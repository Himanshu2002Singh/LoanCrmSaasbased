const { Op, fn, col, literal } = require("sequelize");
const XLSX = require("xlsx");
const { Lead, Customer, User, MasterConfig, CallLog, FollowUp, ActivityLog, Application, Document, Lender, LeadDocumentRequest, LeadAssignmentHistory, Note, sequelize } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { parseScheduledDate, syncLeadFollowUp } = require("../utils/followUpSync");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { findOrCreateCustomer, normaliseMobile } = require("./customerController");
const { ROLES } = require("../constants/roles");
const { teamForStatus, resolveInitialStatus, STATUS_TEAMS } = require("../constants/leadWorkflow");

// A caller may pull only this many leads from the unassigned pool at once.
const MAX_SELF_ASSIGN_LEADS = 50;

// How many row remarks a bulk import folds into its single audit entry before
// it stops listing them, so one big sheet cannot bloat the audit row.
const MAX_IMPORT_REMARKS_LOGGED = 20;

const LEAD_FIELDS = ["leadSource", "loanType", "requiredAmount", "priority", "nextFollowupDate", "commissionPercent"];
const SORTABLE = ["createdAt", "nextFollowupDate", "status", "priority", "requiredAmount"];

const LEAD_INCLUDES = [
  { model: Customer, as: "customer", required: true },
  { model: User, as: "assignedEmployee", attributes: ["id", "name", "role"], required: false },
  { model: User, as: "assignedManager", attributes: ["id", "name", "role"], required: false },
  {
    model: Application,
    as: "applications",
    required: false,
    include: [{ model: Lender, as: "lender", attributes: ["id", "name", "shortCode", "lenderType"] }],
  },
];

const pick = (body, fields) => {
  const data = {};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    data[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
  }
  return data;
};

/**
 * A lead row has no column for free text, so a remark sent with a write is
 * carried into that write's audit entry instead of onto the lead itself.
 * Both spellings the clients send are accepted.
 */
const remarkOf = (body) => {
  const value = body.remark ?? body.remarks;
  if (value === undefined || value === null) return null;
  const text = String(value).trim();
  return text || null;
};

/**
 * Tracks lead assignment/reassignment in LeadAssignmentHistory and ActivityLog.
 * Closes previous assignment for fromUserId, creates active record for toUserId,
 * and maintains complete collaboration trail.
 */
const trackLeadAssignment = async ({ companyId, leadId, fromUserId, toUserId, assignedById, reason, req, transaction }) => {
  try {
    if (toUserId || fromUserId) {
      await LeadAssignmentHistory.update(
        { isActive: false, unassignedAt: new Date() },
        { where: { leadId, isActive: true }, ...(transaction ? { transaction } : {}) }
      );
    }

    const userIds = [fromUserId, toUserId, assignedById].filter(Boolean);
    const users = userIds.length
      ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ["id", "name", "role"], raw: true, ...(transaction ? { transaction } : {}) })
      : [];
    const userMap = new Map(users.map((u) => [u.id, u.name]));
    const fromName = userMap.get(fromUserId) || (fromUserId ? `User #${fromUserId}` : "Unassigned");
    const toName = userMap.get(toUserId) || (toUserId ? `User #${toUserId}` : "Unassigned");
    const assignerName = userMap.get(assignedById) || req?.user?.name || "System";

    if (toUserId) {
      await LeadAssignmentHistory.create(
        {
          companyId,
          leadId,
          userId: toUserId,
          assignedById: assignedById || req?.user?.id || null,
          assignedAt: new Date(),
          isActive: true,
          notes: reason || `Assigned to ${toName} by ${assignerName}`,
        },
        { ...(transaction ? { transaction } : {}) }
      );
    }

    if (req) {
      await logActivity(req, {
        recordType: "Lead",
        recordId: leadId,
        action: "ASSIGNED",
        oldValue: { assignedEmployeeId: fromUserId || null, assignedTo: fromName },
        newValue: { assignedEmployeeId: toUserId || null, assignedTo: toName },
        remarks: reason || (fromUserId ? `Reassigned from ${fromName} to ${toName} by ${assignerName}` : `Assigned to ${toName} by ${assignerName}`),
        companyId,
      });
    }
  } catch (err) {
    console.error("[trackLeadAssignment] error:", err);
  }
};

/**
 * Resolves the most recent remark with timestamp and author across
 * ActivityLog, FollowUp, and CallLog for an array of lead IDs in one batch.
 */
const getLatestRemarksForLeads = async (leadIds, companyId) => {
  if (!leadIds || !leadIds.length) return new Map();

  const companyWhere = companyId ? { companyId } : {};

  const [activities, followups, calls] = await Promise.all([
    ActivityLog.findAll({
      where: {
        ...companyWhere,
        recordType: "Lead",
        recordId: { [Op.in]: leadIds },
        remarks: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
      },
      order: [["createdAt", "DESC"]],
      attributes: ["recordId", "remarks", "createdAt", "actorUserId"],
    }),
    FollowUp.findAll({
      where: {
        ...companyWhere,
        leadId: { [Op.in]: leadIds },
        remarks: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
      },
      order: [["updatedAt", "DESC"]],
      attributes: ["leadId", "remarks", "createdAt", "updatedAt", "userId"],
    }),
    CallLog.findAll({
      where: {
        ...companyWhere,
        leadId: { [Op.in]: leadIds },
        remarks: { [Op.and]: [{ [Op.ne]: null }, { [Op.ne]: "" }] },
      },
      order: [["createdAt", "DESC"]],
      attributes: ["leadId", "remarks", "createdAt", "userId"],
    }),
  ]);

  const userIds = new Set();
  activities.forEach((a) => { if (a.actorUserId) userIds.add(a.actorUserId); });
  followups.forEach((f) => { if (f.userId) userIds.add(f.userId); });
  calls.forEach((c) => { if (c.userId) userIds.add(c.userId); });

  const users = userIds.size > 0
    ? await User.findAll({
        where: { id: { [Op.in]: Array.from(userIds) } },
        attributes: ["id", "name", "role"],
        raw: true,
      })
    : [];
  const userMap = new Map(users.map((u) => [u.id, u.name]));

  const latestMap = new Map();

  const consider = (leadId, remark, dateStr, actorId, type) => {
    if (!remark || !String(remark).trim()) return;
    const time = new Date(dateStr).getTime();
    if (isNaN(time)) return;
    const existing = latestMap.get(leadId);
    if (!existing || time > existing.timestamp) {
      latestMap.set(leadId, {
        remarks: String(remark).trim(),
        createdAt: new Date(dateStr).toISOString(),
        actorUserId: actorId,
        actor: userMap.get(actorId) || null,
        type,
        timestamp: time,
      });
    }
  };

  activities.forEach((a) => consider(a.recordId, a.remarks, a.createdAt, a.actorUserId, "Activity"));
  followups.forEach((f) => consider(f.leadId, f.remarks, f.updatedAt || f.createdAt, f.userId, "FollowUp"));
  calls.forEach((c) => consider(c.leadId, c.remarks, c.createdAt, c.userId, "CallLog"));

  return latestMap;
};

/**
 * Calculates monthly sequential lead code (e.g. OCT26-001, OCT26-027)
 * Company-wise, starting at 1 every single month for each company separately.
 */
const getMonthlySequenceCodesForLeads = async (leads, companyId) => {
  if (!leads || !leads.length) return new Map();
  const resultMap = new Map();
  const monthNames = ["JAN", "FEB", "MAR", "APR", "MAY", "JUN", "JUL", "AUG", "SEP", "OCT", "NOV", "DEC"];

  try {
    await Promise.all(
      leads.map(async (lead) => {
        const rawDate = lead.createdAt || lead.created_at || new Date();
        const d = new Date(rawDate);
        const y = d.getFullYear();
        const m = d.getMonth();
        const startOfMonth = new Date(y, m, 1, 0, 0, 0, 0);
        const endOfMonth = new Date(y, m + 1, 0, 23, 59, 59, 999);
        const mStr = monthNames[m] || "OCT";
        const yStr = String(y).slice(-2);

        const targetCompanyId = companyId || lead.companyId;

        // Count leads in this company for this month with id <= lead.id
        const seqCount = await Lead.count({
          where: {
            companyId: targetCompanyId,
            createdAt: { [Op.between]: [startOfMonth, endOfMonth] },
            id: { [Op.lte]: lead.id },
          },
        });

        const formattedCode = `${mStr}${yStr}-${String(seqCount || 1).padStart(3, "0")}`;
        resultMap.set(lead.id, {
          monthSequence: seqCount || 1,
          leadCode: formattedCode,
        });
      })
    );
  } catch (err) {
    console.warn("[getMonthlySequenceCodesForLeads] Calculation warning:", err.message);
  }

  return resultMap;
};

/**
 * The panel and the mobile app read a flat lead row with the customer's
 * details inlined. Keep that shape and hang the nested records off it.
 */
