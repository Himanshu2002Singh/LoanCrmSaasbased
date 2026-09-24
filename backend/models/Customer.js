const { DataTypes } = require("sequelize");
const sequelize = require("../config/database");

/**
 * Customer Identity Model
 * Module 3: Customer & Sales Engine
 */
const Customer = sequelize.define(
  "Customer",
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
    mobile: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    alternateMobile: {
      type: DataTypes.STRING(30),
      allowNull: true,
      field: "alternate_mobile",
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      validate: {
        isEmailOrEmpty(val) {
          if (val && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(val)) {
            throw new Error("Invalid email format");
          }
        },
      },
    },
    panNumber: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "pan_number",
    },
    aadhaarMasked: {
      type: DataTypes.STRING(20),
      allowNull: true,
      field: "aadhaar_masked",
    },
    city: {
      type: DataTypes.STRING(100),
      allowNull: true,
    },
    employmentType: {
      type: DataTypes.STRING(50),
      allowNull: true,
      field: "employment_type",
      comment: "Salaried / Self-Employed / Business / Professional",
    },
    monthlyIncome: {
      type: DataTypes.DECIMAL(15, 2),
      allowNull: true,
      field: "monthly_income",
    },
  },
  {
    tableName: "customers",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["company_id", "mobile"],
        name: "unique_company_customer_mobile",
      },
      {
        fields: ["company_id", "pan_number"],
        name: "idx_company_customer_pan",
      },
    ],
  }
);

module.exports = Customer;
