import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { Pencil, Plus, Search, Trash2, X } from "lucide-react";
import API_URL from "../../config";

const TEAM_OPTIONS = [
  { value: "calling", label: "Sales team" },
  { value: "operations", label: "Operations team" },
  { value: "both", label: "Both teams" },
];

const teamLabel = (team) => TEAM_OPTIONS.find((option) => option.value === team)?.label || team;
const teamClass = (team) => {
  switch (team) {
    case "operations":
      return "team-ops";
    case "both":
      return "team-both";
    default:
      return "team-sales";
  }
};

const emptyForm = () => ({
  name: "",
  team: "calling",
  sort_order: 100,
  is_initial: false,
  is_file_login: false,
});

export default function LeadStatusesRedesign() {
  const userRole = localStorage.getItem("userRole") || "";
  const isCompanyAdmin = userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN";
  const userPermissions = useMemo(() => {
    try {
      const stored = localStorage.getItem("userPermissions");
      return stored ? JSON.parse(stored) : {};
    } catch {
      return {};
    }
  }, []);
  const canManage = isCompanyAdmin || Boolean(userPermissions.manageLeadStatuses || userPermissions.manageSettings);
  const canDelete = isCompanyAdmin || Boolean(userPermissions.manageLeadStatuses || userPermissions.manageSettings || userPermissions.deleteRecords);

  const [statuses, setStatuses] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [teamFilter, setTeamFilter] = useState("");
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const fetchStatuses = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/lead-statuses`, {
        params: { includeInactive: true },
      });
      setStatuses(res.data?.statuses || []);
    } catch (error) {
      console.error("Error fetching statuses", error);
      toast.error("Could not load statuses");
      setStatuses([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const openCreate = () => {
    if (!canManage) {
      toast.error("You do not have permission to add lead statuses");
      return;
    }
    setEditing(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEdit = (status) => {
    if (!canManage) {
      toast.error("You do not have permission to edit lead statuses");
      return;
    }
    setEditing(status);
    setForm({
      name: status.name || "",
      team: status.team || "calling",
      sort_order: status.sort_order ?? 100,
      is_initial: !!status.is_initial,
      is_file_login: !!status.is_file_login,
    });
    setModalOpen(true);
  };

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Status name is required");
      return;
    }
    setSubmitting(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/lead-statuses/${editing.status_id}`, form);
        toast.success("Status updated");
      } else {
        await axios.post(`${API_URL}/lead-statuses`, form);
        toast.success("Status created");
      }
      setModalOpen(false);
      setForm(emptyForm());
      setEditing(null);
      fetchStatuses();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not save status");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (status) => {
    if (!canManage) {
      toast.error("You do not have permission to modify status state");
      return;
    }
    try {
      await axios.put(`${API_URL}/lead-statuses/${status.status_id}`, {
        is_active: !status.is_active,
      });
      setStatuses((prev) =>
        prev.map((row) => (row.status_id === status.status_id ? { ...row, is_active: !row.is_active } : row))
      );
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not update status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    if (!canDelete) {
      toast.error("You do not have permission to delete lead statuses");
      return;
    }
    try {
      await axios.delete(`${API_URL}/lead-statuses/${deleteTarget.status_id}`);
      toast.success("Status deleted");
      setDeleteTarget(null);
      fetchStatuses();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not delete status");
    }
  };

  const filtered = useMemo(() => {
    return statuses.filter((status) => {
      if (teamFilter && status.team !== teamFilter) return false;
      if (!debouncedSearchTerm.trim()) return true;
      const query = debouncedSearchTerm.toLowerCase();
      return String(status.name || "").toLowerCase().includes(query);
    });
  }, [statuses, debouncedSearchTerm, teamFilter]);

  return (
    <div className="cc-report-redesign cc-ls">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      <section className="cc-report-panel cc-ls-topbar">
        <label className="cc-ls-search-shell">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search status by name..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchTerm ? (
            <button type="button" className="cc-ls-search-clear" onClick={() => setSearchTerm("")} title="Clear search">
              <X size={14} />
            </button>
          ) : null}
        </label>
        <label className="cc-ls-filter">
          Team
          <select value={teamFilter} onChange={(event) => setTeamFilter(event.target.value)}>
            <option value="">All teams</option>
            {TEAM_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="cc-ls-btn primary cc-ls-topbar-add" onClick={openCreate}>
          <Plus size={16} /> New status
        </button>
      </section>

      <section className="cc-report-panel">
        <div className="cc-report-table-head">
          <h2>Lead statuses <span className="cc-ls-count">({filtered.length})</span></h2>
        </div>
        <div className="cc-report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Status</th>
                <th>Team</th>
                <th>Flags</th>
                <th>Sort order</th>
                <th>Active</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="cc-report-empty">Loading statuses...</td></tr>
              ) : filtered.length === 0 ? (
                <tr><td colSpan={6} className="cc-report-empty">No statuses match the filters</td></tr>
              ) : (
                filtered.map((status) => (
                  <tr key={status.status_id}>
                    <td>
                      <span className="cc-ls-name">
                        <i style={{ background: status.color || "#94a3b8" }} />
                        {status.name}
                      </span>
                    </td>
                    <td>
                      <span className={`cc-ls-team ${teamClass(status.team)}`}>{teamLabel(status.team)}</span>
                    </td>
                    <td>
                      <span className="cc-ls-flags">
                        {status.is_initial ? <span className="cc-ls-flag initial">Initial</span> : null}
                        {status.is_file_login ? <span className="cc-ls-flag file">File login</span> : null}
                        {status.is_protected ? <span className="cc-ls-flag system">System</span> : null}
                        {!status.is_initial && !status.is_file_login && !status.is_protected ? (
                          <span className="cc-ls-flag empty">—</span>
                        ) : null}
                      </span>
                    </td>
                    <td className="cc-ls-order">{status.sort_order}</td>
                    <td>
                      <button
                        type="button"
                        className={`cc-ls-toggle ${status.is_active ? "on" : "off"}`}
                        onClick={() => handleToggleActive(status)}
                        title={status.is_active ? "Deactivate" : "Activate"}
                      >
                        <i /> {status.is_active ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td>
                      <div className="cc-ls-actions">
                        <button
                          type="button"
                          className="cc-ls-icon-btn"
                          title="Edit"
                          onClick={() => openEdit(status)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="cc-ls-icon-btn danger"
                          title={
                            status.is_protected || status.is_initial || status.is_file_login
                              ? "Protected status can't be deleted"
                              : "Delete"
                          }
                          disabled={status.is_protected || status.is_initial || status.is_file_login}
                          onClick={() => setDeleteTarget(status)}
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      {modalOpen ? (
        <div className="cc-ls-overlay" onClick={() => setModalOpen(false)}>
          <div className="cc-ls-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-ls-modal-head">
              <h3>{editing ? "Edit status" : "New status"}</h3>
              <button type="button" onClick={() => setModalOpen(false)}><X size={16} /></button>
            </div>
            <form
              className="cc-ls-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <label className="cc-form-field">
                <span>Status name *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. Documents Sent"
                />
              </label>
              <div className="cc-ls-form-row">
                <label className="cc-form-field">
                  <span>Team</span>
                  <select
                    value={form.team}
                    onChange={(event) => setForm({ ...form, team: event.target.value })}
                  >
                    {TEAM_OPTIONS.map((option) => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cc-form-field">
                  <span>Sort order</span>
                  <input
                    type="number"
                    value={form.sort_order}
                    onChange={(event) =>
                      setForm({ ...form, sort_order: Number(event.target.value) || 0 })
                    }
                  />
                </label>
              </div>
              <div className="cc-ls-flags-row">
                <label className={`cc-ls-flag-toggle ${form.is_initial ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={form.is_initial}
                    onChange={(event) => setForm({ ...form, is_initial: event.target.checked })}
                  />
                  <span>Initial</span>
                  <small>Applied to freshly created leads</small>
                </label>
                <label className={`cc-ls-flag-toggle ${form.is_file_login ? "on" : ""}`}>
                  <input
                    type="checkbox"
                    checked={form.is_file_login}
                    onChange={(event) => setForm({ ...form, is_file_login: event.target.checked })}
                  />
                  <span>File login</span>
                  <small>Handoff marker to operations queue</small>
                </label>
              </div>
              <div className="cc-ls-modal-actions">
                <button type="button" className="cc-ls-btn ghost" onClick={() => setModalOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="cc-ls-btn primary" disabled={submitting}>
                  {submitting ? "Saving..." : editing ? "Save changes" : "Create status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="cc-ls-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cc-ls-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-ls-modal-head">
              <h3>Delete status?</h3>
              <button type="button" onClick={() => setDeleteTarget(null)}><X size={16} /></button>
            </div>
            <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
              Delete <strong>{deleteTarget.name}</strong>. Any leads currently on this status will lose it. This cannot be undone.
            </p>
            <div className="cc-ls-modal-actions">
              <button type="button" className="cc-ls-btn ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="cc-ls-btn primary danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = `
  .cc-ls-topbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:12px 16px; }
  .cc-ls-search-shell { position:relative; flex:1 1 320px; min-width:220px; max-width:520px; display:flex; align-items:center; height:42px; padding:0 12px 0 40px; border:1px solid #cbd5e1; border-radius:12px; background:#fff; transition:border-color .12s, box-shadow .12s; }
  .cc-ls-search-shell:focus-within { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); }
  .cc-ls-search-shell svg { position:absolute; left:12px; color:#94a3b8; pointer-events:none; }
  .cc-ls-search-shell input { flex:1; border:0; outline:none; background:transparent; font-size:14px; color:#0f172a; padding:0; height:100%; }
  .cc-ls-search-shell input::placeholder { color:#94a3b8; }
  .cc-ls-search-shell input::-webkit-search-cancel-button { -webkit-appearance:none; }
  .cc-ls-search-clear { border:0; background:#f1f5f9; color:#475569; width:22px; height:22px; border-radius:6px; display:grid; place-items:center; cursor:pointer; margin-left:8px; }
  .cc-ls-search-clear:hover { background:#e2e8f0; color:#0f172a; }
  .cc-ls-filter { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:#475569; text-transform:uppercase; letter-spacing:0.04em; padding:0 4px; }
  .cc-ls-filter select { padding:8px 14px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; min-width:160px; height:42px; font-weight:500; text-transform:none; letter-spacing:0; }
  .cc-ls-filter select:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }
  .cc-ls-topbar-add { margin-left:auto; height:42px; padding:0 18px; }
  .cc-ls-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; margin-left:auto; }
  .cc-ls-btn.primary { background:#047857; color:#fff; }
  .cc-ls-btn.primary.danger { background:#dc2626; }
  .cc-ls-btn.primary:hover:not(:disabled) { filter:brightness(0.96); }
  .cc-ls-btn.ghost { background:#fff; color:#0f172a; border:1px solid #cbd5e1; margin-left:0; }
  .cc-ls-btn:disabled { opacity:0.5; cursor:not-allowed; }

  .cc-ls-count { font-size:13px; color:#475569; margin-left:2px; }
  .cc-ls-name { display:inline-flex; align-items:center; gap:8px; font-weight:600; color:#0f172a; font-size:13px; }
  .cc-ls-name i { width:10px; height:10px; border-radius:50%; display:inline-block; }

  .cc-ls-team { display:inline-flex; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:600; }
  .cc-ls-team.team-sales { background:#eef7f2; color:#065f46; }
  .cc-ls-team.team-ops { background:#fff7ed; color:#c2410c; }
  .cc-ls-team.team-both { background:#eef2ff; color:#3730a3; }

  .cc-ls-flags { display:inline-flex; gap:6px; flex-wrap:wrap; }
  .cc-ls-flag { display:inline-flex; padding:2px 8px; border-radius:6px; font-size:11px; font-weight:600; }
  .cc-ls-flag.initial { background:#fef3c7; color:#b45309; }
  .cc-ls-flag.file { background:#eef2ff; color:#4338ca; }
  .cc-ls-flag.system { background:#f1f5f9; color:#475569; }
  .cc-ls-flag.empty { background:transparent; color:#cbd5e1; padding:2px 0; }

  .cc-ls-order { font-family:ui-monospace,monospace; color:#475569; font-size:12.5px; font-variant-numeric:tabular-nums; }

  .cc-ls-toggle { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid transparent; }
  .cc-ls-toggle.on { background:#eef7f2; color:#047857; border-color:#c7e0d4; }
  .cc-ls-toggle.off { background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0; }
  .cc-ls-toggle i { width:8px; height:8px; border-radius:50%; }
  .cc-ls-toggle.on i { background:#10b981; }
  .cc-ls-toggle.off i { background:#cbd5e1; }
  .cc-ls-toggle:hover { filter:brightness(0.98); }

  .cc-ls-actions { display:inline-flex; gap:6px; }
  .cc-ls-icon-btn { width:32px; height:32px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; display:grid; place-items:center; color:#475569; cursor:pointer; }
  .cc-ls-icon-btn:hover:not(:disabled) { color:#047857; border-color:#047857; }
  .cc-ls-icon-btn.danger:hover:not(:disabled) { color:#dc2626; border-color:#dc2626; }
  .cc-ls-icon-btn:disabled { opacity:0.35; cursor:not-allowed; }

  .cc-ls-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:70; display:grid; place-items:center; padding:16px; }
  .cc-ls-modal { background:#fff; border-radius:16px; padding:22px; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }
  .cc-ls-modal-head { display:flex; align-items:center; justify-content:space-between; }
  .cc-ls-modal-head h3 { margin:0; font-size:17px; font-weight:700; color:#0f172a; }
  .cc-ls-modal-head button { border:0; background:#f1f5f9; color:#475569; width:30px; height:30px; border-radius:8px; cursor:pointer; display:grid; place-items:center; }
  .cc-ls-modal-head button:hover { background:#e2e8f0; color:#0f172a; }

  .cc-ls-form { display:flex; flex-direction:column; gap:12px; }
  .cc-ls-form-row { display:grid; grid-template-columns:2fr 1fr; gap:12px; }
  .cc-form-field { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569; }
  .cc-form-field input, .cc-form-field select { padding:8px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; font-family:inherit; }
  .cc-form-field input:focus, .cc-form-field select:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }

  .cc-ls-flags-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(180px,1fr)); gap:10px; }
  .cc-ls-flag-toggle { display:flex; flex-direction:column; padding:12px 14px; border:1px solid #cbd5e1; border-radius:12px; gap:2px; cursor:pointer; background:#fff; transition:border-color .12s, background-color .12s; position:relative; }
  .cc-ls-flag-toggle input { position:absolute; opacity:0; pointer-events:none; }
  .cc-ls-flag-toggle span { font-size:13px; font-weight:600; color:#0f172a; }
  .cc-ls-flag-toggle small { font-size:11.5px; color:#94a3b8; }
  .cc-ls-flag-toggle.on { border-color:#047857; background:#eef7f2; }
  .cc-ls-flag-toggle.on span { color:#065f46; }
  .cc-ls-flag-toggle:hover:not(.on) { border-color:#94a3b8; }

  .cc-ls-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:4px; }

  .cc-ls-quick-panel { padding:0; background:transparent; border:0; }
  .cc-ls-quick-form { display:flex; flex-wrap:wrap; align-items:center; gap:8px; padding:10px 14px; background:#fff; border:1px solid #e2e8f0; border-radius:14px; }
  .cc-ls-quick-tag { display:inline-flex; align-items:center; gap:6px; padding:6px 10px; border-radius:8px; background:#eef7f2; color:#065f46; font-size:12px; font-weight:700; text-transform:uppercase; letter-spacing:0.04em; margin-right:2px; }
  .cc-ls-quick-input { height:38px; padding:6px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; font-family:inherit; outline:none; flex:1 1 180px; min-width:0; }
  .cc-ls-quick-input:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); }
  select.cc-ls-quick-input { flex:0 1 150px; }
  .cc-ls-quick-order { flex:0 0 84px; text-align:center; font-variant-numeric:tabular-nums; }
  .cc-ls-quick-check { display:inline-flex; align-items:center; gap:6px; font-size:12.5px; color:#334155; padding:8px 12px; border:1px solid #cbd5e1; border-radius:10px; background:#fff; cursor:pointer; user-select:none; height:38px; }
  .cc-ls-quick-check input { width:14px; height:14px; accent-color:#047857; margin:0; }
  .cc-ls-quick-check:has(input:checked) { background:#eef7f2; border-color:#047857; color:#065f46; font-weight:600; }
  .cc-ls-quick-submit { margin-left:0; height:38px; white-space:nowrap; }

  @media (max-width: 780px) {
    .cc-ls-quick-form { padding:12px; }
    .cc-ls-quick-input, .cc-ls-quick-order, .cc-ls-quick-check { flex:1 1 100%; }
    .cc-ls-quick-submit { flex:1 1 100%; justify-content:center; }
  }
`;
