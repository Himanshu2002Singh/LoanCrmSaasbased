require("dotenv").config();
const { Sequelize } = require("sequelize");

/**
 * Sequelize MySQL Database Connection
 * Configured with IST (+05:30) timezone fix, connection pooling, and UTF8MB4 support.
 */
const sequelize = new Sequelize(
  process.env.DB_NAME || "crmdb",
  process.env.DB_USER || process.env.DBUSER || "root",
  process.env.DB_PASSWORD ?? process.env.DBPASS ?? "1234",
  {
    host: process.env.DB_HOST || "localhost",
    port: parseInt(process.env.DB_PORT || "3306", 10),
    dialect: "mysql",

    // Timezone setting for queries and connection session
    timezone: process.env.DB_TIMEZONE || "+05:30",

    dialectOptions: {
      // Return date strings directly from MySQL to prevent local JS Date object timezone shift
      dateStrings: true,
      typeCast: function (field, next) {
        if (field.type === "DATETIME" || field.type === "TIMESTAMP" || field.type === "DATE") {
          return field.string();
        }
        return next();
      },
      decimalNumbers: true,
    },

    pool: {
      max: parseInt(process.env.DB_POOL_MAX || "20", 10),
      min: parseInt(process.env.DB_POOL_MIN || "2", 10),
      acquire: 30000,
      idle: 10000,
    },

    logging: process.env.DB_LOGGING === "true" ? (msg) => console.log(`[Sequelize] ${msg}`) : false,

    define: {
      timestamps: true,
      underscored: true, // snake_case columns (e.g. company_id, created_at, updated_at)
      charset: "utf8mb4",
      collate: "utf8mb4_unicode_ci",
    },
  }
);

module.exports = sequelize;
