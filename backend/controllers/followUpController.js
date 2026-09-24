const { Op } = require("sequelize");
const { FollowUp, Lead, Customer, User } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const REMINDER_TYPES = ["15m", "30m", "1h", "same_day"];
const FOLLOWUP_STATUSES = ["PENDING", "COMPLETED", "OVERDUE"];
const SORTABLE = ["scheduledAt", "status", "createdAt"];

const FOLLOWUP_INCLUDES = [
  { model: User, as: "user", attributes: ["id", "name", "role"], required: false },
  {
    model: Lead,
    as: "lead",
    required: false,
    include: [{ model: Customer, as: "customer", attributes: ["id", "name", "mobile"] }],
  },
];

const serialize = (row) => ({
  followup_id: row.id,
  id: row.id,
  lead_id: row.leadId,
  emp_id: row.userId,
  owner: row.user?.name || null,
  customer_name: row.lead?.customer?.name || null,
  customer_number: row.lead?.customer?.mobile || null,
  scheduled_at: row.scheduledAt,
  reminder_type: row.reminderType,
  status: row.status,
  remarks: row.remarks,
  createdAt: row.createdAt,
});

const followUpScope = async (req) => {
  if (req.user.role === ROLES.EMPLOYEE) return { userId: req.user.id };
  if (req.user.role === ROLES.MANAGER) {
    const subordinates = await User.findAll({
      where: { companyId: req.user.companyId, managerId: req.user.id },
      attributes: ["id"],
      raw: true,
    });
    const teamIds = [req.user.id, ...subordinates.map((u) => u.id)];
    return { userId: { [Op.in]: teamIds } };
  }
  return {};
};

/**
 * GET /api/followups
 * ?window=today|overdue|upcoming plus the usual paging and sorting
 */
exports.getFollowUps = async (req, res) => {
  try {
    const { limit, offset, order, page } = buildQuery(req.query, {
      sortable: SORTABLE,
      defaultSort: ["scheduledAt", "ASC"],
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86399999);

    const where = {
      ...companyScope(req),
      ...(await followUpScope(req)),
    };

    if (req.query.window === "today") where.scheduledAt = { [Op.between]: [startOfToday, endOfToday] };
    if (req.query.window === "overdue") {
      where.scheduledAt = { [Op.lt]: startOfToday };
      where.status = { [Op.ne]: "COMPLETED" };
    }
    if (req.query.window === "upcoming") where.scheduledAt = { [Op.gt]: endOfToday };

    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    if (req.query.leadId) where.leadId = parseInt(req.query.leadId, 10);
    if (req.query.userId && req.user.role !== ROLES.EMPLOYEE) {
      where.userId = parseInt(req.query.userId, 10);
    }

    const { count, rows } = await FollowUp.findAndCountAll({
      where,
      include: FOLLOWUP_INCLUDES,
      limit,
      offset,
      order,
      distinct: true,
    });

    const payload = paginated({ count, rows: rows.map(serialize), page, limit });
    payload.pagination.totalItems = count;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[followups] getFollowUps error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/followups
 * Scheduling one also moves the lead's next_followup_date, so the lead list
 * and the follow-up queue cannot drift apart.
 */
exports.createFollowUp = async (req, res) => {
  try {
    const body = req.body;
    const leadId = body.lead_id ?? body.leadId;
    if (!leadId) return res.status(400).json({ message: "lead_id is required" });

    const lead = await Lead.findByPk(leadId);
    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const scheduledAt = body.scheduled_at || body.scheduledAt;
    if (!scheduledAt) return res.status(400).json({ message: "scheduled_at is required" });

    const when = new Date(scheduledAt);
    if (Number.isNaN(when.valueOf())) {
      return res.status(400).json({ message: "scheduled_at is not a valid date" });
    }

    const reminderType = body.reminder_type || body.reminderType || "same_day";
    if (!REMINDER_TYPES.includes(reminderType)) {
      return res.status(400).json({ message: `reminder_type must be one of: ${REMINDER_TYPES.join(", ")}` });
    }

    const followUp = await FollowUp.create({
      companyId: lead.companyId,
      leadId: lead.id,
      userId: body.emp_id ?? body.userId ?? req.user.id,
      scheduledAt: when,
      reminderType,
      status: "PENDING",
      remarks: body.remarks || null,
    });

    await lead.update({ nextFollowupDate: when });

    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "UPDATED",
      newValue: { nextFollowupDate: when },
      remarks: `Follow-up scheduled: ${followUp.remarks || "no note"}`,
      companyId: lead.companyId,
    });

    const created = await FollowUp.findByPk(followUp.id, { include: FOLLOWUP_INCLUDES });
    return res.status(201).json({ message: "Follow-up scheduled", data: serialize(created) });
  } catch (error) {
    console.error("[followups] createFollowUp error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/followups/:id
 */
exports.updateFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findByPk(req.params.id);
    if (!followUp || !belongsToScope(req, followUp)) {
      return res.status(404).json({ message: "Follow-up not found" });
    }
    if (req.user.role === ROLES.EMPLOYEE && followUp.userId !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own follow-ups" });
    }

    const data = {};
    if (req.body.status) {
      const status = String(req.body.status).toUpperCase();
      if (!FOLLOWUP_STATUSES.includes(status)) {
        return res.status(400).json({ message: `status must be one of: ${FOLLOWUP_STATUSES.join(", ")}` });
      }
      data.status = status;
    }
    if (req.body.remarks !== undefined) data.remarks = req.body.remarks;
    if (req.body.scheduled_at || req.body.scheduledAt) {
      const when = new Date(req.body.scheduled_at || req.body.scheduledAt);
      if (Number.isNaN(when.valueOf())) {
        return res.status(400).json({ message: "scheduled_at is not a valid date" });
      }
      data.scheduledAt = when;
      const lead = await Lead.findByPk(followUp.leadId);
      if (lead) await lead.update({ nextFollowupDate: when });
    }

    await followUp.update(data);
    const updated = await FollowUp.findByPk(followUp.id, { include: FOLLOWUP_INCLUDES });
    return res.status(200).json({ message: "Follow-up updated", data: serialize(updated) });
  } catch (error) {
    console.error("[followups] updateFollowUp error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/followups/:id
 */
exports.deleteFollowUp = async (req, res) => {
  try {
    const followUp = await FollowUp.findByPk(req.params.id);
    if (!followUp || !belongsToScope(req, followUp)) {
      return res.status(404).json({ message: "Follow-up not found" });
    }
    if (req.user.role === ROLES.EMPLOYEE && followUp.userId !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own follow-ups" });
    }

    await followUp.destroy();
    return res.status(200).json({ message: "Follow-up deleted" });
  } catch (error) {
    console.error("[followups] deleteFollowUp error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.REMINDER_TYPES = REMINDER_TYPES;
