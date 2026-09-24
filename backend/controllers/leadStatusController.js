const { MasterConfig, Lead } = require("../models");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const {
  TEAMS,
  teamForStatus,
  isProtectedStatus,
  resolveInitialStatus,
  OPS_HANDOFF_STATUS_VALUE,
} = require("../constants/leadWorkflow");

/**
 * Lead statuses are MasterConfig rows of type LEAD_STATUS. This controller is
 * the status-shaped view of that table, so the panel and the mobile app keep
 * the `status_id` / `name` / `team` fields they already read.
 *
 * master_configs stores only label, value, colour, order and the active flag.
 * Which team owns a status, which one a new lead starts on and which one hands
 * the file to operations are behaviour, not columns: they are computed per
 * request from constants/leadWorkflow, keyed on the row's stable `value`.
 */
const CONFIG_TYPE = "LEAD_STATUS";

// Response fields that are computed rather than stored. A request may still
// send them — older clients do — so they are reported back as ignored instead
// of being written or rejected.
const DERIVED_FIELDS = ["is_initial", "is_file_login"];

const ORDER = [
  ["orderIndex", "ASC"],
  ["label", "ASC"],
];

const slugify = (label) =>
  label.trim().toUpperCase().replace(/[^A-Z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 100);

const loadStatusRows = (companyId) =>
  MasterConfig.findAll({ where: { companyId, configType: CONFIG_TYPE }, order: ORDER });

const readOnlyKeys = (body = {}) => DERIVED_FIELDS.filter((field) => body[field] !== undefined);

const toStatus = (row, initialId = null) => ({
  status_id: row.id,
  name: row.label,
  value: row.value,
  team: row.team || teamForStatus(row.value, row.team),
  sort_order: row.orderIndex,
  is_initial: row.id === initialId,
  is_file_login: row.value === OPS_HANDOFF_STATUS_VALUE,
  is_active: row.isActive,
  is_protected: isProtectedStatus(row.value),
  color_code: row.colorCode,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

/**
 * Resolves the starting status once per company. A SuperAdmin listing without a
 * companyId filter gets rows from several companies at once, and each company has
 * its own initial status, so they cannot share one answer.
 */
const initialIdByCompany = (rows) => {
  const grouped = new Map();
  for (const row of rows) {
    if (!grouped.has(row.companyId)) grouped.set(row.companyId, []);
    grouped.get(row.companyId).push(row);
  }

  const initial = new Map();
  for (const [companyId, companyRows] of grouped) {
    initial.set(companyId, resolveInitialStatus(companyRows)?.id ?? null);
  }
  return initial;
};

/**
 * GET /api/lead-statuses?team=&includeInactive=
 */
exports.getLeadStatuses = async (req, res) => {
  try {
    const where = { ...companyScope(req), configType: CONFIG_TYPE };
    const rows = await MasterConfig.findAll({ where, order: ORDER });

    // Resolved over the whole configured set, so the initial flag does not jump
    // to another row just because the caller asked to hide inactive statuses.
    const initial = initialIdByCompany(rows);

    const includeInactive = req.query.includeInactive === "true";
    let teamFilter = req.query.team;

    // Auto-scope by user role if team parameter is omitted
    if (!teamFilter && req.user) {
      if (req.user.role === "OPS") {
        teamFilter = TEAMS.OPERATIONS;
      } else if (req.user.role === "EMPLOYEE" || req.user.role === "MANAGER") {
        teamFilter = TEAMS.CALLING;
      }
    }

    const statuses = rows
      .filter((row) => includeInactive || row.isActive)
      .filter((row) => {
        if (!teamFilter) return true;
        const rowTeam = row.team || teamForStatus(row.value, row.team);
        return rowTeam === teamFilter || rowTeam === TEAMS.BOTH;
      })
      .map((row) => toStatus(row, initial.get(row.companyId) ?? null));

    return res.status(200).json({ success: true, statuses });
  } catch (error) {
    console.error("[leadStatus] getLeadStatuses error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/lead-statuses
 *
 * team / is_initial / is_file_login are accepted and ignored; the response
 * lists them under `readOnly` so a caller is never left believing a write
 * landed. Ordering is the lever that replaces is_initial: a new lead starts on
 * the declared starting status, and if that one is missing or retired, on
 * whichever status sorts first — so sort_order decides the stand-in.
 */
exports.createLeadStatus = async (req, res) => {
  try {
    const { name, sort_order: sortOrder = 100, color_code: colorCode = null, team = null } = req.body;

    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Status name is required" });
    }

    const companyId = req.user.companyId || parseInt(req.body.companyId, 10);
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const value = slugify(name);
    const clash = await MasterConfig.findOne({ where: { companyId, configType: CONFIG_TYPE, value } });
    if (clash) {
      return res.status(409).json({ message: "A status with this name already exists" });
    }

    const validTeam = [TEAMS.CALLING, TEAMS.OPERATIONS, TEAMS.BOTH].includes(team)
      ? team
      : teamForStatus(value);

    const row = await MasterConfig.create({
      companyId,
      configType: CONFIG_TYPE,
      label: name.trim(),
      value,
      orderIndex: sortOrder,
      colorCode,
      isActive: true,
      team: validTeam,
    });

    await logActivity(req, {
      recordType: "Other",
      recordId: row.id,
      action: "CREATED",
      newValue: { configType: CONFIG_TYPE, label: row.label, value: row.value, team: row.team },
      companyId,
    });

    // The new row can itself become the initial one when it sorts ahead of the
    // rest, so the flag is re-resolved against the saved set.
    const initialId = resolveInitialStatus(await loadStatusRows(companyId))?.id ?? null;

    return res.status(201).json({
      success: true,
      status: toStatus(row, initialId),
      readOnly: readOnlyKeys(req.body),
    });
  } catch (error) {
    console.error("[leadStatus] createLeadStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/lead-statuses/:id
 *
 * Renaming is free: `value` is the key leads store and the workflow constants
 * key on, so an edit touches the label and never the value. team / is_initial /
 * is_file_login are handled; reordering is how an admin steers which status a
 * new lead starts on.
 */
exports.updateLeadStatus = async (req, res) => {
  try {
    const row = await MasterConfig.findByPk(req.params.id);
    if (!row || row.configType !== CONFIG_TYPE || !belongsToScope(req, row)) {
      return res.status(404).json({ message: "Status not found" });
    }

    const body = req.body;
    const data = {};
    if (body.name !== undefined) data.label = String(body.name).trim();
    if (body.sort_order !== undefined) data.orderIndex = body.sort_order;
    if (body.is_active !== undefined) data.isActive = body.is_active;
    if (body.color_code !== undefined) data.colorCode = body.color_code;
    if (body.team !== undefined && [TEAMS.CALLING, TEAMS.OPERATIONS, TEAMS.BOTH].includes(body.team)) {
      data.team = body.team;
    }

    // Deactivating the status leads currently sit on would strand them.
    if (data.isActive === false) {
      const inUse = await Lead.count({ where: { companyId: row.companyId, status: row.value } });
      if (inUse) {
        return res.status(409).json({ message: `${inUse} lead(s) currently hold this status` });
      }
    }

    // get({plain:true}) hands back the live dataValues object, so the before
    // snapshot has to be a copy or the diff compares the row against itself.
    const before = { ...row.get({ plain: true }) };
    await row.update(data);

    const diff = diffFields(before, { ...row.get({ plain: true }) }, [
      "label",
      "orderIndex",
      "isActive",
      "colorCode",
      "team",
    ]);
    if (diff) {
      await logActivity(req, {
        recordType: "Other",
        recordId: row.id,
        action: "UPDATED",
        ...diff,
        companyId: row.companyId,
      });
    }

    const initialId = resolveInitialStatus(await loadStatusRows(row.companyId))?.id ?? null;

    return res.status(200).json({
      success: true,
      status: toStatus(row, initialId),
      readOnly: readOnlyKeys(body),
    });
  } catch (error) {
    console.error("[leadStatus] updateLeadStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/lead-statuses/:id
 */
exports.deleteLeadStatus = async (req, res) => {
  try {
    const row = await MasterConfig.findByPk(req.params.id);
    if (!row || row.configType !== CONFIG_TYPE || !belongsToScope(req, row)) {
      return res.status(404).json({ message: "Status not found" });
    }

    // The starting status and the operations handoff status are the two the
    // workflow transitions name outright; removing either breaks them.
    if (isProtectedStatus(row.value)) {
      return res.status(400).json({ message: "This system status cannot be deleted" });
    }

    const inUse = await Lead.count({ where: { companyId: row.companyId, status: row.value } });
    if (inUse) {
      return res.status(409).json({ message: `${inUse} lead(s) currently hold this status` });
    }

    await logActivity(req, {
      recordType: "Other",
      recordId: row.id,
      action: "DELETED",
      oldValue: { configType: CONFIG_TYPE, label: row.label, value: row.value },
      companyId: row.companyId,
    });

    await row.destroy();
    return res.status(200).json({ success: true, message: "Status deleted successfully" });
  } catch (error) {
    console.error("[leadStatus] deleteLeadStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

exports.CONFIG_TYPE = CONFIG_TYPE;
exports.toStatus = toStatus;
