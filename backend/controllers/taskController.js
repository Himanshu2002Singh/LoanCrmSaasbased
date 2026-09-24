const { Op } = require("sequelize");
const { Task, Lead, Customer, User } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { dateRangeWhere } = require("./leadController");
const { ROLES } = require("../constants/roles");

const TASK_STATUSES = ["PENDING", "IN_PROGRESS", "COMPLETED"];
const PRIORITIES = ["HIGH", "MEDIUM", "LOW"];
const SORTABLE = ["dueDate", "priority", "status", "createdAt"];
const EDITABLE = ["title", "description", "dueDate", "priority", "status", "leadId", "userId"];

const TASK_INCLUDES = [
  { model: User, as: "user", attributes: ["id", "name", "role"], required: false },
  {
    model: Lead,
    as: "lead",
    required: false,
    include: [{ model: Customer, as: "customer", attributes: ["id", "name", "mobile"] }],
  },
];

const serializeTask = (task) => ({
  task_id: task.id,
  id: task.id,
  title: task.title,
  description: task.description,
  due_date: task.dueDate,
  priority: task.priority,
  status: task.status,
  lead_id: task.leadId,
  emp_id: task.userId,
  owner: task.user?.name || null,
  customer_name: task.lead?.customer?.name || null,
  createdAt: task.createdAt,
  updatedAt: task.updatedAt,
});

const pick = (body, fields) => {
  const data = {};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    data[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
  }
  return data;
};

/**
 * Tasks are personal: an employee sees only their own, a manager sees their
 * team's, admins and ops see the company's.
 */
const taskScope = async (req) => {
  if (req.user.role === ROLES.EMPLOYEE) return { userId: req.user.id };
  if (req.user.role === ROLES.MANAGER) {
    const team = await User.findAll({
      where: { companyId: req.user.companyId, managerId: req.user.id },
      attributes: ["id"],
      raw: true,
    });
    return { userId: { [Op.in]: [req.user.id, ...team.map((u) => u.id)] } };
  }
  return {};
};

const canTouch = (req, task) => {
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.MANAGER].includes(req.user.role)) return true;
  return task.userId === req.user.id;
};

/**
 * GET /api/tasks
 * ?page&limit&search&sortBy&sortDir&status&priority&leadId&userId&window
 */
