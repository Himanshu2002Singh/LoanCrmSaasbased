import React, { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarClock,
  ChevronLeft,
  ChevronRight,
  ClipboardList,
  Coins,
  FileBarChart,
  FileText,
  Files,
  Filter,
  IndianRupee,
  LayoutDashboard,
  LogOut,
  Mail,
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Share2,
  ShieldCheck,
  StickyNote,
  Tags,
  User,
  UserPlus,
  Users,
  Wallet,
  X,
} from "lucide-react";

import axios from "axios";

import "../styles/adminRedesign.css";
import API_URL from "../config";
import CrmLogo from "./CrmLogo";
import SubscriptionExpiredModal from "./SubscriptionExpiredModal";
import { resolveLogoUrl } from "../utils/logo";

const managerNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/leads", label: "Leads", icon: FileText },
  { path: "/followup-work", label: "Today Followup / Work", icon: CalendarClock, permission: "viewFollowupWork" },
  { path: "/notes", label: "Quick Notes", icon: StickyNote },
  { path: "/add-users", label: "Add Employees", icon: UserPlus, permission: "manageUsers" },
  { path: "/branches", label: "Branches", icon: MapPin },
  { path: "/attendance", label: "Attendance", icon: CalendarDays },
  { path: "/tasks", label: "Tasks", icon: ClipboardList },
  { path: "/template", label: "Template", icon: FileText },
  { path: "/email-templates", label: "Email Templates", icon: Mail },
  { path: "/lead-statuses", label: "Lead Statuses", icon: Tags, permission: "manageLeadStatuses" },
  { path: "/loan-products", label: "Loan Types", icon: Coins, permission: "manageLoanProducts" },
  { path: "/lead-sources", label: "Lead Sources", icon: Share2, permission: "manageLeadSources" },
  { path: "/document-types", label: "Document Types", icon: Files },
  { path: "/lenders", label: "Lenders & NBFC", icon: Building2 },
  { path: "/operations", label: "Operations", icon: BriefcaseBusiness, permission: "viewOperations" },
  { path: "/party-payouts", label: "Party / Connector Details", icon: Receipt, permission: "viewConnectors" },
  { path: "/case-payouts", label: "Disbursement & Payouts", icon: IndianRupee, permission: "viewPayouts" },
  { path: "/expenses", label: "Expense Tracker", icon: Wallet },
  { path: "/banker/queries", label: "Banker Queries", icon: ClipboardList },
  { path: "/performance", label: "Performance Report", icon: BarChart3, permission: "viewReports" },
  { path: "/lead_report", label: "Lead Report", icon: FileBarChart, permission: "viewReports" },
  { path: "/role-permissions", label: "Role Permissions", icon: ShieldCheck, permission: "manageSettings" },
  { path: "/company", label: "Company & Plan", icon: Building2 },
  { path: "/profile", label: "Profile", icon: User },
  { path: "/settings", label: "Settings", icon: Settings, permission: "manageSettings" },
];

const operationsNavItems = [
  { path: "/leads", label: "Leads", icon: FileText, permission: "viewLeads" },
  { path: "/followup-work", label: "Today Followup / Work", icon: CalendarClock, permission: "viewFollowupWork" },
  { path: "/notes", label: "Quick Notes", icon: StickyNote },
  { path: "/email-templates", label: "Email Templates", icon: Mail },
  { path: "/lead-statuses", label: "Lead Statuses", icon: Tags, permission: "manageLeadStatuses" },
  { path: "/loan-products", label: "Loan Types", icon: Coins, permission: "manageLoanProducts" },
  { path: "/lead-sources", label: "Lead Sources", icon: Share2, permission: "manageLeadSources" },
  { path: "/lenders", label: "Lenders & NBFC", icon: Building2 },
  { path: "/operations", label: "Operations", icon: BriefcaseBusiness, permission: "viewOperations" },
  { path: "/party-payouts", label: "Party / Connector Details", icon: Receipt, permission: "viewConnectors" },
  { path: "/case-payouts", label: "Disbursement & Payouts", icon: IndianRupee, permission: "viewPayouts" },
  { path: "/expenses", label: "Expenses", icon: Wallet },
  { path: "/banker/queries", label: "Banker Queries", icon: ClipboardList },
  { path: "/profile", label: "Profile", icon: User },
];

