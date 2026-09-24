const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Party / Connector Payment & Advance Ledger Model
 * Tracks commission settlements, unallocated advances, and refund credits per party
 */
const PartyPayment = sequelize.define(
  "PartyPayment",
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
    partyName: {
      type: DataTypes.STRING(100),
      allowNull: false,
      field: "party_name",
      comment: "Matches lead_source / party label",
    },
    partyCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "party_code",
      comment: "e.g. PTY-001, PTY-002",
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
    paymentType: {
      type: DataTypes.ENUM("LINKED_PAYMENT", "ADVANCE", "REFUND_CREDIT"),
      allowNull: false,
      defaultValue: "LINKED_PAYMENT",
      field: "payment_type",
    },
    amount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
    },
    paymentDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "payment_date",
    },
    paymentMode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "BANK_TRANSFER",
      field: "payment_mode",
      comment: "BANK_TRANSFER, UPI, CHEQUE, CASH",
    },
    referenceNumber: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "reference_number",
      comment: "UTR No / Cheque No / Transaction ID",
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
    tableName: "party_payments",
    timestamps: true,
    indexes: [
      {
        fields: ["company_id", "party_name"],
        name: "idx_company_party_name",
      },
      {
        fields: ["payment_date"],
        name: "idx_party_payment_date",
      },
    ],
  }
);

module.exports = PartyPayment;
