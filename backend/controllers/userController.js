const { Op } = require("sequelize");
const XLSX = require("xlsx");
const { User, Branch, Company, Plan } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { seatLimitFor } = require("../services/provisioning");
const { ROLES, ROLE_VALUES, USER_STATUSES, USER_STATUS_VALUES } = require("../constants/roles");
const { PERMISSION_DEFINITIONS, DEFAULT_ROLE_PERMISSIONS, resolveUserPermissions } = require("../constants/permissions");

const SEARCHABLE = ["name", "email", "phone"];
const SORTABLE = ["name", "email", "role", "status", "salary", "createdAt"];
const EDITABLE = ["name", "email", "phone", "role", "managerId", "branchId", "status", "salary", "permissions"];

const WITH_RELATIONS = [
  { model: Branch, as: "branch", attributes: ["id", "name", "city"], required: false },
  { model: User, as: "manager", attributes: ["id", "name", "role"], required: false },
];

const pick = (body, fields) => {
  const data = {};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    if (field === "salary") {
      data[field] = body[field] === "" || body[field] === null ? 0 : Number(body[field]) || 0;
    } else {
      data[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
    }
  }
  return data;
};

/**
 * SUPERADMIN is a platform account, not a company one; nobody may mint or
 * become one through this API.
 */
const rejectPrivilegeEscalation = (data, actor) => {
  if (data.role && !ROLE_VALUES.includes(data.role)) {
    return `role must be one of: ${ROLE_VALUES.join(", ")}`;
  }
  if (data.role === ROLES.SUPERADMIN) {
    return "SUPERADMIN accounts cannot be created or assigned through this API";
  }
  if (data.status && !USER_STATUS_VALUES.includes(data.status)) {
    return `status must be one of: ${USER_STATUS_VALUES.join(", ")}`;
  }
  if (actor.role === ROLES.MANAGER && data.role && data.role !== ROLES.EMPLOYEE) {
    return "Managers may only manage employee accounts";
  }
  return null;
};

/**
 * A manager's branch or manager reference must live inside the same company as
 * the user being written, otherwise the row leaks across companies.
 */
const validateReferences = async (data, companyId) => {
  if (data.branchId) {
    const branch = await Branch.findByPk(data.branchId);
    if (!branch || branch.companyId !== companyId) return "branchId does not belong to this company";
  }
  if (data.managerId) {
    const manager = await User.findByPk(data.managerId);
    if (!manager || manager.companyId !== companyId) return "managerId does not belong to this company";
    if (![ROLES.MANAGER, ROLES.COMPANY_ADMIN].includes(manager.role)) {
      return "managerId must reference a manager or company admin";
    }
  }
  return null;
};

/**
 * Seats a company is currently filling against what it may fill. Both the
 * create and the reactivate path answer with this, so an admin always sees the
 * same numbers and the same wording.
 */
const seatUsage = async (companyId) => {
  const company = await Company.findByPk(companyId, {
    include: [{ model: Plan, as: "plan", required: false }],
  });
  const limit = seatLimitFor(company, company?.plan);
  const used = await User.count({
    where: { companyId, status: USER_STATUSES.ACTIVE, role: { [Op.ne]: ROLES.SUPERADMIN } },
  });
  return { used, limit, plan: company?.plan?.name || null };
};

const seatLimitMessage = ({ limit, plan }) =>
  plan
    ? `All ${limit} seats on your ${plan} plan are in use. Upgrade the plan or deactivate a user to free a seat.`
    : `All ${limit} seats for your company are in use. Deactivate a user to free a seat, or ask your account manager to raise the limit.`;

/**
 * GET /api/users
 * ?page&limit&search&sortBy&sortDir&role&status&branchId&managerId&includeInactive
 */
