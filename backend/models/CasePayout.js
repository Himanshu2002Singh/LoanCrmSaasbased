const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Case Payout & Disbursement Invoicing Model
 * Tracks case-by-case loan disbursals, bank commission receivables, 
 * connector payouts, TDS/GST, and invoicing status.
 */
const CasePayout = sequelize.define(
  "CasePayout",
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
    applicationId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "application_id",
      references: {
        model: "applications",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    customerName: {
      type: DataTypes.STRING(150),
      allowNull: false,
      field: "customer_name",
    },
    customerMobile: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "customer_mobile",
    },
    loanProduct: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "loan_product",
    },
    bankName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "bank_name",
    },
    lenderId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "lender_id",
      references: {
        model: "lenders",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    disbursalDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "disbursal_date",
    },
    loanAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "loan_amount",
      comment: "Sanctioned or Disbursed loan amount to customer",
    },
    baseAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "base_amount",
      comment: "Incoming Credit Amount / Commission earned from bank (Base Value)",
    },
    bankCommissionPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 2.0,
      field: "bank_commission_percent",
    },
    bankCommissionDue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "bank_commission_due",
    },
    bankGstPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 18.0,
      field: "bank_gst_percent",
    },
    bankTdsPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 5.0,
      field: "bank_tds_percent",
    },
    bankReceivedAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "bank_received_amount",
    },
    bankRemainingDue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "bank_remaining_due",
    },
    partyName: {
      type: DataTypes.STRING(100),
      allowNull: true,
      field: "party_name",
    },
    partyCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "party_code",
    },
    partyCommissionPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 50.0,
      field: "party_commission_percent",
      comment: "Vendor / Party commission % applied on Base Value (Credit Amount)",
    },
    partyCommissionDue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "party_commission_due",
      comment: "Gross party commission before deductions",
    },
    partyTdsPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "party_tds_percent",
    },
    partyTdsAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "party_tds_amount",
    },
    partyGstPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "party_gst_percent",
    },
    partyGstAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "party_gst_amount",
    },
    extraCharges: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "extra_charges",
      comment: "Extra / manpower / operational deductions",
    },
    partyNetPayable: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "party_net_payable",
      comment: "Final amount payable to vendor after all deductions",
    },
    partyPaidAmount: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "party_paid_amount",
    },
    partyRemainingDue: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "party_remaining_due",
    },
    netMargin: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "net_margin",
    },
    invoiceNumber: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "invoice_number",
    },
    invoiceDate: {
      type: DataTypes.DATEONLY,
      allowNull: true,
      field: "invoice_date",
    },
    invoiceStatus: {
      type: DataTypes.ENUM("DRAFT", "ISSUED", "PAID", "CANCELLED"),
      allowNull: false,
      defaultValue: "DRAFT",
      field: "invoice_status",
    },
    status: {
      type: DataTypes.ENUM("PENDING", "PARTIALLY_SETTLED", "SETTLED"),
      allowNull: false,
      defaultValue: "PENDING",
      field: "status",
    },
    notes: {
      type: DataTypes.TEXT,
      allowNull: true,
      field: "notes",
    },
  },
  {
    tableName: "case_payouts",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["company_id", "lead_id"],
        name: "unique_company_lead_payout",
      },
      {
        fields: ["company_id", "status"],
        name: "idx_company_payout_status",
      },
      {
        fields: ["company_id", "party_name"],
        name: "idx_company_payout_party",
      },
      {
        fields: ["company_id", "bank_name"],
        name: "idx_company_payout_bank",
      },
    ],
  }
);

module.exports = CasePayout;
