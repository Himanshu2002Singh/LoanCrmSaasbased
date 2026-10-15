import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Shield,
  ShieldAlert,
  ShieldCheck,
  Lock,
  Unlock,
  RotateCcw,
  CheckCircle2,
  XCircle,
  Coins,
  Receipt,
  Wallet,
  FileBarChart,
  Users,
  Settings,
  Trash2,
  Download,
  AlertTriangle,
  Info,
  Sparkles,
  Save,
  Briefcase,
  Layers,
  Search,
  Filter,
  UserCheck,
  UserX,
  ChevronRight,
  Eye,
  EyeOff,
  Phone,
  Mail,
  FileText,
  CalendarClock,
  BriefcaseBusiness,
  IndianRupee,
  BarChart3,
  UserPlus,
  HelpCircle,
} from "lucide-react";
import API_URL from "../../config";

const ROLE_TABS = [
  {
    key: "MANAGER",
    name: "Manager",
    badge: "Team Lead & Oversight",
    color: "#4338ca",
    bg: "#eef2ff",
    description: "Branch managers and team leads managing calling teams and branch targets.",
  },
  {
    key: "OPS",
    name: "Operations",
    badge: "Processing & Credit",
    color: "#c2410c",
    bg: "#fff7ed",
    description: "Back-office and operations staff processing loan files and verifying documents.",
  },
  {
    key: "EMPLOYEE",
    name: "Sales / Calling",
    badge: "Frontline Executives",
    color: "#047857",
    bg: "#eef7f2",
    description: "Telecallers and field sales executives working directly on assigned leads.",
  },
  {
    key: "BANKER",
    name: "Banker / Partner",
    badge: "Underwriting Portal",
    color: "#0369a1",
    bg: "#f0f9ff",
    description: "Bank underwriters and credit managers reviewing allocated applications.",
  },
  {
    key: "FINANCE",
    name: "Finance & Accounts",
    badge: "Disbursements & Expenses",
    color: "#0d9488",
    bg: "#f0fdfa",
    description: "Finance team handling case disbursements, payouts, expenses, and connector dues.",
  },
  {
    key: "EMPLOYEE_WISE",
    name: "Employee-Wise",
    badge: "Staff-Level Overrides",
    color: "#7c3aed",
    bg: "#f5f3ff",
    description: "Customize permissions and sidebar menu access for individual team members.",
  },
];

// Sidebar navigation options for employee-wise customization
const SIDEBAR_MENU_OPTIONS = [
  {
    id: "leads",
    title: "Leads Pipeline",
    route: "/leads",
    icon: FileText,
    primaryKey: "viewLeads",
    description: "Access incoming leads, caller queue, status updates, and customer contact info.",
    relatedKeys: ["createLead", "editLead", "reassignLeads", "viewAllLeads"],
  },
  {
    id: "followup",
    title: "Today Followup / Work Tracker",
    route: "/followup-work",
    icon: CalendarClock,
    primaryKey: "viewFollowupWork",
    description: "Daily scheduled followup dashboard, overdue call reminders, and activity notes.",
    relatedKeys: ["followupLead"],
  },
  {
    id: "operations",
    title: "Operations Pipeline",
    route: "/operations",
    icon: BriefcaseBusiness,
    primaryKey: "viewOperations",
    description: "Loan applications pipeline, file stage progress, and credit document checking.",
    relatedKeys: ["manageOperations", "createLoanApplication"],
  },
  {
    id: "payouts",
    title: "Disbursement & Case Payouts",
    route: "/case-payouts",
    icon: IndianRupee,
    primaryKey: "viewPayouts",
    confidential: true,
    description: "View loan disbursement amounts, bank commissions, and net company revenues.",
    relatedKeys: ["managePayouts"],
  },
  {
    id: "connectors",
    title: "Party / Connector Details",
    route: "/party-payouts",
    icon: Receipt,
    primaryKey: "viewConnectors",
    confidential: true,
    description: "DSA channel partner commission ledgers, payout vouchers, and partner dues.",
    relatedKeys: ["manageConnectors"],
  },
  {
    id: "expenses",
    title: "Office Expense Tracker",
    route: "/expenses",
    icon: Wallet,
    primaryKey: "viewExpenses",
    confidential: true,
    description: "Inspect branch expenses, bills, office rent, staff costs, and cash outflow.",
    relatedKeys: ["manageExpenses"],
  },
  {
    id: "reports",
    title: "Performance & Lead Reports",
    route: "/performance, /lead_report",
    icon: BarChart3,
    primaryKey: "viewReports",
    description: "Lead conversion funnel analysis, telecaller performance, and audit reports.",
    relatedKeys: ["exportData"],
  },
  {
    id: "users",
    title: "Add & Manage Employees",
    route: "/add-users",
    icon: UserPlus,
    primaryKey: "manageUsers",
    description: "Staff onboarding, managing reporting lines, and team employee profiles.",
    relatedKeys: [],
  },
  {
    id: "lead_statuses",
    title: "Lead Statuses",
    route: "/lead-statuses",
    icon: Layers,
    primaryKey: "manageLeadStatuses",
    description: "Lead status pipeline stages, colors, and order configuration.",
    relatedKeys: ["manageSettings"],
  },
  {
    id: "loan_products",
    title: "Loan Types / Products",
    route: "/loan-products",
    icon: Briefcase,
    primaryKey: "manageLoanProducts",
    description: "Company loan types, interest rate bounds, and loan product schemes.",
    relatedKeys: ["manageSettings"],
  },
  {
    id: "lead_sources",
    title: "Lead Sources",
    route: "/lead-sources",
    icon: Filter,
    primaryKey: "manageLeadSources",
    description: "Customer acquisition sources, marketing channels, and partner DSA tags.",
    relatedKeys: ["manageSettings"],
  },
  {
    id: "settings",
    title: "Master Settings & Templates",
    route: "/settings, /templates, /company",
    icon: Settings,
    primaryKey: "manageSettings",
    confidential: true,
    description: "Company loan types, lead sources, email templates, and master parameters.",
    relatedKeys: ["deleteRecords"],
  },
];

