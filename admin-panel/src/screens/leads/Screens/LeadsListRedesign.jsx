import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import moment from "moment";
import { useNavigate, useLocation } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import * as XLSX from "xlsx";
import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  Download,
  Eye,
  Pencil,
  Plus,
  Search,
  Trash2,
  UserCog,
  Link,
  Clock,
  MessageSquare,
  Filter,
  CheckCircle2,
  ChevronDown,
  X,
  Check,
  Building2,
  Coins,
  ArrowUpDown,
  Phone,
} from "lucide-react";
import API_URL from "../../../config";
import AddLeadModal from "../AddLeadModal";
import LeadDocumentRequestModal from "../LeadDocumentRequestModal";
import CcPagination from "../../../components/CcPagination";

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 200;
const numberFormatter = new Intl.NumberFormat("en-IN");

const formatLocalDate = (d) => {
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getDefaultRange = () => {
  const to = new Date();
  to.setDate(to.getDate() + 1);
  const from = new Date();
  from.setDate(from.getDate() - 60);
  return {
    from: formatLocalDate(from),
    to: formatLocalDate(to),
  };
};

import { formatLeadCode, formatCurrencyCompact } from "../../../utils/leadUtils";
export { formatLeadCode, formatCurrencyCompact };

export default function LeadsListRedesign({ disbursedOnly = false }) {
  const navigate = useNavigate();
  const location = useLocation();
  const isDisbursedView = disbursedOnly || location.pathname === "/disbursed-leads";
  const defaults = useMemo(getDefaultRange, []);

  // Data states
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(100);
  const [backendSummary, setBackendSummary] = useState(null);
  const [loading, setLoading] = useState(true);

  // Filters
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [selectedFY, setSelectedFY] = useState("ALL");
  const [dateRange, setDateRange] = useState(defaults);
  const [statusCategory, setStatusCategory] = useState(isDisbursedView ? "COMPLETED" : "ALL"); // "ALL" | "PENDING" | "COMPLETED" | "WORKED"
  const [workedCount, setWorkedCount] = useState(0);
  const [selectedStatus, setSelectedStatus] = useState(isDisbursedView ? "DISBURSED" : "ALL");
  const [selectedEmployeeId, setSelectedEmployeeId] = useState("ALL");
  const [selectedProduct, setSelectedProduct] = useState("ALL");
  const [selectedSource, setSelectedSource] = useState("ALL");
  const [sortOrder, setSortOrder] = useState("DESC"); // "DESC" | "ASC"

  // Sync mode when switching between All Leads and Disbursed Leads
  useEffect(() => {
    if (isDisbursedView) {
      setSelectedStatus("DISBURSED");
      setStatusCategory("COMPLETED");
    } else {
      setSelectedStatus("ALL");
      setStatusCategory("ALL");
    }
    setCurrentPage(1);
  }, [isDisbursedView]);

  const handleFYChange = (fy) => {
    setSelectedFY(fy);
    setCurrentPage(1);
    if (fy === "FY 2026-27") {
      setDateRange({ from: "2026-04-01", to: "2027-03-31" });
    } else if (fy === "FY 2025-26") {
      setDateRange({ from: "2025-04-01", to: "2026-03-31" });
    } else if (fy === "FY 2024-25") {
      setDateRange({ from: "2024-04-01", to: "2025-03-31" });
    } else if (fy === "FY 2023-24") {
      setDateRange({ from: "2023-04-01", to: "2024-03-31" });
    } else if (fy === "ALL") {
      setDateRange({ from: "", to: "" });
    }
  };

  // Dropdown data (dynamically fetched from backend)
  const [statusesList, setStatusesList] = useState([]);
  const [lendersList, setLendersList] = useState([]);
  const [productsList, setProductsList] = useState([]);
  const [sourcesList, setSourcesList] = useState([]);

  // Hand-to-hand inline editing
  const [editingCell, setEditingCell] = useState(null); // { leadId, field }
  const [inlineVal, setInlineVal] = useState("");
  const [savingInline, setSavingInline] = useState(false);

  // Modals & Popovers
  const [docReqLead, setDocReqLead] = useState(null);
  const [remarkModalLead, setRemarkModalLead] = useState(null);
  const [remarkText, setRemarkText] = useState("");
  const [remarkNextDate, setRemarkNextDate] = useState("");
  const [submittingRemark, setSubmittingRemark] = useState(false);
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Hand-to-hand reassign dropdown
  const [assignFor, setAssignFor] = useState(null); // { leadId, anchor }
  const [assignQuery, setAssignQuery] = useState("");
  const [debouncedAssignQuery, setDebouncedAssignQuery] = useState("");
  const menuRef = useRef(null);

  // Hand-to-hand status dropdown
  const [statusMenuFor, setStatusMenuFor] = useState(null); // { leadId, currentStatus, anchor }
  const [updatingStatusLeadId, setUpdatingStatusLeadId] = useState(null);
  const statusMenuRef = useRef(null);

  // Permissions & Roles
  const userRole = localStorage.getItem("userRole") || "";
  const employeeRole = localStorage.getItem("employeeRole") || "";
  const isEmployee =
    userRole.toUpperCase() === "EMPLOYEE" ||
    ["calling", "employee"].includes(employeeRole?.toLowerCase());

  const userPermissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isCompanyAdmin =
    userRole.toUpperCase() === "COMPANY_ADMIN" ||
    userRole.toUpperCase() === "SUPERADMIN" ||
    ["admin", "superadmin"].includes(employeeRole?.toLowerCase());
  const canExport = isCompanyAdmin || Boolean(userPermissions.exportData) || (!isEmployee && userPermissions.exportData !== false);
  const canDelete = isCompanyAdmin || Boolean(userPermissions.deleteRecords) || (userRole.toUpperCase() === "MANAGER" && userPermissions.deleteRecords !== false);
  const canViewCommission = !isEmployee && Boolean(userPermissions.viewPayouts || userPermissions.viewConnectors || isCompanyAdmin);

  const canAddLead = isCompanyAdmin || (userPermissions.createLead !== undefined ? Boolean(userPermissions.createLead) : Boolean(userPermissions.manageLeads !== false));
  const canEditLead =
    isCompanyAdmin ||
    ["MANAGER", "OPS", "EMPLOYEE"].includes(userRole.toUpperCase()) ||
    ["manager", "operations", "calling", "employee", "sales"].includes(employeeRole?.toLowerCase()) ||
    userPermissions.editLead !== false;
  const canAssignLead =
    isCompanyAdmin ||
    (userPermissions.reassignLeads !== false &&
      (["MANAGER", "OPS", "EMPLOYEE"].includes(userRole.toUpperCase()) ||
        ["manager", "operations", "calling", "employee", "sales"].includes(employeeRole?.toLowerCase()) ||
        Boolean(userPermissions.reassignLeads || userPermissions.assignLead || userPermissions.manageLeads)));

  useEffect(() => {
    if (location.search.includes("action=add") || location.state?.openAddLead) {
      if (canAddLead) {
        setShowAddModal(true);
      }
    }
  }, [location.search, location.state, canAddLead]);

  useEffect(() => {
    const handleOpenModal = () => {
      if (canAddLead) setShowAddModal(true);
    };
    window.addEventListener("crm_open_add_lead", handleOpenModal);
    return () => window.removeEventListener("crm_open_add_lead", handleOpenModal);
  }, [canAddLead]);

  const handleCloseAddModal = () => {
    setShowAddModal(false);
    if (location.search.includes("action=add")) {
      navigate(location.pathname, { replace: true, state: {} });
    }
  };

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

  const getStatusStageInfo = (status) => {
    const s = String(status || "").toUpperCase();
    if (s === "DISBURSED" || s === "LOAN DISBURSEMENT" || s === "CLOSED") {
      return {
        stage: "Stage 6/6 • Disbursed",
        color: "#047857",
        bg: "#ecfdf5",
        border: "#a7f3d0",
        icon: "🎉",
      };
    }
    if (s === "SANCTIONED" || s === "LOAN SECTION" || s === "APPROVED") {
      return {
        stage: "Stage 5/6 • Sanctioned",
        color: "#0f766e",
        bg: "#f0fdfa",
        border: "#99f6e4",
        icon: "✅",
      };
    }
    if (s.includes("LOGIN") || s.includes("SUBMITTED") || s.includes("BANK") || s.includes("UNDERWRITING")) {
      return {
        stage: "Stage 4/6 • Bank Login & Ops",
        color: "#4338ca",
        bg: "#eef2ff",
        border: "#c7d2fe",
        icon: "🏦",
      };
    }
    if (s.includes("DOCUMENT") || s.includes("DOC") || s.includes("VERIFICATION") || s.includes("KYC")) {
      return {
        stage: "Stage 3/6 • Documentation",
        color: "#d97706",
        bg: "#fffbeb",
        border: "#fde68a",
        icon: "📄",
      };
    }
    if (s.includes("FOLLOW") || s.includes("CALL") || s.includes("INTERESTED") || s.includes("MEETING")) {
      return {
        stage: "Stage 2/6 • Telecalling",
        color: "#2563eb",
        bg: "#eff6ff",
        border: "#bfdbfe",
        icon: "📞",
      };
    }
    if (s === "REJECTED" || s === "NOT INTERESTED" || s === "LOST") {
      return {
        stage: "Closed • Rejected",
        color: "#dc2626",
        bg: "#fef2f2",
        border: "#fecaca",
        icon: "❌",
      };
    }
    return {
      stage: "Stage 1/6 • Fresh Lead",
      color: "#475569",
      bg: "#f8fafc",
      border: "#cbd5e1",
      icon: "🆕",
    };
  };

  // Debounced search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearchTerm(searchTerm.trim()), 350);
    return () => clearTimeout(t);
  }, [searchTerm]);

  // Debounced assign search
  useEffect(() => {
    const t = setTimeout(() => setDebouncedAssignQuery(assignQuery.trim()), 200);
    return () => clearTimeout(t);
  }, [assignQuery]);

  // Fetch employees, statuses, and lenders
  useEffect(() => {
    axios
      .get(`${API_URL}/users?limit=200`)
      .then((res) => {
        const list = res.data?.data || res.data?.users || res.data || [];
        setEmployees(Array.isArray(list) ? list : []);
      })
      .catch((err) => console.error("Failed to load users:", err));

    axios
      .get(`${API_URL}/lead-statuses?team=all`)
      .then((res) => {
        const list = res.data?.statuses || res.data?.data || (Array.isArray(res.data) ? res.data : []);
        setStatusesList(Array.isArray(list) ? list : []);
      })
      .catch((err) => console.error("Failed to load statuses:", err));

    axios
      .get(`${API_URL}/lenders`)
      .then((res) => {
        const list = res.data?.data || res.data || [];
        setLendersList(Array.isArray(list) ? list : []);
      })
      .catch((err) => console.error("Failed to load lenders:", err));

    // Fetch dynamic products and sources from backend
    axios
      .get(`${API_URL}/leads/filter-options`)
      .then((res) => {
        if (res.data?.success) {
          if (Array.isArray(res.data.products) && res.data.products.length > 0) {
            setProductsList(res.data.products);
          }
          if (Array.isArray(res.data.sources) && res.data.sources.length > 0) {
            setSourcesList(res.data.sources);
          }
        }
      })
      .catch((err) => {
        console.warn("Could not fetch filter options from /leads/filter-options, checking master configs:", err);
        axios
          .get(`${API_URL}/master-configs/LOAN_PRODUCT`)
          .then((r) => {
            const list = r.data?.data || [];
            if (list.length > 0) setProductsList(list);
          })
          .catch(() => {});
        axios
          .get(`${API_URL}/master-configs/LEAD_SOURCE`)
          .then((r) => {
            const list = r.data?.data || [];
            if (list.length > 0) setSourcesList(list);
          })
          .catch(() => {});
      });
  }, []);

  const fetchWorkedCount = async () => {
    if (!isEmployee) return;
    try {
      const res = await axios.get(`${API_URL}/leads/worked`, {
        params: { limit: 1 },
      });
      setWorkedCount(res.data?.pagination?.totalItems ?? res.data?.totalItems ?? 0);
    } catch (err) {
      console.warn("Could not fetch worked count:", err.message);
    }
  };

  useEffect(() => {
    fetchWorkedCount();
  }, [isEmployee]);

  // Fetch main leads
  const fetchLeads = async (page = 1) => {
    setLoading(true);
    try {
      const isWorked = statusCategory === "WORKED";
      const endpoint = isWorked ? `${API_URL}/leads/worked` : `${API_URL}/leads`;

      const params = {
        page,
        limit: pageSize,
      };

      if (!isWorked) {
        if (isDisbursedView) {
          params.status = "DISBURSED";
        } else {
          if (statusCategory !== "ALL") params.statusCategory = statusCategory;
          if (selectedStatus !== "ALL") params.status = selectedStatus;
        }
        if (dateRange.from) {
          params.fromDate = dateRange.from;
          params.from = dateRange.from;
        }
        if (dateRange.to) {
          params.toDate = dateRange.to;
          params.to = dateRange.to;
        }
        if (selectedEmployeeId !== "ALL") params.assignedEmployeeId = selectedEmployeeId;
        if (selectedProduct !== "ALL") params.loanType = selectedProduct;
        if (selectedSource !== "ALL") params.source = selectedSource;
      }

      if (debouncedSearchTerm) {
        params.search = debouncedSearchTerm;
      }

      const res = await axios.get(endpoint, { params });
      const data = res.data || {};
      const leadRows = Array.isArray(data.data)
        ? data.data
        : Array.isArray(data.rows)
        ? data.rows
        : Array.isArray(data.leads)
        ? data.leads
        : Array.isArray(data)
        ? data
        : [];
      setRows(leadRows);
      if (data.summary) {
        setBackendSummary(data.summary);
      }
      const pagination = data.pagination || {};
      const total = pagination.totalItems ?? pagination.total ?? leadRows.length;
      setTotalItems(total);
      setTotalPages(
        pagination.totalPages ||
          Math.ceil(total / pageSize) ||
          1
      );
    } catch (err) {
      console.error("Failed to fetch leads:", err);
      toast.error(err.response?.data?.message || "Failed to load leads");
      setRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchLeads(currentPage);
  }, [currentPage, pageSize, debouncedSearchTerm, dateRange.from, dateRange.to, statusCategory, selectedStatus, selectedEmployeeId, selectedProduct, selectedSource]);

  // Sorted and filtered displayed rows
  const displayedRows = useMemo(() => {
    let list = [...rows];
    list.sort((a, b) => {
      const dateA = new Date(a.createdAt || a.date || 0).getTime();
      const dateB = new Date(b.createdAt || b.date || 0).getTime();
      return sortOrder === "DESC" ? dateB - dateA : dateA - dateB;
    });
    return list;
  }, [rows, sortOrder]);

  // Hand-to-Hand Inline Editable Save Function
  const handleInlineSave = async (leadId, field, value) => {
    if (!canEditLead) {
      toast.error("Permission denied to edit lead");
      return;
    }
    setSavingInline(true);
    try {
      // Optimistic UI update
      setRows((prev) =>
        prev.map((r) => {
          if (r.lead_id === leadId) {
            const up = { ...r };
            if (field === "name") up.name = value;
            if (field === "loan_type") up.loan_type = value;
            if (field === "est_budget") up.est_budget = value;
            if (field === "source") up.source = value;
            if (field === "bank_name") up.bank_name = value;
            return up;
          }
          return r;
        })
      );

      const payload = {};
      if (field === "name") payload.name = value;
      if (field === "loan_type") payload.loan_type = value;
      if (field === "est_budget") payload.est_budget = value;
      if (field === "source") payload.source = value;
      if (field === "bank_name") payload.bank_name = value;

      await axios.patch(`${API_URL}/leads/${leadId}`, payload);
      toast.success("Updated successfully", { autoClose: 1200 });
      setEditingCell(null);
    } catch (err) {
      console.error("Inline save error:", err);
      toast.error(err.response?.data?.message || "Failed to update field");
      fetchLeads(currentPage);
    } finally {
      setSavingInline(false);
    }
  };

  // Hand-to-Hand Status update
  const handleStatusChange = async (leadId, newStatusObj) => {
    const statusVal = typeof newStatusObj === "string" ? newStatusObj : (newStatusObj.value || newStatusObj.label);
    setUpdatingStatusLeadId(leadId);
    try {
      await axios.patch(`${API_URL}/leads/${leadId}/status`, {
        status: statusVal,
      });
      setRows((prev) =>
        prev.map((row) =>
          row.lead_id === leadId
            ? { ...row, status: statusVal, status_value: statusVal }
            : row
        )
      );
      toast.success(`Status updated to "${newStatusObj.label || statusVal}"`);
      setStatusMenuFor(null);
    } catch (error) {
      console.error("Failed to update status:", error);
      toast.error(error.response?.data?.message || "Failed to update status");
    } finally {
      setUpdatingStatusLeadId(null);
    }
  };

  // Hand-to-Hand Reassign update
  const openAssignMenu = (event, leadId) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setAssignFor({ leadId, anchor: rect });
    setAssignQuery("");
    setDebouncedAssignQuery("");
  };

  const handleAssign = async (leadId, emp) => {
    try {
      await axios.put(`${API_URL}/leads/${leadId}`, {
        assignedEmployeeId: emp ? emp.id : null,
      });
      setRows((prev) =>
        prev.map((row) =>
          row.lead_id === leadId
            ? { ...row, owner: emp ? emp.name : "Unassigned", assignedEmployeeId: emp ? emp.id : null }
            : row
        )
      );
      toast.success(emp ? `Assigned to ${emp.name}` : "Lead unassigned");
      setAssignFor(null);
    } catch (error) {
      console.error("Failed to assign lead:", error);
      toast.error(error.response?.data?.message || "Failed to assign lead");
    }
  };

  const employeeMatches = employees.filter((emp) => {
    if (!debouncedAssignQuery.trim()) return true;
    const q = debouncedAssignQuery.toLowerCase();
    return (
      String(emp.id).toLowerCase().includes(q) ||
      String(emp.name || "").toLowerCase().includes(q)
    );
  });

  // Hand-to-Hand Quick Remark modal handlers
  const openRemarkModal = (lead) => {
    setRemarkModalLead(lead);
    setRemarkText("");
    setRemarkNextDate("");
  };

  const handleSaveRemark = async (e) => {
    e?.preventDefault();
    if (!remarkModalLead) return;
    if (!remarkText.trim()) {
      toast.error("Please enter remark text");
      return;
    }
    setSubmittingRemark(true);
    try {
      const payload = {
        remark: remarkText.trim(),
      };
      if (remarkNextDate) {
        payload.nextFollowupDate = new Date(remarkNextDate).toISOString();
      }
      await axios.post(`${API_URL}/leads/${remarkModalLead.lead_id}/remarks`, payload);
      toast.success("Remark added successfully");

      const nowIso = new Date().toISOString();
      const currentUserName = localStorage.getItem("userName") || "User";

      // Update in local state rows immediately
      setRows((prev) =>
        prev.map((r) =>
          r.lead_id === remarkModalLead.lead_id
            ? {
                ...r,
                latest_remark: remarkText.trim(),
                latest_remark_date: nowIso,
                latest_remark_by: currentUserName,
                next_meeting: remarkNextDate || r.next_meeting,
              }
            : r
        )
      );

      setRemarkModalLead(null);
    } catch (err) {
      console.error("Failed to save remark:", err);
      toast.error(err.response?.data?.message || "Failed to save remark");
    } finally {
      setSubmittingRemark(false);
    }
  };

  // Delete lead handler
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`${API_URL}/leads/${deleteTarget.lead_id}`);
      toast.success("Lead deleted successfully");
      setRows((prev) => prev.filter((r) => r.lead_id !== deleteTarget.lead_id));
      setDeleteTarget(null);
      setTotalItems((prev) => Math.max(0, prev - 1));
    } catch (err) {
      console.error("Failed to delete lead:", err);
      toast.error(err.response?.data?.message || "Failed to delete lead");
    }
  };

  // Export to Excel
  const handleExport = async () => {
    try {
      toast.info("Preparing Excel export...");
      const exportRows = displayedRows.map((r) => ({
        "Lead Code": formatLeadCode(r),
        "DB Lead ID": r.lead_id,
        "Date": r.createdAt ? moment(r.createdAt).format("YYYY-MM-DD") : "--",
        "Customer Name": r.name || "--",
        "Phone": r.number || "--",
        "Loan Product": r.loan_type || "--",
        "Loan Amount": r.est_budget || "--",
        "Source": r.source || "Self",
        "Bank": r.bank_name || "--",
        "Status": r.status || "--",
        "Assigned To": r.owner || "Unassigned",
        "Latest Remark": r.latest_remark || "--",
        "Remark Date": r.latest_remark_date ? moment(r.latest_remark_date).format("YYYY-MM-DD HH:mm") : "--",
      }));
      const ws = XLSX.utils.json_to_sheet(exportRows);
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, ws, "Leads");
      XLSX.writeFile(wb, `Leads_Export_${moment().format("YYYY-MM-DD")}.xlsx`);
      toast.success("Excel downloaded successfully");
    } catch (err) {
      console.error("Export error:", err);
      toast.error("Failed to export leads");
    }
  };

  // KPI Metrics Calculation for Top Cards
  const kpiMetrics = useMemo(() => {
    let totalEnquired = backendSummary?.totalEnquiredAmount;
    let sentToBank = backendSummary?.sentToBankCount;
    let docsPending = backendSummary?.docsPendingCount;
    let noStatusYet = backendSummary?.noStatusYetCount;

    if (backendSummary === null || backendSummary === undefined) {
      totalEnquired = 0;
      sentToBank = 0;
      docsPending = 0;
      noStatusYet = 0;
      rows.forEach((r) => {
        const b = parseFloat(r.est_budget) || 0;
        totalEnquired += b;
        const s = String(r.status || "").toUpperCase();
        if (s.includes("BANK") || s.includes("LOGIN") || s.includes("SUBMITTED") || s.includes("OPS") || s.includes("SANCTION")) {
          sentToBank++;
        } else if (s.includes("DOC") || s.includes("VERIFICATION") || s.includes("KYC")) {
          docsPending++;
        } else if (!s || s === "NEW" || s === "FRESH" || s === "NOT SET" || s === "UNASSIGNED") {
          noStatusYet++;
        }
      });
    }

    const enquiredFormatted =
      totalEnquired >= 10000000
        ? `₹${(totalEnquired / 10000000).toFixed(2)} Cr enquired`
        : totalEnquired >= 100000
        ? `₹${(totalEnquired / 100000).toFixed(2)} L enquired`
        : `₹${Math.round(totalEnquired || 0).toLocaleString("en-IN")} enquired`;

    return {
      totalCount: backendSummary?.totalCount ?? totalItems ?? rows.length,
      enquiredFormatted,
      sentToBank: sentToBank ?? 0,
      docsPending: docsPending ?? 0,
      noStatusYet: noStatusYet ?? 0,
    };
  }, [rows, totalItems, backendSummary]);

  // Click outside menus
  useEffect(() => {
    const onDoc = (e) => {
      if (menuRef.current && !menuRef.current.contains(e.target)) {
        setAssignFor(null);
      }
      if (statusMenuRef.current && !statusMenuRef.current.contains(e.target)) {
        setStatusMenuFor(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, []);

  return (
    <div className="cc-report-redesign">
      <ToastContainer position="bottom-right" />

      <style>{`
        /* Clean Original CRM White Theme Styles */
        .cc-report-redesign {
          background: #f8fafc;
          min-height: 100vh;
          padding: 10px 16px;
          color: #0f172a;
          font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif;
        }

        /* Top 4 KPI Cards - Compact Sleek Design */
        .cc-kpi-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 10px;
          margin-bottom: 10px;
        }
        .cc-kpi-card {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 7px 14px;
          box-shadow: 0 1px 2px rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
          gap: 1px;
          transition: transform 0.15s ease, box-shadow 0.15s ease;
        }
        .cc-kpi-card:hover {
          box-shadow: 0 3px 8px rgba(15, 23, 42, 0.06);
          border-color: #cbd5e1;
        }
        .cc-kpi-label {
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          color: #64748b;
          line-height: 1.1;
        }
        .cc-kpi-num {
          font-size: 19px;
          font-weight: 800;
          color: #0f172a;
          line-height: 1.15;
        }
        .cc-kpi-sub {
          font-size: 10.5px;
          color: #047857;
          font-weight: 600;
          line-height: 1.1;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }

        /* Main Report Panel */
        .cc-report-panel {
          background: #ffffff;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        /* Toolbar: Single line horizontal layout with neat scroll if needed */
        .cc-leads-toolbar {
          display: flex;
          flex-wrap: nowrap;
          gap: 8px;
          align-items: flex-end;
          overflow-x: auto;
          overflow-y: hidden;
          padding: 2px 2px 6px 2px;
          scrollbar-width: thin;
        }
        .cc-leads-toolbar::-webkit-scrollbar {
          height: 4px;
        }
        .cc-leads-toolbar::-webkit-scrollbar-thumb {
          background: #cbd5e1;
          border-radius: 4px;
        }
        .cc-report-search {
          position: relative;
          display: flex;
          align-items: center;
        }
        .cc-report-search svg {
          position: absolute;
          left: 11px;
          color: #94a3b8;
          pointer-events: none;
        }
        .cc-report-search input {
          width: 100%;
          height: 38px;
          padding: 7px 12px 7px 34px;
          border: 1px solid #d5ded7;
          border-radius: 10px;
          background: #ffffff;
          font-size: 12.5px;
          color: #0f172a;
          outline: none;
          transition: border-color 0.15s ease, box-shadow 0.15s ease;
          box-sizing: border-box;
        }
        .cc-report-search input:focus {
          border-color: #047857;
          box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.12);
        }

        .cc-leads-filter-select {
          display: flex;
          flex-direction: column;
          font-size: 11px;
          font-weight: 600;
          color: #475569;
          gap: 3px;
          flex: 1 1 auto;
          white-space: nowrap;
        }
        .cc-leads-filter-select select,
        .cc-leads-filter-select input[type="date"] {
          height: 36px;
          padding: 5px 8px;
          border: 1px solid #d5ded7;
          border-radius: 8px;
          font-size: 12px;
          background: #ffffff;
          font-weight: 600;
          color: #0f172a;
          outline: none;
          cursor: pointer;
          transition: border-color 0.15s ease;
          width: 100%;
          box-sizing: border-box;
        }
        .cc-leads-filter-select select:focus,
        .cc-leads-filter-select input[type="date"]:focus {
          border-color: #047857;
        }

        .cc-leads-category-tabs {
          display: inline-flex;
          gap: 3px;
          background: #f1f5f9;
          padding: 3px;
          border-radius: 10px;
          border: 1px solid #e2e8f0;
        }
        .cc-leads-category-tabs button {
          border: 0;
          background: transparent;
          padding: 6px 12px;
          border-radius: 7px;
          font-size: 12px;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }
        .cc-leads-category-tabs button:hover {
          color: #0f172a;
        }
        .cc-leads-category-tabs button.active {
          background: #ffffff;
          color: #047857;
          box-shadow: 0 1px 3px rgba(0, 0, 0, 0.08);
          font-weight: 700;
        }

        .cc-leads-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 14px;
          border-radius: 10px;
          font-size: 13px;
          font-weight: 600;
          border: 1px solid transparent;
          cursor: pointer;
          transition: all 0.15s ease;
          height: 38px;
        }
        .cc-leads-btn.primary {
          background: #047857;
          color: #ffffff;
        }
        .cc-leads-btn.primary:hover {
          background: #065f46;
        }
        .cc-leads-btn.ghost {
          background: #ffffff;
          color: #0f172a;
          border-color: #d5ded7;
        }
        .cc-leads-btn.ghost:hover {
          background: #f8fafc;
        }

        /* Table Container: Sized to show 10-12 leads in one view, then smooth vertical scroll */
        .cc-leads-table-container {
          overflow-y: auto;
          overflow-x: auto;
          max-height: 520px;
          min-height: 480px;
          border: 1px solid #cbd5e1;
          border-radius: 10px;
          background: #ffffff;
          box-shadow: 0 1px 3px rgba(15, 23, 42, 0.05);
          position: relative;
        }
        .cc-leads-table-container table {
          width: 100%;
          min-width: 1300px;
          border-collapse: separate;
          border-spacing: 0;
          border: none;
        }
        .cc-leads-table-container thead {
          position: sticky;
          top: 0;
          z-index: 20;
        }
        .cc-leads-table-container thead th {
          position: sticky;
          top: 0;
          z-index: 20;
          background: #f1f5f9 !important;
          color: #334155;
          font-size: 10px;
          font-weight: 700;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          padding: 7px 8px;
          border-bottom: 2px solid #cbd5e1;
          border-right: 1px solid #e2e8f0;
          white-space: nowrap;
          box-shadow: 0 2px 4px rgba(15, 23, 42, 0.04);
        }
        .cc-leads-table-container thead th:last-child {
          border-right: none;
        }
        .cc-leads-table-container tbody td {
          padding: 5px 8px;
          height: 38px;
          font-size: 12px;
          line-height: 1.25;
          color: #1e293b;
          border-bottom: 1px solid #e2e8f0;
          border-right: 1px solid #edf2f7;
          background: #ffffff;
          vertical-align: middle;
          white-space: nowrap;
          transition: background-color 0.12s ease;
        }
        .cc-leads-table-container tbody td:last-child {
          border-right: none;
        }
        .cc-leads-table-container tbody tr:nth-child(even) td {
          background: #fafbfc;
        }
        .cc-leads-table-container tbody tr:hover td {
          background: #f0fdf4 !important;
        }

        /* Cells & Badges */
        .cc-lead-code-text {
          font-weight: 800;
          color: #047857;
          letter-spacing: 0.02em;
          text-decoration: underline;
          cursor: pointer;
        }
        .cc-lead-code-text:hover {
          color: #065f46;
        }
        .cc-badge-worked {
          padding: 2px 6px;
          border-radius: 4px;
          background: #fef3c7;
          color: #92400e;
          border: 1px solid #fde68a;
          font-size: 10px;
          font-weight: 700;
        }

        .cc-product-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 7px;
          border-radius: 6px;
          background: #f1f5f9;
          color: #334155;
          font-weight: 600;
          font-size: 11px;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          white-space: nowrap;
          max-width: 160px;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cc-product-pill:hover {
          background: #e2e8f0;
        }

        .cc-source-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 7px;
          border-radius: 999px;
          font-size: 11px;
          font-weight: 600;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          cursor: pointer;
          white-space: nowrap;
        }

        .cc-bank-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 7px;
          border-radius: 6px;
          font-size: 11px;
          font-weight: 600;
          background: #f8fafc;
          color: #475569;
          border: 1px solid #cbd5e1;
          cursor: pointer;
          white-space: nowrap;
        }
        .cc-bank-pill:hover {
          background: #eef2ff;
          color: #4338ca;
          border-color: #c7d2fe;
        }

        .cc-comm-pill {
          display: inline-flex;
          align-items: center;
          padding: 2px 8px;
          border-radius: 10px;
          font-size: 12px;
          font-weight: 700;
          background: #ecfdf5;
          color: #047857;
          border: 1px solid #a7f3d0;
        }

        /* Hand-to-Hand Inline Edit UI */
        .cc-editable-cell {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          cursor: pointer;
          border-radius: 4px;
          padding: 2px 4px;
          margin: -2px -4px;
          transition: background 0.15s ease;
        }
        .cc-editable-cell:hover {
          background: #f1f5f9;
        }
        .cc-editable-cell.bold {
          font-weight: 600;
        }
        .cc-cell-pencil {
          color: #94a3b8;
          opacity: 0.6;
          transition: opacity 0.15s ease;
        }
        .cc-editable-cell:hover .cc-cell-pencil {
          opacity: 1;
          color: #047857;
        }

        .cc-inline-edit-box {
          display: inline-flex;
          align-items: center;
          gap: 4px;
        }
        .cc-inline-input {
          height: 28px;
          padding: 2px 6px;
          font-size: 12.5px;
          border: 1px solid #047857;
          border-radius: 6px;
          outline: none;
          background: #ffffff;
          box-shadow: 0 0 0 2px rgba(4, 120, 87, 0.15);
        }
        .cc-inline-select {
          height: 28px;
          padding: 2px 6px;
          font-size: 12px;
          border: 1px solid #047857;
          border-radius: 6px;
          outline: none;
          background: #ffffff;
          cursor: pointer;
        }
        .cc-inline-btn {
          width: 24px;
          height: 24px;
          border-radius: 6px;
          display: grid;
          place-items: center;
          border: none;
          cursor: pointer;
        }
        .cc-inline-btn.check {
          background: #047857;
          color: #ffffff;
        }
        .cc-inline-btn.cancel {
          background: #f1f5f9;
          color: #64748b;
        }

        /* Remark Card */
        .cc-remark-card {
          padding: 3px 8px;
          background: #f8fafc;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          max-width: 280px;
        }
        .cc-remark-text {
          font-size: 11.5px;
          color: #1e293b;
          font-weight: 500;
          line-height: 1.25;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
          max-width: 260px;
        }
        .cc-remark-meta {
          display: flex;
          align-items: center;
          gap: 5px;
          margin-top: 2px;
          font-size: 10px;
          color: #64748b;
          white-space: nowrap;
        }
        .cc-remark-btn {
          border: 0;
          background: transparent;
          cursor: pointer;
          font-weight: 600;
          padding: 0;
        }
        .cc-remark-btn.link {
          color: #2563eb;
          font-size: 11px;
          text-decoration: underline;
        }
        .cc-remark-btn.add {
          padding: 2px 8px;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #ffffff;
          color: #047857;
          font-size: 11px;
        }

        /* Hand-to-Hand Assignee Button */
        .cc-leads-assign-btn {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 5px 10px;
          border-radius: 999px;
          border: 1px dashed #cbd5e1;
          background: #ffffff;
          font-size: 12px;
          color: #475569;
          cursor: pointer;
          max-width: 170px;
          white-space: nowrap;
          overflow: hidden;
          text-overflow: ellipsis;
        }
        .cc-leads-assign-btn.assigned {
          background: #eef7f2;
          border-style: solid;
          border-color: #c7e0d4;
          color: #065f46;
          font-weight: 600;
        }

        /* Row Actions */
        .cc-leads-row-actions {
          display: inline-flex;
          align-items: center;
          gap: 6px;
        }
        .cc-leads-icon-btn {
          width: 32px;
          height: 32px;
          border-radius: 8px;
          border: 1px solid #d5ded7;
          background: #ffffff;
          display: grid;
          place-items: center;
          cursor: pointer;
          color: #475569;
          transition: all 0.15s ease;
        }
        .cc-leads-icon-btn:hover {
          color: #047857;
          border-color: #047857;
          background: #f0fdf4;
        }
        .cc-leads-icon-btn.edit:hover {
          color: #2563eb;
          border-color: #2563eb;
          background: #eff6ff;
        }
        .cc-leads-icon-btn.danger:hover {
          color: #dc2626;
          border-color: #dc2626;
          background: #fef2f2;
        }

        /* Floating Menus (Assign & Status) */
        .cc-leads-assign-menu {
          position: fixed;
          z-index: 70;
          width: 260px;
          background: #ffffff;
          border: 1px solid #d5ded7;
          border-radius: 12px;
          box-shadow: 0 14px 35px rgba(15, 23, 42, 0.16);
          padding: 8px;
          display: flex;
          flex-direction: column;
          gap: 6px;
        }
        .cc-leads-assign-menu input {
          border: 1px solid #e2e8f0;
          border-radius: 8px;
          padding: 6px 10px;
          font-size: 12px;
          outline: none;
        }
        .cc-leads-assign-menu ul {
          list-style: none;
          margin: 0;
          padding: 0;
          max-height: 220px;
          overflow-y: auto;
          display: flex;
          flex-direction: column;
          gap: 2px;
        }
        .cc-leads-assign-menu li button {
          width: 100%;
          text-align: left;
          padding: 6px 10px;
          border-radius: 6px;
          font-size: 12.5px;
          color: #0f172a;
          background: transparent;
          border: 0;
          cursor: pointer;
          display: flex;
          justify-content: space-between;
          gap: 8px;
        }
        .cc-leads-assign-menu li button:hover {
          background: #f1f5f9;
        }

        /* Modal Overlays */
        .cc-leads-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.5);
          backdrop-filter: blur(2px);
          z-index: 80;
          display: grid;
          place-items: center;
          padding: 16px;
        }
        .cc-leads-modal {
          background: #ffffff;
          border-radius: 16px;
          padding: 22px;
          width: 100%;
          max-width: 440px;
          display: flex;
          flex-direction: column;
          gap: 14px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
        }
        .cc-leads-modal h3 {
          margin: 0;
          font-size: 16px;
          font-weight: 700;
          color: #0f172a;
        }
        .cc-leads-modal p {
          margin: 0;
          font-size: 13.5px;
          color: #475569;
        }
        .cc-leads-modal-actions {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
        }

        .cc-report-empty {
          text-align: center;
          padding: 40px !important;
          color: #94a3b8;
          font-size: 14px;
        }
      `}</style>

      {/* TOP 4 KPI CARDS */}
      {isDisbursedView ? (
        <div className="cc-kpi-grid">
          <div className="cc-kpi-card">
            <small className="cc-kpi-label">TOTAL DISBURSED CASES</small>
            <strong className="cc-kpi-num" style={{ color: "#047857" }}>
              {backendSummary ? backendSummary.disbursedCount : totalItems}
            </strong>
            <span className="cc-kpi-sub">Fully closed loan cases</span>
          </div>

          <div className="cc-kpi-card">
            <small className="cc-kpi-label">TOTAL DISBURSED AMOUNT</small>
            <strong className="cc-kpi-num" style={{ color: "#047857" }}>
              {backendSummary?.totalDisbursedAmount
                ? formatCurrencyCompact(backendSummary.totalDisbursedAmount)
                : "₹0"}
            </strong>
            <span className="cc-kpi-sub">
              {backendSummary?.totalDisbursedAmount
                ? `₹${Math.round(backendSummary.totalDisbursedAmount).toLocaleString("en-IN")} total volume`
                : "No volume yet"}
            </span>
          </div>

          <div className="cc-kpi-card">
            <small className="cc-kpi-label">AVG TICKET SIZE</small>
            <strong className="cc-kpi-num">
              {backendSummary?.avgDisbursedAmount
                ? formatCurrencyCompact(backendSummary.avgDisbursedAmount)
                : "₹0"}
            </strong>
            <span className="cc-kpi-sub">Average per disbursed case</span>
          </div>

          <div className="cc-kpi-card">
            <small className="cc-kpi-label">DISBURSED CONVERSION</small>
            <strong className="cc-kpi-num">100%</strong>
            <span className="cc-kpi-sub">Active disbursed borrower portfolio</span>
          </div>
        </div>
      ) : (
        <div className="cc-kpi-grid">
          <div className="cc-kpi-card">
            <small className="cc-kpi-label">TOTAL LEADS</small>
            <strong className="cc-kpi-num">{kpiMetrics.totalCount}</strong>
            <span className="cc-kpi-sub">{kpiMetrics.enquiredFormatted}</span>
          </div>

          <div className="cc-kpi-card">
            <small className="cc-kpi-label">SENT TO BANK</small>
            <strong className="cc-kpi-num" style={{ color: "#4338ca" }}>
              {kpiMetrics.sentToBank}
            </strong>
            <span className="cc-kpi-sub">Files active with lenders &amp; ops</span>
          </div>

          <div className="cc-kpi-card">
            <small className="cc-kpi-label">DOCUMENTS PENDING</small>
            <strong className="cc-kpi-num" style={{ color: "#d97706" }}>
              {kpiMetrics.docsPending}
            </strong>
            <span className="cc-kpi-sub">Waiting on customer documents</span>
          </div>

          <div className="cc-kpi-card">
            <small className="cc-kpi-label">NO STATUS YET</small>
            <strong className="cc-kpi-num">{kpiMetrics.noStatusYet}</strong>
            <span className="cc-kpi-sub">Fresh / Initial stage leads</span>
          </div>
        </div>
      )}

      {/* MAIN REPORT PANEL */}
      <section className="cc-report-panel">
        {/* Category Tabs / Disbursed Badge */}
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10 }}>
          {isDisbursedView ? (
            <div style={{ display: "inline-flex", alignItems: "center", gap: 8, padding: "6px 14px", background: "#ecfdf5", border: "1px solid #a7f3d0", borderRadius: 10 }}>
              <CheckCircle2 size={18} color="#047857" />
              <span style={{ fontSize: 13, fontWeight: 700, color: "#047857" }}>
                Disbursed Loans Portfolio ({totalItems})
              </span>
              <span style={{ fontSize: 11.5, color: "#065f46" }}>
                • Successfully closed loan deals
              </span>
            </div>
          ) : (
            <div className="cc-leads-category-tabs">
              <button
                type="button"
                className={statusCategory === "ALL" ? "active" : ""}
                onClick={() => {
                  setStatusCategory("ALL");
                  setCurrentPage(1);
                }}
              >
                All Leads
              </button>
              <button
                type="button"
                className={statusCategory === "PENDING" ? "active" : ""}
                onClick={() => {
                  setStatusCategory("PENDING");
                  setCurrentPage(1);
                }}
              >
                Pending
              </button>
              <button
                type="button"
                className={statusCategory === "COMPLETED" ? "active" : ""}
                onClick={() => {
                  setStatusCategory("COMPLETED");
                  setCurrentPage(1);
                }}
              >
                Completed
              </button>
              {isEmployee && (
                <button
                  type="button"
                  className={statusCategory === "WORKED" ? "active" : ""}
                  onClick={() => {
                    setStatusCategory("WORKED");
                    setCurrentPage(1);
                  }}
                  title="Leads you previously worked on (Read-only view)"
                >
                  Worked Leads {workedCount > 0 && `(${workedCount})`}
                </button>
              )}
            </div>
          )}

          <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
            {/* Search customer, phone, code placed right before Export */}
            <label className="cc-report-search" style={{ minWidth: 220, width: 280 }}>
              <Search size={15} />
              <input
                type="search"
                placeholder="Search customer, phone, code..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </label>

            {canExport && (
              <button
                type="button"
                className="cc-leads-btn ghost"
                onClick={handleExport}
                title="Export filtered leads to Excel"
              >
                <Download size={15} />
                <span>Export</span>
              </button>
            )}

            {canAddLead && (
              <button
                type="button"
                className="cc-leads-btn primary"
                onClick={() => setShowAddModal(true)}
              >
                <Plus size={16} />
                <span>Add Lead</span>
              </button>
            )}
          </div>
        </div>

        {/* Toolbar & Filters (Single Horizontal Line) */}
        <div className="cc-leads-toolbar">
          {/* Owner filter */}
          <label className="cc-leads-filter-select" style={{ minWidth: 130, flex: "1 1 135px" }}>
            Owner / Employee
            <select
              value={selectedEmployeeId}
              onChange={(e) => {
                setSelectedEmployeeId(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Owners</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.name}
                </option>
              ))}
            </select>
          </label>

          {/* Financial Year filter */}
          <label className="cc-leads-filter-select" style={{ minWidth: 105, flex: "0 0 110px" }}>
            Financial Year
            <select
              value={selectedFY}
              onChange={(e) => handleFYChange(e.target.value)}
            >
              <option value="ALL">All FY</option>
              <option value="FY 2026-27">FY 2026-27</option>
              <option value="FY 2025-26">FY 2025-26</option>
              <option value="FY 2024-25">FY 2024-25</option>
              <option value="FY 2023-24">FY 2023-24</option>
              {selectedFY === "CUSTOM" && <option value="CUSTOM">Custom Date</option>}
            </select>
          </label>

          {/* Date Range: From */}
          <label className="cc-leads-filter-select" style={{ minWidth: 120, flex: "0 0 120px" }}>
            From Date
            <input
              type="date"
              value={dateRange.from}
              onChange={(e) => {
                setSelectedFY("CUSTOM");
                setDateRange((prev) => ({ ...prev, from: e.target.value }));
                setCurrentPage(1);
              }}
            />
          </label>

          {/* Date Range: To */}
          <label className="cc-leads-filter-select" style={{ minWidth: 120, flex: "0 0 120px" }}>
            To Date
            <input
              type="date"
              value={dateRange.to}
              onChange={(e) => {
                setSelectedFY("CUSTOM");
                setDateRange((prev) => ({ ...prev, to: e.target.value }));
                setCurrentPage(1);
              }}
            />
          </label>

          {/* Status filter (Only in All Leads view) */}
          {!isDisbursedView && (
            <label className="cc-leads-filter-select" style={{ minWidth: 120, flex: "1 1 125px" }}>
              Status
              <select
                value={selectedStatus}
                onChange={(e) => {
                  setSelectedStatus(e.target.value);
                  setCurrentPage(1);
                }}
              >
                <option value="ALL">All Statuses</option>
                {statusesList.map((st) => (
                  <option key={st.status_id || st.id || st.value} value={st.value}>
                    {st.name || st.label || st.value}
                  </option>
                ))}
              </select>
            </label>
          )}

          {/* Product filter (Dynamic from backend) */}
          <label className="cc-leads-filter-select" style={{ minWidth: 125, flex: "1 1 130px" }}>
            Product
            <select
              value={selectedProduct}
              onChange={(e) => {
                setSelectedProduct(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Products</option>
              {productsList.map((prod, idx) => {
                const val = typeof prod === "string" ? prod : (prod.value || prod.label || prod.name || "");
                const label = typeof prod === "string" ? prod : (prod.label || prod.name || prod.value || "");
                return (
                  <option key={prod.id || `${val}_${idx}`} value={val}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>

          {/* Source filter (Dynamic from backend) */}
          <label className="cc-leads-filter-select" style={{ minWidth: 115, flex: "1 1 120px" }}>
            Source
            <select
              value={selectedSource}
              onChange={(e) => {
                setSelectedSource(e.target.value);
                setCurrentPage(1);
              }}
            >
              <option value="ALL">All Sources</option>
              {sourcesList.map((src, idx) => {
                const val = typeof src === "string" ? src : (src.value || src.label || src.name || "");
                const label = typeof src === "string" ? src : (src.label || src.name || src.value || "");
                return (
                  <option key={src.id || `${val}_${idx}`} value={val}>
                    {label}
                  </option>
                );
              })}
            </select>
          </label>

          {/* Rows per page selector */}
          <label className="cc-leads-filter-select" style={{ minWidth: 100, flex: "0 0 105px" }}>
            Show Rows
            <select
              value={pageSize}
              onChange={(e) => {
                const nextSize = parseInt(e.target.value, 10);
                setPageSize(nextSize);
                setCurrentPage(1);
              }}
            >
              <option value={20}>20 / page</option>
              <option value={50}>50 / page</option>
              <option value={100}>100 / page</option>
              <option value={200}>200 / page</option>
              <option value={500}>500 / page</option>
              <option value={1000}>1000 / page</option>
            </select>
          </label>
        </div>

        {/* Read-only notification if in WORKED tab */}
        {statusCategory === "WORKED" && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              padding: "10px 14px",
              background: "#eff6ff",
              border: "1px solid #bfdbfe",
              borderRadius: "8px",
              color: "#1e40af",
              fontSize: "13px",
            }}
          >
            <span style={{ fontSize: "18px" }}>ℹ️</span>
            <div>
              <strong>Worked Leads:</strong> These are leads you previously handled that have been transferred. You have <strong>Read-Only access</strong> to view updates and progress.
            </div>
          </div>
        )}

        {/* LEADS DATA TABLE */}
        <div className="cc-leads-table-container">
          <table>
            <thead>
              <tr>
                {/* Column 1: LEAD (Displays month-wise company-wise code e.g. OCT26-001) */}
                <th style={{ minWidth: 125 }}>LEAD</th>
                {/* Column 2: DATE ↓ */}
                <th
                  style={{ minWidth: 110, cursor: "pointer", userSelect: "none" }}
                  onClick={() => setSortOrder(sortOrder === "DESC" ? "ASC" : "DESC")}
                  title="Click to toggle sorting"
                >
                  <span style={{ display: "inline-flex", alignItems: "center", gap: 5 }}>
                    DATE {sortOrder === "DESC" ? "↓" : "↑"}
                  </span>
                </th>
                {/* Column 3: CUSTOMER */}
                <th style={{ minWidth: 175 }}>CUSTOMER</th>
                {/* Column 4: PHONE */}
                <th style={{ minWidth: 120 }}>PHONE</th>
                {/* Column 5: PRODUCT */}
                <th style={{ minWidth: 140 }}>PRODUCT</th>
                {/* Column 6: AMOUNT */}
                <th style={{ minWidth: 125 }}>AMOUNT</th>
                {/* Column 7: SOURCE */}
                <th style={{ minWidth: 115 }}>SOURCE</th>
                {/* Column 8: PARTY COMMISSION (if authorized) */}
                {canViewCommission && <th style={{ minWidth: 130 }}>PARTY COMMISSION</th>}
                {/* Column 9: BANK */}
                <th style={{ minWidth: 110 }}>BANK</th>
                {/* Column 10: STATUS & STAGE */}
                <th style={{ minWidth: 175 }}>STATUS &amp; STAGE</th>
                {/* Column 11: LATEST REMARK */}
                <th style={{ minWidth: 280 }}>LATEST REMARK</th>
                {/* Column 12: ASSIGNED TO */}
                <th style={{ minWidth: 160 }}>ASSIGNED TO</th>
                {/* Column 13: ACTIONS */}
                <th style={{ minWidth: 130, textAlign: "right" }}>ACTIONS</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canViewCommission ? 13 : 12} className="cc-report-empty">
                    Loading leads...
                  </td>
                </tr>
              ) : displayedRows.length === 0 ? (
                <tr>
                  <td colSpan={canViewCommission ? 13 : 12} className="cc-report-empty">
                    No leads match the filters.
                  </td>
                </tr>
              ) : (
                displayedRows.map((row) => {
                  const leadCode = formatLeadCode(row);
                  const isEditingName = editingCell?.leadId === row.lead_id && editingCell?.field === "name";
                  const isEditingAmount = editingCell?.leadId === row.lead_id && editingCell?.field === "est_budget";
                  const isEditingSource = editingCell?.leadId === row.lead_id && editingCell?.field === "source";
                  const isEditingBank = editingCell?.leadId === row.lead_id && editingCell?.field === "bank_name";
                  const isEditingProduct = editingCell?.leadId === row.lead_id && editingCell?.field === "loan_type";
                  const stageInfo = getStatusStageInfo(row.status || row.status_value);
                  const isReadonly = Boolean(row.is_read_only) || !canEditLead;

                  return (
                    <tr key={row.lead_id}>
                      {/* 1. LEAD Column */}
                      <td
                        onClick={() => navigate(`/lead-details/${row.lead_id}`)}
                        style={{ cursor: "pointer", fontWeight: 700 }}
                      >
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="cc-lead-code-text" title="Click to view lead details">
                            {leadCode}
                          </span>
                          {row.is_read_only && (
                            <span className="cc-badge-worked" title="Worked Lead (Read-Only Mode)">
                              Worked
                            </span>
                          )}
                        </div>
                      </td>

                      {/* 2. DATE */}
                      <td>
                        <span style={{ fontSize: "12.5px", color: "#475569", fontWeight: 500, whiteSpace: "nowrap" }}>
                          {moment(row.createdAt || row.date).format("DD MMM YYYY")}
                        </span>
                      </td>

                      {/* 3. CUSTOMER (Hand-to-Hand Inline Editable) */}
                      <td>
                        {isEditingName ? (
                          <div className="cc-inline-edit-box">
                            <input
                              type="text"
                              autoFocus
                              value={inlineVal}
                              onChange={(e) => setInlineVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleInlineSave(row.lead_id, "name", inlineVal);
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="cc-inline-input"
                            />
                            <button
                              type="button"
                              onClick={() => handleInlineSave(row.lead_id, "name", inlineVal)}
                              className="cc-inline-btn check"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCell(null)}
                              className="cc-inline-btn cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="cc-editable-cell bold"
                            onClick={() => {
                              if (row.is_read_only || !canEditLead) {
                                navigate(`/lead-details/${row.lead_id}`);
                                return;
                              }
                              setEditingCell({ leadId: row.lead_id, field: "name" });
                              setInlineVal(row.name || "");
                            }}
                            title={!row.is_read_only && canEditLead ? "Click to edit customer name" : "View customer"}
                          >
                            <span>{row.name || "--"}</span>
                            {!row.is_read_only && canEditLead && <Pencil size={11} className="cc-cell-pencil" />}
                          </div>
                        )}
                      </td>

                      {/* 4. PHONE */}
                      <td>
                        {row.number ? (
                          <a
                            href={`tel:${row.number}`}
                            style={{
                              color: "#0f172a",
                              textDecoration: "none",
                              fontSize: "12.5px",
                              fontWeight: 500,
                              display: "inline-flex",
                              alignItems: "center",
                              gap: 5,
                            }}
                            title="Call customer"
                          >
                            <span>{row.number}</span>
                          </a>
                        ) : (
                          <span style={{ fontSize: "12.5px", color: "#94a3b8" }}>--</span>
                        )}
                      </td>

                      {/* 5. PRODUCT (Hand-to-Hand Inline Dropdown Editable) */}
                      <td>
                        {isEditingProduct ? (
                          <select
                            autoFocus
                            value={row.loan_type || ""}
                            onChange={(e) => handleInlineSave(row.lead_id, "loan_type", e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            className="cc-inline-select"
                          >
                            <option value="">Select</option>
                            {productsList.map((p, idx) => {
                              const val = typeof p === "string" ? p : (p.value || p.label || "");
                              const label = typeof p === "string" ? p : (p.label || p.value || "");
                              return (
                                <option key={p.id || `${val}_${idx}`} value={val}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <span
                            className="cc-product-pill"
                            onClick={() => {
                              if (!row.is_read_only && canEditLead) {
                                setEditingCell({ leadId: row.lead_id, field: "loan_type" });
                              }
                            }}
                            title={!row.is_read_only && canEditLead ? "Click to change product" : ""}
                            style={{ cursor: !row.is_read_only && canEditLead ? "pointer" : "default" }}
                          >
                            {row.loan_type || "DOD"}
                          </span>
                        )}
                      </td>

                      {/* 6. AMOUNT (Hand-to-Hand Inline Editable) */}
                      <td>
                        {isEditingAmount ? (
                          <div className="cc-inline-edit-box">
                            <input
                              type="number"
                              autoFocus
                              value={inlineVal}
                              onChange={(e) => setInlineVal(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") handleInlineSave(row.lead_id, "est_budget", inlineVal);
                                if (e.key === "Escape") setEditingCell(null);
                              }}
                              className="cc-inline-input"
                              placeholder="₹"
                            />
                            <button
                              type="button"
                              onClick={() => handleInlineSave(row.lead_id, "est_budget", inlineVal)}
                              className="cc-inline-btn check"
                            >
                              <Check size={12} />
                            </button>
                            <button
                              type="button"
                              onClick={() => setEditingCell(null)}
                              className="cc-inline-btn cancel"
                            >
                              <X size={12} />
                            </button>
                          </div>
                        ) : (
                          <div
                            className="cc-editable-cell"
                            onClick={() => {
                              if (!row.is_read_only && canEditLead) {
                                setEditingCell({ leadId: row.lead_id, field: "est_budget" });
                                setInlineVal(row.est_budget || "");
                              }
                            }}
                            title={!row.is_read_only && canEditLead ? "Click to edit loan amount" : ""}
                            style={{ cursor: !row.is_read_only && canEditLead ? "pointer" : "default", fontWeight: 600 }}
                          >
                            <span>{formatCurrencyCompact(row.est_budget)}</span>
                            {!row.is_read_only && canEditLead && <Pencil size={11} className="cc-cell-pencil" />}
                          </div>
                        )}
                      </td>

                      {/* 7. SOURCE (Hand-to-Hand Inline Dropdown Editable) */}
                      <td>
                        {isEditingSource ? (
                          <select
                            autoFocus
                            value={row.source || "Self"}
                            onChange={(e) => handleInlineSave(row.lead_id, "source", e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            className="cc-inline-select"
                          >
                            {sourcesList.map((s, idx) => {
                              const val = typeof s === "string" ? s : (s.value || s.label || "");
                              const label = typeof s === "string" ? s : (s.label || s.value || "");
                              return (
                                <option key={s.id || `${val}_${idx}`} value={val}>
                                  {label}
                                </option>
                              );
                            })}
                          </select>
                        ) : (
                          <span
                            className="cc-source-pill"
                            onClick={() => {
                              if (!row.is_read_only && canEditLead) {
                                setEditingCell({ leadId: row.lead_id, field: "source" });
                              }
                            }}
                            title={!row.is_read_only && canEditLead ? "Click to change source" : ""}
                            style={{ cursor: !row.is_read_only && canEditLead ? "pointer" : "default" }}
                          >
                            {row.source || "Self"}
                          </span>
                        )}
                      </td>

                      {/* 8. PARTY COMMISSION (if authorized) */}
                      {canViewCommission && (
                        <td>
                          {row.commission_percent !== null && row.commission_percent !== undefined ? (
                            <div style={{ display: "inline-flex", flexDirection: "column", gap: 2 }}>
                              <span className="cc-comm-pill">
                                {row.commission_percent}%
                              </span>
                              {row.commission_amount ? (
                                <span style={{ fontSize: "11px", color: "#047857", fontWeight: 600 }}>
                                  ₹{Number(row.commission_amount).toLocaleString("en-IN")}
                                </span>
                              ) : null}
                            </div>
                          ) : (
                            <span style={{ fontSize: "12px", color: "#94a3b8" }}>--</span>
                          )}
                        </td>
                      )}

                      {/* 9. BANK (Hand-to-Hand Inline Dropdown Editable) */}
                      <td>
                        {isEditingBank ? (
                          <select
                            autoFocus
                            value={row.bank_name || ""}
                            onChange={(e) => handleInlineSave(row.lead_id, "bank_name", e.target.value)}
                            onBlur={() => setEditingCell(null)}
                            className="cc-inline-select"
                          >
                            <option value="">— Direct / None —</option>
                            {lendersList.length > 0 ? (
                              lendersList.map((l) => (
                                <option key={l.id} value={l.name}>
                                  {l.name}
                                </option>
                              ))
                            ) : (
                              <>
                                <option value="HDFC">HDFC</option>
                                <option value="ICICI">ICICI</option>
                                <option value="SBI">SBI</option>
                                <option value="Axis">Axis</option>
                                <option value="CSB">CSB</option>
                              </>
                            )}
                          </select>
                        ) : (
                          <span
                            className="cc-bank-pill"
                            onClick={() => {
                              if (!row.is_read_only && canEditLead) {
                                setEditingCell({ leadId: row.lead_id, field: "bank_name" });
                              }
                            }}
                            title={!row.is_read_only && canEditLead ? "Click to assign bank" : ""}
                            style={{ cursor: !row.is_read_only && canEditLead ? "pointer" : "default" }}
                          >
                            {row.bank_name || "—"}
                          </span>
                        )}
                      </td>

                      {/* 10. STATUS & STAGE (Hand-to-Hand Inline Status Popover) */}
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {isReadonly ? (
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 5,
                                padding: "3px 9px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 700,
                                background: stageInfo.bg,
                                color: stageInfo.color,
                                border: `1px solid ${stageInfo.border}`,
                                width: "fit-content",
                              }}
                            >
                              <span>{stageInfo.icon}</span>
                              <span>{row.status || "Unassigned"}</span>
                            </span>
                          ) : (
                            <button
                              type="button"
                              onClick={(event) => {
                                event.stopPropagation();
                                const rect = event.currentTarget.getBoundingClientRect();
                                setStatusMenuFor({ leadId: row.lead_id, currentStatus: row.status, anchor: rect });
                              }}
                              disabled={updatingStatusLeadId === row.lead_id}
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 6,
                                padding: "4px 10px",
                                borderRadius: "12px",
                                fontSize: "12px",
                                fontWeight: 700,
                                background: stageInfo.bg,
                                color: stageInfo.color,
                                border: `1px solid ${stageInfo.border}`,
                                width: "fit-content",
                                cursor: "pointer",
                                boxShadow: "0 1px 2px rgba(0,0,0,0.05)",
                                transition: "all 0.15s ease",
                              }}
                              title="Click to update lead status"
                            >
                              <span>{stageInfo.icon}</span>
                              <span>{updatingStatusLeadId === row.lead_id ? "Updating..." : (row.status || "Select Status")}</span>
                              <ChevronDown size={12} style={{ opacity: 0.7 }} />
                            </button>
                          )}
                          <span
                            style={{
                              fontSize: "10.5px",
                              fontWeight: 600,
                              color: "#64748b",
                              letterSpacing: "0.2px",
                            }}
                          >
                            {stageInfo.stage}
                          </span>
                        </div>
                      </td>

                      {/* 11. LATEST REMARK (Hand-to-Hand Remark Popup right here) */}
                      <td>
                        {row.is_read_only ? (
                          <div className="cc-remark-card">
                            <div className="cc-remark-text">
                              {row.latest_remark ? `"${row.latest_remark}"` : <span style={{ color: "#94a3b8", fontStyle: "italic" }}>No remark logged</span>}
                            </div>
                            {row.latest_remark_date && (
                              <div className="cc-remark-meta">
                                <Clock size={11} color="#94a3b8" />
                                <span>{formatDateTime(row.latest_remark_date)}</span>
                                {row.latest_remark_by && <span style={{ fontWeight: 600 }}>• {row.latest_remark_by}</span>}
                              </div>
                            )}
                          </div>
                        ) : row.latest_remark ? (
                          <div className="cc-remark-card">
                            <div className="cc-remark-text">
                              "{row.latest_remark}"
                            </div>
                            <div className="cc-remark-meta" style={{ justifyContent: "space-between" }}>
                              <span style={{ display: "inline-flex", alignItems: "center", gap: 3, fontWeight: 600 }}>
                                <Clock size={11} color="#64748b" />
                                {formatDateTime(row.latest_remark_date)}
                              </span>
                              {row.latest_remark_by && (
                                <span style={{ color: "#047857", fontWeight: 600 }}>
                                  by {row.latest_remark_by}
                                </span>
                              )}
                              <button
                                type="button"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  openRemarkModal(row);
                                }}
                                className="cc-remark-btn link"
                                title="Update or add new remark"
                              >
                                + Update
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                            <span style={{ fontSize: "12px", color: "#94a3b8", fontStyle: "italic" }}>
                              No remark logged
                            </span>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                openRemarkModal(row);
                              }}
                              className="cc-remark-btn add"
                              title="Add remark"
                            >
                              + Add
                            </button>
                          </div>
                        )}
                      </td>

                      {/* 12. ASSIGNED TO (Hand-to-Hand Reassign Menu right here) */}
                      <td>
                        {row.is_read_only ? (
                          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
                            <span style={{ fontSize: "10px", color: "#64748b", fontWeight: 600 }}>Currently with:</span>
                            <span
                              className="cc-leads-assign-btn assigned"
                              style={{ cursor: "default", background: "#f8fafc", color: "#1e293b", borderColor: "#cbd5e1" }}
                              title={`Currently handled by ${row.current_owner || row.owner || "Unassigned"}`}
                            >
                              <UserCog size={13} color="#2563eb" />
                              {row.current_owner || row.owner || "Unassigned"}
                            </span>
                          </div>
                        ) : !canAssignLead ? (
                          <span
                            className={`cc-leads-assign-btn ${row.owner ? "assigned" : ""}`}
                            style={{ cursor: "default" }}
                          >
                            <UserCog size={14} />
                            {row.owner || "Unassigned"}
                          </span>
                        ) : (
                          <button
                            type="button"
                            className={`cc-leads-assign-btn ${row.owner ? "assigned" : ""}`}
                            onClick={(event) => openAssignMenu(event, row.lead_id)}
                            title="Assign lead to employee"
                          >
                            <UserCog size={14} />
                            {row.owner || "Unassigned"}
                          </button>
                        )}
                      </td>

                      {/* 13. ACTIONS */}
                      <td style={{ textAlign: "right" }}>
                        {row.is_read_only ? (
                          <div className="cc-leads-row-actions">
                            <button
                              type="button"
                              className="cc-leads-icon-btn"
                              title="View lead details & history (Read-only)"
                              onClick={() => navigate(`/lead-details/${row.lead_id}`)}
                              style={{ color: "#2563eb", background: "#eff6ff", borderRadius: 6 }}
                            >
                              <Eye size={15} />
                            </button>
                            <span
                              style={{
                                display: "inline-flex",
                                alignItems: "center",
                                padding: "3px 6px",
                                borderRadius: 4,
                                background: "#fef3c7",
                                color: "#92400e",
                                fontSize: 10,
                                fontWeight: 700,
                                border: "1px solid #fde68a",
                              }}
                              title="Read-Only: Lead is handled by another employee"
                            >
                              🔒 Read Only
                            </span>
                          </div>
                        ) : (
                          <div className="cc-leads-row-actions">
                            <button
                              type="button"
                              className="cc-leads-icon-btn"
                              title="Generate/Share Customer Document Upload Link"
                              onClick={() =>
                                setDocReqLead({
                                  id: row.lead_id,
                                  customer: { name: row.name, mobile: row.number },
                                  loanType: row.loan_type,
                                  requiredAmount: row.est_budget,
                                })
                              }
                              style={{ color: "#2563eb" }}
                            >
                              <Link size={15} />
                            </button>
                            <button
                              type="button"
                              className="cc-leads-icon-btn"
                              title="View lead details"
                              onClick={() => navigate(`/lead-details/${row.lead_id}`)}
                            >
                              <Eye size={15} />
                            </button>
                            {canEditLead && (
                              <button
                                type="button"
                                className="cc-leads-icon-btn edit"
                                title="Edit lead"
                                onClick={() => navigate(`/lead-edit/${row.lead_id}`)}
                              >
                                <Pencil size={14} />
                              </button>
                            )}
                            {canDelete && (
                              <button
                                type="button"
                                className="cc-leads-icon-btn danger"
                                title="Delete lead"
                                onClick={() => setDeleteTarget(row)}
                              >
                                <Trash2 size={14} />
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        {/* PAGINATION */}
        <CcPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          pageSize={pageSize}
          onPageChange={(p) => setCurrentPage(p)}
        />
      </section>

      {/* HAND-TO-HAND REASSIGN DROPDOWN POPUP */}
      {assignFor ? (
        <div
          ref={menuRef}
          className="cc-leads-assign-menu"
          style={{
            top: Math.min(assignFor.anchor.bottom + 6, window.innerHeight - 260),
            left: Math.min(assignFor.anchor.left, window.innerWidth - 280),
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <input
            type="search"
            autoFocus
            placeholder="Search employees..."
            value={assignQuery}
            onChange={(event) => setAssignQuery(event.target.value)}
          />
          <ul>
            {employeeMatches.length === 0 ? (
              <li style={{ padding: "8px 10px", fontSize: 12, color: "#94a3b8" }}>No matches</li>
            ) : (
              employeeMatches.map((emp) => (
                <li key={emp.id}>
                  <button type="button" onClick={() => handleAssign(assignFor.leadId, emp)}>
                    <span>{emp.name}</span>
                    <span>{emp.id}</span>
                  </button>
                </li>
              ))
            )}
          </ul>
        </div>
      ) : null}

      {/* HAND-TO-HAND STATUS SELECT DROPDOWN POPUP */}
      {statusMenuFor ? (
        <div
          ref={statusMenuRef}
          className="cc-leads-assign-menu"
          style={{
            position: "fixed",
            zIndex: 75,
            top: Math.min(statusMenuFor.anchor.bottom + 6, window.innerHeight - 280),
            left: Math.min(statusMenuFor.anchor.left, window.innerWidth - 260),
            minWidth: 220,
          }}
          onClick={(e) => e.stopPropagation()}
        >
          <div
            style={{
              fontSize: "11px",
              fontWeight: 700,
              color: "#64748b",
              textTransform: "uppercase",
              padding: "4px 8px 6px",
              borderBottom: "1px solid #f1f5f9",
            }}
          >
            Change Lead Status
          </div>
          <ul style={{ maxHeight: 240, overflowY: "auto", margin: "4px 0 0", padding: 0, listStyle: "none" }}>
            {statusesList.map((st) => {
              const info = getStatusStageInfo(st.value || st.label);
              const isCurrent = (statusMenuFor.currentStatus || "").toUpperCase() === (st.value || "").toUpperCase();
              return (
                <li key={st.id || st.value}>
                  <button
                    type="button"
                    onClick={() => handleStatusChange(statusMenuFor.leadId, st)}
                    style={{
                      width: "100%",
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      padding: "7px 10px",
                      borderRadius: "8px",
                      border: "none",
                      background: isCurrent ? "#f0fdf4" : "transparent",
                      color: isCurrent ? "#166534" : "#1e293b",
                      fontSize: "12.5px",
                      fontWeight: isCurrent ? 700 : 500,
                      cursor: "pointer",
                    }}
                    onMouseEnter={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = "#f8fafc";
                    }}
                    onMouseLeave={(e) => {
                      if (!isCurrent) e.currentTarget.style.background = "transparent";
                    }}
                  >
                    <span style={{ display: "inline-flex", alignItems: "center", gap: 7 }}>
                      <span
                        style={{
                          width: 8,
                          height: 8,
                          borderRadius: "50%",
                          background: info.color || "#059669",
                        }}
                      />
                      {st.label || st.value}
                    </span>
                    <span style={{ fontSize: "10px", color: "#94a3b8", fontWeight: 600 }}>
                      {info.stage.split("•")[0]}
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </div>
      ) : null}

      {/* QUICK REMARK MODAL (Hand-to-Hand update) */}
      {remarkModalLead ? (
        <div className="cc-leads-modal-overlay" onClick={() => setRemarkModalLead(null)}>
          <div className="cc-leads-modal" style={{ maxWidth: 480 }} onClick={(e) => e.stopPropagation()}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
              <h3 style={{ margin: 0, display: "flex", alignItems: "center", gap: 8 }}>
                <MessageSquare size={18} color="#047857" />
                Add Remark: {remarkModalLead.name || `#${formatLeadCode(remarkModalLead)}`}
              </h3>
              <button
                type="button"
                onClick={() => setRemarkModalLead(null)}
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "#64748b" }}
              >
                <X size={18} />
              </button>
            </div>

            {remarkModalLead.latest_remark && (
              <div
                style={{
                  padding: "8px 12px",
                  background: "#f8fafc",
                  borderRadius: 8,
                  border: "1px solid #e2e8f0",
                  fontSize: 12,
                }}
              >
                <span style={{ color: "#64748b", fontWeight: 600 }}>Previous Remark:</span>
                <p style={{ margin: "2px 0 0 0", color: "#1e293b" }}>"{remarkModalLead.latest_remark}"</p>
                <small style={{ color: "#94a3b8" }}>{formatDateTime(remarkModalLead.latest_remark_date)}</small>
              </div>
            )}

            <form onSubmit={handleSaveRemark} style={{ display: "flex", flexDirection: "column", gap: 12 }}>
              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  New Remark <span style={{ color: "#dc2626" }}>*</span>
                </label>
                <textarea
                  rows={4}
                  required
                  placeholder="Enter call notes, customer conversation, next steps..."
                  value={remarkText}
                  onChange={(e) => setRemarkText(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    outline: "none",
                    fontFamily: "inherit",
                    resize: "vertical",
                    boxSizing: "border-box",
                  }}
                  autoFocus
                />
              </div>

              <div>
                <label style={{ fontSize: 12, fontWeight: 600, color: "#334155", display: "block", marginBottom: 4 }}>
                  Next Follow-up Date &amp; Time (Optional)
                </label>
                <input
                  type="datetime-local"
                  value={remarkNextDate}
                  onChange={(e) => setRemarkNextDate(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    boxSizing: "border-box",
                  }}
                />
              </div>

              <div className="cc-leads-modal-actions" style={{ marginTop: 6 }}>
                <button
                  type="button"
                  className="cc-leads-btn ghost"
                  onClick={() => setRemarkModalLead(null)}
                  disabled={submittingRemark}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-leads-btn primary"
                  disabled={submittingRemark}
                >
                  {submittingRemark ? "Saving..." : "Save Remark"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* DELETE CONFIRMATION MODAL */}
      {deleteTarget ? (
        <div className="cc-leads-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cc-leads-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Delete lead {formatLeadCode(deleteTarget)}?</h3>
            <p>
              This permanently removes lead <strong>{deleteTarget.name || formatLeadCode(deleteTarget)}</strong> and its history. This action cannot be undone.
            </p>
            <div className="cc-leads-modal-actions">
              <button type="button" className="cc-leads-btn ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cc-leads-btn primary"
                style={{ background: "#dc2626" }}
                onClick={handleDelete}
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {/* ADD LEAD MODAL */}
      <AddLeadModal
        open={showAddModal}
        onClose={handleCloseAddModal}
        onCreated={() => fetchLeads(currentPage)}
      />

      {/* DOCUMENT REQUEST MODAL */}
      <LeadDocumentRequestModal
        isOpen={Boolean(docReqLead)}
        onClose={() => setDocReqLead(null)}
        lead={docReqLead}
        onSuccess={() => fetchLeads(currentPage)}
      />
    </div>
  );
}