exports.getTasks = async (req, res) => {
  try {
    const { limit, offset, order, page, search } = buildQuery(req.query, {
      sortable: SORTABLE,
      defaultSort: ["dueDate", "ASC"],
    });

    const where = {
      ...companyScope(req),
      ...(await taskScope(req)),
      ...dateRangeWhere(req.query.fromDate, req.query.toDate),
    };

    if (search) {
      where[Op.or] = [
        { title: { [Op.like]: `%${search}%` } },
        { description: { [Op.like]: `%${search}%` } },
      ];
    }
    if (req.query.status) where.status = String(req.query.status).toUpperCase();
    if (req.query.priority) where.priority = String(req.query.priority).toUpperCase();
    if (req.query.leadId) where.leadId = parseInt(req.query.leadId, 10);
    if (req.query.userId && req.user.role !== ROLES.EMPLOYEE) {
      where.userId = parseInt(req.query.userId, 10);
    }

    // Overdue means past due and not yet finished.
    if (req.query.window === "overdue") {
      where.dueDate = { [Op.lt]: new Date() };
      where.status = { [Op.ne]: "COMPLETED" };
    }

    const { count, rows } = await Task.findAndCountAll({
      where,
      include: TASK_INCLUDES,
      limit,
      offset,
      order,
      distinct: true,
    });

    const payload = paginated({ count, rows: rows.map(serializeTask), page, limit });
    payload.pagination.totalItems = count;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[tasks] getTasks error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/tasks/:id
 */
exports.getTaskById = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id, { include: TASK_INCLUDES });
    if (!task || !belongsToScope(req, task) || !canTouch(req, task)) {
      return res.status(404).json({ message: "Task not found" });
    }
    return res.status(200).json({ message: "success", data: serializeTask(task) });
  } catch (error) {
    console.error("[tasks] getTaskById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/tasks
 */
exports.createTask = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const body = req.body;

    const title = (body.title || "").trim();
    if (!title) return res.status(400).json({ message: "title is required" });

    const priority = String(body.priority || "MEDIUM").toUpperCase();
    if (!PRIORITIES.includes(priority)) {
      return res.status(400).json({ message: `priority must be one of: ${PRIORITIES.join(", ")}` });
    }

    const status = String(body.status || "PENDING").toUpperCase();
    if (!TASK_STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${TASK_STATUSES.join(", ")}` });
    }

    const leadId = body.lead_id ?? body.leadId ?? null;
    if (leadId) {
      const lead = await Lead.findByPk(leadId);
      if (!lead || !belongsToScope(req, lead)) {
        return res.status(404).json({ message: "Lead not found" });
      }
    }

    // Only a manager or admin may put a task on somebody else's list.
    let userId = body.emp_id ?? body.userId ?? req.user.id;
    if (userId !== req.user.id) {
      if (![ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.MANAGER].includes(req.user.role)) {
        return res.status(403).json({ message: "You can only create tasks for yourself" });
      }
      const owner = await User.findByPk(userId);
      if (!owner || owner.companyId !== companyId) {
        return res.status(400).json({ message: "Assigned user does not belong to this company" });
      }
    }

    const task = await Task.create({
      companyId,
      userId,
      leadId: leadId || null,
      title,
      description: body.description || null,
      dueDate: body.due_date || body.dueDate || null,
      priority,
      status,
    });

    await logActivity(req, {
      recordType: "Other",
      recordId: task.id,
      action: "CREATED",
      newValue: { title: task.title, dueDate: task.dueDate, userId: task.userId },
      companyId,
    });

    const created = await Task.findByPk(task.id, { include: TASK_INCLUDES });
    return res.status(201).json({ message: "Task created", data: serializeTask(created) });
  } catch (error) {
    console.error("[tasks] createTask error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/tasks/:id
 */
exports.updateTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task || !belongsToScope(req, task)) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (!canTouch(req, task)) {
      return res.status(403).json({ message: "You can only edit your own tasks" });
    }

    const body = req.body;
    const data = pick(body, EDITABLE.filter((f) => f !== "userId"));
    if (body.due_date !== undefined) data.dueDate = body.due_date || null;
    if (body.lead_id !== undefined) data.leadId = body.lead_id || null;
    if (data.priority) {
      data.priority = String(data.priority).toUpperCase();
      if (!PRIORITIES.includes(data.priority)) {
        return res.status(400).json({ message: `priority must be one of: ${PRIORITIES.join(", ")}` });
      }
    }
    if (data.status) {
      data.status = String(data.status).toUpperCase();
      if (!TASK_STATUSES.includes(data.status)) {
        return res.status(400).json({ message: `status must be one of: ${TASK_STATUSES.join(", ")}` });
      }
    }

    // Reassignment is a manager action.
    const nextUserId = body.emp_id ?? body.userId;
    if (nextUserId !== undefined && Number(nextUserId) !== task.userId) {
      if (![ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.MANAGER].includes(req.user.role)) {
        return res.status(403).json({ message: "Only a manager can reassign a task" });
      }
      const owner = await User.findByPk(nextUserId);
      if (!owner || owner.companyId !== task.companyId) {
        return res.status(400).json({ message: "Assigned user does not belong to this company" });
      }
      data.userId = owner.id;
    }

    const before = { ...task.get({ plain: true }) };
    await task.update(data);

    const diff = diffFields(before, { ...task.get({ plain: true }) }, EDITABLE);
    if (diff) {
      await logActivity(req, {
        recordType: "Other",
        recordId: task.id,
        action: before.status !== task.status ? "STATUS_CHANGED" : "UPDATED",
        ...diff,
        companyId: task.companyId,
      });
    }

    const updated = await Task.findByPk(task.id, { include: TASK_INCLUDES });
    return res.status(200).json({ message: "Task updated", data: serializeTask(updated) });
  } catch (error) {
    console.error("[tasks] updateTask error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/tasks/:id
 */
exports.deleteTask = async (req, res) => {
  try {
    const task = await Task.findByPk(req.params.id);
    if (!task || !belongsToScope(req, task)) {
      return res.status(404).json({ message: "Task not found" });
    }
    if (!canTouch(req, task)) {
      return res.status(403).json({ message: "You can only delete your own tasks" });
    }

    await logActivity(req, {
      recordType: "Other",
      recordId: task.id,
      action: "DELETED",
      oldValue: { title: task.title },
      companyId: task.companyId,
    });

    await task.destroy();
    return res.status(200).json({ message: "Task deleted" });
  } catch (error) {
    console.error("[tasks] deleteTask error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.TASK_STATUSES = TASK_STATUSES;
