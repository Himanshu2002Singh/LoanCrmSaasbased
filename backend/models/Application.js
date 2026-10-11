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
    pdStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "PENDING",
      field: "pd_status",
      comment: "PENDING, COMPLETED",
    },
    pdRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "pd_remark",
    },
    pdUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "pd_updated_at",
    },
    pdUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "pd_updated_by",
    },
    opsQueryStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "NONE",
      field: "ops_query_status",
      comment: "NONE, PENDING, COMPLETED",
    },
    opsQueryRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "ops_query_remark",
    },
    opsQueryUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "ops_query_updated_at",
    },
    opsQueryUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "ops_query_updated_by",
    },
    legalStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      field: "legal_status",
      comment: "INITIATED, RESOLVED, REJECTED",
    },
    legalRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "legal_remark",
    },
    legalUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "legal_updated_at",
    },
    legalUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "legal_updated_by",
    },
    technicalStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      field: "technical_status",
      comment: "INITIATED, RESOLVED, REJECTED",
    },
    technicalRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "technical_remark",
    },
    technicalUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "technical_updated_at",
    },
    technicalUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "technical_updated_by",
    },
    pddStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      field: "pdd_status",
      comment: "PENDING, RESOLVED",
    },
    pddRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "pdd_remark",
    },
    pddUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "pdd_updated_at",
    },
    pddUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "pdd_updated_by",
    },
    otcStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      field: "otc_status",
      comment: "PENDING, RESOLVED",
    },
    otcRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "otc_remark",
    },
    otcUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "otc_updated_at",
    },
    otcUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "otc_updated_by",
    },
    loginStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "PENDING",
      field: "login_status",
      comment: "PENDING, COMPLETED",
    },
    loginRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "login_remark",
    },
    loginUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "login_updated_at",
    },
    loginUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "login_updated_by",
    },
    sanctionStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      field: "sanction_status",
      comment: "PENDING, SANCTIONED, REJECTED",
    },
    sanctionRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "sanction_remark",
    },
    sanctionUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "sanction_updated_at",
    },
    sanctionUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "sanction_updated_by",
    },
    disbursementStatus: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: "PENDING",
      field: "disbursement_status",
      comment: "PENDING, COMPLETED, CANCELLED",
    },
    disbursedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "disbursed_at",
    },
    disbursedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "disbursed_by",
    },
    disbursedRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "disbursed_remark",
    },
    lastOpsRemark: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "last_ops_remark",
    },
    lastOpsUpdatedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_ops_updated_at",
    },
    lastOpsUpdatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "last_ops_updated_by",
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
