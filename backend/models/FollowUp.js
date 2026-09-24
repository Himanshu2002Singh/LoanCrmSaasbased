const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Follow-Up & Reminder Model
 * Module 3: Customer & Sales Engine
 */
const FollowUp = sequelize.define(
  "FollowUp",
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
    userId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "user_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    scheduledAt: {
      type: DataTypes.DATE,
      allowNull: false,
      field: "scheduled_at",
    },
    reminderType: {
      type: DataTypes.ENUM("15m", "30m", "1h", "same_day"),
      allowNull: false,
      defaultValue: "15m",
      field: "reminder_type",
    },
    status: {
      type: DataTypes.ENUM("PENDING", "COMPLETED", "OVERDUE"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "follow_ups",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "user_id", "status"],
        name: "idx_company_user_followups",
      },
      {
        fields: ["company_id", "scheduled_at"],
        name: "idx_company_followups_schedule",
      },
    ],
  }
);

module.exports = FollowUp;
