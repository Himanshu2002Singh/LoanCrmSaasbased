const { Op } = require("sequelize");
const db = require("../models");
const {
  CasePayout,
  BankReceipt,
  PartyPayment,
  Lead,
  Application,
  Customer,
  Lender,
  User,
  Company,
  MasterConfig,
  sequelize,
} = db;

// Statuses considered as completed/disbursed
const COMPLETED_STATUSES = [
  "DISBURSED",
  "APPROVED",
  "COMPLETED",
  "SANCTIONED",
  "CLOSED",
];

// Helper to resolve companyId
const resolveCompanyId = (req) => {
  if (req.companyId) return req.companyId;
  if (req.user && req.user.companyId) return req.user.companyId;
  return 1;
};

// Activity logger helper
const logActivity = async (req, { recordType, recordId, action, previousValue, newValue, remarks }, transaction) => {
  try {
    if (db.ActivityLog) {
      await db.ActivityLog.create(
        {
          companyId: resolveCompanyId(req),
          userId: req.user?.id || null,
          recordType,
          recordId: String(recordId),
          action,
          previousValue,
          newValue,
          remarks,
        },
        transaction ? { transaction } : {}
      );
    }
  } catch (err) {
    console.error("[ActivityLog] Failed to record:", err.message);
  }
};

/**
 * Auto-syncs any newly disbursed leads into case_payouts table
 */