const bankerNavItems = [
  { path: "/banker", label: "Assigned Applications", icon: BriefcaseBusiness },
  { path: "/banker/queries", label: "Clarification Queries", icon: ClipboardList },
  { path: "/profile", label: "Profile", icon: User },
];

const financeNavItems = [
  { path: "/case-payouts", label: "Disbursement & Payouts", icon: IndianRupee, permission: "viewPayouts" },
  { path: "/expenses", label: "Expense Tracker", icon: Wallet },
  { path: "/party-payouts", label: "Party / Connector Details", icon: Receipt, permission: "viewConnectors" },
  { path: "/lead_report", label: "Lead Report", icon: FileBarChart, permission: "viewReports" },
  { path: "/performance", label: "Performance Report", icon: BarChart3, permission: "viewReports" },
  { path: "/notes", label: "Quick Notes", icon: StickyNote },
  { path: "/profile", label: "Profile", icon: User },
];

const employeeNavItems = [
  { path: "/leads", label: "Leads", icon: FileText, permission: "viewLeads" },
  { path: "/followup-work", label: "Today Followup / Work", icon: CalendarClock, permission: "viewFollowupWork" },
  { path: "/notes", label: "Quick Notes", icon: StickyNote },
  { path: "/operations", label: "Operations", icon: BriefcaseBusiness, permission: "viewOperations" },
  { path: "/lead-statuses", label: "Lead Statuses", icon: Tags, permission: "manageLeadStatuses" },
  { path: "/loan-products", label: "Loan Types", icon: Coins, permission: "manageLoanProducts" },
  { path: "/lead-sources", label: "Lead Sources", icon: Share2, permission: "manageLeadSources" },
  { path: "/expenses", label: "Employee Expenses", icon: Wallet },
  { path: "/profile", label: "Profile", icon: User },
];


const defaultStatusLabels = [
  "Fresh Lead",
  "Interested",
  "Call Back",
  "Follow up",
  "No Requirement",
  "Call Not Pick",
  "Not Pick",
  "Not Connected",
  "Document Pending",
  "Document Rejected",
  "File Login",
  "Invalid Number",
  "Number buzy",
  "number swtich off",
  "Loan Section",
  "Loan Disbursement",
];

const getDefaultDateRange = () => {
  const endDate = new Date();
  endDate.setDate(endDate.getDate() + 1);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const formatInputDate = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    fromDate: formatInputDate(startDate),
    toDate: formatInputDate(endDate),
  };
};