const PERMISSION_GROUPS = [
  {
    title: "Financial & Confidential Pages",
    subtitle: "Protect sensitive business revenue, payout margins, and office expense accounts.",
    icon: Coins,
    permissions: [
      {
        key: "viewPayouts",
        label: "Disbursement & Case Payouts (/case-payouts)",
        description: "Access Disbursement & Payouts page to inspect company loan volumes, bank commissions, and net earnings.",
        confidential: true,
      },
      {
        key: "managePayouts",
        label: "Manage Case Payout Calculations",
        description: "Record bank receipts, calculate party commission shares, and edit payout vouchers.",
        confidential: true,
      },
      {
        key: "viewConnectors",
        label: "Connector & Party Details (/party-payouts)",
        description: "Access Connector Details page to see DSA partner commissions, ledger histories, and dues.",
        confidential: true,
      },
      {
        key: "manageConnectors",
        label: "Manage Connectors & Settlements",
        description: "Create new connectors, record payout settlements, advances, and refund credits.",
        confidential: true,
      },
      {
        key: "viewExpenses",
        label: "Office Expense Tracker (/expenses)",
        description: "Access Expense Tracker to view company rent, staff salaries, bills, and monthly cash outflow.",
        confidential: true,
      },
      {
        key: "manageExpenses",
        label: "Manage Office Expense Entries",
        description: "Add, update, or approve company expense transactions.",
        confidential: true,
      },
    ],
  },
  {
    title: "Operations & Loan Processing Pipeline",
    subtitle: "Control operational authority over application pipeline, bank submissions, and verification stages.",
    icon: Briefcase,
    permissions: [
      {
        key: "viewOperations",
        label: "Access Operations Pipeline (/operations)",
        description: "Inspect active loan applications pipeline, stage statuses, customer documents, and banker queries.",
        confidential: false,
      },
      {
        key: "manageOperations",
        label: "Manage File Stages & Bank Submissions",
        description: "Advance pipeline stages, upload customer documents, dispatch files to banks, and reply to banker queries.",
        confidential: false,
      },
      {
        key: "createLoanApplication",
        label: "Create Loan Applications in Leads",
        description: "Permission to open and submit 'Create Loan Application' modal inside lead details.",
        confidential: false,
      },
    ],
  },
  {
    title: "Leads Management & Reporting Visibility",
    subtitle: "Control data visibility boundaries, lead creation, editing, follow-ups, and business analytics.",
    icon: FileBarChart,
    permissions: [
      {
        key: "viewAllLeads",
        label: "View All Company Leads (All Branches / Teams)",
        description: "If enabled, users can view all company leads. If disabled, they only see leads in their own team or assigned directly to them.",
        confidential: false,
      },
      {
        key: "createLead",
        label: "Add & Create Leads",
        description: "Permission to manually create and enter new customer leads into the system.",
        confidential: false,
      },
      {
        key: "editLead",
        label: "Edit Lead Profiles & Details (/lead-edit)",
        description: "Permission to modify customer contact details, loan requirements, priority, and assigned staff.",
        confidential: false,
      },
      {
        key: "reassignLeads",
        label: "Reassign Leads to Employees",
        description: "Permission to reassign leads to other employees within the company.",
        confidential: false,
      },
      {
        key: "followupLead",
        label: "Lead Follow-up & Meeting Scheduling",
        description: "Permission to schedule next meetings, log call follow-up notes, update follow-up dates, and add remarks.",
        confidential: false,
      },
      {
        key: "viewFollowupWork",
        label: "Today Followup / Work Tracker (/followup-work)",
        description: "Access Today Followup & Daily Work dashboard to monitor daily scheduled followups, remarks, overdue calls, and date-wise activity filters.",
        confidential: false,
      },
      {
        key: "viewReports",
        label: "Performance & Lead Reports (/performance, /lead_report)",
        description: "Access conversion dashboards, lead performance analysis, and team efficiency metrics.",
        confidential: false,
      },
      {
        key: "exportData",
        label: "Export Excel & CSV Spreadsheets",
        description: "Download client contact lists, pipeline records, and audit reports into Excel files.",
        confidential: true,
      },
    ],
  },
  {
    title: "Administration & System Control",
    subtitle: "Control administrative authority over staff profiles, master data, and deletion.",
    icon: Settings,
    permissions: [
      {
        key: "manageUsers",
        label: "Add & Manage Staff (/add-users)",
        description: "Add new employees, modify staff profiles, reset passwords, and assign reporting managers.",
        confidential: false,
      },
      {
        key: "manageSettings",
        label: "Company Master Settings (/settings, /templates, /company)",
        description: "Configure system templates, general settings, and company profile.",
        confidential: true,
      },
      {
        key: "manageLeadStatuses",
        label: "Manage Lead Statuses (/lead-statuses)",
        description: "Add, edit, reorder, and configure pipeline stages and statuses for leads.",
        confidential: false,
      },
      {
        key: "manageLoanProducts",
        label: "Manage Loan Types (/loan-products)",
        description: "Add, edit, and configure available company loan types and financial products.",
        confidential: false,
      },
      {
        key: "manageLeadSources",
        label: "Manage Lead Sources (/lead-sources)",
        description: "Add, edit, and configure lead acquisition channels, DSA sources, and partners.",
        confidential: false,
      },
      {
        key: "deleteRecords",
        label: "Permanent Record Deletion",
        description: "Permission to permanently delete leads, payouts, or expense vouchers.",
        confidential: true,
      },
    ],
  },
];