const autoSyncDisbursedCases = async (companyId) => {
  try {
    // 1. Find all leads for company that are completed/disbursed or have positive sanctioned amount
    const leads = await Lead.findAll({
      where: { companyId },
      include: [
        { model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city"] },
        {
          model: Application,
          as: "applications",
          include: [{ model: Lender, as: "lender", attributes: ["id", "name", "shortCode", "payoutCommissionPercent"] }],
        },
      ],
      order: [["createdAt", "DESC"]],
    });

    // 2. Fetch existing party configs for default codes and commissions
    const sourceConfigs = await MasterConfig.findAll({
      where: { companyId, configType: "LEAD_SOURCE" },
    });

    const configMap = new Map();
    sourceConfigs.forEach((sc) => {
      configMap.set((sc.label || "").toLowerCase(), sc);
      configMap.set((sc.value || "").toLowerCase(), sc);
    });

    for (const lead of leads) {
      const apps = lead.applications || [];
      const primaryApp = apps.find((a) => parseFloat(a.sanctionedAmount || 0) > 0) || apps[0];
      const leadStatusUpper = (lead.status || "").toUpperCase();
      const appStatusUpper = (primaryApp?.status || "").toUpperCase();

      const isDisbursed =
        COMPLETED_STATUSES.includes(leadStatusUpper) ||
        COMPLETED_STATUSES.includes(appStatusUpper) ||
        parseFloat(primaryApp?.sanctionedAmount || 0) > 0;

      if (!isDisbursed) continue;

      // Check if CasePayout exists
      let payout = await CasePayout.findOne({
        where: { companyId, leadId: lead.id },
      });

      const loanAmount = primaryApp?.sanctionedAmount
        ? parseFloat(primaryApp.sanctionedAmount)
        : primaryApp?.appliedAmount
        ? parseFloat(primaryApp.appliedAmount)
        : lead.requiredAmount
        ? parseFloat(lead.requiredAmount)
        : 0;

      const partyName = lead.leadSource || "Direct";
      const sourceConfig = configMap.get(partyName.toLowerCase());
      const partyCode = sourceConfig?.code || (partyName.toLowerCase() === "direct" || partyName.toLowerCase() === "self" ? "—" : "PTY-001");
      
      // Default vendor commission % is 50% if not specified, or from config
      const partyCommPct = lead.commissionPercent !== null && lead.commissionPercent !== undefined
        ? parseFloat(lead.commissionPercent)
        : sourceConfig?.commissionPercent
        ? parseFloat(sourceConfig.commissionPercent)
        : 50.0;

      const lender = primaryApp?.lender;
      const bankName = lender?.name || "Direct / Bank";
      const bankCommPct = lender?.payoutCommissionPercent
        ? parseFloat(lender.payoutCommissionPercent)
        : 2.0;

      // Base Amount = Gross Credit / Commission from Bank = (Loan Amount × Bank Comm %) / 100
      const baseAmount = Math.round((loanAmount * bankCommPct) / 100);
      const bankGstPct = 18.0;
      const bankTdsPct = 5.0;
      const bankGstAmount = Math.round((baseAmount * bankGstPct) / 100);
      const bankTdsAmount = Math.round((baseAmount * bankTdsPct) / 100);

      // Bank Net Payable / Receivable = Base Gross - Bank GST - Bank TDS
      const bankNetReceivable = Math.max(0, baseAmount - bankGstAmount - bankTdsAmount);
      const bankCommDue = bankNetReceivable;

      // Check if lead is Self / Direct sourced
      const isSelf =
        partyName.toLowerCase() === "self" ||
        partyName.toLowerCase() === "direct" ||
        (sourceConfig && (sourceConfig.value || "").toLowerCase() === "self");
      const payoutType = isSelf ? "SELF" : "VENDOR";

      let partyCommPctFinal = isSelf ? 0.0 : partyCommPct;
      let partyCommDue = isSelf ? 0.0 : Math.round((baseAmount * partyCommPctFinal) / 100);
      let partyTdsPercent = 0.0;
      let partyTdsAmount = 0.0;
      let partyGstPercent = 0.0;
      let partyGstAmount = 0.0;
      let extraCharges = 0.0; // Manpower / Staff incentive cost

      // In case of Self: only manpower cost is deducted, rest is company margin
      let partyNetPayable = isSelf ? 0.0 : Math.max(0, partyCommDue - partyTdsAmount - partyGstAmount - extraCharges);
      let netMargin = isSelf
        ? Math.round(bankNetReceivable - extraCharges)
        : Math.round(bankNetReceivable - partyNetPayable);

      if (!payout) {
        // Generate Invoice Number
        const currentYear = new Date().getFullYear();
        const invoiceNumber = `INV-${currentYear}-${String(lead.id).padStart(4, "0")}`;

        payout = await CasePayout.create({
          companyId,
          leadId: lead.id,
          applicationId: primaryApp?.id || null,
          customerName: lead.customer?.name || "Customer",
          customerMobile: lead.customer?.mobile || "—",
          loanProduct: lead.loanType || primaryApp?.loanProduct || "Personal Loan",
          bankName,
          lenderId: lender?.id || null,
          disbursalDate: primaryApp?.updatedAt || lead.updatedAt || new Date(),
          loanAmount,
          baseAmount,
          bankCommissionPercent: bankCommPct,
          bankCommissionDue: bankCommDue,
          bankGstPercent: bankGstPct,
          bankGstAmount,
          bankTdsPercent: bankTdsPct,
          bankTdsAmount,
          bankNetReceivable,
          bankReceivedAmount: 0.0,
          bankRemainingDue: bankCommDue,
          payoutType,
          partyName: isSelf ? "Self" : partyName,
          partyCode: isSelf ? "—" : partyCode,
          partyCommissionPercent: partyCommPctFinal,
          partyCommissionDue,
          partyTdsPercent,
          partyTdsAmount,
          partyGstPercent,
          partyGstAmount,
          extraCharges,
          partyNetPayable,
          partyPaidAmount: 0.0,
          partyRemainingDue: partyNetPayable,
          netMargin,
          invoiceNumber,
          invoiceDate: new Date(),
          status: "PENDING",
        });
      } else {
        // Sync paid/received amounts from actual transactions
        const receipts = await BankReceipt.findAll({
          where: { companyId, casePayoutId: payout.id },
        });
        const totalBankReceived = receipts.reduce((sum, r) => sum + parseFloat(r.grossAmount || 0), 0);

        const partyPayments = await PartyPayment.findAll({
          where: { companyId, leadId: lead.id, paymentType: "LINKED_PAYMENT" },
        });
        const totalPartyPaid = partyPayments.reduce((sum, p) => sum + parseFloat(p.amount || 0), 0);

        const currentBankDue = parseFloat(payout.bankCommissionDue || 0);
        const currentPartyPayable = parseFloat(payout.partyNetPayable || payout.partyCommissionDue || 0);

        const bankRemaining = Math.max(0, currentBankDue - totalBankReceived);
        const partyRemaining = Math.max(0, currentPartyPayable - totalPartyPaid);

        let status = "PENDING";
        if (bankRemaining === 0 && partyRemaining === 0 && (currentBankDue > 0 || currentPartyPayable > 0)) {
          status = "SETTLED";
        } else if (totalBankReceived > 0 || totalPartyPaid > 0) {
          status = "PARTIALLY_SETTLED";
        }

        await payout.update({
          bankReceivedAmount: totalBankReceived,
          bankRemainingDue: bankRemaining,
          partyPaidAmount: totalPartyPaid,
          partyRemainingDue: partyRemaining,
          status,
        });
      }
    }
  } catch (error) {
    console.error("[casePayoutController] autoSyncDisbursedCases error:", error);
  }
};

/**
 * GET /api/payouts/cases
 * Returns all disbursed case payouts with filters and aggregated KPIs
 */
exports.getDisbursedPayouts = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { fromDate, toDate, month, financialYear, bankName, partyName, status, search } = req.query;

    // Run auto-sync first so latest completed leads are guaranteed to show
    await autoSyncDisbursedCases(companyId);

    // Build Where Clause
    const where = { companyId };

    if (bankName && bankName.trim()) {
      where.bankName = bankName.trim();
    }

    if (partyName && partyName.trim()) {
      where.partyName = partyName.trim();
    }

    if (status && status !== "ALL") {
      if (status === "SETTLED") {
        where.status = "SETTLED";
      } else if (status === "BANK_DUE") {
        where.bankRemainingDue = { [Op.gt]: 0 };
      } else if (status === "PARTY_DUE") {
        where.partyRemainingDue = { [Op.gt]: 0 };
      } else if (status === "PENDING") {
        where.status = { [Op.in]: ["PENDING", "PARTIALLY_SETTLED"] };
      }
    }

    // Period Filters
    if (fromDate && toDate) {
      where.disbursalDate = {
        [Op.between]: [fromDate, toDate],
      };
    } else if (month) {
      const [year, m] = month.split("-");
      const startDate = `${year}-${m}-01`;
      const endDate = new Date(parseInt(year, 10), parseInt(m, 10), 0).toISOString().split("T")[0];
      where.disbursalDate = {
        [Op.between]: [startDate, endDate],
      };
    } else if (financialYear) {
      const [startYear] = financialYear.split("-");
      const sY = parseInt(startYear, 10);
      const startDate = `${sY}-04-01`;
      const endDate = `${sY + 1}-03-31`;
      where.disbursalDate = {
        [Op.between]: [startDate, endDate],
      };
    }

    // Search filter
    if (search && search.trim()) {
      const q = search.trim();
      where[Op.or] = [
        { customerName: { [Op.like]: `%${q}%` } },
        { customerMobile: { [Op.like]: `%${q}%` } },
        { bankName: { [Op.like]: `%${q}%` } },
        { partyName: { [Op.like]: `%${q}%` } },
        { loanProduct: { [Op.like]: `%${q}%` } },
        { invoiceNumber: { [Op.like]: `%${q}%` } },
      ];
      if (!isNaN(q)) {
        where[Op.or].push({ leadId: parseInt(q, 10) });
      }
    }

    const cases = await CasePayout.findAll({
      where,
      include: [
        {
          model: Lead,
          as: "lead",
          attributes: ["id", "loanType", "leadSource", "commissionPercent"],
          include: [
            {
              model: Application,
              as: "applications",
              attributes: ["id", "applicationNumber", "loanProduct", "sanctionedAmount", "status"],
            },
          ],
        },
      ],
      order: [["disbursalDate", "DESC"], ["id", "DESC"]],
    });

    // Compute Grand Totals & KPIs
    let totalLoanVolume = 0;
    let totalBaseAmount = 0;
    let totalBankCommissionDue = 0;
    let totalBankReceived = 0;
    let totalBankRemainingDue = 0;
    let totalPartyCommissionDue = 0;
    let totalPartyTds = 0;
    let totalPartyGst = 0;
    let totalExtraCharges = 0;
    let totalPartyNetPayable = 0;
    let totalPartyPaid = 0;
    let totalPartyRemainingDue = 0;
    let totalNetMargin = 0;

    cases.forEach((c) => {
      totalLoanVolume += parseFloat(c.loanAmount || 0);
      totalBaseAmount += parseFloat(c.baseAmount || 0);
      totalBankCommissionDue += parseFloat(c.bankCommissionDue || c.baseAmount || 0);
      totalBankReceived += parseFloat(c.bankReceivedAmount || 0);
      totalBankRemainingDue += parseFloat(c.bankRemainingDue || 0);
      totalPartyCommissionDue += parseFloat(c.partyCommissionDue || 0);
      totalPartyTds += parseFloat(c.partyTdsAmount || 0);
      totalPartyGst += parseFloat(c.partyGstAmount || 0);
      totalExtraCharges += parseFloat(c.extraCharges || 0);
      totalPartyNetPayable += parseFloat(c.partyNetPayable || c.partyCommissionDue || 0);
      totalPartyPaid += parseFloat(c.partyPaidAmount || 0);
      totalPartyRemainingDue += parseFloat(c.partyRemainingDue || 0);
      totalNetMargin += parseFloat(c.netMargin || 0);
    });

    const grandTotals = {
      totalCases: cases.length,
      totalLoanVolume: Math.round(totalLoanVolume),
      totalDisbursedVolume: Math.round(totalLoanVolume),
      totalBaseAmount: Math.round(totalBaseAmount),
      totalBankCommissionDue: Math.round(totalBankCommissionDue),
      totalBankReceived: Math.round(totalBankReceived),
      totalBankRemainingDue: Math.round(totalBankRemainingDue),
      totalPartyCommissionDue: Math.round(totalPartyCommissionDue),
      totalPartyTds: Math.round(totalPartyTds),
      totalPartyGst: Math.round(totalPartyGst),
      totalExtraCharges: Math.round(totalExtraCharges),
      totalPartyNetPayable: Math.round(totalPartyNetPayable),
      totalPartyPaid: Math.round(totalPartyPaid),
      totalPartyRemainingDue: Math.round(totalPartyRemainingDue),
      totalNetMargin: Math.round(totalNetMargin),
    };

    return res.status(200).json({
      cases,
      grandTotals,
      filters: { fromDate, toDate, month, financialYear, bankName, partyName, status, search },
    });
  } catch (error) {
    console.error("[casePayoutController] getDisbursedPayouts error:", error);
    return res.status(500).json({ message: "Failed to fetch disbursed payouts", error: error.message });
  }
};

