import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";
import { Pencil, Plus, Search, UploadCloud, X, Image as ImageIcon } from "lucide-react";

import API_URL from "../../config";
import PlatformLayout from "../../components/PlatformLayout";
import CcPagination from "../../components/CcPagination";
import SeatMeter from "./SeatMeter";
import { resolveLogoUrl } from "../../utils/logo";

const PAGE_SIZE = 20;

const STATUS_TABS = [
  { value: "", label: "All" },
  { value: "active", label: "Active" },
  { value: "trial", label: "Trial" },
  { value: "suspended", label: "Suspended" },
];

const emptyForm = {
  name: "",
  email: "",
  phone: "",
  logoFile: null,
  logoPreview: "",
  planId: "",
  maxUsers: "",
  status: "trial",
  subscriptionExpiresAt: "",
  branchName: "Head Office",
  branchCity: "",
  adminName: "",
  adminEmail: "",
  adminPhone: "",
  adminPassword: "",
};

function CompaniesScreen() {
  const navigate = useNavigate();

  const [rows, setRows] = useState([]);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [status, setStatus] = useState("");
  const [planId, setPlanId] = useState("");

  const [showCreate, setShowCreate] = useState(false);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const [editingCompany, setEditingCompany] = useState(null);
  const [editForm, setEditForm] = useState({
    name: "",
    email: "",
    phone: "",
    logoUrl: "",
    logoFile: null,
    logoPreview: "",
    planId: "",
    maxUsers: "",
    status: "active",
    subscriptionExpiresAt: "",
  });
  const [editSaving, setEditSaving] = useState(false);

  // Typing should not fire a request per keystroke.
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm.trim());
      setPage(1);
    }, 400);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  const loadCompanies = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/platform/companies`, {
        params: {
          page,
          limit: PAGE_SIZE,
          search: debouncedSearch || undefined,
          status: status || undefined,
          planId: planId || undefined,
        },
      });
      setRows(res.data?.data || []);
      setTotalPages(res.data?.pagination?.totalPages || 1);
      setTotalItems(res.data?.pagination?.total || 0);
    } catch (error) {
      console.error("Failed to load companies", error);
      toast.error(error.response?.data?.message || "Could not load companies");
      setRows([]);
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch, status, planId]);

  useEffect(() => {
    loadCompanies();
  }, [loadCompanies]);

  useEffect(() => {
    axios
      .get(`${API_URL}/platform/plans`)
      .then((res) => setPlans(res.data?.data || []))
      .catch(() => setPlans([]));
  }, []);

  const setField = (key) => (event) => setForm((prev) => ({ ...prev, [key]: event.target.value }));

  const handleLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file must be less than 5MB");
      return;
    }
    const preview = URL.createObjectURL(file);
    setForm((prev) => ({
      ...prev,
      logoFile: file,
      logoPreview: preview,
    }));
  };

  const handleRemoveLogo = () => {
    if (form.logoPreview) {
      URL.revokeObjectURL(form.logoPreview);
    }
    setForm((prev) => ({
      ...prev,
      logoFile: null,
      logoPreview: "",
    }));
  };

  const handleOpenEdit = (company) => {
    setEditingCompany(company);
    setEditForm({
      name: company.name || "",
      email: company.email || "",
      phone: company.phone || "",
      logoUrl: company.logoUrl || "",
      logoFile: null,
      logoPreview: company.logoUrl ? resolveLogoUrl(company.logoUrl) : "",
      planId: company.planId ? String(company.planId) : "",
      maxUsers: company.maxUsers ? String(company.maxUsers) : "",
      status: company.status || "active",
      subscriptionExpiresAt: company.subscriptionExpiresAt
        ? moment(company.subscriptionExpiresAt).format("YYYY-MM-DD")
        : "",
    });
  };

  const handleEditLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file must be less than 5MB");
      return;
    }
    const preview = URL.createObjectURL(file);
    setEditForm((prev) => ({
      ...prev,
      logoFile: file,
      logoPreview: preview,
    }));
  };

  const handleEditRemoveLogo = () => {
    if (editForm.logoFile && editForm.logoPreview) {
      URL.revokeObjectURL(editForm.logoPreview);
    }
    setEditForm((prev) => ({
      ...prev,
      logoUrl: "",
      logoFile: null,
      logoPreview: "",
    }));
  };

  const submitEdit = async (event) => {
    event.preventDefault();
    if (!editingCompany) return;
    try {
      setEditSaving(true);
      let finalLogoUrl = editForm.logoUrl;

      if (editForm.logoFile) {
        const logoData = new FormData();
        logoData.append("logo", editForm.logoFile);
        const uploadRes = await axios.post(`${API_URL}/platform/upload-logo`, logoData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        finalLogoUrl = uploadRes.data?.logoUrl || null;
      }

      await axios.put(`${API_URL}/platform/companies/${editingCompany.id}`, {
        name: editForm.name.trim(),
        email: editForm.email ? editForm.email.trim() : null,
        phone: editForm.phone ? editForm.phone.trim() : null,
        logoUrl: finalLogoUrl,
        planId: editForm.planId ? Number(editForm.planId) : null,
        maxUsers: editForm.maxUsers ? Number(editForm.maxUsers) : null,
        status: editForm.status,
        subscriptionExpiresAt: editForm.subscriptionExpiresAt || null,
      });

      toast.success(`${editForm.name} updated successfully!`);
      setEditingCompany(null);
      loadCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Failed to update company");
    } finally {
      setEditSaving(false);
    }
  };

  const submitCreate = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      let logoUrl = null;
      if (form.logoFile) {
        const logoData = new FormData();
        logoData.append("logo", form.logoFile);
        const uploadRes = await axios.post(`${API_URL}/platform/upload-logo`, logoData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        logoUrl = uploadRes.data?.logoUrl || null;
      }

      const res = await axios.post(`${API_URL}/platform/companies`, {
        name: form.name,
        email: form.email || null,
        phone: form.phone || null,
        logoUrl,
        planId: form.planId ? Number(form.planId) : null,
        maxUsers: form.maxUsers ? Number(form.maxUsers) : undefined,
        status: form.status,
        subscriptionExpiresAt: form.subscriptionExpiresAt || null,
        branch: { name: form.branchName || "Head Office", city: form.branchCity || null },
        admin: {
          name: form.adminName,
          email: form.adminEmail || null,
          phone: form.adminPhone,
          password: form.adminPassword,
        },
      });
      toast.success(`${res.data?.data?.company?.name} provisioned`);
      setShowCreate(false);
      setForm(emptyForm);
      setPage(1);
      loadCompanies();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not provision the company");
    } finally {
      setSaving(false);
    }
  };

  return (
    <PlatformLayout
      title="Companies"
      subtitle="Every company on the platform, what they pay for, and how much of it they use."
      actions={
        <button type="button" className="cc-pl-btn" onClick={() => setShowCreate(true)}>
          <Plus size={16} />
          New company
        </button>
      }
    >
      <div className="cc-pl-controls">
        <label className="cc-pl-search">
          <Search size={16} />
          <input
            className="cc-pl-input"
            placeholder="Search name, slug, email or phone"
            value={searchTerm}
            onChange={(event) => setSearchTerm(event.target.value)}
          />
        </label>

        <div className="cc-pl-tabs">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.value || "all"}
              type="button"
              className={status === tab.value ? "active" : ""}
              onClick={() => {
                setStatus(tab.value);
                setPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <select
          className="cc-pl-select"
          value={planId}
          onChange={(event) => {
            setPlanId(event.target.value);
            setPage(1);
          }}
        >
          <option value="">All plans</option>
          {plans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
            </option>
          ))}
        </select>
      </div>

      <section className="cc-pl-card">
        <div className="cc-pl-table-wrap">
          <table className="cc-pl-table">
            <thead>
              <tr>
                <th>Company</th>
                <th>Plan</th>
                <th>Seats</th>
                <th>Status</th>
                <th>Renews</th>
                <th>Created</th>
                <th style={{ textAlign: "right" }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={7} className="cc-pl-empty">
                    Loading companies…
                  </td>
                </tr>
              ) : !rows.length ? (
                <tr>
                  <td colSpan={7} className="cc-pl-empty">
                    No companies match these filters
                  </td>
                </tr>
              ) : (
                rows.map((company) => {
                  const expiry = company.subscriptionExpiresAt
                    ? moment(company.subscriptionExpiresAt)
                    : null;
                  const lapsed = expiry && expiry.isBefore(moment());
                  return (
                    <tr
                      key={company.id}
                      className="clickable"
                      onClick={() => navigate(`/platform/companies/${company.id}`)}
                    >
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                          {company.logoUrl ? (
                            <img
                              src={resolveLogoUrl(company.logoUrl)}
                              alt={company.name}
                              style={{
                                width: 38,
                                height: 38,
                                objectFit: "contain",
                                borderRadius: 8,
                                background: "#fff",
                                border: "1px solid #e2e8f0",
                                padding: 2,
                                flexShrink: 0,
                              }}
                              onError={(e) => {
                                e.target.style.display = "none";
                              }}
                            />
                          ) : (
                            <div
                              style={{
                                width: 38,
                                height: 38,
                                borderRadius: 8,
                                background: "linear-gradient(135deg, #10B981, #047857)",
                                color: "#fff",
                                fontWeight: 700,
                                fontSize: 14,
                                display: "flex",
                                alignItems: "center",
                                justifyContent: "center",
                                flexShrink: 0,
                              }}
                            >
                              {company.name?.charAt(0)?.toUpperCase() || "C"}
                            </div>
                          )}
                          <div>
                            <div className="cc-pl-strong">{company.name}</div>
                            <div className="cc-pl-sub">{company.slug}</div>
                          </div>
                        </div>
                      </td>
                      <td>
                        {company.plan ? (
                          <>
                            <div>{company.plan.name}</div>
                            <div className="cc-pl-sub">₹{company.plan.priceMonthly}/mo</div>
                          </>
                        ) : (
                          <span className="cc-pl-pill muted">no plan</span>
                        )}
                      </td>
                      <td>
                        <SeatMeter used={company.seatsUsed} limit={company.seatLimit} />
                      </td>
                      <td>
                        <span className={`cc-pl-pill ${company.status}`}>{company.status}</span>
                      </td>
                      <td>
                        {expiry ? (
                          <>
                            <div>{expiry.format("DD MMM YYYY")}</div>
                            {lapsed ? <span className="cc-pl-pill suspended">lapsed</span> : null}
                          </>
                        ) : (
                          <span className="cc-pl-sub">no expiry</span>
                        )}
                      </td>
                      <td>{moment(company.createdAt).format("DD MMM YYYY")}</td>
                      <td style={{ textAlign: "right" }} onClick={(e) => e.stopPropagation()}>
                        <button
                          type="button"
                          className="cc-pl-btn ghost sm"
                          onClick={() => handleOpenEdit(company)}
                          title="Edit company"
                          style={{ display: "inline-flex", alignItems: "center", gap: 5 }}
                        >
                          <Pencil size={13} /> Edit
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>

        <CcPagination
          currentPage={page}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setPage}
          itemLabel="companies"
        />
      </section>

      {showCreate ? (
        <div className="cc-pl-backdrop" onClick={() => !saving && setShowCreate(false)}>
          <div className="cc-pl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-pl-modal-head">
              <h3>Provision a company</h3>
              <button type="button" onClick={() => setShowCreate(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitCreate}>
              <div className="cc-pl-modal-body">
                <label className="cc-pl-field">
                  <span>Company name</span>
                  <input value={form.name} onChange={setField("name")} required />
                </label>

                {/* Company Logo Upload Field */}
                <div className="cc-pl-field">
                  <span>Company Logo</span>
                  {form.logoPreview ? (
                    <div className="cc-pl-logo-preview-box">
                      <img
                        src={form.logoPreview}
                        alt="Logo preview"
                        className="cc-pl-logo-img-preview"
                      />
                      <div className="cc-pl-logo-preview-info">
                        <strong>{form.logoFile?.name}</strong>
                        <span>{(form.logoFile?.size / 1024).toFixed(1)} KB</span>
                      </div>
                      <button
                        type="button"
                        className="cc-pl-btn ghost sm danger"
                        onClick={handleRemoveLogo}
                        title="Remove logo"
                      >
                        <X size={15} /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="cc-pl-logo-dropzone">
                      <UploadCloud size={24} className="cc-pl-logo-drop-icon" />
                      <div>
                        <strong>Click to upload company logo</strong>
                        <span>PNG, JPG, WEBP, SVG or GIF (Max 5MB)</span>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        style={{ display: "none" }}
                        onChange={handleLogoChange}
                      />
                    </label>
                  )}
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Email</span>
                    <input type="email" value={form.email} onChange={setField("email")} />
                  </label>
                  <label className="cc-pl-field">
                    <span>Phone</span>
                    <input value={form.phone} onChange={setField("phone")} />
                  </label>
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Plan</span>
                    <select
                      value={form.planId}
                      onChange={(event) => {
                        const pid = event.target.value;
                        const pObj = plans.find((p) => String(p.id) === String(pid));
                        setForm((prev) => ({
                          ...prev,
                          planId: pid,
                          maxUsers: pObj?.maxEmployees ? String(pObj.maxEmployees) : prev.maxUsers,
                        }));
                      }}
                    >
                      <option value="">No plan</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} — {plan.maxEmployees} seats
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cc-pl-field">
                    <span>Allowed Employees (Seats)</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 10, 25, 50"
                      value={form.maxUsers}
                      onChange={setField("maxUsers")}
                    />
                  </label>
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Status</span>
                    <select value={form.status} onChange={setField("status")}>
                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                  <label className="cc-pl-field">
                    <span>Renews on</span>
                    <input
                      type="date"
                      value={form.subscriptionExpiresAt}
                      onChange={setField("subscriptionExpiresAt")}
                    />
                  </label>
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Head office city</span>
                    <input value={form.branchCity} onChange={setField("branchCity")} placeholder="e.g. Mumbai, Delhi" />
                  </label>
                </div>

                <p className="cc-pl-note">
                  The first administrator is created with the company. They sign in with this phone
                  or email and can then add their own team.
                </p>

                <div className="cc-pl-grid2" style={{ marginTop: 12 }}>
                  <label className="cc-pl-field">
                    <span>Admin name</span>
                    <input value={form.adminName} onChange={setField("adminName")} required />
                  </label>
                  <label className="cc-pl-field">
                    <span>Admin phone</span>
                    <input value={form.adminPhone} onChange={setField("adminPhone")} required />
                  </label>
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Admin email</span>
                    <input type="email" value={form.adminEmail} onChange={setField("adminEmail")} />
                  </label>
                  <label className="cc-pl-field">
                    <span>Temporary password</span>
                    <input
                      value={form.adminPassword}
                      onChange={setField("adminPassword")}
                      minLength={8}
                      required
                    />
                  </label>
                </div>
                <p className="cc-pl-hint">At least 8 characters. Share it with the customer directly.</p>
              </div>

              <div className="cc-pl-modal-foot">
                <button
                  type="button"
                  className="cc-pl-btn ghost"
                  onClick={() => setShowCreate(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-pl-btn" disabled={saving}>
                  {saving ? "Provisioning…" : "Provision company"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Company Modal */}
      {editingCompany ? (
        <div className="cc-pl-backdrop" onClick={() => !editSaving && setEditingCompany(null)}>
          <div className="cc-pl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-pl-modal-head">
              <h3>Edit {editingCompany.name}</h3>
              <button type="button" onClick={() => setEditingCompany(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitEdit}>
              <div className="cc-pl-modal-body">
                <label className="cc-pl-field">
                  <span>Company name</span>
                  <input
                    value={editForm.name}
                    onChange={(e) => setEditForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </label>

                {/* Company Logo Upload / Edit Field */}
                <div className="cc-pl-field">
                  <span>Company Logo</span>
                  {editForm.logoPreview ? (
                    <div className="cc-pl-logo-preview-box">
                      <img
                        src={editForm.logoPreview}
                        alt="Logo preview"
                        className="cc-pl-logo-img-preview"
                      />
                      <div className="cc-pl-logo-preview-info">
                        <strong>{editForm.logoFile?.name || "Current Logo"}</strong>
                        <span>{editForm.logoFile ? `${(editForm.logoFile.size / 1024).toFixed(1)} KB` : "Uploaded"}</span>
                      </div>
                      <button
                        type="button"
                        className="cc-pl-btn ghost sm danger"
                        onClick={handleEditRemoveLogo}
                        title="Remove logo"
                      >
                        <X size={15} /> Remove
                      </button>
                    </div>
                  ) : (
                    <label className="cc-pl-logo-dropzone">
                      <UploadCloud size={24} className="cc-pl-logo-drop-icon" />
                      <div>
                        <strong>Click to upload or change company logo</strong>
                        <span>PNG, JPG, WEBP, SVG or GIF (Max 5MB)</span>
                      </div>
                      <input
                        type="file"
                        accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                        style={{ display: "none" }}
                        onChange={handleEditLogoChange}
                      />
                    </label>
                  )}
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Email</span>
                    <input
                      type="email"
                      value={editForm.email}
                      onChange={(e) => setEditForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </label>
                  <label className="cc-pl-field">
                    <span>Phone</span>
                    <input
                      value={editForm.phone}
                      onChange={(e) => setEditForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Plan</span>
                    <select
                      value={editForm.planId}
                      onChange={(event) => {
                        const pid = event.target.value;
                        const pObj = plans.find((p) => String(p.id) === String(pid));
                        setEditForm((prev) => ({
                          ...prev,
                          planId: pid,
                          maxUsers: pObj?.maxEmployees ? String(pObj.maxEmployees) : prev.maxUsers,
                        }));
                      }}
                    >
                      <option value="">No plan</option>
                      {plans.map((plan) => (
                        <option key={plan.id} value={plan.id}>
                          {plan.name} — {plan.maxEmployees} seats
                        </option>
                      ))}
                    </select>
                  </label>
                  <label className="cc-pl-field">
                    <span>Allowed Employees (Seats)</span>
                    <input
                      type="number"
                      min={1}
                      placeholder="e.g. 10, 25, 50"
                      value={editForm.maxUsers}
                      onChange={(e) => setEditForm((p) => ({ ...p, maxUsers: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Status</span>
                    <select
                      value={editForm.status}
                      onChange={(e) => setEditForm((p) => ({ ...p, status: e.target.value }))}
                    >
                      <option value="trial">Trial</option>
                      <option value="active">Active</option>
                      <option value="suspended">Suspended</option>
                    </select>
                  </label>
                  <label className="cc-pl-field">
                    <span>Renews on</span>
                    <input
                      type="date"
                      value={editForm.subscriptionExpiresAt}
                      onChange={(e) => setEditForm((p) => ({ ...p, subscriptionExpiresAt: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="cc-pl-modal-foot">
                <button
                  type="button"
                  className="cc-pl-btn ghost"
                  onClick={() => setEditingCompany(null)}
                  disabled={editSaving}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-pl-btn" disabled={editSaving}>
                  {editSaving ? "Saving changes…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PlatformLayout>
  );
}

export default CompaniesScreen;
