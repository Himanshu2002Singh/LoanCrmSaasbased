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
  Link,
  Download,
  RotateCcw,
} from "lucide-react";
import API_URL from "../../config";
import LeadDocumentRequestModal from "../leads/LeadDocumentRequestModal";
import CcPagination from "../../components/CcPagination";
import { formatLeadCode, formatCurrencyCompact } from "../../utils/leadUtils";

const DEFAULT_PAGE_SIZE = 10;
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

const WhatsAppIcon = ({ size = 14, style = {} }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="#25D366" style={{ flexShrink: 0, ...style }}>
    <path d="M17.472 14.382c-.297-.149-1.758-.867-2.03-.967-.273-.099-.471-.148-.67.15-.197.297-.767.966-.94 1.164-.173.199-.347.223-.644.075-.297-.15-1.255-.463-2.39-1.475-.883-.788-1.48-1.761-1.653-2.059-.173-.297-.018-.458.13-.606.134-.133.298-.347.446-.52.149-.174.198-.298.298-.497.099-.198.05-.371-.025-.52-.075-.149-.669-1.612-.916-2.207-.242-.579-.487-.5-.669-.51-.173-.008-.371-.01-.57-.01-.198 0-.52.074-.792.372-.272.297-1.04 1.016-1.04 2.479 0 1.462 1.065 2.875 1.213 3.074.149.198 2.096 3.2 5.077 4.487.709.306 1.262.489 1.694.625.712.227 1.36.195 1.871.118.571-.085 1.758-.719 2.006-1.413.248-.694.248-1.289.173-1.413-.074-.124-.272-.198-.57-.347m-5.421 7.403h-.004a9.87 9.87 0 01-5.031-1.378l-.361-.214-3.741.982.998-3.648-.235-.374a9.86 9.86 0 01-1.51-5.26c.001-5.45 4.436-9.884 9.888-9.884 2.64 0 5.122 1.03 6.988 2.898a9.825 9.825 0 012.893 6.994c-.003 5.45-4.437 9.884-9.885 9.884m8.413-18.297A11.815 11.815 0 0012.05 0C5.495 0 .16 5.335.157 11.892c0 2.096.547 4.142 1.588 5.945L0 24l6.335-1.662c1.746.953 3.71 1.456 5.711 1.457h.004c6.554 0 11.89-5.335 11.893-11.893a11.821 11.821 0 00-3.48-8.413Z"/>
  </svg>
);

const shareOnWhatsApp = ({ mobile, customerName, appNumber, lenderName, stageTitle, remark }) => {
  if (!mobile || mobile === "—") {
    toast.error("Customer mobile number not found!");
    return;
  }
  const clean = String(mobile).replace(/\D/g, "");
  const formatted = clean.length === 10 ? `91${clean}` : clean;
  
  let text = `Hello ${customerName || "Customer"},\n\n`;
  text += `Update regarding your Loan Application #${appNumber || "—"}`;
  if (lenderName) text += ` with *${lenderName}*`;
  text += `:\n\n`;
  if (stageTitle) text += `📌 *Status / Query:* ${stageTitle}\n`;
  if (remark) text += `📝 *Details / Reason:* ${remark}\n\n`;
  text += `Please review and update us with the required information/documents.\n\nThank you,\nOperations Team`;
  
  const url = `https://wa.me/${formatted}?text=${encodeURIComponent(text)}`;
  window.open(url, "_blank");
};

const PIPELINE_STAGES = [
  { key: "DOCS_PENDING", label: "1. Docs Pending", color: "#b45309", bg: "#fef3c7", border: "#fde68a" },
  { key: "READY_TO_SEND", label: "2. Ready to Send", color: "#4f46e5", bg: "#eef2ff", border: "#c7d2fe" },
  { key: "SUBMITTED_TO_BANK", label: "3. Submitted to Bank", color: "#0369a1", bg: "#e0f2fe", border: "#bae6fd" },
  { key: "LOGIN", label: "4. Bank Login", color: "#0284c7", bg: "#f0f9ff", border: "#bae6fd" },
  { key: "PD", label: "5. PD Status", color: "#6366f1", bg: "#eef2ff", border: "#c7d2fe" },
  { key: "QUERY", label: "6. Banker Query", color: "#e11d48", bg: "#ffe4e6", border: "#fecdd3" },
  { key: "LEGAL", label: "7. Legal", color: "#7c3aed", bg: "#f5f3ff", border: "#ddd6fe" },
  { key: "TECHNICAL", label: "8. Technical", color: "#0891b2", bg: "#ecfeff", border: "#a5f3fc" },
  { key: "SANCTIONED", label: "9. Sanctioned", color: "#15803d", bg: "#f0fdf4", border: "#bbf7d0" },
  { key: "DISBURSEMENT", label: "10. Disbursement", color: "#0d9488", bg: "#f0fdfa", border: "#99f6e4" },
  { key: "OTC", label: "11. OTC", color: "#ea580c", bg: "#fff7ed", border: "#ffedd5" },
  { key: "CANCELLED", label: "12. Cancelled", color: "#475569", bg: "#f1f5f9", border: "#cbd5e1" },
  { key: "DISBURSED", label: "13. Final Disbursed", color: "#047857", bg: "#ecfdf5", border: "#a7f3d0" },
  { key: "PDD", label: "14. PDD", color: "#d97706", bg: "#fffbeb", border: "#fde68a" },
  { key: "ALL_PROCESS_COMPLETED", label: "15. All Process Completed", color: "#059669", bg: "#ecfdf5", border: "#6ee7b7" },
  { key: "REJECTED", label: "Rejected", color: "#b91c1c", bg: "#fef2f2", border: "#fecaca" },
];

const BANK_STAGE_CARDS = [
  { key: "LOGGED_IN", label: "LOGGED IN" },
  { key: "UNDER_PROCESS", label: "UNDER PROCESS" },
  { key: "QUERY_RAISED", label: "QUERY RAISED" },
  { key: "SANCTIONED", label: "SANCTIONED" },
  { key: "STATUS_NOT_SET", label: "STATUS NOT SET" },
];

const renderOpsStatusCell = ({
  status,
  updatedAt,
  remark,
  onClick,
  pendingText = "Pending",
  completedText = "Completed",
  app,
  stageTitle = "Status Update",
  onViewRemark,
  onWhatsApp,
}) => {
  const stUpper = String(status || "").toUpperCase();
  const isDone = stUpper === "COMPLETED" || stUpper === "RESOLVED";
  const isInit = stUpper === "INITIATED";
  const isRej = stUpper === "REJECTED";
  const isPend = stUpper === "PENDING";
  const isNone = !status || stUpper === "NONE" || stUpper === "NO_QUERY" || stUpper === "NOT_STARTED";

  let badgeClass = "pending";
  let label = isDone ? `${completedText} ✓` : isInit ? "Initiated ⚡" : isRej ? "Rejected ❌" : isPend ? `${pendingText} ⏳` : "— Update";
  if (isDone) badgeClass = "resolved";
  else if (isInit) badgeClass = "initiated";
  else if (isRej) badgeClass = "rejected";
  else if (isNone) {
    badgeClass = "not-started";
    label = "Update";
  }

  return (
    <td
      onClick={(e) => {
        e.stopPropagation();
        if (onClick) onClick();
      }}
      className="cc-ops-clickable-status-td"
      title="Click to update status and remark"
    >
      <div className="cc-ops-status-cell-inner">
        <span className={`cc-substatus-pill ${badgeClass}`}>
          <strong>{label}</strong>
        </span>
        {updatedAt ? (
          <div className="cc-status-cell-time">
            <Clock size={10} />
            <span>
              {new Date(updatedAt).toLocaleDateString("en-IN", {
                day: "2-digit",
                month: "short",
                hour: "2-digit",
                minute: "2-digit",
                hour12: true,
              })}
            </span>
          </div>
        ) : null}
        {remark ? (
          <div
            className="cc-status-cell-remark-wrap"
            style={{
              display: "flex",
              alignItems: "center",
              gap: 4,
              marginTop: 3,
              background: "#f8fafc",
              border: "1px solid #e2e8f0",
              borderRadius: 6,
              padding: "2px 5px",
              maxWidth: "100%",
              width: "100%",
              boxSizing: "border-box",
            }}
          >
            <div
              className="cc-status-cell-remark"
              onClick={(e) => {
                if (onViewRemark) {
                  e.stopPropagation();
                  onViewRemark({
                    title: `${stageTitle || label} Remark`,
                    stage: stageTitle || label,
                    remark,
                    updatedAt,
                    app,
                  });
                }
              }}
              title="Click to view full remark popup"
              style={{
                flex: 1,
                fontSize: 11,
                color: "#1e293b",
                cursor: "pointer",
                whiteSpace: "nowrap",
                overflow: "hidden",
                textOverflow: "ellipsis",
                fontWeight: 500,
              }}
            >
              "{remark.length > 20 ? remark.slice(0, 20) + "…" : remark}"
              <span style={{ color: "#2563eb", fontWeight: 700, marginLeft: 4, fontSize: 10 }}>View</span>
            </div>
            {app && (app.customer?.mobile || app.customerMobile) && (
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  if (onWhatsApp) {
                    onWhatsApp({
                      mobile: app.customer?.mobile || app.customerMobile,
                      customerName: app.customer?.name,
                      appNumber: app.applicationNumber,
                      lenderName: app.lender?.name,
                      stageTitle: stageTitle || label,
                      remark,
                    });
                  }
                }}
                title="Direct Share this Remark / Query to Customer on WhatsApp"
                style={{
                  background: "#dcfce7",
                  border: "1px solid #86efac",
                  borderRadius: "50%",
                  width: 20,
                  height: 20,
                  display: "inline-flex",
                  alignItems: "center",
                  justifyContent: "center",
                  cursor: "pointer",
                  padding: 0,
                  flexShrink: 0,
                }}
              >
                <WhatsAppIcon size={12} />
              </button>
            )}
          </div>
        ) : null}
      </div>
    </td>
  );
};

function MultiSelectDropdown({
  label,
  icon: Icon,
  options = [],
  selectedValues = [],
  onChange,
  searchPlaceholder = "Search...",
}) {
  const [isOpen, setIsOpen] = useState(false);
  const [query, setQuery] = useState("");
  const dropdownRef = useRef(null);

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target)) {
        setIsOpen(false);
      }
    };
    if (isOpen) {
      document.addEventListener("mousedown", handleClickOutside);
    }
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, [isOpen]);

  const filteredOptions = useMemo(() => {
    if (!query.trim()) return options;
    const q = query.toLowerCase();
    return options.filter(
      (opt) =>
        (opt.label || "").toLowerCase().includes(q) ||
        (opt.subtitle || "").toLowerCase().includes(q)
    );
  }, [options, query]);

  const toggleOption = (val) => {
    const exists = selectedValues.includes(val);
    let next;
    if (exists) {
      next = selectedValues.filter((v) => v !== val);
    } else {
      next = [...selectedValues, val];
    }
    onChange(next);
  };

  const clearSelection = (e) => {
    e.stopPropagation();
    onChange([]);
  };

  const hasSelection = selectedValues.length > 0;

  const summaryLabel = useMemo(() => {
    if (!hasSelection) return `All ${label}`;
    if (selectedValues.length === 1) {
      const match = options.find((o) => o.value === selectedValues[0]);
      return match ? match.label : `1 ${label}`;
    }
    return `${selectedValues.length} ${label}s`;
  }, [hasSelection, selectedValues, options, label]);

  return (
    <div className="cc-ops-multiselect" ref={dropdownRef}>
      <button
        type="button"
        className={`cc-ops-multiselect-btn ${hasSelection ? "active" : ""}`}
        onClick={() => setIsOpen((prev) => !prev)}
        title={`Filter by ${label}`}
      >
        {Icon && <Icon size={13} className="cc-multiselect-icon" />}
        <span className="cc-multiselect-label">{summaryLabel}</span>
        {hasSelection ? (
          <span
            className="cc-multiselect-badge"
            onClick={clearSelection}
            title="Clear selection"
          >
            {selectedValues.length} <X size={10} />
          </span>
        ) : (
          <span className="cc-multiselect-chevron">▾</span>
        )}
      </button>

      {isOpen && (
        <div className="cc-ops-multiselect-menu">
          <div className="cc-ops-multiselect-search">
            <Search size={13} />
            <input
              type="text"
              autoFocus
              placeholder={searchPlaceholder}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
            {query && (
              <button type="button" onClick={() => setQuery("")}>
                <X size={12} />
              </button>
            )}
          </div>

          <div className="cc-ops-multiselect-actions">
            <button
              type="button"
              onClick={() => onChange(options.map((o) => o.value))}
            >
              Select All
            </button>
            <button type="button" onClick={() => onChange([])}>
              Clear
            </button>
          </div>

          <div className="cc-ops-multiselect-list">
            {filteredOptions.length === 0 ? (
              <div className="cc-ops-multiselect-empty">No options found</div>
            ) : (
              filteredOptions.map((opt) => {
                const isChecked = selectedValues.includes(opt.value);
                return (
                  <label
                    key={opt.value}
                    className={`cc-ops-multiselect-item ${isChecked ? "checked" : ""}`}
                  >
                    <input
                      type="checkbox"
                      checked={isChecked}
                      onChange={() => toggleOption(opt.value)}
                    />
                    <div className="cc-ops-multiselect-item-content">
                      <span className="cc-ops-multiselect-item-text">
                        {opt.label}
                      </span>
                      {opt.subtitle && (
                        <span className="cc-ops-multiselect-item-sub">
                          {opt.subtitle}
                        </span>
                      )}
                    </div>
                  </label>
                );
              })
            )}
          </div>
        </div>
      )}
    </div>
  );
}

const renderWorkflowStageBadge = (app) => {
  const s = String(app.status || "DOCS_PENDING").toUpperCase();
  const isPddPending = (app.pddStatus || "PENDING").toUpperCase() === "PENDING";
  const isOtcPending = (app.otcStatus || "PENDING").toUpperCase() === "PENDING";

  if (s === "DISBURSED") {
    return (
      <span className="cc-ops-status-tag completed-green" title="Final Loan Disbursed">
        <CheckCircle2 size={13} /> Disbursed
      </span>
    );
  }
  if (s === "CANCELLED" || app.disbursementStatus === "CANCELLED") {
    return (
      <span className="cc-ops-status-tag rejected" title={app.disbursedRemark || app.rejectionReason || "Disbursement Cancelled"}>
        <XCircle size={13} /> Cancelled
      </span>
    );
  }
  if (s === "REJECTED") {
    return (
      <span className="cc-ops-status-tag rejected" title={app.rejectionReason || "Application Rejected"}>
        <XCircle size={13} /> Rejected
      </span>
    );
  }
  if (s === "DISBURSEMENT") {
    return (
      <span className="cc-ops-status-tag" style={{ background: "#f0fdfa", color: "#0d9488", border: "1px solid #99f6e4" }} title="Disbursed - Awaiting PDD/OTC Tracking">
        <CheckCircle2 size={13} /> Disbursement
      </span>
    );
  }
  if (s === "SANCTIONED" || s === "APPROVED") {
    if (isPddPending || isOtcPending) {
      return (
        <span className="cc-ops-status-tag pending-amber" title="Sanctioned - Pending PDD/OTC Resolution">
          <Clock size={12} /> Pending for Disbursement
        </span>
      );
    }
    return (
      <span className="cc-ops-status-tag ready-green" title="PDD & OTC Resolved - Ready to Disburse">
        <CheckCircle2 size={13} /> Ready to Disburse
      </span>
    );
  }
  if (app.technicalStatus === "INITIATED") {
    return (
      <span className="cc-ops-status-tag info-blue" title="Technical Inspection / Verification in Progress">
        <Clock size={12} /> Technical: Initiated
      </span>
    );
  }
  if (app.legalStatus === "INITIATED") {
    return (
      <span className="cc-ops-status-tag info-blue" title="Legal Title Verification in Progress">
        <Clock size={12} /> Legal: Initiated
      </span>
    );
  }
  if (s === "LOGIN" || s === "LOGGED_IN" || (app.loginStatus || "").toUpperCase() === "COMPLETED") {
    return (
      <span className="cc-ops-status-tag info-blue" style={{ background: "#f0f9ff", color: "#0284c7", borderColor: "#bae6fd" }} title="File Logged in Bank Portal">
        <CheckCircle2 size={12} /> Bank Login
      </span>
    );
  }
  if (s === "SUBMITTED_TO_BANK" || s === "UNDER_REVIEW") {
    return (
      <span className="cc-ops-status-tag info-blue" title="Submitted to Bank Partner">
        <Send size={12} /> Submitted to Bank
      </span>
    );
  }
  if (s === "READY_TO_SEND") {
    return (
      <span className="cc-ops-status-tag ready-purple" title="Ready to Send">
        <FileCheck size={12} /> Ready to Send
      </span>
    );
  }
  return (
    <span className="cc-ops-status-tag pending-amber" title="Documents Pending">
      <Clock size={12} /> Documents Pending
    </span>
  );
};

const renderStagePendingNotice = (app) => {
  const s = String(app.status || "DOCS_PENDING").toUpperCase();
  const isPddPending = (app.pddStatus || "PENDING").toUpperCase() === "PENDING";
  const isOtcPending = (app.otcStatus || "PENDING").toUpperCase() === "PENDING";

  if (s === "DISBURSED") return null;

  if (s === "DISBURSEMENT") {
    if (isPddPending || isOtcPending) {
      return (
        <div className="cc-stage-stuck-notice warning">
          ⚠️ Loan Disbursed! Case is currently pending for PDD &amp; OTC document resolution.
        </div>
      );
    }
    return (
      <div className="cc-stage-stuck-notice success">
        ✓ PDD &amp; OTC Resolved. Case is eligible for Final Disbursement.
      </div>
    );
  }

  if (s === "SANCTIONED" || s === "APPROVED") {
    if (isPddPending && isOtcPending) {
      return (
        <div className="cc-stage-stuck-notice warning">
          ⚠️ Case is currently pending for PDD &amp; OTC resolution.
        </div>
      );
    }
    if (isPddPending) {
      return (
        <div className="cc-stage-stuck-notice warning">
          ⚠️ Case is currently pending for PDD resolution.
        </div>
      );
    }
    if (isOtcPending) {
      return (
        <div className="cc-stage-stuck-notice warning">
          ⚠️ Case is currently pending for OTC completion.
        </div>
      );
    }
    return (
      <div className="cc-stage-stuck-notice success">
        ✓ PDD &amp; OTC Resolved. Case is eligible for Final Disbursement.
      </div>
    );
  }

  if (app.legalStatus === "INITIATED") {
    return (
      <div className="cc-stage-stuck-notice info">
        ℹ️ Case is currently pending at Legal verification.
      </div>
    );
  }
  if (app.technicalStatus === "INITIATED") {
    return (
      <div className="cc-stage-stuck-notice info">
        ℹ️ Case is currently pending at Technical inspection.
      </div>
    );
  }
  if (s === "SUBMITTED_TO_BANK") {
    return (
      <div className="cc-stage-stuck-notice neutral">
        🏛️ Awaiting underwriting decision from {app.lender?.name || "Bank"}.
      </div>
    );
  }
  if (s === "DOCS_PENDING") {
    return (
      <div className="cc-stage-stuck-notice neutral">
        📄 Pending customer KYC &amp; income documents.
      </div>
    );
  }
  return null;
};

