const { Plan, Company } = require("../models");
const { buildQuery, paginated } = require("../utils/query");

/**
 * The plan catalogue the platform sells. Plans are global, not company-owned,
 * so nothing here is company-scoped and every route sits behind
 * requireSuperAdmin.
 */
const SEARCHABLE = ["name"];
const SORTABLE = ["name", "priceMonthly", "maxEmployees", "createdAt"];
const EDITABLE = ["name", "priceMonthly", "maxEmployees", "featuresJson"];

const pick = (body, fields) => {
  const data = {};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    data[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
  }
  return data;
};

const validate = (data) => {
  if (data.priceMonthly !== undefined && Number(data.priceMonthly) < 0) {
    return "priceMonthly cannot be negative";
  }
  if (data.maxEmployees !== undefined && Number(data.maxEmployees) < 1) {
    return "maxEmployees must be at least 1";
  }
  if (data.featuresJson !== undefined && (typeof data.featuresJson !== "object" || Array.isArray(data.featuresJson))) {
    return "featuresJson must be an object of feature flags";
  }
  return null;
};

/**
 * GET /api/platform/plans
 */
exports.getPlans = async (req, res) => {
  try {
    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: SEARCHABLE,
      sortable: SORTABLE,
      defaultSort: ["priceMonthly", "ASC"],
      defaultLimit: 50,
    });

    const { count, rows } = await Plan.findAndCountAll({ where, limit, offset, order });

    // Company counts turn the catalogue into something the operator can act on.
    const inUse = await Company.findAll({
      attributes: ["planId"],
      raw: true,
    });
    const companiesPerPlan = inUse.reduce((acc, row) => {
      acc[row.planId] = (acc[row.planId] || 0) + 1;
      return acc;
    }, {});

    const data = rows.map((plan) => ({
      ...plan.get({ plain: true }),
      companyCount: companiesPerPlan[plan.id] || 0,
    }));

    return res.status(200).json(paginated({ count, rows: data, page, limit }));
  } catch (error) {
    console.error("[plans] getPlans error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/platform/plans/:id
 */
exports.getPlanById = async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const companyCount = await Company.count({ where: { planId: plan.id } });
    return res.status(200).json({ message: "success", data: { ...plan.get({ plain: true }), companyCount } });
  } catch (error) {
    console.error("[plans] getPlanById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/platform/plans
 */
exports.createPlan = async (req, res) => {
  try {
    const data = pick(req.body, EDITABLE);
    if (!data.name) return res.status(400).json({ message: "name is required" });

    const invalid = validate(data);
    if (invalid) return res.status(400).json({ message: invalid });

    const clash = await Plan.findOne({ where: { name: data.name } });
    if (clash) return res.status(409).json({ message: "A plan with this name already exists" });

    const plan = await Plan.create(data);
    return res.status(201).json({ message: "Plan created", data: plan });
  } catch (error) {
    console.error("[plans] createPlan error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/platform/plans/:id
 *
 * Lowering maxEmployees is allowed, but companies already over the new ceiling
 * are reported back rather than silently left in breach.
 */
exports.updatePlan = async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const data = pick(req.body, EDITABLE);
    const invalid = validate(data);
    if (invalid) return res.status(400).json({ message: invalid });

    if (data.name && data.name !== plan.name) {
      const clash = await Plan.findOne({ where: { name: data.name } });
      if (clash) return res.status(409).json({ message: "A plan with this name already exists" });
    }

    await plan.update(data);

    let warning = null;
    if (data.maxEmployees !== undefined) {
      const overCapacity = await Company.count({
        where: { planId: plan.id, maxUsers: { [require("sequelize").Op.gt]: plan.maxEmployees } },
      });
      if (overCapacity) {
        warning = `${overCapacity} company/companies are provisioned above the new seat ceiling`;
      }
    }

    return res.status(200).json({ message: "Plan updated", data: plan, ...(warning ? { warning } : {}) });
  } catch (error) {
    console.error("[plans] updatePlan error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/platform/plans/:id
 * Refused while companies are on the plan, because companies.plan_id would be
 * left pointing at a row that no longer exists.
 */
exports.deletePlan = async (req, res) => {
  try {
    const plan = await Plan.findByPk(req.params.id);
    if (!plan) return res.status(404).json({ message: "Plan not found" });

    const companyCount = await Company.count({ where: { planId: plan.id } });
    if (companyCount) {
      return res.status(409).json({
        message: `${companyCount} company/companies are on this plan. Move them to another plan first.`,
        companyCount,
      });
    }

    await plan.destroy();
    return res.status(200).json({ message: "Plan deleted" });
  } catch (error) {
    console.error("[plans] deletePlan error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
