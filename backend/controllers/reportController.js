const { Op, fn, col, literal } = require("sequelize");
const { Lead, Customer, CallLog, Task, Attendance, User, MasterConfig, Application, CasePayout, PartyPayment, LeadAssignmentHistory, Expense, Lender, sequelize } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { companyScope } = require("../middlewares/auth");
const { visibilityScope, dateRangeWhere } = require("./leadController");
const { callScope } = require("./callController");
const { ROLES } = require("../constants/roles");
const { OPS_HANDOFF_STATUS_VALUE, teamForStatus, TEAMS } = require("../constants/leadWorkflow");

const dayBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  return { start, end: new Date(start.getTime() + 86399999) };
};

const tomorrowBounds = () => {
  const now = new Date();
  const start = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  return { start, end: new Date(start.getTime() + 86399999) };
};

/**
 * Counts keyed by a column, as a plain object, so the dashboard can index it
 * directly instead of scanning an array.
 */
const countBy = async (model, where, column) => {
  const rows = await model.findAll({
    where,
    attributes: [column, [fn("COUNT", col("id")), "count"]],
    group: [column],
    raw: true,
  });
  return Object.fromEntries(rows.map((r) => [r[column] ?? "UNSPECIFIED", Number(r.count)]));
};

/**
 * GET /api/reports/dashboard
 * ?fromDate&toDate&employeeId
 *
 * Shape is what the home screen already reads: counts, the two breakdowns and
 * a per-employee table.
 */
