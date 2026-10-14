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
 * Auto-syncs any newly disbursed leads into case_payouts table,
 * and purges any payouts whose lead/application is CANCELLED, REJECTED,
 * or not completed through Final Disbursement.
 */
const autoSyncDisbursedCases = async (companyId) => {
  try {
    // 1. Cleanup / Purge step: remove any CasePayout records whose linked Lead or Application
    // is CANCELLED, REJECTED, or has NOT completed Final Disbursement.
    const existingPayouts = await CasePayout.findAll({
      where: { companyId },
      include: [
        {
          model: Lead,
          as: "lead",
          include: [
            {
              model: Application,
              as: "applications",
            },
          ],
        },
        {
          model: Application,
          as: "application",
        },
      ],
    });

    const isDisbursedOrCompleted = (stat) => {
      const s = (stat || "").toUpperCase();
      return (
        s === "DISBURSED" ||
        s === "COMPLETED" ||
        s === "CLOSED" ||
        s === "ALL_PROCESS_COMPLETED"
      );
    };

    for (const payout of existingPayouts) {
      const lead = payout.lead;
      const app = payout.application || (lead?.applications || [])[0];

      const leadStatus = (lead?.status || "").toUpperCase();
      const appStatus = (app?.status || "").toUpperCase();
      const disbStatus = (app?.disbursementStatus || "").toUpperCase();

      const isCancelledOrRejected =
        leadStatus === "CANCELLED" ||
        leadStatus === "REJECTED" ||
        appStatus === "CANCELLED" ||
        appStatus === "REJECTED" ||
        disbStatus === "CANCELLED";

      // A case has completed Final Disbursement or All Process Completed if app or lead is DISBURSED or COMPLETED
      const isFinalDisbursed =
        !isCancelledOrRejected &&
        (app
          ? isDisbursedOrCompleted(appStatus) || isDisbursedOrCompleted(disbStatus)
          : isDisbursedOrCompleted(leadStatus));

      if (isCancelledOrRejected || !isFinalDisbursed) {
        await CasePayout.destroy({ where: { id: payout.id } });
      }
    }

    // 2. Find all leads for company that are completed/disbursed
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

    // 3. Fetch existing party configs for default codes and commissions
    const sourceConfigs = await MasterConfig.findAll({
      where: { companyId, configType: "LEAD_SOURCE" },
    });

    const configMap = new Map();
    sourceConfigs.forEach((sc) => {
      configMap.set((sc.label || "").toLowerCase(), sc);
      configMap.set((sc.value || "").toLowerCase(), sc);
    });

    for (const lead of leads) {
      const leadStatusUpper = (lead.status || "").toUpperCase();
      const apps = lead.applications || [];

      // Find the application that has completed Final Disbursement or All Process Completed
      const primaryApp =
        apps.find((a) => {
          const aStat = (a.status || "").toUpperCase();
          const aDisb = (a.disbursementStatus || "").toUpperCase();
          return isDisbursedOrCompleted(aStat) || isDisbursedOrCompleted(aDisb);
        }) || apps[0];

      const appStatusUpper = (primaryApp?.status || "").toUpperCase();
      const appDisbStatusUpper = (primaryApp?.disbursementStatus || "").toUpperCase();

      const isCancelledOrRejected =
        leadStatusUpper === "CANCELLED" ||
        leadStatusUpper === "REJECTED" ||
        appStatusUpper === "CANCELLED" ||
        appStatusUpper === "REJECTED" ||
        appDisbStatusUpper === "CANCELLED";

      if (isCancelledOrRejected) {
        await CasePayout.destroy({ where: { companyId, leadId: lead.id } });
        continue;
      }

      // Check for final disbursement / all process completed:
      const isFinalDisbursed =
        !isCancelledOrRejected &&
        (primaryApp
          ? isDisbursedOrCompleted(appStatusUpper) || isDisbursedOrCompleted(appDisbStatusUpper)
          : isDisbursedOrCompleted(leadStatusUpper));

      if (!isFinalDisbursed) {
        await CasePayout.destroy({ where: { companyId, leadId: lead.id } });
        continue;
      }

      // Check if CasePayout exists
      let payout = await CasePayout.findOne({
        where: { companyId, leadId: lead.id },
      });

      const loanAmount =
        parseFloat(primaryApp?.disbursedAmount || 0) > 0
          ? parseFloat(primaryApp.disbursedAmount)
          : parseFloat(primaryApp?.sanctionedAmount || 0) > 0
          ? parseFloat(primaryApp.sanctionedAmount)
          : parseFloat(primaryApp?.appliedAmount || 0) > 0
          ? parseFloat(primaryApp.appliedAmount)
          : parseFloat(lead.requiredAmount || 0);

      if (loanAmount <= 0) {
        await CasePayout.destroy({ where: { companyId, leadId: lead.id } });
        continue;
      }

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
      // Base Amount = Gross Credit / Commission from Bank = (Loan Amount × Bank Comm %) / 100
      const baseAmount = Math.round((loanAmount * bankCommPct) / 100);

      // Corporate DSA Charge (%) and Amount (₹):
      const corporateDsaPercent = 0.0;
      const corporateDsaAmount = Math.round((baseAmount * corporateDsaPercent) / 100);
      // Actual Amount after Corporate DSA Charge:
      const actualAmount = Math.max(0, baseAmount - corporateDsaAmount);

      // Check if lead is Self / Direct sourced
      const isSelf =
        partyName.toLowerCase() === "self" ||
        partyName.toLowerCase() === "direct" ||
        (sourceConfig && (sourceConfig.value || "").toLowerCase() === "self");
      const payoutType = isSelf ? "SELF" : "VENDOR";

      let partyCommPctFinal = isSelf ? 0.0 : partyCommPct;
      let partyCommDue = isSelf ? 0.0 : Math.round((baseAmount * partyCommPctFinal) / 100);

      // GST and TDS calculated on Actual Amount (after Corporate DSA deduction):
      const bankGstPct = 18.0;
      const bankTdsPct = 5.0;
      const bankTdsAmount = Math.round((actualAmount * bankTdsPct) / 100);
      const bankGstAmount = Math.round((actualAmount * bankGstPct) / 100);

      // Final Bank Net Receivable: Actual Amount - Bank TDS = X Amount (GST is NOT subtracted from net receivable, kept separate as Y Amount)
      const bankNetReceivable = Math.max(0, actualAmount - bankTdsAmount);
      const bankCommDue = bankNetReceivable;

      let partyTdsPercent = 0.0;
      let partyTdsAmount = 0.0;
      let partyGstPercent = 0.0;
      let partyGstAmount = 0.0;
      let extraCharges = 0.0; // Manpower / Staff incentive cost

      // In case of Self: only manpower cost is deducted, rest is company margin
      let partyNetPayable = isSelf ? 0.0 : Math.max(0, partyCommDue - partyTdsAmount - partyGstAmount - extraCharges);
      let netMargin = Math.round(bankNetReceivable - (isSelf ? 0 : partyNetPayable) - extraCharges);

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
          corporateDsaPercent,
          corporateDsaAmount,
          actualAmount,
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
          partyCommissionDue: partyCommDue,
          partyTdsPercent,
          partyTdsAmount,
          partyGstPercent,
          partyGstAmount,
          extraCharges,
          partyNetPayable,
          partyPaidAmount: 0.0,
          partyRemainingDue: partyNetPayable,
          netMargin,
          gstrStatus: "PENDING",
          gstrAmount: bankGstAmount,
          gstrReceivedAmount: 0.0,
          invoiceNumber,
          invoiceDate: new Date(),
          status: "PENDING",
        });
      } else {
        // If loanAmount was updated on lead/app and no receipts/payments yet, keep payout in sync
        if (
          parseFloat(payout.bankReceivedAmount || 0) === 0 &&
          parseFloat(payout.partyPaidAmount || 0) === 0 &&
          loanAmount > 0 &&
          Math.abs(parseFloat(payout.loanAmount || 0) - loanAmount) > 0.01
        ) {
          await payout.update({
            loanAmount,
            baseAmount,
            bankGstAmount,
            bankTdsAmount,
            bankNetReceivable,
            bankCommissionDue: bankCommDue,
            bankRemainingDue: bankCommDue,
            partyCommissionDue: partyCommDue,
            partyNetPayable,
            partyRemainingDue: partyNetPayable,
            netMargin,
            applicationId: primaryApp?.id || payout.applicationId,
          });
        }

        if (!payout.applicationId && primaryApp?.id) {
          await payout.update({ applicationId: primaryApp.id });
        }
        if (!payout.lenderId && lender?.id) {
          await payout.update({ lenderId: lender.id, bankName });
        }

        // Ensure bank deductions and net receivable are set based on Corporate DSA deduction rule
        const curBase = parseFloat(payout.baseAmount || 0);
        const curCorpDsaPct = parseFloat(payout.corporateDsaPercent || 0);
        const curCorpDsaAmt = payout.corporateDsaAmount !== undefined && payout.corporateDsaAmount !== null ? parseFloat(payout.corporateDsaAmount) : Math.round((curBase * curCorpDsaPct) / 100);
        const curActualAmt = Math.max(0, curBase - curCorpDsaAmt);

        const curBankGstPct = parseFloat(payout.bankGstPercent) || 18.0;
        const curBankTdsPct = parseFloat(payout.bankTdsPercent) || 5.0;
        const curBankGst = Math.round((curActualAmt * curBankGstPct) / 100);
        const curBankTds = Math.round((curActualAmt * curBankTdsPct) / 100);
        // Bank Net Receivable: Actual Amount - TDS (GST is separate, not subtracted!)
        const curBankNet = Math.max(0, curActualAmt - curBankTds);

        const isPayoutSelf = payout.payoutType === "SELF" || (payout.partyName || "").toLowerCase() === "self" || (payout.partyName || "").toLowerCase() === "direct";
        const curPartyPct = isPayoutSelf ? 0 : parseFloat(payout.partyCommissionPercent || 0);
        const correctPartyCommDue = isPayoutSelf ? 0 : Math.round((curBase * curPartyPct) / 100);

        const correctPartyTds = Math.round((correctPartyCommDue * (parseFloat(payout.partyTdsPercent) || 0)) / 100);
        const correctPartyGst = Math.round((correctPartyCommDue * (parseFloat(payout.partyGstPercent) || 0)) / 100);
        const correctPartyNet = Math.max(0, correctPartyCommDue - correctPartyTds - correctPartyGst - (parseFloat(payout.extraCharges) || 0));
        const correctMargin = Math.round(curBankNet - (isPayoutSelf ? 0 : correctPartyNet) - (parseFloat(payout.extraCharges) || 0));

        const partyPaid = parseFloat(payout.partyPaidAmount || 0);
        const shouldUpdateToNetRule =
          parseFloat(payout.bankNetReceivable || 0) !== curBankNet ||
          parseFloat(payout.bankGstAmount || 0) !== curBankGst ||
          parseFloat(payout.bankTdsAmount || 0) !== curBankTds ||
          parseFloat(payout.actualAmount || 0) !== curActualAmt ||
          Math.abs(parseFloat(payout.partyCommissionDue || 0) - correctPartyCommDue) > 0.5 ||
          !payout.gstrStatus;

        if (shouldUpdateToNetRule) {
          await payout.update({
            corporateDsaPercent: curCorpDsaPct,
            corporateDsaAmount: curCorpDsaAmt,
            actualAmount: curActualAmt,
            bankGstAmount: curBankGst,
            bankTdsAmount: curBankTds,
            bankNetReceivable: curBankNet,
            bankCommissionDue: curBankNet,
            bankRemainingDue: Math.max(0, curBankNet - parseFloat(payout.bankReceivedAmount || 0)),
            partyCommissionDue: correctPartyCommDue,
            partyTdsAmount: correctPartyTds,
            partyGstAmount: correctPartyGst,
            partyNetPayable: correctPartyNet,
            partyRemainingDue: Math.max(0, correctPartyNet - partyPaid),
            netMargin: correctMargin,
            gstrStatus: payout.gstrStatus || "PENDING",
            gstrAmount: parseFloat(payout.gstrAmount || 0) > 0 ? payout.gstrAmount : curBankGst,
          });
        }

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
              model: Customer,
              as: "customer",
              attributes: ["id", "name", "email", "mobile"],
              required: false,
            },
            {
              model: Application,
              as: "applications",
              attributes: ["id", "applicationNumber", "loanProduct", "sanctionedAmount", "disbursedAmount", "status"],
            },
          ],
        },
        {
          model: Application,
          as: "application",
          attributes: ["id", "applicationNumber", "loanProduct", "appliedAmount", "sanctionedAmount", "disbursedAmount", "status"],
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
    let totalBankGst = 0;
    let totalBankTds = 0;
    let totalGstrAmount = 0;
    let totalGstrReceived = 0;
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
      totalBankGst += parseFloat(c.bankGstAmount || 0);
      totalBankTds += parseFloat(c.bankTdsAmount || 0);
      totalGstrAmount += parseFloat(c.gstrAmount || c.bankGstAmount || 0);
      totalGstrReceived += parseFloat(c.gstrReceivedAmount || 0);
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
      totalBankGst: Math.round(totalBankGst),
      totalBankTds: Math.round(totalBankTds),
      totalGstrAmount: Math.round(totalGstrAmount),
      totalGstrReceived: Math.round(totalGstrReceived),
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
      corporateDsaPercent,
      corporateDsaAmount,
      actualAmount: reqActualAmount,
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
      partyCommissionDue: reqPartyCommissionDue,
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

    // 2. Corporate DSA Charge (%) and Amount (₹) deducted from Gross Bank Commission Base
    const newCorpDsaPct =
      corporateDsaPercent !== undefined && corporateDsaPercent !== ""
        ? parseFloat(corporateDsaPercent)
        : parseFloat(casePayout.corporateDsaPercent || 0);

    let newCorpDsaAmt =
      corporateDsaAmount !== undefined && corporateDsaAmount !== ""
        ? parseFloat(corporateDsaAmount)
        : Math.round((newBase * newCorpDsaPct) / 100);

    // 3. Actual Amount after Corporate DSA deduction
    const actualAmount = Math.max(0, newBase - newCorpDsaAmt);

    // 4. On this Actual Amount, calculate Bank TDS and GST:
    const newBankTdsPct = bankTdsPercent !== undefined && bankTdsPercent !== "" ? parseFloat(bankTdsPercent) : parseFloat(casePayout.bankTdsPercent || 0);
    let newBankTdsAmt = bankTdsAmount !== undefined && bankTdsAmount !== "" ? parseFloat(bankTdsAmount) : Math.round((actualAmount * newBankTdsPct) / 100);

    const newBankGstPct = bankGstPercent !== undefined && bankGstPercent !== "" ? parseFloat(bankGstPercent) : parseFloat(casePayout.bankGstPercent || 0);
    let newBankGstAmt = bankGstAmount !== undefined && bankGstAmount !== "" ? parseFloat(bankGstAmount) : Math.round((actualAmount * newBankGstPct) / 100);

    // 5. Final Net Receivable: Actual Amount - Bank TDS = X Amount (GST is NOT subtracted from net receivable, kept separate as Y Amount)
    const bankNetReceivable = Math.max(0, actualAmount - newBankTdsAmt);
    const bankCommissionDue = bankNetReceivable;
    const bankReceived = parseFloat(casePayout.bankReceivedAmount || 0);
    const bankRemainingDue = Math.max(0, bankCommissionDue - bankReceived);

    // 6. Payout Type (SELF vs VENDOR) & Party/Vendor Commission
    const effectivePayoutType =
      payoutType !== undefined
        ? payoutType
        : (casePayout.payoutType === "SELF" || (casePayout.partyName || "").toLowerCase() === "self" || (casePayout.partyName || "").toLowerCase() === "direct")
        ? "SELF"
        : "VENDOR";

    const isSelf = effectivePayoutType === "SELF";
    const newExtraCharges = extraCharges !== undefined && extraCharges !== "" ? parseFloat(extraCharges) : parseFloat(casePayout.extraCharges || 0);

    let newPartyPct = 0.0;
    let partyCommissionDue = 0.0;
    let newPartyTdsPct = 0.0;
    let newPartyTdsAmt = 0.0;
    let newPartyGstPct = 0.0;
    let newPartyGstAmt = 0.0;
    let partyNetPayable = 0.0;
    let partyRemainingDue = 0.0;
    const partyPaid = parseFloat(casePayout.partyPaidAmount || 0);

    if (isSelf) {
      newPartyPct = 0.0;
      partyCommissionDue = 0.0;
      partyNetPayable = 0.0;
      partyRemainingDue = 0.0;
    } else {
      newPartyPct = partyCommissionPercent !== undefined && partyCommissionPercent !== "" ? parseFloat(partyCommissionPercent) : parseFloat(casePayout.partyCommissionPercent || 0);
      partyCommissionDue = reqPartyCommissionDue !== undefined && reqPartyCommissionDue !== "" ? parseFloat(reqPartyCommissionDue) : Math.round((newBase * newPartyPct) / 100);

      newPartyTdsPct = partyTdsPercent !== undefined && partyTdsPercent !== "" ? parseFloat(partyTdsPercent) : parseFloat(casePayout.partyTdsPercent || 0);
      newPartyTdsAmt = partyTdsAmount !== undefined && partyTdsAmount !== "" ? parseFloat(partyTdsAmount) : Math.round((partyCommissionDue * newPartyTdsPct) / 100);

      newPartyGstPct = partyGstPercent !== undefined && partyGstPercent !== "" ? parseFloat(partyGstPercent) : parseFloat(casePayout.partyGstPercent || 0);
      newPartyGstAmt = partyGstAmount !== undefined && partyGstAmount !== "" ? parseFloat(partyGstAmount) : Math.round((partyCommissionDue * newPartyGstPct) / 100);

      partyNetPayable = Math.max(0, partyCommissionDue - newPartyTdsAmt - newPartyGstAmt - newExtraCharges);
      partyRemainingDue = Math.max(0, partyNetPayable - partyPaid);
    }

    const netMargin = Math.round(bankNetReceivable - (isSelf ? 0 : partyNetPayable) - newExtraCharges);

    // 7. GST reflection status & amount
    const newGstrStatus = req.body.gstrStatus || casePayout.gstrStatus || "PENDING";
    const newGstrAmount = req.body.gstrAmount !== undefined && req.body.gstrAmount !== "" ? parseFloat(req.body.gstrAmount) : newBankGstAmt;
    let newGstrReceived = req.body.gstrReceivedAmount !== undefined && req.body.gstrReceivedAmount !== "" ? parseFloat(req.body.gstrReceivedAmount) : parseFloat(casePayout.gstrReceivedAmount || 0);
    if (newGstrStatus === "COMPLETE" && (newGstrReceived <= 0 || req.body.gstrStatus === "COMPLETE")) {
      newGstrReceived = newGstrAmount;
    } else if (newGstrStatus === "PENDING" && req.body.gstrStatus === "PENDING") {
      newGstrReceived = 0;
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
        corporateDsaPercent: newCorpDsaPct,
        corporateDsaAmount: newCorpDsaAmt,
        actualAmount,
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
        gstrStatus: newGstrStatus,
        gstrAmount: newGstrAmount,
        gstrReceivedAmount: newGstrReceived,
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

    // Check & Validate: amount cannot exceed (Bank Commission - Corporate DSA Commission - TDS)
    const baseComm = parseFloat(casePayout.baseAmount || 0);
    const corpDsaComm = parseFloat(casePayout.partyCommissionDue || 0);
    const tdsDeducted = parseFloat(casePayout.bankTdsAmount || 0);
    const maxNetReceivable = Math.max(0, baseComm - corpDsaComm - tdsDeducted);
    const alreadyReceived = parseFloat(casePayout.bankReceivedAmount || 0);
    const maxRemainingReceivable = Math.max(0, maxNetReceivable - alreadyReceived);

    if (gross > maxRemainingReceivable + 0.01) {
      await t.rollback();
      return res.status(400).json({
        message: `Receipt amount (₹${gross}) exceeds maximum eligible receivable of ₹${Math.round(maxRemainingReceivable)} (Eligible Net: ₹${Math.round(maxNetReceivable)} [Bank Comm ₹${baseComm} − Corp DSA Comm ₹${corpDsaComm} − TDS ₹${tdsDeducted}] − Already Received ₹${Math.round(alreadyReceived)}).`,
        maxEligible: Math.round(maxNetReceivable),
        alreadyReceived: Math.round(alreadyReceived),
        maxRemainingReceivable: Math.round(maxRemainingReceivable),
      });
    }

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
    const newBankReceived = alreadyReceived + gross;
    const newBankRemaining = Math.max(0, maxNetReceivable - newBankReceived);

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

    // Dynamic Company GST, PAN, Address, and Remittance details
    const fullCompanyAddress = [
      company?.address,
      company?.city,
      company?.state ? `${company.state}${company?.pincode ? ` - ${company.pincode}` : ""}` : (company?.pincode ? `PIN: ${company.pincode}` : "")
    ].filter(Boolean).join(", ") || company?.address || "Address Not Configured (Update in Settings)";

    const companyGstin = company?.gstNumber || "GSTIN Not Specified";
    const companyPan = company?.panNumber || (company?.gstNumber && company.gstNumber.length >= 12 ? company.gstNumber.substring(2, 12) : "—");

    return res.status(200).json({
      invoice: {
        invoiceNumber: casePayout.invoiceNumber || `INV-${new Date().getFullYear()}-${casePayout.id}`,
        invoiceDate: casePayout.invoiceDate || new Date().toISOString().split("T")[0],
        invoiceStatus: casePayout.invoiceStatus || "ISSUED",
        company: {
          name: company?.name || "CapitalCare Financial Solutions",
          address: fullCompanyAddress,
          gstin: companyGstin,
          pan: companyPan,
          email: company?.email || "",
          phone: company?.phone || "",
          bankName: company?.bankName || "—",
          accountNumber: company?.accountNumber || "—",
          ifsc: company?.ifscCode || "—",
          branch: company?.bankBranch || "—",
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

/**
 * POST /api/payouts/cases
 * Allows Finance role and Admin to manually create/record a case payout for a lead
 */
exports.createCasePayout = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const {
      leadId,
      customerName,
      customerMobile,
      customerEmail,
      loanProduct,
      bankName,
      lenderId,
      loanAmount,
      bankCommissionPercent = 2.0,
      baseAmount,
      corporateDsaPercent = 0.0,
      corporateDsaAmount,
      actualAmount: reqActualAmount,
      bankGstPercent = 18.0,
      bankTdsPercent = 5.0,
      disbursalDate,
      partyName,
      partyCode,
      partyCommissionPercent = 50.0,
      extraCharges = 0,
      notes,
    } = req.body;

    if (!customerName && !leadId) {
      await t.rollback();
      return res.status(400).json({ message: "Customer Name or Lead selection is required" });
    }

    const newLoan = parseFloat(loanAmount || 0);
    if (isNaN(newLoan) || newLoan <= 0) {
      await t.rollback();
      return res.status(400).json({ message: "Valid loan amount is required" });
    }

    let targetLead = null;
    let targetCustomer = null;

    if (leadId) {
      targetLead = await Lead.findOne({
        where: { id: leadId, companyId },
        include: [{ model: Customer, as: "customer" }],
        transaction: t,
      });
      if (!targetLead) {
        await t.rollback();
        return res.status(404).json({ message: "Selected lead not found" });
      }
      targetCustomer = targetLead.customer;
      if (targetCustomer && (customerEmail || customerMobile || customerName)) {
        await targetCustomer.update(
          {
            name: customerName ? customerName.trim() : targetCustomer.name,
            mobile: customerMobile ? String(customerMobile).trim() : targetCustomer.mobile,
            email: customerEmail ? customerEmail.trim() : targetCustomer.email,
          },
          { transaction: t }
        );
      }
    } else {
      // Find or create customer
      const mobileVal = customerMobile ? String(customerMobile).trim() : `9999${Date.now().toString().slice(-6)}`;
      targetCustomer = await Customer.create(
        {
          companyId,
          name: customerName ? customerName.trim() : "Customer",
          mobile: mobileVal,
          email: customerEmail ? customerEmail.trim() : null,
        },
        { transaction: t }
      );

      targetLead = await Lead.create(
        {
          companyId,
          customerId: targetCustomer.id,
          loanType: loanProduct || "Personal Loan",
          leadSource: partyName || "Self",
          requiredAmount: newLoan,
          sanctioned_amount: newLoan,
          bank_name: bankName || "Bank",
          status: "DISBURSED",
          priority: "HIGH",
          commissionPercent: parseFloat(partyCommissionPercent) || 0,
          createdById: req.user?.id || null,
        },
        { transaction: t }
      );
    }

    // Check if payout already exists for this lead
    let payout = await CasePayout.findOne({
      where: { companyId, leadId: targetLead.id },
      transaction: t,
    });

    const newBankPct = parseFloat(bankCommissionPercent || 2.0);
    let newBase =
      baseAmount !== undefined && baseAmount !== ""
        ? parseFloat(baseAmount)
        : Math.round((newLoan * newBankPct) / 100);

    const newCorpDsaPct = parseFloat(corporateDsaPercent || 0);
    const newCorpDsaAmt =
      corporateDsaAmount !== undefined && corporateDsaAmount !== ""
        ? parseFloat(corporateDsaAmount)
        : Math.round((newBase * newCorpDsaPct) / 100);
    const actualAmount = Math.max(0, newBase - newCorpDsaAmt);

    const newBankTdsPct = parseFloat(bankTdsPercent ?? 5.0);
    const newBankTdsAmt = Math.round((actualAmount * newBankTdsPct) / 100);
    const newBankGstPct = parseFloat(bankGstPercent ?? 18.0);
    const newBankGstAmt = Math.round((actualAmount * newBankGstPct) / 100);

    // Final Net Receivable: Actual Amount - Bank TDS = X Amount (GST is separate, NOT subtracted!)
    const bankNetReceivable = Math.max(0, actualAmount - newBankTdsAmt);
    const bankCommissionDue = bankNetReceivable;

    const effectivePartyName = partyName || targetLead.leadSource || "Self";
    const isSelf =
      effectivePartyName.toLowerCase() === "self" || effectivePartyName.toLowerCase() === "direct";
    const payoutType = isSelf ? "SELF" : "VENDOR";

    let partyCommPct = isSelf ? 0.0 : parseFloat(partyCommissionPercent ?? 50.0);
    let partyCommDue = isSelf ? 0.0 : Math.round((newBase * partyCommPct) / 100);
    let newExtra = parseFloat(extraCharges || 0);
    let partyNetPayable = isSelf ? 0.0 : Math.max(0, partyCommDue - newExtra);
    let netMargin = Math.round(bankNetReceivable - (isSelf ? 0 : partyNetPayable) - newExtra);

    const disbDateVal = disbursalDate ? disbursalDate : new Date().toISOString().slice(0, 10);
    const custName = customerName ? customerName.trim() : targetCustomer?.name || "Customer";
    const custMobile = customerMobile ? String(customerMobile).trim() : targetCustomer?.mobile || "—";
    const loanProd = loanProduct || targetLead.loanType || "Personal Loan";
    const finalBank = bankName || "Bank";

    if (payout) {
      await payout.update(
        {
          customerName: custName,
          customerMobile: custMobile,
          loanProduct: loanProd,
          bankName: finalBank,
          lenderId: lenderId || payout.lenderId || null,
          disbursalDate: disbDateVal,
          loanAmount: newLoan,
          baseAmount: newBase,
          corporateDsaPercent: newCorpDsaPct,
          corporateDsaAmount: newCorpDsaAmt,
          actualAmount,
          bankCommissionPercent: newBankPct,
          bankCommissionDue,
          bankGstPercent: newBankGstPct,
          bankGstAmount: newBankGstAmt,
          bankTdsPercent: newBankTdsPct,
          bankTdsAmount: newBankTdsAmt,
          bankNetReceivable,
          bankRemainingDue: Math.max(0, bankCommissionDue - parseFloat(payout.bankReceivedAmount || 0)),
          payoutType,
          partyName: effectivePartyName,
          partyCode: partyCode || payout.partyCode || null,
          partyCommissionPercent: partyCommPct,
          partyCommissionDue: partyCommDue,
          extraCharges: newExtra,
          partyNetPayable,
          partyRemainingDue: Math.max(0, partyNetPayable - parseFloat(payout.partyPaidAmount || 0)),
          netMargin,
          gstrAmount: parseFloat(payout.gstrAmount || 0) > 0 ? payout.gstrAmount : newBankGstAmt,
          notes: notes || payout.notes,
        },
        { transaction: t }
      );
    } else {
      const currentYear = new Date().getFullYear();
      const invoiceNumber = `INV-${currentYear}-${String(targetLead.id).padStart(4, "0")}`;

      payout = await CasePayout.create(
        {
          companyId,
          leadId: targetLead.id,
          customerName: custName,
          customerMobile: custMobile,
          loanProduct: loanProd,
          bankName: finalBank,
          lenderId: lenderId || null,
          disbursalDate: disbDateVal,
          loanAmount: newLoan,
          baseAmount: newBase,
          corporateDsaPercent: newCorpDsaPct,
          corporateDsaAmount: newCorpDsaAmt,
          actualAmount,
          bankCommissionPercent: newBankPct,
          bankCommissionDue,
          bankGstPercent: newBankGstPct,
          bankGstAmount: newBankGstAmt,
          bankTdsPercent: newBankTdsPct,
          bankTdsAmount: newBankTdsAmt,
          bankNetReceivable,
          bankReceivedAmount: 0.0,
          bankRemainingDue: bankCommissionDue,
          payoutType,
          partyName: effectivePartyName,
          partyCode: partyCode || null,
          partyCommissionPercent: partyCommPct,
          partyCommissionDue: partyCommDue,
          partyTdsPercent: 0,
          partyTdsAmount: 0,
          partyGstPercent: 0,
          partyGstAmount: 0,
          extraCharges: newExtra,
          partyNetPayable,
          partyPaidAmount: 0.0,
          partyRemainingDue: partyNetPayable,
          netMargin,
          gstrStatus: "PENDING",
          gstrAmount: newBankGstAmt,
          gstrReceivedAmount: 0.0,
          invoiceNumber,
          invoiceDate: new Date(),
          status: "PENDING",
          notes: notes || null,
        },
        { transaction: t }
      );
    }

    // Keep lead in sync with loan amount, bank, status
    await targetLead.update(
      {
        sanctioned_amount: newLoan,
        bank_name: finalBank,
        loanType: loanProd,
        leadSource: effectivePartyName,
        commissionPercent: partyCommPct,
      },
      { transaction: t }
    );

    await logActivity(
      req,
      {
        recordType: "CASE_PAYOUT",
        recordId: payout.id,
        action: "CREATE_CASE_PAYOUT",
        remarks: `Recorded case payout of ₹${newLoan.toLocaleString("en-IN")} for ${custName} (${finalBank})`,
      },
      t
    );

    await t.commit();

    return res.status(201).json({
      success: true,
      message: "Case payout recorded successfully",
      data: payout,
    });
  } catch (error) {
    await t.rollback();
    console.error("[casePayoutController] createCasePayout error:", error);
    return res.status(500).json({ message: "Failed to record case payout", error: error.message });
  }
};

/**
 * PUT /api/payouts/cases/:id/gstr-status
 * Updates GSTR reflection status (PENDING / COMPLETE / PARTIALLY_COMPLETE) and received amount
 */
exports.updateGstrStatus = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const companyId = resolveCompanyId(req);
    const { id } = req.params;
    const { gstrStatus, gstrReceivedAmount, notes } = req.body;

    const casePayout = await CasePayout.findOne({
      where: { id, companyId },
      transaction: t,
    });

    if (!casePayout) {
      await t.rollback();
      return res.status(404).json({ message: "Case payout record not found" });
    }

    const previousValue = casePayout.toJSON();
    const validStatuses = ["PENDING", "COMPLETE", "PARTIALLY_COMPLETE"];
    const statusVal = validStatuses.includes(gstrStatus) ? gstrStatus : "PENDING";
    const totalGstAmount = parseFloat(casePayout.gstrAmount || casePayout.bankGstAmount || 0);

    let receivedAmt = 0;
    if (statusVal === "COMPLETE") {
      receivedAmt = gstrReceivedAmount !== undefined && gstrReceivedAmount !== "" ? parseFloat(gstrReceivedAmount) : totalGstAmount;
    } else if (statusVal === "PARTIALLY_COMPLETE") {
      receivedAmt = parseFloat(gstrReceivedAmount || 0);
      if (receivedAmt > totalGstAmount && totalGstAmount > 0) {
        receivedAmt = totalGstAmount;
      }
    } else {
      receivedAmt = 0;
    }

    await casePayout.update(
      {
        gstrStatus: statusVal,
        gstrAmount: totalGstAmount,
        gstrReceivedAmount: receivedAmt,
        notes: notes !== undefined ? notes : casePayout.notes,
      },
      { transaction: t }
    );

    await logActivity(
      req,
      {
        recordType: "Lead",
        recordId: casePayout.leadId,
        action: "UPDATED",
        previousValue,
        newValue: casePayout.toJSON(),
        remarks: `Updated GSTR status to ${statusVal} (Received ₹${receivedAmt} of ₹${totalGstAmount}) for Lead #${casePayout.leadId}`,
      },
      t
    );

    await t.commit();
    return res.status(200).json({
      message: `GSTR status updated to ${statusVal} successfully`,
      casePayout,
    });
  } catch (error) {
    await t.rollback();
    console.error("[casePayoutController] updateGstrStatus error:", error);
    return res.status(500).json({ message: "Failed to update GSTR status", error: error.message });
  }
};

/**
 * GET /api/payouts/cases/:id/payment-history
 * Returns comprehensive payment history and transaction timeline for a lead / case payout
 */
exports.getCasePaymentHistory = async (req, res) => {
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
            { model: Application, as: "applications", include: [{ model: Lender, as: "lender" }] },
          ],
        },
        { model: Lender, as: "lender" },
      ],
    });

    if (!casePayout) {
      return res.status(404).json({ message: "Case payout record not found" });
    }

    // 1. Fetch all Bank Receipts for this case
    const bankReceipts = await BankReceipt.findAll({
      where: { companyId, casePayoutId: casePayout.id },
      include: [{ model: User, as: "recordedBy", attributes: ["id", "name"] }],
      order: [["receiptDate", "DESC"], ["createdAt", "DESC"]],
    });

    // 2. Fetch all Party Payments linked to this lead
    const partyPayments = await PartyPayment.findAll({
      where: { companyId, leadId: casePayout.leadId },
      include: [{ model: User, as: "recordedBy", attributes: ["id", "name"] }],
      order: [["paymentDate", "DESC"], ["createdAt", "DESC"]],
    });

    // 3. Compile merged timeline
    const timeline = [];

    bankReceipts.forEach((br) => {
      timeline.push({
        id: `br-${br.id}`,
        rawId: br.id,
        category: "BANK_RECEIPT",
        title: "Bank Commission Received",
        partyOrBank: br.bankName || casePayout.bankName || "Bank",
        date: br.receiptDate,
        amount: parseFloat(br.grossAmount || 0),
        gstAmount: parseFloat(br.gstAmount || 0),
        tdsAmount: parseFloat(br.tdsAmount || 0),
        netAmount: parseFloat(br.netAmount || br.grossAmount || 0),
        paymentMode: br.paymentMode,
        referenceNumber: br.referenceNumber || "—",
        notes: br.notes || "—",
        recordedBy: br.recordedBy?.name || "System",
        createdAt: br.createdAt,
      });
    });

    partyPayments.forEach((pp) => {
      timeline.push({
        id: `pp-${pp.id}`,
        rawId: pp.id,
        category: "PARTY_PAYOUT",
        title: `Payout to ${pp.partyName || "Party"}`,
        partyOrBank: pp.partyName || casePayout.partyName || "Connector",
        date: pp.paymentDate,
        amount: parseFloat(pp.amount || 0),
        gstAmount: 0,
        tdsAmount: 0,
        netAmount: parseFloat(pp.amount || 0),
        paymentMode: pp.paymentMode,
        referenceNumber: pp.referenceNumber || "—",
        notes: pp.notes || "—",
        recordedBy: pp.recordedBy?.name || "System",
        createdAt: pp.createdAt,
      });
    });

    // Sort combined timeline descending by date
    timeline.sort((a, b) => new Date(b.date || b.createdAt) - new Date(a.date || a.createdAt));

    // Calculate core figures according to requirement:
    // Gross Bank Comm Base -> minus Corporate DSA Charge -> Actual Amount -> minus Bank TDS = Bank Net Receivable (X Amount).
    // Bank GST (Y Amount) is separate, NOT subtracted!
    const loanAmount = parseFloat(casePayout.loanAmount || 0);
    const bankCommission = parseFloat(casePayout.baseAmount || 0);
    const corporateDsaPercent = parseFloat(casePayout.corporateDsaPercent || 0);
    const corporateDsaAmount = parseFloat(casePayout.corporateDsaAmount || 0);
    const actualAmount = parseFloat(casePayout.actualAmount || Math.max(0, bankCommission - corporateDsaAmount));
    const tdsAmount = parseFloat(casePayout.bankTdsAmount || 0);
    const netReceivable = parseFloat(casePayout.bankNetReceivable || Math.max(0, actualAmount - tdsAmount)); // X Amount
    const gstAmount = parseFloat(casePayout.bankGstAmount || 0); // Y Amount
    const bankReceivedAmount = parseFloat(casePayout.bankReceivedAmount || 0);
    const bankRemainingDue = Math.max(0, netReceivable - bankReceivedAmount);

    return res.status(200).json({
      casePayout,
      calculations: {
        loanAmount,
        bankCommission,
        bankCommissionPercent: parseFloat(casePayout.bankCommissionPercent || 0),
        corporateDsaPercent,
        corporateDsaAmount,
        corporateDsaCommission: corporateDsaAmount,
        actualAmount,
        remainingAfterDsa: actualAmount,
        partyCommissionPercent: parseFloat(casePayout.partyCommissionPercent || 0),
        tdsPercent: parseFloat(casePayout.bankTdsPercent || 0),
        tdsAmount,
        netReceivable, // X Amount: actualAmount - tdsAmount
        gstPercent: parseFloat(casePayout.bankGstPercent || 0),
        gstAmount, // Y Amount: separate, NOT subtracted!
        bankReceivedAmount,
        bankRemainingDue,
        partyNetPayable: parseFloat(casePayout.partyNetPayable || 0),
        partyPaidAmount: parseFloat(casePayout.partyPaidAmount || 0),
        partyRemainingDue: parseFloat(casePayout.partyRemainingDue || 0),
        gstrStatus: casePayout.gstrStatus || "PENDING",
        gstrAmount: parseFloat(casePayout.gstrAmount || gstAmount || 0),
        gstrReceivedAmount: parseFloat(casePayout.gstrReceivedAmount || 0),
      },
      transactions: timeline,
      bankReceipts,
      partyPayments,
    });
  } catch (error) {
    console.error("[casePayoutController] getCasePaymentHistory error:", error);
    return res.status(500).json({ message: "Failed to fetch payment history", error: error.message });
  }
};

exports.autoSyncDisbursedCases = autoSyncDisbursedCases;

