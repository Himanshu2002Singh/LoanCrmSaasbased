const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Expense Model — Office Running Costs & Operational Expenses
 * Tracks general office expenses, vendor payees, GST, payment modes, and monthly aggregation.
 */
const Expense = sequelize.define(
  "Expense",
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
    expenseCode: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "expense_code",
      comment: "e.g. EXP-001, EXP-002",
    },
    expenseDate: {
      type: DataTypes.DATEONLY,
      allowNull: false,
      field: "expense_date",
    },
    expenseMonth: {
      type: DataTypes.STRING(20),
      allowNull: false,
      field: "expense_month",
      comment: "e.g. 2026-09",
    },
    category: {
      type: DataTypes.STRING(100),
      allowNull: false,
      defaultValue: "Miscellaneous",
      comment: "Rent, Electricity, Tea/Pantry, Internet, Stationary, etc.",
    },
    vendorName: {
      type: DataTypes.STRING(150),
      allowNull: true,
      field: "vendor_name",
      comment: "Vendor / Payee name",
    },
    description: {
      type: DataTypes.TEXT,
      allowNull: true,
    },
    baseAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "base_amount",
      comment: "Base taxable or expense amount (₹)",
    },
    gstPercent: {
      type: DataTypes.DECIMAL(5, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "gst_percent",
      comment: "GST % (0, 5, 12, 18, 28)",
    },
    gstAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "gst_amount",
      comment: "Calculated GST amount (₹)",
    },
    totalAmount: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: false,
      defaultValue: 0.0,
      field: "total_amount",
      comment: "Total expense amount including GST (₹)",
    },
    paymentMode: {
      type: DataTypes.STRING(50),
      allowNull: false,
      defaultValue: "UPI",
      field: "payment_mode",
      comment: "UPI, Cash, Net Banking, Credit Card, Cheque",
    },
    status: {
      type: DataTypes.ENUM("PAID", "PENDING"),
      allowNull: false,
      defaultValue: "PAID",
    },
    remarks: {
      type: DataTypes.TEXT,
      allowNull: true,
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
  },
  {
    tableName: "expenses",
    timestamps: true,
    createdAt: "created_at",
    updatedAt: "updated_at",
  }
);

module.exports = Expense;
