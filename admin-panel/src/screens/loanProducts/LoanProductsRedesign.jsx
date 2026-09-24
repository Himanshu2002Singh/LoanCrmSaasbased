import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  CheckCircle2,
  Coins,
  Layers,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  X,
} from "lucide-react";
import API_URL from "../../config";

const COLOR_PRESETS = [
  "#3b82f6", // Blue
  "#10b981", // Emerald
  "#f59e0b", // Amber
  "#8b5cf6", // Purple
  "#ec4899", // Pink
  "#06b6d4", // Cyan
  "#f97316", // Orange
  "#64748b", // Slate
];

const emptyForm = () => ({
  label: "",
  value: "",
  colorCode: "#3b82f6",
  orderIndex: 10,
  isActive: true,
});

export default function LoanProductsRedesign() {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [statusFilter, setStatusFilter] = useState("all"); // 'all' | 'active' | 'inactive'
  const [modalOpen, setModalOpen] = useState(false);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleting, setDeleting] = useState(false);

  const fetchProducts = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/master-configs/LOAN_PRODUCT`, {
        params: { includeInactive: true },
      });
      setProducts(res.data?.data || []);
    } catch (error) {
      console.error("Error fetching loan products", error);
      toast.error(error.response?.data?.message || "Could not load loan products");
      setProducts([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedSearchTerm(searchTerm), 300);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const openCreate = () => {
    setEditing(null);
    const nextOrder = products.length > 0 
      ? Math.max(...products.map(p => p.orderIndex || 0)) + 10 
      : 10;
    setForm({
      ...emptyForm(),
      orderIndex: nextOrder,
    });
    setModalOpen(true);
  };

  const openEdit = (product) => {
    setEditing(product);
    setForm({
      label: product.label || "",
      value: product.value || "",
      colorCode: product.colorCode || "#3b82f6",
      orderIndex: product.orderIndex ?? 10,
      isActive: product.isActive !== false,
    });
    setModalOpen(true);
  };

  const handleSubmit = async (e) => {
    if (e) e.preventDefault();
    if (!form.label.trim()) {
      toast.error("Loan product name / label is required");
      return;
    }

    setSubmitting(true);
    try {
      if (editing) {
        await axios.put(`${API_URL}/master-configs/${editing.id}`, {
          label: form.label.trim(),
          colorCode: form.colorCode,
          orderIndex: Number(form.orderIndex) || 0,
          isActive: form.isActive,
        });
        toast.success("Loan product updated successfully");
      } else {
        await axios.post(`${API_URL}/master-configs/LOAN_PRODUCT`, {
          label: form.label.trim(),
          value: form.value.trim() ? form.value.trim() : undefined,
          colorCode: form.colorCode,
          orderIndex: Number(form.orderIndex) || 0,
          isActive: form.isActive,
        });
        toast.success("Loan product created successfully");
      }
      setModalOpen(false);
      setForm(emptyForm());
      setEditing(null);
      fetchProducts();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not save loan product");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleActive = async (product) => {
    try {
      await axios.put(`${API_URL}/master-configs/${product.id}`, {
        isActive: !product.isActive,
      });
      setProducts((prev) =>
        prev.map((row) =>
          row.id === product.id ? { ...row, isActive: !row.isActive } : row
        )
      );
      toast.success(
        `Loan product ${!product.isActive ? "activated" : "deactivated"}`
      );
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not update status");
    }
  };

  const handleDelete = async (hard = true) => {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      await axios.delete(`${API_URL}/master-configs/${deleteTarget.id}${hard ? "?hard=true" : ""}`);
      toast.success(hard ? "Loan product deleted" : "Loan product deactivated");
      setDeleteTarget(null);
      fetchProducts();
    } catch (error) {
      console.error(error);
      const errMsg = error.response?.data?.message;
      if (errMsg && errMsg.includes("In use")) {
        toast.warning(errMsg);
      } else {
        toast.error(errMsg || "Could not delete loan product");
      }
    } finally {
      setDeleting(false);
    }
  };

  const filtered = useMemo(() => {
    return products.filter((p) => {
      if (statusFilter === "active" && !p.isActive) return false;
      if (statusFilter === "inactive" && p.isActive) return false;
      if (!debouncedSearchTerm.trim()) return true;
      const query = debouncedSearchTerm.toLowerCase();
      return (
        String(p.label || "").toLowerCase().includes(query) ||
        String(p.value || "").toLowerCase().includes(query)
      );
    });
  }, [products, debouncedSearchTerm, statusFilter]);

  const stats = useMemo(() => {
    const total = products.length;
    const active = products.filter((p) => p.isActive).length;
    const inactive = total - active;
    return { total, active, inactive };
  }, [products]);

  return (
    <div className="cc-report-redesign cc-lp">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      {/* Top Header / Stats Row */}
      <div className="cc-lp-stats-grid">
        <div className="cc-lp-stat-card">
          <div className="cc-lp-stat-icon total">
            <Coins size={22} />
          </div>
          <div className="cc-lp-stat-content">
            <span className="cc-lp-stat-label">Total Loan Types</span>
            <span className="cc-lp-stat-value">{stats.total}</span>
          </div>
        </div>
        <div className="cc-lp-stat-card">
          <div className="cc-lp-stat-icon active">
            <CheckCircle2 size={22} />
          </div>
          <div className="cc-lp-stat-content">
            <span className="cc-lp-stat-label">Active Types</span>
            <span className="cc-lp-stat-value">{stats.active}</span>
          </div>
        </div>
        <div className="cc-lp-stat-card">
          <div className="cc-lp-stat-icon inactive">
            <AlertCircle size={22} />
          </div>
          <div className="cc-lp-stat-content">
            <span className="cc-lp-stat-label">Inactive Types</span>
            <span className="cc-lp-stat-value">{stats.inactive}</span>
          </div>
        </div>
      </div>

      {/* Search & Actions Bar */}
      <section className="cc-report-panel cc-lp-topbar">
        <label className="cc-lp-search-shell">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search by loan type or code (e.g. Personal Loan)..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm ? (
            <button
              type="button"
              className="cc-lp-search-clear"
              onClick={() => setSearchTerm("")}
              title="Clear search"
            >
              <X size={14} />
            </button>
          ) : null}
        </label>

        <label className="cc-lp-filter">
          Status
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="all">All Statuses</option>
            <option value="active">Active Only</option>
            <option value="inactive">Inactive Only</option>
          </select>
        </label>

        <button
          type="button"
          className="cc-lp-btn primary cc-lp-topbar-add"
          onClick={openCreate}
        >
          <Plus size={16} /> Add Loan Type
        </button>
      </section>

      {/* Main Table Panel */}
      <section className="cc-report-panel">
        <div className="cc-report-table-head">
          <h2>
            Loan Types & Products{" "}
            <span className="cc-lp-count">({filtered.length})</span>
          </h2>
          <button
            type="button"
            className="cc-lp-refresh-btn"
            onClick={fetchProducts}
            title="Refresh list"
          >
            <RefreshCw size={14} className={loading ? "spin" : ""} />
            <span>Refresh</span>
          </button>
        </div>

        <div className="cc-report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Product Name / Label</th>
                <th>Product Key / Code</th>
                <th>Color Indicator</th>
                <th>Sort Order</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="cc-report-empty">
                    <div className="cc-lp-loading">
                      <RefreshCw size={18} className="spin" />
                      <span>Loading loan products...</span>
                    </div>
                  </td>
                </tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cc-report-empty">
                    <div className="cc-lp-no-data">
                      <Coins size={32} />
                      <p>No loan products found</p>
                      <button
                        type="button"
                        className="cc-lp-btn primary"
                        onClick={openCreate}
                      >
                        <Plus size={15} /> Add First Loan Type
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                filtered.map((product) => (
                  <tr key={product.id}>
                    <td>
                      <div className="cc-lp-name-cell">
                        <span
                          className="cc-lp-color-dot"
                          style={{ background: product.colorCode || "#3b82f6" }}
                        />
                        <span className="cc-lp-product-name">{product.label}</span>
                      </div>
                    </td>
                    <td>
                      <span className="cc-lp-code-badge">{product.value}</span>
                    </td>
                    <td>
                      <div className="cc-lp-color-preview">
                        <span
                          className="cc-lp-color-swatch"
                          style={{ background: product.colorCode || "#3b82f6" }}
                        />
                        <code>{product.colorCode || "#3b82f6"}</code>
                      </div>
                    </td>
                    <td className="cc-lp-order">{product.orderIndex ?? 0}</td>
                    <td>
                      <button
                        type="button"
                        className={`cc-lp-toggle ${
                          product.isActive ? "on" : "off"
                        }`}
                        onClick={() => handleToggleActive(product)}
                        title={
                          product.isActive ? "Click to Deactivate" : "Click to Activate"
                        }
                      >
                        <i />
                        {product.isActive ? "Active" : "Inactive"}
                      </button>
                    </td>
                    <td>
                      <div className="cc-lp-actions">
                        <button
                          type="button"
                          className="cc-lp-icon-btn"
                          title="Edit Loan Type"
                          onClick={() => openEdit(product)}
                        >
                          <Pencil size={14} />
                        </button>
                        <button
                          type="button"
                          className="cc-lp-icon-btn danger"
                          title="Delete Loan Type"
                          onClick={() => setDeleteTarget(product)}
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

      {/* Create / Edit Modal */}
      {modalOpen ? (
        <div className="cc-lp-overlay" onClick={() => setModalOpen(false)}>
          <div
            className="cc-lp-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cc-lp-modal-head">
              <div className="cc-lp-modal-title">
                <div className="cc-lp-modal-icon">
                  <Coins size={18} />
                </div>
                <div>
                  <h3>{editing ? "Edit Loan Type" : "Add New Loan Type"}</h3>
                  <p>
                    {editing
                      ? "Update loan type display name, order, or color"
                      : "Create a new loan product available for leads and applications"}
                  </p>
                </div>
              </div>
              <button
                type="button"
                className="cc-lp-modal-close"
                onClick={() => setModalOpen(false)}
              >
                <X size={16} />
              </button>
            </div>

            <form className="cc-lp-form" onSubmit={handleSubmit}>
              <label className="cc-form-field">
                <span>Loan Product Name *</span>
                <input
                  type="text"
                  required
                  value={form.label}
                  onChange={(e) => setForm({ ...form, label: e.target.value })}
                  placeholder="e.g. Personal Loan, Business Loan, Gold Loan"
                  autoFocus
                />
              </label>

              {!editing ? (
                <label className="cc-form-field">
                  <span>System Code / Value (Optional)</span>
                  <input
                    type="text"
                    value={form.value}
                    onChange={(e) => setForm({ ...form, value: e.target.value })}
                    placeholder="Auto-generated if left blank (e.g. PERSONAL_LOAN)"
                  />
                  <small className="cc-form-hint">
                    Leave blank to auto-generate from the name.
                  </small>
                </label>
              ) : (
                <label className="cc-form-field">
                  <span>System Code</span>
                  <input
                    type="text"
                    value={form.value}
                    disabled
                    className="cc-input-disabled"
                  />
                  <small className="cc-form-hint">
                    System code cannot be changed once created to preserve historical data.
                  </small>
                </label>
              )}

              <div className="cc-lp-form-row">
                <label className="cc-form-field">
                  <span>Sort Order</span>
                  <input
                    type="number"
                    value={form.orderIndex}
                    onChange={(e) =>
                      setForm({
                        ...form,
                        orderIndex: Number(e.target.value) || 0,
                      })
                    }
                    placeholder="10, 20, 30..."
                  />
                </label>

                <label className="cc-form-field">
                  <span>Status</span>
                  <select
                    value={form.isActive ? "true" : "false"}
                    onChange={(e) =>
                      setForm({ ...form, isActive: e.target.value === "true" })
                    }
                  >
                    <option value="true">Active</option>
                    <option value="false">Inactive</option>
                  </select>
                </label>
              </div>

              {/* Color Code Selector */}
              <div className="cc-form-field">
                <span>Color Theme</span>
                <div className="cc-lp-color-selector">
                  <div className="cc-lp-color-presets">
                    {COLOR_PRESETS.map((color) => (
                      <button
                        key={color}
                        type="button"
                        className={`cc-lp-preset-btn ${
                          form.colorCode.toLowerCase() === color.toLowerCase()
                            ? "selected"
                            : ""
                        }`}
                        style={{ background: color }}
                        onClick={() => setForm({ ...form, colorCode: color })}
                        title={color}
                      />
                    ))}
                  </div>
                  <div className="cc-lp-custom-color">
                    <input
                      type="color"
                      value={form.colorCode || "#3b82f6"}
                      onChange={(e) =>
                        setForm({ ...form, colorCode: e.target.value })
                      }
                      title="Custom color picker"
                    />
                    <input
                      type="text"
                      value={form.colorCode || "#3b82f6"}
                      onChange={(e) =>
                        setForm({ ...form, colorCode: e.target.value })
                      }
                      placeholder="#3b82f6"
                      maxLength={7}
                    />
                  </div>
                </div>
              </div>

              <div className="cc-lp-modal-actions">
                <button
                  type="button"
                  className="cc-lp-btn ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-lp-btn primary"
                  disabled={submitting}
                >
                  {submitting
                    ? "Saving..."
                    : editing
                    ? "Save Changes"
                    : "Create Loan Type"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Delete Confirmation Modal */}
      {deleteTarget ? (
        <div className="cc-lp-overlay" onClick={() => setDeleteTarget(null)}>
          <div
            className="cc-lp-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="cc-lp-modal-head">
              <div className="cc-lp-modal-title">
                <div className="cc-lp-modal-icon danger">
                  <Trash2 size={18} />
                </div>
                <div>
                  <h3>Delete Loan Type?</h3>
                  <p>Are you sure you want to delete this product?</p>
                </div>
              </div>
              <button
                type="button"
                className="cc-lp-modal-close"
                onClick={() => setDeleteTarget(null)}
              >
                <X size={16} />
              </button>
            </div>
            <div className="cc-lp-delete-body">
              <p>
                You are about to delete <strong>{deleteTarget.label}</strong> (
                <code>{deleteTarget.value}</code>).
              </p>
              <div className="cc-lp-delete-warning">
                <AlertCircle size={16} />
                <span>
                  If existing leads or applications use this loan type, it cannot be deleted and should instead be deactivated.
                </span>
              </div>
            </div>
            <div className="cc-lp-modal-actions">
              <button
                type="button"
                className="cc-lp-btn ghost"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cc-lp-btn danger-soft"
                disabled={deleting}
                onClick={() => handleDelete(false)}
              >
                Deactivate Instead
              </button>
              <button
                type="button"
                className="cc-lp-btn primary danger"
                disabled={deleting}
                onClick={() => handleDelete(true)}
              >
                {deleting ? "Deleting..." : "Permanently Delete"}
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = `
  .cc-lp { display:flex; flex-direction:column; gap:20px; }
  
  /* Stats Cards */
  .cc-lp-stats-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(220px, 1fr)); gap:16px; }
  .cc-lp-stat-card { display:flex; align-items:center; gap:16px; padding:18px 20px; background:#fff; border-radius:16px; border:1px solid #e2e8f0; box-shadow:0 1px 3px rgba(0,0,0,0.03); transition:all 0.2s ease; }
  .cc-lp-stat-card:hover { transform:translateY(-2px); box-shadow:0 4px 12px rgba(0,0,0,0.05); }
  .cc-lp-stat-icon { width:46px; height:46px; border-radius:12px; display:grid; place-items:center; }
  .cc-lp-stat-icon.total { background:#eff6ff; color:#3b82f6; }
  .cc-lp-stat-icon.active { background:#ecfdf5; color:#10b981; }
  .cc-lp-stat-icon.inactive { background:#fef2f2; color:#ef4444; }
  .cc-lp-stat-content { display:flex; flex-direction:column; gap:2px; }
  .cc-lp-stat-label { font-size:13px; font-weight:500; color:#64748b; }
  .cc-lp-stat-value { font-size:22px; font-weight:700; color:#0f172a; line-height:1.2; }

  /* Top Bar */
  .cc-lp-topbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:14px 18px; }
  .cc-lp-search-shell { position:relative; flex:1 1 320px; min-width:220px; max-width:540px; display:flex; align-items:center; height:42px; padding:0 12px 0 40px; border:1px solid #cbd5e1; border-radius:12px; background:#fff; transition:border-color .15s, box-shadow .15s; }
  .cc-lp-search-shell:focus-within { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); }
  .cc-lp-search-shell svg { position:absolute; left:12px; color:#94a3b8; pointer-events:none; }
  .cc-lp-search-shell input { flex:1; border:0; outline:none; background:transparent; font-size:13.5px; color:#0f172a; padding:0; height:100%; }
  .cc-lp-search-shell input::placeholder { color:#94a3b8; }
  .cc-lp-search-shell input::-webkit-search-cancel-button { -webkit-appearance:none; }
  .cc-lp-search-clear { border:0; background:#f1f5f9; color:#475569; width:22px; height:22px; border-radius:6px; display:grid; place-items:center; cursor:pointer; margin-left:8px; }
  .cc-lp-search-clear:hover { background:#e2e8f0; color:#0f172a; }

  .cc-lp-filter { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:#475569; text-transform:uppercase; letter-spacing:0.04em; padding:0 4px; }
  .cc-lp-filter select { padding:8px 14px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; min-width:150px; height:42px; font-weight:500; text-transform:none; letter-spacing:0; }
  .cc-lp-filter select:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }

  .cc-lp-topbar-add { margin-left:auto; height:42px; padding:0 18px; }
  .cc-lp-btn { display:inline-flex; align-items:center; justify-content:center; gap:6px; padding:8px 16px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; transition:all 0.15s ease; }
  .cc-lp-btn.primary { background:#047857; color:#fff; }
  .cc-lp-btn.primary:hover:not(:disabled) { background:#065f46; transform:translateY(-1px); }
  .cc-lp-btn.primary.danger { background:#dc2626; color:#fff; }
  .cc-lp-btn.primary.danger:hover:not(:disabled) { background:#b91c1c; }
  .cc-lp-btn.danger-soft { background:#fee2e2; color:#b91c1c; border-color:#fca5a5; }
  .cc-lp-btn.danger-soft:hover:not(:disabled) { background:#fecaca; }
  .cc-lp-btn.ghost { background:#fff; color:#0f172a; border:1px solid #cbd5e1; }
  .cc-lp-btn.ghost:hover { background:#f8fafc; border-color:#94a3b8; }
  .cc-lp-btn:disabled { opacity:0.5; cursor:not-allowed; }

  /* Table Header */
  .cc-lp-count { font-size:13px; color:#64748b; font-weight:500; margin-left:4px; }
  .cc-lp-refresh-btn { display:inline-flex; align-items:center; gap:6px; padding:6px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:8px; font-size:12px; font-weight:600; color:#475569; cursor:pointer; transition:all 0.15s ease; }
  .cc-lp-refresh-btn:hover { background:#f1f5f9; color:#0f172a; border-color:#cbd5e1; }
  .spin { animation: spin 1s linear infinite; }
  @keyframes spin { from { transform:rotate(0deg); } to { transform:rotate(360deg); } }

  /* Table Cells */
  .cc-lp-name-cell { display:inline-flex; align-items:center; gap:10px; }
  .cc-lp-color-dot { width:12px; height:12px; border-radius:50%; display:inline-block; flex-shrink:0; box-shadow:0 0 0 2px rgba(0,0,0,0.06); }
  .cc-lp-product-name { font-weight:600; color:#0f172a; font-size:13.5px; }

  .cc-lp-code-badge { display:inline-block; padding:3px 8px; border-radius:6px; background:#f1f5f9; color:#475569; font-size:12px; font-family:ui-monospace,SFMono-Regular,Menlo,Monaco,Consolas,monospace; font-weight:600; letter-spacing:0.02em; }

  .cc-lp-color-preview { display:inline-flex; align-items:center; gap:6px; }
  .cc-lp-color-swatch { width:16px; height:16px; border-radius:4px; border:1px solid rgba(0,0,0,0.1); }
  .cc-lp-color-preview code { font-size:12px; color:#64748b; font-family:ui-monospace,monospace; }

  .cc-lp-order { font-family:ui-monospace,monospace; color:#475569; font-size:13px; font-variant-numeric:tabular-nums; font-weight:600; }

  .cc-lp-toggle { display:inline-flex; align-items:center; gap:6px; padding:5px 12px; border-radius:999px; font-size:12px; font-weight:600; cursor:pointer; border:1px solid transparent; transition:all 0.15s ease; }
  .cc-lp-toggle.on { background:#eef7f2; color:#047857; border-color:#c7e0d4; }
  .cc-lp-toggle.off { background:#f1f5f9; color:#94a3b8; border-color:#e2e8f0; }
  .cc-lp-toggle i { width:8px; height:8px; border-radius:50%; }
  .cc-lp-toggle.on i { background:#10b981; }
  .cc-lp-toggle.off i { background:#cbd5e1; }
  .cc-lp-toggle:hover { filter:brightness(0.96); }

  .cc-lp-actions { display:inline-flex; gap:6px; }
  .cc-lp-icon-btn { width:32px; height:32px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; display:grid; place-items:center; color:#475569; cursor:pointer; transition:all 0.15s ease; }
  .cc-lp-icon-btn:hover:not(:disabled) { color:#047857; border-color:#047857; background:#eef7f2; }
  .cc-lp-icon-btn.danger:hover:not(:disabled) { color:#dc2626; border-color:#dc2626; background:#fee2e2; }
  .cc-lp-icon-btn:disabled { opacity:0.35; cursor:not-allowed; }

  .cc-lp-loading, .cc-lp-no-data { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:10px; padding:40px 20px; color:#64748b; }
  .cc-lp-no-data svg { color:#cbd5e1; }
  .cc-lp-no-data p { margin:0 0 6px 0; font-size:14px; font-weight:500; }

  /* Modal */
  .cc-lp-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.6); backdrop-filter:blur(3px); z-index:70; display:grid; place-items:center; padding:16px; animation: fadeIn 0.15s ease-out; }
  @keyframes fadeIn { from { opacity:0; } to { opacity:1; } }
  
  .cc-lp-modal { background:#fff; border-radius:18px; padding:24px; width:100%; max-width:520px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; gap:16px; box-shadow:0 20px 25px -5px rgba(0,0,0,0.1), 0 10px 10px -5px rgba(0,0,0,0.04); }
  .cc-lp-modal-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .cc-lp-modal-title { display:flex; align-items:flex-start; gap:12px; }
  .cc-lp-modal-icon { width:36px; height:36px; border-radius:10px; background:#eff6ff; color:#2563eb; display:grid; place-items:center; flex-shrink:0; margin-top:2px; }
  .cc-lp-modal-icon.danger { background:#fee2e2; color:#dc2626; }
  .cc-lp-modal-title h3 { margin:0; font-size:17px; font-weight:700; color:#0f172a; }
  .cc-lp-modal-title p { margin:2px 0 0 0; font-size:12.5px; color:#64748b; }
  .cc-lp-modal-close { border:0; background:#f1f5f9; color:#475569; width:30px; height:30px; border-radius:8px; cursor:pointer; display:grid; place-items:center; flex-shrink:0; transition:all 0.15s ease; }
  .cc-lp-modal-close:hover { background:#e2e8f0; color:#0f172a; }

  .cc-lp-form { display:flex; flex-direction:column; gap:14px; }
  .cc-lp-form-row { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .cc-form-field { display:flex; flex-direction:column; gap:5px; font-size:12.5px; font-weight:600; color:#334155; }
  .cc-form-field input, .cc-form-field select { padding:9px 13px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px; color:#0f172a; background:#fff; font-family:inherit; transition:border-color 0.15s ease, box-shadow 0.15s ease; }
  .cc-form-field input:focus, .cc-form-field select:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }
  .cc-input-disabled { background:#f8fafc !important; color:#94a3b8 !important; cursor:not-allowed; }
  .cc-form-hint { font-size:11.5px; color:#94a3b8; font-weight:400; margin-top:2px; }

  /* Color Selector */
  .cc-lp-color-selector { display:flex; flex-direction:column; gap:8px; padding:10px 12px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; }
  .cc-lp-color-presets { display:flex; gap:8px; flex-wrap:wrap; }
  .cc-lp-preset-btn { width:26px; height:26px; border-radius:50%; border:2px solid #fff; cursor:pointer; box-shadow:0 0 0 1px #cbd5e1; transition:transform 0.15s ease, box-shadow 0.15s ease; }
  .cc-lp-preset-btn:hover { transform:scale(1.15); }
  .cc-lp-preset-btn.selected { box-shadow:0 0 0 2.5px #0f172a; transform:scale(1.1); }
  .cc-lp-custom-color { display:flex; align-items:center; gap:8px; margin-top:2px; }
  .cc-lp-custom-color input[type="color"] { width:32px; height:32px; padding:0; border:1px solid #cbd5e1; border-radius:8px; cursor:pointer; background:none; }
  .cc-lp-custom-color input[type="text"] { height:32px; padding:4px 10px; border:1px solid #cbd5e1; border-radius:8px; font-size:12.5px; font-family:ui-monospace,monospace; width:100px; }

  /* Delete Dialog */
  .cc-lp-delete-body { display:flex; flex-direction:column; gap:12px; color:#334155; font-size:13.5px; }
  .cc-lp-delete-body p { margin:0; }
  .cc-lp-delete-warning { display:flex; align-items:flex-start; gap:8px; padding:10px 12px; background:#fffbeb; border:1px solid #fef3c7; border-radius:10px; font-size:12px; color:#b45309; }
  .cc-lp-delete-warning svg { flex-shrink:0; margin-top:1px; }

  .cc-lp-modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:8px; }

  @media (max-width: 640px) {
    .cc-lp-form-row { grid-template-columns:1fr; }
    .cc-lp-modal-actions { flex-direction:column; }
    .cc-lp-modal-actions button { width:100%; }
  }
`;
