import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { Link, Navigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  BarChart3,
  Briefcase,
  Building,
  Building2,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Crown,
  Edit3,
  ExternalLink,
  Headphones,
  HelpCircle,
  Layers,
  Mail,
  MapPin,
  Palette,
  Phone,
  Radio,
  RefreshCw,
  ShieldCheck,
  Sparkles,
  UserCheck,
  UserPlus,
  Users,
  UploadCloud,
  X,
  Zap,
} from "lucide-react";

import API_URL from "../../config";
import { resolveLogoUrl } from "../../utils/logo";
import ThemeCustomizerModal from "../../components/ThemeCustomizerModal";
import { saveTheme } from "../../utils/theme";

export default function CompanyProfileScreen() {
  const location = useLocation();
  const userRole = localStorage.getItem("userRole") || "";
  const employeeRole = localStorage.getItem("employeeRole") || "";
  const isCompanyAdmin =
    ["COMPANY_ADMIN", "SUPERADMIN"].includes(userRole.toUpperCase()) ||
    ["admin", "superadmin"].includes(employeeRole?.toLowerCase());

  if (!isCompanyAdmin) {
    return <Navigate to="/profile" replace />;
  }

  const [data, setData] = useState(null);

  const [loading, setLoading] = useState(true);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [themeModalOpen, setThemeModalOpen] = useState(false);
  const [editForm, setEditForm] = useState({ name: "", email: "", phone: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (location.search && (location.search.includes("theme") || location.search.includes("branding"))) {
      setThemeModalOpen(true);
    }
  }, [location.search]);

  const fetchProfile = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/company/profile`);
      const profile = res.data?.data;
      setData(profile);
      if (profile) {
        setEditForm({
          name: profile.name || "",
          email: profile.email || "",
          phone: profile.phone || "",
          gstNumber: profile.gstNumber || profile.gst_number || "",
          panNumber: profile.panNumber || profile.pan_number || "",
          address: profile.address || "",
          city: profile.city || "",
          state: profile.state || "",
          pincode: profile.pincode || "",
          bankName: profile.bankName || profile.bank_name || "",
          accountNumber: profile.accountNumber || profile.account_number || "",
          ifscCode: profile.ifscCode || profile.ifsc_code || "",
          bankBranch: profile.bankBranch || profile.bank_branch || "",
        });
        if (profile.logoUrl) {
          localStorage.setItem("companyLogo", profile.logoUrl);
          window.dispatchEvent(new Event("company_profile_updated"));
        }
        if (profile.themeConfig) {
          saveTheme(profile.themeConfig);
        }
      }
    } catch (error) {
      console.error("Error fetching company profile:", error);
      toast.error(error.response?.data?.message || "Failed to load company details");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const handleUpdateProfile = async (e) => {
    e.preventDefault();
    if (!String(editForm.name || "").trim()) {
      toast.error("Company name is required");
      return;
    }

    try {
      setSaving(true);
      await axios.put(`${API_URL}/company/profile`, {
        name: editForm.name.trim(),
        email: editForm.email ? editForm.email.trim() : null,
        phone: editForm.phone ? editForm.phone.trim() : null,
        gstNumber: editForm.gstNumber ? editForm.gstNumber.trim().toUpperCase() : null,
        panNumber: editForm.panNumber ? editForm.panNumber.trim().toUpperCase() : null,
        address: editForm.address ? editForm.address.trim() : null,
        city: editForm.city ? editForm.city.trim() : null,
        state: editForm.state ? editForm.state.trim() : null,
        pincode: editForm.pincode ? editForm.pincode.trim() : null,
        bankName: editForm.bankName ? editForm.bankName.trim() : null,
        accountNumber: editForm.accountNumber ? editForm.accountNumber.trim() : null,
        ifscCode: editForm.ifscCode ? editForm.ifscCode.trim().toUpperCase() : null,
        bankBranch: editForm.bankBranch ? editForm.bankBranch.trim() : null,
      });
      toast.success("Company details updated successfully!");
      setEditModalOpen(false);
      fetchProfile();
    } catch (error) {
      console.error("Error updating company profile:", error);
      toast.error(error.response?.data?.message || "Failed to update company details");
    } finally {
      setSaving(false);
    }
  };

  const handleCompanyLogoUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file must be less than 5MB");
      return;
    }
    try {
      setSaving(true);
      const formData = new FormData();
      formData.append("logo", file);
      const res = await axios.post(`${API_URL}/company/upload-logo`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const logoUrl = res.data?.logoUrl;
      await axios.put(`${API_URL}/company/profile`, { logoUrl });
      toast.success("Company logo updated!");
      localStorage.setItem("companyLogo", logoUrl);
      window.dispatchEvent(new Event("company_profile_updated"));
      fetchProfile();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to upload logo");
    } finally {
      setSaving(false);
    }
  };

  if (loading && !data) {
    return (
      <div className="cc-company-page">
        <div className="cc-company-loading">
          <RefreshCw className="cc-spin" size={32} />
          <p>Loading company & subscription details…</p>
        </div>
        <style>{styles}</style>
      </div>
    );
  }

  const sub = data?.subscription || {};
  const plan = data?.plan || {};
  const seatsUsed = data?.seatsUsed || 0;
  const seatLimit = data?.seatLimit || null;
  const seatsRemaining = data?.seatsRemaining;
  const usagePercent = seatLimit ? Math.min(Math.round((seatsUsed / seatLimit) * 100), 100) : 0;
  const daysRemaining = sub.daysRemaining;
  const isExpired = sub.isExpired;
  const branches = data?.branches || [];
  const usersByRole = data?.usersByRole || {};

  // Status badge config
  const statusColor =
    data?.status === "active"
      ? { bg: "#ecfdf5", text: "#065f46", border: "#a7f3d0", label: "Active" }
      : data?.status === "trial"
      ? { bg: "#fffbeb", text: "#92400e", border: "#fde68a", label: "Trial" }
      : { bg: "#fef2f2", text: "#991b1b", border: "#fecaca", label: "Suspended" };

  const getMeterColor = (pct) => {
    if (pct >= 95) return "#dc2626";
    if (pct >= 75) return "#f59e0b";
    return "#047857";
  };

  const companyInitials = (data?.name || "Company")
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();

  const featureItems = [
    { key: "leads", label: "Leads Management & CRM Pipeline", icon: Layers, enabled: true },
    { key: "calling", label: "Calling Engine & Telephony Logs", icon: Headphones, enabled: true },
    { key: "ops", label: "Operations & Loan Processing", icon: Briefcase, enabled: true },
    { key: "bankerPortal", label: "Banker Portal & Query Handling", icon: Building, enabled: true },
    { key: "gpsAttendance", label: "GPS Attendance & Geofencing", icon: MapPin, enabled: true },
    { key: "reports", label: "MIS Reports & Performance Analytics", icon: BarChart3, enabled: true },
  ];

  return (
    <div className="cc-company-page">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      {/* Page Header */}
      <div className="cc-company-header">
        <div>
          <div className="cc-badge-row">
            <span className="cc-badge-chip">
              <ShieldCheck size={13} /> Tenant Organization
            </span>
            <span
              className="cc-status-pill"
              style={{
                background: statusColor.bg,
                color: statusColor.text,
                borderColor: statusColor.border,
              }}
            >
              <i style={{ background: statusColor.text }} />
              {statusColor.label}
            </span>
            {isExpired && (
              <span className="cc-status-pill expired">
                <AlertCircle size={12} /> Plan Expired
              </span>
            )}
          </div>
          <h1>{data?.name || "Company Profile"}</h1>
          <p className="cc-company-sub">
            Overview of your organization profile, assigned subscription tier, and employee seat limits.
          </p>
        </div>

        <div className="cc-header-actions">
          <button
            type="button"
            className="cc-comp-btn primary"
            onClick={() => setThemeModalOpen(true)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "8px",
            }}
          >
            <Palette size={15} /> Customize Panel Colors
          </button>
          <button
            type="button"
            className="cc-comp-btn ghost"
            onClick={() => setEditModalOpen(true)}
          >
            <Edit3 size={15} /> Edit Details
          </button>
          <button
            type="button"
            className="cc-comp-btn ghost"
            onClick={fetchProfile}
            title="Refresh details"
          >
            <RefreshCw size={15} /> Refresh
          </button>
        </div>
      </div>

      {/* Hero Overview Card */}
      <div className="cc-comp-hero-card">
        <div className="cc-hero-left">
          <div style={{ position: "relative", flexShrink: 0 }}>
            {data?.logoUrl ? (
              <img
                src={resolveLogoUrl(data.logoUrl)}
                alt={data.name}
                className="cc-comp-avatar"
                style={{ objectFit: "contain", background: "#fff", padding: 4 }}
              />
            ) : (
              <div className="cc-comp-avatar">{companyInitials}</div>
            )}
            <label
              title="Upload / Change Logo"
              style={{
                position: "absolute",
                bottom: -4,
                right: -4,
                width: 28,
                height: 28,
                borderRadius: "50%",
                background: "#047857",
                color: "#fff",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                cursor: "pointer",
                boxShadow: "0 2px 6px rgba(0,0,0,0.3)",
              }}
            >
              <UploadCloud size={14} />
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                style={{ display: "none" }}
                onChange={handleCompanyLogoUpload}
              />
            </label>
          </div>
          <div className="cc-hero-info">
            <div className="cc-hero-title-row">
              <h2>{data?.name}</h2>
              {data?.slug && <span className="cc-slug-pill">Org Code: {data.slug}</span>}
            </div>
            <div className="cc-hero-meta">
              {data?.email && (
                <span className="cc-meta-item">
                  <Mail size={14} /> {data.email}
                </span>
              )}
              {data?.phone && (
                <span className="cc-meta-item">
                  <Phone size={14} /> {data.phone}
                </span>
              )}
              <span className="cc-meta-item">
                <Calendar size={14} /> Registered {moment(data?.createdAt).format("DD MMM YYYY")}
              </span>
            </div>
          </div>
        </div>

        <div className="cc-hero-right">
          <div className="cc-hero-plan-box">
            <span className="cc-plan-kicker">
              <Crown size={14} /> Active Plan
            </span>
            <h3>{sub.planName || "Standard Plan"}</h3>
            <p className="cc-plan-price">
              {sub.priceMonthly > 0 ? `₹${Number(sub.priceMonthly).toLocaleString("en-IN")} / mo` : "Custom Tier"}
            </p>
          </div>
        </div>
      </div>

      {/* KPI Metric Cards Grid */}
      <div className="cc-comp-kpis">
        <div className="cc-kpi-card">
          <div className="cc-kpi-icon gold">
            <Crown size={20} />
          </div>
          <div className="cc-kpi-body">
            <span className="cc-kpi-label">Subscription Tier</span>
            <strong className="cc-kpi-value">{sub.planName || "Standard"}</strong>
            <span className="cc-kpi-sub">
              {sub.isTrial ? "Trial Account" : "Commercial License"}
            </span>
          </div>
        </div>

        <div className="cc-kpi-card">
          <div className="cc-kpi-icon green">
            <Users size={20} />
          </div>
          <div className="cc-kpi-body">
            <span className="cc-kpi-label">Allowed Employees</span>
            <strong className="cc-kpi-value">
              {seatsUsed} / {seatLimit ?? "∞"}
            </strong>
            <div className="cc-kpi-progress">
              <div
                className="cc-kpi-bar"
                style={{
                  width: `${usagePercent}%`,
                  backgroundColor: getMeterColor(usagePercent),
                }}
              />
            </div>
            <span className="cc-kpi-sub">
              {seatsRemaining !== null ? `${seatsRemaining} seats available` : "Unlimited seats"}
            </span>
          </div>
        </div>

        <div className="cc-kpi-card">
          <div className="cc-kpi-icon blue">
            <Calendar size={20} />
          </div>
          <div className="cc-kpi-body">
            <span className="cc-kpi-label">Plan Renewal / Expiry</span>
            <strong className="cc-kpi-value">
              {data?.subscriptionExpiresAt
                ? moment(data.subscriptionExpiresAt).format("DD MMM YYYY")
                : "No Expiry"}
            </strong>
            <span
              className={`cc-kpi-sub ${
                isExpired ? "danger" : daysRemaining !== null && daysRemaining <= 10 ? "warn" : ""
              }`}
            >
              {daysRemaining !== null
                ? isExpired
                  ? `Expired ${Math.abs(daysRemaining)} days ago`
                  : `${daysRemaining} days remaining`
                : "Perpetual Subscription"}
            </span>
          </div>
        </div>

        <div className="cc-kpi-card">
          <div className="cc-kpi-icon purple">
            <Building2 size={20} />
          </div>
          <div className="cc-kpi-body">
            <span className="cc-kpi-label">Registered Branches</span>
            <strong className="cc-kpi-value">{branches.length}</strong>
            <span className="cc-kpi-sub">
              {branches[0]?.city ? `Head Office: ${branches[0].city}` : "Operational offices"}
            </span>
          </div>
        </div>
      </div>

      {/* Main Two-Column Content */}
      <div className="cc-comp-grid">
        {/* Left Column: Subscription & Seat Details */}
        <div className="cc-comp-col">
          {/* Subscription Card */}
          <div className="cc-section-card">
            <div className="cc-card-header">
              <div>
                <span className="cc-card-subtitle">Plan Details</span>
                <h2>Subscription & License</h2>
              </div>
              <span className="cc-tier-badge">
                <Zap size={14} /> {sub.planName || "Active"}
              </span>
            </div>

            <div className="cc-plan-detail-box">
              <div className="cc-plan-detail-row">
                <span>Plan Tier</span>
                <strong>{sub.planName || "Custom"}</strong>
              </div>
              <div className="cc-plan-detail-row">
                <span>Monthly Recurring Price</span>
                <strong>
                  {sub.priceMonthly > 0
                    ? `₹${Number(sub.priceMonthly).toLocaleString("en-IN")} / month`
                    : "Included / Custom Package"}
                </strong>
              </div>
              <div className="cc-plan-detail-row">
                <span>Total Allowed Team Seats</span>
                <strong>{seatLimit ?? "Unlimited"} seats allocated</strong>
              </div>
              <div className="cc-plan-detail-row">
                <span>Active Seats in Use</span>
                <strong style={{ color: seatsUsed >= (seatLimit || Infinity) ? "#dc2626" : "#047857" }}>
                  {seatsUsed} active users
                </strong>
              </div>
              <div className="cc-plan-detail-row">
                <span>Renewal / Expiration Date</span>
                <strong>
                  {data?.subscriptionExpiresAt
                    ? moment(data.subscriptionExpiresAt).format("DD MMMM YYYY")
                    : "No expiration date"}
                </strong>
              </div>
            </div>

            {/* Seat Usage Bar & Role Breakdown */}
            <div className="cc-usage-breakdown">
              <div className="cc-usage-head">
                <span>Seat Capacity Utilization</span>
                <strong>
                  {seatsUsed} of {seatLimit ?? "∞"} seats ({usagePercent}%)
                </strong>
              </div>
              <div className="cc-main-meter">
                <div
                  className="cc-main-bar"
                  style={{
                    width: `${usagePercent}%`,
                    backgroundColor: getMeterColor(usagePercent),
                  }}
                />
              </div>

              {seatLimit && seatsUsed >= seatLimit && (
                <div className="cc-alert-box danger">
                  <AlertCircle size={16} />
                  <span>
                    Your company is at maximum seat capacity ({seatLimit} seats). To add more staff,
                    please upgrade your limit or deactivate inactive members.
                  </span>
                </div>
              )}

              <div className="cc-role-counts">
                <h4>Team Members Distribution</h4>
                <div className="cc-role-tags">
                  <span className="cc-role-tag sales">
                    Sales Managers: <strong>{usersByRole.EMPLOYEE || 0}</strong>
                  </span>
                  <span className="cc-role-tag manager">
                    Managers: <strong>{usersByRole.MANAGER || 0}</strong>
                  </span>
                  <span className="cc-role-tag ops">
                    Operations: <strong>{usersByRole.OPS || 0}</strong>
                  </span>
                  <span className="cc-role-tag banker">
                    Bankers: <strong>{usersByRole.BANKER || 0}</strong>
                  </span>
                  <span className="cc-role-tag admin">
                    Admins: <strong>{usersByRole.COMPANY_ADMIN || 0}</strong>
                  </span>
                </div>
              </div>
            </div>

            {/* Unlocked Modules */}
            <div className="cc-modules-list">
              <h4>System Modules & Features</h4>
              <div className="cc-modules-grid">
                {featureItems.map((item) => {
                  const Icon = item.icon;
                  return (
                    <div key={item.key} className="cc-module-item">
                      <div className="cc-module-icon">
                        <Icon size={16} />
                      </div>
                      <span className="cc-module-label">{item.label}</span>
                      <CheckCircle2 size={16} className="cc-check-icon" />
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Need More Seats / Upgrade Help Banner */}
            <div className="cc-upgrade-support-box">
              <div className="cc-upgrade-icon">
                <Sparkles size={22} />
              </div>
              <div>
                <h4>Need to Increase Allowed Employees?</h4>
                <p>
                  To add more employee seats or unlock customized enterprise modules for your company,
                  reach out to the platform support team.
                </p>
                <div className="cc-support-contact">
                  <span>
                    <Mail size={13} /> trustingbrains@gmail.com
                  </span>
                  <span>
                    <Phone size={13} /> +91-9876543210
                  </span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Organization Details & Branches */}
        <div className="cc-comp-col">
          {/* Panel Branding & Theme Colors Card */}
          <div className="cc-section-card">
            <div className="cc-card-header">
              <div>
                <span className="cc-card-subtitle">Personalization</span>
                <h2>Panel Theme & Colors</h2>
              </div>
              <button
                type="button"
                className="cc-comp-btn primary small"
                onClick={() => setThemeModalOpen(true)}
                style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
              >
                <Palette size={13} /> Customize Theme
              </button>
            </div>

            <div style={{ padding: "4px 0 10px" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  marginBottom: "14px",
                  flexWrap: "wrap",
                  gap: "8px",
                }}
              >
                <div>
                  <span style={{ fontSize: "14px", fontWeight: 700, color: "var(--cc-ink, #111827)" }}>
                    {data?.themeConfig?.name || "Emerald Forest (Default CRM)"}
                  </span>
                  <p style={{ margin: "2px 0 0", fontSize: "12px", color: "var(--cc-muted, #64748b)" }}>
                    Control button colors, hover effects, body background, text, and sidebar branding.
                  </p>
                </div>
                <span
                  style={{
                    fontSize: "11px",
                    fontWeight: 700,
                    textTransform: "uppercase",
                    letterSpacing: "0.04em",
                    padding: "3px 8px",
                    borderRadius: "6px",
                    background: "var(--cc-primary-light, #eef7f2)",
                    color: "var(--cc-primary, #047857)",
                  }}
                >
                  Active Theme
                </span>
              </div>

              {/* Color Swatches Grid */}
              <div
                style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(100px, 1fr))",
                  gap: "8px",
                  background: "#f8fafc",
                  padding: "12px",
                  borderRadius: "10px",
                  border: "1px solid #e2e8f0",
                }}
              >
                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      height: "26px",
                      borderRadius: "6px",
                      background: data?.themeConfig?.primaryColor || "#047857",
                      border: "1px solid rgba(0,0,0,0.1)",
                      marginBottom: "4px",
                    }}
                  />
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#334155", display: "block" }}>Brand / Buttons</span>
                  <code style={{ fontSize: "10px", color: "#64748b" }}>{data?.themeConfig?.primaryColor || "#047857"}</code>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      height: "26px",
                      borderRadius: "6px",
                      background: data?.themeConfig?.primaryHoverColor || "#065f46",
                      border: "1px solid rgba(0,0,0,0.1)",
                      marginBottom: "4px",
                    }}
                  />
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#334155", display: "block" }}>Hover State</span>
                  <code style={{ fontSize: "10px", color: "#64748b" }}>{data?.themeConfig?.primaryHoverColor || "#065f46"}</code>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      height: "26px",
                      borderRadius: "6px",
                      background: data?.themeConfig?.backgroundColor || "#fafbf9",
                      border: "1px solid rgba(0,0,0,0.15)",
                      marginBottom: "4px",
                    }}
                  />
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#334155", display: "block" }}>Background</span>
                  <code style={{ fontSize: "10px", color: "#64748b" }}>{data?.themeConfig?.backgroundColor || "#fafbf9"}</code>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      height: "26px",
                      borderRadius: "6px",
                      background: data?.themeConfig?.textColor || "#111827",
                      border: "1px solid rgba(0,0,0,0.1)",
                      marginBottom: "4px",
                    }}
                  />
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#334155", display: "block" }}>Text Color</span>
                  <code style={{ fontSize: "10px", color: "#64748b" }}>{data?.themeConfig?.textColor || "#111827"}</code>
                </div>

                <div style={{ textAlign: "center" }}>
                  <div
                    style={{
                      height: "26px",
                      borderRadius: "6px",
                      background: data?.themeConfig?.sidebarBg || "#101922",
                      border: "1px solid rgba(0,0,0,0.1)",
                      marginBottom: "4px",
                    }}
                  />
                  <span style={{ fontSize: "10.5px", fontWeight: 700, color: "#334155", display: "block" }}>Sidebar</span>
                  <code style={{ fontSize: "10px", color: "#64748b" }}>{data?.themeConfig?.sidebarBg || "#101922"}</code>
                </div>
              </div>

              <div style={{ marginTop: "12px", display: "flex", justifyContent: "flex-end" }}>
                <button
                  type="button"
                  className="cc-comp-btn ghost small"
                  onClick={() => setThemeModalOpen(true)}
                  style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}
                >
                  <Palette size={13} /> Change Palette &amp; Hex Codes <ChevronRight size={13} />
                </button>
              </div>
            </div>
          </div>

          {/* Company Info Card */}
          <div className="cc-section-card">
            <div className="cc-card-header">
              <div>
                <span className="cc-card-subtitle">Organization</span>
                <h2>Company Profile</h2>
              </div>
              <button
                type="button"
                className="cc-comp-btn ghost small"
                onClick={() => setEditModalOpen(true)}
              >
                <Edit3 size={13} /> Edit Info
              </button>
            </div>

            <div className="cc-info-table">
              <div className="cc-info-row">
                <span className="cc-info-label">Company Legal Name</span>
                <span className="cc-info-val">
                  <strong>{data?.name}</strong>
                </span>
              </div>
              <div className="cc-info-row">
                <span className="cc-info-label">Organization Code</span>
                <span className="cc-info-val">
                  <code>{data?.slug || "N/A"}</code>
                </span>
              </div>
              <div className="cc-info-row">
                <span className="cc-info-label">GST Number (GSTIN)</span>
                <span className="cc-info-val">
                  {data?.gstNumber || data?.gst_number ? (
                    <strong style={{ color: "#047857" }}>{data.gstNumber || data.gst_number}</strong>
                  ) : (
                    <span style={{ color: "#b45309", fontSize: 12 }}>⚠️ Not Set (Configure in Settings)</span>
                  )}
                </span>
              </div>
              <div className="cc-info-row">
                <span className="cc-info-label">Company PAN</span>
                <span className="cc-info-val">
                  <strong>{data?.panNumber || data?.pan_number || (data?.gstNumber ? data.gstNumber.substring(2, 12) : "Not specified")}</strong>
                </span>
              </div>
              <div className="cc-info-row">
                <span className="cc-info-label">Registered Office Address</span>
                <span className="cc-info-val">
                  {[data?.address, data?.city, data?.state ? `${data.state}${data?.pincode ? ` - ${data.pincode}` : ""}` : ""].filter(Boolean).join(", ") || (data?.address || "Not specified")}
                </span>
              </div>
              <div className="cc-info-row">
                <span className="cc-info-label">Official Email</span>
                <span className="cc-info-val">{data?.email || "Not specified"}</span>
              </div>
              <div className="cc-info-row">
                <span className="cc-info-label">Contact Phone</span>
                <span className="cc-info-val">{data?.phone || "Not specified"}</span>
              </div>
              <div className="cc-info-row">
                <span className="cc-info-label">Account Status</span>
                <span className="cc-info-val">
                  <span
                    className="cc-status-pill inline"
                    style={{
                      background: statusColor.bg,
                      color: statusColor.text,
                      borderColor: statusColor.border,
                    }}
                  >
                    <i style={{ background: statusColor.text }} />
                    {statusColor.label}
                  </span>
                </span>
              </div>
              <div className="cc-info-row">
                <span className="cc-info-label">Account Created</span>
                <span className="cc-info-val">
                  {moment(data?.createdAt).format("DD MMMM YYYY")}
                </span>
              </div>
            </div>
          </div>

          {/* Branches Directory Card */}
          <div className="cc-section-card">
            <div className="cc-card-header">
              <div>
                <span className="cc-card-subtitle">Locations</span>
                <h2>Company Branches ({branches.length})</h2>
              </div>
              <Link to="/branches" className="cc-comp-btn ghost small">
                Manage Branches <ChevronRight size={13} />
              </Link>
            </div>

            {branches.length === 0 ? (
              <div className="cc-empty-state">
                <MapPin size={24} />
                <p>No branches registered yet.</p>
                <Link to="/branches" className="cc-comp-btn primary small">
                  Add Branch
                </Link>
              </div>
            ) : (
              <div className="cc-branch-list">
                {branches.map((b, idx) => (
                  <div key={b.id || idx} className="cc-branch-card">
                    <div className="cc-branch-badge">
                      <Building2 size={16} />
                    </div>
                    <div className="cc-branch-details">
                      <h4>{b.name}</h4>
                      <p>
                        <MapPin size={12} /> {b.city || "Head Office"}{" "}
                        {b.state ? `• ${b.state}` : ""}
                      </p>
                    </div>
                    {idx === 0 && <span className="cc-hq-pill">Head Office</span>}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Quick Shortcuts Card */}
          <div className="cc-section-card">
            <div className="cc-card-header">
              <div>
                <span className="cc-card-subtitle">Quick Navigation</span>
                <h2>Admin Hub</h2>
              </div>
            </div>
            <div className="cc-shortcuts-grid">
              <Link to="/add-users" className="cc-shortcut-item">
                <UserPlus size={18} />
                <div>
                  <strong>Team Members</strong>
                  <span>Manage employees and seats</span>
                </div>
              </Link>
              <Link to="/branches" className="cc-shortcut-item">
                <MapPin size={18} />
                <div>
                  <strong>Branches</strong>
                  <span>Offices & geo-locations</span>
                </div>
              </Link>
              <Link to="/settings" className="cc-shortcut-item">
                <Clock size={18} />
                <div>
                  <strong>Attendance Settings</strong>
                  <span>Shift hours & geofencing</span>
                </div>
              </Link>
              <Link to="/leads" className="cc-shortcut-item">
                <Layers size={18} />
                <div>
                  <strong>CRM Leads</strong>
                  <span>Pipeline & customer files</span>
                </div>
              </Link>
            </div>
          </div>
        </div>
      </div>

      {/* Edit Profile Modal */}
      {editModalOpen && (
        <div className="cc-modal-backdrop" onClick={() => !saving && setEditModalOpen(false)}>
          <div className="cc-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <div>
                <p>Update</p>
                <h3>Edit Company Details</h3>
              </div>
              <button
                type="button"
                className="cc-close-btn"
                onClick={() => setEditModalOpen(false)}
                disabled={saving}
              >
                <X size={16} />
              </button>
            </div>

            <form onSubmit={handleUpdateProfile} className="cc-modal-form">
              <label className="cc-modal-label">
                <span>Company Name *</span>
                <input
                  type="text"
                  required
                  value={editForm.name}
                  onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                  placeholder="e.g. Acme Financial Services"
                />
              </label>

              <label className="cc-modal-label">
                <span>Official Email</span>
                <input
                  type="email"
                  value={editForm.email}
                  onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                  placeholder="contact@company.com"
                />
              </label>

              <label className="cc-modal-label">
                <span>Contact Phone</span>
                <input
                  type="tel"
                  value={editForm.phone}
                  onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                  placeholder="10-digit phone number"
                />
              </label>

              <label className="cc-modal-label">
                <span>GST Number (GSTIN)</span>
                <input
                  type="text"
                  maxLength={15}
                  value={editForm.gstNumber || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, gstNumber: e.target.value.toUpperCase().trim() }))}
                  placeholder="e.g. 08AABCT1234F1Z5"
                />
              </label>

              <label className="cc-modal-label">
                <span>PAN Number</span>
                <input
                  type="text"
                  maxLength={10}
                  value={editForm.panNumber || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, panNumber: e.target.value.toUpperCase().trim() }))}
                  placeholder="e.g. AABCT1234F"
                />
              </label>

              <label className="cc-modal-label">
                <span>Registered Office Address</span>
                <textarea
                  rows={2}
                  value={editForm.address || ""}
                  onChange={(e) => setEditForm((p) => ({ ...p, address: e.target.value }))}
                  placeholder="Building, Street, Landmark"
                />
              </label>

              <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                <label className="cc-modal-label">
                  <span>City</span>
                  <input
                    type="text"
                    value={editForm.city || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, city: e.target.value }))}
                    placeholder="City"
                  />
                </label>
                <label className="cc-modal-label">
                  <span>State</span>
                  <input
                    type="text"
                    value={editForm.state || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, state: e.target.value }))}
                    placeholder="State"
                  />
                </label>
                <label className="cc-modal-label">
                  <span>PIN Code</span>
                  <input
                    type="text"
                    value={editForm.pincode || ""}
                    onChange={(e) => setEditForm((p) => ({ ...p, pincode: e.target.value }))}
                    placeholder="PIN Code"
                  />
                </label>
              </div>

              <p className="cc-modal-note">
                Note: Subscription tier, renewal date, and allowed employee seat limits are managed by
                the platform administration.
              </p>

              <div className="cc-modal-footer">
                <button
                  type="button"
                  className="cc-comp-btn ghost"
                  onClick={() => setEditModalOpen(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-comp-btn primary" disabled={saving}>
                  {saving ? "Saving…" : "Save Changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Theme & Palette Customizer Modal */}
      <ThemeCustomizerModal
        isOpen={themeModalOpen}
        onClose={() => setThemeModalOpen(false)}
        initialTheme={data?.themeConfig}
        onThemeSaved={(savedTheme) => {
          setData((prev) => (prev ? { ...prev, themeConfig: savedTheme } : prev));
        }}
      />
    </div>
  );
}

const styles = `
  .cc-company-page {
    padding: 24px;
    max-width: 1400px;
    margin: 0 auto;
    font-family: inherit;
  }

  .cc-company-loading {
    display: flex;
    flex-direction: column;
    align-items: center;
    justify-content: center;
    min-height: 400px;
    gap: 16px;
    color: #475569;
  }

  .cc-spin {
    animation: spin 1s linear infinite;
    color: #047857;
  }

  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  .cc-company-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 16px;
    margin-bottom: 24px;
  }

  .cc-badge-row {
    display: flex;
    align-items: center;
    gap: 8px;
    margin-bottom: 8px;
  }

  .cc-badge-chip {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11.5px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #047857;
    background: #eef7f2;
    padding: 4px 10px;
    border-radius: 999px;
  }

  .cc-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 600;
    padding: 3px 10px;
    border-radius: 999px;
    border: 1px solid transparent;
  }

  .cc-status-pill i {
    width: 6px;
    height: 6px;
    border-radius: 50%;
  }

  .cc-status-pill.expired {
    background: #fef2f2;
    color: #b91c1c;
    border-color: #fecaca;
  }

  .cc-status-pill.inline {
    font-size: 11px;
    padding: 2px 8px;
  }

  .cc-company-header h1 {
    font-size: 26px;
    font-weight: 800;
    color: #0f172a;
    margin: 0 0 6px 0;
  }

  .cc-company-sub {
    font-size: 13.5px;
    color: #64748b;
    margin: 0;
  }

  .cc-header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
  }

  .cc-comp-btn {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    padding: 9px 16px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
    text-decoration: none;
    font-family: inherit;
  }

  .cc-comp-btn.primary {
    background: var(--cc-primary, #047857);
    color: #ffffff;
    box-shadow: 0 2px 6px var(--cc-primary-glow, rgba(4, 120, 87, 0.2));
  }

  .cc-comp-btn.primary:hover:not(:disabled) {
    background: var(--cc-primary-hover, #065f46);
  }

  .cc-comp-btn.ghost {
    background: #ffffff;
    color: #334155;
    border-color: #cbd5e1;
  }

  .cc-comp-btn.ghost:hover:not(:disabled) {
    background: #f8fafc;
    border-color: #94a3b8;
  }

  .cc-comp-btn.small {
    padding: 5px 10px;
    font-size: 12px;
    border-radius: 7px;
  }

  .cc-comp-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }

  /* Hero Card */
  .cc-comp-hero-card {
    background: linear-gradient(135deg, #111c24 0%, #1e293b 100%);
    border-radius: 18px;
    padding: 24px;
    color: #ffffff;
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 20px;
    margin-bottom: 24px;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.12);
  }

  .cc-hero-left {
    display: flex;
    align-items: center;
    gap: 18px;
  }

  .cc-comp-avatar {
    width: 64px;
    height: 64px;
    border-radius: 16px;
    background: linear-gradient(135deg, #047857 0%, #10b981 100%);
    color: #ffffff;
    display: grid;
    place-items: center;
    font-size: 22px;
    font-weight: 800;
    box-shadow: 0 4px 14px rgba(4, 120, 87, 0.35);
  }

  .cc-hero-title-row {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    margin-bottom: 6px;
  }

  .cc-hero-title-row h2 {
    font-size: 22px;
    font-weight: 700;
    margin: 0;
    color: #ffffff;
  }

  .cc-slug-pill {
    font-size: 12px;
    font-family: ui-monospace, monospace;
    background: rgba(255, 255, 255, 0.12);
    padding: 2px 8px;
    border-radius: 6px;
    color: #93c5fd;
  }

  .cc-hero-meta {
    display: flex;
    align-items: center;
    gap: 16px;
    flex-wrap: wrap;
    font-size: 13px;
    color: #94a3b8;
  }

  .cc-meta-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
  }

  .cc-hero-plan-box {
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.14);
    padding: 14px 20px;
    border-radius: 14px;
    text-align: right;
  }

  .cc-plan-kicker {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #fbbf24;
  }

  .cc-hero-plan-box h3 {
    margin: 4px 0 2px 0;
    font-size: 18px;
    font-weight: 700;
    color: #ffffff;
  }

  .cc-plan-price {
    margin: 0;
    font-size: 12.5px;
    color: #cbd5e1;
  }

  /* KPIs Grid */
  .cc-comp-kpis {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(240px, 1fr));
    gap: 16px;
    margin-bottom: 24px;
  }

  .cc-kpi-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }

  .cc-kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .cc-kpi-icon.gold { background: #fef3c7; color: #b45309; }
  .cc-kpi-icon.green { background: #eef7f2; color: #047857; }
  .cc-kpi-icon.blue { background: #e0f2fe; color: #0369a1; }
  .cc-kpi-icon.purple { background: #f3e8ff; color: #7e22ce; }

  .cc-kpi-body {
    display: flex;
    flex-direction: column;
    gap: 3px;
    flex: 1;
    min-width: 0;
  }

  .cc-kpi-label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cc-kpi-value {
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
  }

  .cc-kpi-sub {
    font-size: 12px;
    color: #64748b;
  }

  .cc-kpi-sub.warn { color: #d97706; font-weight: 600; }
  .cc-kpi-sub.danger { color: #dc2626; font-weight: 600; }

  .cc-kpi-progress {
    width: 100%;
    height: 5px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
    margin: 4px 0 2px 0;
  }

  .cc-kpi-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  /* Main Grid */
  .cc-comp-grid {
    display: grid;
    grid-template-columns: 1.15fr 0.85fr;
    gap: 24px;
  }

  @media (max-width: 1024px) {
    .cc-comp-grid {
      grid-template-columns: 1fr;
    }
  }

  .cc-comp-col {
    display: flex;
    flex-direction: column;
    gap: 24px;
  }

  .cc-section-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 22px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }

  .cc-card-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18px;
  }

  .cc-card-subtitle {
    display: block;
    font-size: 11.5px;
    font-weight: 700;
    color: #047857;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    margin-bottom: 2px;
  }

  .cc-card-header h2 {
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
    margin: 0;
  }

  .cc-tier-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    font-weight: 700;
    background: #fef3c7;
    color: #92400e;
    padding: 4px 10px;
    border-radius: 8px;
  }

  .cc-plan-detail-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-bottom: 18px;
  }

  .cc-plan-detail-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    font-size: 13px;
    color: #64748b;
  }

  .cc-plan-detail-row strong {
    color: #0f172a;
    font-weight: 600;
  }

  .cc-usage-breakdown {
    margin-bottom: 20px;
  }

  .cc-usage-head {
    display: flex;
    justify-content: space-between;
    font-size: 13px;
    color: #475569;
    margin-bottom: 6px;
  }

  .cc-usage-head strong {
    color: #0f172a;
    font-weight: 700;
  }

  .cc-main-meter {
    width: 100%;
    height: 10px;
    background: #e2e8f0;
    border-radius: 999px;
    overflow: hidden;
    margin-bottom: 12px;
  }

  .cc-main-bar {
    height: 100%;
    border-radius: 999px;
    transition: width 0.3s ease;
  }

  .cc-alert-box {
    display: flex;
    align-items: flex-start;
    gap: 10px;
    padding: 12px 14px;
    border-radius: 10px;
    font-size: 12.5px;
    line-height: 1.45;
    margin-bottom: 14px;
  }

  .cc-alert-box.danger {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
  }

  .cc-role-counts h4 {
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    margin: 0 0 8px 0;
  }

  .cc-role-tags {
    display: flex;
    flex-wrap: wrap;
    gap: 8px;
  }

  .cc-role-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    font-size: 12px;
    padding: 4px 10px;
    border-radius: 8px;
    font-weight: 500;
  }

  .cc-role-tag.sales { background: #eef7f2; color: #047857; }
  .cc-role-tag.manager { background: #eef2ff; color: #4338ca; }
  .cc-role-tag.ops { background: #fff7ed; color: #c2410c; }
  .cc-role-tag.banker { background: #f0fdf4; color: #15803d; }
  .cc-role-tag.admin { background: #f1f5f9; color: #334155; }

  .cc-modules-list h4 {
    font-size: 13px;
    font-weight: 700;
    color: #334155;
    margin: 0 0 10px 0;
  }

  .cc-modules-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 10px;
    margin-bottom: 20px;
  }

  .cc-module-item {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }

  .cc-module-icon {
    color: #047857;
    display: grid;
    place-items: center;
  }

  .cc-module-label {
    font-size: 12.5px;
    font-weight: 600;
    color: #1e293b;
    flex: 1;
  }

  .cc-check-icon {
    color: #10b981;
    flex-shrink: 0;
  }

  /* Support Upgrade Box */
  .cc-upgrade-support-box {
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border: 1px solid #bbf7d0;
    border-radius: 14px;
    padding: 16px;
    display: flex;
    align-items: flex-start;
    gap: 14px;
  }

  .cc-upgrade-icon {
    width: 40px;
    height: 40px;
    border-radius: 10px;
    background: #047857;
    color: #ffffff;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .cc-upgrade-support-box h4 {
    margin: 0 0 4px 0;
    font-size: 14px;
    font-weight: 700;
    color: #065f46;
  }

  .cc-upgrade-support-box p {
    margin: 0 0 8px 0;
    font-size: 12.5px;
    color: #166534;
    line-height: 1.4;
  }

  .cc-support-contact {
    display: flex;
    align-items: center;
    gap: 14px;
    font-size: 12px;
    font-weight: 600;
    color: #047857;
  }

  .cc-support-contact span {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }

  /* Info Table */
  .cc-info-table {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }

  .cc-info-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding-bottom: 10px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 13px;
  }

  .cc-info-row:last-child {
    border-bottom: 0;
    padding-bottom: 0;
  }

  .cc-info-label {
    color: #64748b;
    font-weight: 500;
  }

  .cc-info-val {
    color: #0f172a;
    text-align: right;
  }

  .cc-info-val code {
    font-family: ui-monospace, monospace;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 6px;
    font-size: 12px;
  }

  /* Branch List */
  .cc-branch-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }

  .cc-branch-card {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 10px 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }

  .cc-branch-badge {
    width: 34px;
    height: 34px;
    border-radius: 8px;
    background: #eef2ff;
    color: #4338ca;
    display: grid;
    place-items: center;
  }

  .cc-branch-details {
    flex: 1;
    min-width: 0;
  }

  .cc-branch-details h4 {
    margin: 0;
    font-size: 13.5px;
    font-weight: 600;
    color: #0f172a;
  }

  .cc-branch-details p {
    margin: 2px 0 0 0;
    font-size: 12px;
    color: #64748b;
    display: flex;
    align-items: center;
    gap: 4px;
  }

  .cc-hq-pill {
    font-size: 11px;
    font-weight: 700;
    background: #e0f2fe;
    color: #0284c7;
    padding: 2px 8px;
    border-radius: 6px;
  }

  .cc-empty-state {
    text-align: center;
    padding: 24px;
    color: #94a3b8;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 8px;
  }

  /* Shortcuts Grid */
  .cc-shortcuts-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
  }

  .cc-shortcut-item {
    display: flex;
    align-items: center;
    gap: 12px;
    padding: 12px 14px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    text-decoration: none;
    color: #047857;
    transition: all 0.15s ease;
  }

  .cc-shortcut-item:hover {
    background: #f0fdf4;
    border-color: #a7f3d0;
  }

  .cc-shortcut-item div {
    display: flex;
    flex-direction: column;
  }

  .cc-shortcut-item strong {
    font-size: 13px;
    color: #0f172a;
  }

  .cc-shortcut-item span {
    font-size: 11.5px;
    color: #64748b;
  }

  /* Modal */
  .cc-modal-backdrop {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    z-index: 100;
    display: grid;
    place-items: center;
    padding: 16px;
  }

  .cc-modal-dialog {
    background: #ffffff;
    width: 100%;
    max-width: 480px;
    border-radius: 18px;
    padding: 24px;
    box-shadow: 0 20px 60px rgba(15, 23, 42, 0.28);
  }

  .cc-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    margin-bottom: 18px;
  }

  .cc-modal-header p {
    margin: 0;
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    color: #047857;
  }

  .cc-modal-header h3 {
    margin: 2px 0 0 0;
    font-size: 19px;
    font-weight: 700;
    color: #0f172a;
  }

  .cc-close-btn {
    border: 0;
    background: #f1f5f9;
    color: #64748b;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    cursor: pointer;
    display: grid;
    place-items: center;
  }

  .cc-modal-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .cc-modal-label {
    display: flex;
    flex-direction: column;
    gap: 5px;
    font-size: 12.5px;
    font-weight: 600;
    color: #334155;
  }

  .cc-modal-label input {
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 13.5px;
    color: #0f172a;
    font-family: inherit;
  }

  .cc-modal-label input:focus {
    border-color: #047857;
    box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.15);
    outline: none;
  }

  .cc-modal-note {
    font-size: 11.5px;
    color: #64748b;
    margin: 2px 0;
    line-height: 1.4;
  }

  .cc-modal-footer {
    display: flex;
    justify-content: flex-end;
    gap: 8px;
    margin-top: 8px;
  }
`;
