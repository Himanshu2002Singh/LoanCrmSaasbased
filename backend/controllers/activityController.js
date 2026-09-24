const { Op } = require("sequelize");
const { ActivityLog, User } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { companyScope } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const RECORD_TYPES = [
  "Lead",
  "Application",
  "Customer",
  "Document",
  "Attendance",
  "User",
  "Branch",
  "Lender",
  "Other",
];

const ACTIONS = [
  "CREATED",
  "STATUS_CHANGED",
  "ASSIGNED",
  "DOC_UPLOADED",
  "VERIFIED",
  "QUERY_RAISED",
  "DISBURSED",
  "UPDATED",
  "DELETED",
];

const SORTABLE = ["createdAt", "action", "recordType"];

const serialize = (row, actors) => {
  const actor = actors.get(row.actorUserId);
  return {
    id: row.id,
    record_type: row.recordType,
    record_id: row.recordId,
    action: row.action,
    old_value: row.oldValue,
    new_value: row.newValue,
    remarks: row.remarks,
    actor_id: row.actorUserId,
    actor: actor?.name || null,
    actor_role: actor?.role || null,
    source_panel: row.sourcePanel,
    ip_address: row.ipAddress,
    createdAt: row.createdAt,
  };
};

/**
 * There is no association between ActivityLog and User, so the actor cannot be
 * joined in. One lookup resolves every distinct actor on the page and the names
 * are stitched onto the rows in memory - one extra query, never one per row.
 */
const loadActors = async (rows) => {
  const ids = [...new Set(rows.map((row) => row.actorUserId).filter((id) => id !== null && id !== undefined))];
  if (!ids.length) return new Map();

  const users = await User.findAll({
    where: { id: { [Op.in]: ids } },
    attributes: ["id", "name", "role"],
    raw: true,
  });
  return new Map(users.map((user) => [user.id, user]));
};

/**
 * GET /api/activity
 * ?recordType&recordId&action&actorUserId&fromDate&toDate plus paging.
 *
 * The trail is append-only: there is no write, update or delete endpoint here
 * by design. Entries are produced by the controllers that make the changes.
 */
exports.getActivity = async (req, res) => {
  try {
    const { limit, offset, order, page, search } = buildQuery(req.query, {
      sortable: SORTABLE,
      defaultSort: ["createdAt", "DESC"],
    });

    const where = { ...companyScope(req) };

    if (req.query.recordType) {
      if (!RECORD_TYPES.includes(req.query.recordType)) {
        return res.status(400).json({ message: `recordType must be one of: ${RECORD_TYPES.join(", ")}` });
      }
      where.recordType = req.query.recordType;
    }
    if (req.query.recordId) where.recordId = parseInt(req.query.recordId, 10);
    if (req.query.action) {
      const action = String(req.query.action).toUpperCase();
      if (!ACTIONS.includes(action)) {
        return res.status(400).json({ message: `action must be one of: ${ACTIONS.join(", ")}` });
      }
      where.action = action;
    }
    if (req.query.actorUserId) where.actorUserId = parseInt(req.query.actorUserId, 10);
    if (search) where.remarks = { [Op.like]: `%${search}%` };

    if (req.query.fromDate || req.query.toDate) {
      where.createdAt = {};
      if (req.query.fromDate) where.createdAt[Op.gte] = new Date(`${req.query.fromDate}T00:00:00`);
      if (req.query.toDate) where.createdAt[Op.lte] = new Date(`${req.query.toDate}T23:59:59`);
    }

    // An employee may read the trail of their own actions only.
    if (req.user.role === ROLES.EMPLOYEE) where.actorUserId = req.user.id;

    const { count, rows } = await ActivityLog.findAndCountAll({
      where,
      limit,
      offset,
      order,
    });

    const actors = await loadActors(rows);
    const payload = paginated({ count, rows: rows.map((row) => serialize(row, actors)), page, limit });
    payload.pagination.totalItems = count;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[activity] getActivity error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/activity/:recordType/:recordId - one record's timeline, oldest
 * first, which is how a detail screen reads it.
 */
exports.getRecordTimeline = async (req, res) => {
  try {
    const { recordType, recordId } = req.params;
    if (!RECORD_TYPES.includes(recordType)) {
      return res.status(400).json({ message: `recordType must be one of: ${RECORD_TYPES.join(", ")}` });
    }

    const { limit, offset, page } = buildQuery(req.query, { defaultLimit: 100 });

    const { count, rows } = await ActivityLog.findAndCountAll({
      where: { ...companyScope(req), recordType, recordId: parseInt(recordId, 10) },
      limit,
      offset,
      order: [["createdAt", "ASC"]],
    });

    const actors = await loadActors(rows);
    const payload = paginated({ count, rows: rows.map((row) => serialize(row, actors)), page, limit });
    payload.pagination.totalItems = count;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[activity] getRecordTimeline error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.RECORD_TYPES = RECORD_TYPES;
exports.ACTIONS = ACTIONS;
