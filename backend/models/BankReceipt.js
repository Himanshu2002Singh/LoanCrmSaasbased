const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Bank Receipt Model
 * Tracks commission payments received from Banks / Lenders per case
 */
const BankReceipt = sequelize.define(
  "BankReceipt",
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
    casePayoutId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "case_payout_id",
      references: {
        model: "case_payouts",
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
      onDelete: "CASCADE",
    },
    bankName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "bank_name",
    },
    grossAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "gross_amount",
    },
    gstAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "gst_amount",
    },
    tdsAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "tds_amount",
    },
    netAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "net_amount",
    },
    receiptDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "receipt_date",
    },
    paymentMode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "NEFT",
      field: "payment_mode",
      comment: "NEFT, RTGS, IMPS, CHEQUE, DIRECT_CREDIT",
    },
    referenceNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "reference_number",
      comment: "Bank UTR Number or Cheque Ref",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "notes",
    },
    recordedById: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "recorded_by_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
  },
  {
    tableName: "bank_receipts",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "case_payout_id"],
        name: "idx_company_case_receipt",
      },
      {
        fields: ["company_id", "bank_name"],
        name: "idx_company_receipt_bank",
      },
      {
        fields: ["company_id", "receipt_date"],
        name: "idx_company_receipt_date",
      },
    ],
  }
);

module.exports = BankReceipt;
