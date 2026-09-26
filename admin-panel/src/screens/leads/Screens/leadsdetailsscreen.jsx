import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import {
  ArrowLeft,
  Briefcase,
  Building2,
  Calendar,
  CheckCircle2,
  Clock,
  Coins,
  Download,
  ExternalLink,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Files,
  Mail,
  MapPin,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Share2,
  ShieldAlert,
  ShieldCheck,
  Tag,
  Upload,
  User,
  UserCheck,
  X,
} from "lucide-react";
import API_URL from "../../../config";

const statusColorMap = {
  NEW: { bg: "#eff6ff", text: "#1d4ed8", border: "#bfdbfe" },
  INTERESTED: { bg: "#ecfdf5", text: "#047857", border: "#a7f3d0" },
  FOLLOW_UP: { bg: "#fffbeb", text: "#b45309", border: "#fde68a" },
  CALL_BACK: { bg: "#faf5ff", text: "#7e22ce", border: "#e9d5ff" },
  DOCS_PENDING: { bg: "#fff1f2", text: "#be123c", border: "#fecdd3" },
  FILE_LOGIN: { bg: "#f0fdf4", text: "#15803d", border: "#bbf7d0" },
  PASSED_TO_OPS: { bg: "#e0e7ff", text: "#4338ca", border: "#c7d2fe" },
  SANCTIONED: { bg: "#f0fdfa", text: "#0f766e", border: "#99f6e4" },
  DISBURSED: { bg: "#ecfdf5", text: "#065f46", border: "#6ee7b7" },
  REJECTED: { bg: "#fef2f2", text: "#b91c1c", border: "#fecaca" },
  NOT_CONNECTED: { bg: "#f1f5f9", text: "#475569", border: "#cbd5e1" },
};

const appStatusBadge = (status) => {
  const norm = String(status || "").toUpperCase();
  if (norm.includes("SANCTION") || norm.includes("DISBURS")) {
    return { bg: "#ecfdf5", color: "#065f46", border: "#a7f3d0", label: norm };
  }
  if (norm.includes("REJECT")) {
    return { bg: "#fef2f2", color: "#b91c1c", border: "#fecaca", label: norm };
  }
  if (norm.includes("QUERY")) {
    return { bg: "#fff7ed", color: "#c2410c", border: "#ffedd5", label: norm };
  }
  if (norm.includes("REVIEW") || norm.includes("LOGIN")) {
    return { bg: "#eff6ff", color: "#1d4ed8", border: "#bfdbfe", label: norm };
  }
  return { bg: "#f8fafc", color: "#475569", border: "#e2e8f0", label: norm || "PENDING" };
};

const lenderTypeBadge = (type) => {
  const t = String(type || "").toUpperCase();
  if (t === "BANK") return { bg: "#eff6ff", color: "#1e40af" };
  if (t === "NBFC") return { bg: "#f5f3ff", color: "#6b21a8" };
  if (t === "DSA") return { bg: "#ecfdf5", color: "#065f46" };
  return { bg: "#f1f5f9", color: "#475569" };
};

