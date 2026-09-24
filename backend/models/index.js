const { Sequelize } = require("sequelize");
const sequelize = require("../config/database");

// Module 1: SaaS Multi-Tenancy & Platform
const Plan = require("./Plan");
const Company = require("./Company");

// Module 2: Identity, Roles & Organization
const Branch = require("./Branch");
const User = require("./User");

// Module 3: Customer & Sales Engine
const Customer = require("./Customer");
const Lead = require("./Lead");
const CallLog = require("./CallLog");
const FollowUp = require("./FollowUp");
const Task = require("./Task");

// Module 4: Operations & Document Management
const Document = require("./Document");

// Module 5: Loan Applications & Banker Workflow
const Lender = require("./Lender");
const Application = require("./Application");
const BankerQuery = require("./BankerQuery");

// Module 6: Master Configs, Attendance & Audit Engine
const MasterConfig = require("./MasterConfig");
const Attendance = require("./Attendance");
const ActivityLog = require("./ActivityLog");
const Notification = require("./Notification");
const PartyPayment = require("./PartyPayment");
const CasePayout = require("./CasePayout");
const BankReceipt = require("./BankReceipt");
const Expense = require("./Expense");

// ==========================================
// Define Model Relationships & Foreign Keys
// ==========================================

// Module 1: Plan & Company
Plan.hasMany(Company, { foreignKey: "plan_id", as: "companies" });
Company.belongsTo(Plan, { foreignKey: "plan_id", as: "plan" });

// Module 2: Company, Branch, & Users
Company.hasMany(Branch, { foreignKey: "company_id", as: "branches", onDelete: "CASCADE" });
Branch.belongsTo(Company, { foreignKey: "company_id", as: "company" });

Company.hasMany(User, { foreignKey: "company_id", as: "users", onDelete: "CASCADE" });
User.belongsTo(Company, { foreignKey: "company_id", as: "company" });

Branch.hasMany(User, { foreignKey: "branch_id", as: "employees", onDelete: "SET NULL" });
User.belongsTo(Branch, { foreignKey: "branch_id", as: "branch" });

User.belongsTo(User, { foreignKey: "manager_id", as: "manager" });
User.hasMany(User, { foreignKey: "manager_id", as: "subordinates" });

// Module 3: Customers & Leads
Company.hasMany(Customer, { foreignKey: "company_id", as: "customers", onDelete: "CASCADE" });
Customer.belongsTo(Company, { foreignKey: "company_id", as: "company" });

Company.hasMany(Lead, { foreignKey: "company_id", as: "leads", onDelete: "CASCADE" });
Lead.belongsTo(Company, { foreignKey: "company_id", as: "company" });

Customer.hasMany(Lead, { foreignKey: "customer_id", as: "leads", onDelete: "CASCADE" });
Lead.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

Lead.belongsTo(User, { foreignKey: "assigned_employee_id", as: "assignedEmployee" });
User.hasMany(Lead, { foreignKey: "assigned_employee_id", as: "assignedLeads" });

Lead.belongsTo(User, { foreignKey: "assigned_manager_id", as: "assignedManager" });
User.hasMany(Lead, { foreignKey: "assigned_manager_id", as: "managedLeads" });

// Call Logs & Follow-ups
Lead.hasMany(CallLog, { foreignKey: "lead_id", as: "callLogs", onDelete: "SET NULL" });
CallLog.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });
User.hasMany(CallLog, { foreignKey: "user_id", as: "callLogs" });
CallLog.belongsTo(User, { foreignKey: "user_id", as: "user" });

Lead.hasMany(FollowUp, { foreignKey: "lead_id", as: "followUps", onDelete: "CASCADE" });
FollowUp.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });
User.hasMany(FollowUp, { foreignKey: "user_id", as: "followUps" });
FollowUp.belongsTo(User, { foreignKey: "user_id", as: "user" });

User.hasMany(Task, { foreignKey: "user_id", as: "tasks" });
Task.belongsTo(User, { foreignKey: "user_id", as: "user" });
Lead.hasMany(Task, { foreignKey: "lead_id", as: "tasks", onDelete: "SET NULL" });
Task.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });

// Module 4: Documents
Customer.hasMany(Document, { foreignKey: "customer_id", as: "documents", onDelete: "CASCADE" });
Document.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

Lead.hasMany(Document, { foreignKey: "lead_id", as: "documents", onDelete: "SET NULL" });
Document.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });

User.hasMany(Document, { foreignKey: "uploaded_by", as: "uploadedDocuments" });
Document.belongsTo(User, { foreignKey: "uploaded_by", as: "uploader" });

// Module 5: Applications, Lenders, Banker Queries
Company.hasMany(Lender, { foreignKey: "company_id", as: "lenders", onDelete: "CASCADE" });
Lender.belongsTo(Company, { foreignKey: "company_id", as: "company" });

