const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Master Configurations Model (Company-wise customizable statuses & products)
 * Module 6: Master Configs, Attendance & Audit Engine
 */
const MasterConfig = sequelize.define(
  "MasterConfig",
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
    configType: {
      type: DataTypes.ENUM(
        "LEAD_STATUS",
        "APP_STATUS",
        "LOAN_PRODUCT",
        "DOC_TYPE",
        "LEAD_SOURCE",
        "REJECTION_REASON",
        "QUERY_REASON"
      ),
      allowNull: false,
      field: "config_type",
    },
    label: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    value: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    colorCode: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "color_code",
    },
    orderIndex: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 100,
      field: "order_index",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
    team: {
      type: DataTypes.STRING(20),
      allowNull: true,
      defaultValue: null,
      field: "team",
      comment: "calling, operations, or both",
    },
    commissionPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      defaultValue: null,
      field: "commission_percent",
      comment: "Default commission percentage for source/product",
    },
    code: {
      type: DataTypes.STRING(50),
      allowNull: true,
      defaultValue: null,
      field: "code",
      comment: "Party / Connector identifier code (e.g. PTY-001)",
    },
  },
  {
    tableName: "master_configs",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "config_type", "order_index"],
        name: "idx_company_config_type_order",
      },
    ],
  }
);

module.exports = MasterConfig;
