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
  X,
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
  Briefcase,
  Building2,
} from "lucide-react";
import API_URL from "../../config";

const PERMISSION_CATEGORIES = [
  {
    category: "Financial & Confidential Access",
    categoryKey: "finance",
    description: "Control access to company revenue, commissions, connector payouts, and expense tracker.",
    icon: Coins,
    permissions: [
      {
        key: "viewPayouts",
        label: "View Disbursements & Payouts",
        description: "Access Disbursement & Payouts page to view company revenue, bank commissions, and net earnings.",
        confidential: true,
      },
      {
        key: "managePayouts",
        label: "Manage Case Payouts",
        description: "Create, edit, calculate, and finalize disbursement & payout entries.",
        confidential: true,
      },
      {
        key: "viewConnectors",
        label: "View Connector / Party Dues",
        description: "Access Connector Details page to see DSA partner commissions, advances, and dues.",
        confidential: true,
      },
      {
        key: "manageConnectors",
        label: "Manage Connectors & Settlements",
        description: "Add new connectors, record payout settlements, credits, and advances.",
        confidential: true,
      },
      {
        key: "viewExpenses",
        label: "View Company Expense Tracker",
        description: "Access Expense Tracker to inspect operational costs, staff expenses, and cash outflows.",
        confidential: true,
      },
      {
        key: "manageExpenses",
        label: "Manage Expense Records",
        description: "Create, update, and approve company expense logs.",
        confidential: true,
      },
    ],
  },
  {
    category: "Bank & NBFC Management",
    categoryKey: "lenders",
    description: "Control permissions to view partner banks, add new banks/NBFCs, and edit RM contact details.",
    icon: Building2,
    permissions: [
      {
        key: "viewLenders",
        label: "View Bank & NBFC (Lenders)",
        description: "Access Bank & NBFC list (/lenders) to view partner banks, NBFCs, RM contact emails, and loan products.",
        confidential: false,
      },
      {
        key: "createLender",
        label: "Add Bank & NBFC (Lenders)",
        description: "Permission to register and onboard new Banks, NBFCs, and lending partners.",
        confidential: false,
      },
      {
        key: "editLender",
        label: "Edit Bank & NBFC (Lenders)",
        description: "Permission to modify partner bank details, RM phone/emails, and supported products.",
        confidential: false,
      },
    ],
  },
  {
    category: "Operations & Loan Processing",
    categoryKey: "operations",
    description: "Control access to loan file processing, pipeline stages, document uploads, and banker queries.",
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
    category: "Leads Management & Visibility",
    categoryKey: "leads_reports",
    description: "Control whether this employee can add, edit, or follow up on leads, view all company leads, and access reports.",
    icon: FileBarChart,
    permissions: [
      {
        key: "viewAllLeads",
        label: "View All Company Leads",
        description: "See all leads across the entire company. If disabled, user only sees leads assigned to them or their branch/team.",
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
        description: "Permission to modify personal information, loan amount, and assigned staff for existing leads.",
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
        description: "Permission to schedule next meetings, log call notes, and update follow-up dates.",
        confidential: false,
      },
      {
        key: "viewFollowupWork",
        label: "Today Followup / Work Tracker",
        description: "Access Today Followup & Daily Work dashboard to monitor daily scheduled followups, remarks, overdue calls, and date-wise activity filters.",
        confidential: false,
      },
      {
        key: "viewReports",
        label: "View Performance & Lead Reports",
        description: "Access Lead Reports and Performance Analytics pages.",
        confidential: false,
      },
      {
        key: "exportData",
        label: "Export Excel & Data Reports",
        description: "Download and export leads, reports, and table data as Excel / CSV files.",
        confidential: true,
      },
    ],
  },
  {
    category: "Management & System Control",
    categoryKey: "admin_control",
    description: "Control administrative authority over employees, system master settings, and record deletion.",
    icon: Settings,
    permissions: [
      {
        key: "manageUsers",
        label: "Manage Employees & Staff",
        description: "Add new employees, edit profiles, assign managers, and update salaries.",
        confidential: false,
      },
      {
        key: "manageSettings",
        label: "Manage Company Master Settings",
        description: "Configure system templates, general settings, and company settings.",
        confidential: true,
      },
      {
        key: "manageLeadStatuses",
        label: "Manage Lead Statuses",
        description: "Add, edit, reorder, and configure pipeline stages and statuses for leads.",
        confidential: false,
      },
      {
        key: "manageLoanProducts",
        label: "Manage Loan Types / Products",
        description: "Add, edit, and configure available company loan types and financial products.",
        confidential: false,
      },
      {
        key: "manageLeadSources",
        label: "Manage Lead Sources",
        description: "Add, edit, and configure customer acquisition sources and partner channels.",
        confidential: false,
      },
      {
        key: "deleteRecords",
        label: "Delete Leads & Critical Records",
        description: "Permission to permanently delete leads, payouts, or expense records.",
        confidential: true,
      },
    ],
  },
];