Lead.hasMany(Application, { foreignKey: "lead_id", as: "applications", onDelete: "CASCADE" });
Application.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });

Customer.hasMany(Application, { foreignKey: "customer_id", as: "applications", onDelete: "CASCADE" });
Application.belongsTo(Customer, { foreignKey: "customer_id", as: "customer" });

Application.belongsTo(Lender, { foreignKey: "lender_id", as: "lender" });
Lender.hasMany(Application, { foreignKey: "lender_id", as: "applications" });

Application.belongsTo(User, { foreignKey: "assigned_banker_id", as: "assignedBanker" });
User.hasMany(Application, { foreignKey: "assigned_banker_id", as: "assignedApplications" });

Application.hasMany(Document, { foreignKey: "application_id", as: "documents", onDelete: "CASCADE" });
Document.belongsTo(Application, { foreignKey: "application_id", as: "application" });

Application.hasMany(BankerQuery, { foreignKey: "application_id", as: "queries", onDelete: "CASCADE" });
BankerQuery.belongsTo(Application, { foreignKey: "application_id", as: "application" });

BankerQuery.belongsTo(User, { foreignKey: "banker_id", as: "banker" });
BankerQuery.belongsTo(User, { foreignKey: "resolved_by_ops_id", as: "resolvedByOps" });

// Module 6: Master Configs, Attendance, Audit Logs, Notifications
Company.hasMany(MasterConfig, { foreignKey: "company_id", as: "masterConfigs", onDelete: "CASCADE" });
MasterConfig.belongsTo(Company, { foreignKey: "company_id", as: "company" });

User.hasMany(Attendance, { foreignKey: "user_id", as: "attendanceRecords", onDelete: "CASCADE" });
Attendance.belongsTo(User, { foreignKey: "user_id", as: "user" });

Company.hasMany(ActivityLog, { foreignKey: "company_id", as: "activityLogs", onDelete: "CASCADE" });
ActivityLog.belongsTo(Company, { foreignKey: "company_id", as: "company" });

User.hasMany(Notification, { foreignKey: "recipient_id", as: "notifications", onDelete: "CASCADE" });
Notification.belongsTo(User, { foreignKey: "recipient_id", as: "recipient" });

// Module 7: Party / Connector Payouts & Ledger
Company.hasMany(PartyPayment, { foreignKey: "company_id", as: "partyPayments", onDelete: "CASCADE" });
PartyPayment.belongsTo(Company, { foreignKey: "company_id", as: "company" });
PartyPayment.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });
PartyPayment.belongsTo(User, { foreignKey: "recorded_by_id", as: "recordedBy" });

// Module 8: Disbursed Case Payouts, Bank Commission & Invoicing
Company.hasMany(CasePayout, { foreignKey: "company_id", as: "casePayouts", onDelete: "CASCADE" });
CasePayout.belongsTo(Company, { foreignKey: "company_id", as: "company" });

Lead.hasOne(CasePayout, { foreignKey: "lead_id", as: "casePayout", onDelete: "CASCADE" });
CasePayout.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });

Application.hasOne(CasePayout, { foreignKey: "application_id", as: "casePayout", onDelete: "SET NULL" });
CasePayout.belongsTo(Application, { foreignKey: "application_id", as: "application" });

Lender.hasMany(CasePayout, { foreignKey: "lender_id", as: "casePayouts", onDelete: "SET NULL" });
CasePayout.belongsTo(Lender, { foreignKey: "lender_id", as: "lender" });

CasePayout.hasMany(BankReceipt, { foreignKey: "case_payout_id", as: "bankReceipts", onDelete: "CASCADE" });
BankReceipt.belongsTo(CasePayout, { foreignKey: "case_payout_id", as: "casePayout" });

BankReceipt.belongsTo(Company, { foreignKey: "company_id", as: "company" });
BankReceipt.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });
BankReceipt.belongsTo(User, { foreignKey: "recorded_by_id", as: "recordedBy" });

// Module 9: Expenses — Office Running Costs
Company.hasMany(Expense, { foreignKey: "company_id", as: "expenses", onDelete: "CASCADE" });
Expense.belongsTo(Company, { foreignKey: "company_id", as: "company" });
Expense.belongsTo(User, { foreignKey: "created_by_id", as: "createdBy" });
User.hasMany(Expense, { foreignKey: "created_by_id", as: "createdExpenses" });

const db = {
  sequelize,
  Sequelize,
  Plan,
  Company,
  Branch,
  User,
  Customer,
  Lead,
  CallLog,
  FollowUp,
  Task,
  Document,
  Lender,
  Application,
  BankerQuery,
  MasterConfig,
  Attendance,
  ActivityLog,
  Notification,
  PartyPayment,
  CasePayout,
  BankReceipt,
  Expense,
};

module.exports = db;
