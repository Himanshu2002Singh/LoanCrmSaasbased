const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Branch Office Model (with GPS Geo-Fencing for Attendance)
 * Module 2: Identity, Roles & Organization
 */
const Branch = sequelize.define(
  "Branch",
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
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    state: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    address: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    officeLat: {
      type: DataTypes.DECIMAL(10, 8),
      allowNull: true,
      field: "office_lat",
      comment: "Office Latitude for Geofencing",
    },
    officeLng: {
      type: DataTypes.DECIMAL(11, 8),
      allowNull: true,
      field: "office_lng",
      comment: "Office Longitude for Geofencing",
    },
    geoRadiusMeters: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 200,
      field: "geo_radius_meters",
      comment: "Allowed radius in meters for GPS attendance",
    },
    workStartTime: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "work_start_time",
      comment: "Branch check-in start time e.g. 09:30 (null fallback to global config)",
    },
    workEndTime: {
      type: DataTypes.STRING(10),
      allowNull: true,
      field: "work_end_time",
      comment: "Branch check-out end time e.g. 18:30 (null fallback to global config)",
    },
    lateBufferMinutes: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "late_buffer_minutes",
      comment: "Grace period in minutes before mark as late (null fallback to global config)",
    },
    halfDayHours: {
      type: DataTypes.DECIMAL(4, 2),
      allowNull: true,
      field: "half_day_hours",
      comment: "Minimum hours threshold for full day (null fallback to global config)",
    },
  },
  {
    tableName: "branches",
    timestamps: true,
  }
);

module.exports = Branch;
