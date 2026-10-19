import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Building2,
  Check,
  CheckCircle2,
  Mail,
  Pencil,
  Phone,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  UserCheck,
  X,
} from "lucide-react";
import API_URL from "../../config";

const LENDER_TYPES = ["Bank", "NBFC", "DSA", "Private Financer", "Other"];

const typeClass = (type) => {
  switch (type) {
    case "NBFC":
      return "type-nbfc";
    case "DSA":
      return "type-dsa";
    case "Private Financer":
      return "type-fintech";
    default:
      return "type-bank";
  }
};

const emptyLender = () => ({
  name: "",
  short_code: "",
  lender_type: "Bank",
  contact_person: "",
  bank_email: "",
  rm_email: "",
  rm_phone: "",
  supported_loan_products: [],
  is_active: true,
});

export default function LendersRedesign() {
  const [lenders, setLenders] = useState([]);
  const [loanProducts, setLoanProducts] = useState([]);
  const [loading, setLoading] = useState(true);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");

  const [lenderModalOpen, setLenderModalOpen] = useState(false);
  const [editingLender, setEditingLender] = useState(null);
  const [lenderForm, setLenderForm] = useState(emptyLender);

  const [submitting, setSubmitting] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);

  const userRole = localStorage.getItem("userRole") || "";
  const employeeRole = localStorage.getItem("employeeRole") || "";
  const isCompanyAdmin =
    ["COMPANY_ADMIN", "SUPERADMIN"].includes(userRole.toUpperCase()) ||
    ["admin", "superadmin"].includes(employeeRole.toLowerCase());

  let userPermissions = {};
  try {
    userPermissions = JSON.parse(localStorage.getItem("userPermissions") || "{}");
  } catch {
    userPermissions = {};
  }

  const canCreateLender =
    isCompanyAdmin ||
    userPermissions.createLender === true ||
    (userPermissions.createLender !== false &&
      ["MANAGER", "OPS"].includes(userRole.toUpperCase()));

  const canEditLender =
    isCompanyAdmin ||
    userPermissions.editLender === true ||
    (userPermissions.editLender !== false &&
      ["MANAGER", "OPS"].includes(userRole.toUpperCase()));

  const fetchLoanProducts = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/master-configs/LOAN_PRODUCT`);
      const raw = res.data?.data || res.data || [];
      const items = Array.isArray(raw) ? raw : [];
      // Deduplicate by value or label
      const unique = [];
      const seen = new Set();
      items.forEach((p) => {
        const val = p.value || p.label;
        if (val && !seen.has(val)) {
          seen.add(val);
          unique.push(p);
        }
      });
      setLoanProducts(unique);
    } catch (err) {
      console.warn("Could not load loan products master configs", err);
    }
  }, []);

  const fetchLenders = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/lenders`, {
        params: { includeInactive: true },
      });
      setLenders(res.data?.lenders || res.data?.data || []);
    } catch (error) {
      console.error("Error fetching lenders", error);
      toast.error("Could not load lenders");
      setLenders([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchLenders();
    fetchLoanProducts();
  }, [fetchLenders, fetchLoanProducts]);

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedSearchTerm(searchTerm), 350);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const openCreateLender = () => {
    setEditingLender(null);
    setLenderForm(emptyLender());
    setLenderModalOpen(true);
  };

  const openEditLender = (lender) => {
    let prods = lender.supported_loan_products || lender.supportedLoanProducts || [];
    if (typeof prods === "string") {
      try {
        prods = JSON.parse(prods);
      } catch {
        prods = [];
      }
    }
    if (!Array.isArray(prods)) prods = [];

    setEditingLender(lender);
    setLenderForm({
      name: lender.name || "",
      short_code: lender.short_code || lender.shortCode || "",
      lender_type: lender.lender_type || lender.lenderType || "Bank",
      contact_person: lender.contact_person || lender.contactPerson || "",
      bank_email: lender.bank_email || lender.bankEmail || "",
      rm_email: lender.rm_email || lender.rmEmail || "",
      rm_phone: lender.rm_phone || lender.rmPhone || "",
      supported_loan_products: prods,
      is_active: lender.is_active !== undefined ? lender.is_active : lender.isActive ?? true,
    });
    setLenderModalOpen(true);
  };

  const toggleLoanProduct = (productVal) => {
    setLenderForm((prev) => {
      const current = prev.supported_loan_products || [];
      const exists = current.includes(productVal);
      return {
        ...prev,
        supported_loan_products: exists
          ? current.filter((p) => p !== productVal)
          : [...current, productVal],
      };
    });
  };

  const selectAllProducts = () => {
    const allVals = loanProducts.map((p) => p.value || p.label);
    setLenderForm((prev) => ({
      ...prev,
      supported_loan_products: allVals,
    }));
  };

  const clearAllProducts = () => {
    setLenderForm((prev) => ({
      ...prev,
      supported_loan_products: [],
    }));
  };

  const getProductLabel = (val) => {
    const found = loanProducts.find(
      (p) => p.value === val || p.label === val || String(p.id) === String(val)
    );
    return found?.label || val;
  };

  const handleLenderSubmit = async (e) => {
    e?.preventDefault();
    if (!lenderForm.name.trim()) {
      toast.warning("Lender name is required");
      return;
    }
    if (!lenderForm.short_code.trim()) {
      toast.warning("Short code is required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        name: lenderForm.name.trim(),
        short_code: lenderForm.short_code.trim(),
        lender_type: lenderForm.lender_type,
        contact_person: lenderForm.contact_person.trim() || null,
        bank_email: lenderForm.bank_email?.trim() || null,
        rm_email: lenderForm.rm_email?.trim() || null,
        rm_phone: lenderForm.rm_phone?.trim() || null,
        supported_loan_products: lenderForm.supported_loan_products || [],
      };

      if (editingLender) {
        await axios.put(`${API_URL}/lenders/${editingLender.lender_id || editingLender.id}`, payload);
        toast.success("Lender updated successfully");
      } else {
        await axios.post(`${API_URL}/lenders`, payload);
        toast.success("New lender partner added successfully");
      }
      setLenderModalOpen(false);
      setEditingLender(null);
      setLenderForm(emptyLender());
      fetchLenders();
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not save lender");
    } finally {
      setSubmitting(false);
    }
  };

  const handleToggleLenderActive = async (lender) => {
    const lenderId = lender.lender_id || lender.id;
    const nextStatus = !lender.is_active;
    try {
      await axios.put(`${API_URL}/lenders/${lenderId}`, {
        is_active: nextStatus,
      });
      setLenders((prev) =>
        prev.map((row) =>
          (row.lender_id || row.id) === lenderId ? { ...row, is_active: nextStatus, isActive: nextStatus } : row
        )
      );
      toast.success(`Lender marked as ${nextStatus ? "Active" : "Inactive"}`);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not update lender status");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    const lenderId = deleteTarget.lender_id || deleteTarget.id;
    try {
      await axios.delete(`${API_URL}/lenders/${lenderId}`);
      toast.success("Lender deactivated");
      fetchLenders();
      setDeleteTarget(null);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Could not delete lender");
    }
  };

  const filteredLenders = useMemo(() => {
    return lenders.filter((lender) => {
      const type = lender.lender_type || lender.lenderType;
      if (typeFilter && type !== typeFilter) return false;
      if (!debouncedSearchTerm.trim()) return true;
      const query = debouncedSearchTerm.toLowerCase();
      const code = lender.short_code || lender.shortCode || "";
      const contact = lender.contact_person || lender.contactPerson || "";
      return (
        String(lender.name || "").toLowerCase().includes(query) ||
        String(code).toLowerCase().includes(query) ||
        String(contact).toLowerCase().includes(query)
      );
    });
  }, [lenders, debouncedSearchTerm, typeFilter]);

  return (
    <div className="cc-report-redesign cc-lender">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      {/* Top Filter Bar */}
      <section className="cc-report-panel cc-lender-topbar">
        <label className="cc-lender-search-shell">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search by bank name, short code, RM..."
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="cc-lender-search-clear"
              onClick={() => setSearchTerm("")}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </label>

        <label className="cc-lender-filter">
          Type
          <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
            <option value="">All Institution Types</option>
            {LENDER_TYPES.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </label>

        {canCreateLender && (
          <button
            type="button"
            className="cc-lender-btn primary cc-lender-topbar-add"
            onClick={openCreateLender}
          >
            <Plus size={16} /> Add New Lender
          </button>
        )}
      </section>

      {/* Lenders Table */}
      <section className="cc-report-panel">
        <div className="cc-report-table-head">
          <h2>
            Lenders &amp; NBFC Partners <span className="cc-lender-count">({filteredLenders.length})</span>
          </h2>
          <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
            Manage Banks, NBFCs, and lending institutions for application dispatch and payout tracking.
          </p>
        </div>

        <div className="cc-report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lender Name &amp; Code</th>
                <th>Institution Type</th>
                <th>Relationship Manager / Contact</th>
                <th>Supported Loan Products</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="cc-report-empty">
                    Loading lender partners...
                  </td>
                </tr>
              ) : filteredLenders.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cc-report-empty">
                    {lenders.length === 0
                      ? "No lenders added yet — click Add New Lender to register your first bank or NBFC."
                      : "No lenders match the current filter criteria."}
                  </td>
                </tr>
              ) : (
                filteredLenders.map((lender) => {
                  const lenderId = lender.lender_id || lender.id;
                  const lenderType = lender.lender_type || lender.lenderType || "Bank";
                  const shortCode = lender.short_code || lender.shortCode || "--";
                  const contact = lender.contact_person || lender.contactPerson;
                  const prods = Array.isArray(lender.supported_loan_products)
                    ? lender.supported_loan_products
                    : [];
                  const isActive = lender.is_active !== undefined ? lender.is_active : lender.isActive ?? true;

                  return (
                    <tr key={lenderId} className="cc-lender-row" onClick={() => openEditLender(lender)}>
                      <td>
                        <span className="cc-lender-name">
                          <strong>{lender.name}</strong>
                          <small>{shortCode}</small>
                        </span>
                      </td>
                      <td>
                        <span className={`cc-lender-type ${typeClass(lenderType)}`}>
                          {lenderType}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
                          {contact ? (
                            <span className="cc-lender-contact-cell">
                              <UserCheck size={14} /> <strong>{contact}</strong>
                            </span>
                          ) : (
                            <span className="cc-lender-muted">—</span>
                          )}
                          {lender.rm_email || lender.rmEmail ? (
                            <a
                              href={`mailto:${lender.rm_email || lender.rmEmail}`}
                              onClick={(e) => e.stopPropagation()}
                              className="cc-lender-mail-tag rm"
                              title="Bank RM Email (Receives dispatched applications)"
                            >
                              <Mail size={12} />
                              <span>{lender.rm_email || lender.rmEmail}</span>
                            </a>
                          ) : null}
                          {lender.bank_email || lender.bankEmail ? (
                            <a
                              href={`mailto:${lender.bank_email || lender.bankEmail}`}
                              onClick={(e) => e.stopPropagation()}
                              className="cc-lender-mail-tag bank"
                              title="Bank Branch / Official Email"
                            >
                              <Building2 size={12} />
                              <span>{lender.bank_email || lender.bankEmail}</span>
                            </a>
                          ) : null}
                          {lender.rm_phone || lender.rmPhone ? (
                            <span style={{ fontSize: 11, color: "#64748b", display: "inline-flex", alignItems: "center", gap: 4 }}>
                              <Phone size={11} /> {lender.rm_phone || lender.rmPhone}
                            </span>
                          ) : null}
                        </div>
                      </td>
                      <td>
                        {prods.length > 0 ? (
                          <div className="cc-lender-product-tags">
                            {prods.slice(0, 3).map((prodVal) => (
                              <span key={prodVal} className="cc-lender-product-tag">
                                {getProductLabel(prodVal)}
                              </span>
                            ))}
                            {prods.length > 3 && (
                              <span
                                className="cc-lender-product-tag more"
                                title={prods.slice(3).map(getProductLabel).join(", ")}
                              >
                                +{prods.length - 3} more
                              </span>
                            )}
                          </div>
                        ) : (
                          <span className="cc-lender-muted">All Products</span>
                        )}
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <button
                          type="button"
                          className={`cc-lender-toggle ${isActive ? "on" : "off"}`}
                          onClick={() => handleToggleLenderActive(lender)}
                          title={isActive ? "Deactivate" : "Activate"}
                        >
                          <i /> {isActive ? "Active" : "Inactive"}
                        </button>
                      </td>
                      <td onClick={(event) => event.stopPropagation()}>
                        <div className="cc-lender-actions">
                          {canEditLender && (
                            <button
                              type="button"
                              className="cc-lender-icon-btn"
                              title="Edit"
                              onClick={() => openEditLender(lender)}
                            >
                              <Pencil size={14} />
                            </button>
                          )}
                          <button
                            type="button"
                            className="cc-lender-icon-btn danger"
                            title="Deactivate / Delete"
                            onClick={() => setDeleteTarget(lender)}
                          >
                            <Trash2 size={14} />
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
      </section>

      {/* Add / Edit Lender Modal */}
      {lenderModalOpen && (
        <div className="cc-lender-overlay" onClick={() => setLenderModalOpen(false)}>
          <div className="cc-lender-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-lender-modal-head">
              <div>
                <p style={{ margin: 0, fontSize: 11, fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>
                  Institution Partner
                </p>
                <h3 style={{ margin: "2px 0 0", fontSize: 18, fontWeight: 700, color: "#0f172a" }}>
                  {editingLender ? "Edit Lender Partner" : "Add New Lender Partner"}
                </h3>
              </div>
              <button type="button" onClick={() => setLenderModalOpen(false)}>
                <X size={16} />
              </button>
            </div>

            <form className="cc-lender-form" onSubmit={handleLenderSubmit}>
              <div className="cc-lender-form-row">
                <label className="cc-form-field grow">
                  <span>Lender / Bank Name *</span>
                  <input
                    type="text"
                    value={lenderForm.name}
                    onChange={(event) => setLenderForm({ ...lenderForm, name: event.target.value })}
                    placeholder="e.g. HDFC Bank, ICICI Bank, Bajaj Finserv"
                    autoFocus
                    required
                  />
                </label>
                <label className="cc-form-field" style={{ minWidth: 120 }}>
                  <span>Short Code *</span>
                  <input
                    type="text"
                    value={lenderForm.short_code}
                    onChange={(event) =>
                      setLenderForm({ ...lenderForm, short_code: event.target.value.toUpperCase() })
                    }
                    placeholder="HDFC"
                    required
                  />
                </label>
              </div>

              <div className="cc-lender-form-row">
                <label className="cc-form-field grow">
                  <span>Institution Type *</span>
                  <select
                    value={lenderForm.lender_type}
                    onChange={(event) =>
                      setLenderForm({ ...lenderForm, lender_type: event.target.value })
                    }
                  >
                    {LENDER_TYPES.map((type) => (
                      <option key={type} value={type}>
                        {type}
                      </option>
                    ))}
                  </select>
                </label>

                <label className="cc-form-field grow">
                  <span>Relationship Manager / Contact Person</span>
                  <input
                    type="text"
                    value={lenderForm.contact_person}
                    onChange={(event) =>
                      setLenderForm({ ...lenderForm, contact_person: event.target.value })
                    }
                    placeholder="e.g. Rajesh Kumar - Chief RM"
                  />
                </label>
              </div>

              <div className="cc-lender-form-row">
                <label className="cc-form-field grow">
                  <span style={{ color: "#047857", fontWeight: 700 }}>Bank RM Email (Direct Dispatch)</span>
                  <input
                    type="email"
                    value={lenderForm.rm_email}
                    onChange={(event) =>
                      setLenderForm({ ...lenderForm, rm_email: event.target.value })
                    }
                    placeholder="e.g. rajesh.rm@hdfcbank.com"
                  />
                  <small style={{ fontSize: 10.5, color: "#64748b", fontWeight: 400 }}>
                    Applications sent from Operations will be emailed to this RM directly
                  </small>
                </label>

                <label className="cc-form-field grow">
                  <span>Bank Official / Branch Email</span>
                  <input
                    type="email"
                    value={lenderForm.bank_email}
                    onChange={(event) =>
                      setLenderForm({ ...lenderForm, bank_email: event.target.value })
                    }
                    placeholder="e.g. loans@hdfcbank.com"
                  />
                </label>

                <label className="cc-form-field" style={{ minWidth: 150 }}>
                  <span>RM Phone / Mobile</span>
                  <input
                    type="tel"
                    value={lenderForm.rm_phone}
                    onChange={(event) =>
                      setLenderForm({ ...lenderForm, rm_phone: event.target.value })
                    }
                    placeholder="e.g. 9876543210"
                  />
                </label>
              </div>

              {/* Loan Products Checklist */}
              <div className="cc-lender-products-section">
                <div className="cc-lender-products-head">
                  <div>
                    <span className="cc-lender-products-title">Loan Products Handled / Supported</span>
                    <span className="cc-lender-products-subtitle">
                      Check all loans processed by this institution partner
                    </span>
                  </div>
                  <div className="cc-lender-products-actions">
                    <span className="cc-lender-badge-count">
                      {(lenderForm.supported_loan_products || []).length} Selected
                    </span>
                    <button
                      type="button"
                      className="cc-lender-action-link"
                      onClick={selectAllProducts}
                    >
                      Select All
                    </button>
                    <span className="cc-lender-action-sep">|</span>
                    <button
                      type="button"
                      className="cc-lender-action-link"
                      onClick={clearAllProducts}
                    >
                      Clear
                    </button>
                  </div>
                </div>

                <div className="cc-lender-products-grid">
                  {loanProducts.map((p) => {
                    const val = p.value || p.label;
                    const isSelected = (lenderForm.supported_loan_products || []).includes(val);
                    return (
                      <label
                        key={val}
                        className={`cc-lender-product-item ${isSelected ? "selected" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleLoanProduct(val)}
                        />
                        <span className="cc-lender-product-check">
                          {isSelected ? <Check size={12} strokeWidth={3} /> : null}
                        </span>
                        <span className="cc-lender-product-label" title={p.label || val}>
                          {p.label || val}
                        </span>
                      </label>
                    );
                  })}
                  {loanProducts.length === 0 && (
                    <div className="cc-lender-products-empty">
                      No loan products found. (Configurable under Master Settings)
                    </div>
                  )}
                </div>
              </div>

              <div className="cc-lender-modal-actions">
                <button
                  type="button"
                  className="cc-lender-btn ghost"
                  onClick={() => setLenderModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-lender-btn primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingLender ? "Save Changes" : "Add Lender"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Delete / Deactivate Confirm Modal */}
      {deleteTarget && (
        <div className="cc-lender-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cc-lender-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-lender-modal-head">
              <h3>Deactivate {deleteTarget.name}?</h3>
              <button type="button" onClick={() => setDeleteTarget(null)}>
                <X size={16} />
              </button>
            </div>
            <p style={{ margin: 0, color: "#475569", fontSize: 13.5, lineHeight: 1.5 }}>
              This will deactivate <strong>{deleteTarget.name}</strong>. Existing loan applications will retain their historical partner link, but no new applications can be routed to this lender.
            </p>
            <div className="cc-lender-modal-actions">
              <button
                type="button"
                className="cc-lender-btn ghost"
                onClick={() => setDeleteTarget(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cc-lender-btn primary danger"
                onClick={handleDelete}
              >
                Deactivate Lender
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
  .cc-lender-topbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; padding:12px 16px; margin-bottom:14px; }
  .cc-lender-search-shell { position:relative; flex:1 1 280px; min-width:200px; display:flex; align-items:center; height:40px; padding:0 12px 0 38px; border:1px solid #cbd5e1; border-radius:10px; background:#fff; }
  .cc-lender-search-shell:focus-within { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.12); }
  .cc-lender-search-shell svg { position:absolute; left:12px; color:#94a3b8; pointer-events:none; }
  .cc-lender-search-shell input { flex:1; border:0; outline:none; background:transparent; font-size:13px; color:#0f172a; }
  .cc-lender-search-clear { border:0; background:#f1f5f9; color:#475569; width:20px; height:20px; border-radius:50%; display:grid; place-items:center; cursor:pointer; }
  .cc-lender-filter { display:inline-flex; align-items:center; gap:8px; font-size:12px; font-weight:600; color:#475569; text-transform:uppercase; }
  .cc-lender-filter select { padding:8px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; height:40px; }
  .cc-lender-topbar-add { margin-left:auto; height:40px; padding:0 16px; }

  .cc-lender-count { font-size:13px; color:#64748b; font-weight:600; }
  .cc-lender-row { cursor:pointer; transition:background-color .12s; }
  .cc-lender-row:hover { background:#f8fafc; }
  .cc-lender-name strong { display:block; font-size:13.5px; color:#0f172a; }
  .cc-lender-name small { display:block; font-size:11.5px; color:#64748b; font-weight:600; }

  .cc-lender-type { display:inline-flex; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:600; }
  .cc-lender-type.type-bank { background:#eef2ff; color:#4338ca; }
  .cc-lender-type.type-nbfc { background:#fef3c7; color:#b45309; }
  .cc-lender-type.type-dsa { background:#ecfdf5; color:#047857; }
  .cc-lender-type.type-fintech { background:#fff1f2; color:#be123c; }

  .cc-lender-contact-cell { display:inline-flex; align-items:center; gap:6px; font-size:13px; color:#334155; }
  .cc-lender-muted { color:#94a3b8; }

  .cc-lender-toggle { display:inline-flex; align-items:center; gap:6px; padding:4px 10px; border-radius:999px; border:1px solid #cbd5e1; background:#fff; font-size:12px; font-weight:600; cursor:pointer; }
  .cc-lender-toggle.on { color:#047857; border-color:#bbf7d0; background:#f0fdf4; }
  .cc-lender-toggle.on i { width:6px; height:6px; border-radius:50%; background:#10b981; }
  .cc-lender-toggle.off { color:#64748b; border-color:#e2e8f0; background:#f8fafc; }
  .cc-lender-toggle.off i { width:6px; height:6px; border-radius:50%; background:#94a3b8; }

  .cc-lender-actions { display:inline-flex; gap:6px; }
  .cc-lender-icon-btn { width:30px; height:30px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; display:grid; place-items:center; color:#475569; cursor:pointer; }
  .cc-lender-icon-btn:hover { color:#047857; border-color:#047857; }
  .cc-lender-icon-btn.danger:hover { color:#dc2626; border-color:#dc2626; }

  .cc-lender-product-tags { display:flex; flex-wrap:wrap; gap:4px; align-items:center; max-width:320px; }
  .cc-lender-product-tag { display:inline-flex; align-items:center; padding:2px 7px; border-radius:6px; font-size:11px; font-weight:600; background:#f1f5f9; color:#334155; border:1px solid #e2e8f0; }
  .cc-lender-product-tag.more { background:#e2e8f0; color:#475569; cursor:help; }

  .cc-lender-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:100; display:grid; place-items:center; padding:16px; }
  .cc-lender-modal { width:100%; max-width:580px; background:#fff; border-radius:16px; padding:22px; display:flex; flex-direction:column; gap:14px; box-shadow:0 20px 60px rgba(15,23,42,0.25); max-height:92vh; overflow-y:auto; }
  .cc-lender-modal-head { display:flex; justify-content:space-between; align-items:flex-start; }
  .cc-lender-modal-head button { border:0; background:#f1f5f9; width:30px; height:30px; border-radius:8px; display:grid; place-items:center; cursor:pointer; color:#475569; }

  .cc-lender-form { display:flex; flex-direction:column; gap:12px; }
  .cc-lender-form-row { display:flex; gap:12px; flex-wrap:wrap; }
  .cc-form-field { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569; font-weight:600; }
  .cc-form-field.grow { flex:1; min-width:180px; }
  .cc-form-field input, .cc-form-field select { padding:9px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; font-family:inherit; }
  .cc-form-field input:focus, .cc-form-field select:focus { border-color:#047857; outline:none; box-shadow:0 0 0 3px rgba(4,120,87,0.12); }

  .cc-lender-products-section { display:flex; flex-direction:column; gap:8px; margin-top:4px; padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; }
  .cc-lender-products-head { display:flex; justify-content:space-between; align-items:flex-start; flex-wrap:wrap; gap:8px; }
  .cc-lender-products-title { display:block; font-size:12.5px; font-weight:700; color:#1e293b; }
  .cc-lender-products-subtitle { display:block; font-size:11.5px; color:#64748b; margin-top:1px; }
  .cc-lender-products-actions { display:inline-flex; align-items:center; gap:6px; font-size:12px; }
  .cc-lender-badge-count { padding:2px 8px; border-radius:999px; background:#ecfdf5; color:#047857; font-weight:700; font-size:11px; }
  .cc-lender-action-link { border:0; background:none; padding:0; color:#047857; font-size:11.5px; font-weight:600; cursor:pointer; text-decoration:underline; }
  .cc-lender-action-link:hover { color:#065f46; }
  .cc-lender-action-sep { color:#cbd5e1; font-size:11px; }

  .cc-lender-products-grid { display:grid; grid-template-columns:repeat(auto-fill, minmax(150px, 1fr)); gap:6px; max-height:180px; overflow-y:auto; padding:4px 2px; }
  .cc-lender-product-item { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border-radius:8px; border:1px solid #cbd5e1; background:#fff; font-size:12px; font-weight:500; color:#334155; cursor:pointer; user-select:none; transition:all .15s ease; }
  .cc-lender-product-item:hover { border-color:#047857; background:#f0fdf4; }
  .cc-lender-product-item.selected { border-color:#047857; background:#ecfdf5; color:#065f46; font-weight:600; }
  .cc-lender-product-item input[type="checkbox"] { display:none; }
  .cc-lender-product-check { width:16px; height:16px; border-radius:4px; border:1.5px solid #cbd5e1; display:grid; place-items:center; background:#fff; flex-shrink:0; color:#fff; transition:all .12s; }
  .cc-lender-product-item.selected .cc-lender-product-check { border-color:#047857; background:#047857; }
  .cc-lender-product-label { white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
  .cc-lender-products-empty { font-size:12px; color:#94a3b8; font-style:italic; padding:6px 0; }

  .cc-lender-mail-tag { display:inline-flex; align-items:center; gap:5px; font-size:11.5px; padding:2px 7px; border-radius:6px; text-decoration:none; max-width:240px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; transition:all .15s; }
  .cc-lender-mail-tag.rm { background:#ecfdf5; color:#047857; border:1px solid #bbf7d0; font-weight:600; }
  .cc-lender-mail-tag.rm:hover { background:#d1fae5; }
  .cc-lender-mail-tag.bank { background:#f8fafc; color:#475569; border:1px solid #e2e8f0; }
  .cc-lender-mail-tag.bank:hover { background:#f1f5f9; color:#0f172a; }

  .cc-lender-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:8px; }
  .cc-lender-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 16px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; }
  .cc-lender-btn.primary { background:#047857; color:#fff; }
  .cc-lender-btn.primary.danger { background:#dc2626; }
  .cc-lender-btn.ghost { background:#fff; color:#0f172a; border-color:#cbd5e1; }
`;