export default function RolePermissionsRedesign() {
  const [selectedRole, setSelectedRole] = useState("MANAGER");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [roleDefaults, setRoleDefaults] = useState({});
  const [companyOverrides, setCompanyOverrides] = useState({});
  const [effectivePermissions, setEffectivePermissions] = useState({});
  const [hasChanges, setHasChanges] = useState(false);

  // Employee-wise permissions state
  const [employees, setEmployees] = useState([]);
  const [loadingEmployees, setLoadingEmployees] = useState(false);
  const [selectedEmployee, setSelectedEmployee] = useState(null);
  const [employeeSearch, setEmployeeSearch] = useState("");
  const [employeeRoleFilter, setEmployeeRoleFilter] = useState("ALL");
  const [employeeCustomOnly, setEmployeeCustomOnly] = useState(false);
  const [employeeCustomPerms, setEmployeeCustomPerms] = useState({});
  const [employeeHasChanges, setEmployeeHasChanges] = useState(false);
  const [savingEmployee, setSavingEmployee] = useState(false);

  const fetchRolePermissions = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/role-permissions`);
      setRoleDefaults(res.data?.roleDefaults || {});
      setCompanyOverrides(res.data?.companyRolePermissions || {});
      setEffectivePermissions(res.data?.effectiveRolePermissions || {});
      setHasChanges(false);
    } catch (err) {
      console.error("Error fetching role permissions:", err);
      toast.error("Failed to load company role permissions");
    } finally {
      setLoading(false);
    }
  };

  const fetchEmployees = async () => {
    setLoadingEmployees(true);
    try {
      const res = await axios.get(`${API_URL}/users`, { params: { limit: 200 } });
      const userList = res.data?.data || res.data?.users || [];
      // Filter out system superadmins from employee permissions list
      const staffList = userList.filter(
        (u) => u.role !== "SUPERADMIN" && u.role !== "COMPANY_ADMIN"
      );
      setEmployees(staffList);
      if (staffList.length > 0 && !selectedEmployee) {
        setSelectedEmployee(staffList[0]);
        setEmployeeCustomPerms(staffList[0].permissions || {});
      }
    } catch (err) {
      console.error("Error fetching employees:", err);
    } finally {
      setLoadingEmployees(false);
    }
  };

  useEffect(() => {
    fetchRolePermissions();
    fetchEmployees();
  }, []);

  // When selected employee changes, populate their custom permissions
  const handleSelectEmployee = (emp) => {
    if (employeeHasChanges) {
      const confirmSwitch = window.confirm(
        `You have unsaved changes for ${selectedEmployee?.name}. Do you want to discard them?`
      );
      if (!confirmSwitch) return;
    }
    setSelectedEmployee(emp);
    setEmployeeCustomPerms(emp.permissions || {});
    setEmployeeHasChanges(false);
  };

  const currentRolePerms = effectivePermissions[selectedRole] || roleDefaults[selectedRole] || {};
  const currentRoleDefaults = roleDefaults[selectedRole] || {};
  const currentRoleOverrides = companyOverrides[selectedRole] || {};

  // Handlers for role-level tab
  const handleToggle = (permKey) => {
    const currentVal = Boolean(currentRolePerms[permKey]);
    const nextVal = !currentVal;

    const updatedRolePerms = {
      ...currentRolePerms,
      [permKey]: nextVal,
    };

    setEffectivePermissions((prev) => ({
      ...prev,
      [selectedRole]: updatedRolePerms,
    }));

    setCompanyOverrides((prev) => ({
      ...prev,
      [selectedRole]: {
        ...(prev[selectedRole] || {}),
        [permKey]: nextVal,
      },
    }));

    setHasChanges(true);
  };

  const handleApplyPreset = (presetType) => {
    let preset = {};
    if (presetType === "strict") {
      preset = {
        ...currentRoleDefaults,
        viewPayouts: false,
        managePayouts: false,
        viewConnectors: false,
        manageConnectors: false,
        viewExpenses: true, // Employee expenses universal
        manageExpenses: false,
        viewAllLeads: false,
        createLead: selectedRole === "MANAGER" || selectedRole === "EMPLOYEE",
        editLead: selectedRole === "MANAGER" || selectedRole === "EMPLOYEE" || selectedRole === "OPS",
        followupLead: selectedRole === "MANAGER" || selectedRole === "EMPLOYEE" || selectedRole === "OPS",
        viewOperations: selectedRole === "MANAGER" || selectedRole === "OPS",
        manageOperations: selectedRole === "MANAGER" || selectedRole === "OPS",
        createLoanApplication: selectedRole === "OPS",
        viewReports: selectedRole === "MANAGER",
        exportData: false,
        manageUsers: false,
        manageSettings: false,
        manageLeadStatuses: false,
        manageLoanProducts: false,
        manageLeadSources: false,
        deleteRecords: false,
      };
      toast.info(`Applied 'Confidential / Restricted' preset to ${selectedRole}`);
    } else if (presetType === "full") {
      preset = {
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
      };
      toast.info(`Applied 'Full Access' preset to ${selectedRole}`);
    }

    setEffectivePermissions((prev) => ({
      ...prev,
      [selectedRole]: preset,
    }));

    setCompanyOverrides((prev) => ({
      ...prev,
      [selectedRole]: preset,
    }));

    setHasChanges(true);
  };

  const handleResetCurrentRole = async () => {
    try {
      setSaving(true);
      const res = await axios.post(`${API_URL}/role-permissions/reset`, { role: selectedRole });
      setCompanyOverrides(res.data?.companyRolePermissions || {});
      setEffectivePermissions(res.data?.effectiveRolePermissions || {});
      setHasChanges(false);
      toast.success(res.data?.message || `Reset ${selectedRole} permissions to default`);
    } catch (err) {
      console.error("Reset error:", err);
      toast.error("Failed to reset role permissions");
    } finally {
      setSaving(false);
    }
  };

  const handleSaveChanges = async () => {
    try {
      setSaving(true);
      const res = await axios.put(`${API_URL}/role-permissions`, {
        role: selectedRole,
        permissions: effectivePermissions[selectedRole],
      });

      setCompanyOverrides(res.data?.companyRolePermissions || {});
      setEffectivePermissions(res.data?.effectiveRolePermissions || {});
      setHasChanges(false);
      toast.success(res.data?.message || `Permissions for ${selectedRole} saved successfully!`);
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.response?.data?.message || "Failed to save role permissions");
    } finally {
      setSaving(false);
    }
  };

  // Handlers for Employee-Wise permissions
  const employeeRoleDefault = useMemo(() => {
    if (!selectedEmployee) return {};
    return (
      effectivePermissions[selectedEmployee.role] ||
      roleDefaults[selectedEmployee.role] ||
      {}
    );
  }, [selectedEmployee, effectivePermissions, roleDefaults]);

  // Resolve effective status for selected employee
  const resolveEmpPerm = (key) => {
    if (employeeCustomPerms && employeeCustomPerms[key] !== undefined) {
      return Boolean(employeeCustomPerms[key]);
    }
    return Boolean(employeeRoleDefault[key]);
  };

  const isEmpOverridden = (key) => {
    return employeeCustomPerms && employeeCustomPerms[key] !== undefined;
  };

  const handleToggleEmpPerm = (key) => {
    const currentVal = resolveEmpPerm(key);
    const nextVal = !currentVal;

    setEmployeeCustomPerms((prev) => ({
      ...prev,
      [key]: nextVal,
    }));
    setEmployeeHasChanges(true);
  };

  const handleRevertEmpPerm = (key) => {
    setEmployeeCustomPerms((prev) => {
      const copy = { ...prev };
      delete copy[key];
      return copy;
    });
    setEmployeeHasChanges(true);
  };

  const handleApplyEmpPreset = (presetName) => {
    if (!selectedEmployee) return;

    if (presetName === "reset") {
      setEmployeeCustomPerms({});
      setEmployeeHasChanges(true);
      toast.info(`Reset ${selectedEmployee.name} permissions to ${selectedEmployee.role} role defaults`);
      return;
    }

    if (presetName === "finance") {
      setEmployeeCustomPerms({
        viewPayouts: true,
        managePayouts: true,
        viewExpenses: true,
        manageExpenses: true,
        viewConnectors: true,
        manageConnectors: true,
        viewReports: true,
        viewLeads: false,
        viewOperations: false,
      });
      setEmployeeHasChanges(true);
      toast.info(`Applied 'Finance Focus' preset to ${selectedEmployee.name}`);
      return;
    }

    if (presetName === "sales") {
      setEmployeeCustomPerms({
        viewLeads: true,
        createLead: true,
        editLead: true,
        reassignLeads: true,
        followupLead: true,
        viewFollowupWork: true,
        viewOperations: true,
        viewPayouts: false,
        viewExpenses: true,
        viewConnectors: false,
      });
      setEmployeeHasChanges(true);
      toast.info(`Applied 'Sales Calling' preset to ${selectedEmployee.name}`);
      return;
    }

    if (presetName === "strict") {
      setEmployeeCustomPerms({
        viewPayouts: false,
        managePayouts: false,
        viewConnectors: false,
        manageConnectors: false,
        viewExpenses: true,
        manageExpenses: false,
        exportData: false,
      });
      setEmployeeHasChanges(true);
      toast.info(`Applied 'Confidential Shield' preset to ${selectedEmployee.name}`);
      return;
    }

    if (presetName === "full") {
      const fullPerms = {};
      PERMISSION_GROUPS.forEach((g) => {
        g.permissions.forEach((p) => {
          fullPerms[p.key] = true;
        });
      });
      fullPerms.viewLeads = true;
      fullPerms.viewOperations = true;
      fullPerms.viewDashboard = true;
      setEmployeeCustomPerms(fullPerms);
      setEmployeeHasChanges(true);
      toast.info(`Applied 'Full Access' preset to ${selectedEmployee.name}`);
      return;
    }
  };

  const handleSaveEmployeePermissions = async () => {
    if (!selectedEmployee) return;
    try {
      setSavingEmployee(true);
      const res = await axios.put(`${API_URL}/users/${selectedEmployee.id}/permissions`, {
        permissions: employeeCustomPerms,
      });

      // Update local state
      const updatedUser = {
        ...selectedEmployee,
        permissions: res.data.data.permissions,
        resolvedPermissions: res.data.data.resolvedPermissions,
      };

      setEmployees((prev) =>
        prev.map((u) => (u.id === selectedEmployee.id ? updatedUser : u))
      );
      setSelectedEmployee(updatedUser);
      setEmployeeHasChanges(false);
      toast.success(res.data?.message || `Permissions saved for ${selectedEmployee.name}!`);

      // If current user modified their own permissions, sync localStorage
      const loggedInId = localStorage.getItem("userId") || localStorage.getItem("id");
      if (String(loggedInId) === String(selectedEmployee.id)) {
        localStorage.setItem("userPermissions", JSON.stringify(res.data.data.resolvedPermissions));
        window.dispatchEvent(new Event("storage"));
      }
    } catch (err) {
      console.error("Save employee permissions error:", err);
      toast.error(err.response?.data?.message || "Failed to update employee permissions");
    } finally {
      setSavingEmployee(false);
    }
  };

  // Filtered employees list
  const filteredEmployees = useMemo(() => {
    return employees.filter((emp) => {
      const q = employeeSearch.toLowerCase().trim();
      const matchSearch =
        !q ||
        emp.name?.toLowerCase().includes(q) ||
        emp.email?.toLowerCase().includes(q) ||
        emp.phone?.toLowerCase().includes(q);

      const matchRole =
        employeeRoleFilter === "ALL" || emp.role === employeeRoleFilter;

      const hasCustom =
        emp.permissions && Object.keys(emp.permissions).length > 0;
      const matchCustom = !employeeCustomOnly || hasCustom;

      return matchSearch && matchRole && matchCustom;
    });
  }, [employees, employeeSearch, employeeRoleFilter, employeeCustomOnly]);

  const currentTabInfo = ROLE_TABS.find((t) => t.key === selectedRole) || ROLE_TABS[0];
  const isOverriddenForRole = Boolean(companyOverrides[selectedRole] && Object.keys(companyOverrides[selectedRole]).length > 0);

  // Stats calculation
  const confidentialKeys = ["viewPayouts", "managePayouts", "viewConnectors", "manageConnectors", "viewExpenses", "manageExpenses"];
  const confidentialAllowedCount = confidentialKeys.filter((k) => currentRolePerms[k]).length;

  return (
    <div className="cc-perm-page">
      <style>{pageStyles}</style>

      {/* Page Header */}
      <div className="cc-perm-head">
        <div className="cc-perm-head-left">
          <div className="cc-perm-title-icon">
            <ShieldCheck size={26} />
          </div>
          <div>
            <h1>Role Permissions & Confidential Data Control</h1>
            <p>
              Manage access boundaries across company roles and fine-tune individual staff permissions based on sidebar menu options.
            </p>
          </div>
        </div>

        {selectedRole !== "EMPLOYEE_WISE" && hasChanges && (
          <div className="cc-perm-save-bar">
            <span className="cc-perm-unsaved-badge">Unsaved changes for {selectedRole}</span>
            <button
              type="button"
              className="cc-perm-save-btn"
              onClick={handleSaveChanges}
              disabled={saving}
            >
              <Save size={16} />
              {saving ? "Saving..." : "Save Role Permissions"}
            </button>
          </div>
        )}

        {selectedRole === "EMPLOYEE_WISE" && employeeHasChanges && (
          <div className="cc-perm-save-bar">
            <span className="cc-perm-unsaved-badge">
              Unsaved changes for {selectedEmployee?.name}
            </span>
            <button
              type="button"
              className="cc-perm-save-btn"
              onClick={handleSaveEmployeePermissions}
              disabled={savingEmployee}
            >
              <Save size={16} />
              {savingEmployee ? "Saving..." : "Save Employee Permissions"}
            </button>
          </div>
        )}
      </div>

      {/* Mode View Switcher Bar */}
      <div className="cc-perm-mode-switcher-bar">
        <div className="cc-perm-segmented-switch">
          <button
            type="button"
            className={`cc-perm-seg-btn ${selectedRole !== "EMPLOYEE_WISE" ? "active" : ""}`}
            onClick={() => setSelectedRole("MANAGER")}
          >
            <ShieldCheck size={16} />
            <span>Company Role Defaults</span>
            <span className="cc-seg-count">5 Roles</span>
          </button>
          <button
            type="button"
            className={`cc-perm-seg-btn ${selectedRole === "EMPLOYEE_WISE" ? "active" : ""}`}
            onClick={() => setSelectedRole("EMPLOYEE_WISE")}
          >
            <Users size={16} />
            <span>Employee-Wise Permissions & Sidebar Access</span>
            <span className="cc-seg-badge-accent">Staff Studio</span>
          </button>
        </div>
      </div>

      {/* Top Role Tabs Band */}
      <div className="cc-role-tabs-band">
        {ROLE_TABS.map((tab) => {
          const isSelected = tab.key === selectedRole;
          const hasCustom =
            tab.key === "EMPLOYEE_WISE"
              ? employees.some((e) => e.permissions && Object.keys(e.permissions).length > 0)
              : Boolean(companyOverrides[tab.key] && Object.keys(companyOverrides[tab.key]).length > 0);

          return (
            <button
              key={tab.key}
              type="button"
              className={`cc-role-tab ${isSelected ? "active" : ""}`}
              onClick={() => setSelectedRole(tab.key)}
            >
              <div className="cc-role-tab-top">
                <span
                  className="cc-role-tab-badge"
                  style={{ color: tab.color, background: tab.bg }}
                >
                  {tab.name}
                </span>
                {hasCustom && (
                  <span className="cc-role-custom-dot" title="Custom overrides active">
                    <Unlock size={11} /> Custom
                  </span>
                )}
              </div>
              <p className="cc-role-tab-desc">{tab.badge}</p>
            </button>
          );
        })}
      </div>

      {/* ============================================================== */}
      {/* VIEW 1: COMPANY ROLE-LEVEL PERMISSIONS MATRIX                  */}
      {/* ============================================================== */}
      {selectedRole !== "EMPLOYEE_WISE" && (
        <>
          {/* Active Role Overview Card */}
          <div className="cc-role-banner">
            <div className="cc-role-banner-left">
              <div
                className="cc-role-banner-icon"
                style={{ color: currentTabInfo.color, background: currentTabInfo.bg }}
              >
                <Shield size={24} />
              </div>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2 style={{ margin: 0, fontSize: 18, color: "#0f172a" }}>
                    {currentTabInfo.name} Access Permissions
                  </h2>
                  {isOverriddenForRole ? (
                    <span className="cc-perm-badge-custom">
                      <Unlock size={12} /> Company Custom Overrides Active
                    </span>
                  ) : (
                    <span className="cc-perm-badge-default">
                      <Lock size={12} /> Standard System Defaults
                    </span>
                  )}
                </div>
                <p style={{ margin: "4px 0 0", fontSize: 13, color: "#64748b" }}>
                  {currentTabInfo.description} • Changes apply to all users with role: <strong>{currentTabInfo.name}</strong>
                </p>
              </div>
            </div>

            <div className="cc-role-banner-right">
              <div className="cc-confidential-status-pill">
                <span>Confidential Financials:</span>
                <strong>
                  {confidentialAllowedCount === 0
                    ? "🔒 Fully Hidden (Recommended)"
                    : confidentialAllowedCount === confidentialKeys.length
                    ? "⚡ Unrestricted Access"
                    : `⚠️ ${confidentialAllowedCount} / ${confidentialKeys.length} Accessible`}
                </strong>
              </div>

              <div className="cc-role-quick-presets">
                <button
                  type="button"
                  className="cc-preset-btn strict"
                  onClick={() => handleApplyPreset("strict")}
                  title="Hide Payouts, Connectors & Expense tracker pages from this role"
                >
                  🔒 Restrict Financials
                </button>
                <button
                  type="button"
                  className="cc-preset-btn"
                  onClick={() => handleApplyPreset("full")}
                  title="Grant full access to this role"
                >
                  ⚡ Full Access
                </button>
                {isOverriddenForRole && (
                  <button
                    type="button"
                    className="cc-preset-btn reset"
                    onClick={handleResetCurrentRole}
                    title="Revert back to standard CRM default rules"
                  >
                    <RotateCcw size={13} /> Reset to Default
                  </button>
                )}
              </div>
            </div>
          </div>

          {/* Permissions Grid */}
          {loading ? (
            <div style={{ textAlign: "center", padding: "60px 20px", color: "#64748b" }}>
              Loading role permission matrix...
            </div>
          ) : (
            <div className="cc-perm-groups-container">
              {PERMISSION_GROUPS.map((group, idx) => {
                const GroupIcon = group.icon;
                return (
                  <div key={idx} className="cc-perm-card-box">
                    <div className="cc-perm-card-header">
                      <div className="cc-perm-card-title-wrap">
                        <GroupIcon size={19} className="cc-perm-card-icon" />
                        <div>
                          <h3>{group.title}</h3>
                          <p>{group.subtitle}</p>
                        </div>
                      </div>
                    </div>

                    <div className="cc-perm-table">
                      {group.permissions.map((perm) => {
                        const isAllowed = Boolean(currentRolePerms[perm.key]);
                        const isCustomized = currentRoleOverrides[perm.key] !== undefined;

                        return (
                          <div
                            key={perm.key}
                            className={`cc-perm-item-row ${isAllowed ? "allowed" : "denied"}`}
                            onClick={() => handleToggle(perm.key)}
                          >
                            <div className="cc-perm-item-left">
                              <div className="cc-perm-item-title-bar">
                                <strong>{perm.label}</strong>
                                {perm.confidential && (
                                  <span className="cc-tag-confidential">
                                    🔒 Confidential Financial
                                  </span>
                                )}
                                {isCustomized ? (
                                  <span className="cc-tag-custom">Custom Rule</span>
                                ) : (
                                  <span className="cc-tag-default">Role Default</span>
                                )}
                              </div>
                              <p>{perm.description}</p>
                            </div>

                            <div className="cc-perm-item-right" onClick={(e) => e.stopPropagation()}>
                              <label className="cc-switch">
                                <input
                                  type="checkbox"
                                  checked={isAllowed}
                                  onChange={() => handleToggle(perm.key)}
                                />
                                <span className="cc-slider" />
                              </label>
                              <span className={`cc-switch-label ${isAllowed ? "enabled" : "disabled"}`}>
                                {isAllowed ? "Allowed" : "Hidden"}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {/* Floating Save Action Bar for Role Defaults */}
          {hasChanges && (
            <div className="cc-floating-save-band">
              <div className="cc-floating-save-inner">
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
                  <span style={{ fontSize: 13.5, fontWeight: 600, color: "#ffffff" }}>
                    You have unsaved permission changes for <strong>{currentTabInfo.name}</strong>.
                  </span>
                </div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <button
                    type="button"
                    className="cc-floating-btn-cancel"
                    onClick={fetchRolePermissions}
                  >
                    Discard
                  </button>
                  <button
                    type="button"
                    className="cc-floating-btn-save"
                    onClick={handleSaveChanges}
                    disabled={saving}
                  >
                    <Save size={16} />
                    {saving ? "Saving..." : "Save Role Permissions"}
                  </button>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* ============================================================== */}
      {/* VIEW 2: EMPLOYEE-WISE CUSTOM PERMISSIONS & SIDEBAR STUDIO      */}
      {/* ============================================================== */}
      {selectedRole === "EMPLOYEE_WISE" && (
        <div className="cc-emp-studio-layout">
          {/* LEFT COLUMN: EMPLOYEE DIRECTORY */}
          <div className="cc-emp-directory-pane">
            <div className="cc-emp-dir-head">
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                  Company Staff Directory
                </h3>
                <span className="cc-emp-count-badge">
                  {filteredEmployees.length} Staff
                </span>
              </div>
              <p style={{ margin: "4px 0 12px", fontSize: 12.5, color: "#64748b" }}>
                Select an employee to grant or revoke specific sidebar options.
              </p>

              {/* Search input */}
              <div className="cc-emp-search-wrap">
                <Search size={15} className="cc-emp-search-icon" />
                <input
                  type="text"
                  placeholder="Search name, email, phone..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="cc-emp-search-input"
                />
              </div>

              {/* Filters */}
              <div className="cc-emp-filters-row">
                <select
                  value={employeeRoleFilter}
                  onChange={(e) => setEmployeeRoleFilter(e.target.value)}
                  className="cc-emp-role-select"
                >
                  <option value="ALL">All Roles</option>
                  <option value="MANAGER">Manager</option>
                  <option value="OPS">Operations</option>
                  <option value="EMPLOYEE">Sales / Calling</option>
                  <option value="FINANCE">Finance</option>
                  <option value="BANKER">Banker</option>
                </select>

                <label className="cc-emp-custom-toggle-label">
                  <input
                    type="checkbox"
                    checked={employeeCustomOnly}
                    onChange={(e) => setEmployeeCustomOnly(e.target.checked)}
                  />
                  <span>Custom Only</span>
                </label>
              </div>
            </div>

            {/* Employee List */}
            <div className="cc-emp-list-scroll">
              {loadingEmployees ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "#64748b" }}>
                  Loading employees...
                </div>
              ) : filteredEmployees.length === 0 ? (
                <div style={{ padding: "40px 16px", textAlign: "center", color: "#94a3b8" }}>
                  No employees found matching filter.
                </div>
              ) : (
                filteredEmployees.map((emp) => {
                  const isSelected = selectedEmployee?.id === emp.id;
                  const hasCustom = emp.permissions && Object.keys(emp.permissions).length > 0;
                  const initials = (emp.name || "U")
                    .split(" ")
                    .map((n) => n[0])
                    .slice(0, 2)
                    .join("")
                    .toUpperCase();

                  return (
                    <div
                      key={emp.id}
                      className={`cc-emp-item-card ${isSelected ? "selected" : ""}`}
                      onClick={() => handleSelectEmployee(emp)}
                    >
                      <div className="cc-emp-avatar">{initials}</div>
                      <div className="cc-emp-item-info">
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", gap: 6 }}>
                          <strong className="cc-emp-item-name">{emp.name}</strong>
                          <span className={`cc-emp-role-pill role-${emp.role?.toLowerCase()}`}>
                            {emp.role}
                          </span>
                        </div>
                        <div className="cc-emp-item-email">{emp.email}</div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 4 }}>
                          {hasCustom ? (
                            <span className="cc-emp-tag-custom-active">
                              <Unlock size={10} /> Custom Overrides Active
                            </span>
                          ) : (
                            <span className="cc-emp-tag-default-active">
                              Role Defaults
                            </span>
                          )}
                        </div>
                      </div>
                      <ChevronRight size={16} className="cc-emp-chevron" />
                    </div>
                  );
                })
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: PERMISSION & SIDEBAR MANAGER */}
          <div className="cc-emp-editor-pane">
            {!selectedEmployee ? (
              <div className="cc-emp-empty-state">
                <Users size={48} style={{ color: "#94a3b8", marginBottom: 12 }} />
                <h3>No Employee Selected</h3>
                <p>Pick an employee from the staff directory on the left to configure their custom permissions.</p>
              </div>
            ) : (
              <div>
                {/* Selected Employee Hero Banner */}
                <div className="cc-emp-hero-card">
                  <div className="cc-emp-hero-left">
                    <div className="cc-emp-hero-avatar">
                      {(selectedEmployee.name || "U")
                        .split(" ")
                        .map((n) => n[0])
                        .slice(0, 2)
                        .join("")
                        .toUpperCase()}
                    </div>
                    <div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                        <h2 style={{ margin: 0, fontSize: 19, color: "#0f172a" }}>
                          {selectedEmployee.name}
                        </h2>
                        <span className={`cc-emp-role-pill role-${selectedEmployee.role?.toLowerCase()}`}>
                          Base Role: {selectedEmployee.role}
                        </span>
                        {selectedEmployee.permissions && Object.keys(selectedEmployee.permissions).length > 0 ? (
                          <span className="cc-perm-badge-custom">
                            <Unlock size={12} /> Custom Overrides Active ({Object.keys(selectedEmployee.permissions).length})
                          </span>
                        ) : (
                          <span className="cc-perm-badge-default">
                            <Lock size={12} /> Inheriting {selectedEmployee.role} Defaults
                          </span>
                        )}
                      </div>
                      <div className="cc-emp-hero-contacts">
                        <span><Mail size={13} /> {selectedEmployee.email}</span>
                        {selectedEmployee.phone && <span><Phone size={13} /> {selectedEmployee.phone}</span>}
                      </div>
                    </div>
                  </div>

                  {/* Preset Action Buttons */}
                  <div className="cc-emp-hero-actions">
                    <button
                      type="button"
                      className="cc-preset-btn"
                      onClick={() => handleApplyEmpPreset("finance")}
                      title="Only allow Disbursements, Expenses & Connector ledgers"
                    >
                      💰 Finance Focus
                    </button>
                    <button
                      type="button"
                      className="cc-preset-btn"
                      onClick={() => handleApplyEmpPreset("sales")}
                      title="Allow Leads, Calling, and Operations view"
                    >
                      📞 Sales Calling
                    </button>
                    <button
                      type="button"
                      className="cc-preset-btn strict"
                      onClick={() => handleApplyEmpPreset("strict")}
                      title="Hide confidential financials"
                    >
                      🔒 Confidential Shield
                    </button>
                    <button
                      type="button"
                      className="cc-preset-btn"
                      onClick={() => handleApplyEmpPreset("full")}
                      title="Grant all permissions"
                    >
                      ⚡ Full Access
                    </button>
                    <button
                      type="button"
                      className="cc-preset-btn reset"
                      onClick={() => handleApplyEmpPreset("reset")}
                      title="Revert back to role default"
                    >
                      <RotateCcw size={13} /> Revert to Default
                    </button>
                  </div>
                </div>

                {/* ========================================================= */}
                {/* SECTION 1: SIDEBAR MENU OPTIONS & NAVIGATION VISIBILITY   */}
                {/* ========================================================= */}
                <div className="cc-emp-section-card">
                  <div className="cc-emp-section-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="cc-emp-section-icon" style={{ background: "#e0e7ff", color: "#4338ca" }}>
                        <Layers size={19} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                          Sidebar Menu Options & Navigation Visibility
                        </h3>
                        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                          Control which sidebar pages and modules appear on <strong>{selectedEmployee.name}</strong>'s dashboard navigation.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="cc-sidebar-grid">
                    {SIDEBAR_MENU_OPTIONS.map((item) => {
                      const Icon = item.icon;
                      const isAllowed = resolveEmpPerm(item.primaryKey);
                      const isOverridden = isEmpOverridden(item.primaryKey);
                      const isDefaultAllowed = Boolean(employeeRoleDefault[item.primaryKey]);

                      return (
                        <div
                          key={item.id}
                          className={`cc-sidebar-card ${isAllowed ? "allowed" : "denied"}`}
                        >
                          <div className="cc-sidebar-card-top">
                            <div className="cc-sidebar-card-icon-wrap">
                              <Icon size={18} />
                            </div>
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <strong className="cc-sidebar-card-title">{item.title}</strong>
                                {item.confidential && (
                                  <span className="cc-tag-confidential">🔒 Confidential</span>
                                )}
                              </div>
                              <span className="cc-sidebar-card-route">{item.route}</span>
                            </div>

                            {/* Toggle Switch */}
                            <label className="cc-switch">
                              <input
                                type="checkbox"
                                checked={isAllowed}
                                onChange={() => handleToggleEmpPerm(item.primaryKey)}
                              />
                              <span className="cc-slider" />
                            </label>
                          </div>

                          <p className="cc-sidebar-card-desc">{item.description}</p>

                          <div className="cc-sidebar-card-footer">
                            <div className="cc-sidebar-status-tag">
                              {isOverridden ? (
                                <span className={`cc-tag-emp-override ${isAllowed ? "on" : "off"}`}>
                                  <Unlock size={11} /> Custom {isAllowed ? "Granted" : "Hidden"}
                                </span>
                              ) : (
                                <span className="cc-tag-emp-inherited">
                                  <Lock size={11} /> {isDefaultAllowed ? "Default Enabled" : "Default Hidden"}
                                </span>
                              )}
                            </div>

                            {isOverridden && (
                              <button
                                type="button"
                                className="cc-revert-link"
                                onClick={() => handleRevertEmpPerm(item.primaryKey)}
                                title="Revert to role default"
                              >
                                Revert
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                {/* ========================================================= */}
                {/* SECTION 2: FINE-GRAINED ACTION PERMISSIONS                */}
                {/* ========================================================= */}
                <div className="cc-emp-section-card">
                  <div className="cc-emp-section-header">
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div className="cc-emp-section-icon" style={{ background: "#ecfdf5", color: "#059669" }}>
                        <ShieldCheck size={19} />
                      </div>
                      <div>
                        <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#0f172a" }}>
                          Operational Authority & Feature Permissions
                        </h3>
                        <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                          Fine-tune granular create, edit, reassign, calculate, and delete capabilities for this employee.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="cc-emp-actions-matrix">
                    {PERMISSION_GROUPS.map((group, gIdx) => (
                      <div key={gIdx} className="cc-emp-action-group">
                        <div className="cc-emp-action-group-title">
                          <group.icon size={16} />
                          <span>{group.title}</span>
                        </div>

                        <div className="cc-emp-action-group-items">
                          {group.permissions.map((perm) => {
                            const isAllowed = resolveEmpPerm(perm.key);
                            const isOverridden = isEmpOverridden(perm.key);
                            const isDefaultAllowed = Boolean(employeeRoleDefault[perm.key]);

                            return (
                              <div
                                key={perm.key}
                                className={`cc-emp-action-row ${isAllowed ? "allowed" : "denied"}`}
                              >
                                <div className="cc-emp-action-row-left">
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <strong>{perm.label}</strong>
                                    {perm.confidential && (
                                      <span className="cc-tag-confidential">🔒 Confidential</span>
                                    )}
                                    {isOverridden ? (
                                      <span className="cc-tag-custom">Custom Override</span>
                                    ) : (
                                      <span className="cc-tag-default">
                                        Inherited ({isDefaultAllowed ? "Allowed" : "Disabled"})
                                      </span>
                                    )}
                                  </div>
                                  <p>{perm.description}</p>
                                </div>

                                <div className="cc-emp-action-row-right">
                                  {isOverridden && (
                                    <button
                                      type="button"
                                      className="cc-revert-link"
                                      onClick={() => handleRevertEmpPerm(perm.key)}
                                      title="Revert this permission to role default"
                                    >
                                      Revert
                                    </button>
                                  )}
                                  <label className="cc-switch">
                                    <input
                                      type="checkbox"
                                      checked={isAllowed}
                                      onChange={() => handleToggleEmpPerm(perm.key)}
                                    />
                                    <span className="cc-slider" />
                                  </label>
                                  <span className={`cc-switch-label ${isAllowed ? "enabled" : "disabled"}`}>
                                    {isAllowed ? "Allowed" : "Hidden"}
                                  </span>
                                </div>
                              </div>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Floating Save Action Bar for Employee Permissions */}
                {employeeHasChanges && (
                  <div className="cc-floating-save-band">
                    <div className="cc-floating-save-inner">
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <AlertTriangle size={18} style={{ color: "#f59e0b" }} />
                        <span style={{ fontSize: 13.5, fontWeight: 600, color: "#ffffff" }}>
                          You have unsaved changes for <strong>{selectedEmployee.name}</strong>.
                        </span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <button
                          type="button"
                          className="cc-floating-btn-cancel"
                          onClick={() => {
                            setEmployeeCustomPerms(selectedEmployee.permissions || {});
                            setEmployeeHasChanges(false);
                          }}
                        >
                          Discard
                        </button>
                        <button
                          type="button"
                          className="cc-floating-btn-save"
                          onClick={handleSaveEmployeePermissions}
                          disabled={savingEmployee}
                        >
                          <Save size={16} />
                          {savingEmployee ? "Saving..." : "Save Employee Permissions"}
                        </button>
                      </div>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const pageStyles = `
.cc-perm-page {
  padding: 24px 28px 80px;
  max-width: 1400px;
  margin: 0 auto;
  font-family: inherit;
}

.cc-perm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 20px;
}

