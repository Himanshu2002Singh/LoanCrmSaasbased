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
    key: "viewAllLeads",
    label: "View All Company Leads",
    category: "Leads & Workflow",
    description: "Can view all company leads across all teams rather than only assigned / own team leads",
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
    viewConnectors: true,
    manageConnectors: true,
    viewPayouts: true,
    managePayouts: true,
    viewExpenses: true,
    manageExpenses: true,
    viewReports: true,
    manageUsers: true,
    manageSettings: true,
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
    viewConnectors: true,
    manageConnectors: true,
    viewPayouts: true,
    managePayouts: true,
    viewExpenses: true,
    manageExpenses: true,
    viewReports: true,
    manageUsers: true,
    manageSettings: true,
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
    viewConnectors: false, // confidential - disabled by default for managers unless admin grants
    manageConnectors: false,
    viewPayouts: false, // confidential - disabled by default for managers unless admin grants
    managePayouts: false,
    viewExpenses: false, // confidential - disabled by default for managers unless admin grants
    manageExpenses: false,
    viewReports: true,
    manageUsers: false,
    manageSettings: false,
    exportData: true,
    deleteRecords: false,
    viewAttendance: true,
    viewTasks: true,
  },
  OPS: {
    viewDashboard: true,
    viewLeads: true,
    viewAllLeads: true,
    manageLeads: true,
    viewConnectors: false, // confidential - disabled by default
    manageConnectors: false,
    viewPayouts: true, // enabled for disbursement and payouts
    managePayouts: true,
    viewExpenses: false, // confidential - disabled by default
    manageExpenses: false,
    viewReports: false,
    manageUsers: false,
    manageSettings: false,
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
    viewConnectors: false,
    manageConnectors: false,
    viewPayouts: false,
    managePayouts: false,
    viewExpenses: false,
    manageExpenses: false,
    viewReports: false,
    manageUsers: false,
    manageSettings: false,
    exportData: false,
    deleteRecords: false,
    viewAttendance: false,
    viewTasks: false,
  },
  BANKER: {
    viewDashboard: true,
    viewLeads: false,
    viewAllLeads: false,
    manageLeads: false,
    viewConnectors: false,
    manageConnectors: false,
    viewPayouts: false,
    managePayouts: false,
    viewExpenses: false,
    manageExpenses: false,
    viewReports: false,
    manageUsers: false,
    manageSettings: false,
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

  return {
    ...roleDefaults,
    ...roleOverride,
    ...userCustom,
  };
};

module.exports = {
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveUserPermissions,
};
