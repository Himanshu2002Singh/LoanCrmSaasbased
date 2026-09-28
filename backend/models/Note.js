const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Note Model
 * Module: Personal & Team Scratchpad with Lead Integration
 * Accessible across Sales, Operations, Admin, and Managers.
 */
const Note = sequelize.define(
  "Note",
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
    title: {
      type: DataTypes.STRING(255),
      allowNull: false,
      defaultValue: "Untitled Note",
    },
    content: {
      type: DataTypes.TEXT,
      allowNull: false,
      defaultValue: "",
    },
    color: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "amber", // amber, emerald, sky, purple, rose, slate
    },
    priority: {
      type: DataTypes.ENUM("LOW", "NORMAL", "HIGH", "URGENT"),
      allowNull: false,
      defaultValue: "NORMAL",
    },
    isPinned: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_pinned",
    },
    noteDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      defaultValue: DataTypes.NOW,
      field: "note_date",
    },
  },
  {
    tableName: "notes",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "user_id"],
        name: "idx_company_user_notes",
      },
      {
        fields: ["lead_id"],
        name: "idx_lead_notes",
      },
      {
        fields: ["note_date"],
        name: "idx_note_date",
      },
    ],
  }
);

module.exports = Note;