export default function ManagePermissionsModal({ open, onClose, user, onUpdated }) {
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [effectivePermissions, setEffectivePermissions] = useState({});
  const [defaultPermissions, setDefaultPermissions] = useState({});
  const [customOverrides, setCustomOverrides] = useState({});
  const [hasCustomOverrides, setHasCustomOverrides] = useState(false);

  useEffect(() => {
    if (!open || !user) return;

    const fetchPermissions = async () => {
      setLoading(true);
      try {
        const res = await axios.get(`${API_URL}/users/permissions/metadata`);
        const defaultRolePerms = res.data?.defaultRolePermissions?.[user.role] || {};
        setDefaultPermissions(defaultRolePerms);

        // Current user permissions
        const userExplicitPerms = user.permissions || {};
        const isExplicit = user.permissions && Object.keys(user.permissions).length > 0;
        setHasCustomOverrides(isExplicit);
        setCustomOverrides(userExplicitPerms);

        // Effective permissions
        const effective = { ...defaultRolePerms, ...(user.permissions || {}) };
        setEffectivePermissions(effective);
      } catch (error) {
        console.error("Failed to load permission metadata:", error);
        // Fallback calculation
        const fallbackEffective = user.resolvedPermissions || user.permissions || {};
        setEffectivePermissions(fallbackEffective);
      } finally {
        setLoading(false);
      }
    };

    fetchPermissions();
  }, [open, user]);

  if (!open || !user) return null;

  const handleToggle = (key) => {
    const currentVal = Boolean(effectivePermissions[key]);
    const newVal = !currentVal;

    const newEffective = { ...effectivePermissions, [key]: newVal };
    setEffectivePermissions(newEffective);

    // Update custom overrides
    const newOverrides = { ...customOverrides, [key]: newVal };
    setCustomOverrides(newOverrides);
    setHasCustomOverrides(true);
  };

  const handleResetToRoleDefault = () => {
    setEffectivePermissions({ ...defaultPermissions });
    setCustomOverrides({});
    setHasCustomOverrides(false);
    toast.info(`Reset to default permissions for role: ${user.role}`);
  };

  const handleApplyPreset = (presetType) => {
    let preset = {};
    if (presetType === "strict") {
      // Hide all confidential financial data and restrict to team leads
      preset = {
        viewPayouts: false,
        managePayouts: false,
        viewConnectors: false,
        manageConnectors: false,
        viewExpenses: false,
        manageExpenses: false,
        viewAllLeads: false,
        createLead: user.role === "MANAGER" || user.role === "EMPLOYEE",
        editLead: user.role === "MANAGER" || user.role === "EMPLOYEE" || user.role === "OPS",
        reassignLeads: user.role === "MANAGER" || user.role === "EMPLOYEE" || user.role === "OPS",
        followupLead: user.role === "MANAGER" || user.role === "EMPLOYEE" || user.role === "OPS",
        viewOperations: user.role === "MANAGER" || user.role === "OPS",
        manageOperations: user.role === "MANAGER" || user.role === "OPS",
        createLoanApplication: user.role === "OPS",
        viewReports: true,
        exportData: false,
        manageUsers: false,
        manageSettings: false,
        manageLeadStatuses: false,
        manageLoanProducts: false,
        manageLeadSources: false,
        deleteRecords: false,
      };
      toast.info("Applied 'Confidential / Restricted' preset");
    } else if (presetType === "finance") {
      preset = {
        viewPayouts: true,
        managePayouts: true,
        viewConnectors: true,
        manageConnectors: true,
        viewExpenses: true,
        manageExpenses: true,
        viewReports: true,
        exportData: true,
        viewAllLeads: false,
        createLead: false,
        editLead: false,
        reassignLeads: false,
        followupLead: false,
        viewOperations: false,
        manageOperations: false,
        createLoanApplication: false,
        manageUsers: false,
        manageSettings: false,
        manageLeadStatuses: false,
        manageLoanProducts: false,
        manageLeadSources: false,
        deleteRecords: false,
      };
      toast.info("Applied 'Finance & Accounts' preset");
    } else if (presetType === "full") {
      // Grant all permissions
      preset = {
        viewPayouts: true,
        managePayouts: true,
        viewConnectors: true,
        manageConnectors: true,
        viewExpenses: true,
        manageExpenses: true,
        viewAllLeads: true,
        createLead: true,
        editLead: true,
        reassignLeads: true,
        followupLead: true,
        viewOperations: true,
        manageOperations: true,
        createLoanApplication: true,
        viewReports: true,
        exportData: true,
        manageUsers: true,
        manageSettings: true,
        manageLeadStatuses: true,
        manageLoanProducts: true,
        manageLeadSources: true,
        deleteRecords: true,
      };
      toast.info("Applied 'Full Access' preset");
    }
    setEffectivePermissions(preset);
    setCustomOverrides(preset);
    setHasCustomOverrides(true);
  };

  const handleSave = async () => {
    setSubmitting(true);
    try {
      // If no custom overrides, we can send null or empty to revert to role defaults
      const payloadPermissions = hasCustomOverrides ? effectivePermissions : null;

      const res = await axios.put(`${API_URL}/users/${user.id}/permissions`, {
        permissions: payloadPermissions,
      });

      toast.success(res.data?.message || "Permissions updated successfully!");
      if (onUpdated) {
        onUpdated(res.data?.data);
      }
      onClose();
    } catch (error) {
      console.error("Failed to update permissions:", error);
      toast.error(error.response?.data?.message || "Failed to save permissions");
    } finally {
      setSubmitting(false);
    }
  };

  const isCompanyAdminUser = user.role === "COMPANY_ADMIN" || user.role === "SUPERADMIN";

  return (
    <div className="cc-perm-overlay" onClick={onClose}>
      <style>{modalStyles}</style>
      <div className="cc-perm-card" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="cc-perm-header">
          <div className="cc-perm-header-left">
            <div className="cc-perm-icon-wrap">
              <Shield size={22} />
            </div>
            <div>
              <h3>Role & Feature Permissions</h3>
              <p>
                Configure feature access and confidential data visibility for{" "}
                <strong>{user.name || `User #${user.id}`}</strong>
              </p>
            </div>
          </div>
          <button type="button" className="cc-perm-close-btn" onClick={onClose} aria-label="Close">
            <X size={19} />
          </button>
        </div>

        {/* User Badge Banner */}
        <div className="cc-perm-banner">
          <div className="cc-perm-user-info">
            <span className="cc-perm-avatar">
              {(user.name || String(user.id) || "?").slice(0, 2).toUpperCase()}
            </span>
            <div>
              <div className="cc-perm-user-title">
                <strong>{user.name}</strong>
                <span className={`cc-perm-role-badge role-${(user.role || "").toLowerCase()}`}>
                  {user.role}
                </span>
                {hasCustomOverrides ? (
                  <span className="cc-perm-custom-badge">
                    <Unlock size={12} /> Custom Overrides Active
                  </span>
                ) : (
                  <span className="cc-perm-default-badge">
                    <Lock size={12} /> Standard Role Defaults
                  </span>
                )}
              </div>
              <small style={{ color: "#64748b" }}>
                {user.email || "No email"} • {user.branch?.name ? `Branch: ${user.branch.name}` : "All Branches"}
              </small>
            </div>
          </div>

          {!isCompanyAdminUser && (
            <div className="cc-perm-quick-actions">
              <button
                type="button"
                className="cc-perm-preset-btn strict"
                onClick={() => handleApplyPreset("strict")}
                title="Hide all payouts, connectors, and expense data"
              >
                🔒 Strict (Hide Confidential Data)
              </button>
              <button
                type="button"
                className="cc-perm-preset-btn"
                style={{ background: "#f0fdfa", color: "#0f766e", borderColor: "#99f6e4" }}
                onClick={() => handleApplyPreset("finance")}
                title="Only payouts, expenses, and connector parties"
              >
                💼 Finance Only
              </button>
              <button
                type="button"
                className="cc-perm-preset-btn"
                onClick={() => handleApplyPreset("full")}
                title="Allow all permissions"
              >
                ⚡ Full Access
              </button>
              {hasCustomOverrides && (
                <button
                  type="button"
                  className="cc-perm-preset-btn reset"
                  onClick={handleResetToRoleDefault}
                  title="Revert back to standard role defaults"
                >
                  <RotateCcw size={13} /> Reset to Default
                </button>
              )}
            </div>
          )}
        </div>

        {/* Notice for Company Admin */}
        {isCompanyAdminUser ? (
          <div className="cc-perm-admin-alert">
            <Info size={20} />
            <div>
              <strong>Company Admin has Unrestricted Access</strong>
              <p>
                Company Admins automatically have unrestricted master access to all financial pages, payouts, connectors, expenses, settings, and employee leads.
              </p>
            </div>
          </div>
        ) : (
          <div className="cc-perm-hint-bar">
            <AlertTriangle size={15} style={{ color: "#d97706", flexShrink: 0 }} />
            <span>
              Toggling these permissions lets you hide sensitive pages like <strong>Payouts</strong>, <strong>Expense Tracker</strong>, and <strong>Connector Dues</strong> from managers and staff.
            </span>
          </div>
        )}

        {/* Body Permissions List */}
        <div className="cc-perm-body">
          {loading ? (
            <div style={{ textAlign: "center", padding: "40px 20px", color: "#64748b" }}>
              Loading permissions...
            </div>
          ) : (
            PERMISSION_CATEGORIES.map((cat) => {
              const CategoryIcon = cat.icon;
              return (
                <div key={cat.categoryKey} className="cc-perm-group">
                  <div className="cc-perm-group-header">
                    <CategoryIcon size={18} className="cc-perm-group-icon" />
                    <div>
                      <h4>{cat.category}</h4>
                      <p>{cat.description}</p>
                    </div>
                  </div>

                  <div className="cc-perm-items-grid">
                    {cat.permissions.map((perm) => {
                      const isAllowed = isCompanyAdminUser ? true : Boolean(effectivePermissions[perm.key]);
                      const isOverridden = !isCompanyAdminUser && customOverrides[perm.key] !== undefined;

                      return (
                        <div
                          key={perm.key}
                          className={`cc-perm-row ${isAllowed ? "allowed" : "denied"} ${
                            isOverridden ? "overridden" : ""
                          }`}
                          onClick={() => {
                            if (!isCompanyAdminUser) handleToggle(perm.key);
                          }}
                        >
                          <div className="cc-perm-row-content">
                            <div className="cc-perm-row-title">
                              <strong>{perm.label}</strong>
                              {perm.confidential && (
                                <span className="cc-perm-confidential-tag">
                                  🔒 Confidential
                                </span>
                              )}
                              {isOverridden && (
                                <span className="cc-perm-overridden-tag">
                                  Custom
                                </span>
                              )}
                            </div>
                            <p>{perm.description}</p>
                          </div>

                          <div className="cc-perm-switch-wrap" onClick={(e) => e.stopPropagation()}>
                            <label className="cc-perm-switch">
                              <input
                                type="checkbox"
                                checked={isAllowed}
                                disabled={isCompanyAdminUser}
                                onChange={() => handleToggle(perm.key)}
                              />
                              <span className="cc-perm-slider" />
                            </label>
                            <span className={`cc-perm-switch-status ${isAllowed ? "on" : "off"}`}>
                              {isAllowed ? "Enabled" : "Disabled"}
                            </span>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })
          )}
        </div>

        {/* Footer */}
        <div className="cc-perm-footer">
          <div className="cc-perm-footer-left">
            <span style={{ fontSize: 13, color: "#64748b" }}>
              {hasCustomOverrides
                ? "💡 Custom permission profile will be saved for this user."
                : "💡 Standard role default permissions are active."}
            </span>
          </div>

          <div className="cc-perm-footer-actions">
            <button type="button" className="cc-perm-btn-cancel" onClick={onClose}>
              Cancel
            </button>
            <button
              type="button"
              className="cc-perm-btn-save"
              onClick={handleSave}
              disabled={submitting || isCompanyAdminUser}
            >
              {submitting ? "Saving..." : "Save Permissions"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

const modalStyles = `
.cc-perm-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.65);
  backdrop-filter: blur(4px);
  z-index: 1200;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 16px;
  animation: ccPermFadeIn 0.18s ease-out;
}

@keyframes ccPermFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

.cc-perm-card {
  background: #ffffff;
  border-radius: 16px;
  box-shadow: 0 20px 45px -10px rgba(15, 23, 42, 0.25), 0 0 0 1px rgba(15, 23, 42, 0.08);
  width: 100%;
  max-width: 820px;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  font-family: inherit;
}

.cc-perm-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 20px 24px;
  border-bottom: 1px solid #e2e8f0;
  background: #f8fafc;
}

.cc-perm-header-left {
  display: flex;
  align-items: center;
  gap: 14px;
}

.cc-perm-icon-wrap {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: linear-gradient(135deg, #3b82f6 0%, #1d4ed8 100%);
  color: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  box-shadow: 0 4px 10px rgba(59, 130, 246, 0.28);
}

.cc-perm-header h3 {
  margin: 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}

.cc-perm-header p {
  margin: 2px 0 0;
  font-size: 13px;
  color: #64748b;
}

.cc-perm-close-btn {
  background: transparent;
  border: none;
  color: #64748b;
  cursor: pointer;
  padding: 6px;
  border-radius: 8px;
  transition: all 0.15s;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cc-perm-close-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.cc-perm-banner {
  padding: 14px 24px;
  background: #ffffff;
  border-bottom: 1px solid #f1f5f9;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.cc-perm-user-info {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cc-perm-avatar {
  width: 40px;
  height: 40px;
  border-radius: 10px;
  background: #0f172a;
  color: #ffffff;
  font-weight: 700;
  font-size: 14px;
  display: flex;
  align-items: center;
  justify-content: center;
}

.cc-perm-user-title {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cc-perm-role-badge {
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 6px;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  background: #f1f5f9;
  color: #334155;
}

.cc-perm-role-badge.role-manager {
  background: #e0e7ff;
  color: #3730a3;
}

.cc-perm-role-badge.role-ops {
  background: #fae8ff;
  color: #86198f;
}

.cc-perm-role-badge.role-company_admin {
  background: #fef3c7;
  color: #92400e;
}

.cc-perm-custom-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cc-perm-default-badge {
  font-size: 11px;
  font-weight: 600;
  padding: 2px 8px;
  border-radius: 6px;
  background: #f8fafc;
  color: #64748b;
  border: 1px solid #e2e8f0;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}

.cc-perm-quick-actions {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}

.cc-perm-preset-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #334155;
  padding: 5px 11px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
  display: inline-flex;
  align-items: center;
  gap: 5px;
}

.cc-perm-preset-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.cc-perm-preset-btn.strict {
  background: #fff1f2;
  border-color: #fecdd3;
  color: #be123c;
}

.cc-perm-preset-btn.strict:hover {
  background: #ffe4e6;
}

.cc-perm-preset-btn.reset {
  background: #f8fafc;
  color: #475569;
}

.cc-perm-hint-bar {
  background: #fffbeb;
  border-bottom: 1px solid #fef3c7;
  padding: 10px 24px;
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 12.5px;
  color: #92400e;
}

.cc-perm-admin-alert {
  background: #eff6ff;
  border-bottom: 1px solid #dbeafe;
  padding: 12px 24px;
  display: flex;
  align-items: center;
  gap: 12px;
  color: #1e40af;
  font-size: 13px;
}

.cc-perm-admin-alert p {
  margin: 2px 0 0;
  color: #3b82f6;
  font-size: 12px;
}

.cc-perm-body {
  padding: 18px 24px;
  overflow-y: auto;
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cc-perm-group {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  overflow: hidden;
}

.cc-perm-group-header {
  padding: 12px 18px;
  background: #f8fafc;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  gap: 12px;
}

.cc-perm-group-icon {
  color: #2563eb;
  flex-shrink: 0;
}

.cc-perm-group-header h4 {
  margin: 0;
  font-size: 14px;
  font-weight: 700;
  color: #0f172a;
}

.cc-perm-group-header p {
  margin: 1px 0 0;
  font-size: 12px;
  color: #64748b;
}

.cc-perm-items-grid {
  display: grid;
  grid-template-columns: 1fr;
}

.cc-perm-row {
  padding: 12px 18px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  border-bottom: 1px solid #f1f5f9;
  cursor: pointer;
  transition: background 0.12s;
}

.cc-perm-row:last-child {
  border-bottom: none;
}

.cc-perm-row:hover {
  background: #f8fafc;
}

.cc-perm-row-content {
  flex: 1;
}

.cc-perm-row-title {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 13.5px;
  color: #1e293b;
}

.cc-perm-confidential-tag {
  font-size: 10.5px;
  font-weight: 700;
  padding: 1px 6px;
  border-radius: 5px;
  background: #fee2e2;
  color: #b91c1c;
}

.cc-perm-overridden-tag {
  font-size: 10px;
  font-weight: 700;
  padding: 1px 5px;
  border-radius: 4px;
  background: #dbeafe;
  color: #1d4ed8;
}

.cc-perm-row-content p {
  margin: 3px 0 0;
  font-size: 12px;
  color: #64748b;
  line-height: 1.35;
}

.cc-perm-switch-wrap {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-shrink: 0;
}

.cc-perm-switch-status {
  font-size: 12px;
  font-weight: 600;
  min-width: 58px;
  text-align: right;
}

.cc-perm-switch-status.on {
  color: #059669;
}

.cc-perm-switch-status.off {
  color: #94a3b8;
}

/* Apple-style Toggle Switch */
.cc-perm-switch {
  position: relative;
  display: inline-block;
  width: 44px;
  height: 24px;
  flex-shrink: 0;
}

.cc-perm-switch input {
  opacity: 0;
  width: 0;
  height: 0;
}

.cc-perm-slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: #cbd5e1;
  transition: 0.2s cubic-bezier(0.4, 0, 0.2, 1);
  border-radius: 24px;
}

.cc-perm-slider:before {
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

.cc-perm-switch input:checked + .cc-perm-slider {
  background-color: #2563eb;
}

.cc-perm-switch input:checked + .cc-perm-slider:before {
  transform: translateX(20px);
}

.cc-perm-switch input:disabled + .cc-perm-slider {
  opacity: 0.6;
  cursor: not-allowed;
}

.cc-perm-footer {
  padding: 16px 24px;
  background: #f8fafc;
  border-top: 1px solid #e2e8f0;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
}

.cc-perm-footer-actions {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cc-perm-btn-cancel {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.cc-perm-btn-cancel:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.cc-perm-btn-save {
  background: #2563eb;
  border: 1px solid #2563eb;
  color: #ffffff;
  padding: 8px 22px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(37, 99, 235, 0.35);
  transition: all 0.15s;
}

.cc-perm-btn-save:hover:not(:disabled) {
  background: #1d4ed8;
}

.cc-perm-btn-save:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
`;
