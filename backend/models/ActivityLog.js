const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Universal Immutable Audit Trail Model
 * Module 6: Master Configs, Attendance & Audit Engine
 */
const ActivityLog = sequelize.define(
  "ActivityLog",
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
    recordType: {
      type: DataTypes.ENUM(
        "Lead",
        "Application",
        "Customer",
        "Document",
        "Attendance",
        "User",
        "Branch",
        "Lender",
        "Other"
      ),
      allowNull: false,
      field: "record_type",
    },
    recordId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "record_id",
    },
    action: {
      type: DataTypes.ENUM(
        "CREATED",
        "STATUS_CHANGED",
        "ASSIGNED",
        "DOC_UPLOADED",
        "VERIFIED",
        "QUERY_RAISED",
        "DISBURSED",
        "UPDATED",
        "DELETED"
      ),
      allowNull: false,
    },
    oldValue: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "old_value",
    },
    newValue: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "new_value",
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    actorUserId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "actor_user_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    sourcePanel: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "source_panel",
      comment: "Admin Panel / Ops Portal / Banker Portal / Mobile App",
    },
    ipAddress: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "ip_address",
    },
  },
  {
    tableName: "activity_logs",
    timestamps: true,
    updatedAt: false, // Immutable audit trail (only created_at)
    indexes: [
      {
        fields: ["company_id", "record_type", "record_id"],
        name: "idx_company_record_activity",
      },
      {
        fields: ["company_id", "actor_user_id"],
        name: "idx_company_actor_activity",
      },
    ],
  }
);

module.exports = ActivityLog;
