const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Attendance Model with GPS Check-In/Out & Manual Override
 * Module 6: Master Configs, Attendance & Audit Engine
 */
const Attendance = sequelize.define(
  "Attendance",
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
    date: {
      type: DataTypes.DATEONLY,
      allowNull: false,
    },
    checkInTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "check_in_time",
    },
    checkInLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: "check_in_lat",
    },
    checkInLng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: "check_in_lng",
    },
    checkOutTime: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "check_out_time",
    },
    checkOutLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: "check_out_lat",
    },
    checkOutLng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: "check_out_lng",
    },
    workingHours: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: "working_hours",
    },
    status: {
      type: DataTypes.ENUM("PRESENT", "HALF_DAY", "LATE", "ABSENT"),
      allowNull: false,
      defaultValue: "PRESENT",
    },
    isManualOverride: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_manual_override",
    },
    overrideReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "override_reason",
    },
    overriddenBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "overridden_by",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "attendance",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["company_id", "user_id", "date"],
        name: "unique_company_user_daily_attendance",
      },
      {
        fields: ["company_id", "date"],
        name: "idx_company_attendance_date",
      },
    ],
  }
);

module.exports = Attendance;