export default function OperationsRedesign() {
  const navigate = useNavigate();
  const employeeId = localStorage.getItem("employeeId");
  const employeeRole = localStorage.getItem("employeeRole");
  const userRole = localStorage.getItem("userRole") || "";
  const isCompanyAdmin = userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN";

  const userPermissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  }, []);

  const canManageOperations = isCompanyAdmin || (userPermissions.manageOperations !== undefined ? Boolean(userPermissions.manageOperations) : true);

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

  // Advanced Operations Combined Filters
  const [employees, setEmployees] = useState([]);
  const [associationsList, setAssociationsList] = useState([]);
  const [selectedEmployees, setSelectedEmployees] = useState([]);
  const [selectedDSAs, setSelectedDSAs] = useState([]);
  const [selectedBanks, setSelectedBanks] = useState([]);
  const [selectedAssociations, setSelectedAssociations] = useState([]);
  const [selectedStages, setSelectedStages] = useState([]);

  // Sub-status Popups State
  // 0. Bank Login Modal
  const [loginModalApp, setLoginModalApp] = useState(null);
  const [loginStatusInput, setLoginStatusInput] = useState("PENDING");
  const [loginRemarkInput, setLoginRemarkInput] = useState("");
  const [loginSubmitting, setLoginSubmitting] = useState(false);

  // 0a. PD Status Modal
  const [pdModalApp, setPdModalApp] = useState(null);
  const [pdStatusInput, setPdStatusInput] = useState("PENDING");
  const [pdRemarkInput, setPdRemarkInput] = useState("");
  const [pdSubmitting, setPdSubmitting] = useState(false);

  // 0b. Banker Query Modal
  const [queryModalApp, setQueryModalApp] = useState(null);
  const [queryStatusInput, setQueryStatusInput] = useState("PENDING");
  const [queryRemarkInput, setQueryRemarkInput] = useState("");
  const [querySubmitting, setQuerySubmitting] = useState(false);

  // 1. Legal Modal
  const [legalModalApp, setLegalModalApp] = useState(null);
  const [legalStatusInput, setLegalStatusInput] = useState("INITIATED");
  const [legalRemarkInput, setLegalRemarkInput] = useState("");
  const [legalSubmitting, setLegalSubmitting] = useState(false);

  // 2. Technical Modal
  const [technicalModalApp, setTechnicalModalApp] = useState(null);
  const [technicalStatusInput, setTechnicalStatusInput] = useState("INITIATED");
  const [technicalRemarkInput, setTechnicalRemarkInput] = useState("");
  const [technicalSubmitting, setTechnicalSubmitting] = useState(false);

  // 2b. Bank Sanction Modal
  const [sanctionModalApp, setSanctionModalApp] = useState(null);
  const [sanctionStatusInput, setSanctionStatusInput] = useState("PENDING");
  const [sanctionAmountInput, setSanctionAmountInput] = useState("");
  const [sanctionRemarkInput, setSanctionRemarkInput] = useState("");
  const [sanctionSubmitting, setSanctionSubmitting] = useState(false);

  // 2b. Intermediate Disbursement Stage Modal
  const [disbursementStageModalApp, setDisbursementStageModalApp] = useState(null);
  const [disbursementStageStatusInput, setDisbursementStageStatusInput] = useState("DISBURSED");
  const [disbursementStageAmountInput, setDisbursementStageAmountInput] = useState("");
  const [disbursementStageDateInput, setDisbursementStageDateInput] = useState("");
  const [disbursementStageRemarkInput, setDisbursementStageRemarkInput] = useState("");
  const [disbursementStageSubmitting, setDisbursementStageSubmitting] = useState(false);

  // 3. PDD Modal
  const [pddModalApp, setPddModalApp] = useState(null);
  const [pddStatusInput, setPddStatusInput] = useState("PENDING");
  const [pddRemarkInput, setPddRemarkInput] = useState("");
  const [pddSubmitting, setPddSubmitting] = useState(false);

  // 4. OTC Modal
  const [otcModalApp, setOtcModalApp] = useState(null);
  const [otcStatusInput, setOtcStatusInput] = useState("PENDING");
  const [otcRemarkInput, setOtcRemarkInput] = useState("");
  const [otcSubmitting, setOtcSubmitting] = useState(false);

  // 5. General Stage Modal
  const [stageModalApp, setStageModalApp] = useState(null);
  const [stageTargetInput, setStageTargetInput] = useState("DOCS_PENDING");
  const [stageRemarkInput, setStageRemarkInput] = useState("");
  const [stageSanctionedAmtInput, setStageSanctionedAmtInput] = useState("");
  const [stageSubmitting, setStageSubmitting] = useState(false);

  // 6. History / Timeline Modal
  const [historyModalApp, setHistoryModalApp] = useState(null);
  const [historyTimeline, setHistoryTimeline] = useState([]);
  const [historyLoading, setHistoryLoading] = useState(false);

  // Applications & Pipeline State
  const [applications, setApplications] = useState([]);
  const [appsLoading, setAppsLoading] = useState(true);
  const [appSearch, setAppSearch] = useState("");
  const [debouncedAppSearch, setDebouncedAppSearch] = useState("");
  const [selectedStageFilter, setSelectedStageFilter] = useState("ALL");
  const [activeStageCard, setActiveStageCard] = useState(null);
  const [appCurrentPage, setAppCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(DEFAULT_PAGE_SIZE);
  const [appTotalPages, setAppTotalPages] = useState(1);
  const [appTotalItems, setAppTotalItems] = useState(0);

  // Live KPI Summary Metrics across all filtered applications
  const [opsSummary, setOpsSummary] = useState({
    totalApplications: 0,
    totalAppliedAmount: 0,
    totalSanctionedAmount: 0,
    totalDisbursedAmount: 0,
    disbursedCount: 0,
    sanctionedCount: 0,
    pendingCount: 0,
    rejectedCount: 0,
    stageCounts: {},
  });

  // Calculate the 5 Bank Stage KPI metrics dynamically
  const stageKpiMetrics = useMemo(() => {
    if (opsSummary?.bankStages) {
      return opsSummary.bankStages;
    }
    const metrics = {
      LOGGED_IN: { count: 0, amount: 0 },
      UNDER_PROCESS: { count: 0, amount: 0 },
      QUERY_RAISED: { count: 0, amount: 0 },
      SANCTIONED: { count: 0, amount: 0 },
      STATUS_NOT_SET: { count: 0, amount: 0 },
    };
    (applications || []).forEach((app) => {
      const s = String(app.status || "").toUpperCase();
      const qStatus = String(app.opsQueryStatus || "").toUpperCase();
      const amt = parseFloat(app.sanctionedAmount || 0) || parseFloat(app.appliedAmount || 0);

      if (s === "QUERY" || s === "QUERY_RAISED" || qStatus === "PENDING" || (app.queries && app.queries.some(q => q.status === "OPEN"))) {
        metrics.QUERY_RAISED.count++;
        metrics.QUERY_RAISED.amount += amt;
      } else if (s === "SANCTIONED" || s === "APPROVED") {
        metrics.SANCTIONED.count++;
        metrics.SANCTIONED.amount += (parseFloat(app.sanctionedAmount || 0) || amt);
      } else if (
        s === "PD" || s === "LEGAL" || s === "TECHNICAL" ||
        s.includes("PROCESS") || s.includes("VERIF") || s.includes("REVIEW") || s.includes("UNDERWRITING") ||
        (app.pdStatus && app.pdStatus !== "PENDING" && app.pdStatus !== "NONE") ||
        (app.legalStatus && app.legalStatus !== "PENDING" && app.legalStatus !== "NONE") ||
        (app.technicalStatus && app.technicalStatus !== "PENDING" && app.technicalStatus !== "NONE")
      ) {
        metrics.UNDER_PROCESS.count++;
        metrics.UNDER_PROCESS.amount += amt;
      } else if (s === "LOGGED_IN" || s === "LOGIN" || s === "SUBMITTED_TO_BANK" || (app.loginStatus && app.loginStatus === "COMPLETED")) {
        metrics.LOGGED_IN.count++;
        metrics.LOGGED_IN.amount += amt;
      } else {
        metrics.STATUS_NOT_SET.count++;
        metrics.STATUS_NOT_SET.amount += amt;
      }
    });
    return metrics;
  }, [applications, opsSummary]);

  // Filter applications when an interactive stage KPI card is selected
  const displayedApplications = useMemo(() => {
    if (!activeStageCard) return applications;
    return (applications || []).filter((app) => {
      const s = String(app.status || "").toUpperCase();
      const qStatus = String(app.opsQueryStatus || "").toUpperCase();
      if (activeStageCard === "QUERY_RAISED") {
        return s === "QUERY" || s === "QUERY_RAISED" || qStatus === "PENDING" || (app.queries && app.queries.some(q => q.status === "OPEN"));
      }
      if (activeStageCard === "SANCTIONED") {
        return s === "SANCTIONED" || s === "APPROVED";
      }
      if (activeStageCard === "UNDER_PROCESS") {
        return (
          s === "PD" || s === "LEGAL" || s === "TECHNICAL" ||
          s.includes("PROCESS") || s.includes("VERIF") || s.includes("REVIEW") || s.includes("UNDERWRITING") ||
          (app.pdStatus && app.pdStatus !== "PENDING" && app.pdStatus !== "NONE") ||
          (app.legalStatus && app.legalStatus !== "PENDING" && app.legalStatus !== "NONE") ||
          (app.technicalStatus && app.technicalStatus !== "PENDING" && app.technicalStatus !== "NONE")
        );
      }
      if (activeStageCard === "LOGGED_IN") {
        return s === "LOGGED_IN" || s === "LOGIN" || s === "SUBMITTED_TO_BANK" || (app.loginStatus && app.loginStatus === "COMPLETED");
      }
      if (activeStageCard === "STATUS_NOT_SET") {
        return (
          !s || s === "DOCS_PENDING" || s === "READY_TO_SEND" || s === "NEW" || s === "NOT_SET" ||
          (!["LOGGED_IN", "LOGIN", "SUBMITTED_TO_BANK", "PD", "LEGAL", "TECHNICAL", "QUERY", "QUERY_RAISED", "SANCTIONED", "APPROVED", "DISBURSED"].includes(s) &&
           !qStatus && !app.loginStatus)
        );
      }
      return true;
    });
  }, [applications, activeStageCard]);

  // Full Remark View Modal State
  const [remarkViewModal, setRemarkViewModal] = useState(null); // { title, stage, remark, updatedAt, app }

  // All Process Completed Modal State
  const [allProcessModalApp, setAllProcessModalApp] = useState(null);
  const [allProcessAmountInput, setAllProcessAmountInput] = useState("");
  const [allProcessRemarkInput, setAllProcessRemarkInput] = useState("All processes completed successfully");
  const [allProcessSubmitting, setAllProcessSubmitting] = useState(false);

  const openAllProcessCompletedModal = (app) => {
    setAllProcessModalApp(app);
    const defAmt = app.disbursedAmount || app.sanctionedAmount || app.appliedAmount || "";
    setAllProcessAmountInput(defAmt ? String(defAmt) : "");
    setAllProcessRemarkInput(app.disbursedRemark || "All processes completed successfully");
  };

  // Disbursal Confirmation Modal State
  const [disburseModalApp, setDisburseModalApp] = useState(null);
  const [disburseStatusInput, setDisburseStatusInput] = useState("COMPLETED"); // "COMPLETED" | "PENDING" | "CANCEL"
  const [disburseAmountInput, setDisburseAmountInput] = useState("");
  const [disburseRemarksInput, setDisburseRemarksInput] = useState("");
  const [disburseSubmitting, setDisburseSubmitting] = useState(false);

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
  const [uploadFiles, setUploadFiles] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);
  const [opsDocReqLead, setOpsDocReqLead] = useState(null);

  // 1-Click Lead -> Loan Application Modal
  const [convertLead, setConvertLead] = useState(null);
  const [lenders, setLenders] = useState([]);
  const [bankers, setBankers] = useState([]);
  const [loanProducts, setLoanProducts] = useState([]);
  const [convertForm, setConvertForm] = useState({
    loanProduct: "Personal Loan",
    appliedAmount: "",
    lenderId: "",
    assignedBankerId: "",
  });
  const [convertSubmitting, setConvertSubmitting] = useState(false);

  // Scroll preservation refs
  const pipelineTableContainerRef = useRef(null);
  const leadsTableContainerRef = useRef(null);

  // Edit Loan Amount Modal State
  const [editAmountModalApp, setEditAmountModalApp] = useState(null);
  const [editAmountForm, setEditAmountForm] = useState({
    appliedAmount: "",
    sanctionedAmount: "",
    loanProduct: "",
  });
  const [editAmountSubmitting, setEditAmountSubmitting] = useState(false);

  // Edit Bank / Lender Modal State
  const [editBankModalApp, setEditBankModalApp] = useState(null);
  const [editBankForm, setEditBankForm] = useState({
    lenderId: "",
    assignedBankerId: "",
    loanProduct: "",
  });
  const [editBankSubmitting, setEditBankSubmitting] = useState(false);

  // Reassign Lead / Case Ownership Modal State
  const [reassignModalData, setReassignModalData] = useState(null);
  const [reassignTargetUserId, setReassignTargetUserId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [reassignSubmitting, setReassignSubmitting] = useState(false);

  // Bank Email Dispatch Modal State
  const [bankMailModalApp, setBankMailModalApp] = useState(null);
  const [emailTemplates, setEmailTemplates] = useState([]);
  const [mailSmtpConfig, setMailSmtpConfig] = useState(null);
  const [bankMailLoading, setBankMailLoading] = useState(false);
  const [bankMailSubmitting, setBankMailSubmitting] = useState(false);
  const [mailActiveTab, setMailActiveTab] = useState("compose"); // "compose" | "preview"
  const [quickSmtpOpen, setQuickSmtpOpen] = useState(false);
  const [quickSmtpUser, setQuickSmtpUser] = useState("");
  const [quickSmtpPass, setQuickSmtpPass] = useState("");
  const [quickSmtpSenderName, setQuickSmtpSenderName] = useState("");
  const [quickSmtpLoading, setQuickSmtpLoading] = useState(false);
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

  const refreshSmtpStatus = async () => {
    try {
      const res = await axios.get(`${API_URL}/email-templates/smtp/config`);
      if (res.data?.data && res.data.data.user && (res.data.data.hasPassword || res.data.data.isConfigured)) {
        setMailSmtpConfig(res.data.data);
        toast.success(`SMTP verified! Sending from ${res.data.data.user}`);
      } else {
        setMailSmtpConfig(null);
        toast.info("SMTP outgoing email is not configured yet.");
      }
    } catch {
      toast.error("Could not check SMTP status");
    }
  };

  const handleQuickSmtpSave = async (e) => {
    e?.preventDefault();
    if (!quickSmtpUser.trim()) {
      toast.warning("Please enter your Gmail address");
      return;
    }
    if (!quickSmtpPass.trim()) {
      toast.warning("Please enter your 16-character Google App Password");
      return;
    }
    setQuickSmtpLoading(true);
    try {
      const isGmail = quickSmtpUser.toLowerCase().endsWith("@gmail.com");
      const cleanPass = isGmail ? quickSmtpPass.replace(/\s+/g, "") : quickSmtpPass.trim();
      const res = await axios.post(`${API_URL}/email-templates/smtp/test`, {
        service: "gmail",
        user: quickSmtpUser.trim(),
        pass: cleanPass,
        senderName: quickSmtpSenderName.trim() || undefined,
        testToEmail: quickSmtpUser.trim(),
      });
      if (res.data?.success) {
        toast.success("✅ Gmail & App Password verified and saved successfully!");
        setMailSmtpConfig(res.data.data || {
          user: quickSmtpUser.trim(),
          senderName: quickSmtpSenderName.trim() || "Operations Desk",
          isConfigured: true,
          hasPassword: true,
        });
        setQuickSmtpOpen(false);
      }
    } catch (err) {
      toast.error(err.response?.data?.message || err.message || "Failed to verify Gmail App Password");
    } finally {
      setQuickSmtpLoading(false);
    }
  };

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
      const [lenderRes, bankerRes, docTypeRes, usersRes, leadSrcRes, loanProdRes] = await Promise.all([
        axios.get(`${API_URL}/lenders`, { params: { includeInactive: false } }),
        axios.get(`${API_URL}/users`, { params: { role: "BANKER", limit: 100 } }),
        axios.get(`${API_URL}/master-configs/DOC_TYPE`, { params: { includeInactive: false } }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_URL}/users`, { params: { limit: 200 } }).catch(() => ({ data: { users: [] } })),
        axios.get(`${API_URL}/master-configs/LEAD_SOURCE`, { params: { includeInactive: false } }).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_URL}/master-configs/LOAN_PRODUCT`, { params: { includeInactive: false } }).catch(() => ({ data: { data: [] } })),
      ]);
      const lenderList = lenderRes.data?.lenders || lenderRes.data?.data || [];
      setLenders(lenderList);
      setBankers(bankerRes.data?.data || bankerRes.data?.users || []);
      const docTypesList = docTypeRes.data?.data || [];
      setMasterDocTypes(docTypesList);
      if (docTypesList.length > 0) {
        setUploadDocType(docTypesList[0].label || docTypesList[0].value);
      }
      const userList = usersRes.data?.users || usersRes.data?.data || [];
      setEmployees(userList);
      const leadSources = leadSrcRes.data?.data || [];
      setAssociationsList(leadSources);
      const loanProdList = loanProdRes.data?.data || [];
      setLoanProducts(loanProdList);
    } catch (error) {
      console.error("Error fetching aux data:", error);
    }
  };

  // Bank / NBFC Options (Banks and NBFC partners)
  const bankOptions = useMemo(() => {
    return lenders
      .filter((l) => l.lenderType !== "DSA")
      .map((l) => ({
        value: String(l.id || l.lender_id),
        label: l.name,
        subtitle: l.shortCode || l.lenderType || "Bank Partner",
      }));
  }, [lenders]);

  // DSA Options (Lenders of type DSA + LEAD_SOURCE entries mentioning DSA/Partner/Finance)
  const dsaOptions = useMemo(() => {
    const list = new Map();
    lenders.forEach((l) => {
      if (l.lenderType === "DSA" || (l.name || "").toLowerCase().includes("dsa")) {
        list.set(l.name, { value: l.name, label: l.name, subtitle: "DSA Partner" });
      }
    });
    associationsList.forEach((a) => {
      const val = a.value || a.label;
      const lbl = a.label || a.value;
      if (
        (lbl || "").toLowerCase().includes("dsa") ||
        (lbl || "").toLowerCase().includes("finance") ||
        (lbl || "").toLowerCase().includes("consultan") ||
        (lbl || "").toLowerCase().includes("partner")
      ) {
        if (!list.has(val)) {
          list.set(val, { value: val, label: lbl, subtitle: "Sourcing Channel" });
        }
      }
    });
    if (list.size === 0) {
      ["DSA Partner", "Sharma & Associates (DSA)", "Pooja Finance", "ABC Finance"].forEach((d) => {
        list.set(d, { value: d, label: d, subtitle: "Channel Partner" });
      });
    }
    return Array.from(list.values());
  }, [lenders, associationsList]);

  // Association Options
  const associationOptions = useMemo(() => {
    if (associationsList.length > 0) {
      return associationsList.map((a) => ({
        value: a.value || a.label,
        label: a.label || a.value,
        subtitle: a.code || undefined,
      }));
    }
    return [
      { value: "Direct Walkin", label: "Self / Direct Walkin" },
      { value: "DSA Partner", label: "DSA Direct Partner" },
      { value: "Sharma DSA", label: "Sharma & Associates (DSA)" },
      { value: "Pooja Finance", label: "Pooja Financial Consultancy" },
      { value: "FinTech Connect", label: "FinTech Connectors Network" },
      { value: "Bank Referral", label: "Bank Referral Channel" },
      { value: "Online", label: "Website / Online Ads" },
    ];
  }, [associationsList]);

  // Employee Options
  const employeeOptions = useMemo(() => {
    return employees.map((u) => ({
      value: String(u.id),
      label: u.name,
      subtitle: u.role || (u.branch?.name ? `Branch: ${u.branch.name}` : undefined),
    }));
  }, [employees]);

  // Status / Workflow Stage Options
  const stageOptions = useMemo(() => [
    { value: "DOCS_PENDING", label: "1. Documents Pending" },
    { value: "READY_TO_SEND", label: "2. Ready to Send" },
    { value: "SUBMITTED_TO_BANK", label: "3. Submitted to Bank" },
    { value: "LOGIN_PENDING", label: "4. Bank Login - Pending" },
    { value: "LOGIN_COMPLETED", label: "4. Bank Login - Completed" },
    { value: "PD_PENDING", label: "5. PD - Pending" },
    { value: "PD_COMPLETED", label: "5. PD - Completed" },
    { value: "QUERY_PENDING", label: "6. Query - Pending" },
    { value: "QUERY_COMPLETED", label: "6. Query - Completed" },
    { value: "LEGAL_INITIATED", label: "7. Legal - Initiated" },
    { value: "LEGAL_RESOLVED", label: "7. Legal - Resolved" },
    { value: "TECHNICAL_INITIATED", label: "8. Technical - Initiated" },
    { value: "TECHNICAL_RESOLVED", label: "8. Technical - Resolved" },
    { value: "SANCTIONED", label: "9. Sanctioned" },
    { value: "DISBURSEMENT", label: "10. Disbursement" },
    { value: "PDD_PENDING", label: "11. PDD - Pending" },
    { value: "PDD_RESOLVED", label: "11. PDD - Resolved" },
    { value: "OTC_PENDING", label: "12. OTC - Pending" },
    { value: "OTC_RESOLVED", label: "12. OTC - Resolved" },
    { value: "PENDING_DISBURSEMENT", label: "⏳ Pending for Final Disbursement" },
    { value: "DISBURSED", label: "13. Final Disbursed" },
    { value: "CANCELLED", label: "❌ Cancelled" },
    { value: "REJECTED", label: "🚫 Rejected" },
  ], []);

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

  // Fetch Applications with all combined filters
  const fetchApplications = useCallback(async (page = 1, isSilent = false) => {
    const scrollEl = pipelineTableContainerRef.current;
    const prevScrollTop = scrollEl ? scrollEl.scrollTop : 0;
    const prevScrollLeft = scrollEl ? scrollEl.scrollLeft : 0;
    const prevWindowY = typeof window !== "undefined" ? window.scrollY : 0;

    if (!isSilent) {
      setAppsLoading(true);
    }
    try {
      const params = {
        page,
        limit: displayType === "kanban" ? 150 : pageSize,
        search: debouncedAppSearch || undefined,
        status: selectedStages.length > 0 ? selectedStages.join(",") : (selectedStageFilter !== "ALL" ? selectedStageFilter : undefined),
        employeeIds: selectedEmployees.length > 0 ? selectedEmployees.join(",") : undefined,
        dsaNames: selectedDSAs.length > 0 ? selectedDSAs.join(",") : undefined,
        bankIds: selectedBanks.length > 0 ? selectedBanks.join(",") : undefined,
        associations: selectedAssociations.length > 0 ? selectedAssociations.join(",") : undefined,
        lenderId: selectedLenderFilter !== "ALL" ? selectedLenderFilter : undefined,
        fromDate: filterPeriodType === "custom" && customFromDate ? customFromDate : undefined,
        toDate: filterPeriodType === "custom" && customToDate ? customToDate : undefined,
        month: filterPeriodType === "month" && selectedMonth ? selectedMonth : undefined,
        financialYear: filterPeriodType === "fy" && selectedFY ? selectedFY : undefined,
      };
      const res = await axios.get(`${API_URL}/applications`, { params });
      const fetchedApps = res.data?.applications || res.data?.data || [];
      setApplications(fetchedApps);
      if (res.data?.summary) {
        setOpsSummary(res.data.summary);
      }
      const pagination = res.data?.pagination || {};
      setAppTotalPages(pagination.totalPages || 1);
      setAppTotalItems(pagination.totalItems || 0);

      // Keep verification drawer synced if open
      setVerificationApp((curr) => {
        if (!curr) return null;
        const matching = fetchedApps.find((a) => a.id === curr.id);
        return matching ? { ...curr, ...matching } : curr;
      });

      // Restore scroll position
      if (prevScrollTop > 0 || prevScrollLeft > 0 || prevWindowY > 0) {
        requestAnimationFrame(() => {
          if (pipelineTableContainerRef.current) {
            pipelineTableContainerRef.current.scrollTop = prevScrollTop;
            pipelineTableContainerRef.current.scrollLeft = prevScrollLeft;
          }
          if (prevWindowY > 0 && typeof window !== "undefined") {
            window.scrollTo({ top: prevWindowY, behavior: "instant" });
          }
        });
      }
    } catch (error) {
      console.error("Error fetching applications:", error);
      toast.error("Could not load loan applications");
      setApplications([]);
    } finally {
      if (!isSilent) {
        setAppsLoading(false);
      }
    }
  }, [
    debouncedAppSearch,
    selectedStageFilter,
    selectedStages,
    selectedEmployees,
    selectedDSAs,
    selectedBanks,
    selectedAssociations,
    selectedLenderFilter,
    displayType,
    pageSize,
    filterPeriodType,
    customFromDate,
    customToDate,
    selectedMonth,
    selectedFY,
  ]);

  // Fetch Leads Passed to Ops with Date, Month, and FY filters
  const fetchLeads = useCallback(async (page = 1, isSilent = false) => {
    const scrollEl = leadsTableContainerRef.current;
    const prevScrollTop = scrollEl ? scrollEl.scrollTop : 0;
    const prevScrollLeft = scrollEl ? scrollEl.scrollLeft : 0;
    const prevWindowY = typeof window !== "undefined" ? window.scrollY : 0;

    if (!isSilent) {
      setLeadsLoading(true);
    }
    try {
      const endpoint = `${API_URL}/leads`;
      const params = {
        limit: pageSize,
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

      // Restore scroll position
      if (prevScrollTop > 0 || prevScrollLeft > 0 || prevWindowY > 0) {
        requestAnimationFrame(() => {
          if (leadsTableContainerRef.current) {
            leadsTableContainerRef.current.scrollTop = prevScrollTop;
            leadsTableContainerRef.current.scrollLeft = prevScrollLeft;
          }
          if (prevWindowY > 0 && typeof window !== "undefined") {
            window.scrollTo({ top: prevWindowY, behavior: "instant" });
          }
        });
      }
    } catch (error) {
      console.error("Error fetching leads:", error);
      toast.error("Could not load operations leads");
      setLeads([]);
    } finally {
      if (!isSilent) {
        setLeadsLoading(false);
      }
    }
  }, [
    debouncedLeadSearch,
    pageSize,
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
    selectedEmployees,
    selectedDSAs,
    selectedBanks,
    selectedAssociations,
    selectedStages,
  ]);

  const hasActiveFilters = useMemo(() => {
    return (
      filterPeriodType !== "all" ||
      selectedLenderFilter !== "ALL" ||
      selectedEmployees.length > 0 ||
      selectedDSAs.length > 0 ||
      selectedBanks.length > 0 ||
      selectedAssociations.length > 0 ||
      selectedStages.length > 0 ||
      (viewMode === "pipeline"
        ? selectedStageFilter !== "ALL" || Boolean(appSearch)
        : leadStatusCategory !== "ALL" || Boolean(leadSearch))
    );
  }, [
    filterPeriodType,
    selectedLenderFilter,
    selectedEmployees,
    selectedDSAs,
    selectedBanks,
    selectedAssociations,
    selectedStages,
    viewMode,
    selectedStageFilter,
    appSearch,
    leadStatusCategory,
    leadSearch,
  ]);

  const resetAllFilters = () => {
    setFilterPeriodType("all");
    setCustomFromDate("");
    setCustomToDate("");
    setSelectedMonth("");
    setSelectedFY("");
    setSelectedLenderFilter("ALL");
    setSelectedEmployees([]);
    setSelectedDSAs([]);
    setSelectedBanks([]);
    setSelectedAssociations([]);
    setSelectedStages([]);
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

        {/* Combined Multi-Select Filters (Pipeline view) */}
        {isPipeline && (
          <>
            {/* 1. Employee Filter */}
            <MultiSelectDropdown
              label="Employee"
              icon={User}
              options={employeeOptions}
              selectedValues={selectedEmployees}
              onChange={(vals) => {
                setSelectedEmployees(vals);
                setAppCurrentPage(1);
              }}
              searchPlaceholder="Search employees..."
            />

            {/* 2. DSA Filter */}
            <MultiSelectDropdown
              label="DSA"
              icon={Users}
              options={dsaOptions}
              selectedValues={selectedDSAs}
              onChange={(vals) => {
                setSelectedDSAs(vals);
                setAppCurrentPage(1);
              }}
              searchPlaceholder="Search DSA partners..."
            />

            {/* 3. Bank / NBFC Filter */}
            <MultiSelectDropdown
              label="Bank / NBFC"
              icon={Building2}
              options={bankOptions}
              selectedValues={selectedBanks}
              onChange={(vals) => {
                setSelectedBanks(vals);
                setAppCurrentPage(1);
              }}
              searchPlaceholder="Search Bank or NBFC..."
            />

            {/* 4. Association Filter */}
            <MultiSelectDropdown
              label="Association"
              icon={Layers}
              options={associationOptions}
              selectedValues={selectedAssociations}
              onChange={(vals) => {
                setSelectedAssociations(vals);
                setAppCurrentPage(1);
              }}
              searchPlaceholder="Search associations..."
            />

            {/* 5. Stage Filter */}
            <MultiSelectDropdown
              label="Stage"
              icon={Kanban}
              options={stageOptions}
              selectedValues={selectedStages}
              onChange={(vals) => {
                setSelectedStages(vals);
                setAppCurrentPage(1);
              }}
              searchPlaceholder="Search workflow stages..."
            />
          </>
        )}

        {/* Assigned Bank Filter for Leads Queue */}
        {!isPipeline && (
          <div className="cc-ops-filter-control">
            <Building2 size={14} className="cc-filter-icon" />
            <select
              value={selectedLenderFilter}
              onChange={(e) => {
                setSelectedLenderFilter(e.target.value);
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
        )}

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

        {(!isPipeline || displayType === "table") && (
          <div className="cc-ops-filter-control cc-ops-page-size-control">
            <label htmlFor="cc-ops-page-size">Show rows</label>
            <select
              id="cc-ops-page-size"
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setAppCurrentPage(1);
                setLeadCurrentPage(1);
              }}
              className="cc-ops-select"
              title="Leads or applications per page"
            >
              {[10, 20, 50, 100].map((size) => (
                <option key={size} value={size}>{size} / page</option>
              ))}
            </select>
          </div>
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
              All Files ({opsSummary?.totalApplications ?? appTotalItems})
            </button>
            <button
              type="button"
              className={`pending-tab ${selectedStageFilter === "PENDING_STAGES" ? "active" : ""}`}
              onClick={() => {
                setSelectedStageFilter("PENDING_STAGES");
                setAppCurrentPage(1);
              }}
            >
              ⏳ Pending Files ({opsSummary?.pendingCount ?? 0})
            </button>
            <button
              type="button"
              className={`completed-tab ${selectedStageFilter === "COMPLETED_STAGES" ? "active" : ""}`}
              onClick={() => {
                setSelectedStageFilter("COMPLETED_STAGES");
                setAppCurrentPage(1);
              }}
            >
              ✅ Completed Files ({(opsSummary?.disbursedCount || 0) + (opsSummary?.sanctionedCount || 0)})
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
                {s.label} ({opsSummary?.stageCounts?.[s.key] ?? 0})
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
      fetchApplications(appCurrentPage, true);
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
    const filesToUpload = uploadFiles && uploadFiles.length > 0 ? uploadFiles : (uploadFile ? [uploadFile] : []);
    if (filesToUpload.length === 0) {
      toast.warning("Please choose at least one file to upload");
      return;
    }
    const MAX_SIZE = 25 * 1024 * 1024;
    for (const f of filesToUpload) {
      if (f.size > MAX_SIZE) {
        toast.error(`File "${f.name}" exceeds the 25MB maximum limit.`);
        return;
      }
    }
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      filesToUpload.forEach((f) => formData.append("files", f));
      formData.append("docType", uploadDocType);
      if (verificationApp.customerId) formData.append("customerId", verificationApp.customerId);
      if (verificationApp.leadId) formData.append("leadId", verificationApp.leadId);
      if (verificationApp.id) formData.append("applicationId", verificationApp.id);

      await axios.post(`${API_URL}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      toast.success(`${filesToUpload.length} document(s) uploaded successfully!`);
      setUploadFile(null);
      setUploadFiles([]);

      // Refresh
      const res = await axios.get(`${API_URL}/applications/${verificationApp.id}`);
      setVerificationApp(res.data?.application);
      fetchApplications(appCurrentPage, true);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  // Disburse Loan Modal Handlers
  const initiateDisburseModal = (app) => {
    setDisburseModalApp(app);
    setDisburseStatusInput(
      app.status === "CANCELLED" || app.disbursementStatus === "CANCELLED"
        ? "CANCEL"
        : app.status === "DISBURSED"
        ? "COMPLETED"
        : "COMPLETED"
    );
    const defaultAmt = app.disbursedAmount || app.sanctionedAmount || app.appliedAmount || "";
    setDisburseAmountInput(defaultAmt ? String(defaultAmt) : "");
    setDisburseRemarksInput(app.disbursedRemark || "");
  };

  const handleConfirmDisburse = async (e) => {
    if (e) e.preventDefault();
    if (!disburseModalApp) return;

    if (disburseStatusInput === "CANCEL") {
      if (!disburseRemarksInput.trim()) {
        toast.error("Please enter a remark / cancellation reason for cancelling the disbursement");
        return;
      }
      setDisburseSubmitting(true);
      try {
        const res = await axios.put(`${API_URL}/applications/${disburseModalApp.id}/stage-status`, {
          stageType: "DISBURSED",
          status: "CANCELLED",
          remark: disburseRemarksInput.trim(),
        });
        toast.success(`Disbursement CANCELLED for Application #${disburseModalApp.applicationNumber}`);
        const updated = res.data?.application;
        if (updated) {
          setApplications((prev) =>
            prev.map((a) =>
              a.id === updated.id
                ? {
                    ...a,
                    ...updated,
                    status: "CANCELLED",
                    disbursementStatus: "CANCELLED",
                    disbursedRemark: disburseRemarksInput.trim(),
                  }
                : a
            )
          );
        }
        if (verificationApp && verificationApp.id === disburseModalApp.id) {
          setVerificationApp((prev) => ({
            ...prev,
            status: "CANCELLED",
            disbursementStatus: "CANCELLED",
            disbursedRemark: disburseRemarksInput.trim(),
          }));
        }
        setDisburseModalApp(null);
        fetchApplications(appCurrentPage, true);
      } catch (error) {
        console.error("Cancel disburse error:", error);
        toast.error(error.response?.data?.message || "Failed to cancel disbursement");
      } finally {
        setDisburseSubmitting(false);
      }
      return;
    }

    if (disburseStatusInput === "PENDING") {
      setDisburseSubmitting(true);
      try {
        const res = await axios.put(`${API_URL}/applications/${disburseModalApp.id}/stage-status`, {
          stageType: "DISBURSED",
          status: "PENDING",
          remark: disburseRemarksInput.trim() || undefined,
        });
        toast.success(`Application #${disburseModalApp.applicationNumber} disbursement marked as PENDING.`);
        const updated = res.data?.application;
        if (updated) {
          setApplications((prev) =>
            prev.map((a) =>
              a.id === updated.id
                ? { ...a, ...updated, disbursementStatus: "PENDING", disbursedRemark: disburseRemarksInput.trim() }
                : a
            )
          );
        }
        if (verificationApp && verificationApp.id === disburseModalApp.id) {
          setVerificationApp((prev) => ({
            ...prev,
            disbursementStatus: "PENDING",
            disbursedRemark: disburseRemarksInput.trim(),
          }));
        }
        setDisburseModalApp(null);
        fetchApplications(appCurrentPage, true);
      } catch (error) {
        console.error("Disburse pending error:", error);
        toast.error(error.response?.data?.message || "Failed to update disbursement status");
      } finally {
        setDisburseSubmitting(false);
      }
      return;
    }

    // Default: COMPLETED / DISBURSED
    // BUSINESS RULE: PDD is Post-Disbursement and does NOT block Final Disbursement.
    const isOtcResolved = (disburseModalApp.otcStatus || "").toUpperCase() === "RESOLVED";
    if (!isOtcResolved) {
      // Optional notification / non-blocking warning if needed, but allow disburse
      console.log("Notice: Final disbursement proceeding while OTC is pending clearance.");
    }

    const amt = parseFloat(disburseAmountInput);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid disbursed amount");
      return;
    }
    const finalRemark = disburseRemarksInput.trim() || `Loan Disbursed - Amount ${currencyFormatter.format(amt)}`;

    setDisburseSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${disburseModalApp.id}/stage-status`, {
        stageType: "DISBURSED",
        status: "DISBURSED",
        disbursedAmount: amt,
        remark: finalRemark,
      });

      toast.success(`Application #${disburseModalApp.applicationNumber} marked as DISBURSED! Payout & Lead synced.`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated, status: "DISBURSED", disbursementStatus: "COMPLETED" } : a)));
      }
      setDisburseModalApp(null);
      fetchApplications(appCurrentPage, true);

      if (verificationApp && verificationApp.id === disburseModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          status: "DISBURSED",
          disbursementStatus: "COMPLETED",
          disbursedAmount: amt,
        }));
      }
    } catch (error) {
      console.error("Disburse error:", error);
      toast.error(error.response?.data?.message || "Failed to disburse loan application");
    } finally {
      setDisburseSubmitting(false);
    }
  };

  // Handler for "All Process Completed"
  const handleAllProcessCompletedSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!allProcessModalApp) return;

    const amt = parseFloat(allProcessAmountInput);
    if (isNaN(amt) || amt <= 0) {
      toast.error("Please enter a valid completion / disbursed amount");
      return;
    }

    setAllProcessSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${allProcessModalApp.id}/stage-status`, {
        stageType: "ALL_PROCESS_COMPLETED",
        status: "ALL_PROCESS_COMPLETED",
        disbursedAmount: amt,
        remark: allProcessRemarkInput.trim() || "All processes completed successfully",
      });

      toast.success(`Application #${allProcessModalApp.applicationNumber} & Lead marked ALL PROCESS COMPLETED! Payout generated.`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === updated.id
              ? {
                  ...a,
                  ...updated,
                  status: "DISBURSED",
                  disbursementStatus: "COMPLETED",
                  pddStatus: "RESOLVED",
                  otcStatus: "RESOLVED",
                  disbursedAmount: amt,
                  disbursedRemark: allProcessRemarkInput.trim() || "All processes completed successfully",
                }
              : a
          )
        );
      }
      if (verificationApp && verificationApp.id === allProcessModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          status: "DISBURSED",
          disbursementStatus: "COMPLETED",
          pddStatus: "RESOLVED",
          otcStatus: "RESOLVED",
          disbursedAmount: amt,
          disbursedRemark: allProcessRemarkInput.trim() || "All processes completed successfully",
        }));
      }
      setAllProcessModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (error) {
      console.error("All Process Completed error:", error);
      toast.error(error.response?.data?.message || "Failed to mark all process completed");
    } finally {
      setAllProcessSubmitting(false);
    }
  };

  // Sub-status Popups Handlers
  // 0a. PD Status Modal
  const openPdModal = (app) => {
    setPdModalApp(app);
    setPdStatusInput(app.pdStatus || "PENDING");
    setPdRemarkInput(app.pdRemark || "");
  };

  const handlePdSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pdModalApp) return;
    setPdSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${pdModalApp.id}/stage-status`, {
        stageType: "PD",
        status: pdStatusInput,
        remark: pdRemarkInput.trim() || undefined,
      });
      toast.success(`PD status updated to ${pdStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated, pdStatus: pdStatusInput, pdRemark: pdRemarkInput.trim(), pdUpdatedAt: new Date() } : a)));
      }
      if (verificationApp && verificationApp.id === pdModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          pdStatus: pdStatusInput,
          pdRemark: pdRemarkInput.trim(),
          pdUpdatedAt: new Date(),
        }));
      }
      setPdModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update PD status");
    } finally {
      setPdSubmitting(false);
    }
  };

  // 0b. Banker Query Modal
  const openQueryModal = (app) => {
    setQueryModalApp(app);
    setQueryStatusInput(app.opsQueryStatus === "COMPLETED" ? "COMPLETED" : "PENDING");
    setQueryRemarkInput(app.opsQueryRemark || "");
  };

  const handleQuerySubmit = async (e) => {
    if (e) e.preventDefault();
    if (!queryModalApp) return;
    setQuerySubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${queryModalApp.id}/stage-status`, {
        stageType: "QUERY",
        status: queryStatusInput,
        remark: queryRemarkInput.trim() || undefined,
      });
      toast.success(`Banker Query status updated to ${queryStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated, opsQueryStatus: queryStatusInput, opsQueryRemark: queryRemarkInput.trim(), opsQueryUpdatedAt: new Date() } : a)));
      }
      if (verificationApp && verificationApp.id === queryModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          opsQueryStatus: queryStatusInput,
          opsQueryRemark: queryRemarkInput.trim(),
          opsQueryUpdatedAt: new Date(),
        }));
      }
      setQueryModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update Query status");
    } finally {
      setQuerySubmitting(false);
    }
  };

  // 1. Legal Status Modal
  const openLegalModal = (app) => {
    setLegalModalApp(app);
    setLegalStatusInput(app.legalStatus || "INITIATED");
    setLegalRemarkInput(app.legalRemark || "");
  };

  const handleLegalSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!legalModalApp) return;
    setLegalSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${legalModalApp.id}/stage-status`, {
        stageType: "LEGAL",
        status: legalStatusInput,
        remark: legalRemarkInput.trim() || undefined,
      });
      toast.success(`Legal status updated to ${legalStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated, legalStatus: legalStatusInput, legalRemark: legalRemarkInput.trim(), legalUpdatedAt: new Date() } : a)));
      }
      if (verificationApp && verificationApp.id === legalModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          legalStatus: legalStatusInput,
          legalRemark: legalRemarkInput.trim(),
          legalUpdatedAt: new Date(),
        }));
      }
      setLegalModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update Legal status");
    } finally {
      setLegalSubmitting(false);
    }
  };

  // 2. Technical Status Modal
  const openTechnicalModal = (app) => {
    setTechnicalModalApp(app);
    setTechnicalStatusInput(app.technicalStatus || "INITIATED");
    setTechnicalRemarkInput(app.technicalRemark || "");
  };

  const handleTechnicalSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!technicalModalApp) return;
    setTechnicalSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${technicalModalApp.id}/stage-status`, {
        stageType: "TECHNICAL",
        status: technicalStatusInput,
        remark: technicalRemarkInput.trim() || undefined,
      });
      toast.success(`Technical status updated to ${technicalStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated, technicalStatus: technicalStatusInput, technicalRemark: technicalRemarkInput.trim(), technicalUpdatedAt: new Date() } : a)));
      }
      if (verificationApp && verificationApp.id === technicalModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          technicalStatus: technicalStatusInput,
          technicalRemark: technicalRemarkInput.trim(),
          technicalUpdatedAt: new Date(),
        }));
      }
      setTechnicalModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update Technical status");
    } finally {
      setTechnicalSubmitting(false);
    }
  };

  // 3. PDD Status Modal
  const openPddModal = (app) => {
    setPddModalApp(app);
    setPddStatusInput(app.pddStatus || "PENDING");
    setPddRemarkInput(app.pddRemark || "");
  };

  const handlePddSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!pddModalApp) return;
    setPddSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${pddModalApp.id}/stage-status`, {
        stageType: "PDD",
        status: pddStatusInput,
        remark: pddRemarkInput.trim() || undefined,
      });
      toast.success(`PDD status updated to ${pddStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated, pddStatus: pddStatusInput, pddRemark: pddRemarkInput.trim(), pddUpdatedAt: new Date() } : a)));
      }
      if (verificationApp && verificationApp.id === pddModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          pddStatus: pddStatusInput,
          pddRemark: pddRemarkInput.trim(),
          pddUpdatedAt: new Date(),
          isPddResolved: pddStatusInput === "RESOLVED",
        }));
      }
      setPddModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update PDD status");
    } finally {
      setPddSubmitting(false);
    }
  };

  // 4. OTC Status Modal
  const openOtcModal = (app) => {
    setOtcModalApp(app);
    setOtcStatusInput(app.otcStatus || "PENDING");
    setOtcRemarkInput(app.otcRemark || "");
  };

  const handleOtcSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!otcModalApp) return;
    setOtcSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${otcModalApp.id}/stage-status`, {
        stageType: "OTC",
        status: otcStatusInput,
        remark: otcRemarkInput.trim() || undefined,
      });
      toast.success(`OTC status updated to ${otcStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated, otcStatus: otcStatusInput, otcRemark: otcRemarkInput.trim(), otcUpdatedAt: new Date() } : a)));
      }
      if (verificationApp && verificationApp.id === otcModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          otcStatus: otcStatusInput,
          otcRemark: otcRemarkInput.trim(),
          otcUpdatedAt: new Date(),
          isOtcResolved: otcStatusInput === "RESOLVED",
        }));
      }
      setOtcModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update OTC status");
    } finally {
      setOtcSubmitting(false);
    }
  };

  // 4b. Bank Login Modal Handlers
  const openLoginModal = (app) => {
    setLoginModalApp(app);
    setLoginStatusInput(
      (app.loginStatus || "").toUpperCase() === "COMPLETED" || app.status === "LOGGED_IN"
        ? "COMPLETED"
        : "PENDING"
    );
    setLoginRemarkInput(app.loginRemark || "");
  };

  const handleLoginSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!loginModalApp) return;
    setLoginSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${loginModalApp.id}/stage-status`, {
        stageType: "LOGIN",
        status: loginStatusInput,
        remark: loginRemarkInput.trim() || undefined,
      });
      toast.success(`Bank Login status updated to ${loginStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === updated.id
              ? {
                  ...a,
                  ...updated,
                  loginStatus: loginStatusInput,
                  loginRemark: loginRemarkInput.trim(),
                  loginUpdatedAt: new Date(),
                  status: loginStatusInput === "COMPLETED" && (a.status === "SUBMITTED_TO_BANK" || a.status === "DOCS_PENDING" || a.status === "READY_TO_SEND") ? "LOGGED_IN" : a.status,
                }
              : a
          )
        );
      }
      if (verificationApp && verificationApp.id === loginModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          loginStatus: loginStatusInput,
          loginRemark: loginRemarkInput.trim(),
          loginUpdatedAt: new Date(),
          status: loginStatusInput === "COMPLETED" && (prev.status === "SUBMITTED_TO_BANK" || prev.status === "DOCS_PENDING" || prev.status === "READY_TO_SEND") ? "LOGGED_IN" : prev.status,
        }));
      }
      setLoginModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update Login status");
    } finally {
      setLoginSubmitting(false);
    }
  };

  // 4c. Bank Sanction Modal Handlers
  const openSanctionModal = (app) => {
    setSanctionModalApp(app);
    setSanctionStatusInput(
      (app.sanctionStatus || "").toUpperCase() === "SANCTIONED" || app.status === "SANCTIONED"
        ? "SANCTIONED"
        : (app.sanctionStatus || "").toUpperCase() === "REJECTED"
        ? "REJECTED"
        : "PENDING"
    );
    setSanctionAmountInput(
      app.sanctionedAmount ? String(app.sanctionedAmount) : app.appliedAmount ? String(app.appliedAmount) : ""
    );
    setSanctionRemarkInput(app.sanctionRemark || "");
  };

  const handleSanctionSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!sanctionModalApp) return;
    setSanctionSubmitting(true);
    try {
      const amt = sanctionAmountInput ? parseFloat(sanctionAmountInput) : undefined;
      const res = await axios.put(`${API_URL}/applications/${sanctionModalApp.id}/stage-status`, {
        stageType: "SANCTION",
        status: sanctionStatusInput,
        sanctionedAmount: amt,
        remark: sanctionRemarkInput.trim() || undefined,
      });
      toast.success(`Sanction status updated to ${sanctionStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === updated.id
              ? {
                  ...a,
                  ...updated,
                  sanctionStatus: sanctionStatusInput,
                  sanctionedAmount: amt !== undefined ? amt : a.sanctionedAmount,
                  sanctionRemark: sanctionRemarkInput.trim(),
                  sanctionUpdatedAt: new Date(),
                  status: sanctionStatusInput === "SANCTIONED" ? "SANCTIONED" : sanctionStatusInput === "REJECTED" ? "REJECTED" : a.status,
                }
              : a
          )
        );
      }
      if (verificationApp && verificationApp.id === sanctionModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          sanctionStatus: sanctionStatusInput,
          sanctionedAmount: amt !== undefined ? amt : prev.sanctionedAmount,
          sanctionRemark: sanctionRemarkInput.trim(),
          sanctionUpdatedAt: new Date(),
          status: sanctionStatusInput === "SANCTIONED" ? "SANCTIONED" : sanctionStatusInput === "REJECTED" ? "REJECTED" : prev.status,
        }));
      }
      setSanctionModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update Sanction status");
    } finally {
      setSanctionSubmitting(false);
    }
  };

  // 4d. Intermediate Disbursement Stage Modal Handlers
  const openDisbursementStageModal = (app) => {
    setDisbursementStageModalApp(app);
    setDisbursementStageStatusInput(
      (app.disbursementStatus || "").toUpperCase() === "DISBURSED" || (app.disbursementStatus || "").toUpperCase() === "COMPLETED" || app.status === "DISBURSEMENT"
        ? "DISBURSED"
        : (app.disbursementStatus || "").toUpperCase() === "INITIATED"
        ? "INITIATED"
        : "PENDING"
    );
    setDisbursementStageAmountInput(
      app.disbursedAmount ? String(app.disbursedAmount) : app.sanctionedAmount ? String(app.sanctionedAmount) : app.appliedAmount ? String(app.appliedAmount) : ""
    );
    setDisbursementStageDateInput(
      app.disbursedAt ? new Date(app.disbursedAt).toISOString().split("T")[0] : new Date().toISOString().split("T")[0]
    );
    setDisbursementStageRemarkInput(app.disbursedRemark || "");
  };

  const handleDisbursementStageSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!disbursementStageModalApp) return;
    setDisbursementStageSubmitting(true);
    try {
      const amt = disbursementStageAmountInput ? parseFloat(disbursementStageAmountInput) : undefined;
      const res = await axios.put(`${API_URL}/applications/${disbursementStageModalApp.id}/stage-status`, {
        stageType: "DISBURSEMENT",
        status: disbursementStageStatusInput,
        disbursedAmount: amt,
        disbursementDate: disbursementStageDateInput || undefined,
        remark: disbursementStageRemarkInput.trim() || undefined,
      });
      toast.success(`Disbursement status updated to ${disbursementStageStatusInput}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) =>
          prev.map((a) =>
            a.id === updated.id
              ? {
                  ...a,
                  ...updated,
                  status: disbursementStageStatusInput === "DISBURSED" ? "DISBURSEMENT" : a.status,
                  disbursementStatus: disbursementStageStatusInput,
                  disbursedAmount: amt !== undefined ? amt : a.disbursedAmount,
                  disbursedAt: disbursementStageDateInput ? new Date(disbursementStageDateInput) : a.disbursedAt,
                  disbursedRemark: disbursementStageRemarkInput.trim(),
                }
              : a
          )
        );
      }
      if (verificationApp && verificationApp.id === disbursementStageModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          status: disbursementStageStatusInput === "DISBURSED" ? "DISBURSEMENT" : prev.status,
          disbursementStatus: disbursementStageStatusInput,
          disbursedAmount: amt !== undefined ? amt : prev.disbursedAmount,
          disbursedAt: disbursementStageDateInput ? new Date(disbursementStageDateInput) : prev.disbursedAt,
          disbursedRemark: disbursementStageRemarkInput.trim(),
        }));
      }
      setDisbursementStageModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update Disbursement status");
    } finally {
      setDisbursementStageSubmitting(false);
    }
  };

  // 5. General Stage Modal
  const openStageModal = (app, defaultTarget) => {
    setStageModalApp(app);
    setStageTargetInput(defaultTarget || app.status || "DOCS_PENDING");
    setStageRemarkInput("");
    setStageSanctionedAmtInput(app.sanctionedAmount ? String(app.sanctionedAmount) : "");
  };

  const handleStageSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!stageModalApp) return;
    setStageSubmitting(true);
    try {
      const res = await axios.put(`${API_URL}/applications/${stageModalApp.id}/stage-status`, {
        stageType: "STAGE",
        status: stageTargetInput,
        remark: stageRemarkInput.trim() || undefined,
        sanctionedAmount: stageSanctionedAmtInput ? parseFloat(stageSanctionedAmtInput) : undefined,
      });
      toast.success(`Workflow stage updated to ${stageTargetInput.replace(/_/g, " ")}!`);
      const updated = res.data?.application;
      if (updated) {
        setApplications((prev) => prev.map((a) => (a.id === updated.id ? { ...a, ...updated, status: stageTargetInput } : a)));
      }
      if (verificationApp && verificationApp.id === stageModalApp.id) {
        setVerificationApp((prev) => ({
          ...prev,
          ...(updated || {}),
          status: stageTargetInput,
          sanctionedAmount: stageSanctionedAmtInput ? parseFloat(stageSanctionedAmtInput) : prev.sanctionedAmount,
        }));
      }
      setStageModalApp(null);
      fetchApplications(appCurrentPage, true);
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to update stage");
    } finally {
      setStageSubmitting(false);
    }
  };

  // 6. History Timeline Modal
  const openHistoryModal = async (app) => {
    setHistoryModalApp(app);
    setHistoryTimeline([]);
    setHistoryLoading(true);
    try {
      const res = await axios.get(`${API_URL}/applications/${app.id}/history`);
      setHistoryTimeline(res.data?.history || []);
    } catch (err) {
      console.error(err);
      toast.error("Failed to load status history");
    } finally {
      setHistoryLoading(false);
    }
  };

  // Transition Application Pipeline Stage (Always opens corresponding popup modal)
  const handleStageTransition = (appId, newStatus) => {
    const app = (verificationApp?.id === appId ? verificationApp : null) || applications.find((a) => a.id === appId);
    if (!app) return;

    if (newStatus === "LOGIN" || newStatus === "BANK_LOGIN" || newStatus === "LOGGED_IN") {
      openLoginModal(app);
      return;
    }
    if (newStatus === "PD") {
      openPdModal(app);
      return;
    }
    if (newStatus === "QUERY") {
      openQueryModal(app);
      return;
    }
    if (newStatus === "LEGAL") {
      openLegalModal(app);
      return;
    }
    if (newStatus === "TECHNICAL") {
      openTechnicalModal(app);
      return;
    }
    if (newStatus === "SANCTIONED" || newStatus === "SANCTION") {
      openSanctionModal(app);
      return;
    }
    if (newStatus === "DISBURSEMENT") {
      openDisbursementStageModal(app);
      return;
    }
    if (newStatus === "OTC") {
      openOtcModal(app);
      return;
    }
    if (newStatus === "CANCELLED" || newStatus === "CANCEL") {
      setDisburseModalApp(app);
      setDisburseStatusInput("CANCEL");
      return;
    }
    if (newStatus === "DISBURSED") {
      initiateDisburseModal(app);
      return;
    }
    if (newStatus === "PDD") {
      openPddModal(app);
      return;
    }
    if (newStatus === "ALL_PROCESS_COMPLETED" || newStatus === "COMPLETED") {
      openAllProcessCompletedModal(app);
      return;
    }

    // For any general workflow stage (DOCS_PENDING, READY_TO_SEND, SUBMITTED_TO_BANK, SANCTIONED, REJECTED, etc.)
    openStageModal(app, newStatus);
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
      const [appRes, tplRes, smtpRes] = await Promise.all([
        axios.get(`${API_URL}/applications/${app.id}`),
        axios.get(`${API_URL}/email-templates`),
        axios.get(`${API_URL}/email-templates/smtp/config`).catch(() => ({ data: null })),
      ]);

      const fullApp = appRes.data?.application || app;
      setBankMailModalApp(fullApp);

      const tpls = tplRes.data?.templates || tplRes.data?.data || [];
      setEmailTemplates(tpls);

      if (smtpRes?.data?.data && smtpRes.data.data.user && (smtpRes.data.data.hasPassword || smtpRes.data.data.isConfigured)) {
        setMailSmtpConfig(smtpRes.data.data);
        setQuickSmtpUser(smtpRes.data.data.user || "");
        setQuickSmtpSenderName(smtpRes.data.data.senderName || "");
      } else {
        setMailSmtpConfig(null);
        setQuickSmtpUser(localStorage.getItem("email") || "");
        setQuickSmtpSenderName(localStorage.getItem("name") || "Operations Desk");
      }

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

    if (!mailSmtpConfig?.user && !mailSmtpConfig?.isConfigured) {
      toast.warning("Sender email is not configured. Please set your Gmail ID & App Password below.");
      setQuickSmtpOpen(true);
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
      fetchApplications(appCurrentPage, true);
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
      loanProduct: lead.loan_type || loanProducts[0]?.label || loanProducts[0]?.value || "Personal Loan",
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

  // Edit Bank / Lender & Banker Partner for Application
  const openEditBankModal = (app) => {
    setEditBankModalApp(app);
    setEditBankForm({
      lenderId: app.lenderId || app.lender?.id || (app.lender?.lender_id ? String(app.lender.lender_id) : "") || "",
      assignedBankerId: app.assignedBankerId || app.assignedBanker?.id || "",
      loanProduct: app.loanProduct || "",
    });
  };

  const handleEditBankSubmit = async (e) => {
    e.preventDefault();
    if (!editBankForm.lenderId) {
      toast.warning("Please select a Bank / NBFC Institution");
      return;
    }
    setEditBankSubmitting(true);
    try {
      const payload = {
        lenderId: parseInt(editBankForm.lenderId, 10),
        assignedBankerId: editBankForm.assignedBankerId ? parseInt(editBankForm.assignedBankerId, 10) : null,
      };
      if (editBankForm.loanProduct) {
        payload.loanProduct = editBankForm.loanProduct;
      }
      const res = await axios.patch(`${API_URL}/applications/${editBankModalApp.id}`, payload);
      const updated = res.data?.application;

      const selectedLender = lenders.find((l) => String(l.lender_id || l.id) === String(payload.lenderId));
      const selectedBanker = bankers.find((b) => String(b.id) === String(payload.assignedBankerId));

      const patchApp = (prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          ...updated,
          lenderId: payload.lenderId,
          assignedBankerId: payload.assignedBankerId,
          loanProduct: payload.loanProduct || prev.loanProduct,
          lender: selectedLender || updated?.lender || prev.lender,
          assignedBanker: selectedBanker || updated?.assignedBanker || prev.assignedBanker,
        };
      };

      setApplications((prev) =>
        Array.isArray(prev) ? prev.map((a) => (a.id === editBankModalApp.id ? patchApp(a) : a)) : []
      );
      if (verificationApp && verificationApp.id === editBankModalApp.id) {
        setVerificationApp((prev) => patchApp(prev));
      }

      setLeads((prev) =>
        Array.isArray(prev)
          ? prev.map((ld) => {
              if (ld.application_id === editBankModalApp.id || ld.lead_id === editBankModalApp.leadId) {
                return {
                  ...ld,
                  bank_name: selectedLender?.name || ld.bank_name,
                };
              }
              return ld;
            })
          : []
      );

      toast.success(`Bank successfully updated to ${selectedLender?.name || "selected Bank"}!`);
      setEditBankModalApp(null);
      fetchApplications(appCurrentPage, true);
      fetchLeads(leadCurrentPage, true);
    } catch (error) {
      console.error("Error updating bank:", error);
      toast.error(error.response?.data?.message || "Failed to update Bank");
    } finally {
      setEditBankSubmitting(false);
    }
  };

  // Edit Loan / Applied Amount & Sanction Amount
  const openEditAmountModal = (app) => {
    if (!app) return;
    setEditAmountModalApp(app);
    setEditAmountForm({
      appliedAmount: app.appliedAmount ? String(app.appliedAmount) : (app.est_budget ? String(app.est_budget) : ""),
      sanctionedAmount: app.sanctionedAmount ? String(app.sanctionedAmount) : "",
      loanProduct: app.loanProduct || app.loan_type || "",
    });
  };

  const handleEditAmountSubmit = async (e) => {
    e.preventDefault();
    const rawAmt = editAmountForm.appliedAmount.toString().replace(/,/g, "").trim();
    if (!rawAmt || isNaN(parseFloat(rawAmt))) {
      toast.warning("Please enter a valid Loan Amount");
      return;
    }
    setEditAmountSubmitting(true);
    try {
      const appliedAmt = parseFloat(rawAmt);
      const rawSanct = editAmountForm.sanctionedAmount ? editAmountForm.sanctionedAmount.toString().replace(/,/g, "").trim() : "";
      const sanctAmt = rawSanct && !isNaN(parseFloat(rawSanct)) ? parseFloat(rawSanct) : null;

      const appId = editAmountModalApp.id || editAmountModalApp.application_id;
      const leadId = editAmountModalApp.leadId || editAmountModalApp.lead_id || editAmountModalApp.id;

      if (appId) {
        const payload = {
          appliedAmount: appliedAmt,
        };
        if (sanctAmt !== null) payload.sanctionedAmount = sanctAmt;
        if (editAmountForm.loanProduct) payload.loanProduct = editAmountForm.loanProduct;

        const res = await axios.patch(`${API_URL}/applications/${appId}`, payload);
        const updated = res.data?.application;

        setApplications((prev) =>
          Array.isArray(prev)
            ? prev.map((a) =>
                a.id === appId
                  ? {
                      ...a,
                      ...updated,
                      appliedAmount: appliedAmt,
                      sanctionedAmount: sanctAmt !== null ? sanctAmt : a.sanctionedAmount,
                      loanProduct: editAmountForm.loanProduct || a.loanProduct,
                    }
                  : a
              )
            : []
        );

        if (verificationApp && (verificationApp.id === appId || verificationApp.application_id === appId)) {
          setVerificationApp((prev) => ({
            ...prev,
            ...updated,
            appliedAmount: appliedAmt,
            sanctionedAmount: sanctAmt !== null ? sanctAmt : prev.sanctionedAmount,
            loanProduct: editAmountForm.loanProduct || prev.loanProduct,
          }));
        }

        setLeads((prev) =>
          Array.isArray(prev)
            ? prev.map((ld) =>
                ld.application_id === appId || ld.lead_id === leadId
                  ? { ...ld, est_budget: appliedAmt, applied_amount: appliedAmt, sanctioned_amount: sanctAmt }
                  : ld
              )
            : []
        );

        toast.success(`Loan Amount updated to ${currencyFormatter.format(appliedAmt)}!`);
      } else if (leadId) {
        await axios.put(`${API_URL}/leads/${leadId}`, {
          requiredAmount: appliedAmt,
          est_budget: appliedAmt,
          loanType: editAmountForm.loanProduct || undefined,
        });

        setLeads((prev) =>
          Array.isArray(prev)
            ? prev.map((ld) =>
                (ld.lead_id === leadId || ld.id === leadId)
                  ? { ...ld, est_budget: appliedAmt, loan_type: editAmountForm.loanProduct || ld.loan_type }
                  : ld
              )
            : []
        );
        toast.success(`Required Budget updated to ${currencyFormatter.format(appliedAmt)}!`);
      }

      setEditAmountModalApp(null);
      fetchApplications(appCurrentPage, true);
      fetchLeads(leadCurrentPage, true);
    } catch (error) {
      console.error("Error updating loan amount:", error);
      toast.error(error.response?.data?.message || "Failed to update Loan Amount");
    } finally {
      setEditAmountSubmitting(false);
    }
  };

  // Reassign Lead Ownership
  const openReassignModal = (item) => {
    if (!item) return;
    const leadId = item.lead_id || item.leadId || (item.lead ? item.lead.id : item.id);
    const currentOwnerId =
      item.person_id ||
      item.assignedEmployeeId ||
      item.lead?.assignedEmployeeId ||
      item.current_owner_id ||
      "";
    const currentOwnerName =
      item.owner ||
      item.current_owner ||
      item.lead?.assignedEmployee?.name ||
      "Unassigned";
    const appNum = item.applicationNumber || item.application_number || "";
    const custName =
      item.name ||
      item.customer?.name ||
      item.customerName ||
      "Customer";

    setReassignModalData({
      lead_id: leadId,
      name: custName,
      owner: currentOwnerName,
      person_id: currentOwnerId,
      applicationNumber: appNum,
      applicationId: item.applicationId || (item.lead_id ? item.application_id : item.id),
    });
    setReassignTargetUserId(currentOwnerId ? String(currentOwnerId) : "");
    setReassignReason("");
  };

  const handleReassignSubmit = async (e) => {
    e.preventDefault();
    if (!reassignTargetUserId) {
      toast.warning("Please select a staff member to reassign to");
      return;
    }
    const leadId = reassignModalData?.lead_id;
    if (!leadId) {
      toast.error("Lead reference is missing for this record");
      return;
    }
    setReassignSubmitting(true);
    try {
      const targetEmp = employees.find((u) => String(u.id) === String(reassignTargetUserId));
      await axios.patch(`${API_URL}/leads/${leadId}/assign`, {
        assignedEmployeeId: parseInt(reassignTargetUserId, 10),
        reason:
          reassignReason ||
          (targetEmp ? `Reassigned to ${targetEmp.name} from Operations` : "Reassigned from Operations"),
      });

      toast.success(targetEmp ? `Lead reassigned to ${targetEmp.name}!` : "Lead reassigned successfully!");
      setReassignModalData(null);
      setReassignReason("");

      // Refresh applications and leads queue
      fetchApplications(appCurrentPage, true);
      fetchLeads(leadCurrentPage);

      if (verificationApp && (verificationApp.leadId === leadId || verificationApp.lead?.id === leadId)) {
        setVerificationApp((prev) =>
          prev
            ? {
                ...prev,
                lead: {
                  ...(prev.lead || {}),
                  assignedEmployeeId: parseInt(reassignTargetUserId, 10),
                  assignedEmployee: targetEmp || prev.lead?.assignedEmployee,
                },
              }
            : prev
        );
      }
    } catch (err) {
      console.error("Error reassigning lead:", err);
      toast.error(err.response?.data?.message || "Failed to reassign lead");
    } finally {
      setReassignSubmitting(false);
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
      fetchApplications(appCurrentPage, true);
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

      {/* Banker Stage KPI Cards - Compact horizontally & vertically */}
      <section style={{ marginBottom: "8px", display: "flex", alignItems: "center", gap: "6px", flexWrap: "wrap" }}>
        <span style={{ color: "#64748b", fontSize: "10.5px", fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.04em", marginRight: 2 }}>
          Stage KPI:
        </span>
        {BANK_STAGE_CARDS.map((card) => {
          const metric = stageKpiMetrics[card.key] || { count: 0, amount: 0 };
          const isActive = activeStageCard === card.key;
          return (
            <div
              key={card.key}
              onClick={() => setActiveStageCard((prev) => (prev === card.key ? null : card.key))}
              style={{
                backgroundColor: "#0b1328",
                backgroundImage: "linear-gradient(180deg, #0e172e 0%, #080e1d 100%)",
                borderRadius: "5px",
                padding: "2px 8px",
                border: isActive ? "2px solid #38bdf8" : "1px solid rgba(255, 255, 255, 0.12)",
                boxShadow: isActive ? "0 0 8px rgba(56, 189, 248, 0.3)" : "none",
                cursor: "pointer",
                transition: "all 0.15s ease-in-out",
                userSelect: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "5px",
                height: "26px",
              }}
              className="cc-bank-stage-card"
              title={`Click to filter by ${card.label}`}
            >
              <div style={{ display: "flex", alignItems: "center", gap: "4px", lineHeight: 1 }}>
                <span style={{ fontSize: "9.5px", fontWeight: 700, color: isActive ? "#38bdf8" : "#94a3b8", textTransform: "uppercase" }}>
                  {card.label}:
                </span>
                <span style={{ fontSize: "9.5px", fontWeight: 600, color: "#cbd5e1" }}>
                  {formatCurrencyCompact(metric.amount)}
                </span>
              </div>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 800,
                  color: "#ffffff",
                  paddingLeft: "5px",
                  borderLeft: "1px solid rgba(255, 255, 255, 0.18)",
                  lineHeight: 1,
                }}
              >
                {metric.count}
              </span>
            </div>
          );
        })}
        {activeStageCard && (
          <button
            type="button"
            onClick={() => setActiveStageCard(null)}
            style={{
              display: "inline-flex",
              alignItems: "center",
              gap: "3px",
              background: "#f1f5f9",
              border: "1px solid #cbd5e1",
              borderRadius: "5px",
              padding: "2px 7px",
              fontSize: "10.5px",
              fontWeight: 600,
              color: "#475569",
              cursor: "pointer",
              height: "26px",
            }}
          >
            <RotateCcw size={10} /> Clear
          </button>
        )}
      </section>

      {/* VIEW MODE: PIPELINE (KANBAN / TABLE) */}
      {viewMode === "pipeline" && (
        <>
          {/* Search, Bank, Date/Month/FY Filters & Stage Tabs */}
          {renderFilterToolbar(true)}

          {/* KANBAN BOARD VIEW */}
          {displayType === "kanban" ? (
            <div className="cc-ops-kanban-board">
              {PIPELINE_STAGES.map((stage) => {
                const stageApps = displayedApplications.filter((a) => {
                  const s = (a.status || "DOCS_PENDING").toUpperCase();
                  if (stage.key === "SUBMITTED_TO_BANK") {
                    return s === "SUBMITTED_TO_BANK" || s === "UNDER_REVIEW";
                  }
                  if (stage.key === "LOGIN") {
                    return s === "LOGIN" || s === "LOGGED_IN" || (a.loginStatus || "").toUpperCase() === "COMPLETED";
                  }
                  if (stage.key === "SANCTIONED") {
                    return (s === "SANCTIONED" || s === "APPROVED" || (a.sanctionStatus || "").toUpperCase() === "SANCTIONED") && s !== "DISBURSEMENT" && s !== "DISBURSED";
                  }
                  if (stage.key === "DISBURSEMENT") {
                    return s === "DISBURSEMENT" || (a.disbursementStatus || "").toUpperCase() === "INITIATED" || (a.disbursementStatus || "").toUpperCase() === "PARTIAL";
                  }
                  if (stage.key === "CANCELLED") {
                    return s === "CANCELLED" || a.disbursementStatus === "CANCELLED";
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
                                  <div style={{ display: "flex", alignItems: "center", gap: 3 }}>
                                    <strong>{currencyFormatter.format(app.appliedAmount || 0)}</strong>
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        openEditAmountModal(app);
                                      }}
                                      style={{
                                        background: "none",
                                        border: "none",
                                        padding: 0,
                                        cursor: "pointer",
                                        color: "#4f46e5",
                                      }}
                                      title="Edit Loan Amount"
                                    >
                                      <Pencil size={9} />
                                    </button>
                                  </div>
                                </div>
                              </div>

                              <div className="cc-kcard-footer">
                                <span
                                  className="cc-kcard-lender"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditBankModal(app);
                                  }}
                                  title={`Click to change or edit assigned ${app.lender?.lenderType || "Bank"}`}
                                  style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 4 }}
                                >
                                  <Building2 size={12} /> {app.lender?.shortCode || app.lender?.name || "Direct Bank"}
                                  <Pencil size={10} style={{ opacity: 0.8 }} />
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
              <div ref={pipelineTableContainerRef} className="cc-report-table-scroll cc-ops-table-container cc-ops-pipeline-table-container">
                <table>
                  <thead>
                    <tr>
                      <th>App &amp; Borrower</th>
                      <th>Bank &amp; Team</th>
                      <th>Workflow Stage</th>
                      <th>Login</th>
                      <th>PD Status</th>
                      <th>Banker Query</th>
                      <th>Legal</th>
                      <th>Technical</th>
                      <th>Sanction</th>
                      <th>Disbursement</th>
                      <th>OTC</th>
                      <th>Cancel</th>
                      <th>Final Disbursed</th>
                      <th>PDD</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {appsLoading && displayedApplications.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="cc-report-empty">
                          Loading loan applications...
                        </td>
                      </tr>
                    ) : displayedApplications.length === 0 ? (
                      <tr>
                        <td colSpan={15} className="cc-report-empty">
                          No loan applications match the selected filters.
                        </td>
                      </tr>
                    ) : (
                      displayedApplications.map((app) => (
                        <tr
                          key={app.id}
                          className="cc-ops-table-row"
                          onClick={() => openVerificationDrawer(app)}
                        >
                          {/* 1. App & Borrower */}
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <strong style={{ fontSize: 11.5, color: "#0f172a" }}>{app.customer?.name || "Customer"}</strong>
                              {app.customer?.mobile && (
                                <span style={{ fontSize: 10.5, color: "#64748b" }}>({app.customer.mobile})</span>
                              )}
                              <span style={{ fontSize: 9.5, color: "#94a3b8" }}>#{app.applicationNumber}</span>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1, fontSize: 10.5, whiteSpace: "nowrap" }}>
                              <span style={{ color: "#475569" }}>{app.loanProduct}</span>:
                              <strong style={{ color: "#0f172a" }}>{currencyFormatter.format(app.appliedAmount || 0)}</strong>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditAmountModal(app);
                                }}
                                style={{
                                  background: "#f1f5f9",
                                  border: "1px solid #cbd5e1",
                                  borderRadius: 3,
                                  padding: "0 3px",
                                  fontSize: 8.5,
                                  height: 15,
                                  lineHeight: "13px",
                                  cursor: "pointer",
                                  color: "#0f172a",
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 2,
                                }}
                                title="Edit Loan Amount"
                              >
                                <Pencil size={8} />
                              </button>
                              {app.sanctionedAmount ? (
                                <span style={{ color: "#0284c7", fontWeight: 600 }}>• Sanct: {currencyFormatter.format(app.sanctionedAmount)}</span>
                              ) : null}
                              {app.lead?.leadSource && (
                                <span style={{ fontSize: 9, color: "#475569", background: "#f1f5f9", padding: "0 3px", borderRadius: 2 }}>
                                  {app.lead.leadSource}
                                </span>
                              )}
                            </div>
                          </td>

                          {/* 2. Bank & Team */}
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 4, whiteSpace: "nowrap" }}>
                              <Building2 size={11} color="#4f46e5" />
                              <strong style={{ fontSize: 11.5, color: "#0f172a" }}>
                                {app.lender?.name || `Unassigned ${app.lender?.lenderType || "Bank"}`}
                              </strong>
                              <button
                                type="button"
                                className="cc-ops-edit-bank-btn"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openEditBankModal(app);
                                }}
                                style={{ padding: "0 4px", fontSize: 9, height: 16, lineHeight: "14px" }}
                                title={`Edit ${app.lender?.lenderType || "Bank"}`}
                              >
                                <Pencil size={8} />
                              </button>
                            </div>
                            <div style={{ display: "flex", alignItems: "center", gap: 3, marginTop: 1, fontSize: 10.5, whiteSpace: "nowrap" }}>
                              <span style={{ color: "#64748b" }}>Staff:</span>
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openReassignModal(app);
                                }}
                                title="Click to reassign staff"
                                style={{
                                  background: "none",
                                  border: "none",
                                  padding: 0,
                                  color: app.lead?.assignedEmployee?.name ? "#166534" : "#94a3b8",
                                  fontWeight: 600,
                                  fontSize: 10.5,
                                  cursor: "pointer",
                                  textDecoration: "underline dotted",
                                }}
                              >
                                {app.lead?.assignedEmployee?.name || "Unassigned"} ✏️
                              </button>
                              {app.assignedBanker?.name ? (
                                <span style={{ color: "#047857", fontSize: 10, marginLeft: 2 }}>
                                  • {app.assignedBanker.name.split(" ")[0]}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          {/* 3. Workflow Stage */}
                          <td>
                            <div
                              onClick={(e) => {
                                e.stopPropagation();
                                openStageModal(app);
                              }}
                              title="Click to advance or change workflow stage"
                              style={{ cursor: "pointer", display: "inline-block" }}
                            >
                              {renderWorkflowStageBadge(app)}
                            </div>
                            {renderStagePendingNotice(app)}
                          </td>

                          {/* 4. Login */}
                          {renderOpsStatusCell({
                            status: app.loginStatus || (app.status === "LOGGED_IN" ? "COMPLETED" : "PENDING"),
                            updatedAt: app.loginUpdatedAt,
                            remark: app.loginRemark,
                            onClick: () => openLoginModal(app),
                            pendingText: "Pending",
                            completedText: "Completed",
                          })}

                          {/* 5. PD Status */}
                          {renderOpsStatusCell({
                            status: app.pdStatus || "PENDING",
                            updatedAt: app.pdUpdatedAt,
                            remark: app.pdRemark,
                            onClick: () => openPdModal(app),
                            pendingText: "Pending",
                            completedText: "Completed",
                          })}

                          {/* 6. Banker Query */}
                          {renderOpsStatusCell({
                            status:
                              app.opsQueryStatus && app.opsQueryStatus !== "NONE"
                                ? app.opsQueryStatus
                                : (app.queries || []).some((q) => q.status === "OPEN")
                                ? "PENDING"
                                : (app.queries || []).length > 0
                                ? "COMPLETED"
                                : "NONE",
                            updatedAt: app.opsQueryUpdatedAt,
                            remark: app.opsQueryRemark,
                            onClick: () => openQueryModal(app),
                            pendingText: "Pending",
                            completedText: "Completed",
                            app,
                            stageTitle: "Banker Query",
                            onViewRemark: setRemarkViewModal,
                            onWhatsApp: shareOnWhatsApp,
                          })}

                          {/* 7. Legal */}
                          {renderOpsStatusCell({
                            status: app.legalStatus || "NOT_STARTED",
                            updatedAt: app.legalUpdatedAt,
                            remark: app.legalRemark,
                            onClick: () => openLegalModal(app),
                            pendingText: "Initiated",
                            completedText: "Resolved",
                            app,
                            stageTitle: "Legal Status",
                            onViewRemark: setRemarkViewModal,
                            onWhatsApp: shareOnWhatsApp,
                          })}

                          {/* 8. Technical */}
                          {renderOpsStatusCell({
                            status: app.technicalStatus || "NOT_STARTED",
                            updatedAt: app.technicalUpdatedAt,
                            remark: app.technicalRemark,
                            onClick: () => openTechnicalModal(app),
                            pendingText: "Initiated",
                            completedText: "Resolved",
                            app,
                            stageTitle: "Technical Status",
                            onViewRemark: setRemarkViewModal,
                            onWhatsApp: shareOnWhatsApp,
                          })}

                          {/* 9. Sanction */}
                          <td
                            onClick={(e) => {
                              e.stopPropagation();
                              openSanctionModal(app);
                            }}
                            className="cc-ops-clickable-status-td"
                            title="Click to view or update Bank Sanction status & amount"
                          >
                            <div className="cc-ops-status-cell-inner">
                              <div style={{ display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                                {(app.sanctionStatus || "").toUpperCase() === "SANCTIONED" || app.status === "SANCTIONED" ? (
                                  <span className="cc-substatus-pill resolved">
                                    <CheckCircle2 size={10} /> <strong>Sanctioned ✓</strong>
                                  </span>
                                ) : (app.sanctionStatus || "").toUpperCase() === "REJECTED" ? (
                                  <span className="cc-substatus-pill rejected">
                                    <XCircle size={10} /> <strong>Rejected ❌</strong>
                                  </span>
                                ) : (
                                  <span className="cc-substatus-pill pending">
                                    <Clock size={10} /> <strong>Pending ⏳</strong>
                                  </span>
                                )}
                                {(app.sanctionAmount || app.sanctionedAmount) ? (
                                  <strong style={{ fontSize: 10.5, color: "#15803d" }}>
                                    {currencyFormatter.format(app.sanctionAmount || app.sanctionedAmount)}
                                  </strong>
                                ) : null}
                              </div>
                              {app.sanctionRemark ? (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemarkViewModal({
                                      title: "Sanction Remark",
                                      stage: "Sanctioned",
                                      remark: app.sanctionRemark,
                                      updatedAt: app.sanctionUpdatedAt,
                                      app,
                                    });
                                  }}
                                  title={`Sanction Remark: "${app.sanctionRemark}" (Click to view)`}
                                  style={{ fontSize: 9.5, color: "#475569", cursor: "pointer", maxWidth: 105, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}
                                >
                                  💬 {app.sanctionRemark}
                                </div>
                              ) : app.sanctionUpdatedAt ? (
                                <div className="cc-status-cell-time" style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 1, lineHeight: 1 }}>
                                  {new Date(app.sanctionUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                </div>
                              ) : null}
                            </div>
                          </td>

                          {/* 10. Intermediate Disbursement */}
                          <td
                            onClick={(e) => {
                              e.stopPropagation();
                              openDisbursementStageModal(app);
                            }}
                            className="cc-ops-clickable-status-td"
                            title="Click to view or update Loan Disbursement status & amount"
                          >
                            <div className="cc-ops-status-cell-inner">
                              <div style={{ display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                                {(app.disbursementStatus || "").toUpperCase() === "DISBURSED" || (app.disbursementStatus || "").toUpperCase() === "COMPLETED" || app.status === "DISBURSEMENT" ? (
                                  <span className="cc-substatus-pill resolved">
                                    <CheckCircle2 size={10} /> <strong>Disbursed ✓</strong>
                                  </span>
                                ) : (app.disbursementStatus || "").toUpperCase() === "INITIATED" ? (
                                  <span className="cc-substatus-pill initiated">
                                    <Clock size={10} /> <strong>Initiated ⚡</strong>
                                  </span>
                                ) : (
                                  <span className="cc-substatus-pill pending">
                                    <Clock size={10} /> <strong>Pending ⏳</strong>
                                  </span>
                                )}
                                {app.disbursedAmount ? (
                                  <strong style={{ fontSize: 10.5, color: "#047857" }}>
                                    {currencyFormatter.format(app.disbursedAmount)}
                                  </strong>
                                ) : null}
                              </div>
                              {app.disbursedRemark ? (
                                <div
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setRemarkViewModal({
                                      title: "Disbursement Remark",
                                      stage: "Disbursement",
                                      remark: app.disbursedRemark,
                                      updatedAt: app.disbursedAt,
                                      app,
                                    });
                                  }}
                                  title={`Disbursement Remark: "${app.disbursedRemark}" (Click to view)`}
                                  style={{ fontSize: 9.5, color: "#475569", cursor: "pointer", maxWidth: 105, whiteSpace: "nowrap", overflow: "hidden", textOverflow: "ellipsis", marginTop: 1 }}
                                >
                                  💬 {app.disbursedRemark}
                                </div>
                              ) : app.disbursedAt ? (
                                <div className="cc-status-cell-time" style={{ fontSize: 9.5, color: "#94a3b8", marginTop: 1, lineHeight: 1 }}>
                                  {new Date(app.disbursedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short" })}
                                </div>
                              ) : null}
                            </div>
                          </td>

                          {/* 11. OTC */}
                          {renderOpsStatusCell({
                            status: app.otcStatus || "PENDING",
                            updatedAt: app.otcUpdatedAt,
                            remark: app.otcRemark,
                            onClick: () => openOtcModal(app),
                            pendingText: "Pending",
                            completedText: "Resolved",
                            app,
                            stageTitle: "OTC Clearance",
                            onViewRemark: setRemarkViewModal,
                            onWhatsApp: shareOnWhatsApp,
                          })}

                          {/* 12. Cancel */}
                          <td onClick={(e) => e.stopPropagation()}>
                            {app.status === "CANCELLED" || app.disbursementStatus === "CANCELLED" ? (
                              <div className="cc-ops-status-cell-inner">
                                <span
                                  className="cc-substatus-pill rejected"
                                  title={app.disbursedRemark || app.rejectionReason || "Disbursement cancelled"}
                                  onClick={() => initiateDisburseModal(app)}
                                  style={{ cursor: "pointer" }}
                                >
                                  <XCircle size={10} /> <strong>Cancelled ❌</strong>
                                </span>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="cc-ops-action-btn"
                                onClick={() => {
                                  setDisburseModalApp(app);
                                  setDisburseStatusInput("CANCEL");
                                }}
                                style={{ color: "#ef4444", borderColor: "#fca5a5", background: "#fef2f2", fontSize: 10, padding: "2px 5px", height: 20 }}
                                title="Click to cancel loan disbursement"
                              >
                                <XCircle size={10} /> Cancel
                              </button>
                            )}
                          </td>

                          {/* 13. Final Disbursed */}
                          <td onClick={(e) => e.stopPropagation()}>
                            {app.status === "DISBURSED" ? (
                              <div className="cc-ops-status-cell-inner">
                                <div style={{ display: "flex", alignItems: "center", gap: 3, whiteSpace: "nowrap" }}>
                                  <span className="cc-disbursed-done-tag" style={{ padding: "1px 5px", fontSize: 10 }} title="Loan application is fully Disbursed">
                                    <CheckCircle2 size={10} /> Disbursed
                                  </span>
                                  {app.disbursedAmount ? (
                                    <strong style={{ fontSize: 10.5, color: "#047857" }}>
                                      {currencyFormatter.format(app.disbursedAmount)}
                                    </strong>
                                  ) : null}
                                </div>
                              </div>
                            ) : (
                              <button
                                type="button"
                                className="cc-ops-action-btn cc-btn-disburse"
                                style={{ padding: "2px 5px", fontSize: 10, height: 20 }}
                                title="Confirm & Mark Loan as Disbursed"
                                onClick={() => initiateDisburseModal(app)}
                              >
                                <CheckCircle2 size={10} /> Disburse
                              </button>
                            )}
                          </td>

                          {/* 14. PDD */}
                          {renderOpsStatusCell({
                            status: app.pddStatus || "PENDING",
                            updatedAt: app.pddUpdatedAt,
                            remark: app.pddRemark,
                            onClick: () => openPddModal(app),
                            pendingText: "Pending",
                            completedText: "Resolved",
                            app,
                            stageTitle: "PDD (Post-Disbursement Documents)",
                            onViewRemark: setRemarkViewModal,
                            onWhatsApp: shareOnWhatsApp,
                          })}

                          {/* 15. Actions - Strictly Horizontal Row */}
                          <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                            <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 3, flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                              <button
                                type="button"
                                className="cc-ops-action-btn cc-btn-history"
                                title="View Status History & Audit Trail"
                                onClick={() => openHistoryModal(app)}
                                style={{ padding: "2px 5px", fontSize: "10px", height: 20, whiteSpace: "nowrap" }}
                              >
                                <Clock size={10} /> History
                              </button>

                              <button
                                type="button"
                                className="cc-ops-action-btn mail-dispatch"
                                title="Send Loan Application & KYC to Bank via Email"
                                onClick={() => openBankMailModal(app)}
                                style={{ padding: "2px 5px", fontSize: "10px", height: 20, whiteSpace: "nowrap" }}
                              >
                                <Mail size={10} /> Email
                              </button>

                              <button
                                type="button"
                                className="cc-ops-action-btn"
                                style={{ color: "#047857", borderColor: "#a7f3d0", background: "#ecfdf5", fontWeight: 700, padding: "2px 5px", fontSize: "10px", height: 20, whiteSpace: "nowrap" }}
                                title="All Process Completed (Mark Completed, Disburse & Sync Payout)"
                                onClick={() => openAllProcessCompletedModal(app)}
                              >
                                <CheckCircle2 size={10} /> All Done
                              </button>

                              <button
                                type="button"
                                className="cc-ops-action-btn"
                                onClick={() => openVerificationDrawer(app)}
                                style={{ padding: "2px 5px", fontSize: "10px", height: 20, whiteSpace: "nowrap" }}
                              >
                                KYC <ChevronRight size={10} />
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
                pageSize={pageSize}
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

            <div ref={leadsTableContainerRef} className="cc-report-table-scroll cc-ops-table-container cc-ops-leads-table-container">
              <table>
                <thead>
                  <tr>
                    <th>LEAD</th>
                    <th>Customer Name</th>
                    <th>Contact Phone</th>
                    <th>Assigned Person / Owner</th>
                    <th>Loan Product</th>
                    <th>Est. Budget</th>
                    <th>Assigned Bank / NBFC</th>
                    <th>Status</th>
                    <th style={{ minWidth: 220 }}>Latest Remark</th>
                    <th>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leadsLoading && leads.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="cc-report-empty">
                        Loading operations leads...
                      </td>
                    </tr>
                  ) : leads.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="cc-report-empty">
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
                        <td style={{ fontWeight: 600 }}>#{formatLeadCode(lead)}</td>
                        <td>
                          <strong>{lead.name || "--"}</strong>
                        </td>
                        <td>{lead.number || "--"}</td>
                        <td>
                          <span
                            className="cc-ops-owner-tag"
                            style={{ cursor: "pointer", display: "inline-flex", alignItems: "center", gap: 3 }}
                            onClick={(e) => {
                              e.stopPropagation();
                              openReassignModal(lead);
                            }}
                            title="Click to reassign lead ownership"
                          >
                            <UserCheck size={11} color="#4f46e5" />
                            {lead.owner || "Unassigned"} ✏️
                          </span>
                        </td>
                        <td>{lead.loan_type || "Personal Loan"}</td>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <strong>
                              {lead.est_budget ? `₹${numberFormatter.format(lead.est_budget)}` : "—"}
                            </strong>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditAmountModal({
                                  leadId: lead.lead_id || lead.id,
                                  application_id: lead.application_id,
                                  applicationNumber: lead.application_number || `Lead #${formatLeadCode(lead)}`,
                                  customer: { name: lead.name, mobile: lead.number },
                                  appliedAmount: lead.est_budget,
                                  loanProduct: lead.loan_type,
                                });
                              }}
                              className="cc-ops-edit-bank-btn"
                              style={{ padding: "0 4px", fontSize: 9, height: 16, lineHeight: "14px" }}
                              title="Edit Loan Budget"
                            >
                              <Pencil size={8} />
                            </button>
                          </div>
                        </td>
                        <td>
                          {lead.bank_name ? (
                            <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                                <Building2 size={14} color="#4f46e5" />
                                <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 12.5 }}>
                                  {lead.bank_name}
                                </span>
                              </div>
                              {lead.application_id && (
                                <button
                                  type="button"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    openEditBankModal({
                                      id: lead.application_id,
                                      applicationNumber: lead.application_number || `Lead #${formatLeadCode(lead)}`,
                                      customer: { name: lead.name, mobile: lead.number },
                                      lender: { name: lead.bank_name, lenderType: lead.lender_type || lead.lenderType },
                                      leadId: lead.lead_id,
                                      loanProduct: lead.loan_type,
                                    });
                                  }}
                                  className="cc-ops-edit-bank-btn"
                                  style={{ alignSelf: "flex-start", padding: "1px 6px", fontSize: 10.5 }}
                                  title="Edit assigned Bank"
                                >
                                  <Pencil size={10} /> Edit {lead.lender_type || lead.lenderType || "Bank"}
                                </button>
                              )}
                            </div>
                          ) : lead.application_id ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openEditBankModal({
                                  id: lead.application_id,
                                  applicationNumber: lead.application_number || `Lead #${formatLeadCode(lead)}`,
                                  customer: { name: lead.name, mobile: lead.number },
                                  lender: null,
                                  leadId: lead.lead_id,
                                  loanProduct: lead.loan_type,
                                });
                              }}
                              className="cc-ops-edit-bank-btn"
                              style={{ alignSelf: "flex-start", padding: "1px 6px", fontSize: 10.5 }}
                              title="Assign Bank"
                            >
                              <Building2 size={10} /> Assign Lender
                            </button>
                          ) : (
                            <span style={{ color: "#94a3b8", fontSize: 12, fontStyle: "italic" }}>
                              Not Assigned
                            </span>
                          )}
                        </td>
                        <td>
                          {renderStatusBadge(lead.status_value || lead.status)}
                        </td>
                        <td>
                          {lead.latest_remark ? (
                            <div className="cc-ops-lead-remark" title={lead.latest_remark}>
                              <div>"{lead.latest_remark}"</div>
                              <div className="cc-ops-lead-remark-meta">
                                <Clock size={10} color="#64748b" />
                                <span>{lead.latest_remark_date ? new Date(lead.latest_remark_date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true }) : "--"}</span>
                                {lead.latest_remark_by && <strong style={{ color: "#047857" }}>by {lead.latest_remark_by}</strong>}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11.5, color: "#94a3b8", fontStyle: "italic" }}>No remark</span>
                          )}
                        </td>
                        <td onClick={(e) => e.stopPropagation()} style={{ whiteSpace: "nowrap" }}>
                          <div style={{ display: "flex", flexDirection: "row", alignItems: "center", gap: 3, flexWrap: "nowrap", whiteSpace: "nowrap" }}>
                            <button
                              type="button"
                              className="cc-ops-convert-btn"
                              onClick={() => openConvertModal(lead)}
                              title="Convert to Loan Application"
                              style={{ padding: "2px 6px", fontSize: "10px", height: 20, whiteSpace: "nowrap" }}
                            >
                              <Send size={10} /> Convert
                            </button>
                            <button
                              type="button"
                              className="cc-ops-action-btn"
                              onClick={() => openReassignModal(lead)}
                              title="Reassign this lead to another staff member"
                              style={{ color: "#4f46e5", borderColor: "#c7d2fe", background: "#eef2ff", padding: "2px 5px", fontSize: "10px", height: 20, whiteSpace: "nowrap" }}
                            >
                              <UserCheck size={10} /> Reassign
                            </button>
                            <button
                              type="button"
                              className="cc-ops-action-btn"
                              onClick={() => navigate(`/lead-details/${lead.lead_id}`)}
                              title="View Lead Details"
                              style={{ padding: "2px 5px", fontSize: "10px", height: 20, whiteSpace: "nowrap" }}
                            >
                              <Eye size={10} />
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
              pageSize={pageSize}
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
                  <span
                    className={`cc-ops-status-tag ${(verificationApp.status || "").toLowerCase()}`}
                    style={{ cursor: "pointer" }}
                    onClick={() => openStageModal(verificationApp)}
                    title="Click to update workflow stage and view remarks"
                  >
                    {verificationApp.status} ✏️
                  </span>
                </div>
                <p>
                  KYC Verification &amp; Document Management Hub • Customer:{" "}
                  <strong>{verificationApp.customer?.name}</strong> ({verificationApp.customer?.mobile})
                </p>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8, marginLeft: "auto", flexWrap: "wrap" }}>
                <button
                  type="button"
                  className="cc-drawer-mail-btn"
                  onClick={() => openEditAmountModal(verificationApp)}
                  title="Edit Loan / Applied Amount"
                  style={{ background: "#ecfdf5", borderColor: "#a7f3d0", color: "#047857" }}
                >
                  <IndianRupee size={13} /> {currencyFormatter.format(verificationApp.appliedAmount || 0)} ✏️
                </button>
                <button
                  type="button"
                  className="cc-drawer-mail-btn"
                  onClick={() => openReassignModal(verificationApp)}
                  title="Reassign this lead / application to another employee"
                  style={{ background: "#f0fdf4", borderColor: "#bbf7d0", color: "#166534" }}
                >
                  <UserCheck size={13} /> {verificationApp.lead?.assignedEmployee?.name ? `Owner: ${verificationApp.lead.assignedEmployee.name.split(" ")[0]}` : "Assign Staff"} ✏️
                </button>
                <button
                  type="button"
                  className="cc-drawer-mail-btn"
                  onClick={() => openEditBankModal(verificationApp)}
                  title={`Change or update assigned ${verificationApp.lender?.lenderType || "Bank"} Institution & RM`}
                  style={{ background: "#eef2ff", borderColor: "#c7d2fe", color: "#4338ca" }}
                >
                  <Building2 size={13} /> {verificationApp.lender?.shortCode || verificationApp.lender?.name || `Assign ${verificationApp.lender?.lenderType || "Bank"}`} ✏️
                </button>
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
                  {/* Bank & Banker Partner Info Strip with Quick Edit */}
                  <div
                    style={{
                      background: "#f8fafc",
                      border: "1px solid #e2e8f0",
                      borderRadius: 10,
                      padding: "10px 14px",
                      marginBottom: 12,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                    }}
                  >
                    <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                      <div
                        style={{
                          width: 34,
                          height: 34,
                          borderRadius: 8,
                          background: "#e0e7ff",
                          color: "#4338ca",
                          display: "grid",
                          placeItems: "center",
                          border: "1px solid #c7d2fe",
                          flexShrink: 0,
                        }}
                      >
                        <Building2 size={17} />
                      </div>
                      <div>
                        <div style={{ fontSize: 13, fontWeight: 700, color: "#0f172a" }}>
                          {verificationApp.lender?.lenderType || "Bank"}: {verificationApp.lender?.name || "Unassigned"}
                          {verificationApp.lender?.shortCode ? ` (${verificationApp.lender.shortCode})` : ""}
                        </div>
                        <div style={{ fontSize: 11.5, color: "#64748b", marginTop: 2, display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                          {verificationApp.assignedBanker?.name ? (
                            <span>Banker / RM: <strong>{verificationApp.assignedBanker.name}</strong> ({verificationApp.assignedBanker.phone || verificationApp.assignedBanker.email || "RM"})</span>
                          ) : (
                            <span style={{ fontStyle: "italic" }}>No specific Banker RM assigned</span>
                          )}
                          {" • "}Product: <strong>{verificationApp.loanProduct || "Loan"}</strong>
                          {" • "}Amount: <strong style={{ color: "#047857" }}>{currencyFormatter.format(verificationApp.appliedAmount || 0)}</strong>
                          {verificationApp.sanctionedAmount ? (
                            <span style={{ color: "#0284c7" }}> • Sanctioned: <strong>{currencyFormatter.format(verificationApp.sanctionedAmount)}</strong></span>
                          ) : null}
                          <button
                            type="button"
                            onClick={() => openEditAmountModal(verificationApp)}
                            className="cc-ops-edit-bank-btn"
                            style={{ marginLeft: 4, padding: "0 5px", fontSize: 10, height: 18 }}
                            title="Edit Loan Amount"
                          >
                            <Pencil size={8} /> Edit Amount
                          </button>
                        </div>
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => openEditBankModal(verificationApp)}
                      className="cc-ops-edit-bank-btn"
                      title={`Edit / Update Assigned ${verificationApp.lender?.lenderType || "Bank"} Institution & Banker`}
                    >
                      <Pencil size={11} /> Edit {verificationApp.lender?.lenderType || "Bank"}
                    </button>
                  </div>

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

                  {/* Interactive Operations Sub-Status & Compliance Hub */}
                  <div className="cc-ops-drawer-status-grid-box">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                      <label style={{ fontSize: 13, fontWeight: 700, color: "#0f172a", display: "flex", alignItems: "center", gap: 6 }}>
                        <Layers size={15} style={{ color: "#4f46e5" }} /> Operations Sub-Status &amp; Verification Checks:
                      </label>
                      <button
                        type="button"
                        onClick={() => openHistoryModal(verificationApp)}
                        style={{
                          background: "#f1f5f9",
                          border: "1px solid #cbd5e1",
                          borderRadius: 6,
                          padding: "3px 8px",
                          fontSize: 11.5,
                          fontWeight: 600,
                          color: "#334155",
                          cursor: "pointer",
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 4,
                        }}
                      >
                        <Clock size={12} /> Audit History
                      </button>
                    </div>

                    <div className="cc-drawer-status-cards-grid">
                      {/* 0. Bank Login */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openLoginModal(verificationApp)}
                        title="Click to update Bank Login Status & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">🏦 Bank Login</span>
                          <span className={`cc-substatus-pill ${
                            (verificationApp.loginStatus || "").toUpperCase() === "COMPLETED" || verificationApp.status === "LOGGED_IN" ? "resolved" : "pending"
                          }`}>
                            <strong>{
                              (verificationApp.loginStatus || "").toUpperCase() === "COMPLETED" || verificationApp.status === "LOGGED_IN" ? "Completed ✓" : "Pending ⏳"
                            }</strong>
                          </span>
                        </div>
                        {verificationApp.loginUpdatedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.loginUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.loginRemark && (
                          <div className="cc-status-cell-remark" style={{ marginTop: 2, maxWidth: "100%" }} title={verificationApp.loginRemark}>
                            "{verificationApp.loginRemark}"
                          </div>
                        )}
                      </div>

                      {/* 1. PD Status */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openPdModal(verificationApp)}
                        title="Click to update PD Status & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">🤝 PD Status</span>
                          <span className={`cc-substatus-pill ${(verificationApp.pdStatus || "").toUpperCase() === "COMPLETED" ? "resolved" : "pending"}`}>
                            <strong>{(verificationApp.pdStatus || "").toUpperCase() === "COMPLETED" ? "Completed ✓" : "Pending ⏳"}</strong>
                          </span>
                        </div>
                        {verificationApp.pdUpdatedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.pdUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.pdRemark && (
                          <div className="cc-status-cell-remark" style={{ marginTop: 2, maxWidth: "100%" }} title={verificationApp.pdRemark}>
                            "{verificationApp.pdRemark}"
                          </div>
                        )}
                      </div>

                      {/* 2. Banker Query */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openQueryModal(verificationApp)}
                        title="Click to update Banker Query Status & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">❓ Banker Query</span>
                          <span className={`cc-substatus-pill ${
                            (verificationApp.opsQueryStatus || "").toUpperCase() === "COMPLETED" ? "resolved" :
                            (verificationApp.opsQueryStatus || "").toUpperCase() === "PENDING" ? "pending" : "not-started"
                          }`}>
                            <strong>{
                              (verificationApp.opsQueryStatus || "").toUpperCase() === "COMPLETED" ? "Completed ✓" :
                              (verificationApp.opsQueryStatus || "").toUpperCase() === "PENDING" ? "Pending ⏳" : "No Query"
                            }</strong>
                          </span>
                        </div>
                        {verificationApp.opsQueryUpdatedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.opsQueryUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.opsQueryRemark && (
                          <div className="cc-status-cell-remark" style={{ marginTop: 2, maxWidth: "100%" }} title={verificationApp.opsQueryRemark}>
                            "{verificationApp.opsQueryRemark}"
                          </div>
                        )}
                      </div>

                      {/* 3. Legal Status */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openLegalModal(verificationApp)}
                        title="Click to update Legal Status & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">⚖️ Legal</span>
                          <span className={`cc-substatus-pill ${
                            (verificationApp.legalStatus || "").toUpperCase() === "RESOLVED" ? "resolved" :
                            (verificationApp.legalStatus || "").toUpperCase() === "INITIATED" ? "initiated" :
                            (verificationApp.legalStatus || "").toUpperCase() === "REJECTED" ? "rejected" : "not-started"
                          }`}>
                            <strong>{
                              (verificationApp.legalStatus || "").toUpperCase() === "RESOLVED" ? "Resolved ✓" :
                              (verificationApp.legalStatus || "").toUpperCase() === "INITIATED" ? "Initiated ⚡" :
                              (verificationApp.legalStatus || "").toUpperCase() === "REJECTED" ? "Rejected ❌" : "Update"
                            }</strong>
                          </span>
                        </div>
                        {verificationApp.legalUpdatedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.legalUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.legalRemark && (
                          <div className="cc-status-cell-remark" style={{ marginTop: 2, maxWidth: "100%" }} title={verificationApp.legalRemark}>
                            "{verificationApp.legalRemark}"
                          </div>
                        )}
                      </div>

                      {/* 4. Technical Status */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openTechnicalModal(verificationApp)}
                        title="Click to update Technical Status & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">📐 Technical</span>
                          <span className={`cc-substatus-pill ${
                            (verificationApp.technicalStatus || "").toUpperCase() === "RESOLVED" ? "resolved" :
                            (verificationApp.technicalStatus || "").toUpperCase() === "INITIATED" ? "initiated" :
                            (verificationApp.technicalStatus || "").toUpperCase() === "REJECTED" ? "rejected" : "not-started"
                          }`}>
                            <strong>{
                              (verificationApp.technicalStatus || "").toUpperCase() === "RESOLVED" ? "Resolved ✓" :
                              (verificationApp.technicalStatus || "").toUpperCase() === "INITIATED" ? "Initiated ⚡" :
                              (verificationApp.technicalStatus || "").toUpperCase() === "REJECTED" ? "Rejected ❌" : "Update"
                            }</strong>
                          </span>
                        </div>
                        {verificationApp.technicalUpdatedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.technicalUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.technicalRemark && (
                          <div className="cc-status-cell-remark" style={{ marginTop: 2, maxWidth: "100%" }} title={verificationApp.technicalRemark}>
                            "{verificationApp.technicalRemark}"
                          </div>
                        )}
                      </div>

                      {/* 5. Bank Sanction */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openSanctionModal(verificationApp)}
                        title="Click to update Bank Sanction Status, Amount & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">📜 Bank Sanction</span>
                          <span className={`cc-substatus-pill ${
                            (verificationApp.sanctionStatus || "").toUpperCase() === "SANCTIONED" || verificationApp.status === "SANCTIONED" ? "resolved" :
                            (verificationApp.sanctionStatus || "").toUpperCase() === "REJECTED" ? "rejected" : "pending"
                          }`}>
                            <strong>{
                              (verificationApp.sanctionStatus || "").toUpperCase() === "SANCTIONED" || verificationApp.status === "SANCTIONED" ? "Sanctioned ✓" :
                              (verificationApp.sanctionStatus || "").toUpperCase() === "REJECTED" ? "Rejected ❌" : "Pending ⏳"
                            }</strong>
                          </span>
                        </div>
                        {verificationApp.sanctionedAmount ? (
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#15803d", marginTop: 2 }}>
                            {currencyFormatter.format(verificationApp.sanctionedAmount)}
                          </div>
                        ) : null}
                        {verificationApp.sanctionUpdatedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.sanctionUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.sanctionRemark && (
                          <div className="cc-status-cell-remark" style={{ marginTop: 2, maxWidth: "100%" }} title={verificationApp.sanctionRemark}>
                            "{verificationApp.sanctionRemark}"
                          </div>
                        )}
                      </div>

                      {/* 6. Intermediate Disbursement */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openDisbursementStageModal(verificationApp)}
                        title="Click to update Loan Disbursement Status, Amount, Date & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">💸 Loan Disbursement</span>
                          <span className={`cc-substatus-pill ${
                            (verificationApp.disbursementStatus || "").toUpperCase() === "DISBURSED" || (verificationApp.disbursementStatus || "").toUpperCase() === "COMPLETED" || verificationApp.status === "DISBURSEMENT" ? "resolved" :
                            (verificationApp.disbursementStatus || "").toUpperCase() === "INITIATED" ? "initiated" : "pending"
                          }`}>
                            <strong>{
                              (verificationApp.disbursementStatus || "").toUpperCase() === "DISBURSED" || (verificationApp.disbursementStatus || "").toUpperCase() === "COMPLETED" || verificationApp.status === "DISBURSEMENT" ? "Disbursed ✓" :
                              (verificationApp.disbursementStatus || "").toUpperCase() === "INITIATED" ? "Initiated ⚡" : "Pending ⏳"
                            }</strong>
                          </span>
                        </div>
                        {verificationApp.disbursedAmount ? (
                          <div style={{ fontSize: 11.5, fontWeight: 700, color: "#047857", marginTop: 2 }}>
                            {currencyFormatter.format(verificationApp.disbursedAmount)}
                          </div>
                        ) : null}
                        {verificationApp.disbursedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.disbursedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.disbursedRemark && (
                          <div
                            className="cc-status-cell-remark"
                            style={{ marginTop: 2, maxWidth: "100%", cursor: "pointer" }}
                            title={verificationApp.disbursedRemark}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemarkViewModal({
                                title: "Disbursement Remark",
                                stage: "Disbursement",
                                remark: verificationApp.disbursedRemark,
                                updatedAt: verificationApp.disbursedAt,
                                app: verificationApp,
                              });
                            }}
                          >
                            "{verificationApp.disbursedRemark}" <span style={{ color: "#2563eb", fontWeight: 700 }}>View</span>
                          </div>
                        )}
                      </div>

                      {/* 7. OTC Status */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openOtcModal(verificationApp)}
                        title="Click to update OTC Status & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">📑 OTC</span>
                          <span className={`cc-substatus-pill ${(verificationApp.otcStatus || "").toUpperCase() === "RESOLVED" ? "resolved" : "pending"}`}>
                            <strong>{(verificationApp.otcStatus || "").toUpperCase() === "RESOLVED" ? "Resolved ✓" : "Pending ⏳"}</strong>
                          </span>
                        </div>
                        {verificationApp.otcUpdatedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.otcUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.otcRemark && (
                          <div
                            className="cc-status-cell-remark"
                            style={{ marginTop: 2, maxWidth: "100%", cursor: "pointer" }}
                            title={verificationApp.otcRemark}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemarkViewModal({
                                title: "OTC Requirement Remark",
                                stage: "OTC",
                                remark: verificationApp.otcRemark,
                                updatedAt: verificationApp.otcUpdatedAt,
                                app: verificationApp,
                              });
                            }}
                          >
                            "{verificationApp.otcRemark}" <span style={{ color: "#2563eb", fontWeight: 700 }}>View</span>
                          </div>
                        )}
                      </div>

                      {/* 8. Cancel Status */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => {
                          setDisburseModalApp(verificationApp);
                          setDisburseStatusInput("CANCEL");
                        }}
                        title="Click to view or cancel disbursement"
                        style={{ borderLeftColor: verificationApp.status === "CANCELLED" || verificationApp.disbursementStatus === "CANCELLED" ? "#ef4444" : "#e2e8f0" }}
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">❌ Cancel State</span>
                          <span className={`cc-substatus-pill ${verificationApp.status === "CANCELLED" || verificationApp.disbursementStatus === "CANCELLED" ? "rejected" : "not-started"}`}>
                            <strong>{verificationApp.status === "CANCELLED" || verificationApp.disbursementStatus === "CANCELLED" ? "Cancelled ❌" : "Active Case"}</strong>
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {verificationApp.status === "CANCELLED" || verificationApp.disbursementStatus === "CANCELLED"
                            ? verificationApp.disbursedRemark || "Case Cancelled"
                            : "Click to Cancel"}
                        </div>
                      </div>

                      {/* 9. Final Disbursement */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => initiateDisburseModal(verificationApp)}
                        title="Click to manage Final Loan Disbursement"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">💰 Final Disbursement</span>
                          <span className={`cc-substatus-pill ${
                            verificationApp.status === "CANCELLED" || verificationApp.disbursementStatus === "CANCELLED" ? "rejected" :
                            (verificationApp.status || "").toUpperCase() === "DISBURSED" ? "resolved" : "pending"
                          }`}>
                            <strong>{
                              verificationApp.status === "CANCELLED" || verificationApp.disbursementStatus === "CANCELLED" ? "Cancelled ❌" :
                              (verificationApp.status || "").toUpperCase() === "DISBURSED" ? "Disbursed ✓" : "Pending"
                            }</strong>
                          </span>
                        </div>
                        {verificationApp.disbursedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.disbursedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        <div style={{ fontSize: 11, color: "#64748b", marginTop: 2 }}>
                          {verificationApp.status === "CANCELLED" || verificationApp.disbursementStatus === "CANCELLED"
                            ? verificationApp.disbursedRemark || "Disbursement Cancelled"
                            : verificationApp.disbursedAmount ? `₹${Number(verificationApp.disbursedAmount).toLocaleString("en-IN")}` : "Click to Manage"}
                        </div>
                      </div>

                      {/* 10. PDD Status */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openPddModal(verificationApp)}
                        title="Click to update PDD Status & Remark"
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title">📄 PDD</span>
                          <span className={`cc-substatus-pill ${(verificationApp.pddStatus || "").toUpperCase() === "RESOLVED" ? "resolved" : "pending"}`}>
                            <strong>{(verificationApp.pddStatus || "").toUpperCase() === "RESOLVED" ? "Resolved ✓" : "Pending ⏳"}</strong>
                          </span>
                        </div>
                        {verificationApp.pddUpdatedAt && (
                          <div className="cc-status-cell-time" style={{ marginTop: 2 }}>
                            <Clock size={10} />
                            <span>{new Date(verificationApp.pddUpdatedAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
                          </div>
                        )}
                        {verificationApp.pddRemark && (
                          <div
                            className="cc-status-cell-remark"
                            style={{ marginTop: 2, maxWidth: "100%", cursor: "pointer" }}
                            title={verificationApp.pddRemark}
                            onClick={(e) => {
                              e.stopPropagation();
                              setRemarkViewModal({
                                title: "PDD Requirement Remark",
                                stage: "PDD",
                                remark: verificationApp.pddRemark,
                                updatedAt: verificationApp.pddUpdatedAt,
                                app: verificationApp,
                              });
                            }}
                          >
                            "{verificationApp.pddRemark}" <span style={{ color: "#2563eb", fontWeight: 700 }}>View</span>
                          </div>
                        )}
                      </div>

                      {/* 11. All Process Completed Card */}
                      <div
                        className="cc-drawer-status-card"
                        onClick={() => openAllProcessCompletedModal(verificationApp)}
                        title="Click to mark All Processes Completed and sync Lead & Payout"
                        style={{ borderLeftColor: "#059669", background: "#f0fdf4" }}
                      >
                        <div className="cc-dsc-head">
                          <span className="cc-dsc-title" style={{ color: "#065f46" }}>✅ All Process Done</span>
                          <span className="cc-substatus-pill resolved">
                            <strong>Complete &amp; Payout</strong>
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#047857", marginTop: 2 }}>
                          Mark Lead Complete + Payout Record
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* KYC & Financial Documents Section */}
                  <div className="cc-ops-drawer-section">
                    <div className="cc-drawer-sec-title" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 8 }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                        <FileCheck size={17} /> Applicant KYC &amp; Verification Documents (
                        {(verificationApp.documents || []).length})
                      </div>
                      <button
                        type="button"
                        onClick={() =>
                          setOpsDocReqLead({
                            id: verificationApp.leadId || verificationApp.lead?.id,
                            customer: verificationApp.customer || verificationApp.lead?.customer,
                            loanType: verificationApp.loanProduct || verificationApp.loanType,
                            requiredAmount: verificationApp.appliedAmount || verificationApp.sanctionedAmount,
                          })
                        }
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 5,
                          fontSize: 12,
                          fontWeight: 600,
                          padding: "4px 10px",
                          borderRadius: 8,
                          background: "#eff6ff",
                          color: "#1d4ed8",
                          border: "1px solid #bfdbfe",
                          cursor: "pointer",
                        }}
                        title="Generate / Share unique upload link for customer"
                      >
                        <Link size={13} />
                        <span>Customer Doc Link</span>
                      </button>

                      {verificationApp.documents && verificationApp.documents.length > 0 && (
                        <a
                          href={`${API_URL}/documents/application/${verificationApp.id}/download-all?token=${localStorage.getItem("token") || ""}`}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 5,
                            fontSize: 12,
                            fontWeight: 600,
                            padding: "4px 10px",
                            borderRadius: 8,
                            background: "#ecfdf5",
                            color: "#047857",
                            border: "1px solid #a7f3d0",
                            textDecoration: "none",
                            cursor: "pointer",
                          }}
                          title={`Download all ${verificationApp.documents.length} documents as a single ZIP archive`}
                        >
                          <Download size={13} />
                          <span>Download All ({verificationApp.documents.length} Docs ZIP)</span>
                        </a>
                      )}
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
                                  <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                                    <strong>{doc.docType}</strong>
                                    <span className={`cc-doc-status-pill ${doc.verificationStatus?.toLowerCase()}`}>
                                      {doc.verificationStatus}
                                    </span>
                                    {doc.isCustomerUpload && (
                                      <span
                                        style={{
                                          fontSize: "10px",
                                          fontWeight: 700,
                                          padding: "1px 6px",
                                          borderRadius: 4,
                                          background: "#f3e8ff",
                                          color: "#6b21a8",
                                          border: "1px solid #d8b4fe",
                                        }}
                                      >
                                        Customer Uploaded
                                      </span>
                                    )}
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
                                  <>
                                    <a
                                      href={
                                        doc.fileUrl.startsWith("http")
                                          ? doc.fileUrl
                                          : `${API_URL.replace(/\/api\/?$/, "")}/${doc.fileUrl.replace(/^\//, "")}`
                                      }
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="cc-doc-open-btn"
                                    >
                                      <ExternalLink size={13} /> View File
                                    </a>
                                    <a
                                      href={`${API_URL}/documents/${doc.id}/download?token=${localStorage.getItem("token")}`}
                                      download={doc.fileName || `${doc.docType}.pdf`}
                                      className="cc-doc-open-btn"
                                      style={{ background: "#ecfdf5", color: "#059669", borderColor: "#a7f3d0" }}
                                      title="Download Document"
                                    >
                                      <Download size={13} /> Download
                                    </a>
                                  </>
                                )}

                                {isVerified ? (
                                  <>
                                    <span className="cc-doc-act-btn verify active" style={{ cursor: "default" }}>
                                      <CheckCircle2 size={13} /> Verified
                                    </span>
                                    <button
                                      type="button"
                                      className="cc-doc-act-btn reset"
                                      onClick={() => handleVerifyDoc(doc.id, "PENDING")}
                                      disabled={docVerifying}
                                      title="Reset status back to Pending"
                                    >
                                      <RotateCcw size={12} /> Reset
                                    </button>
                                  </>
                                ) : isRejected ? (
                                  <>
                                    <span className="cc-doc-act-btn reject active" style={{ cursor: "default" }}>
                                      <XCircle size={13} /> Rejected
                                    </span>
                                    <button
                                      type="button"
                                      className="cc-doc-act-btn reset"
                                      onClick={() => handleVerifyDoc(doc.id, "PENDING")}
                                      disabled={docVerifying}
                                      title="Reset status back to Pending"
                                    >
                                      <RotateCcw size={12} /> Reset
                                    </button>
                                  </>
                                ) : isReupload ? (
                                  <>
                                    <span className="cc-doc-act-btn reupload active" style={{ cursor: "default" }}>
                                      <RefreshCw size={13} /> Re-upload Req.
                                    </span>
                                    <button
                                      type="button"
                                      className="cc-doc-act-btn reset"
                                      onClick={() => handleVerifyDoc(doc.id, "PENDING")}
                                      disabled={docVerifying}
                                      title="Reset status back to Pending"
                                    >
                                      <RotateCcw size={12} /> Reset
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      className="cc-doc-act-btn verify"
                                      onClick={() => handleVerifyDoc(doc.id, "VERIFIED")}
                                      disabled={docVerifying}
                                      title="Approve Document"
                                    >
                                      <CheckCircle2 size={13} /> Approve
                                    </button>

                                    <button
                                      type="button"
                                      className="cc-doc-act-btn reupload"
                                      onClick={() => setDocRejectTarget({ doc, action: "REUPLOAD_REQUIRED" })}
                                      disabled={docVerifying}
                                      title="Request Re-upload"
                                    >
                                      <RefreshCw size={13} /> Re-upload
                                    </button>

                                    <button
                                      type="button"
                                      className="cc-doc-act-btn reject"
                                      onClick={() => setDocRejectTarget({ doc, action: "REJECTED" })}
                                      disabled={docVerifying}
                                      title="Reject Document"
                                    >
                                      <XCircle size={13} /> Reject
                                    </button>
                                  </>
                                )}
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
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <input
                            type="file"
                            multiple
                            accept=".pdf,.png,.jpg,.jpeg,.doc,.docx,.xls,.xlsx"
                            onChange={(e) => {
                              const files = Array.from(e.target.files || []);
                              const invalid = files.find((f) => f.size > 25 * 1024 * 1024);
                              if (invalid) {
                                toast.error(`File "${invalid.name}" exceeds 25MB limit.`);
                                e.target.value = "";
                                setUploadFiles([]);
                                setUploadFile(null);
                                return;
                              }
                              setUploadFiles(files);
                              setUploadFile(files[0] || null);
                            }}
                            required={uploadFiles.length === 0}
                          />
                          <small style={{ fontSize: 11, color: "#64748b" }}>
                            {uploadFiles.length > 0
                              ? `Selected ${uploadFiles.length} file(s) (Max 25MB each)`
                              : "Select 1 or more files (Max 25MB each)"}
                          </small>
                        </div>
                        <button type="submit" className="cc-upload-submit-btn" disabled={uploadingDoc}>
                          {uploadingDoc ? "Uploading..." : `Upload ${uploadFiles.length > 1 ? `${uploadFiles.length} Docs` : "Document"}`}
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
                              <div className="cc-qbox-ans" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                                <div>
                                  <strong>Operations Answer:</strong> {q.responseText}
                                  {q.resolvedByOps?.name && (
                                    <small> — Answered by {q.resolvedByOps.name}</small>
                                  )}
                                </div>
                                {verificationApp.customer?.mobile && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const msg = `Dear ${verificationApp.customer?.name || "Customer"}, regarding your loan application #${verificationApp.applicationNumber}: Banker query "${q.queryText}" - Response: "${q.responseText}".`;
                                      shareOnWhatsApp(verificationApp.customer?.mobile, msg);
                                    }}
                                    style={{
                                      padding: "4px 8px",
                                      borderRadius: 6,
                                      border: "1px solid #86efac",
                                      background: "#f0fdf4",
                                      color: "#166534",
                                      fontSize: 11,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 4,
                                    }}
                                    title="Share resolution on WhatsApp"
                                  >
                                    <WhatsAppIcon size={12} /> WhatsApp
                                  </button>
                                )}
                              </div>
                            ) : (
                              <div className="cc-qbox-reply-action" style={{ display: "flex", gap: 8, alignItems: "center", flexWrap: "wrap" }}>
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
                                {verificationApp.customer?.mobile && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      const msg = `Dear ${verificationApp.customer?.name || "Customer"}, regarding your loan application #${verificationApp.applicationNumber} with ${verificationApp.lender?.name || "the bank"}: Clarification requested by Banker - "${q.queryText}". Please provide the required information/documents as soon as possible.`;
                                      shareOnWhatsApp(verificationApp.customer?.mobile, msg);
                                    }}
                                    style={{
                                      padding: "6px 12px",
                                      borderRadius: 6,
                                      border: "1px solid #86efac",
                                      background: "#f0fdf4",
                                      color: "#166534",
                                      fontSize: 12,
                                      fontWeight: 600,
                                      cursor: "pointer",
                                      display: "inline-flex",
                                      alignItems: "center",
                                      gap: 5,
                                    }}
                                    title="Share query with customer on WhatsApp"
                                  >
                                    <WhatsAppIcon size={14} /> WhatsApp Customer
                                  </button>
                                )}
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
                <span>Select Loan Product / Type *</span>
                <select
                  value={convertForm.loanProduct}
                  onChange={(e) => setConvertForm({ ...convertForm, loanProduct: e.target.value })}
                  required
                >
                  <option value="">Select Loan Product</option>
                  {loanProducts.map((lp) => (
                    <option key={lp.id || lp.value} value={lp.label || lp.value}>
                      {lp.label || lp.value}
                    </option>
                  ))}
                  {convertForm.loanProduct &&
                    !loanProducts.some(
                      (lp) => (lp.label || lp.value).toLowerCase() === convertForm.loanProduct.toLowerCase()
                    ) && (
                      <option value={convertForm.loanProduct}>
                        {convertForm.loanProduct} (Current)
                      </option>
                    )}
                </select>
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

      {/* Edit Bank & Banker Partner Modal */}
      {editBankModalApp && (
        <div className="cc-modal-overlay" onClick={() => setEditBankModalApp(null)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="cc-modal-head">
              <div>
                <p>Operations / Bank Partner Assignment</p>
                <h3>Edit / Update Bank Partner</h3>
              </div>
              <button type="button" onClick={() => setEditBankModalApp(null)}>
                <X size={16} />
              </button>
            </div>

            <form className="cc-modal-form" onSubmit={handleEditBankSubmit}>
              <div
                style={{
                  background: "#eff6ff",
                  border: "1px solid #bfdbfe",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#1e40af",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div>
                  <strong>Application:</strong> {editBankModalApp.applicationNumber || `#${editBankModalApp.id}`}
                </div>
                <div>
                  <strong>Applicant:</strong> {editBankModalApp.customer?.name || editBankModalApp.customerName || "Customer"} 
                  {editBankModalApp.customer?.mobile ? ` (${editBankModalApp.customer.mobile})` : ""}
                </div>
                <div style={{ fontSize: 12, color: "#2563eb", marginTop: 2 }}>
                  Current {editBankModalApp.lender?.lenderType || "Bank"}: <strong>{editBankModalApp.lender?.name || "Unassigned"}</strong>
                </div>
              </div>

              <label className="cc-modal-field">
                <span>Select Bank / NBFC Institution (Lender) *</span>
                <select
                  value={editBankForm.lenderId}
                  onChange={(e) => setEditBankForm({ ...editBankForm, lenderId: e.target.value })}
                  required
                >
                  <option value="">Select Bank / NBFC Partner</option>
                  {lenders.map((l) => (
                    <option key={l.lender_id || l.id} value={l.lender_id || l.id}>
                      {l.name} ({l.short_code || l.shortCode || l.lenderType || "Lender"})
                    </option>
                  ))}
                </select>
              </label>

              <label className="cc-modal-field">
                <span>Assign Banker / RM Officer (Optional)</span>
                <select
                  value={editBankForm.assignedBankerId}
                  onChange={(e) => setEditBankForm({ ...editBankForm, assignedBankerId: e.target.value })}
                >
                  <option value="">Select Banker RM (Optional)</option>
                  {bankers.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.name} ({b.email || b.phone || "Banker"})
                    </option>
                  ))}
                </select>
              </label>

              <label className="cc-modal-field">
                <span>Loan Product / Type (Optional)</span>
                <select
                  value={editBankForm.loanProduct}
                  onChange={(e) => setEditBankForm({ ...editBankForm, loanProduct: e.target.value })}
                >
                  <option value="">Keep Current ({editBankModalApp.loanProduct || "Default"})</option>
                  {loanProducts.map((lp) => (
                    <option key={lp.id || lp.value} value={lp.label || lp.value}>
                      {lp.label || lp.value}
                    </option>
                  ))}
                </select>
              </label>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-btn ghost"
                  onClick={() => setEditBankModalApp(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-modal-btn primary"
                  disabled={editBankSubmitting}
                >
                  <Building2 size={15} /> {editBankSubmitting ? "Updating..." : "Update Bank"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Loan Amount Modal */}
      {editAmountModalApp && (
        <div className="cc-modal-overlay" onClick={() => !editAmountSubmitting && setEditAmountModalApp(null)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="cc-modal-head">
              <div>
                <p>Operations Financials</p>
                <h3>Edit Loan Amount</h3>
              </div>
              <button type="button" onClick={() => !editAmountSubmitting && setEditAmountModalApp(null)}>
                <X size={16} />
              </button>
            </div>

            <form className="cc-modal-form" onSubmit={handleEditAmountSubmit}>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#166534",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div>
                  <strong>Record:</strong> {editAmountModalApp.applicationNumber || `Lead #${editAmountModalApp.leadId || editAmountModalApp.id}`}
                </div>
                <div>
                  <strong>Borrower / Customer:</strong> {editAmountModalApp.customer?.name || editAmountModalApp.name || "Customer"}
                  {(editAmountModalApp.customer?.mobile || editAmountModalApp.number) ? ` (${editAmountModalApp.customer?.mobile || editAmountModalApp.number})` : ""}
                </div>
              </div>

              <label className="cc-modal-field">
                <span>Applied Loan Amount (₹) *</span>
                <input
                  type="number"
                  placeholder="e.g. 5000000"
                  value={editAmountForm.appliedAmount}
                  onChange={(e) => setEditAmountForm({ ...editAmountForm, appliedAmount: e.target.value })}
                  required
                  autoFocus
                />
                {editAmountForm.appliedAmount && !isNaN(parseFloat(editAmountForm.appliedAmount)) ? (
                  <small style={{ color: "#047857", fontWeight: 600, marginTop: 3 }}>
                    In words: {currencyFormatter.format(parseFloat(editAmountForm.appliedAmount))}
                  </small>
                ) : null}
              </label>

              {editAmountModalApp.applicationNumber && (
                <label className="cc-modal-field">
                  <span>Sanctioned Amount (₹) (Optional)</span>
                  <input
                    type="number"
                    placeholder="e.g. 4500000 (if sanctioned)"
                    value={editAmountForm.sanctionedAmount}
                    onChange={(e) => setEditAmountForm({ ...editAmountForm, sanctionedAmount: e.target.value })}
                  />
                  {editAmountForm.sanctionedAmount && !isNaN(parseFloat(editAmountForm.sanctionedAmount)) ? (
                    <small style={{ color: "#0284c7", fontWeight: 600, marginTop: 3 }}>
                      Sanctioned: {currencyFormatter.format(parseFloat(editAmountForm.sanctionedAmount))}
                    </small>
                  ) : null}
                </label>
              )}

              <label className="cc-modal-field">
                <span>Loan Product / Type (Optional)</span>
                <input
                  type="text"
                  placeholder="e.g. Home Loan, Personal Loan, LAP"
                  value={editAmountForm.loanProduct}
                  onChange={(e) => setEditAmountForm({ ...editAmountForm, loanProduct: e.target.value })}
                />
              </label>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-btn ghost"
                  onClick={() => setEditAmountModalApp(null)}
                  disabled={editAmountSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-modal-btn primary"
                  disabled={editAmountSubmitting}
                  style={{ background: "#059669", borderColor: "#059669" }}
                >
                  <IndianRupee size={15} /> {editAmountSubmitting ? "Updating..." : "Save Loan Amount"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Reassign Lead / Case Ownership Modal */}
      {reassignModalData && (
        <div className="cc-modal-overlay" onClick={() => setReassignModalData(null)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 480 }}>
            <div className="cc-modal-head">
              <div>
                <p>Staff &amp; Operations Reassignment</p>
                <h3>Reassign Lead Ownership</h3>
              </div>
              <button type="button" onClick={() => setReassignModalData(null)}>
                <X size={16} />
              </button>
            </div>

            <form className="cc-modal-form" onSubmit={handleReassignSubmit}>
              <div
                style={{
                  background: "#f0fdf4",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#166534",
                  display: "flex",
                  flexDirection: "column",
                  gap: 3,
                }}
              >
                <div>
                  <strong>Applicant:</strong> {reassignModalData.name || reassignModalData.customerName || "Customer"}
                </div>
                {reassignModalData.lead_id && (
                  <div>
                    <strong>Lead:</strong> #{formatLeadCode(reassignModalData)}
                  </div>
                )}
                {reassignModalData.applicationNumber && (
                  <div>
                    <strong>Application:</strong> {reassignModalData.applicationNumber}
                  </div>
                )}
                <div style={{ fontSize: 12, color: "#15803d", marginTop: 2 }}>
                  Current Owner: <strong>{reassignModalData.owner || reassignModalData.currentOwner || "Unassigned"}</strong>
                </div>
              </div>

              <label className="cc-modal-field">
                <span>Select New Staff / Assignee *</span>
                <select
                  value={reassignTargetUserId}
                  onChange={(e) => setReassignTargetUserId(e.target.value)}
                  required
                >
                  <option value="">-- Select Employee / Operations Staff --</option>
                  {employees
                    .filter((u) => u.status === "active" || !u.status)
                    .map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.role || "Staff"}) {emp.phone ? `• ${emp.phone}` : ""}
                      </option>
                    ))}
                </select>
              </label>

              <label className="cc-modal-field">
                <span>Reassignment Reason / Remark (Optional)</span>
                <textarea
                  rows={3}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Workload balancing, specialized lender desk, or ops file handoff"
                  style={{
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #d1d5db",
                    fontSize: 12.5,
                    resize: "vertical",
                  }}
                />
              </label>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-btn ghost"
                  onClick={() => setReassignModalData(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-modal-btn primary"
                  disabled={reassignSubmitting || !reassignTargetUserId}
                  style={{ background: "#16a34a", borderColor: "#16a34a" }}
                >
                  <UserCheck size={15} /> {reassignSubmitting ? "Reassigning..." : "Confirm Reassign"}
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
                {/* Outgoing Sender Email & SMTP Configuration Alert Banner */}
                {mailSmtpConfig?.isConfigured && mailSmtpConfig?.user ? (
                  <div style={{ background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 8, padding: "9px 13px", marginBottom: 12, display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12.5, color: "#065f46" }}>
                      <CheckCircle2 size={15} color="#059669" />
                      <span>Sending From: <strong>{mailSmtpConfig.senderName}</strong> (&lt;{mailSmtpConfig.user}&gt;)</span>
                    </div>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <span style={{ fontSize: 11, background: "#d1fae5", color: "#047857", padding: "2px 7px", borderRadius: 5, fontWeight: 700 }}>Verified SMTP</span>
                      <button
                        type="button"
                        onClick={refreshSmtpStatus}
                        title="Recheck SMTP status"
                        style={{ background: "transparent", border: "none", cursor: "pointer", color: "#047857", padding: "2px 5px" }}
                      >
                        <RefreshCw size={13} />
                      </button>
                    </div>
                  </div>
                ) : (
                  <div style={{ marginBottom: 12 }}>
                    <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "9px 13px", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div style={{ display: "flex", alignItems: "center", gap: 8, fontSize: 12, color: "#92400e" }}>
                        <AlertCircle size={15} color="#d97706" />
                        <span><strong>Sender Email Not Configured:</strong> Set your Gmail ID &amp; 16-digit App Password to dispatch emails to Bank RM.</span>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                        <button
                          type="button"
                          onClick={() => setQuickSmtpOpen((prev) => !prev)}
                          style={{ fontSize: 11, background: "#f59e0b", color: "#ffffff", border: "none", padding: "4px 10px", borderRadius: 5, fontWeight: 700, cursor: "pointer" }}
                        >
                          {quickSmtpOpen ? "Hide Quick Setup" : "⚡ Quick Setup Gmail"}
                        </button>
                        <button
                          type="button"
                          onClick={refreshSmtpStatus}
                          title="Refresh status if configured in Settings"
                          style={{ fontSize: 11, background: "#fef3c7", color: "#92400e", border: "1px solid #fde68a", padding: "4px 8px", borderRadius: 5, cursor: "pointer", display: "flex", alignItems: "center", gap: 4 }}
                        >
                          <RefreshCw size={11} /> Refresh
                        </button>
                      </div>
                    </div>

                    {/* Quick Inline SMTP Setup Box */}
                    {quickSmtpOpen && (
                      <div style={{ background: "#f8fafc", border: "1px solid #cbd5e1", borderRadius: 8, padding: "14px 16px", marginTop: 8 }}>
                        <div style={{ fontSize: 12.5, fontWeight: 700, color: "#1e293b", marginBottom: 6 }}>
                          🔑 1-Click Gmail &amp; App Password Configuration
                        </div>
                        <p style={{ fontSize: 11.5, color: "#64748b", margin: "0 0 10px 0" }}>
                          Enter your company Gmail and Google 16-digit App Password. It will be verified and saved automatically so this docket can be emailed immediately.
                        </p>
                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, marginBottom: 10 }}>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Sender Gmail Address *</label>
                            <input
                              type="email"
                              value={quickSmtpUser}
                              onChange={(e) => setQuickSmtpUser(e.target.value)}
                              placeholder="e.g. yourcompany@gmail.com"
                              style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 6 }}
                              required
                            />
                          </div>
                          <div>
                            <label style={{ fontSize: 11, fontWeight: 600, color: "#475569", display: "block", marginBottom: 4 }}>Gmail 16-Digit App Password *</label>
                            <input
                              type="password"
                              value={quickSmtpPass}
                              onChange={(e) => setQuickSmtpPass(e.target.value)}
                              placeholder="16-character Google App Password"
                              style={{ width: "100%", padding: "7px 10px", fontSize: 12, border: "1px solid #cbd5e1", borderRadius: 6 }}
                              required
                            />
                          </div>
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            Need an App Password? Generate it at <a href="https://myaccount.google.com/apppasswords" target="_blank" rel="noopener noreferrer" style={{ color: "#2563eb", textDecoration: "underline" }}>myaccount.google.com/apppasswords</a>
                          </span>
                          <div style={{ display: "flex", gap: 8 }}>
                            <button
                              type="button"
                              onClick={() => setQuickSmtpOpen(false)}
                              style={{ padding: "6px 12px", fontSize: 12, background: "#f1f5f9", border: "1px solid #cbd5e1", borderRadius: 6, cursor: "pointer", color: "#475569" }}
                            >
                              Cancel
                            </button>
                            <button
                              type="button"
                              onClick={handleQuickSmtpSave}
                              disabled={quickSmtpLoading}
                              style={{ padding: "6px 14px", fontSize: 12, background: "#059669", color: "#ffffff", border: "none", borderRadius: 6, fontWeight: 600, cursor: "pointer", display: "flex", alignItems: "center", gap: 6 }}
                            >
                              {quickSmtpLoading ? <RefreshCw className="cc-spin" size={13} /> : <Check size={13} />}
                              {quickSmtpLoading ? "Verifying & Saving..." : "Verify & Save Settings"}
                            </button>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                )}

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
                                <>
                                  <a
                                    href={
                                      doc.fileUrl.startsWith("http")
                                        ? doc.fileUrl
                                        : `${API_URL.replace(/\/api\/?$/, "")}/${doc.fileUrl.replace(/^\//, "")}`
                                    }
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="cc-mail-doc-view-btn"
                                    title="Inspect Document"
                                  >
                                    <ExternalLink size={12} />
                                  </a>
                                  <a
                                    href={`${API_URL}/documents/${doc.id}/download?token=${localStorage.getItem("token")}`}
                                    download={doc.fileName || `${doc.docType}.pdf`}
                                    className="cc-mail-doc-view-btn"
                                    title="Download Document"
                                  >
                                    <Download size={12} />
                                  </a>
                                </>
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
                      <strong>From:</strong>{" "}
                      <span>
                        {mailSmtpConfig?.senderName || "Operations Desk"} &lt;{mailSmtpConfig?.user || "operations@capitalcare.com"}&gt;
                      </span>
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

      {/* MODAL: CONFIRM LOAN DISBURSAL & FINANCIAL SYNC */}
      {disburseModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !disburseSubmitting && setDisburseModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 510, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div className="cc-disburse-header" style={{
              background: disburseStatusInput === "CANCEL"
                ? "linear-gradient(135deg, #991b1b 0%, #dc2626 100%)"
                : disburseStatusInput === "PENDING"
                ? "linear-gradient(135deg, #b45309 0%, #d97706 100%)"
                : "linear-gradient(135deg, #065f46 0%, #047857 100%)",
              flexShrink: 0,
              padding: "14px 20px"
            }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge">
                  {disburseStatusInput === "CANCEL" ? (
                    <XCircle size={20} />
                  ) : disburseStatusInput === "PENDING" ? (
                    <Clock size={20} />
                  ) : (
                    <CheckCircle2 size={20} />
                  )}
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    {disburseStatusInput === "CANCEL"
                      ? "Cancel Loan Disbursement"
                      : disburseStatusInput === "PENDING"
                      ? "Pending for Disbursement"
                      : "Confirm Final Disbursement"}
                  </h3>
                  <small style={{ color: "#f1f5f9", fontSize: 12 }}>
                    App #{disburseModalApp.applicationNumber} • {disburseModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !disburseSubmitting && setDisburseModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleConfirmDisburse} style={{ padding: "16px 20px", overflowY: "auto", flex: 1, display: "flex", flexDirection: "column" }}>
              {/* Disbursement Action Decision Selector */}
              <div style={{ marginBottom: 12 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Disbursement Decision / Option <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1fr", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setDisburseStatusInput("COMPLETED")}
                    style={{
                      padding: "8px 6px",
                      borderRadius: 9,
                      border: disburseStatusInput === "COMPLETED" ? "2px solid #047857" : "1.5px solid #cbd5e1",
                      background: disburseStatusInput === "COMPLETED" ? "#ecfdf5" : "#fff",
                      color: disburseStatusInput === "COMPLETED" ? "#047857" : "#475569",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <CheckCircle2 size={15} /> Completed
                  </button>

                  <button
                    type="button"
                    onClick={() => setDisburseStatusInput("PENDING")}
                    style={{
                      padding: "8px 6px",
                      borderRadius: 9,
                      border: disburseStatusInput === "PENDING" ? "2px solid #d97706" : "1.5px solid #cbd5e1",
                      background: disburseStatusInput === "PENDING" ? "#fffbeb" : "#fff",
                      color: disburseStatusInput === "PENDING" ? "#b45309" : "#475569",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <Clock size={15} /> Pending
                  </button>

                  <button
                    type="button"
                    onClick={() => setDisburseStatusInput("CANCEL")}
                    style={{
                      padding: "8px 6px",
                      borderRadius: 9,
                      border: disburseStatusInput === "CANCEL" ? "2px solid #ef4444" : "1.5px solid #cbd5e1",
                      background: disburseStatusInput === "CANCEL" ? "#fef2f2" : "#fff",
                      color: disburseStatusInput === "CANCEL" ? "#b91c1c" : "#475569",
                      fontWeight: 700,
                      fontSize: 12.5,
                      cursor: "pointer",
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      gap: 3,
                      transition: "all 0.15s ease",
                    }}
                  >
                    <XCircle size={15} /> Cancel
                  </button>
                </div>
              </div>

              {/* Case Summary Card */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "10px 14px", marginBottom: 12 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px 12px", fontSize: 12 }}>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Borrower</span>
                    <strong style={{ display: "block", color: "#0f172a", fontSize: 12.5, marginTop: 1 }}>{disburseModalApp.customer?.name}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Contact</span>
                    <strong style={{ display: "block", color: "#0f172a", fontSize: 12.5, marginTop: 1 }}>{disburseModalApp.customer?.mobile || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Loan Product</span>
                    <strong style={{ display: "block", color: "#0f172a", fontSize: 12.5, marginTop: 1 }}>{disburseModalApp.loanProduct}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Assigned Bank</span>
                    <strong style={{ display: "block", color: "#047857", fontSize: 12.5, marginTop: 1 }}>{disburseModalApp.lender?.name || "Direct / Bank"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Applied Amount</span>
                    <strong style={{ display: "block", color: "#0f172a", fontSize: 12.5, marginTop: 1 }}>{currencyFormatter.format(disburseModalApp.appliedAmount || 0)}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", letterSpacing: 0.5, fontWeight: 600 }}>Sanctioned Amount</span>
                    <strong style={{ display: "block", color: "#0284c7", fontSize: 12.5, marginTop: 1 }}>
                      {disburseModalApp.sanctionedAmount ? currencyFormatter.format(disburseModalApp.sanctionedAmount) : "—"}
                    </strong>
                  </div>
                </div>
              </div>

              {/* BRANCH 1: CANCEL DISBURSEMENT */}
              {disburseStatusInput === "CANCEL" && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderLeft: "4px solid #ef4444", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: "#991b1b" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <AlertCircle size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <strong>Disbursement Cancel Warning:</strong> Cancelling this disbursement means the loan will <strong>NOT</strong> proceed for disbursement. The application status will be marked as <strong>CANCELLED</strong>.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                      Cancellation Reason / Remark <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <textarea
                      rows={3}
                      required
                      value={disburseRemarksInput}
                      onChange={(e) => setDisburseRemarksInput(e.target.value)}
                      placeholder="Enter mandatory reason for cancelling disbursement (e.g. Borrower backed out, Property issue, Bank rejected disbursement)..."
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1.5px solid #ef4444",
                        fontSize: 13,
                        boxSizing: "border-box",
                        outline: "none",
                        color: "#0f172a",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* BRANCH 2: PENDING DISBURSEMENT */}
              {disburseStatusInput === "PENDING" && (
                <div style={{ marginBottom: 18 }}>
                  <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderLeft: "4px solid #d97706", borderRadius: 8, padding: "12px 14px", marginBottom: 16, fontSize: 12.5, color: "#92400e" }}>
                    <div style={{ display: "flex", gap: 8, alignItems: "flex-start" }}>
                      <Clock size={16} style={{ flexShrink: 0, marginTop: 1 }} />
                      <div>
                        <strong>Pending for Disbursement:</strong> Application will remain pending while awaiting PDD/OTC clearance or bank clearing schedule.
                      </div>
                    </div>
                  </div>

                  <div>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                      Pending Remarks / Notes <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={disburseRemarksInput}
                      onChange={(e) => setDisburseRemarksInput(e.target.value)}
                      placeholder="e.g. Awaiting banker final docket clearance, OTC documents in transit"
                      style={{
                        width: "100%",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 13,
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  </div>
                </div>
              )}

              {/* BRANCH 3: COMPLETED DISBURSEMENT */}
              {disburseStatusInput === "COMPLETED" && (
                <>
                  {/* PDD & OTC Requirements Gatekeeping Check */}
                  {(() => {
                    const isPddOk = (disburseModalApp.pddStatus || "").toUpperCase() === "RESOLVED";
                    const isOtcOk = (disburseModalApp.otcStatus || "").toUpperCase() === "RESOLVED";

                    return (
                      <div style={{
                        marginBottom: 12,
                        padding: "10px 14px",
                        borderRadius: 10,
                        background: "#ecfdf5",
                        border: "1px solid #a7f3d0"
                      }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                          <span style={{ fontSize: 11.5, fontWeight: 700, color: "#065f46", textTransform: "uppercase", letterSpacing: 0.5 }}>
                            Disbursement Status Check
                          </span>
                          <span style={{
                            fontSize: 10.5,
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: 12,
                            background: "#059669",
                            color: "#fff"
                          }}>
                            ✓ Ready for Final Disbursal
                          </span>
                        </div>

                        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 8, fontSize: 11.5 }}>
                          <div style={{
                            padding: "6px 9px",
                            borderRadius: 7,
                            background: isOtcOk ? "#d1fae5" : "#fef3c7",
                            border: isOtcOk ? "1px solid #6ee7b7" : "1px solid #fde68a",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between"
                          }}>
                            <span><strong>OTC:</strong> {disburseModalApp.otcStatus || "Pending"}</span>
                            <span>{isOtcOk ? "✓ Resolved" : "⏳ Pending"}</span>
                          </div>
                          <div style={{
                            padding: "6px 9px",
                            borderRadius: 7,
                            background: isPddOk ? "#d1fae5" : "#eff6ff",
                            border: isPddOk ? "1px solid #6ee7b7" : "1px solid #bfdbfe",
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between"
                          }}>
                            <span><strong>PDD (Post-Disb.):</strong> {disburseModalApp.pddStatus || "Pending"}</span>
                            <span>{isPddOk ? "✓ Collected" : "📄 Post Disb."}</span>
                          </div>
                        </div>

                        <p style={{ margin: "6px 0 0 0", fontSize: 11, color: "#047857", lineHeight: 1.35 }}>
                          ℹ️ <strong>PDD Unblocked:</strong> Post-Disbursement Documents are collected after disbursement. Final disbursement can be executed immediately.
                        </p>
                      </div>
                    );
                  })()}

                  {/* Disbursed Amount Input */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 5 }}>
                      Final Disbursed Amount (₹) <span style={{ color: "#ef4444" }}>*</span>
                    </label>
                    <div style={{ position: "relative" }}>
                      <IndianRupee size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                      <input
                        type="number"
                        step="1"
                        min="1"
                        required
                        value={disburseAmountInput}
                        onChange={(e) => setDisburseAmountInput(e.target.value)}
                        placeholder="e.g. 5000000"
                        style={{
                          width: "100%",
                          padding: "9px 12px 9px 36px",
                          borderRadius: 8,
                          border: "1.5px solid #cbd5e1",
                          fontSize: 15,
                          fontWeight: 700,
                          color: "#047857",
                          background: "#fff",
                          boxSizing: "border-box",
                          outline: "none",
                        }}
                        onFocus={(e) => (e.target.style.borderColor = "#047857")}
                        onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                      />
                    </div>
                    {disburseAmountInput && !isNaN(parseFloat(disburseAmountInput)) && (
                      <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#047857", fontWeight: 700, fontSize: 12, marginTop: 4 }}>
                        <CheckCircle2 size={12} />
                        <span>Amount: {currencyFormatter.format(parseFloat(disburseAmountInput))}</span>
                      </div>
                    )}
                  </div>

                  {/* Disbursal Remarks */}
                  <div style={{ marginBottom: 12 }}>
                    <label style={{ display: "block", fontWeight: 600, fontSize: 12.5, color: "#334155", marginBottom: 5 }}>
                      Remarks / UTR / Reference <span style={{ color: "#64748b", fontWeight: 400, fontSize: 11.5 }}>(Optional)</span>
                    </label>
                    <input
                      type="text"
                      value={disburseRemarksInput}
                      onChange={(e) => setDisburseRemarksInput(e.target.value)}
                      placeholder="e.g. Disbursal confirmed, UTR #..., Banker approval"
                      style={{
                        width: "100%",
                        padding: "8px 12px",
                        borderRadius: 8,
                        border: "1px solid #cbd5e1",
                        fontSize: 12.5,
                        color: "#0f172a",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                      onFocus={(e) => (e.target.style.borderColor = "#64748b")}
                      onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                    />
                  </div>

                  {/* Notice Alert */}
                  <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderLeft: "4px solid #047857", borderRadius: 8, padding: "9px 12px", marginBottom: 14, fontSize: 11.5, color: "#334155", display: "flex", gap: 8, alignItems: "flex-start" }}>
                    <CheckCircle2 size={15} style={{ flexShrink: 0, marginTop: 1, color: "#047857" }} />
                    <div style={{ lineHeight: 1.4 }}>
                      <strong>Direct Payout Sync:</strong> Marking this application as <strong>Disbursed</strong> will automatically update the linked lead status to <strong>DISBURSED</strong> and generate the case payout &amp; invoice record in <strong>Case Payouts</strong>.
                    </div>
                  </div>
                </>
              )}

              {/* Modal Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginTop: "auto", borderTop: "1px solid #f1f5f9", paddingTop: 12, gap: 10 }}>
                {disburseModalApp.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const msg = `Dear ${disburseModalApp.customer?.name || "Customer"}, your loan application #${disburseModalApp.applicationNumber} with ${disburseModalApp.lender?.name || "the bank"} is approved for disbursement. Disbursed Amount: ${currencyFormatter.format(parseFloat(disburseAmountInput) || disburseModalApp.sanctionedAmount || disburseModalApp.appliedAmount || 0)}.`;
                      shareOnWhatsApp(disburseModalApp.customer?.mobile, msg);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Share disbursement update on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> WhatsApp Update
                  </button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={disburseSubmitting}
                    onClick={() => setDisburseModalApp(null)}
                    style={{
                      padding: "8px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={disburseSubmitting}
                    style={{
                      padding: "10px 22px",
                      borderRadius: 9,
                      border: "none",
                      background:
                        disburseStatusInput === "CANCEL"
                          ? "#dc2626"
                          : disburseStatusInput === "PENDING"
                          ? "#d97706"
                          : "#047857",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 8,
                      boxShadow:
                        disburseStatusInput === "CANCEL"
                          ? "0 2px 6px rgba(220, 38, 38, 0.35)"
                          : disburseStatusInput === "PENDING"
                          ? "0 2px 6px rgba(217, 119, 6, 0.35)"
                          : "0 2px 6px rgba(4, 120, 87, 0.35)",
                    }}
                  >
                    {disburseSubmitting ? (
                      <>
                        <RefreshCw size={14} className="cc-spin" /> Processing...
                      </>
                    ) : disburseStatusInput === "CANCEL" ? (
                      <>
                        <XCircle size={16} /> Confirm Cancellation
                      </>
                    ) : disburseStatusInput === "PENDING" ? (
                      <>
                        <Clock size={16} /> Save Pending Status
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Confirm &amp; Disburse
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BANK LOGIN STATUS */}
      {loginModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !loginSubmitting && setLoginModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #0284c7 0%, #0369a1 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  🏦
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Bank Login Status
                  </h3>
                  <small style={{ color: "#e0f2fe", fontSize: 12 }}>
                    App #{loginModalApp.applicationNumber} • {loginModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !loginSubmitting && setLoginModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLoginSubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current Login Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: (loginModalApp.loginStatus || "").toUpperCase() === "COMPLETED" || loginModalApp.status === "LOGGED_IN" ? "#d1fae5" : "#fef3c7",
                    color: (loginModalApp.loginStatus || "").toUpperCase() === "COMPLETED" || loginModalApp.status === "LOGGED_IN" ? "#047857" : "#b45309",
                  }}>
                    {(loginModalApp.loginStatus || "").toUpperCase() === "COMPLETED" || loginModalApp.status === "LOGGED_IN" ? "COMPLETED" : "PENDING"}
                  </strong>
                </div>
                {loginModalApp.loginRemark && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark:</strong> "{loginModalApp.loginRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update Login Status <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Select option)</span>
                </label>
                <select
                  value={loginStatusInput}
                  onChange={(e) => setLoginStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="PENDING">Pending (Bank Login in Progress / Docket Under Review)</option>
                  <option value="COMPLETED">Completed (File Logged in Bank Portal / LAN Generated)</option>
                </select>
              </div>

              {/* Remark */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                  Login Remark / Reference / LAN Number <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={loginRemarkInput}
                  onChange={(e) => setLoginRemarkInput(e.target.value)}
                  placeholder="e.g. Logged in HDFC LOS, Application LAN #678912"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  disabled={loginSubmitting}
                  onClick={() => setLoginModalApp(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={loginSubmitting}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#0284c7",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {loginSubmitting ? (
                    <>
                      <RefreshCw size={13} className="cc-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Save Login Status
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BANK SANCTION STATUS */}
      {sanctionModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !sanctionSubmitting && setSanctionModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #15803d 0%, #16a34a 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  📜
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Bank Sanction Status
                  </h3>
                  <small style={{ color: "#dcfce7", fontSize: 12 }}>
                    App #{sanctionModalApp.applicationNumber} • {sanctionModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !sanctionSubmitting && setSanctionModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSanctionSubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: (sanctionModalApp.sanctionStatus || "").toUpperCase() === "SANCTIONED" || sanctionModalApp.status === "SANCTIONED" ? "#d1fae5" : (sanctionModalApp.sanctionStatus || "").toUpperCase() === "REJECTED" ? "#fee2e2" : "#fef3c7",
                    color: (sanctionModalApp.sanctionStatus || "").toUpperCase() === "SANCTIONED" || sanctionModalApp.status === "SANCTIONED" ? "#047857" : (sanctionModalApp.sanctionStatus || "").toUpperCase() === "REJECTED" ? "#b91c1c" : "#b45309",
                  }}>
                    {(sanctionModalApp.sanctionStatus || "").toUpperCase() === "SANCTIONED" || sanctionModalApp.status === "SANCTIONED" ? "SANCTIONED" : (sanctionModalApp.sanctionStatus || "").toUpperCase() === "REJECTED" ? "REJECTED" : "PENDING"}
                  </strong>
                </div>
                {sanctionModalApp.sanctionedAmount && (
                  <div style={{ marginTop: 6, fontSize: 12.5, color: "#15803d", fontWeight: 700 }}>
                    Sanctioned Amount: {currencyFormatter.format(sanctionModalApp.sanctionedAmount)}
                  </div>
                )}
                {sanctionModalApp.sanctionRemark && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark:</strong> "{sanctionModalApp.sanctionRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update Sanction Decision <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Select option)</span>
                </label>
                <select
                  value={sanctionStatusInput}
                  onChange={(e) => setSanctionStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="PENDING">Pending (Bank Credit Assessment in Progress)</option>
                  <option value="SANCTIONED">Sanctioned (Sanction Letter Issued / Credit Approved)</option>
                  <option value="REJECTED">Rejected (Sanction Declined by Credit Committee)</option>
                </select>
              </div>

              {/* Sanctioned Amount (when SANCTIONED) */}
              {sanctionStatusInput === "SANCTIONED" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                    Sanctioned Amount (₹) <span style={{ color: "#ef4444" }}>*</span>
                  </label>
                  <div style={{ position: "relative" }}>
                    <IndianRupee size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                    <input
                      type="number"
                      step="1"
                      min="1"
                      required
                      value={sanctionAmountInput}
                      onChange={(e) => setSanctionAmountInput(e.target.value)}
                      placeholder="e.g. 5000000"
                      style={{
                        width: "100%",
                        padding: "10px 14px 10px 36px",
                        borderRadius: 8,
                        border: "1.5px solid #cbd5e1",
                        fontSize: 15,
                        fontWeight: 700,
                        color: "#15803d",
                        boxSizing: "border-box",
                        outline: "none",
                      }}
                    />
                  </div>
                  {sanctionAmountInput && !isNaN(parseFloat(sanctionAmountInput)) && (
                    <div style={{ color: "#15803d", fontSize: 12, fontWeight: 700, marginTop: 4 }}>
                      Amount: {currencyFormatter.format(parseFloat(sanctionAmountInput))}
                    </div>
                  )}
                </div>
              )}

              {/* Remark */}
              <div style={{ marginBottom: 18 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 13, color: "#334155", marginBottom: 6 }}>
                  Sanction Remark / Letter Reference <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <input
                  type="text"
                  value={sanctionRemarkInput}
                  onChange={(e) => setSanctionRemarkInput(e.target.value)}
                  placeholder="e.g. Sanctioned at 8.75% ROI, Letter Ref #12345"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  disabled={sanctionSubmitting}
                  onClick={() => setSanctionModalApp(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={sanctionSubmitting}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: sanctionStatusInput === "REJECTED" ? "#dc2626" : "#15803d",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {sanctionSubmitting ? (
                    <>
                      <RefreshCw size={13} className="cc-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Save Sanction Status
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INTERMEDIATE LOAN DISBURSEMENT STATUS */}
      {disbursementStageModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !disbursementStageSubmitting && setDisbursementStageModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, maxHeight: "88vh", display: "flex", flexDirection: "column" }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #0d9488 0%, #0f766e 100%)", flexShrink: 0 }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  💸
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Loan Disbursement Status
                  </h3>
                  <small style={{ color: "#ccfbf1", fontSize: 12 }}>
                    App #{disbursementStageModalApp.applicationNumber} • {disbursementStageModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !disbursementStageSubmitting && setDisbursementStageModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleDisbursementStageSubmit} style={{ padding: "18px 22px", overflowY: "auto", flex: 1 }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: (disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "DISBURSED" || (disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "COMPLETED" || disbursementStageModalApp.status === "DISBURSEMENT" ? "#ccfbf1" : (disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "INITIATED" ? "#e0e7ff" : "#fef3c7",
                    color: (disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "DISBURSED" || (disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "COMPLETED" || disbursementStageModalApp.status === "DISBURSEMENT" ? "#0f766e" : (disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "INITIATED" ? "#4338ca" : "#b45309",
                  }}>
                    {(disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "DISBURSED" || (disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "COMPLETED" || disbursementStageModalApp.status === "DISBURSEMENT" ? "DISBURSED" : (disbursementStageModalApp.disbursementStatus || "").toUpperCase() === "INITIATED" ? "INITIATED" : "PENDING"}
                  </strong>
                </div>
                {disbursementStageModalApp.sanctionedAmount && (
                  <div style={{ marginTop: 6, fontSize: 12, color: "#64748b" }}>
                    Sanctioned Amount: <strong style={{ color: "#15803d" }}>{currencyFormatter.format(disbursementStageModalApp.sanctionedAmount)}</strong>
                  </div>
                )}
                {disbursementStageModalApp.disbursedAmount && (
                  <div style={{ marginTop: 4, fontSize: 12.5, color: "#0d9488", fontWeight: 700 }}>
                    Disbursed Amount: {currencyFormatter.format(disbursementStageModalApp.disbursedAmount)}
                  </div>
                )}
                {disbursementStageModalApp.disbursedRemark && (
                  <div style={{ marginTop: 6, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark:</strong> "{disbursementStageModalApp.disbursedRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update Disbursement Decision <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={disbursementStageStatusInput}
                  onChange={(e) => setDisbursementStageStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="PENDING">Pending (Awaiting Bank Disbursal)</option>
                  <option value="INITIATED">Initiated (Disbursal Docket Submitted to Bank)</option>
                  <option value="DISBURSED">Disbursed (Loan Amount Disbursed / UTR Generated)</option>
                </select>
              </div>

              {/* Disbursed Amount */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Disbursed Amount (₹) {disbursementStageStatusInput === "DISBURSED" && <span style={{ color: "#ef4444" }}>*</span>}
                </label>
                <div style={{ position: "relative" }}>
                  <IndianRupee size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required={disbursementStageStatusInput === "DISBURSED"}
                    value={disbursementStageAmountInput}
                    onChange={(e) => setDisbursementStageAmountInput(e.target.value)}
                    placeholder="e.g. 5000000"
                    style={{
                      width: "100%",
                      padding: "10px 14px 10px 36px",
                      borderRadius: 8,
                      border: "1.5px solid #cbd5e1",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#0f766e",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                  />
                </div>
                {disbursementStageAmountInput && !isNaN(parseFloat(disbursementStageAmountInput)) && (
                  <div style={{ marginTop: 4, fontSize: 12, color: "#0d9488", fontWeight: 600 }}>
                    Formatted: {currencyFormatter.format(parseFloat(disbursementStageAmountInput))}
                  </div>
                )}
              </div>

              {/* Disbursement Date */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Disbursement Date
                </label>
                <input
                  type="date"
                  value={disbursementStageDateInput}
                  onChange={(e) => setDisbursementStageDateInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              {/* UTR / Remarks */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  UTR / Reference / Remark <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <textarea
                  rows={2}
                  value={disbursementStageRemarkInput}
                  onChange={(e) => setDisbursementStageRemarkInput(e.target.value)}
                  placeholder="e.g. UTR #HDFC12345678, Initial tranche disbursed"
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                    outline: "none",
                  }}
                />
              </div>

              <div style={{ background: "#f0fdfa", border: "1px solid #99f6e4", borderRadius: 8, padding: "10px 12px", marginBottom: 16, fontSize: 11.5, color: "#0f766e", lineHeight: 1.4 }}>
                ℹ️ Recording this disbursement allows your operations team to track and resolve <strong>PDD (Post-Disbursement Documents)</strong> and <strong>OTC</strong> clearance before the final case closure.
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10, borderTop: "1px solid #f1f5f9", paddingTop: 12 }}>
                <button
                  type="button"
                  disabled={disbursementStageSubmitting}
                  onClick={() => setDisbursementStageModalApp(null)}
                  style={{
                    padding: "8px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={disbursementStageSubmitting}
                  style={{
                    padding: "8px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#0d9488",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {disbursementStageSubmitting ? (
                    <>
                      <RefreshCw size={13} className="cc-spin" /> Saving...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Save Disbursement
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PD STATUS */}
      {pdModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !pdSubmitting && setPdModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #5b21b6 0%, #7c3aed 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  🤝
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    PD Status (Personal Discussion)
                  </h3>
                  <small style={{ color: "#ede9fe", fontSize: 12 }}>
                    App #{pdModalApp.applicationNumber} • {pdModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !pdSubmitting && setPdModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePdSubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current PD Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: pdModalApp.pdStatus === "COMPLETED" ? "#d1fae5" : "#fef3c7",
                    color: pdModalApp.pdStatus === "COMPLETED" ? "#047857" : "#b45309",
                  }}>
                    {pdModalApp.pdStatus === "COMPLETED" ? "COMPLETED" : "PENDING"}
                  </strong>
                </div>
                {pdModalApp.pdRemark && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark:</strong> "{pdModalApp.pdRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update PD Status <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Select option)</span>
                </label>
                <select
                  value={pdStatusInput}
                  onChange={(e) => setPdStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="PENDING">Pending (Personal Discussion Scheduled / Awaited)</option>
                  <option value="COMPLETED">Completed (Personal Discussion Verified Successfully)</option>
                </select>
              </div>

              {/* Remark */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Remark / Discussion Notes <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={pdRemarkInput}
                  onChange={(e) => setPdRemarkInput(e.target.value)}
                  placeholder="e.g. Customer PD completed at residence / business verified successfully"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Meta Info */}
              <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 11.5, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                <span><strong>Updated By:</strong> {localStorage.getItem("name") || "Operations User"}</span>
                <span><strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  disabled={pdSubmitting}
                  onClick={() => setPdModalApp(null)}
                  style={{
                    padding: "9px 16px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#f8fafc",
                    color: "#475569",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={pdSubmitting}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "none",
                    background: "#7c3aed",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "inline-flex",
                    alignItems: "center",
                    gap: 6,
                  }}
                >
                  {pdSubmitting ? <RefreshCw size={14} className="cc-spin" /> : <CheckCircle2 size={14} />} Save PD Status
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: BANKER QUERY STATUS */}
      {queryModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !querySubmitting && setQueryModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #b45309 0%, #d97706 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  ❓
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Banker Query Status
                  </h3>
                  <small style={{ color: "#fef3c7", fontSize: 12 }}>
                    App #{queryModalApp.applicationNumber} • {queryModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !querySubmitting && setQueryModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleQuerySubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current Query Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: queryModalApp.opsQueryStatus === "COMPLETED" ? "#d1fae5" : queryModalApp.opsQueryStatus === "PENDING" ? "#fee2e2" : "#f1f5f9",
                    color: queryModalApp.opsQueryStatus === "COMPLETED" ? "#047857" : queryModalApp.opsQueryStatus === "PENDING" ? "#b91c1c" : "#475569",
                  }}>
                    {queryModalApp.opsQueryStatus || "NO QUERY"}
                  </strong>
                </div>
                {queryModalApp.opsQueryRemark && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark / Query:</strong> "{queryModalApp.opsQueryRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update Banker Query Status <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Select option)</span>
                </label>
                <select
                  value={queryStatusInput}
                  onChange={(e) => setQueryStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="PENDING">Pending (Banker Query Raised / Awaiting Resolution)</option>
                  <option value="COMPLETED">Completed (Query Resolved &amp; Clarification Provided)</option>
                </select>
              </div>

              {/* Remark */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Query Details / Resolution Remark <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={queryRemarkInput}
                  onChange={(e) => setQueryRemarkInput(e.target.value)}
                  placeholder="e.g. Additional ITR submitted / Query replied to credit officer"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Meta Info */}
              <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 11.5, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                <span><strong>Updated By:</strong> {localStorage.getItem("name") || "Operations User"}</span>
                <span><strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {queryModalApp.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const text = queryRemarkInput.trim() || queryModalApp.opsQueryRemark || "Clarification required on your loan application.";
                      const msg = `Dear ${queryModalApp.customer?.name || "Customer"}, regarding your loan application #${queryModalApp.applicationNumber} with ${queryModalApp.lender?.name || "the bank"}: Banker Query - "${text}". Please provide the necessary details.`;
                      shareOnWhatsApp(queryModalApp.customer?.mobile, msg);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Share query with customer on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> WhatsApp Query
                  </button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={querySubmitting}
                    onClick={() => setQueryModalApp(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={querySubmitting}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#d97706",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {querySubmitting ? <RefreshCw size={14} className="cc-spin" /> : <CheckCircle2 size={14} />} Save Query Status
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LEGAL STATUS */}
      {legalModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !legalSubmitting && setLegalModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #1e3a8a 0%, #3b82f6 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  ⚖️
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Legal Status
                  </h3>
                  <small style={{ color: "#e0e7ff", fontSize: 12 }}>
                    App #{legalModalApp.applicationNumber} • {legalModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !legalSubmitting && setLegalModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleLegalSubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current Legal Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: legalModalApp.legalStatus === "RESOLVED" ? "#d1fae5" : legalModalApp.legalStatus === "INITIATED" ? "#dbeafe" : legalModalApp.legalStatus === "REJECTED" ? "#fee2e2" : "#f1f5f9",
                    color: legalModalApp.legalStatus === "RESOLVED" ? "#047857" : legalModalApp.legalStatus === "INITIATED" ? "#1e40af" : legalModalApp.legalStatus === "REJECTED" ? "#b91c1c" : "#475569",
                  }}>
                    {legalModalApp.legalStatus || "NOT STARTED"}
                  </strong>
                </div>
                {legalModalApp.legalRemark && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark:</strong> "{legalModalApp.legalRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update Legal Status <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={legalStatusInput}
                  onChange={(e) => setLegalStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="INITIATED">Initiated (Verification Started / Pending)</option>
                  <option value="RESOLVED">Resolved (Completed Successfully)</option>
                  <option value="REJECTED">Rejected (Legal Criteria Not Met)</option>
                </select>
              </div>

              {/* Remark */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Remark / Notes <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={legalRemarkInput}
                  onChange={(e) => setLegalRemarkInput(e.target.value)}
                  placeholder="e.g. Property verification initiated / Title search completed successfully"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Meta Info */}
              <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 11.5, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                <span><strong>Updated By:</strong> {localStorage.getItem("name") || "Operations User"}</span>
                <span><strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {legalModalApp.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const text = legalRemarkInput.trim() || legalModalApp.legalRemark || legalStatusInput;
                      const msg = `Dear ${legalModalApp.customer?.name || "Customer"}, regarding your loan application #${legalModalApp.applicationNumber} with ${legalModalApp.lender?.name || "the bank"}: Legal verification update - "${text}".`;
                      shareOnWhatsApp(legalModalApp.customer?.mobile, msg);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Share legal update with customer on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> WhatsApp Legal
                  </button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={legalSubmitting}
                    onClick={() => setLegalModalApp(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={legalSubmitting}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#2563eb",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {legalSubmitting ? <RefreshCw size={14} className="cc-spin" /> : <CheckCircle2 size={14} />} Save Legal Status
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: TECHNICAL STATUS */}
      {technicalModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !technicalSubmitting && setTechnicalModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #0e7490 0%, #06b6d4 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  📐
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Technical Status
                  </h3>
                  <small style={{ color: "#ecfeff", fontSize: 12 }}>
                    App #{technicalModalApp.applicationNumber} • {technicalModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !technicalSubmitting && setTechnicalModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleTechnicalSubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current Technical Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: technicalModalApp.technicalStatus === "RESOLVED" ? "#d1fae5" : technicalModalApp.technicalStatus === "INITIATED" ? "#e0f2fe" : technicalModalApp.technicalStatus === "REJECTED" ? "#fee2e2" : "#f1f5f9",
                    color: technicalModalApp.technicalStatus === "RESOLVED" ? "#047857" : technicalModalApp.technicalStatus === "INITIATED" ? "#0369a1" : technicalModalApp.technicalStatus === "REJECTED" ? "#b91c1c" : "#475569",
                  }}>
                    {technicalModalApp.technicalStatus || "NOT STARTED"}
                  </strong>
                </div>
                {technicalModalApp.technicalRemark && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark:</strong> "{technicalModalApp.technicalRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update Technical Status <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={technicalStatusInput}
                  onChange={(e) => setTechnicalStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="INITIATED">Initiated (Inspection Scheduled / In Progress)</option>
                  <option value="RESOLVED">Resolved (Technical Verification Completed)</option>
                  <option value="REJECTED">Rejected (Property Criteria Not Met)</option>
                </select>
              </div>

              {/* Remark */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Remark / Notes <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={technicalRemarkInput}
                  onChange={(e) => setTechnicalRemarkInput(e.target.value)}
                  placeholder="e.g. Valuation done at 45L / Site visit verified successfully"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Meta Info */}
              <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 11.5, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                <span><strong>Updated By:</strong> {localStorage.getItem("name") || "Operations User"}</span>
                <span><strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {technicalModalApp.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const text = techRemarkInput.trim() || technicalModalApp.technicalRemark || techStatusInput;
                      const msg = `Dear ${technicalModalApp.customer?.name || "Customer"}, regarding your loan application #${technicalModalApp.applicationNumber} with ${technicalModalApp.lender?.name || "the bank"}: Technical verification update - "${text}".`;
                      shareOnWhatsApp(technicalModalApp.customer?.mobile, msg);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Share technical update with customer on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> WhatsApp Technical
                  </button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={technicalSubmitting}
                    onClick={() => setTechnicalModalApp(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={technicalSubmitting}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#0891b2",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {technicalSubmitting ? <RefreshCw size={14} className="cc-spin" /> : <CheckCircle2 size={14} />} Save Technical Status
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: PDD STATUS */}
      {pddModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !pddSubmitting && setPddModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #7c3aed 0%, #8b5cf6 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  📄
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    PDD Status (Post-Disbursement Documents)
                  </h3>
                  <small style={{ color: "#ede9fe", fontSize: 12 }}>
                    App #{pddModalApp.applicationNumber} • {pddModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !pddSubmitting && setPddModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePddSubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current PDD Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: pddModalApp.pddStatus === "RESOLVED" ? "#d1fae5" : "#fef3c7",
                    color: pddModalApp.pddStatus === "RESOLVED" ? "#047857" : "#b45309",
                  }}>
                    {pddModalApp.pddStatus === "RESOLVED" ? "RESOLVED" : "PENDING"}
                  </strong>
                </div>
                {pddModalApp.pddRemark && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark:</strong> "{pddModalApp.pddRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update PDD Status <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={pddStatusInput}
                  onChange={(e) => setPddStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="PENDING">Pending (PDD Documents Awaited)</option>
                  <option value="RESOLVED">Resolved (PDD Documents Verified Successfully)</option>
                </select>
              </div>

              {/* Remark */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  PDD Remark / Notes <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={pddRemarkInput}
                  onChange={(e) => setPddRemarkInput(e.target.value)}
                  placeholder="e.g. Original RC / Property Title / PDD documents collected and verified"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Meta Info */}
              <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 11.5, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                <span><strong>Updated By:</strong> {localStorage.getItem("name") || "Operations User"}</span>
                <span><strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {pddModalApp.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const text = pddRemarkInput.trim() || pddModalApp.pddRemark || pddStatusInput;
                      const msg = `Dear ${pddModalApp.customer?.name || "Customer"}, regarding your loan application #${pddModalApp.applicationNumber} with ${pddModalApp.lender?.name || "the bank"}: Post-Disbursement Document (PDD) update - "${text}".`;
                      shareOnWhatsApp(pddModalApp.customer?.mobile, msg);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Share PDD update with customer on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> WhatsApp PDD
                  </button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={pddSubmitting}
                    onClick={() => setPddModalApp(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={pddSubmitting}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#7c3aed",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {pddSubmitting ? <RefreshCw size={14} className="cc-spin" /> : <CheckCircle2 size={14} />} Save PDD Status
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: OTC STATUS */}
      {otcModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !otcSubmitting && setOtcModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #d97706 0%, #f59e0b 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  📑
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    OTC Status (One-Time Clearance)
                  </h3>
                  <small style={{ color: "#fef3c7", fontSize: 12 }}>
                    App #{otcModalApp.applicationNumber} • {otcModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !otcSubmitting && setOtcModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleOtcSubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current OTC Status:</span>
                  <strong style={{
                    padding: "3px 10px",
                    borderRadius: 12,
                    fontSize: 12,
                    background: otcModalApp.otcStatus === "RESOLVED" ? "#d1fae5" : "#fef3c7",
                    color: otcModalApp.otcStatus === "RESOLVED" ? "#047857" : "#b45309",
                  }}>
                    {otcModalApp.otcStatus === "RESOLVED" ? "RESOLVED" : "PENDING"}
                  </strong>
                </div>
                {otcModalApp.otcRemark && (
                  <div style={{ marginTop: 8, fontSize: 11.5, color: "#475569", borderTop: "1px dashed #cbd5e1", paddingTop: 6 }}>
                    <strong>Last Remark:</strong> "{otcModalApp.otcRemark}"
                  </div>
                )}
              </div>

              {/* Status Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Update OTC Status <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={otcStatusInput}
                  onChange={(e) => setOtcStatusInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="PENDING">Pending (OTC Confirmation Awaited)</option>
                  <option value="RESOLVED">Resolved (OTC Successfully Completed)</option>
                </select>
              </div>

              {/* Remark */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  OTC Remark / Notes <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={otcRemarkInput}
                  onChange={(e) => setOtcRemarkInput(e.target.value)}
                  placeholder="e.g. OTC approval received from credit manager"
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Meta Info */}
              <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", marginBottom: 20, fontSize: 11.5, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                <span><strong>Updated By:</strong> {localStorage.getItem("name") || "Operations User"}</span>
                <span><strong>Date:</strong> {new Date().toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true })}</span>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {otcModalApp.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const text = otcRemarkInput.trim() || otcModalApp.otcRemark || otcStatusInput;
                      const msg = `Dear ${otcModalApp.customer?.name || "Customer"}, regarding your loan application #${otcModalApp.applicationNumber} with ${otcModalApp.lender?.name || "the bank"}: One-Time Clearance (OTC) update - "${text}".`;
                      shareOnWhatsApp(otcModalApp.customer?.mobile, msg);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Share OTC update with customer on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> WhatsApp OTC
                  </button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={otcSubmitting}
                    onClick={() => setOtcModalApp(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={otcSubmitting}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#d97706",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {otcSubmitting ? <RefreshCw size={14} className="cc-spin" /> : <CheckCircle2 size={14} />} Save OTC Status
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: GENERAL WORKFLOW STAGE TRANSITION */}
      {stageModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !stageSubmitting && setStageModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="cc-disburse-header">
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "#4f46e5" }}>
                  <Layers size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Update Workflow Stage
                  </h3>
                  <small style={{ color: "#94a3b8", fontSize: 12 }}>
                    App #{stageModalApp.applicationNumber} • {stageModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !stageSubmitting && setStageModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleStageSubmit} style={{ padding: "20px 24px" }}>
              {/* Current Status Box */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "12px 14px", marginBottom: 16 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", fontSize: 12 }}>
                  <span style={{ color: "#64748b" }}>Current Status:</span>
                  <strong style={{ color: "#0f172a", fontSize: 13 }}>
                    {stageModalApp.status}
                  </strong>
                </div>
              </div>

              {/* Target Stage Select */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Select New Stage <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <select
                  value={stageTargetInput}
                  onChange={(e) => setStageTargetInput(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1.5px solid #cbd5e1",
                    fontSize: 14,
                    fontWeight: 600,
                    color: "#0f172a",
                    background: "#fff",
                    outline: "none",
                  }}
                >
                  <option value="DOCS_PENDING">1. Documents Pending</option>
                  <option value="READY_TO_SEND">2. Ready to Send</option>
                  <option value="SUBMITTED_TO_BANK">3. Submitted to Bank</option>
                  <option value="LOGIN">4. Bank Login</option>
                  <option value="PD">5. PD Status</option>
                  <option value="QUERY">6. Banker Query</option>
                  <option value="LEGAL">7. Legal</option>
                  <option value="TECHNICAL">8. Technical</option>
                  <option value="SANCTIONED">9. Sanctioned</option>
                  <option value="DISBURSEMENT">10. Intermediate Disbursement</option>
                  <option value="OTC">11. OTC (Pending / Resolved)</option>
                  <option value="CANCELLED">12. Cancel (Cancelled)</option>
                  <option value="DISBURSED">13. Final Disbursed</option>
                  <option value="PDD">14. PDD (Post-Disb. Documents)</option>
                  <option value="ALL_PROCESS_COMPLETED">15. All Process Completed</option>
                  <option value="REJECTED">❌ Rejected</option>
                </select>
              </div>

              {stageTargetInput === "SANCTIONED" && (
                <div style={{ marginBottom: 16 }}>
                  <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                    Sanctioned Amount (₹)
                  </label>
                  <input
                    type="number"
                    value={stageSanctionedAmtInput}
                    onChange={(e) => setStageSanctionedAmtInput(e.target.value)}
                    placeholder="e.g. 2500000"
                    style={{
                      width: "100%",
                      padding: "9px 12px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      fontSize: 13,
                      boxSizing: "border-box",
                    }}
                  />
                </div>
              )}

              {stageTargetInput === "DISBURSED" && (
                <div style={{
                  marginBottom: 16,
                  padding: "10px 14px",
                  borderRadius: 8,
                  background: "#ecfdf5",
                  border: "1px solid #6ee7b7",
                  fontSize: 12,
                  color: "#065f46",
                }}>
                  <span>✓ <strong>Ready for Disbursal:</strong> PDD is collected post-disbursement. You may transition this application to Disbursed.</span>
                </div>
              )}

              {/* Remark */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Stage Remark <span style={{ color: "#64748b", fontWeight: 400, fontSize: 12 }}>(Optional)</span>
                </label>
                <textarea
                  rows={3}
                  value={stageRemarkInput}
                  onChange={(e) => setStageRemarkInput(e.target.value)}
                  placeholder="Enter a remark explaining this workflow update (optional)..."
                  style={{
                    width: "100%",
                    padding: "10px 14px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical",
                  }}
                />
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10 }}>
                {stageModalApp.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const text = stageRemarkInput.trim() || `Workflow stage updated to ${stageTargetInput.replace(/_/g, " ")}`;
                      const msg = `Dear ${stageModalApp.customer?.name || "Customer"}, regarding your loan application #${stageModalApp.applicationNumber} with ${stageModalApp.lender?.name || "the bank"}: ${text}.`;
                      shareOnWhatsApp(stageModalApp.customer?.mobile, msg);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Share stage update with customer on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> WhatsApp
                  </button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={stageSubmitting}
                    onClick={() => setStageModalApp(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={stageSubmitting}
                    style={{
                      padding: "9px 20px",
                      borderRadius: 8,
                      border: "none",
                      background: "#4f46e5",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {stageSubmitting ? <RefreshCw size={14} className="cc-spin" /> : <CheckCircle2 size={14} />} Update Stage
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: STATUS HISTORY / AUDIT TIMELINE */}
      {historyModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => setHistoryModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 640, maxHeight: "85vh", display: "flex", flexDirection: "column" }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #1e293b 0%, #334155 100%)", flexShrink: 0 }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.15)" }}>
                  <Clock size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Status History &amp; Audit Trail
                  </h3>
                  <small style={{ color: "#cbd5e1", fontSize: 12 }}>
                    App #{historyModalApp.applicationNumber} • {historyModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => setHistoryModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px", overflowY: "auto", flex: 1 }}>
              {historyLoading ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#64748b" }}>
                  <RefreshCw size={24} className="cc-spin" style={{ marginBottom: 10 }} />
                  <p style={{ margin: 0, fontSize: 13 }}>Loading audit timeline...</p>
                </div>
              ) : historyTimeline.length === 0 ? (
                <div style={{ textAlign: "center", padding: "40px 0", color: "#94a3b8" }}>
                  <Clock size={32} style={{ marginBottom: 8, opacity: 0.5 }} />
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 500 }}>No status history logged yet.</p>
                  <small style={{ fontSize: 11.5, color: "#94a3b8" }}>Status updates and operational remarks will be tracked here in real-time.</small>
                </div>
              ) : (
                <div className="cc-history-timeline-list">
                  {historyTimeline.map((item, idx) => (
                    <div key={item.id || idx} className="cc-history-timeline-item">
                      <div className="cc-timeline-dot" />
                      <div className="cc-timeline-card">
                        <div className="cc-timeline-card-header">
                          <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                            <span className={`cc-timeline-type-badge ${(item.status_type || "").toLowerCase()}`}>
                              {item.status_type || "STAGE"}
                            </span>
                            <strong style={{ fontSize: 13, color: "#0f172a" }}>
                              {item.old_status && item.old_status !== item.new_status
                                ? `${item.old_status.replace(/_/g, " ")} → ${item.new_status.replace(/_/g, " ")}`
                                : item.new_status?.replace(/_/g, " ") || "Status Updated"}
                            </strong>
                          </div>
                          <span className="cc-timeline-time">
                            {new Date(item.createdAt).toLocaleDateString("en-IN", {
                              day: "2-digit",
                              month: "short",
                              year: "numeric",
                              hour: "2-digit",
                              minute: "2-digit",
                              hour12: true,
                            })}
                          </span>
                        </div>

                        {item.remark && (
                          <div className="cc-timeline-remark">
                            "{item.remark}"
                          </div>
                        )}

                        <div className="cc-timeline-footer">
                          <span>
                            Updated by: <strong>{item.updater?.name || item.updaterName || (item.updated_by ? `User #${item.updated_by}` : "Operations Team")}</strong>
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div style={{ padding: "12px 24px", borderTop: "1px solid #e2e8f0", background: "#f8fafc", display: "flex", justifyContent: "flex-end", flexShrink: 0 }}>
              <button
                type="button"
                onClick={() => setHistoryModalApp(null)}
                style={{
                  padding: "8px 18px",
                  borderRadius: 8,
                  border: "1px solid #cbd5e1",
                  background: "#fff",
                  color: "#334155",
                  fontSize: 13,
                  fontWeight: 600,
                  cursor: "pointer",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: CUSTOMER DOCUMENT REQUEST LINK (OPS) */}
      <LeadDocumentRequestModal
        isOpen={Boolean(opsDocReqLead)}
        onClose={() => setOpsDocReqLead(null)}
        lead={opsDocReqLead}
        onSuccess={() => {
          if (verificationApp?.id) openVerificationDrawer(verificationApp);
        }}
      />

      {/* MODAL: REMARK FULL VIEW POPUP & WHATSAPP SHARE */}
      {remarkViewModal && (
        <div className="cc-disburse-backdrop" onClick={() => setRemarkViewModal(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 520, borderRadius: 14 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #0f172a 0%, #1e293b 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.15)" }}>
                  <FileText size={18} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    {remarkViewModal.title || "Stage Remark Details"}
                  </h3>
                  <small style={{ color: "#94a3b8", fontSize: 12 }}>
                    Stage: <strong style={{ color: "#38bdf8" }}>{remarkViewModal.stage || "Operations"}</strong>
                    {remarkViewModal.app?.applicationNumber && ` • App #${remarkViewModal.app.applicationNumber}`}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => setRemarkViewModal(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px 24px" }}>
              {/* Application Details Summary */}
              {remarkViewModal.app && (
                <div style={{
                  background: "#f8fafc",
                  border: "1px solid #e2e8f0",
                  borderRadius: 10,
                  padding: "10px 14px",
                  marginBottom: 16,
                  display: "grid",
                  gridTemplateColumns: "1fr 1fr",
                  gap: 8,
                  fontSize: 12
                }}>
                  <div>
                    <span style={{ color: "#64748b" }}>Borrower:</span>{" "}
                    <strong style={{ color: "#0f172a" }}>{remarkViewModal.app.customer?.name || "Customer"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Mobile:</span>{" "}
                    <strong style={{ color: "#0f172a" }}>{remarkViewModal.app.customer?.mobile || "—"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Lender / Bank:</span>{" "}
                    <strong style={{ color: "#047857" }}>{remarkViewModal.app.lender?.name || "Bank / Lender"}</strong>
                  </div>
                  <div>
                    <span style={{ color: "#64748b" }}>Product:</span>{" "}
                    <strong style={{ color: "#0f172a" }}>{remarkViewModal.app.loanProduct || "Loan"}</strong>
                  </div>
                </div>
              )}

              {/* Full Remark Content */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 6 }}>
                  Full Remark / Notes / Query Reason
                </label>
                <div style={{
                  background: "#fff",
                  border: "1.5px solid #cbd5e1",
                  borderRadius: 10,
                  padding: "14px 16px",
                  fontSize: 13.5,
                  lineHeight: 1.6,
                  color: "#0f172a",
                  minHeight: 100,
                  maxHeight: 280,
                  overflowY: "auto",
                  whiteSpace: "pre-wrap",
                  wordBreak: "break-word",
                  fontFamily: "inherit"
                }}>
                  {remarkViewModal.remark ? (
                    remarkViewModal.remark
                  ) : (
                    <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No remark provided for this stage.</span>
                  )}
                </div>
              </div>

              {/* Timestamp Info */}
              {remarkViewModal.updatedAt && (
                <div style={{ background: "#f1f5f9", borderRadius: 8, padding: "8px 12px", marginBottom: 18, fontSize: 11.5, color: "#64748b", display: "flex", justifyContent: "space-between" }}>
                  <span><strong>Last Updated:</strong> {new Date(remarkViewModal.updatedAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}</span>
                  {remarkViewModal.app?.lead?.assignedEmployee?.name && (
                    <span><strong>Staff:</strong> {remarkViewModal.app.lead.assignedEmployee.name}</span>
                  )}
                </div>
              )}

              {/* Actions Footer */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                {remarkViewModal.app?.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const app = remarkViewModal.app;
                      const msg = `Dear ${app.customer?.name || "Customer"}, regarding your loan application #${app.applicationNumber} with ${app.lender?.name || "the bank"}: ${remarkViewModal.stage ? `[${remarkViewModal.stage}] ` : ""}${remarkViewModal.remark || "Please reach out to our team."}`;
                      shareOnWhatsApp(app.customer.mobile, msg);
                    }}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      boxShadow: "0 1px 3px rgba(22, 101, 52, 0.1)"
                    }}
                    title="Share this remark directly on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> Share on WhatsApp
                  </button>
                ) : <div />}

                <button
                  type="button"
                  onClick={() => setRemarkViewModal(null)}
                  style={{
                    padding: "9px 20px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    background: "#0f172a",
                    color: "#fff",
                    fontSize: 13,
                    fontWeight: 600,
                    cursor: "pointer",
                  }}
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: ALL PROCESS COMPLETED */}
      {allProcessModalApp && (
        <div className="cc-disburse-backdrop" onClick={() => !allProcessSubmitting && setAllProcessModalApp(null)}>
          <div className="cc-disburse-dialog" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="cc-disburse-header" style={{ background: "linear-gradient(135deg, #059669 0%, #047857 100%)" }}>
              <div className="cc-disburse-title-wrap">
                <div className="cc-disburse-icon-badge" style={{ background: "rgba(255, 255, 255, 0.2)" }}>
                  <CheckCircle2 size={20} />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: "#fff" }}>
                    Complete All Process &amp; Sync Payout
                  </h3>
                  <small style={{ color: "#d1fae5", fontSize: 12 }}>
                    App #{allProcessModalApp.applicationNumber} • {allProcessModalApp.customer?.name}
                  </small>
                </div>
              </div>
              <button
                type="button"
                className="cc-disburse-close-btn"
                onClick={() => !allProcessSubmitting && setAllProcessModalApp(null)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAllProcessCompletedSubmit} style={{ padding: "20px 24px" }}>
              {/* App Summary */}
              <div style={{
                background: "#f0fdf4",
                border: "1px solid #bbf7d0",
                borderRadius: 10,
                padding: "12px 14px",
                marginBottom: 16,
                display: "grid",
                gridTemplateColumns: "1fr 1fr",
                gap: 8,
                fontSize: 12
              }}>
                <div>
                  <span style={{ color: "#166534" }}>Borrower:</span>{" "}
                  <strong style={{ color: "#0f172a" }}>{allProcessModalApp.customer?.name}</strong>
                </div>
                <div>
                  <span style={{ color: "#166534" }}>Mobile:</span>{" "}
                  <strong style={{ color: "#0f172a" }}>{allProcessModalApp.customer?.mobile || "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#166534" }}>Bank / Lender:</span>{" "}
                  <strong style={{ color: "#047857" }}>{allProcessModalApp.lender?.name || "Direct / Bank"}</strong>
                </div>
                <div>
                  <span style={{ color: "#166534" }}>Product:</span>{" "}
                  <strong style={{ color: "#0f172a" }}>{allProcessModalApp.loanProduct || "Loan"}</strong>
                </div>
                <div>
                  <span style={{ color: "#166534" }}>Sanctioned:</span>{" "}
                  <strong style={{ color: "#0f172a" }}>{allProcessModalApp.sanctionedAmount ? currencyFormatter.format(allProcessModalApp.sanctionedAmount) : "—"}</strong>
                </div>
                <div>
                  <span style={{ color: "#166534" }}>Applied:</span>{" "}
                  <strong style={{ color: "#0f172a" }}>{currencyFormatter.format(allProcessModalApp.appliedAmount || 0)}</strong>
                </div>
              </div>

              {/* Completion Disbursed Amount */}
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontWeight: 700, fontSize: 13, color: "#0f172a", marginBottom: 5 }}>
                  Final Disbursed Amount (₹) <span style={{ color: "#ef4444" }}>*</span>
                </label>
                <div style={{ position: "relative" }}>
                  <IndianRupee size={16} style={{ position: "absolute", left: 12, top: "50%", transform: "translateY(-50%)", color: "#64748b" }} />
                  <input
                    type="number"
                    step="1"
                    min="1"
                    required
                    value={allProcessAmountInput}
                    onChange={(e) => setAllProcessAmountInput(e.target.value)}
                    placeholder="e.g. 5000000"
                    style={{
                      width: "100%",
                      padding: "9px 12px 9px 36px",
                      borderRadius: 8,
                      border: "1.5px solid #cbd5e1",
                      fontSize: 15,
                      fontWeight: 700,
                      color: "#047857",
                      background: "#fff",
                      boxSizing: "border-box",
                      outline: "none",
                    }}
                    onFocus={(e) => (e.target.style.borderColor = "#047857")}
                    onBlur={(e) => (e.target.style.borderColor = "#cbd5e1")}
                  />
                </div>
                {allProcessAmountInput && !isNaN(parseFloat(allProcessAmountInput)) && (
                  <div style={{ display: "flex", alignItems: "center", gap: 6, color: "#047857", fontWeight: 700, fontSize: 12, marginTop: 4 }}>
                    <CheckCircle2 size={12} />
                    <span>Formatted: {currencyFormatter.format(parseFloat(allProcessAmountInput))}</span>
                  </div>
                )}
              </div>

              {/* Remarks */}
              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontWeight: 600, fontSize: 12.5, color: "#334155", marginBottom: 5 }}>
                  Completion Remarks / Notes
                </label>
                <textarea
                  rows={2}
                  value={allProcessRemarkInput}
                  onChange={(e) => setAllProcessRemarkInput(e.target.value)}
                  placeholder="e.g. All operations stages, OTC &amp; PDD completed. Payout calculation synced."
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                    color: "#0f172a",
                    boxSizing: "border-box",
                    outline: "none",
                    resize: "vertical"
                  }}
                />
              </div>

              {/* What will happen note */}
              <div style={{
                background: "#ecfdf5",
                border: "1px solid #a7f3d0",
                borderRadius: 8,
                padding: "10px 14px",
                marginBottom: 16,
                fontSize: 11.5,
                color: "#065f46",
                lineHeight: 1.45
              }}>
                <div style={{ fontWeight: 700, marginBottom: 3, display: "flex", alignItems: "center", gap: 6 }}>
                  <CheckCircle2 size={14} color="#059669" /> Automatic Synchronizations:
                </div>
                <ul style={{ margin: 0, paddingLeft: 18 }}>
                  <li>Application marked as <strong>DISBURSED (COMPLETED)</strong></li>
                  <li>Linked Lead status updated to <strong>COMPLETED</strong></li>
                  <li>PDD &amp; OTC marked as <strong>RESOLVED</strong></li>
                  <li>Payout commission record automatically created / synced in <strong>Case Payouts</strong></li>
                </ul>
              </div>

              {/* Actions */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", borderTop: "1px solid #f1f5f9", paddingTop: 14 }}>
                {allProcessModalApp.customer?.mobile ? (
                  <button
                    type="button"
                    onClick={() => {
                      const amt = parseFloat(allProcessAmountInput) || allProcessModalApp.sanctionedAmount || allProcessModalApp.appliedAmount || 0;
                      const msg = `Dear ${allProcessModalApp.customer?.name || "Customer"}, your loan application #${allProcessModalApp.applicationNumber} with ${allProcessModalApp.lender?.name || "the bank"} has completed all processes successfully. Disbursed Amount: ${currencyFormatter.format(amt)}. Thank you!`;
                      shareOnWhatsApp(allProcessModalApp.customer?.mobile, msg);
                    }}
                    style={{
                      padding: "8px 14px",
                      borderRadius: 8,
                      border: "1px solid #86efac",
                      background: "#f0fdf4",
                      color: "#166534",
                      fontSize: 12.5,
                      fontWeight: 600,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                    title="Share completion update on WhatsApp"
                  >
                    <WhatsAppIcon size={16} /> WhatsApp
                  </button>
                ) : <div />}

                <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                  <button
                    type="button"
                    disabled={allProcessSubmitting}
                    onClick={() => setAllProcessModalApp(null)}
                    style={{
                      padding: "9px 16px",
                      borderRadius: 8,
                      border: "1px solid #cbd5e1",
                      background: "#f8fafc",
                      color: "#475569",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={allProcessSubmitting}
                    style={{
                      padding: "9px 22px",
                      borderRadius: 8,
                      border: "none",
                      background: "#059669",
                      color: "#fff",
                      fontSize: 13,
                      fontWeight: 700,
                      cursor: "pointer",
                      display: "inline-flex",
                      alignItems: "center",
                      gap: 7,
                      boxShadow: "0 2px 6px rgba(5, 150, 105, 0.35)",
                    }}
                  >
                    {allProcessSubmitting ? (
                      <>
                        <RefreshCw size={14} className="cc-spin" /> Processing...
                      </>
                    ) : (
                      <>
                        <CheckCircle2 size={16} /> Confirm All Completed
                      </>
                    )}
                  </button>
                </div>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const opsStyles = `
  /* Disburse Modal Backdrop & Dialog (Clean Grey Frosted Background) */
  .cc-disburse-backdrop {
    position: fixed;
    inset: 0;
    z-index: 99999;
    display: flex;
    justify-content: center;
    align-items: center;
    background: rgba(15, 23, 42, 0.75);
    backdrop-filter: blur(6px);
    -webkit-backdrop-filter: blur(6px);
    padding: 16px;
    overflow-y: auto;
    animation: ccDisburseFadeIn 0.2s ease-out;
  }
  @keyframes ccDisburseFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }
  .cc-disburse-dialog {
    background: #ffffff;
    max-width: 520px;
    width: 100%;
    max-height: 88vh;
    display: flex;
    flex-direction: column;
    border-radius: 16px;
    box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5), 0 0 0 1px rgba(226, 232, 240, 0.8);
    overflow: hidden;
    animation: ccDisbursePopIn 0.25s cubic-bezier(0.16, 1, 0.3, 1);
  }
  @keyframes ccDisbursePopIn {
    from { transform: scale(0.95) translateY(10px); opacity: 0; }
    to { transform: scale(1) translateY(0); opacity: 1; }
  }
  .cc-disburse-header {
    background: #0f172a;
    color: #ffffff;
    padding: 18px 22px;
    display: flex;
    align-items: center;
    justify-content: space-between;
    border-bottom: 1px solid #1e293b;
  }
  .cc-disburse-title-wrap {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cc-disburse-icon-badge {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: rgba(16, 185, 129, 0.15);
    border: 1px solid rgba(16, 185, 129, 0.3);
    display: flex;
    align-items: center;
    justify-content: center;
    color: #10b981;
    flex-shrink: 0;
  }
  .cc-disburse-close-btn {
    background: transparent;
    border: 0;
    color: #94a3b8;
    cursor: pointer;
    padding: 4px;
    border-radius: 6px;
    display: flex;
    align-items: center;
    justify-content: center;
    transition: color 0.15s ease, background 0.15s ease;
  }
  .cc-disburse-close-btn:hover {
    color: #ffffff;
    background: #334155;
  }

  /* Disburse Action Button */
  .cc-ops-action-btn.cc-btn-disburse {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
    font-weight: 600;
  }
  .cc-ops-action-btn.cc-btn-disburse:hover {
    background: #047857;
    color: #ffffff;
    border-color: #047857;
  }

  /* Disburse Modal */
  .cc-disburse-modal {
    max-width: 540px;
    width: 100%;
    border-radius: 14px;
    overflow: hidden;
  }

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
  .cc-ops-page-size-control { gap: 6px; color: #64748b; font-size: 12px; font-weight: 600; white-space: nowrap; }
  .cc-ops-page-size-control .cc-ops-select { height: 34px; padding: 0 8px; }
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
  .cc-ops-table-container,
  .cc-report-table-scroll.cc-ops-table-container {
    overflow-x: auto !important;
    overflow-y: auto !important;
    max-height: calc(100vh - 190px) !important;
    min-height: 400px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #ffffff;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
    position: relative;
    width: 100%;
  }
  .cc-ops-table-container::-webkit-scrollbar {
    width: 6px;
    height: 6px;
  }
  .cc-ops-table-container::-webkit-scrollbar-track {
    background: #f1f5f9;
    border-radius: 4px;
  }
  .cc-ops-table-container::-webkit-scrollbar-thumb {
    background: #cbd5e1;
    border-radius: 4px;
  }
  .cc-ops-table-container::-webkit-scrollbar-thumb:hover {
    background: #94a3b8;
  }
  .cc-ops-table-container table {
    width: 100%;
    min-width: 1100px;
    border-collapse: separate;
    border-spacing: 0;
    border: none;
  }
  .cc-ops-table-container thead {
    position: sticky;
    top: 0;
    z-index: 20;
  }
  .cc-ops-table-container thead th {
    position: sticky;
    top: 0;
    z-index: 20;
    background: #f1f5f9 !important;
    color: #334155;
    font-size: 10px !important;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.04em;
    padding: 6px 8px !important;
    border-bottom: 2px solid #cbd5e1;
    border-right: 1px solid #e2e8f0;
    white-space: nowrap;
    box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04);
  }
  .cc-ops-table-container thead th:last-child {
    border-right: none;
  }
  .cc-ops-table-container tbody td {
    padding: 3px 6px !important;
    font-size: 11px !important;
    height: 36px !important;
    line-height: 1.2;
    color: #1e293b;
    border-bottom: 1px solid #e2e8f0;
    border-right: 1px solid #edf2f7;
    background: #ffffff;
    vertical-align: middle !important;
    transition: background-color 0.12s ease;
  }
  .cc-ops-table-container tbody td:last-child {
    border-right: none;
  }
  .cc-ops-table-container tbody tr:nth-child(even) td {
    background: #fafbfc;
  }
  .cc-ops-table-container tbody tr:hover td {
    background: #f0fdf4 !important;
  }
  /* Compact loan pipeline rows. Shared report-table rules use !important padding. */
  .cc-ops-pipeline-table-container thead th { padding: 6px 7px !important; font-size: 10px !important; }
  .cc-ops-pipeline-table-container tbody td {
    padding: 4px 6px !important;
    font-size: 11px !important;
    line-height: 1.15;
  }
  .cc-ops-pipeline-table-container tbody td:first-child > small {
    display: inline !important;
    margin-left: 4px;
    font-size: 9px !important;
  }
  .cc-ops-pipeline-table-container tbody td:first-child > div:nth-of-type(1) {
    display: flex;
    align-items: center;
    gap: 4px;
    margin-top: 0 !important;
    white-space: nowrap;
  }
  .cc-ops-pipeline-table-container tbody td:first-child > div:nth-of-type(1) small {
    display: inline !important;
    font-size: 9px !important;
  }
  .cc-ops-pipeline-table-container tbody td:first-child > div:nth-of-type(1) strong { font-size: 11px !important; }
  .cc-ops-pipeline-table-container tbody td:first-child > div:nth-of-type(2) {
    margin-top: 1px !important;
    font-size: 10px !important;
    white-space: nowrap;
  }
  .cc-ops-pipeline-table-container tbody td:first-child > div:nth-of-type(2) small {
    display: inline !important;
    margin-left: 3px;
    font-size: 9px !important;
  }
  .cc-ops-pipeline-table-container tbody td:first-child > div:nth-of-type(3) { margin-top: 2px !important; gap: 2px !important; }
  .cc-ops-pipeline-table-container tbody td:first-child .cc-ops-source-tag,
  .cc-ops-pipeline-table-container tbody td:first-child .cc-ops-dsa-tag {
    padding: 1px 4px;
    font-size: 9px;
  }
  .cc-ops-pipeline-table-container tbody td:nth-child(2) > div:first-child { margin-bottom: 1px !important; gap: 4px !important; }
  .cc-ops-pipeline-table-container tbody td:nth-child(2) > div:first-child > div:first-child { width: 20px !important; height: 20px !important; }
  .cc-ops-pipeline-table-container tbody td:nth-child(2) > div:first-child strong { display: inline !important; font-size: 10px !important; }
  .cc-ops-pipeline-table-container tbody td:nth-child(2) > div:first-child span { display: inline !important; margin-left: 3px; font-size: 9px !important; }
  .cc-ops-pipeline-table-container tbody td:nth-child(2) .cc-ops-badge { padding: 1px 4px !important; margin-bottom: 1px !important; font-size: 9px !important; }
  .cc-ops-pipeline-table-container tbody td:nth-child(2) > div:last-child { margin-top: 2px !important; gap: 3px !important; }
  .cc-ops-pipeline-table-container tbody td:nth-child(2) .cc-ops-edit-bank-btn { padding: 2px 5px !important; font-size: 9px !important; }
  .cc-ops-pipeline-table-container .cc-ops-status-cell-inner { gap: 2px; }
  .cc-ops-pipeline-table-container .cc-ops-clickable-status-td { padding: 4px 5px !important; vertical-align: middle; }
  .cc-ops-pipeline-table-container .cc-substatus-pill { padding: 2px 5px; font-size: 9px; gap: 2px; }
  .cc-ops-pipeline-table-container .cc-status-cell-time { display: none !important; }
  .cc-ops-pipeline-table-container .cc-status-cell-remark-wrap { margin-top: 0 !important; gap: 2px !important; padding: 0 !important; border: 0 !important; background: transparent !important; }
  .cc-ops-pipeline-table-container .cc-status-cell-remark { padding: 1px 3px; font-size: 9px !important; line-height: 1.1; max-width: 105px; }
  .cc-ops-pipeline-table-container .cc-stage-stuck-notice {
    display: block;
    max-width: 125px;
    margin-top: 2px;
    padding: 2px 4px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 9px;
    line-height: 1.1;
  }
  /* Keep the incoming leads queue dense enough to scan several records at once. */
  .cc-ops-screen { gap: 8px; }
  .cc-ops-leads-table-container { max-height: calc(100vh - 175px); min-height: 360px; }
  .cc-ops-leads-table-container thead th { padding: 5px 7px !important; font-size: 10px !important; }
  .cc-ops-leads-table-container tbody td {
    height: 34px;
    padding: 3px 6px !important;
    font-size: 11px !important;
    line-height: 1.15;
    white-space: nowrap;
  }
  .cc-ops-leads-table-container tbody td:nth-child(9) { white-space: normal; }
  .cc-ops-leads-table-container .cc-ops-action-btn,
  .cc-ops-leads-table-container .cc-ops-convert-btn { padding: 4px 7px; gap: 3px; font-size: 10.5px; }
  .cc-ops-lead-remark {
    max-width: 220px;
    padding: 3px 6px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
  }
  .cc-ops-lead-remark > div:first-child {
    max-width: 205px;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-size: 11px;
    line-height: 1.15;
    color: #1e293b;
    font-weight: 500;
  }
  .cc-ops-lead-remark-meta {
    display: flex;
    align-items: center;
    gap: 3px;
    margin-top: 1px;
    overflow: hidden;
    white-space: nowrap;
    font-size: 9px;
    line-height: 1.1;
    color: #64748b;
  }
  .cc-ops-lead-remark-meta strong { overflow: hidden; text-overflow: ellipsis; }
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

  .cc-ops-edit-bank-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    background: #eff6ff;
    color: #2563eb;
    border: 1px solid #bfdbfe;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .cc-ops-edit-bank-btn:hover {
    background: #2563eb;
    color: #ffffff;
    border-color: #2563eb;
  }

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
    gap: 3px;
    padding: 2px 5px !important;
    border-radius: 5px !important;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #047857;
    font-size: 10px !important;
    font-weight: 600;
    height: 20px !important;
    line-height: 1 !important;
    cursor: pointer;
    white-space: nowrap !important;
    flex-shrink: 0;
  }
  .cc-ops-action-btn:hover { background: #047857; color: #fff; border-color: #047857; }

  /* Leads queue */
  .cc-ops-leads-topbar { display: flex; justify-content: space-between; align-items: center; margin-bottom: 14px; gap: 12px; flex-wrap: wrap; }
  .cc-leads-hint { display: inline-flex; align-items: center; gap: 6px; font-size: 12.5px; color: #64748b; margin: 0; }
  .cc-ops-owner-tag { display: inline-flex; padding: 2px 8px; border-radius: 999px; background: #f1f5f9; font-size: 11.5px; font-weight: 600; color: #475569; }
  .cc-ops-convert-btn {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 2px 6px !important;
    border-radius: 5px !important;
    background: #047857;
    color: #fff;
    border: 0;
    font-size: 10px !important;
    font-weight: 600;
    height: 20px !important;
    line-height: 1 !important;
    cursor: pointer;
    white-space: nowrap !important;
    flex-shrink: 0;
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
  .cc-doc-act-btn.reupload.active { background: #b45309; color: #fff; }
  .cc-doc-act-btn.reject { background: #fef2f2; color: #b91c1c; border-color: #fecaca; }
  .cc-doc-act-btn.reject.active { background: #b91c1c; color: #fff; }
  .cc-doc-act-btn.reset { background: #f8fafc; color: #64748b; border-color: #cbd5e1; }
  .cc-doc-act-btn.reset:hover { background: #f1f5f9; color: #1e293b; border-color: #94a3b8; }

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

  /* =========================================================
     OPERATIONS ENHANCEMENTS: MULTI-SELECT FILTERS & WORKFLOW
     ========================================================= */

  /* Multi-Select Dropdown Container */
  .cc-ops-multiselect {
    position: relative;
    display: inline-block;
  }
  .cc-ops-multiselect-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 7px 11px;
    background: #ffffff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 12.5px;
    color: #334155;
    font-weight: 500;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    max-width: 175px;
  }
  .cc-ops-multiselect-btn:hover {
    border-color: #94a3b8;
    background: #f8fafc;
  }
  .cc-ops-multiselect-btn.active {
    border-color: #047857;
    background: #f0fdf4;
    color: #065f46;
    font-weight: 600;
  }
  .cc-ops-multiselect-badge {
    background: #047857;
    color: #ffffff;
    font-size: 10px;
    font-weight: 700;
    padding: 1px 6px;
    border-radius: 10px;
  }
  .cc-ops-multiselect-menu {
    position: absolute;
    top: calc(100% + 4px);
    left: 0;
    width: 260px;
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.15), 0 8px 10px -6px rgba(0, 0, 0, 0.1);
    z-index: 9999;
    padding: 8px;
    animation: ccDisburseFadeIn 0.15s ease-out;
  }
  .cc-ops-multiselect-search {
    position: relative;
    margin-bottom: 6px;
  }
  .cc-ops-multiselect-search input {
    width: 100%;
    padding: 6px 8px 6px 28px;
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    font-size: 12px;
    box-sizing: border-box;
    outline: none;
  }
  .cc-ops-multiselect-search input:focus {
    border-color: #047857;
  }
  .cc-ops-multiselect-actions {
    display: flex;
    justify-content: space-between;
    padding: 4px 2px 6px 2px;
    border-bottom: 1px solid #f1f5f9;
    margin-bottom: 4px;
  }
  .cc-ops-multiselect-actions button {
    background: none;
    border: none;
    font-size: 11px;
    color: #047857;
    font-weight: 600;
    cursor: pointer;
    padding: 2px 4px;
    border-radius: 4px;
  }
  .cc-ops-multiselect-actions button:hover {
    background: #f0fdf4;
  }
  .cc-ops-multiselect-list {
    max-height: 200px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cc-ops-multiselect-item {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 6px 8px;
    border-radius: 6px;
    font-size: 12px;
    color: #1e293b;
    cursor: pointer;
    user-select: none;
    transition: background 0.1s ease;
  }
  .cc-ops-multiselect-item:hover {
    background: #f8fafc;
  }
  .cc-ops-multiselect-item.selected {
    background: #ecfdf5;
    color: #065f46;
    font-weight: 600;
  }
  .cc-ops-multiselect-checkbox {
    width: 14px;
    height: 14px;
    border-radius: 3px;
    border: 1.5px solid #cbd5e1;
    display: grid;
    place-items: center;
    flex-shrink: 0;
    background: #fff;
  }
  .cc-ops-multiselect-item.selected .cc-ops-multiselect-checkbox {
    background: #047857;
    border-color: #047857;
    color: #fff;
  }

  /* Sourcing & Employee Badges */
  .cc-ops-source-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f1f5f9;
    color: #475569;
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .cc-ops-dsa-tag {
    display: inline-flex;
    align-items: center;
    background: #eff6ff;
    color: #1d4ed8;
    font-size: 10.5px;
    font-weight: 600;
    padding: 2px 6px;
    border-radius: 6px;
    border: 1px solid #bfdbfe;
    white-space: nowrap;
  }
  .cc-ops-badge.employee {
    background: #fdf4ff;
    color: #86198f;
    border: 1px solid #f0abfc;
  }

  /* Sub-status interactive pills */
  .cc-substatus-pills-row {
    display: flex;
    flex-wrap: wrap;
    gap: 4px;
    margin-top: 6px;
  }
  .cc-substatus-pill {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    padding: 1.5px 5px !important;
    border-radius: 4px !important;
    font-size: 10px !important;
    border: 1px solid #cbd5e1;
    background: #ffffff;
    cursor: pointer;
    transition: all 0.15s ease;
    white-space: nowrap;
    line-height: 1.25 !important;
  }
  .cc-substatus-pill:hover {
    transform: translateY(-1px);
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.06);
  }
  .cc-substatus-pill.resolved {
    background: #ecfdf5;
    border-color: #a7f3d0;
    color: #047857;
  }
  .cc-substatus-pill.initiated {
    background: #eff6ff;
    border-color: #bfdbfe;
    color: #1d4ed8;
  }
  .cc-substatus-pill.pending {
    background: #fffbeb;
    border-color: #fde68a;
    color: #b45309;
  }
  .cc-substatus-pill.rejected {
    background: #fef2f2;
    border-color: #fecaca;
    color: #dc2626;
  }
  .cc-substatus-pill.not-started {
    background: #f8fafc;
    border-color: #e2e8f0;
    color: #64748b;
  }

  /* Operations Table interactive status cells */
  .cc-ops-clickable-status-td {
    cursor: pointer;
    transition: background 0.15s ease;
    vertical-align: middle !important;
    padding: 3px 5px !important;
  }
  .cc-ops-clickable-status-td:hover {
    background: #f8fafc;
  }
  .cc-ops-status-cell-inner {
    display: flex;
    flex-direction: column;
    gap: 1px !important;
    align-items: flex-start;
  }
  .cc-status-cell-time {
    display: inline-flex;
    align-items: center;
    gap: 3px;
    font-size: 9.5px;
    color: #64748b;
    font-weight: 500;
    line-height: 1;
  }
  .cc-status-cell-remark {
    font-size: 9.5px;
    color: #334155;
    background: #f1f5f9;
    border-left: 2px solid #94a3b8;
    padding: 1px 4px;
    border-radius: 0 3px 3px 0;
    line-height: 1.2;
    max-width: 110px;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .cc-ops-clickable-status-td:hover .cc-status-cell-remark {
    border-left-color: #2563eb;
    background: #eff6ff;
  }

  /* Drawer Operations Sub-Status Cards Grid */
  .cc-ops-drawer-status-grid-box {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px 16px;
    margin-bottom: 20px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .cc-drawer-status-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(210px, 1fr));
    gap: 10px;
  }
  .cc-drawer-status-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: all 0.15s ease;
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cc-drawer-status-card:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateY(-1px);
    box-shadow: 0 3px 6px rgba(0, 0, 0, 0.06);
  }
  .cc-dsc-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 6px;
    margin-bottom: 2px;
  }
  .cc-dsc-title {
    font-size: 12px;
    font-weight: 700;
    color: #1e293b;
  }

  /* Stuck / Pending notification badge */
  .cc-stage-stuck-notice {
    display: flex;
    align-items: center;
    gap: 4px;
    padding: 3px 7px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    margin-top: 4px;
    line-height: 1.3;
  }
  .cc-stage-stuck-notice.warning {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }
  .cc-stage-stuck-notice.info {
    background: #eff6ff;
    color: #1d4ed8;
    border: 1px solid #bfdbfe;
  }
  .cc-stage-stuck-notice.success {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }
  .cc-stage-stuck-notice.neutral {
    background: #f8fafc;
    color: #475569;
    border: 1px solid #e2e8f0;
  }

  /* Action Buttons */
  .cc-ops-action-btn.cc-btn-disburse-locked {
    background: #f1f5f9;
    color: #94a3b8;
    border: 1px dashed #cbd5e1;
    font-weight: 600;
    cursor: not-allowed;
  }
  .cc-ops-action-btn.cc-btn-history {
    background: #f8fafc;
    color: #334155;
    border: 1px solid #cbd5e1;
    font-weight: 600;
  }
  .cc-ops-action-btn.cc-btn-history:hover {
    background: #1e293b;
    color: #ffffff;
    border-color: #1e293b;
  }
  .cc-disbursed-done-tag {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 10px;
    background: #dcfce7;
    color: #15803d;
    font-size: 12px;
    font-weight: 700;
    border-radius: 8px;
    border: 1px solid #86efac;
  }

  /* History Timeline Popup */
  .cc-history-timeline-list {
    position: relative;
    padding-left: 20px;
    display: flex;
    flex-direction: column;
    gap: 16px;
  }
  .cc-history-timeline-list::before {
    content: "";
    position: absolute;
    top: 6px;
    bottom: 6px;
    left: 6px;
    width: 2px;
    background: #e2e8f0;
  }
  .cc-history-timeline-item {
    position: relative;
  }
  .cc-timeline-dot {
    position: absolute;
    left: -20px;
    top: 10px;
    width: 10px;
    height: 10px;
    border-radius: 50%;
    background: #047857;
    border: 2px solid #ffffff;
    box-shadow: 0 0 0 2px #a7f3d0;
  }
  .cc-timeline-card {
    background: #ffffff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 14px;
    box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
  }
  .cc-timeline-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 8px;
    flex-wrap: wrap;
    gap: 6px;
  }
  .cc-timeline-type-badge {
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
    background: #f1f5f9;
    color: #475569;
  }
  .cc-timeline-type-badge.pd { background: #ede9fe; color: #6d28d9; }
  .cc-timeline-type-badge.query { background: #fef3c7; color: #b45309; }
  .cc-timeline-type-badge.legal { background: #eff6ff; color: #1d4ed8; }
  .cc-timeline-type-badge.technical { background: #ecfeff; color: #0e7490; }
  .cc-timeline-type-badge.pdd { background: #f5f3ff; color: #7c3aed; }
  .cc-timeline-type-badge.otc { background: #fffbeb; color: #d97706; }
  .cc-timeline-type-badge.disbursement { background: #ecfdf5; color: #047857; }
  .cc-timeline-time {
    font-size: 11px;
    color: #94a3b8;
  }
  .cc-timeline-remark {
    font-size: 12.5px;
    color: #1e293b;
    background: #f8fafc;
    border-left: 3px solid #047857;
    padding: 6px 10px;
    border-radius: 0 6px 6px 0;
    margin-bottom: 8px;
    line-height: 1.4;
  }
  .cc-timeline-footer {
    font-size: 11px;
    color: #64748b;
  }
`;

