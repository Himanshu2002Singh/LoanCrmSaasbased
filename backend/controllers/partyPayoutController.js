const { Op } = require("sequelize");
const { MasterConfig, Lead, Application, Customer, Lender, User, PartyPayment, sequelize } = require("../models");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { logActivity } = require("../utils/activity");

const COMPLETED_STATUSES = ["DISBURSED", "SANCTIONED", "APPROVED", "COMPLETED", "CLOSED"];

/**
 * Helper to compute date range filter
 */
const dateRangeWhere = (fromDate, toDate, month, financialYear, field = "createdAt") => {
  let from = fromDate;
  let to = toDate;

  if (financialYear && !from && !to) {
    const match = String(financialYear).match(/^(\d{4})/);
    if (match) {
      const startYear = parseInt(match[1], 10);
      from = `${startYear}-04-01`;
      to = `${startYear + 1}-03-31`;
    }
  } else if (month && !from && !to) {
    const parts = String(month).split("-");
    if (parts.length === 2) {
      const y = parseInt(parts[0], 10);
      const m = parseInt(parts[1], 10);
      if (!isNaN(y) && !isNaN(m)) {
        const lastDay = new Date(y, m, 0).getDate();
        from = `${y}-${String(m).padStart(2, "0")}-01`;
        to = `${y}-${String(m).padStart(2, "0")}-${String(lastDay).padStart(2, "0")}`;
      }
    }
  }

  if (!from && !to) return {};
  const range = {};
  if (from) range[Op.gte] = new Date(`${from}T00:00:00`);
  if (to) range[Op.lte] = new Date(`${to}T23:59:59`);
  return { [field]: range };
};

const resolveCompanyId = (req) => {
  return req.companyId || req.user?.companyId || (req.user?.role === "SUPERADMIN" ? (parseInt(req.query?.companyId, 10) || 1) : 1);
};

/**
 * GET /api/party-payouts/summary
 * Returns Summary Sheet matching "Party Summary — what each connector is owed vs. already paid, per Party Code"
 */
