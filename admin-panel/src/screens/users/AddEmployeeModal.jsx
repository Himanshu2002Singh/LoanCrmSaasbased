import React, { useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { X } from "lucide-react";
import API_URL from "../../config";

const emptyForm = () => ({
  name: "",
  email: "",
  phone: "",
  password: "",
  role: "EMPLOYEE",
  salary: "",
  branchId: "",
  managerId: "",
  status: "active",
});

export default function AddEmployeeModal({ open, onClose, onCreated }) {
  const [form, setForm] = useState(emptyForm);
  const [branches, setBranches] = useState([]);
  const [managers, setManagers] = useState([]);
  const [seatInfo, setSeatInfo] = useState(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) {
      axios
        .get(`${API_URL}/branches`, { params: { limit: 100 } })
        .then((res) => setBranches(res.data?.data || res.data?.rows || []))
        .catch((err) => console.error("Error fetching branches for modal:", err));

      axios
        .get(`${API_URL}/users`, { params: { limit: 100, role: "MANAGER" } })
        .then((res) => setManagers(res.data?.data || []))
        .catch((err) => console.error("Error fetching managers for modal:", err));

      axios
        .get(`${API_URL}/users/seats`)
        .then((res) => setSeatInfo(res.data?.data || null))
        .catch((err) => console.error("Error fetching seat info for modal:", err));
    }
  }, [open]);

  if (!open) return null;

  const update = (name, value) => setForm((prev) => ({ ...prev, [name]: value }));

  const closeAll = () => {
    setForm(emptyForm());
    onClose?.();
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    const required = ["name", "email", "phone", "password"];
    for (const key of required) {
      if (!String(form[key] || "").trim()) {
        toast.error("All fields are required");
        return;
      }
    }
    if (form.password.length < 8) {
      toast.error("Password must be at least 8 characters");
      return;
    }

    const payload = {
      name: String(form.name).trim(),
      email: String(form.email).trim(),
      phone: String(form.phone).trim(),
      password: form.password,
      role: form.role || "EMPLOYEE",
      salary: form.salary !== "" && form.salary !== null && !isNaN(Number(form.salary)) ? Number(form.salary) : 0,
      branchId: form.branchId ? Number(form.branchId) : null,
      managerId: form.managerId ? Number(form.managerId) : null,
      status: form.status || "active",
    };

    setSubmitting(true);
    try {
      const res = await axios.post(`${API_URL}/users`, payload);
      toast.success("Employee added successfully");
      onCreated?.(res.data?.data);
      closeAll();
    } catch (error) {
      toast.error(error.response?.data?.message || "Unable to add employee");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="cc-modal-overlay" onClick={closeAll}>
      <style>{styles}</style>
      <div className="cc-modal-card cc-modal-card-wide" onClick={(event) => event.stopPropagation()}>
        <div className="cc-modal-head">
          <div>
            <p>New</p>
            <h3>Add employee</h3>
          </div>
          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {seatInfo?.limit !== null && seatInfo?.limit !== undefined && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  padding: "4px 10px",
                  borderRadius: 999,
                  background: seatInfo.full ? "#fee2e2" : "#eef7f2",
                  color: seatInfo.full ? "#dc2626" : "#047857",
                }}
              >
                Seats: {seatInfo.used} / {seatInfo.limit}
              </span>
            )}
            <button type="button" onClick={closeAll} title="Close">
              <X size={16} />
            </button>
          </div>
        </div>

        {seatInfo?.full && (
          <div
            style={{
              padding: "10px 14px",
              borderRadius: 10,
              background: "#fef2f2",
              border: "1px solid #fecaca",
              color: "#991b1b",
              fontSize: 12.5,
              lineHeight: 1.4,
            }}
          >
            <strong>Seat limit reached:</strong> All {seatInfo.limit} seats on your company plan are currently in use. Please increase your allowed employee limit or deactivate unused accounts before adding new members.
          </div>
        )}

        <form className="cc-modal-form" onSubmit={handleSubmit}>
          <div className="cc-modal-grid">
            <label className="cc-modal-field">
              <span>Full name</span>
              <input
                type="text"
                value={form.name}
                onChange={(event) => update("name", event.target.value)}
                placeholder="e.g. Rahul Kapoor"
                required
              />
            </label>
            <label className="cc-modal-field">
              <span>Email</span>
              <input
                type="email"
                value={form.email}
                onChange={(event) => update("email", event.target.value)}
                placeholder="name@example.com"
                required
              />
            </label>
            <label className="cc-modal-field">
              <span>Phone</span>
              <input
                type="tel"
                value={form.phone}
                onChange={(event) => update("phone", event.target.value)}
                placeholder="10-digit phone number"
                required
              />
            </label>
            <label className="cc-modal-field">
              <span>Password</span>
              <input
                type="text"
                value={form.password}
                onChange={(event) => update("password", event.target.value)}
                placeholder="At least 8 characters"
                minLength={8}
                required
              />
            </label>
            <label className="cc-modal-field">
              <span>Role</span>
              <select value={form.role} onChange={(event) => update("role", event.target.value)}>
                <option value="EMPLOYEE">Sales Manager</option>
                <option value="MANAGER">Manager</option>
                <option value="OPS">Operations</option>
                <option value="BANKER">Banker</option>
              </select>
            </label>
            <label className="cc-modal-field">
              <span>Monthly Salary (₹)</span>
              <input
                type="number"
                min="0"
                step="any"
                value={form.salary}
                onChange={(event) => update("salary", event.target.value)}
                placeholder="e.g. 25000"
              />
            </label>
            <label className="cc-modal-field">
              <span>Assigned Branch</span>
              <select
                value={form.branchId || ""}
                onChange={(event) => update("branchId", event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">Select a branch (optional)</option>
                {branches.map((b) => (
                  <option key={b.id} value={b.id}>
                    {b.name} {b.city ? `(${b.city})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="cc-modal-field">
              <span>Reporting Manager</span>
              <select
                value={form.managerId || ""}
                onChange={(event) => update("managerId", event.target.value ? Number(event.target.value) : null)}
              >
                <option value="">No direct manager / Admin</option>
                {managers.map((m) => (
                  <option key={m.id} value={m.id}>
                    {m.name} {m.branch?.name ? `(${m.branch.name})` : ""}
                  </option>
                ))}
              </select>
            </label>
            <label className="cc-modal-field">
              <span>Status</span>
              <select value={form.status} onChange={(event) => update("status", event.target.value)}>
                <option value="active">Active</option>
                <option value="inactive">Inactive</option>
              </select>
            </label>
          </div>

          <div className="cc-modal-actions">
            <button type="button" className="cc-modal-btn ghost" onClick={closeAll}>
              Cancel
            </button>
            <button type="submit" className="cc-modal-btn primary" disabled={submitting}>
              {submitting ? "Saving..." : "Add employee"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = `
  .cc-modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:120; display:grid; place-items:center; padding:16px; }
  .cc-modal-card { width:100%; max-width:460px; background:#fff; border-radius:18px; padding:22px; display:flex; flex-direction:column; gap:14px; box-shadow:0 20px 60px rgba(15,23,42,0.28); max-height:92vh; overflow-y:auto; }
  .cc-modal-card-wide { max-width:640px; }
  .cc-modal-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .cc-modal-head p { margin:0; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#047857; font-weight:700; }
  .cc-modal-head h3 { margin:2px 0 0; font-size:19px; color:#0f172a; font-weight:700; }
  .cc-modal-head button { border:0; background:#f1f5f9; color:#475569; width:32px; height:32px; border-radius:9px; cursor:pointer; display:grid; place-items:center; }
  .cc-modal-head button:hover { background:#e2e8f0; color:#0f172a; }

  .cc-modal-form { display:flex; flex-direction:column; gap:14px; }
  .cc-modal-grid { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  .cc-modal-field { display:flex; flex-direction:column; gap:5px; font-size:12px; color:#475569; font-weight:600; }
  .cc-modal-field input, .cc-modal-field select { padding:10px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px; color:#0f172a; background:#fff; font-family:inherit; font-weight:500; }
  .cc-modal-field input:focus, .cc-modal-field select:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }

  .cc-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:4px; }
  .cc-modal-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; }
  .cc-modal-btn.primary { background:#047857; color:#fff; }
  .cc-modal-btn.primary:hover:not(:disabled) { filter:brightness(0.96); }
  .cc-modal-btn.ghost { background:#fff; color:#0f172a; border:1px solid #cbd5e1; }
  .cc-modal-btn:disabled { opacity:0.5; cursor:not-allowed; }
`;
