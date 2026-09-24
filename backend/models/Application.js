const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Loan Application Entity Model
 * Module 5: Loan Applications & Banker Workflow
 */
const Application = sequelize.define(
  "Application",
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
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "lead_id",
      references: {
        model: "leads",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "customer_id",
      references: {
        model: "customers",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    applicationNumber: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "application_number",
    },
    loanProduct: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "loan_product",
      comment: "Maps to master_configs.value (config_type: LOAN_PRODUCT)",
    },
    appliedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      field: "applied_amount",
    },
    sanctionedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: "sanctioned_amount",
    },
    disbursedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: "disbursed_amount",
    },
    assignedBankerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_banker_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    lenderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "lender_id",
      references: {
        model: "lenders",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "DOCS_PENDING",
      comment: "Maps dynamically to master_configs.value (config_type: APP_STATUS)",
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "rejection_reason",
      comment: "Maps to master_configs.value (config_type: REJECTION_REASON)",
    },
  },
  {
    tableName: "applications",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["company_id", "application_number"],
        name: "unique_company_app_number",
      },
      {
        fields: ["company_id", "status"],
        name: "idx_company_app_status",
      },
      {
        fields: ["company_id", "lender_id"],
        name: "idx_company_app_lender",
      },
      {
        fields: ["company_id", "customer_id"],
        name: "idx_company_app_customer",
      },
    ],
  }
);

module.exports = Application;
