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
const LeadAssignmentHistory = require("./LeadAssignmentHistory");

// Module 4: Operations & Document Management
const Document = require("./Document");
const LeadDocumentRequest = require("./LeadDocumentRequest");

// Module 5: Loan Applications & Banker Workflow
const Lender = require("./Lender");
const Application = require("./Application");
const BankerQuery = require("./BankerQuery");
const EmailTemplate = require("./EmailTemplate");
const OperationStatusHistory = require("./OperationStatusHistory");

// Module 6: Master Configs, Attendance & Audit Engine
const MasterConfig = require("./MasterConfig");
const Attendance = require("./Attendance");
const ActivityLog = require("./ActivityLog");
const Notification = require("./Notification");
const PartyPayment = require("./PartyPayment");
const CasePayout = require("./CasePayout");
const BankReceipt = require("./BankReceipt");
const Expense = require("./Expense");
const Note = require("./Note");

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

// Lead Assignment History & Collaboration Trail
Lead.hasMany(LeadAssignmentHistory, { foreignKey: "lead_id", as: "assignmentHistories", onDelete: "CASCADE" });
LeadAssignmentHistory.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });
LeadAssignmentHistory.belongsTo(User, { foreignKey: "user_id", as: "assignee" });
User.hasMany(LeadAssignmentHistory, { foreignKey: "user_id", as: "leadAssignments" });
LeadAssignmentHistory.belongsTo(User, { foreignKey: "assigned_by_id", as: "assignedBy" });
User.hasMany(LeadAssignmentHistory, { foreignKey: "assigned_by_id", as: "createdLeadAssignments" });
LeadAssignmentHistory.belongsTo(Company, { foreignKey: "company_id", as: "company" });
Company.hasMany(LeadAssignmentHistory, { foreignKey: "company_id", as: "leadAssignmentHistories", onDelete: "CASCADE" });

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

// Customer Document Collection Requests (Lead-wise secure upload links)
Lead.hasMany(LeadDocumentRequest, { foreignKey: "lead_id", as: "documentRequests", onDelete: "CASCADE" });
LeadDocumentRequest.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });

Company.hasMany(LeadDocumentRequest, { foreignKey: "company_id", as: "documentRequests", onDelete: "CASCADE" });
LeadDocumentRequest.belongsTo(Company, { foreignKey: "company_id", as: "company" });

LeadDocumentRequest.belongsTo(User, { foreignKey: "created_by_id", as: "creator" });
User.hasMany(LeadDocumentRequest, { foreignKey: "created_by_id", as: "createdDocumentRequests" });

LeadDocumentRequest.hasMany(Document, { foreignKey: "customerRequestId", as: "uploadedDocuments" });
Document.belongsTo(LeadDocumentRequest, { foreignKey: "customerRequestId", as: "documentRequest" });

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

// Operation Status History & Audit Trail
Application.hasMany(OperationStatusHistory, { foreignKey: "application_id", as: "statusHistories", onDelete: "CASCADE" });
OperationStatusHistory.belongsTo(Application, { foreignKey: "application_id", as: "application" });
OperationStatusHistory.belongsTo(User, { foreignKey: "updated_by", as: "updater" });
OperationStatusHistory.belongsTo(Company, { foreignKey: "company_id", as: "company" });
Lead.hasMany(OperationStatusHistory, { foreignKey: "lead_id", as: "opsHistories", onDelete: "CASCADE" });
OperationStatusHistory.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });

Company.hasMany(EmailTemplate, { foreignKey: "company_id", as: "emailTemplates", onDelete: "CASCADE" });
EmailTemplate.belongsTo(Company, { foreignKey: "company_id", as: "company" });

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

CasePayout.belongsTo(User, { foreignKey: "lg_user_id", as: "lgUser" });
User.hasMany(CasePayout, { foreignKey: "lg_user_id", as: "lgPayouts" });

CasePayout.belongsTo(User, { foreignKey: "lc_user_id", as: "lcUser" });
User.hasMany(CasePayout, { foreignKey: "lc_user_id", as: "lcPayouts" });

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
Expense.belongsTo(User, { foreignKey: "employee_id", as: "employee" });
// Module 10: Notes — Personal & Team Scratchpad with Lead Integration
Company.hasMany(Note, { foreignKey: "company_id", as: "notes", onDelete: "CASCADE" });
Note.belongsTo(Company, { foreignKey: "company_id", as: "company" });

User.hasMany(Note, { foreignKey: "user_id", as: "notes", onDelete: "CASCADE" });
Note.belongsTo(User, { foreignKey: "user_id", as: "user" });

Lead.hasMany(Note, { foreignKey: "lead_id", as: "notes", onDelete: "SET NULL" });
Note.belongsTo(Lead, { foreignKey: "lead_id", as: "lead" });



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
  EmailTemplate,
  Note,
  LeadDocumentRequest,
  OperationStatusHistory,
  LeadAssignmentHistory,
};

module.exports = db;

