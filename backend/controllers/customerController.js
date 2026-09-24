const { Op } = require("sequelize");
const { Customer, Lead, Application, Document } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");

const SEARCHABLE = ["name", "mobile", "alternateMobile", "email", "panNumber", "city"];
const SORTABLE = ["name", "mobile", "city", "createdAt"];
const EDITABLE = [
  "name",
  "mobile",
  "alternateMobile",
  "email",
  "panNumber",
  "aadhaarMasked",
  "city",
  "employmentType",
  "monthlyIncome",
];

const pick = (body, fields) => {
  const data = {};
  for (const field of fields) {
    if (body[field] === undefined) continue;
    data[field] = typeof body[field] === "string" ? body[field].trim() : body[field];
  }
  return data;
};

const normaliseMobile = (value) => String(value || "").replace(/\D/g, "").slice(-10);

/**
 * A person is one customer per company, keyed on mobile. Callers that create
 * leads reuse this so a repeat enquiry attaches to the existing customer
 * instead of duplicating them.
 */
const findOrCreateCustomer = async (companyId, payload, transaction = null) => {
  const mobile = normaliseMobile(payload.mobile);
  if (!mobile || mobile.length < 10) {
    throw Object.assign(new Error("A valid 10-digit mobile number is required"), { status: 400 });
  }
  if (!payload.name || !String(payload.name).trim()) {
    throw Object.assign(new Error("Customer name is required"), { status: 400 });
  }

  const existing = await Customer.findOne({ where: { companyId, mobile }, transaction });
  if (existing) {
    // Fill blanks the caller supplied, but never overwrite what is already known.
    const fill = {};
    for (const field of EDITABLE) {
      if (field === "mobile") continue;
      if (payload[field] && !existing[field]) fill[field] = payload[field];
    }
    if (Object.keys(fill).length) await existing.update(fill, { transaction });
    return { customer: existing, created: false };
  }

  const customer = await Customer.create(
    { ...pick(payload, EDITABLE), mobile, companyId },
    { transaction }
  );
  return { customer, created: true };
};

/**
 * GET /api/customers
 */
exports.getCustomers = async (req, res) => {
  try {
    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: SEARCHABLE,
      sortable: SORTABLE,
      defaultSort: ["createdAt", "DESC"],
    });

    Object.assign(where, companyScope(req));
    if (req.query.city) where.city = req.query.city;
    if (req.query.employmentType) where.employmentType = req.query.employmentType;

    const { count, rows } = await Customer.findAndCountAll({ where, limit, offset, order });
    return res.status(200).json(paginated({ count, rows, page, limit }));
  } catch (error) {
    console.error("[customers] getCustomers error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/customers/:id - the customer with their full lead and application
 * history, which is what the 360 view needs.
 */
exports.getCustomerById = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id, {
      include: [
        { model: Lead, as: "leads", separate: true, order: [["createdAt", "DESC"]] },
        { model: Application, as: "applications", separate: true, order: [["createdAt", "DESC"]] },
        { model: Document, as: "documents", separate: true, order: [["createdAt", "DESC"]] },
      ],
    });

    if (!customer || !belongsToScope(req, customer)) {
      return res.status(404).json({ message: "Customer not found" });
    }

    return res.status(200).json({ message: "success", data: customer });
  } catch (error) {
    console.error("[customers] getCustomerById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/customers/by-mobile/:mobile - duplicate check before creating a lead.
 */
exports.getCustomerByMobile = async (req, res) => {
  try {
    const mobile = normaliseMobile(req.params.mobile);
    const customer = await Customer.findOne({
      where: { ...companyScope(req), mobile },
      include: [{ model: Lead, as: "leads", separate: true, order: [["createdAt", "DESC"]] }],
    });

    if (!customer) {
      return res.status(404).json({ message: "No customer with this mobile number" });
    }

    return res.status(200).json({ message: "success", data: customer });
  } catch (error) {
    console.error("[customers] getCustomerByMobile error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/customers
 */
exports.createCustomer = async (req, res) => {
  try {
    const companyId = req.user.companyId || parseInt(req.body.companyId, 10);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    const { customer, created } = await findOrCreateCustomer(companyId, req.body);

    if (created) {
      await logActivity(req, {
        recordType: "Customer",
        recordId: customer.id,
        action: "CREATED",
        newValue: { name: customer.name, mobile: customer.mobile },
        companyId,
      });
    }

    return res.status(created ? 201 : 200).json({
      message: created ? "Customer created" : "Customer already existed",
      created,
      data: customer,
    });
  } catch (error) {
    if (error.status) return res.status(error.status).json({ message: error.message });
    console.error("[customers] createCustomer error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/customers/:id
 */
exports.updateCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer || !belongsToScope(req, customer)) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const data = pick(req.body, EDITABLE);
    if (data.mobile) {
      data.mobile = normaliseMobile(data.mobile);
      if (data.mobile.length < 10) {
        return res.status(400).json({ message: "A valid 10-digit mobile number is required" });
      }
      const clash = await Customer.findOne({
        where: { companyId: customer.companyId, mobile: data.mobile, id: { [Op.ne]: customer.id } },
      });
      if (clash) {
        return res.status(409).json({ message: "Another customer already uses this mobile number" });
      }
    }

    const before = { ...customer.get({ plain: true }) };
    await customer.update(data);

    const diff = diffFields(before, { ...customer.get({ plain: true }) }, EDITABLE);
    if (diff) {
      await logActivity(req, {
        recordType: "Customer",
        recordId: customer.id,
        action: "UPDATED",
        ...diff,
        companyId: customer.companyId,
      });
    }

    return res.status(200).json({ message: "Customer updated", data: customer });
  } catch (error) {
    console.error("[customers] updateCustomer error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/customers/:id - refused while leads or applications reference
 * them, since the customer is the spine of both.
 */
exports.deleteCustomer = async (req, res) => {
  try {
    const customer = await Customer.findByPk(req.params.id);
    if (!customer || !belongsToScope(req, customer)) {
      return res.status(404).json({ message: "Customer not found" });
    }

    const [leadCount, appCount] = await Promise.all([
      Lead.count({ where: { customerId: customer.id } }),
      Application.count({ where: { customerId: customer.id } }),
    ]);

    if (leadCount || appCount) {
      return res.status(409).json({
        message: `Customer has ${leadCount} lead(s) and ${appCount} application(s) and cannot be deleted`,
      });
    }

    await logActivity(req, {
      recordType: "Customer",
      recordId: customer.id,
      action: "DELETED",
      oldValue: { name: customer.name, mobile: customer.mobile },
      companyId: customer.companyId,
    });

    await customer.destroy();
    return res.status(200).json({ message: "Customer deleted" });
  } catch (error) {
    console.error("[customers] deleteCustomer error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.findOrCreateCustomer = findOrCreateCustomer;
exports.normaliseMobile = normaliseMobile;
exports.CUSTOMER_FIELDS = EDITABLE;
