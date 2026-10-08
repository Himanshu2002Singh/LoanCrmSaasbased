const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Lead Assignment History Model
 * Module 3: Customer & Sales Engine / Team Collaboration
 * Tracks full chronological lifecycle of lead ownership:
 * who owned the lead, who reassigned it, when it was handed off, and notes.
 */
const LeadAssignmentHistory = sequelize.define(
  "LeadAssignmentHistory",
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
    assignedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "assigned_by_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    assignedAt: {
      type: DataTypes.DATE,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "assigned_at",
    },
    unassignedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "unassigned_at",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      defaultValue: true,
      field: "is_active",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
  },
  {
    tableName: "lead_assignment_histories",
    timestamps: true,
    indexes: [
      { fields: ["company_id"] },
      { fields: ["lead_id"] },
      { fields: ["user_id"] },
      { fields: ["is_active"] },
    ],
  }
);

module.exports = LeadAssignmentHistory;
