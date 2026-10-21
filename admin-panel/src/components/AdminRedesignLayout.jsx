import React, { cloneElement, isValidElement, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import {
  BarChart3,
  BriefcaseBusiness,
  Building2,
  CalendarDays,
  CalendarClock,
  ChevronDown,
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
  Plus,
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
import { saveTheme, applyTheme } from "../utils/theme";

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
    createLender: false,
    editLender: false,
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
    createLender: false,
    editLender: false,
  },
  BANKER: {
    viewDashboard: true,
    viewLeads: false,
    createLead: false,
    viewFollowupWork: false,
    viewTasks: false,
    viewNotes: false,
    viewOperations: false,
    viewConnectors: false,
    viewPayouts: false,
    viewExpenses: false,
    viewReports: false,
    manageUsers: false,
    manageBranches: false,
    manageSettings: false,
    manageLeadStatuses: false,
    manageLoanProducts: false,
    manageLeadSources: false,
    viewAttendance: false,
    viewLenders: true,
  },
};

const bankerNavItems = [
  { path: "/banker", label: "Assigned Applications", icon: BriefcaseBusiness },
  { path: "/banker/queries", label: "Clarification Queries", icon: ClipboardList },
  { path: "/profile", label: "Profile", icon: User },
];

const masterNavStructure = [
  {
    type: "link",
    path: "/",
    label: "Dashboard",
    icon: LayoutDashboard,
    permission: "viewDashboard",
  },
  {
    type: "group",
    id: "leads",
    label: "Leads",
    icon: FileText,
    permission: "viewLeads",
    children: [
      { path: "/leads", label: "All Leads", icon: FileText, exact: true, permission: "viewLeads" },
      {
        path: "/leads?action=add",
        label: "+ Add Lead",
        icon: Plus,
        permission: "createLead",
        isAction: true,
        actionEvent: "crm_open_add_lead",
      },
      {
        path: "/lead-statuses",
        label: "Lead Statuses",
        icon: Tags,
        permission: "manageLeadStatuses",
      },
      {
        path: "/lead-statuses?action=add",
        label: "+ Add Lead Status",
        icon: Plus,
        permission: "manageLeadStatuses",
        isAction: true,
        actionEvent: "crm_open_add_lead_status",
      },
      {
        path: "/lead-sources",
        label: "Lead Sources",
        icon: Share2,
        permission: "manageLeadSources",
      },
    ],
  },
  {
    type: "group",
    id: "work",
    label: "Followups & Tasks",
    icon: CalendarClock,
    children: [
      {
        path: "/followup-work",
        label: "Today Followup",
        icon: CalendarClock,
        permission: "viewFollowupWork",
      },
      { path: "/tasks", label: "Tasks", icon: ClipboardList, permission: "viewTasks" },
      { path: "/notes", label: "Quick Notes", icon: StickyNote, permission: "viewNotes" },
    ],
  },
  {
    type: "link",
    path: "/operations",
    label: "Operations",
    icon: BriefcaseBusiness,
    permission: "viewOperations",
  },
  {
    type: "group",
    id: "bankers",
    label: "Bankers & Lenders",
    icon: Building2,
    permission: "viewLenders",
    children: [
      { path: "/lenders", label: "Lenders & NBFC", icon: Building2, permission: "viewLenders" },
      { path: "/banker/queries", label: "Banker Queries", icon: ClipboardList, permission: "viewLenders" },
    ],
  },
  {
    type: "group",
    id: "loans",
    label: "Loan Products",
    icon: Coins,
    permission: "manageLoanProducts",
    children: [
      {
        path: "/loan-products",
        label: "Loan Types & Products",
        icon: Coins,
        permission: "manageLoanProducts",
      },
      {
        path: "/loan-products?action=add",
        label: "+ Add Loan Product",
        icon: Plus,
        permission: "manageLoanProducts",
        isAction: true,
        actionEvent: "crm_open_add_loan_product",
      },
      { path: "/document-types", label: "Document Types", icon: Files, permission: "manageLoanProducts" },
    ],
  },
  {
    type: "group",
    id: "team",
    label: "Team & Workplace",
    icon: Users,
    children: [
      {
        path: "/add-users",
        label: "Employees",
        icon: UserPlus,
        permission: "manageUsers",
      },
      { path: "/branches", label: "Branches", icon: MapPin, permission: "manageBranches" },
      { path: "/attendance", label: "Attendance", icon: CalendarDays, permission: "viewAttendance" },
    ],
  },
  {
    type: "group",
    id: "payouts",
    label: "Payouts & Connectors",
    icon: IndianRupee,
    children: [
      {
        path: "/party-payouts",
        label: "Party / Connector Details",
        icon: Receipt,
        permission: "viewConnectors",
      },
      {
        path: "/case-payouts",
        label: "Disbursement & Payouts",
        icon: IndianRupee,
        permission: "viewPayouts",
      },
    ],
  },
  {
    type: "link",
    path: "/expenses",
    label: "Expense Tracker",
    icon: Wallet,
    permission: "viewExpenses",
  },
  {
    type: "group",
    id: "reports",
    label: "Reports & Analytics",
    icon: BarChart3,
    permission: "viewReports",
    children: [
      {
        path: "/performance",
        label: "Performance Report",
        icon: BarChart3,
        permission: "viewReports",
      },
      {
        path: "/lead_report",
        label: "Lead Report",
        icon: FileBarChart,
        permission: "viewReports",
      },
    ],
  },
  {
    type: "group",
    id: "settings",
    label: "Settings & Config",
    icon: Settings,
    children: [
      {
        path: "/settings",
        label: "General Settings",
        icon: Settings,
        permission: "manageSettings",
      },
      {
        path: "/role-permissions",
        label: "Role Permissions",
        icon: ShieldCheck,
        permission: "manageSettings",
      },
      {
        path: "/company",
        label: "Company & Plan",
        icon: Building2,
        adminOnly: true,
      },
      { path: "/email-templates", label: "Email Templates", icon: Mail, permission: "manageSettings" },
      { path: "/template", label: "Document Templates", icon: FileText, permission: "manageSettings" },
      {
        path: "/profile",
        label: "My Profile",
        icon: User,
      },
    ],
  },
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

  const [permSyncTrigger, setPermSyncTrigger] = useState(0);

  useEffect(() => {
    const syncUserProfile = () => {
      setUserName(localStorage.getItem("name") || "Guest");
      setUserEmail(localStorage.getItem("email") || "");
    };

    const handlePermUpdate = () => {
      setPermSyncTrigger((v) => v + 1);
    };

    const fetchFreshPermissions = async () => {
      try {
        const token = localStorage.getItem("token");
        if (!token) return;
        const res = await axios.get(`${API_URL}/auth/me`);
        const u = res.data?.user;
        if (u?.resolvedPermissions) {
          const freshPerms = JSON.stringify(u.resolvedPermissions);
          if (localStorage.getItem("userPermissions") !== freshPerms) {
            localStorage.setItem("userPermissions", freshPerms);
            setPermSyncTrigger((v) => v + 1);
          }
        }
      } catch (e) {
        // Silent catch
      }
    };
    fetchFreshPermissions();

    window.addEventListener("storage", syncUserProfile);
    window.addEventListener("user_profile_updated", syncUserProfile);
    window.addEventListener("permissions_updated", handlePermUpdate);
    window.addEventListener("storage", handlePermUpdate);
    return () => {
      window.removeEventListener("storage", syncUserProfile);
      window.removeEventListener("user_profile_updated", syncUserProfile);
      window.removeEventListener("permissions_updated", handlePermUpdate);
      window.removeEventListener("storage", handlePermUpdate);
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
      const perms = JSON.parse(localStorage.getItem("userPermissions") || "{}");
      return { ...perms, viewExpenses: true };
    } catch {
      return { viewExpenses: true };
    }
  }, [permSyncTrigger]);

  const navItems = useMemo(() => {
    if (isBanker) return bankerNavItems;

    const canManageSettings = isCompanyAdmin || Boolean(userPermissions.manageSettings);

    const checkPermission = (permKey) => {
      // 1. Company Admin always has full access to all options
      if (isCompanyAdmin) return true;
      if (!permKey) return true;

      // Expense by employees is universal for all staff roles (Operations, Manager, Employee, Finance)
      if (permKey === "viewExpenses") return true;

      // 2. Explicit permission grant or denial takes highest precedence
      if (userPermissions[permKey] === true) return true;
      if (userPermissions[permKey] === false) return false;

      // 3. Fallback to strict role default permissions
      const normalizedRole = isOperations
        ? "OPS"
        : isFinance
        ? "FINANCE"
        : isBanker
        ? "BANKER"
        : isEmployee
        ? "EMPLOYEE"
        : "MANAGER";

      const roleDefault = ROLE_DEFAULTS[normalizedRole]?.[permKey];
      if (roleDefault !== undefined) {
        return Boolean(roleDefault);
      }

      // 4. Default: If permission is not granted, hide completely
      return false;
    };

    return masterNavStructure
      .map((item) => {
        // Single link item
        if (item.type === "link") {
          if (item.adminOnly && !isCompanyAdmin) return null;

          if (item.permission && !checkPermission(item.permission)) {
            return null;
          }

          let itemLabel = item.label;
          if (item.path === "/expenses") {
            itemLabel = isCompanyAdmin || isFinance ? "Expense Tracker" : "Expense by Employees";
          }

          return { ...item, label: itemLabel };
        }

        // Group item with children
        if (item.type === "group") {
          // If this is the settings group and user does not have manageSettings permission,
          // replace the entire settings group with a direct single link to "My Profile".
          if (item.id === "settings") {
            if (!canManageSettings) {
              return {
                type: "link",
                path: "/profile",
                label: "My Profile",
                icon: User,
              };
            }
          }

          if (item.permission && !checkPermission(item.permission)) {
            return null;
          }

          // Role-specific suppression for finance
          if (isFinance && item.id === "leads" && !userPermissions?.viewLeads) return null;
          if (isFinance && (item.id === "loans" || item.id === "bankers")) return null;

          // Calling/employee restrictions: hide bankers & lenders completely
          if (isEmployee && item.id === "bankers") {
            return null;
          }

          // Filter children strictly by permissions
          const filteredChildren = (item.children || []).filter((child) => {
            if (child.adminOnly && !isCompanyAdmin) return false;

            if (child.permission && !checkPermission(child.permission)) {
              return false;
            }

            // Exclude admin-level items for non-admins
            if (!canManageSettings) {
              if (
                child.path === "/role-permissions" ||
                child.path === "/company" ||
                child.path === "/email-templates" ||
                child.path === "/template" ||
                child.path === "/settings" ||
                child.path === "/branches"
              ) {
                return false;
              }
            }

            if (isFinance) {
              if (child.path === "/branches" || child.path === "/attendance" || child.path === "/tasks") return false;
            }

            return true;
          });

          // If all children in this group are restricted/hidden, hide the entire group
          if (filteredChildren.length === 0) return null;

          return { ...item, children: filteredChildren };
        }

        return item;
      })
      .filter(Boolean);
  }, [isBanker, isFinance, isOperations, isEmployee, isCompanyAdmin, userPermissions]);

  const isPathActive = (path, isAction = false) => {
    const [pathname, search] = path.split("?");
    if (pathname === "/" || pathname === "/banker") {
      return location.pathname === pathname;
    }
    if (isAction) {
      return location.pathname === pathname && location.search.includes(search);
    }
    const matches = location.pathname === pathname || location.pathname.startsWith(`${pathname}/`);
    if (matches && location.search.includes("action=add")) {
      return false;
    }
    return matches;
  };

  const isGroupActive = (item) => {
    if (!item.children) return false;
    return item.children.some((child) => isPathActive(child.path, child.isAction));
  };

  const [openDropdowns, setOpenDropdowns] = useState({
    leads: true,
  });

  useEffect(() => {
    navItems.forEach((item) => {
      if (item.children && isGroupActive(item)) {
        setOpenDropdowns((prev) => ({ ...prev, [item.id]: true }));
      }
    });
  }, [location.pathname, location.search, navItems]);

  const toggleDropdown = (id) => {
    if (collapsed) {
      setCollapsed(false);
      setOpenDropdowns((prev) => ({ ...prev, [id]: true }));
    } else {
      setOpenDropdowns((prev) => ({ ...prev, [id]: !prev[id] }));
    }
  };

  const handleItemClick = (item, e) => {
    setMobileOpen(false);
    if (item.actionEvent) {
      window.dispatchEvent(new CustomEvent(item.actionEvent));
    }
  };

  const isActive = (path) => isPathActive(path);

  const homePath = employeeRole === "banker" ? "/banker" : "/";
  const isDashboard = location.pathname === "/" || location.pathname === "/banker";

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
          if (profile.themeConfig) {
            saveTheme(profile.themeConfig);
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

            if (item.children) {
              const isOpen = Boolean(openDropdowns[item.id]);
              const groupActive = isGroupActive(item);

              return (
                <div key={item.id} className={`cc-nav-group ${groupActive ? "cc-nav-group-active" : ""}`}>
                  <button
                    type="button"
                    className={`cc-nav-item cc-nav-group-header ${groupActive ? "cc-nav-group-header-active" : ""} ${isOpen ? "cc-nav-group-open" : ""}`}
                    onClick={() => toggleDropdown(item.id)}
                    title={collapsed ? item.label : undefined}
                    aria-expanded={isOpen}
                  >
                    <div className="cc-nav-header-left">
                      <Icon size={19} className="cc-nav-icon" />
                      <span className="cc-nav-label">{item.label}</span>
                    </div>
                    {!collapsed && (
                      <ChevronDown
                        size={15}
                        className={`cc-nav-chevron ${isOpen ? "cc-nav-chevron-rotated" : ""}`}
                      />
                    )}
                  </button>

                  {!collapsed && isOpen && (
                    <div className="cc-nav-group-children">
                      {item.children.map((child) => {
                        const ChildIcon = child.icon || FileText;
                        const active = isPathActive(child.path, child.isAction);

                        return (
                          <Link
                            key={child.path}
                            to={child.path}
                            onClick={(e) => handleItemClick(child, e)}
                            className={`cc-nav-sub-item ${active ? "cc-nav-sub-item-active" : ""} ${child.isAction ? "cc-nav-action-item" : ""}`}
                          >
                            <ChildIcon size={14} className="cc-sub-icon" />
                            <span>{child.label}</span>
                          </Link>
                        );
                      })}
                    </div>
                  )}
                </div>
              );
            }

            const active = isPathActive(item.path);
            return (
              <Link
                key={item.path}
                to={item.path}
                title={collapsed ? item.label : undefined}
                onClick={(e) => handleItemClick(item, e)}
                className={`cc-nav-item ${active ? "cc-nav-item-active" : ""}`}
              >
                <Icon size={19} className="cc-nav-icon" />
                <span className="cc-nav-label">{item.label}</span>
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
