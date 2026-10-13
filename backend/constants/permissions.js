/**
 * System-wide Permission Definitions & Role Defaults
 * Module: Role-based Access Control (RBAC) & Custom User Permissions
 */

const PERMISSION_DEFINITIONS = [
  {
    key: "viewPayouts",
    label: "Disbursement & Case Payouts",
    category: "Financial & Confidential Data",
    description: "Can view case disbursals, loan volumes, bank commission receivables & net margins",
    confidential: true,
  },
  {
    key: "managePayouts",
    label: "Manage Case Payouts & Invoices",
    category: "Financial & Confidential Data",
    description: "Can record bank receipts, party payouts, edit commission rates & issue invoices",
    confidential: true,
  },
  {
    key: "viewConnectors",
    label: "Party & Connector Details",
    category: "Financial & Confidential Data",
    description: "Can view connector payouts, dues, advance balances & party ledger history",
    confidential: true,
  },
  {
    key: "manageConnectors",
    label: "Manage Connector Payments & Advances",
    category: "Financial & Confidential Data",
    description: "Can record payments, advances, refund credits and link leads to connectors",
    confidential: true,
  },
  {
    key: "viewExpenses",
    label: "Office Expense Tracker",
    category: "Financial & Confidential Data",
    description: "Can view monthly office running costs, rent, electricity, bills and net profit/loss",
    confidential: true,
  },
  {
    key: "manageExpenses",
    label: "Manage Office Expenses",
    category: "Financial & Confidential Data",
    description: "Can add, edit, approve, or delete company expense entries",
    confidential: true,
  },
  {
    key: "viewReports",
    label: "Performance & Financial Reports",
    category: "Analytics & Reporting",
    description: "Can view employee performance reports, conversion metrics & lead reports",
    confidential: false,
  },
  {
    key: "viewOperations",
    label: "Operations & Loan Processing Pipeline",
    category: "Operations & File Processing",
    description: "Can access Operations pipeline to inspect active files, verification stages, customer documents, and banker queries",
    confidential: false,
  },
  {
    key: "manageOperations",
    label: "Manage File Stages & Bank Submissions",
    category: "Operations & File Processing",
    description: "Can update pipeline stages, upload customer documents, dispatch files to banks, and resolve banker queries",
    confidential: false,
  },
  {
    key: "createLoanApplication",
    label: "Create Loan Applications in Leads",
    category: "Operations & File Processing",
    description: "Can create and submit new loan applications for leads to Banks, NBFCs, or DSA partners",
    confidential: false,
  },
  {
    key: "viewAllLeads",
    label: "View All Company Leads",
    category: "Leads & Workflow",
    description: "Can view all company leads across all teams rather than only assigned / own team leads",
    confidential: false,
  },
  {
    key: "createLead",
    label: "Add & Create Leads",
    category: "Leads & Workflow",
    description: "Can manually create and enter new customer leads into the system",
    confidential: false,
  },
  {
    key: "editLead",
    label: "Edit Lead Details & Profiles",
    category: "Leads & Workflow",
    description: "Can modify customer personal information, loan amount, and assignment parameters on existing leads",
    confidential: false,
  },
  {
    key: "reassignLeads",
    label: "Reassign Leads to Employees",
    category: "Leads & Workflow",
    description: "Can reassign leads to other employees within the company",
    confidential: false,
  },
  {
    key: "followupLead",
    label: "Lead Follow-up & Meeting Scheduling",
    category: "Leads & Workflow",
    description: "Can schedule next meetings, log follow-up call history, update status notes, and add remarks",
    confidential: false,
  },
  {
    key: "viewFollowupWork",
    label: "Today Followup / Work Tracker",
    category: "Leads & Workflow",
    description: "Can view daily scheduled followups, remarks, overdue calls, and date-wise activity filter",
    confidential: false,
  },
  {
    key: "manageUsers",
    label: "Add & Manage Employees",
    category: "User & Access Management",
    description: "Can add new employees, reassign branches, and edit staff profiles",
    confidential: true,
  },
  {
    key: "manageSettings",
    label: "Company Settings & Masters",
    category: "User & Access Management",
    description: "Can edit company profile, lead statuses, loan products, and role permissions",
    confidential: true,
  },
  {
    key: "manageLeadStatuses",
    label: "Manage Lead Statuses (Add & Edit Stages)",
    category: "User & Access Management",
    description: "Can add, edit, reorder, and configure lead status pipeline stages",
    confidential: false,
  },
  {
    key: "manageLoanProducts",
    label: "Manage Loan Types (Add & Edit Products)",
    category: "User & Access Management",
    description: "Can add, edit, and configure available company loan types and financial products",
    confidential: false,
  },
  {
    key: "manageLeadSources",
    label: "Manage Lead Sources (Add & Edit Channels)",
    category: "User & Access Management",
    description: "Can add, edit, and configure customer acquisition sources, DSA connectors, and partners",
    confidential: false,
  },
  {
    key: "exportData",
    label: "Export Data to Excel / CSV",
    category: "Data Security",
    description: "Can download Excel spreadsheets and export reports",
    confidential: false,
  },

  {
    key: "deleteRecords",
    label: "Delete Records",
    category: "Data Security",
    description: "Can permanently delete leads, tasks, payments, or expenses",
    confidential: true,
  },
];

