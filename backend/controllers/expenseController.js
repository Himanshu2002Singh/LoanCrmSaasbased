const { Op, fn, col, literal } = require("sequelize");
const { Expense, User, CasePayout, Lead, PartyPayment, BankReceipt } = require("../models");
const { companyScope } = require("../middlewares/auth");

const DEFAULT_CATEGORIES = [
  "Office Rent",
  "Electricity & Utility",
  "Tea, Coffee & Pantry",
  "Internet & Phone",
  "Software & Subscriptions",
  "Stationery & Printing",
  "Travel & Fuel",
  "Office Maintenance",
  "Marketing & Advertising",
  "Legal & Accounting",
  "Miscellaneous",
];

const getMonthStr = (dateInput) => {
  if (!dateInput) {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  }
  const str = String(dateInput).slice(0, 7);
  return str.length === 7 ? str : new Date().toISOString().slice(0, 7);
};

/**
 * GET /api/expenses
 * Query params: month (YYYY-MM), category, status, search, fromDate, toDate, page, limit
 */
exports.getExpenses = async (req, res) => {
  try {
    const scope = companyScope(req);
    const {
      month,
      category,
      status,
      search,
      fromDate,
      toDate,
      page = 1,
      limit = 50,
    } = req.query;

    const where = { ...scope };

    if (month && month !== "ALL") {
      where.expenseMonth = month;
    }

    if (category && category !== "ALL") {
      where.category = category;
    }

    if (status && status !== "ALL") {
      where.status = status.toUpperCase();
    }

    if (fromDate && toDate) {
      where.expenseDate = { [Op.between]: [fromDate, toDate] };
    } else if (fromDate) {
      where.expenseDate = { [Op.gte]: fromDate };
    } else if (toDate) {
      where.expenseDate = { [Op.lte]: toDate };
    }

    if (search && search.trim()) {
      const term = `%${search.trim()}%`;
      where[Op.or] = [
        { expenseCode: { [Op.like]: term } },
        { vendorName: { [Op.like]: term } },
        { description: { [Op.like]: term } },
        { category: { [Op.like]: term } },
        { remarks: { [Op.like]: term } },
      ];
    }

    const pageNum = Math.max(1, parseInt(page, 10) || 1);
    const pageSize = Math.min(200, Math.max(1, parseInt(limit, 10) || 50));
    const offset = (pageNum - 1) * pageSize;

    const { count, rows } = await Expense.findAndCountAll({
      where,
      include: [
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "name", "email"],
          required: false,
        },
      ],
      order: [["expenseDate", "DESC"], ["id", "DESC"]],
      limit: pageSize,
      offset,
    });

    // Calculate totals across ALL matched records (not just this page)
    const allMatches = await Expense.findAll({
      where,
      attributes: [
        [fn("SUM", col("base_amount")), "totalBase"],
        [fn("SUM", col("gst_amount")), "totalGst"],
        [fn("SUM", col("total_amount")), "totalAmount"],
        [fn("COUNT", col("id")), "matchCount"],
      ],
      raw: true,
    });

    const totals = {
      totalBase: parseFloat(allMatches[0]?.totalBase) || 0,
      totalGst: parseFloat(allMatches[0]?.totalGst) || 0,
      totalAmount: parseFloat(allMatches[0]?.totalAmount) || 0,
      totalCount: parseInt(allMatches[0]?.matchCount, 10) || count,
    };

    return res.status(200).json({
      success: true,
      data: rows,
      totals,
      pagination: {
        page: pageNum,
        limit: pageSize,
        total: count,
        totalPages: Math.ceil(count / pageSize) || 1,
      },
    });
  } catch (error) {
    console.error("[expenses] getExpenses error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * GET /api/expenses/summary
 * Master Monthly Overview:
 *  1. Office Running Costs (Expenses)
 *  2. Employee Salaries (from Users)
 *  3. Employee Incentives (from CasePayout manpower extraCharges with assigned lead employee)
 *  4. Partner / Connector Payouts (from PartyPayment / CasePayouts)
 *  5. Bank Commission Inflow vs Total Outflows
 */
exports.getExpenseSummary = async (req, res) => {
  try {
    const scope = companyScope(req);
    const targetMonth = getMonthStr(req.query.month); // e.g. "2026-09"
    const [yearStr, monthNumStr] = targetMonth.split("-");
    const year = parseInt(yearStr, 10);
    const monthIndex = parseInt(monthNumStr, 10) - 1;

    // Start & End of target month (DATE strings)
    const startOfMonth = `${targetMonth}-01`;
    const lastDay = new Date(year, monthIndex + 1, 0).getDate();
    const endOfMonth = `${targetMonth}-${String(lastDay).padStart(2, "0")}`;

    // 1. Office Running Costs
    const officeExpenses = await Expense.findAll({
      where: {
        ...scope,
        [Op.or]: [
          { expenseMonth: targetMonth },
          { expenseDate: { [Op.between]: [startOfMonth, endOfMonth] } },
        ],
      },
      raw: true,
    });

    let officeBaseTotal = 0;
    let officeGstTotal = 0;
    let officeGrandTotal = 0;
    const categoryMap = {};

    for (const exp of officeExpenses) {
      const base = parseFloat(exp.baseAmount ?? exp.base_amount) || 0;
      const gst = parseFloat(exp.gstAmount ?? exp.gst_amount) || 0;
      const tot = parseFloat(exp.totalAmount ?? exp.total_amount) || 0;
      officeBaseTotal += base;
      officeGstTotal += gst;
      officeGrandTotal += tot;

      const cat = exp.category || "Miscellaneous";
      if (!categoryMap[cat]) {
        categoryMap[cat] = { category: cat, count: 0, amount: 0 };
      }
      categoryMap[cat].count += 1;
      categoryMap[cat].amount += tot;
    }

    const officeCategoryBreakdown = Object.values(categoryMap).sort((a, b) => b.amount - a.amount);

    // 2. Active Employees & Base Salaries
    const employees = await User.findAll({
      where: {
        ...scope,
        role: { [Op.ne]: "SUPERADMIN" },
        status: "active",
      },
      attributes: ["id", "name", "email", "phone", "role", "salary"],
      raw: true,
    });

    let totalStaffSalary = 0;
    const employeeCostMap = {};
    for (const emp of employees) {
      const sal = parseFloat(emp.salary) || 0;
      totalStaffSalary += sal;
      employeeCostMap[emp.id] = {
        id: emp.id,
        name: emp.name,
        email: emp.email,
        phone: emp.phone,
        role: emp.role,
        monthlySalary: sal,
        incentiveCount: 0,
        totalIncentive: 0,
        totalPayable: sal,
      };
    }

    // 3. Employee Incentives (from CasePayout manpower / extraCharges in this month)
    const casePayouts = await CasePayout.findAll({
      where: {
        ...scope,
        [Op.or]: [
          { disbursalDate: { [Op.between]: [startOfMonth, endOfMonth] } },
          { invoiceDate: { [Op.between]: [startOfMonth, endOfMonth] } },
        ],
      },
      include: [
        {
          model: Lead,
          as: "lead",
          attributes: ["id", "assignedEmployeeId", "leadSource"],
          include: [
            {
              model: User,
              as: "assignedEmployee",
              attributes: ["id", "name", "email", "salary"],
              required: false,
            },
          ],
          required: false,
        },
      ],
    });

    let totalStaffIncentives = 0;
    let totalPartyPayoutsFromCases = 0;
    let totalBankCommissionReceived = 0;
    let totalLoanDisbursed = 0;
    const incentiveCases = [];

    for (const cp of casePayouts) {
      const extra = parseFloat(cp.extraCharges) || 0;
      const partyNet = parseFloat(cp.partyNetPayable) || 0;
      const bankRec = parseFloat(cp.bankReceivedAmount) || 0;
      const loanAmt = parseFloat(cp.loanAmount) || 0;

      totalStaffIncentives += extra;
      totalPartyPayoutsFromCases += partyNet;
      totalBankCommissionReceived += bankRec;
      totalLoanDisbursed += loanAmt;

      const assignedEmp = cp.lead?.assignedEmployee;
      const empId = assignedEmp?.id || cp.lead?.assignedEmployeeId;

      if (empId && employeeCostMap[empId]) {
        employeeCostMap[empId].incentiveCount += 1;
        employeeCostMap[empId].totalIncentive += extra;
        employeeCostMap[empId].totalPayable += extra;
      }

      if (extra > 0 || cp.loanAmount > 0) {
        incentiveCases.push({
          caseId: cp.id,
          customerName: cp.customerName,
          loanProduct: cp.loanProduct,
          bankName: cp.bankName,
          disbursalDate: cp.disbursalDate,
          loanAmount: loanAmt,
          baseAmount: parseFloat(cp.baseAmount) || 0,
          employeeId: empId || null,
          employeeName: assignedEmp?.name || "Direct / Admin",
          incentiveAmount: extra,
          partyName: cp.partyName,
          partyNetPayable: partyNet,
        });
      }
    }

    // 4. Partner Payments recorded directly in PartyPayment table for this month
    const partyPayments = await PartyPayment.findAll({
      where: {
        ...scope,
        paymentDate: { [Op.between]: [startOfMonth, endOfMonth] },
      },
      raw: true,
    });

    let totalDirectPartyPayments = 0;
    for (const pp of partyPayments) {
      totalDirectPartyPayments += parseFloat(pp.amount) || 0;
    }

    // If direct party payments are logged, use them or take the max of recorded payments vs case dues
    const totalPartyPayout = Math.max(totalDirectPartyPayments, totalPartyPayoutsFromCases);

    // 5. Grand Totals
    const grandTotalExpenses =
      officeGrandTotal + totalStaffSalary + totalStaffIncentives + totalPartyPayout;

    const netProfitOrLoss = totalBankCommissionReceived - grandTotalExpenses;

    const staffBreakdown = Object.values(employeeCostMap).sort(
      (a, b) => b.totalPayable - a.totalPayable
    );

    return res.status(200).json({
      success: true,
      month: targetMonth,
      dateRange: { start: startOfMonth, end: endOfMonth },
      summary: {
        grandTotalExpenses,
        officeRunningCosts: officeGrandTotal,
        officeBaseTotal,
        officeGstTotal,
        staffSalaries: totalStaffSalary,
        staffIncentives: totalStaffIncentives,
        staffTotalCost: totalStaffSalary + totalStaffIncentives,
        partnerPayouts: totalPartyPayout,
        bankCommissionReceived: totalBankCommissionReceived,
        totalLoanDisbursed,
        netProfitOrLoss,
        employeeCount: employees.length,
        officeExpenseCount: officeExpenses.length,
        disbursedCaseCount: casePayouts.length,
      },
      officeCategoryBreakdown,
      staffBreakdown,
      incentiveCases,
    });
  } catch (error) {
    console.error("[expenses] getExpenseSummary error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * POST /api/expenses
 */
exports.createExpense = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const {
      expenseDate,
      category,
      vendorName,
      description,
      baseAmount,
      gstPercent,
      paymentMode,
      status,
      remarks,
    } = req.body;

    if (!expenseDate) {
      return res.status(400).json({ message: "expenseDate is required" });
    }

    const dateStr = String(expenseDate).slice(0, 10);
    const monthStr = dateStr.slice(0, 7);

    const base = Math.max(0, parseFloat(baseAmount) || 0);
    const gstPct = Math.max(0, parseFloat(gstPercent) || 0);
    const gstAmt = Math.round(base * (gstPct / 100) * 100) / 100;
    const total = Math.round((base + gstAmt) * 100) / 100;

    // Generate readable code e.g. EXP-202609-001
    const countThisMonth = await Expense.count({
      where: { companyId, expenseMonth: monthStr },
    });
    const suffix = String(countThisMonth + 1).padStart(3, "0");
    const expenseCode = `EXP-${monthStr.replace("-", "")}-${suffix}`;

    const expense = await Expense.create({
      companyId,
      expenseCode,
      expenseDate: dateStr,
      expenseMonth: monthStr,
      category: category ? String(category).trim() : "Miscellaneous",
      vendorName: vendorName ? String(vendorName).trim() : "",
      description: description ? String(description).trim() : "",
      baseAmount: base,
      gstPercent: gstPct,
      gstAmount: gstAmt,
      totalAmount: total,
      paymentMode: paymentMode || "UPI",
      status: (status || "PAID").toUpperCase(),
      remarks: remarks ? String(remarks).trim() : "",
      createdById: req.user.id || null,
    });

    const created = await Expense.findByPk(expense.id, {
      include: [
        { model: User, as: "createdBy", attributes: ["id", "name", "email"], required: false },
      ],
    });

    return res.status(201).json({
      success: true,
      message: "Expense recorded successfully",
      data: created,
    });
  } catch (error) {
    console.error("[expenses] createExpense error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * PUT /api/expenses/:id
 */
exports.updateExpense = async (req, res) => {
  try {
    const scope = companyScope(req);
    const expense = await Expense.findOne({
      where: { id: req.params.id, ...scope },
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense record not found" });
    }

    const {
      expenseDate,
      category,
      vendorName,
      description,
      baseAmount,
      gstPercent,
      paymentMode,
      status,
      remarks,
    } = req.body;

    const dateStr = expenseDate !== undefined ? String(expenseDate).slice(0, 10) : expense.expenseDate;
    const monthStr = dateStr.slice(0, 7);

    const base = baseAmount !== undefined ? Math.max(0, parseFloat(baseAmount) || 0) : parseFloat(expense.baseAmount) || 0;
    const gstPct = gstPercent !== undefined ? Math.max(0, parseFloat(gstPercent) || 0) : parseFloat(expense.gstPercent) || 0;
    const gstAmt = Math.round(base * (gstPct / 100) * 100) / 100;
    const total = Math.round((base + gstAmt) * 100) / 100;

    await expense.update({
      expenseDate: dateStr,
      expenseMonth: monthStr,
      category: category !== undefined ? String(category).trim() : expense.category,
      vendorName: vendorName !== undefined ? String(vendorName).trim() : expense.vendorName,
      description: description !== undefined ? String(description).trim() : expense.description,
      baseAmount: base,
      gstPercent: gstPct,
      gstAmount: gstAmt,
      totalAmount: total,
      paymentMode: paymentMode !== undefined ? paymentMode : expense.paymentMode,
      status: status !== undefined ? String(status).toUpperCase() : expense.status,
      remarks: remarks !== undefined ? String(remarks).trim() : expense.remarks,
    });

    const updated = await Expense.findByPk(expense.id, {
      include: [
        { model: User, as: "createdBy", attributes: ["id", "name", "email"], required: false },
      ],
    });

    return res.status(200).json({
      success: true,
      message: "Expense updated successfully",
      data: updated,
    });
  } catch (error) {
    console.error("[expenses] updateExpense error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * DELETE /api/expenses/:id
 */
exports.deleteExpense = async (req, res) => {
  try {
    const scope = companyScope(req);
    const expense = await Expense.findOne({
      where: { id: req.params.id, ...scope },
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense record not found" });
    }

    await expense.destroy();
    return res.status(200).json({ success: true, message: "Expense deleted successfully" });
  } catch (error) {
    console.error("[expenses] deleteExpense error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * GET /api/expenses/categories
 */
exports.getCategories = async (req, res) => {
  try {
    const scope = companyScope(req);
    const customCats = await Expense.findAll({
      where: scope,
      attributes: [[fn("DISTINCT", col("category")), "category"]],
      raw: true,
    });

    const set = new Set(DEFAULT_CATEGORIES);
    for (const c of customCats) {
      if (c.category) set.add(c.category);
    }

    return res.status(200).json({
      success: true,
      data: Array.from(set),
    });
  } catch (error) {
    console.error("[expenses] getCategories error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};
