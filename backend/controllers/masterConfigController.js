const { Op } = require("sequelize");
const { MasterConfig, Lead, Application } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");

/**
 * Every admin-configurable list lives in one table, told apart by config_type:
 * lead statuses, application statuses, loan products, document types, lead
 * sources and the rejection/query reason lists.
 */
const CONFIG_TYPES = [
  "LEAD_STATUS",
  "APP_STATUS",
  "LOAN_PRODUCT",
  "DOC_TYPE",
  "LEAD_SOURCE",
  "REJECTION_REASON",
  "QUERY_REASON",
];

const SEARCHABLE = ["label", "value"];
const SORTABLE = ["label", "value", "orderIndex", "createdAt"];
const EDITABLE = ["label", "value", "colorCode", "orderIndex", "isActive", "commissionPercent", "code"];

const slugify = (label) =>
  label
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 100);

const pick = (body, fields) => {
  const data = {};
  if (body.commission_percent !== undefined && body.commissionPercent === undefined) {
    body.commissionPercent = body.commission_percent;
  }
  for (const field of fields) {
    if (body[field] === undefined) continue;
    data[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
  }
  return data;
};

const requireConfigType = (req, res) => {
  const configType = (req.params.configType || req.query.configType || "").toUpperCase();
  if (!CONFIG_TYPES.includes(configType)) {
    res.status(400).json({ message: `configType must be one of: ${CONFIG_TYPES.join(", ")}` });
    return null;
  }
  return configType;
};

/**
 * GET /api/master-configs/:configType
 * ?page&limit&search&sortBy&sortDir&includeInactive
 *
 * Answers unpaginated by default: these lists feed dropdowns and are small.
 * Pass ?paginate=true for the admin management table.
 */
exports.list = async (req, res) => {
  try {
    const configType = requireConfigType(req, res);
    if (!configType) return;

    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: SEARCHABLE,
      sortable: SORTABLE,
      defaultSort: ["orderIndex", "ASC"],
      defaultLimit: 200,
    });

    Object.assign(where, companyScope(req), { configType });
    if (req.query.includeInactive !== "true") where.isActive = true;

    if (req.query.paginate === "true") {
      const { count, rows } = await MasterConfig.findAndCountAll({ where, limit, offset, order });
      return res.status(200).json(paginated({ count, rows, page, limit }));
    }

    const rows = await MasterConfig.findAll({ where, order });
    return res.status(200).json({ message: "success", data: rows });
  } catch (error) {
    console.error("[masterConfig] list error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/master-configs - every list in one call, grouped by type, for the
 * dropdowns a screen needs on first paint.
 */
exports.listAll = async (req, res) => {
  try {
    const where = { ...companyScope(req) };
    if (req.query.includeInactive !== "true") where.isActive = true;

    const rows = await MasterConfig.findAll({
      where,
      order: [
        ["configType", "ASC"],
        ["orderIndex", "ASC"],
      ],
    });

    const grouped = Object.fromEntries(CONFIG_TYPES.map((type) => [type, []]));
    for (const row of rows) {
      if (grouped[row.configType]) grouped[row.configType].push(row);
    }

    return res.status(200).json({ message: "success", data: grouped });
  } catch (error) {
    console.error("[masterConfig] listAll error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/master-configs/:configType
 */
exports.create = async (req, res) => {
  try {
    const configType = requireConfigType(req, res);
    if (!configType) return;

    const data = pick(req.body, EDITABLE);
    if (!data.label) {
      return res.status(400).json({ message: "label is required" });
    }

    const companyId = req.user.companyId || parseInt(req.body.companyId, 10);
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    data.value = data.value ? slugify(data.value) : slugify(data.label);

    const clash = await MasterConfig.findOne({ where: { companyId, configType, value: data.value } });
    if (clash) {
      return res.status(409).json({ message: `${configType} "${data.value}" already exists` });
    }

    const config = await MasterConfig.create({ ...data, companyId, configType });

    await logActivity(req, {
      recordType: "Other",
      recordId: config.id,
      action: "CREATED",
      newValue: { configType, label: config.label, value: config.value },
      companyId,
    });

    return res.status(201).json({ message: `${configType} created`, data: config });
  } catch (error) {
    console.error("[masterConfig] create error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/master-configs/:id
 *
 * `value` is deliberately not editable: leads and applications store it as
 * their status, so changing it would orphan every row already using it. Edit
 * the label instead, or deactivate and create a replacement.
 */
exports.update = async (req, res) => {
  try {
    const config = await MasterConfig.findByPk(req.params.id);
    if (!config || !belongsToScope(req, config)) {
      return res.status(404).json({ message: "Config not found" });
    }

    const data = pick(req.body, EDITABLE.filter((f) => f !== "value"));
    const before = { ...config.get({ plain: true }) };
    await config.update(data);

    const diff = diffFields(before, { ...config.get({ plain: true }) }, EDITABLE);
    if (diff) {
      await logActivity(req, {
        recordType: "Other",
        recordId: config.id,
        action: "UPDATED",
        ...diff,
        companyId: config.companyId,
      });
    }

    return res.status(200).json({ message: "Config updated", data: config });
  } catch (error) {
    console.error("[masterConfig] update error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/master-configs/:id
 * Deactivates rather than deletes, so historical rows keep resolving their
 * status label. Pass ?hard=true to actually remove one nothing references.
 */
exports.remove = async (req, res) => {
  try {
    const config = await MasterConfig.findByPk(req.params.id);
    if (!config || !belongsToScope(req, config)) {
      return res.status(404).json({ message: "Config not found" });
    }

    if (req.query.hard === "true") {
      // Both counts stay pinned to this row's company: the same status value
      // exists independently in every company's list.
      const inUse =
        (config.configType === "LEAD_STATUS" &&
          (await Lead.count({ where: { status: config.value, companyId: config.companyId } }))) ||
        (config.configType === "APP_STATUS" &&
          (await Application.count({
            where: { status: config.value, companyId: config.companyId },
          })));

      if (inUse) {
        return res.status(409).json({ message: "In use by existing records; deactivate it instead" });
      }

      await config.destroy();
      await logActivity(req, {
        recordType: "Other",
        recordId: config.id,
        action: "DELETED",
        oldValue: { configType: config.configType, value: config.value },
        companyId: config.companyId,
      });
      return res.status(200).json({ message: "Config deleted" });
    }

    await config.update({ isActive: false });
    await logActivity(req, {
      recordType: "Other",
      recordId: config.id,
      action: "STATUS_CHANGED",
      oldValue: { isActive: true },
      newValue: { isActive: false },
      companyId: config.companyId,
    });

    return res.status(200).json({ message: "Config deactivated", data: config });
  } catch (error) {
    console.error("[masterConfig] remove error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/master-configs/:configType/reorder
 * Body: { order: [id, id, ...] } - positions come from the array index.
 */
exports.reorder = async (req, res) => {
  try {
    const configType = requireConfigType(req, res);
    if (!configType) return;

    const { order } = req.body;
    if (!Array.isArray(order) || !order.length) {
      return res.status(400).json({ message: "order must be a non-empty array of ids" });
    }

    const scope = { ...companyScope(req), configType, id: { [Op.in]: order } };
    const rows = await MasterConfig.findAll({ where: scope });

    await Promise.all(
      rows.map((row) => row.update({ orderIndex: (order.indexOf(row.id) + 1) * 10 }))
    );

    return res.status(200).json({ message: "Order updated", data: rows.length });
  } catch (error) {
    console.error("[masterConfig] reorder error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.CONFIG_TYPES = CONFIG_TYPES;
