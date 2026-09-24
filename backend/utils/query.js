const { Op } = require("sequelize");

const DEFAULT_LIMIT = 20;
const MAX_LIMIT = 200;

/**
 * Turns the ?page/?limit/?search/?sortBy/?sortDir query string into Sequelize
 * findAndCountAll options.
 *
 * Every controller passes its own whitelist so a caller can never sort or
 * search on a column we did not intend to expose (and never on a raw string
 * that reaches SQL).
 *
 *   const { limit, offset, order, where, page } = buildQuery(req.query, {
 *     searchable: ["name", "email"],
 *     sortable: ["name", "createdAt"],
 *     defaultSort: ["createdAt", "DESC"],
 *   });
 */
const buildQuery = (query = {}, options = {}) => {
  const {
    searchable = [],
    sortable = [],
    defaultSort = ["createdAt", "DESC"],
    defaultLimit = DEFAULT_LIMIT,
  } = options;

  const page = Math.max(parseInt(query.page, 10) || 1, 1);

  const requestedLimit = parseInt(query.limit, 10);
  const limit = Math.min(
    Number.isNaN(requestedLimit) || requestedLimit < 1 ? defaultLimit : requestedLimit,
    MAX_LIMIT
  );

  const offset = (page - 1) * limit;

  const search = typeof query.search === "string" ? query.search.trim() : "";
  const where = {};
  if (search && searchable.length) {
    where[Op.or] = searchable.map((field) => ({ [field]: { [Op.like]: `%${search}%` } }));
  }

  const sortDir = String(query.sortDir || "").toUpperCase() === "ASC" ? "ASC" : "DESC";
  const sortBy = sortable.includes(query.sortBy) ? query.sortBy : defaultSort[0];
  const order = [[sortBy, sortable.includes(query.sortBy) ? sortDir : defaultSort[1]]];

  return { page, limit, offset, where, order, search, sortBy, sortDir };
};

/**
 * Uniform list envelope so every paginated endpoint answers the same shape.
 */
const paginated = ({ count, rows, page, limit }) => ({
  message: "success",
  data: rows,
  pagination: {
    page,
    limit,
    total: count,
    totalPages: Math.max(Math.ceil(count / limit), 1),
  },
});

module.exports = { buildQuery, paginated, DEFAULT_LIMIT, MAX_LIMIT };
