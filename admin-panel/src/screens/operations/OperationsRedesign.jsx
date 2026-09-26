import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  Building2,
  CalendarDays,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Copy,
  ExternalLink,
  Eye,
  FileCheck,
  FileSearch,
  FileText,
  Filter,
  HelpCircle,
  IndianRupee,
  Kanban,
  Layers,
  List,
  Mail,
  MessageSquare,
  Paperclip,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  ShieldAlert,
  ShieldCheck,
  Upload,
  User,
  UserCheck,
  Users,
  X,
  XCircle,
} from "lucide-react";
import API_URL from "../../config";
import CcPagination from "../../components/CcPagination";

const PAGE_SIZE = 20;
const numberFormatter = new Intl.NumberFormat("en-IN");
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const isStatusCompleted = (status) => {
  if (!status) return false;
  const s = String(status).toUpperCase();
  return s === "SANCTIONED" || s === "DISBURSED" || s === "APPROVED" || s === "COMPLETED" || s === "CLOSED";
};

const renderStatusBadge = (status) => {
  const isCompleted = isStatusCompleted(status);
  const s = String(status || "PENDING").toUpperCase();
  const isRejected = s === "REJECTED" || s === "CANCELLED";

  if (isCompleted) {
    return (
      <span className="cc-ops-status-tag completed-green" title="Completed Stage">
        <CheckCircle2 size={13} /> {status || "COMPLETED"}
      </span>
    );
  }
  if (isRejected) {
    return (
      <span className="cc-ops-status-tag rejected" title="Rejected">
        <XCircle size={13} /> {status}
      </span>
    );
  }
  return (
    <span className="cc-ops-status-tag pending-amber" title="Pending File">
      <Clock size={12} /> {status || "PENDING"}
    </span>
  );
};

