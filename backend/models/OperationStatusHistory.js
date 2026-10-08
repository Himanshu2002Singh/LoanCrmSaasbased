const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Operation Status History Model
 * Module 4/5: Operations Workflow & Audit Engine
 * Tracks all workflow stage transitions, sub-status changes (Legal, Technical, PDD, OTC, Disbursement),
 * remarks, timestamps, and actors.
 */
const OperationStatusHistory = sequelize.define(
  "OperationStatusHistory",
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
      allowNull: true,
      field: "application_id",
      references: {
        model: "applications",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    leadId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "lead_id",
      references: {
        model: "leads",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    statusType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "status_type",
      comment: "STAGE, LEGAL, TECHNICAL, PDD, OTC, DISBURSEMENT",
    },
    oldStatus: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "old_status",
    },
    newStatus: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "new_status",
    },
    remark: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    updatedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "updated_by",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "operation_status_histories",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "application_id"],
        name: "idx_ops_history_app",
      },
      {
        fields: ["company_id", "status_type"],
        name: "idx_ops_history_type",
      },
    ],
  }
);

module.exports = OperationStatusHistory;
