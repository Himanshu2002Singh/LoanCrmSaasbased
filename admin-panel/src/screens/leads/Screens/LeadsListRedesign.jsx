import React, { useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import moment from "moment";
import { useNavigate } from "react-router-dom";
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
} from "lucide-react";
import API_URL from "../../../config";
import AddLeadModal from "../AddLeadModal";
import CcPagination from "../../../components/CcPagination";

const PAGE_SIZE = 20;
const EXPORT_PAGE_SIZE = 200;
const numberFormatter = new Intl.NumberFormat("en-IN");

const getDefaultRange = () => {
  const to = new Date();
  const from = new Date();
  from.setDate(from.getDate() - 30);
  return {
    from: from.toISOString().split("T")[0],
    to: to.toISOString().split("T")[0],
  };
};

export default function LeadsListRedesign() {
  const navigate = useNavigate();
  const defaults = useMemo(getDefaultRange, []);
  const [rows, setRows] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [dateRange, setDateRange] = useState(defaults);
  const [statusCategory, setStatusCategory] = useState("ALL"); // "ALL" | "PENDING" | "COMPLETED"
  const [showAddModal, setShowAddModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [assignFor, setAssignFor] = useState(null); // { leadId, anchorRect }
  const [assignQuery, setAssignQuery] = useState("");
  const [debouncedAssignQuery, setDebouncedAssignQuery] = useState("");
  const menuRef = useRef(null);

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

  const canExport = !isEmployee && userPermissions.exportData !== false;
  const canDelete = !isEmployee && Boolean(userPermissions.deleteRecords);
  const canViewCommission = !isEmployee && Boolean(userPermissions.viewPayouts || userPermissions.viewConnectors || userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN");

  const fetchEmployees = () => {
    axios
      .get(`${API_URL}/users`, { params: { limit: 200 } })
      .then((res) => setEmployees(res.data?.data || []))
      .catch(() => setEmployees([]));
  };

  const fetchLeads = async (pageOverride, search = debouncedSearchTerm) => {
    setLoading(true);
    const page = pageOverride || currentPage;
    try {
      const res = await axios.get(`${API_URL}/leads`, {
        params: {
          page,
          limit: PAGE_SIZE,
          search: search || "",
          fromDate: dateRange.from || "",
          toDate: dateRange.to || "",
          statusCategory: statusCategory !== "ALL" ? statusCategory : undefined,
        },
      });
      const pagination = res.data?.pagination || {};
      setRows(res.data?.data || []);
      setTotalPages(pagination.totalPages || 1);
      setTotalItems(pagination.totalItems ?? pagination.total ?? 0);
    } catch (error) {
      console.error("Error fetching leads", error);
      setRows([]);
      setTotalPages(1);
      setTotalItems(0);
      toast.error("Could not load leads");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedAssignQuery(assignQuery), 400);
    return () => clearTimeout(debounce);
  }, [assignQuery]);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  useEffect(() => {
    fetchLeads(currentPage, debouncedSearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm, dateRange.from, dateRange.to, statusCategory]);

  useEffect(() => {
    if (!assignFor) return;
    const onDoc = (event) => {
      if (menuRef.current && !menuRef.current.contains(event.target)) {
        setAssignFor(null);
      }
    };
    document.addEventListener("mousedown", onDoc);
    return () => document.removeEventListener("mousedown", onDoc);
  }, [assignFor]);

  const handleAssign = async (leadId, emp) => {
    try {
      await axios.put(`${API_URL}/leads/${leadId}`, {
        person_id: emp.id,
      });
      setRows((prev) =>
        prev.map((row) =>
          row.lead_id === leadId ? { ...row, person_id: emp.id, owner: emp.name } : row
        )
      );
      toast.success("Assigned");
      setAssignFor(null);
      setAssignQuery("");
      setDebouncedAssignQuery("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to assign");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const leadId = deleteTarget.lead_id;
    try {
      await toast.promise(axios.delete(`${API_URL}/leads/${leadId}`), {
        pending: "Deleting lead...",
        success: `Lead ${leadId} deleted`,
        error: "Failed to delete",
      });
      setRows((prev) => prev.filter((row) => row.lead_id !== leadId));
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
    }
  };

  const handleDownloadExcel = async () => {
    if (rows.length === 0) {
      toast.info("No leads to download");
      return;
    }
    const loadingToast = toast.loading("Preparing Excel...");
    try {
      // The API caps a page at 200 rows, so the export walks the pages.
      const all = [];
      for (let page = 1; ; page += 1) {
        const res = await axios.get(`${API_URL}/leads`, {
          params: {
            page,
            limit: EXPORT_PAGE_SIZE,
            search: debouncedSearchTerm || "",
            fromDate: dateRange.from || "",
            toDate: dateRange.to || "",
          },
        });
        const batch = res.data?.data || [];
        all.push(...batch);
        if (batch.length < EXPORT_PAGE_SIZE || page >= (res.data?.pagination?.totalPages || 1)) break;
      }
      if (all.length === 0) {
        toast.update(loadingToast, {
          render: "No leads match current filters",
          type: "info",
          isLoading: false,
          autoClose: 3000,
        });
        return;
      }
      const excel = all.map((row) => {
        const item = {
          "Lead ID": row.lead_id,
          Name: row.name || "",
          Phone: row.number || "",
          Email: row.email || "",
          Status: row.status || "",
          "Assigned To": row.owner || "Unassigned",
          "Loan Type": row.loan_type || "",
          Source: row.source || "",
        };
        if (canViewCommission) {
          item["Commission (%)"] =
            row.commission_percent !== null && row.commission_percent !== undefined
              ? `${row.commission_percent}%`
              : "0%";
        }
        item["Next Meeting"] = row.next_meeting
          ? moment(row.next_meeting).format("DD MMM YYYY, hh:mm A")
          : "";
        item["Created At"] = row.createdAt ? moment(row.createdAt).format("DD MMM YYYY") : "";
        return item;
      });
      const sheet = XLSX.utils.json_to_sheet(excel);
      const book = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(book, sheet, "Leads");
      XLSX.writeFile(book, `Leads_${moment().format("YYYYMMDD_HHmm")}.xlsx`);
      toast.update(loadingToast, {
        render: `Downloaded ${all.length} leads`,
        type: "success",
        isLoading: false,
        autoClose: 3000,
      });
    } catch (error) {
      console.error(error);
      toast.update(loadingToast, {
        render: "Failed to build Excel",
        type: "error",
        isLoading: false,
        autoClose: 3000,
      });
    }
  };

  const openAssignMenu = (event, leadId) => {
    event.stopPropagation();
    const rect = event.currentTarget.getBoundingClientRect();
    setAssignFor({ leadId, anchor: rect });
    setAssignQuery("");
    setDebouncedAssignQuery("");
  };

  const employeeMatches = employees.filter((emp) => {
    if (!debouncedAssignQuery.trim()) return true;
    const q = debouncedAssignQuery.toLowerCase();
    return (
      String(emp.id).toLowerCase().includes(q) ||
      String(emp.name || "").toLowerCase().includes(q)
    );
  });

  return (
    <div className="cc-report-redesign">
      <ToastContainer position="bottom-right" />

      <style>{`
        .cc-leads-toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
        .cc-leads-toolbar .cc-report-search { flex:1 1 240px; min-width:220px; }
        .cc-leads-toolbar .cc-report-search input { appearance:none; -webkit-appearance:none; height:38px; padding:8px 12px 8px 40px; border:1px solid #d5ded7; border-radius:10px; background:#fff; font-size:13px; color:#0f172a; outline:none; box-shadow:none; }
        .cc-leads-toolbar .cc-report-search input:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); }
        .cc-leads-toolbar .cc-report-search input::-webkit-search-cancel-button { -webkit-appearance:none; height:14px; width:14px; background:#cbd5e1; mask:url("data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' viewBox='0 0 24 24'><path d='M18 6 6 18M6 6l12 12' stroke='black' stroke-width='2' fill='none' stroke-linecap='round'/></svg>") center/12px no-repeat; cursor:pointer; }
        .cc-leads-toolbar .cc-leads-date { display:flex; flex-direction:column; font-size:12px; color:#475569; gap:4px; }
        .cc-leads-toolbar input[type="date"] { padding:8px 10px; border:1px solid #d5ded7; border-radius:10px; font-size:13px; }
        .cc-leads-toolbar .cc-leads-actions { display:flex; gap:8px; margin-left:auto; }
        .cc-leads-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; }
        .cc-leads-btn.primary { background:#047857; color:#fff; }
        .cc-leads-btn.ghost { background:#fff; color:#0f172a; border-color:#d5ded7; }
        .cc-leads-btn:hover { filter:brightness(0.96); }
        .cc-leads-count { font-size:13px; color:#475569; margin-left:2px; }
        .cc-leads-row-actions { display:inline-flex; gap:6px; }
        .cc-leads-icon-btn { width:34px; height:34px; border-radius:8px; border:1px solid #d5ded7; background:#fff; display:grid; place-items:center; cursor:pointer; color:#475569; }
        .cc-leads-icon-btn:hover { color:#047857; border-color:#047857; }
        .cc-leads-icon-btn.edit:hover { color:#2563eb; border-color:#2563eb; background:#eff6ff; }
        .cc-leads-icon-btn.danger:hover { color:#dc2626; border-color:#dc2626; background:#fef2f2; }
        .cc-leads-assign-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:999px; border:1px dashed #cbd5e1; background:#fff; font-size:12px; color:#475569; cursor:pointer; max-width:180px; }
        .cc-leads-assign-btn.assigned { background:#eef7f2; border-style:solid; border-color:#c7e0d4; color:#065f46; font-weight:600; }
        .cc-leads-assign-menu { position:fixed; z-index:60; width:260px; background:#fff; border:1px solid #d5ded7; border-radius:12px; box-shadow:0 12px 30px rgba(15,23,42,0.15); padding:8px; display:flex; flex-direction:column; gap:6px; }
        .cc-leads-assign-menu input { border:1px solid #e2e8f0; border-radius:8px; padding:6px 10px; font-size:12px; }
        .cc-leads-assign-menu ul { list-style:none; margin:0; padding:0; max-height:220px; overflow-y:auto; display:flex; flex-direction:column; gap:2px; }
        .cc-leads-assign-menu li button { width:100%; text-align:left; padding:6px 10px; border-radius:6px; font-size:12.5px; color:#0f172a; background:transparent; border:0; cursor:pointer; display:flex; justify-content:space-between; gap:8px; }
        .cc-leads-assign-menu li button:hover { background:#f1f5f9; }
        .cc-leads-assign-menu li button span:last-child { color:#94a3b8; font-family:ui-monospace,monospace; font-size:11px; }
        .cc-leads-modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:70; display:grid; place-items:center; padding:16px; }
        .cc-leads-modal { background:#fff; border-radius:16px; padding:22px; width:100%; max-width:420px; display:flex; flex-direction:column; gap:14px; }
        .cc-leads-modal h3 { margin:0; font-size:17px; font-weight:700; color:#0f172a; }
        .cc-leads-modal p { margin:0; font-size:13.5px; color:#475569; }
        .cc-leads-modal-actions { display:flex; justify-content:flex-end; gap:8px; }
        .cc-leads-add-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:70; display:grid; place-items:center; padding:16px; }
        .cc-leads-add-modal { background:#fff; border-radius:16px; padding:20px; width:100%; max-width:640px; max-height:90vh; overflow-y:auto; }

        /* Pagination polish */
        .cc-report-pagination { padding:14px 4px 4px; border-top:1px solid #eef1ee; margin-top:10px; gap:12px; flex-wrap:wrap; }
        .cc-report-pagination > span { font-size:13px; color:#475569; }
        .cc-report-pagination > span b { color:#0f172a; font-weight:600; }
        .cc-report-pagination div { gap:6px; }
        .cc-report-pagination button { border-radius:10px !important; padding:8px 14px !important; font-size:13px !important; font-weight:600 !important; }
        .cc-leads-pager-jump { display:inline-flex; align-items:center; gap:6px; margin:0 4px; }
        .cc-leads-pager-jump input { width:56px; padding:6px 8px; border:1px solid #d5ded7; border-radius:8px; font-size:13px; text-align:center; }

        .cc-leads-category-tabs { display:inline-flex; gap:4px; background:#f1f5f9; padding:3px; border-radius:10px; border:1px solid #e2e8f0; }
        .cc-leads-category-tabs button { border:0; background:transparent; padding:6px 14px; border-radius:7px; font-size:12.5px; font-weight:600; color:#475569; cursor:pointer; transition:all .15s ease; }
        .cc-leads-category-tabs button:hover { color:#0f172a; }
        .cc-leads-category-tabs button.active { background:#fff; color:#047857; box-shadow:0 1px 3px rgba(0,0,0,0.08); font-weight:700; }
      `}</style>

      <section className="cc-report-panel">
        <div className="cc-leads-toolbar">
          <label className="cc-report-search" style={{ flex: "1 1 260px" }}>
            <Search size={18} />
            <input
              type="search"
              placeholder="Search by name, phone, email or employee ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <label className="cc-leads-date">
            From date
            <input
              type="date"
              value={dateRange.from}
              max={dateRange.to}
              onChange={(event) => {
                setDateRange((prev) => ({ ...prev, from: event.target.value }));
                setCurrentPage(1);
              }}
            />
          </label>
          <label className="cc-leads-date">
            To date
            <input
              type="date"
              value={dateRange.to}
              min={dateRange.from}
              onChange={(event) => {
                setDateRange((prev) => ({ ...prev, to: event.target.value }));
                setCurrentPage(1);
              }}
            />
          </label>
          <div className="cc-leads-actions">
            {canExport && (
              <button type="button" className="cc-leads-btn ghost" onClick={handleDownloadExcel}>
                <Download size={16} /> Excel
              </button>
            )}
            <button type="button" className="cc-leads-btn primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Add lead
            </button>
          </div>
        </div>
      </section>

      <section className="cc-report-panel">
        <div className="cc-report-table-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <h2>Leads <span className="cc-leads-count">({numberFormatter.format(totalItems)})</span></h2>
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
              ⏳ Pending Leads
            </button>
            <button
              type="button"
              className={statusCategory === "COMPLETED" ? "active" : ""}
              onClick={() => {
                setStatusCategory("COMPLETED");
                setCurrentPage(1);
              }}
            >
              ✅ Completed Leads
            </button>
          </div>
        </div>

        <div className="cc-report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lead ID</th>
                <th>Name</th>
                <th>Phone</th>
                <th>Source / Party</th>
                {canViewCommission && <th>Party Commission</th>}
                <th>Status</th>
                <th>Assigned to</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={canViewCommission ? 8 : 7} className="cc-report-empty">Loading leads...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={canViewCommission ? 8 : 7} className="cc-report-empty">No leads match the filters</td>
                </tr>
              ) : (
                rows.map((row) => (
                  <tr key={row.lead_id}>
                    <td onClick={() => navigate(`/lead-details/${row.lead_id}`)} style={{ cursor: "pointer", fontWeight: 600 }}>
                      {row.lead_id}
                    </td>
                    <td onClick={() => navigate(`/lead-details/${row.lead_id}`)} style={{ cursor: "pointer" }}>
                      {row.name || "--"}
                    </td>
                    <td>{row.number || "--"}</td>
                    <td>
                      <span
                        style={{
                          display: "inline-flex",
                          alignItems: "center",
                          padding: "2px 8px",
                          borderRadius: "12px",
                          fontSize: "12px",
                          fontWeight: 600,
                          background: row.source && row.source.toLowerCase() !== "self" ? "#eff6ff" : "#f1f5f9",
                          color: row.source && row.source.toLowerCase() !== "self" ? "#1d4ed8" : "#475569",
                          border: `1px solid ${row.source && row.source.toLowerCase() !== "self" ? "#bfdbfe" : "#e2e8f0"}`,
                        }}
                      >
                        {row.source || "Self"}
                      </span>
                    </td>
                    {canViewCommission && (
                      <td>
                        {row.commission_percent !== null && row.commission_percent !== undefined ? (
                          <span
                            style={{
                              display: "inline-flex",
                              alignItems: "center",
                              padding: "2px 8px",
                              borderRadius: "10px",
                              fontSize: "12px",
                              fontWeight: 700,
                              background: "#ecfdf5",
                              color: "#047857",
                              border: "1px solid #a7f3d0",
                            }}
                          >
                            {row.commission_percent}%
                          </span>
                        ) : (
                          <span style={{ fontSize: "12px", color: "#94a3b8" }}>--</span>
                        )}
                      </td>
                    )}
                    <td>
                      <span className="cc-report-status">{row.status || "Unassigned"}</span>
                    </td>
                    <td>
                      {isEmployee ? (
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
                    <td>
                      <div className="cc-leads-row-actions">
                        <button
                          type="button"
                          className="cc-leads-icon-btn"
                          title="View lead details"
                          onClick={() => navigate(`/lead-details/${row.lead_id}`)}
                        >
                          <Eye size={16} />
                        </button>
                        <button
                          type="button"
                          className="cc-leads-icon-btn edit"
                          title="Edit lead"
                          onClick={() => navigate(`/lead-edit/${row.lead_id}`)}
                        >
                          <Pencil size={15} />
                        </button>
                        {canDelete && (
                          <button
                            type="button"
                            className="cc-leads-icon-btn danger"
                            title="Delete lead"
                            onClick={() => setDeleteTarget(row)}
                          >
                            <Trash2 size={16} />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <CcPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          itemLabel="leads"
        />
      </section>

      {assignFor ? (
        <div
          ref={menuRef}
          className="cc-leads-assign-menu"
          style={{
            top: Math.min(assignFor.anchor.bottom + 6, window.innerHeight - 260),
            left: Math.min(assignFor.anchor.left, window.innerWidth - 280),
          }}
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

      {deleteTarget ? (
        <div className="cc-leads-modal-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cc-leads-modal" onClick={(event) => event.stopPropagation()}>
            <h3>Delete lead {deleteTarget.lead_id}?</h3>
            <p>
              This permanently removes lead <strong>{deleteTarget.name || deleteTarget.lead_id}</strong>{" "}
              and its history. This cannot be undone.
            </p>
            <div className="cc-leads-modal-actions">
              <button type="button" className="cc-leads-btn ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="cc-leads-btn primary" style={{ background: "#dc2626" }} onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <AddLeadModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={() => fetchLeads(currentPage)}
      />
    </div>
  );
}
