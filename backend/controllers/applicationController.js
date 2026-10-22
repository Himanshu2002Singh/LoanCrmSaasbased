const { Op } = require("sequelize");
const { Application, Lead, Customer, Lender, User, Document, BankerQuery, MasterConfig, OperationStatusHistory, sequelize } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");
const { sendMail } = require("../utils/emailService");
const { getPublicApiBaseUrl } = require("../utils/documentHelper");

const APP_FIELDS = [
  "loanProduct",
  "appliedAmount",
  "sanctionedAmount",
  "disbursedAmount",
  "assignedBankerId",
  "lenderId",
  "rejectionReason",
  "legalStatus",
  "legalRemark",
  "technicalStatus",
  "technicalRemark",
  "pddStatus",
  "pddRemark",
  "otcStatus",
  "otcRemark",
  "disbursedRemark",
  "lastOpsRemark",
];

const getCompanyId = (req) => req.companyId || req.user?.companyId;

/**
 * Generates an incrementing application number like APP-2026-0001
 */
const generateAppNumber = async (companyId) => {
  const count = await Application.count({ where: { companyId } });
  const year = new Date().getFullYear();
  const seq = String(count + 1).padStart(4, "0");
  return `APP-${year}-${seq}`;
};

/**
 * @desc    Create a new Loan Application from a Lead
 * @route   POST /api/applications
 */
