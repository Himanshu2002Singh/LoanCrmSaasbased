const { Op, fn, col } = require("sequelize");
const { Company, Plan, Branch, User, Lead, sequelize } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { provisionCompany, seatLimitFor } = require("../services/provisioning");
const { ROLES, USER_STATUSES } = require("../constants/roles");

/**
 * Company administration for the platform operator. Everything here sits behind
 * requireSuperAdmin — these rows are the customers of the product itself, not
 * records belonging to any one of them.
 */
const SEARCHABLE = ["name", "slug", "email", "phone"];
const SORTABLE = ["name", "status", "createdAt", "subscriptionExpiresAt"];
const EDITABLE = [
  "name",
  "email",
  "phone",
  "logoUrl",
  "planId",
  "maxUsers",
  "subscriptionExpiresAt",
  "status",
  "gstNumber",
  "panNumber",
  "address",
  "city",
  "state",
  "pincode",
  "bankName",
  "accountNumber",
  "ifscCode",
  "bankBranch",
];
const STATUSES = ["active", "trial", "suspended"];

const COMPANY_ALIASES = {
  gst_number: "gstNumber",
  pan_number: "panNumber",
  bank_name: "bankName",
  account_number: "accountNumber",
  ifsc_code: "ifscCode",
  bank_branch: "bankBranch",
};

const pick = (body, fields, aliases = COMPANY_ALIASES) => {
  const data = {};
  const source = { ...body };
  if (aliases) {
    for (const [from, to] of Object.entries(aliases)) {
      if (source[from] !== undefined && source[to] === undefined) source[to] = source[from];
    }
  }
  for (const field of fields) {
    if (source[field] === undefined) continue;
    data[field] = typeof source[field] === "string" ? source[field].trim() : source[field];
  }
  return data;
};

const serialize = (company, extra = {}) => {
  const plain = company.get ? company.get({ plain: true }) : { ...company };
  if (plain.smtpConfig && plain.smtpConfig.pass) {
    plain.smtpConfig = {
      ...plain.smtpConfig,
      pass: undefined,
      hasPassword: true,
    };
  }
  return {
    ...plain,
    plan: company.plan
      ? {
          id: company.plan.id,
          name: company.plan.name,
          priceMonthly: company.plan.priceMonthly,
          maxEmployees: company.plan.maxEmployees,
          featuresJson: company.plan.featuresJson,
        }
      : null,
    ...extra,
  };
};

/**
 * GET /api/platform/companies
 * ?page&limit&search&sortBy&sortDir&status&planId&expiring=<days>
 */