const DEFAULT_ROLE_PERMISSIONS = {
  SUPERADMIN: {
    viewDashboard: true,
    viewLeads: true,
    viewAllLeads: true,
    manageLeads: true,
    createLead: true,
    editLead: true,
    reassignLeads: true,
    followupLead: true,
    viewFollowupWork: true,
    viewOperations: true,
    manageOperations: true,
    createLoanApplication: true,
    viewConnectors: true,
    manageConnectors: true,
    viewPayouts: true,
    managePayouts: true,
    viewExpenses: true,
    manageExpenses: true,
    viewReports: true,
    manageUsers: true,
    manageSettings: true,
    manageLeadStatuses: true,
    manageLoanProducts: true,
    manageLeadSources: true,
    exportData: true,
    deleteRecords: true,
    viewAttendance: true,
    viewTasks: true,
  },
  COMPANY_ADMIN: {
    viewDashboard: true,
    viewLeads: true,
    viewAllLeads: true,
    manageLeads: true,
    createLead: true,
    editLead: true,
    reassignLeads: true,
    followupLead: true,
    viewFollowupWork: true,
    viewOperations: true,
    manageOperations: true,
    createLoanApplication: true,
    viewConnectors: true,
    manageConnectors: true,
    viewPayouts: true,
    managePayouts: true,
    viewExpenses: true,
    manageExpenses: true,
    viewReports: true,
    manageUsers: true,
    manageSettings: true,
    manageLeadStatuses: true,
    manageLoanProducts: true,
    manageLeadSources: true,
    exportData: true,
    deleteRecords: true,
    viewAttendance: true,
    viewTasks: true,
  },
  MANAGER: {
    viewDashboard: true,
    viewLeads: true,
    viewAllLeads: false, // by default only team leads
    manageLeads: true,
    createLead: true,
    editLead: true,
    reassignLeads: true,
    followupLead: true,
    viewFollowupWork: true,
    viewOperations: false, // by default false; admin can toggle ON in Permissions
    manageOperations: false,
    createLoanApplication: false, // by default false; admin can toggle ON in Permissions
    viewConnectors: false, // confidential - disabled by default for managers unless admin grants
    manageConnectors: false,
    viewPayouts: false, // confidential - disabled by default for managers unless admin grants
    managePayouts: false,
    viewExpenses: false, // confidential - disabled by default for managers unless admin grants
    manageExpenses: false,
    viewReports: true,
    manageUsers: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    exportData: true,
    deleteRecords: false,
    viewAttendance: true,
    viewTasks: true,
  },
  OPS: {
    viewDashboard: true,
    viewLeads: true,
    viewAllLeads: false, // by default only assigned leads on Leads page; admin can toggle ON in Permissions
    manageLeads: true,
    createLead: false, // admin can grant create lead permission to Ops
    editLead: true, // sales, manager, operations, and admin can edit leads
    reassignLeads: true,
    followupLead: true, // admin can grant followup permission to Ops
    viewFollowupWork: true,
    viewOperations: true,
    manageOperations: true,
    createLoanApplication: true,
    viewConnectors: false, // confidential - disabled by default
    manageConnectors: false,
    viewPayouts: true, // enabled for disbursement and payouts
    managePayouts: true,
    viewExpenses: false, // confidential - disabled by default
    manageExpenses: false,
    viewReports: false,
    manageUsers: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    exportData: true,
    deleteRecords: false,
    viewAttendance: false,
    viewTasks: true,
  },
  EMPLOYEE: {
    viewDashboard: false,
    viewLeads: true,
    viewAllLeads: false,
    manageLeads: true,
    createLead: true,
    editLead: true,
    reassignLeads: true,
    followupLead: true,
    viewFollowupWork: true,
    viewOperations: false,
    manageOperations: false,
    createLoanApplication: false,
    viewConnectors: false,
    manageConnectors: false,
    viewPayouts: false,
    managePayouts: false,
    viewExpenses: false,
    manageExpenses: false,
    viewReports: false,
    manageUsers: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    exportData: false,
    deleteRecords: false,
    viewAttendance: false,
    viewTasks: false,
  },
  FINANCE: {
    viewDashboard: true,
    viewLeads: false,
    viewAllLeads: false,
    manageLeads: false,
    createLead: false,
    editLead: false,
    reassignLeads: false,
    followupLead: false,
    viewFollowupWork: false,
    viewOperations: false,
    manageOperations: false,
    createLoanApplication: false,
    viewConnectors: true,
    manageConnectors: true,
    viewPayouts: true,
    managePayouts: true,
    viewExpenses: true,
    manageExpenses: true,
    viewReports: true,
    manageUsers: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    exportData: true,
    deleteRecords: false,
    viewAttendance: false,
    viewTasks: false,
  },
  BANKER: {
    viewDashboard: true,
    viewLeads: false,
    viewAllLeads: false,
    manageLeads: false,
    createLead: false,
    editLead: false,
    reassignLeads: false,
    followupLead: false,
    viewFollowupWork: false,
    viewOperations: false,
    manageOperations: false,
    createLoanApplication: false,
    viewConnectors: false,
    manageConnectors: false,
    viewPayouts: false,
    managePayouts: false,
    viewExpenses: false,
    manageExpenses: false,
    viewReports: false,
    manageUsers: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    exportData: false,
    deleteRecords: false,
    viewAttendance: false,
    viewTasks: true,
  },
};