const createApplication = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const { leadId, customerId, loanProduct, appliedAmount, lenderId, assignedBankerId } = req.body;

    if (!leadId || !loanProduct || !appliedAmount) {
      await t.rollback();
      return res.status(400).json({
        message: "leadId, loanProduct, and appliedAmount are required",
      });
    }

    const lead = await Lead.findByPk(leadId, { transaction: t });
    if (!lead || !belongsToScope(req, lead)) {
      await t.rollback();
      return res.status(404).json({ message: "Referenced lead not found" });
    }

    if (req.user.role === ROLES.EMPLOYEE) {
      if (
        !req.permissions?.editAllLeads &&
        !req.permissions?.manageOperations &&
        lead.assignedEmployeeId !== req.user.id &&
        lead.assignedManagerId !== req.user.id
      ) {
        await t.rollback();
        return res.status(403).json({
          code: "WORKED_LEAD_READ_ONLY",
          message: "This lead is currently assigned to another employee. You have read-only access to this worked lead.",
        });
      }
    }

    const resolvedCustomerId = customerId ? parseInt(customerId, 10) : lead.customerId;
    const resolvedCompId = getCompanyId(req);
    const applicationNumber = await generateAppNumber(resolvedCompId);

    const application = await Application.create(
      {
        companyId: resolvedCompId,
        leadId: lead.id,
        customerId: resolvedCustomerId,
        applicationNumber,
        loanProduct: loanProduct.trim(),
        appliedAmount: parseFloat(appliedAmount),
        lenderId: lenderId ? parseInt(lenderId, 10) : null,
        assignedBankerId: assignedBankerId ? parseInt(assignedBankerId, 10) : null,
        status: "DOCS_PENDING",
      },
      { transaction: t }
    );

    // Update lead status to PASSED_TO_OPS if not already
    if (lead.status !== "PASSED_TO_OPS") {
      await lead.update({ status: "PASSED_TO_OPS" }, { transaction: t });
    }

    await logActivity(
      req,
      {
        recordType: "Application",
        recordId: application.id,
        action: "CREATED",
        newValue: application.toJSON(),
        remarks: `Created Application #${application.applicationNumber} for Lead #${lead.id}`,
      },
      t
    );

    await t.commit();
    return res.status(201).json({
      message: "Application created successfully",
      application,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

const parseList = (val) => {
  if (!val) return [];
  if (Array.isArray(val)) return val.map((s) => String(s).trim()).filter(Boolean);
  return String(val)
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
};

/**
 * @desc    List Loan Applications with combined multi-select filters & pagination
 *          Supports Employee, DSA, Bank/NBFC, Association, and Status/Stage workflow filters
 * @route   GET /api/applications
 */
const listApplications = async (req, res, next) => {
  try {
    const { status, lenderId, customerId, assignedBankerId, leadId, search } = req.query;

    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: ["applicationNumber", "loanProduct"],
      sortable: ["createdAt", "appliedAmount", "sanctionedAmount", "disbursedAmount", "status", "applicationNumber"],
      defaultSort: ["createdAt", "DESC"],
    });

    Object.assign(where, companyScope(req));

    // Banker scoping: Bankers can ONLY see applications explicitly assigned to them
    if (req.user.role === ROLES.BANKER) {
      where.assignedBankerId = req.user.id;
    } else if (assignedBankerId) {
      where.assignedBankerId = parseInt(assignedBankerId, 10);
    }

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

    if (fromDate || toDate) {
      const range = {};
      if (fromDate) range[Op.gte] = new Date(`${fromDate}T00:00:00`);
      if (toDate) range[Op.lte] = new Date(`${toDate}T23:59:59`);
      where.createdAt = range;
    }

    // 1. Bank / NBFC Multi-select or Single Filter
    const bankParams = parseList(req.query.bankIds || req.query.bankId || req.query.lenderIds || lenderId).filter(
      (b) => b !== "ALL"
    );
    const validBankIds = bankParams.map(Number).filter((n) => !isNaN(n) && n > 0);
    if (validBankIds.length === 1) {
      where.lenderId = validBankIds[0];
    } else if (validBankIds.length > 1) {
      where.lenderId = { [Op.in]: validBankIds };
    }

    if (customerId) where.customerId = parseInt(customerId, 10);
    if (leadId) where.leadId = parseInt(leadId, 10);

    // 2. Status / Stage Workflow Combined Filter
    const stageParams = parseList(req.query.stageFilter || status).filter((s) => s !== "ALL");
    if (stageParams.length > 0) {
      const stageOrConditions = [];
      stageParams.forEach((st) => {
        const key = st.toUpperCase();
        if (key === "COMPLETED_STAGES" || key === "COMPLETED") {
          stageOrConditions.push({ status: { [Op.in]: ["SANCTIONED", "DISBURSED", "APPROVED"] } });
        } else if (key === "PENDING_STAGES" || key === "PENDING") {
          stageOrConditions.push({
            status: {
              [Op.in]: [
                "DOCS_PENDING",
                "UNDER_VERIFICATION",
                "SUBMITTED_TO_BANK",
                "UNDER_REVIEW",
                "QUERY_RAISED",
                "LOGGED_IN",
                "READY_TO_SEND",
                "UNDERWRITING",
              ],
            },
          });
        } else if (key === "DOCS_PENDING") {
          stageOrConditions.push({ status: "DOCS_PENDING" });
        } else if (key === "READY_TO_SEND" || key === "LOGGED_IN") {
          stageOrConditions.push({ status: { [Op.in]: ["READY_TO_SEND", "LOGGED_IN"] } });
        } else if (key === "SUBMITTED_TO_BANK") {
          stageOrConditions.push({ status: "SUBMITTED_TO_BANK" });
        } else if (key === "PD" || key === "PD_ALL") {
          stageOrConditions.push({ pdStatus: { [Op.ne]: null } });
        } else if (key === "PD_PENDING") {
          stageOrConditions.push({ pdStatus: "PENDING" });
        } else if (key === "PD_COMPLETED") {
          stageOrConditions.push({ pdStatus: "COMPLETED" });
        } else if (key === "QUERY" || key === "QUERY_ALL") {
          stageOrConditions.push({ opsQueryStatus: { [Op.in]: ["PENDING", "COMPLETED"] } });
        } else if (key === "QUERY_PENDING") {
          stageOrConditions.push({ opsQueryStatus: "PENDING" });
        } else if (key === "QUERY_COMPLETED") {
          stageOrConditions.push({ opsQueryStatus: "COMPLETED" });
        } else if (key === "LEGAL" || key === "LEGAL_ALL") {
          stageOrConditions.push({ legalStatus: { [Op.ne]: null } });
        } else if (key === "LEGAL_INITIATED") {
          stageOrConditions.push({ legalStatus: "INITIATED" });
        } else if (key === "LEGAL_RESOLVED") {
          stageOrConditions.push({ legalStatus: "RESOLVED" });
        } else if (key === "LEGAL_REJECTED") {
          stageOrConditions.push({ legalStatus: "REJECTED" });
        } else if (key === "TECHNICAL" || key === "TECHNICAL_ALL") {
          stageOrConditions.push({ technicalStatus: { [Op.ne]: null } });
        } else if (key === "TECHNICAL_INITIATED") {
          stageOrConditions.push({ technicalStatus: "INITIATED" });
        } else if (key === "TECHNICAL_RESOLVED") {
          stageOrConditions.push({ technicalStatus: "RESOLVED" });
        } else if (key === "TECHNICAL_REJECTED") {
          stageOrConditions.push({ technicalStatus: "REJECTED" });
        } else if (key === "LOGIN" || key === "LOGIN_ALL") {
          stageOrConditions.push({ [Op.or]: [{ loginStatus: { [Op.ne]: null } }, { status: "LOGGED_IN" }] });
        } else if (key === "LOGIN_PENDING") {
          stageOrConditions.push({ [Op.or]: [{ loginStatus: "PENDING" }, { status: "SUBMITTED_TO_BANK" }] });
        } else if (key === "LOGIN_COMPLETED") {
          stageOrConditions.push({ [Op.or]: [{ loginStatus: "COMPLETED" }, { status: "LOGGED_IN" }] });
        } else if (key === "SANCTIONED") {
          stageOrConditions.push({ [Op.or]: [{ status: "SANCTIONED" }, { sanctionStatus: "SANCTIONED" }] });
        } else if (key === "DISBURSEMENT" || key === "DISBURSED_INITIATED") {
          stageOrConditions.push({
            [Op.or]: [
              { status: "DISBURSEMENT" },
              { disbursementStatus: { [Op.in]: ["INITIATED", "PARTIAL", "DISBURSED", "COMPLETED"] } },
            ],
          });
        } else if (key === "PDD" || key === "PDD_ALL") {
          stageOrConditions.push({ pddStatus: { [Op.ne]: null } });
        } else if (key === "PDD_PENDING") {
          stageOrConditions.push({ pddStatus: "PENDING" });
        } else if (key === "PDD_RESOLVED") {
          stageOrConditions.push({ pddStatus: "RESOLVED" });
        } else if (key === "OTC" || key === "OTC_ALL") {
          stageOrConditions.push({ otcStatus: { [Op.ne]: null } });
        } else if (key === "OTC_PENDING") {
          stageOrConditions.push({ otcStatus: "PENDING" });
        } else if (key === "OTC_RESOLVED") {
          stageOrConditions.push({ otcStatus: "RESOLVED" });
        } else if (key === "PENDING_DISBURSEMENT") {
          stageOrConditions.push({
            status: "SANCTIONED",
            [Op.or]: [{ pddStatus: "PENDING" }, { otcStatus: "PENDING" }],
          });
        } else if (key === "DISBURSED") {
          stageOrConditions.push({ status: "DISBURSED" });
        } else if (key === "CANCELLED") {
          stageOrConditions.push({ [Op.or]: [{ status: "CANCELLED" }, { disbursementStatus: "CANCELLED" }] });
        } else if (key === "REJECTED") {
          stageOrConditions.push({ status: { [Op.in]: ["REJECTED", "CANCELLED"] } });
        } else {
          stageOrConditions.push({ status: st });
        }
      });

      if (stageOrConditions.length === 1) {
        Object.assign(where, stageOrConditions[0]);
      } else if (stageOrConditions.length > 1) {
        where[Op.or] = stageOrConditions;
      }
    }

    // 3. Employee, DSA, and Association Filters (on linked Lead)
    const employeeParams = parseList(req.query.employeeIds || req.query.employeeId).map(Number).filter((n) => !isNaN(n) && n > 0);
    const dsaParams = parseList(req.query.dsaNames || req.query.dsaName || req.query.dsa);
    const associationParams = parseList(req.query.associations || req.query.association);

    const leadWhere = {};
    let leadRequired = false;

    if (employeeParams.length > 0) {
      leadWhere.assignedEmployeeId = { [Op.in]: employeeParams };
      leadRequired = true;
    }

    if (dsaParams.length > 0 && associationParams.length > 0) {
      // Find intersection or both
      const common = dsaParams.filter((d) => associationParams.includes(d));
      leadWhere.leadSource = { [Op.in]: common.length > 0 ? common : dsaParams.concat(associationParams) };
      leadRequired = true;
    } else if (dsaParams.length > 0) {
      leadWhere.leadSource = { [Op.in]: dsaParams };
      leadRequired = true;
    } else if (associationParams.length > 0) {
      leadWhere.leadSource = { [Op.in]: associationParams };
      leadRequired = true;
    }

    const isUnrestrictedAdmin =
      req.user.role === ROLES.SUPERADMIN ||
      req.user.role === ROLES.COMPANY_ADMIN ||
      req.permissions?.viewAllLeads === true;

    if (!isUnrestrictedAdmin) {
      if (req.user.role === ROLES.MANAGER) {
        const subordinates = await User.findAll({
          where: { companyId: req.user.companyId, managerId: req.user.id },
          attributes: ["id"],
          raw: true,
        });
        const teamIds = [req.user.id, ...subordinates.map((u) => u.id)];
        leadWhere[Op.or] = [
          { assignedManagerId: req.user.id },
          { assignedEmployeeId: { [Op.in]: teamIds } },
        ];
        leadRequired = true;
      } else if (req.user.role === ROLES.OPS || req.user.role === ROLES.EMPLOYEE) {
        leadWhere[Op.or] = [
          { assignedEmployeeId: req.user.id },
          { assignedManagerId: req.user.id },
        ];
        leadRequired = true;
      }
    } else if (req.query.assignedOnly === "true") {
      leadWhere[Op.or] = [
        { assignedEmployeeId: req.user.id },
        { assignedManagerId: req.user.id },
      ];
      leadRequired = true;
    }

    const leadInclude = {
      model: Lead,
      as: "lead",
      attributes: [
        "id",
        "assignedEmployeeId",
        "assignedManagerId",
        "leadSource",
        "loanType",
        "requiredAmount",
        "priority",
        "status",
      ],
      include: [
        {
          model: User,
          as: "assignedEmployee",
          attributes: ["id", "name", "email", "phone"],
        },
      ],
      required: leadRequired,
      where: leadRequired || Reflect.ownKeys(leadWhere).length > 0 ? leadWhere : undefined,
    };

    const { count, rows } = await Application.findAndCountAll({
      where,
      limit,
      offset,
      order,
      distinct: true,
      subQuery: false,
      include: [
        leadInclude,
        {
          model: Customer,
          as: "customer",
          attributes: [
            "id",
            "name",
            "mobile",
            "city",
            "email",
            "employmentType",
            "monthlyIncome",
            "panNumber",
            "aadhaarMasked",
          ],
        },
        { model: Lender, as: "lender", attributes: ["id", "name", "shortCode", "lenderType"] },
        { model: User, as: "assignedBanker", attributes: ["id", "name", "email", "phone"] },
        { model: Document, as: "documents" },
        {
          model: BankerQuery,
          as: "queries",
          attributes: ["id", "status", "queryText", "responseText", "createdAt"],
        },
      ],
    });

    const { getLatestRemarksForLeads } = require("./leadController");
    const leadIds = rows.map((r) => r.leadId).filter(Boolean);
    const remarksMap = await getLatestRemarksForLeads(leadIds, getCompanyId(req));

    const serializedRows = rows.map((r) => {
      const plain = r.get ? r.get({ plain: true }) : { ...r };
      const rem = remarksMap.get(r.leadId);

      // Determine the true latest remark between Lead and Application Ops
      let latestRemark = rem?.remarks || null;
      let latestRemarkDate = rem?.createdAt || null;
      let latestRemarkBy = rem?.actor || null;

      if (plain.lastOpsRemark) {
        if (!latestRemarkDate || new Date(plain.lastOpsUpdatedAt) >= new Date(latestRemarkDate)) {
          latestRemark = plain.lastOpsRemark;
          latestRemarkDate = plain.lastOpsUpdatedAt;
          latestRemarkBy = "Operations";
        }
      }

      // Compute precise workflow status summary and disbursement readiness
      const pddStatus = (plain.pddStatus || "PENDING").toUpperCase();
      const otcStatus = (plain.otcStatus || "PENDING").toUpperCase();
      const isPddResolved = pddStatus === "RESOLVED";
      const isOtcResolved = otcStatus === "RESOLVED";
      const isDisbursed = plain.status === "DISBURSED";
      const isSanctioned = plain.status === "SANCTIONED" || plain.status === "APPROVED";

      let workflowStage = plain.status;
      let stageDisplay = plain.status;
      let disbursementReadiness = "LOCKED"; // "LOCKED" | "PENDING_PDD_OTC" | "READY" | "DISBURSED"

      if (isDisbursed) {
        workflowStage = "DISBURSED";
        stageDisplay = "Disbursed";
        disbursementReadiness = "DISBURSED";
      } else if (plain.status === "REJECTED" || plain.status === "CANCELLED") {
        workflowStage = "REJECTED";
        stageDisplay = "Rejected";
        disbursementReadiness = "LOCKED";
      } else if (plain.status === "DISBURSEMENT") {
        workflowStage = "DISBURSEMENT";
        stageDisplay = "Disbursement";
        disbursementReadiness = (!isPddResolved || !isOtcResolved) ? "PENDING_PDD_OTC" : "READY";
      } else if (isSanctioned) {
        if (!isPddResolved || !isOtcResolved) {
          workflowStage = "PENDING_DISBURSEMENT";
          stageDisplay = "Pending for Disbursement";
          disbursementReadiness = "PENDING_PDD_OTC";
        } else {
          workflowStage = "READY_FOR_DISBURSEMENT";
          stageDisplay = "Ready to Disburse";
          disbursementReadiness = "READY";
        }
      } else if (plain.technicalStatus === "INITIATED") {
        workflowStage = "TECHNICAL_INITIATED";
        stageDisplay = "Technical: Initiated";
      } else if (plain.legalStatus === "INITIATED") {
        workflowStage = "LEGAL_INITIATED";
        stageDisplay = "Legal: Initiated";
      } else if (plain.status === "SUBMITTED_TO_BANK") {
        workflowStage = "SUBMITTED_TO_BANK";
        stageDisplay = "Submitted to Bank";
      } else if (plain.status === "READY_TO_SEND" || plain.status === "LOGGED_IN") {
        workflowStage = "READY_TO_SEND";
        stageDisplay = "Ready to Send";
      } else {
        workflowStage = "DOCS_PENDING";
        stageDisplay = "Documents Pending";
      }

      return {
        ...plain,
        workflowStage,
        stageDisplay,
        disbursementReadiness,
        isPddResolved,
        isOtcResolved,
        latest_remark: latestRemark,
        latest_remark_date: latestRemarkDate,
        latest_remark_by: latestRemarkBy,
      };
    });

    const payload = paginated({ count, rows: serializedRows, page, limit });
    payload.pagination.totalItems = count;
    payload.applications = payload.data;

    // Calculate live stage counts & financial volume totals across all filtered applications
    const summaryWhere = { ...where };
    delete summaryWhere.status;

    const allApps = await Application.findAll({
      where: summaryWhere,
      attributes: ["id", "status", "appliedAmount", "sanctionedAmount", "disbursedAmount", "opsQueryStatus", "pdStatus", "legalStatus", "technicalStatus", "loginStatus"],
      include: leadRequired ? [leadInclude] : [],
    });

    const summary = {
      totalApplications: allApps.length,
      totalAppliedAmount: 0,
      totalSanctionedAmount: 0,
      totalDisbursedAmount: 0,
      disbursedCount: 0,
      sanctionedCount: 0,
      pendingCount: 0,
      rejectedCount: 0,
      bankStages: {
        LOGGED_IN: { count: 0, amount: 0 },
        UNDER_PROCESS: { count: 0, amount: 0 },
        QUERY_RAISED: { count: 0, amount: 0 },
        SANCTIONED: { count: 0, amount: 0 },
        STATUS_NOT_SET: { count: 0, amount: 0 },
      },
      stageCounts: {
        DOCS_PENDING: 0,
        UNDER_VERIFICATION: 0,
        SUBMITTED_TO_BANK: 0,
        QUERY_RAISED: 0,
        SANCTIONED: 0,
        DISBURSEMENT: 0,
        DISBURSED: 0,
        REJECTED: 0,
        CANCELLED: 0,
      },
    };

    allApps.forEach((app) => {
      const s = (app.status || "DOCS_PENDING").toUpperCase();
      const disbStatus = (app.disbursementStatus || "").toUpperCase();
      const qStatus = (app.opsQueryStatus || "").toUpperCase();
      const applied = parseFloat(app.appliedAmount || 0);
      const sanctioned = parseFloat(app.sanctionedAmount || 0);
      const stageAmt = sanctioned || applied || 0;

      // Group into Bank Stage KPI buckets
      if (s === "QUERY" || s === "QUERY_RAISED" || qStatus === "PENDING") {
        summary.bankStages.QUERY_RAISED.count++;
        summary.bankStages.QUERY_RAISED.amount += stageAmt;
      } else if (s === "SANCTIONED" || s === "APPROVED") {
        summary.bankStages.SANCTIONED.count++;
        summary.bankStages.SANCTIONED.amount += (sanctioned || stageAmt);
      } else if (
        s === "PD" || s === "LEGAL" || s === "TECHNICAL" ||
        s.includes("PROCESS") || s.includes("VERIF") || s.includes("REVIEW") || s.includes("UNDERWRITING") ||
        (app.pdStatus && app.pdStatus !== "PENDING" && app.pdStatus !== "NONE") ||
        (app.legalStatus && app.legalStatus !== "PENDING" && app.legalStatus !== "NONE") ||
        (app.technicalStatus && app.technicalStatus !== "PENDING" && app.technicalStatus !== "NONE")
      ) {
        summary.bankStages.UNDER_PROCESS.count++;
        summary.bankStages.UNDER_PROCESS.amount += stageAmt;
      } else if (s === "LOGGED_IN" || s === "LOGIN" || s === "SUBMITTED_TO_BANK" || (app.loginStatus && app.loginStatus === "COMPLETED")) {
        summary.bankStages.LOGGED_IN.count++;
        summary.bankStages.LOGGED_IN.amount += stageAmt;
      } else {
        summary.bankStages.STATUS_NOT_SET.count++;
        summary.bankStages.STATUS_NOT_SET.amount += stageAmt;
      }
      const isCancelled = s === "CANCELLED" || disbStatus === "CANCELLED" || s === "REJECTED";
      const isFinalDisbursed = (s === "DISBURSED" || disbStatus === "COMPLETED") && !isCancelled;
      const isSanctioned = (s === "SANCTIONED" || s === "DISBURSEMENT" || isFinalDisbursed) && !isCancelled;

      const disbursed = isFinalDisbursed ? (parseFloat(app.disbursedAmount || 0) || sanctioned || applied) : 0;

      summary.totalAppliedAmount += applied;
      if (isSanctioned) {
        summary.totalSanctionedAmount += (sanctioned || (s === "SANCTIONED" ? applied : 0));
      }
      summary.totalDisbursedAmount += disbursed;

      if (summary.stageCounts[s] !== undefined) {
        summary.stageCounts[s]++;
      } else if (s === "APPROVED") {
        summary.stageCounts.SANCTIONED++;
      } else if (s === "UNDER_REVIEW") {
        summary.stageCounts.SUBMITTED_TO_BANK++;
      }

      if (isFinalDisbursed || s === "CLOSED") {
        summary.disbursedCount++;
      } else if (s === "SANCTIONED" || s === "APPROVED" || s === "DISBURSEMENT") {
        summary.sanctionedCount++;
      } else if (isCancelled) {
        summary.rejectedCount++;
      } else {
        summary.pendingCount++;
      }
    });

    payload.summary = summary;
    return res.json(payload);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Banker / Ops Dashboard KPI Stats
 * @route   GET /api/applications/stats
 */
const getBankerStats = async (req, res, next) => {
  try {
    const where = companyScope(req);
    if (req.user.role === ROLES.BANKER) {
      where.assignedBankerId = req.user.id;
    }

    const leadWhere = {};
    let leadRequired = false;
    const isUnrestrictedAdmin =
      req.user.role === ROLES.SUPERADMIN ||
      req.user.role === ROLES.COMPANY_ADMIN ||
      req.permissions?.viewAllLeads === true;

    if (!isUnrestrictedAdmin) {
      if (req.user.role === ROLES.MANAGER) {
        const subordinates = await User.findAll({
          where: { companyId: req.user.companyId, managerId: req.user.id },
          attributes: ["id"],
          raw: true,
        });
        const teamIds = [req.user.id, ...subordinates.map((u) => u.id)];
        leadWhere[Op.or] = [
          { assignedManagerId: req.user.id },
          { assignedEmployeeId: { [Op.in]: teamIds } },
        ];
        leadRequired = true;
      } else if (req.user.role === ROLES.OPS || req.user.role === ROLES.EMPLOYEE) {
        leadWhere[Op.or] = [
          { assignedEmployeeId: req.user.id },
          { assignedManagerId: req.user.id },
        ];
        leadRequired = true;
      }
    }

    const applications = await Application.findAll({
      where,
      attributes: ["id", "status", "appliedAmount", "sanctionedAmount", "disbursedAmount"],
      include: leadRequired ? [{ model: Lead, as: "lead", where: leadWhere, required: true }] : [],
    });

    const stats = {
      totalAssigned: applications.length,
      underReview: 0,
      docsPending: 0,
      queryRaised: 0,
      sanctioned: 0,
      disbursed: 0,
      rejected: 0,
      other: 0,
      totalAppliedAmount: 0,
      totalSanctionedAmount: 0,
      totalDisbursedAmount: 0,
      openQueriesCount: 0,
    };

    applications.forEach((app) => {
      const s = (app.status || "").toUpperCase();
      const disbStatus = (app.disbursementStatus || "").toUpperCase();
      const applied = parseFloat(app.appliedAmount) || 0;
      const sanctioned = parseFloat(app.sanctionedAmount) || 0;

      const isCancelled = s.includes("CANCEL") || disbStatus === "CANCELLED" || s.includes("REJECT");
      const isFinalDisbursed = (s === "DISBURSED" || disbStatus === "COMPLETED") && !isCancelled;
      const isSanctioned = (s.includes("SANCTION") || s === "DISBURSEMENT" || isFinalDisbursed) && !isCancelled;

      const disbursed = isFinalDisbursed ? (parseFloat(app.disbursedAmount) || (sanctioned || applied)) : 0;

      stats.totalAppliedAmount += applied;
      if (isSanctioned) {
        stats.totalSanctionedAmount += (sanctioned || applied);
      }
      stats.totalDisbursedAmount += disbursed;

      if (s.includes("DOCS_PENDING") || s.includes("DOCUMENT PENDING")) {
        stats.docsPending++;
      } else if (s.includes("QUERY")) {
        stats.queryRaised++;
      } else if (s === "SANCTIONED" || s.includes("SANCTION") || s.includes("APPROVED")) {
        stats.sanctioned++;
      } else if (isFinalDisbursed) {
        stats.disbursed++;
      } else if (isCancelled) {
        stats.rejected++;
      } else if (s.includes("REVIEW") || s.includes("LOGIN") || s.includes("PROCESS") || s.includes("IN_PROGRESS")) {
        stats.underReview++;
      } else {
        stats.other++;
      }
    });

    const queryWhere = { companyId: getCompanyId(req), status: "OPEN" };
    if (req.user.role === ROLES.BANKER) {
      queryWhere.bankerId = req.user.id;
    }
    stats.openQueriesCount = await BankerQuery.count({ where: queryWhere });

    return res.json({ stats });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List all clarification queries across applications
 * @route   GET /api/applications/queries/all
 */
const listAllQueries = async (req, res, next) => {
  try {
    const { status, applicationId, search } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 20;
    const offset = (page - 1) * limit;

    const where = { companyId: getCompanyId(req) };
    if (req.user.role === ROLES.BANKER) {
      where.bankerId = req.user.id;
    }
    if (status && status !== "ALL") {
      where.status = status;
    }
    if (applicationId) {
      where.applicationId = parseInt(applicationId, 10);
    }
    if (search) {
      where.queryText = { [Op.like]: `%${search.trim()}%` };
    }

    const leadWhere = {};
    let leadRequired = false;
    const isUnrestrictedAdmin =
      req.user.role === ROLES.SUPERADMIN ||
      req.user.role === ROLES.COMPANY_ADMIN ||
      req.permissions?.viewAllLeads === true;

    if (!isUnrestrictedAdmin) {
      if (req.user.role === ROLES.MANAGER) {
        const subordinates = await User.findAll({
          where: { companyId: req.user.companyId, managerId: req.user.id },
          attributes: ["id"],
          raw: true,
        });
        const teamIds = [req.user.id, ...subordinates.map((u) => u.id)];
        leadWhere[Op.or] = [
          { assignedManagerId: req.user.id },
          { assignedEmployeeId: { [Op.in]: teamIds } },
        ];
        leadRequired = true;
      } else if (req.user.role === ROLES.OPS || req.user.role === ROLES.EMPLOYEE) {
        leadWhere[Op.or] = [
          { assignedEmployeeId: req.user.id },
          { assignedManagerId: req.user.id },
        ];
        leadRequired = true;
      }
    }

    const { count, rows } = await BankerQuery.findAndCountAll({
      where,
      limit,
      offset,
      order: [["createdAt", "DESC"]],
      include: [
        {
          model: Application,
          as: "application",
          attributes: ["id", "applicationNumber", "loanProduct", "status", "appliedAmount", "sanctionedAmount"],
          required: leadRequired,
          include: [
            { model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city"] },
            ...(leadRequired ? [{ model: Lead, as: "lead", where: leadWhere, required: true }] : []),
          ],
        },
        { model: User, as: "banker", attributes: ["id", "name", "email", "phone"] },
        { model: User, as: "resolvedByOps", attributes: ["id", "name", "email", "phone"] },
      ],
    });

    return res.json({
      queries: rows,
      pagination: {
        page,
        limit,
        totalItems: count,
        totalPages: Math.ceil(count / limit) || 1,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get Application details by ID with comprehensive documents and banker queries
 * @route   GET /api/applications/:id
 */
const getApplicationById = async (req, res, next) => {
  try {
    const application = await Application.findByPk(req.params.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: Lead, as: "lead" },
        { model: Lender, as: "lender" },
        { model: User, as: "assignedBanker", attributes: ["id", "name", "email", "phone", "role"] },
        {
          model: BankerQuery,
          as: "queries",
          include: [
            { model: User, as: "banker", attributes: ["id", "name", "role"] },
            { model: User, as: "resolvedByOps", attributes: ["id", "name", "role"] },
          ],
        },
      ],
      order: [[{ model: BankerQuery, as: "queries" }, "createdAt", "DESC"]],
    });

    if (!application || !belongsToScope(req, application)) {
      return res.status(404).json({ message: "Application not found" });
    }

    const isUnrestrictedAdmin =
      req.user.role === ROLES.SUPERADMIN ||
      req.user.role === ROLES.COMPANY_ADMIN ||
      req.permissions?.viewAllLeads === true;

    // Role check for Banker: only assigned applications allowed
    if (req.user.role === ROLES.BANKER && application.assignedBankerId !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to view this application" });
    }

    // Role check for Employee / Ops: only assigned applications allowed unless unrestricted admin
    if (!isUnrestrictedAdmin && [ROLES.OPS, ROLES.EMPLOYEE].includes(req.user.role)) {
      if (
        application.lead &&
        application.lead.assignedEmployeeId &&
        application.lead.assignedEmployeeId !== req.user.id &&
        application.lead.assignedManagerId !== req.user.id
      ) {
        return res.status(403).json({ message: "You are not authorized to view this application" });
      }
    }

    // Collect all documents linked to Customer, Lead, or Application
    const docConditions = [];
    if (application.id) docConditions.push({ applicationId: application.id });
    if (application.customerId) docConditions.push({ customerId: application.customerId });
    if (application.leadId) docConditions.push({ leadId: application.leadId });

    let allDocs = [];
    if (docConditions.length > 0) {
      allDocs = await Document.findAll({
        where: {
          companyId: getCompanyId(req),
          [Op.or]: docConditions,
        },
        include: [{ model: User, as: "uploader", attributes: ["id", "name", "role"] }],
        order: [["createdAt", "DESC"]],
      });
    }

    const appJson = application.toJSON();
    appJson.documents = allDocs;

    return res.json({ application: appJson });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update Application fields (Amounts, Lender, Banker)
 * @route   PATCH /api/applications/:id
 */
const updateApplication = async (req, res, next) => {
  try {
    const application = await Application.findByPk(req.params.id);
    if (!application || !belongsToScope(req, application)) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (req.user.role === ROLES.BANKER && application.assignedBankerId !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to update this application" });
    }

    const before = application.toJSON();
    const payload = {};
    for (const field of APP_FIELDS) {
      if (req.body[field] !== undefined) {
        payload[field] = req.body[field];
      }
    }

    await application.update(payload);

    const diff = diffFields(before, application.toJSON(), APP_FIELDS);
    if (diff) {
      await logActivity(req, {
        recordType: "Application",
        recordId: application.id,
        action: "UPDATED",
        ...diff,
        remarks: `Updated Application #${application.applicationNumber}`,
      });
    }

    if (payload.lenderId !== undefined && String(payload.lenderId) !== String(before.lenderId)) {
      const oldLender = before.lenderId ? await Lender.findByPk(before.lenderId) : null;
      const newLender = payload.lenderId ? await Lender.findByPk(payload.lenderId) : null;
      await OperationStatusHistory.create({
        companyId: application.companyId,
        applicationId: application.id,
        leadId: application.leadId,
        statusType: "BANK_UPDATE",
        oldStatus: oldLender ? oldLender.name : "Unassigned",
        newStatus: newLender ? newLender.name : "Unassigned",
        remarks: `Bank updated from ${oldLender ? oldLender.name : "Unassigned"} to ${newLender ? newLender.name : "Unassigned"} by ${req.user.name || "Operations"}`,
        updatedBy: req.user.id,
      }).catch((e) => console.error("Error creating OperationStatusHistory:", e.message));
    }

    const updatedApp = await Application.findByPk(application.id, {
      include: [
        { model: Customer, as: "customer" },
        { model: Lead, as: "lead" },
        { model: Lender, as: "lender" },
        { model: User, as: "assignedBanker", attributes: ["id", "name", "email", "phone", "role"] },
      ],
    });

    return res.json({
      message: "Application updated successfully",
      application: updatedApp || application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Transition Application Status (Ops / Banker workflow)
 * @route   PATCH /api/applications/:id/status
 */
const updateStatus = async (req, res, next) => {
  try {
    const { status, rejectionReason, remarks, sanctionedAmount, disbursedAmount } = req.body;
    if (!status) {
      return res.status(400).json({ message: "Status is required" });
    }

    const application = await Application.findByPk(req.params.id);
    if (!application || !belongsToScope(req, application)) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (req.user.role === ROLES.BANKER && application.assignedBankerId !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to update this application" });
    }

    // BUSINESS RULE: OTC check can be reviewed, but PDD (Post-Disbursement) does NOT block Final Disbursement
    if (status === "ALL_PROCESS_COMPLETED" || status === "COMPLETED") {
      application.pddStatus = "RESOLVED";
      application.otcStatus = "RESOLVED";
      application.disbursementStatus = "COMPLETED";
    }

    const beforeStatus = application.status;
    application.status = status === "ALL_PROCESS_COMPLETED" ? "DISBURSED" : status;
    if (status === "REJECTED" && rejectionReason) {
      application.rejectionReason = rejectionReason;
    }
    if (sanctionedAmount !== undefined && sanctionedAmount !== null && sanctionedAmount !== "") {
      application.sanctionedAmount = parseFloat(sanctionedAmount);
    }
    if (status === "CANCELLED" || status === "REJECTED") {
      application.disbursementStatus = "CANCELLED";
      application.disbursedAmount = 0;
    } else if (disbursedAmount !== undefined && disbursedAmount !== null && disbursedAmount !== "") {
      application.disbursedAmount = parseFloat(disbursedAmount);
    } else if (status === "DISBURSED" && (!application.disbursedAmount || application.disbursedAmount === 0)) {
      // Auto-fallback: if marking disbursed without explicit disbursedAmount, use sanctioned or applied amount
      application.disbursedAmount = application.sanctionedAmount || application.appliedAmount || 0;
    }

    if (status === "SANCTIONED" && (!application.sanctionedAmount || application.sanctionedAmount === 0)) {
      application.sanctionedAmount = application.appliedAmount || 0;
      if (!application.pddStatus) application.pddStatus = "PENDING";
      if (!application.otcStatus) application.otcStatus = "PENDING";
    }

    if (remarks) {
      application.lastOpsRemark = remarks;
      application.lastOpsUpdatedAt = new Date();
      application.lastOpsUpdatedBy = req.user?.id || null;
    }

    await application.save();

    // Log to OperationStatusHistory
    await OperationStatusHistory.create({
      companyId: application.companyId,
      applicationId: application.id,
      leadId: application.leadId,
      statusType: "STAGE",
      oldStatus: beforeStatus,
      newStatus: status,
      remark: remarks || rejectionReason || `Status changed from ${beforeStatus} to ${status}`,
      updatedBy: req.user?.id || null,
    }).catch((e) => console.error("Error creating OperationStatusHistory:", e.message));

    await logActivity(req, {
      recordType: "Application",
      recordId: application.id,
      action: status === "DISBURSED" ? "DISBURSED" : "STATUS_CHANGED",
      oldValue: { status: beforeStatus },
      newValue: {
        status: application.status,
        rejectionReason: application.rejectionReason,
        sanctionedAmount: application.sanctionedAmount,
        disbursedAmount: application.disbursedAmount,
      },
      remarks: remarks || `Application status changed from ${beforeStatus} to ${status}`,
    });

    // Sync with linked Lead
    if (application.leadId) {
      const lead = await Lead.findByPk(application.leadId);
      if (lead) {
        let targetLeadStatus = null;
        if (status === "DISBURSED") {
          targetLeadStatus = "DISBURSED";
        } else if (status === "COMPLETED" || status === "ALL_PROCESS_COMPLETED") {
          targetLeadStatus = "COMPLETED";
        } else if (status === "SANCTIONED") {
          targetLeadStatus = "SANCTIONED";
        } else if (status === "REJECTED") {
          targetLeadStatus = "REJECTED";
        }

        if (targetLeadStatus) {
          // Check if company has configured status matching this target
          const leadStatusConfig = await MasterConfig.findOne({
            where: {
              companyId: lead.companyId,
              configType: "LEAD_STATUS",
              [Op.or]: [
                { value: targetLeadStatus },
                { value: { [Op.like]: `%${targetLeadStatus}%` } },
                { label: { [Op.like]: `%${targetLeadStatus}%` } },
              ],
            },
          });

          // Ensure master config exists for DISBURSED / SANCTIONED / COMPLETED so UI tags look great
          if (!leadStatusConfig && (targetLeadStatus === "DISBURSED" || targetLeadStatus === "SANCTIONED" || targetLeadStatus === "COMPLETED")) {
            await MasterConfig.create({
              companyId: lead.companyId,
              configType: "LEAD_STATUS",
              value: targetLeadStatus,
              label: targetLeadStatus === "COMPLETED" ? "Completed" : targetLeadStatus === "DISBURSED" ? "Disbursed" : "Sanctioned",
              colorCode: targetLeadStatus === "COMPLETED" ? "#059669" : targetLeadStatus === "DISBURSED" ? "#047857" : "#10B981",
              orderIndex: targetLeadStatus === "COMPLETED" ? 80 : targetLeadStatus === "DISBURSED" ? 70 : 60,
              team: "operations",
            }).catch(() => {});
          }

          const resolvedValue = leadStatusConfig ? leadStatusConfig.value : targetLeadStatus;
          const oldLeadStatus = lead.status;
          lead.status = resolvedValue;

          if (application.disbursedAmount && parseFloat(application.disbursedAmount) > 0) {
            lead.requiredAmount = application.disbursedAmount;
          }

          await lead.save();

          await logActivity(req, {
            recordType: "Lead",
            recordId: lead.id,
            action: "STATUS_CHANGED",
            oldValue: { status: oldLeadStatus },
            newValue: { status: resolvedValue },
            remarks: `Automatically updated to ${resolvedValue} as Application #${application.applicationNumber} moved to ${status}`,
            companyId: lead.companyId,
          });
        }
      }
    }

    // Sync with case payouts (creates for DISBURSED, purges for CANCELLED/REJECTED or non-disbursed)
    try {
      if (status === "CANCELLED" || status === "REJECTED") {
        const { CasePayout } = require("../models");
        await CasePayout.destroy({
          where: {
            companyId: application.companyId,
            [Op.or]: [
              { applicationId: application.id },
              ...(application.leadId ? [{ leadId: application.leadId }] : []),
            ],
          },
        });
      }
      const { autoSyncDisbursedCases } = require("./casePayoutController");
      await autoSyncDisbursedCases(application.companyId);
    } catch (e) {
      console.error("[applicationController] autoSync error:", e.message);
    }

    return res.json({
      message: `Application status updated to ${status}`,
      application,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Update an Application's stage or sub-status (Legal, Technical, PDD, OTC, Disbursement)
 *          Enforces mandatory remark, PDD/OTC disbursement check, and status history logging
 * @route   PUT /api/applications/:id/stage-status
 */
const updateStageStatus = async (req, res, next) => {
  const t = await sequelize.transaction();
  try {
    const {
      stageType,
      status,
      remark,
      sanctionedAmount,
      disbursedAmount,
      disbursementDate,
      rejectionReason,
    } = req.body;

    if (!stageType) {
      await t.rollback();
      return res.status(400).json({ message: "stageType is required (PD, QUERY, LEGAL, TECHNICAL, SANCTION, DISBURSEMENT, PDD, OTC, DISBURSED, STAGE)" });
    }
    if (!status) {
      await t.rollback();
      return res.status(400).json({ message: "status is required" });
    }

    const application = await Application.findByPk(req.params.id, { transaction: t });
    if (!application || !belongsToScope(req, application)) {
      await t.rollback();
      return res.status(404).json({ message: "Application not found" });
    }

    const statusUpper = String(status).toUpperCase();
    const typeUpper = String(stageType).toUpperCase();
    const trimmedRemark = (remark && typeof remark === "string" && remark.trim())
      ? remark.trim()
      : (statusUpper ? `${typeUpper} status updated to ${statusUpper}` : "Status updated");
    const userId = req.user?.id || null;
    const now = new Date();
    let oldStatus = null;
    let newStatus = statusUpper;

    if (typeUpper === "LOGIN") {
      oldStatus = application.loginStatus || "PENDING";
      application.loginStatus = statusUpper;
      application.loginRemark = trimmedRemark;
      application.loginUpdatedAt = now;
      application.loginUpdatedBy = userId;
      if (statusUpper === "COMPLETED" && (application.status === "SUBMITTED_TO_BANK" || application.status === "DOCS_PENDING" || application.status === "READY_TO_SEND")) {
        application.status = "LOGGED_IN";
      }
    } else if (typeUpper === "PD") {
      oldStatus = application.pdStatus || "PENDING";
      application.pdStatus = statusUpper;
      application.pdRemark = trimmedRemark;
      application.pdUpdatedAt = now;
      application.pdUpdatedBy = userId;
    } else if (typeUpper === "QUERY") {
      oldStatus = application.opsQueryStatus || "NONE";
      application.opsQueryStatus = statusUpper;
      application.opsQueryRemark = trimmedRemark;
      application.opsQueryUpdatedAt = now;
      application.opsQueryUpdatedBy = userId;
    } else if (typeUpper === "LEGAL") {
      oldStatus = application.legalStatus || "NOT_INITIATED";
      application.legalStatus = statusUpper;
      application.legalRemark = trimmedRemark;
      application.legalUpdatedAt = now;
      application.legalUpdatedBy = userId;
    } else if (typeUpper === "TECHNICAL") {
      oldStatus = application.technicalStatus || "NOT_INITIATED";
      application.technicalStatus = statusUpper;
      application.technicalRemark = trimmedRemark;
      application.technicalUpdatedAt = now;
      application.technicalUpdatedBy = userId;
    } else if (typeUpper === "SANCTION" || typeUpper === "SANCTIONED") {
      oldStatus = application.sanctionStatus || "PENDING";
      application.sanctionStatus = statusUpper;
      application.sanctionRemark = trimmedRemark;
      application.sanctionUpdatedAt = now;
      application.sanctionUpdatedBy = userId;
      if (sanctionedAmount) {
        application.sanctionedAmount = parseFloat(sanctionedAmount);
      }
      if (statusUpper === "SANCTIONED") {
        application.status = "SANCTIONED";
        if (!application.sanctionedAmount) application.sanctionedAmount = application.appliedAmount || 0;
        if (!application.pddStatus) application.pddStatus = "PENDING";
        if (!application.otcStatus) application.otcStatus = "PENDING";
      } else if (statusUpper === "REJECTED") {
        application.status = "REJECTED";
        application.rejectionReason = rejectionReason || trimmedRemark;
      }
    } else if (typeUpper === "PDD") {
      oldStatus = application.pddStatus || "PENDING";
      application.pddStatus = statusUpper;
      application.pddRemark = trimmedRemark;
      application.pddUpdatedAt = now;
      application.pddUpdatedBy = userId;
    } else if (typeUpper === "OTC") {
      oldStatus = application.otcStatus || "PENDING";
      application.otcStatus = statusUpper;
      application.otcRemark = trimmedRemark;
      application.otcUpdatedAt = now;
      application.otcUpdatedBy = userId;
    } else if (typeUpper === "DISBURSEMENT") {
      oldStatus = application.disbursementStatus || "PENDING";
      newStatus = statusUpper;
      application.disbursementStatus = statusUpper;
      application.disbursedRemark = trimmedRemark;
      application.disbursedUpdatedAt = now;
      application.disbursedUpdatedBy = userId;
      if (disbursedAmount) {
        application.disbursedAmount = parseFloat(disbursedAmount);
      }
      if (disbursementDate) {
        application.disbursedAt = new Date(disbursementDate);
      }
      if (statusUpper === "DISBURSED" || statusUpper === "COMPLETED") {
        application.status = "DISBURSEMENT";
        if (!application.disbursedAmount) {
          application.disbursedAmount = application.sanctionedAmount || application.appliedAmount || 0;
        }
      }
    } else if (typeUpper === "DISBURSED" || statusUpper === "DISBURSED") {
      if (statusUpper === "CANCEL" || statusUpper === "CANCELLED") {
        oldStatus = application.status;
        newStatus = "CANCELLED";
        application.status = "CANCELLED";
        application.disbursementStatus = "CANCELLED";
        application.disbursedAmount = 0;
        application.disbursedRemark = trimmedRemark;
        application.rejectionReason = rejectionReason || trimmedRemark;

        // Destroy CasePayout immediately
        try {
          const { CasePayout } = require("../models");
          await CasePayout.destroy({
            where: {
              companyId: application.companyId,
              [Op.or]: [
                { applicationId: application.id },
                ...(application.leadId ? [{ leadId: application.leadId }] : []),
              ],
            },
            transaction: t,
          });
        } catch (e) {
          console.error("Error removing CasePayout on cancel in updateStageStatus:", e.message);
        }
      } else if (statusUpper === "PENDING") {
        oldStatus = application.disbursementStatus || "PENDING";
        newStatus = "PENDING";
        application.disbursementStatus = "PENDING";
        application.disbursedRemark = trimmedRemark;
      } else {
        // COMPLETED / DISBURSED / FINAL DISBURSEMENT
        // Business Rule: PDD (Post-Disbursement) does NOT block disbursement.
        oldStatus = application.status;
        newStatus = "DISBURSED";
        application.status = "DISBURSED";
        application.disbursementStatus = "COMPLETED";
        application.disbursedAt = disbursementDate ? new Date(disbursementDate) : now;
        application.disbursedBy = userId;
        application.disbursedRemark = trimmedRemark;
        if (disbursedAmount) {
          application.disbursedAmount = parseFloat(disbursedAmount);
        } else if (!application.disbursedAmount || application.disbursedAmount === 0) {
          application.disbursedAmount = application.sanctionedAmount || application.appliedAmount || 0;
        }
      }
    } else if (typeUpper === "ALL_PROCESS_COMPLETED" || statusUpper === "ALL_PROCESS_COMPLETED" || (typeUpper === "STAGE" && statusUpper === "COMPLETED")) {
      // ALL PROCESS COMPLETED: Mark lead complete, application disbursed/complete, resolve OTC & PDD, and sync payout
      oldStatus = application.status;
      newStatus = "COMPLETED";
      application.status = "DISBURSED";
      application.disbursementStatus = "COMPLETED";
      application.pddStatus = "RESOLVED";
      application.otcStatus = "RESOLVED";
      application.disbursedAt = disbursementDate ? new Date(disbursementDate) : now;
      application.disbursedBy = userId;
      application.disbursedRemark = trimmedRemark || "All process completed successfully";
      if (disbursedAmount) {
        application.disbursedAmount = parseFloat(disbursedAmount);
      } else if (!application.disbursedAmount || application.disbursedAmount === 0) {
        application.disbursedAmount = application.sanctionedAmount || application.appliedAmount || 0;
      }
    } else {
      // General workflow stage change (DOCS_PENDING, READY_TO_SEND, SUBMITTED_TO_BANK, SANCTIONED, REJECTED)
      oldStatus = application.status;
      application.status = statusUpper;
      if (statusUpper === "SANCTIONED") {
        if (sanctionedAmount) application.sanctionedAmount = parseFloat(sanctionedAmount);
        else if (!application.sanctionedAmount) application.sanctionedAmount = application.appliedAmount || 0;
        if (!application.pddStatus) application.pddStatus = "PENDING";
        if (!application.otcStatus) application.otcStatus = "PENDING";
      }
      if (statusUpper === "REJECTED") {
        application.rejectionReason = rejectionReason || trimmedRemark;
      }
    }

    application.lastOpsRemark = trimmedRemark;
    application.lastOpsUpdatedAt = now;
    application.lastOpsUpdatedBy = userId;

    await application.save({ transaction: t });

    // Save to OperationStatusHistory
    const historyRecord = await OperationStatusHistory.create(
      {
        companyId: application.companyId,
        applicationId: application.id,
        leadId: application.leadId,
        statusType: typeUpper,
        oldStatus: oldStatus || "NONE",
        newStatus,
        remark: trimmedRemark,
        updatedBy: userId,
      },
      { transaction: t }
    );

    // Sync Lead status if relevant
    if (application.leadId) {
      const lead = await Lead.findByPk(application.leadId, { transaction: t });
      if (lead) {
        if (newStatus === "DISBURSED" || newStatus === "COMPLETED") {
          await lead.update({
            status: newStatus === "COMPLETED" ? "COMPLETED" : "DISBURSED",
            ...(application.disbursedAmount ? { requiredAmount: application.disbursedAmount } : {}),
          }, { transaction: t });
        } else if (newStatus === "SANCTIONED") await lead.update({ status: "SANCTIONED" }, { transaction: t });
        else if (newStatus === "REJECTED" || newStatus === "CANCELLED") await lead.update({ status: newStatus }, { transaction: t });
      }
    }

    // Log Activity
    await logActivity(
      req,
      {
        recordType: "Application",
        recordId: application.id,
        action: newStatus === "DISBURSED" ? "DISBURSED" : "STATUS_CHANGED",
        oldValue: { [typeUpper]: oldStatus },
        newValue: { [typeUpper]: newStatus },
        remarks: `[${typeUpper}] ${oldStatus || "—"} → ${newStatus} | Remark: ${trimmedRemark}`,
      },
      t
    );

    await t.commit();

    // Sync case payouts (auto-syncs newly disbursed cases, purges cancelled/non-disbursed)
    try {
      const { autoSyncDisbursedCases } = require("./casePayoutController");
      await autoSyncDisbursedCases(application.companyId);
    } catch (e) {
      console.error("[applicationController] autoSync error:", e.message);
    }

    return res.json({
      success: true,
      message: `${typeUpper} status updated to ${newStatus}`,
      application,
      history: historyRecord,
    });
  } catch (error) {
    await t.rollback();
    next(error);
  }
};

/**
 * @desc    Get complete audit timeline & status history for an application
 * @route   GET /api/applications/:id/history
 */
const getApplicationHistory = async (req, res, next) => {
  try {
    const application = await Application.findByPk(req.params.id);
    if (!application || !belongsToScope(req, application)) {
      return res.status(404).json({ message: "Application not found" });
    }

    const history = await OperationStatusHistory.findAll({
      where: {
        applicationId: application.id,
        companyId: getCompanyId(req),
      },
      include: [
        {
          model: User,
          as: "updater",
          attributes: ["id", "name", "email", "role"],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    return res.json({
      success: true,
      applicationId: application.id,
      applicationNumber: application.applicationNumber,
      history,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Create a Banker Clarification Query on an Application
 * @route   POST /api/applications/:id/queries
 */
const createBankerQuery = async (req, res, next) => {
  try {
    const { queryText } = req.body;
    if (!queryText) {
      return res.status(400).json({ message: "Query text (queryText) is required" });
    }

    const application = await Application.findByPk(req.params.id);
    if (!application || !belongsToScope(req, application)) {
      return res.status(404).json({ message: "Application not found" });
    }

    if (req.user.role === ROLES.BANKER && application.assignedBankerId !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to raise queries on this application" });
    }

    const query = await BankerQuery.create({
      companyId: getCompanyId(req),
      applicationId: application.id,
      bankerId: req.user.id,
      queryText: queryText.trim(),
      status: "OPEN",
    });

    // Optionally set application status to QUERY_RAISED
    if (application.status !== "QUERY_RAISED") {
      await application.update({ status: "QUERY_RAISED" });
    }

    await logActivity(req, {
      recordType: "Application",
      recordId: application.id,
      action: "QUERY_RAISED",
      newValue: { queryId: query.id, queryText: query.queryText },
      remarks: `Query raised by ${req.user.name}: ${query.queryText}`,
    });

    return res.status(201).json({
      message: "Banker query raised successfully",
      query,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Resolve a Banker Clarification Query (Ops action)
 * @route   PATCH /api/applications/:id/queries/:queryId/resolve
 */
const resolveBankerQuery = async (req, res, next) => {
  try {
    const { responseText } = req.body;
    if (!responseText) {
      return res.status(400).json({ message: "Response text (responseText) is required" });
    }

    const query = await BankerQuery.findOne({
      where: {
        id: req.params.queryId,
        applicationId: req.params.id,
        companyId: getCompanyId(req),
      },
    });

    if (!query) {
      return res.status(404).json({ message: "Banker query not found" });
    }

    query.responseText = responseText.trim();
    query.status = "RESOLVED";
    query.resolvedByOpsId = req.user.id;
    await query.save();

    await logActivity(req, {
      recordType: "Application",
      recordId: query.applicationId,
      action: "STATUS_CHANGED",
      newValue: { queryId: query.id, status: "RESOLVED", responseText: query.responseText },
      remarks: `Query resolved by ${req.user.name}: ${query.responseText}`,
    });

    return res.json({
      message: "Banker query resolved successfully",
      query,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send Loan Application Docket to Bank RM via Email with Customer Documents
 * @route   POST /api/applications/:id/send-to-bank
 */
const sendApplicationToBank = async (req, res, next) => {
  try {
    const applicationId = req.params.id;
    const {
      toEmail,
      ccEmails,
      subject,
      content,
      documentIds = [],
      lenderId,
      newStatus,
    } = req.body;

    if (!toEmail || !String(toEmail).trim()) {
      return res.status(400).json({ message: "Recipient Bank / RM Email (toEmail) is required" });
    }
    if (!subject || !String(subject).trim()) {
      return res.status(400).json({ message: "Email subject is required" });
    }
    if (!content || !String(content).trim()) {
      return res.status(400).json({ message: "Email content / body is required" });
    }

    const application = await Application.findByPk(applicationId, {
      include: [
        { model: Customer, as: "customer" },
        { model: Lead, as: "lead" },
        { model: Lender, as: "lender" },
      ],
    });

    if (!application || !belongsToScope(req, application)) {
      return res.status(404).json({ message: "Application not found" });
    }

    // Update lender if a different one was selected
    if (lenderId && parseInt(lenderId, 10) !== application.lenderId) {
      await application.update({ lenderId: parseInt(lenderId, 10) });
    }

    // Target company id scoped from application or request
    const targetCompanyId = application.companyId || getCompanyId(req) || 1;

    // Retrieve documents to attach
    let attachedDocs = [];
    if (Array.isArray(documentIds) && documentIds.length > 0) {
      attachedDocs = await Document.findAll({
        where: {
          id: { [Op.in]: documentIds },
          companyId: targetCompanyId,
        },
      });
    }

    const baseUrl = getPublicApiBaseUrl(req);
    const zipDownloadUrl = `${baseUrl}/api/public/documents/application/${application.id}/download-all`;

    const attachments = attachedDocs.map((doc) => ({
      filename: `${doc.docType.replace(/\s+/g, "_")}_${doc.fileName}`,
      fileUrl: doc.fileUrl,
    }));

    // Enriched document items with direct, public download links
    const docItemsHtml = attachedDocs
      .map((doc) => {
        const downloadUrl = `${baseUrl}/api/public/documents/${doc.id}/download`;
        const viewUrl = `${baseUrl}/api/public/documents/${doc.id}/view`;
        return `
          <tr style="border-bottom: 1px solid #e2e8f0;">
            <td style="padding: 10px 14px; font-weight: 600; color: #1e293b; font-size: 13px;">
              ${doc.docType}
            </td>
            <td style="padding: 10px 14px; color: #475569; font-size: 12.5px;">
              ${doc.fileName}
            </td>
            <td style="padding: 10px 14px; text-align: right; white-space: nowrap;">
              <a href="${downloadUrl}" style="display: inline-block; padding: 5px 12px; background: #0284c7; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 600; margin-right: 6px;">📥 Download</a>
              <a href="${viewUrl}" target="_blank" style="display: inline-block; padding: 5px 10px; background: #f1f5f9; color: #334155; text-decoration: none; border: 1px solid #cbd5e1; border-radius: 6px; font-size: 12px; font-weight: 500;">👁 View</a>
            </td>
          </tr>
        `;
      })
      .join("");

    // Send email via emailService
    const mailResult = await sendMail({
      companyId: targetCompanyId,
      to: toEmail,
      cc: ccEmails || undefined,
      subject: subject.trim(),
      text: content.trim(),
      html: `
        <div style="font-family: Arial, -apple-system, sans-serif; line-height: 1.6; color: #1e293b; max-width: 680px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%); color: #ffffff; padding: 24px 28px;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.08em; color: #94a3b8; font-weight: 700; margin-bottom: 4px;">Loan Docket Submission</div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700; color: #ffffff;">${application.loanProduct || "Loan Application"}</h2>
            <p style="margin: 6px 0 0; font-size: 13px; color: #cbd5e1;">Application Ref: <strong>${application.applicationNumber}</strong> • Applied: <strong>₹${Number(application.appliedAmount || 0).toLocaleString("en-IN")}</strong></p>
          </div>
          <div style="padding: 26px 28px;">
            <div style="white-space: pre-wrap; font-size: 14px; color: #334155; line-height: 1.65; margin-bottom: 24px;">${content.trim()}</div>
            ${
              attachedDocs.length > 0
                ? `<div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 18px 20px; margin-top: 24px;">
                    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                      <div style="font-size: 13.5px; font-weight: 700; color: #0f172a;">📎 Attached Applicant Documents (${attachedDocs.length})</div>
                      <a href="${zipDownloadUrl}" style="display: inline-block; padding: 6px 14px; background: #059669; color: #ffffff; text-decoration: none; border-radius: 6px; font-size: 12px; font-weight: 700;">
                        📦 Download All Docs (ZIP)
                      </a>
                    </div>
                    <table style="width: 100%; border-collapse: collapse; background: #ffffff; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
                      <thead>
                        <tr style="background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b;">
                          <th style="padding: 8px 14px;">Doc Type</th>
                          <th style="padding: 8px 14px;">Filename</th>
                          <th style="padding: 8px 14px; text-align: right;">Actions</th>
                        </tr>
                      </thead>
                      <tbody>
                        ${docItemsHtml}
                      </tbody>
                    </table>
                  </div>`
                : ""
            }
            <div style="margin-top: 28px; padding-top: 18px; border-top: 1px solid #f1f5f9; font-size: 11.5px; color: #94a3b8; display: flex; justify-content: space-between;">
              <span>Verified Loan Dispatch from CapitalCare CRM</span>
              <span>Dispatched by ${req.user.name || "Operations Desk"}</span>
            </div>
          </div>
        </div>
      `,
      attachments,
    });

    // Optionally update pipeline status (e.g. to FILE_LOGIN)
    if (newStatus && newStatus !== application.status) {
      await application.update({ status: newStatus });
    }

    await logActivity(req, {
      recordType: "Application",
      recordId: application.id,
      action: "UPDATED",
      newValue: {
        dispatchedToEmail: toEmail,
        subject,
        documentsAttached: attachedDocs.map((d) => d.fileName),
        status: application.status,
      },
      remarks: `Loan application docket dispatched to Bank RM (${toEmail}) with ${attachedDocs.length} documents.`,
    });

    return res.json({
      success: true,
      message: `Loan application docket successfully emailed to ${toEmail}`,
      mailResult,
      documentsCount: attachedDocs.length,
      applicationNumber: application.applicationNumber,
      updatedStatus: application.status,
    });
  } catch (error) {
    console.error("[applicationController] sendApplicationToBank error:", error);
    next(error);
  }
};

module.exports = {
  createApplication,
  listApplications,
  getBankerStats,
  listAllQueries,
  getApplicationById,
  updateApplication,
  updateStatus,
  updateStageStatus,
  getApplicationHistory,
  createBankerQuery,
  resolveBankerQuery,
  sendApplicationToBank,
};