.cc-perm-head-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cc-perm-title-icon {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #1e40af 0%, #3b82f6 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 6px 16px rgba(37, 99, 235, 0.28);
}

.cc-perm-head h1 {
  margin: 0;
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  letter-spacing: -0.02em;
}

.cc-perm-head p {
  margin: 3px 0 0;
  font-size: 13.5px;
  color: #64748b;
  max-width: 760px;
}

.cc-perm-save-bar {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cc-perm-unsaved-badge {
  background: #fef3c7;
  color: #92400e;
  border: 1px solid #fde68a;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
}

.cc-perm-save-btn {
  background: #2563eb;
  color: #ffffff;
  border: none;
  padding: 9px 18px;
  border-radius: 10px;
  font-size: 13.5px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 8px;
  cursor: pointer;
  box-shadow: 0 4px 12px rgba(37, 99, 235, 0.3);
  transition: all 0.15s;
}

.cc-perm-save-btn:hover:not(:disabled) {
  background: #1d4ed8;
  transform: translateY(-1px);
}

/* Mode Switcher */
.cc-perm-mode-switcher-bar {
  display: flex;
  align-items: center;
  margin-bottom: 20px;
}

.cc-perm-segmented-switch {
  display: inline-flex;
  background: #e2e8f0;
  padding: 4px;
  border-radius: 12px;
  gap: 4px;
}

.cc-perm-seg-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 16px;
  border-radius: 9px;
  border: none;
  background: transparent;
  color: #475569;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.16s ease;
}