/**
 * PUT /api/payouts/cases/:id
 * Update Case Rates, Taxes, Manpower deductions, and Invoicing details
 */
exports.updateCasePayoutRates = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const { id } = req.params;
    const {
      loanAmount,
      baseAmount,
      disbursalDate,
      bankCommissionPercent,
      bankGstPercent,
      bankGstAmount,
      bankTdsPercent,
      bankTdsAmount,
      payoutType,
      partyName,
      partyCode,
      partyCommissionPercent,
      partyTdsPercent,
      partyTdsAmount,
      partyGstPercent,
      partyGstAmount,
      extraCharges,
      invoiceNumber,
      invoiceDate,
      invoiceStatus,
      notes,
    } = req.body;

    const casePayout = await CasePayout.findOne({
      where: { id, companyId },
      transaction: t,
    });

    if (!casePayout) {
      await t.rollback();
      return res.status(404).json({ message: "Case payout record not found" });
    }

    const previousValue = casePayout.toJSON();

    const newLoan = loanAmount !== undefined && loanAmount !== "" ? parseFloat(loanAmount) : parseFloat(casePayout.loanAmount || 0);
    const newBankPct = bankCommissionPercent !== undefined && bankCommissionPercent !== "" ? parseFloat(bankCommissionPercent) : parseFloat(casePayout.bankCommissionPercent || 0);

    // 1. Base Amount = Gross Credit / Commission from Bank
    let newBase = baseAmount !== undefined && baseAmount !== "" ? parseFloat(baseAmount) : null;
    if (newBase === null || isNaN(newBase)) {
      newBase = Math.round((newLoan * newBankPct) / 100);
    }

    // 2. Bank Deductions (GST & TDS deducted from Bank Gross Commission)
    const newBankGstPct = bankGstPercent !== undefined && bankGstPercent !== "" ? parseFloat(bankGstPercent) : parseFloat(casePayout.bankGstPercent || 0);
    let newBankGstAmt = bankGstAmount !== undefined && bankGstAmount !== "" ? parseFloat(bankGstAmount) : Math.round((newBase * newBankGstPct) / 100);

    const newBankTdsPct = bankTdsPercent !== undefined && bankTdsPercent !== "" ? parseFloat(bankTdsPercent) : parseFloat(casePayout.bankTdsPercent || 0);
    let newBankTdsAmt = bankTdsAmount !== undefined && bankTdsAmount !== "" ? parseFloat(bankTdsAmount) : Math.round((newBase * newBankTdsPct) / 100);

    // Bank Net Payable / Receivable: Bank Commission Due is after subtracting GST & TDS
    const bankNetReceivable = Math.max(0, newBase - newBankGstAmt - newBankTdsAmt);
    const bankCommissionDue = bankNetReceivable;
    const bankReceived = parseFloat(casePayout.bankReceivedAmount || 0);
    const bankRemainingDue = Math.max(0, bankCommissionDue - bankReceived);

    // 3. Payout Type (SELF vs VENDOR)
    const effectivePayoutType =
      payoutType !== undefined
        ? payoutType
        : (casePayout.payoutType === "SELF" || (casePayout.partyName || "").toLowerCase() === "self" || (casePayout.partyName || "").toLowerCase() === "direct")
        ? "SELF"
        : "VENDOR";

    const isSelf = effectivePayoutType === "SELF";

    // 4. Manpower / Staff incentive cost
    const newExtraCharges = extraCharges !== undefined && extraCharges !== "" ? parseFloat(extraCharges) : parseFloat(casePayout.extraCharges || 0);

    let newPartyPct = 0.0;
    let partyCommissionDue = 0.0;
    let newPartyTdsPct = 0.0;
    let newPartyTdsAmt = 0.0;
    let newPartyGstPct = 0.0;
    let newPartyGstAmt = 0.0;
    let partyNetPayable = 0.0;
    let partyRemainingDue = 0.0;
    let netMargin = 0.0;
    const partyPaid = parseFloat(casePayout.partyPaidAmount || 0);

    if (isSelf) {
      // In case of Self: NO vendor payout, only manpower cost is deducted, rest is 100% company margin
      newPartyPct = 0.0;
      partyCommissionDue = 0.0;
      newPartyTdsPct = 0.0;
      newPartyTdsAmt = 0.0;
      newPartyGstPct = 0.0;
      newPartyGstAmt = 0.0;
      partyNetPayable = 0.0;
      partyRemainingDue = 0.0;
      netMargin = Math.round(bankNetReceivable - newExtraCharges);
    } else {
      // VENDOR Payout: Gross Vendor Comm minus Vendor TDS, GST, and Manpower cost
      newPartyPct = partyCommissionPercent !== undefined && partyCommissionPercent !== "" ? parseFloat(partyCommissionPercent) : parseFloat(casePayout.partyCommissionPercent || 0);
      partyCommissionDue = Math.round((newBase * newPartyPct) / 100);

      newPartyTdsPct = partyTdsPercent !== undefined && partyTdsPercent !== "" ? parseFloat(partyTdsPercent) : parseFloat(casePayout.partyTdsPercent || 0);
      newPartyTdsAmt = partyTdsAmount !== undefined && partyTdsAmount !== "" ? parseFloat(partyTdsAmount) : Math.round((partyCommissionDue * newPartyTdsPct) / 100);

      newPartyGstPct = partyGstPercent !== undefined && partyGstPercent !== "" ? parseFloat(partyGstPercent) : parseFloat(casePayout.partyGstPercent || 0);
      newPartyGstAmt = partyGstAmount !== undefined && partyGstAmount !== "" ? parseFloat(partyGstAmount) : Math.round((partyCommissionDue * newPartyGstPct) / 100);

      partyNetPayable = Math.max(0, partyCommissionDue - newPartyTdsAmt - newPartyGstAmt - newExtraCharges);
      partyRemainingDue = Math.max(0, partyNetPayable - partyPaid);
      netMargin = Math.round(bankNetReceivable - partyNetPayable);
    }

    let status = "PENDING";
    if (bankRemainingDue === 0 && partyRemainingDue === 0 && (bankCommissionDue > 0 || partyNetPayable > 0 || isSelf)) {
      status = "SETTLED";
    } else if (bankReceived > 0 || partyPaid > 0) {
      status = "PARTIALLY_SETTLED";
    }

    await casePayout.update(
      {
        loanAmount: newLoan,
        baseAmount: newBase,
        disbursalDate: disbursalDate || casePayout.disbursalDate,
        bankCommissionPercent: newBankPct,
        bankCommissionDue,
        bankGstPercent: newBankGstPct,
        bankGstAmount: newBankGstAmt,
        bankTdsPercent: newBankTdsPct,
        bankTdsAmount: newBankTdsAmt,
        bankNetReceivable,
        bankRemainingDue,
        payoutType: effectivePayoutType,
        partyName: isSelf ? "Self" : (partyName !== undefined ? partyName : casePayout.partyName),
        partyCode: isSelf ? "—" : (partyCode !== undefined ? partyCode : casePayout.partyCode),
        partyCommissionPercent: newPartyPct,
        partyCommissionDue,
        partyTdsPercent: newPartyTdsPct,
        partyTdsAmount: newPartyTdsAmt,
        partyGstPercent: newPartyGstPct,
        partyGstAmount: newPartyGstAmt,
        extraCharges: newExtraCharges,
        partyNetPayable,
        partyRemainingDue,
        netMargin,
        invoiceNumber: invoiceNumber !== undefined ? invoiceNumber : casePayout.invoiceNumber,
        invoiceDate: invoiceDate !== undefined ? invoiceDate : casePayout.invoiceDate,
        invoiceStatus: invoiceStatus || casePayout.invoiceStatus,
        notes: notes !== undefined ? notes : casePayout.notes,
        status,
      },
      { transaction: t }
    );

    // Also update lead's commissionPercent if partyCommissionPercent changed
    if (partyCommissionPercent !== undefined && casePayout.leadId) {
      await Lead.update(
        { commissionPercent: newPartyPct },
        { where: { id: casePayout.leadId, companyId }, transaction: t }
      );
    }

    await logActivity(
      req,
      {
        recordType: "Lead",
        recordId: casePayout.leadId,
        action: "UPDATED",
        previousValue,
        newValue: casePayout.toJSON(),
        remarks: `Updated rates & deductions for Lead #${casePayout.leadId} (${casePayout.customerName})`,
      },
      t
    );

    await t.commit();
    return res.status(200).json({
      message: "Case payout rates and deductions updated successfully",
      casePayout,
    });
  } catch (error) {
    await t.rollback();
    console.error("[casePayoutController] updateCasePayoutRates error:", error);
    return res.status(500).json({ message: "Failed to update case rates", error: error.message });
  }
};

