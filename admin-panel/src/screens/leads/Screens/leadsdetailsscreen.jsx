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
  Check,
  Copy,
  Link,
  Lock,
  MessageSquare,
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
  UserCog,
  X,
  RotateCcw,
} from "lucide-react";
import API_URL, { CLIENT_PORTAL_URL } from "../../../config";
import LeadDocumentRequestModal from "../LeadDocumentRequestModal";

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
  const [docRequests, setDocRequests] = useState([]);
  const [docReqModalOpen, setDocReqModalOpen] = useState(false);
  const [allEmployeesList, setAllEmployeesList] = useState([]);
  const [reassignModalOpen, setReassignModalOpen] = useState(false);
  const [reassignTargetEmpId, setReassignTargetEmpId] = useState("");
  const [reassignReason, setReassignReason] = useState("");
  const [submittingReassign, setSubmittingReassign] = useState(false);

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

  const isReadOnly = Boolean(lead?.is_read_only);
  const canExport = !isEmployee && userPermissions.exportData !== false;
  const canViewCommission = !isEmployee && Boolean(userPermissions.viewPayouts || userPermissions.viewConnectors || userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN");
  const isCompanyAdmin = userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN";
  const canEditLead =
    !isReadOnly &&
    (isCompanyAdmin ||
      ["MANAGER", "OPS", "EMPLOYEE"].includes(userRole.toUpperCase()) ||
      ["manager", "operations", "calling", "employee", "sales"].includes(employeeRole?.toLowerCase()) ||
      userPermissions.editLead !== false);
  const canAssignLead =
    !isReadOnly &&
    (isCompanyAdmin ||
      (userPermissions.reassignLeads !== false &&
        (["MANAGER", "OPS", "EMPLOYEE"].includes(userRole.toUpperCase()) ||
          ["manager", "operations", "calling", "employee", "sales"].includes(employeeRole?.toLowerCase()) ||
          Boolean(userPermissions.reassignLeads || userPermissions.assignLead || userPermissions.manageLeads))));
  const canFollowupLead = !isReadOnly && (isCompanyAdmin || (userPermissions.followupLead !== undefined ? Boolean(userPermissions.followupLead) : Boolean(userPermissions.manageLeads !== false)));
  const canCreateLoanApplication =
    !isReadOnly &&
    (isCompanyAdmin ||
      Boolean(
        userPermissions.createLoanApplication ||
        userPermissions.createApplication ||
        userPermissions.manageOperations
      ));

  // Upload Doc Modal state
  const [uploadModalOpen, setUploadModalOpen] = useState(false);
  const [selectedDocType, setSelectedDocType] = useState("");
  const [docFiles, setDocFiles] = useState([]);
  const [uploadingDoc, setUploadingDoc] = useState(false);

  // Create Application Modal state
  const [createAppModalOpen, setCreateAppModalOpen] = useState(false);
  const [appForm, setAppForm] = useState({
    loanProduct: "",
    appliedAmount: "",
    lenderId: "",
  });
  const [submittingApp, setSubmittingApp] = useState(false);
  const [remarkModalOpen, setRemarkModalOpen] = useState(false);
  const [newRemarkText, setNewRemarkText] = useState("");
  const [newFollowupDate, setNewFollowupDate] = useState("");
  const [submittingRemark, setSubmittingRemark] = useState(false);

  const formatDateTime = (isoStr) => {
    if (!isoStr) return "--";
    const d = new Date(isoStr);
    if (isNaN(d.getTime())) return "--";
    return d.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
  };

  const getLeadFunnelMilestones = (status) => {
    const s = String(status || "").toUpperCase();
    const steps = [
      { key: "NEW", label: "Lead Ingestion", desc: "Fresh lead received" },
      { key: "CONTACTED", label: "Telecalling & Follow-up", desc: "Customer pitch & follow-up" },
      { key: "DOCS", label: "Documentation", desc: "KYC & income docs collection" },
      { key: "BANK_LOGIN", label: "Bank Processing", desc: "File logged in bank system" },
      { key: "SANCTIONED", label: "Sanctioned", desc: "Credit approval & offer issued" },
      { key: "DISBURSED", label: "Disbursed", desc: "Loan disbursed to account" },
    ];

    let currentStep = 0;
    if (s === "DISBURSED" || s === "LOAN DISBURSEMENT" || s === "CLOSED") {
      currentStep = 5;
    } else if (s === "SANCTIONED" || s === "LOAN SECTION" || s === "APPROVED") {
      currentStep = 4;
    } else if (s.includes("LOGIN") || s.includes("SUBMITTED") || s.includes("BANK") || s.includes("UNDERWRITING")) {
      currentStep = 3;
    } else if (s.includes("DOCUMENT") || s.includes("DOC") || s.includes("VERIFICATION") || s.includes("KYC")) {
      currentStep = 2;
    } else if (s.includes("FOLLOW") || s.includes("CALL") || s.includes("INTERESTED") || s.includes("MEETING")) {
      currentStep = 1;
    } else if (s === "REJECTED" || s === "CANCELLED") {
      currentStep = -1;
    } else {
      currentStep = 0;
    }

    return { steps, currentStep, isRejected: currentStep === -1 };
  };

  const handleSaveLeadRemark = async (e) => {
    e?.preventDefault();
    if (!newRemarkText.trim()) {
      toast.error("Please enter a remark");
      return;
    }
    setSubmittingRemark(true);
    try {
      const payload = {
        remark: newRemarkText.trim(),
      };
      if (newFollowupDate) {
        payload.nextFollowupDate = new Date(newFollowupDate).toISOString();
      }
      await axios.post(`${API_URL}/leads/${id}/remarks`, payload);
      toast.success("Remark added successfully");
      setRemarkModalOpen(false);
      setNewRemarkText("");
      setNewFollowupDate("");
      await Promise.all([fetchLeadDetails(), fetchHistoryDetails()]);
    } catch (err) {
      console.error("Failed to add remark:", err);
      toast.error(err.response?.data?.message || "Failed to add remark");
    } finally {
      setSubmittingRemark(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API_URL}/users`, { params: { limit: 200 } });
      const employeesList = response.data?.data || [];
      setAllEmployeesList(employeesList);
      const namesMap = {};
      employeesList.forEach((emp) => {
        namesMap[emp.id] = emp.name;
      });
      setPersonNames(namesMap);
    } catch (error) {
      console.error("Error fetching employees: ", error);
    }
  };

  const handleExecuteReassign = async (e) => {
    e.preventDefault();
    if (!reassignTargetEmpId) {
      toast.error("Please select an employee to reassign to");
      return;
    }
    setSubmittingReassign(true);
    try {
      const targetEmp = allEmployeesList.find((u) => String(u.id) === String(reassignTargetEmpId));
      await axios.put(`${API_URL}/leads/${id}`, {
        person_id: reassignTargetEmpId,
        reason: reassignReason || (targetEmp ? `Reassigned to ${targetEmp.name}` : undefined),
      });
      toast.success(targetEmp ? `Lead reassigned to ${targetEmp.name}!` : "Lead reassigned successfully!");
      setReassignModalOpen(false);
      setReassignReason("");
      await Promise.all([fetchLeadDetails(), fetchHistoryDetails()]);
    } catch (err) {
      console.error("Failed to reassign lead:", err);
      toast.error(err.response?.data?.message || "Failed to reassign lead");
    } finally {
      setSubmittingReassign(false);
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
        setDocRequests(data.documentRequests || []);
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

  const fetchDocRequests = async () => {
    try {
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/document-requests/lead/${id}`, {
        headers: { ...(token && { Authorization: `Bearer ${token}` }) },
      });
      if (res.data?.success) {
        setDocRequests(res.data.data || []);
      }
    } catch (e) {
      console.error("Error fetching doc requests:", e);
    }
  };

  const handleCancelDocRequest = async (requestId) => {
    if (!window.confirm("Are you sure you want to cancel and deactivate this upload link?")) return;
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/document-requests/${requestId}/cancel`,
        {},
        { headers: { ...(token && { Authorization: `Bearer ${token}` }) } }
      );
      toast.success("Document request link cancelled");
      fetchDocRequests();
    } catch (err) {
      toast.error("Failed to cancel link");
    }
  };

  const handleVerifyDocument = async (docId, status, reason = null) => {
    try {
      const token = localStorage.getItem("token");
      await axios.patch(
        `${API_URL}/documents/${docId}/verify`,
        { status, rejectionReason: reason },
        { headers: { ...(token && { Authorization: `Bearer ${token}` }) } }
      );
      toast.success(`Document marked as ${status}`);
      fetchLeadDetails();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update verification status");
    }
  };

  useEffect(() => {
    fetchDocRequests();
  }, [id]);

  const handleUploadDocument = async (e) => {
    e.preventDefault();
    if (!docFiles || docFiles.length === 0) {
      toast.error("Please select at least one file to upload");
      return;
    }
    if (!selectedDocType) {
      toast.error("Please select a document type");
      return;
    }

    // Check 25MB maximum limit per file
    const maxBytes = 25 * 1024 * 1024;
    for (const f of docFiles) {
      if (f.size > maxBytes) {
        toast.error(`File "${f.name}" exceeds the 25MB maximum size limit.`);
        return;
      }
    }

    setUploadingDoc(true);
    try {
      const formData = new FormData();
      docFiles.forEach((file) => {
        formData.append("files", file);
      });
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
      toast.success(`${docFiles.length} Document(s) uploaded successfully`);
      setUploadModalOpen(false);
      setDocFiles([]);
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
          {!isReadOnly && (
            <button
              type="button"
              className="cc-header-action-btn primary"
              style={{ backgroundColor: "#2563eb", color: "#ffffff", borderColor: "#1d4ed8" }}
              onClick={() => setDocReqModalOpen(true)}
              title="Generate secure document upload link for customer"
            >
              <Link size={15} />
              <span>Customer Doc Link</span>
            </button>
          )}
          {canAssignLead && (
            <button
              type="button"
              className="cc-header-action-btn"
              style={{ background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}
              onClick={() => {
                setReassignTargetEmpId(lead.person_id ? String(lead.person_id) : "");
                setReassignReason("");
                setReassignModalOpen(true);
              }}
              title="Reassign this lead to another company employee"
            >
              <UserCog size={15} />
              <span>Reassign Lead</span>
            </button>
          )}
          {canEditLead && (
            <button
              type="button"
              className="cc-header-action-btn edit"
              onClick={() => navigate(`/lead-edit/${lead.lead_id || lead.id}`)}
            >
              <Pencil size={15} />
              <span>Edit Lead</span>
            </button>
          )}
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

      {/* Worked Lead Read-Only Alert Banner */}
      {isReadOnly && (
        <div
          style={{
            display: "flex",
            alignItems: "flex-start",
            gap: "14px",
            background: "linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%)",
            border: "1px solid #fcd34d",
            borderRadius: "12px",
            padding: "16px 20px",
            marginBottom: "20px",
            boxShadow: "0 2px 4px rgba(217, 119, 6, 0.08)",
          }}
        >
          <div
            style={{
              background: "#f59e0b",
              color: "#ffffff",
              padding: "8px",
              borderRadius: "10px",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              flexShrink: 0,
            }}
          >
            <Lock size={18} />
          </div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
              <strong style={{ fontSize: "15px", color: "#92400e" }}>
                Worked Lead (Strict Read-Only Mode)
              </strong>
              <span
                style={{
                  fontSize: "12px",
                  fontWeight: 600,
                  padding: "2px 10px",
                  borderRadius: "9999px",
                  background: "#fde68a",
                  color: "#78350f",
                  border: "1px solid #f59e0b",
                }}
              >
                Currently Handled By: {lead.current_owner || lead.owner || "Another Staff"}
              </span>
            </div>
            <p style={{ margin: "6px 0 0", fontSize: "13px", lineHeight: "1.5", color: "#b45309" }}>
              You previously worked on this lead. You can review all details, documents, live loan status, latest remarks, call recordings, and full activity trail. However, modifications are locked while this lead is assigned to another team member.
            </p>
          </div>
        </div>
      )}

      {/* Key Info Banner Grid */}
      <div className="cc-lead-summary-grid">
        <div className="cc-summary-card">
          <span className="cc-card-icon caller">
            <UserCheck size={18} />
          </span>
          <div className="cc-card-info" style={{ width: "100%" }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <span className="label">Assigned Owner</span>
              {canAssignLead && (
                <button
                  type="button"
                  style={{
                    border: "none",
                    background: "transparent",
                    color: "#2563eb",
                    fontSize: "11px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                  }}
                  onClick={() => {
                    setReassignTargetEmpId(lead.person_id ? String(lead.person_id) : "");
                    setReassignReason("");
                    setReassignModalOpen(true);
                  }}
                >
                  Change ❯
                </button>
              )}
            </div>
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

      {/* 1. LEAD FUNNEL PROGRESSION / STAGE TRACKER (Kha tak pahucha hai) */}
      {(() => {
        const { steps, currentStep, isRejected } = getLeadFunnelMilestones(lead.status || lead.status_value);
        return (
          <div className="cc-lead-stage-journey-card">
            <div className="cc-stage-header">
              <div className="cc-stage-title-wrap">
                <span className="cc-stage-badge-pill" style={{
                  background: isRejected ? "#fef2f2" : "#ecfdf5",
                  color: isRejected ? "#b91c1c" : "#047857",
                  border: isRejected ? "1px solid #fecaca" : "1px solid #a7f3d0",
                }}>
                  {isRejected ? "❌ STATUS: REJECTED / CANCELLED" : `STAGE ${currentStep + 1} OF ${steps.length} • ${(steps[currentStep] || steps[0]).label.toUpperCase()}`}
                </span>
                <span className="cc-stage-status-text">
                  Lead Status: <strong style={{ color: "#0f172a" }}>{lead.status}</strong>
                </span>
              </div>
              <div className="cc-stage-progress-percentage">
                {isRejected ? "Dropped" : `${Math.round(((currentStep + 1) / steps.length) * 100)}% Completed`}
              </div>
            </div>

            <div className="cc-stage-stepper">
              {steps.map((st, idx) => {
                const isCompleted = !isRejected && idx < currentStep;
                const isCurrent = !isRejected && idx === currentStep;
                return (
                  <div key={st.key} className={`cc-step-item ${isCompleted ? "completed" : ""} ${isCurrent ? "current" : ""} ${isRejected ? "rejected" : ""}`}>
                    <div className="cc-step-indicator">
                      {isCompleted ? <Check size={14} /> : <span>{idx + 1}</span>}
                    </div>
                    <div className="cc-step-info">
                      <div className="cc-step-name">{st.label}</div>
                      <div className="cc-step-desc">{st.desc}</div>
                    </div>
                    {idx < steps.length - 1 && <div className={`cc-step-connector ${isCompleted ? "completed" : ""}`} />}
                  </div>
                );
              })}
            </div>
          </div>
        );
      })()}

      {/* 2. LATEST REMARK BANNER (PROMINENT AT TOP WITH DATE & TIME) */}
      {(() => {
        const latestText =
          lead.latest_remark ||
          lead.last_remark ||
          lead.remarks ||
          histories?.find((h) => h.remarks)?.remarks;
        const latestDate =
          lead.latest_remark_date ||
          histories?.find((h) => h.remarks)?.createdAt ||
          lead.updatedAt;
        const latestBy =
          lead.latest_remark_by ||
          histories?.find((h) => h.remarks)?.actor ||
          lead.owner ||
          "Staff";

        return (
          <div className="cc-lead-latest-remark-card">
            <div className="cc-remark-card-left">
              <div className="cc-remark-icon-circle">
                <MessageSquare size={22} />
              </div>
              <div className="cc-remark-content">
                <div className="cc-remark-top-meta">
                  <span className="cc-remark-tag">💬 LATEST REMARK</span>
                  {latestText && (
                    <>
                      <span className="cc-remark-meta-item">
                        <Clock size={12} />
                        {formatDateTime(latestDate)}
                      </span>
                      <span className="cc-remark-meta-item user">
                        <User size={12} />
                        By {latestBy}
                      </span>
                    </>
                  )}
                </div>
                <div className="cc-remark-body-text">
                  {latestText ? (
                    `"${latestText}"`
                  ) : (
                    <span style={{ color: "#94a3b8", fontStyle: "italic", fontWeight: 400 }}>
                      No remarks recorded for this lead yet. Click button to log the first remark.
                    </span>
                  )}
                </div>
              </div>
            </div>
            <div className="cc-remark-card-right">
              {isReadOnly ? (
                <div
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 14px",
                    borderRadius: "8px",
                    background: "#f1f5f9",
                    color: "#64748b",
                    fontSize: "12px",
                    fontWeight: 600,
                    border: "1px solid #e2e8f0",
                  }}
                  title="Lead is currently assigned to another employee"
                >
                  <Lock size={13} />
                  <span>Read Only Mode</span>
                </div>
              ) : (
                <button
                  type="button"
                  className="cc-add-remark-btn"
                  onClick={() => {
                    setNewRemarkText("");
                    setRemarkModalOpen(true);
                  }}
                >
                  <Plus size={15} />
                  <span>{latestText ? "Add / Update Remark" : "Add Remark"}</span>
                </button>
              )}
            </div>
          </div>
        );
      })()}

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
        <button
          type="button"
          className={`cc-lead-tab ${activeTab === "assignment" ? "active" : ""}`}
          onClick={() => setActiveTab("assignment")}
        >
          <UserCheck size={16} />
          <span>Assignment History</span>
          <span className="count-badge">{(lead?.assignment_history || []).length}</span>
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
            {canCreateLoanApplication && (
              <button
                type="button"
                className="cc-action-btn primary"
                onClick={() => setCreateAppModalOpen(true)}
              >
                <Plus size={15} />
                <span>Create Loan Application</span>
              </button>
            )}
          </div>

          {applications.length === 0 ? (
            <div className="cc-empty-state-box">
              <Briefcase size={36} />
              <h4>No Loan Application created yet for this lead</h4>
              <p>
                You can create a loan application to assign a Bank / NBFC partner (or DSA channel) and start document verification.
              </p>
              {canCreateLoanApplication && (
                <button
                  type="button"
                  className="cc-action-btn primary"
                  onClick={() => setCreateAppModalOpen(true)}
                >
                  <Plus size={15} />
                  <span>Create Loan Application</span>
                </button>
              )}
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
                        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", flexWrap: "wrap", gap: "8px", marginBottom: "6px" }}>
                          <span className="section-title" style={{ margin: 0 }}>
                            <Files size={13} /> Documents attached to this application ({app.documents.length}):
                          </span>
                          <a
                            href={`${API_URL}/documents/application/${app.id}/download-all?token=${localStorage.getItem("token")}`}
                            style={{
                              fontSize: "11px",
                              fontWeight: 700,
                              color: "#059669",
                              textDecoration: "none",
                              display: "inline-flex",
                              alignItems: "center",
                              gap: "4px",
                              background: "#ecfdf5",
                              border: "1px solid #a7f3d0",
                              borderRadius: "6px",
                              padding: "2px 8px",
                            }}
                            title="Download all attached documents as ZIP"
                          >
                            <Download size={11} /> Download ZIP
                          </a>
                        </div>
                        <div className="cc-app-docs-chips">
                          {app.documents.map((doc) => (
                            <span key={doc.id} className="cc-doc-chip" style={{ display: "inline-flex", alignItems: "center", gap: "6px" }}>
                              <a
                                href={doc.fileUrl ? `${API_URL.replace(/\/api\/?$/, "")}${doc.fileUrl}` : "#"}
                                target="_blank"
                                rel="noreferrer"
                                style={{ display: "inline-flex", alignItems: "center", gap: "5px", textDecoration: "none", color: "inherit" }}
                                title={`View ${doc.fileName || doc.docType}`}
                              >
                                <FileText size={13} />
                                <span className="name">{doc.docType}</span>
                                <span className={`status ${String(doc.verificationStatus || doc.status).toLowerCase()}`}>
                                  {doc.verificationStatus || doc.status || "PENDING"}
                                </span>
                                <ExternalLink size={12} />
                              </a>
                              <a
                                href={`${API_URL}/documents/${doc.id}/download?token=${localStorage.getItem("token")}`}
                                download={doc.fileName || `${doc.docType}.pdf`}
                                title={`Download ${doc.fileName || doc.docType}`}
                                style={{ color: "#2563eb", padding: "1px 4px", display: "inline-flex", alignItems: "center" }}
                              >
                                <Download size={12} />
                              </a>
                            </span>
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
            <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
              {documents.length > 0 && (
                <a
                  href={`${API_URL}/documents/lead/${id}/download-all?token=${localStorage.getItem("token")}`}
                  className="cc-action-btn secondary"
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    backgroundColor: "#ecfdf5",
                    color: "#059669",
                    borderColor: "#a7f3d0",
                    fontWeight: 700,
                  }}
                  title="Download all documents for this lead in a single ZIP file"
                >
                  <Download size={14} />
                  <span>Download All ({documents.length} Docs ZIP)</span>
                </a>
              )}
              {!isReadOnly && (
                <>
                  <button
                    type="button"
                    className="cc-action-btn primary"
                    style={{ backgroundColor: "#2563eb", color: "#ffffff" }}
                    onClick={() => setDocReqModalOpen(true)}
                  >
                    <Link size={14} />
                    <span>Customer Upload Link</span>
                  </button>
                  <button
                    type="button"
                    className="cc-action-btn secondary"
                    onClick={() => {
                      setDocFiles([]);
                      setUploadModalOpen(true);
                    }}
                  >
                    <Upload size={14} />
                    <span>Staff Upload</span>
                  </button>
                </>
              )}
            </div>
          </div>

          {/* Active Customer Upload Links Card */}
          {docRequests.length > 0 && (
            <div style={{ marginBottom: "20px", background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: "12px", padding: "16px" }}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "between", marginBottom: "12px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <ShieldCheck size={18} color="#2563eb" />
                  <strong style={{ fontSize: "14px", color: "#1e293b" }}>
                    Active Customer Document Collection Links ({docRequests.length})
                  </strong>
                </div>
              </div>
              <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(320px, 1fr))", gap: "12px" }}>
                {docRequests.map((req) => {
                  const baseUrl = CLIENT_PORTAL_URL || "https://loan-crm-saasbased.vercel.app";
                  const uploadUrl = `${baseUrl.replace(/\/+$/, "")}/upload-docs/${req.token}`;
                  const isCompleted = req.status === "COMPLETED";
                  const isCancelled = req.status === "CANCELLED";
                  const total = (req.requiredDocs || []).length;
                  const uploaded = (req.requiredDocs || []).filter((d) => d.status === "UPLOADED").length;

                  return (
                    <div
                      key={req.id}
                      style={{
                        background: "#ffffff",
                        border: isCompleted ? "1px solid #86efac" : "1px solid #cbd5e1",
                        borderRadius: "10px",
                        padding: "12px 14px",
                        boxShadow: "0 1px 3px rgba(0,0,0,0.05)",
                      }}
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "6px" }}>
                        <span style={{ fontSize: "12px", fontWeight: 700, color: "#334155" }}>
                          {req.title || "Document Collection"}
                        </span>
                        <span
                          style={{
                            fontSize: "10px",
                            fontWeight: 700,
                            padding: "2px 8px",
                            borderRadius: "9999px",
                            background: isCompleted ? "#dcfce7" : isCancelled ? "#fee2e2" : "#e0e7ff",
                            color: isCompleted ? "#15803d" : isCancelled ? "#b91c1c" : "#4338ca",
                          }}
                        >
                          {req.status} ({uploaded}/{total})
                        </span>
                      </div>

                      <div style={{ fontSize: "11px", color: "#64748b", marginBottom: "8px" }}>
                        Created: {new Date(req.createdAt).toLocaleDateString("en-IN")}
                        {req.expiresAt && ` • Expires: ${new Date(req.expiresAt).toLocaleDateString("en-IN")}`}
                        {req.accessCount > 0 && ` • Opened: ${req.accessCount} times`}
                      </div>

                      <div style={{ display: "flex", gap: "6px", flexWrap: "wrap", alignItems: "center" }}>
                        <button
                          type="button"
                          onClick={() => {
                            navigator.clipboard.writeText(uploadUrl);
                            toast.success("Customer link copied!");
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            borderRadius: "6px",
                            background: "#eff6ff",
                            color: "#1d4ed8",
                            border: "1px solid #bfdbfe",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontWeight: 600,
                          }}
                        >
                          <Copy size={11} /> Copy Link
                        </button>

                        <button
                          type="button"
                          onClick={() => {
                            let phone = (lead?.number || "").replace(/[^0-9]/g, "");
                            if (phone.length === 10) phone = `91${phone}`;
                            const msg = `Dear ${lead?.customer?.name || "Customer"},\n\nPlease upload the required documents for your loan processing using our secure portal:\n🔗 ${uploadUrl}\n\nThank you!`;
                            window.open(`https://wa.me/${phone}?text=${encodeURIComponent(msg)}`, "_blank");
                          }}
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            borderRadius: "6px",
                            background: "#ecfdf5",
                            color: "#047857",
                            border: "1px solid #a7f3d0",
                            cursor: "pointer",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                            fontWeight: 600,
                          }}
                        >
                          <MessageSquare size={11} /> WhatsApp
                        </button>

                        <a
                          href={uploadUrl}
                          target="_blank"
                          rel="noreferrer"
                          style={{
                            padding: "4px 8px",
                            fontSize: "11px",
                            borderRadius: "6px",
                            background: "#f8fafc",
                            color: "#475569",
                            border: "1px solid #cbd5e1",
                            textDecoration: "none",
                            display: "inline-flex",
                            alignItems: "center",
                            gap: "4px",
                          }}
                        >
                          <Eye size={11} /> Preview
                        </a>

                        {!isReadOnly && !isCancelled && !isCompleted && (
                          <button
                            type="button"
                            onClick={() => handleCancelDocRequest(req.id)}
                            style={{
                              padding: "4px 8px",
                              fontSize: "11px",
                              borderRadius: "6px",
                              background: "#fff1f2",
                              color: "#be123c",
                              border: "1px solid #fecdd3",
                              cursor: "pointer",
                              marginLeft: "auto",
                            }}
                          >
                            Deactivate
                          </button>
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          {documents.length === 0 ? (
            <div className="cc-empty-state-box small">
              <Files size={30} />
              <p>No KYC documents uploaded for this lead yet.</p>
              {!isReadOnly && (
                <button
                  type="button"
                  className="cc-action-btn secondary"
                  onClick={() => setUploadModalOpen(true)}
                >
                  <Upload size={14} />
                  <span>Upload First Document</span>
                </button>
              )}
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
                        <td>
                          {doc.isCustomerUpload || !doc.uploadedBy ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "2px 8px",
                                borderRadius: "9999px",
                                fontSize: "11px",
                                fontWeight: 700,
                                background: "#f3e8ff",
                                color: "#6b21a8",
                                border: "1px solid #d8b4fe",
                              }}
                            >
                              <Share2 size={10} /> Customer (Via Link)
                            </span>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#334155", fontWeight: 500 }}>
                              {doc.uploader?.name || "Staff / Ops"}
                            </span>
                          )}
                        </td>
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
                          <div style={{ display: "inline-flex", gap: "6px", alignItems: "center" }}>
                            <a
                              href={fileLink}
                              target="_blank"
                              rel="noreferrer"
                              className="cc-view-doc-btn"
                            >
                              <Eye size={13} />
                              <span>View</span>
                            </a>
                            <a
                              href={`${API_URL}/documents/${doc.id}/download?token=${localStorage.getItem("token")}`}
                              download={doc.fileName || `${doc.docType}.pdf`}
                              className="cc-view-doc-btn"
                              style={{ background: "#eff6ff", color: "#1d4ed8", borderColor: "#bfdbfe" }}
                              title={`Download ${doc.fileName || doc.docType}`}
                            >
                              <Download size={13} />
                              <span>Download</span>
                            </a>
                            {!isReadOnly && (
                              <>
                                {isVerified ? (
                                  <>
                                    <span
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        borderRadius: "6px",
                                        background: "#ecfdf5",
                                        color: "#059669",
                                        border: "1px solid #a7f3d0",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                      title="Document Approved & Verified"
                                    >
                                      <CheckCircle2 size={12} /> Approved
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyDocument(doc.id, "PENDING")}
                                      style={{
                                        padding: "4px 6px",
                                        fontSize: "11px",
                                        borderRadius: "6px",
                                        background: "#f8fafc",
                                        color: "#64748b",
                                        border: "1px solid #e2e8f0",
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                      }}
                                      title="Reset status back to Pending"
                                    >
                                      <RotateCcw size={11} />
                                    </button>
                                  </>
                                ) : isRejected ? (
                                  <>
                                    <span
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "11px",
                                        fontWeight: 700,
                                        borderRadius: "6px",
                                        background: "#fef2f2",
                                        color: "#dc2626",
                                        border: "1px solid #fecaca",
                                        display: "inline-flex",
                                        alignItems: "center",
                                        gap: "4px",
                                      }}
                                      title={`Document Rejected: ${doc.rejectionReason || "Issue with document"}`}
                                    >
                                      <X size={12} /> Rejected
                                    </span>
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyDocument(doc.id, "PENDING")}
                                      style={{
                                        padding: "4px 6px",
                                        fontSize: "11px",
                                        borderRadius: "6px",
                                        background: "#f8fafc",
                                        color: "#64748b",
                                        border: "1px solid #e2e8f0",
                                        cursor: "pointer",
                                        display: "inline-flex",
                                        alignItems: "center",
                                      }}
                                      title="Reset status back to Pending"
                                    >
                                      <RotateCcw size={11} />
                                    </button>
                                  </>
                                ) : (
                                  <>
                                    <button
                                      type="button"
                                      onClick={() => handleVerifyDocument(doc.id, "VERIFIED")}
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        borderRadius: "6px",
                                        background: "#ecfdf5",
                                        color: "#059669",
                                        border: "1px solid #a7f3d0",
                                        cursor: "pointer",
                                      }}
                                      title="Approve and mark document verified"
                                    >
                                      Approve
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        const reason = window.prompt("Enter rejection reason for this document:");
                                        if (reason) handleVerifyDocument(doc.id, "REJECTED", reason);
                                      }}
                                      style={{
                                        padding: "4px 8px",
                                        fontSize: "11px",
                                        fontWeight: 600,
                                        borderRadius: "6px",
                                        background: "#fef2f2",
                                        color: "#dc2626",
                                        border: "1px solid #fecaca",
                                        cursor: "pointer",
                                      }}
                                      title="Reject document"
                                    >
                                      Reject
                                    </button>
                                  </>
                                )}
                              </>
                            )}
                          </div>
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

      {/* TAB CONTENT: ASSIGNMENT HISTORY */}
      {activeTab === "assignment" && (
        <div className="cc-tab-panel">
          <div className="cc-panel-section-header">
            <div>
              <h3>Lead Assignment &amp; Ownership Trail ({(lead?.assignment_history || []).length})</h3>
              <p>Complete track record of employees who handled this lead, handovers, and active ownership</p>
            </div>
          </div>

          {(!lead?.assignment_history || lead.assignment_history.length === 0) ? (
            <div className="cc-empty-state-box">
              <UserCheck size={36} />
              <h4>No reassignment history recorded</h4>
              <p>This lead is currently with its initial assigned owner ({lead?.owner || "Unassigned"}).</p>
            </div>
          ) : (
            <div className="cc-documents-table-shell">
              <table className="cc-data-table">
                <thead>
                  <tr>
                    <th>Assigned Employee</th>
                    <th>Role</th>
                    <th>Assignment Status</th>
                    <th>Assigned By</th>
                    <th>Assigned On</th>
                    <th>Handed Off On</th>
                    <th>Notes / Handover Reason</th>
                  </tr>
                </thead>
                <tbody>
                  {lead.assignment_history.map((record, index) => {
                    const isActive = record.is_active;
                    return (
                      <tr key={record.id || index} style={{ backgroundColor: isActive ? "#f0fdf4" : undefined }}>
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                            <div
                              style={{
                                width: "32px",
                                height: "32px",
                                borderRadius: "50%",
                                backgroundColor: isActive ? "#dcfce7" : "#f1f5f9",
                                color: isActive ? "#15803d" : "#475569",
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                fontWeight: 700,
                                fontSize: "13px",
                              }}
                            >
                              {(record.assignee_name || "E").charAt(0).toUpperCase()}
                            </div>
                            <div>
                              <strong style={{ color: isActive ? "#15803d" : "#1e293b", fontSize: "14px" }}>
                                {record.assignee_name || "Employee"}
                              </strong>
                              {isActive && (
                                <span
                                  style={{
                                    display: "inline-block",
                                    marginLeft: "6px",
                                    fontSize: "11px",
                                    padding: "1px 6px",
                                    borderRadius: "4px",
                                    backgroundColor: "#16a34a",
                                    color: "#ffffff",
                                    fontWeight: 600,
                                  }}
                                >
                                  Current Owner
                                </span>
                              )}
                            </div>
                          </div>
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", color: "#64748b" }}>
                            {record.assignee_role || "--"}
                          </span>
                        </td>
                        <td>
                          {isActive ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                backgroundColor: "#dcfce7",
                                color: "#166534",
                                border: "1px solid #bbf7d0",
                              }}
                            >
                              <CheckCircle2 size={12} /> Active Handler
                            </span>
                          ) : (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: "4px",
                                padding: "3px 8px",
                                borderRadius: "6px",
                                fontSize: "12px",
                                fontWeight: 600,
                                backgroundColor: "#f1f5f9",
                                color: "#475569",
                                border: "1px solid #e2e8f0",
                              }}
                            >
                              <Clock size={12} /> Past Handler
                            </span>
                          )}
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", color: "#334155" }}>
                            {record.assigned_by_name || "System"}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", color: "#334155" }}>
                            {formatDateTime(record.assigned_at)}
                          </span>
                        </td>
                        <td>
                          <span
                            style={{
                              fontSize: "13px",
                              color: isActive ? "#16a34a" : "#64748b",
                              fontWeight: isActive ? 600 : 400,
                            }}
                          >
                            {isActive ? "Currently Working" : formatDateTime(record.unassigned_at)}
                          </span>
                        </td>
                        <td>
                          <span style={{ fontSize: "13px", color: "#475569" }}>
                            {record.notes || "--"}
                          </span>
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
                  Select File(s) <span className="req">*</span>
                  <span style={{ fontSize: "11.5px", color: "#64748b", marginLeft: "6px", fontWeight: "normal" }}>
                    (Multiple files allowed &bull; Max 25MB per file)
                  </span>
                </label>
                <input
                  type="file"
                  multiple
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.doc,.docx,.xls,.xlsx,.csv"
                  onChange={(e) => {
                    const files = Array.from(e.target.files || []);
                    const oversized = files.find((f) => f.size > 25 * 1024 * 1024);
                    if (oversized) {
                      toast.error(`File "${oversized.name}" exceeds the 25MB maximum size limit!`);
                      return;
                    }
                    setDocFiles(files);
                  }}
                  required
                />
                <small className="help">
                  Accepted: PDF, Images (.jpg, .png), Word, Excel &bull; <strong>Max 25MB per file</strong>
                </small>

                {docFiles && docFiles.length > 0 && (
                  <div style={{ marginTop: "10px", display: "flex", flexDirection: "column", gap: "5px" }}>
                    <div style={{ fontSize: "12px", fontWeight: "600", color: "#334155" }}>
                      Selected Files ({docFiles.length}):
                    </div>
                    <div style={{ maxHeight: "110px", overflowY: "auto", display: "flex", flexDirection: "column", gap: "4px" }}>
                      {docFiles.map((f, i) => (
                        <div
                          key={i}
                          style={{
                            display: "flex",
                            alignItems: "center",
                            justifyContent: "space-between",
                            padding: "4px 8px",
                            backgroundColor: "#f8fafc",
                            border: "1px solid #e2e8f0",
                            borderRadius: "6px",
                            fontSize: "11.5px",
                          }}
                        >
                          <span style={{ overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", maxWidth: "260px" }}>
                            📄 {f.name}
                          </span>
                          <span style={{ color: "#64748b", fontSize: "11px", shrink: 0 }}>
                            {(f.size / (1024 * 1024)).toFixed(1)} MB
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
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
                  disabled={uploadingDoc || !docFiles || docFiles.length === 0}
                >
                  {uploadingDoc ? "Uploading..." : `Upload ${docFiles?.length > 1 ? `${docFiles.length} Documents` : "Document"}`}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: CREATE LOAN APPLICATION */}
      {createAppModalOpen && canCreateLoanApplication && (
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

      {/* MODAL: ADD / UPDATE REMARK */}
      {remarkModalOpen && (
        <div className="cc-modal-backdrop" onClick={() => setRemarkModalOpen(false)}>
          <div className="cc-modal-box" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <h3>
                <MessageSquare size={18} style={{ color: "#047857" }} />
                Add Remark for Lead #{lead.lead_id || lead.id}
              </h3>
              <button
                type="button"
                className="cc-modal-close"
                onClick={() => setRemarkModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveLeadRemark} className="cc-modal-form">
              <div className="cc-form-group">
                <label>
                  Remark Notes <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter detailed observation, customer requirement, follow-up conversation notes..."
                  value={newRemarkText}
                  onChange={(e) => setNewRemarkText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: "10px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    fontFamily: "inherit",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>

              <div className="cc-form-group">
                <label>Next Follow-up Date &amp; Time (Optional)</label>
                <input
                  type="datetime-local"
                  value={newFollowupDate}
                  onChange={(e) => setNewFollowupDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: "8px",
                    border: "1px solid #cbd5e1",
                    fontSize: "13px",
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div className="cc-modal-actions" style={{ marginTop: 12 }}>
                <button
                  type="button"
                  className="cc-btn ghost"
                  onClick={() => setRemarkModalOpen(false)}
                  disabled={submittingRemark}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-btn primary"
                  disabled={submittingRemark}
                >
                  {submittingRemark ? "Saving..." : "Save Remark"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: LEAD DOCUMENT REQUEST */}
      <LeadDocumentRequestModal
        isOpen={docReqModalOpen && !isReadOnly}
        onClose={() => setDocReqModalOpen(false)}
        lead={lead}
        onSuccess={() => {
          fetchLeadDetails();
          fetchDocRequests();
        }}
      />

      {/* MODAL: REASSIGN LEAD */}
      {reassignModalOpen && (
        <div className="cc-modal-overlay" onClick={() => setReassignModalOpen(false)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 440 }}>
            <div className="cc-modal-header">
              <div>
                <h3 style={{ margin: 0, fontSize: 17, fontWeight: 700, color: "#0f172a" }}>Reassign Lead Ownership</h3>
                <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Transfer lead #{lead?.lead_id || lead?.id} ({lead?.name || "Customer"}) to another company employee
                </p>
              </div>
              <button
                type="button"
                className="cc-modal-close-btn"
                onClick={() => setReassignModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleExecuteReassign} style={{ padding: "16px 20px" }}>
              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                  Current Owner
                </label>
                <div style={{ padding: "8px 12px", background: "#f8fafc", borderRadius: 8, border: "1px solid #e2e8f0", fontSize: 13, fontWeight: 600, color: "#334155" }}>
                  👤 {lead?.owner || "Unassigned"} {lead?.person_id ? `(ID: ${lead.person_id})` : ""}
                </div>
              </div>

              <div style={{ marginBottom: 14 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                  Select New Employee *
                </label>
                <select
                  required
                  value={reassignTargetEmpId}
                  onChange={(e) => setReassignTargetEmpId(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "9px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    background: "#fff",
                  }}
                >
                  <option value="" disabled>-- Select an active employee --</option>
                  {allEmployeesList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role || "Staff"}{emp.branch?.name ? ` • ${emp.branch.name}` : ""})
                    </option>
                  ))}
                </select>
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: "block", fontSize: 12, fontWeight: 600, color: "#475569", marginBottom: 6 }}>
                  Reassignment Reason / Remark (Optional)
                </label>
                <textarea
                  rows={2}
                  value={reassignReason}
                  onChange={(e) => setReassignReason(e.target.value)}
                  placeholder="e.g. Workload balancing, language preference, or branch reassignment"
                  style={{
                    width: "100%",
                    padding: "8px 12px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 12.5,
                  }}
                />
              </div>

              <div style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="cc-modal-btn cancel"
                  onClick={() => setReassignModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingReassign || !reassignTargetEmpId}
                  className="cc-modal-btn submit"
                  style={{ background: "#2563eb", color: "#fff" }}
                >
                  {submittingReassign ? "Reassigning..." : "Confirm Reassign"}
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

/* Documents Table & Details Tables */
.cc-documents-table-shell {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #cbd5e1;
  overflow-x: auto;
  overflow-y: auto;
  max-height: 480px;
  box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
  position: relative;
}

.cc-documents-table-shell::-webkit-scrollbar {
  width: 7px;
  height: 7px;
}
.cc-documents-table-shell::-webkit-scrollbar-track {
  background: #f1f5f9;
}
.cc-documents-table-shell::-webkit-scrollbar-thumb {
  background: #cbd5e1;
  border-radius: 4px;
}
.cc-documents-table-shell::-webkit-scrollbar-thumb:hover {
  background: #94a3b8;
}

.cc-data-table {
  width: 100%;
  border-collapse: separate;
  border-spacing: 0;
  text-align: left;
}

.cc-data-table th {
  position: sticky;
  top: 0;
  z-index: 20;
  background: #f1f5f9 !important;
  padding: 12px 16px;
  font-size: 11.5px;
  font-weight: 700;
  color: #334155;
  text-transform: uppercase;
  letter-spacing: 0.05em;
  border-bottom: 2px solid #cbd5e1;
  border-right: 1px solid #e2e8f0;
  white-space: nowrap;
  box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04);
}

.cc-data-table th:last-child {
  border-right: none;
}

.cc-data-table td {
  padding: 13px 16px;
  font-size: 13px;
  color: #1e293b;
  border-bottom: 1px solid #e2e8f0;
  border-right: 1px solid #edf2f7;
  vertical-align: middle;
  background: #ffffff;
  transition: background-color 0.12s ease;
}

.cc-data-table td:last-child {
  border-right: none;
}

.cc-data-table tbody tr:nth-child(even) td {
  background: #fafbfc;
}

.cc-data-table tbody tr:hover td {
  background: #f0fdf4 !important;
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

/* Funnel Stage Stepper Styling */
.cc-lead-stage-journey-card {
  background: #ffffff;
  border-radius: 16px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 2px 10px rgba(15, 23, 42, 0.04);
  padding: 16px 20px;
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.cc-stage-header {
  display: flex;
  justify-content: space-between;
  align-items: center;
  flex-wrap: wrap;
  gap: 10px;
}

.cc-stage-title-wrap {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}

.cc-stage-badge-pill {
  padding: 4px 10px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.3px;
}

.cc-stage-status-text {
  font-size: 13px;
  color: #64748b;
}

.cc-stage-progress-percentage {
  font-size: 12.5px;
  font-weight: 700;
  color: #047857;
  background: #ecfdf5;
  padding: 3px 10px;
  border-radius: 8px;
  border: 1px solid #a7f3d0;
}

.cc-stage-stepper {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 8px;
  overflow-x: auto;
  padding-bottom: 4px;
}

.cc-step-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
  flex: 1;
  min-width: 110px;
  position: relative;
}

.cc-step-indicator {
  width: 32px;
  height: 32px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 12px;
  font-weight: 700;
  background: #f1f5f9;
  color: #64748b;
  border: 2px solid #cbd5e1;
  z-index: 2;
  transition: all 0.2s ease;
}

.cc-step-item.completed .cc-step-indicator {
  background: #047857;
  color: #ffffff;
  border-color: #047857;
}

.cc-step-item.current .cc-step-indicator {
  background: #2563eb;
  color: #ffffff;
  border-color: #2563eb;
  box-shadow: 0 0 0 4px rgba(37, 99, 235, 0.18);
  transform: scale(1.08);
}

.cc-step-item.rejected .cc-step-indicator {
  background: #dc2626;
  color: #ffffff;
  border-color: #dc2626;
}

.cc-step-info {
  margin-top: 8px;
  display: flex;
  flex-direction: column;
  gap: 2px;
}

.cc-step-name {
  font-size: 12px;
  font-weight: 700;
  color: #64748b;
}

.cc-step-item.completed .cc-step-name {
  color: #0f172a;
}

.cc-step-item.current .cc-step-name {
  color: #2563eb;
}

.cc-step-desc {
  font-size: 10px;
  color: #94a3b8;
  line-height: 1.3;
}

.cc-step-connector {
  position: absolute;
  top: 16px;
  left: 50%;
  width: 100%;
  height: 2px;
  background: #e2e8f0;
  z-index: 1;
}

.cc-step-connector.completed {
  background: #047857;
}

/* Latest Remark Card Styling */
.cc-lead-latest-remark-card {
  background: linear-gradient(135deg, #f0fdf4 0%, #ffffff 60%, #eff6ff 100%);
  border-radius: 16px;
  border: 1px solid #bbf7d0;
  box-shadow: 0 4px 16px rgba(4, 120, 87, 0.06);
  padding: 16px 20px;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 16px;
  flex-wrap: wrap;
}

.cc-remark-card-left {
  display: flex;
  align-items: flex-start;
  gap: 14px;
  flex: 1;
  min-width: 260px;
}

.cc-remark-icon-circle {
  width: 44px;
  height: 44px;
  border-radius: 12px;
  background: #dcfce7;
  color: #047857;
  display: flex;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  border: 1px solid #86efac;
}

.cc-remark-content {
  display: flex;
  flex-direction: column;
  gap: 6px;
  flex: 1;
}

.cc-remark-top-meta {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

.cc-remark-tag {
  font-size: 11px;
  font-weight: 800;
  letter-spacing: 0.5px;
  color: #047857;
}

.cc-remark-meta-item {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  color: #475569;
  background: rgba(255, 255, 255, 0.8);
  padding: 2px 8px;
  border-radius: 6px;
  border: 1px solid #e2e8f0;
  font-weight: 600;
}

.cc-remark-meta-item.user {
  color: #1d4ed8;
  border-color: #bfdbfe;
  background: #eff6ff;
}

.cc-remark-body-text {
  font-size: 14px;
  font-weight: 600;
  color: #0f172a;
  line-height: 1.5;
  word-break: break-word;
}

.cc-remark-card-right {
  display: flex;
  align-items: center;
}

.cc-add-remark-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 9px 16px;
  border-radius: 10px;
  font-size: 13px;
  font-weight: 700;
  background: #047857;
  color: #ffffff;
  border: 0;
  cursor: pointer;
  box-shadow: 0 2px 6px rgba(4, 120, 87, 0.2);
  transition: all 0.2s ease;
}

.cc-add-remark-btn:hover {
  background: #065f46;
  transform: translateY(-1px);
}
`;