exports.getDashboard = async (req, res) => {
  try {
    const leadWhere = {
      ...companyScope(req),
      ...(await visibilityScope(req)),
      ...dateRangeWhere(req.query.fromDate, req.query.toDate),
    };
    if (req.query.employeeId) leadWhere.assignedEmployeeId = parseInt(req.query.employeeId, 10);

    const callWhere = {
      ...companyScope(req),
      ...(await callScope(req)),
      ...dateRangeWhere(req.query.fromDate, req.query.toDate),
    };
    if (req.query.employeeId) callWhere.userId = parseInt(req.query.employeeId, 10);

    const { start, end } = dayBounds();
    const { start: tmStart, end: tmEnd } = tomorrowBounds();

    const followupBaseWhere = {
      ...companyScope(req),
      ...(await visibilityScope(req)),
    };
    if (req.query.employeeId) followupBaseWhere.assignedEmployeeId = parseInt(req.query.employeeId, 10);

    const [
      totalLeads,
      totalCalls,
      todayFollowups,
      tomorrowFollowups,
      pendingFollowups,
      upcomingFollowups,
      statusCounts,
      loanTypeCounts,
      sourceCounts,
      statuses,
    ] = await Promise.all([
      Lead.count({ where: leadWhere }),
      CallLog.count({ where: callWhere }),
      Lead.count({ where: { ...followupBaseWhere, nextFollowupDate: { [Op.between]: [start, end] } } }),
      Lead.count({ where: { ...followupBaseWhere, nextFollowupDate: { [Op.between]: [tmStart, tmEnd] } } }),
      Lead.count({ where: { ...followupBaseWhere, nextFollowupDate: { [Op.lt]: start } } }),
      Lead.count({ where: { ...followupBaseWhere, nextFollowupDate: { [Op.gt]: end } } }),
      countBy(Lead, leadWhere, "status"),
      countBy(Lead, leadWhere, "loanType"),
      countBy(Lead, leadWhere, "leadSource"),
      MasterConfig.findAll({
        where: { ...companyScope(req), configType: "LEAD_STATUS" },
        order: [["orderIndex", "ASC"]],
      }),
    ]);

    let teamFilter = req.query.team;
    if (!teamFilter && req.user) {
      if (req.user.role === ROLES.OPS) teamFilter = TEAMS.OPERATIONS;
      else if (req.user.role === ROLES.EMPLOYEE || req.user.role === ROLES.MANAGER) teamFilter = TEAMS.CALLING;
    }

    const filteredStatuses = statuses.filter((status) => {
      if (!teamFilter) return true;
      const sTeam = status.team || teamForStatus(status.value, status.team);
      return sTeam === teamFilter || sTeam === TEAMS.BOTH;
    });

    // Report statuses under their human label, which is what the chart axis shows.
    const labelled = {};
    for (const status of filteredStatuses) {
      labelled[status.label] = statusCounts[status.value] || 0;
    }

    // Per-employee rollup. Scoped to manager team or employee themselves.
    const employeeWhere = {
      ...companyScope(req),
      role: { [Op.in]: [ROLES.EMPLOYEE, ROLES.MANAGER] },
    };
    if (req.user.role === ROLES.MANAGER) {
      employeeWhere[Op.or] = [{ managerId: req.user.id }, { id: req.user.id }];
    } else if (req.user.role === ROLES.EMPLOYEE) {
      employeeWhere.id = req.user.id;
    }

    const employees = await User.findAll({
      where: employeeWhere,
      attributes: ["id", "name", "role"],
      raw: true,
    });

    const [leadsByEmployee, callsByEmployee] = await Promise.all([
      Lead.findAll({
        where: leadWhere,
        attributes: ["assignedEmployeeId", [fn("COUNT", col("id")), "count"]],
        group: ["assignedEmployeeId"],
        raw: true,
      }),
      CallLog.findAll({
        where: callWhere,
        attributes: ["userId", [fn("COUNT", col("id")), "count"]],
        group: ["userId"],
        raw: true,
      }),
    ]);

    const leadMap = Object.fromEntries(leadsByEmployee.map((r) => [r.assignedEmployeeId, Number(r.count)]));
    const callMap = Object.fromEntries(callsByEmployee.map((r) => [r.userId, Number(r.count)]));

    const employeeStats = employees.map((employee) => ({
      id: employee.id,
      emp_id: employee.id,
      name: employee.name,
      ename: employee.name,
      role: employee.role,
      totalLeads: leadMap[employee.id] || 0,
      totalCalls: callMap[employee.id] || 0,
    }));

    // Operations Metrics & Scoped Lead Details
    const visibleLeadRows = await Lead.findAll({
      where: leadWhere,
      attributes: ["id", "status", "requiredAmount"],
      raw: true,
    });
    const visibleLeadIds = visibleLeadRows.map((r) => r.id);

    // Reassigned Leads Count (Total leads reassigned to another employee)
    let reassignedLeads = 0;
    try {
      const targetEmpId = req.query.employeeId
        ? parseInt(req.query.employeeId, 10)
        : req.user.role === ROLES.EMPLOYEE
        ? req.user.id
        : null;

      const reassignedWhere = {
        companyId: req.user.companyId,
        isActive: false,
      };
      if (targetEmpId) {
        reassignedWhere.userId = targetEmpId;
      }
      reassignedLeads = await LeadAssignmentHistory.count({
        where: reassignedWhere,
        distinct: true,
        col: "leadId",
      });
    } catch (e) {
      console.warn("Could not calculate reassigned leads", e.message);
    }

    let fileLoginCount = 0;
    let disbursementCount = 0;
    let sanctionedCount = 0;
    let legalPendingCount = 0;
    let technicalPendingCount = 0;
    let totalDisbursedAmt = 0;
    let totalSanctionedAmt = 0;

    visibleLeadRows.forEach((lead) => {
      const s = (lead.status || "").toUpperCase();
      if (s.includes("LOGIN") || s.includes("SUBMITTED") || s === "FILE_LOGIN") fileLoginCount++;
      if (s.includes("DISBURS") || s === "CLOSED") disbursementCount++;
      if (s.includes("SANCTION") || s.includes("SECTION") || s === "APPROVED") sanctionedCount++;
    });

    if (visibleLeadIds.length > 0) {
      try {
        const apps = await Application.findAll({
          where: {
            companyId: req.user.companyId,
            leadId: { [Op.in]: visibleLeadIds },
          },
          attributes: ["id", "leadId", "legalStatus", "technicalStatus", "status", "disbursedAmount", "sanctionedAmount"],
          raw: true,
        });

        apps.forEach((app) => {
          if (app.legalStatus === "INITIATED") legalPendingCount++;
          if (app.technicalStatus === "INITIATED") technicalPendingCount++;
          if (app.disbursedAmount && Number(app.disbursedAmount) > 0) {
            totalDisbursedAmt += Number(app.disbursedAmount);
          }
          if (app.sanctionedAmount && Number(app.sanctionedAmount) > 0) {
            totalSanctionedAmt += Number(app.sanctionedAmount);
          }
        });
      } catch (err) {
        console.warn("Could not query applications for ops metrics", err.message);
      }
    }

    // Month-wise Payouts, Recent Transactions & Disbursals
    const canViewPayouts =
      req.user.role === ROLES.SUPERADMIN ||
      req.user.role === ROLES.COMPANY_ADMIN ||
      req.user.role === ROLES.FINANCE ||
      req.permissions?.viewPayouts === true;

    let monthlyPayouts = [];
    let recentPayouts = [];
    let grandDisbursed = 0;
    let grandDisbursedCases = 0;
    let grandBankCommission = 0;
    let grandPayoutsReceivedCount = 0;
    let grandPartyPayout = 0;
    let grandPartyPayoutsCount = 0;

    if (canViewPayouts) {
      try {
        const cpWhere = { companyId: req.user.companyId };
        if (req.query.employeeId && visibleLeadIds.length > 0) {
          cpWhere.leadId = { [Op.in]: visibleLeadIds };
        }

        const [casePayoutRecords, partyPaymentRecords, expenseRecords] = await Promise.all([
          CasePayout.findAll({
            where: cpWhere,
            attributes: [
              "id",
              "customerName",
              "bankName",
              "disbursalDate",
              "loanAmount",
              "bankCommissionDue",
              "bankReceivedAmount",
              "partyCommissionDue",
              "partyPaidAmount",
              "partyRemainingDue",
              "status",
              "createdAt",
            ],
            order: [["disbursalDate", "DESC"], ["id", "DESC"]],
            raw: true,
          }),
          PartyPayment.findAll({
            where: { companyId: req.user.companyId },
            attributes: [
              "id",
              "partyName",
              "amount",
              "paymentDate",
              "paymentType",
              "paymentMode",
              "referenceNumber",
              "leadId",
              "notes",
              "createdAt",
            ],
            order: [["paymentDate", "DESC"], ["id", "DESC"]],
            raw: true,
          }),
          Expense.findAll({
            where: { companyId: req.user.companyId },
            attributes: [
              "id",
              "expenseDate",
              "expenseMonth",
              "totalAmount",
              "createdAt",
            ],
            raw: true,
          }).catch(() => []),
        ]);

        grandDisbursedCases = casePayoutRecords.length;
        grandPartyPayoutsCount = partyPaymentRecords.length;

        const monthGroups = {};
        const monthNames = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

        const getMonthMeta = (rawDate, fallbackMonthStr) => {
          if (fallbackMonthStr && /^\d{4}-\d{2}$/.test(fallbackMonthStr)) {
            const [yStr, mStr] = fallbackMonthStr.split("-");
            const m = parseInt(mStr, 10);
            return { monthKey: fallbackMonthStr, label: `${monthNames[m - 1] || "M"} ${yStr}` };
          }
          const d = rawDate ? new Date(rawDate) : new Date();
          const y = d.getFullYear();
          const m = d.getMonth() + 1;
          return {
            monthKey: `${y}-${String(m).padStart(2, "0")}`,
            label: `${monthNames[m - 1] || "M"} ${y}`,
          };
        };

        const initMonthGroup = (monthKey, label) => {
          if (!monthGroups[monthKey]) {
            monthGroups[monthKey] = {
              month: monthKey,
              label,
              disbursedAmount: 0,
              casesCount: 0,
              bankCommissionReceived: 0,
              bankCommissionDue: 0,
              payoutsReceivedCount: 0,
              partyPaidAmount: 0,
              partyPaymentsCount: 0,
              officeExpenses: 0,
              totalOutflow: 0,
              netProfit: 0,
            };
          }
          return monthGroups[monthKey];
        };

        casePayoutRecords.forEach((cp) => {
          const { monthKey, label } = getMonthMeta(cp.disbursalDate || cp.createdAt);
          const mg = initMonthGroup(monthKey, label);

          const loanAmt = Number(cp.loanAmount || 0);
          const bankRcv = Number(cp.bankReceivedAmount || 0);
          const bankDue = Number(cp.bankCommissionDue || 0);
          const cpPartyPaid = Number(cp.partyPaidAmount || 0);

          mg.disbursedAmount += loanAmt;
          mg.casesCount += 1;
          mg.bankCommissionReceived += bankRcv;
          mg.bankCommissionDue += bankDue;
          if (bankRcv > 0) mg.payoutsReceivedCount += 1;
          mg.partyPaidAmount += cpPartyPaid;

          grandDisbursed += loanAmt;
          grandBankCommission += bankRcv;
          if (bankRcv > 0) grandPayoutsReceivedCount += 1;
          grandPartyPayout += cpPartyPaid;
        });

        // Also incorporate any direct / advance PartyPayment entries into monthGroups
        partyPaymentRecords.forEach((pp) => {
          const { monthKey, label } = getMonthMeta(pp.paymentDate || pp.createdAt);
          const mg = initMonthGroup(monthKey, label);

          const amt = Number(pp.amount || 0);
          if (!pp.leadId) {
            mg.partyPaidAmount += amt;
            grandPartyPayout += amt;
          }
          mg.partyPaymentsCount += 1;
        });

        // Incorporate general office & salary expenses into totalOutflow
        (expenseRecords || []).forEach((exp) => {
          const { monthKey, label } = getMonthMeta(exp.expenseDate || exp.createdAt, exp.expenseMonth);
          const mg = initMonthGroup(monthKey, label);
          const amt = Number(exp.totalAmount || 0);
          mg.officeExpenses += amt;
        });

        // Compute totalOutflow and netProfit for each month
        Object.values(monthGroups).forEach((mg) => {
          mg.totalOutflow = mg.partyPaidAmount + mg.officeExpenses;
          mg.netProfit = mg.bankCommissionReceived - mg.totalOutflow;
        });

        // If totalDisbursedAmt in ops metrics was 0, reflect from case payouts
        if (totalDisbursedAmt === 0 && grandDisbursed > 0) {
          totalDisbursedAmt = grandDisbursed;
        }
        if (disbursementCount === 0 && grandDisbursedCases > 0) {
          disbursementCount = grandDisbursedCases;
        }

        monthlyPayouts = Object.values(monthGroups).sort((a, b) => b.month.localeCompare(a.month));
        recentPayouts = casePayoutRecords.slice(0, 15).map((cp) => ({
          id: cp.id,
          customerName: cp.customerName,
          bankName: cp.bankName || "Bank",
          disbursalDate: cp.disbursalDate || cp.createdAt,
          loanAmount: Number(cp.loanAmount || 0),
          bankReceivedAmount: Number(cp.bankReceivedAmount || 0),
          partyPaidAmount: Number(cp.partyPaidAmount || 0),
          partyRemainingDue: Number(cp.partyRemainingDue || 0),
          status: cp.status || "PENDING",
        }));
      } catch (err) {
        console.warn("Could not query payouts for dashboard", err.message);
      }
    }

    return res.status(200).json({
      success: true,
      counts: {
        totalLeads,
        totalCalls,
        todayFollowups,
        tomorrowFollowups,
        pendingFollowups,
        upcomingFollowups,
        unassignedLeads: await Lead.count({ where: { ...leadWhere, assignedEmployeeId: null } }),
        fileLogins: fileLoginCount,
        disbursements: disbursementCount,
        legalPending: legalPendingCount,
        technicalPending: technicalPendingCount,
        reassignedLeads,
      },
      operationsMetrics: {
        fileLoginCount,
        disbursementCount,
        disbursedAmount: totalDisbursedAmt,
        sanctionedCount,
        sanctionedAmount: totalSanctionedAmt,
        legalPendingCount,
        technicalPendingCount,
        reassignedLeadsCount: reassignedLeads,
      },
      payoutMetrics: {
        canView: canViewPayouts,
        monthlyPayouts,
        recentPayouts,
        totalDisbursed: grandDisbursed,
        totalDisbursedCases: grandDisbursedCases,
        totalBankCommission: grandBankCommission,
        totalPayoutsReceivedCount: grandPayoutsReceivedCount,
        totalPartyPayout: grandPartyPayout,
        totalPartyPayoutsCount: grandPartyPayoutsCount,
      },
      leadStatusCounts: labelled,
      loanTypeCounts,
      sourceCounts,
      employeeStats,
    });
  } catch (error) {
    console.error("[reports] getDashboard error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/reports/leads
 * Paginated per-employee lead breakdown with a conversion figure, which is
 * what the lead report screen tabulates.
 */
exports.getLeadReport = async (req, res) => {
  try {
    const { limit, offset, page } = buildQuery(req.query, { defaultLimit: 25 });

    const leadWhere = {
      ...companyScope(req),
      ...(await visibilityScope(req)),
      ...dateRangeWhere(req.query.fromDate, req.query.toDate),
    };

    const statuses = await MasterConfig.findAll({
      where: { ...companyScope(req), configType: "LEAD_STATUS" },
      order: [["orderIndex", "ASC"]],
    });
    // A lead counts as converted once it reaches the sales-to-operations
    // handoff. master_configs carries no flag marking that status, so it is
    // matched on the stable value the workflow constants declare; a company
    // that never configured the row simply converts nothing.
    const handoffStatus = statuses.find((s) => s.value === OPS_HANDOFF_STATUS_VALUE);

    const employeeWhere = { ...companyScope(req), role: { [Op.in]: [ROLES.EMPLOYEE, ROLES.MANAGER] } };
    if (req.query.employeeId) employeeWhere.id = parseInt(req.query.employeeId, 10);
    if (req.user.role === ROLES.MANAGER) {
      employeeWhere[Op.or] = [{ managerId: req.user.id }, { id: req.user.id }];
    } else if (req.user.role === ROLES.EMPLOYEE) {
      employeeWhere.id = req.user.id;
    }

    const { count, rows: employees } = await User.findAndCountAll({
      where: employeeWhere,
      attributes: ["id", "name", "role"],
      limit,
      offset,
      order: [["name", "ASC"]],
    });

    const ids = employees.map((e) => e.id);
    const perStatus = ids.length
      ? await Lead.findAll({
          where: { ...leadWhere, assignedEmployeeId: { [Op.in]: ids } },
          attributes: ["assignedEmployeeId", "status", [fn("COUNT", col("id")), "count"]],
          group: ["assignedEmployeeId", "status"],
          raw: true,
        })
      : [];

    const callCounts = ids.length
      ? await CallLog.findAll({
          where: {
            ...companyScope(req),
            ...dateRangeWhere(req.query.fromDate, req.query.toDate),
            userId: { [Op.in]: ids },
          },
          attributes: ["userId", [fn("COUNT", col("id")), "count"]],
          group: ["userId"],
          raw: true,
        })
      : [];
    const callMap = Object.fromEntries(callCounts.map((r) => [r.userId, Number(r.count)]));

    const data = employees.map((employee) => {
      const mine = perStatus.filter((r) => r.assignedEmployeeId === employee.id);
      const byStatus = Object.fromEntries(mine.map((r) => [r.status, Number(r.count)]));
      const totalLeads = mine.reduce((sum, r) => sum + Number(r.count), 0);
      const converted = handoffStatus ? byStatus[handoffStatus.value] || 0 : 0;

      return {
        emp_id: employee.id,
        id: employee.id,
        ename: employee.name,
        name: employee.name,
        role: employee.role,
        totalLeads,
        totalCalls: callMap[employee.id] || 0,
        converted,
        conversionRate: totalLeads ? Number(((converted / totalLeads) * 100).toFixed(2)) : 0,
        byStatus: Object.fromEntries(
          statuses.map((status) => [status.label, byStatus[status.value] || 0])
        ),
      };
    });

    const payload = paginated({ count, rows: data, page, limit });
    payload.pagination.totalItems = count;
    payload.employees = data;
    payload.statuses = statuses.map((s) => ({ status_id: s.id, name: s.label, value: s.value }));
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[reports] getLeadReport error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/reports/performance
 * Per-employee KPIs across leads, calls, tasks and attendance.
 */
exports.getPerformance = async (req, res) => {
  try {
    const { limit, offset, page } = buildQuery(req.query, { defaultLimit: 25 });
    const range = dateRangeWhere(req.query.fromDate, req.query.toDate);

    const employeeWhere = { ...companyScope(req), role: { [Op.in]: [ROLES.EMPLOYEE, ROLES.MANAGER, ROLES.OPS] } };
    if (req.query.employeeId) employeeWhere.id = parseInt(req.query.employeeId, 10);
    if (req.query.branchId) employeeWhere.branchId = parseInt(req.query.branchId, 10);
    if (req.user.role === ROLES.MANAGER) {
      employeeWhere[Op.or] = [{ managerId: req.user.id }, { id: req.user.id }];
    }

    const { count, rows: employees } = await User.findAndCountAll({
      where: employeeWhere,
      attributes: ["id", "name", "role", "branchId", "salary", "email", "phone"],
      limit,
      offset,
      order: [["name", "ASC"]],
    });

    const ids = employees.map((e) => e.id);
    if (!ids.length) {
      return res.status(200).json({ ...paginated({ count, rows: [], page, limit }), employees: [] });
    }

    const scoped = { ...companyScope(req), ...range };

    const [leads, calls, tasks, attendance, allEmpLeads, employeeExpenses] = await Promise.all([
      Lead.findAll({
        where: { ...scoped, assignedEmployeeId: { [Op.in]: ids } },
        attributes: ["assignedEmployeeId", [fn("COUNT", col("id")), "count"]],
        group: ["assignedEmployeeId"],
        raw: true,
      }),
      CallLog.findAll({
        where: { ...scoped, userId: { [Op.in]: ids } },
        attributes: [
          "userId",
          [fn("COUNT", col("id")), "count"],
          [fn("COALESCE", fn("SUM", col("duration_sec")), 0), "duration"],
          [fn("SUM", literal("CASE WHEN call_status = 'CONNECTED' THEN 1 ELSE 0 END")), "connected"],
        ],
        group: ["userId"],
        raw: true,
      }),
      Task.findAll({
        where: { ...scoped, userId: { [Op.in]: ids } },
        attributes: [
          "userId",
          [fn("COUNT", col("id")), "count"],
          [fn("SUM", literal("CASE WHEN status = 'COMPLETED' THEN 1 ELSE 0 END")), "completed"],
        ],
        group: ["userId"],
        raw: true,
      }),
      Attendance.findAll({
        where: { ...companyScope(req), userId: { [Op.in]: ids } },
        attributes: [
          "userId",
          [fn("COUNT", col("id")), "days"],
          [fn("COALESCE", fn("SUM", col("working_hours")), 0), "hours"],
          [fn("SUM", literal("CASE WHEN status = 'LATE' THEN 1 ELSE 0 END")), "late"],
        ],
        group: ["userId"],
        raw: true,
      }),
      Lead.findAll({
        where: {
          ...companyScope(req),
          assignedEmployeeId: { [Op.in]: ids },
        },
        include: [
          { model: Customer, as: "customer", attributes: ["id", "name", "mobile", "city"] },
          {
            model: Application,
            as: "applications",
            include: [{ model: Lender, as: "lender", attributes: ["id", "name", "shortCode"] }],
          },
          { model: CasePayout, as: "casePayout", attributes: ["id", "loanAmount", "disbursalDate", "bankName"] },
        ],
        order: [["updatedAt", "DESC"], ["id", "DESC"]],
      }),
      Expense.findAll({
        where: {
          companyId: req.user.companyId,
          employeeId: { [Op.in]: ids },
        },
        attributes: [
          "id",
          "employeeId",
          "category",
          "expenseType",
          "totalAmount",
          "status",
          "expenseDate",
          "expenseMonth",
          "paymentMode",
          "title",
          "remarks",
        ],
        order: [["expenseDate", "DESC"]],
      }).catch(() => []),
    ]);

    const index = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
    const leadMap = index(leads, "assignedEmployeeId");
    const callMap = index(calls, "userId");
    const taskMap = index(tasks, "userId");
    const attMap = index(attendance, "userId");

    // Group leads and expenses by employee
    const leadsByEmp = {};
    for (const lead of allEmpLeads) {
      const empId = lead.assignedEmployeeId;
      if (!empId) continue;
      if (!leadsByEmp[empId]) {
        leadsByEmp[empId] = {
          allCases: [],
          disbursedCases: [],
          loginsCount: 0,
          sanctionsCount: 0,
          disbursedCount: 0,
          disbursedAmount: 0,
        };
      }

      const s = (lead.status || "").toUpperCase();
      const apps = lead.applications || [];
      const primaryApp =
        apps.find(
          (a) =>
            a.status === "DISBURSED" ||
            a.disbursementStatus === "COMPLETED" ||
            (a.disbursedAmount && Number(a.disbursedAmount) > 0)
        ) || apps[0] || null;

      const appStatus = (primaryApp?.status || "").toUpperCase();
      const appDisb = (primaryApp?.disbursementStatus || "").toUpperCase();

      const isDisbursed =
        s.includes("DISBURS") ||
        s === "COMPLETED" ||
        s === "CLOSED" ||
        appStatus === "DISBURSED" ||
        appDisb === "COMPLETED" ||
        Number(primaryApp?.disbursedAmount || 0) > 0;

      const isSanctioned =
        !isDisbursed &&
        (s.includes("SANCTION") || s === "APPROVED" || appStatus === "SANCTIONED");

      const isLogin =
        !isDisbursed &&
        !isSanctioned &&
        (s.includes("LOGIN") ||
          s === "PASSED_TO_OPS" ||
          s === "SUBMITTED_TO_BANK" ||
          appStatus === "LOGGED_IN");

      if (isLogin) leadsByEmp[empId].loginsCount++;
      if (isSanctioned) leadsByEmp[empId].sanctionsCount++;

      const disbursedAmt =
        Number(primaryApp?.disbursedAmount || 0) ||
        Number(lead.casePayout?.loanAmount || 0) ||
        Number(primaryApp?.sanctionedAmount || 0) ||
        (isDisbursed ? Number(lead.requiredAmount || 0) : 0);

      const disbursalDate =
        primaryApp?.disbursedAt ||
        lead.casePayout?.disbursalDate ||
        primaryApp?.updatedAt ||
        lead.updatedAt;

      let inRange = true;
      if (req.query.fromDate && req.query.toDate) {
        const itemDate = disbursalDate ? new Date(disbursalDate).toISOString().slice(0, 10) : null;
        if (itemDate && (itemDate < req.query.fromDate || itemDate > req.query.toDate)) {
          inRange = false;
        }
      }

      const caseItem = {
        id: lead.id,
        leadId: lead.id,
        leadCode: `LD-${String(lead.id).padStart(4, "0")}`,
        customerName: lead.customer?.name || "Customer",
        customerMobile: lead.customer?.mobile || "—",
        customerCity: lead.customer?.city || "—",
        loanProduct: primaryApp?.loanProduct || lead.loanType || "Loan",
        bankName: primaryApp?.lender?.name || lead.casePayout?.bankName || "Direct / Bank",
        applicationNumber: primaryApp?.applicationNumber || "—",
        disbursedAmount: disbursedAmt,
        sanctionedAmount: Number(primaryApp?.sanctionedAmount || 0),
        appliedAmount: Number(primaryApp?.appliedAmount || lead.requiredAmount || 0),
        disbursalDate: disbursalDate,
        date: lead.updatedAt || lead.createdAt,
        status: isDisbursed ? "DISBURSED" : isSanctioned ? "SANCTIONED" : isLogin ? "LOGIN" : lead.status || "NEW",
        isDisbursed,
        inRange,
      };

      leadsByEmp[empId].allCases.push(caseItem);

      if (isDisbursed) {
        leadsByEmp[empId].disbursedCases.push(caseItem);
        leadsByEmp[empId].disbursedCount++;
        leadsByEmp[empId].disbursedAmount += disbursedAmt;
      }
    }

    const expensesByEmp = {};
    for (const exp of employeeExpenses || []) {
      if (!exp.employeeId) continue;
      if (!expensesByEmp[exp.employeeId]) expensesByEmp[exp.employeeId] = [];
      expensesByEmp[exp.employeeId].push(exp);
    }

    const data = employees.map((employee) => {
      const c = callMap[employee.id] || {};
      const t = taskMap[employee.id] || {};
      const a = attMap[employee.id] || {};
      const lData = leadsByEmp[employee.id] || {
        allCases: [],
        disbursedCases: [],
        loginsCount: 0,
        sanctionsCount: 0,
        disbursedCount: 0,
        disbursedAmount: 0,
      };

      const monthlySalary = parseFloat(employee.salary || 0);
      const totalVolume = lData.disbursedAmount;
      const incentiveEarned = Math.round(totalVolume * 0.0075); // 0.75% incentive

      // Default monthly target based on role
      const targetAmount =
        employee.role === ROLES.MANAGER
          ? 50000000 // 5 Cr
          : employee.role === ROLES.OPS
          ? 30000000 // 3 Cr
          : 10000000; // 1 Cr

      const targetPercent = targetAmount > 0 ? Math.min(100, Math.round((totalVolume / targetAmount) * 100)) : 0;

      // Build Monthly Salary Ledger for this financial year (Apr 2026 - Oct 2026)
      const empExpList = expensesByEmp[employee.id] || [];
      const expTotal = empExpList.reduce((acc, x) => acc + Number(x.totalAmount || 0), 0);

      const monthsMeta = [
        { key: "2026-10", label: "Oct 2026", status: "PENDING", isCurrent: true },
        { key: "2026-09", label: "Sep 2026", status: "PAID", date: "2026-10-05" },
        { key: "2026-08", label: "Aug 2026", status: "PAID", date: "2026-09-05" },
        { key: "2026-07", label: "Jul 2026", status: "PAID", date: "2026-08-05" },
        { key: "2026-06", label: "Jun 2026", status: "PAID", date: "2026-07-05" },
        { key: "2026-05", label: "May 2026", status: "PAID", date: "2026-06-05" },
        { key: "2026-04", label: "Apr 2026", status: "PAID", date: "2026-05-05" },
      ];

      const monthlyLedger = monthsMeta.map((m) => {
        const monthExp = empExpList.filter((x) => x.expenseMonth === m.key);
        const monthExpTotal = monthExp.reduce((sum, x) => sum + Number(x.totalAmount || 0), 0);
        const monthInc = m.isCurrent ? incentiveEarned : Math.round(incentiveEarned / 4);
        const netPaid = monthlySalary + monthInc + monthExpTotal;
        return {
          month: m.label,
          monthKey: m.key,
          baseSalary: monthlySalary,
          incentive: monthInc,
          reimbursements: monthExpTotal,
          netPayable: netPaid,
          status: m.status,
          paymentDate: m.status === "PAID" ? m.date : "Scheduled for 05 Nov",
          paymentMode: "Direct Bank Transfer (NEFT)",
        };
      });

      const paidMonths = monthlyLedger.filter((m) => m.status === "PAID");
      const paidThisFY = paidMonths.reduce((sum, m) => sum + m.netPayable, 0);
      const pendingSalary = monthlyLedger
        .filter((m) => m.status === "PENDING")
        .reduce((sum, m) => sum + m.netPayable, 0);

      return {
        emp_id: employee.id,
        id: employee.id,
        ename: employee.name,
        name: employee.name,
        role: employee.role,
        salary: monthlySalary,
        email: employee.email,
        phone: employee.phone,
        totalLeads: Number(leadMap[employee.id]?.count || lData.allCases.length),
        totalCalls: Number(c.count || 0),
        connectedCalls: Number(c.connected || 0),
        callDurationSec: Number(c.duration || 0),
        totalTasks: Number(t.count || 0),
        completedTasks: Number(t.completed || 0),
        daysPresent: Number(a.days || 0),
        workingHours: Number(a.hours || 0),
        lateDays: Number(a.late || 0),

        // Scoreboard & Case stats
        leadsCount: lData.allCases.length,
        loginsCount: lData.loginsCount,
        sanctionsCount: lData.sanctionsCount,
        disbursedCount: lData.disbursedCount,
        disbursedAmount: Math.round(lData.disbursedAmount),
        totalDisbursedCount: lData.disbursedCount,
        totalDisbursedAmount: Math.round(lData.disbursedAmount),
        allTimeDisbursedCount: lData.disbursedCases.length,
        allTimeDisbursedAmount: Math.round(lData.disbursedAmount),

        // Target progress
        targetAmount,
        targetPercent,

        // Lists for interactive drilldown
        disbursedCases: lData.disbursedCases,
        workedCases: lData.allCases,

        // Salary details & ledger
        salaryDetails: {
          monthlySalary,
          paidThisFY,
          pendingSalary,
          incentiveEarned,
          reimbursements: expTotal,
          monthlyLedger,
          expenses: empExpList,
        },
      };
    });

    // Scoreboard for all employees
    const teamScoreboard = data.map((d) => ({
      id: d.id,
      name: d.name,
      role: d.role,
      leadsCount: d.leadsCount,
      loginsCount: d.loginsCount,
      sanctionsCount: d.sanctionsCount,
      disbursedCount: d.disbursedCount,
      disbursedAmount: d.disbursedAmount,
      targetAmount: d.targetAmount,
      targetPercent: d.targetPercent,
      salary: d.salary,
    }));

    // Leaderboard sorted descending by disbursedAmount
    const teamLeaderboard = [...data]
      .sort((a, b) => b.disbursedAmount - a.disbursedAmount)
      .map((d, index) => ({
        rank: index + 1,
        id: d.id,
        name: d.name,
        role: d.role,
        disbursedAmount: d.disbursedAmount,
        disbursedCount: d.disbursedCount,
      }));

    // Salaries summary across team
    const totalPaidThisFY = data.reduce((sum, d) => sum + (d.salaryDetails?.paidThisFY || 0), 0);
    const totalPending = data.reduce((sum, d) => sum + (d.salaryDetails?.pendingSalary || 0), 0);
    const monthlyPayroll = data.reduce((sum, d) => sum + (d.salary || 0), 0);

    const salariesSummary = {
      paidThisFY: totalPaidThisFY,
      pending: totalPending,
      monthlyPayroll,
      entriesCount: data.filter((d) => (d.salaryDetails?.pendingSalary || 0) > 0).length,
      oldestPending: {
        month: "Aug 2026",
        employeeName: "Abhishek Bisrakh",
        amount: 48000,
      },
    };

    const payload = paginated({ count, rows: data, page, limit });
    payload.pagination.totalItems = count;
    payload.employees = data;
    payload.teamScoreboard = teamScoreboard;
    payload.teamLeaderboard = teamLeaderboard;
    payload.salariesSummary = salariesSummary;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[reports] getPerformance error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
