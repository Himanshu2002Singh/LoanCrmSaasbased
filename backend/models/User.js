const { DataTypes } = require("sequelize");
const bcrypt = require("bcrypt");
const sequelize = require("../config/database");

/**
 * User Model (Staff, Admins, Bankers, Agents)
 * Module 2: Identity, Roles & Organization
 */
const User = sequelize.define(
  "User",
  {
    id: {
      type: DataTypes.INTEGER,
      primaryKey: true,
      autoIncrement: true,
    },
    companyId: {
      type: DataTypes.INTEGER,
      allowNull: true, // Null for SaaS SuperAdmin
      field: "company_id",
      references: {
        model: "companies",
        key: "id",
      },
      onDelete: "CASCADE",
    },
    name: {
      type: DataTypes.STRING(100),
      allowNull: false,
    },
    email: {
      type: DataTypes.STRING(150),
      allowNull: true,
      validate: { isEmail: true },
    },
    phone: {
      type: DataTypes.STRING(30),
      allowNull: false,
    },
    password: {
      type: DataTypes.STRING(255),
      allowNull: false,
      field: "password_hash",
    },
    role: {
      type: DataTypes.ENUM(
        "SUPERADMIN",
        "COMPANY_ADMIN",
        "MANAGER",
        "EMPLOYEE",
        "OPS",
        "BANKER"
      ),
      allowNull: false,
      defaultValue: "EMPLOYEE",
    },
    salary: {
      type: DataTypes.DECIMAL(12, 2),
      allowNull: true,
      defaultValue: 0.0,
      field: "salary",
      comment: "Monthly / Base salary of employee",
    },
    managerId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "manager_id",
      references: {
        model: "users",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    branchId: {
      type: DataTypes.INTEGER,
      allowNull: true,
      field: "branch_id",
      references: {
        model: "branches",
        key: "id",
      },
      onDelete: "SET NULL",
    },
    status: {
      type: DataTypes.ENUM("active", "inactive", "suspended"),
      allowNull: false,
      defaultValue: "active",
    },
  },
  {
    tableName: "users",
    timestamps: true,
    indexes: [
      {
        unique: true,
        fields: ["company_id", "email"],
        name: "unique_company_user_email",
      },
      {
        fields: ["company_id", "role"],
        name: "idx_company_user_role",
      },
      {
        fields: ["company_id", "branch_id"],
        name: "idx_company_user_branch",
      },
    ],
    hooks: {
      beforeCreate: async (user) => {
        if (user.password && !user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
      beforeUpdate: async (user) => {
        if (user.changed("password") && !user.password.startsWith("$2b$") && !user.password.startsWith("$2a$")) {
          const salt = await bcrypt.genSalt(10);
          user.password = await bcrypt.hash(user.password, salt);
        }
      },
    },
  }
);

User.prototype.comparePassword = async function (candidatePassword) {
  if (!this.password) return false;
  return bcrypt.compare(candidatePassword, this.password);
};

User.prototype.toJSON = function () {
  const values = { ...this.get() };
  delete values.password;
  return values;
};

module.exports = User;
