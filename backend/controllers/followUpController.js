const { Op } = require("sequelize");
const { FollowUp, Lead, Customer, User } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity } = require("../utils/activity");
const { parseScheduledDate, autoSyncPendingLeadsToFollowUps } = require("../utils/followUpSync");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const REMINDER_TYPES = ["15m", "30m", "1h", "same_day"];
const FOLLOWUP_STATUSES = ["PENDING", "COMPLETED", "OVERDUE"];
const SORTABLE = ["scheduledAt", "status", "createdAt"];

const FOLLOWUP_INCLUDES = [
  { model: User, as: "user", attributes: ["id", "name", "role", "email"], required: false },
  {
    model: Lead,
    as: "lead",
    required: false,
    attributes: ["id", "loanType", "requiredAmount", "status", "leadSource", "assignedEmployeeId", "assignedManagerId"],
    include: [{ model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city"] }],
  },
];

const serialize = (row) => ({
  followup_id: row.id,
  id: row.id,
  lead_id: row.leadId,
  leadId: row.leadId,
  lead_number: `LD-${row.leadId}`,
  leadNumber: `LD-${row.leadId}`,
  lead: row.lead,
  emp_id: row.userId,
  userId: row.userId,
  owner: row.user?.name || null,
  owner_role: row.user?.role || null,
  customer_name: row.lead?.customer?.name || null,
  customer_number: row.lead?.customer?.mobile || null,
  customer_city: row.lead?.customer?.city || null,
  loan_type: row.lead?.loanType || null,
  loan_amount: row.lead?.requiredAmount || null,
  lead_status: row.lead?.status || null,
  lead_source: row.lead?.leadSource || null,
  scheduled_at: row.scheduledAt,
  scheduledAt: row.scheduledAt,
  reminder_type: row.reminderType,
  reminderType: row.reminderType,
  status: row.status,
  remarks: row.remarks,
  createdAt: row.createdAt,
  updatedAt: row.updatedAt,
});

const followUpScope = async (req) => {
  if (
    req.user.role === ROLES.SUPERADMIN ||
    req.user.role === ROLES.COMPANY_ADMIN ||
    req.user.role === ROLES.OPS ||
    req.permissions?.viewAllLeads === true
  ) {
    return {};
  }

  let leadCondition = {};
  let teamIds = [req.user.id];

  if (req.user.role === ROLES.MANAGER) {
    const subordinates = await User.findAll({
      where: { companyId: req.user.companyId, managerId: req.user.id },
      attributes: ["id"],
      raw: true,
    });
    teamIds = [req.user.id, ...subordinates.map((u) => u.id)];
    leadCondition = {
      companyId: req.user.companyId,
      [Op.or]: [
        { assignedManagerId: req.user.id },
        { assignedEmployeeId: { [Op.in]: teamIds } },
      ],
    };
  } else if (req.user.role === ROLES.EMPLOYEE) {
    leadCondition = {
      companyId: req.user.companyId,
      [Op.or]: [
        { assignedEmployeeId: req.user.id },
        { assignedManagerId: req.user.id },
      ],
    };
  }

  const visibleLeads = await Lead.findAll({
    where: leadCondition,
    attributes: ["id"],
    raw: true,
  });

  const visibleLeadIds = visibleLeads.map((l) => l.id);

  return {
    [Op.or]: [
      { userId: { [Op.in]: teamIds } },
      ...(visibleLeadIds.length > 0 ? [{ leadId: { [Op.in]: visibleLeadIds } }] : []),
    ],
  };
};

/**
 * Synchronize a follow-up for a lead.
 * Creates or updates a PENDING follow-up record whenever nextFollowupDate is set.
 */
const syncLeadFollowUp = async (lead, followupDate, options = {}) => {
  if (!lead || !lead.id || !followupDate) return null;

  const when = new Date(followupDate);
  if (Number.isNaN(when.valueOf())) return null;

  const { userId, remarks, reminderType = "same_day", transaction } = options;
  const assignedUserId = userId || lead.assignedEmployeeId || lead.assignedManagerId || null;

  // 1. Ensure lead has the date updated
  if (!lead.nextFollowupDate || new Date(lead.nextFollowupDate).valueOf() !== when.valueOf()) {
    await lead.update({ nextFollowupDate: when }, { transaction });
  }

  // 2. Check if a pending follow-up already exists for this lead
  const existing = await FollowUp.findOne({
    where: {
      leadId: lead.id,
      companyId: lead.companyId,
      status: "PENDING",
    },
    order: [["scheduledAt", "ASC"]],
    transaction,
  });

  if (existing) {
    await existing.update(
      {
        scheduledAt: when,
        userId: assignedUserId || existing.userId,
        remarks: remarks !== undefined ? remarks : existing.remarks,
        reminderType: reminderType || existing.reminderType || "same_day",
      },
      { transaction }
    );
    return existing;
  } else {
    const created = await FollowUp.create(
      {
        companyId: lead.companyId,
        leadId: lead.id,
        userId: assignedUserId || null,
        scheduledAt: when,
        reminderType: reminderType || "same_day",
        status: "PENDING",
        remarks: remarks || "Follow-up scheduled",
      },
      { transaction }
    );
    return created;
  }
};

/**
 * GET /api/followups
 * ?window=today|tomorrow|overdue|upcoming or ?date=YYYY-MM-DD or ?fromDate=...&toDate=...
 */
exports.getFollowUps = async (req, res) => {
  try {
    // Auto-sync any existing leads with nextFollowupDate that lack a FollowUp record
    if (req.user?.companyId) {
      await autoSyncPendingLeadsToFollowUps(req.user.companyId);
    }

    const { limit, offset, order, page } = buildQuery(req.query, {
      sortable: SORTABLE,
      defaultSort: ["scheduledAt", "ASC"],
    });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
    const endOfTomorrow = new Date(endOfToday.getTime() + 86400000);

    const where = {
      ...companyScope(req),
      ...(await followUpScope(req)),
    };

    // Date filtering options
    if (req.query.date) {
      const parts = req.query.date.split("-").map(Number);
      if (parts.length === 3) {
        const dayStart = new Date(parts[0], parts[1] - 1, parts[2], 0, 0, 0, 0);
        const dayEnd = new Date(parts[0], parts[1] - 1, parts[2], 23, 59, 59, 999);
        where.scheduledAt = { [Op.between]: [dayStart, dayEnd] };
      }
    } else if (req.query.fromDate && req.query.toDate) {
      const fParts = req.query.fromDate.split("-").map(Number);
      const tParts = req.query.toDate.split("-").map(Number);
      const start = new Date(fParts[0], fParts[1] - 1, fParts[2], 0, 0, 0, 0);
      const end = new Date(tParts[0], tParts[1] - 1, tParts[2], 23, 59, 59, 999);
      where.scheduledAt = { [Op.between]: [start, end] };
    } else if (req.query.window === "today") {
      where.scheduledAt = { [Op.between]: [startOfToday, endOfToday] };
    } else if (req.query.window === "tomorrow") {
      where.scheduledAt = { [Op.between]: [startOfTomorrow, endOfTomorrow] };
    } else if (req.query.window === "overdue") {
      where.scheduledAt = { [Op.lt]: startOfToday };
      where.status = { [Op.ne]: "COMPLETED" };
    } else if (req.query.window === "upcoming") {
      where.scheduledAt = { [Op.gt]: endOfToday };
      if (!req.query.status) {
        where.status = { [Op.ne]: "COMPLETED" };
      }
    }

    if (req.query.status && req.query.status !== "All") {
      where.status = String(req.query.status).toUpperCase();
    }
    if (req.query.leadId) {
      where.leadId = parseInt(req.query.leadId, 10);
    }

    const targetUserId = req.query.employeeId || req.query.userId;
    if (targetUserId && targetUserId !== "All" && req.user.role !== ROLES.EMPLOYEE) {
      where.userId = parseInt(targetUserId, 10);
    }

    if (req.query.search && req.query.search.trim()) {
      const q = `%${req.query.search.trim()}%`;
      where[Op.or] = [
        { remarks: { [Op.like]: q } },
        { "$lead.customer.name$": { [Op.like]: q } },
        { "$lead.customer.mobile$": { [Op.like]: q } },
      ];
    }

    const { count, rows } = await FollowUp.findAndCountAll({
      where,
      include: FOLLOWUP_INCLUDES,
      limit,
      offset,
      order,
      distinct: true,
    });

    // Calculate quick stats for the user scope
    const baseScope = {
      ...companyScope(req),
      ...(await followUpScope(req)),
      ...(targetUserId && targetUserId !== "All" && req.user.role !== ROLES.EMPLOYEE
        ? { userId: parseInt(targetUserId, 10) }
        : {}),
    };

    const [todayCount, tomorrowCount, overdueCount, completedCount, totalCount] = await Promise.all([
      FollowUp.count({
        where: {
          ...baseScope,
          scheduledAt: { [Op.between]: [startOfToday, endOfToday] },
        },
      }),
      FollowUp.count({
        where: {
          ...baseScope,
          scheduledAt: { [Op.between]: [startOfTomorrow, endOfTomorrow] },
        },
      }),
      FollowUp.count({
        where: {
          ...baseScope,
          scheduledAt: { [Op.lt]: startOfToday },
          status: { [Op.ne]: "COMPLETED" },
        },
      }),
      FollowUp.count({
        where: {
          ...baseScope,
          status: "COMPLETED",
        },
      }),
      FollowUp.count({
        where: baseScope,
      }),
    ]);

    const payload = paginated({ count, rows: rows.map(serialize), page, limit });
    payload.pagination.totalItems = count;
    payload.stats = {
      todayCount,
      tomorrowCount,
      overdueCount,
      completedCount,
      totalCount,
    };

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

    const when = parseScheduledDate(scheduledAt);
    if (!when) {
      return res.status(400).json({ message: "scheduled_at is not a valid date" });
    }

    const reminderType = body.reminder_type || body.reminderType || "same_day";
    if (!REMINDER_TYPES.includes(reminderType)) {
      return res.status(400).json({ message: `reminder_type must be one of: ${REMINDER_TYPES.join(", ")}` });
    }

    const followUp = await syncLeadFollowUp(lead, when, {
      userId: body.emp_id ?? body.userId ?? lead.assignedEmployeeId ?? req.user.id,
      reminderType,
      remarks: body.remarks || null,
    });

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
      const when = parseScheduledDate(req.body.scheduled_at || req.body.scheduledAt);
      if (!when) {
        return res.status(400).json({ message: "scheduled_at is not a valid date" });
      }
      data.scheduledAt = when;
      const lead = await Lead.findByPk(followUp.leadId);
      if (lead) await lead.update({ nextFollowupDate: when });
    }

    await followUp.update(data);

    if (req.body.remarks) {
      await logActivity(req, {
        recordType: "Lead",
        recordId: followUp.leadId,
        action: "UPDATED",
        remarks: req.body.remarks,
        companyId: followUp.companyId,
      });
    }

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
exports.syncLeadFollowUp = syncLeadFollowUp;
