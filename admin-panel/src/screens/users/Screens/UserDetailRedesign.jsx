import React, { useEffect, useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import axios from "axios";
import { ToastContainer } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  ArrowLeft,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Key,
  Shield,
  ShieldCheck,
} from "lucide-react";
import API_URL from "../../../config";
import CcPagination from "../../../components/CcPagination";
import ResetPasswordModal from "../ResetPasswordModal";
import ManagePermissionsModal from "../ManagePermissionsModal";

const ROLE_LABELS = {
  EMPLOYEE: "Sales Manager",
  MANAGER: "Manager",
  OPS: "Operations",
  COMPANY_ADMIN: "Company Admin",
  BANKER: "Banker",
  FINANCE: "Finance & Accounts",
};
const ROLE_CLASS = {
  EMPLOYEE: "role-sales",
  MANAGER: "role-manager",
  OPS: "role-ops",
  COMPANY_ADMIN: "role-manager",
  BANKER: "role-ops",
  FINANCE: "role-finance",
};

const PAGE_SIZE_OPTIONS = [10, 20, 50, 100];

export default function UserDetailRedesign() {
  const { emp_id } = useParams();
  const navigate = useNavigate();
  const [employee, setEmployee] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [leads, setLeads] = useState({ rows: [], total: 0 });
  const [calls, setCalls] = useState({ rows: [], total: 0 });
  const [tasks, setTasks] = useState({ rows: [], total: 0 });

  const [leadsPage, setLeadsPage] = useState(1);
  const [callsPage, setCallsPage] = useState(1);
  const [tasksPage, setTasksPage] = useState(1);
  const [leadsSize, setLeadsSize] = useState(10);
  const [callsSize, setCallsSize] = useState(10);
  const [tasksSize, setTasksSize] = useState(10);
  const [showLeads, setShowLeads] = useState(true);
  const [showCalls, setShowCalls] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  const [showResetPassword, setShowResetPassword] = useState(false);
  const [showPermissionsModal, setShowPermissionsModal] = useState(false);

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/users/${emp_id}`);
      setEmployee(res.data?.data || null);
    } catch (err) {
      setError(err.message || "Failed to load employee");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (emp_id) fetchEmployee();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [emp_id]);

  useEffect(() => {
    if (!emp_id) return;
    axios
      .get(`${API_URL}/leads`, {
        params: { assignedEmployeeId: emp_id, page: leadsPage, limit: leadsSize },
      })
      .then((res) => {
        const rows = res.data?.data || [];
        const total = res.data?.pagination?.totalItems ?? res.data?.pagination?.total ?? rows.length;
        setLeads({ rows, total });
      })
      .catch(() => setLeads({ rows: [], total: 0 }));
  }, [emp_id, leadsPage, leadsSize]);

  useEffect(() => {
    if (!emp_id) return;
    axios
      .get(`${API_URL}/calls`, { params: { userId: emp_id, page: callsPage, limit: callsSize } })
      .then((res) => {
        const rows = res.data?.data || [];
        const total = res.data?.pagination?.totalItems ?? res.data?.pagination?.total ?? rows.length;
        setCalls({ rows, total });
      })
      .catch(() => setCalls({ rows: [], total: 0 }));
  }, [emp_id, callsPage, callsSize]);

  useEffect(() => {
    if (!emp_id) return;
    axios
      .get(`${API_URL}/tasks`, { params: { userId: emp_id, page: tasksPage, limit: tasksSize } })
      .then((res) => {
        const rows = res.data?.data || [];
        const total = res.data?.pagination?.totalItems ?? res.data?.pagination?.total ?? rows.length;
        setTasks({ rows, total });
      })
      .catch(() => setTasks({ rows: [], total: 0 }));
  }, [emp_id, tasksPage, tasksSize]);

  if (loading) return <div className="cc-report-redesign"><section className="cc-report-panel">Loading...</section></div>;
  if (error) return <div className="cc-report-redesign"><section className="cc-report-panel" style={{ color: "#dc2626" }}>Error: {error}</section></div>;
  if (!employee) return <div className="cc-report-redesign"><section className="cc-report-panel">Employee not found</section></div>;

  const roleKey = employee.role || "EMPLOYEE";
  const roleLabel = ROLE_LABELS[roleKey] || roleKey;
  const roleClass = ROLE_CLASS[roleKey] || "role-sales";
  const statusKey = (employee.status || "active").toLowerCase();

  return (
    <div className="cc-report-redesign cc-userdetail">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      <button type="button" className="cc-udt-back" onClick={() => navigate(-1)}>
        <ArrowLeft size={16} /> Back to employees
      </button>

      <section className="cc-report-panel cc-udt-hero">
        <div className="cc-udt-hero-top">
          <div className="cc-udt-hero-main">
            <div className="cc-udt-avatar">{(employee.name || String(employee.id) || "?").slice(0, 2).toUpperCase()}</div>
            <div>
              <h1>{employee.name || "Unnamed"}</h1>
              <div className="cc-udt-hero-meta">
                <span className={`cc-role-pill ${roleClass}`}>{roleLabel}</span>
                <span className={`cc-status-dot cc-status-${statusKey}`}>
                  <i /> {statusKey === "active" ? "Active" : "Inactive"}
                </span>
                <span className="cc-udt-empid">ID: {employee.id}</span>
              </div>
            </div>
          </div>
          <div style={{ display: "flex", gap: "8px", flexWrap: "wrap", alignItems: "center" }}>
            <button
              type="button"
              className="cc-udt-btn ghost"
              onClick={() => setShowPermissionsModal(true)}
              title="Manage custom employee role permissions"
              style={{ color: "#2563eb", borderColor: "#bfdbfe" }}
            >
              <Shield size={14} /> Manage Custom Permissions
            </button>
            <button
              type="button"
              className="cc-udt-btn ghost"
              onClick={() => setShowResetPassword(true)}
              title="Reset employee password"
            >
              <Key size={14} /> Reset Password
            </button>
          </div>
        </div>

        <dl className="cc-udt-info">
          <div><dt>Phone</dt><dd>{employee.phone || "--"}</dd></div>
          <div><dt>Email</dt><dd>{employee.email || "--"}</dd></div>
          <div><dt>Branch</dt><dd>{employee.branch?.name || "--"}</dd></div>
          <div><dt>Reports to</dt><dd>{employee.manager?.name || "--"}</dd></div>
          <div>
            <dt>Monthly Salary</dt>
            <dd style={{ fontWeight: 700, color: "#047857" }}>
              {employee.salary !== null && employee.salary !== undefined && employee.salary !== ""
                ? `₹${Number(employee.salary).toLocaleString("en-IN")}`
                : "₹0"}
            </dd>
          </div>
        </dl>

        {/* Feature Permissions Quick Overview */}
        <div style={{ marginTop: 16, paddingTop: 16, borderTop: "1px solid #e2e8f0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8, flexWrap: "wrap", gap: 6 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: "#1e293b", display: "inline-flex", alignItems: "center", gap: 6 }}>
              <ShieldCheck size={16} color="#2563eb" /> Active Permissions & Feature Access
            </span>
            {employee.permissions && Object.keys(employee.permissions).length > 0 ? (
              <span style={{ fontSize: 11, fontWeight: 600, color: "#2563eb", background: "#eff6ff", padding: "2px 8px", borderRadius: 999 }}>
                {Object.keys(employee.permissions).length} Custom Override(s) Applied
              </span>
            ) : (
              <span style={{ fontSize: 11, fontWeight: 500, color: "#64748b" }}>
                Inherited from Role Defaults ({roleLabel})
              </span>
            )}
          </div>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {Object.entries(employee.resolvedPermissions || employee.permissions || {}).map(([key, val]) => (
              <span
                key={key}
                style={{
                  fontSize: 11,
                  padding: "2px 8px",
                  borderRadius: 6,
                  fontWeight: 500,
                  background: val ? "#eef7f2" : "#fef2f2",
                  color: val ? "#047857" : "#b91c1c",
                  border: `1px solid ${val ? "#c7e0d4" : "#fecaca"}`,
                  textDecoration: val ? "none" : "line-through",
                }}
                title={`${key}: ${val ? "Granted" : "Restricted"}`}
              >
                {key}
              </span>
            ))}
          </div>
        </div>
      </section>

      <CollapsibleSection
        title="Associated leads"
        total={leads.total}
        pageSize={leadsSize}
        setPageSize={(v) => { setLeadsSize(v); setLeadsPage(1); }}
        page={leadsPage}
        setPage={setLeadsPage}
        expanded={showLeads}
        onToggle={() => setShowLeads((v) => !v)}
      >
        <MiniTable
          columns={["Lead ID", "Name", "Email", "Phone", "Status"]}
          rows={leads.rows}
          emptyText="No leads for this employee"
          renderRow={(lead) => (
            <tr
              key={lead.lead_id}
              className="cc-udt-row"
              onClick={() => navigate(`/lead-details/${lead.lead_id}`)}
            >
              <td>{lead.lead_id}</td>
              <td>{lead.name || "--"}</td>
              <td>{lead.email || "--"}</td>
              <td>{lead.number || "--"}</td>
              <td>
                <span className="cc-report-status">{lead.status || "--"}</span>
              </td>
            </tr>
          )}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Call logs"
        total={calls.total}
        pageSize={callsSize}
        setPageSize={(v) => { setCallsSize(v); setCallsPage(1); }}
        page={callsPage}
        setPage={setCallsPage}
        expanded={showCalls}
        onToggle={() => setShowCalls((v) => !v)}
      >
        <MiniTable
          columns={["Call ID", "Name", "Number", "Remark", "When"]}
          rows={calls.rows}
          emptyText="No call logs for this employee"
          renderRow={(call) => (
            <tr key={call.call_id}>
              <td>{call.call_id}</td>
              <td>{call.customer_name || "--"}</td>
              <td>{call.customer_number || "--"}</td>
              <td className="cc-udt-wrap">{call.remarks || "--"}</td>
              <td>{call.createdAt ? new Date(call.createdAt).toLocaleString() : "--"}</td>
            </tr>
          )}
        />
      </CollapsibleSection>

      <CollapsibleSection
        title="Tasks"
        total={tasks.total}
        pageSize={tasksSize}
        setPageSize={(v) => { setTasksSize(v); setTasksPage(1); }}
        page={tasksPage}
        setPage={setTasksPage}
        expanded={showTasks}
        onToggle={() => setShowTasks((v) => !v)}
      >
        <MiniTable
          columns={["Task ID", "Title", "Lead", "Due", "Priority", "Status", "Description"]}
          rows={tasks.rows}
          emptyText="No tasks for this employee"
          renderRow={(task) => {
            const status = task.status || "";
            const statusClass =
              status === "COMPLETED" ? "task-done" : status === "IN_PROGRESS" ? "task-progress" : "task-idle";
            return (
              <tr key={task.task_id}>
                <td>{task.task_id}</td>
                <td>{task.title || "--"}</td>
                <td>{task.customer_name || task.lead_id || "--"}</td>
                <td>{task.due_date ? new Date(task.due_date).toLocaleString() : "--"}</td>
                <td>{task.priority || "--"}</td>
                <td><span className={`cc-udt-task-status ${statusClass}`}>{status || "--"}</span></td>
                <td className="cc-udt-wrap" title={task.description}>
                  {task.description && task.description.length > 40
                    ? `${task.description.slice(0, 40)}...`
                    : task.description || "--"}
                </td>
              </tr>
            );
          }}
        />
      </CollapsibleSection>

      <ResetPasswordModal
        open={showResetPassword}
        onClose={() => setShowResetPassword(false)}
        user={employee}
      />

      <ManagePermissionsModal
        open={showPermissionsModal}
        onClose={() => setShowPermissionsModal(false)}
        user={employee}
        onUpdated={() => {
          fetchEmployee();
        }}
      />
    </div>
  );
}

function CollapsibleSection({ title, total, page, setPage, pageSize, setPageSize, expanded, onToggle, children }) {
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  return (
    <section className="cc-report-panel">
      <div className="cc-udt-section-head">
        <button type="button" className="cc-udt-toggle" onClick={onToggle}>
          {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
          <h2>{title}</h2>
          <span className="cc-udt-count">{total}</span>
        </button>
        {expanded ? (
          <label className="cc-udt-pageSize">
            Show
            <select value={pageSize} onChange={(event) => setPageSize(Number(event.target.value))}>
              {PAGE_SIZE_OPTIONS.map((count) => (
                <option key={count} value={count}>{count}</option>
              ))}
            </select>
            per page
          </label>
        ) : null}
      </div>

      {expanded ? (
        <>
          <div className="cc-report-table-scroll">{children}</div>
          {total > pageSize ? (
            <CcPagination
              currentPage={page}
              totalPages={totalPages}
              totalItems={total}
              onPageChange={setPage}
            />
          ) : null}
        </>
      ) : null}
    </section>
  );
}

function MiniTable({ columns, rows, renderRow, emptyText }) {
  if (rows.length === 0) {
    return <p className="cc-report-empty" style={{ padding: "18px 0" }}>{emptyText}</p>;
  }
  return (
    <table>
      <thead>
        <tr>
          {columns.map((column) => (
            <th key={column}>{column}</th>
          ))}
        </tr>
      </thead>
      <tbody>{rows.map(renderRow)}</tbody>
    </table>
  );
}


const styles = `
  .cc-userdetail .cc-udt-back { display:inline-flex; align-items:center; gap:6px; background:none; border:0; color:#475569; font-size:13px; cursor:pointer; padding:4px 0; margin-bottom:4px; }
  .cc-userdetail .cc-udt-back:hover { color:#047857; }

  .cc-udt-hero { display:flex; flex-direction:column; gap:18px; }
  .cc-udt-hero-top { display:flex; justify-content:space-between; align-items:flex-start; gap:16px; flex-wrap:wrap; }
  .cc-udt-hero-main { display:flex; align-items:center; gap:16px; }
  .cc-udt-avatar { width:64px; height:64px; border-radius:50%; background:linear-gradient(135deg,#065f46,#10b981); color:#fff; display:grid; place-items:center; font-size:22px; font-weight:700; letter-spacing:0.02em; }
  .cc-udt-hero h1 { margin:0; font-size:24px; font-weight:700; color:#0f172a; letter-spacing:-0.01em; }
  .cc-udt-hero-meta { display:flex; align-items:center; gap:10px; margin-top:6px; flex-wrap:wrap; }
  .cc-udt-empid { font-size:12px; color:#94a3b8; font-family:ui-monospace,monospace; }

  .cc-udt-info { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:14px; margin:0; padding:16px 0 4px; border-top:1px solid #eef1ee; }
  .cc-udt-info > div { display:flex; flex-direction:column; gap:2px; }
  .cc-udt-info dt { font-size:12px; color:#94a3b8; }
  .cc-udt-info dd { margin:0; font-size:14px; color:#0f172a; font-weight:500; }
  .cc-udt-info code { font-family:ui-monospace,monospace; font-size:13px; background:#f1f5f9; padding:2px 8px; border-radius:6px; color:#0f172a; }

  .cc-role-pill { display:inline-flex; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:600; }
  .cc-role-pill.role-sales { background:#eef7f2; color:#047857; }
  .cc-role-pill.role-manager { background:#eef2ff; color:#4338ca; }
  .cc-role-pill.role-ops { background:#fff7ed; color:#c2410c; }
  .cc-status-dot { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500; color:#475569; }
  .cc-status-dot i { width:8px; height:8px; border-radius:50%; background:#94a3b8; }
  .cc-status-dot.cc-status-active i { background:#10b981; }
  .cc-status-dot.cc-status-active { color:#047857; }
  .cc-status-dot.cc-status-inactive i { background:#f43f5e; }
  .cc-status-dot.cc-status-inactive { color:#be123c; }

  .cc-udt-drop { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; text-align:center; padding:26px 20px; border:1.5px dashed #cbd5e1; border-radius:12px; background:#f8fafc; color:#475569; cursor:pointer; transition:border-color .12s, background-color .12s; }
  .cc-udt-drop:hover, .cc-udt-drop.over { border-color:#047857; background:#eef7f2; color:#047857; }
  .cc-udt-drop p { margin:0; font-size:14px; }
  .cc-udt-drop small { font-size:12px; color:#94a3b8; }

  .cc-udt-pending { margin-top:14px; border:1px solid #eef1ee; border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:8px; background:#fff; }
  .cc-udt-pending h3 { margin:0; font-size:13px; font-weight:700; color:#0f172a; }
  .cc-udt-pending ul { list-style:none; margin:0; padding:0; display:flex; flex-direction:column; gap:4px; }
  .cc-udt-pending li { display:flex; align-items:center; gap:8px; font-size:13px; color:#334155; padding:6px 8px; background:#f8fafc; border-radius:8px; }
  .cc-udt-pending li span { flex:1; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cc-udt-pending li small { color:#94a3b8; font-size:11px; }
  .cc-udt-pending li button { border:0; background:transparent; color:#94a3b8; cursor:pointer; display:grid; place-items:center; width:24px; height:24px; border-radius:6px; }
  .cc-udt-pending li button:hover { color:#dc2626; background:#fee2e2; }

  .cc-udt-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; }
  .cc-udt-btn.primary { background:#047857; color:#fff; }
  .cc-udt-btn.ghost { background:#fff; color:#0f172a; border:1px solid #d5ded7; }
  .cc-udt-btn:disabled { opacity:0.5; cursor:not-allowed; }

  .cc-udt-docs { display:grid; grid-template-columns:repeat(auto-fit,minmax(240px,1fr)); gap:10px; margin-top:14px; }
  .cc-udt-doc { display:flex; align-items:center; justify-content:space-between; gap:10px; padding:10px 12px; border:1px solid #eef1ee; border-radius:10px; background:#f8fafc; }
  .cc-udt-doc a { display:inline-flex; align-items:center; gap:8px; color:#047857; text-decoration:none; font-size:13px; font-weight:500; overflow:hidden; }
  .cc-udt-doc a span { overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .cc-udt-doc a:hover { text-decoration:underline; }

  .cc-icon-btn { width:30px; height:30px; border-radius:8px; border:1px solid #d5ded7; background:#fff; display:grid; place-items:center; color:#475569; cursor:pointer; }
  .cc-icon-btn:hover { color:#047857; border-color:#047857; }
  .cc-icon-btn.danger:hover { color:#dc2626; border-color:#dc2626; }

  .cc-udt-section-head { display:flex; align-items:center; justify-content:space-between; gap:12px; flex-wrap:wrap; }
  .cc-udt-toggle { display:inline-flex; align-items:center; gap:8px; background:none; border:0; padding:0; cursor:pointer; color:#0f172a; }
  .cc-udt-toggle h2 { margin:0; font-size:15px; font-weight:700; }
  .cc-udt-count { display:inline-grid; place-items:center; min-width:24px; padding:0 8px; height:22px; border-radius:999px; background:#eef7f2; color:#047857; font-size:12px; font-weight:600; }
  .cc-udt-pageSize { font-size:12px; color:#475569; display:inline-flex; align-items:center; gap:6px; }
  .cc-udt-pageSize select { padding:4px 8px; border:1px solid #d5ded7; border-radius:8px; font-size:12px; color:#0f172a; background:#fff; }

  .cc-udt-row { cursor:pointer; }
  .cc-udt-row:hover { background:#f8fafc; }
  .cc-udt-wrap { max-width:280px; white-space:normal !important; word-break:break-word; }

  .cc-udt-task-status { display:inline-flex; padding:2px 10px; border-radius:999px; font-size:11.5px; font-weight:600; }
  .cc-udt-task-status.task-done { background:#eef7f2; color:#047857; }
  .cc-udt-task-status.task-progress { background:#eef2ff; color:#4338ca; }
  .cc-udt-task-status.task-idle { background:#f1f5f9; color:#475569; }

  .cc-udt-pagination { padding:14px 4px 4px; border-top:1px solid #eef1ee; margin-top:10px; gap:12px; flex-wrap:wrap; }
  .cc-udt-pagination > span { font-size:13px; color:#475569; }
  .cc-udt-pagination > span b { color:#0f172a; font-weight:600; }
  .cc-udt-pagination div { gap:6px; }
  .cc-udt-pagination button { border-radius:10px !important; padding:8px 14px !important; font-size:13px !important; font-weight:600 !important; }
`;
