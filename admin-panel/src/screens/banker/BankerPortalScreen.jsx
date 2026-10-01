import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileSearch,
  FileText,
  Filter,
  HelpCircle,
  IndianRupee,
  Layers,
  MessageSquare,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Tag,
  User,
  UserCheck,
  X,
  XCircle,
} from "lucide-react";
import API_URL from "../../config";
import CcPagination from "../../components/CcPagination";

const PAGE_SIZE = 15;
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});
const numberFormatter = new Intl.NumberFormat("en-IN");

const STATUS_CONFIG = {
  DOCS_PENDING: { label: "Docs Pending", bg: "#fef3c7", color: "#b45309", border: "#fde68a" },
  UNDER_REVIEW: { label: "Under Review", bg: "#e0f2fe", color: "#0369a1", border: "#bae6fd" },
  QUERY_RAISED: { label: "Query Raised", bg: "#fff1f2", color: "#be123c", border: "#fecdd3" },
  SANCTIONED: { label: "Sanctioned", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  APPROVED: { label: "Approved", bg: "#f0fdf4", color: "#15803d", border: "#bbf7d0" },
  DISBURSED: { label: "Disbursed", bg: "#ecfdf5", color: "#047857", border: "#a7f3d0" },
  REJECTED: { label: "Rejected", bg: "#fef2f2", color: "#b91c1c", border: "#fecaca" },
};

const getStatusBadge = (status = "DOCS_PENDING") => {
  const norm = (status || "").toUpperCase().replace(/\s+/g, "_");
  const cfg = STATUS_CONFIG[norm] || {
    label: status,
    bg: "#f1f5f9",
    color: "#475569",
    border: "#e2e8f0",
  };
  return (
    <span
      style={{
        display: "inline-flex",
        alignItems: "center",
        gap: 5,
        padding: "3px 10px",
        borderRadius: 999,
        fontSize: 12,
        fontWeight: 600,
        background: cfg.bg,
        color: cfg.color,
        border: `1px solid ${cfg.border}`,
      }}
    >
      <i style={{ width: 6, height: 6, borderRadius: "50%", background: cfg.color }} />
      {cfg.label}
    </span>
  );
};

export default function BankerPortalScreen() {
  const [stats, setStats] = useState(null);
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statsLoading, setStatsLoading] = useState(true);

  const [activeTab, setActiveTab] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Detail Modal / Drawer state
  const [selectedApp, setSelectedApp] = useState(null);
  const [appDetailLoading, setAppDetailLoading] = useState(false);

  // Actions state inside drawer
  const [newQueryText, setNewQueryText] = useState("");
  const [querySubmitting, setQuerySubmitting] = useState(false);

  // Decision Modals
  const [decisionModal, setDecisionModal] = useState(null); // 'SANCTION' | 'DISBURSE' | 'REJECT' | 'UNDER_REVIEW'
  const [decisionForm, setDecisionForm] = useState({
    sanctionedAmount: "",
    disbursedAmount: "",
    rejectionReason: "Low Credit Score",
    remarks: "",
  });
  const [decisionSubmitting, setDecisionSubmitting] = useState(false);

  const bankerName = localStorage.getItem("name") || "Banker";

  // Fetch KPI Stats
  const fetchStats = useCallback(async () => {
    setStatsLoading(true);
    try {
      const res = await axios.get(`${API_URL}/applications/stats`);
      setStats(res.data?.stats || null);
    } catch (error) {
      console.error("Error fetching banker stats:", error);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // Fetch Applications
  const fetchApplications = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        search: debouncedSearch || undefined,
        status: activeTab !== "ALL" ? activeTab : undefined,
      };
      const res = await axios.get(`${API_URL}/applications`, { params });
      setApplications(res.data?.applications || res.data?.data || []);
      const pagination = res.data?.pagination || {};
      setTotalPages(pagination.totalPages || 1);
      setTotalItems(pagination.totalItems ?? (res.data?.applications?.length || 0));
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast.error("Could not load assigned loan applications");
      setApplications([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, activeTab]);

  // Fetch App Detail (with KYC docs + queries)
  const openAppDetails = async (app) => {
    setAppDetailLoading(true);
    setSelectedApp(app);
    try {
      const res = await axios.get(`${API_URL}/applications/${app.id}`);
      setSelectedApp(res.data?.application || app);
    } catch (error) {
      console.error("Error loading application detail:", error);
      toast.error("Could not load full application details");
    } finally {
      setAppDetailLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, [fetchStats]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchApplications(currentPage);
  }, [fetchApplications, currentPage]);

  // Raise Banker Query
  const handleRaiseQuery = async (e) => {
    e?.preventDefault();
    if (!newQueryText.trim()) {
      toast.warning("Please type your clarification query");
      return;
    }
    setQuerySubmitting(true);
    try {
      await axios.post(`${API_URL}/applications/${selectedApp.id}/queries`, {
        queryText: newQueryText.trim(),
      });
      toast.success("Query raised successfully. Operations team has been notified.");
      setNewQueryText("");
      // Refresh details & stats
      const res = await axios.get(`${API_URL}/applications/${selectedApp.id}`);
      setSelectedApp(res.data?.application);
      fetchStats();
      fetchApplications(currentPage);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to raise query");
    } finally {
      setQuerySubmitting(false);
    }
  };

  // Submit Credit Decision
  const handleDecisionSubmit = async () => {
    if (!decisionModal || !selectedApp) return;
    setDecisionSubmitting(true);
    try {
      let targetStatus = "UNDER_REVIEW";
      const payload = { remarks: decisionForm.remarks };

      if (decisionModal === "SANCTION") {
        targetStatus = "SANCTIONED";
        if (!decisionForm.sanctionedAmount) {
          toast.warning("Please specify the approved sanction amount");
          setDecisionSubmitting(false);
          return;
        }
        payload.sanctionedAmount = parseFloat(decisionForm.sanctionedAmount);
      } else if (decisionModal === "DISBURSE") {
        targetStatus = "DISBURSED";
        if (!decisionForm.disbursedAmount) {
          toast.warning("Please specify the disbursed amount");
          setDecisionSubmitting(false);
          return;
        }
        payload.disbursedAmount = parseFloat(decisionForm.disbursedAmount);
      } else if (decisionModal === "REJECT") {
        targetStatus = "REJECTED";
        payload.rejectionReason = decisionForm.rejectionReason || "Criteria not met";
      } else if (decisionModal === "UNDER_REVIEW") {
        targetStatus = "UNDER_REVIEW";
      }

      payload.status = targetStatus;

      await axios.patch(`${API_URL}/applications/${selectedApp.id}/status`, payload);
      toast.success(`Application updated to ${targetStatus}`);
      setDecisionModal(null);
      setDecisionForm({
        sanctionedAmount: "",
        disbursedAmount: "",
        rejectionReason: "Low Credit Score",
        remarks: "",
      });

      // Refresh
      const res = await axios.get(`${API_URL}/applications/${selectedApp.id}`);
      setSelectedApp(res.data?.application);
      fetchStats();
      fetchApplications(currentPage);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to update decision");
    } finally {
      setDecisionSubmitting(false);
    }
  };

  return (
    <div className="cc-report-redesign cc-banker-portal">
      <ToastContainer position="bottom-right" />
      <style>{bankerStyles}</style>

      {/* Hero Welcome Banner */}
      <section className="cc-banker-hero">
        <div className="cc-banker-hero-copy">
          <div className="cc-banker-hero-tag">
            <Building2 size={14} /> Banker &amp; NBFC Underwriting Portal
          </div>
          <h1>Welcome, {bankerName}</h1>
          <p>
            Review assigned loan applications, inspect applicant KYC &amp; financial documents, raise clarification queries to Operations, and submit credit sanctions.
          </p>
        </div>
        <div className="cc-banker-hero-badge">
          <ShieldCheck size={28} />
          <div>
            <strong>Authorized Credit Reviewer</strong>
            <small>Direct Institution Portal</small>
          </div>
        </div>
      </section>

      {/* KPI Cards Grid */}
      <section className="cc-banker-kpi-grid">
        <div className="cc-banker-kpi-card">
          <div className="cc-banker-kpi-icon total">
            <Layers size={20} />
          </div>
          <div className="cc-banker-kpi-content">
            <small>Total Assigned Files</small>
            <h3>{statsLoading ? "..." : numberFormatter.format(stats?.totalAssigned || 0)}</h3>
          </div>
        </div>

        <div className="cc-banker-kpi-card">
          <div className="cc-banker-kpi-icon pending">
            <Clock size={20} />
          </div>
          <div className="cc-banker-kpi-content">
            <small>Under Review / Docs</small>
            <h3>
              {statsLoading
                ? "..."
                : numberFormatter.format((stats?.underReview || 0) + (stats?.docsPending || 0))}
            </h3>
          </div>
        </div>

        <div className="cc-banker-kpi-card">
          <div className="cc-banker-kpi-icon query">
            <HelpCircle size={20} />
          </div>
          <div className="cc-banker-kpi-content">
            <small>Open Clarifications</small>
            <h3>{statsLoading ? "..." : numberFormatter.format(stats?.openQueriesCount || 0)}</h3>
          </div>
        </div>

        <div className="cc-banker-kpi-card highlighted">
          <div className="cc-banker-kpi-icon sanction">
            <Coins size={20} />
          </div>
          <div className="cc-banker-kpi-content">
            <small>Total Sanctioned / Disbursed</small>
            <h3>
              {statsLoading
                ? "..."
                : currencyFormatter.format(
                    (stats?.totalSanctionedAmount || 0) + (stats?.totalDisbursedAmount || 0)
                  )}
            </h3>
          </div>
        </div>
      </section>

      {/* Search & Status Filters */}
      <section className="cc-report-panel cc-banker-filter-panel">
        <div className="cc-banker-filter-bar">
          <label className="cc-banker-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search by App #, customer name, mobile, loan product..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="cc-banker-search-clear"
                onClick={() => setSearchTerm("")}
              >
                <X size={14} />
              </button>
            )}
          </label>

          <div className="cc-banker-tabs">
            {[
              { key: "ALL", label: "All Files" },
              { key: "UNDER_REVIEW", label: "Under Review" },
              { key: "QUERY_RAISED", label: "Queries Raised" },
              { key: "SANCTIONED", label: "Sanctioned" },
              { key: "DISBURSED", label: "Disbursed" },
              { key: "REJECTED", label: "Rejected" },
            ].map((tab) => (
              <button
                key={tab.key}
                type="button"
                className={activeTab === tab.key ? "active" : ""}
                onClick={() => {
                  setActiveTab(tab.key);
                  setCurrentPage(1);
                }}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <button
            type="button"
            className="cc-banker-refresh-btn"
            onClick={() => {
              fetchStats();
              fetchApplications(currentPage);
            }}
            title="Refresh List"
          >
            <RefreshCw size={16} />
          </button>
        </div>
      </section>

      {/* Applications Data Table */}
      <section className="cc-report-panel">
        <div className="cc-report-table-head">
          <h2>
            Assigned Applications <span className="cc-banker-count">({numberFormatter.format(totalItems)})</span>
          </h2>
          <p className="cc-banker-sub">
            Click on any application to view applicant details, inspect KYC documents, raise queries, and provide credit decisions.
          </p>
        </div>

        <div className="cc-report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>App Number</th>
                <th>Applicant Name</th>
                <th>Loan Product</th>
                <th>Applied Amount</th>
                <th>Sanctioned</th>
                <th>Status</th>
                <th>Queries</th>
                <th>Assigned Lender</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="cc-report-empty">
                    Loading assigned applications...
                  </td>
                </tr>
              ) : applications.length === 0 ? (
                <tr>
                  <td colSpan={9} className="cc-report-empty">
                    {activeTab === "ALL"
                      ? "No applications currently assigned to you."
                      : `No applications found with status "${activeTab}".`}
                  </td>
                </tr>
              ) : (
                applications.map((app) => {
                  const openQueries = (app.queries || []).filter((q) => q.status === "OPEN").length;
                  return (
                    <tr
                      key={app.id}
                      className="cc-banker-row"
                      onClick={() => openAppDetails(app)}
                    >
                      <td>
                        <strong className="cc-banker-appnum">{app.applicationNumber}</strong>
                        <small className="cc-banker-date">
                          {new Date(app.createdAt).toLocaleDateString("en-IN", {
                            day: "2-digit",
                            month: "short",
                            year: "numeric",
                          })}
                        </small>
                      </td>
                      <td>
                        <span className="cc-banker-cust">
                          <strong>{app.customer?.name || "Anonymous Applicant"}</strong>
                          <small>
                            {app.customer?.mobile || "No Mobile"} • {app.customer?.city || "India"}
                          </small>
                        </span>
                      </td>
                      <td>
                        <span className="cc-banker-product">{app.loanProduct || "Personal Loan"}</span>
                      </td>
                      <td>
                        <span className="cc-banker-amount">
                          {currencyFormatter.format(app.appliedAmount || 0)}
                        </span>
                      </td>
                      <td>
                        {app.sanctionedAmount ? (
                          <span className="cc-banker-sanctioned-amt">
                            {currencyFormatter.format(app.sanctionedAmount)}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>{getStatusBadge(app.status)}</td>
                      <td>
                        {openQueries > 0 ? (
                          <span className="cc-banker-query-pill alert">
                            <MessageSquare size={13} /> {openQueries} Open
                          </span>
                        ) : (app.queries || []).length > 0 ? (
                          <span className="cc-banker-query-pill resolved">
                            <CheckCircle2 size={13} /> {(app.queries || []).length} Resolved
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: 12 }}>None</span>
                        )}
                      </td>
                      <td>
                        <span className="cc-banker-lender">
                          {app.lender?.name || app.lender?.shortCode || "Direct NBFC"}
                        </span>
                      </td>
                      <td onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="cc-banker-review-btn"
                          onClick={() => openAppDetails(app)}
                        >
                          Review File <ChevronRight size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <CcPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          itemLabel="applications"
        />
      </section>

      {/* Interactive Credit & KYC Review Drawer */}
      {selectedApp && (
        <div className="cc-banker-drawer-overlay" onClick={() => setSelectedApp(null)}>
          <aside className="cc-banker-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cc-banker-drawer-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2>{selectedApp.applicationNumber}</h2>
                  {getStatusBadge(selectedApp.status)}
                </div>
                <p>
                  Assigned Loan File • Created on{" "}
                  {new Date(selectedApp.createdAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "long",
                    year: "numeric",
                  })}
                </p>
              </div>
              <button
                type="button"
                className="cc-banker-drawer-close"
                onClick={() => setSelectedApp(null)}
              >
                <X size={20} />
              </button>
            </div>

            <div className="cc-banker-drawer-body">
              {appDetailLoading ? (
                <div style={{ padding: "40px 20px", textAlign: "center", color: "#64748b" }}>
                  <RefreshCw className="cc-spin" size={24} style={{ marginBottom: 12 }} />
                  <p>Loading application KYC files and query threads...</p>
                </div>
              ) : (
                <>
                  {/* Quick Summary Cards */}
                  <div className="cc-banker-summary-row">
                    <div className="cc-banker-sum-card">
                      <small>Applied Loan Amount</small>
                      <h4>{currencyFormatter.format(selectedApp.appliedAmount || 0)}</h4>
                    </div>
                    <div className="cc-banker-sum-card">
                      <small>Loan Product</small>
                      <h4>{selectedApp.loanProduct || "Personal Loan"}</h4>
                    </div>
                    <div className="cc-banker-sum-card">
                      <small>Sanctioned Amount</small>
                      <h4 style={{ color: selectedApp.sanctionedAmount ? "#15803d" : "#64748b" }}>
                        {selectedApp.sanctionedAmount
                          ? currencyFormatter.format(selectedApp.sanctionedAmount)
                          : "Not Sanctioned"}
                      </h4>
                    </div>
                  </div>

                  {/* Decision Action Toolbar */}
                  <div className="cc-banker-decision-bar">
                    <div className="cc-banker-decision-label">
                      <strong>Credit Decision Actions:</strong>
                    </div>
                    <div className="cc-banker-decision-btns">
                      <button
                        type="button"
                        className="cc-decision-btn sanction"
                        onClick={() => {
                          setDecisionModal("SANCTION");
                          setDecisionForm((prev) => ({
                            ...prev,
                            sanctionedAmount: selectedApp.sanctionedAmount || selectedApp.appliedAmount || "",
                          }));
                        }}
                      >
                        <CheckCircle2 size={16} /> Approve / Sanction
                      </button>

                      <button
                        type="button"
                        className="cc-decision-btn disburse"
                        onClick={() => {
                          setDecisionModal("DISBURSE");
                          setDecisionForm((prev) => ({
                            ...prev,
                            disbursedAmount:
                              selectedApp.disbursedAmount ||
                              selectedApp.sanctionedAmount ||
                              selectedApp.appliedAmount ||
                              "",
                          }));
                        }}
                      >
                        <Coins size={16} /> Mark Disbursed
                      </button>

                      <button
                        type="button"
                        className="cc-decision-btn review"
                        onClick={() => {
                          setDecisionModal("UNDER_REVIEW");
                        }}
                      >
                        <FileSearch size={16} /> Set Under Review
                      </button>

                      <button
                        type="button"
                        className="cc-decision-btn reject"
                        onClick={() => {
                          setDecisionModal("REJECT");
                        }}
                      >
                        <XCircle size={16} /> Reject Application
                      </button>
                    </div>
                  </div>

                  {/* Applicant Details */}
                  <div className="cc-banker-section">
                    <div className="cc-banker-sec-title">
                      <User size={16} /> Applicant Profile &amp; Financials
                    </div>
                    <div className="cc-banker-profile-grid">
                      <div className="cc-profile-item">
                        <label>Full Name</label>
                        <span>{selectedApp.customer?.name || "—"}</span>
                      </div>
                      <div className="cc-profile-item">
                        <label>Contact Phone</label>
                        <span>{selectedApp.customer?.mobile || "—"}</span>
                      </div>
                      <div className="cc-profile-item">
                        <label>Email Address</label>
                        <span>{selectedApp.customer?.email || "—"}</span>
                      </div>
                      <div className="cc-profile-item">
                        <label>City / Location</label>
                        <span>{selectedApp.customer?.city || "—"}</span>
                      </div>
                      <div className="cc-profile-item">
                        <label>PAN Card Number</label>
                        <span style={{ fontFamily: "monospace", fontWeight: 700 }}>
                          {selectedApp.customer?.pan || selectedApp.customer?.panNumber || "—"}
                        </span>
                      </div>
                      <div className="cc-profile-item">
                        <label>Aadhaar / Identity</label>
                        <span style={{ fontFamily: "monospace" }}>
                          {selectedApp.customer?.aadhaar || selectedApp.customer?.aadhaarNumber || "—"}
                        </span>
                      </div>
                      <div className="cc-profile-item">
                        <label>Employment Type</label>
                        <span>{selectedApp.customer?.employmentType || "Salaried / Professional"}</span>
                      </div>
                      <div className="cc-profile-item">
                        <label>Monthly Income</label>
                        <span style={{ color: "#047857", fontWeight: 700 }}>
                          {selectedApp.customer?.monthlyIncome
                            ? currencyFormatter.format(selectedApp.customer.monthlyIncome)
                            : selectedApp.lead?.monthly_income
                            ? currencyFormatter.format(selectedApp.lead.monthly_income)
                            : "—"}
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* KYC & Financial Documents Section */}
                  <div className="cc-banker-section">
                    <div className="cc-banker-sec-title">
                      <FileCheck size={16} /> KYC &amp; Verification Documents (
                      {(selectedApp.documents || []).length})
                    </div>
                    {(selectedApp.documents || []).length === 0 ? (
                      <div className="cc-banker-empty-box">
                        <FileText size={28} style={{ color: "#94a3b8", marginBottom: 6 }} />
                        <p>No documents uploaded yet for this applicant.</p>
                        <small>You can raise a query below requesting salary slips, bank statements, or PAN/Aadhaar copies.</small>
                      </div>
                    ) : (
                      <div className="cc-banker-docs-grid">
                        {selectedApp.documents.map((doc) => (
                          <div key={doc.id} className="cc-banker-doc-card">
                            <div className="cc-doc-icon">
                              <FileText size={20} />
                            </div>
                            <div className="cc-doc-info">
                              <strong>{doc.docType || "Verification Document"}</strong>
                              <small>{doc.fileName || "document_file"}</small>
                              <span
                                className={`cc-doc-status ${
                                  doc.verificationStatus === "VERIFIED"
                                    ? "verified"
                                    : doc.verificationStatus === "REJECTED"
                                    ? "rejected"
                                    : "pending"
                                }`}
                              >
                                {doc.verificationStatus || "PENDING"}
                              </span>
                            </div>
                            <div className="cc-doc-actions">
                              {doc.fileUrl && (
                                <a
                                  href={
                                    doc.fileUrl.startsWith("http")
                                      ? doc.fileUrl
                                      : `${API_URL.replace(/\/api\/?$/, "")}/${doc.fileUrl.replace(/^\//, "")}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cc-doc-link-btn"
                                  title="View Document"
                                >
                                  <ExternalLink size={14} /> Open
                                </a>
                              )}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  {/* Clarification Queries & Remarks Thread */}
                  <div className="cc-banker-section">
                    <div className="cc-banker-sec-title">
                      <MessageSquare size={16} /> Clarification Queries &amp; Resolution Thread (
                      {(selectedApp.queries || []).length})
                    </div>

                    {/* Query Form */}
                    <form className="cc-banker-query-form" onSubmit={handleRaiseQuery}>
                      <label>
                        <span>Need clarification or additional document? Raise a Query to Ops:</span>
                        <div className="cc-banker-query-input-shell">
                          <input
                            type="text"
                            placeholder="e.g. Need latest 3 months salary slip and 6 months bank statement with seal..."
                            value={newQueryText}
                            onChange={(e) => setNewQueryText(e.target.value)}
                          />
                          <button
                            type="submit"
                            className="cc-banker-query-send"
                            disabled={querySubmitting}
                          >
                            <Send size={15} /> {querySubmitting ? "Sending..." : "Raise Query"}
                          </button>
                        </div>
                      </label>
                    </form>

                    {/* Query List */}
                    {(selectedApp.queries || []).length === 0 ? (
                      <p style={{ fontSize: 13, color: "#94a3b8", marginTop: 12 }}>
                        No queries raised on this application yet.
                      </p>
                    ) : (
                      <div className="cc-banker-query-list">
                        {selectedApp.queries.map((q) => (
                          <div
                            key={q.id}
                            className={`cc-banker-query-item ${q.status === "RESOLVED" ? "resolved" : "open"}`}
                          >
                            <div className="cc-query-item-head">
                              <span className={`cc-query-tag ${q.status === "RESOLVED" ? "resolved" : "open"}`}>
                                {q.status === "RESOLVED" ? "RESOLVED" : "OPEN QUERY"}
                              </span>
                              <small>
                                Raised on {new Date(q.createdAt).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </small>
                            </div>
                            <p className="cc-query-text">
                              <strong>Query:</strong> {q.queryText}
                            </p>
                            {q.responseText ? (
                              <div className="cc-query-response">
                                <strong>Operations Response:</strong> {q.responseText}
                                {q.resolvedByOps?.name && (
                                  <small> — Answered by {q.resolvedByOps.name}</small>
                                )}
                              </div>
                            ) : (
                              <div className="cc-query-pending">
                                <Clock size={13} /> Awaiting response from CRM Operations team
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* Decision Modal (Approve, Disburse, Reject, etc.) */}
      {decisionModal && (
        <div className="cc-modal-overlay" onClick={() => setDecisionModal(null)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div>
                <p>Credit Underwriting</p>
                <h3>
                  {decisionModal === "SANCTION" && "Approve & Sanction Loan"}
                  {decisionModal === "DISBURSE" && "Confirm Loan Disbursement"}
                  {decisionModal === "REJECT" && "Reject Loan Application"}
                  {decisionModal === "UNDER_REVIEW" && "Mark Under Credit Review"}
                </h3>
              </div>
              <button type="button" onClick={() => setDecisionModal(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="cc-modal-form">
              {decisionModal === "SANCTION" && (
                <>
                  <label className="cc-modal-field">
                    <span>Approved Sanction Amount (₹) *</span>
                    <input
                      type="number"
                      placeholder="e.g. 500000"
                      value={decisionForm.sanctionedAmount}
                      onChange={(e) =>
                        setDecisionForm({ ...decisionForm, sanctionedAmount: e.target.value })
                      }
                      autoFocus
                      required
                    />
                  </label>
                  <label className="cc-modal-field">
                    <span>Sanction Remarks / Tenor / Interest Rate</span>
                    <textarea
                      rows={3}
                      placeholder="e.g. Approved at 10.5% ROI for 48 months tenor subject to final verification."
                      value={decisionForm.remarks}
                      onChange={(e) =>
                        setDecisionForm({ ...decisionForm, remarks: e.target.value })
                      }
                    />
                  </label>
                </>
              )}

              {decisionModal === "DISBURSE" && (
                <>
                  <label className="cc-modal-field">
                    <span>Disbursed Amount (₹) *</span>
                    <input
                      type="number"
                      placeholder="e.g. 500000"
                      value={decisionForm.disbursedAmount}
                      onChange={(e) =>
                        setDecisionForm({ ...decisionForm, disbursedAmount: e.target.value })
                      }
                      autoFocus
                      required
                    />
                  </label>
                  <label className="cc-modal-field">
                    <span>Disbursement UTR / Bank Reference &amp; Remarks</span>
                    <textarea
                      rows={3}
                      placeholder="e.g. Disbursed via NEFT UTR #HDFC00019284 to customer account."
                      value={decisionForm.remarks}
                      onChange={(e) =>
                        setDecisionForm({ ...decisionForm, remarks: e.target.value })
                      }
                    />
                  </label>
                </>
              )}

              {decisionModal === "REJECT" && (
                <>
                  <label className="cc-modal-field">
                    <span>Primary Rejection Reason *</span>
                    <select
                      value={decisionForm.rejectionReason}
                      onChange={(e) =>
                        setDecisionForm({ ...decisionForm, rejectionReason: e.target.value })
                      }
                    >
                      <option value="Low Credit Score">Low Credit / CIBIL Score</option>
                      <option value="High DTI Ratio">High Debt-to-Income (DTI) Ratio</option>
                      <option value="Incomplete Documents">Incomplete / Unverifiable Documents</option>
                      <option value="Salary Mismatch">Salary Mismatch with Bank Statement</option>
                      <option value="Location / Pin Unserviceable">Negative Pin / Location</option>
                      <option value="Other Policy Guideline">Other Institution Policy Criteria</option>
                    </select>
                  </label>
                  <label className="cc-modal-field">
                    <span>Detailed Rejection Remarks</span>
                    <textarea
                      rows={3}
                      placeholder="Detailed credit remarks regarding why this application was rejected..."
                      value={decisionForm.remarks}
                      onChange={(e) =>
                        setDecisionForm({ ...decisionForm, remarks: e.target.value })
                      }
                    />
                  </label>
                </>
              )}

              {decisionModal === "UNDER_REVIEW" && (
                <label className="cc-modal-field">
                  <span>Underwriting Remarks (Optional)</span>
                  <textarea
                    rows={3}
                    placeholder="e.g. Underwriting in progress by credit team."
                    value={decisionForm.remarks}
                    onChange={(e) =>
                      setDecisionForm({ ...decisionForm, remarks: e.target.value })
                    }
                  />
                </label>
              )}

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-btn ghost"
                  onClick={() => setDecisionModal(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`cc-modal-btn primary ${decisionModal === "REJECT" ? "danger" : ""}`}
                  onClick={handleDecisionSubmit}
                  disabled={decisionSubmitting}
                >
                  {decisionSubmitting
                    ? "Updating..."
                    : decisionModal === "SANCTION"
                    ? "Confirm Sanction"
                    : decisionModal === "DISBURSE"
                    ? "Confirm Disbursement"
                    : decisionModal === "REJECT"
                    ? "Reject Application"
                    : "Mark Under Review"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const bankerStyles = `
  .cc-banker-hero {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
    border-radius: 16px;
    padding: 24px 28px;
    color: #fff;
    margin-bottom: 20px;
    box-shadow: 0 10px 25px rgba(15, 23, 42, 0.15);
    flex-wrap: wrap;
    gap: 16px;
  }
  .cc-banker-hero-tag {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.05em;
    color: #34d399;
    margin-bottom: 8px;
  }
  .cc-banker-hero-copy h1 {
    margin: 0 0 6px;
    font-size: 24px;
    font-weight: 700;
    color: #f8fafc;
  }
  .cc-banker-hero-copy p {
    margin: 0;
    font-size: 13.5px;
    color: #94a3b8;
    max-width: 680px;
    line-height: 1.5;
  }
  .cc-banker-hero-badge {
    display: flex;
    align-items: center;
    gap: 12px;
    background: rgba(255, 255, 255, 0.08);
    border: 1px solid rgba(255, 255, 255, 0.15);
    padding: 12px 18px;
    border-radius: 12px;
    backdrop-filter: blur(10px);
  }
  .cc-banker-hero-badge svg {
    color: #10b981;
  }
  .cc-banker-hero-badge strong {
    display: block;
    font-size: 13px;
    color: #f8fafc;
  }
  .cc-banker-hero-badge small {
    display: block;
    font-size: 11px;
    color: #94a3b8;
  }

  .cc-banker-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
    gap: 14px;
    margin-bottom: 20px;
  }
  .cc-banker-kpi-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 16px 18px;
    display: flex;
    align-items: center;
    gap: 14px;
    box-shadow: 0 2px 5px rgba(15, 23, 42, 0.04);
  }
  .cc-banker-kpi-card.highlighted {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }
  .cc-banker-kpi-icon {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }
  .cc-banker-kpi-icon.total { background: #e0e7ff; color: #4338ca; }
  .cc-banker-kpi-icon.pending { background: #e0f2fe; color: #0369a1; }
  .cc-banker-kpi-icon.query { background: #fff1f2; color: #be123c; }
  .cc-banker-kpi-icon.sanction { background: #dcfce7; color: #15803d; }
  .cc-banker-kpi-content small {
    display: block;
    font-size: 12px;
    color: #64748b;
    font-weight: 500;
  }
  .cc-banker-kpi-content h3 {
    margin: 2px 0 0;
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
  }

  .cc-banker-filter-panel {
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .cc-banker-filter-bar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
  }
  .cc-banker-search {
    position: relative;
    flex: 1 1 260px;
    min-width: 220px;
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 12px 0 38px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #fff;
  }
  .cc-banker-search svg {
    position: absolute;
    left: 12px;
    color: #94a3b8;
  }
  .cc-banker-search input {
    width: 100%;
    border: 0;
    outline: none;
    font-size: 13px;
    color: #0f172a;
  }
  .cc-banker-search-clear {
    border: 0;
    background: #f1f5f9;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .cc-banker-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 10px;
    gap: 2px;
    overflow-x: auto;
  }
  .cc-banker-tabs button {
    border: 0;
    background: transparent;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    white-space: nowrap;
  }
  .cc-banker-tabs button.active {
    background: #fff;
    color: #047857;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
  .cc-banker-refresh-btn {
    border: 1px solid #cbd5e1;
    background: #fff;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: #475569;
    cursor: pointer;
  }
  .cc-banker-refresh-btn:hover {
    color: #047857;
    border-color: #047857;
  }

  .cc-banker-count { font-size: 13px; color: #64748b; font-weight: 600; }
  .cc-banker-sub { font-size: 12.5px; color: #64748b; margin: 2px 0 0; }

  .cc-banker-row { cursor: pointer; transition: background-color 0.12s; }
  .cc-banker-row:hover { background: #f8fafc; }
  .cc-banker-appnum { display: block; font-size: 13px; color: #0f172a; }
  .cc-banker-date { display: block; font-size: 11px; color: #94a3b8; }
  .cc-banker-cust strong { display: block; font-size: 13.5px; color: #0f172a; }
  .cc-banker-cust small { display: block; font-size: 11.5px; color: #64748b; }
  .cc-banker-product { font-size: 12.5px; font-weight: 600; color: #334155; }
  .cc-banker-amount { font-size: 13.5px; font-weight: 700; color: #0f172a; }
  .cc-banker-sanctioned-amt { font-size: 13.5px; font-weight: 700; color: #15803d; }
  .cc-banker-lender { font-size: 12px; font-weight: 600; color: #4338ca; background: #eef2ff; padding: 3px 8px; border-radius: 6px; }

  .cc-banker-query-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
  }
  .cc-banker-query-pill.alert { background: #fff1f2; color: #be123c; }
  .cc-banker-query-pill.resolved { background: #f0fdf4; color: #15803d; }

  .cc-banker-review-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 12px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #047857;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .cc-banker-review-btn:hover {
    background: #047857;
    color: #fff;
    border-color: #047857;
  }

  /* Drawer / Modal Layout */
  .cc-banker-drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    z-index: 100;
    display: flex;
    justify-content: flex-end;
  }
  .cc-banker-drawer {
    width: 100%;
    max-width: 780px;
    background: #fff;
    height: 100vh;
    display: flex;
    flex-direction: column;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.15);
    animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes slideInRight {
    from { transform: translateX(100%); }
    to { transform: translateX(0); }
  }
  .cc-banker-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .cc-banker-drawer-header h2 {
    margin: 0;
    font-size: 20px;
    font-weight: 700;
    color: #0f172a;
  }
  .cc-banker-drawer-header p {
    margin: 4px 0 0;
    font-size: 12.5px;
    color: #64748b;
  }
  .cc-banker-drawer-close {
    border: 0;
    background: #e2e8f0;
    color: #475569;
    width: 34px;
    height: 34px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .cc-banker-drawer-close:hover { background: #cbd5e1; color: #0f172a; }

  .cc-banker-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .cc-banker-summary-row {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
  }
  .cc-banker-sum-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px 16px;
  }
  .cc-banker-sum-card small { display: block; font-size: 11.5px; color: #64748b; }
  .cc-banker-sum-card h4 { margin: 4px 0 0; font-size: 16px; font-weight: 700; color: #0f172a; }

  .cc-banker-decision-bar {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cc-banker-decision-label strong {
    font-size: 13px;
    color: #166534;
  }
  .cc-banker-decision-btns {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cc-decision-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    border: 0;
    cursor: pointer;
    transition: transform 0.1s;
  }
  .cc-decision-btn:active { transform: scale(0.97); }
  .cc-decision-btn.sanction { background: #047857; color: #fff; }
  .cc-decision-btn.disburse { background: #0d9488; color: #fff; }
  .cc-decision-btn.review { background: #e0f2fe; color: #0369a1; border: 1px solid #bae6fd; }
  .cc-decision-btn.reject { background: #fee2e2; color: #b91c1c; border: 1px solid #fecaca; }

  .cc-banker-section {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    background: #fff;
  }
  .cc-banker-sec-title {
    display: flex;
    align-items: center;
    gap: 8px;
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    margin-bottom: 14px;
  }

  .cc-banker-profile-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 12px;
  }
  .cc-profile-item label { display: block; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
  .cc-profile-item span { display: block; font-size: 13px; color: #0f172a; margin-top: 2px; }

  .cc-banker-docs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(280px, 1fr));
    gap: 10px;
  }
  .cc-banker-doc-card {
    display: flex;
    align-items: center;
    gap: 10px;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 14px;
    background: #f8fafc;
  }
  .cc-doc-icon {
    width: 36px;
    height: 36px;
    border-radius: 8px;
    background: #e2e8f0;
    display: grid;
    place-items: center;
    color: #475569;
    flex-shrink: 0;
  }
  .cc-doc-info { flex: 1; }
  .cc-doc-info strong { display: block; font-size: 12.5px; color: #0f172a; }
  .cc-doc-info small { display: block; font-size: 11px; color: #64748b; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; max-width: 160px; }
  .cc-doc-status {
    display: inline-block;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    margin-top: 3px;
  }
  .cc-doc-status.verified { background: #dcfce7; color: #166534; }
  .cc-doc-status.rejected { background: #fee2e2; color: #991b1b; }
  .cc-doc-status.pending { background: #fef3c7; color: #92400e; }
  .cc-doc-link-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 10px;
    border-radius: 6px;
    background: #fff;
    border: 1px solid #cbd5e1;
    color: #0f172a;
    font-size: 11.5px;
    font-weight: 600;
    text-decoration: none;
  }
  .cc-doc-link-btn:hover { background: #047857; color: #fff; border-color: #047857; }

  .cc-banker-empty-box {
    text-align: center;
    padding: 24px;
    background: #f8fafc;
    border-radius: 10px;
    border: 1px dashed #cbd5e1;
  }
  .cc-banker-empty-box p { margin: 0; font-size: 13px; font-weight: 600; color: #475569; }
  .cc-banker-empty-box small { display: block; font-size: 11.5px; color: #94a3b8; margin-top: 4px; }

  .cc-banker-query-form label span {
    display: block;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    margin-bottom: 6px;
  }
  .cc-banker-query-input-shell {
    display: flex;
    gap: 8px;
  }
  .cc-banker-query-input-shell input {
    flex: 1;
    height: 40px;
    padding: 0 14px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 13px;
    color: #0f172a;
  }
  .cc-banker-query-input-shell input:focus {
    border-color: #047857;
    outline: none;
    box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.12);
  }
  .cc-banker-query-send {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 0 16px;
    background: #047857;
    color: #fff;
    border: 0;
    border-radius: 10px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
  }

  .cc-banker-query-list {
    display: flex;
    flex-direction: column;
    gap: 10px;
    margin-top: 14px;
  }
  .cc-banker-query-item {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    background: #f8fafc;
  }
  .cc-banker-query-item.open { border-left: 4px solid #f43f5e; }
  .cc-banker-query-item.resolved { border-left: 4px solid #10b981; }
  .cc-query-item-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .cc-query-tag {
    font-size: 10px;
    font-weight: 700;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .cc-query-tag.open { background: #fff1f2; color: #be123c; }
  .cc-query-tag.resolved { background: #dcfce7; color: #166534; }
  .cc-query-text { margin: 0; font-size: 13px; color: #0f172a; }
  .cc-query-response {
    margin-top: 8px;
    padding: 8px 12px;
    background: #fff;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    font-size: 12.5px;
    color: #065f46;
  }
  .cc-query-pending {
    margin-top: 6px;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    color: #94a3b8;
  }

  .cc-spin {
    animation: spin 1s linear infinite;
  }
  @keyframes spin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  /* Banker Drawer Overlay & Modals */
  .cc-banker-drawer-overlay {
    position: fixed;
    inset: 0;
    z-index: 998;
    display: flex;
    justify-content: flex-end;
    align-items: stretch;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(3px);
  }

  .cc-modal-overlay {
    position: fixed;
    inset: 0;
    z-index: 999;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    padding: 16px;
    overflow-y: auto;
  }

  .cc-modal-card {
    width: 100%;
    max-width: 540px;
    background: #ffffff;
    border-radius: 18px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 24px 64px rgba(15, 23, 42, 0.35);
    max-height: 92vh;
    overflow-y: auto;
    position: relative;
    animation: ccModalPop 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  }

  .cc-modal-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .cc-modal-head p {
    margin: 0;
    font-size: 11px;
    text-transform: uppercase;
    font-weight: 700;
    color: #047857;
    letter-spacing: 0.05em;
  }

  .cc-modal-head h3 {
    margin: 2px 0 0 0;
    font-size: 18px;
    color: #0f172a;
    font-weight: 700;
  }

  .cc-modal-head button {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 0;
    background: #f1f5f9;
    color: #64748b;
    cursor: pointer;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .cc-modal-head button:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  .cc-modal-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .cc-modal-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 600;
    color: #334155;
  }

  .cc-modal-field input,
  .cc-modal-field select,
  .cc-modal-field textarea {
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 13.5px;
    color: #0f172a;
    background: #fff;
    font-family: inherit;
    outline: none;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .cc-modal-field input:focus,
  .cc-modal-field select:focus,
  .cc-modal-field textarea:focus {
    border-color: #047857;
    box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.12);
  }

  .cc-modal-field small {
    font-size: 11.5px;
    color: #64748b;
    font-weight: 400;
  }

  .cc-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }

  .cc-modal-btn {
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    border: 1px solid transparent;
  }

  .cc-modal-btn.ghost {
    background: #f1f5f9;
    color: #475569;
    border-color: #e2e8f0;
  }

  .cc-modal-btn.ghost:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  .cc-modal-btn.primary {
    background: #047857;
    color: #ffffff;
  }

  .cc-modal-btn.primary:hover {
    background: #065f46;
  }

  .cc-modal-btn.primary.danger {
    background: #dc2626;
  }

  .cc-modal-btn.primary.danger:hover {
    background: #b91c1c;
  }

  .cc-modal-btn:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;
