const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Company / Tenant Model
 * Module 1: SaaS Multi-Tenancy & Platform
 */
const Company = sequelize.define(
  "Company",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    slug: {
      type: DataTypes.STRING(80),
      allowNull: false,
      unique: true,
      comment: "Unique tenant subdomain / identifier",
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: true,
    },
    logoUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "logo_url",
    },
    planId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "plan_id",
      references: {
        model: "plans",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    status: {
      type: DataTypes.ENUM("active", "trial", "suspended"),
      allowNull: false,
      defaultValue: "active",
    },
    maxUsers: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 5,
      field: "max_users",
    },
    subscriptionExpiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "subscription_expires_at",
    },
    rolePermissions: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "role_permissions",
      comment: "Company customized role permissions overrides for MANAGER, OPS, BANKER, EMPLOYEE",
    },
    smtpConfig: {
      type: DataTypes.JSON,
      allowNull: true,
      field: "smtp_config",
      comment: "Company outgoing mail configuration { host, port, secure, user, pass, senderName, isConfigured }",
    },
  },
  {
    tableName: "companies",
    timestamps: true,
  }
);

module.exports = Company;