exports.getUsers = async (req, res) => {
  console.log("this user controller hit");
  try {
    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: SEARCHABLE,
      sortable: SORTABLE,
      defaultSort: ["createdAt", "DESC"],
    });

    Object.assign(where, companyScope(req));

    // Platform accounts never appear in a company's user list.
    where.role = { [Op.ne]: ROLES.SUPERADMIN };

    if (req.query.role) {
      if (!ROLE_VALUES.includes(req.query.role)) {
        return res.status(400).json({ message: `Unknown role: ${req.query.role}` });
      }
      where.role = req.query.role;
    }

    if (req.query.status) {
      where.status = req.query.status;
    } else if (req.query.includeInactive !== "true") {
      where.status = USER_STATUSES.ACTIVE;
    }

    if (req.query.branchId) where.branchId = parseInt(req.query.branchId, 10);
    if (req.query.managerId) where.managerId = parseInt(req.query.managerId, 10);

    // A manager only sees their own team.
    if (req.user.role === ROLES.MANAGER) {
      where[Op.and] = [
        ...(where[Op.and] || []),
        { [Op.or]: [{ managerId: req.user.id }, { id: req.user.id }] },
      ];
    }

    const { count, rows } = await User.findAndCountAll({
      where,
      include: WITH_RELATIONS,
      limit,
      offset,
      order,
      distinct: true,
    });

    const formattedRows = rows.map((u) => {
      const json = u.toJSON ? u.toJSON() : { ...u };
      json.resolvedPermissions = resolveUserPermissions(u);
      return json;
    });

    return res.status(200).json(paginated({ count, rows: formattedRows, page, limit }));
  } catch (error) {
    console.error("[users] getUsers error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/users/permissions/metadata
 */
exports.getPermissionMetadata = async (req, res) => {
  try {
    return res.status(200).json({
      success: true,
      definitions: PERMISSION_DEFINITIONS,
      roleDefaults: DEFAULT_ROLE_PERMISSIONS,
      defaultRolePermissions: DEFAULT_ROLE_PERMISSIONS,
    });
  } catch (err) {
    console.error("[users] getPermissionMetadata error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

/**
 * PUT /api/users/:id/permissions
 */
exports.updateUserPermissions = async (req, res) => {
  try {
    const { id } = req.params;
    const { permissions } = req.body;

    const user = await User.findByPk(id);
    if (!user || !belongsToScope(req, user)) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === ROLES.SUPERADMIN || user.role === ROLES.COMPANY_ADMIN) {
      return res.status(400).json({ message: "Cannot override permissions for administrator accounts" });
    }

    // Update user permissions JSON
    await user.update({ permissions: permissions || {} });

    const resolved = resolveUserPermissions(user);

    await logActivity(req, {
      recordType: "User",
      recordId: user.id,
      action: "UPDATED",
      remarks: `Updated role permissions for ${user.name} (${user.role})`,
    });

    return res.status(200).json({
      success: true,
      message: `Permissions updated successfully for ${user.name}`,
      data: {
        userId: user.id,
        role: user.role,
        permissions: user.permissions,
        resolvedPermissions: resolved,
      },
    });
  } catch (error) {
    console.error("[users] updateUserPermissions error:", error);
    return res.status(500).json({ message: "Internal server error", error: error.message });
  }
};

/**
 * GET /api/users/:id
 */
exports.getUserById = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id, {
      include: [
        ...WITH_RELATIONS,
        { model: Company, as: "company", attributes: ["id", "name", "slug"], required: false },
      ],
    });

    if (!user || !belongsToScope(req, user)) {
      return res.status(404).json({ message: "User not found" });
    }

    const json = user.toJSON ? user.toJSON() : { ...user };
    json.resolvedPermissions = resolveUserPermissions(user);

    return res.status(200).json({ message: "success", data: json });
  } catch (error) {
    console.error("[users] getUserById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/users
 */
exports.createUser = async (req, res) => {
  try {
    const data = pick(req.body, EDITABLE);
    const { password } = req.body;

    if (!data.name || !data.phone) {
      return res.status(400).json({ message: "name and phone are required" });
    }
    if (!password || String(password).length < 8) {
      return res.status(400).json({ message: "password is required and must be at least 8 characters" });
    }

    const escalation = rejectPrivilegeEscalation(data, req.user);
    if (escalation) return res.status(403).json({ message: escalation });

    // SUPERADMIN must say which company the user belongs to; everyone else
    // creates inside their own.
    const companyId =
      req.user.role === ROLES.SUPERADMIN ? parseInt(req.body.companyId, 10) : req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const referenceError = await validateReferences(data, companyId);
    if (referenceError) return res.status(400).json({ message: referenceError });

    if (data.email) {
      const existing = await User.findOne({ where: { companyId, email: data.email } });
      if (existing) {
        return res.status(409).json({ message: "A user with this email already exists in this company" });
      }
    }

    // Seats are what the company pays for, so the cap is enforced on the way in.
    const seats = await seatUsage(companyId);
    if (seats.limit !== null && seats.used >= seats.limit) {
      return res.status(409).json({
        code: "SEAT_LIMIT_REACHED",
        message: seatLimitMessage(seats),
        ...seats,
      });
    }

    const user = await User.create({ ...data, companyId, password });
    const created = await User.findByPk(user.id, { include: WITH_RELATIONS });

    await logActivity(req, {
      recordType: "User",
      recordId: user.id,
      action: "CREATED",
      newValue: { name: user.name, email: user.email, role: user.role },
      companyId,
    });

    return res.status(201).json({ message: "User created", data: created });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "A user with these details already exists" });
    }
    console.error("[users] createUser error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/users/:id
 */
exports.updateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user || !belongsToScope(req, user)) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === ROLES.SUPERADMIN) {
      return res.status(403).json({ message: "Platform accounts cannot be edited here" });
    }

    const data = pick(req.body, EDITABLE);
    const escalation = rejectPrivilegeEscalation(data, req.user);
    if (escalation) return res.status(403).json({ message: escalation });

    if (data.managerId && Number(data.managerId) === user.id) {
      return res.status(400).json({ message: "A user cannot be their own manager" });
    }

    const referenceError = await validateReferences(data, user.companyId);
    if (referenceError) return res.status(400).json({ message: referenceError });

    // Spread it: get({ plain: true }) hands back the live dataValues object,
    // which would mutate along with the update and leave nothing to diff.
    // Reactivating fills a seat just as creating one does, so it faces the
    // same cap — otherwise deactivating and re-enabling walks a company past it.
    if (data.status === USER_STATUSES.ACTIVE && user.status !== USER_STATUSES.ACTIVE) {
      const seats = await seatUsage(user.companyId);
      if (seats.limit !== null && seats.used >= seats.limit) {
        return res.status(409).json({
          code: "SEAT_LIMIT_REACHED",
          message: seatLimitMessage(seats),
          ...seats,
        });
      }
    }

    const before = { ...user.get({ plain: true }) };
    await user.update(data);

    const diff = diffFields(before, { ...user.get({ plain: true }) }, EDITABLE);
    if (diff) {
      await logActivity(req, {
        recordType: "User",
        recordId: user.id,
        action: "UPDATED",
        ...diff,
        companyId: user.companyId,
      });
    }

    const updated = await User.findByPk(user.id, { include: WITH_RELATIONS });
    return res.status(200).json({ message: "User updated", data: updated });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "A user with these details already exists" });
    }
    console.error("[users] updateUser error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/users/:id/password - admin reset, no current password needed.
 */
exports.resetPassword = async (req, res) => {
  try {
    const { newPassword } = req.body;
    if (!newPassword || String(newPassword).length < 8) {
      return res.status(400).json({ message: "newPassword must be at least 8 characters" });
    }

    const user = await User.findByPk(req.params.id);
    if (!user || !belongsToScope(req, user)) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.role === ROLES.SUPERADMIN && req.user.role !== ROLES.SUPERADMIN) {
      return res.status(403).json({ message: "Platform accounts cannot be reset here" });
    }

    user.password = newPassword;
    await user.save();

    await logActivity(req, {
      recordType: "User",
      recordId: user.id,
      action: "UPDATED",
      remarks: "Password reset by administrator",
      companyId: user.companyId,
    });

    return res.status(200).json({ message: "Password reset" });
  } catch (error) {
    console.error("[users] resetPassword error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/users/:id
 * Deactivates instead of deleting: leads, calls and audit rows reference the
 * user and the history must survive.
 */
exports.deactivateUser = async (req, res) => {
  try {
    const user = await User.findByPk(req.params.id);
    if (!user || !belongsToScope(req, user)) {
      return res.status(404).json({ message: "User not found" });
    }
    if (user.id === req.user.id) {
      return res.status(400).json({ message: "You cannot deactivate your own account" });
    }
    if (user.role === ROLES.SUPERADMIN) {
      return res.status(403).json({ message: "Platform accounts cannot be deactivated here" });
    }

    const previousStatus = user.status;
    await user.update({ status: USER_STATUSES.INACTIVE });

    await logActivity(req, {
      recordType: "User",
      recordId: user.id,
      action: "STATUS_CHANGED",
      oldValue: { status: previousStatus },
      newValue: { status: USER_STATUSES.INACTIVE },
      companyId: user.companyId,
    });

    return res.status(200).json({ message: "User deactivated", data: user });
  } catch (error) {
    console.error("[users] deactivateUser error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/users/seats
 * Lets a company admin see how many seats are left before they hit the wall,
 * rather than discovering it when "add user" fails.
 */
exports.getSeatUsage = async (req, res) => {
  try {
    const companyId =
      req.user.role === ROLES.SUPERADMIN ? parseInt(req.query.companyId, 10) : req.user.companyId;
    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    const seats = await seatUsage(companyId);
    return res.status(200).json({
      message: "success",
      data: {
        ...seats,
        remaining: seats.limit === null ? null : Math.max(seats.limit - seats.used, 0),
        full: seats.limit !== null && seats.used >= seats.limit,
      },
    });
  } catch (error) {
    console.error("[users] getSeatUsage error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * Column headings the import accepts. Sheets are written by people, so each
 * field answers to the few spellings that actually turn up rather than one
 * exact string.
 */
const IMPORT_COLUMNS = {
  name: ["Name", "name", "Employee Name", "Full Name"],
  phone: ["Mobile Number", "Mobile", "Phone", "phone", "Contact", "Number"],
  email: ["Email Id", "Email ID", "Email", "email"],
  role: ["Role", "role", "Designation"],
  password: ["Password", "password"],
  salary: ["Salary", "salary", "Monthly Salary", "Basic Salary"],
};

const cellOf = (row, keys) => {
  for (const key of keys) {
    const value = row[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return String(value).trim();
    }
  }
  return "";
};

/**
 * Sheets carry the label an admin sees in the panel, not the enum the column
 * stores, so both are accepted.
 */
const ROLE_ALIASES = {
  "sales manager": ROLES.EMPLOYEE,
  employee: ROLES.EMPLOYEE,
  caller: ROLES.EMPLOYEE,
  calling: ROLES.EMPLOYEE,
  manager: ROLES.MANAGER,
  operations: ROLES.OPS,
  ops: ROLES.OPS,
  banker: ROLES.BANKER,
  "company admin": ROLES.COMPANY_ADMIN,
};

const resolveRole = (value) => {
  if (!value) return ROLES.EMPLOYEE;
  const raw = String(value).trim();
  if (ROLE_VALUES.includes(raw.toUpperCase())) return raw.toUpperCase();
  return ROLE_ALIASES[raw.toLowerCase()] || null;
};

const MIN_PASSWORD_LENGTH = 8;
const MAX_IMPORT_ERRORS_RETURNED = 50;

/**
 * POST /api/users/import - multipart, field name `file`.
 *
 * Seats are filled in sheet order: rows are created until the company's plan
 * runs out of them, and the remainder is reported back rather than silently
 * dropped. A row rejected for its own contents never costs a seat.
 *
 * Passwords come from the sheet. The model hashes on create, so nothing here
 * stores or returns one.
 */
exports.importUsersFromExcel = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No Excel file uploaded" });
    }

    const companyId =
      req.user.role === ROLES.SUPERADMIN ? parseInt(req.body.companyId, 10) : req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const workbook = XLSX.read(req.file.buffer, { type: "buffer" });
    const sheet = workbook.Sheets[workbook.SheetNames[0]];
    const rows = XLSX.utils.sheet_to_json(sheet);

    if (!rows.length) {
      return res.status(400).json({ message: "The sheet has no rows" });
    }

    const seats = await seatUsage(companyId);
    let seatsLeft = seats.limit === null ? Infinity : Math.max(seats.limit - seats.used, 0);

    // Emails already spoken for, so a duplicate inside the sheet is caught the
    // same way as one that clashes with an existing account.
    const existing = await User.findAll({
      where: { companyId, email: { [Op.ne]: null } },
      attributes: ["email"],
      raw: true,
    });
    const takenEmails = new Set(existing.map((user) => user.email.toLowerCase()));

    let imported = 0;
    let skipped = 0;
    const errors = [];

    const skip = (rowNumber, reason) => {
      skipped += 1;
      errors.push({ row: rowNumber, reason });
    };

    for (const [index, row] of rows.entries()) {
      const rowNumber = index + 2; // sheet row, counting the header

      const name = cellOf(row, IMPORT_COLUMNS.name);
      const phone = cellOf(row, IMPORT_COLUMNS.phone);
      const email = cellOf(row, IMPORT_COLUMNS.email);
      const password = cellOf(row, IMPORT_COLUMNS.password);

      if (!name || !phone) {
        skip(rowNumber, "Missing name or mobile number");
        continue;
      }
      if (password.length < MIN_PASSWORD_LENGTH) {
        skip(rowNumber, `Password must be at least ${MIN_PASSWORD_LENGTH} characters`);
        continue;
      }

      const role = resolveRole(cellOf(row, IMPORT_COLUMNS.role));
      if (!role) {
        skip(rowNumber, `Unknown role: ${cellOf(row, IMPORT_COLUMNS.role)}`);
        continue;
      }

      const escalation = rejectPrivilegeEscalation({ role }, req.user);
      if (escalation) {
        skip(rowNumber, escalation);
        continue;
      }

      if (email && takenEmails.has(email.toLowerCase())) {
        skip(rowNumber, `A user with the email ${email} already exists`);
        continue;
      }

      // Checked last, so a row that would have been rejected anyway does not
      // consume the seat it never earned.
      if (seatsLeft <= 0) {
        skip(rowNumber, seatLimitMessage(seats));
        continue;
      }

      const salaryRaw = cellOf(row, IMPORT_COLUMNS.salary);
      const salary = salaryRaw ? parseFloat(salaryRaw) || 0 : 0;

      try {
        await User.create({
          companyId,
          name,
          phone,
          email: email || null,
          password,
          role,
          salary,
          status: USER_STATUSES.ACTIVE,
        });
        if (email) takenEmails.add(email.toLowerCase());
        imported += 1;
        seatsLeft -= 1;
      } catch (error) {
        skip(rowNumber, error.message);
      }
    }

    await logActivity(req, {
      recordType: "User",
      recordId: 0,
      action: "CREATED",
      newValue: { imported, skipped },
      remarks: `Imported ${imported} user(s) from a spreadsheet, ${skipped} skipped`,
      companyId,
    });

    const after = await seatUsage(companyId);
    return res.status(200).json({
      message: `${imported} user(s) imported, ${skipped} skipped`,
      imported,
      skipped,
      total: rows.length,
      seats: {
        ...after,
        remaining: after.limit === null ? null : Math.max(after.limit - after.used, 0),
      },
      errors: errors.slice(0, MAX_IMPORT_ERRORS_RETURNED),
    });
  } catch (error) {
    console.error("[users] importUsersFromExcel error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