const serializeLead = (lead, statusMap = {}, requestingUser = null, latestRemarkInfo = null, seqInfo = {}) => {
  const customer = lead.customer || {};
  const status = statusMap[lead.status];
  const apps = lead.applications || [];
  const primaryApp =
    apps.find((a) => a.disbursedAmount || a.sanctionedAmount || a.status === "SANCTIONED" || a.status === "DISBURSED") ||
    apps[0] ||
    null;
  const disbursedAmount = primaryApp?.disbursedAmount
    ? parseFloat(primaryApp.disbursedAmount)
    : (primaryApp?.status === "DISBURSED" ? (parseFloat(primaryApp.sanctionedAmount) || parseFloat(primaryApp.appliedAmount) || (lead.requiredAmount ? parseFloat(lead.requiredAmount) : null)) : null);
  const sanctionedAmount = primaryApp?.sanctionedAmount ? parseFloat(primaryApp.sanctionedAmount) : null;
  const appliedAmount = primaryApp?.appliedAmount
    ? parseFloat(primaryApp.appliedAmount)
    : lead.requiredAmount
    ? parseFloat(lead.requiredAmount)
    : null;
  const bankName = primaryApp?.lender?.name || null;
  const sanctionDate = primaryApp?.sanctionedAmount ? primaryApp.updatedAt : null;
  
  const isEmployee = requestingUser && (requestingUser.role === ROLES.EMPLOYEE || requestingUser.role === "EMPLOYEE");
  const commPercent =
    !isEmployee && lead.commissionPercent !== null && lead.commissionPercent !== undefined
      ? parseFloat(lead.commissionPercent)
      : null;
  const baseAmount = disbursedAmount || sanctionedAmount || appliedAmount || (lead.requiredAmount ? parseFloat(lead.requiredAmount) : null);
  const commissionAmount =
    !isEmployee && baseAmount !== null && commPercent !== null ? Math.round((baseAmount * commPercent) / 100) : null;

  return {
    lead_id: lead.id,
    id: lead.id,
    lead_code: seqInfo.leadCode || null,
    month_sequence: seqInfo.monthSequence || null,
    customer_id: lead.customerId,
    name: customer.name || null,
    number: customer.mobile || null,
    alternate_number: customer.alternateMobile || null,
    email: customer.email || null,
    city: customer.city || null,
    employment_type: customer.employmentType || null,
    monthly_income: customer.monthlyIncome || null,
    income: customer.monthlyIncome || null,
    source: lead.leadSource,
    commission_percent: commPercent,
    commissionPercent: commPercent,
    commission_amount: commissionAmount,
    bank_name: bankName,
    application_number: primaryApp?.applicationNumber || null,
    applicationNumber: primaryApp?.applicationNumber || null,
    application_id: primaryApp?.id || null,
    disbursed_amount: disbursedAmount,
    disbursedAmount: disbursedAmount,
    sanctioned_amount: sanctionedAmount,
    sanctionedAmount: sanctionedAmount,
    applied_amount: appliedAmount,
    appliedAmount: appliedAmount,
    sanction_date: sanctionDate,
    loan_type: lead.loanType,
    est_budget: lead.requiredAmount,
    status: status?.label || lead.status,
    status_value: lead.status,
    status_id: status?.id || null,
    status_team: status?.team || teamForStatus(lead.status, status?.team),
    priority: lead.priority,
    next_meeting: lead.nextFollowupDate,
    person_id: lead.assignedEmployeeId,
    owner: lead.assignedEmployee?.name || null,
    current_owner: lead.assignedEmployee?.name || "Unassigned",
    current_owner_id: lead.assignedEmployeeId,
    manager_id: lead.assignedManagerId,
    manager: lead.assignedManager?.name || null,
    is_read_only: Boolean(
      requestingUser &&
      requestingUser.role === ROLES.EMPLOYEE &&
      !requestingUser.permissions?.editAllLeads &&
      lead.assignedEmployeeId !== requestingUser.id &&
      lead.assignedManagerId !== requestingUser.id
    ),
    isReadOnly: Boolean(
      requestingUser &&
      requestingUser.role === ROLES.EMPLOYEE &&
      !requestingUser.permissions?.editAllLeads &&
      lead.assignedEmployeeId !== requestingUser.id &&
      lead.assignedManagerId !== requestingUser.id
    ),
    is_worked_lead: Boolean(
      lead.is_worked_lead ||
      (requestingUser && requestingUser.role === ROLES.EMPLOYEE && lead.assignedEmployeeId !== requestingUser.id)
    ),
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    customer: lead.customer || null,
    applications_count: apps.length,
    latest_remark: latestRemarkInfo?.remarks || null,
    latest_remark_date: latestRemarkInfo?.createdAt || null,
    latest_remark_by: latestRemarkInfo?.actor || null,
    latest_remark_source: latestRemarkInfo?.type || null,
    last_remark: latestRemarkInfo?.remarks || null,
  };
};

/**
 * Statuses are MasterConfig rows, so resolving one takes a lookup. Fetch the
 * whole set once per request and index it both ways.
 */
const loadStatuses = async (companyId) => {
  const rows = await MasterConfig.findAll({
    where: { companyId, configType: "LEAD_STATUS" },
    order: [["orderIndex", "ASC"]],
  });
  const byValue = {};
  for (const row of rows) byValue[row.value] = row;
  return { rows, byValue };
};

const resolveStatus = (statuses, input) => {
  if (!input) return null;
  const wanted = String(input).trim();
  const normalized = wanted.toUpperCase().replace(/[\s-]+/g, "_");
  return (
    statuses.rows.find((row) => row.value === wanted.toUpperCase()) ||
    statuses.rows.find((row) => row.value === normalized) ||
    statuses.rows.find((row) => row.label.toLowerCase() === wanted.toLowerCase()) ||
    statuses.rows.find((row) => String(row.id) === wanted) ||
    null
  );
};

/**
 * Sales staff work calling-team statuses, operations work operations-team
 * ones, and either may use a status marked for both. Which team owns a status
 * is declared in master_configs or workflow constants.
 * Company admins and superadmins are not restricted.
 */
const canSetStatus = (user, status, permissions = {}) => {
  const role = typeof user === "string" ? user : user?.role;
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.OPS].includes(role)) return true;
  if (permissions?.manageOperations || permissions?.viewAllLeads || permissions?.editLead || permissions?.manageLeads) return true;
  const team = status?.team || teamForStatus(status?.value, status?.team);
  if (role === ROLES.EMPLOYEE || role === ROLES.MANAGER) return team === "calling" || team === "both";
  return false;
};

/**
 * Row-level visibility: an employee and ops staff see leads assigned to them,
 * a manager sees their team's, admins see the whole company.
 */
const visibilityScope = async (req) => {
  if (
    req.user.role === ROLES.SUPERADMIN ||
    req.user.role === ROLES.COMPANY_ADMIN ||
    req.permissions?.viewAllLeads === true
  ) {
    return {};
  }

  if (req.user.role === ROLES.EMPLOYEE || req.user.role === ROLES.OPS) {
    return {
      [Op.or]: [
        { assignedEmployeeId: req.user.id },
        { assignedManagerId: req.user.id },
      ],
    };
  }

  if (req.user.role === ROLES.MANAGER) {
    const subordinates = await User.findAll({
      where: { companyId: req.user.companyId, managerId: req.user.id },
      attributes: ["id"],
      raw: true,
    });
    const teamIds = [req.user.id, ...subordinates.map((u) => u.id)];
    return {
      [Op.or]: [
        { assignedManagerId: req.user.id },
        { assignedEmployeeId: { [Op.in]: teamIds } },
      ],
    };
  }
  return {};
};

const dateRangeWhere = (from, to, field = "createdAt") => {
  if (!from && !to) return {};
  const range = {};
  if (from) range[Op.gte] = new Date(`${from}T00:00:00`);
  if (to) range[Op.lte] = new Date(`${to}T23:59:59`);
  return { [field]: range };
};

/**
 * GET /api/leads
 * ?page&limit&search&sortBy&sortDir&status&loanType&source&priority
 * &assignedEmployeeId&assignedManagerId&fromDate&toDate&unassigned
 * &team&statusCategory&stage&financialYear&month
 *
 * Search spans the customer, so it is applied to the joined table rather than
 * through the shared helper's own `where`.
 */