/**
 * Resolves the effective boolean permissions for a user by merging:
 * 1. Default permissions for their role
 * 2. Company-wide role overrides (company.rolePermissions[role])
 * 3. Individual user-level custom permission overrides (if any)
 */
const resolveUserPermissions = (user, explicitCompanyOverrides = null) => {
  if (!user) return {};
  const role = user.role || "EMPLOYEE";
  
  if (role === "SUPERADMIN" || role === "COMPANY_ADMIN") {
    return { ...DEFAULT_ROLE_PERMISSIONS.COMPANY_ADMIN };
  }

  const roleDefaults = DEFAULT_ROLE_PERMISSIONS[role] || DEFAULT_ROLE_PERMISSIONS.EMPLOYEE;
  
  let companyOverrides = explicitCompanyOverrides;
  if (!companyOverrides && user.company && user.company.rolePermissions) {
    companyOverrides = typeof user.company.rolePermissions === "string"
      ? JSON.parse(user.company.rolePermissions || "{}")
      : user.company.rolePermissions;
  }
  
  const roleOverride = (companyOverrides && companyOverrides[role]) || {};
  const userCustom = typeof user.permissions === "string" ? JSON.parse(user.permissions || "{}") : (user.permissions || {});

  const resolved = {
    ...roleDefaults,
    ...roleOverride,
    ...userCustom,
  };

  // If user has manageSettings, ensure lead statuses, loan products, and lead sources are also granted by default
  if (resolved.manageSettings) {
    if (resolved.manageLeadStatuses === undefined) resolved.manageLeadStatuses = true;
    if (resolved.manageLoanProducts === undefined) resolved.manageLoanProducts = true;
    if (resolved.manageLeadSources === undefined) resolved.manageLeadSources = true;
  }

  return resolved;
};


module.exports = {
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveUserPermissions,
};
