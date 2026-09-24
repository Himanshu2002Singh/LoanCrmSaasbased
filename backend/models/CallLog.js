const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Call Log Model for Telecalling Activities
 * Module 3: Customer & Sales Engine
 */
const CallLog = sequelize.define(
  "CallLog",
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
      allowNull: true,
      field: "lead_id",
      references: {
        model: "leads",
        key: "id",
      },
      onDelete: "SET NULL",
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
    callStatus: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "call_status",
      comment: "Connected / Busy / Call Back Later / Not Picked / Wrong Number",
    },
    durationSec: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "duration_sec",
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    recordingUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "recording_url",
    },
  },
  {
    tableName: "call_logs",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "user_id"],
        name: "idx_company_calls_user",
      },
      {
        fields: ["company_id", "lead_id"],
        name: "idx_company_calls_lead",
      },
    ],
  }
);

module.exports = CallLog;