const PIPELINE_STAGES = [
  { key: "DOCS_PENDING", label: "Docs Pending", color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
  { key: "UNDER_VERIFICATION", label: "Under Verification", color: "#0369a1", bg: "#e0f2fe", border: "#bae6fd" },
  { key: "SUBMITTED_TO_BANK", label: "Submitted to Bank", color: "#4338ca", bg: "#e0e7ff", border: "#c7d2fe" },
  { key: "QUERY_RAISED", label: "Query Raised", color: "#be123c", bg: "#fff1f2", border: "#fecdd3" },
  { key: "SANCTIONED", label: "Sanctioned", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  { key: "DISBURSED", label: "Disbursed", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  { key: "REJECTED", label: "Rejected", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
];

export default function OperationsRedesign() {
  const navigate = useNavigate();
  const employeeId = localStorage.getItem("employeeId");
  const employeeRole = localStorage.getItem("employeeRole");

  // Navigation View: "pipeline" (Applications Kanban/Table) | "leads" (Operations Leads Queue)
  const [viewMode, setViewMode] = useState("pipeline");
  const [displayType, setDisplayType] = useState("table"); // Default to "table" per user requirement

  // Date & Period Filter State (Date Wise, Month Wise, Financial Year Wise)
  const [filterPeriodType, setFilterPeriodType] = useState("all"); // "all" | "custom" | "month" | "fy"
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedFY, setSelectedFY] = useState("");
  const [selectedLenderFilter, setSelectedLenderFilter] = useState("ALL");

  // Applications & Pipeline State
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appSearch, setAppSearch] = useState("");
  const [debouncedAppSearch, setDebouncedAppSearch] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState("ALL");
  const [appCurrentPage, setAppCurrentPage] = useState(1);
  const [appTotalPages, setAppTotalPages] = useState(1);
  const [appTotalItems, setAppTotalItems] = useState(0);

  // Leads Queue State
  const [leads, setLeads] = useState([]);
  const [leadsLoading, setLeadsLoading] = useState(false);
  const [leadSearch, setLeadSearch] = useState("");
  const [debouncedLeadSearch, setDebouncedLeadSearch] = useState("");
  const [leadStatusCategory, setLeadStatusCategory] = useState("ALL"); // "ALL" | "PENDING" | "COMPLETED"
  const [leadCurrentPage, setLeadCurrentPage] = useState(1);
  const [leadTotalPages, setLeadTotalPages] = useState(1);
  const [leadTotalItems, setLeadTotalItems] = useState(0);

  // Open Banker Queries Widget State
  const [openQueries, setOpenQueries] = useState([]);
  const [queriesLoading, setQueriesLoading] = useState(false);
  const [replyTargetQuery, setReplyTargetQuery] = useState(null);
  const [replyResponseText, setReplyResponseText] = useState("");
  const [replySubmitting, setReplySubmitting] = useState(false);

  // Application / Document Verification Center Drawer
  const [verificationApp, setVerificationApp] = useState(null);
  const [verificationLoading, setVerificationLoading] = useState(false);
  const [docRejectTarget, setDocRejectTarget] = useState(null);
  const [docRejectionReason, setDocRejectionReason] = useState("");
  const [docVerifying, setDocVerifying] = useState(false);

  // Upload Document State (Ops uploading for customer)
  const [masterDocTypes, setMasterDocTypes] = useState([]);
  const [uploadDocType, setUploadDocType] = useState("PAN Card");
  const [uploadFile, setUploadFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // 1-Click Lead -> Loan Application Modal
  const [convertLead, setConvertLead] = useState(null);
  const [lenders, setLenders] = useState([]);
  const [bankers, setBankers] = useState([]);
  const [convertForm, setConvertForm] = useState({
    loanProduct: "Personal Loan",
    appliedAmount: "",
    lenderId: "",
    assignedBankerId: "",
  });
  const [convertSubmitting, setConvertSubmitting] = useState(false);

  // Bank Email Dispatch Modal State
  const [bankMailModalApp, setBankMailModalApp] = useState(null);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [bankMailLoading, setBankMailLoading] = useState(false);
  const [bankMailSubmitting, setBankMailSubmitting] = useState(false);
  const [mailActiveTab, setMailActiveTab] = useState("compose"); // "compose" | "preview"
  const [mailForm, setMailForm] = useState({
    lenderId: "",
    toEmail: "",
    ccEmails: "",
    templateId: "",
    subject: "",
    content: "",
    selectedDocIds: [],
    updateStatus: "FILE_LOGIN",
  });
  const mailSubjectRef = useRef(null);
  const mailContentRef = useRef(null);

  // Financial Years list (Indian FY starting April 1)
  const financialYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const baseYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    const list = [];
    for (let y = baseYear + 1; y >= baseYear - 3; y--) {
      list.push(`${y}-${String(y + 1).slice(-2)}`);
    }
    return list;
  }, []);

  // Available past and upcoming months
  const availableMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });
      list.push({ val, label });
    }
    return list;
  }, []);

  // Fetch Auxiliary Lenders, Bankers, and Master Document Types
  const fetchAuxData = async () => {
    try {
      const [lenderRes, bankerRes, docTypeRes] = await Promise.all([
        axios.get(`${API_URL}/lenders`, { params: { includeInactive: false } }),
        axios.get(`${API_URL}/users`, { params: { role: "BANKER", limit: 100 } }),
        axios.get(`${API_URL}/master-configs/DOC_TYPE`, { params: { includeInactive: false } }).catch(() => ({ data: { data: [] } })),
      ]);
      setLenders(lenderRes.data?.lenders || lenderRes.data?.data || []);
      setBankers(bankerRes.data?.data || bankerRes.data?.users || []);
      const docTypesList = docTypeRes.data?.data || [];
      setMasterDocTypes(docTypesList);
      if (docTypesList.length > 0) {
        setUploadDocType(docTypesList[0].label || docTypesList[0].value);
      }
    } catch (error) {
      console.error("Error fetching aux data:", error);
    }
  };

  // Fetch Open Banker Queries
  const fetchOpenQueries = async () => {
    setQueriesLoading(true);
    try {
      const res = await axios.get(`${API_URL}/applications/queries/all`, {
        params: { status: "OPEN", limit: 50 },
      });
      setOpenQueries(res.data?.queries || []);
    } catch (error) {
      console.error("Error fetching open queries:", error);
    } finally {
      setQueriesLoading(false);
    }
  };

  // Fetch Applications with all date, month, financial year, and bank filters
  const fetchApplications = useCallback(async (page = 1) => {
    setAppsLoading(true);
    try {
      const params = {
        page,
        limit: displayType === "kanban" ? 150 : PAGE_SIZE,
        search: debouncedAppSearch || undefined,
        status: selectedStageFilter !== "ALL" ? selectedStageFilter : undefined,
        lenderId: selectedLenderFilter !== "ALL" ? selectedLenderFilter : undefined,
        fromDate: filterPeriodType === "custom" && customFromDate ? customFromDate : undefined,
        toDate: filterPeriodType === "custom" && customToDate ? customToDate : undefined,
        month: filterPeriodType === "month" && selectedMonth ? selectedMonth : undefined,
        financialYear: filterPeriodType === "fy" && selectedFY ? selectedFY : undefined,
      };
      const res = await axios.get(`${API_URL}/applications`, { params });
      setApplications(res.data?.applications || res.data?.data || []);
      const pagination = res.data?.pagination || {};
      setAppTotalPages(pagination.totalPages || 1);
      setAppTotalItems(pagination.totalItems || 0);
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast.error("Could not load loan applications");
      setApplications([]);
    } finally {
      setAppsLoading(false);
    }
  }, [
    debouncedAppSearch,
    selectedStageFilter,
    selectedLenderFilter,
    displayType,
    filterPeriodType,
    customFromDate,
    customToDate,
    selectedMonth,
    selectedFY,
  ]);

  // Fetch Leads Passed to Ops with Date, Month, and FY filters
  const fetchLeads = useCallback(async (page = 1) => {
    setLeadsLoading(true);
    try {
      const endpoint = `${API_URL}/leads`;
      const params = {
        limit: PAGE_SIZE,
        page,
        search: debouncedLeadSearch || undefined,
        team: "operations",
        statusCategory: leadStatusCategory !== "ALL" ? leadStatusCategory : undefined,
        lenderId: selectedLenderFilter !== "ALL" ? selectedLenderFilter : undefined,
        fromDate: filterPeriodType === "custom" && customFromDate ? customFromDate : undefined,
        toDate: filterPeriodType === "custom" && customToDate ? customToDate : undefined,
        month: filterPeriodType === "month" && selectedMonth ? selectedMonth : undefined,
        financialYear: filterPeriodType === "fy" && selectedFY ? selectedFY : undefined,
      };
      const res = await axios.get(endpoint, { params });
      const list = res.data?.data || res.data?.leads || (Array.isArray(res.data) ? res.data : []);
      const pagination = res.data?.pagination || {};
      setLeads(list);
      setLeadTotalPages(pagination.totalPages || 1);
      setLeadTotalItems(pagination.totalItems ?? pagination.total ?? list.length);
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Could not load operations leads");
      setLeads([]);
    } finally {
      setLeadsLoading(false);
    }
  }, [
    debouncedLeadSearch,
    leadStatusCategory,
    selectedLenderFilter,
    filterPeriodType,
    customFromDate,
    customToDate,
    selectedMonth,
    selectedFY,
  ]);

  useEffect(() => {
    fetchAuxData();
    fetchOpenQueries();
  }, []);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedAppSearch(appSearch);
      setAppCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [appSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedLeadSearch(leadSearch);
      setLeadCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [leadSearch]);

  useEffect(() => {
    if (viewMode === "pipeline") {
      fetchApplications(appCurrentPage);
    } else {
      fetchLeads(leadCurrentPage);
    }
  }, [
    viewMode,
    fetchApplications,
    appCurrentPage,
    fetchLeads,
    leadCurrentPage,
    leadStatusCategory,
    filterPeriodType,
    customFromDate,
    customToDate,
    selectedMonth,
    selectedFY,
    selectedLenderFilter,
  ]);

  const hasActiveFilters = useMemo(() => {
    return (
      filterPeriodType !== "all" ||
      selectedLenderFilter !== "ALL" ||
      (viewMode === "pipeline"
        ? selectedStageFilter !== "ALL" || Boolean(appSearch)
        : leadStatusCategory !== "ALL" || Boolean(leadSearch))
    );
  }, [filterPeriodType, selectedLenderFilter, viewMode, selectedStageFilter, appSearch, leadStatusCategory, leadSearch]);

  const resetAllFilters = () => {
    setFilterPeriodType("all");
    setCustomFromDate("");
    setCustomToDate("");
    setSelectedMonth("");
    setSelectedFY("");
    setSelectedLenderFilter("ALL");
    if (viewMode === "pipeline") {
      setSelectedStageFilter("ALL");
      setAppSearch("");
      setAppCurrentPage(1);
    } else {
      setLeadStatusCategory("ALL");
      setLeadSearch("");
      setLeadCurrentPage(1);
    }
  };

  const renderFilterToolbar = (isPipeline) => (
    <section className="cc-report-panel cc-ops-filter-panel">
      <div className="cc-ops-filter-bar">
        {/* Search Input */}
        <label className="cc-ops-search-box">
          <Search size={16} />
          <input
            type="search"
            placeholder={
              isPipeline
                ? "Search applications by App #, applicant, phone, loan product..."
                : "Search leads by customer, phone, owner, loan type..."
            }
            value={isPipeline ? appSearch : leadSearch}
            onChange={(e) => {
              if (isPipeline) setAppSearch(e.target.value);
              else setLeadSearch(e.target.value);
            }}
          />
          {(isPipeline ? appSearch : leadSearch) && (
            <button
              type="button"
              className="cc-search-clear"
              onClick={() => {
                if (isPipeline) setAppSearch("");
                else setLeadSearch("");
              }}
            >
              <X size={13} />
            </button>
          )}
        </label>

        {/* Assigned Bank Filter */}
        <div className="cc-ops-filter-control">
          <Building2 size={14} className="cc-filter-icon" />
          <select
            value={selectedLenderFilter}
            onChange={(e) => {
              setSelectedLenderFilter(e.target.value);
              setAppCurrentPage(1);
              setLeadCurrentPage(1);
            }}
            className="cc-ops-select"
            title="Filter by Assigned Bank"
          >
            <option value="ALL">🏛️ All Assigned Banks</option>
            {lenders.map((l) => (
              <option key={l.id || l.lender_id} value={l.id || l.lender_id}>
                {l.name} {l.shortCode ? `(${l.shortCode})` : ""}
              </option>
            ))}
          </select>
        </div>

        {/* Time Period Filter Type */}
        <div className="cc-ops-filter-control">
          <CalendarDays size={14} className="cc-filter-icon" />
          <select
            value={filterPeriodType}
            onChange={(e) => {
              const val = e.target.value;
              setFilterPeriodType(val);
              if (val === "month" && !selectedMonth && availableMonths.length > 0) {
                setSelectedMonth(availableMonths[0].val);
              }
              if (val === "fy" && !selectedFY && financialYears.length > 0) {
                setSelectedFY(financialYears[0]);
              }
              setAppCurrentPage(1);
              setLeadCurrentPage(1);
            }}
            className="cc-ops-select"
            title="Filter by Period (Date, Month, Financial Year)"
          >
            <option value="all">📅 All Dates</option>
            <option value="custom">📆 Date Wise (Range)</option>
            <option value="month">🗓️ Month Wise</option>
            <option value="fy">📊 Financial Year Wise</option>
          </select>
        </div>

        {/* Custom Date Range (From - To) */}
        {filterPeriodType === "custom" && (
          <div className="cc-ops-date-range-inputs">
            <label className="cc-date-field">
              <span>From:</span>
              <input
                type="date"
                value={customFromDate}
                onChange={(e) => {
                  setCustomFromDate(e.target.value);
                  setAppCurrentPage(1);
                  setLeadCurrentPage(1);
                }}
                className="cc-ops-date-input"
              />
            </label>
            <label className="cc-date-field">
              <span>To:</span>
              <input
                type="date"
                value={customToDate}
                onChange={(e) => {
                  setCustomToDate(e.target.value);
                  setAppCurrentPage(1);
                  setLeadCurrentPage(1);
                }}
                className="cc-ops-date-input"
              />
            </label>
          </div>
        )}

        {/* Month Selector */}
        {filterPeriodType === "month" && (
          <div className="cc-ops-filter-control">
            <select
              value={selectedMonth || (availableMonths[0] && availableMonths[0].val) || ""}
              onChange={(e) => {
                setSelectedMonth(e.target.value);
                setAppCurrentPage(1);
                setLeadCurrentPage(1);
              }}
              className="cc-ops-select highlight"
            >
              {availableMonths.map((m) => (
                <option key={m.val} value={m.val}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Financial Year Selector */}
        {filterPeriodType === "fy" && (
          <div className="cc-ops-filter-control">
            <select
              value={selectedFY || financialYears[0] || ""}
              onChange={(e) => {
                setSelectedFY(e.target.value);
                setAppCurrentPage(1);
                setLeadCurrentPage(1);
              }}
              className="cc-ops-select highlight"
            >
              {financialYears.map((fy) => (
                <option key={fy} value={fy}>
                  FY {fy} (Apr - Mar)
                </option>
              ))}
            </select>
          </div>
        )}

        {/* Clear Filters Button */}
        {hasActiveFilters && (
          <button
            type="button"
            className="cc-ops-clear-filters-btn"
            onClick={resetAllFilters}
            title="Reset All Filters"
          >
            <X size={13} /> Clear Filters
          </button>
        )}

        {/* Refresh Button */}
        <button
          type="button"
          className="cc-ops-icon-refresh"
          onClick={() => {
            if (isPipeline) {
              fetchApplications(appCurrentPage);
            } else {
              fetchLeads(leadCurrentPage);
            }
            fetchOpenQueries();
          }}
          title="Refresh Data"
        >
          <RefreshCw size={15} />
        </button>
      </div>

      {/* Stage / Status Quick Filter Tabs */}
      <div className="cc-ops-filter-tabs-row" style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
        {isPipeline ? (
          <div className="cc-ops-stage-filter-tabs">
            <button
              type="button"
              className={selectedStageFilter === "ALL" ? "active" : ""}
              onClick={() => {
                setSelectedStageFilter("ALL");
                setAppCurrentPage(1);
              }}
            >
              All Files ({appTotalItems})
            </button>
            <button
              type="button"
              className={`pending-tab ${selectedStageFilter === "PENDING_STAGES" ? "active" : ""}`}
              onClick={() => {
                setSelectedStageFilter("PENDING_STAGES");
                setAppCurrentPage(1);
              }}
            >
              ⏳ Pending Files
            </button>
            <button
              type="button"
              className={`completed-tab ${selectedStageFilter === "COMPLETED_STAGES" ? "active" : ""}`}
              onClick={() => {
                setSelectedStageFilter("COMPLETED_STAGES");
                setAppCurrentPage(1);
              }}
            >
              ✅ Completed Files (Green)
            </button>
            {PIPELINE_STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                className={selectedStageFilter === s.key ? "active" : ""}
                onClick={() => {
                  setSelectedStageFilter(s.key);
                  setAppCurrentPage(1);
                }}
              >
                {s.label}
              </button>
            ))}
          </div>
        ) : (
          <div className="cc-ops-stage-filter-tabs">
            <button
              type="button"
              className={leadStatusCategory === "ALL" ? "active" : ""}
              onClick={() => {
                setLeadStatusCategory("ALL");
                setLeadCurrentPage(1);
              }}
            >
              All Leads ({leadTotalItems})
            </button>
            <button
              type="button"
              className={`pending-tab ${leadStatusCategory === "PENDING" ? "active" : ""}`}
              onClick={() => {
                setLeadStatusCategory("PENDING");
                setLeadCurrentPage(1);
              }}
            >
              ⏳ Pending Leads
            </button>
            <button
              type="button"
              className={`completed-tab ${leadStatusCategory === "COMPLETED" ? "active" : ""}`}
              onClick={() => {
                setLeadStatusCategory("COMPLETED");
                setLeadCurrentPage(1);
              }}
            >
              ✅ Completed Leads (Green)
            </button>
          </div>
        )}
      </div>
    </section>
  );

  // Open Full Verification Drawer for Application
  const openVerificationDrawer = async (app) => {
    setVerificationLoading(true);
    setVerificationApp(app);
    try {
      const res = await axios.get(`${API_URL}/applications/${app.id}`);
      setVerificationApp(res.data?.application || app);
    } catch (error) {
      console.error("Error loading application detail:", error);
      toast.error("Could not load application documents");
    } finally {
      setVerificationLoading(false);
    }
  };

  // Verify Document Action
  const handleVerifyDoc = async (docId, status, reason = "") => {
    setDocVerifying(true);
    try {
      await axios.patch(`${API_URL}/documents/${docId}/verify`, {
        status,
        rejectionReason: reason || undefined,
      });
      toast.success(
        status === "VERIFIED"
          ? "Document marked as Verified!"
          : status === "REUPLOAD_REQUIRED"
          ? "Re-upload requested from customer"
          : "Document rejected"
      );
      setDocRejectTarget(null);
      setDocRejectionReason("");

      // Refresh drawer
      if (verificationApp) {
        const res = await axios.get(`${API_URL}/applications/${verificationApp.id}`);
        setVerificationApp(res.data?.application);
      }
      fetchApplications(appCurrentPage);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to verify document");
    } finally {
      setDocVerifying(false);
    }
  };

  // Upload Missing Document on Behalf of Customer
  const handleUploadDocumentSubmit = async (e) => {
    e.preventDefault();
    if (!uploadFile) {
      toast.warning("Please choose a file to upload");
      return;
    }
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", uploadFile);
      formData.append("docType", uploadDocType);
      if (verificationApp.customerId) formData.append("customerId", verificationApp.customerId);
      if (verificationApp.leadId) formData.append("leadId", verificationApp.leadId);
      if (verificationApp.id) formData.append("applicationId", verificationApp.id);

      await axios.post(`${API_URL}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${uploadDocType} uploaded successfully!`);
      setUploadFile(null);

      // Refresh
      const res = await axios.get(`${API_URL}/applications/${verificationApp.id}`);
      setVerificationApp(res.data?.application);
      fetchApplications(appCurrentPage);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Transition Application Pipeline Stage
  const handleStageTransition = async (appId, newStatus) => {
    try {
      await axios.patch(`${API_URL}/applications/${appId}/status`, { status: newStatus });
      toast.success(`Application stage updated to ${newStatus.replace(/_/g, " ")}`);
      fetchApplications(appCurrentPage);
      if (verificationApp && verificationApp.id === appId) {
        setVerificationApp((prev) => ({ ...prev, status: newStatus }));
      }
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to update application stage");
    }
  };

  // Helper to replace {{placeholder}} tags
  const renderTemplateVariables = (tplString = "", varMap = {}) => {
    if (!tplString) return "";
    let out = tplString;
    for (const [k, v] of Object.entries(varMap)) {
      out = out.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), v ?? "");
    }
    return out;
  };

  const getApplicationVarMap = (app, currentLender) => {
    const docs = app.documents || [];
    const docBullets =
      docs.length > 0
        ? docs.map((d) => `• ${d.docType}: ${d.fileName}`).join("\n")
        : "• No documents attached";

    return {
      customer_name: app.customer?.name || "Customer",
      application_number: app.applicationNumber || "",
      loan_product: app.loanProduct || "",
      loan_amount: app.appliedAmount ? Number(app.appliedAmount).toLocaleString("en-IN") : "0",
      bank_name: currentLender?.name || app.lender?.name || "Bank",
      bank_rm_name: currentLender?.contact_person || currentLender?.contactPerson || "Relationship Manager",
      mobile: app.customer?.mobile || "",
      email: app.customer?.email || "",
      pan: app.customer?.panNumber || app.customer?.pan || "—",
      documents_list: docBullets,
      company_name: localStorage.getItem("companyName") || "CapitalCare Financial",
      sender_name: localStorage.getItem("name") || "Operations Team",
    };
  };

  // Open Bank Email Dispatch Modal
  const openBankMailModal = async (app) => {
    setBankMailLoading(true);
    setBankMailModalApp(app);
    setMailActiveTab("compose");

    try {
      const [appRes, tplRes] = await Promise.all([
        axios.get(`${API_URL}/applications/${app.id}`),
        axios.get(`${API_URL}/email-templates`),
      ]);

      const fullApp = appRes.data?.application || app;
      setBankMailModalApp(fullApp);

      const tpls = tplRes.data?.templates || tplRes.data?.data || [];
      setEmailTemplates(tpls);

      const currentLenderId = fullApp.lenderId || (lenders[0]?.lender_id || lenders[0]?.id || "");
      const currentLender = lenders.find(
        (l) => String(l.lender_id || l.id) === String(currentLenderId)
      );

      const defaultToEmail =
        currentLender?.rm_email ||
        currentLender?.rmEmail ||
        currentLender?.bank_email ||
        currentLender?.bankEmail ||
        "";

      const defaultTpl =
        tpls.find((t) => t.isDefault) ||
        tpls[0] || {
          subject: "[Loan Docket] Application Submission - {{customer_name}} | {{loan_product}} (Ref: {{application_number}})",
          content:
            "Dear {{bank_rm_name}},\n\nPlease find attached the verified loan docket and customer KYC documents for processing:\n\nApplicant Details:\n• Customer Name: {{customer_name}}\n• Mobile: {{mobile}}\n• PAN: {{pan}}\n• Loan Product: {{loan_product}}\n• Loan Amount: ₹{{loan_amount}}\n• Application Ref: {{application_number}}\n\nAttached Documents:\n{{documents_list}}\n\nKindly initiate file login at the earliest.\n\nBest regards,\n{{sender_name}}\n{{company_name}}",
        };

      const varMap = getApplicationVarMap(fullApp, currentLender);
      const evalSubject = renderTemplateVariables(defaultTpl.subject, varMap);
      const evalContent = renderTemplateVariables(defaultTpl.content, varMap);

      // Select ALL customer documents by default!
      const allDocIds = (fullApp.documents || []).map((d) => d.id);

      setMailForm({
        lenderId: currentLenderId,
        toEmail: defaultToEmail,
        ccEmails: "",
        templateId: defaultTpl.id || "",
        subject: evalSubject,
        content: evalContent,
        selectedDocIds: allDocIds,
        updateStatus: "FILE_LOGIN",
      });
    } catch (err) {
      console.error("Error opening bank email modal:", err);
      toast.error("Could not prepare email dispatch");
    } finally {
      setBankMailLoading(false);
    }
  };

  const handleBankChange = (newLenderId) => {
    const currentLender = lenders.find((l) => String(l.lender_id || l.id) === String(newLenderId));
    const toEmail =
      currentLender?.rm_email ||
      currentLender?.rmEmail ||
      currentLender?.bank_email ||
      currentLender?.bankEmail ||
      "";

    setMailForm((prev) => {
      let nextSubject = prev.subject;
      let nextContent = prev.content;
      if (bankMailModalApp && currentLender) {
        const varMap = getApplicationVarMap(bankMailModalApp, currentLender);
        // If a template was selected, re-evaluate with new bank name and RM
        const activeTpl = emailTemplates.find((t) => String(t.id) === String(prev.templateId));
        if (activeTpl) {
          nextSubject = renderTemplateVariables(activeTpl.subject, varMap);
          nextContent = renderTemplateVariables(activeTpl.content, varMap);
        }
      }
      return {
        ...prev,
        lenderId: newLenderId,
        toEmail: toEmail || prev.toEmail,
        subject: nextSubject,
        content: nextContent,
      };
    });
  };

  const handleTemplateChange = (tplId) => {
    const chosenTpl = emailTemplates.find((t) => String(t.id) === String(tplId));
    if (!chosenTpl || !bankMailModalApp) return;

    const currentLender = lenders.find(
      (l) => String(l.lender_id || l.id) === String(mailForm.lenderId)
    );
    const varMap = getApplicationVarMap(bankMailModalApp, currentLender);

    setMailForm((prev) => ({
      ...prev,
      templateId: tplId,
      subject: renderTemplateVariables(chosenTpl.subject, varMap),
      content: renderTemplateVariables(chosenTpl.content, varMap),
    }));
  };

  const toggleDocumentAttachment = (docId) => {
    setMailForm((prev) => {
      const exists = prev.selectedDocIds.includes(docId);
      return {
        ...prev,
        selectedDocIds: exists
          ? prev.selectedDocIds.filter((id) => id !== docId)
          : [...prev.selectedDocIds, docId],
      };
    });
  };

  const selectAllDocs = () => {
    const all = (bankMailModalApp?.documents || []).map((d) => d.id);
    setMailForm((prev) => ({ ...prev, selectedDocIds: all }));
  };

  const deselectAllDocs = () => {
    setMailForm((prev) => ({ ...prev, selectedDocIds: [] }));
  };

  const insertMailVariable = (tag, field = "content") => {
    if (field === "subject") {
      const input = mailSubjectRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const oldVal = mailForm.subject || "";
        const newVal = oldVal.substring(0, start) + tag + oldVal.substring(end);
        setMailForm((prev) => ({ ...prev, subject: newVal }));
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + tag.length, start + tag.length);
        }, 50);
      } else {
        setMailForm((prev) => ({ ...prev, subject: (prev.subject || "") + " " + tag }));
      }
    } else {
      const textarea = mailContentRef.current;
      if (textarea) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const oldVal = mailForm.content || "";
        const newVal = oldVal.substring(0, start) + tag + oldVal.substring(end);
        setMailForm((prev) => ({ ...prev, content: newVal }));
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 50);
      } else {
        setMailForm((prev) => ({ ...prev, content: (prev.content || "") + "\n" + tag }));
      }
    }
  };

  const handleSendBankEmail = async (e) => {
    e?.preventDefault();
    if (!mailForm.toEmail.trim()) {
      toast.warning("Please provide a recipient Bank / RM email address");
      return;
    }
    if (!mailForm.subject.trim()) {
      toast.warning("Email subject cannot be empty");
      return;
    }
    if (!mailForm.content.trim()) {
      toast.warning("Email content cannot be empty");
      return;
    }

    setBankMailSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/applications/${bankMailModalApp.id}/send-to-bank`, {
        toEmail: mailForm.toEmail.trim(),
        ccEmails: mailForm.ccEmails.trim() || undefined,
        subject: mailForm.subject.trim(),
        content: mailForm.content.trim(),
        documentIds: mailForm.selectedDocIds,
        lenderId: mailForm.lenderId ? parseInt(mailForm.lenderId, 10) : undefined,
        newStatus: mailForm.updateStatus || undefined,
      });

      toast.success(res.data?.message || "Loan application successfully emailed to Bank RM!");
      setBankMailModalApp(null);
      fetchApplications(appCurrentPage);
      if (verificationApp && verificationApp.id === bankMailModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          status: mailForm.updateStatus || prev.status,
        }));
      }
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to send email to bank");
    } finally {
      setBankMailSubmitting(false);
    }
  };

  // 1-Click Convert Lead to Application
  const openConvertModal = (lead) => {
    setConvertLead(lead);
    setConvertForm({
      loanProduct: lead.loan_type || "Personal Loan",
      appliedAmount: lead.est_budget || lead.appliedAmount || "",
      lenderId: lenders[0]?.lender_id || lenders[0]?.id || "",
      assignedBankerId: bankers[0]?.id || "",
    });
  };

  const handleConvertSubmit = async (e) => {
    e.preventDefault();
    if (!convertForm.loanProduct || !convertForm.appliedAmount) {
      toast.warning("Loan Product and Applied Amount are required");
      return;
    }
    setConvertSubmitting(true);
    try {
      const payload = {
        leadId: convertLead.lead_id,
        customerId: convertLead.customer_id,
        loanProduct: convertForm.loanProduct,
        appliedAmount: parseFloat(convertForm.appliedAmount),
        lenderId: convertForm.lenderId ? parseInt(convertForm.lenderId, 10) : null,
        assignedBankerId: convertForm.assignedBankerId ? parseInt(convertForm.assignedBankerId, 10) : null,
      };
      const res = await axios.post(`${API_URL}/applications`, payload);
      toast.success(
        `Application #${res.data?.application?.applicationNumber} created and dispatched to Banker!`
      );
      setConvertLead(null);
      setViewMode("pipeline");
      fetchApplications(1);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to convert lead to application");
    } finally {
      setConvertSubmitting(false);
    }
  };

  // Reply to Banker Query
  const handleReplyQuerySubmit = async (e) => {
    e.preventDefault();
    if (!replyResponseText.trim()) {
      toast.warning("Please type your clarification response");
      return;
    }
    setReplySubmitting(true);
    try {
      await axios.patch(
        `${API_URL}/applications/${replyTargetQuery.applicationId}/queries/${replyTargetQuery.id}/resolve`,
        { responseText: replyResponseText.trim() }
      );
      toast.success("Clarification submitted! Query resolved with Banker.");
      setReplyTargetQuery(null);
      setReplyResponseText("");
      fetchOpenQueries();
      fetchApplications(appCurrentPage);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to resolve query");
    } finally {
      setReplySubmitting(false);
    }
  };

  return (
    <div className="cc-report-redesign cc-ops-screen">
      <ToastContainer position="bottom-right" />
      <style>{opsStyles}</style>

      {/* Top Header & Mode Switcher */}
      <section className="cc-report-panel cc-ops-top-panel">
        <div className="cc-ops-nav-cluster">
          <div className="cc-ops-mode-tabs">
            <button
              type="button"
              className={`cc-ops-mode-btn ${viewMode === "pipeline" ? "active" : ""}`}
              onClick={() => setViewMode("pipeline")}
            >
              <Kanban size={17} /> Loan Pipeline &amp; Verification
            </button>
            <button
              type="button"
              className={`cc-ops-mode-btn ${viewMode === "leads" ? "active" : ""}`}
              onClick={() => setViewMode("leads")}
            >
              <Layers size={17} /> Incoming Operations Leads ({leadTotalItems})
            </button>
          </div>

          {viewMode === "pipeline" && (
            <div className="cc-ops-view-toggle">
              <button
                type="button"
                className={displayType === "kanban" ? "active" : ""}
                onClick={() => setDisplayType("kanban")}
                title="Kanban Board View"
              >
                <Kanban size={16} /> Board
              </button>
              <button
                type="button"
                className={displayType === "table" ? "active" : ""}
                onClick={() => setDisplayType("table")}
                title="Table List View"
              >
                <List size={16} /> Table
              </button>
            </div>
          )}
        </div>
      </section>

      {/* Real-time Banker Open Queries Alert Widget */}
      {openQueries.length > 0 && (
        <section className="cc-ops-query-alert-panel">
          <div className="cc-ops-query-alert-head">
            <div className="cc-query-alert-title">
              <AlertCircle size={18} />
              <strong>Banker Clarification Queries Requiring Attention ({openQueries.length})</strong>
            </div>
            <button
              type="button"
              className="cc-query-view-all-btn"
              onClick={() => navigate("/banker/queries")}
            >
              All Queries <ArrowRight size={13} />
            </button>
          </div>
          <div className="cc-ops-query-chips-scroll">
            {openQueries.slice(0, 4).map((q) => (
              <div key={q.id} className="cc-query-alert-chip">
                <div className="cc-chip-meta">
                  <span className="cc-chip-app">{q.application?.applicationNumber || `App #${q.applicationId}`}</span>
                  <span className="cc-chip-cust">{q.application?.customer?.name || "Customer"}</span>
                </div>
                <p className="cc-chip-text">"{q.queryText}"</p>
                <button
                  type="button"
                  className="cc-chip-answer-btn"
                  onClick={() => {
                    setReplyTargetQuery(q);
                    setReplyResponseText("");
                  }}
                >
                  Reply &amp; Resolve
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {/* VIEW MODE: PIPELINE (KANBAN / TABLE) */}
      {viewMode === "pipeline" && (
        <>
          {/* Search, Bank, Date/Month/FY Filters & Stage Tabs */}
          {renderFilterToolbar(true)}

          {/* KANBAN BOARD VIEW */}
          {displayType === "kanban" ? (
            <div className="cc-ops-kanban-board">
              {PIPELINE_STAGES.map((stage) => {
                const stageApps = applications.filter((a) => {
                  const s = (a.status || "DOCS_PENDING").toUpperCase();
                  if (stage.key === "SUBMITTED_TO_BANK") {
                    return s === "SUBMITTED_TO_BANK" || s === "UNDER_REVIEW";
                  }
                  if (stage.key === "SANCTIONED") {
                    return s === "SANCTIONED" || s === "APPROVED";
                  }
                  return s === stage.key;
                });

                return (
                  <div key={stage.key} className="cc-kanban-column">
                    <div className="cc-kanban-col-header" style={{ borderTopColor: stage.color }}>
                      <div className="cc-kanban-col-title">
                        <span style={{ background: stage.color }} className="cc-col-dot" />
                        <h3>{stage.label}</h3>
                      </div>
                      <span className="cc-kanban-count">{stageApps.length}</span>
                    </div>

                    <div className="cc-kanban-cards-wrap">
                      {stageApps.length === 0 ? (
                        <div className="cc-kanban-empty">No applications</div>
                      ) : (
                        stageApps.map((app) => {
                          const hasOpenQuery = (app.queries || []).some((q) => q.status === "OPEN");
                          return (
                            <div
                              key={app.id}
                              className="cc-kanban-card"
                              onClick={() => openVerificationDrawer(app)}
                            >
                              <div className="cc-kcard-top">
                                <span className="cc-kcard-appnum">{app.applicationNumber}</span>
                                {hasOpenQuery && (
                                  <span className="cc-kcard-query-alert" title="Banker Query Raised">
                                    <HelpCircle size={13} /> Query
                                  </span>
                                )}
                              </div>

                              <strong className="cc-kcard-name">
                                {app.customer?.name || "Applicant"}
                              </strong>
                              <small className="cc-kcard-contact">
                                {app.customer?.mobile || "No Mobile"} • {app.customer?.city || "India"}
                              </small>

                              <div className="cc-kcard-finance">
                                <div>
                                  <small>Product</small>
                                  <span>{app.loanProduct}</span>
                                </div>
                                <div>
                                  <small>Amount</small>
                                  <strong>{currencyFormatter.format(app.appliedAmount || 0)}</strong>
                                </div>
                              </div>

                              <div className="cc-kcard-footer">
                                <span className="cc-kcard-lender">
                                  <Building2 size={12} /> {app.lender?.shortCode || app.lender?.name || "Direct Bank"}
                                </span>
                                {app.assignedBanker?.name ? (
                                  <span className="cc-kcard-banker">
                                    <UserCheck size={12} /> {app.assignedBanker.name.split(" ")[0]}
                                  </span>
                                ) : null}
                              </div>

                              <div className="cc-kcard-dispatch-row" onClick={(e) => e.stopPropagation()}>
                                <button
                                  type="button"
                                  className="cc-kcard-mail-btn"
                                  title="Send Loan Docket & KYC to Bank via Email"
                                  onClick={() => openBankMailModal(app)}
                                >
                                  <Mail size={12} /> Send Email to Bank
                                </button>
                              </div>
                            </div>
                          );
                        })
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            /* TABLE LIST VIEW */
            <section className="cc-report-panel">
              <div className="cc-report-table-scroll">
                <table>
                  <thead>
                    <tr>
                      <th>App Number</th>
                      <th>Applicant / Customer</th>
                      <th>Loan Product</th>
                      <th>Applied Amount</th>
                      <th>Assigned Bank / NBFC</th>
                      <th>Assigned Banker</th>
                      <th>Status</th>
                      <th>Queries</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appsLoading ? (
                      <tr>
                        <td colSpan={9} className="cc-report-empty">
                          Loading loan applications...
                        </td>
                      </tr>
                    ) : applications.length === 0 ? (
                      <tr>
                        <td colSpan={9} className="cc-report-empty">
                          No loan applications match the filters.
                        </td>
                      </tr>
                    ) : (
                      applications.map((app) => (
                        <tr
                          key={app.id}
                          className="cc-ops-table-row"
                          onClick={() => openVerificationDrawer(app)}
                        >
                          <td>
                            <strong>{app.applicationNumber}</strong>
                            <small style={{ display: "block", color: "#94a3b8", fontSize: 11 }}>
                              {new Date(app.createdAt).toLocaleDateString("en-IN")}
                            </small>
                          </td>
                          <td>
                            <strong>{app.customer?.name || "Customer"}</strong>
                            <small style={{ display: "block", color: "#64748b", fontSize: 11.5 }}>
                              {app.customer?.mobile || "—"}
                            </small>
                          </td>
                          <td>{app.loanProduct}</td>
                          <td>
                            <strong>{currencyFormatter.format(app.appliedAmount || 0)}</strong>
                          </td>
                          <td>
                            {app.lender ? (
                              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                <div style={{
                                  width: 32, height: 32, borderRadius: 8, background: "#eef2ff",
                                  color: "#4f46e5", display: "grid", placeItems: "center", flexShrink: 0,
                                  border: "1px solid #c7d2fe"
                                }}>
                                  <Building2 size={16} />
                                </div>
                                <div>
                                  <strong style={{ fontSize: 13, color: "#0f172a", display: "block" }}>
                                    {app.lender.name}
                                  </strong>
                                  <span style={{ fontSize: 11, color: "#64748b" }}>
                                    {app.lender.shortCode || app.lender.lenderType || "Bank Partner"}
                                  </span>
                                </div>
                              </div>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>
                                Not Assigned
                              </span>
                            )}
                          </td>
                          <td>
                            {app.assignedBanker?.name ? (
                              <span className="cc-ops-badge banker">
                                <UserCheck size={12} /> {app.assignedBanker.name}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>Unassigned</span>
                            )}
                          </td>
                          <td>
                            {renderStatusBadge(app.status)}
                          </td>
                          <td>
                            {(app.queries || []).some((q) => q.status === "OPEN") ? (
                              <span className="cc-ops-query-flag alert">
                                <HelpCircle size={12} /> Open Query
                              </span>
                            ) : (app.queries || []).length > 0 ? (
                              <span className="cc-ops-query-flag resolved">Resolved</span>
                            ) : (
                              <span style={{ color: "#94a3b8", fontSize: 12 }}>None</span>
                            )}
                          </td>
                          <td onClick={(e) => e.stopPropagation()}>
                            <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                              <button
                                type="button"
                                className="cc-ops-action-btn mail-dispatch"
                                title="Send Loan Application & KYC to Bank via Email"
                                onClick={() => openBankMailModal(app)}
                              >
                                <Mail size={12} /> Email Bank
                              </button>
                              <button
                                type="button"
                                className="cc-ops-action-btn"
                                onClick={() => openVerificationDrawer(app)}
                              >
                                Verify KYC <ChevronRight size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              <CcPagination
                currentPage={appCurrentPage}
                totalPages={appTotalPages}
                totalItems={appTotalItems}
                onPageChange={setAppCurrentPage}
                itemLabel="applications"
              />
            </section>
          )}
        </>
      )}

      {/* VIEW MODE: OPERATIONS LEADS QUEUE */}
      {viewMode === "leads" && (
        <>
          {renderFilterToolbar(false)}

          <section className="cc-report-panel">
            <div style={{ padding: "12px 18px 4px 18px" }}>
              <p className="cc-leads-hint" style={{ margin: 0 }}>
                <Layers size={14} /> Showing {employeeRole === "manager" ? "all operations" : "your assigned"} leads in table view. Click <strong>1-Click Convert</strong> to dispatch directly to Bankers.
              </p>
            </div>

            <div className="cc-report-table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Lead ID</th>
                    <th>Customer Name</th>
                    <th>Contact Phone</th>
                    <th>Assigned Person / Owner</th>
                    <th>Loan Product</th>
                    <th>Est. Budget</th>
                    <th>Assigned Bank / NBFC</th>
                    <th>Status</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsLoading ? (
                    <tr>
                      <td colSpan={9} className="cc-report-empty">
                        Loading operations leads...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="cc-report-empty">
                        {leadStatusCategory === "PENDING"
                          ? "No pending leads found for operations."
                          : leadStatusCategory === "COMPLETED"
                          ? "No completed leads found."
                          : "No leads currently in the Operations queue."}
                      </td>
                    </tr>
                  ) : (
                    leads.map((lead) => (
                      <tr
                        key={lead.lead_id}
                        className="cc-ops-table-row"
                        onClick={() => navigate(`/lead-details/${lead.lead_id}`)}
                      >
                        <td style={{ fontWeight: 600 }}>#{lead.lead_id}</td>
                        <td>
                          <strong>{lead.name || "--"}</strong>
                        </td>
                        <td>{lead.number || "--"}</td>
                        <td>
                          <span className="cc-ops-owner-tag">{lead.owner || "Unassigned"}</span>
                        </td>
                        <td>{lead.loan_type || "Personal Loan"}</td>
                        <td>
                          <strong>
                            {lead.est_budget ? `₹${numberFormatter.format(lead.est_budget)}` : "—"}
                          </strong>
                        </td>
                        <td>
                          {lead.bank_name ? (
                            <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                              <Building2 size={14} color="#4f46e5" />
                              <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 12.5 }}>
                                {lead.bank_name}
                              </span>
                            </div>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>
                              Not Assigned
                            </span>
                          )}
                        </td>
                        <td>
                          {renderStatusBadge(lead.status_value || lead.status)}
                        </td>
                        <td onClick={(e) => e.stopPropagation()}>
                          <div style={{ display: "flex", gap: 6 }}>
                            <button
                              type="button"
                              className="cc-ops-convert-btn"
                              onClick={() => openConvertModal(lead)}
                              title="Convert to Loan Application"
                            >
                              <Send size={12} /> Convert
                            </button>
                            <button
                              type="button"
                              className="cc-ops-action-btn"
                              onClick={() => navigate(`/lead-details/${lead.lead_id}`)}
                              title="View Lead Details"
                            >
                              <Eye size={13} />
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>

            <CcPagination
              currentPage={leadCurrentPage}
              totalPages={leadTotalPages}
              totalItems={leadTotalItems}
              onPageChange={setLeadCurrentPage}
              itemLabel="leads"
            />
          </section>
        </>
      )}

      {/* Interactive Document Verification & KYC Review Drawer */}
      {verificationApp && (
        <div className="cc-ops-drawer-overlay" onClick={() => setVerificationApp(null)}>
          <aside className="cc-ops-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cc-ops-drawer-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2>{verificationApp.applicationNumber}</h2>
                  <span className={`cc-ops-status-tag ${(verificationApp.status || "").toLowerCase()}`}>
                    {verificationApp.status}
                  </span>
                </div>
                <p>
                  KYC Verification &amp; Document Management Hub • Customer:{" "}
                  <strong>{verificationApp.customer?.name}</strong> ({verificationApp.customer?.mobile})
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 10, marginLeft: "auto" }}>
                <button
                  type="button"
                  className="cc-drawer-mail-btn"
                  onClick={() => openBankMailModal(verificationApp)}
                  title="Send Loan Application Docket to Bank RM via Email"
                >
                  <Mail size={14} /> Send to Bank (Email)
                </button>
                <button
                  type="button"
                  className="cc-drawer-close-btn"
                  onClick={() => setVerificationApp(null)}
                >
                  <X size={20} />
                </button>
              </div>
            </div>

            <div className="cc-ops-drawer-body">
              {verificationLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  <RefreshCw className="cc-spin" size={24} style={{ marginBottom: 12 }} />
                  <p>Loading application documents and query stream...</p>
                </div>
              ) : (
                <>
                  {/* Pipeline Stage Quick Changer */}
                  <div className="cc-ops-stage-selector-box">
                    <label>
                      <Kanban size={15} /> Move Application Pipeline Stage:
                    </label>
                    <div className="cc-stage-btn-cluster">
                      {PIPELINE_STAGES.map((st) => (
                        <button
                          key={st.key}
                          type="button"
                          className={verificationApp.status === st.key ? "active" : ""}
                          onClick={() => handleStageTransition(verificationApp.id, st.key)}
                        >
                          {st.label}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* KYC & Financial Documents Section */}
                  <div className="cc-ops-drawer-section">
                    <div className="cc-drawer-sec-title">
                      <FileCheck size={17} /> Applicant KYC &amp; Verification Documents (
                      {(verificationApp.documents || []).length})
                    </div>

                    {(verificationApp.documents || []).length === 0 ? (
                      <div className="cc-ops-no-docs">
                        <FileText size={28} style={{ color: "#94a3b8", marginBottom: 6 }} />
                        <p>No documents uploaded yet for this application.</p>
                        <small>Upload customer documents below so Bankers can review them.</small>
                      </div>
                    ) : (
                      <div className="cc-ops-docs-list">
                        {verificationApp.documents.map((doc) => {
                          const isVerified = doc.verificationStatus === "VERIFIED";
                          const isRejected = doc.verificationStatus === "REJECTED";
                          const isReupload = doc.verificationStatus === "REUPLOAD_REQUIRED";

                          return (
                            <div key={doc.id} className={`cc-ops-doc-card ${doc.verificationStatus?.toLowerCase()}`}>
                              <div className="cc-doc-main">
                                <div className="cc-doc-icon-shell">
                                  <FileText size={20} />
                                </div>
                                <div className="cc-doc-meta">
                                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                                    <strong>{doc.docType}</strong>
                                    <span className={`cc-doc-status-pill ${doc.verificationStatus?.toLowerCase()}`}>
                                      {doc.verificationStatus}
                                    </span>
                                  </div>
                                  <small>{doc.fileName}</small>
                                  {doc.rejectionReason && (
                                    <p className="cc-doc-reject-note">
                                      <strong>Remarks / Issue:</strong> {doc.rejectionReason}
                                    </p>
                                  )}
                                </div>
                              </div>

                              <div className="cc-doc-actions-row">
                                {doc.fileUrl && (
                                  <a
                                    href={doc.fileUrl.startsWith("http") ? doc.fileUrl : `${API_URL.replace("/api", "")}/${doc.fileUrl}`}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cc-doc-open-btn"
                                  >
                                    <ExternalLink size={13} /> View File
                                  </a>
                                )}

                                <button
                                  type="button"
                                  className={`cc-doc-act-btn verify ${isVerified ? "active" : ""}`}
                                  onClick={() => handleVerifyDoc(doc.id, "VERIFIED")}
                                  disabled={docVerifying}
                                  title="Mark Verified"
                                >
                                  <CheckCircle2 size={13} /> {isVerified ? "Verified" : "Verify"}
                                </button>

                                <button
                                  type="button"
                                  className={`cc-doc-act-btn reupload ${isReupload ? "active" : ""}`}
                                  onClick={() => setDocRejectTarget({ doc, action: "REUPLOAD_REQUIRED" })}
                                  disabled={docVerifying}
                                  title="Request Re-upload"
                                >
                                  <RefreshCw size={13} /> Request Re-upload
                                </button>

                                <button
                                  type="button"
                                  className={`cc-doc-act-btn reject ${isRejected ? "active" : ""}`}
                                  onClick={() => setDocRejectTarget({ doc, action: "REJECTED" })}
                                  disabled={docVerifying}
                                  title="Reject Document"
                                >
                                  <XCircle size={13} /> Reject
                                </button>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Direct Upload Missing Document Form */}
                    <form className="cc-ops-upload-box" onSubmit={handleUploadDocumentSubmit}>
                      <div className="cc-upload-box-title">
                        <Upload size={15} /> Upload Missing Document:
                      </div>
                      <div className="cc-upload-box-row">
                        <select
                          value={uploadDocType}
                          onChange={(e) => setUploadDocType(e.target.value)}
                        >
                          {masterDocTypes && masterDocTypes.length > 0 ? (
                            masterDocTypes.map((dt) => (
                              <option key={dt.id || dt.value} value={dt.label || dt.value}>
                                {dt.label || dt.value}
                              </option>
                            ))
                          ) : (
                            <>
                              <option value="PAN Card">PAN Card</option>
                              <option value="Aadhaar Card">Aadhaar Card</option>
                              <option value="Salary Slip">Salary Slip (Latest 3 Months)</option>
                              <option value="Bank Statement">Bank Statement (6 Months)</option>
                              <option value="ITR / Form 16">ITR / Form 16</option>
                              <option value="Address Proof">Address Proof / Utility Bill</option>
                              <option value="Property Document">Property Document</option>
                              <option value="Other">Other Supporting Document</option>
                            </>
                          )}
                        </select>
                        <input
                          type="file"
                          onChange={(e) => setUploadFile(e.target.files[0])}
                          required
                        />
                        <button type="submit" className="cc-upload-submit-btn" disabled={uploadingDoc}>
                          {uploadingDoc ? "Uploading..." : "Upload Document"}
                        </button>
                      </div>
                    </form>
                  </div>

                  {/* Clarification Queries & Banker Thread */}
                  <div className="cc-ops-drawer-section">
                    <div className="cc-drawer-sec-title">
                      <MessageSquare size={17} /> Clarification Queries &amp; Banker Thread (
                      {(verificationApp.queries || []).length})
                    </div>

                    {(verificationApp.queries || []).length === 0 ? (
                      <p style={{ fontSize: 13, color: "#94a3b8", margin: "8px 0 0" }}>
                        No queries raised by Banker yet.
                      </p>
                    ) : (
                      <div className="cc-ops-queries-stream">
                        {verificationApp.queries.map((q) => (
                          <div
                            key={q.id}
                            className={`cc-ops-query-box ${q.status === "RESOLVED" ? "resolved" : "open"}`}
                          >
                            <div className="cc-qbox-head">
                              <span className={`cc-qbox-tag ${q.status === "RESOLVED" ? "resolved" : "open"}`}>
                                {q.status}
                              </span>
                              <small>
                                Raised by {q.banker?.name || "Banker"} on{" "}
                                {new Date(q.createdAt).toLocaleString("en-IN", {
                                  dateStyle: "medium",
                                  timeStyle: "short",
                                })}
                              </small>
                            </div>
                            <p className="cc-qbox-text">
                              <strong>Banker Query:</strong> {q.queryText}
                            </p>

                            {q.responseText ? (
                              <div className="cc-qbox-ans">
                                <strong>Operations Answer:</strong> {q.responseText}
                                {q.resolvedByOps?.name && (
                                  <small> — Answered by {q.resolvedByOps.name}</small>
                                )}
                              </div>
                            ) : (
                              <div className="cc-qbox-reply-action">
                                <button
                                  type="button"
                                  className="cc-qbox-answer-btn"
                                  onClick={() => {
                                    setReplyTargetQuery(q);
                                    setReplyResponseText("");
                                  }}
                                >
                                  Answer &amp; Resolve Query
                                </button>
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

      {/* Document Rejection / Re-upload Modal */}
      {docRejectTarget && (
        <div className="cc-modal-overlay" onClick={() => setDocRejectTarget(null)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div>
                <p>Document Verification</p>
                <h3>
                  {docRejectTarget.action === "REUPLOAD_REQUIRED"
                    ? "Request Document Re-upload"
                    : "Reject Document"}
                </h3>
              </div>
              <button type="button" onClick={() => setDocRejectTarget(null)}>
                <X size={16} />
              </button>
            </div>

            <div className="cc-modal-form">
              <p style={{ margin: 0, fontSize: 13, color: "#475569" }}>
                Document: <strong>{docRejectTarget.doc.docType}</strong> ({docRejectTarget.doc.fileName})
              </p>

              <label className="cc-modal-field">
                <span>Specify Reason / Instructions for Customer *</span>
                <textarea
                  rows={3}
                  placeholder={
                    docRejectTarget.action === "REUPLOAD_REQUIRED"
                      ? "e.g. Salary slip is blurry. Please upload clear copy showing company name and deductions."
                      : "e.g. Mismatched name on PAN card with application."
                  }
                  value={docRejectionReason}
                  onChange={(e) => setDocRejectionReason(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-btn ghost"
                  onClick={() => setDocRejectTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className={`cc-modal-btn primary ${docRejectTarget.action === "REJECTED" ? "danger" : ""}`}
                  onClick={() =>
                    handleVerifyDoc(
                      docRejectTarget.doc.id,
                      docRejectTarget.action,
                      docRejectionReason
                    )
                  }
                  disabled={docVerifying || !docRejectionReason.trim()}
                >
                  {docVerifying
                    ? "Saving..."
                    : docRejectTarget.action === "REUPLOAD_REQUIRED"
                    ? "Request Re-upload"
                    : "Reject Document"}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* 1-Click Convert Lead to Bank Application Modal */}
      {convertLead && (
        <div className="cc-modal-overlay" onClick={() => setConvertLead(null)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div>
                <p>1-Click Dispatch</p>
                <h3>Create &amp; Dispatch Loan File</h3>
              </div>
              <button type="button" onClick={() => setConvertLead(null)}>
                <X size={16} />
              </button>
            </div>

            <form className="cc-modal-form" onSubmit={handleConvertSubmit}>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#166534",
                }}
              >
                <strong>Applicant:</strong> {convertLead.name} ({convertLead.number})
              </div>

              <label className="cc-modal-field">
                <span>Loan Product *</span>
                <input
                  type="text"
                  value={convertForm.loanProduct}
                  onChange={(e) => setConvertForm({ ...convertForm, loanProduct: e.target.value })}
                  placeholder="e.g. Personal Loan, Home Loan, Business Loan"
                  required
                />
              </label>

              <label className="cc-modal-field">
                <span>Applied Amount (₹) *</span>
                <input
                  type="number"
                  value={convertForm.appliedAmount}
                  onChange={(e) => setConvertForm({ ...convertForm, appliedAmount: e.target.value })}
                  placeholder="e.g. 500000"
                  required
                />
              </label>

              <label className="cc-modal-field">
                <span>Select Bank / NBFC Institution (Lender)</span>
                <select
                  value={convertForm.lenderId}
                  onChange={(e) => setConvertForm({ ...convertForm, lenderId: e.target.value })}
                >
                  <option value="">Direct / Multi-Lender</option>
                  {lenders.map((l) => (
                    <option key={l.lender_id || l.id} value={l.lender_id || l.id}>
                      {l.name} ({l.short_code || l.shortCode})
                    </option>
                  ))}
                </select>
              </label>

              <label className="cc-modal-field">
                <span>Assign Banker / Underwriting Officer</span>
                <select
                  value={convertForm.assignedBankerId}
                  onChange={(e) => setConvertForm({ ...convertForm, assignedBankerId: e.target.value })}
                >
                  <option value="">Select Banker Account</option>
                  {bankers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.email || b.phone})
                    </option>
                  ))}
                </select>
              </label>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-btn ghost"
                  onClick={() => setConvertLead(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-modal-btn primary" disabled={convertSubmitting}>
                  <Send size={15} /> {convertSubmitting ? "Creating..." : "Submit to Bank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Send Loan Application Docket to Bank RM via Email Modal */}
      {bankMailModalApp && (
        <div className="cc-modal-overlay" onClick={() => setBankMailModalApp(null)}>
          <div className="cc-modal-card cc-mail-modal-large" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 2 }}>
                  <span className="cc-mail-modal-badge">
                    <Mail size={12} /> Direct Bank Email Dispatch
                  </span>
                  <span className="cc-mail-app-no">{bankMailModalApp.applicationNumber}</span>
                </div>
                <h3 style={{ margin: "2px 0 0", fontSize: 18, color: "#0f172a", fontWeight: 700 }}>
                  Send Loan Docket to Bank RM
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Applicant: <strong>{bankMailModalApp.customer?.name}</strong> • Product:{" "}
                  <strong>{bankMailModalApp.loanProduct}</strong> • Applied:{" "}
                  <strong>₹{Number(bankMailModalApp.appliedAmount || 0).toLocaleString("en-IN")}</strong>
                </p>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <div className="cc-mail-tabs">
                  <button
                    type="button"
                    className={`cc-mail-tab ${mailActiveTab === "compose" ? "active" : ""}`}
                    onClick={() => setMailActiveTab("compose")}
                  >
                    <Pencil size={13} /> Compose &amp; Edit
                  </button>
                  <button
                    type="button"
                    className={`cc-mail-tab ${mailActiveTab === "preview" ? "active" : ""}`}
                    onClick={() => setMailActiveTab("preview")}
                  >
                    <Eye size={13} /> Email Preview
                  </button>
                </div>
                <button
                  type="button"
                  className="cc-mail-close-btn"
                  onClick={() => setBankMailModalApp(null)}
                >
                  <X size={17} />
                </button>
              </div>
            </div>

            {bankMailLoading ? (
              <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                <RefreshCw className="cc-spin" size={24} style={{ marginBottom: 10, color: "#047857" }} />
                <p>Loading application documents and bank templates...</p>
              </div>
            ) : mailActiveTab === "compose" ? (
              <form className="cc-modal-form" onSubmit={handleSendBankEmail}>
                {/* Bank / RM Recipient Section */}
                <div className="cc-mail-section-card">
                  <div className="cc-mail-section-title">
                    <Building2 size={15} style={{ color: "#4338ca" }} /> 1. Institution &amp; Recipient Bank RM Email
                  </div>

                  <div className="cc-modal-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
                    <label className="cc-modal-field">
                      <span>Target Bank / NBFC Institution *</span>
                      <select
                        value={mailForm.lenderId}
                        onChange={(e) => handleBankChange(e.target.value)}
                        required
                      >
                        <option value="">Select Bank / Lender</option>
                        {lenders.map((l) => (
                          <option key={l.lender_id || l.id} value={l.lender_id || l.id}>
                            {l.name} ({l.short_code || l.shortCode})
                          </option>
                        ))}
                      </select>
                    </label>

                    <label className="cc-modal-field">
                      <span style={{ color: "#047857", fontWeight: 700 }}>
                        Send Directly To (Bank RM Email) *
                      </span>
                      <input
                        type="email"
                        value={mailForm.toEmail}
                        onChange={(e) => setMailForm({ ...mailForm, toEmail: e.target.value })}
                        placeholder="e.g. rajesh.rm@hdfcbank.com"
                        required
                      />
                    </label>
                  </div>

                  <div className="cc-modal-row" style={{ marginTop: 8 }}>
                    <label className="cc-modal-field" style={{ width: "100%" }}>
                      <span>CC Email Address(es) (Optional)</span>
                      <input
                        type="text"
                        value={mailForm.ccEmails}
                        onChange={(e) => setMailForm({ ...mailForm, ccEmails: e.target.value })}
                        placeholder="e.g. ops.desk@capitalcare.in, credit.officer@bank.com (comma separated)"
                      />
                    </label>
                  </div>
                </div>

                {/* Email Subject & Content Section */}
                <div className="cc-mail-section-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <div className="cc-mail-section-title" style={{ margin: 0 }}>
                      <Mail size={15} style={{ color: "#047857" }} /> 2. Subject &amp; Mail Content (Editable)
                    </div>

                    <label style={{ display: "inline-flex", alignItems: "center", gap: 6, fontSize: 12, color: "#475569" }}>
                      <span>Preset Template:</span>
                      <select
                        style={{ padding: "4px 8px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 12 }}
                        value={mailForm.templateId}
                        onChange={(e) => handleTemplateChange(e.target.value)}
                      >
                        <option value="">-- Choose Template --</option>
                        {emailTemplates.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name} {t.isDefault ? "(Default)" : ""}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  {/* Subject Input */}
                  <div className="cc-mail-field-shell">
                    <div className="cc-mail-field-header">
                      <label className="cc-modal-field" style={{ margin: 0 }}>
                        <span style={{ fontWeight: 700 }}>Email Subject *</span>
                      </label>
                      <div className="cc-mail-var-pills">
                        <span style={{ fontSize: 10.5, color: "#64748b" }}>Insert:</span>
                        {["{{customer_name}}", "{{loan_product}}", "{{application_number}}", "{{loan_amount}}"].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="cc-mail-var-btn"
                            onClick={() => insertMailVariable(tag, "subject")}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <input
                      ref={mailSubjectRef}
                      type="text"
                      className="cc-mail-subject-input"
                      value={mailForm.subject}
                      onChange={(e) => setMailForm({ ...mailForm, subject: e.target.value })}
                      placeholder="e.g. Loan Application Docket: Rahul Verma - Personal Loan (Ref: APP-2026-0042)"
                      required
                    />
                  </div>

                  {/* Multiline Body Textarea */}
                  <div className="cc-mail-field-shell" style={{ marginTop: 10 }}>
                    <div className="cc-mail-field-header">
                      <label className="cc-modal-field" style={{ margin: 0 }}>
                        <span style={{ fontWeight: 700 }}>Multiline Mail Body / Content *</span>
                      </label>
                      <div className="cc-mail-var-pills">
                        <span style={{ fontSize: 10.5, color: "#64748b" }}>Insert:</span>
                        {["{{bank_rm_name}}", "{{customer_name}}", "{{documents_list}}", "{{company_name}}", "{{sender_name}}"].map((tag) => (
                          <button
                            key={tag}
                            type="button"
                            className="cc-mail-var-btn"
                            onClick={() => insertMailVariable(tag, "content")}
                          >
                            + {tag}
                          </button>
                        ))}
                      </div>
                    </div>
                    <textarea
                      ref={mailContentRef}
                      rows={8}
                      className="cc-mail-textarea"
                      value={mailForm.content}
                      onChange={(e) => setMailForm({ ...mailForm, content: e.target.value })}
                      placeholder="Write your email body..."
                      required
                    />
                  </div>
                </div>

                {/* Document Attachments Selection */}
                <div className="cc-mail-section-card">
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8, flexWrap: "wrap", gap: 8 }}>
                    <div className="cc-mail-section-title" style={{ margin: 0 }}>
                      <Paperclip size={15} style={{ color: "#d97706" }} /> 3. Applicant KYC &amp; Loan Documents Attached
                      <span className="cc-mail-count-pill">
                        {mailForm.selectedDocIds.length} of {(bankMailModalApp.documents || []).length} Attached
                      </span>
                    </div>

                    <div style={{ display: "flex", gap: 6, fontSize: 11.5 }}>
                      <button
                        type="button"
                        className="cc-mail-link-btn"
                        onClick={selectAllDocs}
                      >
                        Select All
                      </button>
                      <span style={{ color: "#cbd5e1" }}>|</span>
                      <button
                        type="button"
                        className="cc-mail-link-btn"
                        onClick={deselectAllDocs}
                      >
                        Remove All
                      </button>
                    </div>
                  </div>

                  {(bankMailModalApp.documents || []).length === 0 ? (
                    <div className="cc-mail-no-docs">
                      <AlertCircle size={18} style={{ color: "#d97706" }} />
                      <span>
                        No customer documents are currently uploaded for this applicant. You can still email the docket text, or upload documents in the KYC Verification Center.
                      </span>
                    </div>
                  ) : (
                    <div className="cc-mail-docs-grid">
                      {bankMailModalApp.documents.map((doc) => {
                        const isSelected = mailForm.selectedDocIds.includes(doc.id);
                        return (
                          <div
                            key={doc.id}
                            className={`cc-mail-doc-card ${isSelected ? "selected" : "deselected"}`}
                            onClick={() => toggleDocumentAttachment(doc.id)}
                          >
                            <label
                              className="cc-mail-doc-check"
                              onClick={(e) => e.stopPropagation()}
                            >
                              <input
                                type="checkbox"
                                checked={isSelected}
                                onChange={() => toggleDocumentAttachment(doc.id)}
                              />
                            </label>

                            <div className="cc-mail-doc-info">
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <strong className="cc-mail-doc-type">{doc.docType}</strong>
                                <span className={`cc-mail-doc-status ${doc.verificationStatus?.toLowerCase()}`}>
                                  {doc.verificationStatus}
                                </span>
                              </div>
                              <span className="cc-mail-doc-name" title={doc.fileName}>
                                {doc.fileName}
                              </span>
                            </div>

                            <div className="cc-mail-doc-actions" onClick={(e) => e.stopPropagation()}>
                              {doc.fileUrl && (
                                <a
                                  href={
                                    doc.fileUrl.startsWith("http")
                                      ? doc.fileUrl
                                      : `${API_URL.replace("/api", "")}/${doc.fileUrl.replace(/^\//, "")}`
                                  }
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="cc-mail-doc-view-btn"
                                  title="Inspect Document"
                                >
                                  <ExternalLink size={12} />
                                </a>
                              )}
                              <button
                                type="button"
                                className={`cc-mail-remove-btn ${isSelected ? "" : "add"}`}
                                title={isSelected ? "Remove attachment from this email" : "Attach this document"}
                                onClick={() => toggleDocumentAttachment(doc.id)}
                              >
                                {isSelected ? <X size={13} /> : <Plus size={13} />}
                              </button>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>

                {/* Pipeline Stage Transition Option */}
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", background: "#f8fafc", padding: "10px 14px", borderRadius: 10, border: "1px solid #e2e8f0" }}>
                  <label style={{ display: "inline-flex", alignItems: "center", gap: 8, fontSize: 13, color: "#334155", cursor: "pointer", fontWeight: 500 }}>
                    <input
                      type="checkbox"
                      checked={mailForm.updateStatus === "FILE_LOGIN"}
                      onChange={(e) =>
                        setMailForm({ ...mailForm, updateStatus: e.target.checked ? "FILE_LOGIN" : "" })
                      }
                      style={{ accentColor: "#047857" }}
                    />
                    <span>Automatically move application pipeline status to <strong>FILE_LOGIN</strong></span>
                  </label>
                  <span style={{ fontSize: 11.5, color: "#64748b" }}>Recommended for banker dispatch</span>
                </div>

                {/* Modal Action Buttons */}
                <div className="cc-modal-actions">
                  <button
                    type="button"
                    className="cc-modal-btn ghost"
                    onClick={() => setBankMailModalApp(null)}
                  >
                    Cancel
                  </button>
                  <button
                    type="button"
                    className="cc-modal-btn ghost"
                    style={{ borderColor: "#4338ca", color: "#4338ca" }}
                    onClick={() => setMailActiveTab("preview")}
                  >
                    <Eye size={14} /> Preview Email
                  </button>
                  <button
                    type="submit"
                    className="cc-modal-btn primary"
                    disabled={bankMailSubmitting}
                  >
                    {bankMailSubmitting ? (
                      <>
                        <RefreshCw className="cc-spin" size={14} /> Sending Email &amp; Documents...
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Send Email to Bank
                      </>
                    )}
                  </button>
                </div>
              </form>
            ) : (
              /* TAB 2: LIVE EMAIL PREVIEW */
              <div className="cc-mail-preview-wrapper">
                <div className="cc-email-preview-envelope">
                  <div className="cc-email-preview-headers">
                    <div className="cc-email-hdr-row">
                      <strong>From:</strong> <span>Operations Desk &lt;operations@capitalcare.com&gt;</span>
                    </div>
                    <div className="cc-email-hdr-row">
                      <strong>To:</strong>{" "}
                      <span style={{ color: "#047857", fontWeight: 700 }}>
                        {mailForm.toEmail || "(No RM email specified)"}
                      </span>
                    </div>
                    {mailForm.ccEmails && (
                      <div className="cc-email-hdr-row">
                        <strong>CC:</strong> <span>{mailForm.ccEmails}</span>
                      </div>
                    )}
                    <div className="cc-email-hdr-row">
                      <strong>Subject:</strong>{" "}
                      <span style={{ fontWeight: 700, color: "#0f172a" }}>
                        {mailForm.subject || "(Empty Subject)"}
                      </span>
                    </div>
                    <div className="cc-email-hdr-row">
                      <strong>Attachments:</strong>{" "}
                      <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                        {mailForm.selectedDocIds.length === 0 ? (
                          <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No attachments selected</span>
                        ) : (
                          (bankMailModalApp.documents || [])
                            .filter((d) => mailForm.selectedDocIds.includes(d.id))
                            .map((doc) => (
                              <span key={doc.id} className="cc-etpl-sample-att-badge">
                                📎 {doc.docType} ({doc.fileName})
                              </span>
                            ))
                        )}
                      </div>
                    </div>
                  </div>

                  <div className="cc-email-preview-body">
                    <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.65, color: "#334155" }}>
                      {mailForm.content || "(Empty message content)"}
                    </div>
                  </div>
                </div>

                <div className="cc-modal-actions" style={{ marginTop: 16 }}>
                  <button
                    type="button"
                    className="cc-modal-btn ghost"
                    onClick={() => setMailActiveTab("compose")}
                  >
                    <Pencil size={14} /> Back to Edit
                  </button>
                  <button
                    type="button"
                    className="cc-modal-btn primary"
                    onClick={handleSendBankEmail}
                    disabled={bankMailSubmitting}
                  >
                    {bankMailSubmitting ? (
                      <>
                        <RefreshCw className="cc-spin" size={14} /> Sending Email...
                      </>
                    ) : (
                      <>
                        <Send size={15} /> Confirm &amp; Send Email to Bank
                      </>
                    )}
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Reply to Banker Query Modal */}
      {replyTargetQuery && (
        <div className="cc-modal-overlay" onClick={() => setReplyTargetQuery(null)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div>
                <p>Clarification Hub</p>
                <h3>Reply to Banker Clarification Query</h3>
              </div>
              <button type="button" onClick={() => setReplyTargetQuery(null)}>
                <X size={16} />
              </button>
            </div>

            <form className="cc-modal-form" onSubmit={handleReplyQuerySubmit}>
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#9f1239",
                }}
              >
                <strong>Banker Query:</strong> "{replyTargetQuery.queryText}"
              </div>

              <label className="cc-modal-field">
                <span>Operations Response / Clarification Details *</span>
                <textarea
                  rows={4}
                  placeholder="e.g. Verified and uploaded fresh 3 months bank statements. Customer income matches criteria."
                  value={replyResponseText}
                  onChange={(e) => setReplyResponseText(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-btn ghost"
                  onClick={() => setReplyTargetQuery(null)}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-modal-btn primary" disabled={replySubmitting}>
                  <Send size={15} /> {replySubmitting ? "Sending..." : "Submit Reply"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const opsStyles = `
  .cc-ops-top-panel { padding: 10px 18px; margin-bottom: 14px; }
  .cc-ops-nav-cluster { display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; }
  .cc-ops-mode-tabs { display: flex; gap: 8px; flex-wrap: wrap; }
  .cc-ops-mode-btn {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    padding: 8px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #475569;
    cursor: pointer;
  }
  .cc-ops-mode-btn.active {
    background: #047857;
    color: #fff;
    border-color: #047857;
    box-shadow: 0 2px 6px rgba(4, 120, 87, 0.2);
  }

  .cc-ops-view-toggle {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 9px;
    gap: 2px;
  }
  .cc-ops-view-toggle button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: transparent;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
  }
  .cc-ops-view-toggle button.active {
    background: #fff;
    color: #047857;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  }

  /* Query Alert Panel */
  .cc-ops-query-alert-panel {
    background: #fff1f2;
    border: 1px solid #fecdd3;
    border-radius: 14px;
    padding: 14px 18px;
    margin-bottom: 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cc-ops-query-alert-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cc-query-alert-title {
    display: flex;
    align-items: center;
    gap: 8px;
    color: #be123c;
    font-size: 13.5px;
  }
  .cc-query-view-all-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: transparent;
    border: 0;
    color: #be123c;
    font-size: 12px;
    font-weight: 700;
    cursor: pointer;
  }
  .cc-ops-query-chips-scroll {
    display: flex;
    gap: 12px;
    overflow-x: auto;
    padding-bottom: 4px;
  }
  .cc-query-alert-chip {
    flex: 0 0 280px;
    background: #fff;
    border: 1px solid #fecdd3;
    border-radius: 10px;
    padding: 10px 12px;
    display: flex;
    flex-direction: column;
    justify-content: space-between;
    gap: 8px;
  }
  .cc-chip-meta { display: flex; justify-content: space-between; align-items: center; font-size: 11.5px; }
  .cc-chip-app { font-weight: 700; color: #0f172a; }
  .cc-chip-cust { color: #64748b; }
  .cc-chip-text { margin: 0; font-size: 12.5px; color: #be123c; line-height: 1.35; font-style: italic; }
  .cc-chip-answer-btn {
    align-self: flex-start;
    padding: 4px 10px;
    border-radius: 6px;
    background: #047857;
    color: #fff;
    border: 0;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }

  /* Filter Panel */
  .cc-ops-filter-panel { padding: 14px 18px; margin-bottom: 16px; background: #fff; border-radius: 12px; border: 1px solid #e2e8f0; }
  .cc-ops-filter-bar { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
  .cc-ops-search-box {
    position: relative;
    flex: 1 1 240px;
    min-width: 200px;
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 10px 0 34px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    background: #fff;
  }
  .cc-ops-search-box svg { position: absolute; left: 10px; color: #94a3b8; }
  .cc-ops-search-box input { width: 100%; border: 0; outline: none; font-size: 13px; color: #0f172a; }
  .cc-search-clear { border: 0; background: #f1f5f9; border-radius: 50%; width: 18px; height: 18px; display: grid; place-items: center; cursor: pointer; }

  .cc-ops-filter-control {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .cc-filter-icon {
    position: absolute;
    left: 10px;
    color: #64748b;
    pointer-events: none;
  }
  .cc-ops-select {
    height: 38px;
    padding: 0 12px 0 32px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    background: #fff;
    font-size: 12.5px;
    font-weight: 500;
    color: #1e293b;
    outline: none;
    cursor: pointer;
    transition: border-color 0.15s, box-shadow 0.15s;
  }
  .cc-ops-select:focus {
    border-color: #047857;
    box-shadow: 0 0 0 2px rgba(4, 120, 87, 0.15);
  }
  .cc-ops-select.highlight {
    background: #f0fdf4;
    border-color: #86efac;
    color: #047857;
    font-weight: 600;
    padding-left: 12px;
  }
  .cc-ops-date-range-inputs {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    padding: 2px 8px;
    height: 38px;
  }
  .cc-date-field {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 600;
    color: #64748b;
  }
  .cc-ops-date-input {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 3px 6px;
    font-size: 12px;
    color: #0f172a;
    outline: none;
    background: #fff;
  }
  .cc-ops-clear-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px;
    height: 38px;
    border-radius: 9px;
    background: #fef2f2;
    color: #be123c;
    border: 1px solid #fecdd3;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: background 0.15s;
  }
  .cc-ops-clear-filters-btn:hover {
    background: #fee2e2;
  }

  .cc-ops-stage-filter-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 10px;
    gap: 2px;
    overflow-x: auto;
  }
  .cc-ops-stage-filter-tabs button {
    border: 0;
    background: transparent;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    white-space: nowrap;
  }
  .cc-ops-stage-filter-tabs button.active {
    background: #fff;
    color: #047857;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
  .cc-ops-stage-filter-tabs button.completed-tab.active {
    background: #047857 !important;
    color: #fff !important;
  }
  .cc-ops-stage-filter-tabs button.pending-tab.active {
    background: #d97706 !important;
    color: #fff !important;
  }
  .cc-ops-icon-refresh {
    border: 1px solid #cbd5e1;
    background: #fff;
    width: 38px;
    height: 38px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    color: #475569;
    cursor: pointer;
  }

  /* KANBAN BOARD */
  .cc-ops-kanban-board {
    display: flex;
    gap: 14px;
    overflow-x: auto;
    padding-bottom: 18px;
    align-items: flex-start;
    min-height: 600px;
  }
  .cc-kanban-column {
    flex: 0 0 280px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    display: flex;
    flex-direction: column;
    max-height: 80vh;
  }
  .cc-kanban-col-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 12px 14px;
    border-top: 4px solid #94a3b8;
    border-bottom: 1px solid #e2e8f0;
    border-radius: 14px 14px 0 0;
    background: #fff;
  }
  .cc-kanban-col-title { display: flex; align-items: center; gap: 8px; }
  .cc-col-dot { width: 8px; height: 8px; border-radius: 50%; }
  .cc-kanban-col-title h3 { margin: 0; font-size: 13px; font-weight: 700; color: #0f172a; }
  .cc-kanban-count { font-size: 11px; font-weight: 700; background: #f1f5f9; color: #475569; padding: 2px 8px; border-radius: 999px; }

  .cc-kanban-cards-wrap {
    padding: 10px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cc-kanban-empty {
    text-align: center;
    padding: 24px 12px;
    font-size: 12px;
    color: #94a3b8;
  }
  .cc-kanban-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px;
    cursor: pointer;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    transition: transform 0.1s, box-shadow 0.1s, border-color 0.1s;
    display: flex;
    flex-direction: column;
    gap: 6px;
  }
  .cc-kanban-card:hover {
    border-color: #047857;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.08);
    transform: translateY(-2px);
  }
  .cc-kcard-top { display: flex; justify-content: space-between; align-items: center; }
  .cc-kcard-appnum { font-size: 11px; font-weight: 700; color: #047857; font-family: monospace; }
  .cc-kcard-query-alert {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 4px;
    background: #fff1f2;
    color: #be123c;
  }
  .cc-kcard-name { font-size: 13.5px; color: #0f172a; }
  .cc-kcard-contact { font-size: 11px; color: #64748b; }
  .cc-kcard-finance {
    display: flex;
    justify-content: space-between;
    background: #f8fafc;
    border-radius: 6px;
    padding: 6px 8px;
    margin-top: 4px;
  }
  .cc-kcard-finance small { display: block; font-size: 10px; color: #94a3b8; }
  .cc-kcard-finance span, .cc-kcard-finance strong { font-size: 11.5px; color: #0f172a; }
  .cc-kcard-footer { display: flex; justify-content: space-between; align-items: center; font-size: 11px; color: #64748b; margin-top: 2px; }
  .cc-kcard-lender { display: inline-flex; align-items: center; gap: 4px; font-weight: 600; color: #4338ca; }
  .cc-kcard-banker { display: inline-flex; align-items: center; gap: 4px; color: #047857; }

  /* Table styling */
  .cc-ops-table-row { cursor: pointer; }
  .cc-ops-table-row:hover { background: #f8fafc; }
  .cc-ops-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    font-weight: 600;
    padding: 3px 8px;
    border-radius: 6px;
  }
  .cc-ops-badge.lender { background: #eef2ff; color: #4338ca; }
  .cc-ops-badge.banker { background: #eef7f2; color: #047857; }

  .cc-ops-status-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 3px 9px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 700;
    background: #f1f5f9;
    color: #475569;
    letter-spacing: 0.2px;
  }
  .cc-ops-status-tag.completed-green {
    background: #ecfdf5 !important;
    color: #047857 !important;
    border: 1px solid #10b981 !important;
    box-shadow: 0 1px 3px rgba(16, 185, 129, 0.15);
  }
  .cc-ops-status-tag.pending-amber {
    background: #fffbeb !important;
    color: #b45309 !important;
    border: 1px solid #fcd34d !important;
  }
  .cc-ops-status-tag.rejected {
    background: #fef2f2 !important;
    color: #b91c1c !important;
    border: 1px solid #fca5a5 !important;
  }
  .cc-ops-status-tag.sanctioned { background: #dcfce7; color: #166534; border: 1px solid #86efac; }
  .cc-ops-status-tag.disbursed { background: #ecfdf5; color: #047857; border: 1px solid #10b981; }
  .cc-ops-status-tag.query_raised { background: #fff1f2; color: #be123c; border: 1px solid #fecdd3; }

  .cc-ops-query-flag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .cc-ops-query-flag.alert { background: #fff1f2; color: #be123c; }
  .cc-ops-query-flag.resolved { background: #f0fdf4; color: #15803d; }

  .cc-ops-action-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 5px 12px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #047857;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .cc-ops-action-btn:hover { background: #047857; color: #fff; border-color: #047857; }

  /* Leads queue */
  .cc-ops-leads-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
  .cc-leads-hint { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #64748b; margin: 0; }
  .cc-ops-owner-tag { display: inline-flex; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; font-size: 11.5px; font-weight: 600; color: #475569; }
  .cc-ops-convert-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 6px 14px;
    border-radius: 8px;
    background: #047857;
    color: #fff;
    border: 0;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .cc-ops-convert-btn:hover { background: #065f46; }

  /* Verification Drawer */
  .cc-ops-drawer {
    width: 100%;
    max-width: 800px;
    background: #fff;
    height: 100vh;
    display: flex;
    flex-direction: column;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.18);
    animation: slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  .cc-ops-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .cc-ops-drawer-header h2 { margin: 0; font-size: 20px; font-weight: 700; color: #0f172a; }
  .cc-ops-drawer-header p { margin: 4px 0 0; font-size: 12.5px; color: #64748b; }
  .cc-drawer-close-btn { border: 0; background: #e2e8f0; color: #475569; width: 34px; height: 34px; border-radius: 8px; display: grid; place-items: center; cursor: pointer; }

  .cc-ops-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 20px;
  }

  .cc-ops-stage-selector-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cc-ops-stage-selector-box label { display: inline-flex; align-items: center; gap: 6px; font-size: 12px; font-weight: 700; color: #334155; text-transform: uppercase; }
  .cc-stage-btn-cluster { display: flex; flex-wrap: wrap; gap: 6px; }
  .cc-stage-btn-cluster button {
    border: 1px solid #cbd5e1;
    background: #fff;
    padding: 5px 10px;
    border-radius: 7px;
    font-size: 11.5px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
  }
  .cc-stage-btn-cluster button.active {
    background: #047857;
    color: #fff;
    border-color: #047857;
  }

  .cc-ops-drawer-section {
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    background: #fff;
  }
  .cc-drawer-sec-title { display: flex; align-items: center; gap: 8px; font-size: 14px; font-weight: 700; color: #0f172a; margin-bottom: 14px; }

  .cc-ops-no-docs { text-align: center; padding: 24px; background: #f8fafc; border-radius: 10px; border: 1px dashed #cbd5e1; }
  .cc-ops-no-docs p { margin: 0; font-size: 13px; font-weight: 600; color: #475569; }
  .cc-ops-no-docs small { display: block; font-size: 11.5px; color: #94a3b8; margin-top: 4px; }

  .cc-ops-docs-list { display: flex; flex-direction: column; gap: 10px; margin-bottom: 14px; }
  .cc-ops-doc-card {
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    background: #f8fafc;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cc-ops-doc-card.verified { border-left: 4px solid #10b981; }
  .cc-ops-doc-card.rejected { border-left: 4px solid #f43f5e; }
  .cc-ops-doc-card.reupload_required { border-left: 4px solid #f59e0b; }

  .cc-doc-main { display: flex; align-items: flex-start; gap: 12px; }
  .cc-doc-icon-shell { width: 36px; height: 36px; border-radius: 8px; background: #e2e8f0; display: grid; place-items: center; color: #475569; flex-shrink: 0; }
  .cc-doc-meta { flex: 1; }
  .cc-doc-meta strong { font-size: 13px; color: #0f172a; }
  .cc-doc-meta small { display: block; font-size: 11.5px; color: #64748b; margin-top: 1px; }
  .cc-doc-reject-note { margin: 4px 0 0; font-size: 11.5px; color: #b91c1c; background: #fef2f2; padding: 4px 8px; border-radius: 6px; }

  .cc-doc-status-pill { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
  .cc-doc-status-pill.verified { background: #dcfce7; color: #166534; }
  .cc-doc-status-pill.rejected { background: #fee2e2; color: #991b1b; }
  .cc-doc-status-pill.reupload_required { background: #fef3c7; color: #92400e; }
  .cc-doc-status-pill.pending { background: #f1f5f9; color: #475569; }

  .cc-doc-actions-row { display: flex; gap: 6px; flex-wrap: wrap; align-items: center; padding-top: 6px; border-top: 1px solid #eef1ee; }
  .cc-doc-open-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; color: #0f172a; background: #fff; border: 1px solid #cbd5e1; padding: 4px 10px; border-radius: 6px; text-decoration: none; }
  .cc-doc-act-btn { display: inline-flex; align-items: center; gap: 4px; font-size: 11.5px; font-weight: 600; padding: 4px 10px; border-radius: 6px; border: 1px solid transparent; cursor: pointer; }
  .cc-doc-act-btn.verify { background: #f0fdf4; color: #15803d; border-color: #bbf7d0; }
  .cc-doc-act-btn.verify.active { background: #15803d; color: #fff; }
  .cc-doc-act-btn.reupload { background: #fffbeb; color: #b45309; border-color: #fde68a; }
  .cc-doc-act-btn.reject { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }

  .cc-ops-upload-box { background: #f8fafc; border: 1px dashed #cbd5e1; border-radius: 10px; padding: 12px; display: flex; flex-direction: column; gap: 8px; }
  .cc-upload-box-title { font-size: 12px; font-weight: 700; color: #334155; display: flex; align-items: center; gap: 6px; }
  .cc-upload-box-row { display: flex; gap: 8px; flex-wrap: wrap; align-items: center; }
  .cc-upload-box-row select, .cc-upload-box-row input { padding: 6px 10px; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12.5px; background: #fff; }
  .cc-upload-submit-btn { padding: 6px 14px; border-radius: 8px; background: #047857; color: #fff; border: 0; font-size: 12px; font-weight: 600; cursor: pointer; }

  /* Queries stream in drawer */
  .cc-ops-queries-stream { display: flex; flex-direction: column; gap: 10px; }
  .cc-ops-query-box { border: 1px solid #e2e8f0; border-radius: 10px; padding: 12px; background: #f8fafc; }
  .cc-ops-query-box.open { border-left: 4px solid #f43f5e; }
  .cc-ops-query-box.resolved { border-left: 4px solid #10b981; }
  .cc-qbox-head { display: flex; justify-content: space-between; align-items: center; margin-bottom: 6px; }
  .cc-qbox-tag { font-size: 10px; font-weight: 700; padding: 1px 6px; border-radius: 4px; }
  .cc-qbox-tag.open { background: #fff1f2; color: #be123c; }
  .cc-qbox-tag.resolved { background: #dcfce7; color: #166534; }
  .cc-qbox-text { margin: 0; font-size: 13px; color: #0f172a; }
  .cc-qbox-ans { margin-top: 8px; padding: 8px 12px; background: #fff; border: 1px solid #cbd5e1; border-radius: 8px; font-size: 12px; color: #065f46; }
  .cc-qbox-reply-action { margin-top: 8px; }
  .cc-qbox-answer-btn { padding: 5px 12px; border-radius: 6px; background: #047857; color: #fff; border: 0; font-size: 11.5px; font-weight: 600; cursor: pointer; }

  /* Full Screen Overlays & Modals */
  .cc-ops-drawer-overlay {
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

  /* Bank Email Dispatch Modal & Buttons */
  .cc-kcard-dispatch-row {
    margin-top: 8px;
    padding-top: 8px;
    border-top: 1px dashed #e2e8f0;
  }
  .cc-kcard-mail-btn {
    width: 100%;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 6px;
    padding: 5px 8px;
    border-radius: 6px;
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #bbf7d0;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s ease;
  }
  .cc-kcard-mail-btn:hover {
    background: #047857;
    color: #fff;
    border-color: #047857;
  }

  .cc-ops-action-btn.mail-dispatch {
    background: #ecfdf5;
    color: #047857;
    border-color: #a7f3d0;
  }
  .cc-ops-action-btn.mail-dispatch:hover {
    background: #047857;
    color: #fff;
  }

  .cc-drawer-mail-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 14px;
    border-radius: 8px;
    background: #047857;
    color: #fff;
    border: 0;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all .15s ease;
    box-shadow: 0 2px 6px rgba(4,120,87,0.25);
  }
  .cc-drawer-mail-btn:hover {
    background: #065f46;
    transform: translateY(-1px);
  }

  .cc-modal-card.cc-mail-modal-large {
    max-width: 820px;
    width: 100%;
    max-height: 94vh;
    padding: 22px 26px;
    display: flex;
    flex-direction: column;
    gap: 14px;
    overflow-y: auto;
  }
  .cc-mail-modal-badge {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 2px 8px;
    border-radius: 999px;
    background: #ecfdf5;
    color: #047857;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid #bbf7d0;
  }
  .cc-mail-app-no {
    font-size: 11.5px;
    color: #64748b;
    font-weight: 700;
  }
  .cc-mail-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 8px;
    gap: 3px;
  }
  .cc-mail-tab {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 6px;
    border: 0;
    background: transparent;
    color: #475569;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    transition: all .12s;
  }
  .cc-mail-tab.active {
    background: #fff;
    color: #0f172a;
    box-shadow: 0 1px 3px rgba(0,0,0,0.1);
  }
  .cc-mail-close-btn {
    border: 0;
    background: #f1f5f9;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #475569;
  }

  .cc-mail-section-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cc-mail-section-title {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    font-size: 12.5px;
    font-weight: 700;
    color: #1e293b;
  }
  .cc-mail-field-shell {
    display: flex;
    flex-direction: column;
    gap: 5px;
  }
  .cc-mail-field-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cc-mail-var-pills {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    flex-wrap: wrap;
  }
  .cc-mail-var-btn {
    border: 1px dashed #cbd5e1;
    background: #fff;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10.5px;
    color: #047857;
    font-weight: 600;
    cursor: pointer;
    transition: all .12s;
  }
  .cc-mail-var-btn:hover {
    background: #ecfdf5;
    border-color: #047857;
  }
  .cc-mail-subject-input {
    width: 100%;
    box-sizing: border-box;
    padding: 9px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 13px;
    color: #0f172a;
    background: #fff;
    outline: none;
  }
  .cc-mail-subject-input:focus {
    border-color: #047857;
    box-shadow: 0 0 0 3px rgba(4,120,87,0.12);
  }
  .cc-mail-textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 13px;
    font-family: inherit;
    line-height: 1.55;
    color: #0f172a;
    background: #fff;
    resize: vertical;
    outline: none;
  }
  .cc-mail-textarea:focus {
    border-color: #047857;
    box-shadow: 0 0 0 3px rgba(4,120,87,0.12);
  }

  .cc-mail-count-pill {
    padding: 2px 7px;
    border-radius: 999px;
    background: #fef3c7;
    color: #b45309;
    font-size: 11px;
    font-weight: 700;
  }
  .cc-mail-link-btn {
    border: 0;
    background: none;
    padding: 0;
    color: #047857;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    text-decoration: underline;
  }
  .cc-mail-no-docs {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 12px 14px;
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 8px;
    font-size: 12.5px;
    color: #92400e;
  }

  .cc-mail-docs-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
    gap: 8px;
    max-height: 200px;
    overflow-y: auto;
    padding: 2px;
  }
  .cc-mail-doc-card {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 7px 10px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    background: #fff;
    cursor: pointer;
    transition: all .12s ease;
    user-select: none;
  }
  .cc-mail-doc-card:hover {
    border-color: #047857;
  }
  .cc-mail-doc-card.selected {
    background: #f0fdf4;
    border-color: #86efac;
  }
  .cc-mail-doc-card.deselected {
    background: #f8fafc;
    opacity: 0.65;
  }
  .cc-mail-doc-check input {
    cursor: pointer;
    accent-color: #047857;
  }
  .cc-mail-doc-info {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cc-mail-doc-type {
    font-size: 12px;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cc-mail-doc-status {
    font-size: 9.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
    text-transform: uppercase;
  }
  .cc-mail-doc-status.verified { background: #dcfce7; color: #15803d; }
  .cc-mail-doc-status.pending { background: #fef3c7; color: #b45309; }
  .cc-mail-doc-name {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cc-mail-doc-actions {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .cc-mail-doc-view-btn {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    display: grid;
    place-items: center;
    background: #f1f5f9;
    color: #475569;
    text-decoration: none;
  }
  .cc-mail-doc-view-btn:hover {
    background: #e2e8f0;
    color: #0f172a;
  }
  .cc-mail-remove-btn {
    width: 22px;
    height: 22px;
    border-radius: 4px;
    border: 0;
    display: grid;
    place-items: center;
    background: #fee2e2;
    color: #dc2626;
    cursor: pointer;
  }
  .cc-mail-remove-btn.add {
    background: #ecfdf5;
    color: #047857;
  }

  .cc-mail-preview-wrapper {
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
`;
