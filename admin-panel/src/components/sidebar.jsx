import React, { useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import CrmLogo from "./CrmLogo";
import { resolveLogoUrl } from "../utils/logo";

const ROLE_DEFAULTS = {
  COMPANY_ADMIN: {
    viewDashboard: true,
    viewLeads: true,
    createLead: true,
    manageLeads: true,
    viewFollowupWork: true,
    viewTasks: true,
    viewNotes: true,
    viewOperations: true,
    viewConnectors: true,
    viewPayouts: true,
    viewExpenses: true,
    viewReports: true,
    manageUsers: true,
    manageSettings: true,
    manageLeadStatuses: true,
    manageLoanProducts: true,
    manageLeadSources: true,
    manageBranches: true,
    viewAttendance: true,
    viewLenders: true,
  },
  MANAGER: {
    viewDashboard: true,
    viewLeads: true,
    createLead: true,
    manageLeads: true,
    viewFollowupWork: true,
    viewTasks: true,
    viewNotes: true,
    viewReports: true,
    viewAttendance: true,
    viewOperations: false,
    manageLoanProducts: false,
    manageLeadStatuses: false,
    manageLeadSources: false,
    manageUsers: false,
    manageBranches: false,
    viewConnectors: false,
    viewPayouts: false,
    viewExpenses: true,
    manageSettings: false,
    viewLenders: false,
  },
  OPS: {
    viewDashboard: true,
    viewLeads: true,
    createLead: false,
    manageLeads: true,
    viewFollowupWork: true,
    viewTasks: true,
    viewNotes: true,
    viewOperations: true,
    manageOperations: true,
    viewPayouts: true,
    viewReports: false,
    viewConnectors: false,
    viewExpenses: true,
    manageUsers: false,
    manageBranches: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    viewAttendance: false,
    viewLenders: true,
  },
  EMPLOYEE: {
    viewDashboard: true,
    viewLeads: true,
    createLead: true,
    manageLeads: true,
    viewFollowupWork: true,
    viewTasks: false,
    viewNotes: true,
    viewOperations: false,
    viewConnectors: false,
    viewPayouts: false,
    viewExpenses: true,
    viewReports: false,
    manageUsers: false,
    manageBranches: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    viewAttendance: false,
    viewLenders: false,
  },
  FINANCE: {
    viewDashboard: true,
    viewLeads: false,
    createLead: false,
    viewFollowupWork: false,
    viewTasks: false,
    viewNotes: false,
    viewOperations: false,
    viewConnectors: true,
    viewPayouts: true,
    viewExpenses: true,
    viewReports: true,
    manageUsers: false,
    manageBranches: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    viewAttendance: false,
    viewLenders: false,
  },
};

const Sidebar = ({ isOpen, setIsOpen }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const [logoFailed, setLogoFailed] = useState(false);
  const companyLogo = localStorage.getItem("companyLogo");
  const companyName = localStorage.getItem("companyName");

  const isActive = (path) => location.pathname === path;
  const employeeRole = localStorage.getItem("employeeRole");

  const userRole = localStorage.getItem("userRole") || "";
  const isCompanyAdmin =
    ["COMPANY_ADMIN", "SUPERADMIN"].includes(userRole.toUpperCase()) ||
    ["admin", "superadmin"].includes(employeeRole?.toLowerCase());

  let userPermissions = {};
  try {
    userPermissions = JSON.parse(localStorage.getItem("userPermissions") || "{}");
  } catch {
    userPermissions = {};
  }

  const canManageSettings = isCompanyAdmin || Boolean(userPermissions.manageSettings);

  const checkPermission = (permKey) => {
    if (isCompanyAdmin) return true;
    if (!permKey) return true;
    if (permKey === "viewExpenses") return true;
    if (userPermissions[permKey] === true) return true;
    if (userPermissions[permKey] === false) return false;

    const normalizedRole =
      employeeRole === "operations" || userRole.toUpperCase() === "OPERATIONS" || userRole.toUpperCase() === "OPS"
        ? "OPS"
        : employeeRole === "finance" || userRole.toUpperCase() === "FINANCE"
        ? "FINANCE"
        : employeeRole === "calling" || employeeRole === "employee" || userRole.toUpperCase() === "EMPLOYEE"
        ? "EMPLOYEE"
        : "MANAGER";

    const roleDefault = ROLE_DEFAULTS[normalizedRole]?.[permKey];
    if (roleDefault !== undefined) {
      return Boolean(roleDefault);
    }

    return false;
  };

  const managerNavItems = [
    { path: "/", label: "Dashboard", icon: "home" },
    { path: "/leads", label: "Leads", icon: "document", permission: "viewLeads" },
    { path: "/followup-work", label: "Today Followup / Work", icon: "calendar", permission: "viewFollowupWork" },
    { path: "/tasks", label: "Tasks", icon: "task", permission: "viewTasks" },
    { path: "/notes", label: "Quick Notes", icon: "document", permission: "viewNotes" },
    { path: "/operations", label: "Operations", icon: "operations", permission: "viewOperations" },
    { path: "/loan-products", label: "Loan Types", icon: "template", permission: "manageLoanProducts" },
    { path: "/lead-statuses", label: "Lead Statuses", icon: "lead_report", permission: "manageLeadStatuses" },
    { path: "/lead-sources", label: "Lead Sources", icon: "template", permission: "manageLeadSources" },
    { path: "/document-types", label: "Document Types", icon: "document", permission: "manageLoanProducts" },
    { path: "/add-users", label: "Add Employees", icon: "user-add", permission: "manageUsers" },
    { path: "/attendance", label: "Attendance", icon: "calendar", permission: "viewAttendance" },
    { path: "/party-payouts", label: "Party / Connector Details", icon: "template", permission: "viewConnectors" },
    { path: "/case-payouts", label: "Disbursement & Payouts", icon: "performance", permission: "viewPayouts" },
    { path: "/expenses", label: isCompanyAdmin ? "Expense Tracker" : "Expense by Employees", icon: "expense", permission: "viewExpenses" },
    { path: "/performance", label: "Performance Report", icon: "performance", permission: "viewReports" },
    { path: "/lead_report", label: "Lead Report", icon: "lead_report", permission: "viewReports" },
    { path: "/email-templates", label: "Email Templates", icon: "document", permission: "manageSettings" },
    { path: "/template", label: "Template", icon: "template", permission: "manageSettings" },
    canManageSettings
      ? { path: "/settings", label: "Settings", icon: "settings", permission: "manageSettings" }
      : { path: "/profile", label: "My Profile", icon: "profile" },
    { path: "/logout", label: "Logout", icon: "logout" },
  ];

  const operationsNavItems = [
    { path: "/", label: "Dashboard", icon: "home", permission: "viewDashboard" },
    { path: "/leads", label: "Leads", icon: "document", permission: "viewLeads" },
    { path: "/followup-work", label: "Today Followup / Work", icon: "calendar", permission: "viewFollowupWork" },
    { path: "/notes", label: "Quick Notes", icon: "document", permission: "viewNotes" },
    { path: "/operations", label: "Operations", icon: "operations", permission: "viewOperations" },
    { path: "/email-templates", label: "Email Templates", icon: "document", permission: "manageSettings" },
    { path: "/party-payouts", label: "Party / Connector Details", icon: "template", permission: "viewConnectors" },
    { path: "/case-payouts", label: "Disbursement & Payouts", icon: "performance", permission: "viewPayouts" },
    { path: "/expenses", label: isCompanyAdmin ? "Expense Tracker" : "Expense by Employees", icon: "expense", permission: "viewExpenses" },
    canManageSettings
      ? { path: "/settings", label: "Settings", icon: "settings", permission: "manageSettings" }
      : { path: "/profile", label: "My Profile", icon: "profile" },
    { path: "/logout", label: "Logout", icon: "logout" },
  ];

  const employeeNavItems = [
    { path: "/", label: "Dashboard", icon: "home", permission: "viewDashboard" },
    { path: "/leads", label: "Leads", icon: "document", permission: "viewLeads" },
    { path: "/followup-work", label: "Today Followup / Work", icon: "calendar", permission: "viewFollowupWork" },
    { path: "/notes", label: "Quick Notes", icon: "document", permission: "viewNotes" },
    { path: "/expenses", label: "Expense by Employees", icon: "expense", permission: "viewExpenses" },
    canManageSettings
      ? { path: "/settings", label: "Settings", icon: "settings", permission: "manageSettings" }
      : { path: "/profile", label: "My Profile", icon: "profile" },
    { path: "/logout", label: "Logout", icon: "logout" },
  ];

  const defaultNavItems = [
    { path: "/", label: "Dashboard", icon: "home", permission: "viewDashboard" },
    { path: "/expenses", label: "Expense by Employees", icon: "expense", permission: "viewExpenses" },
    { path: "/profile", label: "My Profile", icon: "profile" },
    { path: "/logout", label: "Logout", icon: "logout" },
  ];

  const rawNavItems =
    employeeRole === "operations"
      ? operationsNavItems
      : employeeRole === "manager"
      ? managerNavItems
      : employeeRole === "calling" || employeeRole === "employee"
      ? employeeNavItems
      : defaultNavItems;

  const navItems = rawNavItems.filter((item) => {
    if (item.permission && !checkPermission(item.permission)) {
      return false;
    }
    return true;
  });

  const getIcon = (icon) => {
    switch (icon) {
      case "home":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M3 12l2-2m0 0l7-7 7 7M5 10v10h4m10-10v10h-4" />
          </svg>
        );
      case "document":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5h6a2 2 0 012 2v12a2 2 0 01-2 2H9a2 2 0 01-2-2V7a2 2 0 012-2z" />
          </svg>
        );
      case "user-add":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M18 9v6m3-3h-6m-3 0a4 4 0 11-8 0 4 4 0 018 0zM4 21v-1a4 4 0 014-4h4" />
          </svg>
        );
      case "calendar":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-12 8h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case "task":
      case "template":
      case "performance":
      case "lead_report":
      case "operations":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M8 7V3m8 4V3m-9 8h10m-12 8h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
          </svg>
        );
      case "expense":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M12 8c-1.657 0-3 .895-3 2s1.343 2 3 2 3 .895 3 2-1.343 2-3 2m0-8c1.11 0 2.08.402 2.599 1M12 8V7m0 1v8m0 0v1m0-1c-1.11 0-2.08-.402-2.599-1M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        );
      case "settings":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        );
      case "profile":
      case "user":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" />
          </svg>
        );
      case "logout":
        return (
          <svg className="w-5 h-5 mr-3" fill="none" stroke="currentColor" strokeWidth={2} viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a2 2 0 01-2 2H5a2 2 0 01-2-2V7a2 2 0 012-2h6a2 2 0 012 2v1" />
          </svg>
        );
      default:
        return null;
    }
  };

  // 👇 fetch from localStorage
  const name = localStorage.getItem("name") || "Guest";
  const email = localStorage.getItem("email") || "No email";
  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <>
      {/* Mobile Backdrop */}
      {isOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 md:hidden transition-opacity"
          onClick={() => setIsOpen && setIsOpen(false)}
        />
      )}

      <nav
        className={`bg-[#1e293b] text-white h-screen fixed top-0 left-0 min-w-[250px] w-64 font-[sans-serif] shadow-lg z-50 flex flex-col transform transition-transform duration-300 ease-in-out
          ${isOpen ? "translate-x-0" : "-translate-x-full"} md:translate-x-0
        `}
      >
        <div className="w-full flex items-center justify-center py-6 px-4 shrink-0">
          <Link to={employeeRole === "operations" ? "/operations" : "/"} onClick={() => setIsOpen && setIsOpen(false)}>
            <div className="flex items-center justify-center p-2 rounded-lg">
              {companyLogo && !logoFailed ? (
                <img
                  src={resolveLogoUrl(companyLogo)}
                  alt={companyName || "Logo"}
                  style={{ maxHeight: "38px", maxWidth: "160px", objectFit: "contain" }}
                  onError={() => setLogoFailed(true)}
                />
              ) : (
                <CrmLogo height={38} />
              )}
            </div>
          </Link>
        </div>

        <div className="flex-1 overflow-y-auto px-4 pb-4">
          <ul className="space-y-2">
            {navItems.map(({ path, label, icon }) => (
              <li key={path}>
                {path === "/logout" ? (
                  <button
                    type="button"
                    onClick={handleLogout}
                    className="w-full flex items-center rounded-lg px-4 py-3 transition-all text-blue-100 hover:bg-blue-700 hover:text-white"
                  >
                    {getIcon(icon)}
                    <span className="text-sm font-medium">{label}</span>
                  </button>
                ) : (
                  <Link
                    to={path}
                    onClick={() => setIsOpen && setIsOpen(false)}
                    className={`flex items-center rounded-lg px-4 py-3 transition-all ${isActive(path)
                        ? "bg-blue-600 text-white shadow-md"
                        : "text-blue-100 hover:bg-blue-700 hover:text-white"
                      }`}
                  >
                    {getIcon(icon)}
                    <span className="text-sm font-medium">{label}</span>
                  </Link>
                )}
              </li>
            ))}
          </ul>
        </div>

        {/* 👇 Bottom profile section (dynamic) */}
        <div className="p-4 border-t border-blue-800 shrink-0">
          <div className="flex items-center space-x-3">
            <div className="h-10 w-10 rounded-full bg-blue-600 flex items-center justify-center shrink-0">
              <span className="text-white font-medium">
                {name.slice(0, 2).toUpperCase()}
              </span>
            </div>
            <div className="overflow-hidden">
              <p className="text-sm font-medium text-white truncate">{name}</p>
              <p className="text-xs text-blue-200 truncate">{email}</p>
            </div>
          </div>
        </div>
      </nav>
    </>
  );
};

export default Sidebar;