/**
 * POST /api/payouts/cases/:id/bank-receipt
 * Record commission payment received from the bank for this case
 */
exports.recordBankReceipt = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const { id } = req.params;
    const { grossAmount, gstAmount, tdsAmount, receiptDate, paymentMode, referenceNumber, notes } = req.body;

    if (!grossAmount || parseFloat(grossAmount) <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Valid gross amount is required" });
    }

    const casePayout = await CasePayout.findOne({
      where: { id, companyId },
      transaction: t,
    });

    if (!casePayout) {
      await t.rollback();
      return res.status(404).json({ message: "Case payout record not found" });
    }

    const gross = parseFloat(grossAmount);
    const gst = parseFloat(gstAmount || 0);
    const tds = parseFloat(tdsAmount || 0);
    const net = gross + gst - tds;

    const receipt = await BankReceipt.create(
      {
        companyId,
        casePayoutId: casePayout.id,
        leadId: casePayout.leadId,
        bankName: casePayout.bankName || "Bank",
        grossAmount: gross,
        gstAmount: gst,
        tdsAmount: tds,
        netAmount: net,
        receiptDate: receiptDate || new Date().toISOString().split("T")[0],
        paymentMode: paymentMode || "NEFT",
        referenceNumber: referenceNumber || null,
        notes: notes || null,
        recordedById: req.user?.id || null,
      },
      { transaction: t }
    );

    // Update CasePayout
    const newBankReceived = parseFloat(casePayout.bankReceivedAmount || 0) + gross;
    const newBankRemaining = Math.max(0, parseFloat(casePayout.bankCommissionDue || 0) - newBankReceived);

    const partyRemaining = parseFloat(casePayout.partyRemainingDue || 0);
    let status = "PENDING";
    if (newBankRemaining === 0 && partyRemaining === 0) {
      status = "SETTLED";
    } else if (newBankReceived > 0 || parseFloat(casePayout.partyPaidAmount || 0) > 0) {
      status = "PARTIALLY_SETTLED";
    }

    await casePayout.update(
      {
        bankReceivedAmount: newBankReceived,
        bankRemainingDue: newBankRemaining,
        status,
      },
      { transaction: t }
    );

    await logActivity(
      req,
      {
        recordType: "Lead",
        recordId: casePayout.leadId,
        action: "CREATED",
        newValue: receipt.toJSON(),
        remarks: `Recorded Bank Receipt of ₹${gross} for Lead #${casePayout.leadId} (${casePayout.bankName})`,
      },
      t
    );

    await t.commit();
    return res.status(201).json({
      message: `Bank payment of ₹${gross} recorded successfully!`,
      receipt,
      casePayout,
    });
  } catch (error) {
    await t.rollback();
    console.error("[casePayoutController] recordBankReceipt error:", error);
    return res.status(500).json({ message: "Failed to record bank receipt", error: error.message });
  }
};