exports.getCompanies = async (req, res) => {
  try {
    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: SEARCHABLE,
      sortable: SORTABLE,
      defaultSort: ["createdAt", "DESC"],
    });

    if (req.query.status) {
      if (!STATUSES.includes(req.query.status)) {
        return res.status(400).json({ message: `status must be one of: ${STATUSES.join(", ")}` });
      }
      where.status = req.query.status;
    }
    if (req.query.planId) where.planId = parseInt(req.query.planId, 10);

    // Renewals worth chasing: expiring inside N days, including already lapsed.
    if (req.query.expiring) {
      const days = parseInt(req.query.expiring, 10) || 30;
      where.subscriptionExpiresAt = {
        [Op.ne]: null,
        [Op.lte]: new Date(Date.now() + days * 86400000),
      };
    }

    const { count, rows } = await Company.findAndCountAll({
      where,
      include: [{ model: Plan, as: "plan", required: false }],
      limit,
      offset,
      order,
      distinct: true,
    });

    // Seat usage in one grouped query rather than one per company.
    const ids = rows.map((c) => c.id);
    const seatRows = ids.length
      ? await User.findAll({
          where: {
            companyId: { [Op.in]: ids },
            status: USER_STATUSES.ACTIVE,
            role: { [Op.ne]: ROLES.SUPERADMIN },
          },
          attributes: ["companyId", [fn("COUNT", col("id")), "count"]],
          group: ["companyId"],
          raw: true,
        })
      : [];
    const seatMap = Object.fromEntries(seatRows.map((r) => [r.companyId, Number(r.count)]));

    const data = rows.map((company) =>
      serialize(company, {
        seatsUsed: seatMap[company.id] || 0,
        seatLimit: seatLimitFor(company, company.plan),
      })
    );

    return res.status(200).json(paginated({ count, rows: data, page, limit }));
  } catch (error) {
    console.error("[companies] getCompanies error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/platform/companies/:id
 */
exports.getCompanyById = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id, {
      include: [{ model: Plan, as: "plan", required: false }],
    });
    if (!company) return res.status(404).json({ message: "Company not found" });

    const [seatsUsed, admins, branches] = await Promise.all([
      User.count({
        where: { companyId: company.id, status: USER_STATUSES.ACTIVE, role: { [Op.ne]: ROLES.SUPERADMIN } },
      }),
      User.findAll({
        where: { companyId: company.id, role: ROLES.COMPANY_ADMIN },
        attributes: ["id", "name", "email", "phone", "status"],
      }),
      Branch.findAll({ where: { companyId: company.id }, attributes: ["id", "name", "city"] }),
    ]);

    return res.status(200).json({
      message: "success",
      data: serialize(company, {
        seatsUsed,
        seatLimit: seatLimitFor(company, company.plan),
        admins,
        branches,
      }),
    });
  } catch (error) {
    console.error("[companies] getCompanyById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/platform/companies
 * Stands up a company: company, head office, first admin and the master configs
 * its CRM needs, in one transaction.
 */
exports.createCompany = async (req, res) => {
  try {
    const { company, branch, admin } = await provisionCompany({
      name: req.body.name,
      email: req.body.email,
      phone: req.body.phone,
      slug: req.body.slug,
      logoUrl: req.body.logoUrl || null,
      planId: req.body.planId,
      status: req.body.status || "trial",
      maxUsers: req.body.maxUsers,
      subscriptionExpiresAt: req.body.subscriptionExpiresAt,
      branch: req.body.branch || {},
      admin: req.body.admin || {},
    });

    await logActivity(req, {
      recordType: "Other",
      recordId: company.id,
      action: "CREATED",
      newValue: { company: company.name, slug: company.slug, status: company.status },
      remarks: "Company provisioned",
      companyId: company.id,
    });

    return res.status(201).json({
      message: "Company provisioned",
      data: {
        company,
        branch: { id: branch.id, name: branch.name },
        admin: { id: admin.id, name: admin.name, email: admin.email, phone: admin.phone },
      },
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "A company with these details already exists" });
    }
    console.error("[companies] createCompany error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/platform/companies/:id
 * Profile, plan, seats and renewal date. Status changes go through their own
 * endpoint so a suspension is never a side effect of an edit.
 */
exports.updateCompany = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id, {
      include: [{ model: Plan, as: "plan", required: false }],
    });
    if (!company) return res.status(404).json({ message: "Company not found" });

    const data = pick(req.body, EDITABLE);

    if (data.status !== undefined) {
      data.status = String(data.status).toLowerCase();
      if (!STATUSES.includes(data.status)) {
        return res.status(400).json({ message: `status must be one of: ${STATUSES.join(", ")}` });
      }
    }

    let plan = company.plan;
    if (data.planId !== undefined && data.planId !== company.planId) {
      plan = data.planId ? await Plan.findByPk(data.planId) : null;
      if (data.planId && !plan) return res.status(404).json({ message: "Plan not found" });
    }

    // Custom seat allocation can be set for the company.
    let seatNote = null;
    if (data.maxUsers !== undefined) {
      if (data.maxUsers === null || data.maxUsers === "") {
        data.maxUsers = plan?.maxEmployees || 5;
      } else {
        const requested = parseInt(data.maxUsers, 10);
        if (!Number.isInteger(requested) || requested < 1) {
          return res.status(400).json({ message: "maxUsers must be at least 1" });
        }
        data.maxUsers = requested;
      }
    } else if (data.planId !== undefined && data.planId !== company.planId && plan?.maxEmployees) {
      // If plan changed and maxUsers wasn't explicitly supplied, default to the new plan's employee limit
      data.maxUsers = plan.maxEmployees;
    }

    const before = { ...company.get({ plain: true }) };
    await company.update(data);

    const diff = diffFields(before, { ...company.get({ plain: true }) }, EDITABLE);
    if (diff) {
      await logActivity(req, {
        recordType: "Other",
        recordId: company.id,
        action: "UPDATED",
        ...diff,
        remarks: "Company updated by platform operator",
        companyId: company.id,
      });
    }

    return res.status(200).json({
      message: "Company updated",
      data: serialize(company),
      ...(seatNote ? { note: seatNote } : {}),
    });
  } catch (error) {
    console.error("[companies] updateCompany error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/platform/companies/:id/status
 * Suspending a company cuts off every one of its users, on the panel and in the
 * mobile app, because the check lives in the shared auth middleware.
 */
exports.setCompanyStatus = async (req, res) => {
  try {
    const status = String(req.body.status || "").toLowerCase();
    if (!STATUSES.includes(status)) {
      return res.status(400).json({ message: `status must be one of: ${STATUSES.join(", ")}` });
    }
    if (status === "suspended" && !String(req.body.reason || "").trim()) {
      return res.status(400).json({ message: "reason is required when suspending a company" });
    }

    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const previous = company.status;
    if (previous === status) {
      return res.status(200).json({ message: `Company is already ${status}`, data: company });
    }

    await company.update({ status });

    const affectedUsers = await User.count({
      where: { companyId: company.id, status: USER_STATUSES.ACTIVE },
    });

    await logActivity(req, {
      recordType: "Other",
      recordId: company.id,
      action: "STATUS_CHANGED",
      oldValue: { status: previous },
      newValue: { status },
      remarks: req.body.reason || `Company ${status}`,
      companyId: company.id,
    });

    return res.status(200).json({
      message: `Company ${status}`,
      data: company,
      affectedUsers,
    });
  } catch (error) {
    console.error("[companies] setCompanyStatus error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/platform/companies/:id/admins
 * Adds another COMPANY_ADMIN, for handover or when a company loses access.
 */
exports.createCompanyAdmin = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const { name, phone, email, password } = req.body;
    if (!name || !phone) return res.status(400).json({ message: "name and phone are required" });
    if (!password || String(password).length < 8) {
      return res.status(400).json({ message: "password must be at least 8 characters" });
    }

    if (email) {
      const clash = await User.findOne({ where: { companyId: company.id, email } });
      if (clash) {
        return res.status(409).json({ message: "A user with this email already exists in this company" });
      }
    }

    const branch = await Branch.findOne({ where: { companyId: company.id }, order: [["id", "ASC"]] });

    const admin = await User.create({
      companyId: company.id,
      branchId: branch ? branch.id : null,
      name: String(name).trim(),
      email: email || null,
      phone: String(phone).trim(),
      password,
      role: ROLES.COMPANY_ADMIN,
      status: USER_STATUSES.ACTIVE,
    });

    await logActivity(req, {
      recordType: "User",
      recordId: admin.id,
      action: "CREATED",
      newValue: { name: admin.name, role: admin.role },
      remarks: "Company admin created by platform operator",
      companyId: company.id,
    });

    return res.status(201).json({ message: "Company admin created", data: admin });
  } catch (error) {
    console.error("[companies] createCompanyAdmin error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/platform/companies/:id/usage
 */
exports.getCompanyUsage = async (req, res) => {
  try {
    const company = await Company.findByPk(req.params.id, {
      include: [{ model: Plan, as: "plan", required: false }],
    });
    if (!company) return res.status(404).json({ message: "Company not found" });

    const [seatsUsed, byRole, leadCount, lastLead] = await Promise.all([
      User.count({
        where: { companyId: company.id, status: USER_STATUSES.ACTIVE, role: { [Op.ne]: ROLES.SUPERADMIN } },
      }),
      User.findAll({
        where: { companyId: company.id, status: USER_STATUSES.ACTIVE },
        attributes: ["role", [fn("COUNT", col("id")), "count"]],
        group: ["role"],
        raw: true,
      }),
      Lead.count({ where: { companyId: company.id } }),
      Lead.findOne({ where: { companyId: company.id }, order: [["createdAt", "DESC"]], attributes: ["createdAt"] }),
    ]);

    const seatLimit = seatLimitFor(company, company.plan);

    return res.status(200).json({
      message: "success",
      data: {
        companyId: company.id,
        name: company.name,
        status: company.status,
        plan: company.plan ? company.plan.name : null,
        seatsUsed,
        seatLimit,
        seatsRemaining: seatLimit === null ? null : Math.max(seatLimit - seatsUsed, 0),
        usersByRole: Object.fromEntries(byRole.map((r) => [r.role, Number(r.count)])),
        totalLeads: leadCount,
        lastLeadAt: lastLead ? lastLead.createdAt : null,
        subscriptionExpiresAt: company.subscriptionExpiresAt,
      },
    });
  } catch (error) {
    console.error("[companies] getCompanyUsage error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/platform/metrics
 * The operator's own dashboard: companies, seats and recurring revenue.
 */
exports.getPlatformMetrics = async (req, res) => {
  try {
    const [byStatus, companies, totalUsers, totalLeads] = await Promise.all([
      Company.findAll({
        attributes: ["status", [fn("COUNT", col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),
      Company.findAll({ include: [{ model: Plan, as: "plan", required: false }] }),
      User.count({ where: { role: { [Op.ne]: ROLES.SUPERADMIN }, status: USER_STATUSES.ACTIVE } }),
      Lead.count(),
    ]);

    // Recurring revenue counts only companies that are actually paying.
    const paying = companies.filter((c) => c.status === "active" && c.plan);
    const monthlyRecurring = paying.reduce((sum, c) => sum + Number(c.plan.priceMonthly || 0), 0);

    const now = Date.now();
    const expiringSoon = companies.filter(
      (c) =>
        c.subscriptionExpiresAt &&
        new Date(c.subscriptionExpiresAt) >= new Date(now) &&
        new Date(c.subscriptionExpiresAt) <= new Date(now + 30 * 86400000)
    );
    const expired = companies.filter(
      (c) => c.subscriptionExpiresAt && new Date(c.subscriptionExpiresAt) < new Date(now)
    );

    return res.status(200).json({
      message: "success",
      data: {
        companies: {
          total: companies.length,
          ...Object.fromEntries(byStatus.map((r) => [r.status, Number(r.count)])),
        },
        monthlyRecurringRevenue: monthlyRecurring,
        payingCompanies: paying.length,
        totalUsers,
        totalLeads,
        expiringSoon: expiringSoon.map((c) => ({
          id: c.id,
          name: c.name,
          subscriptionExpiresAt: c.subscriptionExpiresAt,
        })),
        expired: expired.map((c) => ({
          id: c.id,
          name: c.name,
          subscriptionExpiresAt: c.subscriptionExpiresAt,
        })),
      },
    });
  } catch (error) {
    console.error("[companies] getPlatformMetrics error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/company/profile
 * Returns the authenticated company's profile, subscription plan, seat usage, and organizational statistics.
 */
exports.getMyCompanyProfile = async (req, res) => {
  try {
    const companyId =
      req.user.role === ROLES.SUPERADMIN
        ? parseInt(req.query.companyId, 10) || req.user.companyId || 1
        : req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "No company associated with this account" });
    }

    const company = await Company.findByPk(companyId, {
      include: [
        { model: Plan, as: "plan", required: false },
        { model: Branch, as: "branches", attributes: ["id", "name", "city", "state", "address"] },
      ],
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const [seatsUsed, byRole, totalLeads, totalBranches] = await Promise.all([
      User.count({
        where: { companyId: company.id, status: USER_STATUSES.ACTIVE, role: { [Op.ne]: ROLES.SUPERADMIN } },
      }),
      User.findAll({
        where: { companyId: company.id, status: USER_STATUSES.ACTIVE, role: { [Op.ne]: ROLES.SUPERADMIN } },
        attributes: ["role", [fn("COUNT", col("id")), "count"]],
        group: ["role"],
        raw: true,
      }),
      Lead.count({ where: { companyId: company.id } }),
      Branch.count({ where: { companyId: company.id } }),
    ]);

    const seatLimit = seatLimitFor(company, company.plan);
    const now = Date.now();
    let daysRemaining = null;
    let isExpired = false;

    if (company.subscriptionExpiresAt) {
      const expiry = new Date(company.subscriptionExpiresAt).getTime();
      daysRemaining = Math.ceil((expiry - now) / (1000 * 60 * 60 * 24));
      isExpired = expiry < now;
    }

    return res.status(200).json({
      message: "success",
      data: {
        ...serialize(company),
        branches: company.branches || [],
        seatLimit,
        seatsUsed,
        seatsRemaining: seatLimit === null ? null : Math.max(seatLimit - seatsUsed, 0),
        seatUsagePercent: seatLimit ? Math.min(Math.round((seatsUsed / seatLimit) * 100), 100) : null,
        usersByRole: Object.fromEntries(byRole.map((r) => [r.role, Number(r.count)])),
        totalLeads,
        totalBranches,
        subscription: {
          planName: company.plan ? company.plan.name : "Custom / Standard Plan",
          priceMonthly: company.plan ? Number(company.plan.priceMonthly) : 0,
          maxEmployees: seatLimit,
          featuresJson: company.plan?.featuresJson || {
            leads: true,
            calling: true,
            ops: true,
            bankerPortal: true,
            gpsAttendance: true,
          },
          status: company.status,
          expiresAt: company.subscriptionExpiresAt,
          daysRemaining,
          isExpired,
          isTrial: company.status === "trial",
        },
      },
    });
  } catch (error) {
    console.error("[companies] getMyCompanyProfile error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/company/profile
 * Allows company admin to update basic company details (name, email, phone, logoUrl).
 */
exports.updateMyCompanyProfile = async (req, res) => {
  try {
    const companyId =
      req.user.role === ROLES.SUPERADMIN
        ? parseInt(req.body.companyId, 10) || req.user.companyId || 1
        : req.user.companyId;

    if (!companyId) {
      return res.status(400).json({ message: "No company associated with this account" });
    }

    const company = await Company.findByPk(companyId);
    if (!company) return res.status(404).json({ message: "Company not found" });

    const EDITABLE_BY_ADMIN = [
      "name",
      "email",
      "phone",
      "logoUrl",
      "themeConfig",
      "gstNumber",
      "panNumber",
      "address",
      "city",
      "state",
      "pincode",
      "bankName",
      "accountNumber",
      "ifscCode",
      "bankBranch",
    ];
    const data = pick(req.body, EDITABLE_BY_ADMIN);
    if (data.gstNumber) data.gstNumber = data.gstNumber.toUpperCase();
    if (data.panNumber) data.panNumber = data.panNumber.toUpperCase();
    if (data.ifscCode) data.ifscCode = data.ifscCode.toUpperCase();

    if (data.name !== undefined && !String(data.name).trim()) {
      return res.status(400).json({ message: "Company name cannot be empty" });
    }

    const before = { ...company.get({ plain: true }) };
    await company.update(data);

    const diff = diffFields(before, { ...company.get({ plain: true }) }, EDITABLE_BY_ADMIN);
    if (diff) {
      await logActivity(req, {
        recordType: "Other",
        recordId: company.id,
        action: "UPDATED",
        ...diff,
        remarks: "Company profile updated by company admin",
        companyId: company.id,
      });
    }

    return res.status(200).json({
      message: "Company details updated successfully",
      data: serialize(company),
    });
  } catch (error) {
    console.error("[companies] updateMyCompanyProfile error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/platform/upload-logo or POST /api/company/upload-logo
 * Uploads a company logo image file and returns relative URL path.
 */
exports.uploadLogo = async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No logo file uploaded" });
    }
    const logoUrl = `/uploads/logos/${req.file.filename}`;
    return res.status(200).json({
      message: "Logo uploaded successfully",
      logoUrl,
      fileName: req.file.originalname,
    });
  } catch (error) {
    console.error("[companies] uploadLogo error:", error);
    return res.status(500).json({ message: "Failed to upload logo", error: error.message });
  }
};

