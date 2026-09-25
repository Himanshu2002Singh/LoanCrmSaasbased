import React, { useEffect, useState } from "react";
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
    title: "Leads & Reporting Visibility",
    subtitle: "Control data visibility boundaries and access to business analytics.",
    icon: FileBarChart,
    permissions: [
      {
        key: "viewAllLeads",
        label: "View All Company Leads (All Branches / Teams)",
        description: "If enabled, users can view all company leads. If disabled, they only see leads in their own team or assigned directly to them.",
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
        description: "Configure system templates, loan products, lead sources, and company profile.",
        confidential: true,
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

  useEffect(() => {
    fetchRolePermissions();
  }, []);

  const currentRolePerms = effectivePermissions[selectedRole] || roleDefaults[selectedRole] || {};
  const currentRoleDefaults = roleDefaults[selectedRole] || {};
  const currentRoleOverrides = companyOverrides[selectedRole] || {};

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
      // Hide all confidential financial data
      preset = {
        ...currentRoleDefaults,
        viewPayouts: false,
        managePayouts: false,
        viewConnectors: false,
        manageConnectors: false,
        viewExpenses: false,
        manageExpenses: false,
        viewAllLeads: false,
        viewReports: selectedRole === "MANAGER",
        exportData: false,
        manageUsers: false,
        manageSettings: false,
        deleteRecords: false,
      };
      toast.info(`Applied 'Confidential / Restricted' preset to ${selectedRole}`);
    } else if (presetType === "full") {
      preset = {
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
              Configure admin panel page access, confidential financial data visibility (Payouts, Connectors, Expenses), and operational authority per role.
            </p>
          </div>
        </div>

        {hasChanges && (
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
      </div>

      {/* Role Tabs */}
      <div className="cc-role-tabs-band">
        {ROLE_TABS.map((tab) => {
          const isSelected = tab.key === selectedRole;
          const hasCustom = Boolean(companyOverrides[tab.key] && Object.keys(companyOverrides[tab.key]).length > 0);

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
                  <span className="cc-role-custom-dot" title="Custom rules active for this role">
                    <Unlock size={11} /> Custom
                  </span>
                )}
              </div>
              <p className="cc-role-tab-desc">{tab.badge}</p>
            </button>
          );
        })}
      </div>

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
                    const isDefault = Boolean(currentRoleDefaults[perm.key]);
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

      {/* Floating Save Action Bar for Mobile & Desktop */}
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
    </div>
  );
}

const pageStyles = `
.cc-perm-page {
  padding: 24px 28px 80px;
  max-width: 1280px;
  margin: 0 auto;
  font-family: inherit;
}

.cc-perm-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  margin-bottom: 24px;
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
  animation: pulse 2s infinite;
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

.cc-role-tabs-band {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 12px;
  margin-bottom: 20px;
}

.cc-role-tab {
  background: #ffffff;
  border: 2px solid #e2e8f0;
  border-radius: 14px;
  padding: 14px 16px;
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
  background: #ffffff;
  box-shadow: 0 4px 14px rgba(37, 99, 235, 0.12);
}

.cc-role-tab-top {
  display: flex;
  align-items: center;
  justify-content: space-between;
}

.cc-role-tab-badge {
  font-size: 13.5px;
  font-weight: 700;
  padding: 3px 10px;
  border-radius: 8px;
}

.cc-role-custom-dot {
  font-size: 11px;
  font-weight: 600;
  color: #047857;
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  padding: 2px 7px;
  border-radius: 6px;
  display: inline-flex;
  align-items: center;
  gap: 3px;
}

.cc-role-tab-desc {
  margin: 0;
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.cc-role-banner {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 14px;
  padding: 16px 22px;
  margin-bottom: 24px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.04);
}

.cc-role-banner-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cc-role-banner-icon {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cc-perm-badge-custom {
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 6px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cc-perm-badge-default {
  font-size: 11.5px;
  font-weight: 600;
  padding: 2px 9px;
  border-radius: 6px;
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
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
  color: #475569;
  display: flex;
  align-items: center;
  gap: 6px;
}

.cc-confidential-status-pill strong {
  color: #0f172a;
}

.cc-role-quick-presets {
  display: flex;
  align-items: center;
  gap: 8px;
}

.cc-preset-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 6px 12px;
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
  color: #0f172a;
}

.cc-preset-btn.strict {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}

.cc-preset-btn.strict:hover {
  background: #ffe4e6;
}

.cc-preset-btn.reset {
  background: #f8fafc;
  color: #475569;
}

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
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}

.cc-perm-card-header {
  padding: 14px 22px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
}

.cc-perm-card-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cc-perm-card-icon {
  color: #2563eb;
  flex-shrink: 0;
}

.cc-perm-card-header h3 {
  margin: 0;
  font-size: 15px;
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
  padding: 14px 22px;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 18px;
  cursor: pointer;
  transition: background 0.12s;
}

.cc-perm-item-row:last-child {
  border-bottom: none;
}

.cc-perm-item-row:hover {
  background: #f8fafc;
}

.cc-perm-item-left {
  flex: 1;
}

.cc-perm-item-title-bar {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cc-perm-item-title-bar strong {
  font-size: 14px;
  color: #1e293b;
}

.cc-tag-confidential {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 7px;
  border-radius: 6px;
  background: #fee2e2;
  color: #b91c1c;
}

.cc-tag-custom {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 5px;
  background: #dbeafe;
  color: #1d4ed8;
}

.cc-tag-default {
  font-size: 10.5px;
  font-weight: 600;
  padding: 1px 6px;
  border-radius: 5px;
  background: #f1f5f9;
  color: #64748b;
}

.cc-perm-item-left p {
  margin: 4px 0 0;
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

.cc-switch-label {
  font-size: 12.5px;
  font-weight: 600;
  min-width: 58px;
  text-align: right;
}

.cc-switch-label.enabled {
  color: #059669;
}

.cc-switch-label.disabled {
  color: #94a3b8;
}

/* Switch */
.cc-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.cc-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.cc-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: #cbd5e1;
  transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
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
  transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 50%;
  box-shadow: 0 2px 4px rgba(0, 0, 0, 0.2);
}

.cc-switch input:checked + .cc-slider {
  background-color: #2563eb;
}

.cc-switch input:checked + .cc-slider:before {
  transform: translateX(20px);
}

/* Floating Bottom Save Band */
.cc-floating-save-band {
  position: fixed;
  bottom: 24px;
  left: 50%;
  transform: translateX(-50%);
  background: #0f172a;
  box-shadow: 0 12px 36px rgba(0,0,0,0.3);
  border-radius: 14px;
  padding: 12px 20px;
  z-index: 1000;
  animation: floatUp 0.2s ease-out;
  border: 1px solid rgba(255,255,255,0.1);
}

@keyframes floatUp {
  from { transform: translate(-50%, 20px); opacity: 0; }
  to { transform: translate(-50%, 0); opacity: 1; }
}

.cc-floating-save-inner {
  display: flex;
  align-items: center;
  gap: 24px;
}

.cc-floating-btn-cancel {
  background: transparent;
  border: 1px solid #475569;
  color: #cbd5e1;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.cc-floating-btn-cancel:hover {
  background: rgba(255,255,255,0.08);
  color: #ffffff;
}

.cc-floating-btn-save {
  background: #2563eb;
  border: 1px solid #2563eb;
  color: #ffffff;
  padding: 7px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.4);
  transition: all 0.15s;
}

.cc-floating-btn-save:hover:not(:disabled) {
  background: #1d4ed8;
}
`;