/**
 * POST /api/payouts/cases/:id/party-payment
 * Record connector payout for this specific case (auto-syncs to PartyPayment ledger)
 */
exports.recordPartyPayoutForCase = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const { id } = req.params;
    const { amount, paymentDate, paymentMode, referenceNumber, notes } = req.body;

    if (!amount || parseFloat(amount) <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Valid payout amount is required" });
    }

    const casePayout = await CasePayout.findOne({
      where: { id, companyId },
      transaction: t,
    });

    if (!casePayout) {
      await t.rollback();
      return res.status(404).json({ message: "Case payout record not found" });
    }

    const amt = parseFloat(amount);

    // 1. Create linked PartyPayment entry
    const payment = await PartyPayment.create(
      {
        companyId,
        partyName: casePayout.partyName,
        partyCode: casePayout.partyCode,
        leadId: casePayout.leadId,
        paymentType: "LINKED_PAYMENT",
        amount: amt,
        paymentDate: paymentDate || new Date().toISOString().split("T")[0],
        paymentMode: paymentMode || "BANK_TRANSFER",
        referenceNumber: referenceNumber || null,
        notes: notes || `Payout for Lead #${casePayout.leadId} (${casePayout.customerName})`,
        recordedById: req.user?.id || null,
      },
      { transaction: t }
    );

    // 2. Update CasePayout against partyNetPayable
    const newPartyPaid = parseFloat(casePayout.partyPaidAmount || 0) + amt;
    const targetPayable = parseFloat(casePayout.partyNetPayable || casePayout.partyCommissionDue || 0);
    const newPartyRemaining = Math.max(0, targetPayable - newPartyPaid);

    const bankRemaining = parseFloat(casePayout.bankRemainingDue || 0);
    let status = "PENDING";
    if (newPartyRemaining === 0 && bankRemaining === 0) {
      status = "SETTLED";
    } else if (newPartyPaid > 0 || parseFloat(casePayout.bankReceivedAmount || 0) > 0) {
      status = "PARTIALLY_SETTLED";
    }

    await casePayout.update(
      {
        partyPaidAmount: newPartyPaid,
        partyRemainingDue: newPartyRemaining,
        status,
      },
      { transaction: t }
    );

    await logActivity(
      req,
      {
        recordType: "Lead",
        recordId: casePayout.leadId,
        action: "CREATED",
        newValue: payment.toJSON(),
        remarks: `Recorded Party Payout of ₹${amt} to ${casePayout.partyName} for Lead #${casePayout.leadId}`,
      },
      t
    );

    await t.commit();
    return res.status(201).json({
      message: `Party payout of ₹${amt} recorded successfully!`,
      payment,
      casePayout,
    });
  } catch (error) {
    await t.rollback();
    console.error("[casePayoutController] recordPartyPayoutForCase error:", error);
    return res.status(500).json({ message: "Failed to record party payout", error: error.message });
  }
};

