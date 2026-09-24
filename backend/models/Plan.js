const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Plan & Subscription Tier Model
 * Module 1: SaaS Multi-Tenancy & Platform
 */
const Plan = sequelize.define(
  "Plan",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
      comment: "Starter / Growth / Enterprise",
    },
    priceMonthly: {
      type: DataTypes.DECIMAL(10, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "price_monthly",
    },
    maxEmployees: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 10,
      field: "max_employees",
    },
    featuresJson: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: {},
      field: "features_json",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "plans",
    timestamps: true,
  }
);

module.exports = Plan;
