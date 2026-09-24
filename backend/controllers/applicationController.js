const { Op } = require("sequelize");
const { Application, Lead, Customer, Lender, User, Document, BankerQuery, sequelize } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const APP_FIELDS = [
  "loanProduct",
  "appliedAmount",
  "sanctionedAmount",
  "disbursedAmount",
  "assignedBankerId",
  "lenderId",
  "rejectionReason",
];

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

    const resolvedCustomerId = customerId ? parseInt(customerId, 10) : lead.customerId;
    const applicationNumber = await generateAppNumber(req.companyId);

    const application = await Application.create(
      {
        companyId: req.companyId,
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

/**
 * @desc    List Loan Applications with filters & pagination
 *          Scoped automatically to assigned banker if user role is BANKER
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

    if (status && status !== "ALL") {
      if (status === "COMPLETED_STAGES" || status === "COMPLETED") {
        where.status = { [Op.in]: ["SANCTIONED", "DISBURSED", "APPROVED"] };
      } else if (status === "PENDING_STAGES" || status === "PENDING") {
        where.status = { [Op.in]: ["DOCS_PENDING", "UNDER_VERIFICATION", "SUBMITTED_TO_BANK", "UNDER_REVIEW", "QUERY_RAISED", "LOGGED_IN", "UNDERWRITING"] };
      } else {
        where.status = status;
      }
    }
    if (lenderId && lenderId !== "ALL") where.lenderId = parseInt(lenderId, 10);
    if (customerId) where.customerId = parseInt(customerId, 10);
    if (leadId) where.leadId = parseInt(leadId, 10);

    const leadInclude = {
      model: Lead,
      as: "lead",
      attributes: ["id", "assignedEmployeeId", "assignedManagerId"],
      required: false,
    };
    if (req.query.assignedOnly === "true") {
      leadInclude.where = {
        [Op.or]: [
          { assignedEmployeeId: req.user.id },
          { assignedManagerId: req.user.id },
        ],
      };
      leadInclude.required = true;
    }

    const { count, rows } = await Application.findAndCountAll({
      where,
      limit,
      offset,
      order,
      distinct: true,
      include: [
        leadInclude,
        { model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city", "email", "employmentType", "monthlyIncome", "panNumber", "aadhaarMasked"] },
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

    const payload = paginated({ count, rows, page, limit });
    payload.pagination.totalItems = count;
    payload.applications = payload.data;
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

    const applications = await Application.findAll({
      where,
      attributes: ["id", "status", "appliedAmount", "sanctionedAmount", "disbursedAmount"],
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
      const applied = parseFloat(app.appliedAmount) || 0;
      const sanctioned = parseFloat(app.sanctionedAmount) || 0;
      const disbursed = parseFloat(app.disbursedAmount) || 0;

      stats.totalAppliedAmount += applied;
      stats.totalSanctionedAmount += sanctioned;
      stats.totalDisbursedAmount += disbursed;

      if (s.includes("DOCS_PENDING") || s.includes("DOCUMENT PENDING")) {
        stats.docsPending++;
      } else if (s.includes("QUERY")) {
        stats.queryRaised++;
      } else if (s.includes("SANCTION") || s.includes("APPROVED")) {
        stats.sanctioned++;
      } else if (s.includes("DISBURSE")) {
        stats.disbursed++;
      } else if (s.includes("REJECT")) {
        stats.rejected++;
      } else if (s.includes("REVIEW") || s.includes("LOGIN") || s.includes("PROCESS") || s.includes("IN_PROGRESS")) {
        stats.underReview++;
      } else {
        stats.other++;
      }
    });

    const queryWhere = { companyId: req.companyId, status: "OPEN" };
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

    const where = { companyId: req.companyId };
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
          include: [{ model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city"] }],
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

    // Role check for Banker: only assigned applications allowed
    if (req.user.role === ROLES.BANKER && application.assignedBankerId !== req.user.id) {
      return res.status(403).json({ message: "You are not authorized to view this application" });
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
          companyId: req.companyId,
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

    return res.json({
      message: "Application updated successfully",
      application,
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

    const beforeStatus = application.status;
    application.status = status;
    if (status === "REJECTED" && rejectionReason) {
      application.rejectionReason = rejectionReason;
    }
    if (sanctionedAmount !== undefined && sanctionedAmount !== null && sanctionedAmount !== "") {
      application.sanctionedAmount = parseFloat(sanctionedAmount);
    }
    if (disbursedAmount !== undefined && disbursedAmount !== null && disbursedAmount !== "") {
      application.disbursedAmount = parseFloat(disbursedAmount);
    }
    await application.save();

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

    return res.json({
      message: `Application status updated to ${status}`,
      application,
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
      companyId: req.companyId,
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
        companyId: req.companyId,
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

module.exports = {
  createApplication,
  listApplications,
  getBankerStats,
  listAllQueries,
  getApplicationById,
  updateApplication,
  updateStatus,
  createBankerQuery,
  resolveBankerQuery,
};