.cc-perm-seg-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.08);
}

.cc-seg-count {
  font-size: 11px;
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 6px;
  color: #64748b;
}

.cc-seg-badge-accent {
  font-size: 11px;
  background: #f5f3ff;
  color: #7c3aed;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
}

/* Role Tabs Band */
.cc-role-tabs-band {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(190px, 1fr));
  gap: 12px;
  margin-bottom: 24px;
}

.cc-role-tab {
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  padding: 13px 15px;
  text-align: left;
  cursor: pointer;
  transition: all 0.18s ease;
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cc-role-tab:hover {
  border-color: #cbd5e1;
  background: #f8fafc;
}

.cc-role-tab.active {
  border-color: #2563eb;
  background: #f8faff;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.12);
}

.cc-role-tab-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 6px;
}

.cc-role-tab-badge {
  font-size: 13px;
  font-weight: 700;
  padding: 3px 9px;
  border-radius: 7px;
}

.cc-role-custom-dot {
  font-size: 11px;
  color: #059669;
  background: #ecfdf5;
  padding: 2px 6px;
  border-radius: 6px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.cc-role-tab-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.35;
}

/* Banner */
.cc-role-banner {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 22px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.cc-role-banner-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cc-role-banner-icon {
  width: 46px;
  height: 46px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cc-perm-badge-custom {
  background: #f5f3ff;
  color: #7c3aed;
  border: 1px solid #ddd6fe;
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cc-perm-badge-default {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  font-size: 11.5px;
  font-weight: 600;
  padding: 3px 8px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cc-role-banner-right {
  display: flex;
  align-items: center;
  gap: 14px;
  flex-wrap: wrap;
}

.cc-confidential-status-pill {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  padding: 6px 12px;
  border-radius: 8px;
  font-size: 12.5px;
  display: flex;
  align-items: center;
  gap: 6px;
  color: #475569;
}

.cc-role-quick-presets {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cc-preset-btn {
  background: #f1f5f9;
  border: 1px solid #e2e8f0;
  color: #1e293b;
  padding: 6px 11px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.cc-preset-btn:hover {
  background: #e2e8f0;
}

.cc-preset-btn.strict {
  background: #fff7ed;
  border-color: #fed7aa;
  color: #c2410c;
}

.cc-preset-btn.strict:hover {
  background: #ffedd5;
}

.cc-preset-btn.reset {
  background: #fee2e2;
  border-color: #fecaca;
  color: #dc2626;
}

.cc-preset-btn.reset:hover {
  background: #fecaca;
}

/* Permissions Group Containers */
.cc-perm-groups-container {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cc-perm-card-box {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 6px rgba(0, 0, 0, 0.03);
}

.cc-perm-card-header {
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.cc-perm-card-title-wrap {
  display: flex;
  align-items: flex-start;
  gap: 12px;
}

.cc-perm-card-icon {
  color: #2563eb;
  margin-top: 2px;
  flex-shrink: 0;
}

.cc-perm-card-header h3 {
  margin: 0;
  font-size: 15.5px;
  font-weight: 700;
  color: #0f172a;
}

.cc-perm-card-header p {
  margin: 2px 0 0;
  font-size: 12.5px;
  color: #64748b;
}

.cc-perm-table {
  display: flex;
  flex-direction: column;
}

.cc-perm-item-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 20px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.15s;
}

.cc-perm-item-row:last-child {
  border-bottom: none;
}

.cc-perm-item-row:hover {
  background: #f8fafc;
}

.cc-perm-item-left {
  flex: 1;
  min-width: 0;
  padding-right: 20px;
}

.cc-perm-item-title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cc-perm-item-title-bar strong {
  font-size: 14px;
  color: #0f172a;
}

.cc-tag-confidential {
  background: #fff7ed;
  color: #c2410c;
  border: 1px solid #fed7aa;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 7px;
  border-radius: 5px;
}

.cc-tag-custom {
  background: #f5f3ff;
  color: #7c3aed;
  border: 1px solid #ddd6fe;
  font-size: 11px;
  font-weight: 600;
  padding: 2px 6px;
  border-radius: 5px;
}

.cc-tag-default {
  background: #f1f5f9;
  color: #64748b;
  border: 1px solid #e2e8f0;
  font-size: 11px;
  font-weight: 500;
  padding: 2px 6px;
  border-radius: 5px;
}

.cc-perm-item-left p {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: #64748b;
  line-height: 1.4;
}

.cc-perm-item-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}

/* Switch */
.cc-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
}

.cc-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.cc-slider {
  position: absolute;
  cursor: pointer;
  top: 0;
  left: 0;
  right: 0;
  bottom: 0;
  background-color: #cbd5e1;
  transition: 0.2s;
  border-radius: 24px;
}

.cc-slider:before {
  position: absolute;
  content: "";
  height: 18px;
  width: 18px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.2);
}

input:checked + .cc-slider {
  background-color: #10b981;
}

input:checked + .cc-slider:before {
  transform: translateX(20px);
}

.cc-switch-label {
  font-size: 12.5px;
  font-weight: 600;
  min-width: 52px;
}

.cc-switch-label.enabled {
  color: #059669;
}

.cc-switch-label.disabled {
  color: #94a3b8;
}

/* Floating Save Bar */
.cc-floating-save-band {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  z-index: 999;
  width: 90%;
  max-width: 820px;
}

.cc-floating-save-inner {
  background: #0f172a;
  border: 1px solid rgba(255, 255, 255, 0.15);
  border-radius: 14px;
  padding: 12px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  box-shadow: 0 10px 30px rgba(0, 0, 0, 0.35);
}

.cc-floating-btn-cancel {
  background: transparent;
  color: #cbd5e1;
  border: 1px solid #475569;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
  transition: all 0.15s;
}

.cc-floating-btn-cancel:hover {
  background: #1e293b;
  color: #ffffff;
}

.cc-floating-btn-save {
  background: #2563eb;
  color: #ffffff;
  border: none;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 7px;
  cursor: pointer;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
  transition: all 0.15s;
}

.cc-floating-btn-save:hover:not(:disabled) {
  background: #1d4ed8;
}

/* ==================================================================== */
/* EMPLOYEE STUDIO LAYOUT                                               */
/* ==================================================================== */
.cc-emp-studio-layout {
  display: grid;
  grid-template-columns: 340px 1fr;
  gap: 20px;
  align-items: start;
}

@media (max-width: 992px) {
  .cc-emp-studio-layout {
    grid-template-columns: 1fr;
  }
}

/* Directory Pane */
.cc-emp-directory-pane {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
  overflow: hidden;
  position: sticky;
  top: 80px;
}

.cc-emp-dir-head {
  padding: 16px 18px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.cc-emp-count-badge {
  font-size: 11.5px;
  background: #e2e8f0;
  color: #334155;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
}

.cc-emp-search-wrap {
  position: relative;
  margin-bottom: 10px;
}

.cc-emp-search-icon {
  position: absolute;
  left: 10px;
  top: 50%;
  transform: translateY(-50%);
  color: #94a3b8;
}

.cc-emp-search-input {
  width: 100%;
  box-sizing: border-box;
  padding: 8px 12px 8px 32px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  background: #ffffff;
  color: #0f172a;
}

.cc-emp-search-input:focus {
  outline: none;
  border-color: #2563eb;
}

.cc-emp-filters-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 8px;
}

.cc-emp-role-select {
  flex: 1;
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 12px;
  background: #ffffff;
  color: #334155;
}

.cc-emp-custom-toggle-label {
  display: flex;
  align-items: center;
  gap: 5px;
  font-size: 11.5px;
  color: #475569;
  cursor: pointer;
  white-space: nowrap;
}

.cc-emp-list-scroll {
  max-height: calc(100vh - 300px);
  overflow-y: auto;
}

.cc-emp-item-card {
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 12px 16px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: all 0.15s;
}

.cc-emp-item-card:hover {
  background: #f8fafc;
}

.cc-emp-item-card.selected {
  background: #eef2ff;
  border-left: 4px solid #4f46e5;
}

.cc-emp-avatar {
  width: 38px;
  height: 38px;
  border-radius: 10px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 13px;
  flex-shrink: 0;
}

.cc-emp-item-info {
  flex: 1;
  min-width: 0;
}

.cc-emp-item-name {
  font-size: 13.5px;
  color: #0f172a;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-emp-item-email {
  font-size: 12px;
  color: #64748b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-top: 1px;
}

.cc-emp-role-pill {
  font-size: 10.5px;
  font-weight: 700;
  padding: 2px 6px;
  border-radius: 5px;
  text-transform: uppercase;
  flex-shrink: 0;
}

.cc-emp-role-pill.role-manager {
  background: #eef2ff;
  color: #4338ca;
}

.cc-emp-role-pill.role-ops {
  background: #fff7ed;
  color: #c2410c;
}

.cc-emp-role-pill.role-employee {
  background: #ecfdf5;
  color: #047857;
}

.cc-emp-role-pill.role-finance {
  background: #f0fdfa;
  color: #0d9488;
}

.cc-emp-role-pill.role-banker {
  background: #f0f9ff;
  color: #0369a1;
}

.cc-emp-tag-custom-active {
  font-size: 10.5px;
  color: #7c3aed;
  background: #f5f3ff;
  border: 1px solid #ddd6fe;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.cc-emp-tag-default-active {
  font-size: 10.5px;
  color: #64748b;
  background: #f1f5f9;
  padding: 1px 6px;
  border-radius: 4px;
}

.cc-emp-chevron {
  color: #94a3b8;
  flex-shrink: 0;
}

/* Editor Pane */
.cc-emp-editor-pane {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cc-emp-empty-state {
  background: #ffffff;
  border: 2px dashed #cbd5e1;
  border-radius: 14px;
  padding: 80px 24px;
  text-align: center;
}

.cc-emp-empty-state h3 {
  margin: 0;
  font-size: 18px;
  color: #1e293b;
}

.cc-emp-empty-state p {
  margin: 6px 0 0;
  font-size: 13.5px;
  color: #64748b;
}

/* Hero card */
.cc-emp-hero-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 18px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.cc-emp-hero-left {
  display: flex;
  align-items: center;
  gap: 16px;
}

.cc-emp-hero-avatar {
  width: 52px;
  height: 52px;
  border-radius: 14px;
  background: linear-gradient(135deg, #4f46e5, #7c3aed);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 800;
  font-size: 18px;
  box-shadow: 0 4px 12px rgba(124, 58, 237, 0.25);
  flex-shrink: 0;
}

.cc-emp-hero-contacts {
  display: flex;
  align-items: center;
  gap: 14px;
  margin-top: 6px;
  font-size: 12.5px;
  color: #64748b;
  flex-wrap: wrap;
}

.cc-emp-hero-contacts span {
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.cc-emp-hero-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
  padding-top: 12px;
  border-top: 1px solid #f1f5f9;
}

/* Section Cards */
.cc-emp-section-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  overflow: hidden;
  box-shadow: 0 2px 8px rgba(0, 0, 0, 0.04);
}

.cc-emp-section-header {
  padding: 16px 20px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.cc-emp-section-icon {
  width: 36px;
  height: 36px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

/* Sidebar Grid */
.cc-sidebar-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
  gap: 14px;
  padding: 18px 20px;
}

.cc-sidebar-card {
  border: 1.5px solid #e2e8f0;
  border-radius: 12px;
  padding: 14px 16px;
  background: #ffffff;
  transition: all 0.15s ease;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
}

.cc-sidebar-card.allowed {
  border-color: #cbd5e1;
  background: #ffffff;
}

.cc-sidebar-card.denied {
  border-color: #f1f5f9;
  background: #fafafa;
  opacity: 0.85;
}

.cc-sidebar-card-top {
  display: flex;
  align-items: flex-start;
  gap: 10px;
}

.cc-sidebar-card-icon-wrap {
  width: 34px;
  height: 34px;
  border-radius: 8px;
  background: #f1f5f9;
  color: #334155;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cc-sidebar-card.allowed .cc-sidebar-card-icon-wrap {
  background: #e0e7ff;
  color: #4338ca;
}

.cc-sidebar-card-title {
  font-size: 13.5px;
  color: #0f172a;
}

.cc-sidebar-card-route {
  display: block;
  font-size: 11px;
  color: #94a3b8;
  font-family: monospace;
  margin-top: 1px;
}

.cc-sidebar-card-desc {
  margin: 10px 0 12px;
  font-size: 12px;
  color: #64748b;
  line-height: 1.4;
}

.cc-sidebar-card-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding-top: 10px;
  border-top: 1px solid #f1f5f9;
}

.cc-tag-emp-override {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cc-tag-emp-override.on {
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.cc-tag-emp-override.off {
  background: #fef2f2;
  color: #b91c1c;
  border: 1px solid #fecaca;
}

.cc-tag-emp-inherited {
  font-size: 11px;
  color: #64748b;
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 5px;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cc-revert-link {
  background: transparent;
  border: none;
  color: #dc2626;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  padding: 0;
  text-decoration: underline;
}

/* Actions Matrix */
.cc-emp-actions-matrix {
  display: flex;
  flex-direction: column;
}

.cc-emp-action-group {
  border-bottom: 1px solid #e2e8f0;
}

.cc-emp-action-group:last-child {
  border-bottom: none;
}

.cc-emp-action-group-title {
  padding: 12px 20px;
  background: #f8fafc;
  font-size: 13px;
  font-weight: 700;
  color: #334155;
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 1px solid #f1f5f9;
}

.cc-emp-action-group-items {
  display: flex;
  flex-direction: column;
}

.cc-emp-action-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 12px 20px;
  border-bottom: 1px solid #f8fafc;
  transition: background 0.15s;
}

.cc-emp-action-row:last-child {
  border-bottom: none;
}

.cc-emp-action-row:hover {
  background: #f8fafc;
}

.cc-emp-action-row-left {
  flex: 1;
  min-width: 0;
  padding-right: 20px;
}

.cc-emp-action-row-left strong {
  font-size: 13.5px;
  color: #0f172a;
}

.cc-emp-action-row-left p {
  margin: 2px 0 0;
  font-size: 12px;
  color: #64748b;
}

.cc-emp-action-row-right {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-shrink: 0;
}
`;
