const { Op } = require("sequelize");
const { Lender, Application } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");

const SEARCHABLE = ["name", "shortCode", "contactPerson"];
const SORTABLE = ["name", "lenderType", "createdAt"];

/**
 * The accepted lender types are read straight off the column definition, so the
 * validation can never drift from what the ENUM will actually store.
 */
const LENDER_TYPE_VALUES = Lender.getAttributes().lenderType.values;

const LENDER_FIELDS = [
  "name",
  "shortCode",
  "lenderType",
  "contactPerson",
  "supportedLoanProducts",
  "payoutCommissionPercent",
  "isActive",
];

/**
 * The panel writes snake_case; the models are camelCase. Translate at the edge
 * so neither side has to know about the other's convention.
 */
const LENDER_ALIASES = {
  short_code: "shortCode",
  lender_type: "lenderType",
  contact_person: "contactPerson",
  supported_loan_products: "supportedLoanProducts",
  supportedLoanProducts: "supportedLoanProducts",
  commission_percent: "payoutCommissionPercent",
  payout_commission_percent: "payoutCommissionPercent",
  is_active: "isActive",
};

const pick = (body, fields, aliases = {}) => {
  const data = {};
  const source = { ...body };
  for (const [from, to] of Object.entries(aliases)) {
    if (source[from] !== undefined && source[to] === undefined) source[to] = source[from];
  }
  for (const field of fields) {
    if (source[field] === undefined) continue;
    if (field === "supportedLoanProducts") {
      if (Array.isArray(source[field])) {
        data[field] = source[field];
      } else if (typeof source[field] === "string") {
        try {
          data[field] = JSON.parse(source[field]);
        } catch {
          data[field] = source[field] ? [source[field]] : [];
        }
      } else {
        data[field] = [];
      }
    } else {
      data[field] = typeof source[field] === "string" ? source[field].trim() : source[field];
    }
  }
  return data;
};

const serializeLender = (lender) => {
  let products = lender.supportedLoanProducts;
  if (typeof products === "string") {
    try {
      products = JSON.parse(products);
    } catch {
      products = [];
    }
  }
  if (!Array.isArray(products)) {
    products = [];
  }

  return {
    lender_id: lender.id,
    id: lender.id,
    name: lender.name,
    short_code: lender.shortCode,
    lender_type: lender.lenderType,
    contact_person: lender.contactPerson,
    supported_loan_products: products,
    commission_percent: lender.payoutCommissionPercent,
    is_active: lender.isActive,
    createdAt: lender.createdAt,
    updatedAt: lender.updatedAt,
  };
};

const loadLender = async (req, id) => {
  const lender = await Lender.findByPk(id);
  if (!lender || !belongsToScope(req, lender)) return null;
  return lender;
};

/**
 * GET /api/lenders
 * ?page&limit&search&sortBy&sortDir&lender_type&includeInactive
 */
exports.getLenders = async (req, res) => {
  try {
    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: SEARCHABLE,
      sortable: SORTABLE,
      defaultSort: ["name", "ASC"],
      defaultLimit: 100,
    });

    Object.assign(where, companyScope(req));
    if (req.query.includeInactive !== "true") where.isActive = true;

    const lenderType = req.query.lender_type || req.query.lenderType;
    if (lenderType) {
      if (!LENDER_TYPE_VALUES.includes(lenderType)) {
        return res.status(400).json({ message: `lender_type must be one of: ${LENDER_TYPE_VALUES.join(", ")}` });
      }
      where.lenderType = lenderType;
    }

    const { count, rows } = await Lender.findAndCountAll({
      where,
      limit,
      offset,
      order,
    });

    const payload = paginated({ count, rows: rows.map(serializeLender), page, limit });
    payload.pagination.totalItems = count;
    // The lenders screen reads a bare `lenders` array.
    payload.lenders = payload.data;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[lenders] getLenders error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/lenders/:id
 */