exports.getPartyPayoutSummary = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { fromDate, toDate, month, financialYear, search } = req.query;

    // 1. Fetch all Lead Sources / Parties for company
    const sourceRows = await MasterConfig.findAll({
      where: {
        companyId,
        configType: "LEAD_SOURCE",
      },
      order: [["orderIndex", "ASC"], ["id", "ASC"]],
    });

    // 2. Fetch all leads with applications to calculate case-linked due per party
    const leadDateFilter = dateRangeWhere(fromDate, toDate, month, financialYear, "createdAt");
    const leadWhere = {
      companyId,
      ...leadDateFilter,
    };

    const allLeads = await Lead.findAll({
      where: leadWhere,
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city"] },
        {
          model: Application,
          as: "applications",
          include: [{ model: Lender, as: "lender", attributes: ["id", "name", "shortCode"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 3. Fetch all PartyPayment records for company
    const paymentDateFilter = dateRangeWhere(fromDate, toDate, month, financialYear, "paymentDate");
    const paymentWhere = {
      companyId,
      ...paymentDateFilter,
    };

    const allPayments = await PartyPayment.findAll({
      where: paymentWhere,
      order: [["paymentDate", "DESC"]],
    });

    // Gather all known party names from MasterConfig
    const existingNames = new Set(sourceRows.map((s) => (s.label || s.value || "").toLowerCase()));

    // Also collect any parties present in leads or payments
    const extraSources = [];
    allLeads.forEach((l) => {
      const src = (l.leadSource || "").trim();
      if (src && !existingNames.has(src.toLowerCase())) {
        existingNames.add(src.toLowerCase());
        extraSources.push({
          id: `lead-source-${src}`,
          label: src,
          value: src,
          code: null,
          colorCode: "#3b82f6",
          commissionPercent: l.commissionPercent || 1.0,
          isActive: true,
        });
      }
    });

    allPayments.forEach((p) => {
      const src = (p.partyName || "").trim();
      if (src && !existingNames.has(src.toLowerCase())) {
        existingNames.add(src.toLowerCase());
        extraSources.push({
          id: `payment-source-${src}`,
          label: src,
          value: src,
          code: p.partyCode || null,
          colorCode: "#8b5cf6",
          commissionPercent: 1.0,
          isActive: true,
        });
      }
    });

    const fullSourceList = [...sourceRows, ...extraSources];

    // 4. Aggregate data per source/party
    let connectorIndex = 0;
    const summaryList = fullSourceList.map((source) => {
      const partyName = source.label || source.value;
      const isDirect = partyName.toLowerCase() === "self" || partyName.toLowerCase() === "direct";
      let partyCode = source.code;
      if (!partyCode) {
        if (isDirect) {
          partyCode = "—";
        } else {
          connectorIndex += 1;
          partyCode = `PTY-${String(connectorIndex).padStart(3, "0")}`;
        }
      }
      const defaultComm = source.commissionPercent ? parseFloat(source.commissionPercent) : 0;

      // Filter leads belonging to this party
      const partyLeads = allLeads.filter(
        (l) => (l.leadSource && l.leadSource.toLowerCase() === partyName.toLowerCase()) ||
               (l.leadSource && l.leadSource.toLowerCase() === source.value.toLowerCase())
      );

      // Disbursed cases: leads or apps in completed statuses
      const disbursedCasesList = partyLeads.filter((l) => {
        const leadStatusUpper = (l.status || "").toUpperCase();
        const hasCompletedApp = (l.applications || []).some((a) =>
          COMPLETED_STATUSES.includes((a.status || "").toUpperCase()) || parseFloat(a.sanctionedAmount || 0) > 0
        );
        return COMPLETED_STATUSES.includes(leadStatusUpper) || hasCompletedApp;
      });

      // Calculate Case-linked Due (₹)
      let caseLinkedDue = 0;
      disbursedCasesList.forEach((lead) => {
        const apps = lead.applications || [];
        const primaryApp = apps.find((a) => parseFloat(a.sanctionedAmount || 0) > 0) || apps[0];
        const baseAmount = primaryApp?.sanctionedAmount
          ? parseFloat(primaryApp.sanctionedAmount)
          : primaryApp?.appliedAmount
          ? parseFloat(primaryApp.appliedAmount)
          : lead.requiredAmount
          ? parseFloat(lead.requiredAmount)
          : 0;

        const commPct = lead.commissionPercent !== null && lead.commissionPercent !== undefined
          ? parseFloat(lead.commissionPercent)
          : defaultComm;

        const caseComm = Math.round((baseAmount * commPct) / 100);
        caseLinkedDue += caseComm;
      });

      // Filter payments belonging to this party
      const partyPayments = allPayments.filter(
        (p) => (p.partyName && p.partyName.toLowerCase() === partyName.toLowerCase()) ||
               (p.partyCode && p.partyCode === partyCode)
      );

      let linkedPayments = 0;
      let unallocatedAdvances = 0;
      let refundsCredits = 0;

      partyPayments.forEach((p) => {
        const amt = parseFloat(p.amount) || 0;
        if (p.paymentType === "ADVANCE") {
          unallocatedAdvances += amt;
        } else if (p.paymentType === "REFUND_CREDIT") {
          refundsCredits += amt;
        } else {
          linkedPayments += amt;
        }
      });

      const netCashTransferred = linkedPayments + unallocatedAdvances - refundsCredits;
      const payableAfterTransfers = Math.max(0, caseLinkedDue - netCashTransferred);
      const advanceBalance = Math.max(0, netCashTransferred - caseLinkedDue);

      let status = "NO_CASES";
      if (disbursedCasesList.length > 0 || netCashTransferred > 0) {
        if (payableAfterTransfers === 0 && caseLinkedDue > 0) {
          status = "SETTLED";
        } else if (payableAfterTransfers > 0) {
          status = "PENDING";
        } else if (advanceBalance > 0) {
          status = "ADVANCE_PAID";
        }
      }

      return {
        id: source.id,
        partyName,
        partyCode,
        colorCode: source.colorCode || "#3b82f6",
        defaultCommissionPercent: defaultComm,
        totalCases: partyLeads.length,
        disbursedCases: disbursedCasesList.length,
        caseLinkedDue: Math.round(caseLinkedDue),
        linkedPayments: Math.round(linkedPayments),
        unallocatedAdvances: Math.round(unallocatedAdvances),
        refundsCredits: Math.round(refundsCredits),
        netCashTransferred: Math.round(netCashTransferred),
        payableAfterTransfers: Math.round(payableAfterTransfers),
        advanceBalance: Math.round(advanceBalance),
        status,
        isActive: source.isActive,
      };
    });

    // Filter by search if provided
    let filteredList = summaryList;
    if (search && search.trim()) {
      const q = search.trim().toLowerCase();
      filteredList = summaryList.filter(
        (s) => s.partyName.toLowerCase().includes(q) || s.partyCode.toLowerCase().includes(q)
      );
    }

    // Grand Totals across all connectors
    const grandTotals = filteredList.reduce(
      (acc, row) => ({
        totalConnectors: acc.totalConnectors + 1,
        disbursedCases: acc.disbursedCases + row.disbursedCases,
        caseLinkedDue: acc.caseLinkedDue + row.caseLinkedDue,
        linkedPayments: acc.linkedPayments + row.linkedPayments,
        unallocatedAdvances: acc.unallocatedAdvances + row.unallocatedAdvances,
        refundsCredits: acc.refundsCredits + row.refundsCredits,
        netCashTransferred: acc.netCashTransferred + row.netCashTransferred,
        payableAfterTransfers: acc.payableAfterTransfers + row.payableAfterTransfers,
        advanceBalance: acc.advanceBalance + row.advanceBalance,
      }),
      {
        totalConnectors: 0,
        disbursedCases: 0,
        caseLinkedDue: 0,
        linkedPayments: 0,
        unallocatedAdvances: 0,
        refundsCredits: 0,
        netCashTransferred: 0,
        payableAfterTransfers: 0,
        advanceBalance: 0,
      }
    );

    return res.status(200).json({
      summary: filteredList,
      grandTotals,
      period: { fromDate, toDate, month, financialYear },
    });
  } catch (error) {
    console.error("[partyPayouts] getPartyPayoutSummary error:", error);
    return res.status(500).json({ message: "Failed to generate party payout summary", error: error.message });
  }
};

/**
 * GET /api/party-payouts/:partyName/ledger
 * Returns full breakdown of Disbursed Cases & Payment Ledger History for a specific party
 */
exports.getPartyLedgerDetail = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const rawPartyName = decodeURIComponent(req.params.partyName || "").trim();

    if (!rawPartyName) {
      return res.status(400).json({ message: "Party name is required" });
    }

    // 1. Fetch Source MasterConfig
    const sourceConfig = await MasterConfig.findOne({
      where: {
        companyId,
        configType: "LEAD_SOURCE",
        [Op.or]: [
          { label: rawPartyName },
          { value: rawPartyName },
          { code: rawPartyName },
        ],
      },
    });

    const partyName = sourceConfig?.label || rawPartyName;
    const partyCode = sourceConfig?.code || (sourceConfig?.value === "SELF" ? "—" : "PTY-001");
    const defaultComm = sourceConfig?.commissionPercent ? parseFloat(sourceConfig.commissionPercent) : 0;

    // 2. Fetch all leads for this party
    const leads = await Lead.findAll({
      where: {
        companyId,
        [Op.or]: [
          { leadSource: partyName },
          { leadSource: rawPartyName },
          ...(sourceConfig?.value ? [{ leadSource: sourceConfig.value }] : []),
        ],
      },
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city", "email"] },
        { model: User, as: "assignedEmployee", attributes: ["id", "name"] },
        {
          model: Application,
          as: "applications",
          include: [{ model: Lender, as: "lender", attributes: ["id", "name", "shortCode", "lenderType"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Process case details with calculated commissions
    const cases = leads.map((lead) => {
      const customer = lead.customer || {};
      const apps = lead.applications || [];
      const primaryApp = apps.find((a) => parseFloat(a.sanctionedAmount || 0) > 0) || apps[0];
      const sanctionedAmount = primaryApp?.sanctionedAmount ? parseFloat(primaryApp.sanctionedAmount) : null;
      const appliedAmount = primaryApp?.appliedAmount
        ? parseFloat(primaryApp.appliedAmount)
        : lead.requiredAmount
        ? parseFloat(lead.requiredAmount)
        : null;

      const baseAmount = sanctionedAmount || appliedAmount || 0;
      const commPct = lead.commissionPercent !== null && lead.commissionPercent !== undefined
        ? parseFloat(lead.commissionPercent)
        : defaultComm;

      const commissionDue = Math.round((baseAmount * commPct) / 100);
      const isDisbursed =
        COMPLETED_STATUSES.includes((lead.status || "").toUpperCase()) ||
        COMPLETED_STATUSES.includes((primaryApp?.status || "").toUpperCase()) ||
        Boolean(sanctionedAmount);

      return {
        leadId: lead.id,
        applicationId: primaryApp?.id || null,
        applicationNumber: primaryApp?.applicationNumber || null,
        customerName: customer.name || "Customer",
        customerMobile: customer.mobile || "—",
        customerCity: customer.city || "—",
        loanProduct: lead.loanType || primaryApp?.loanProduct || "Personal Loan",
        bankName: primaryApp?.lender?.name || null,
        bankCode: primaryApp?.lender?.shortCode || null,
        sanctionedAmount,
        appliedAmount,
        baseAmount,
        commissionPercent: commPct,
        commissionDue,
        isDisbursed,
        status: primaryApp?.status || lead.status,
        date: lead.createdAt,
        owner: lead.assignedEmployee?.name || "Unassigned",
      };
    });

    // 3. Fetch all payments for this party
    const payments = await PartyPayment.findAll({
      where: {
        companyId,
        [Op.or]: [
          { partyName: partyName },
          { partyName: rawPartyName },
          ...(partyCode && partyCode !== "—" ? [{ partyCode }] : []),
        ],
      },
      include: [
        { model: User, as: "recordedBy", attributes: ["id", "name", "email"] },
        { model: Lead, as: "lead", attributes: ["id", "loanType"] },
      ],
      order: [["paymentDate", "DESC"], ["createdAt", "DESC"]],
    });

    // Compute live balances
    const disbursedCasesList = cases.filter((c) => c.isDisbursed);
    const caseLinkedDue = disbursedCasesList.reduce((acc, c) => acc + c.commissionDue, 0);

    let linkedPayments = 0;
    let unallocatedAdvances = 0;
    let refundsCredits = 0;

    payments.forEach((p) => {
      const amt = parseFloat(p.amount) || 0;
      if (p.paymentType === "ADVANCE") {
        unallocatedAdvances += amt;
      } else if (p.paymentType === "REFUND_CREDIT") {
        refundsCredits += amt;
      } else {
        linkedPayments += amt;
      }
    });

    const netCashTransferred = linkedPayments + unallocatedAdvances - refundsCredits;
    const payableAfterTransfers = Math.max(0, caseLinkedDue - netCashTransferred);
    const advanceBalance = Math.max(0, netCashTransferred - caseLinkedDue);

    return res.status(200).json({
      party: {
        id: sourceConfig?.id || null,
        partyName,
        partyCode,
        colorCode: sourceConfig?.colorCode || "#3b82f6",
        defaultCommissionPercent: defaultComm,
      },
      balances: {
        totalCasesCount: cases.length,
        disbursedCasesCount: disbursedCasesList.length,
        caseLinkedDue: Math.round(caseLinkedDue),
        linkedPayments: Math.round(linkedPayments),
        unallocatedAdvances: Math.round(unallocatedAdvances),
        refundsCredits: Math.round(refundsCredits),
        netCashTransferred: Math.round(netCashTransferred),
        payableAfterTransfers: Math.round(payableAfterTransfers),
        advanceBalance: Math.round(advanceBalance),
      },
      cases,
      payments,
    });
  } catch (error) {
    console.error("[partyPayouts] getPartyLedgerDetail error:", error);
    return res.status(500).json({ message: "Failed to fetch party ledger detail", error: error.message });
  }
};

/**
 * POST /api/party-payouts/payments
 * Record a payment / advance / settlement transaction to a party
 */
exports.recordPartyPayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const {
      partyName,
      partyCode,
      leadId,
      paymentType = "LINKED_PAYMENT",
      amount,
      paymentDate,
      paymentMode = "BANK_TRANSFER",
      referenceNumber,
      notes,
    } = req.body;

    if (!partyName || !amount || parseFloat(amount) <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Party Name and positive Amount are required" });
    }

    if (!paymentDate) {
      await t.rollback();
      return res.status(400).json({ message: "Payment Date is required" });
    }

    const resolvedDate = paymentDate ? new Date(paymentDate) : new Date();

    const payment = await PartyPayment.create(
      {
        companyId,
        partyName: partyName.trim(),
        partyCode: partyCode ? partyCode.trim() : null,
        leadId: leadId ? parseInt(leadId, 10) : null,
        paymentType: ["LINKED_PAYMENT", "ADVANCE", "REFUND_CREDIT"].includes(paymentType)
          ? paymentType
          : "LINKED_PAYMENT",
        amount: parseFloat(amount),
        paymentDate: resolvedDate,
        paymentMode: paymentMode.trim(),
        referenceNumber: referenceNumber ? referenceNumber.trim() : null,
        notes: notes ? notes.trim() : null,
        recordedById: req.user.id,
      },
      { transaction: t }
    );

    await logActivity(
      req,
      {
        recordType: "PartyPayment",
        recordId: payment.id,
        action: "CREATED",
        newValue: payment.toJSON(),
        remarks: `Recorded ${paymentType} of ₹${parseFloat(amount).toLocaleString("en-IN")} to ${partyName}`,
      },
      t
    );

    await t.commit();
    return res.status(201).json({
      message: "Payment entry recorded successfully",
      payment,
    });
  } catch (error) {
    await t.rollback();
    console.error("[partyPayouts] recordPartyPayment error:", error);
    return res.status(500).json({ message: "Failed to record payment", error: error.message });
  }
};

/**
 * DELETE /api/party-payouts/payments/:id
 * Delete or reverse a payment entry
 */
exports.deletePartyPayment = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const payment = await PartyPayment.findOne({
      where: { id: req.params.id, companyId },
      transaction: t,
    });

    if (!payment) {
      await t.rollback();
      return res.status(404).json({ message: "Payment entry not found" });
    }

    const previousValue = payment.toJSON();
    await payment.destroy({ transaction: t });

    await logActivity(
      req,
      {
        recordType: "PartyPayment",
        recordId: req.params.id,
        action: "DELETED",
        previousValue,
        remarks: `Deleted payment of ₹${previousValue.amount} for party ${previousValue.partyName}`,
      },
      t
    );

    await t.commit();
    return res.status(200).json({ message: "Payment entry deleted successfully" });
  } catch (error) {
    await t.rollback();
    console.error("[partyPayouts] deletePartyPayment error:", error);
    return res.status(500).json({ message: "Failed to delete payment entry", error: error.message });
  }
};

/**
 * GET /api/party-payouts/leads/search
 * Searches company leads to link to a party or select for payment
 */
exports.searchCompanyLeads = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const q = (req.query.q || "").trim();
    const partyName = (req.query.partyName || "").trim();

    const whereClause = { companyId };
    if (partyName) {
      whereClause.leadSource = partyName;
    }

    const customerWhere = q
      ? {
          [Op.or]: [
            { name: { [Op.like]: `%${q}%` } },
            { mobile: { [Op.like]: `%${q}%` } },
          ],
        }
      : undefined;

    const leadWhere = { ...whereClause };
    if (q && !isNaN(q)) {
      leadWhere[Op.or] = [{ id: parseInt(q, 10) }];
    }

    const leads = await Lead.findAll({
      where: leadWhere,
      include: [
        {
          model: Customer,
          as: "customer",
          where: customerWhere,
          required: Boolean(customerWhere && isNaN(q)),
          attributes: ["id", "name", "mobile", "city"],
        },
        {
          model: Application,
          as: "applications",
          include: [{ model: Lender, as: "lender", attributes: ["id", "name", "shortCode"] }],
        },
      ],
      limit: 50,
      order: [["createdAt", "DESC"]],
    });

    const results = leads.map((lead) => {
      const customer = lead.customer || {};
      const apps = lead.applications || [];
      const primaryApp = apps.find((a) => parseFloat(a.sanctionedAmount || 0) > 0) || apps[0];
      const sanctionedAmount = primaryApp?.sanctionedAmount ? parseFloat(primaryApp.sanctionedAmount) : null;
      const appliedAmount = primaryApp?.appliedAmount
        ? parseFloat(primaryApp.appliedAmount)
        : lead.requiredAmount
        ? parseFloat(lead.requiredAmount)
        : null;

      const baseAmount = sanctionedAmount || appliedAmount || 0;
      const commPct = parseFloat(lead.commissionPercent || 0);
      const commissionDue = Math.round((baseAmount * commPct) / 100);

      const isDisbursed =
        COMPLETED_STATUSES.includes((lead.status || "").toUpperCase()) ||
        COMPLETED_STATUSES.includes((primaryApp?.status || "").toUpperCase()) ||
        Boolean(sanctionedAmount);

      return {
        leadId: lead.id,
        applicationId: primaryApp?.id || null,
        applicationNumber: primaryApp?.applicationNumber || null,
        customerName: customer.name || "Customer",
        customerMobile: customer.mobile || "—",
        customerCity: customer.city || "—",
        loanProduct: lead.loanType || primaryApp?.loanProduct || "Personal Loan",
        bankName: primaryApp?.lender?.name || null,
        bankCode: primaryApp?.lender?.shortCode || null,
        leadSource: lead.leadSource || "Self",
        commissionPercent: commPct,
        sanctionedAmount,
        appliedAmount,
        baseAmount,
        commissionDue,
        isDisbursed,
        status: primaryApp?.status || lead.status,
        date: lead.createdAt,
      };
    });

    return res.status(200).json({ leads: results });
  } catch (error) {
    console.error("[partyPayouts] searchCompanyLeads error:", error);
    return res.status(500).json({ message: "Failed to search leads", error: error.message });
  }
};

/**
 * POST /api/party-payouts/:partyName/link-lead
 * Sets/Links a lead to a party connector (updates lead.leadSource and optionally commissionPercent)
 */
exports.linkLeadToParty = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const rawPartyName = decodeURIComponent(req.params.partyName || "").trim();
    const { leadId, commissionPercent } = req.body;

    if (!leadId) {
      await t.rollback();
      return res.status(400).json({ message: "Lead ID is required" });
    }

    // Verify party exists
    const sourceConfig = await MasterConfig.findOne({
      where: {
        companyId,
        configType: "LEAD_SOURCE",
        [Op.or]: [
          { label: rawPartyName },
          { value: rawPartyName },
          { code: rawPartyName },
        ],
      },
      transaction: t,
    });

    const partyName = sourceConfig?.label || rawPartyName;
    const defaultComm = sourceConfig?.commissionPercent ? parseFloat(sourceConfig.commissionPercent) : 0;

    const lead = await Lead.findOne({
      where: { id: leadId, companyId },
      include: [{ model: Customer, as: "customer", attributes: ["name", "mobile"] }],
      transaction: t,
    });

    if (!lead) {
      await t.rollback();
      return res.status(404).json({ message: "Lead not found in this company" });
    }

    const previousSource = lead.leadSource;
    const previousComm = lead.commissionPercent;

    const commToSet =
      commissionPercent !== undefined && commissionPercent !== null && commissionPercent !== ""
        ? parseFloat(commissionPercent)
        : defaultComm;

    await lead.update(
      {
        leadSource: partyName,
        commissionPercent: commToSet,
      },
      { transaction: t }
    );

    await logActivity(
      req,
      {
        recordType: "Lead",
        recordId: lead.id,
        action: "UPDATED",
        previousValue: { leadSource: previousSource, commissionPercent: previousComm },
        newValue: { leadSource: partyName, commissionPercent: commToSet },
        remarks: `Lead #${lead.id} (${lead.customer?.name}) assigned to Connector/Party ${partyName} with ${commToSet}% commission`,
      },
      t
    );

    await t.commit();
    return res.status(200).json({
      message: `Lead #${leadId} (${lead.customer?.name || "Customer"}) successfully assigned to ${partyName}`,
      lead: {
        id: lead.id,
        leadSource: lead.leadSource,
        commissionPercent: lead.commissionPercent,
      },
    });
  } catch (error) {
    await t.rollback();
    console.error("[partyPayouts] linkLeadToParty error:", error);
    return res.status(500).json({ message: "Failed to link lead to party", error: error.message });
  }
};

