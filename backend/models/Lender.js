const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Bank & NBFC Partner Model
 * Module 5: Loan Applications & Banker Workflow
 */
const Lender = sequelize.define(
  "Lender",
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
    name: {
      type: DataTypes.STRING(150),
      allowNull: false,
    },
    shortCode: {
      type: DataTypes.STRING(30),
      allowNull: false,
      field: "short_code",
    },
    lenderType: {
      type: DataTypes.ENUM("Bank", "NBFC", "DSA", "Private Financer", "Other"),
      allowNull: false,
      defaultValue: "Bank",
      field: "lender_type",
    },
    contactPerson: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "contact_person",
    },
    supportedLoanProducts: {
      type: DataTypes.JSON,
      allowNull: true,
      defaultValue: [],
      field: "supported_loan_products",
    },
    payoutCommissionPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: true,
      field: "payout_commission_percent",
    },
    isActive: {
      type: DataTypes.BOOLEAN,
      allowNull: false,
      defaultValue: true,
      field: "is_active",
    },
  },
  {
    tableName: "lenders",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["company_id", "name"],
        name: "unique_company_lender_name",
      },
      {
        unique: true,
        fields: ["company_id", "short_code"],
        name: "unique_company_lender_code",
      },
    ],
  }
);

module.exports = Lender;