function AdminRedesignLayout({ children }) {
  const location = useLocation();
  const navigate = useNavigate();
  const [collapsed, setCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const defaultDateRange = useMemo(getDefaultDateRange, []);
  const [filters, setFilters] = useState({
    ...defaultDateRange,
    employeeId: "All",
    status: "All",
  });
  const [employees, setEmployees] = useState([]);
  const [statuses, setStatuses] = useState(defaultStatusLabels);
  const employeeRole = localStorage.getItem("employeeRole");
  const userRole = localStorage.getItem("userRole") || "";
  const [userName, setUserName] = useState(() => localStorage.getItem("name") || "Guest");
  const [userEmail, setUserEmail] = useState(() => localStorage.getItem("email") || "");
  const [companyLogo, setCompanyLogo] = useState(() => localStorage.getItem("companyLogo") || "");
  const [companyName, setCompanyName] = useState(() => localStorage.getItem("companyName") || "");
  const [logoFailed, setLogoFailed] = useState(false);

  useEffect(() => {
    const syncUserProfile = () => {
      setUserName(localStorage.getItem("name") || "Guest");
      setUserEmail(localStorage.getItem("email") || "");
    };
    window.addEventListener("storage", syncUserProfile);
    window.addEventListener("user_profile_updated", syncUserProfile);
    return () => {
      window.removeEventListener("storage", syncUserProfile);
      window.removeEventListener("user_profile_updated", syncUserProfile);
    };
  }, []);

  const isCompanyAdmin =
    ["COMPANY_ADMIN", "SUPERADMIN"].includes(userRole.toUpperCase()) ||
    ["admin", "superadmin"].includes(employeeRole?.toLowerCase());

  const isOperations =
    userRole.toUpperCase() === "OPERATIONS" ||
    userRole.toUpperCase() === "OPS" ||
    employeeRole?.toLowerCase() === "operations" ||
    employeeRole?.toLowerCase() === "ops";

  const isBanker =
    userRole.toUpperCase() === "BANKER" ||
    employeeRole?.toLowerCase() === "banker";

  const isFinance =
    userRole.toUpperCase() === "FINANCE" ||
    employeeRole?.toLowerCase() === "finance";

  const isEmployee =
    userRole.toUpperCase() === "EMPLOYEE" ||
    ["calling", "employee"].includes(employeeRole?.toLowerCase());

  const userPermissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  }, []);

  const rawNavItems = useMemo(() => {
    if (isBanker) return bankerNavItems;
    if (isFinance) {
      const items = [...financeNavItems];
      if (userPermissions?.viewLeads) {
        items.unshift({ path: "/leads", label: "Leads", icon: FileText, permission: "viewLeads" });
      }
      if (userPermissions?.viewOperations) {
        items.splice(2, 0, { path: "/operations", label: "Operations", icon: BriefcaseBusiness, permission: "viewOperations" });
      }
      if (userPermissions?.viewFollowupWork) {
        items.splice(1, 0, { path: "/followup-work", label: "Today Followup / Work", icon: CalendarClock, permission: "viewFollowupWork" });
      }
      if (userPermissions?.manageUsers) {
        items.push({ path: "/add-users", label: "Add Employees", icon: UserPlus, permission: "manageUsers" });
      }
      return items;
    }
    if (isOperations) {
      const items = [...operationsNavItems];
      if (userPermissions?.manageUsers) {
        items.splice(3, 0, { path: "/add-users", label: "Add Employees", icon: UserPlus, permission: "manageUsers" });
      }
      return items;
    }
    if (isEmployee) {
      const items = [...employeeNavItems];
      if (userPermissions?.viewPayouts) {
        items.push({ path: "/case-payouts", label: "Disbursement & Payouts", icon: IndianRupee, permission: "viewPayouts" });
      }
      if (userPermissions?.viewConnectors) {
        items.push({ path: "/party-payouts", label: "Party / Connector Details", icon: Receipt, permission: "viewConnectors" });
      }
      if (userPermissions?.viewReports) {
        items.push({ path: "/performance", label: "Performance Report", icon: BarChart3, permission: "viewReports" });
        items.push({ path: "/lead_report", label: "Lead Report", icon: FileBarChart, permission: "viewReports" });
      }
      if (userPermissions?.manageUsers) {
        items.push({ path: "/add-users", label: "Add Employees", icon: UserPlus, permission: "manageUsers" });
      }
      if (userPermissions?.manageSettings) {
        items.push({ path: "/settings", label: "Settings", icon: Settings, permission: "manageSettings" });
      }
      return items;
    }
    return managerNavItems;
  }, [isBanker, isFinance, isOperations, isEmployee, userPermissions]);

  const navItems = useMemo(() => {
    let items = rawNavItems;
    // Hide Company & Plan from non-company-admin users so they only see their Profile
    if (!isCompanyAdmin) {
      items = items.filter((item) => item.path !== "/company");
    }
    return items.filter((item) => {
      if (isCompanyAdmin) return true;
      if (!item.permission) return true;
      const hasPermission = Boolean(userPermissions[item.permission] || userPermissions.manageSettings);
      return userPermissions[item.permission] !== false && hasPermission;
    });
  }, [rawNavItems, isCompanyAdmin, userPermissions]);


  const homePath =
    isFinance
      ? "/case-payouts"
      : employeeRole === "banker"
      ? "/banker"
      : employeeRole === "operations"
      ? "/operations"
      : isEmployee
      ? "/leads"
      : "/";
  const isDashboard = location.pathname === "/" || location.pathname === "/banker" || (isFinance && location.pathname === "/case-payouts");

  const initials = useMemo(() => {
    return (
      userName
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((part) => part[0])
        .join("")
        .toUpperCase() || "CC"
    );
  }, [userName]);


  const isActive = (path) => {
    if (path === "/" || path === "/banker") return location.pathname === path;
    return location.pathname === path || location.pathname.startsWith(`${path}/`);
  };

  const handleLogout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  const handleFilterChange = (key, value) => {
    setFilters((current) => ({
      ...current,
      [key]: value,
    }));
  };

  const resetFilters = () => {
    setFilters({
      ...defaultDateRange,
      employeeId: "All",
      status: "All",
    });
  };

  useEffect(() => {
    const fetchFilterOptions = async () => {
      try {
        const [employeeResponse, statusResponse] = await Promise.all([
          axios.get(`${API_URL}/users`, { params: { limit: 200 } }),
          axios.get(`${API_URL}/lead-statuses`),
        ]);
        setEmployees(employeeResponse.data?.data || []);
        const backendStatuses = statusResponse.data?.statuses?.map((status) => status.name).filter(Boolean);
        if (backendStatuses?.length) {
          setStatuses(backendStatuses);
        }
      } catch (error) {
        console.error("Error fetching dashboard filter options", error);
      }
    };

    fetchFilterOptions();
  }, []);

  useEffect(() => {
    const fetchCompanyData = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await axios.get(`${API_URL}/company/profile`);
        const profile = res.data?.data;
        if (profile) {
          if (profile.logoUrl !== undefined) {
            setCompanyLogo(profile.logoUrl || "");
            localStorage.setItem("companyLogo", profile.logoUrl || "");
          }
          if (profile.name) {
            setCompanyName(profile.name);
            localStorage.setItem("companyName", profile.name);
          }
          setLogoFailed(false);
        }
      } catch {
        // Silently skip if tenant profile is unavailable
      }
    };

    fetchCompanyData();

    const handleProfileUpdate = () => {
      fetchCompanyData();
    };

    window.addEventListener("company_profile_updated", handleProfileUpdate);
    return () => {
      window.removeEventListener("company_profile_updated", handleProfileUpdate);
    };
  }, []);

  const enhancedChildren = isValidElement(children)
    ? cloneElement(children, {
        dashboardFilters: filters,
        dashboardFilterOptions: { employees, statuses },
      })
    : children;

  return (
    <div className={`cc-admin ${collapsed ? "cc-admin-collapsed" : ""}`}>
      {mobileOpen && (
        <button
          type="button"
          className="cc-mobile-backdrop"
          onClick={() => setMobileOpen(false)}
          aria-label="Close navigation"
        />
      )}

      <aside className={`cc-sidebar ${mobileOpen ? "cc-sidebar-open" : ""}`}>
        <div className="cc-sidebar-brand">
          <button
            type="button"
            className="cc-collapse-btn"
            onClick={() => setCollapsed((value) => !value)}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            title={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? <PanelLeftOpen size={17} /> : <PanelLeftClose size={17} />}
          </button>
          <Link
            to={homePath}
            onClick={() => setMobileOpen(false)}
            className="cc-brand-link"
          >
            <div className="cc-logo-full">
              {companyLogo && !logoFailed ? (
                <div className="cc-tenant-brand">
                  <img
                    src={resolveLogoUrl(companyLogo)}
                    alt={companyName || "Company Logo"}
                    className="cc-tenant-logo"
                    onError={() => setLogoFailed(true)}
                  />
                  {companyName && (
                    <div className="cc-tenant-meta">
                      <span className="cc-tenant-title">{companyName}</span>
                      <span className="cc-tenant-sub">CRM PORTAL</span>
                    </div>
                  )}
                </div>
              ) : (
                <CrmLogo />
              )}
            </div>
            <div className="cc-logo-mark">
              {companyLogo && !logoFailed ? (
                <div className="cc-tenant-logo-mark-wrap">
                  <img
                    src={resolveLogoUrl(companyLogo)}
                    alt={companyName || "Logo"}
                    className="cc-tenant-logo-mark"
                    onError={() => setLogoFailed(true)}
                  />
                </div>
              ) : (
                <CrmLogo markOnly height={36} />
              )}
            </div>
          </Link>
        </div>

        <nav className="cc-sidebar-nav">
          {navItems.map((item) => {
            const Icon = item.icon;

            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                onClick={() => setMobileOpen(false)}
                className={`cc-nav-item ${isActive(item.path) ? "cc-nav-item-active" : ""}`}
              >
                <Icon size={19} />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        <div className="cc-sidebar-footer">
          <Link to="/profile" className="cc-sidebar-profile" style={{ textDecoration: "none" }} title="View & Edit Profile">
            <span className="cc-profile-avatar">{initials}</span>
            <span className="cc-profile-text">
              <strong>{userName}</strong>
              {userEmail && <small>{userEmail}</small>}
            </span>
          </Link>
          <button type="button" className="cc-nav-item cc-logout" onClick={handleLogout}>

            <LogOut size={19} />
            <span>Logout</span>
          </button>
        </div>
      </aside>

      <div className="cc-shell">
        <header className="cc-header cc-header-mobile-only">
          <button
            type="button"
            className="cc-mobile-menu"
            onClick={() => setMobileOpen((value) => !value)}
            aria-label="Open navigation"
          >
            {mobileOpen ? <X size={21} /> : <Menu size={21} />}
          </button>

          <Link to={homePath} className="cc-mobile-brand">
            {companyLogo && !logoFailed ? (
              <img
                src={resolveLogoUrl(companyLogo)}
                alt={companyName || "Logo"}
                className="cc-tenant-logo-mobile"
                onError={() => setLogoFailed(true)}
              />
            ) : (
              <CrmLogo height={32} />
            )}
          </Link>
        </header>

        {isDashboard && (
          <section className="cc-filter-band">
            <label className="cc-filter-chip cc-date-filter">
              <CalendarDays size={17} />
              <input
                type="date"
                value={filters.fromDate}
                max={filters.toDate}
                onChange={(event) => handleFilterChange("fromDate", event.target.value)}
                aria-label="From date"
              />
              <span>to</span>
              <input
                type="date"
                value={filters.toDate}
                min={filters.fromDate}
                onChange={(event) => handleFilterChange("toDate", event.target.value)}
                aria-label="To date"
              />
            </label>
            <label className="cc-filter-chip">
              <Users size={17} />
              <select
                value={filters.employeeId}
                onChange={(event) => handleFilterChange("employeeId", event.target.value)}
                aria-label="Filter employee"
              >
                <option value="All">All employees</option>
                {employees.map((employee) => (
                  <option key={employee.id} value={employee.id}>
                    {employee.name || employee.id}
                  </option>
                ))}
              </select>
            </label>
            <label className="cc-filter-chip">
              <Filter size={17} />
              <select
                value={filters.status}
                onChange={(event) => handleFilterChange("status", event.target.value)}
                aria-label="Filter status"
              >
                <option value="All">All statuses</option>
                {statuses.map((status) => (
                  <option key={status} value={status}>
                    {status}
                  </option>
                ))}
              </select>
            </label>
            <button type="button" className="cc-filter-reset" onClick={resetFilters}>
              Reset
            </button>
          </section>
        )}

        <main className="cc-content">{enhancedChildren}</main>
        <SubscriptionExpiredModal />
      </div>
    </div>
  );
}

export default AdminRedesignLayout;
