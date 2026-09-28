import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import axios from "axios";
import * as XLSX from "xlsx";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  ArrowLeft,
  Building2,
  Calendar,
  CheckCircle2,
  Coins,
  Download,
  Eye,
  FileSpreadsheet,
  Filter,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Share2,
  ShieldCheck,
  Trash2,
  TrendingUp,
  User,
  X,
} from "lucide-react";
import API_URL from "../../config";

const COLOR_PRESETS = [
  "#10b981", // Emerald (Default for Self)
  "#3b82f6", // Blue
  "#8b5cf6", // Purple
  "#f59e0b", // Amber
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b", // Slate
];

const PAST_MONTHS = (() => {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 18; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const value = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    const label = d.toLocaleDateString("en-IN", { month: "short", year: "numeric" });
    months.push({ value, label });
  }
  return months;
})();

const emptyForm = () => ({
  label: "",
  value: "",
  colorCode: "#3b82f6",
  commissionPercent: "",
  orderIndex: 10,
  isActive: true,
});

export default function LeadSourcesRedesign() {
  const navigate = useNavigate();
  const userRole = localStorage.getItem("userRole") || "";
  const employeeRole = localStorage.getItem("employeeRole") || "";
  const isAdmin =
    userRole.toUpperCase() === "COMPANY_ADMIN" ||
    userRole.toUpperCase() === "SUPERADMIN" ||
    ["admin", "superadmin"].includes(employeeRole?.toLowerCase());

  const [sources, setSources] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  // Party Leads View State
  const [selectedParty, setSelectedParty] = useState(null);
  const [partyLeads, setPartyLeads] = useState([]);
  const [partyLeadsLoading, setPartyLeadsLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [debouncedLeadSearch, setDebouncedLeadSearch] = useState("");
  const [monthFilter, setMonthFilter] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [statusFilterParty, setStatusFilterParty] = useState("all");

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedLeadSearch(leadSearch), 300);
    return () => clearTimeout(debounce);
  }, [leadSearch]);

  const fetchPartyLeads = async () => {
    if (!selectedParty) return;
    setPartyLeadsLoading(true);
    try {
      const partyName = selectedParty.label || selectedParty.value;
      const params = {
        source: partyName,
        limit: 300,
      };
      if (debouncedLeadSearch.trim()) params.search = debouncedLeadSearch.trim();
      if (monthFilter) params.month = monthFilter;
      if (fromDate) params.fromDate = fromDate;
      if (toDate) params.toDate = toDate;
      if (statusFilterParty && statusFilterParty !== "all") params.status = statusFilterParty;

      const res = await axios.get(`${API_URL}/leads`, { params });
      setPartyLeads(res.data?.data || res.data?.rows || []);
    } catch (err) {
      console.error("Error loading party leads", err);
      toast.error("Could not load leads for " + (selectedParty.label || "Party"));
      setPartyLeads([]);
    } finally {
      setPartyLeadsLoading(false);
    }
  };

  useEffect(() => {
    if (selectedParty) {
      fetchPartyLeads();
    }
  }, [selectedParty, debouncedLeadSearch, monthFilter, fromDate, toDate, statusFilterParty]);

  const handleExportPartyLeads = () => {
    if (!partyLeads.length) {
      toast.info("No leads to export");
      return;
    }
    const data = partyLeads.map((l, idx) => {
      const commPct =
        l.commission_percent !== null && l.commission_percent !== undefined
          ? Number(l.commission_percent)
          : selectedParty?.commissionPercent
          ? Number(selectedParty.commissionPercent)
          : 0;
      return {
        "S.No": idx + 1,
        "Lead ID": l.lead_id || l.id,
        "Customer Name": l.name || "--",
        "Phone": l.number || "--",
        "Email": l.email || "--",
        "City": l.city || "--",
        "Lead Date": l.createdAt ? new Date(l.createdAt).toLocaleDateString("en-IN") : "--",
        "Bank / Lender": l.bank_name || "--",
        "Loan Product": l.loan_type || "--",
        "Sanctioned Amount (₹)": l.sanctioned_amount ? Number(l.sanctioned_amount) : "--",
        "Applied / Budget Amount (₹)":
          l.applied_amount || l.est_budget ? Number(l.applied_amount || l.est_budget) : "--",
        "Sanction Date": l.sanction_date ? new Date(l.sanction_date).toLocaleDateString("en-IN") : "--",
        ...(isAdmin ? { "Party Commission (%)": `${commPct}%` } : {}),
        "Status": l.status || "--",
        "Assigned To": l.owner || "Unassigned",
      };
    });
    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Party Leads");
    const safeName = (selectedParty?.label || "Party").replace(/[^a-zA-Z0-9]/g, "_");
    XLSX.writeFile(wb, `Leads_${safeName}_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Excel exported successfully!");
  };

  const fetchSources = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/master-configs/LEAD_SOURCE`, {
        params: { includeInactive: true },
      });
      setSources(res.data?.data || []);
    } catch (error) {
      console.error("Error fetching lead sources", error);
      toast.error(error.response?.data?.message || "Could not load lead sources");
      setSources([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchSources();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const openCreate = () => {
    setEditing(null);
    const nextOrder =
      sources.length > 0
        ? Math.max(...sources.map((s) => s.orderIndex || 0)) + 10
        : 10;
    setForm({
      ...emptyForm(),
      orderIndex: nextOrder,
    });
    setModalOpen(true);
  };

  const openEdit = (source) => {
    setEditing(source);
    setForm({
      label: source.label || "",
      value: source.value || "",
      colorCode: source.colorCode || "#3b82f6",
      commissionPercent:
        source.commissionPercent !== null && source.commissionPercent !== undefined
          ? source.commissionPercent
          : "",
      orderIndex: source.orderIndex ?? 10,
      isActive: source.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!form.label.trim()) {
      toast.error("Source / Party name is required");
      return;
    }

    setSubmitting(true);
    try {
      const commVal =
        form.commissionPercent !== "" && !isNaN(parseFloat(form.commissionPercent))
          ? parseFloat(form.commissionPercent)
          : null;
      if (editing) {
        await axios.put(`${API_URL}/master-configs/${editing.id}`, {
          label: form.label.trim(),
          colorCode: form.colorCode,
          commissionPercent: commVal,
          orderIndex: Number(form.orderIndex) || 0,
          isActive: form.isActive,
        });
        toast.success("Source / Party updated successfully");
      } else {
        await axios.post(`${API_URL}/master-configs/LEAD_SOURCE`, {
          label: form.label.trim(),
          value: form.value.trim() ? form.value.trim() : undefined,
          colorCode: form.colorCode,
          commissionPercent: commVal,
          orderIndex: Number(form.orderIndex) || 0,
          isActive: form.isActive,
        });
        toast.success("New Source / Party added successfully");
      }
      setModalOpen(false);
      setForm(emptyForm());
      setEditing(null);
      fetchSources();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not save source");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (source) => {
    try {
      await axios.put(`${API_URL}/master-configs/${source.id}`, {
        isActive: !source.isActive,
      });
      setSources((prev) =>
        prev.map((item) =>
          item.id === source.id ? { ...item, isActive: !item.isActive } : item
        )
      );
      toast.success(
        `Source "${source.label}" ${!source.isActive ? "activated" : "deactivated"}`
      );
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not update status");
    }
  };

  const handleDelete = async (hard = true) => {
    if (!deleteTarget) return;
    if (deleteTarget.value?.toLowerCase() === "self") {
      toast.error("Default 'Self' source cannot be deleted as it is required by the system.");
      setDeleteTarget(null);
      return;
    }
    setDeleting(true);
    try {
      await axios.delete(
        `${API_URL}/master-configs/${deleteTarget.id}${hard ? "?hard=true" : ""}`
      );
      toast.success(hard ? "Source deleted" : "Source deactivated");
      setDeleteTarget(null);
      fetchSources();
    } catch (error) {
      console.error(error);
      const errMsg = error.response?.data?.message;
      if (errMsg && errMsg.includes("In use")) {
        toast.warning(errMsg);
      } else {
        toast.error(errMsg || "Could not delete source");
      }
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    return sources.filter((s) => {
      if (statusFilter === "active" && !s.isActive) return false;
      if (statusFilter === "inactive" && s.isActive) return false;
      if (!debouncedSearchTerm.trim()) return true;
      const query = debouncedSearchTerm.toLowerCase();
      return (
        String(s.label || "").toLowerCase().includes(query) ||
        String(s.value || "").toLowerCase().includes(query)
      );
    });
  }, [sources, debouncedSearchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = sources.length;
    const active = sources.filter((s) => s.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [sources]);

  return (
    <div className="cc-report-redesign cc-sources">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      {selectedParty ? (
        <div className="cc-party-leads-view">
          {/* Top Breadcrumb & Actions */}
          <div className="cc-party-leads-header">
            <div className="cc-party-header-left">
              <button
                type="button"
                className="cc-party-back-btn"
                onClick={() => setSelectedParty(null)}
                title="Back to all sources"
              >
                <ArrowLeft size={16} />
                <span>All Sources</span>
              </button>
              <div className="cc-party-title-group">
                <div className="cc-party-title-row">
                  <span
                    className="cc-party-dot"
                    style={{ backgroundColor: selectedParty.colorCode || "#3b82f6" }}
                  />
                  <h2>{selectedParty.label}</h2>
                  <span className="cc-party-code-badge">{selectedParty.value}</span>
                  {isAdmin && selectedParty.commissionPercent !== null && selectedParty.commissionPercent !== undefined && (
                    <span className="cc-party-comm-badge">
                      {selectedParty.commissionPercent}% Default Comm.
                    </span>
                  )}
                </div>
                <p className="cc-party-subtitle">
                  Showing all leads sourced from <strong>{selectedParty.label}</strong> with bank, sanction details and party commission.
                </p>
              </div>
            </div>

            <div className="cc-party-header-right">
              <button
                type="button"
                className="cc-party-action-btn ghost"
                onClick={fetchPartyLeads}
                disabled={partyLeadsLoading}
                title="Refresh leads list"
              >
                <RefreshCw size={14} className={partyLeadsLoading ? "spin" : ""} />
                <span>Refresh</span>
              </button>
              <button
                type="button"
                className="cc-party-action-btn excel"
                onClick={handleExportPartyLeads}
                disabled={!partyLeads.length}
                title="Export this party's leads to Excel"
              >
                <FileSpreadsheet size={15} />
                <span>Export Excel</span>
              </button>
            </div>
          </div>

          {/* Metric Stats Cards */}
          <div className="cc-party-stats-grid">
            <div className="cc-party-stat-card">
              <div className="icon blue"><Layers size={20} /></div>
              <div className="info">
                <span className="label">Total Leads</span>
                <span className="val">{partyLeads.length}</span>
              </div>
            </div>

            <div className="cc-party-stat-card">
              <div className="icon emerald"><Coins size={20} /></div>
              <div className="info">
                <span className="label">Total Sanctioned / Loan Amount</span>
                <span className="val">
                  ₹{Number(
                    partyLeads.reduce(
                      (acc, l) => acc + Number(l.sanctioned_amount || l.applied_amount || l.est_budget || 0),
                      0
                    )
                  ).toLocaleString("en-IN")}
                </span>
              </div>
            </div>

            {isAdmin && (
              <div className="cc-party-stat-card">
                <div className="icon purple"><TrendingUp size={20} /></div>
                <div className="info">
                  <span className="label">Party Commission Rate</span>
                  <span className="val">
                    {selectedParty.commissionPercent !== null && selectedParty.commissionPercent !== undefined
                      ? `${selectedParty.commissionPercent}%`
                      : partyLeads.some((l) => l.commission_percent !== null)
                      ? `${(
                          partyLeads.reduce((acc, l) => acc + (Number(l.commission_percent) || 0), 0) /
                          (partyLeads.filter((l) => l.commission_percent !== null).length || 1)
                        ).toFixed(1)}%`
                      : "0%"}
                  </span>
                </div>
              </div>
            )}

            <div className="cc-party-stat-card">
              <div className="icon amber"><Building2 size={20} /></div>
              <div className="info">
                <span className="label">Sanctioned Cases</span>
                <span className="val">
                  {partyLeads.filter(l => l.sanctioned_amount || String(l.status_value || l.status).toUpperCase().includes("SANCTION") || String(l.status_value || l.status).toUpperCase().includes("DISBURS")).length}
                </span>
              </div>
            </div>
          </div>

          {/* Top Filter Bar */}
          <div className="cc-party-filter-bar">
            {/* Search */}
            <div className="cc-party-search-box">
              <Search size={15} />
              <input
                type="text"
                placeholder="Search lead by name, phone, city..."
                value={leadSearch}
                onChange={(e) => setLeadSearch(e.target.value)}
              />
              {leadSearch && (
                <button type="button" onClick={() => setLeadSearch("")} title="Clear search">
                  <X size={13} />
                </button>
              )}
            </div>

            {/* Month Filter */}
            <div className="cc-party-filter-group">
              <span className="group-label"><Calendar size={13} /> Month:</span>
              <select
                value={monthFilter}
                onChange={(e) => {
                  setMonthFilter(e.target.value);
                  if (e.target.value) {
                    setFromDate("");
                    setToDate("");
                  }
                }}
              >
                <option value="">All Months</option>
                {PAST_MONTHS.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>
            </div>

            {/* From Date */}
            <div className="cc-party-filter-group">
              <span className="group-label">From:</span>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => {
                  setFromDate(e.target.value);
                  if (e.target.value) setMonthFilter("");
                }}
              />
            </div>

            {/* To Date */}
            <div className="cc-party-filter-group">
              <span className="group-label">To:</span>
              <input
                type="date"
                value={toDate}
                onChange={(e) => {
                  setToDate(e.target.value);
                  if (e.target.value) setMonthFilter("");
                }}
              />
            </div>

            {/* Status Filter */}
            <div className="cc-party-filter-group">
              <span className="group-label"><Filter size={13} /> Status:</span>
              <select
                value={statusFilterParty}
                onChange={(e) => setStatusFilterParty(e.target.value)}
              >
                <option value="all">All Statuses</option>
                <option value="NEW">New</option>
                <option value="IN_PROGRESS">In Progress</option>
                <option value="DOCS_COLLECTED">Docs Collected</option>
                <option value="SANCTIONED">Sanctioned</option>
                <option value="DISBURSED">Disbursed</option>
                <option value="REJECTED">Rejected</option>
              </select>
            </div>

            {/* Reset Filters */}
            {(leadSearch || monthFilter || fromDate || toDate || statusFilterParty !== "all") && (
              <button
                type="button"
                className="cc-party-clear-btn"
                onClick={() => {
                  setLeadSearch("");
                  setMonthFilter("");
                  setFromDate("");
                  setToDate("");
                  setStatusFilterParty("all");
                }}
              >
                <X size={13} /> Reset Filters
              </button>
            )}
          </div>

          {/* Table */}
          <div className="cc-party-table-panel">
            <div className="cc-party-table-scroll">
              <table className="cc-party-table">
                <thead>
                  <tr>
                    <th>Lead ID</th>
                    <th>Customer Name</th>
                    <th>Lead Date</th>
                    <th>Bank / Lender</th>
                    <th>Sanction / Loan Amount</th>
                    <th>Sanction Date</th>
                    {isAdmin && <th>Party Commission</th>}
                    <th>Status</th>
                    <th>Assigned To</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {partyLeadsLoading ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="cc-party-loading-cell">
                        <RefreshCw size={22} className="spin" />
                        <span>Loading party leads...</span>
                      </td>
                    </tr>
                  ) : partyLeads.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 10 : 9} className="cc-party-empty-cell">
                        <Share2 size={32} />
                        <h4>No leads found for this party</h4>
                        <p>No leads match the selected filter criteria or this party has no leads assigned yet.</p>
                      </td>
                    </tr>
                  ) : (
                    partyLeads.map((lead) => {
                      const commPct =
                        lead.commission_percent !== null && lead.commission_percent !== undefined
                          ? Number(lead.commission_percent)
                          : selectedParty.commissionPercent !== null && selectedParty.commissionPercent !== undefined
                          ? Number(selectedParty.commissionPercent)
                          : null;
                      return (
                        <tr key={lead.lead_id || lead.id}>
                          <td
                            className="cc-party-id-cell"
                            onClick={() => navigate(`/lead-details/${lead.lead_id || lead.id}`)}
                            title="Click to view full lead details"
                          >
                            #LEAD-{lead.lead_id || lead.id}
                          </td>
                          <td>
                            <div className="cc-party-lead-customer">
                              <span
                                className="name"
                                onClick={() => navigate(`/lead-details/${lead.lead_id || lead.id}`)}
                              >
                                {lead.name || "--"}
                              </span>
                              <span className="contact">{lead.number || "--"}</span>
                            </div>
                          </td>
                          <td>
                            <span className="cc-party-date-tag">
                              {lead.createdAt
                                ? new Date(lead.createdAt).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })
                                : "--"}
                            </span>
                          </td>
                          <td>
                            {lead.bank_name ? (
                              <div className="cc-party-bank-box">
                                <span className="bank-name">
                                  <Building2 size={12} /> {lead.bank_name}
                                </span>
                                <small>{lead.loan_type || "Loan"}</small>
                              </div>
                            ) : (
                              <div className="cc-party-bank-box">
                                <span className="bank-empty">--</span>
                                <small>{lead.loan_type || "General Loan"}</small>
                              </div>
                            )}
                          </td>
                          <td>
                            {lead.sanctioned_amount ? (
                              <div className="cc-party-amount-box">
                                <span className="amount sanctioned">
                                  ₹{Number(lead.sanctioned_amount).toLocaleString("en-IN")}
                                </span>
                                <span className="amount-badge sanctioned">✓ Sanctioned</span>
                              </div>
                            ) : (
                              <div className="cc-party-amount-box">
                                <span className="amount applied">
                                  ₹{Number(lead.applied_amount || lead.est_budget || 0).toLocaleString("en-IN")}
                                </span>
                                <span className="amount-badge applied">Applied Budget</span>
                              </div>
                            )}
                          </td>
                          <td>
                            {lead.sanction_date ? (
                              <div className="cc-party-session-date">
                                <Calendar size={12} />
                                <span>
                                  {new Date(lead.sanction_date).toLocaleDateString("en-IN", {
                                    day: "2-digit",
                                    month: "short",
                                    year: "numeric",
                                  })}
                                </span>
                              </div>
                            ) : (
                              <span className="cc-party-session-pending">Pending</span>
                            )}
                          </td>
                          {isAdmin && (
                            <td>
                              <div className="cc-party-comm-cell">
                                {commPct !== null ? (
                                  <span className="comm-pill">{commPct}%</span>
                                ) : (
                                  <span className="comm-pill none">0%</span>
                                )}
                              </div>
                            </td>
                          )}
                          <td>
                            <span className="cc-party-status-pill">{lead.status || "NEW"}</span>
                          </td>
                          <td>
                            <span className="cc-party-owner-text">{lead.owner || "Unassigned"}</span>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <button
                              type="button"
                              className="cc-party-view-btn"
                              onClick={() => navigate(`/lead-details/${lead.lead_id || lead.id}`)}
                              title="Open Lead Profile"
                            >
                              <Eye size={15} />
                              <span>View</span>
                            </button>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      ) : (
        <>
          {/* Top Header / Stats Row */}
          <div className="cc-sources-stats-grid">
            <div className="cc-sources-stat-card">
              <div className="cc-sources-stat-icon total">
                <Share2 size={22} />
              </div>
              <div className="cc-sources-stat-content">
                <span className="cc-sources-stat-label">Total Sources / Parties</span>
                <span className="cc-sources-stat-value">{stats.total}</span>
              </div>
            </div>
            <div className="cc-sources-stat-card">
              <div className="cc-sources-stat-icon active">
                <CheckCircle2 size={22} />
              </div>
              <div className="cc-sources-stat-content">
                <span className="cc-sources-stat-label">Active Sources</span>
                <span className="cc-sources-stat-value">{stats.active}</span>
              </div>
            </div>
            <div className="cc-sources-stat-card">
              <div className="cc-sources-stat-icon inactive">
                <AlertCircle size={22} />
              </div>
              <div className="cc-sources-stat-content">
                <span className="cc-sources-stat-label">Inactive Sources</span>
                <span className="cc-sources-stat-value">{stats.inactive}</span>
              </div>
            </div>
          </div>

          {/* Search & Actions Bar */}
          <section className="cc-report-panel cc-sources-topbar">
            <label className="cc-sources-search-shell">
              <Search size={18} />
              <input
                type="search"
                placeholder="Search by source name or code (e.g. DSA, Referral, Self)..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
              {searchTerm ? (
                <button
                  type="button"
                  className="cc-sources-search-clear"
                  onClick={() => setSearchTerm("")}
                  title="Clear search"
                >
                  <X size={14} />
                </button>
              ) : null}
            </label>

            <div className="cc-sources-topbar-actions">
              {/* Status Filter Tabs */}
              <div className="cc-sources-filter-tabs">
                <button
                  type="button"
                  className={`cc-sources-filter-tab ${statusFilter === "all" ? "active" : ""}`}
                  onClick={() => setStatusFilter("all")}
                >
                  All ({stats.total})
                </button>
                <button
                  type="button"
                  className={`cc-sources-filter-tab ${statusFilter === "active" ? "active" : ""}`}
                  onClick={() => setStatusFilter("active")}
                >
                  Active ({stats.active})
                </button>
                <button
                  type="button"
                  className={`cc-sources-filter-tab ${statusFilter === "inactive" ? "active" : ""}`}
                  onClick={() => setStatusFilter("inactive")}
                >
                  Inactive ({stats.inactive})
                </button>
              </div>

              <button
                type="button"
                className="cc-sources-refresh-btn"
                onClick={fetchSources}
                title="Refresh list"
              >
                <RefreshCw size={16} className={loading ? "spin" : ""} />
              </button>

              <button
                type="button"
                className="cc-sources-primary-btn"
                onClick={openCreate}
              >
                <Plus size={16} />
                <span>Add Source / Party</span>
              </button>
            </div>
          </section>

          {/* Main Content Table */}
          <section className="cc-report-panel cc-sources-table-panel">
            <div className="cc-sources-table-header">
              <div>
                <h3>All Lead Sources & Parties</h3>
                <p>
                  Sources and external parties configured here appear dynamically in Add Lead &amp; Excel Import. Default is <strong>Self</strong>.
                </p>
              </div>
              <span className="cc-sources-count-badge">
                Showing {filtered.length} of {sources.length}
              </span>
            </div>

            <div className="cc-sources-table-responsive">
              <table className="cc-sources-table">
                <thead>
                  <tr>
                    <th style={{ width: "40px" }}>#</th>
                    <th>Source / Party Name</th>
                    <th>System Code</th>
                    {isAdmin && <th>Default Comm.</th>}
                    <th>Color Badge</th>
                    <th>Order Index</th>
                    <th>Status</th>
                    <th style={{ textAlign: "right", width: "130px" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="cc-sources-loading-cell">
                        <RefreshCw size={24} className="spin" />
                        <span>Loading lead sources...</span>
                      </td>
                    </tr>
                  ) : filtered.length === 0 ? (
                    <tr>
                      <td colSpan={isAdmin ? 8 : 7} className="cc-sources-empty-cell">
                        <Share2 size={36} />
                        <p>No lead sources found matching your criteria</p>
                        {searchTerm && (
                          <button
                            type="button"
                            className="cc-sources-clear-btn"
                            onClick={() => {
                              setSearchTerm("");
                              setStatusFilter("all");
                            }}
                          >
                            Reset Search Filters
                          </button>
                        )}
                      </td>
                    </tr>
                  ) : (
                    filtered.map((source, index) => {
                      const isSelf = source.value?.toLowerCase() === "self";
                      return (
                        <tr
                          key={source.id}
                          className={!source.isActive ? "row-inactive" : ""}
                        >
                          <td className="cc-sources-index-cell">{index + 1}</td>
                          <td>
                            <div
                              className="cc-sources-name-cell"
                              style={{ cursor: "pointer" }}
                              onClick={() => setSelectedParty(source)}
                              title="Click to view all leads for this party"
                            >
                              <span
                                className="cc-sources-color-dot"
                                style={{ backgroundColor: source.colorCode || "#3b82f6" }}
                              />
                              <div>
                                <span className="cc-sources-title" style={{ color: "#1d4ed8" }}>
                                  {source.label}
                                </span>
                                {isSelf && (
                                  <span className="cc-sources-default-tag" title="Default fallback for new leads">
                                    <ShieldCheck size={11} /> Default
                                  </span>
                                )}
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="cc-sources-code">{source.value}</span>
                          </td>
                          {isAdmin && (
                            <td>
                              {source.commissionPercent !== null && source.commissionPercent !== undefined ? (
                                <span
                                  style={{
                                    fontSize: "11.5px",
                                    color: "#047857",
                                    fontWeight: 700,
                                    background: "#ecfdf5",
                                    padding: "2px 7px",
                                    borderRadius: "6px",
                                    border: "1px solid #a7f3d0",
                                  }}
                                >
                                  {source.commissionPercent}%
                                </span>
                              ) : (
                                <span style={{ color: "#94a3b8", fontSize: "12px" }}>--</span>
                              )}
                            </td>
                          )}
                          <td>
                            <span
                              className="cc-sources-badge-preview"
                              style={{
                                backgroundColor: `${source.colorCode || "#3b82f6"}15`,
                                color: source.colorCode || "#3b82f6",
                                borderColor: `${source.colorCode || "#3b82f6"}40`,
                              }}
                            >
                              <span
                                className="dot"
                                style={{ backgroundColor: source.colorCode || "#3b82f6" }}
                              />
                              {source.label}
                            </span>
                          </td>
                          <td>
                            <span className="cc-sources-order-badge">
                              {source.orderIndex ?? "--"}
                            </span>
                          </td>
                          <td>
                            <button
                              type="button"
                              className={`cc-sources-toggle-btn ${source.isActive ? "active" : "inactive"}`}
                              onClick={() => handleToggleActive(source)}
                              title="Click to toggle active/inactive"
                            >
                              <span className="toggle-switch" />
                              <span className="toggle-label">
                                {source.isActive ? "Active" : "Inactive"}
                              </span>
                            </button>
                          </td>
                          <td style={{ textAlign: "right" }}>
                            <div className="cc-sources-actions-cell">
                              <button
                                type="button"
                                className="cc-sources-action-icon view"
                                onClick={() => setSelectedParty(source)}
                                title="View Leads & Commission for this party"
                              >
                                <Eye size={15} />
                              </button>
                              <button
                                type="button"
                                className="cc-sources-action-icon edit"
                                onClick={() => openEdit(source)}
                                title="Edit Source"
                              >
                                <Pencil size={15} />
                              </button>
                              {!isSelf ? (
                                <button
                                  type="button"
                                  className="cc-sources-action-icon delete"
                                  onClick={() => setDeleteTarget(source)}
                                  title="Delete Source"
                                >
                                  <Trash2 size={15} />
                                </button>
                              ) : (
                                <span
                                  className="cc-sources-action-icon disabled"
                                  title="Default Self source cannot be deleted"
                                >
                                  <ShieldCheck size={15} />
                                </span>
                              )}
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}

      {/* Add / Edit Modal */}
      {modalOpen && (
        <div className="cc-sources-modal-backdrop" onClick={() => setModalOpen(false)}>
          <div
            className="cc-sources-modal-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cc-sources-modal-header">
              <div>
                <h3>{editing ? "Edit Lead Source / Party" : "Add New Lead Source / Party"}</h3>
                <p>Configure channel, DSA, broker or advertising source</p>
              </div>
              <button
                type="button"
                className="cc-sources-modal-close"
                onClick={() => setModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="cc-sources-modal-body">
              <div className="cc-sources-form-group">
                <label>
                  Source / Party Name <span className="req">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. DSA - Sharmaji, Google Ads, Bank Referral..."
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  required
                  autoFocus
                />
                <span className="help-text">
                  This display name will appear in dropdowns during lead creation and filtering.
                </span>
              </div>

              {!editing && (
                <div className="cc-sources-form-group">
                  <label>System Code / Identifier (Optional)</label>
                  <input
                    type="text"
                    placeholder="Leave blank to auto-generate from name"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                  />
                  <span className="help-text">
                    Identifier used in backend API &amp; Excel sheets. Auto-slugified if left blank.
                  </span>
                </div>
              )}

              <div className="cc-sources-form-group">
                <label>Color Theme &amp; Badge</label>
                <div className="cc-sources-color-picker-row">
                  <div className="presets-list">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`color-preset-circle ${form.colorCode === color ? "selected" : ""}`}
                        style={{ backgroundColor: color }}
                        onClick={() => setForm({ ...form, colorCode: color })}
                      />
                    ))}
                  </div>
                  <div className="custom-color-input">
                    <input
                      type="color"
                      value={form.colorCode}
                      onChange={(e) => setForm({ ...form, colorCode: e.target.value })}
                    />
                    <span>{form.colorCode}</span>
                  </div>
                </div>
              </div>

              {isAdmin && (
                <div className="cc-sources-form-group">
                  <label>Default Commission (%) (Optional)</label>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      placeholder="e.g. 1.5"
                      value={form.commissionPercent}
                      onChange={(e) => setForm({ ...form, commissionPercent: e.target.value })}
                      style={{ paddingRight: "30px", width: "100%", boxSizing: "border-box" }}
                    />
                    <span style={{ position: "absolute", right: "12px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontWeight: 700, fontSize: "13px", pointerEvents: "none" }}>%</span>
                  </div>
                  <span className="help-text">
                    Default commission percentage for leads created under this party / source.
                  </span>
                </div>
              )}

              <div className="cc-sources-form-row">
                <div className="cc-sources-form-group">
                  <label>Display Order</label>
                  <input
                    type="number"
                    min="1"
                    step="5"
                    value={form.orderIndex}
                    onChange={(e) => setForm({ ...form, orderIndex: e.target.value })}
                  />
                </div>

                <div className="cc-sources-form-group">
                  <label>Active Status</label>
                  <div className="status-toggle-wrapper">
                    <label className="switch-label">
                      <input
                        type="checkbox"
                        checked={form.isActive}
                        onChange={(e) => setForm({ ...form, isActive: e.target.checked })}
                      />
                      <span className="slider" />
                    </label>
                    <span className="status-text">
                      {form.isActive ? "Active (Selectable)" : "Inactive (Hidden)"}
                    </span>
                  </div>
                </div>
              </div>

              <div className="cc-sources-preview-box">
                <span className="preview-label">Live Preview:</span>
                <span
                  className="cc-sources-badge-preview"
                  style={{
                    backgroundColor: `${form.colorCode || "#3b82f6"}18`,
                    color: form.colorCode || "#3b82f6",
                    borderColor: `${form.colorCode || "#3b82f6"}50`,
                  }}
                >
                  <span
                    className="dot"
                    style={{ backgroundColor: form.colorCode || "#3b82f6" }}
                  />
                  {form.label || "Sample Source"}
                </span>
              </div>

              <div className="cc-sources-modal-footer">
                <button
                  type="button"
                  className="cc-sources-modal-cancel"
                  onClick={() => setModalOpen(false)}
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-sources-modal-submit"
                  disabled={submitting}
                >
                  {submitting ? "Saving..." : editing ? "Update Source" : "Add Source"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="cc-sources-modal-backdrop" onClick={() => setDeleteTarget(null)}>
          <div
            className="cc-sources-modal-dialog delete-dialog"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="cc-sources-modal-header danger">
              <div>
                <h3>Delete Lead Source?</h3>
                <p>Are you sure you want to remove this source?</p>
              </div>
              <button
                type="button"
                className="cc-sources-modal-close"
                onClick={() => setDeleteTarget(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="cc-sources-modal-body">
              <p className="delete-warning-text">
                Source: <strong>{deleteTarget.label}</strong> (Code: <code>{deleteTarget.value}</code>)
              </p>
              <p className="delete-info-text">
                Existing leads with this source will preserve their historical data. You can deactivate it instead of permanently deleting.
              </p>

              <div className="cc-sources-modal-footer">
                <button
                  type="button"
                  className="cc-sources-modal-cancel"
                  onClick={() => setDeleteTarget(null)}
                  disabled={deleting}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cc-sources-modal-deactivate"
                  onClick={() => handleDelete(false)}
                  disabled={deleting}
                >
                  Deactivate Only
                </button>
                <button
                  type="button"
                  className="cc-sources-modal-delete"
                  onClick={() => handleDelete(true)}
                  disabled={deleting}
                >
                  {deleting ? "Deleting..." : "Delete Permanently"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
.cc-sources {
  display: flex;
  flex-direction: column;
  gap: 20px;
}

.cc-sources-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.cc-sources-stat-card {
  display: flex;
  align-items: center;
  gap: 16px;
  background: #ffffff;
  padding: 18px 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.cc-sources-stat-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 48px;
  height: 48px;
  border-radius: 10px;
}

.cc-sources-stat-icon.total {
  background: #eff6ff;
  color: #3b82f6;
}

.cc-sources-stat-icon.active {
  background: #ecfdf5;
  color: #10b981;
}

.cc-sources-stat-icon.inactive {
  background: #fff1f2;
  color: #f43f5e;
}

.cc-sources-stat-content {
  display: flex;
  flex-direction: column;
}

.cc-sources-stat-label {
  font-size: 13px;
  color: #64748b;
  font-weight: 500;
}

.cc-sources-stat-value {
  font-size: 24px;
  font-weight: 700;
  color: #0f172a;
}

.cc-sources-topbar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #ffffff;
  padding: 16px 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.cc-sources-search-shell {
  display: flex;
  align-items: center;
  gap: 10px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 14px;
  width: 360px;
  max-width: 100%;
  color: #64748b;
  transition: all 0.2s;
}

.cc-sources-search-shell:focus-within {
  border-color: #3b82f6;
  background: #ffffff;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.cc-sources-search-shell input {
  border: none;
  background: transparent;
  width: 100%;
  font-size: 14px;
  outline: none;
  color: #0f172a;
}

.cc-sources-search-clear {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 2px;
  display: flex;
}

.cc-sources-search-clear:hover {
  color: #475569;
}

.cc-sources-topbar-actions {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.cc-sources-filter-tabs {
  display: flex;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 8px;
  gap: 2px;
}

.cc-sources-filter-tab {
  border: none;
  background: transparent;
  padding: 6px 14px;
  font-size: 13px;
  font-weight: 500;
  color: #64748b;
  border-radius: 6px;
  cursor: pointer;
  transition: all 0.15s;
}

.cc-sources-filter-tab.active {
  background: #ffffff;
  color: #0f172a;
  font-weight: 600;
  box-shadow: 0 1px 2px rgba(0, 0, 0, 0.06);
}

.cc-sources-refresh-btn {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  width: 36px;
  height: 36px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.2s;
}

.cc-sources-refresh-btn:hover {
  background: #f8fafc;
  color: #0f172a;
}

.cc-sources-primary-btn {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #2563eb;
  color: #ffffff;
  border: none;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 14px;
  font-weight: 600;
  cursor: pointer;
  transition: background 0.2s;
}

.cc-sources-primary-btn:hover {
  background: #1d4ed8;
}

.cc-sources-table-panel {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
}

.cc-sources-table-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 24px;
  border-bottom: 1px solid #f1f5f9;
}

.cc-sources-table-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.cc-sources-table-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}

.cc-sources-count-badge {
  font-size: 12px;
  color: #64748b;
  background: #f1f5f9;
  padding: 4px 10px;
  border-radius: 12px;
  font-weight: 500;
}

.cc-sources-table-responsive {
  overflow-x: auto;
}

.cc-sources-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.cc-sources-table th {
  background: #f8fafc;
  padding: 12px 20px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  letter-spacing: 0.03em;
  border-bottom: 1px solid #e2e8f0;
}

.cc-sources-table td {
  padding: 14px 20px;
  font-size: 14px;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.cc-sources-table tr:hover {
  background: #fbfcfe;
}

.cc-sources-table tr.row-inactive {
  opacity: 0.6;
}

.cc-sources-index-cell {
  color: #94a3b8;
  font-size: 13px;
}

.cc-sources-name-cell {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cc-sources-color-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cc-sources-title {
  font-weight: 600;
  color: #0f172a;
}

.cc-sources-default-tag {
  display: inline-flex;
  align-items: center;
  gap: 3px;
  background: #ecfdf5;
  color: #059669;
  border: 1px solid #a7f3d0;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 11px;
  font-weight: 600;
  margin-left: 8px;
}

.cc-sources-code {
  font-family: monospace;
  font-size: 12px;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 4px;
  color: #475569;
}

.cc-sources-badge-preview {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  border-radius: 14px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}

.cc-sources-badge-preview .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.cc-sources-order-badge {
  font-size: 13px;
  font-weight: 600;
  color: #64748b;
}

.cc-sources-toggle-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 4px 8px;
  border-radius: 6px;
  transition: background 0.15s;
}

.cc-sources-toggle-btn:hover {
  background: #f1f5f9;
}

.toggle-switch {
  width: 28px;
  height: 16px;
  background: #cbd5e1;
  border-radius: 10px;
  position: relative;
  transition: background 0.2s;
}

.toggle-switch::after {
  content: "";
  position: absolute;
  top: 2px;
  left: 2px;
  width: 12px;
  height: 12px;
  background: #ffffff;
  border-radius: 50%;
  transition: transform 0.2s;
}

.cc-sources-toggle-btn.active .toggle-switch {
  background: #10b981;
}

.cc-sources-toggle-btn.active .toggle-switch::after {
  transform: translateX(12px);
}

.toggle-label {
  font-size: 12px;
  font-weight: 600;
}

.cc-sources-toggle-btn.active .toggle-label {
  color: #059669;
}

.cc-sources-toggle-btn.inactive .toggle-label {
  color: #94a3b8;
}

.cc-sources-actions-cell {
  display: flex;
  align-items: center;
  justify-content: flex-end;
  gap: 6px;
}

.cc-sources-action-icon {
  width: 32px;
  height: 32px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  background: #ffffff;
  display: flex;
  align-items: center;
  justify-content: center;
  cursor: pointer;
  transition: all 0.15s;
  color: #64748b;
}

.cc-sources-action-icon.edit:hover {
  background: #eff6ff;
  color: #2563eb;
  border-color: #bfdbfe;
}

.cc-sources-action-icon.delete:hover {
  background: #fff1f2;
  color: #e11d48;
  border-color: #fecdd3;
}

.cc-sources-action-icon.disabled {
  opacity: 0.35;
  cursor: not-allowed;
}

.cc-sources-loading-cell,
.cc-sources-empty-cell {
  text-align: center;
  padding: 48px 20px;
  color: #64748b;
}

.cc-sources-loading-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 12px;
}

.cc-sources-clear-btn {
  margin-top: 12px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  padding: 6px 14px;
  border-radius: 6px;
  font-size: 13px;
  font-weight: 500;
  cursor: pointer;
}

/* Modals */
.cc-sources-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 20px;
}

.cc-sources-modal-dialog {
  background: #ffffff;
  border-radius: 14px;
  width: 520px;
  max-width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
  overflow: hidden;
  animation: modalIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
}

@keyframes modalIn {
  from {
    opacity: 0;
    transform: scale(0.96) translateY(8px);
  }
  to {
    opacity: 1;
    transform: scale(1) translateY(0);
  }
}

.cc-sources-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  padding: 20px 24px 16px;
  border-bottom: 1px solid #f1f5f9;
}

.cc-sources-modal-header h3 {
  margin: 0;
  font-size: 17px;
  font-weight: 700;
  color: #0f172a;
}

.cc-sources-modal-header p {
  margin: 4px 0 0;
  font-size: 13px;
  color: #64748b;
}

.cc-sources-modal-close {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  padding: 4px;
  border-radius: 6px;
}

.cc-sources-modal-close:hover {
  background: #f1f5f9;
  color: #0f172a;
}

.cc-sources-modal-body {
  padding: 20px 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cc-sources-form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.cc-sources-form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.cc-sources-form-group .req {
  color: #ef4444;
}

.cc-sources-form-group input[type="text"],
.cc-sources-form-group input[type="number"] {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 14px;
  color: #0f172a;
  outline: none;
  transition: all 0.15s;
}

.cc-sources-form-group input:focus {
  border-color: #3b82f6;
  box-shadow: 0 0 0 3px rgba(59, 130, 246, 0.12);
}

.cc-sources-form-group .help-text {
  font-size: 11.5px;
  color: #64748b;
}

.cc-sources-form-row {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: 16px;
}

.cc-sources-color-picker-row {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.presets-list {
  display: flex;
  gap: 8px;
}

.color-preset-circle {
  width: 24px;
  height: 24px;
  border-radius: 50%;
  border: 2px solid transparent;
  cursor: pointer;
  transition: transform 0.15s, border-color 0.15s;
}

.color-preset-circle:hover {
  transform: scale(1.15);
}

.color-preset-circle.selected {
  border-color: #0f172a;
  box-shadow: 0 0 0 2px #ffffff;
}

.custom-color-input {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f8fafc;
  padding: 4px 8px;
  border-radius: 6px;
  border: 1px solid #cbd5e1;
}

.custom-color-input input[type="color"] {
  width: 24px;
  height: 24px;
  border: none;
  background: transparent;
  cursor: pointer;
}

.custom-color-input span {
  font-family: monospace;
  font-size: 12px;
  color: #475569;
}

.status-toggle-wrapper {
  display: flex;
  align-items: center;
  gap: 10px;
  padding-top: 6px;
}

.switch-label {
  position: relative;
  display: inline-block;
  width: 38px;
  height: 22px;
}

.switch-label input {
  opacity: 0;
  width: 0;
  height: 0;
}

.slider {
  position: absolute;
  cursor: pointer;
  inset: 0;
  background-color: #cbd5e1;
  transition: 0.2s;
  border-radius: 24px;
}

.slider::before {
  position: absolute;
  content: "";
  height: 16px;
  width: 16px;
  left: 3px;
  bottom: 3px;
  background-color: white;
  transition: 0.2s;
  border-radius: 50%;
}

input:checked + .slider {
  background-color: #10b981;
}

input:checked + .slider::before {
  transform: translateX(16px);
}

.status-text {
  font-size: 13px;
  color: #334155;
  font-weight: 500;
}

.cc-sources-preview-box {
  background: #f8fafc;
  padding: 10px 14px;
  border-radius: 8px;
  display: flex;
  align-items: center;
  gap: 12px;
  border: 1px dashed #cbd5e1;
}

.preview-label {
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
}

.cc-sources-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.cc-sources-modal-cancel {
  border: 1px solid #cbd5e1;
  background: #ffffff;
  color: #475569;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.cc-sources-modal-cancel:hover {
  background: #f1f5f9;
}

.cc-sources-modal-submit {
  border: none;
  background: #2563eb;
  color: #ffffff;
  padding: 8px 18px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.cc-sources-modal-submit:hover {
  background: #1d4ed8;
}

.cc-sources-modal-deactivate {
  border: 1px solid #f59e0b;
  background: #fffbeb;
  color: #b45309;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.cc-sources-modal-delete {
  border: none;
  background: #ef4444;
  color: #ffffff;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
}

.delete-warning-text {
  font-size: 14px;
  color: #0f172a;
  margin: 0 0 8px;
}

.delete-info-text {
  font-size: 13px;
  color: #64748b;
  line-height: 1.5;
  margin: 0 0 16px;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* ========================================================
   Party Leads Detailed View Styles
   ======================================================== */
.cc-party-leads-view {
  display: flex;
  flex-direction: column;
  gap: 16px;
  width: 100%;
}

.cc-party-leads-header {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  justify-content: space-between;
  gap: 16px;
  background: #ffffff;
  padding: 18px 22px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.cc-party-header-left {
  display: flex;
  align-items: flex-start;
  gap: 16px;
  flex-wrap: wrap;
}

.cc-party-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  background: #f1f5f9;
  color: #334155;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  white-space: nowrap;
}

.cc-party-back-btn:hover {
  background: #0f172a;
  color: #ffffff;
  border-color: #0f172a;
}

.cc-party-title-group {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cc-party-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cc-party-title-row h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.cc-party-dot {
  width: 12px;
  height: 12px;
  border-radius: 50%;
  flex-shrink: 0;
}

.cc-party-code-badge {
  font-size: 11px;
  font-family: monospace;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
}

.cc-party-comm-badge {
  font-size: 11px;
  font-weight: 700;
  background: #ecfdf5;
  color: #047857;
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #a7f3d0;
}

.cc-party-subtitle {
  margin: 0;
  font-size: 12.5px;
  color: #64748b;
}

.cc-party-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cc-party-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
  border: 1px solid transparent;
}

.cc-party-action-btn.ghost {
  background: #f8fafc;
  border-color: #cbd5e1;
  color: #334155;
}

.cc-party-action-btn.ghost:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.cc-party-action-btn.excel {
  background: #047857;
  color: #ffffff;
}

.cc-party-action-btn.excel:hover:not(:disabled) {
  background: #065f46;
}

.cc-party-action-btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}

.cc-party-stats-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
}

.cc-party-stat-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #ffffff;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.cc-party-stat-card .icon {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 44px;
  height: 44px;
  border-radius: 10px;
  flex-shrink: 0;
}

.cc-party-stat-card .icon.blue { background: #eff6ff; color: #2563eb; }
.cc-party-stat-card .icon.emerald { background: #ecfdf5; color: #059669; }
.cc-party-stat-card .icon.purple { background: #f5f3ff; color: #7c3aed; }
.cc-party-stat-card .icon.amber { background: #fffbeb; color: #d97706; }

.cc-party-stat-card .info {
  display: flex;
  flex-direction: column;
}

.cc-party-stat-card .label {
  font-size: 11.5px;
  color: #64748b;
  font-weight: 500;
}

.cc-party-stat-card .val {
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.cc-party-filter-bar {
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 10px;
  background: #ffffff;
  padding: 12px 18px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.cc-party-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 7px 12px;
  color: #64748b;
  flex: 1;
  min-width: 220px;
}

.cc-party-search-box input {
  border: 0;
  background: transparent;
  outline: none;
  font-size: 13px;
  width: 100%;
  color: #0f172a;
}

.cc-party-search-box button {
  border: 0;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
  display: grid;
  place-items: center;
  padding: 0;
}

.cc-party-filter-group {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #475569;
  font-weight: 600;
}

.cc-party-filter-group .group-label {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  white-space: nowrap;
}

.cc-party-filter-group select,
.cc-party-filter-group input[type="date"] {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 12.5px;
  background: #fff;
  color: #0f172a;
  outline: none;
  font-family: inherit;
}

.cc-party-filter-group select:focus,
.cc-party-filter-group input[type="date"]:focus {
  border-color: #3b82f6;
}

.cc-party-clear-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: #fee2e2;
  color: #b91c1c;
  border: 1px solid #fecaca;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

.cc-party-clear-btn:hover {
  background: #fca5a5;
}

.cc-party-table-panel {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.03);
}

.cc-party-table-scroll {
  overflow-x: auto;
  width: 100%;
}

.cc-party-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 13px;
  text-align: left;
}

.cc-party-table th {
  background: #f8fafc;
  color: #475569;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  padding: 12px 14px;
  border-bottom: 1px solid #e2e8f0;
  white-space: nowrap;
}

.cc-party-table td {
  padding: 12px 14px;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
  color: #1e293b;
}

.cc-party-table tr:hover td {
  background: #f8fafc;
}

.cc-party-id-cell {
  font-weight: 700;
  font-size: 12px;
  color: #2563eb;
  cursor: pointer;
  white-space: nowrap;
}

.cc-party-id-cell:hover {
  text-decoration: underline;
}

.cc-party-lead-customer {
  display: flex;
  flex-direction: column;
}

.cc-party-lead-customer .name {
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
}

.cc-party-lead-customer .name:hover {
  color: #2563eb;
}

.cc-party-lead-customer .contact {
  font-size: 11.5px;
  color: #64748b;
}

.cc-party-date-tag {
  font-size: 12px;
  color: #475569;
  white-space: nowrap;
}

.cc-party-bank-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc-party-bank-box .bank-name {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-weight: 600;
  font-size: 12.5px;
  color: #1e293b;
}

.cc-party-bank-box .bank-empty {
  color: #94a3b8;
  font-size: 12px;
}

.cc-party-bank-box small {
  font-size: 11px;
  color: #64748b;
}

.cc-party-amount-box {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc-party-amount-box .amount {
  font-weight: 700;
  font-size: 13.5px;
}

.cc-party-amount-box .amount.sanctioned {
  color: #047857;
}

.cc-party-amount-box .amount.applied {
  color: #1e293b;
}

.cc-party-amount-box .amount-badge {
  font-size: 10.5px;
  font-weight: 600;
  width: fit-content;
  padding: 1px 6px;
  border-radius: 4px;
}

.cc-party-amount-box .amount-badge.sanctioned {
  background: #ecfdf5;
  color: #059669;
}

.cc-party-amount-box .amount-badge.applied {
  background: #f1f5f9;
  color: #64748b;
}

.cc-party-session-date {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 12px;
  color: #334155;
  white-space: nowrap;
}

.cc-party-session-pending {
  font-size: 11.5px;
  color: #94a3b8;
  background: #f8fafc;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
}

.cc-party-comm-cell {
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc-party-comm-cell .comm-pill {
  display: inline-flex;
  align-items: center;
  width: fit-content;
  padding: 2px 7px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 700;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
}

.cc-party-comm-cell .comm-pill.none {
  background: #f1f5f9;
  color: #94a3b8;
  border-color: #e2e8f0;
}

.cc-party-comm-cell .comm-val {
  font-size: 11px;
  font-weight: 700;
  color: #059669;
}

.cc-party-status-pill {
  display: inline-block;
  padding: 3px 9px;
  border-radius: 12px;
  font-size: 11.5px;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #e2e8f0;
  white-space: nowrap;
}

.cc-party-owner-text {
  font-size: 12px;
  color: #475569;
  white-space: nowrap;
}

.cc-party-view-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 6px 10px;
  background: #eff6ff;
  color: #2563eb;
  border: 1px solid #bfdbfe;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}

.cc-party-view-btn:hover {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
}

.cc-party-loading-cell,
.cc-party-empty-cell {
  text-align: center;
  padding: 44px 20px;
  color: #64748b;
}

.cc-party-loading-cell {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.cc-party-empty-cell h4 {
  margin: 8px 0 4px;
  color: #0f172a;
  font-size: 15px;
}

.cc-party-empty-cell p {
  margin: 0;
  font-size: 13px;
  color: #94a3b8;
}

.cc-sources-action-icon.view:hover {
  background: #ecfdf5;
  color: #059669;
  border-color: #a7f3d0;
}
`;
