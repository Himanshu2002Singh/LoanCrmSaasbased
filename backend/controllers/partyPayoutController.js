const { Op } = require("sequelize");
const { MasterConfig, Lead, Application, Customer, Lender, User, PartyPayment, CasePayout, sequelize } = require("../models");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { logActivity } = require("../utils/activity");
const { autoSyncDisbursedCases } = require("./casePayoutController");

const COMPLETED_STATUSES = ["DISBURSED", "CLOSED"];

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
 * Guaranteed to match Case Payouts (/payouts) using CasePayout model as single source of truth.
 */
exports.getPartyPayoutSummary = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { fromDate, toDate, month, financialYear, search } = req.query;

    // 0. Auto-sync latest disbursed leads into CasePayout so everything is 100% current
    await autoSyncDisbursedCases(companyId);

    // 1. Fetch all Lead Sources / Parties for company
    const sourceRows = await MasterConfig.findAll({
      where: {
        companyId,
        configType: "LEAD_SOURCE",
      },
      order: [["orderIndex", "ASC"], ["id", "ASC"]],
    });

    // 2. Fetch all CasePayout records for company (single source of truth for disbursed amounts)
    const casePayoutDateFilter = dateRangeWhere(fromDate, toDate, month, financialYear, "disbursalDate");
    const casePayoutWhere = {
      companyId,
      ...casePayoutDateFilter,
    };

    const allCasePayouts = await CasePayout.findAll({
      where: casePayoutWhere,
      include: [
        {
          model: Lead,
          as: "lead",
          attributes: ["id", "leadSource", "loanType", "commissionPercent"],
        },
      ],
      order: [["disbursalDate", "DESC"], ["id", "DESC"]],
    });

    // 3. Fetch all leads for pipeline / total case counts
    const leadDateFilter = dateRangeWhere(fromDate, toDate, month, financialYear, "createdAt");
    const leadWhere = {
      companyId,
      ...leadDateFilter,
    };

    const allLeads = await Lead.findAll({
      where: leadWhere,
      attributes: ["id", "leadSource", "status", "createdAt"],
      order: [["createdAt", "DESC"]],
    });

    // 4. Fetch all PartyPayment records for company
    const paymentDateFilter = dateRangeWhere(fromDate, toDate, month, financialYear, "paymentDate");
    const paymentWhere = {
      companyId,
      ...paymentDateFilter,
    };

    const allPayments = await PartyPayment.findAll({
      where: paymentWhere,
      order: [["paymentDate", "DESC"]],
    });

    // Gather canonical party configs and deduplicate aliases
    const canonicalMap = new Map();
    const aliasesMap = new Map();

    sourceRows.forEach((s) => {
      const label = (s.label || "").trim();
      const val = (s.value || "").trim();
      const isDirect =
        label.toLowerCase() === "self" ||
        val.toLowerCase() === "self" ||
        label.toLowerCase() === "direct" ||
        val.toLowerCase() === "direct";
      if (isDirect) return;

      const key = (label || val).toLowerCase();
      let canon = aliasesMap.get(label.toLowerCase()) || aliasesMap.get(val.toLowerCase());
      if (!canon) {
        canon = {
          id: s.id,
          partyName: label || val,
          primaryName: val || label,
          partyCode: s.code || null,
          colorCode: s.colorCode || "#3b82f6",
          commissionPercent: s.commissionPercent ? parseFloat(s.commissionPercent) : 50.0,
          aliases: new Set([label.toLowerCase(), val.toLowerCase()].filter(Boolean)),
          isActive: s.isActive !== false,
        };
        canonicalMap.set(key, canon);
      } else {
        if (label) canon.aliases.add(label.toLowerCase());
        if (val) canon.aliases.add(val.toLowerCase());
        if (s.code && !canon.partyCode) canon.partyCode = s.code;
        if (s.commissionPercent && (!canon.commissionPercent || canon.commissionPercent === 50)) {
          canon.commissionPercent = parseFloat(s.commissionPercent);
        }
      }
      if (label) aliasesMap.set(label.toLowerCase(), canon);
      if (val) aliasesMap.set(val.toLowerCase(), canon);
    });

    // Also collect any parties present in case_payouts, leads, or payments
    allCasePayouts.forEach((cp) => {
      const src = (cp.partyName || cp.lead?.leadSource || "").trim();
      if (src && !["self", "direct"].includes(src.toLowerCase()) && !aliasesMap.has(src.toLowerCase())) {
        const canon = {
          id: `payout-${src}`,
          partyName: src,
          primaryName: src,
          partyCode: cp.partyCode && cp.partyCode !== "PTY-001" ? cp.partyCode : null,
          colorCode: "#8b5cf6",
          commissionPercent: cp.partyCommissionPercent ? parseFloat(cp.partyCommissionPercent) : 50.0,
          aliases: new Set([src.toLowerCase()]),
          isActive: true,
        };
        canonicalMap.set(src.toLowerCase(), canon);
        aliasesMap.set(src.toLowerCase(), canon);
      }
    });

    allLeads.forEach((l) => {
      const src = (l.leadSource || "").trim();
      if (src && !["self", "direct"].includes(src.toLowerCase()) && !aliasesMap.has(src.toLowerCase())) {
        const canon = {
          id: `lead-source-${src}`,
          partyName: src,
          primaryName: src,
          partyCode: null,
          colorCode: "#3b82f6",
          commissionPercent: l.commissionPercent ? parseFloat(l.commissionPercent) : 50.0,
          aliases: new Set([src.toLowerCase()]),
          isActive: true,
        };
        canonicalMap.set(src.toLowerCase(), canon);
        aliasesMap.set(src.toLowerCase(), canon);
      }
    });

    allPayments.forEach((p) => {
      const src = (p.partyName || "").trim();
      if (src && !["self", "direct"].includes(src.toLowerCase()) && !aliasesMap.has(src.toLowerCase())) {
        const canon = {
          id: `payment-source-${src}`,
          partyName: src,
          primaryName: src,
          partyCode: p.partyCode || null,
          colorCode: "#8b5cf6",
          commissionPercent: 50.0,
          aliases: new Set([src.toLowerCase()]),
          isActive: true,
        };
        canonicalMap.set(src.toLowerCase(), canon);
        aliasesMap.set(src.toLowerCase(), canon);
      }
    });

    // Assign sequential party codes if missing
    let connectorIndex = 0;
    const fullSourceList = Array.from(canonicalMap.values());
    fullSourceList.forEach((source) => {
      if (!source.partyCode) {
        connectorIndex += 1;
        source.partyCode = `PTY-${String(connectorIndex).padStart(3, "0")}`;
      }
    });

    // 5. Aggregate data per source/party
    const summaryList = fullSourceList.map((source) => {
      const partyName = source.partyName;
      const partyCode = source.partyCode;
      const defaultComm = source.commissionPercent || 0;

      // Filter all leads belonging to this party
      const partyLeads = allLeads.filter((l) => {
        const src = (l.leadSource || "").trim().toLowerCase();
        return source.aliases.has(src);
      });

      // Match CasePayout records belonging to this party (single source of truth matching Disbursed Payouts)
      const partyCasePayouts = allCasePayouts.filter((cp) => {
        if (cp.payoutType === "SELF") return false;
        const cpParty = (cp.partyName || "").trim().toLowerCase();
        const leadParty = (cp.lead?.leadSource || "").trim().toLowerCase();
        return source.aliases.has(cpParty) || source.aliases.has(leadParty);
      });

      // Calculate Case-linked Due (₹) directly from CasePayout
      // Exactly matches the Net Payable (or Commission Due) shown in Disbursed Payouts (/payouts)
      let caseLinkedDue = 0;
      let totalDisbursedLoanVolume = 0;
      let totalBankBaseAmount = 0;

      partyCasePayouts.forEach((cp) => {
        const amtDue = parseFloat(
          cp.partyNetPayable !== undefined && cp.partyNetPayable !== null ? cp.partyNetPayable : cp.partyCommissionDue || 0
        );
        caseLinkedDue += amtDue;
        totalDisbursedLoanVolume += parseFloat(cp.loanAmount || 0);
        totalBankBaseAmount += parseFloat(cp.baseAmount || 0);
      });

      // Filter payments belonging to this party
      const partyPayments = allPayments.filter((p) => {
        const pParty = (p.partyName || "").trim().toLowerCase();
        return source.aliases.has(pParty);
      });

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
      const payableAfterTransfers = Math.max(0, Math.round(caseLinkedDue) - Math.round(netCashTransferred));
      const advanceBalance = Math.max(0, Math.round(netCashTransferred) - Math.round(caseLinkedDue));

      let status = "NO_CASES";
      if (partyCasePayouts.length > 0 || netCashTransferred > 0) {
        if (payableAfterTransfers === 0 && (caseLinkedDue > 0 || netCashTransferred > 0)) {
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
        totalCases: Math.max(partyLeads.length, partyCasePayouts.length),
        disbursedCases: partyCasePayouts.length,
        totalDisbursedLoanVolume: Math.round(totalDisbursedLoanVolume),
        totalBankBaseAmount: Math.round(totalBankBaseAmount),
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

    // 0. Auto-sync latest disbursed leads into CasePayout so data is up to date
    await autoSyncDisbursedCases(companyId);

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
    const defaultComm = sourceConfig?.commissionPercent ? parseFloat(sourceConfig.commissionPercent) : 50.0;

    // Build aliases set for this party
    const sourceAliases = new Set([partyName.toLowerCase(), rawPartyName.toLowerCase()]);
    if (sourceConfig?.value) sourceAliases.add(sourceConfig.value.toLowerCase());
    if (sourceConfig?.label) sourceAliases.add(sourceConfig.label.toLowerCase());

    const allMatchingConfigs = await MasterConfig.findAll({
      where: {
        companyId,
        configType: "LEAD_SOURCE",
        [Op.or]: [
          { label: partyName },
          { value: partyName },
          { label: rawPartyName },
          { value: rawPartyName },
        ],
      },
    });
    allMatchingConfigs.forEach((sc) => {
      if (sc.label) sourceAliases.add(sc.label.toLowerCase());
      if (sc.value) sourceAliases.add(sc.value.toLowerCase());
    });

    const partyCode = sourceConfig?.code || (sourceConfig?.value === "SELF" ? "—" : "PTY-001");
    const aliasArray = Array.from(sourceAliases);

    // 2. Fetch all leads for this party, including CasePayout (disbursed payout truth)
    const leads = await Lead.findAll({
      where: {
        companyId,
        leadSource: { [Op.in]: aliasArray },
      },
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city", "email"] },
        { model: User, as: "assignedEmployee", attributes: ["id", "name"] },
        {
          model: Application,
          as: "applications",
          include: [{ model: Lender, as: "lender", attributes: ["id", "name", "shortCode", "lenderType"] }],
        },
        {
          model: CasePayout,
          as: "casePayout",
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // Also fetch any CasePayout records assigned to this party where leadId might not match leadSource exactly
    const existingLeadIds = new Set(leads.map((l) => l.id));
    const extraCasePayouts = await CasePayout.findAll({
      where: {
        companyId,
        payoutType: { [Op.ne]: "SELF" },
        partyName: { [Op.in]: aliasArray },
        ...(existingLeadIds.size > 0 ? { leadId: { [Op.notIn]: Array.from(existingLeadIds) } } : {}),
      },
      include: [
        {
          model: Lead,
          as: "lead",
          include: [
            { model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city", "email"] },
            { model: User, as: "assignedEmployee", attributes: ["id", "name"] },
            {
              model: Application,
              as: "applications",
              include: [{ model: Lender, as: "lender", attributes: ["id", "name", "shortCode"] }],
            },
          ],
        },
      ],
    });

    // Process case details with calculated commissions guaranteed to match Disbursed Payouts
    const processedCases = leads.map((lead) => {
      const customer = lead.customer || {};
      const apps = lead.applications || [];
      const primaryApp =
        apps.find((a) => parseFloat(a.sanctionedAmount || 0) > 0 || parseFloat(a.disbursedAmount || 0) > 0) || apps[0];
      const sanctionedAmount = primaryApp?.disbursedAmount
        ? parseFloat(primaryApp.disbursedAmount)
        : primaryApp?.sanctionedAmount
        ? parseFloat(primaryApp.sanctionedAmount)
        : null;
      const appliedAmount = primaryApp?.appliedAmount
        ? parseFloat(primaryApp.appliedAmount)
        : lead.requiredAmount
        ? parseFloat(lead.requiredAmount)
        : null;

      const cp = lead.casePayout;

      if (cp && cp.payoutType !== "SELF") {
        const loanAmount = parseFloat(cp.loanAmount || 0) || (sanctionedAmount || appliedAmount || 0);
        const bankBaseAmount = parseFloat(cp.baseAmount || 0);
        const commPct = parseFloat(cp.partyCommissionPercent || 0);
        const commDue = parseFloat(cp.partyCommissionDue || 0);
        const netPayable = parseFloat(cp.partyNetPayable !== undefined && cp.partyNetPayable !== null ? cp.partyNetPayable : commDue);
        const partyPaid = parseFloat(cp.partyPaidAmount || 0);
        const remainingDue = parseFloat(cp.partyRemainingDue !== undefined ? cp.partyRemainingDue : Math.max(0, netPayable - partyPaid));

        return {
          leadId: lead.id,
          casePayoutId: cp.id,
          applicationId: cp.applicationId || primaryApp?.id || null,
          applicationNumber: primaryApp?.applicationNumber || null,
          customerName: cp.customerName || customer.name || "Customer",
          customerMobile: cp.customerMobile || customer.mobile || "—",
          customerCity: customer.city || "—",
          loanProduct: cp.loanProduct || lead.loanType || primaryApp?.loanProduct || "Personal Loan",
          bankName: cp.bankName || primaryApp?.lender?.name || null,
          bankCode: primaryApp?.lender?.shortCode || null,
          loanAmount,
          baseAmount: loanAmount, // For backward UI compatibility
          bankBaseAmount, // The actual commission base earned from bank
          bankCommissionPercent: parseFloat(cp.bankCommissionPercent || 0),
          bankGstAmount: parseFloat(cp.bankGstAmount || 0),
          bankTdsAmount: parseFloat(cp.bankTdsAmount || 0),
          bankNetReceivable: parseFloat(cp.bankNetReceivable || 0),
          commissionPercent: commPct,
          commissionDue: commDue,
          partyTdsAmount: parseFloat(cp.partyTdsAmount || 0),
          partyGstAmount: parseFloat(cp.partyGstAmount || 0),
          extraCharges: parseFloat(cp.extraCharges || 0),
          netPayable,
          paidAmount: partyPaid,
          remainingDue,
          isDisbursed: true,
          status: remainingDue === 0 && (netPayable > 0 || partyPaid > 0) ? "SETTLED" : (partyPaid > 0 ? "PARTIALLY_SETTLED" : "DISBURSED"),
          date: cp.disbursalDate || lead.createdAt,
          owner: lead.assignedEmployee?.name || "Unassigned",
          invoiceNumber: cp.invoiceNumber || null,
        };
      }

      // Pipeline Lead (not disbursed yet)
      const baseAmt = sanctionedAmount || appliedAmount || 0;
      const commPct =
        lead.commissionPercent !== null && lead.commissionPercent !== undefined
          ? parseFloat(lead.commissionPercent)
          : defaultComm;

      const isDisbursed =
        !["CANCELLED", "REJECTED"].includes((lead.status || "").toUpperCase()) &&
        !["CANCELLED", "REJECTED"].includes((primaryApp?.status || "").toUpperCase()) &&
        !["CANCELLED", "REJECTED"].includes((primaryApp?.disbursementStatus || "").toUpperCase()) &&
        (COMPLETED_STATUSES.includes((lead.status || "").toUpperCase()) ||
          COMPLETED_STATUSES.includes((primaryApp?.status || "").toUpperCase()) ||
          (primaryApp?.disbursementStatus || "").toUpperCase() === "COMPLETED");

      return {
        leadId: lead.id,
        casePayoutId: null,
        applicationId: primaryApp?.id || null,
        applicationNumber: primaryApp?.applicationNumber || null,
        customerName: customer.name || "Customer",
        customerMobile: customer.mobile || "—",
        customerCity: customer.city || "—",
        loanProduct: lead.loanType || primaryApp?.loanProduct || "Personal Loan",
        bankName: primaryApp?.lender?.name || null,
        bankCode: primaryApp?.lender?.shortCode || null,
        loanAmount: baseAmt,
        baseAmount: baseAmt,
        bankBaseAmount: 0,
        bankCommissionPercent: null,
        bankGstAmount: 0,
        bankTdsAmount: 0,
        bankNetReceivable: 0,
        commissionPercent: commPct,
        commissionDue: 0,
        partyTdsAmount: 0,
        partyGstAmount: 0,
        extraCharges: 0,
        netPayable: 0,
        paidAmount: 0,
        remainingDue: 0,
        isDisbursed,
        status: primaryApp?.status || lead.status,
        date: lead.createdAt,
        owner: lead.assignedEmployee?.name || "Unassigned",
        invoiceNumber: null,
      };
    });

    // Add any extra case payouts found
    extraCasePayouts.forEach((cp) => {
      const l = cp.lead || {};
      const customer = l.customer || {};
      const loanAmount = parseFloat(cp.loanAmount || 0);
      const bankBaseAmount = parseFloat(cp.baseAmount || 0);
      const commPct = parseFloat(cp.partyCommissionPercent || 0);
      const commDue = parseFloat(cp.partyCommissionDue || 0);
      const netPayable = parseFloat(cp.partyNetPayable !== undefined && cp.partyNetPayable !== null ? cp.partyNetPayable : commDue);
      const partyPaid = parseFloat(cp.partyPaidAmount || 0);
      const remainingDue = parseFloat(cp.partyRemainingDue !== undefined ? cp.partyRemainingDue : Math.max(0, netPayable - partyPaid));

      processedCases.push({
        leadId: cp.leadId,
        casePayoutId: cp.id,
        applicationId: cp.applicationId,
        applicationNumber: null,
        customerName: cp.customerName || customer.name || "Customer",
        customerMobile: cp.customerMobile || customer.mobile || "—",
        customerCity: customer.city || "—",
        loanProduct: cp.loanProduct || l.loanType || "Loan",
        bankName: cp.bankName || null,
        bankCode: null,
        loanAmount,
        baseAmount: loanAmount,
        bankBaseAmount,
        bankCommissionPercent: parseFloat(cp.bankCommissionPercent || 0),
        bankGstAmount: parseFloat(cp.bankGstAmount || 0),
        bankTdsAmount: parseFloat(cp.bankTdsAmount || 0),
        bankNetReceivable: parseFloat(cp.bankNetReceivable || 0),
        commissionPercent: commPct,
        commissionDue: commDue,
        partyTdsAmount: parseFloat(cp.partyTdsAmount || 0),
        partyGstAmount: parseFloat(cp.partyGstAmount || 0),
        extraCharges: parseFloat(cp.extraCharges || 0),
        netPayable,
        paidAmount: partyPaid,
        remainingDue,
        isDisbursed: true,
        status: remainingDue === 0 && (netPayable > 0 || partyPaid > 0) ? "SETTLED" : (partyPaid > 0 ? "PARTIALLY_SETTLED" : "DISBURSED"),
        date: cp.disbursalDate || l.createdAt || new Date(),
        owner: l.assignedEmployee?.name || "Unassigned",
        invoiceNumber: cp.invoiceNumber || null,
      });
    });

    // 3. Fetch all payments for this party
    const payments = await PartyPayment.findAll({
      where: {
        companyId,
        partyName: { [Op.in]: aliasArray },
      },
      include: [
        { model: User, as: "recordedBy", attributes: ["id", "name", "email"] },
        { model: Lead, as: "lead", attributes: ["id", "loanType"] },
      ],
      order: [["paymentDate", "DESC"], ["createdAt", "DESC"]],
    });

    // Compute live balances matching Disbursed Payouts
    const disbursedCasesList = processedCases.filter((c) => c.isDisbursed);
    const caseLinkedDue = disbursedCasesList.reduce(
      (acc, c) => acc + parseFloat(c.netPayable !== undefined && c.netPayable !== null ? c.netPayable : c.commissionDue || 0),
      0
    );

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
    const payableAfterTransfers = Math.max(0, Math.round(caseLinkedDue) - Math.round(netCashTransferred));
    const advanceBalance = Math.max(0, Math.round(netCashTransferred) - Math.round(caseLinkedDue));

    return res.status(200).json({
      party: {
        id: sourceConfig?.id || null,
        partyName,
        partyCode,
        colorCode: sourceConfig?.colorCode || "#3b82f6",
        defaultCommissionPercent: defaultComm,
      },
      balances: {
        totalCasesCount: processedCases.length,
        disbursedCasesCount: disbursedCasesList.length,
        caseLinkedDue: Math.round(caseLinkedDue),
        linkedPayments: Math.round(linkedPayments),
        unallocatedAdvances: Math.round(unallocatedAdvances),
        refundsCredits: Math.round(refundsCredits),
        netCashTransferred: Math.round(netCashTransferred),
        payableAfterTransfers: Math.round(payableAfterTransfers),
        advanceBalance: Math.round(advanceBalance),
      },
      cases: processedCases,
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
 * Automatically syncs the lead's CasePayout partyPaidAmount and partyRemainingDue in real time!
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

    // Sync CasePayout if this payment was linked to a specific lead
    if (leadId && paymentType === "LINKED_PAYMENT") {
      const casePayout = await CasePayout.findOne({
        where: { leadId: parseInt(leadId, 10), companyId },
        transaction: t,
      });

      if (casePayout) {
        const allPartyPaymentsForLead = await PartyPayment.findAll({
          where: { companyId, leadId: parseInt(leadId, 10), paymentType: "LINKED_PAYMENT" },
          transaction: t,
        });

        const totalPartyPaid = allPartyPaymentsForLead.reduce(
          (sum, p) => sum + parseFloat(p.amount || 0),
          0
        );

        const currentPartyPayable = parseFloat(
          casePayout.partyNetPayable !== undefined && casePayout.partyNetPayable !== null
            ? casePayout.partyNetPayable
            : casePayout.partyCommissionDue || 0
        );

        const partyRemaining = Math.max(0, currentPartyPayable - totalPartyPaid);
        const currentBankDue = parseFloat(casePayout.bankCommissionDue || 0);
        const bankReceived = parseFloat(casePayout.bankReceivedAmount || 0);
        const bankRemaining = Math.max(0, currentBankDue - bankReceived);

        let newStatus = casePayout.status;
        if (partyRemaining === 0 && bankRemaining === 0 && (currentPartyPayable > 0 || currentBankDue > 0)) {
          newStatus = "SETTLED";
        } else if (totalPartyPaid > 0 || bankReceived > 0) {
          newStatus = "PARTIALLY_SETTLED";
        }

        await casePayout.update(
          {
            partyPaidAmount: totalPartyPaid,
            partyRemainingDue: partyRemaining,
            status: newStatus,
          },
          { transaction: t }
        );
      }
    }

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
 * Delete or reverse a payment entry and keep CasePayout in sync
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
    const linkedLeadId = payment.leadId;
    const wasLinkedPayment = payment.paymentType === "LINKED_PAYMENT";

    await payment.destroy({ transaction: t });

    // Sync CasePayout if this payment was linked to a lead
    if (linkedLeadId && wasLinkedPayment) {
      const casePayout = await CasePayout.findOne({
        where: { leadId: linkedLeadId, companyId },
        transaction: t,
      });

      if (casePayout) {
        const remainingPayments = await PartyPayment.findAll({
          where: {
            companyId,
            leadId: linkedLeadId,
            paymentType: "LINKED_PAYMENT",
            id: { [Op.ne]: previousValue.id },
          },
          transaction: t,
        });

        const totalPartyPaid = remainingPayments.reduce(
          (sum, p) => sum + parseFloat(p.amount || 0),
          0
        );

        const currentPartyPayable = parseFloat(
          casePayout.partyNetPayable !== undefined && casePayout.partyNetPayable !== null
            ? casePayout.partyNetPayable
            : casePayout.partyCommissionDue || 0
        );

        const partyRemaining = Math.max(0, currentPartyPayable - totalPartyPaid);
        const currentBankDue = parseFloat(casePayout.bankCommissionDue || 0);
        const bankReceived = parseFloat(casePayout.bankReceivedAmount || 0);
        const bankRemaining = Math.max(0, currentBankDue - bankReceived);

        let newStatus = "PENDING";
        if (partyRemaining === 0 && bankRemaining === 0 && (currentPartyPayable > 0 || currentBankDue > 0)) {
          newStatus = "SETTLED";
        } else if (totalPartyPaid > 0 || bankReceived > 0) {
          newStatus = "PARTIALLY_SETTLED";
        }

        await casePayout.update(
          {
            partyPaidAmount: totalPartyPaid,
            partyRemainingDue: partyRemaining,
            status: newStatus,
          },
          { transaction: t }
        );
      }
    }

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
 * Guaranteed to pull real CasePayout commission amounts for disbursed cases!
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
        {
          model: CasePayout,
          as: "casePayout",
        },
      ],
      limit: 50,
      order: [["createdAt", "DESC"]],
    });

    const results = leads.map((lead) => {
      const customer = lead.customer || {};
      const apps = lead.applications || [];
      const primaryApp =
        apps.find((a) => parseFloat(a.sanctionedAmount || 0) > 0 || parseFloat(a.disbursedAmount || 0) > 0) || apps[0];
      const sanctionedAmount = primaryApp?.disbursedAmount
        ? parseFloat(primaryApp.disbursedAmount)
        : primaryApp?.sanctionedAmount
        ? parseFloat(primaryApp.sanctionedAmount)
        : null;
      const appliedAmount = primaryApp?.appliedAmount
        ? parseFloat(primaryApp.appliedAmount)
        : lead.requiredAmount
        ? parseFloat(lead.requiredAmount)
        : null;

      const cp = lead.casePayout;

      if (cp && cp.payoutType !== "SELF") {
        const commDue = parseFloat(cp.partyCommissionDue || 0);
        const netPayable = parseFloat(
          cp.partyNetPayable !== undefined && cp.partyNetPayable !== null ? cp.partyNetPayable : commDue
        );

        return {
          leadId: lead.id,
          applicationId: cp.applicationId || primaryApp?.id || null,
          applicationNumber: primaryApp?.applicationNumber || null,
          customerName: cp.customerName || customer.name || "Customer",
          customerMobile: cp.customerMobile || customer.mobile || "—",
          customerCity: customer.city || "—",
          loanProduct: cp.loanProduct || lead.loanType || primaryApp?.loanProduct || "Personal Loan",
          bankName: cp.bankName || primaryApp?.lender?.name || null,
          bankCode: primaryApp?.lender?.shortCode || null,
          leadSource: cp.partyName || lead.leadSource || "Direct",
          commissionPercent: parseFloat(cp.partyCommissionPercent || 0),
          sanctionedAmount: parseFloat(cp.loanAmount || 0),
          appliedAmount: parseFloat(cp.loanAmount || 0),
          baseAmount: parseFloat(cp.loanAmount || 0),
          bankBaseAmount: parseFloat(cp.baseAmount || 0),
          commissionDue: netPayable,
          grossCommissionDue: commDue,
          remainingDue: parseFloat(cp.partyRemainingDue !== undefined ? cp.partyRemainingDue : netPayable),
          paidAmount: parseFloat(cp.partyPaidAmount || 0),
          isDisbursed: true,
          status: cp.status || primaryApp?.status || lead.status,
          date: cp.disbursalDate || lead.createdAt,
        };
      }

      const baseAmount = sanctionedAmount || appliedAmount || 0;
      const commPct = parseFloat(lead.commissionPercent || 0);
      const isDisbursed =
        !["CANCELLED", "REJECTED"].includes((lead.status || "").toUpperCase()) &&
        !["CANCELLED", "REJECTED"].includes((primaryApp?.status || "").toUpperCase()) &&
        !["CANCELLED", "REJECTED"].includes((primaryApp?.disbursementStatus || "").toUpperCase()) &&
        (COMPLETED_STATUSES.includes((lead.status || "").toUpperCase()) ||
          COMPLETED_STATUSES.includes((primaryApp?.status || "").toUpperCase()) ||
          (primaryApp?.disbursementStatus || "").toUpperCase() === "COMPLETED");

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
        leadSource: lead.leadSource || "Direct",
        commissionPercent: commPct,
        sanctionedAmount,
        appliedAmount,
        baseAmount,
        bankBaseAmount: 0,
        commissionDue: 0,
        grossCommissionDue: 0,
        remainingDue: 0,
        paidAmount: 0,
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
 * Automatically syncs the lead's CasePayout to update partyName, commissionPercent and partyDue!
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
    const defaultComm = sourceConfig?.commissionPercent ? parseFloat(sourceConfig.commissionPercent) : 50.0;

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

    // Also sync CasePayout if already exists for this lead
    const casePayout = await CasePayout.findOne({
      where: { leadId, companyId },
      transaction: t,
    });

    if (casePayout && casePayout.payoutType !== "SELF") {
      const bankBase = parseFloat(casePayout.baseAmount || 0);
      const bGst = parseFloat(casePayout.bankGstAmount || 0);
      const bTds = parseFloat(casePayout.bankTdsAmount || 0);
      const bankNet = parseFloat(casePayout.bankNetReceivable || 0) || Math.max(0, bankBase - bGst - bTds);

      const newPartyPct = commToSet;
      // Party commission is calculated on bank net receivable (after bank GST & TDS)
      const newPartyCommDue = Math.round((bankNet * newPartyPct) / 100);
      const newPartyTdsAmt = Math.round((newPartyCommDue * parseFloat(casePayout.partyTdsPercent || 0)) / 100);
      const newPartyGstAmt = Math.round((newPartyCommDue * parseFloat(casePayout.partyGstPercent || 0)) / 100);
      const extra = parseFloat(casePayout.extraCharges || 0);
      const newNetPayable = Math.max(0, newPartyCommDue - newPartyTdsAmt - newPartyGstAmt - extra);
      const partyPaid = parseFloat(casePayout.partyPaidAmount || 0);
      const remDue = Math.max(0, newNetPayable - partyPaid);
      const netMargin = Math.round(bankNet - newNetPayable);

      await casePayout.update(
        {
          partyName,
          partyCode: sourceConfig?.code || casePayout.partyCode,
          partyCommissionPercent: newPartyPct,
          partyCommissionDue: newPartyCommDue,
          partyTdsAmount: newPartyTdsAmt,
          partyGstAmount: newPartyGstAmt,
          partyNetPayable: newNetPayable,
          partyRemainingDue: remDue,
          netMargin,
        },
        { transaction: t }
      );
    }

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

/**
 * PUT /api/party-payouts/payments/:id
 * Edit an existing party payment / advance entry and re-sync CasePayout
 */
exports.updatePartyPayment = async (req, res) => {
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
    const oldLeadId = payment.leadId;
    const {
      amount,
      paymentDate,
      paymentType,
      paymentMode,
      referenceNumber,
      notes,
      leadId,
    } = req.body;

    const updatedData = {};
    if (amount !== undefined && parseFloat(amount) > 0) updatedData.amount = parseFloat(amount);
    if (paymentDate) updatedData.paymentDate = new Date(paymentDate);
    if (paymentType && ["LINKED_PAYMENT", "ADVANCE", "REFUND_CREDIT"].includes(paymentType)) {
      updatedData.paymentType = paymentType;
    }
    if (paymentMode) updatedData.paymentMode = paymentMode.trim();
    if (referenceNumber !== undefined) updatedData.referenceNumber = referenceNumber ? referenceNumber.trim() : null;
    if (notes !== undefined) updatedData.notes = notes ? notes.trim() : null;
    if (leadId !== undefined) updatedData.leadId = leadId ? parseInt(leadId, 10) : null;

    await payment.update(updatedData, { transaction: t });

    // Sync CasePayout for oldLeadId and new leadId if applicable
    const leadIdsToSync = new Set([oldLeadId, updatedData.leadId || payment.leadId].filter(Boolean));
    for (const lid of leadIdsToSync) {
      const casePayout = await CasePayout.findOne({
        where: { leadId: lid, companyId },
        transaction: t,
      });

      if (casePayout) {
        const allPartyPaymentsForLead = await PartyPayment.findAll({
          where: { companyId, leadId: lid, paymentType: "LINKED_PAYMENT" },
          transaction: t,
        });

        const totalPartyPaid = allPartyPaymentsForLead.reduce(
          (sum, p) => sum + parseFloat(p.amount || 0),
          0
        );

        const currentPartyPayable = parseFloat(
          casePayout.partyNetPayable !== undefined && casePayout.partyNetPayable !== null
            ? casePayout.partyNetPayable
            : casePayout.partyCommissionDue || 0
        );

        const partyRemaining = Math.max(0, currentPartyPayable - totalPartyPaid);
        const currentBankDue = parseFloat(casePayout.bankCommissionDue || 0);
        const bankReceived = parseFloat(casePayout.bankReceivedAmount || 0);
        const bankRemaining = Math.max(0, currentBankDue - bankReceived);

        let newStatus = "PENDING";
        if (partyRemaining === 0 && bankRemaining === 0 && (currentPartyPayable > 0 || currentBankDue > 0)) {
          newStatus = "SETTLED";
        } else if (totalPartyPaid > 0 || bankReceived > 0) {
          newStatus = "PARTIALLY_SETTLED";
        }

        await casePayout.update(
          {
            partyPaidAmount: totalPartyPaid,
            partyRemainingDue: partyRemaining,
            status: newStatus,
          },
          { transaction: t }
        );
      }
    }

    await logActivity(
      req,
      {
        recordType: "PartyPayment",
        recordId: payment.id,
        action: "UPDATED",
        previousValue,
        newValue: payment.toJSON(),
        remarks: `Updated payment entry #${payment.id} for ${payment.partyName}`,
      },
      t
    );

    await t.commit();
    return res.status(200).json({
      message: "Payment entry updated successfully",
      payment,
    });
  } catch (error) {
    await t.rollback();
    console.error("[partyPayouts] updatePartyPayment error:", error);
    return res.status(500).json({ message: "Failed to update payment", error: error.message });
  }
};

/**
 * POST /api/party-payouts/:partyName/payments/bulk-upload
 * Bulk upload payments for a party via Excel rows
 * Supports default paymentDate / month so rows get assigned into that month
 */
exports.bulkUploadPartyPayments = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const { partyName } = req.params;
    const { payments = [], defaultDate, defaultMonth } = req.body;

    if (!partyName) {
      await t.rollback();
      return res.status(400).json({ message: "Party name is required" });
    }

    if (!Array.isArray(payments) || payments.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "No payment records provided for upload" });
    }

    // Resolve party code
    const sourceConfig = await MasterConfig.findOne({
      where: {
        companyId,
        configType: "LEAD_SOURCE",
        [Op.or]: [{ label: partyName }, { value: partyName }],
      },
      transaction: t,
    });
    const partyCode = sourceConfig?.code || null;

    const createdPayments = [];
    const affectedLeadIds = new Set();

    for (let i = 0; i < payments.length; i++) {
      const row = payments[i];
      const amountVal = parseFloat(row.amount || row.Amount || 0);
      if (isNaN(amountVal) || amountVal <= 0) continue;

      let rowDate = row.paymentDate || row.payment_date || row["Payment Date"] || defaultDate;
      if (!rowDate && defaultMonth) {
        rowDate = `${defaultMonth}-01`;
      }
      if (!rowDate) {
        rowDate = new Date().toISOString().split("T")[0];
      }

      const pType = String(row.paymentType || row.payment_type || row["Payment Type"] || "LINKED_PAYMENT").trim().toUpperCase();
      const validPType = ["LINKED_PAYMENT", "ADVANCE", "REFUND_CREDIT"].includes(pType)
        ? pType
        : "LINKED_PAYMENT";

      const pMode = String(row.paymentMode || row.payment_mode || row["Payment Mode"] || "BANK_TRANSFER").trim();
      const refNo = row.referenceNumber || row.reference_number || row["Reference Number"] || row["UTR"] || null;
      const rowNotes = row.notes || row.Notes || null;
      const rowLeadId = row.leadId || row.lead_id || row["Lead ID"] ? parseInt(row.leadId || row.lead_id || row["Lead ID"], 10) : null;

      const p = await PartyPayment.create(
        {
          companyId,
          partyName: partyName.trim(),
          partyCode,
          leadId: rowLeadId,
          paymentType: validPType,
          amount: amountVal,
          paymentDate: new Date(rowDate),
          paymentMode: pMode,
          referenceNumber: refNo ? String(refNo).trim() : null,
          notes: rowNotes ? String(rowNotes).trim() : null,
          recordedById: req.user.id,
        },
        { transaction: t }
      );

      createdPayments.push(p);
      if (rowLeadId && validPType === "LINKED_PAYMENT") {
        affectedLeadIds.add(rowLeadId);
      }
    }

    // Sync CasePayout for any linked leads
    for (const lid of affectedLeadIds) {
      const casePayout = await CasePayout.findOne({
        where: { leadId: lid, companyId },
        transaction: t,
      });

      if (casePayout) {
        const allPartyPaymentsForLead = await PartyPayment.findAll({
          where: { companyId, leadId: lid, paymentType: "LINKED_PAYMENT" },
          transaction: t,
        });

        const totalPartyPaid = allPartyPaymentsForLead.reduce(
          (sum, p) => sum + parseFloat(p.amount || 0),
          0
        );

        const currentPartyPayable = parseFloat(
          casePayout.partyNetPayable !== undefined && casePayout.partyNetPayable !== null
            ? casePayout.partyNetPayable
            : casePayout.partyCommissionDue || 0
        );

        const partyRemaining = Math.max(0, currentPartyPayable - totalPartyPaid);
        const currentBankDue = parseFloat(casePayout.bankCommissionDue || 0);
        const bankReceived = parseFloat(casePayout.bankReceivedAmount || 0);
        const bankRemaining = Math.max(0, currentBankDue - bankReceived);

        let newStatus = "PENDING";
        if (partyRemaining === 0 && bankRemaining === 0 && (currentPartyPayable > 0 || currentBankDue > 0)) {
          newStatus = "SETTLED";
        } else if (totalPartyPaid > 0 || bankReceived > 0) {
          newStatus = "PARTIALLY_SETTLED";
        }

        await casePayout.update(
          {
            partyPaidAmount: totalPartyPaid,
            partyRemainingDue: partyRemaining,
            status: newStatus,
          },
          { transaction: t }
        );
      }
    }

    await logActivity(
      req,
      {
        recordType: "PartyPayment",
        recordId: partyName,
        action: "CREATED",
        remarks: `Bulk uploaded ${createdPayments.length} payment(s) for Connector/Party ${partyName}`,
      },
      t
    );

    await t.commit();
    return res.status(201).json({
      message: `Successfully uploaded ${createdPayments.length} payment entries`,
      count: createdPayments.length,
      payments: createdPayments,
    });
  } catch (error) {
    await t.rollback();
    console.error("[partyPayouts] bulkUploadPartyPayments error:", error);
    return res.status(500).json({ message: "Failed to bulk upload payments", error: error.message });
  }
};

/**
 * PUT /api/party-payouts/parties/:id
 * Edit a party / connector config (name, code, commission %, colorCode, active)
 */
exports.updateParty = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const { id } = req.params;
    const { partyName, partyCode, commissionPercent, colorCode, isActive } = req.body;

    let config = null;
    if (isNaN(id)) {
      config = await MasterConfig.findOne({
        where: {
          companyId,
          configType: "LEAD_SOURCE",
          [Op.or]: [{ label: id }, { value: id }],
        },
        transaction: t,
      });
    } else {
      config = await MasterConfig.findOne({
        where: { id: parseInt(id, 10), companyId, configType: "LEAD_SOURCE" },
        transaction: t,
      });
    }

    if (!config) {
      await t.rollback();
      return res.status(404).json({ message: "Party / Connector config not found" });
    }

    const previousValue = config.toJSON();
    const oldName = config.label;
    const newName = partyName ? partyName.trim() : oldName;

    const updates = {};
    if (partyName) {
      updates.label = newName;
      updates.value = newName;
    }
    if (partyCode !== undefined) updates.code = partyCode ? partyCode.trim() : null;
    if (commissionPercent !== undefined) updates.commissionPercent = parseFloat(commissionPercent) || 0;
    if (colorCode !== undefined) updates.colorCode = colorCode;
    if (isActive !== undefined) updates.isActive = Boolean(isActive);

    await config.update(updates, { transaction: t });

    // If party name changed, sync partyName across historic PartyPayments & CasePayouts
    if (newName !== oldName) {
      await PartyPayment.update(
        { partyName: newName, ...(updates.code ? { partyCode: updates.code } : {}) },
        { where: { companyId, partyName: oldName }, transaction: t }
      );
      await CasePayout.update(
        { partyName: newName, ...(updates.code ? { partyCode: updates.code } : {}) },
        { where: { companyId, partyName: oldName }, transaction: t }
      );
      await Lead.update(
        { leadSource: newName },
        { where: { companyId, leadSource: oldName }, transaction: t }
      );
    }

    await logActivity(
      req,
      {
        recordType: "MasterConfig",
        recordId: config.id,
        action: "UPDATED",
        previousValue,
        newValue: config.toJSON(),
        remarks: `Updated party/connector: ${oldName} -> ${newName}`,
      },
      t
    );

    await t.commit();
    return res.status(200).json({
      message: "Party / Connector updated successfully",
      party: config,
    });
  } catch (error) {
    await t.rollback();
    console.error("[partyPayouts] updateParty error:", error);
    return res.status(500).json({ message: "Failed to update party", error: error.message });
  }
};

/**
 * POST /api/party-payouts/parties/bulk-upload
 * Bulk upload parties / connectors via Excel
 */
exports.bulkUploadParties = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const { parties = [] } = req.body;

    if (!Array.isArray(parties) || parties.length === 0) {
      await t.rollback();
      return res.status(400).json({ message: "No party records provided for upload" });
    }

    const createdParties = [];
    let orderIndexCounter = 100;

    for (const p of parties) {
      const name = p.partyName || p.name || p["Party Name"] || p["Connector Name"];
      if (!name || !String(name).trim()) continue;

      const trimmedName = String(name).trim();
      const pCode = p.partyCode || p.code || p["Party Code"] || null;
      const commPct = parseFloat(p.commissionPercent || p.commission_percent || p["Commission Percent"] || 50.0);
      const activeVal = p.isActive !== undefined ? p.isActive : (p["Active"] === "NO" || p["Active"] === false ? false : true);

      let existing = await MasterConfig.findOne({
        where: {
          companyId,
          configType: "LEAD_SOURCE",
          [Op.or]: [{ label: trimmedName }, { value: trimmedName }],
        },
        transaction: t,
      });

      if (existing) {
        await existing.update(
          {
            ...(pCode ? { code: String(pCode).trim() } : {}),
            commissionPercent: isNaN(commPct) ? 50.0 : commPct,
            isActive: activeVal,
          },
          { transaction: t }
        );
        createdParties.push(existing);
      } else {
        const created = await MasterConfig.create(
          {
            companyId,
            configType: "LEAD_SOURCE",
            label: trimmedName,
            value: trimmedName,
            code: pCode ? String(pCode).trim() : null,
            commissionPercent: isNaN(commPct) ? 50.0 : commPct,
            colorCode: "#3b82f6",
            orderIndex: orderIndexCounter++,
            isActive: activeVal,
          },
          { transaction: t }
        );
        createdParties.push(created);
      }
    }

    await logActivity(
      req,
      {
        recordType: "MasterConfig",
        recordId: "BULK_UPLOAD",
        action: "CREATED",
        remarks: `Bulk imported/updated ${createdParties.length} Parties/Connectors`,
      },
      t
    );

    await t.commit();
    return res.status(201).json({
      message: `Successfully processed ${createdParties.length} Parties/Connectors`,
      count: createdParties.length,
      parties: createdParties,
    });
  } catch (error) {
    await t.rollback();
    console.error("[partyPayouts] bulkUploadParties error:", error);
    return res.status(500).json({ message: "Failed to upload parties", error: error.message });
  }
};


