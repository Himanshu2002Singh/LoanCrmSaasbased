const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Banker ↔ Ops Clarification Query Model
 * Module 5: Loan Applications & Banker Workflow
 */
const BankerQuery = sequelize.define(
  "BankerQuery",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "company_id",
      references: {
        model: "companies",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "application_id",
      references: {
        model: "applications",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    bankerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "banker_id",
      references: {
        model: "users",
        key: "id",
      },
    },
    queryText: {
      type: DataTypes.TEXT,
      allowNull: false,
      field: "query_text",
    },
    status: {
      type: DataTypes.ENUM("OPEN", "RESOLVED"),
      allowNull: false,
      defaultValue: "OPEN",
    },
    responseText: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "response_text",
    },
    resolvedByOpsId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "resolved_by_ops_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "banker_queries",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "application_id", "status"],
        name: "idx_company_app_queries",
      },
    ],
  }
);

module.exports = BankerQuery;
