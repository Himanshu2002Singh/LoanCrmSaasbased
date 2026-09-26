const { Company, Branch, User, Plan, MasterConfig, sequelize } = require("../models");
const { DEFAULT_MASTER_CONFIGS } = require("../constants/defaultMasterConfigs");
const { ROLES, USER_STATUSES } = require("../constants/roles");

/**
 * Company provisioning.
 *
 * Standing up a company is four writes that have to succeed together: the
 * company, its head-office branch, its first administrator, and the master
 * configs its CRM cannot function without. A company created without lead
 * statuses can never take a lead, so a partial provision is worse than none —
 * everything here runs in one transaction.
 *
 * Both entry points use this: the platform operator creating a company by hand,
 * and (later) a self-serve trial signup, which is the same work without the
 * operator check in front of it.
 */

const slugify = (name) =>
  String(name)
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80);

/**
 * Slugs identify a company, so a clash cannot be silently accepted. Append the
 * smallest numeric suffix that is free.
 */
const uniqueSlug = async (base, transaction = null) => {
  const root = slugify(base) || "company";
  let candidate = root;
  let suffix = 2;

  // eslint-disable-next-line no-await-in-loop
  while (await Company.findOne({ where: { slug: candidate }, transaction })) {
    candidate = `${root}-${suffix}`.slice(0, 80);
    suffix += 1;
  }
  return candidate;
};

const seedMasterConfigs = async (companyId, transaction) =>
  MasterConfig.bulkCreate(
    DEFAULT_MASTER_CONFIGS.map((config) => ({ ...config, companyId, isActive: true })),
    { transaction }
  );

/**
 * Creates a company and everything it needs to be usable on first login.
 *
 * Returns { company, branch, admin }. Throws an Error carrying a `status`
 * property for anything the caller should report as a 4xx.
 */
const provisionCompany = async ({
  name,
  email = null,
  phone = null,
  slug = null,
  logoUrl = null,
  planId = null,
  status = "trial",
  maxUsers = null,
  subscriptionExpiresAt = null,
  branch = {},
  admin = {},
}) => {
  if (!name || !String(name).trim()) {
    throw Object.assign(new Error("Company name is required"), { status: 400 });
  }
  if (!admin.name || !admin.phone) {
    throw Object.assign(new Error("An admin name and phone are required"), { status: 400 });
  }
  if (!admin.password || String(admin.password).length < 8) {
    throw Object.assign(new Error("Admin password must be at least 8 characters"), { status: 400 });
  }
  if (!["active", "trial", "suspended"].includes(status)) {
    throw Object.assign(new Error("status must be active, trial or suspended"), { status: 400 });
  }

  let plan = null;
  if (planId) {
    plan = await Plan.findByPk(planId);
    if (!plan) throw Object.assign(new Error("Plan not found"), { status: 404 });
  }

  // A company may be given fewer seats than the plan allows, never more.
  const seatCeiling = plan ? plan.maxEmployees : null;
  let seats = maxUsers ? parseInt(maxUsers, 10) : seatCeiling;
  if (seats && seatCeiling && seats > seatCeiling) seats = seatCeiling;

  return sequelize.transaction(async (transaction) => {
    const resolvedSlug = await uniqueSlug(slug || name, transaction);

    const company = await Company.create(
      {
        name: String(name).trim(),
        slug: resolvedSlug,
        email,
        phone,
        logoUrl: logoUrl ? String(logoUrl).trim() : null,
        planId: plan ? plan.id : null,
        status,
        ...(seats ? { maxUsers: seats } : {}),
        subscriptionExpiresAt,
      },
      { transaction }
    );

    const headOffice = await Branch.create(
      {
        companyId: company.id,
        name: branch.name || "Head Office",
        city: branch.city || null,
        state: branch.state || null,
        address: branch.address || null,
        officeLat: branch.officeLat ?? null,
        officeLng: branch.officeLng ?? null,
        ...(branch.geoRadiusMeters ? { geoRadiusMeters: branch.geoRadiusMeters } : {}),
      },
      { transaction }
    );

    const companyAdmin = await User.create(
      {
        companyId: company.id,
        branchId: headOffice.id,
        name: String(admin.name).trim(),
        email: admin.email || null,
        phone: String(admin.phone).trim(),
        password: admin.password,
        role: ROLES.COMPANY_ADMIN,
        status: USER_STATUSES.ACTIVE,
      },
      { transaction }
    );

    await seedMasterConfigs(company.id, transaction);

    return { company, branch: headOffice, admin: companyAdmin };
  });
};

/**
 * Seats a company may fill: if the company has a custom limit set on company.maxUsers,
 * that limit takes precedence. Otherwise falls back to plan.maxEmployees.
 */
const seatLimitFor = (company, plan) => {
  if (company && Number.isInteger(company.maxUsers) && company.maxUsers > 0) {
    return company.maxUsers;
  }
  if (plan && Number.isInteger(plan.maxEmployees) && plan.maxEmployees > 0) {
    return plan.maxEmployees;
  }
  return null;
};

/**
 * Whether a company may currently be used at all. Returns null when fine, or a
 * { status, message } the caller should answer with.
 */
const subscriptionBlock = (company) => {
  if (!company) return null;

  if (company.status === "suspended") {
    return {
      status: 403,
      code: "COMPANY_SUSPENDED",
      message: "Your company account has been suspended. Please contact platform support to reactivate your account.",
      planStatus: "suspended",
    };
  }

  if (company.subscriptionExpiresAt && new Date(company.subscriptionExpiresAt) < new Date()) {
    const expiredDate = new Date(company.subscriptionExpiresAt);
    const dateFormatted = !isNaN(expiredDate.getTime())
      ? expiredDate.toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })
      : "";
    return {
      status: 403,
      code: "SUBSCRIPTION_EXPIRED",
      message: `Your company's subscription plan ${dateFormatted ? `expired on ${dateFormatted}` : "has expired"}. Please contact your administrator or support to renew the plan.`,
      planStatus: "expired",
      expiredAt: company.subscriptionExpiresAt,
    };
  }

  return null;
};

module.exports = {
  provisionCompany,
  seedMasterConfigs,
  seatLimitFor,
  subscriptionBlock,
  uniqueSlug,
  slugify,
};
