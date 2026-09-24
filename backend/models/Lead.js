const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Lead Intent & Opportunity Model
 * Module 3: Customer & Sales Engine
 */
const Lead = sequelize.define(
  "Lead",
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
    leadSource: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "lead_source",
      comment: "Maps to master_configs.value (config_type: LEAD_SOURCE)",
    },
    loanType: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "loan_type",
      comment: "Maps to master_configs.value (config_type: LOAN_PRODUCT)",
    },
    requiredAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: "required_amount",
    },
    assignedEmployeeId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_employee_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    assignedManagerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_manager_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    status: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "NEW",
      comment: "Maps dynamically to master_configs.value (config_type: LEAD_STATUS)",
    },
    priority: {
      type: DataTypes.ENUM("HIGH", "MEDIUM", "LOW"),
      allowNull: false,
      defaultValue: "MEDIUM",
    },
    nextFollowupDate: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "next_followup_date",
    },
    commissionPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: null,
      field: "commission_percent",
      comment: "Lead-wise commission percentage for source/party",
    },
  },
  {
    tableName: "leads",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "status"],
        name: "idx_company_lead_status",
      },
      {
        fields: ["company_id", "assigned_employee_id"],
        name: "idx_company_lead_employee",
      },
      {
        fields: ["company_id", "customer_id"],
        name: "idx_company_lead_customer",
      },
      {
        fields: ["company_id", "created_at"],
        name: "idx_company_lead_created",
      },
    ],
  }
);

module.exports = Lead;
