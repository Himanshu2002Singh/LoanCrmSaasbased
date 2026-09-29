const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Lead Document Request Model
 * Enables generating secure, temporary customer upload links per lead
 */
const LeadDocumentRequest = sequelize.define(
  "LeadDocumentRequest",
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
    token: {
      type: DataTypes.STRING(64),
      allowNull: false,
      unique: true,
    },
    title: {
      type: DataTypes.STRING(150),
      allowNull: false,
      defaultValue: "Document Upload Request",
    },
    requiredDocs: {
      type: DataTypes.JSON,
      allowNull: false,
      defaultValue: [],
      field: "required_docs",
      comment: "Array of requested documents [{ id, docType, title, category, isRequired, status, documentId, fileName, fileUrl, fileSize, uploadedAt }]",
    },
    status: {
      type: DataTypes.ENUM("PENDING", "PARTIALLY_UPLOADED", "COMPLETED", "EXPIRED", "CANCELLED"),
      allowNull: false,
      defaultValue: "PENDING",
    },
    expiresAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "expires_at",
    },
    createdById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "created_by_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    customMessage: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "custom_message",
    },
    customerNotes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "customer_notes",
    },
    accessCount: {
      type: DataTypes.INTEGER,
      allowNull: false,
      defaultValue: 0,
      field: "access_count",
    },
    lastAccessedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "last_accessed_at",
    },
    completedAt: {
      type: DataTypes.DATE,
      allowNull: true,
      field: "completed_at",
    },
  },
  {
    tableName: "lead_document_requests",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["token"],
        name: "idx_doc_request_token",
      },
      {
        fields: ["company_id", "lead_id"],
        name: "idx_company_lead_doc_request",
      },
      {
        fields: ["status"],
        name: "idx_doc_request_status",
      },
    ],
  }
);

module.exports = LeadDocumentRequest;