export default function LeadDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [lead, setLead] = useState(null);
  const [calls, setCalls] = useState([]);
  const [histories, setHistories] = useState([]);
  const [applications, setApplications] = useState([]);
  const [documents, setDocuments] = useState([]);
  const [personNames, setPersonNames] = useState({});
  const [lendersList, setLendersList] = useState([]);
  const [docTypesList, setDocTypesList] = useState([]);
  const [activeTab, setActiveTab] = useState("applications");
  const [loading, setLoading] = useState(true);

  const userRole = localStorage.getItem("userRole") || "";
  const employeeRole = localStorage.getItem("employeeRole") || "";
  const isEmployee =
    userRole.toUpperCase() === "EMPLOYEE" ||
    ["calling", "employee"].includes(employeeRole?.toLowerCase());

  const userPermissions = (() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  })();

  const canExport = !isEmployee && userPermissions.exportData !== false;
  const canViewCommission = !isEmployee && Boolean(userPermissions.viewPayouts || userPermissions.viewConnectors || userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN");

  // Upload Doc Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [docFile, setDocFile] = useState(null);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Create Application Modal state
  const [createAppModalOpen, setCreateAppModalOpen] = useState(false);
  const [appForm, setAppForm] = useState({
    loanProduct: "",
    appliedAmount: "",
    lenderId: "",
  });
  const [submittingApp, setSubmittingApp] = useState(false);

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API_URL}/users`, { params: { limit: 200 } });
      const employeesList = response.data?.data || [];
      const namesMap = {};
      employeesList.forEach((emp) => {
        namesMap[emp.id] = emp.name;
      });
      setPersonNames(namesMap);
    } catch (error) {
      console.error("Error fetching employees: ", error);
    }
  };

  const fetchMasterConfigs = async () => {
    try {
      const [lendersRes, docTypesRes] = await Promise.all([
        axios.get(`${API_URL}/lenders`).catch(() => ({ data: { data: [] } })),
        axios.get(`${API_URL}/master-configs/DOC_TYPE`, { params: { includeInactive: false } }).catch(() => ({ data: { data: [] } })),
      ]);
      setLendersList(lendersRes.data?.data || lendersRes.data?.lenders || []);
      setDocTypesList(docTypesRes.data?.data || []);
      if (docTypesRes.data?.data?.length) {
        setSelectedDocType(docTypesRes.data.data[0].value || docTypesRes.data.data[0].label);
      }
    } catch (err) {
      console.error("Error loading master configs", err);
    }
  };

  const fetchLeadDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/leads/${id}`);
      const data = response.data?.data;
      if (data) {
        setLead(data);
        setApplications(data.applications || []);
        setDocuments(data.documents || []);
        if (data.loan_type) {
          setAppForm((prev) => ({
            ...prev,
            loanProduct: data.loan_type,
            appliedAmount: data.est_budget || "",
          }));
        }
      }
    } catch (error) {
      console.error("Error fetching lead details: ", error);
      toast.error("Could not load lead details");
    }
  };

  const fetchCallDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/calls`, { params: { leadId: id, limit: 200 } });
      setCalls(response.data?.data || []);
    } catch (error) {
      console.error("Error fetching calls: ", error);
    }
  };

  const fetchHistoryDetails = async () => {
    try {
      const res = await axios.get(`${API_URL}/activity/Lead/${id}`);
      setHistories(res.data?.data || []);
    } catch (error) {
      console.error("Error fetching history data:", error);
    }
  };

  const loadData = async () => {
    setLoading(true);
    try {
      await Promise.all([
        fetchLeadDetails(),
        fetchCallDetails(),
        fetchHistoryDetails(),
        fetchEmployees(),
        fetchMasterConfigs(),
      ]);
    } catch (err) {
      console.error("Error loading lead details data:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (id) {
      loadData();
    }
  }, [id]);

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!docFile) {
      toast.error("Please select a file to upload");
      return;
    }
    if (!selectedDocType) {
      toast.error("Please select a document type");
      return;
    }
    setUploadingDoc(true);
    try {
      const formData = new FormData();
      formData.append("file", docFile);
      formData.append("leadId", id);
      if (lead?.customer_id) {
        formData.append("customerId", lead.customer_id);
      }
      formData.append("docType", selectedDocType);

      const token = localStorage.getItem("token");
      await axios.post(`${API_URL}/documents`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      toast.success("Document uploaded successfully");
      setUploadModalOpen(false);
      setDocFile(null);
      fetchLeadDetails();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to upload document");
    } finally {
      setUploadingDoc(false);
    }
  };

  const handleCreateApplication = async (e) => {
    e.preventDefault();
    if (!appForm.loanProduct || !appForm.appliedAmount) {
      toast.error("Loan Product and Applied Amount are required");
      return;
    }
    setSubmittingApp(true);
    try {
      const token = localStorage.getItem("token");
      await axios.post(
        `${API_URL}/applications`,
        {
          leadId: parseInt(id, 10),
          customerId: lead?.customer_id,
          loanProduct: appForm.loanProduct,
          appliedAmount: parseFloat(appForm.appliedAmount),
          lenderId: appForm.lenderId ? parseInt(appForm.lenderId, 10) : null,
        },
        {
          headers: {
            ...(token && { Authorization: `Bearer ${token}` }),
          },
        }
      );
      toast.success("Loan Application created successfully");
      setCreateAppModalOpen(false);
      fetchLeadDetails();
    } catch (err) {
      console.error(err);
      toast.error(err.response?.data?.message || "Failed to create application");
    } finally {
      setSubmittingApp(false);
    }
  };

  const downloadexcel = () => {
    const wb = XLSX.utils.book_new();

    // Sheet 1: Lead Details
    const leadProfileRow = {
      "Lead ID": lead?.lead_id || lead?.id || "N/A",
      Name: lead?.name || "N/A",
      Phone: lead?.number || "N/A",
      Email: lead?.email || "N/A",
      City: lead?.city || "N/A",
      "Assigned To": `${lead?.person_id || ""}-${lead?.owner || "Unassigned"}`,
      Status: lead?.status || "N/A",
      "Source / Party": lead?.source || "Self",
    };
    if (canViewCommission) {
      leadProfileRow["Commission (%)"] =
        lead?.commission_percent !== null && lead?.commission_percent !== undefined
          ? `${lead.commission_percent}%`
          : "0%";
    }
    leadProfileRow["Priority"] = lead?.priority || "N/A";
    leadProfileRow["Loan Product"] = lead?.loan_type || "N/A";
    leadProfileRow["Estimated Budget"] = lead?.est_budget || "N/A";
    leadProfileRow["Monthly Income"] = lead?.monthly_income || lead?.income || "N/A";
    leadProfileRow["Next Meeting"] = lead?.next_meeting
      ? new Date(lead.next_meeting).toLocaleString("en-IN")
      : "N/A";
    leadProfileRow["Created At"] = lead?.createdAt
      ? new Date(lead.createdAt).toLocaleString("en-IN")
      : "N/A";

    const leadDetailsData = [leadProfileRow];
    XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(leadDetailsData), "Lead Profile");

    // Sheet 2: Loan Applications
    if (applications.length) {
      const appsData = applications.map((a) => ({
        "App Number": a.applicationNumber,
        "Loan Product": a.loanProduct,
        "Applied Amount": a.appliedAmount,
        "Sanctioned Amount": a.sanctionedAmount || "N/A",
        "Disbursed Amount": a.disbursedAmount || "N/A",
        Status: a.status,
        "Assigned Bank/NBFC/DSA": a.lender?.name || "Unassigned",
        "Lender Type": a.lender?.lenderType || "N/A",
        "Assigned Banker": a.assignedBanker?.name || "Unassigned",
        "Banker Phone": a.assignedBanker?.phone || "N/A",
        "Documents Count": a.documents?.length || 0,
        "Created At": new Date(a.createdAt).toLocaleString("en-IN"),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(appsData), "Loan Applications");
    }

    // Sheet 3: Documents
    const allDocs = [
      ...documents,
      ...applications.flatMap((a) => a.documents || []),
    ];
    if (allDocs.length) {
      const docsData = allDocs.map((d) => ({
        "Doc ID": d.id,
        "Doc Type": d.docType,
        "File Name": d.fileName,
        Status: d.verificationStatus || d.status || "PENDING",
        "Uploaded By": d.uploader?.name || "N/A",
        "File URL": d.fileUrl ? `${API_URL.replace(/\/api\/?$/, "")}${d.fileUrl}` : "N/A",
        "Uploaded At": new Date(d.createdAt).toLocaleString("en-IN"),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(docsData), "Documents");
    }

    // Sheet 4: Calls
    if (calls.length) {
      const callsData = calls.map((c) => ({
        "Called By": personNames[c.emp_id] || c.emp_id || "N/A",
        Phone: c.customer_number || lead?.number || "N/A",
        Remarks: c.remarks || c.remark || "N/A",
        Date: new Date(c.createdAt).toLocaleString("en-IN"),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(callsData), "Calls");
    }

    // Sheet 5: History
    if (histories.length) {
      const historyData = histories.map((h) => ({
        "Updated By": h.actor || personNames[h.actor_id] || "System",
        Action: h.action || "N/A",
        "From Status": h.old_value?.status || "N/A",
        "To Status": h.new_value?.status || "N/A",
        Remarks: h.remarks || h.remark || "N/A",
        Date: new Date(h.createdAt).toLocaleString("en-IN"),
      }));
      XLSX.utils.book_append_sheet(wb, XLSX.utils.json_to_sheet(historyData), "History");
    }

    const fileName = `Lead_${lead?.name || id}_Complete_${new Date().toISOString().split("T")[0]}.xlsx`;
    XLSX.writeFile(wb, fileName);
  };

  if (loading) {
    return (
      <div className="cc-lead-detail-loading">
        <RefreshCw size={28} className="spin" />
        <span>Loading lead complete profile...</span>
      </div>
    );
  }

  if (!lead) {
    return (
      <div className="cc-lead-detail-error">
        <ShieldAlert size={40} />
        <h2>Lead not found</h2>
        <button onClick={() => navigate("/leads")} className="cc-btn primary">
          Back to Leads
        </button>
      </div>
    );
  }

  const statusStyle = statusColorMap[lead.status_value || lead.status] || {
    bg: "#f1f5f9",
    text: "#475569",
    border: "#cbd5e1",
  };

  const leadSourceDisplay = lead.source || "Self";
  const isSelf = leadSourceDisplay.toLowerCase() === "self";

  return (
    <div className="cc-lead-detail-page">
      <ToastContainer position="bottom-right" />
      <style>{detailStyles}</style>

      {/* Top Header / Actions Bar */}
      <div className="cc-lead-detail-header">
        <div className="cc-lead-header-left">
          <button
            type="button"
            className="cc-back-btn"
            onClick={() => navigate("/leads")}
            title="Back to leads list"
          >
            <ArrowLeft size={18} />
            <span>Leads</span>
          </button>
          <div className="cc-lead-title-box">
            <div className="cc-lead-title-row">
              <h2>{lead.name}</h2>
              <span className="cc-lead-id-tag">#LEAD-{lead.lead_id || lead.id}</span>
              <span
                className="cc-lead-status-pill"
                style={{
                  backgroundColor: statusStyle.bg,
                  color: statusStyle.text,
                  borderColor: statusStyle.border,
                }}
              >
                {lead.status}
              </span>
              <span
                className="cc-lead-source-pill"
                style={{
                  backgroundColor: isSelf ? "#ecfdf5" : "#eff6ff",
                  color: isSelf ? "#059669" : "#1d4ed8",
                  borderColor: isSelf ? "#a7f3d0" : "#bfdbfe",
                }}
              >
                <Share2 size={11} />
                {leadSourceDisplay}
                {canViewCommission && lead.commission_percent !== null && lead.commission_percent !== undefined && (
                  <span style={{ marginLeft: "4px", fontWeight: 700 }}>
                    ({lead.commission_percent}%)
                  </span>
                )}
              </span>
            </div>
            <p className="cc-lead-subtitle">
              Customer Contact: <strong>{lead.number}</strong>
              {lead.email ? ` • ${lead.email}` : ""}
              {lead.city ? ` • ${lead.city}` : ""}
            </p>
          </div>
        </div>

        <div className="cc-lead-header-right">
          <button
            type="button"
            className="cc-header-action-btn edit"
            onClick={() => navigate(`/lead-edit/${lead.lead_id || lead.id}`)}
          >
            <Pencil size={15} />
            <span>Edit Lead</span>
          </button>
          {canExport && (
            <button
              type="button"
              className="cc-header-action-btn excel"
              onClick={downloadexcel}
            >
              <Download size={15} />
              <span>Export Excel</span>
            </button>
          )}
        </div>
      </div>

      {/* Key Info Banner Grid */}
      <div className="cc-lead-summary-grid">
        <div className="cc-summary-card">
          <span className="cc-card-icon caller">
            <UserCheck size={18} />
          </span>
          <div className="cc-card-info">
            <span className="label">Assigned Owner</span>
            <span className="value">{lead.owner || "Unassigned"}</span>
            <small>ID: {lead.person_id || "--"}</small>
          </div>
        </div>

        <div className="cc-summary-card">
          <span className="cc-card-icon loan">
            <Coins size={18} />
          </span>
          <div className="cc-card-info">
            <span className="label">Requirement</span>
            <span className="value">{lead.loan_type || "General Loan"}</span>
            <small>
              Budget: {lead.est_budget ? `₹${Number(lead.est_budget).toLocaleString("en-IN")}` : "N/A"}
            </small>
          </div>
        </div>

        <div className="cc-summary-card">
          <span className="cc-card-icon source">
            <Share2 size={18} />
          </span>
          <div className="cc-card-info">
            <span className="label">Party / Source</span>
            <span className="value">
              {leadSourceDisplay}
              {canViewCommission && lead.commission_percent !== null && lead.commission_percent !== undefined && (
                <span style={{ fontSize: "12px", color: "#047857", fontWeight: 700, marginLeft: "6px" }}>
                  ({lead.commission_percent}%)
                </span>
              )}
            </span>
            <small>
              {canViewCommission && lead.commission_percent !== null && lead.commission_percent !== undefined
                ? `Commission: ${lead.commission_percent}% • `
                : ""}
              Priority: {lead.priority || "Medium"}
            </small>
          </div>
        </div>

        <div className="cc-summary-card">
          <span className="cc-card-icon meeting">
            <Calendar size={18} />
          </span>
          <div className="cc-card-info">
            <span className="label">Next Follow-up</span>
            <span className="value">
              {lead.next_meeting
                ? new Date(lead.next_meeting).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })
                : "Not Scheduled"}
            </span>
            <small>
              {lead.next_meeting
                ? new Date(lead.next_meeting).toLocaleTimeString("en-IN", {
                    hour: "2-digit",
                    minute: "2-digit",
                  })
                : "No meeting time"}
            </small>
          </div>
        </div>
      </div>

      {/* Tab Navigation */}
      <div className="cc-lead-tabs-nav">
        <button
          type="button"
          className={`cc-lead-tab ${activeTab === "applications" ? "active" : ""}`}
          onClick={() => setActiveTab("applications")}
        >
          <Briefcase size={16} />
          <span>Loan Applications &amp; Documents</span>
          <span className="count-badge">{applications.length + documents.length}</span>
        </button>
        <button
          type="button"
          className={`cc-lead-tab ${activeTab === "calls" ? "active" : ""}`}
          onClick={() => setActiveTab("calls")}
        >
          <Phone size={16} />
          <span>Call Logs</span>
          <span className="count-badge">{calls.length}</span>
        </button>
        <button
          type="button"
          className={`cc-lead-tab ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          <Clock size={16} />
          <span>Activity &amp; Timeline</span>
          <span className="count-badge">{histories.length}</span>
        </button>
      </div>

      {/* TAB CONTENT: LOAN APPLICATIONS & DOCUMENTS */}
      {activeTab === "applications" && (
        <div className="cc-tab-panel">
          {/* Applications Header */}
          <div className="cc-panel-section-header">
            <div>
              <h3>Loan Applications</h3>
              <p>Active loan cases submitted to Bank, NBFC or DSA partner with status &amp; underwriting info</p>
            </div>
            <button
              type="button"
              className="cc-action-btn primary"
              onClick={() => setCreateAppModalOpen(true)}
            >
              <Plus size={15} />
              <span>Create Loan Application</span>
            </button>
          </div>

          {applications.length === 0 ? (
            <div className="cc-empty-state-box">
              <Briefcase size={36} />
              <h4>No Loan Application created yet for this lead</h4>
              <p>
                You can create a loan application to assign a Bank / NBFC partner (or DSA channel) and start document verification.
              </p>
              <button
                type="button"
                className="cc-action-btn primary"
                onClick={() => setCreateAppModalOpen(true)}
              >
                <Plus size={15} />
                <span>Create Loan Application</span>
              </button>
            </div>
          ) : (
            <div className="cc-applications-cards-list">
              {applications.map((app) => {
                const badge = appStatusBadge(app.status);
                const lType = lenderTypeBadge(app.lender?.lenderType);
                return (
                  <div key={app.id} className="cc-app-card">
                    {/* App Header */}
                    <div className="cc-app-card-header">
                      <div className="cc-app-header-title">
                        <span className="cc-app-num">{app.applicationNumber}</span>
                        <span className="cc-app-product">{app.loanProduct}</span>
                      </div>
                      <div className="cc-app-header-tags">
                        <span
                          className="cc-app-status-badge"
                          style={{
                            backgroundColor: badge.bg,
                            color: badge.color,
                            borderColor: badge.border,
                          }}
                        >
                          <span className="dot" style={{ backgroundColor: badge.color }} />
                          {app.status}
                        </span>
                      </div>
                    </div>

                    {/* App Key Details Grid */}
                    <div className="cc-app-details-grid">
                      {/* Bank / NBFC / DSA Partner */}
                      <div className="cc-app-meta-box">
                        <span className="meta-label">
                          <Building2 size={13} /> Assigned Bank / NBFC / DSA
                        </span>
                        {app.lender ? (
                          <div className="meta-value-lender">
                            <strong>{app.lender.name}</strong>
                            <span
                              className="lender-type-tag"
                              style={{ backgroundColor: lType.bg, color: lType.color }}
                            >
                              {app.lender.lenderType || "Bank"}
                            </span>
                            {app.lender.shortCode ? (
                              <span className="code">({app.lender.shortCode})</span>
                            ) : null}
                          </div>
                        ) : (
                          <span className="meta-value unassigned">
                            Unassigned Partner (Direct)
                          </span>
                        )}
                      </div>

                      {/* Assigned Banker / Underwriter */}
                      <div className="cc-app-meta-box">
                        <span className="meta-label">
                          <User size={13} /> Assigned Banker / Ops
                        </span>
                        {app.assignedBanker ? (
                          <div className="meta-value-banker">
                            <strong>{app.assignedBanker.name}</strong>
                            {app.assignedBanker.phone && (
                              <span className="sub">{app.assignedBanker.phone}</span>
                            )}
                          </div>
                        ) : (
                          <span className="meta-value unassigned">Not Assigned</span>
                        )}
                      </div>

                      {/* Amounts */}
                      <div className="cc-app-meta-box">
                        <span className="meta-label">
                          <Coins size={13} /> Loan Amount
                        </span>
                        <div className="meta-value-amounts">
                          <div>
                            <small>Applied:</small>{" "}
                            <strong>₹{Number(app.appliedAmount || 0).toLocaleString("en-IN")}</strong>
                          </div>
                          {app.sanctionedAmount ? (
                            <div>
                              <small>Sanctioned:</small>{" "}
                              <strong style={{ color: "#047857" }}>
                                ₹{Number(app.sanctionedAmount).toLocaleString("en-IN")}
                              </strong>
                            </div>
                          ) : null}
                          {app.disbursedAmount ? (
                            <div>
                              <small>Disbursed:</small>{" "}
                              <strong style={{ color: "#15803d" }}>
                                ₹{Number(app.disbursedAmount).toLocaleString("en-IN")}
                              </strong>
                            </div>
                          ) : null}
                        </div>
                      </div>
                    </div>

                    {/* App Documents List */}
                    {app.documents && app.documents.length > 0 ? (
                      <div className="cc-app-documents-section">
                        <span className="section-title">
                          <Files size={13} /> Documents attached to this application ({app.documents.length}):
                        </span>
                        <div className="cc-app-docs-chips">
                          {app.documents.map((doc) => (
                            <a
                              key={doc.id}
                              href={doc.fileUrl ? `${API_URL.replace(/\/api\/?$/, "")}${doc.fileUrl}` : "#"}
                              target="_blank"
                              rel="noreferrer"
                              className="cc-doc-chip"
                              title={`View ${doc.fileName || doc.docType}`}
                            >
                              <FileText size={13} />
                              <span className="name">{doc.docType}</span>
                              <span className={`status ${String(doc.verificationStatus || doc.status).toLowerCase()}`}>
                                {doc.verificationStatus || doc.status || "PENDING"}
                              </span>
                              <ExternalLink size={12} />
                            </a>
                          ))}
                        </div>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}

          {/* KYC Documents Section */}
          <div className="cc-panel-section-header mt-8">
            <div>
              <h3>All Documents for this Lead ({documents.length})</h3>
              <p>KYC documents (PAN, Aadhaar, Bank Statement, Salary Slips, ITR, etc.)</p>
            </div>
            <button
              type="button"
              className="cc-action-btn secondary"
              onClick={() => setUploadModalOpen(true)}
            >
              <Upload size={14} />
              <span>Upload Document</span>
            </button>
          </div>

          {documents.length === 0 ? (
            <div className="cc-empty-state-box small">
              <Files size={30} />
              <p>No KYC documents uploaded for this lead yet.</p>
              <button
                type="button"
                className="cc-action-btn secondary"
                onClick={() => setUploadModalOpen(true)}
              >
                <Upload size={14} />
                <span>Upload First Document</span>
              </button>
            </div>
          ) : (
            <div className="cc-documents-table-shell">
              <table className="cc-data-table">
                <thead>
                  <tr>
                    <th>Doc Type</th>
                    <th>File Name</th>
                    <th>Verification Status</th>
                    <th>Uploaded By</th>
                    <th>Date</th>
                    <th style={{ textAlign: "right" }}>Action</th>
                  </tr>
                </thead>
                <tbody>
                  {documents.map((doc) => {
                    const status = String(doc.verificationStatus || doc.status || "PENDING").toUpperCase();
                    const isVerified = status === "VERIFIED";
                    const isRejected = status === "REJECTED";
                    const fileLink = doc.fileUrl
                      ? `${API_URL.replace(/\/api\/?$/, "")}${doc.fileUrl}`
                      : "#";

                    return (
                      <tr key={doc.id}>
                        <td>
                          <div className="cc-doc-type-cell">
                            <FileCheck size={16} color="#2563eb" />
                            <strong>{doc.docType}</strong>
                          </div>
                        </td>
                        <td>
                          <span className="file-name" title={doc.fileName}>
                            {doc.fileName || "document_file"}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`cc-doc-status-badge ${isVerified ? "verified" : isRejected ? "rejected" : "pending"}`}
                          >
                            {isVerified ? (
                              <CheckCircle2 size={12} />
                            ) : isRejected ? (
                              <ShieldAlert size={12} />
                            ) : (
                              <Clock size={12} />
                            )}
                            {status}
                          </span>
                        </td>
                        <td>{doc.uploader?.name || "System / Ops"}</td>
                        <td>
                          {doc.createdAt
                            ? new Date(doc.createdAt).toLocaleDateString("en-IN", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })
                            : "--"}
                        </td>
                        <td style={{ textAlign: "right" }}>
                          <a
                            href={fileLink}
                            target="_blank"
                            rel="noreferrer"
                            className="cc-view-doc-btn"
                          >
                            <Eye size={13} />
                            <span>View / Download</span>
                          </a>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: CALL LOGS */}
      {activeTab === "calls" && (
        <div className="cc-tab-panel">
          <div className="cc-panel-section-header">
            <div>
              <h3>Telecalling Activity ({calls.length})</h3>
              <p>Logs of phone calls made by callers or received for this lead</p>
            </div>
          </div>

          {calls.length === 0 ? (
            <div className="cc-empty-state-box">
              <Phone size={36} />
              <h4>No call records found</h4>
              <p>Call activities logged from the mobile dialer or calling screen will appear here.</p>
            </div>
          ) : (
            <div className="cc-documents-table-shell">
              <table className="cc-data-table">
                <thead>
                  <tr>
                    <th>Called By</th>
                    <th>Customer Number</th>
                    <th>Remarks</th>
                    <th>Date &amp; Time</th>
                  </tr>
                </thead>
                <tbody>
                  {calls.map((call, index) => (
                    <tr key={index}>
                      <td>
                        <strong>{personNames[call.emp_id] || call.emp_id || "Employee"}</strong>
                      </td>
                      <td>{call.customer_number || lead.number}</td>
                      <td>{call.remarks || call.remark || "--"}</td>
                      <td>
                        {call.createdAt
                          ? new Date(call.createdAt).toLocaleString("en-IN", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })
                          : "--"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB CONTENT: TIMELINE & HISTORY */}
      {activeTab === "history" && (
        <div className="cc-tab-panel">
          <div className="cc-panel-section-header">
            <div>
              <h3>Lead Audit &amp; Status Timeline ({histories.length})</h3>
              <p>Historical record of every change, reassignment, and status transition</p>
            </div>
          </div>

          {histories.length === 0 ? (
            <div className="cc-empty-state-box">
              <Clock size={36} />
              <h4>No activity timeline records yet</h4>
            </div>
          ) : (
            <div className="cc-timeline-flow">
              {histories.map((item, index) => {
                const actorName = item.actor || personNames[item.actor_id] || "System";
                const toStatus = item.new_value?.status;
                const fromStatus = item.old_value?.status;

                return (
                  <div key={index} className="cc-timeline-item">
                    <div className="cc-timeline-marker" />
                    <div className="cc-timeline-content">
                      <div className="cc-timeline-meta">
                        <span className="actor">{actorName}</span>
                        <span className="action">{item.action || "STATUS_CHANGE"}</span>
                        <span className="time">
                          {item.createdAt
                            ? new Date(item.createdAt).toLocaleString("en-IN", {
                                dateStyle: "medium",
                                timeStyle: "short",
                              })
                            : ""}
                        </span>
                      </div>
                      {toStatus ? (
                        <div className="cc-timeline-transition">
                          {fromStatus ? <span className="from">{fromStatus}</span> : null}
                          {fromStatus ? <span className="arrow">➔</span> : null}
                          <span className="to">{toStatus}</span>
                        </div>
                      ) : null}
                      {item.remarks || item.remark ? (
                        <p className="cc-timeline-remark">"{item.remarks || item.remark}"</p>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: UPLOAD DOCUMENT */}
      {uploadModalOpen && (
        <div className="cc-modal-backdrop" onClick={() => setUploadModalOpen(false)}>
          <div className="cc-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <h3>Upload Lead Document</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setUploadModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleUploadDocument} className="cc-modal-form">
              <div className="form-group">
                <label>
                  Document Type <span className="req">*</span>
                </label>
                <select
                  value={selectedDocType}
                  onChange={(e) => setSelectedDocType(e.target.value)}
                  required
                >
                  {docTypesList.map((dt) => (
                    <option key={dt.id || dt.value} value={dt.value || dt.label}>
                      {dt.label || dt.value}
                    </option>
                  ))}
                  {docTypesList.length === 0 && (
                    <>
                      <option value="PAN">PAN Card</option>
                      <option value="AADHAAR">Aadhaar Card</option>
                      <option value="SALARY_SLIP">Salary Slip</option>
                      <option value="BANK_STATEMENT">Bank Statement</option>
                      <option value="ITR">ITR / Form 16</option>
                      <option value="PROPERTY_CHAIN">Property Documents</option>
                    </>
                  )}
                </select>
              </div>

              <div className="form-group">
                <label>
                  Select File <span className="req">*</span>
                </label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png,.doc,.docx"
                  onChange={(e) => setDocFile(e.target.files?.[0] || null)}
                  required
                />
                <small className="help">Accepted: PDF, Images (.jpg, .png), Word (.docx)</small>
              </div>

              <div className="cc-modal-footer">
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setUploadModalOpen(false)}
                  disabled={uploadingDoc}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-btn primary"
                  disabled={uploadingDoc || !docFile}
                >
                  {uploadingDoc ? "Uploading..." : "Upload Document"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE LOAN APPLICATION */}
      {createAppModalOpen && (
        <div className="cc-modal-backdrop" onClick={() => setCreateAppModalOpen(false)}>
          <div className="cc-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <h3>Create Loan Application</h3>
              <button
                type="button"
                className="close-btn"
                onClick={() => setCreateAppModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>
            <form onSubmit={handleCreateApplication} className="cc-modal-form">
              <div className="form-group">
                <label>
                  Loan Product <span className="req">*</span>
                </label>
                <input
                  type="text"
                  placeholder="e.g. Home Loan, Business Loan, Personal Loan..."
                  value={appForm.loanProduct}
                  onChange={(e) => setAppForm({ ...appForm, loanProduct: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>
                  Applied Amount (₹) <span className="req">*</span>
                </label>
                <input
                  type="number"
                  placeholder="e.g. 500000"
                  value={appForm.appliedAmount}
                  onChange={(e) => setAppForm({ ...appForm, appliedAmount: e.target.value })}
                  required
                />
              </div>

              <div className="form-group">
                <label>Assign Bank / NBFC / DSA Partner (Optional)</label>
                <select
                  value={appForm.lenderId}
                  onChange={(e) => setAppForm({ ...appForm, lenderId: e.target.value })}
                >
                  <option value="">None / Assign Later in Underwriting</option>
                  {lendersList.map((l) => (
                    <option key={l.id} value={l.id}>
                      {l.name} ({l.lenderType || "Bank"})
                    </option>
                  ))}
                </select>
                <small className="help">
                  Choose which Bank, NBFC or DSA partner this case is forwarded to.
                </small>
              </div>

              <div className="cc-modal-footer">
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setCreateAppModalOpen(false)}
                  disabled={submittingApp}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-btn primary"
                  disabled={submittingApp}
                >
                  {submittingApp ? "Creating..." : "Create Application"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const detailStyles = `
.cc-lead-detail-page {
  display: flex;
  flex-direction: column;
  gap: 20px;
  padding: 4px;
}

.cc-lead-detail-loading,
.cc-lead-detail-error {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  min-height: 400px;
  gap: 16px;
  color: #64748b;
}

.spin {
  animation: spin 1s linear infinite;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Header */
.cc-lead-detail-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 16px;
  background: #ffffff;
  padding: 18px 24px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.cc-lead-header-left {
  display: flex;
  align-items: center;
  gap: 18px;
  flex-wrap: wrap;
}

.cc-back-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  padding: 8px 14px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.cc-back-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.cc-lead-title-box {
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.cc-lead-title-row {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cc-lead-title-row h2 {
  margin: 0;
  font-size: 20px;
  font-weight: 700;
  color: #0f172a;
}

.cc-lead-id-tag {
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-family: monospace;
  font-size: 12px;
  padding: 2px 8px;
  border-radius: 6px;
  font-weight: 600;
}

.cc-lead-status-pill,
.cc-lead-source-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 10px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 600;
  border: 1px solid transparent;
}

.cc-lead-subtitle {
  margin: 0;
  font-size: 13px;
  color: #64748b;
}

.cc-lead-header-right {
  display: flex;
  align-items: center;
  gap: 10px;
}

.cc-header-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.cc-header-action-btn.edit {
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
}

.cc-header-action-btn.edit:hover {
  background: #dbeafe;
}

.cc-header-action-btn.excel {
  background: #ecfdf5;
  border: 1px solid #a7f3d0;
  color: #059669;
}

.cc-header-action-btn.excel:hover {
  background: #d1fae5;
}

/* Summary Grid */
.cc-lead-summary-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.cc-summary-card {
  display: flex;
  align-items: center;
  gap: 14px;
  background: #ffffff;
  padding: 16px 18px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.cc-card-icon {
  width: 44px;
  height: 44px;
  border-radius: 10px;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
}

.cc-card-icon.caller { background: #eff6ff; color: #2563eb; }
.cc-card-icon.loan { background: #fef3c7; color: #d97706; }
.cc-card-icon.source { background: #ecfdf5; color: #059669; }
.cc-card-icon.meeting { background: #f5f3ff; color: #7c3aed; }

.cc-card-info {
  display: flex;
  flex-direction: column;
}

.cc-card-info .label {
  font-size: 12px;
  color: #64748b;
  font-weight: 500;
}

.cc-card-info .value {
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.cc-card-info small {
  font-size: 11.5px;
  color: #94a3b8;
}

/* Tabs */
.cc-lead-tabs-nav {
  display: flex;
  gap: 8px;
  background: #f1f5f9;
  padding: 5px;
  border-radius: 10px;
  overflow-x: auto;
}

.cc-lead-tab {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 9px 18px;
  border-radius: 8px;
  font-size: 13.5px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: none;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}

.cc-lead-tab.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
}

.cc-lead-tab .count-badge {
  background: #e2e8f0;
  color: #475569;
  font-size: 11px;
  padding: 2px 7px;
  border-radius: 10px;
  font-weight: 700;
}

.cc-lead-tab.active .count-badge {
  background: #eff6ff;
  color: #2563eb;
}

/* Tab Panels */
.cc-tab-panel {
  display: flex;
  flex-direction: column;
  gap: 18px;
}

.cc-panel-section-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
}

.cc-panel-section-header.mt-8 {
  margin-top: 18px;
  padding-top: 18px;
  border-top: 1px dashed #cbd5e1;
}

.cc-panel-section-header h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}

.cc-panel-section-header p {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: #64748b;
}

.cc-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}

.cc-action-btn.primary {
  background: #2563eb;
  border: none;
  color: #ffffff;
}

.cc-action-btn.primary:hover {
  background: #1d4ed8;
}

.cc-action-btn.secondary {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  color: #334155;
}

.cc-action-btn.secondary:hover {
  background: #f8fafc;
  color: #0f172a;
}

/* Empty State */
.cc-empty-state-box {
  background: #ffffff;
  border-radius: 12px;
  border: 1px dashed #cbd5e1;
  padding: 36px 20px;
  text-align: center;
  color: #64748b;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 10px;
}

.cc-empty-state-box h4 {
  margin: 0;
  font-size: 15px;
  color: #1e293b;
}

.cc-empty-state-box p {
  margin: 0;
  font-size: 13px;
  max-width: 440px;
}

.cc-empty-state-box.small {
  padding: 24px 16px;
}

/* Application Cards */
.cc-applications-cards-list {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cc-app-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 1px 3px rgba(0, 0, 0, 0.04);
}

.cc-app-card-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 12px;
  border-bottom: 1px solid #f1f5f9;
  padding-bottom: 14px;
}

.cc-app-header-title {
  display: flex;
  align-items: center;
  gap: 12px;
}

.cc-app-num {
  font-family: monospace;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}

.cc-app-product {
  font-size: 13px;
  font-weight: 600;
  color: #2563eb;
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 6px;
}

.cc-app-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 4px 12px;
  border-radius: 12px;
  font-size: 12px;
  font-weight: 700;
  border: 1px solid transparent;
}

.cc-app-status-badge .dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
}

.cc-app-details-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(220px, 1fr));
  gap: 16px;
}

.cc-app-meta-box {
  display: flex;
  flex-direction: column;
  gap: 5px;
}

.cc-app-meta-box .meta-label {
  font-size: 12px;
  color: #64748b;
  display: inline-flex;
  align-items: center;
  gap: 5px;
  font-weight: 500;
}

.meta-value-lender,
.meta-value-banker {
  display: flex;
  align-items: center;
  gap: 8px;
  font-size: 14px;
  color: #0f172a;
  flex-wrap: wrap;
}

.lender-type-tag {
  font-size: 11px;
  padding: 1px 6px;
  border-radius: 4px;
  font-weight: 600;
}

.meta-value.unassigned {
  font-size: 13px;
  color: #94a3b8;
  font-style: italic;
}

.meta-value-amounts {
  display: flex;
  gap: 14px;
  font-size: 13px;
  color: #334155;
  flex-wrap: wrap;
}

.cc-app-documents-section {
  display: flex;
  flex-direction: column;
  gap: 8px;
  background: #f8fafc;
  padding: 12px 16px;
  border-radius: 8px;
  border: 1px solid #f1f5f9;
}

.cc-app-documents-section .section-title {
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  display: inline-flex;
  align-items: center;
  gap: 6px;
}

.cc-app-docs-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}

.cc-doc-chip {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  background: #ffffff;
  border: 1px solid #cbd5e1;
  padding: 4px 10px;
  border-radius: 6px;
  font-size: 12px;
  color: #0f172a;
  text-decoration: none;
  transition: all 0.15s;
}

.cc-doc-chip:hover {
  border-color: #2563eb;
  color: #2563eb;
}

.cc-doc-chip .status {
  font-size: 10px;
  padding: 1px 4px;
  border-radius: 4px;
  font-weight: 700;
  text-transform: uppercase;
}

.cc-doc-chip .status.verified { background: #dcfce7; color: #15803d; }
.cc-doc-chip .status.pending { background: #fef9c3; color: #854d0e; }
.cc-doc-chip .status.rejected { background: #fee2e2; color: #b91c1c; }

/* Documents Table */
.cc-documents-table-shell {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  overflow-x: auto;
}

.cc-data-table {
  width: 100%;
  border-collapse: collapse;
  text-align: left;
}

.cc-data-table th {
  background: #f8fafc;
  padding: 12px 18px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
  text-transform: uppercase;
  border-bottom: 1px solid #e2e8f0;
}

.cc-data-table td {
  padding: 14px 18px;
  font-size: 13.5px;
  color: #1e293b;
  border-bottom: 1px solid #f1f5f9;
  vertical-align: middle;
}

.cc-doc-type-cell {
  display: flex;
  align-items: center;
  gap: 8px;
}

.file-name {
  font-family: monospace;
  font-size: 12.5px;
  color: #475569;
}

.cc-doc-status-badge {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 10px;
  font-size: 11px;
  font-weight: 700;
}

.cc-doc-status-badge.verified { background: #ecfdf5; color: #047857; }
.cc-doc-status-badge.pending { background: #fffbeb; color: #b45309; }
.cc-doc-status-badge.rejected { background: #fef2f2; color: #b91c1c; }

.cc-view-doc-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  color: #2563eb;
  padding: 5px 10px;
  border-radius: 6px;
  font-size: 12px;
  font-weight: 600;
  text-decoration: none;
  transition: all 0.15s;
}

.cc-view-doc-btn:hover {
  background: #dbeafe;
}

/* Timeline */
.cc-timeline-flow {
  display: flex;
  flex-direction: column;
  gap: 16px;
  background: #ffffff;
  padding: 24px 20px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}

.cc-timeline-item {
  display: flex;
  gap: 14px;
  position: relative;
}

.cc-timeline-marker {
  width: 10px;
  height: 10px;
  border-radius: 50%;
  background: #2563eb;
  margin-top: 6px;
  flex-shrink: 0;
  position: relative;
}

.cc-timeline-marker::after {
  content: "";
  position: absolute;
  top: 12px;
  left: 4px;
  bottom: -22px;
  width: 2px;
  background: #e2e8f0;
}

.cc-timeline-item:last-child .cc-timeline-marker::after {
  display: none;
}

.cc-timeline-content {
  display: flex;
  flex-direction: column;
  gap: 4px;
  width: 100%;
}

.cc-timeline-meta {
  display: flex;
  gap: 8px;
  font-size: 12.5px;
  align-items: center;
}

.cc-timeline-meta .actor { font-weight: 700; color: #0f172a; }
.cc-timeline-meta .action { background: #f1f5f9; padding: 1px 6px; border-radius: 4px; font-size: 11px; color: #475569; }
.cc-timeline-meta .time { color: #94a3b8; font-size: 12px; margin-left: auto; }

.cc-timeline-transition {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
}

.cc-timeline-transition .from { color: #64748b; }
.cc-timeline-transition .arrow { color: #94a3b8; font-size: 11px; }
.cc-timeline-transition .to { color: #059669; }

.cc-timeline-remark {
  margin: 2px 0 0;
  font-size: 13px;
  color: #334155;
  font-style: italic;
  background: #f8fafc;
  padding: 6px 12px;
  border-radius: 6px;
}

/* Modals */
.cc-modal-backdrop {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
  padding: 16px;
}

.cc-modal-box {
  background: #ffffff;
  border-radius: 14px;
  width: 480px;
  max-width: 100%;
  box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
  overflow: hidden;
}

.cc-modal-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 18px 22px;
  border-bottom: 1px solid #f1f5f9;
}

.cc-modal-header h3 {
  margin: 0;
  font-size: 16.5px;
  font-weight: 700;
  color: #0f172a;
}

.close-btn {
  border: none;
  background: transparent;
  color: #94a3b8;
  cursor: pointer;
}

.cc-modal-form {
  padding: 20px 22px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.form-group {
  display: flex;
  flex-direction: column;
  gap: 6px;
}

.form-group label {
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}

.form-group .req { color: #ef4444; }

.form-group input,
.form-group select {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 9px 12px;
  font-size: 13.5px;
  outline: none;
  color: #0f172a;
}

.form-group input:focus,
.form-group select:focus {
  border-color: #2563eb;
  box-shadow: 0 0 0 3px rgba(37, 99, 235, 0.12);
}

.form-group .help {
  font-size: 11.5px;
  color: #64748b;
}

.cc-modal-footer {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  margin-top: 8px;
}

.cc-btn {
  padding: 8px 16px;
  border-radius: 8px;
  font-size: 13px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
}

.cc-btn.ghost {
  background: #ffffff;
  border-color: #cbd5e1;
  color: #475569;
}

.cc-btn.primary {
  background: #2563eb;
  color: #ffffff;
}

.cc-btn.primary:disabled,
.cc-btn.ghost:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
`;
