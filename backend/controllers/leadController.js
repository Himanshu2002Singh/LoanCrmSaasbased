const { Op, fn, col, literal } = require("sequelize");
const XLSX = require("xlsx");
const { Lead, Customer, User, MasterConfig, CallLog, FollowUp, ActivityLog, Application, Document, Lender, sequelize } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
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
 * The panel and the mobile app read a flat lead row with the customer's
 * details inlined. Keep that shape and hang the nested records off it.
 */
const serializeLead = (lead, statusMap = {}) => {
  const customer = lead.customer || {};
  const status = statusMap[lead.status];
  const apps = lead.applications || [];
  const primaryApp =
    apps.find((a) => a.sanctionedAmount || a.status === "SANCTIONED" || a.status === "DISBURSED") ||
    apps[0] ||
    null;
  const sanctionedAmount = primaryApp?.sanctionedAmount ? parseFloat(primaryApp.sanctionedAmount) : null;
  const appliedAmount = primaryApp?.appliedAmount
    ? parseFloat(primaryApp.appliedAmount)
    : lead.requiredAmount
    ? parseFloat(lead.requiredAmount)
    : null;
  const bankName = primaryApp?.lender?.name || null;
  const sanctionDate = primaryApp?.sanctionedAmount ? primaryApp.updatedAt : null;
  const commPercent =
    lead.commissionPercent !== null && lead.commissionPercent !== undefined
      ? parseFloat(lead.commissionPercent)
      : null;
  const baseAmount = sanctionedAmount || appliedAmount || (lead.requiredAmount ? parseFloat(lead.requiredAmount) : null);
  const commissionAmount =
    baseAmount !== null && commPercent !== null ? Math.round((baseAmount * commPercent) / 100) : null;

  return {
    lead_id: lead.id,
    id: lead.id,
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
    sanctioned_amount: sanctionedAmount,
    applied_amount: appliedAmount,
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
    manager_id: lead.assignedManagerId,
    manager: lead.assignedManager?.name || null,
    createdAt: lead.createdAt,
    updatedAt: lead.updatedAt,
    customer: lead.customer || null,
    applications_count: apps.length,
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
  return (
    statuses.rows.find((row) => row.value === wanted.toUpperCase()) ||
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
const canSetStatus = (role, status) => {
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN].includes(role)) return true;
  const team = status?.team || teamForStatus(status?.value, status?.team);
  if (role === ROLES.OPS) return team === "operations" || team === "both";
  if (role === ROLES.EMPLOYEE || role === ROLES.MANAGER) return team === "calling" || team === "both";
  return false;
};

/**
 * Row-level visibility: an employee and ops staff see leads assigned to them,
 * a manager sees their team's, admins see the whole company.
 */
const visibilityScope = async (req) => {
  if (req.user.role === ROLES.EMPLOYEE) {
    return {
      [Op.or]: [
        { assignedEmployeeId: req.user.id },
        { assignedManagerId: req.user.id },
      ],
    };
  }
  if (req.user.role === ROLES.OPS) {
    if (req.query.assignedOnly === "true") {
      return {
        [Op.or]: [
          { assignedEmployeeId: req.user.id },
          { assignedManagerId: req.user.id },
        ],
      };
    }
    return {
      [Op.or]: [
        { assignedEmployeeId: req.user.id },
        { assignedManagerId: req.user.id },
        {
          status: {
            [Op.in]: [
              "PASSED_TO_OPS",
              "DOCS_PENDING",
              "DOCS_RECEIVED",
              "VERIFICATION_PENDING",
              "APPLICATION_CREATED",
              "FILE_LOGIN",
              "SANCTIONED",
              "DISBURSED",
            ],
          },
        },
      ],
    };
  }
  if (req.user.role === ROLES.MANAGER) {
    if (req.permissions?.viewAllLeads) {
      return {};
    }
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

    let fromDate = req.query.fromDate;
    let toDate = req.query.toDate;
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

    const where = {
      ...companyScope(req),
      ...(await visibilityScope(req)),
      ...dateRangeWhere(fromDate, toDate),
    };

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
        where.status = { [Op.in]: completedValues };
      } else if (cat === "PENDING") {
        where.status = { [Op.notIn]: [...completedValues, ...rejectedValues] };
      } else if (cat === "REJECTED") {
        where.status = { [Op.in]: rejectedValues };
      }
    } else if (req.query.status) {
      const status = resolveStatus(statuses, req.query.status);
      where.status = status ? status.value : req.query.status;
    } else if (validTeamStatusSet && validTeamStatusSet.length > 0 && req.query.team === "calling") {
      where.status = { [Op.in]: validTeamStatusSet };
    }

    if (req.query.loanType) where.loanType = req.query.loanType;
    if (req.query.source) where.leadSource = req.query.source;
    if (req.query.priority) where.priority = String(req.query.priority).toUpperCase();
    if (req.query.assignedEmployeeId) where.assignedEmployeeId = parseInt(req.query.assignedEmployeeId, 10);
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

    const payload = paginated({ count, rows: rows.map((r) => serializeLead(r, statuses.byValue)), page, limit });
    // The panel's table reads pagination.totalItems.
    payload.pagination.totalItems = count;
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
      ],
    });

    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    if (req.user.role === ROLES.EMPLOYEE || req.user.role === ROLES.OPS) {
      if (lead.assignedEmployeeId !== req.user.id && lead.assignedManagerId !== req.user.id) {
        return res.status(403).json({ message: "You do not have access to this lead" });
      }
    }

    const statuses = await loadStatuses(lead.companyId);

    const creationActivity = await ActivityLog.findOne({
      where: { companyId: lead.companyId, recordType: "Lead", recordId: lead.id, action: "CREATED" },
      attributes: ["remarks"],
    });

    const lastActivity = await ActivityLog.findOne({
      where: {
        companyId: lead.companyId,
        recordType: "Lead",
        recordId: lead.id,
        remarks: { [Op.ne]: null },
      },
      order: [["createdAt", "DESC"]],
      attributes: ["remarks"],
    });

    return res.status(200).json({
      message: "success",
      data: {
        ...serializeLead(lead, statuses.byValue),
        remarks: creationActivity?.remarks || null,
        initial_remark: creationActivity?.remarks || null,
        last_remark: lastActivity?.remarks || null,
        callLogs: lead.callLogs,
        followUps: lead.followUps,
        applications: lead.applications || [],
        documents: lead.documents || [],
      },
    });
  } catch (error) {
    console.error("[leads] getLeadById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
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
    const { customer } = await findOrCreateCustomer(
      companyId,
      {
        name: body.name,
        mobile: body.number || body.mobile,
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

    if (requested && !canSetStatus(req.user.role, requested)) {
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
    if (body.next_meeting !== undefined) data.nextFollowupDate = body.next_meeting || null;
    if (data.priority) data.priority = String(data.priority).toUpperCase();
    const rawComm = body.commission_percent ?? body.commissionPercent ?? body.commission;
    if (rawComm !== undefined && rawComm !== null && String(rawComm).trim() !== "") {
      data.commissionPercent = parseFloat(rawComm);
    } else {
      data.commissionPercent = null;
    }

    const remark = remarkOf(body);

    // An employee creating a lead owns it; their manager inherits oversight.
    const assignedEmployeeId =
      body.assignedEmployeeId ?? body.person_id ?? (req.user.role === ROLES.EMPLOYEE ? req.user.id : null);
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
        assignedManagerId: body.assignedManagerId ?? owner?.managerId ?? null,
      },
      { transaction }
    );

    await transaction.commit();

    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "CREATED",
      newValue: { customer: customer.name, mobile: customer.mobile, status: lead.status },
      remarks: remark,
      companyId,
    });

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

    if (req.user.role === ROLES.EMPLOYEE || req.user.role === ROLES.OPS) {
      if (lead.assignedEmployeeId !== req.user.id && lead.assignedManagerId !== req.user.id) {
        return res.status(403).json({ message: "You do not have permission to edit this lead" });
      }
    }

    const body = req.body;
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
    if (body.next_meeting !== undefined) data.nextFollowupDate = body.next_meeting || null;
    if (data.priority) data.priority = String(data.priority).toUpperCase();
    const rawUpdateComm = body.commission_percent ?? body.commissionPercent ?? body.commission;
    if (rawUpdateComm !== undefined) {
      data.commissionPercent = (rawUpdateComm !== null && String(rawUpdateComm).trim() !== "")
        ? parseFloat(rawUpdateComm)
        : null;
    }

    const remark = remarkOf(body);

    let statusChange = null;
    const requested = resolveStatus(statuses, body.status ?? body.status_id);
    if (requested && requested.value !== lead.status) {
      if (!canSetStatus(req.user.role, requested)) {
        return res.status(403).json({ message: `Your role cannot set the status "${requested.label}"` });
      }
      statusChange = { from: lead.status, to: requested.value };
      data.status = requested.value;
    }

    if (body.assignedEmployeeId !== undefined || body.person_id !== undefined) {
      const nextOwnerId = body.assignedEmployeeId ?? body.person_id;
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
    if (body.email !== undefined) customerPatch.email = body.email;
    if (body.city !== undefined) customerPatch.city = body.city;
    if (body.alternate_number !== undefined) customerPatch.alternateMobile = body.alternate_number;
    if (body.employment_type !== undefined || body.employmentType !== undefined) {
      customerPatch.employmentType = body.employment_type || body.employmentType;
    }
    if (body.monthly_income !== undefined || body.monthlyIncome !== undefined || body.income !== undefined) {
      customerPatch.monthlyIncome = body.monthly_income ?? body.monthlyIncome ?? body.income;
    }
    if (body.pan_number !== undefined || body.panNumber !== undefined) {
      customerPatch.panNumber = body.pan_number || body.panNumber;
    }
    if (Object.keys(customerPatch).length && lead.customer) {
      await lead.customer.update(customerPatch);
    }

    return res.status(200).json({ message: "Lead updated", data: serializeLead(lead, statuses.byValue) });
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

    const statuses = await loadStatuses(lead.companyId);
    const status = resolveStatus(statuses, req.body.status ?? req.body.status_id);
    if (!status) {
      return res.status(400).json({ message: "Unknown status" });
    }
    if (!canSetStatus(req.user.role, status)) {
      return res.status(403).json({ message: `Your role cannot set the status "${status.label}"` });
    }

    const previous = lead.status;
    const patch = { status: status.value };
    if (req.body.next_meeting !== undefined) patch.nextFollowupDate = req.body.next_meeting || null;

    await lead.update(patch);

    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "STATUS_CHANGED",
      oldValue: { status: previous },
      newValue: { status: status.value },
      remarks: remarkOf(req.body),
      companyId: lead.companyId,
    });

    return res.status(200).json({ message: "Status updated", data: serializeLead(lead, statuses.byValue) });
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
      leads: leads.map((l) => serializeLead(l, statuses.byValue)),
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
        logActivity(req, {
          recordType: "Lead",
          recordId: id,
          action: "ASSIGNED",
          newValue: { assignedEmployeeId: owner.id, assignedTo: owner.name },
          companyId: req.user.companyId,
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
        await logActivity(req, {
          recordType: "Lead",
          recordId: lead.id,
          action: "ASSIGNED",
          oldValue: { assignedEmployeeId: from },
          newValue: { assignedEmployeeId: owner.id, assignedTo: owner.name },
          companyId: lead.companyId,
        });
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

    const windows = {
      today: { [Op.between]: [startOfToday, endOfToday] },
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

    const payload = paginated({ count, rows: rows.map((r) => serializeLead(r, statuses.byValue)), page, limit });
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

    const [total, unassigned, dueToday, overdue] = await Promise.all([
      Lead.count({ where }),
      Lead.count({ where: { ...where, assignedEmployeeId: null } }),
      Lead.count({ where: { ...where, nextFollowupDate: { [Op.between]: [startOfToday, endOfToday] } } }),
      Lead.count({ where: { ...where, nextFollowupDate: { [Op.lt]: startOfToday } } }),
    ]);

    return res.status(200).json({
      message: "success",
      data: { total, unassigned, followupsToday: dueToday, followupsOverdue: overdue, byStatus },
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
      const name = row.name || row.Name;
      const number = row.number || row.Number || row.mobile || row.Mobile;

      if (!name || !number) {
        skipped += 1;
        errors.push({ row: rowNumber, reason: "Missing name or number" });
        continue;
      }

      const transaction = await sequelize.transaction();
      try {
        const { customer } = await findOrCreateCustomer(
          companyId,
          {
            name,
            mobile: number,
            email: row.email || null,
            city: row.city || null,
            employmentType: row.employment_type || null,
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

        await Lead.create(
          {
            companyId,
            customerId: customer.id,
            leadSource: rowLeadSource,
            commissionPercent: rowCommission,
            loanType: row.loan_type || null,
            requiredAmount: row.est_budget || null,
            priority: String(row.priority || "MEDIUM").toUpperCase(),
            status: fresh?.value || "NEW",
            nextFollowupDate,
          },
          { transaction }
        );

        await transaction.commit();
        imported += 1;

        const remark = remarkOf(row);
        if (remark) rowRemarks.push(`row ${rowNumber}: ${remark}`);
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

exports.serializeLead = serializeLead;
exports.loadStatuses = loadStatuses;
exports.visibilityScope = visibilityScope;
exports.dateRangeWhere = dateRangeWhere;
exports.MAX_SELF_ASSIGN_LEADS = MAX_SELF_ASSIGN_LEADS;
