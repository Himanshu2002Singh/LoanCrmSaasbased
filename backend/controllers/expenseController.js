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
  "Client Meeting & Food",
  "Office Maintenance",
  "Marketing & Advertising",
  "Courier & Postage",
  "Mobile Recharge",
  "Staff Welfare",
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
 * Query params: month (YYYY-MM), category, status, search, fromDate, toDate, expenseType, employeeId, page, limit
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
      expenseType,
      employeeId,
      page = 1,
      limit = 50,
    } = req.query;

    const canViewAllExpenses =
      req.user.role === "SUPERADMIN" ||
      req.user.role === "COMPANY_ADMIN" ||
      req.user.role === "FINANCE" ||
      Boolean(req.permissions?.manageExpenses);

    const where = { ...scope };

    // Role-based visibility
    if (!canViewAllExpenses) {
      // Employees, Operations, Sales Managers without full manageExpenses see only their own expenses
      where[Op.or] = [
        { createdById: req.user.id },
        { employeeId: req.user.id },
      ];
    } else {
      // Admin / Finance / Staff with manageExpenses
      if (expenseType && expenseType !== "ALL") {
        where.expenseType = expenseType.toUpperCase();
      }

      if (employeeId && employeeId !== "ALL") {
        const empId = parseInt(employeeId, 10);
        if (!isNaN(empId)) {
          where[Op.or] = [{ employeeId: empId }, { createdById: empId }];
        }
      }
    }

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
      const matchingUsers = await User.findAll({
        where: {
          ...scope,
          name: { [Op.like]: term },
        },
        attributes: ["id"],
        raw: true,
      });
      const matchingUserIds = matchingUsers.map((u) => u.id);

      const searchConditions = [
        { expenseCode: { [Op.like]: term } },
        { vendorName: { [Op.like]: term } },
        { description: { [Op.like]: term } },
        { category: { [Op.like]: term } },
        { remarks: { [Op.like]: term } },
      ];

      if (matchingUserIds.length > 0) {
        searchConditions.push(
          { createdById: { [Op.in]: matchingUserIds } },
          { employeeId: { [Op.in]: matchingUserIds } }
        );
      }

      if (where[Op.or]) {
        where[Op.and] = [{ [Op.or]: where[Op.or] }, { [Op.or]: searchConditions }];
        delete where[Op.or];
      } else {
        where[Op.or] = searchConditions;
      }
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
          attributes: ["id", "name", "email", "role", "phone"],
          required: false,
        },
        {
          model: User,
          as: "employee",
          attributes: ["id", "name", "email", "role", "phone"],
          required: false,
        },
      ],
      order: [["expenseDate", "DESC"], ["id", "DESC"]],
      limit: pageSize,
      offset,
    });

    // Calculate totals across ALL matched records (no include needed to avoid only_full_group_by)
    const allMatches = await Expense.findAll({
      where,
      attributes: [
        [fn("SUM", col("Expense.base_amount")), "totalBase"],
        [fn("SUM", col("Expense.gst_amount")), "totalGst"],
        [fn("SUM", col("Expense.total_amount")), "totalAmount"],
        [fn("SUM", literal("CASE WHEN Expense.status = 'PAID' THEN Expense.total_amount ELSE 0 END")), "totalPaid"],
        [fn("SUM", literal("CASE WHEN Expense.status = 'PENDING' THEN Expense.total_amount ELSE 0 END")), "totalPending"],
        [fn("COUNT", col("Expense.id")), "matchCount"],
      ],
      raw: true,
    });

    const totals = {
      totalBase: parseFloat(allMatches[0]?.totalBase) || 0,
      totalGst: parseFloat(allMatches[0]?.totalGst) || 0,
      totalAmount: parseFloat(allMatches[0]?.totalAmount) || 0,
      totalPaid: parseFloat(allMatches[0]?.totalPaid) || 0,
      totalPending: parseFloat(allMatches[0]?.totalPending) || 0,
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
 *  2. Employee Expenses (Submitted by employees)
 *  3. Employee Salaries (from Users)
 *  4. Employee Incentives (from CasePayout manpower extraCharges with assigned lead employee)
 *  5. Partner / Connector Payouts (from PartyPayment / CasePayouts)
 *  6. Bank Commission Inflow vs Total Outflows
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

    // 1. Office Running Costs (OFFICE expenses)
    const officeExpenses = await Expense.findAll({
      where: {
        ...scope,
        expenseType: "OFFICE",
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

    // 1b. Employee Expenses for target month
    const employeeExpenses = await Expense.findAll({
      where: {
        ...scope,
        expenseType: "EMPLOYEE",
        [Op.or]: [
          { expenseMonth: targetMonth },
          { expenseDate: { [Op.between]: [startOfMonth, endOfMonth] } },
        ],
      },
      include: [
        {
          model: User,
          as: "employee",
          attributes: ["id", "name", "email", "role"],
          required: false,
        },
        {
          model: User,
          as: "createdBy",
          attributes: ["id", "name", "email", "role"],
          required: false,
        },
      ],
    });

    let employeeExpTotal = 0;
    let employeeExpPaid = 0;
    let employeeExpPending = 0;
    const employeeExpUserMap = {};

    for (const exp of employeeExpenses) {
      const tot = parseFloat(exp.totalAmount ?? exp.total_amount) || 0;
      employeeExpTotal += tot;
      if (exp.status === "PAID") {
        employeeExpPaid += tot;
      } else {
        employeeExpPending += tot;
      }

      const emp = exp.employee || exp.createdBy;
      const empId = emp ? emp.id : 0;
      const empName = emp ? emp.name : "Unassigned";
      const empRole = emp ? emp.role : "EMPLOYEE";
      const empEmail = emp ? emp.email : "";

      if (!employeeExpUserMap[empId]) {
        employeeExpUserMap[empId] = {
          employeeId: empId,
          name: empName,
          role: empRole,
          email: empEmail,
          totalAmount: 0,
          paidAmount: 0,
          pendingAmount: 0,
          count: 0,
        };
      }
      employeeExpUserMap[empId].totalAmount += tot;
      if (exp.status === "PAID") {
        employeeExpUserMap[empId].paidAmount += tot;
      } else {
        employeeExpUserMap[empId].pendingAmount += tot;
      }
      employeeExpUserMap[empId].count += 1;
    }

    const employeeExpensesBreakdown = Object.values(employeeExpUserMap).sort(
      (a, b) => b.totalAmount - a.totalAmount
    );

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

    const totalPartyPayout = Math.max(totalDirectPartyPayments, totalPartyPayoutsFromCases);

    // 5. Grand Totals
    const grandTotalExpenses =
      officeGrandTotal + employeeExpTotal + totalStaffSalary + totalStaffIncentives + totalPartyPayout;

    const netProfitOrLoss = totalBankCommissionReceived - grandTotalExpenses;

    // 4b. Existing Salary Expense records for this month
    const salaryExpenses = await Expense.findAll({
      where: {
        ...scope,
        category: "Salary",
        expenseMonth: targetMonth,
      },
      raw: true,
    });

    const salaryExpenseMap = {};
    for (const se of salaryExpenses) {
      const empId = se.employeeId ?? se.employee_id;
      if (empId) {
        salaryExpenseMap[empId] = se;
      }
    }

    let staffSalariesPaid = 0;
    let staffSalariesPending = 0;
    let staffPaidCount = 0;
    let staffPendingCount = 0;

    for (const emp of Object.values(employeeCostMap)) {
      const se = salaryExpenseMap[emp.id];
      const status = se ? se.status : "PENDING";
      emp.salaryStatus = status;
      emp.salaryExpenseId = se ? se.id : null;
      emp.paymentMode = se ? (se.paymentMode ?? se.payment_mode ?? "Net Banking") : "Net Banking";
      emp.paidDate = se && se.status === "PAID" ? (se.expenseDate ?? se.expense_date) : null;
      emp.salaryRemarks = se ? se.remarks : "";

      if (status === "PAID") {
        staffSalariesPaid += emp.totalPayable;
        staffPaidCount += 1;
      } else {
        staffSalariesPending += emp.totalPayable;
        staffPendingCount += 1;
      }
    }

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
        employeeExpensesTotal: employeeExpTotal,
        employeeExpensesPaid: employeeExpPaid,
        employeeExpensesPending: employeeExpPending,
        employeeExpenseCount: employeeExpenses.length,
        staffSalaries: totalStaffSalary,
        staffIncentives: totalStaffIncentives,
        staffTotalCost: totalStaffSalary + totalStaffIncentives,
        staffSalariesPaid,
        staffSalariesPending,
        staffPaidCount,
        staffPendingCount,
        partnerPayouts: totalPartyPayout,
        bankCommissionReceived: totalBankCommissionReceived,
        totalLoanDisbursed,
        netProfitOrLoss,
        employeeCount: employees.length,
        officeExpenseCount: officeExpenses.length,
        disbursedCaseCount: casePayouts.length,
      },
      officeCategoryBreakdown,
      employeeExpensesSummary: {
        totalAmount: employeeExpTotal,
        paidAmount: employeeExpPaid,
        pendingAmount: employeeExpPending,
        count: employeeExpenses.length,
      },
      employeeExpensesBreakdown,
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
 * Submits an expense: Office Expense or Employee Expense
 */
exports.createExpense = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const isAdminOrManager =
      req.user.role === "SUPERADMIN" ||
      req.user.role === "COMPANY_ADMIN" ||
      Boolean(req.permissions?.manageExpenses);

    const {
      expenseDate,
      category,
      vendorName,
      description,
      amount,
      baseAmount,
      gstPercent,
      paymentMode,
      status,
      remarks,
      expenseType: requestedType,
      employeeId: requestedEmployeeId,
    } = req.body;

    const chosenDate = expenseDate || new Date().toISOString().slice(0, 10);
    const dateStr = String(chosenDate).slice(0, 10);
    const monthStr = dateStr.slice(0, 7);

    // Accept either baseAmount or amount
    const rawAmount = baseAmount !== undefined ? baseAmount : amount;
    const base = Math.max(0, parseFloat(rawAmount) || 0);
    const gstPct = Math.max(0, parseFloat(gstPercent) || 0);
    const gstAmt = Math.round(base * (gstPct / 100) * 100) / 100;
    const total = Math.round((base + gstAmt) * 100) / 100;

    // Determine expenseType and employeeId
    let finalExpenseType = "EMPLOYEE";
    let finalEmployeeId = req.user.id;

    if (isAdminOrManager) {
      if (requestedType === "OFFICE") {
        finalExpenseType = "OFFICE";
        finalEmployeeId = null;
      } else if (requestedType === "EMPLOYEE") {
        finalExpenseType = "EMPLOYEE";
        finalEmployeeId = requestedEmployeeId ? parseInt(requestedEmployeeId, 10) : req.user.id;
      } else {
        finalExpenseType = requestedEmployeeId ? "EMPLOYEE" : "OFFICE";
        finalEmployeeId = requestedEmployeeId ? parseInt(requestedEmployeeId, 10) : null;
      }
    } else {
      // Normal employee / sales manager / operations always records EMPLOYEE expense
      finalExpenseType = "EMPLOYEE";
      finalEmployeeId = req.user.id;
    }

    // Generate readable code e.g. EXP-EMP-202609-001 or EXP-202609-001
    const countThisMonth = await Expense.count({
      where: { companyId, expenseMonth: monthStr },
    });
    const suffix = String(countThisMonth + 1).padStart(3, "0");
    const prefix = finalExpenseType === "EMPLOYEE" ? "EXP-EMP" : "EXP";
    const expenseCode = `${prefix}-${monthStr.replace("-", "")}-${suffix}`;

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
      amount: total,
      paymentMode: paymentMode || "UPI",
      status: (status || "PAID").toUpperCase(),
      remarks: remarks ? String(remarks).trim() : "",
      createdById: req.user.id || null,
      expenseType: finalExpenseType,
      employeeId: finalEmployeeId,
    });

    const created = await Expense.findByPk(expense.id, {
      include: [
        { model: User, as: "createdBy", attributes: ["id", "name", "email", "role", "phone"], required: false },
        { model: User, as: "employee", attributes: ["id", "name", "email", "role", "phone"], required: false },
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
    const isAdminOrManager =
      req.user.role === "SUPERADMIN" ||
      req.user.role === "COMPANY_ADMIN" ||
      Boolean(req.permissions?.manageExpenses);

    const expense = await Expense.findOne({
      where: { id: req.params.id, ...scope },
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense record not found" });
    }

    // Non-admin can only update their own expense
    if (!isAdminOrManager) {
      if (expense.createdById !== req.user.id && expense.employeeId !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to edit this expense" });
      }
    }

    const {
      expenseDate,
      category,
      vendorName,
      description,
      amount,
      baseAmount,
      gstPercent,
      paymentMode,
      status,
      remarks,
      expenseType,
      employeeId,
    } = req.body;

    const dateStr = expenseDate !== undefined ? String(expenseDate).slice(0, 10) : expense.expenseDate;
    const monthStr = dateStr.slice(0, 7);

    const rawAmount = baseAmount !== undefined ? baseAmount : amount;
    const base = rawAmount !== undefined ? Math.max(0, parseFloat(rawAmount) || 0) : parseFloat(expense.baseAmount) || 0;
    const gstPct = gstPercent !== undefined ? Math.max(0, parseFloat(gstPercent) || 0) : parseFloat(expense.gstPercent) || 0;
    const gstAmt = Math.round(base * (gstPct / 100) * 100) / 100;
    const total = Math.round((base + gstAmt) * 100) / 100;

    const updatePayload = {
      expenseDate: dateStr,
      expenseMonth: monthStr,
      category: category !== undefined ? String(category).trim() : expense.category,
      vendorName: vendorName !== undefined ? String(vendorName).trim() : expense.vendorName,
      description: description !== undefined ? String(description).trim() : expense.description,
      baseAmount: base,
      gstPercent: gstPct,
      gstAmount: gstAmt,
      totalAmount: total,
      amount: total,
      paymentMode: paymentMode !== undefined ? paymentMode : expense.paymentMode,
      status: status !== undefined ? String(status).toUpperCase() : expense.status,
      remarks: remarks !== undefined ? String(remarks).trim() : expense.remarks,
    };

    if (isAdminOrManager) {
      if (expenseType !== undefined) updatePayload.expenseType = expenseType;
      if (employeeId !== undefined) updatePayload.employeeId = employeeId ? parseInt(employeeId, 10) : null;
    }

    await expense.update(updatePayload);

    const updated = await Expense.findByPk(expense.id, {
      include: [
        { model: User, as: "createdBy", attributes: ["id", "name", "email", "role", "phone"], required: false },
        { model: User, as: "employee", attributes: ["id", "name", "email", "role", "phone"], required: false },
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
    const isAdminOrManager =
      req.user.role === "SUPERADMIN" ||
      req.user.role === "COMPANY_ADMIN" ||
      Boolean(req.permissions?.manageExpenses) ||
      Boolean(req.permissions?.deleteRecords);

    const expense = await Expense.findOne({
      where: { id: req.params.id, ...scope },
    });

    if (!expense) {
      return res.status(404).json({ message: "Expense record not found" });
    }

    if (!isAdminOrManager) {
      if (expense.createdById !== req.user.id && expense.employeeId !== req.user.id) {
        return res.status(403).json({ message: "You are not authorized to delete this expense" });
      }
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

/**
 * POST /api/expenses/salary-status
 * Update employee salary payment status (PAID / PENDING)
 * Supports both single employee update and bulk selection
 */
exports.updateSalaryStatus = async (req, res) => {
  try {
    const { employeeIds, status, month, paymentMode } = req.body;

    if (!Array.isArray(employeeIds) || employeeIds.length === 0) {
      return res.status(400).json({ success: false, message: "Please select at least one employee" });
    }

    const targetStatus = (status || "").toUpperCase();
    if (targetStatus !== "PAID" && targetStatus !== "PENDING") {
      return res.status(400).json({ success: false, message: "Status must be PAID or PENDING" });
    }

    const targetMonth = getMonthStr(month);
    const scope = companyScope(req);
    const companyId = req.user?.companyId || 1;

    // Fetch the target employees
    const employees = await User.findAll({
      where: {
        ...scope,
        id: { [Op.in]: employeeIds },
      },
      attributes: ["id", "name", "email", "salary", "companyId"],
    });

    if (!employees || employees.length === 0) {
      return res.status(404).json({ success: false, message: "No valid employees found" });
    }

    const today = new Date().toISOString().slice(0, 10);
    const updatedRecords = [];

    for (const emp of employees) {
      const sal = parseFloat(emp.salary) || 0;

      // Check if an expense record already exists for this employee + month + category: "Salary"
      let record = await Expense.findOne({
        where: {
          ...scope,
          category: "Salary",
          expenseMonth: targetMonth,
          employeeId: emp.id,
        },
      });

      if (record) {
        record.status = targetStatus;
        if (paymentMode) {
          record.paymentMode = paymentMode;
        }
        if (targetStatus === "PAID") {
          record.expenseDate = record.expenseDate || today;
        }
        record.remarks = `Salary marked as ${targetStatus} by ${req.user.name || "Admin"} on ${today}`;
        await record.save();
        updatedRecords.push(record);
      } else {
        record = await Expense.create({
          companyId: emp.companyId || companyId,
          expenseCode: `SAL-${targetMonth.replace("-", "")}-${emp.id}`,
          expenseDate: today,
          expenseMonth: targetMonth,
          category: "Salary",
          expenseType: "SALARY",
          employeeId: emp.id,
          vendorName: emp.name,
          title: `Salary - ${emp.name} (${targetMonth})`,
          amount: sal,
          baseAmount: sal,
          gstPercent: 0,
          gstAmount: 0,
          totalAmount: sal,
          paymentMode: paymentMode || "Net Banking",
          status: targetStatus,
          createdById: req.user.id,
          remarks: `Salary marked as ${targetStatus} by ${req.user.name || "Admin"} on ${today}`,
        });
        updatedRecords.push(record);
      }
    }

    return res.status(200).json({
      success: true,
      message: `Updated ${updatedRecords.length} staff salary status to ${targetStatus}`,
      status: targetStatus,
      month: targetMonth,
      count: updatedRecords.length,
    });
  } catch (error) {
    console.error("[expenses] updateSalaryStatus error:", error);
    return res.status(500).json({ success: false, message: "Internal server error", error: error.message });
  }
};

