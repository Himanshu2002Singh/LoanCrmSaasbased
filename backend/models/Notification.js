const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * System & In-App Notification Model
 * Module 6: Master Configs, Attendance & Audit Engine
 */
const Notification = sequelize.define(
  "Notification",
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
    recipientId: {
      type: DataTypes.INTEGER,
      allowNull: false,
      field: "recipient_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    message: {
      type: DataTypes.TEXT,
      allowNull: false,
    },
    type: {
      type: DataTypes.STRING(50),
      allowNull: true,
      comment: "lead_assigned / query_raised / doc_verified / reminder",
    },
    recordId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "record_id",
    },
    isRead: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_read",
    },
  },
  {
    tableName: "notifications",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "recipient_id", "is_read"],
        name: "idx_company_user_notifications",
      },
    ],
  }
);

module.exports = Notification;
