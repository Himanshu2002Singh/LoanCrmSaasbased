import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  ChevronLeft,
  ChevronRight,
  Key,
  Pencil,
  Plus,
  Search,
  Shuffle,
  Trash2,
  Upload,
} from "lucide-react";
import API_URL from "../../../config";
import AddEmployeeModal from "../AddEmployeeModal";
import EmployeeImportModal from "../EmployeeImportModal";
import ResetPasswordModal from "../ResetPasswordModal";
import CcPagination from "../../../components/CcPagination";

const PAGE_SIZE = 50;
const numberFormatter = new Intl.NumberFormat("en-IN");

const ROLE_LABELS = {
  EMPLOYEE: "Sales Manager",
  MANAGER: "Manager",
  OPS: "Operations",
  COMPANY_ADMIN: "Company Admin",
  BANKER: "Banker",
};
const ROLE_CLASS = {
  EMPLOYEE: "role-sales",
  MANAGER: "role-manager",
  OPS: "role-ops",
  COMPANY_ADMIN: "role-manager",
  BANKER: "role-ops",
};

// Fields the update endpoint accepts.
const EDITABLE_FIELDS = ["name", "email", "phone", "role", "status", "branchId", "managerId", "salary"];

// The reassign endpoint moves a named list of leads, so moving everything one
// employee owns means reading their leads first. 200 is the server's page cap.
const REASSIGN_PAGE = 200;