exports.getLenderById = async (req, res) => {
  try {
    const lender = await Lender.findByPk(req.params.id);
    if (!lender || !belongsToScope(req, lender)) {
      return res.status(404).json({ message: "Lender not found" });
    }
    return res.status(200).json({ message: "success", data: serializeLender(lender) });
  } catch (error) {
    console.error("[lenders] getLenderById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/lenders
 */
exports.createLender = async (req, res) => {
  try {
    const data = pick(req.body, LENDER_FIELDS, LENDER_ALIASES);

    if (!data.name) return res.status(400).json({ message: "name is required" });
    if (!data.lenderType || !LENDER_TYPE_VALUES.includes(data.lenderType)) {
      return res.status(400).json({ message: `lender_type must be one of: ${LENDER_TYPE_VALUES.join(", ")}` });
    }

    const companyId = req.user.companyId || parseInt(req.body.companyId, 10);
    if (!companyId) return res.status(400).json({ message: "companyId is required" });

    if (data.name) {
      const nameClash = await Lender.findOne({ where: { companyId, name: data.name } });
      if (nameClash) return res.status(409).json({ message: "A lender with this name already exists" });
    }

    if (data.shortCode) {
      const clash = await Lender.findOne({ where: { companyId, shortCode: data.shortCode } });
      if (clash) return res.status(409).json({ message: "A lender with this short code already exists" });
    }

    const lender = await Lender.create({ ...data, companyId });

    await logActivity(req, {
      recordType: "Lender",
      recordId: lender.id,
      action: "CREATED",
      newValue: { name: lender.name, lenderType: lender.lenderType },
      companyId,
    });

    return res.status(201).json({ message: "Lender created", data: serializeLender(lender) });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "A lender with this name or short code already exists" });
    }
    console.error("[lenders] createLender error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/lenders/:id
 */
exports.updateLender = async (req, res) => {
  try {
    const lender = await loadLender(req, req.params.id);
    if (!lender) return res.status(404).json({ message: "Lender not found" });

    const data = pick(req.body, LENDER_FIELDS, LENDER_ALIASES);
    if (data.lenderType && !LENDER_TYPE_VALUES.includes(data.lenderType)) {
      return res.status(400).json({ message: `lender_type must be one of: ${LENDER_TYPE_VALUES.join(", ")}` });
    }
    if (data.name) {
      const nameClash = await Lender.findOne({
        where: { companyId: lender.companyId, name: data.name, id: { [Op.ne]: lender.id } },
      });
      if (nameClash) return res.status(409).json({ message: "A lender with this name already exists" });
    }
    if (data.shortCode) {
      const clash = await Lender.findOne({
        where: { companyId: lender.companyId, shortCode: data.shortCode, id: { [Op.ne]: lender.id } },
      });
      if (clash) return res.status(409).json({ message: "A lender with this short code already exists" });
    }

    const before = { ...lender.get({ plain: true }) };
    await lender.update(data);

    const diff = diffFields(before, { ...lender.get({ plain: true }) }, LENDER_FIELDS);
    if (diff) {
      await logActivity(req, {
        recordType: "Lender",
        recordId: lender.id,
        action: "UPDATED",
        ...diff,
        companyId: lender.companyId,
      });
    }

    return res.status(200).json({ message: "Lender updated", data: serializeLender(lender) });
  } catch (error) {
    if (error.name === "SequelizeUniqueConstraintError") {
      return res.status(409).json({ message: "A lender with this name or short code already exists" });
    }
    console.error("[lenders] updateLender error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/lenders/:id
 * Deactivates by default, since applications point at the lender. ?hard=true
 * removes one that nothing references.
 */
exports.deleteLender = async (req, res) => {
  try {
    const lender = await loadLender(req, req.params.id);
    if (!lender) return res.status(404).json({ message: "Lender not found" });

    const applicationCount = await Application.count({ where: { lenderId: lender.id } });

    if (req.query.hard === "true") {
      if (applicationCount) {
        return res.status(409).json({
          message: `${applicationCount} application(s) reference this lender; deactivate it instead`,
        });
      }
      await logActivity(req, {
        recordType: "Lender",
        recordId: lender.id,
        action: "DELETED",
        oldValue: { name: lender.name },
        companyId: lender.companyId,
      });
      await lender.destroy();
      return res.status(200).json({ message: "Lender deleted" });
    }

    await lender.update({ isActive: false });
    await logActivity(req, {
      recordType: "Lender",
      recordId: lender.id,
      action: "STATUS_CHANGED",
      oldValue: { isActive: true },
      newValue: { isActive: false },
      companyId: lender.companyId,
    });

    return res.status(200).json({ message: "Lender deactivated", data: serializeLender(lender) });
  } catch (error) {
    console.error("[lenders] deleteLender error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