/**
 * GET /api/payouts/journal
 * Returns the exact Party Payment Journal / Ledger matching user screenshot:
 * Payment Ref | Date | Party / Connector | Party Code | Transaction Type | Lead ID | Case Position |
 * Paid / Debit (₹) | Refund / Credit (₹) | Net Cash Out (₹) | Payment Mode | Bank Ref / UTR | Running Balance (₹) | Allocation Status | Remarks
 */
exports.getPaymentJournal = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { fromDate, toDate, month, financialYear, partyName, search } = req.query;

    const where = { companyId };

    if (partyName && partyName.trim()) {
      where.partyName = partyName.trim();
    }

    if (fromDate && toDate) {
      where.paymentDate = { [Op.between]: [fromDate, toDate] };
    } else if (month) {
      const [year, m] = month.split("-");
      const startDate = `${year}-${m}-01`;
      const endDate = new Date(parseInt(year, 10), parseInt(m, 10), 0).toISOString().split("T")[0];
      where.paymentDate = { [Op.between]: [startDate, endDate] };
    } else if (financialYear) {
      const [startYear] = financialYear.split("-");
      const sY = parseInt(startYear, 10);
      where.paymentDate = { [Op.between]: [`${sY}-04-01`, `${sY + 1}-03-31`] };
    }

    if (search && search.trim()) {
      const q = search.trim();
      where[Op.or] = [
        { partyName: { [Op.like]: `%${q}%` } },
        { partyCode: { [Op.like]: `%${q}%` } },
        { referenceNumber: { [Op.like]: `%${q}%` } },
        { notes: { [Op.like]: `%${q}%` } },
      ];
      if (!isNaN(q)) {
        where[Op.or].push({ leadId: parseInt(q, 10) });
      }
    }

    // Fetch all payments ordered chronologically
    const payments = await PartyPayment.findAll({
      where,
      include: [
        {
          model: Lead,
          as: "lead",
          attributes: ["id", "loanType"],
          include: [
            { model: Customer, as: "customer", attributes: ["name", "mobile"] },
          ],
        },
        { model: User, as: "recordedBy", attributes: ["name"] },
      ],
      order: [["paymentDate", "ASC"], ["createdAt", "ASC"]],
    });

    let runningBalance = 0;
    let totalDebit = 0;
    let totalCredit = 0;
    let totalNetCashOut = 0;

    const journal = payments.map((p) => {
      const amt = parseFloat(p.amount || 0);
      const isRefund = p.paymentType === "REFUND_CREDIT";
      const isAdvance = p.paymentType === "ADVANCE";

      const paidDebit = isRefund ? 0 : amt;
      const refundCredit = isRefund ? amt : 0;
      const netCashOut = paidDebit - refundCredit;

      runningBalance += netCashOut;
      totalDebit += paidDebit;
      totalCredit += refundCredit;
      totalNetCashOut += netCashOut;

      const customerName = p.lead?.customer?.name;
      const loanProduct = p.lead?.loanType;
      const casePosition = customerName ? `${customerName} (${loanProduct || "Loan"})` : isAdvance ? "General Advance" : "Unallocated";

      const allocationStatus = isAdvance
        ? "Unallocated Advance"
        : isRefund
        ? "Refund / Credit Adj"
        : p.leadId
        ? `Linked to Lead #${p.leadId}`
        : "Direct Settlement";

      const paymentRef = `PAY-${String(p.id).padStart(5, "0")}`;

      return {
        id: p.id,
        paymentRef,
        date: p.paymentDate,
        partyName: p.partyName,
        partyCode: p.partyCode || "—",
        transactionType: isAdvance ? "Advance" : isRefund ? "Refund / Credit" : "Settlement",
        rawType: p.paymentType,
        leadId: p.leadId || "—",
        casePosition,
        paidDebit: Math.round(paidDebit),
        refundCredit: Math.round(refundCredit),
        netCashOut: Math.round(netCashOut),
        paymentMode: p.paymentMode?.replace(/_/g, " "),
        referenceNumber: p.referenceNumber || "—",
        runningBalance: Math.round(runningBalance),
        allocationStatus,
        remarks: p.notes || "—",
        recordedBy: p.recordedBy?.name || "Admin",
      };
    });

    // Return in reverse chronological order for display
    const displayJournal = [...journal].reverse();

    const totals = {
      totalEntries: payments.length,
      totalDebit: Math.round(totalDebit),
      totalCredit: Math.round(totalCredit),
      totalNetCashOut: Math.round(totalNetCashOut),
      finalBalance: Math.round(runningBalance),
    };

    return res.status(200).json({ journal: displayJournal, totals });
  } catch (error) {
    console.error("[casePayoutController] getPaymentJournal error:", error);
    return res.status(500).json({ message: "Failed to fetch payment journal", error: error.message });
  }
};

