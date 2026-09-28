const { Op, fn, col, literal } = require("sequelize");
const { Lead, Customer, CallLog, Task, Attendance, User, MasterConfig } = require("../models");
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
      attributes: ["id", "name", "role", "branchId"],
      limit,
      offset,
      order: [["name", "ASC"]],
    });

    const ids = employees.map((e) => e.id);
    if (!ids.length) {
      return res.status(200).json({ ...paginated({ count, rows: [], page, limit }), employees: [] });
    }

    const scoped = { ...companyScope(req), ...range };

    const [leads, calls, tasks, attendance] = await Promise.all([
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
    ]);

    const index = (rows, key) => Object.fromEntries(rows.map((r) => [r[key], r]));
    const leadMap = index(leads, "assignedEmployeeId");
    const callMap = index(calls, "userId");
    const taskMap = index(tasks, "userId");
    const attMap = index(attendance, "userId");

    const data = employees.map((employee) => {
      const c = callMap[employee.id] || {};
      const t = taskMap[employee.id] || {};
      const a = attMap[employee.id] || {};
      return {
        emp_id: employee.id,
        id: employee.id,
        ename: employee.name,
        name: employee.name,
        role: employee.role,
        totalLeads: Number(leadMap[employee.id]?.count || 0),
        totalCalls: Number(c.count || 0),
        connectedCalls: Number(c.connected || 0),
        callDurationSec: Number(c.duration || 0),
        totalTasks: Number(t.count || 0),
        completedTasks: Number(t.completed || 0),
        daysPresent: Number(a.days || 0),
        workingHours: Number(a.hours || 0),
        lateDays: Number(a.late || 0),
      };
    });

    const payload = paginated({ count, rows: data, page, limit });
    payload.pagination.totalItems = count;
    payload.employees = data;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[reports] getPerformance error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