exports.getLeads = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { limit, offset, order, page, search } = buildQuery(req.query, {
      sortable: SORTABLE,
      defaultSort: ["createdAt", "DESC"],
    });

    let fromDate = req.query.fromDate || req.query.from;
    let toDate = req.query.toDate || req.query.to;
    if (req.query.financialYear && !fromDate && !toDate) {
      const match = String(req.query.financialYear).match(/^(\d{4})/);
      if (match) {
        const startYear = parseInt(match[1], 10);
        fromDate = `${startYear}-04-01`;
        toDate = `${startYear + 1}-03-31`;
      }
    } else if (req.query.month && !fromDate && !toDate) {
      const parts = String(req.query.month).split("-");
      if (parts.length === 2) {
        const y = parseInt(parts[0], 10);
        const m = parseInt(parts[1], 10);
        if (!isNaN(y) && !isNaN(m)) {
          const lastDay = new Date(y, m, 0).getDate();
          fromDate = `${y}-${String(m).padStart(2, "0")}-01`;
          toDate = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
        }
      }
    }

    const isWorkedView =
      req.query.scope === "worked" ||
      req.query.worked === "true" ||
      req.query.statusCategory === "WORKED" ||
      req.query.view === "worked";

    let where;
    if (isWorkedView) {
      const targetUserId =
        req.query.workedBy ||
        (req.user.role === ROLES.EMPLOYEE ? req.user.id : (req.query.assignedEmployeeId || req.user.id));

      const [assignedLeadRows, callLeadRows, activityLeadRows, noteLeadRows] = await Promise.all([
        LeadAssignmentHistory.findAll({
          where: { companyId, userId: targetUserId },
          attributes: ["leadId"],
          raw: true,
        }),
        CallLog.findAll({
          where: { companyId, userId: targetUserId },
          attributes: ["leadId"],
          raw: true,
        }),
        ActivityLog.findAll({
          where: { companyId, recordType: "Lead", actorUserId: targetUserId },
          attributes: ["recordId"],
          raw: true,
        }),
        Note.findAll({
          where: { companyId, userId: targetUserId, leadId: { [Op.ne]: null } },
          attributes: ["leadId"],
          raw: true,
        }),
      ]);

      const workedLeadIds = [
        ...new Set([
          ...assignedLeadRows.map((r) => r.leadId),
          ...callLeadRows.map((r) => r.leadId),
          ...activityLeadRows.map((r) => r.recordId),
          ...noteLeadRows.map((r) => r.leadId),
        ]),
      ].filter(Boolean);

      where = {
        ...companyScope(req),
        id: { [Op.in]: workedLeadIds.length ? workedLeadIds : [-1] },
        [Op.or]: [
          { assignedEmployeeId: { [Op.ne]: targetUserId } },
          { assignedEmployeeId: null },
        ],
        ...dateRangeWhere(fromDate, toDate),
      };
    } else {
      where = {
        ...companyScope(req),
        ...(await visibilityScope(req)),
        ...dateRangeWhere(fromDate, toDate),
      };
    }

    const statuses = await loadStatuses(companyId);

    const completedValues = ["DISBURSED", "SANCTIONED", "APPROVED", "COMPLETED", "CLOSED"];
    const rejectedValues = ["REJECTED", "CANCELLED"];

    let validTeamStatusSet = null;
    if (req.query.team) {
      const allStatuses = statuses.rows || [];
      validTeamStatusSet = allStatuses
        .filter((s) => {
          const t = s.team || teamForStatus(s.value, s.team);
          return t === req.query.team || t === "both";
        })
        .map((s) => s.value);

      if (!validTeamStatusSet || validTeamStatusSet.length === 0) {
        validTeamStatusSet = Object.entries(STATUS_TEAMS)
          .filter(([, t]) => t === req.query.team || t === "both")
          .map(([v]) => v);
      }
    }

    if (req.query.statusCategory || req.query.stage) {
      const cat = (req.query.statusCategory || req.query.stage).toUpperCase();
      if (cat === "COMPLETED") {
        where.status = validTeamStatusSet
          ? { [Op.in]: completedValues.filter((v) => validTeamStatusSet.includes(v)) }
          : { [Op.in]: completedValues };
      } else if (cat === "PENDING") {
        where.status = validTeamStatusSet
          ? { [Op.in]: validTeamStatusSet.filter((v) => !completedValues.includes(v) && !rejectedValues.includes(v)) }
          : { [Op.notIn]: [...completedValues, ...rejectedValues] };
      } else if (cat === "REJECTED") {
        where.status = validTeamStatusSet
          ? { [Op.in]: rejectedValues.filter((v) => validTeamStatusSet.includes(v)) }
          : { [Op.in]: rejectedValues };
      }
    } else if (req.query.status) {
      const status = resolveStatus(statuses, req.query.status);
      where.status = status ? status.value : req.query.status;
    } else if (validTeamStatusSet && validTeamStatusSet.length > 0) {
      where.status = { [Op.in]: validTeamStatusSet };
    }

    if (req.query.loanType) where.loanType = req.query.loanType;
    if (req.query.source) where.leadSource = req.query.source;
    if (req.query.priority) where.priority = String(req.query.priority).toUpperCase();
    if (!isWorkedView && req.query.assignedEmployeeId) where.assignedEmployeeId = parseInt(req.query.assignedEmployeeId, 10);
    if (req.query.assignedManagerId) where.assignedManagerId = parseInt(req.query.assignedManagerId, 10);
    if (req.query.unassigned === "true") where.assignedEmployeeId = null;

    const customerWhere = search
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${search}%` } },
            { mobile: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } },
            { city: { [Op.like]: `%${search}%` } },
          ],
        }
      : undefined;

    const includes = LEAD_INCLUDES.map((inc) => {
      if (inc.as === "customer") return { ...inc, where: customerWhere };
      if (inc.as === "applications" && req.query.lenderId && req.query.lenderId !== "ALL") {
        return {
          ...inc,
          where: { lenderId: parseInt(req.query.lenderId, 10) },
          required: true,
        };
      }
      return inc;
    });

    const { count, rows } = await Lead.findAndCountAll({
      where,
      include: includes,
      limit,
      offset,
      order,
      distinct: true,
    });

    const leadIds = rows.map((r) => r.id);
    const [remarksMap, seqMap] = await Promise.all([
      getLatestRemarksForLeads(leadIds, companyId),
      getMonthlySequenceCodesForLeads(rows, companyId),
    ]);

    const payload = paginated({
      count,
      rows: rows.map((r) => serializeLead(r, statuses.byValue, req.user, remarksMap.get(r.id), seqMap.get(r.id) || {})),
      page,
      limit,
    });
    // The panel's table reads pagination.totalItems.
    payload.pagination.totalItems = count;

    // Calculate summary statistics across the active filter scope
    let summaryStats = null;
    try {
      const summaryQuery = `
        SELECT 
          COUNT(*) as totalCount,
          COALESCE(SUM(l.required_amount), 0) as totalEnquiredAmount,
          SUM(CASE WHEN l.status IN ('FILE_LOGIN', 'LOGIN', 'PASSED_TO_OPS', 'BANK_LOGIN', 'SUBMITTED', 'IN_PROCESS', 'SANCTIONED') OR l.status LIKE '%LOGIN%' OR l.status LIKE '%BANK%' OR l.status LIKE '%OPS%' OR l.status LIKE '%SANCTION%' THEN 1 ELSE 0 END) as sentToBankCount,
          SUM(CASE WHEN l.status IN ('DOCS_PENDING', 'DOCUMENT_PENDING', 'DOCS_COLLECTED') OR l.status LIKE '%DOC%' THEN 1 ELSE 0 END) as docsPendingCount,
          SUM(CASE WHEN l.status IN ('NEW', 'FRESH', 'UNASSIGNED') OR l.status IS NULL THEN 1 ELSE 0 END) as noStatusYetCount,
          SUM(CASE WHEN l.status = 'DISBURSED' THEN 1 ELSE 0 END) as disbursedCount,
          COALESCE(SUM(CASE WHEN l.status = 'DISBURSED' THEN COALESCE(app.disbursed_amount, app.sanctioned_amount, l.required_amount, 0) ELSE 0 END), 0) as totalDisbursedAmount,
          COALESCE(AVG(CASE WHEN l.status = 'DISBURSED' THEN COALESCE(app.disbursed_amount, app.sanctioned_amount, l.required_amount, NULL) ELSE NULL END), 0) as avgDisbursedAmount
        FROM leads l
        LEFT JOIN (
          SELECT lead_id, 
                 MAX(disbursed_amount) as disbursed_amount, 
                 MAX(sanctioned_amount) as sanctioned_amount
          FROM applications
          GROUP BY lead_id
        ) app ON app.lead_id = l.id
        WHERE l.company_id = :companyId
          ${fromDate ? "AND l.created_at >= :fromDate" : ""}
          ${toDate ? "AND l.created_at <= :toDate" : ""}
          ${req.query.assignedEmployeeId && req.query.assignedEmployeeId !== "ALL" ? "AND l.assigned_employee_id = :assignedEmployeeId" : ""}
          ${req.query.status && req.query.status !== "ALL" ? "AND l.status = :statusQuery" : ""}
          ${req.query.statusCategory === "COMPLETED" ? "AND l.status IN ('DISBURSED', 'CLOSED', 'COMPLETED', 'REJECTED')" : req.query.statusCategory === "PENDING" ? "AND (l.status NOT IN ('DISBURSED', 'CLOSED', 'COMPLETED', 'REJECTED') OR l.status IS NULL)" : ""}
          ${req.query.loanType && req.query.loanType !== "ALL" ? "AND l.loan_type = :loanTypeQuery" : ""}
          ${req.query.source && req.query.source !== "ALL" ? "AND l.lead_source = :sourceQuery" : ""}
      `;

      const [sumRow] = await sequelize.query(summaryQuery, {
        replacements: {
          companyId,
          fromDate: fromDate ? `${fromDate} 00:00:00` : null,
          toDate: toDate ? `${toDate} 23:59:59` : null,
          assignedEmployeeId: req.query.assignedEmployeeId && req.query.assignedEmployeeId !== "ALL" ? parseInt(req.query.assignedEmployeeId, 10) : null,
          statusQuery: req.query.status && req.query.status !== "ALL" ? req.query.status : null,
          loanTypeQuery: req.query.loanType && req.query.loanType !== "ALL" ? req.query.loanType : null,
          sourceQuery: req.query.source && req.query.source !== "ALL" ? req.query.source : null,
        },
        type: sequelize.QueryTypes.SELECT,
      });
      summaryStats = sumRow;
    } catch (e) {
      console.warn("[leads] Failed to compute lead summary stats:", e.message);
    }

    payload.summary = {
      totalCount: summaryStats ? parseInt(summaryStats.totalCount, 10) : count,
      totalEnquiredAmount: summaryStats ? parseFloat(summaryStats.totalEnquiredAmount) : 0,
      sentToBankCount: summaryStats ? parseInt(summaryStats.sentToBankCount, 10) : 0,
      docsPendingCount: summaryStats ? parseInt(summaryStats.docsPendingCount, 10) : 0,
      noStatusYetCount: summaryStats ? parseInt(summaryStats.noStatusYetCount, 10) : 0,
      disbursedCount: summaryStats ? parseInt(summaryStats.disbursedCount, 10) : 0,
      totalDisbursedAmount: summaryStats ? parseFloat(summaryStats.totalDisbursedAmount) : 0,
      avgDisbursedAmount: summaryStats ? parseFloat(summaryStats.avgDisbursedAmount) : 0,
    };

    return res.status(200).json(payload);
  } catch (error) {
    console.error("[leads] getLeads error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/leads/:id
 */
exports.getLeadById = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, {
      include: [
        ...LEAD_INCLUDES,
        { model: CallLog, as: "callLogs", separate: true, order: [["createdAt", "DESC"]] },
        { model: FollowUp, as: "followUps", separate: true, order: [["scheduledAt", "DESC"]] },
        {
          model: Application,
          as: "applications",
          separate: true,
          order: [["createdAt", "DESC"]],
          include: [
            { model: Lender, as: "lender", attributes: ["id", "name", "shortCode", "lenderType"] },
            { model: User, as: "assignedBanker", attributes: ["id", "name", "email", "phone"] },
            { model: Document, as: "documents" },
          ],
        },
        {
          model: Document,
          as: "documents",
          separate: true,
          order: [["createdAt", "DESC"]],
          include: [
            { model: User, as: "uploader", attributes: ["id", "name", "role"] },
          ],
        },
        {
          model: LeadDocumentRequest,
          as: "documentRequests",
          separate: true,
          order: [["createdAt", "DESC"]],
          include: [
            { model: User, as: "creator", attributes: ["id", "name", "role"] },
          ],
        },
        {
          model: LeadAssignmentHistory,
          as: "assignmentHistories",
          separate: true,
          order: [["assignedAt", "DESC"]],
          include: [
            { model: User, as: "assignee", attributes: ["id", "name", "role", "email"] },
            { model: User, as: "assignedBy", attributes: ["id", "name", "role"] },
          ],
        },
      ],
    });

    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    let hasWorkedOnLead = false;
    if (req.user.role === ROLES.EMPLOYEE) {
      if (
        !req.permissions?.viewAllLeads &&
        lead.assignedEmployeeId !== req.user.id &&
        lead.assignedManagerId !== req.user.id
      ) {
        const [workedHistory, workedActivity, workedCall, workedNote] = await Promise.all([
          LeadAssignmentHistory.findOne({ where: { leadId: lead.id, userId: req.user.id } }),
          ActivityLog.findOne({ where: { companyId: lead.companyId, recordType: "Lead", recordId: lead.id, actorUserId: req.user.id } }),
          CallLog.findOne({ where: { companyId: lead.companyId, leadId: lead.id, userId: req.user.id } }),
          Note.findOne({ where: { companyId: lead.companyId, leadId: lead.id, userId: req.user.id } }),
        ]);

        if (workedHistory || workedActivity || workedCall || workedNote) {
          hasWorkedOnLead = true;
        } else {
          return res.status(403).json({ message: "You do not have access to this lead" });
        }
      }
    }

    const statuses = await loadStatuses(lead.companyId);

    const creationActivity = await ActivityLog.findOne({
      where: { companyId: lead.companyId, recordType: "Lead", recordId: lead.id, action: "CREATED" },
      attributes: ["remarks"],
    });

    const [remarksMap, seqMap] = await Promise.all([
      getLatestRemarksForLeads([lead.id], lead.companyId),
      getMonthlySequenceCodesForLeads([lead], lead.companyId),
    ]);
    const remarkInfo = remarksMap.get(lead.id);
    const seqInfo = seqMap.get(lead.id) || {};

    const isReadOnly = req.user.role === ROLES.EMPLOYEE &&
      !req.permissions?.editAllLeads &&
      lead.assignedEmployeeId !== req.user.id &&
      lead.assignedManagerId !== req.user.id;

    return res.status(200).json({
      message: "success",
      data: {
        ...serializeLead(lead, statuses.byValue, req.user, remarkInfo, seqInfo),
        is_read_only: isReadOnly,
        isReadOnly: isReadOnly,
        is_worked_lead: hasWorkedOnLead || lead.assignedEmployeeId !== req.user.id,
        current_owner: lead.assignedEmployee?.name || "Unassigned",
        current_owner_id: lead.assignedEmployeeId,
        assignment_history: (lead.assignmentHistories || []).map((h) => ({
          id: h.id,
          user_id: h.userId,
          assignee_name: h.assignee?.name || "Employee",
          assignee_role: h.assignee?.role || "",
          assigned_by_id: h.assignedById,
          assigned_by_name: h.assignedBy?.name || "Admin/Manager",
          assigned_at: h.assignedAt,
          unassigned_at: h.unassignedAt,
          is_active: h.isActive,
          notes: h.notes,
        })),
        remarks: creationActivity?.remarks || null,
        initial_remark: creationActivity?.remarks || null,
        last_remark: remarkInfo?.remarks || null,
        latest_remark: remarkInfo?.remarks || null,
        latest_remark_date: remarkInfo?.createdAt || null,
        latest_remark_by: remarkInfo?.actor || null,
        latest_remark_source: remarkInfo?.type || null,
        callLogs: lead.callLogs,
        followUps: lead.followUps,
        applications: lead.applications || [],
        documents: lead.documents || [],
        documentRequests: lead.documentRequests || [],
      },
    });
  } catch (error) {
    console.error("[leads] getLeadById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/leads/check-duplicate
 * Checks if a contact/phone number is repeated / already registered under this company.
 */
exports.checkDuplicateMobile = async (req, res) => {
  try {
    const companyId = req.user.companyId || parseInt(req.query.companyId, 10);
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const raw = req.query.number || req.query.mobile || req.query.contact || "";
    const mobile = normaliseMobile(raw);

    if (!mobile || mobile.length < 10) {
      return res.status(200).json({ exists: false, isDuplicate: false });
    }

    const customer = await Customer.findOne({
      where: {
        companyId,
        [Op.or]: [{ mobile }, { alternateMobile: mobile }],
      },
      include: [
        {
          model: Lead,
          as: "leads",
          include: [
            { model: User, as: "assignedEmployee", attributes: ["id", "name", "email"] },
          ],
          order: [["id", "DESC"]],
          limit: 1,
        },
      ],
    });

    if (!customer) {
      return res.status(200).json({ exists: false, isDuplicate: false });
    }

    const existingLead = customer.leads && customer.leads.length > 0 ? customer.leads[0] : null;

    return res.status(200).json({
      exists: true,
      isDuplicate: true,
      message: "Bhai number same hai! Yeh number pehle se exist karta hai (Repeated Number).",
      customer: {
        id: customer.id,
        name: customer.name,
        mobile: customer.mobile,
        city: customer.city || null,
      },
      lead: existingLead
        ? {
            id: existingLead.id,
            loanType: existingLead.loanType || "Loan",
            leadSource: existingLead.leadSource || "—",
            status: existingLead.status || "Active",
            assignedTo: existingLead.assignedEmployee?.name || "Unassigned",
            createdAt: existingLead.createdAt,
          }
        : null,
    });
  } catch (error) {
    console.error("[leads] checkDuplicateMobile error:", error);
    return res.status(500).json({ message: "Failed to check duplicate number", error: error.message });
  }
};

/**
 * POST /api/leads
 * Accepts the flat body the app already sends: the customer half is split off
 * and matched on mobile, so a repeat enquiry reuses the existing customer.
 */
exports.createLead = async (req, res) => {
  const transaction = await sequelize.transaction();
  try {
    const companyId = req.user.companyId || parseInt(req.body.companyId, 10);
    if (!companyId) {
      await transaction.rollback();
      return res.status(400).json({ message: "companyId is required" });
    }

    const body = req.body;
    const rawNumber = body.number || body.mobile || body.contact;
    const mobile = normaliseMobile(rawNumber);
    if (!mobile || mobile.length < 10) {
      await transaction.rollback();
      return res.status(400).json({ message: "Valid 10-digit mobile number is required" });
    }

    // Check duplicate: if customer/lead with this phone number already exists, block creation
    const existingCustomer = await Customer.findOne({
      where: {
        companyId,
        [Op.or]: [{ mobile }, { alternateMobile: mobile }],
      },
      include: [
        {
          model: Lead,
          as: "leads",
          include: [
            { model: User, as: "assignedEmployee", attributes: ["id", "name"] },
          ],
          order: [["id", "DESC"]],
          limit: 1,
        },
      ],
      transaction,
    });

    if (existingCustomer) {
      await transaction.rollback();
      const existingLead = existingCustomer.leads && existingCustomer.leads.length > 0 ? existingCustomer.leads[0] : null;
      const leadInfo = existingLead ? `(Lead #${existingLead.id} - ${existingCustomer.name}, Status: ${existingLead.status})` : `(${existingCustomer.name})`;
      return res.status(409).json({
        message: `Bhai number same hai! Yeh number pehle se exist karta hai (Repeated Number) ${leadInfo}. Duplicate lead add nahi ho sakti.`,
        isDuplicate: true,
        customer: {
          id: existingCustomer.id,
          name: existingCustomer.name,
          mobile: existingCustomer.mobile,
        },
        lead: existingLead
          ? {
              id: existingLead.id,
              loanType: existingLead.loanType,
              status: existingLead.status,
              assignedTo: existingLead.assignedEmployee?.name || "Unassigned",
            }
          : null,
      });
    }

    const { customer } = await findOrCreateCustomer(
      companyId,
      {
        name: body.name,
        mobile,
        alternateMobile: body.alternate_number || body.alternateMobile,
        email: body.email,
        city: body.city,
        employmentType: body.employment_type || body.employmentType,
        monthlyIncome: body.monthly_income ?? body.monthlyIncome ?? body.income,
        panNumber: body.pan_number || body.panNumber,
      },
      transaction
    );

    const statuses = await loadStatuses(companyId);
    const requested = resolveStatus(statuses, body.status || body.status_id);
    const status = requested || resolveInitialStatus(statuses.rows);

    if (requested && !canSetStatus(req.user, requested, req.permissions)) {
      await transaction.rollback();
      return res.status(403).json({ message: `Your role cannot set the status "${requested.label}"` });
    }

    const data = pick(body, LEAD_FIELDS);
    const rawSource = body.source ?? body.leadSource ?? body.lead_source ?? body.party ?? body.Party;
    data.leadSource = (rawSource !== undefined && rawSource !== null && String(rawSource).trim() !== "")
      ? String(rawSource).trim()
      : "Self";
    if (body.loan_type !== undefined) data.loanType = body.loan_type;
    if (body.est_budget !== undefined) data.requiredAmount = body.est_budget;
    const rawMeeting = body.next_meeting ?? body.meetingDate ?? body.meeting_date ?? body.nextMeetingDate ?? body.nextFollowupDate;
    if (rawMeeting !== undefined) {
      let combinedMeeting = rawMeeting;
      const rawTime = body.meetingTime ?? body.meeting_time ?? body.nextMeetingTime;
      if (rawTime && typeof rawMeeting === "string" && rawMeeting.length === 10) {
        combinedMeeting = `${rawMeeting}T${rawTime.length === 5 ? rawTime + ":00" : rawTime}`;
      }
      data.nextFollowupDate = parseScheduledDate(combinedMeeting);
    }
    if (data.priority) data.priority = String(data.priority).toUpperCase();
    const rawComm = body.commission_percent ?? body.commissionPercent ?? body.commission;
    if (rawComm !== undefined && rawComm !== null && String(rawComm).trim() !== "") {
      data.commissionPercent = parseFloat(rawComm);
    } else {
      data.commissionPercent = null;
    }

    const remark = remarkOf(body);

    // Whenever an employee/staff member creates a lead, default assignment to the creator unless explicitly provided
    const defaultAssigneeId = ![ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN].includes(req.user.role)
      ? req.user.id
      : null;

    const assignedEmployeeId =
      body.assignedEmployeeId ?? body.person_id ?? defaultAssigneeId;
    const owner = assignedEmployeeId ? await User.findByPk(assignedEmployeeId, { transaction }) : null;
    if (assignedEmployeeId && (!owner || owner.companyId !== companyId)) {
      await transaction.rollback();
      return res.status(400).json({ message: "Assigned employee does not belong to this company" });
    }

    const lead = await Lead.create(
      {
        ...data,
        companyId,
        customerId: customer.id,
        status: status?.value || "NEW",
        assignedEmployeeId: assignedEmployeeId || null,
        assignedManagerId: body.assignedManagerId ?? owner?.managerId ?? (assignedEmployeeId === req.user.id ? req.user.managerId : null),
      },
      { transaction }
    );

    // If call was placed from dialer or requested to log call upon lead creation
    if (body.log_call || body.logCall || body.call_status || body.callStatus || body.from_dialer || body.fromDialer) {
      const callStatusRaw = String(body.call_status || body.callStatus || "CONNECTED").toUpperCase();
      const validCallStatuses = [
        "CONNECTED", "INTERESTED", "CALL_BACK_LATER", "NOT_CONNECTED",
        "BUSY", "SWITCHED_OFF", "NOT_INTERESTED", "INVALID_NUMBER"
      ];
      const callStatus = validCallStatuses.includes(callStatusRaw) ? callStatusRaw : "CONNECTED";
      const duration = parseInt(body.duration ?? body.call_duration ?? body.callDuration ?? 60, 10);

      await CallLog.create(
        {
          companyId,
          leadId: lead.id,
          userId: req.user.id,
          callStatus,
          durationSec: Number.isNaN(duration) || duration < 0 ? 60 : duration,
          remarks: body.call_remarks || body.callRemarks || remark || "Initial call from Smart Dialer",
        },
        { transaction }
      );
    }

    // If follow-up date was set upon lead creation
    const followupInput = body.next_meeting || body.nextFollowupDate || body.nextMeeting;
    if (followupInput) {
      const when = new Date(followupInput);
      if (!Number.isNaN(when.valueOf())) {
        await FollowUp.create(
          {
            companyId,
            leadId: lead.id,
            userId: assignedEmployeeId || req.user.id,
            scheduledAt: when,
            reminderType: body.reminder_type || "same_day",
            status: "PENDING",
            remarks: remark || body.remarks || "Initial follow-up scheduled",
          },
          { transaction }
        );
      }
    }

    await transaction.commit();

    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "CREATED",
      newValue: { customer: customer.name, mobile: customer.mobile, status: lead.status },
      remarks: remark,
      companyId,
    });

    if (lead.assignedEmployeeId) {
      await trackLeadAssignment({
        companyId,
        leadId: lead.id,
        fromUserId: null,
        toUserId: lead.assignedEmployeeId,
        assignedById: req.user.id,
        reason: remark || "Initial lead assignment",
        req: null,
      });
    }

    if (data.nextFollowupDate) {
      await syncLeadFollowUp({
        leadId: lead.id,
        companyId,
        nextDate: data.nextFollowupDate,
        userId: lead.assignedEmployeeId || lead.assignedManagerId || req.user.id,
        remarks: remark || "Initial follow-up scheduled",
        reqUser: req.user,
      });
    }

    return res.status(201).json({ message: "Lead added successfully", id: lead.id, data: lead });
  } catch (error) {
    await transaction.rollback();
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("[leads] createLead error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/leads/:id
 * A status change is audited separately from the field edit, because the
 * timeline has to show the old and new status explicitly.
 */
exports.updateLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, { include: [{ model: Customer, as: "customer" }] });
    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const body = req.body || {};

    const hasReassignField =
      body.assignedEmployeeId !== undefined ||
      body.person_id !== undefined ||
      body.assignedTo !== undefined;

    if (req.user.role === ROLES.EMPLOYEE) {
      const isDeniedReassign = req.permissions?.reassignLeads === false;
      const canReassign = !isDeniedReassign && (
        req.permissions?.reassignLeads ||
        req.permissions?.assignLeads ||
        req.permissions?.manageLeads ||
        req.permissions?.editAllLeads ||
        req.permissions?.reassignLeads !== false
      );
      const isOwnLead = lead.assignedEmployeeId === req.user.id || lead.assignedManagerId === req.user.id;

      // If user has edit permissions or is the lead owner, or is performing a permitted reassignment
      const isPermitted =
        Boolean(req.permissions?.editAllLeads) ||
        Boolean(req.permissions?.editLeads) ||
        isOwnLead ||
        (hasReassignField && canReassign);

      if (!isPermitted) {
        return res.status(403).json({
          code: "WORKED_LEAD_READ_ONLY",
          message: "This lead is currently assigned to another employee. You have read-only access to this worked lead.",
        });
      }
    }

    const statuses = await loadStatuses(lead.companyId);

    const data = pick(body, LEAD_FIELDS);
    const rawSource = body.source ?? body.leadSource ?? body.lead_source ?? body.party ?? body.Party;
    if (rawSource !== undefined) {
      data.leadSource = (rawSource !== null && String(rawSource).trim() !== "")
        ? String(rawSource).trim()
        : "Self";
    }
    if (body.loan_type !== undefined) data.loanType = body.loan_type;
    if (body.est_budget !== undefined) data.requiredAmount = body.est_budget;
    const rawMeeting = body.next_meeting ?? body.meetingDate ?? body.meeting_date ?? body.nextMeetingDate ?? body.nextFollowupDate;
    if (rawMeeting !== undefined) {
      let combinedMeeting = rawMeeting;
      const rawTime = body.meetingTime ?? body.meeting_time ?? body.nextMeetingTime;
      if (rawTime && typeof rawMeeting === "string" && rawMeeting.length === 10) {
        combinedMeeting = `${rawMeeting}T${rawTime.length === 5 ? rawTime + ":00" : rawTime}`;
      }
      data.nextFollowupDate = parseScheduledDate(combinedMeeting);
    }
    if (data.priority) data.priority = String(data.priority).toUpperCase();
    const rawUpdateComm = body.commission_percent ?? body.commissionPercent ?? body.commission;
    if (rawUpdateComm !== undefined) {
      data.commissionPercent = (rawUpdateComm !== null && String(rawUpdateComm).trim() !== "")
        ? parseFloat(rawUpdateComm)
        : null;
    }

    const rawBank = body.bank_name ?? body.bank ?? body.bankName;
    if (rawBank !== undefined) {
      try {
        const bankTrimmed = String(rawBank).trim();
        if (bankTrimmed && bankTrimmed !== "—" && bankTrimmed !== "--") {
          let lender = await Lender.findOne({
            where: {
              companyId: lead.companyId,
              name: { [Op.like]: `%${bankTrimmed}%` },
            },
          });
          if (!lender) {
            lender = await Lender.create({
              companyId: lead.companyId,
              name: bankTrimmed,
              shortCode: bankTrimmed.slice(0, 10).toUpperCase(),
              lenderType: "BANK",
            });
          }
          let app = await Application.findOne({
            where: { leadId: lead.id, companyId: lead.companyId },
            order: [["id", "ASC"]],
          });
          if (app) {
            await app.update({ lenderId: lender.id });
          } else {
            await Application.create({
              companyId: lead.companyId,
              leadId: lead.id,
              customerId: lead.customerId,
              loanProduct: data.loanType || lead.loanType || "General",
              lenderId: lender.id,
            });
          }
        }
      } catch (err) {
        console.warn("[updateLead] Bank sync warning:", err.message);
      }
    }

    const remark = remarkOf(body);

    let statusChange = null;
    const requested = resolveStatus(statuses, body.status ?? body.status_id);
    if (requested && requested.value !== lead.status) {
      if (!canSetStatus(req.user, requested, req.permissions)) {
        return res.status(403).json({ message: `Your role cannot set the status "${requested.label}"` });
      }
      statusChange = { from: lead.status, to: requested.value };
      data.status = requested.value;
    }

    if (body.assignedEmployeeId !== undefined || body.person_id !== undefined || body.assignedTo !== undefined) {
      const isSuperOrAdmin = [ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN].includes(req.user.role);
      const isDenied = req.permissions?.reassignLeads === false;
      const canReassignRole =
        !isDenied &&
        (isSuperOrAdmin ||
          [ROLES.MANAGER, ROLES.OPS, ROLES.EMPLOYEE].includes(req.user.role) ||
          Boolean(req.permissions?.reassignLeads) ||
          Boolean(req.permissions?.assignLeads) ||
          Boolean(req.permissions?.manageLeads));
      if (!canReassignRole) {
        return res.status(403).json({ message: "You do not have permission to reassign leads" });
      }

      const nextOwnerId = body.assignedEmployeeId ?? body.person_id ?? body.assignedTo;
      if (nextOwnerId) {
        const owner = await User.findByPk(nextOwnerId);
        if (!owner || owner.companyId !== lead.companyId) {
          return res.status(400).json({ message: "Assigned employee does not belong to this company" });
        }
        data.assignedEmployeeId = owner.id;
        data.assignedManagerId = owner.managerId ?? lead.assignedManagerId;
      } else {
        data.assignedEmployeeId = null;
      }
    }

    const before = { ...lead.get({ plain: true }) };
    await lead.update(data);
    const after = { ...lead.get({ plain: true }) };

    if (data.assignedEmployeeId !== undefined && before.assignedEmployeeId !== data.assignedEmployeeId) {
      await trackLeadAssignment({
        companyId: lead.companyId,
        leadId: lead.id,
        fromUserId: before.assignedEmployeeId,
        toUserId: data.assignedEmployeeId,
        assignedById: req.user.id,
        reason: req.body.assignment_reason || req.body.reason || remark || null,
        req,
      });

      if (data.assignedEmployeeId) {
        await FollowUp.update(
          { userId: data.assignedEmployeeId },
          { where: { leadId: lead.id, companyId: lead.companyId, status: "PENDING" } }
        ).catch((err) => console.error("[updateLead] FollowUp transfer error:", err));
      }
    }

    if (statusChange) {
      await logActivity(req, {
        recordType: "Lead",
        recordId: lead.id,
        action: "STATUS_CHANGED",
        oldValue: { status: statusChange.from },
        newValue: { status: statusChange.to },
        remarks: remark,
        companyId: lead.companyId,
      });
    }

    // A status change already carries the remark, so this entry only takes it
    // when there is no status entry - and a remark sent on its own still earns
    // an entry, which is the only place it can be kept.
    const diff = diffFields(before, after, LEAD_FIELDS.concat(["assignedEmployeeId", "assignedManagerId"]));
    if (diff || (remark && !statusChange)) {
      await logActivity(req, {
        recordType: "Lead",
        recordId: lead.id,
        action: "UPDATED",
        ...(diff || {}),
        remarks: statusChange ? null : remark,
        companyId: lead.companyId,
      });
    }

    // Keep the customer half in step when the caller edits it through the lead.
    const customerPatch = {};
    if (body.name) customerPatch.name = String(body.name).trim();
    const rawMobile = body.mobile ?? body.number ?? body.phone ?? body.contact ?? body.customerMobile;
    if (rawMobile !== undefined && String(rawMobile).trim() !== "") {
      customerPatch.mobile = String(rawMobile).trim();
    }
    if (body.email !== undefined) customerPatch.email = body.email;
    if (body.city !== undefined) customerPatch.city = body.city;
    const rawAltMobile = body.alternate_number ?? body.alternateMobile ?? body.alt_phone ?? body.altPhone;
    if (rawAltMobile !== undefined) customerPatch.alternateMobile = rawAltMobile ? String(rawAltMobile).trim() : null;
    if (body.employment_type !== undefined || body.employmentType !== undefined) {
      customerPatch.employmentType = body.employment_type || body.employmentType;
    }
    if (body.monthly_income !== undefined || body.monthlyIncome !== undefined || body.income !== undefined) {
      customerPatch.monthlyIncome = body.monthly_income ?? body.monthlyIncome ?? body.income;
    }
    if (body.pan_number !== undefined || body.panNumber !== undefined) {
      customerPatch.panNumber = body.pan_number || body.panNumber;
    }
    if (Object.keys(customerPatch).length) {
      if (lead.customer) {
        await lead.customer.update(customerPatch);
      } else if (lead.customerId) {
        await Customer.update(customerPatch, { where: { id: lead.customerId } });
      } else {
        const newCust = await Customer.create({
          companyId: lead.companyId,
          name: customerPatch.name || "Customer",
          mobile: customerPatch.mobile || "0000000000",
          ...customerPatch,
        });
        await lead.update({ customerId: newCust.id });
      }

      // Keep CasePayout customer name / mobile in sync if exists
      if (customerPatch.mobile || customerPatch.name) {
        try {
          const { CasePayout } = require("../models");
          const payoutPatch = {};
          if (customerPatch.mobile) payoutPatch.customerMobile = customerPatch.mobile;
          if (customerPatch.name) payoutPatch.customerName = customerPatch.name;
          await CasePayout.update(payoutPatch, { where: { leadId: lead.id, companyId: lead.companyId } });
        } catch (e) {}
      }
    }

    const rawMeetingUpdated = body.next_meeting ?? body.meetingDate ?? body.meeting_date ?? body.nextMeetingDate ?? body.nextFollowupDate ?? body.nextMeeting;
    if (rawMeetingUpdated !== undefined || data.nextFollowupDate !== undefined) {
      await syncLeadFollowUp({
        leadId: lead.id,
        companyId: lead.companyId,
        nextDate: data.nextFollowupDate,
        userId: data.assignedEmployeeId || lead.assignedEmployeeId || lead.assignedManagerId || req.user.id,
        remarks: remark || "Meeting updated",
        reqUser: req.user,
      });
    }

    if (["CANCELLED", "REJECTED"].includes(String(lead.status || "").toUpperCase())) {
      try {
        const { CasePayout } = require("../models");
        CasePayout.destroy({ where: { companyId: lead.companyId, leadId: lead.id } }).catch(() => {});
      } catch (e) {}
    }
    try {
      const { autoSyncDisbursedCases } = require("./casePayoutController");
      autoSyncDisbursedCases(lead.companyId).catch((e) =>
        console.error("[leadController] autoSync error:", e.message)
      );
    } catch (e) {}

    const seqMap = await getMonthlySequenceCodesForLeads([lead], lead.companyId);
    return res.status(200).json({ message: "Lead updated", data: serializeLead(lead, statuses.byValue, req.user, null, seqMap.get(lead.id) || {}) });
  } catch (error) {
    console.error("[leads] updateLead error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/leads/:id/status - the narrow endpoint the mobile app uses after a
 * call, carrying the remark and the next follow-up in one write.
 */
exports.updateLeadStatus = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if ([ROLES.EMPLOYEE, ROLES.OPS].includes(req.user.role)) {
      if (
        !req.permissions?.viewAllLeads &&
        !req.permissions?.editAllLeads &&
        !req.permissions?.editLead &&
        !req.permissions?.manageLeads &&
        lead.assignedEmployeeId &&
        lead.assignedEmployeeId !== req.user.id &&
        lead.assignedManagerId !== req.user.id
      ) {
        return res.status(403).json({
          code: "WORKED_LEAD_READ_ONLY",
          message: "This lead is currently assigned to another staff member. You have read-only access to this lead.",
        });
      }
    }

    const statuses = await loadStatuses(lead.companyId);
    const status = resolveStatus(statuses, req.body.status ?? req.body.status_id);
    if (!status) {
      return res.status(400).json({ message: "Unknown status" });
    }
    if (!canSetStatus(req.user, status, req.permissions)) {
      return res.status(403).json({ message: `Your role cannot set the status "${status.label}"` });
    }

    const previous = lead.status;
    const patch = { status: status.value };
    const statusFollowupInput = req.body.next_meeting ?? req.body.nextFollowupDate ?? req.body.meetingDate ?? req.body.meeting_date ?? req.body.nextMeeting;
    if (statusFollowupInput !== undefined) patch.nextFollowupDate = parseScheduledDate(statusFollowupInput);

    await lead.update(patch);

    if (statusFollowupInput !== undefined) {
      await syncLeadFollowUp({
        leadId: lead.id,
        companyId: lead.companyId,
        nextDate: patch.nextFollowupDate,
        userId: lead.assignedEmployeeId || lead.assignedManagerId || req.user.id,
        remarks: remarkOf(req.body) || `Status changed to ${status.label}`,
        reqUser: req.user,
      });
    }

    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "STATUS_CHANGED",
      oldValue: { status: previous },
      newValue: { status: status.value },
      remarks: remarkOf(req.body),
      companyId: lead.companyId,
    });

    if (["CANCELLED", "REJECTED"].includes(String(status.value || "").toUpperCase())) {
      try {
        const { CasePayout } = require("../models");
        CasePayout.destroy({ where: { companyId: lead.companyId, leadId: lead.id } }).catch(() => {});
      } catch (e) {}
    }
    try {
      const { autoSyncDisbursedCases } = require("./casePayoutController");
      autoSyncDisbursedCases(lead.companyId).catch((e) =>
        console.error("[leadController] autoSync error:", e.message)
      );
    } catch (e) {}

    const seqMap = await getMonthlySequenceCodesForLeads([lead], lead.companyId);
    const serialized = serializeLead(lead, statuses.byValue, req.user, null, seqMap.get(lead.id) || {});
    return res.status(200).json({ message: "Status updated", data: serialized, lead: serialized });
  } catch (error) {
    console.error("[leads] updateLeadStatus error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/leads/:id
 */
exports.deleteLead = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id, { include: [{ model: Customer, as: "customer" }] });
    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "DELETED",
      oldValue: { customer: lead.customer?.name, status: lead.status },
      companyId: lead.companyId,
    });

    await lead.destroy();
    return res.status(200).json({ message: "Lead deleted" });
  } catch (error) {
    console.error("[leads] deleteLead error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/leads/unassigned - the pool an employee may pull from.
 */
exports.getUnassignedLeads = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const statuses = await loadStatuses(companyId);
    const fresh = resolveInitialStatus(statuses.rows);
    const limit = Math.min(parseInt(req.query.limit, 10) || MAX_SELF_ASSIGN_LEADS, MAX_SELF_ASSIGN_LEADS);

    if (!fresh) {
      return res.status(200).json({ success: true, leads: [], availableCount: 0, maxAssignable: MAX_SELF_ASSIGN_LEADS });
    }

    const where = { companyId, assignedEmployeeId: null, status: fresh.value };
    const [availableCount, leads] = await Promise.all([
      Lead.count({ where }),
      Lead.findAll({ where, include: LEAD_INCLUDES, order: [["createdAt", "ASC"]], limit }),
    ]);

    return res.status(200).json({
      success: true,
      leads: leads.map((l) => serializeLead(l, statuses.byValue, req.user)),
      availableCount,
      maxAssignable: MAX_SELF_ASSIGN_LEADS,
    });
  } catch (error) {
    console.error("[leads] getUnassignedLeads error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/leads/assign/:userId - hand the oldest N unassigned fresh leads to
 * one user. The update repeats the unassigned condition so two callers racing
 * for the same pool cannot both win the same rows.
 */
exports.assignUnassignedLeads = async (req, res) => {
  try {
    const count = parseInt(req.body.count, 10);
    if (!count || count < 1) {
      return res.status(400).json({ message: "count must be at least 1" });
    }

    const owner = await User.findByPk(req.params.userId);
    if (!owner || owner.companyId !== req.user.companyId) {
      return res.status(404).json({ message: "User not found" });
    }

    const statuses = await loadStatuses(req.user.companyId);
    const fresh = resolveInitialStatus(statuses.rows);
    if (!fresh) return res.status(404).json({ message: "No initial lead status configured" });

    const where = { companyId: req.user.companyId, assignedEmployeeId: null, status: fresh.value };
    const availableCount = await Lead.count({ where });
    const assignCount = Math.min(count, MAX_SELF_ASSIGN_LEADS, availableCount);

    if (assignCount < 1) {
      return res.status(400).json({ message: "No unassigned fresh leads available" });
    }

    const candidates = await Lead.findAll({ where, order: [["createdAt", "ASC"]], limit: assignCount });
    const ids = candidates.map((l) => l.id);

    const [updated] = await Lead.update(
      { assignedEmployeeId: owner.id, assignedManagerId: owner.managerId ?? null },
      { where: { id: { [Op.in]: ids }, ...where } }
    );

    await Promise.all(
      ids.map((id) =>
        trackLeadAssignment({
          companyId: req.user.companyId,
          leadId: id,
          fromUserId: null,
          toUserId: owner.id,
          assignedById: req.user.id,
          reason: `Auto-assigned to ${owner.name}`,
          req,
        })
      )
    );

    return res.status(200).json({
      success: true,
      message: `${updated} leads assigned to ${owner.name}`,
      assignedCount: updated,
      requestedCount: count,
      maxAssignable: MAX_SELF_ASSIGN_LEADS,
      availableCount: Math.max(availableCount - updated, 0),
    });
  } catch (error) {
    console.error("[leads] assignUnassignedLeads error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/leads/reassign - move a named set of leads to another user.
 */
exports.reassignLeadsBulk = async (req, res) => {
  try {
    const { leadIds, toUserId } = req.body;
    if (!Array.isArray(leadIds) || !leadIds.length) {
      return res.status(400).json({ message: "leadIds must be a non-empty array" });
    }

    const owner = await User.findByPk(toUserId);
    if (!owner || owner.companyId !== req.user.companyId) {
      return res.status(404).json({ message: "Target user not found" });
    }

    const leads = await Lead.findAll({
      where: { id: { [Op.in]: leadIds }, companyId: req.user.companyId },
    });
    if (!leads.length) {
      return res.status(404).json({ message: "No matching leads" });
    }

    await Promise.all(
      leads.map(async (lead) => {
        const from = lead.assignedEmployeeId;
        await lead.update({ assignedEmployeeId: owner.id, assignedManagerId: owner.managerId ?? null });
        await trackLeadAssignment({
          companyId: lead.companyId,
          leadId: lead.id,
          fromUserId: from,
          toUserId: owner.id,
          assignedById: req.user.id,
          reason: req.body.reason || `Bulk reassigned to ${owner.name}`,
          req,
        });
        await FollowUp.update(
          { userId: owner.id },
          { where: { leadId: lead.id, companyId: lead.companyId, status: "PENDING" } }
        ).catch((err) => console.error("[reassignLeadsBulk] FollowUp transfer error:", err));
      })
    );

    return res.status(200).json({
      success: true,
      message: `${leads.length} lead(s) reassigned to ${owner.name}`,
      reassignedCount: leads.length,
    });
  } catch (error) {
    console.error("[leads] reassignLeadsBulk error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/leads/followups - what is due, grouped by the window the dashboard
 * asks for: today, upcoming or overdue.
 */
exports.getFollowups = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const { limit, offset, page } = buildQuery(req.query, { defaultSort: ["nextFollowupDate", "ASC"] });

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86399999);
    const startOfTomorrow = new Date(startOfToday.getTime() + 86400000);
    const endOfTomorrow = new Date(endOfToday.getTime() + 86400000);

    const windows = {
      today: { [Op.between]: [startOfToday, endOfToday] },
      tomorrow: { [Op.between]: [startOfTomorrow, endOfTomorrow] },
      overdue: { [Op.lt]: startOfToday },
      upcoming: { [Op.gt]: endOfToday },
    };
    const range = windows[req.query.window] || { [Op.ne]: null };

    const where = {
      ...companyScope(req),
      ...(await visibilityScope(req)),
      nextFollowupDate: range,
    };

    const statuses = await loadStatuses(companyId);
    const { count, rows } = await Lead.findAndCountAll({
      where,
      include: LEAD_INCLUDES,
      limit,
      offset,
      order: [["nextFollowupDate", "ASC"]],
      distinct: true,
    });

    const leadIds = rows.map((r) => r.id);
    const remarksMap = await getLatestRemarksForLeads(leadIds, companyId);

    const payload = paginated({
      count,
      rows: rows.map((r) => serializeLead(r, statuses.byValue, req.user, remarksMap.get(r.id))),
      page,
      limit,
    });
    payload.pagination.totalItems = count;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[leads] getFollowups error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/leads/counts - funnel counts for the dashboards, honouring the same
 * visibility scope as the list.
 */
exports.getLeadCounts = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const where = {
      ...companyScope(req),
      ...(await visibilityScope(req)),
      ...dateRangeWhere(req.query.fromDate, req.query.toDate),
    };
    if (req.query.assignedEmployeeId) where.assignedEmployeeId = parseInt(req.query.assignedEmployeeId, 10);

    const statuses = await loadStatuses(companyId);

    const grouped = await Lead.findAll({
      where,
      attributes: ["status", [fn("COUNT", col("id")), "count"]],
      group: ["status"],
      raw: true,
    });

    let teamFilter = req.query.team;
    if (!teamFilter && req.user) {
      if (req.user.role === "OPS") teamFilter = "operations";
      else if (req.user.role === "EMPLOYEE" || req.user.role === "MANAGER") teamFilter = "calling";
    }

    const byStatus = statuses.rows
      .filter((status) => {
        if (!teamFilter) return true;
        const sTeam = status.team || teamForStatus(status.value, status.team);
        return sTeam === teamFilter || sTeam === "both";
      })
      .map((status) => ({
        status_id: status.id,
        value: status.value,
        label: status.label,
        team: status.team || teamForStatus(status.value, status.team),
        color_code: status.colorCode,
        count: Number(grouped.find((g) => g.status === status.value)?.count || 0),
      }));

    const now = new Date();
    const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const endOfToday = new Date(startOfToday.getTime() + 86399999);

    let workedCount = 0;
    try {
      const targetUserId = req.user.id;
      const [assignedLeadRows, callLeadRows, activityLeadRows, noteLeadRows] = await Promise.all([
        LeadAssignmentHistory.findAll({
          where: { companyId, userId: targetUserId },
          attributes: ["leadId"],
          raw: true,
        }),
        CallLog.findAll({
          where: { companyId, userId: targetUserId },
          attributes: ["leadId"],
          raw: true,
        }),
        ActivityLog.findAll({
          where: { companyId, recordType: "Lead", actorUserId: targetUserId },
          attributes: ["recordId"],
          raw: true,
        }),
        Note.findAll({
          where: { companyId, userId: targetUserId, leadId: { [Op.ne]: null } },
          attributes: ["leadId"],
          raw: true,
        }),
      ]);

      const workedLeadIds = [
        ...new Set([
          ...assignedLeadRows.map((r) => r.leadId),
          ...callLeadRows.map((r) => r.leadId),
          ...activityLeadRows.map((r) => r.recordId),
          ...noteLeadRows.map((r) => r.leadId),
        ]),
      ].filter(Boolean);

      if (workedLeadIds.length) {
        workedCount = await Lead.count({
          where: {
            ...companyScope(req),
            id: { [Op.in]: workedLeadIds },
            [Op.or]: [
              { assignedEmployeeId: { [Op.ne]: targetUserId } },
              { assignedEmployeeId: null },
            ],
          },
        });
      }
    } catch (e) {
      console.error("[getLeadCounts] workedCount error:", e.message);
    }

    const [total, unassigned, dueToday, overdue] = await Promise.all([
      Lead.count({ where }),
      Lead.count({ where: { ...where, assignedEmployeeId: null } }),
      Lead.count({ where: { ...where, nextFollowupDate: { [Op.between]: [startOfToday, endOfToday] } } }),
      Lead.count({ where: { ...where, nextFollowupDate: { [Op.lt]: startOfToday } } }),
    ]);

    return res.status(200).json({
      message: "success",
      data: { total, unassigned, followupsToday: dueToday, followupsOverdue: overdue, workedCount, byStatus },
    });
  } catch (error) {
    console.error("[leads] getLeadCounts error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/leads/import - bulk upload. Rows are processed one at a time so a
 * single bad row cannot abort the whole sheet; the response reports what
 * landed and why the rest did not.
 */
exports.importLeadsFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No Excel file uploaded" });
    }

    const companyId = req.user.companyId;
    const workbook = XLSX.read(req.file.buffer, { type: "buffer", cellDates: true });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const sheetRows = XLSX.utils.sheet_to_json(sheet);

    const statuses = await loadStatuses(companyId);
    const fresh = resolveInitialStatus(statuses.rows);

    let imported = 0;
    let skipped = 0;
    const errors = [];
    // A lead row cannot hold the sheet's remark column, so the remarks that
    // came in are gathered onto the import's own audit entry.
    const rowRemarks = [];

    for (const [index, row] of sheetRows.entries()) {
      const rowNumber = index + 2; // sheet row, counting the header
      const rawName =
        row.name ||
        row.Name ||
        row["Customer Name"] ||
        row["customer_name"] ||
        row["Name *"] ||
        row["Lead Name"] ||
        row["Client Name"] ||
        row["Borrower Name"];
      const name = rawName !== undefined && rawName !== null ? String(rawName).trim() : "";

      const rawNumber =
        row.number ||
        row.Number ||
        row.mobile ||
        row.Mobile ||
        row["Mobile *"] ||
        row["Mobile Number"] ||
        row["Contact"] ||
        row["Contact Number"] ||
        row["Phone"] ||
        row["Phone Number"];
      const digitsOnly = rawNumber !== undefined && rawNumber !== null ? String(rawNumber).replace(/\D/g, "") : "";
      const number = digitsOnly.length >= 10 ? digitsOnly.slice(-10) : digitsOnly;

      if (!name || !number || number.length < 10) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          reason: !name
            ? "Missing customer name"
            : !number
            ? "Missing mobile number"
            : "Invalid mobile number (must be at least 10 digits)",
        });
        continue;
      }

      // Check duplicate mobile: block if phone number already exists in company
      const existingCust = await Customer.findOne({
        where: {
          companyId,
          [Op.or]: [{ mobile: number }, { alternateMobile: number }],
        },
      });

      if (existingCust) {
        skipped += 1;
        errors.push({
          row: rowNumber,
          reason: `Repeated number: ${number} pehle se registered hai (Customer: ${existingCust.name}). Duplicate lead blocked.`,
        });
        continue;
      }

      const transaction = await sequelize.transaction();
      try {
        const rawEmail = row.email || row.Email || row["Email ID"] || row["Email Address"] || null;
        const rawCity = row.city || row.City || row.location || row.Location || null;
        const rawEmp =
          row.employment_type ||
          row.employmentType ||
          row["Employment Type"] ||
          row["Occupation"] ||
          null;

        const { customer } = await findOrCreateCustomer(
          companyId,
          {
            name,
            mobile: number,
            email: rawEmail ? String(rawEmail).trim() : null,
            city: rawCity ? String(rawCity).trim() : null,
            employmentType: rawEmp ? String(rawEmp).trim() : null,
          },
          transaction
        );

        let nextFollowupDate = null;
        const meeting = row.next_meeting;
        if (meeting instanceof Date && !Number.isNaN(meeting.valueOf())) {
          nextFollowupDate = meeting;
        }

        const rawSource =
          row.source ||
          row.Source ||
          row.party ||
          row.Party ||
          row.lead_source ||
          row.leadSource ||
          row["Party/Source"] ||
          row["Source/Party"] ||
          row["Source / Party"] ||
          row["Party / Source"] ||
          req.body.defaultSource ||
          "";
        const rowLeadSource = (rawSource && String(rawSource).trim()) ? String(rawSource).trim() : "Self";

        const rawCommission =
          row.commission ||
          row.Commission ||
          row.commission_percent ||
          row.commissionPercent ||
          row["Commission %"] ||
          row["Commission (%)"] ||
          row["Commission"] ||
          row["commission%"] ||
          req.body.defaultCommission ||
          null;
        const parsedCommission =
          rawCommission !== null && rawCommission !== undefined && String(rawCommission).trim() !== ""
            ? parseFloat(String(rawCommission).replace("%", "").trim())
            : null;
        const rowCommission = parsedCommission !== null && !isNaN(parsedCommission) ? parsedCommission : null;

        const rawLoanType =
          row.loan_type ||
          row.loanType ||
          row["Loan Type"] ||
          row["Product"] ||
          row["Loan Product"] ||
          null;
        const rawBudget =
          row.est_budget ||
          row.required_amount ||
          row.requiredAmount ||
          row["Required Amount"] ||
          row["Loan Amount"] ||
          row["Amount"] ||
          row["Budget"] ||
          null;
        const parsedBudget = rawBudget ? parseFloat(String(rawBudget).replace(/,/g, "").trim()) : null;
        const rowBudget = parsedBudget !== null && !isNaN(parsedBudget) ? parsedBudget : null;

        const rawPriority = String(row.priority || row.Priority || "MEDIUM").trim().toUpperCase();
        const rowPriority = ["HIGH", "MEDIUM", "LOW"].includes(rawPriority) ? rawPriority : "MEDIUM";

        const defaultAssigneeId = ![ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN].includes(req.user.role)
          ? req.user.id
          : null;

        const importedLead = await Lead.create(
          {
            companyId,
            customerId: customer.id,
            leadSource: rowLeadSource,
            commissionPercent: rowCommission,
            loanType: rawLoanType ? String(rawLoanType).trim() : null,
            requiredAmount: rowBudget,
            priority: rowPriority,
            status: fresh?.value || "NEW",
            assignedEmployeeId: defaultAssigneeId,
            assignedManagerId: defaultAssigneeId ? (req.user.managerId || null) : null,
            nextFollowupDate,
          },
          { transaction }
        );

        await transaction.commit();
        imported += 1;

        if (defaultAssigneeId) {
          trackLeadAssignment({
            companyId,
            leadId: importedLead.id,
            fromUserId: null,
            toUserId: defaultAssigneeId,
            assignedById: req.user.id,
            reason: "Initial import assignment",
            req: null,
          }).catch(() => {});
        }

        const rawRemark =
          row.remark ||
          row.Remark ||
          row.remarks ||
          row.Remarks ||
          row.note ||
          row.notes ||
          row.Notes ||
          remarkOf(row);

        if (rawRemark && String(rawRemark).trim()) {
          const cleanRemark = String(rawRemark).trim();
          rowRemarks.push(`row ${rowNumber}: ${cleanRemark}`);
          Note.create({
            companyId,
            leadId: importedLead.id,
            userId: req.user.id,
            content: cleanRemark,
          }).catch(() => {});
        }
      } catch (rowError) {
        await transaction.rollback();
        skipped += 1;
        errors.push({ row: rowNumber, reason: rowError.message });
      }
    }

    const summary = [`Bulk import of ${sheetRows.length} row(s)`];
    if (rowRemarks.length) {
      summary.push(`Remarks - ${rowRemarks.slice(0, MAX_IMPORT_REMARKS_LOGGED).join("; ")}`);
      if (rowRemarks.length > MAX_IMPORT_REMARKS_LOGGED) {
        summary.push(`and ${rowRemarks.length - MAX_IMPORT_REMARKS_LOGGED} more remark(s)`);
      }
    }

    await logActivity(req, {
      recordType: "Lead",
      recordId: 0,
      action: "CREATED",
      newValue: { imported, skipped },
      remarks: summary.join(". "),
      companyId,
    });

    return res.status(200).json({
      message: `${imported} lead(s) imported, ${skipped} skipped`,
      imported,
      skipped,
      total: sheetRows.length,
      errors: errors.slice(0, 50),
    });
  } catch (error) {
    console.error("[leads] importLeadsFromExcel error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.assignLeadSingle = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }
    const targetUserId = req.body.assignedEmployeeId || req.body.userId || req.body.person_id;
    let owner = null;
    if (targetUserId) {
      owner = await User.findByPk(targetUserId);
      if (!owner || owner.companyId !== lead.companyId) {
        return res.status(400).json({ message: "Target user not found in this company" });
      }
    }
    const prevAssignee = lead.assignedEmployeeId;
    await lead.update({
      assignedEmployeeId: owner ? owner.id : null,
      assignedManagerId: owner ? (owner.managerId ?? null) : null,
    });
    if (owner && prevAssignee !== owner.id) {
      await trackLeadAssignment({
        companyId: lead.companyId,
        leadId: lead.id,
        fromUserId: prevAssignee,
        toUserId: owner.id,
        assignedById: req.user.id,
        reason: req.body.reason || "Lead assigned",
        req,
      });
      await FollowUp.update(
        { userId: owner.id },
        { where: { leadId: lead.id, companyId: lead.companyId, status: "PENDING" } }
      ).catch((err) => console.error("[assignLeadSingle] FollowUp transfer error:", err));
    }
    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "ASSIGNED",
      newValue: { assignedEmployeeId: owner ? owner.id : null, assignedTo: owner ? owner.name : "Unassigned" },
      companyId: lead.companyId,
    });
    const statuses = await loadStatuses(lead.companyId);
    const serialized = serializeLead(lead, statuses.byValue, req.user);
    return res.status(200).json({ message: "Lead assigned", data: serialized, lead: serialized });
  } catch (error) {
    console.error("[leads] assignLeadSingle error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/leads/:id/remarks
 * Body: { remark, nextFollowupDate }
 */
exports.addLeadRemark = async (req, res) => {
  try {
    const lead = await Lead.findByPk(req.params.id);
    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (req.user.role === ROLES.EMPLOYEE) {
      if (
        !req.permissions?.editAllLeads &&
        !req.permissions?.editLeads &&
        lead.assignedEmployeeId !== req.user.id &&
        lead.assignedManagerId !== req.user.id
      ) {
        return res.status(403).json({
          code: "WORKED_LEAD_READ_ONLY",
          message: "This lead is currently assigned to another employee. You have read-only access to this worked lead.",
        });
      }
    }

    const remark = remarkOf(req.body);
    if (!remark) {
      return res.status(400).json({ message: "Remark text is required" });
    }

    const nextDate = req.body.nextFollowupDate || req.body.next_meeting;
    if (nextDate) {
      lead.nextFollowupDate = parseScheduledDate(nextDate);
      await lead.save();

      await syncLeadFollowUp({
        leadId: lead.id,
        companyId: lead.companyId,
        nextDate: lead.nextFollowupDate,
        userId: lead.assignedEmployeeId || lead.assignedManagerId || req.user.id,
        remarks: remark,
        reqUser: req.user,
      });
    }

    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "UPDATED",
      remarks: remark,
      companyId: lead.companyId,
    });

    const nowIso = new Date().toISOString();
    return res.status(200).json({
      success: true,
      message: "Remark added successfully",
      data: {
        lead_id: lead.id,
        latest_remark: remark,
        latest_remark_date: nowIso,
        latest_remark_by: req.user.name || "User",
      },
    });
  } catch (error) {
    console.error("[leads] addLeadRemark error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/leads/sample-excel
 * Downloads a ready-to-use sample Excel sheet with pre-populated demo records
 * and format instructions.
 */
exports.downloadSampleExcel = async (req, res) => {
  try {
    const sampleRows = [
      {
        "Name": "Rahul Sharma",
        "Mobile": "9876543210",
        "Source / Party": "Self",
        "Commission %": 1.5,
        "Remarks": "Interested in loan, callback requested after 4 PM",
      },
      {
        "Name": "Priya Patel",
        "Mobile": "9812345678",
        "Source / Party": "DSA Partner",
        "Commission %": 1.0,
        "Remarks": "Looking for lowest interest rate",
      },
      {
        "Name": "Vikram Singh",
        "Mobile": "9765432109",
        "Source / Party": "Direct",
        "Commission %": 0.0,
        "Remarks": "Urgent requirement",
      },
    ];

    const guidelines = [
      {
        "Column Name": "Name",
        "Required": "YES (Mandatory)",
        "Description": "Full name of customer / borrower",
        "Example": "Rahul Sharma",
      },
      {
        "Column Name": "Mobile",
        "Required": "YES (Mandatory)",
        "Description": "10-digit mobile phone number",
        "Example": "9876543210",
      },
      {
        "Column Name": "Source / Party",
        "Required": "Optional",
        "Description": "Lead source or DSA channel (defaults to Self)",
        "Example": "Self, Direct, DSA Partner",
      },
      {
        "Column Name": "Commission %",
        "Required": "Optional",
        "Description": "Commission percentage (numeric)",
        "Example": "1.5",
      },
      {
        "Column Name": "Remarks",
        "Required": "Optional",
        "Description": "Initial discussion notes or callback time",
        "Example": "Customer requested callback after 4 PM",
      },
    ];

    const wb = XLSX.utils.book_new();

    const wsSample = XLSX.utils.json_to_sheet(sampleRows);
    wsSample["!cols"] = [
      { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 45 }
    ];
    XLSX.utils.book_append_sheet(wb, wsSample, "Sample Leads");

    const wsGuide = XLSX.utils.json_to_sheet(guidelines);
    wsGuide["!cols"] = [{ wch: 18 }, { wch: 16 }, { wch: 44 }, { wch: 30 }];
    XLSX.utils.book_append_sheet(wb, wsGuide, "Format Guide & Rules");

    const buffer = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

    res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("Content-Disposition", 'attachment; filename="Sample_Leads_Template.xlsx"');
    return res.status(200).send(buffer);
  } catch (error) {
    console.error("[leads] downloadSampleExcel error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.getLatestRemarksForLeads = getLatestRemarksForLeads;
exports.serializeLead = serializeLead;
exports.loadStatuses = loadStatuses;
exports.visibilityScope = visibilityScope;
exports.dateRangeWhere = dateRangeWhere;
exports.MAX_SELF_ASSIGN_LEADS = MAX_SELF_ASSIGN_LEADS;
exports.trackLeadAssignment = trackLeadAssignment;