export default function UserListRedesign() {
  const navigate = useNavigate();
  const [rows, setRows] = useState([]);
  const [allEmployees, setAllEmployees] = useState([]);
  const [branches, setBranches] = useState([]);
  const [managers, setManagers] = useState([]);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [currentPage, setCurrentPage] = useState(1);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [loading, setLoading] = useState(true);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showExcelModal, setShowExcelModal] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [deleteUser, setDeleteUser] = useState(null);
  const [transferUser, setTransferUser] = useState(null);
  const [transferTarget, setTransferTarget] = useState("");
  const [resetPasswordUser, setResetPasswordUser] = useState(null);
  const [seatInfo, setSeatInfo] = useState(null);

  const fetchSeats = async () => {
    try {
      const res = await axios.get(`${API_URL}/users/seats`);
      setSeatInfo(res.data?.data || null);
    } catch (error) {
      console.error("Error fetching seat usage", error);
    }
  };

  const fetchAll = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, { params: { limit: REASSIGN_PAGE } });
      setAllEmployees(res.data?.data || []);
    } catch (error) {
      console.error("Error fetching all employees", error);
    }
  };

  const fetchAux = async () => {
    try {
      const [bRes, mRes] = await Promise.all([
        axios.get(`${API_URL}/branches`, { params: { limit: 100 } }),
        axios.get(`${API_URL}/users`, { params: { limit: 100, role: "MANAGER" } }),
      ]);
      setBranches(bRes.data?.data || bRes.data?.rows || []);
      setManagers(mRes.data?.data || []);
    } catch (error) {
      console.error("Error fetching aux data", error);
    }
  };

  const fetchPage = async (pageOverride, search) => {
    setLoading(true);
    const page = pageOverride ?? currentPage;
    try {
      const res = await axios.get(`${API_URL}/users`, {
        params: { page, limit: PAGE_SIZE, search: search ?? debouncedSearchTerm },
      });
      const pagination = res.data?.pagination || {};
      setRows(res.data?.data || []);
      setTotalPages(pagination.totalPages || 1);
      setTotalItems(pagination.total ?? (res.data?.data || []).length);
    } catch (error) {
      console.error("Error fetching employees", error);
      toast.error("Could not load employees");
      setRows([]);
      setTotalPages(1);
      setTotalItems(0);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAll();
    fetchAux();
    fetchSeats();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  useEffect(() => {
    fetchPage(currentPage, debouncedSearchTerm);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [currentPage, debouncedSearchTerm]);

  const handleDelete = async () => {
    if (!deleteUser) return;
    const empId = deleteUser.id;
    try {
      await toast.promise(axios.delete(`${API_URL}/users/${empId}`), {
        pending: "Deactivating employee...",
        success: `${deleteUser.name || empId} deactivated`,
        error: "Failed to deactivate employee",
      });
      setRows((prev) => prev.filter((r) => r.id !== empId));
      setDeleteUser(null);
      fetchSeats();
    } catch (error) {
      console.error(error);
    }
  };

  const handleUpdate = async () => {
    if (!editUser) return;
    const payload = Object.fromEntries(
      EDITABLE_FIELDS.filter((field) => editUser[field] !== undefined).map((field) => [
        field,
        field === "salary"
          ? editUser[field] === "" || editUser[field] === null || isNaN(Number(editUser[field]))
            ? 0
            : Number(editUser[field])
          : editUser[field],
      ])
    );
    try {
      const res = await axios.put(`${API_URL}/users/${editUser.id}`, payload);
      toast.success("Employee updated");
      const updated = res.data?.data || editUser;
      setRows((prev) => prev.map((r) => (r.id === editUser.id ? { ...r, ...updated } : r)));
      setEditUser(null);
      fetchPage(currentPage, debouncedSearchTerm);
      fetchAll();
      fetchAux();
      fetchSeats();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Update failed");
    }
  };

  const handleTransfer = async () => {
    if (!transferUser || !transferTarget) {
      toast.error("Select a target employee");
      return;
    }
    try {
      let moved = 0;
      // Every round re-reads the first page: the leads just moved no longer
      // belong to the source, so what is left shifts down into it. The round
      // cap stops the loop if a move ever silently fails to take effect.
      for (let round = 0; round < 50; round += 1) {
        const res = await axios.get(`${API_URL}/leads`, {
          params: { assignedEmployeeId: transferUser.id, page: 1, limit: REASSIGN_PAGE },
        });
        const leadIds = (res.data?.data || []).map((lead) => lead.lead_id);
        if (!leadIds.length) break;

        await axios.post(`${API_URL}/leads/reassign`, {
          leadIds,
          toUserId: Number(transferTarget),
        });
        moved += leadIds.length;
      }
      toast.success(moved ? `${moved} lead(s) transferred` : "No leads to transfer");
      setTransferUser(null);
      setTransferTarget("");
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Transfer failed");
    }
  };

  const transferOptions = useMemo(
    () => allEmployees.filter((e) => e.id !== transferUser?.id),
    [allEmployees, transferUser]
  );

  return (
    <div className="cc-report-redesign cc-users-redesign">
      <ToastContainer position="bottom-right" />

      <style>{styles}</style>

      <section className="cc-report-panel">
        <div className="cc-users-toolbar">
          <label className="cc-report-search" style={{ flex: "1 1 260px" }}>
            <Search size={18} />
            <input
              type="search"
              placeholder="Search by name, email, employee ID or phone..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <div className="cc-users-actions">
            <button type="button" className="cc-users-btn ghost" onClick={() => setShowExcelModal(true)}>
              <Upload size={16} /> Excel upload
            </button>
            <button type="button" className="cc-users-btn primary" onClick={() => setShowAddModal(true)}>
              <Plus size={16} /> Add employee
            </button>
          </div>
        </div>
      </section>

      <section className="cc-report-panel">
        <div className="cc-report-table-head" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
          <h2>
            Employees <span className="cc-users-count">({numberFormatter.format(totalItems)})</span>
          </h2>
          {seatInfo && (
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <span
                style={{
                  fontSize: 12.5,
                  fontWeight: 600,
                  padding: "5px 12px",
                  borderRadius: 8,
                  background: seatInfo.full ? "#fee2e2" : "#f1f5f9",
                  color: seatInfo.full ? "#dc2626" : "#334155",
                  border: `1px solid ${seatInfo.full ? "#fecaca" : "#e2e8f0"}`,
                  display: "inline-flex",
                  alignItems: "center",
                  gap: 6,
                }}
              >
                <span>Allowed Employees:</span>
                <strong>
                  {seatInfo.used} / {seatInfo.limit ?? "∞"} seats used
                </strong>
                {seatInfo.remaining !== null && (
                  <span style={{ color: seatInfo.remaining === 0 ? "#dc2626" : "#047857", fontWeight: 700 }}>
                    ({seatInfo.remaining} remaining)
                  </span>
                )}
              </span>
            </div>
          )}
        </div>

        <div className="cc-report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee ID</th>
                <th>Name</th>
                <th>Branch</th>
                <th>Reporting Manager</th>
                <th>Contact</th>
                <th>Salary (₹)</th>
                <th>Role</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="cc-report-empty">Loading employees...</td>
                </tr>
              ) : rows.length === 0 ? (
                <tr>
                  <td colSpan={9} className="cc-report-empty">No employees match the filters</td>
                </tr>
              ) : (
                rows.map((user) => {
                  const roleKey = user.role || "EMPLOYEE";
                  const roleLabel = ROLE_LABELS[roleKey] || roleKey;
                  const roleClass = ROLE_CLASS[roleKey] || "role-sales";
                  const statusKey = (user.status || "active").toLowerCase();
                  const goDetail = () => navigate(`/userdetail/${user.id}`);
                  const stop = (event) => event.stopPropagation();
                  return (
                    <tr
                      key={user.id}
                      className="cc-users-row"
                      onClick={goDetail}
                    >
                      <td style={{ fontWeight: 600 }}>{user.id}</td>
                      <td>
                        <span className="cc-user-cell">
                          <span className="cc-user-avatar">
                            {(user.name || String(user.id) || "?").slice(0, 2).toUpperCase()}
                          </span>
                          <span>
                            <strong>{user.name || "--"}</strong>
                          </span>
                        </span>
                      </td>
                      <td>
                        {user.branch?.name ? (
                          <span className="cc-branch-pill">
                            🏢 {user.branch.name}
                          </span>
                        ) : (
                          <span style={{ color: "#94a3b8", fontSize: "12px" }}>--</span>
                        )}
                      </td>
                      <td>
                        {user.role === "MANAGER" || user.role === "COMPANY_ADMIN" ? (
                          <span className="cc-mgr-badge lead">👑 Team Lead / Manager</span>
                        ) : user.manager?.name ? (
                          <span className="cc-mgr-badge">👤 {user.manager.name}</span>
                        ) : (
                          <span className="cc-mgr-badge direct">Direct (Admin)</span>
                        )}
                      </td>
                      <td>
                        <div className="cc-user-contact">
                          <span>{user.email || "--"}</span>
                          <small>{user.phone || "no phone"}</small>
                        </div>
                      </td>
                      <td onClick={stop}>
                        <div
                          style={{
                            display: "inline-flex",
                            alignItems: "center",
                            gap: 6,
                            padding: "3px 8px",
                            borderRadius: 6,
                            background: "#f8fafc",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <strong style={{ color: "#0f172a", fontSize: 13 }}>
                            {user.salary !== null && user.salary !== undefined && user.salary !== ""
                              ? `₹${Number(user.salary).toLocaleString("en-IN")}`
                              : "₹0"}
                          </strong>
                          <button
                            type="button"
                            className="cc-icon-btn"
                            style={{
                              padding: 2,
                              height: 20,
                              width: 20,
                              border: "none",
                              background: "transparent",
                              color: "#64748b",
                              cursor: "pointer",
                            }}
                            title="Edit Employee & Salary"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditUser({ ...user });
                            }}
                          >
                            <Pencil size={11} />
                          </button>
                        </div>
                      </td>
                      <td>
                        <span className={`cc-role-pill ${roleClass}`}>{roleLabel}</span>
                      </td>
                      <td>
                        <span className={`cc-status-dot cc-status-${statusKey}`}>
                          <i />
                          {statusKey === "active" ? "Active" : "Inactive"}
                        </span>
                      </td>
                      <td onClick={stop}>
                        <div className="cc-user-actions">
                          <button
                            type="button"
                            className="cc-icon-btn"
                            title="Reset Password"
                            onClick={(event) => {
                              event.stopPropagation();
                              setResetPasswordUser(user);
                            }}
                          >
                            <Key size={15} />
                          </button>
                          <button
                            type="button"
                            className="cc-icon-btn"
                            title="Edit"
                            onClick={(event) => {
                              event.stopPropagation();
                              setEditUser({ ...user });
                            }}
                          >
                            <Pencil size={15} />
                          </button>
                          <button
                            type="button"
                            className="cc-icon-btn"
                            title="Transfer all leads"
                            onClick={(event) => {
                              event.stopPropagation();
                              setTransferUser(user);
                            }}
                          >
                            <Shuffle size={15} />
                          </button>
                          <button
                            type="button"
                            className="cc-icon-btn danger"
                            title="Delete"
                            onClick={(event) => {
                              event.stopPropagation();
                              setDeleteUser(user);
                            }}
                          >
                            <Trash2 size={15} />
                          </button>
                        </div>
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
          itemLabel="employees"
        />
      </section>

      <AddEmployeeModal
        open={showAddModal}
        onClose={() => setShowAddModal(false)}
        onCreated={(newUser) => {
          if (newUser) {
            setRows((prev) => [newUser, ...prev]);
            setTotalItems((prev) => prev + 1);
          }
          setCurrentPage(1);
          fetchPage(1, debouncedSearchTerm);
          fetchAll();
          fetchAux();
          fetchSeats();
        }}
      />

      <EmployeeImportModal
        open={showExcelModal}
        onClose={() => setShowExcelModal(false)}
        onImported={() => {
          fetchPage(currentPage, debouncedSearchTerm);
          fetchAll();
          fetchSeats();
        }}
      />

      <ResetPasswordModal
        open={Boolean(resetPasswordUser)}
        onClose={() => setResetPasswordUser(null)}
        user={resetPasswordUser}
      />

      {deleteUser ? (
        <ConfirmModal
          title={`Deactivate employee ${deleteUser.id}?`}
          description={
            <>
              This marks <strong>{deleteUser.name || deleteUser.id}</strong> inactive and frees their
              seat. They can no longer sign in.
            </>
          }
          confirmLabel="Deactivate"
          confirmVariant="danger"
          onCancel={() => setDeleteUser(null)}
          onConfirm={handleDelete}
        />
      ) : null}

      {transferUser ? (
        <ConfirmModal
          title="Transfer leads"
          description={
            <>
              Reassign every lead currently owned by{" "}
              <strong>{transferUser.name || transferUser.id}</strong> to another employee.
            </>
          }
          confirmLabel="Transfer"
          onCancel={() => {
            setTransferUser(null);
            setTransferTarget("");
          }}
          onConfirm={handleTransfer}
          confirmDisabled={!transferTarget}
        >
          <label className="cc-form-field">
            <span>Target employee</span>
            <select value={transferTarget} onChange={(event) => setTransferTarget(event.target.value)}>
              <option value="" disabled>
                Select employee
              </option>
              {transferOptions.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.id} — {emp.name}
                </option>
              ))}
            </select>
          </label>
        </ConfirmModal>
      ) : null}

      {editUser ? (
        <ModalOverlay onClose={() => setEditUser(null)}>
          <div className="cc-users-modal">
            <h3>Update employee</h3>
            <form
              onSubmit={(event) => {
                event.preventDefault();
                handleUpdate();
              }}
            >
              <div className="cc-form-grid">
                <label className="cc-form-field">
                  <span>Name</span>
                  <input
                    type="text"
                    value={editUser.name || ""}
                    onChange={(event) => setEditUser({ ...editUser, name: event.target.value })}
                  />
                </label>
                <label className="cc-form-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={editUser.email || ""}
                    onChange={(event) => setEditUser({ ...editUser, email: event.target.value })}
                  />
                </label>
                <label className="cc-form-field">
                  <span>Phone</span>
                  <input
                    type="text"
                    value={editUser.phone || ""}
                    onChange={(event) => setEditUser({ ...editUser, phone: event.target.value })}
                  />
                </label>
                <label className="cc-form-field">
                  <span>Role</span>
                  <select
                    value={editUser.role || "EMPLOYEE"}
                    onChange={(event) => setEditUser({ ...editUser, role: event.target.value })}
                  >
                    <option value="EMPLOYEE">Sales Manager</option>
                    <option value="MANAGER">Manager</option>
                    <option value="OPS">Operations</option>
                    <option value="BANKER">Banker</option>
                  </select>
                </label>
                <label className="cc-form-field">
                  <span>Monthly Salary (₹)</span>
                  <input
                    type="number"
                    min="0"
                    step="any"
                    value={editUser.salary !== undefined && editUser.salary !== null ? editUser.salary : ""}
                    onChange={(event) =>
                      setEditUser({
                        ...editUser,
                        salary: event.target.value,
                      })
                    }
                    placeholder="e.g. 25000"
                  />
                </label>
                <label className="cc-form-field">
                  <span>Assigned Branch</span>
                  <select
                    value={editUser.branchId || ""}
                    onChange={(event) =>
                      setEditUser({
                        ...editUser,
                        branchId: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  >
                    <option value="">Select a branch (optional)</option>
                    {branches.map((b) => (
                      <option key={b.id} value={b.id}>
                        {b.name} {b.city ? `(${b.city})` : ""}
                      </option>
                    ))}
                  </select>
                </label>
                <label className="cc-form-field">
                  <span>Reporting Manager</span>
                  <select
                    value={editUser.managerId || ""}
                    onChange={(event) =>
                      setEditUser({
                        ...editUser,
                        managerId: event.target.value ? Number(event.target.value) : null,
                      })
                    }
                  >
                    <option value="">No direct manager / Admin</option>
                    {managers
                      .filter((m) => m.id !== editUser.id)
                      .map((m) => (
                        <option key={m.id} value={m.id}>
                          {m.name} {m.branch?.name ? `(${m.branch.name})` : ""}
                        </option>
                      ))}
                  </select>
                </label>
                <label className="cc-form-field">
                  <span>Status</span>
                  <select
                    value={editUser.status || "active"}
                    onChange={(event) => setEditUser({ ...editUser, status: event.target.value })}
                  >
                    <option value="active">Active</option>
                    <option value="inactive">Inactive</option>
                  </select>
                </label>
              </div>
              <div className="cc-modal-actions">
                <button type="button" className="cc-users-btn ghost" onClick={() => setEditUser(null)}>
                  Cancel
                </button>
                <button type="submit" className="cc-users-btn primary">
                  Save changes
                </button>
              </div>
            </form>
          </div>
        </ModalOverlay>
      ) : null}
    </div>
  );
}

function ModalOverlay({ children, onClose }) {
  return (
    <div className="cc-users-overlay" onClick={onClose}>
      <div className="cc-users-overlay-inner" onClick={(event) => event.stopPropagation()}>
        {children}
      </div>
    </div>
  );
}

function ConfirmModal({
  title,
  description,
  confirmLabel,
  confirmVariant,
  confirmDisabled,
  onCancel,
  onConfirm,
  children,
}) {
  return (
    <ModalOverlay onClose={onCancel}>
      <div className="cc-users-modal">
        <h3>{title}</h3>
        <p>{description}</p>
        {children}
        <div className="cc-modal-actions">
          <button type="button" className="cc-users-btn ghost" onClick={onCancel}>
            Cancel
          </button>
          <button
            type="button"
            className={`cc-users-btn primary${confirmVariant === "danger" ? " danger" : ""}`}
            onClick={onConfirm}
            disabled={confirmDisabled}
          >
            {confirmLabel}
          </button>
        </div>
      </div>
    </ModalOverlay>
  );
}

const styles = `
  .cc-users-toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
  .cc-users-toolbar .cc-report-search input { appearance:none; -webkit-appearance:none; height:38px; padding:8px 12px 8px 40px; border:1px solid #d5ded7; border-radius:10px; background:#fff; font-size:13px; color:#0f172a; outline:none; }
  .cc-users-toolbar .cc-report-search input:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); }
  .cc-users-toolbar .cc-users-actions { display:flex; gap:8px; margin-left:auto; }

  .cc-users-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; }
  .cc-users-btn.primary { background:#047857; color:#fff; }
  .cc-users-btn.primary.danger { background:#dc2626; }
  .cc-users-btn.ghost { background:#fff; color:#0f172a; border-color:#d5ded7; }
  .cc-users-btn:disabled { opacity:0.5; cursor:not-allowed; }
  .cc-users-btn:hover:not(:disabled) { filter:brightness(0.96); }

  .cc-users-count { font-size:13px; color:#475569; margin-left:2px; }

  .cc-users-row { cursor:pointer; transition:background-color .12s; }
  .cc-users-row:hover { background:#f8fafc; }
  .cc-user-cell { display:inline-flex; align-items:center; gap:10px; }
  .cc-user-cell strong { display:block; font-size:13.5px; color:#0f172a; }
  .cc-user-cell small { display:block; font-size:11px; color:#94a3b8; }
  .cc-user-avatar { width:32px; height:32px; border-radius:50%; background:#eef7f2; color:#047857; display:grid; place-items:center; font-size:11px; font-weight:700; }

  .cc-user-contact span { display:block; font-size:13px; color:#334155; }
  .cc-user-contact small { display:block; font-size:11.5px; color:#94a3b8; font-family:ui-monospace,monospace; }

  .cc-role-pill { display:inline-flex; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:600; }
  .cc-role-pill.role-sales { background:#eef7f2; color:#047857; }
  .cc-role-pill.role-manager { background:#eef2ff; color:#4338ca; }
  .cc-role-pill.role-ops { background:#fff7ed; color:#c2410c; }

  .cc-branch-pill { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:500; color:#334155; background:#f1f5f9; padding:3px 8px; border-radius:6px; }
  .cc-mgr-badge { display:inline-flex; align-items:center; gap:4px; font-size:12px; font-weight:600; color:#4338ca; background:#eef2ff; padding:3px 8px; border-radius:6px; }
  .cc-mgr-badge.lead { color:#b45309; background:#fef3c7; }
  .cc-mgr-badge.direct { color:#64748b; background:#f1f5f9; font-weight:500; }

  .cc-status-dot { display:inline-flex; align-items:center; gap:6px; font-size:12px; font-weight:500; color:#475569; }
  .cc-status-dot i { width:8px; height:8px; border-radius:50%; background:#94a3b8; }
  .cc-status-dot.cc-status-active i { background:#10b981; }
  .cc-status-dot.cc-status-active { color:#047857; }
  .cc-status-dot.cc-status-inactive i { background:#f43f5e; }
  .cc-status-dot.cc-status-inactive { color:#be123c; }

  .cc-password-cell { display:inline-flex; align-items:center; gap:8px; }
  .cc-password-cell code { font-family:ui-monospace,monospace; font-size:12.5px; color:#0f172a; background:#f1f5f9; padding:3px 8px; border-radius:6px; }

  .cc-user-actions { display:inline-flex; gap:6px; }
  .cc-icon-btn { width:32px; height:32px; border-radius:8px; border:1px solid #d5ded7; background:#fff; display:grid; place-items:center; color:#475569; cursor:pointer; }
  .cc-icon-btn:hover { color:#047857; border-color:#047857; }
  .cc-icon-btn.danger:hover { color:#dc2626; border-color:#dc2626; }

  .cc-users-pagination { padding:14px 4px 4px; border-top:1px solid #eef1ee; margin-top:10px; gap:12px; flex-wrap:wrap; }
  .cc-users-pagination > span { font-size:13px; color:#475569; }
  .cc-users-pagination > span b { color:#0f172a; font-weight:600; }
  .cc-users-pagination div { gap:6px; }
  .cc-users-pagination button { border-radius:10px !important; padding:8px 14px !important; font-size:13px !important; font-weight:600 !important; }
  .cc-users-jump { display:inline-flex; align-items:center; gap:6px; margin:0 4px; }
  .cc-users-jump input { width:56px; padding:6px 8px; border:1px solid #d5ded7; border-radius:8px; font-size:13px; text-align:center; }

  .cc-users-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:70; display:grid; place-items:center; padding:16px; }
  .cc-users-overlay-inner { max-width:640px; width:100%; max-height:92vh; overflow-y:auto; }
  .cc-users-modal { background:#fff; border-radius:16px; padding:22px; display:flex; flex-direction:column; gap:14px; }
  .cc-users-modal h3 { margin:0; font-size:17px; font-weight:700; color:#0f172a; }
  .cc-users-modal p { margin:0; font-size:13.5px; color:#475569; }
  .cc-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:6px; }

  .cc-form-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  .cc-form-field { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569; }
  .cc-form-field input, .cc-form-field select { padding:8px 12px; border:1px solid #d5ded7; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; }
  .cc-form-field input:focus, .cc-form-field select:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }
`;
