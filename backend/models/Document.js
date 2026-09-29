const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * KYC & Loan Verification Document Model
 * Module 4: Operations & Document Management
 */
const Document = sequelize.define(
  "Document",
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
    customerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "customer_id",
      references: {
        model: "customers",
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
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "application_id",
      comment: "Linked loan application",
    },
    docType: {
      type: DataTypes.STRING(50),
      allowNull: false,
      field: "doc_type",
      comment: "Maps dynamically to master_configs.value (config_type: DOC_TYPE)",
    },
    fileUrl: {
      type: DataTypes.STRING(255),
      allowNull: true,
      field: "file_url",
    },
    fileName: {
      type: DataTypes.STRING(200),
      allowNull: false,
      field: "file_name",
    },
    uploadedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "uploaded_by",
      references: {
        model: "users",
        key: "id",
      },
    },
    isCustomerUpload: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: false,
      field: "is_customer_upload",
    },
    customerRequestId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "customer_request_id",
    },
    verificationStatus: {
      type: DataTypes.ENUM(
        "PENDING",
        "VERIFIED",
        "REJECTED",
        "REUPLOAD_REQUIRED"
      ),
      allowNull: false,
      defaultValue: "PENDING",
      field: "verification_status",
    },
    verifiedBy: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "verified_by",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    rejectionReason: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "rejection_reason",
    },
  },
  {
    tableName: "documents",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "customer_id"],
        name: "idx_company_doc_customer",
      },
      {
        fields: ["company_id", "application_id"],
        name: "idx_company_doc_application",
      },
    ],
  }
);

module.exports = Document;
