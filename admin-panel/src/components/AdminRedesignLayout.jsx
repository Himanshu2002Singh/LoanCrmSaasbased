import React, { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
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
  MapPin,
  Menu,
  PanelLeftClose,
  PanelLeftOpen,
  Receipt,
  Settings,
  Share2,
  ShieldCheck,
  Tags,
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

const managerNavItems = [
  { path: "/", label: "Dashboard", icon: LayoutDashboard },
  { path: "/leads", label: "Leads", icon: FileText },
  { path: "/add-users", label: "Add Employees", icon: UserPlus, permission: "manageUsers" },
  { path: "/branches", label: "Branches", icon: MapPin },
  { path: "/attendance", label: "Attendance", icon: CalendarDays },
  { path: "/tasks", label: "Tasks", icon: ClipboardList },
  { path: "/template", label: "Template", icon: FileText },
  { path: "/lead-statuses", label: "Lead Statuses", icon: Tags },
  { path: "/loan-products", label: "Loan Types", icon: Coins },
  { path: "/lead-sources", label: "Lead Sources", icon: Share2 },
  { path: "/document-types", label: "Document Types", icon: Files },
  { path: "/lenders", label: "Lenders & NBFC", icon: Building2 },
  { path: "/operations", label: "Operations", icon: BriefcaseBusiness },
  { path: "/party-payouts", label: "Party / Connector Details", icon: Receipt, permission: "viewConnectors" },
  { path: "/case-payouts", label: "Disbursement & Payouts", icon: IndianRupee, permission: "viewPayouts" },
  { path: "/expenses", label: "Expense Tracker", icon: Wallet, permission: "viewExpenses" },
  { path: "/banker/queries", label: "Banker Queries", icon: ClipboardList },
  { path: "/performance", label: "Performance Report", icon: BarChart3, permission: "viewReports" },
  { path: "/lead_report", label: "Lead Report", icon: FileBarChart, permission: "viewReports" },
  { path: "/role-permissions", label: "Role Permissions", icon: ShieldCheck, permission: "manageSettings" },
  { path: "/company", label: "Company & Plan", icon: Building2 },
  { path: "/settings", label: "Settings", icon: Settings, permission: "manageSettings" },
];

const operationsNavItems = [
  { path: "/operations", label: "Operations", icon: BriefcaseBusiness },
  { path: "/party-payouts", label: "Party / Connector Details", icon: Receipt, permission: "viewConnectors" },
  { path: "/case-payouts", label: "Disbursement & Payouts", icon: IndianRupee, permission: "viewPayouts" },
  { path: "/expenses", label: "Expense Tracker", icon: Wallet, permission: "viewExpenses" },
  { path: "/banker/queries", label: "Banker Queries", icon: ClipboardList },
];

const bankerNavItems = [
  { path: "/banker", label: "Assigned Applications", icon: BriefcaseBusiness },
  { path: "/banker/queries", label: "Clarification Queries", icon: ClipboardList },
  { path: "/company", label: "Company Profile", icon: Building2 },
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
  const name = localStorage.getItem("name") || "Guest";
  const email = localStorage.getItem("email") || "";

  const isCompanyAdmin =
    ["COMPANY_ADMIN", "SUPERADMIN"].includes(userRole.toUpperCase()) ||
    ["admin", "superadmin"].includes(employeeRole?.toLowerCase());

  const userPermissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  }, []);

  const rawNavItems =
    employeeRole === "banker"
      ? bankerNavItems
      : employeeRole === "operations"
      ? operationsNavItems
      : managerNavItems;

  const navItems = useMemo(() => {
    if (isCompanyAdmin) return rawNavItems;
    return rawNavItems.filter((item) => {
      if (!item.permission) return true;
      return Boolean(userPermissions[item.permission]);
    });
  }, [rawNavItems, isCompanyAdmin, userPermissions]);

  const homePath =
    employeeRole === "banker"
      ? "/banker"
      : employeeRole === "operations"
      ? "/operations"
      : "/";
  const isDashboard = location.pathname === "/" || location.pathname === "/banker";

  const initials = useMemo(() => {
    return name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0])
      .join("")
      .toUpperCase() || "CC";
  }, [name]);

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
              <CrmLogo />
            </div>
            <div className="cc-logo-mark">
              <CrmLogo markOnly height={36} />
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
          <div className="cc-sidebar-profile">
            <span className="cc-profile-avatar">{initials}</span>
            <span className="cc-profile-text">
              <strong>{name}</strong>
              {email && <small>{email}</small>}
            </span>
          </div>
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
            <CrmLogo height={32} />
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