/**
 * GET /api/payouts/cases/:id/invoice
 * Returns structured data for generating and printing official Bank Tax Invoice and Connector Payout Slip
 */
exports.getInvoiceData = async (req, res) => {
  try {
    const companyId = resolveCompanyId(req);
    const { id } = req.params;

    const casePayout = await CasePayout.findOne({
      where: { id, companyId },
      include: [
        {
          model: Lead,
          as: "lead",
          include: [
            { model: Customer, as: "customer" },
            {
              model: Application,
              as: "applications",
              include: [{ model: Lender, as: "lender" }],
            },
          ],
        },
        { model: Lender, as: "lender" },
        { model: BankReceipt, as: "bankReceipts" },
      ],
    });

    if (!casePayout) {
      return res.status(404).json({ message: "Case payout record not found" });
    }

    const company = await Company.findByPk(companyId);

    // Also fetch PartyPayment history for this case
    const partyPayments = await PartyPayment.findAll({
      where: { companyId, leadId: casePayout.leadId, paymentType: "LINKED_PAYMENT" },
      order: [["paymentDate", "DESC"]],
    });

    const loanAmount = parseFloat(casePayout.loanAmount || 0);
    const baseAmount = parseFloat(casePayout.baseAmount || 0);
    const bankCommDue = parseFloat(casePayout.bankCommissionDue || baseAmount || 0);
    const bankGstPct = parseFloat(casePayout.bankGstPercent || 18);
    const bankTdsPct = parseFloat(casePayout.bankTdsPercent || 5);

    const gstAmount = Math.round((bankCommDue * bankGstPct) / 100);
    const tdsAmount = Math.round((bankCommDue * bankTdsPct) / 100);
    const grossInvoiceValue = bankCommDue + gstAmount;
    const netReceivableFromBank = grossInvoiceValue - tdsAmount;

    const partyCommDue = parseFloat(casePayout.partyCommissionDue || 0);
    const partyTdsPct = parseFloat(casePayout.partyTdsPercent || 0);
    const partyTdsAmount = parseFloat(casePayout.partyTdsAmount || 0);
    const partyGstPct = parseFloat(casePayout.partyGstPercent || 0);
    const partyGstAmount = parseFloat(casePayout.partyGstAmount || 0);
    const extraCharges = parseFloat(casePayout.extraCharges || 0);
    const netPayableToParty = parseFloat(casePayout.partyNetPayable || (partyCommDue - partyTdsAmount - partyGstAmount - extraCharges));

    return res.status(200).json({
      invoice: {
        invoiceNumber: casePayout.invoiceNumber || `INV-${new Date().getFullYear()}-${casePayout.id}`,
        invoiceDate: casePayout.invoiceDate || new Date().toISOString().split("T")[0],
        invoiceStatus: casePayout.invoiceStatus || "ISSUED",
        company: {
          name: company?.name || "CapitalCare Financial Solutions",
          address: "120, Financial District, MG Road, Jaipur, Rajasthan - 302001",
          gstin: "08AABCT1234F1Z5",
          pan: "AABCT1234F",
          email: company?.email || "billing@capitalcare.in",
          phone: company?.phone || "+91 98765 43210",
          bankName: "HDFC Bank",
          accountNumber: "50200012345678",
          ifsc: "HDFC0001234",
          branch: "Ashok Nagar, Jaipur",
        },
        billTo: {
          bankName: casePayout.bankName || "Lender / Bank Partner",
          lenderType: casePayout.lender?.lenderType || "Bank",
          contactPerson: casePayout.lender?.contactPerson || "Loan Processing & Channel Operations",
        },
        caseDetails: {
          leadId: casePayout.leadId,
          customerName: casePayout.customerName,
          customerMobile: casePayout.customerMobile,
          loanProduct: casePayout.loanProduct,
          disbursalDate: casePayout.disbursalDate,
          loanAmount,
          baseAmount,
          bankCommissionPercent: parseFloat(casePayout.bankCommissionPercent),
          bankCommissionDue: bankCommDue,
          bankGstPercent: bankGstPct,
          gstAmount,
          bankTdsPercent: bankTdsPct,
          tdsAmount,
          grossInvoiceValue,
          netReceivableFromBank,
          bankReceivedAmount: parseFloat(casePayout.bankReceivedAmount || 0),
          bankRemainingDue: parseFloat(casePayout.bankRemainingDue || 0),
        },
        connectorDetails: {
          partyName: casePayout.partyName,
          partyCode: casePayout.partyCode,
          partyCommissionPercent: parseFloat(casePayout.partyCommissionPercent),
          partyCommissionDue: partyCommDue,
          partyTdsPercent: partyTdsPct,
          partyTdsAmount,
          partyGstPercent: partyGstPct,
          partyGstAmount,
          extraCharges,
          netPayableToParty,
          partyPaidAmount: parseFloat(casePayout.partyPaidAmount || 0),
          partyRemainingDue: parseFloat(casePayout.partyRemainingDue || 0),
        },
        bankReceipts: casePayout.bankReceipts || [],
        partyPayments: partyPayments || [],
      },
    });
  } catch (error) {
    console.error("[casePayoutController] getInvoiceData error:", error);
    return res.status(500).json({ message: "Failed to generate invoice data", error: error.message });
  }
};
