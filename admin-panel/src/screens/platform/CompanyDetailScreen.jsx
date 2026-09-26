import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, KeyRound, Pencil, Plus, UploadCloud, X } from "lucide-react";

import API_URL from "../../config";
import PlatformLayout from "../../components/PlatformLayout";
import SeatMeter from "./SeatMeter";
import { resolveLogoUrl } from "../../utils/logo";

function CompanyDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [uploadingLogo, setUploadingLogo] = useState(false);
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [savingEdit, setSavingEdit] = useState(false);
  const [editCompanyForm, setEditCompanyForm] = useState({
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
  const [statusModal, setStatusModal] = useState(null);
  const [statusReason, setStatusReason] = useState("");
  const [adminModal, setAdminModal] = useState(false);
  const [adminForm, setAdminForm] = useState({ name: "", phone: "", email: "", password: "" });
  const [resetTarget, setResetTarget] = useState(null);
  const [resetPassword, setResetPassword] = useState("");

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const [detail, use] = await Promise.all([
        axios.get(`${API_URL}/platform/companies/${id}`),
        axios.get(`${API_URL}/platform/companies/${id}/usage`),
      ]);
      const data = detail.data?.data;
      setCompany(data);
      setUsage(use.data?.data || null);
      setForm({
        planId: data?.planId ? String(data.planId) : "",
        maxUsers: data?.maxUsers ? String(data.maxUsers) : "",
        subscriptionExpiresAt: data?.subscriptionExpiresAt
          ? moment(data.subscriptionExpiresAt).format("YYYY-MM-DD")
          : "",
      });
    } catch (error) {
      console.error("Failed to load company", error);
      toast.error(error.response?.data?.message || "Could not load the company");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    axios
      .get(`${API_URL}/platform/plans`, { params: { limit: 100 } })
      .then((res) => setPlans(res.data?.data || []))
      .catch(() => setPlans([]));
  }, []);

  const saveSubscription = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      const res = await axios.put(`${API_URL}/platform/companies/${id}`, {
        planId: form.planId ? Number(form.planId) : null,
        maxUsers: form.maxUsers ? Number(form.maxUsers) : null,
        subscriptionExpiresAt: form.subscriptionExpiresAt || null,
      });
      if (res.data?.note) toast.info(res.data.note);
      else toast.success("Subscription updated successfully");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not update the subscription");
    } finally {
      setSaving(false);
    }
  };

  const changeStatus = async () => {
    try {
      setSaving(true);
      const res = await axios.put(`${API_URL}/platform/companies/${id}/status`, {
        status: statusModal,
        reason: statusReason || undefined,
      });
      toast.success(
        statusModal === "suspended"
          ? `Suspended — ${res.data?.affectedUsers ?? 0} users cut off`
          : res.data?.message || "Status updated"
      );
      setStatusModal(null);
      setStatusReason("");
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not change the status");
    } finally {
      setSaving(false);
    }
  };

  const addAdmin = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await axios.post(`${API_URL}/platform/companies/${id}/admins`, adminForm);
      toast.success("Company admin added");
      setAdminModal(false);
      setAdminForm({ name: "", phone: "", email: "", password: "" });
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not add the admin");
    } finally {
      setSaving(false);
    }
  };

  const handleLogoUpload = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file must be less than 5MB");
      return;
    }
    try {
      setUploadingLogo(true);
      const logoData = new FormData();
      logoData.append("logo", file);
      const uploadRes = await axios.post(`${API_URL}/platform/upload-logo`, logoData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const logoUrl = uploadRes.data?.logoUrl;
      await axios.put(`${API_URL}/platform/companies/${id}`, { logoUrl });
      toast.success("Company logo updated successfully");
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update company logo");
    } finally {
      setUploadingLogo(false);
    }
  };

  const handleOpenEditModal = () => {
    if (!company) return;
    setEditCompanyForm({
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
    setEditModalOpen(true);
  };

  const handleEditLogoChange = (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) {
      toast.error("Logo file must be less than 5MB");
      return;
    }
    const preview = URL.createObjectURL(file);
    setEditCompanyForm((prev) => ({
      ...prev,
      logoFile: file,
      logoPreview: preview,
    }));
  };

  const handleEditRemoveLogo = () => {
    if (editCompanyForm.logoFile && editCompanyForm.logoPreview) {
      URL.revokeObjectURL(editCompanyForm.logoPreview);
    }
    setEditCompanyForm((prev) => ({
      ...prev,
      logoUrl: "",
      logoFile: null,
      logoPreview: "",
    }));
  };

  const submitEditCompany = async (event) => {
    event.preventDefault();
    try {
      setSavingEdit(true);
      let finalLogoUrl = editCompanyForm.logoUrl;

      if (editCompanyForm.logoFile) {
        const logoData = new FormData();
        logoData.append("logo", editCompanyForm.logoFile);
        const uploadRes = await axios.post(`${API_URL}/platform/upload-logo`, logoData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
        finalLogoUrl = uploadRes.data?.logoUrl || null;
      }

      await axios.put(`${API_URL}/platform/companies/${id}`, {
        name: editCompanyForm.name.trim(),
        email: editCompanyForm.email ? editCompanyForm.email.trim() : null,
        phone: editCompanyForm.phone ? editCompanyForm.phone.trim() : null,
        logoUrl: finalLogoUrl,
        planId: editCompanyForm.planId ? Number(editCompanyForm.planId) : null,
        maxUsers: editCompanyForm.maxUsers ? Number(editCompanyForm.maxUsers) : null,
        status: editCompanyForm.status,
        subscriptionExpiresAt: editCompanyForm.subscriptionExpiresAt || null,
      });

      toast.success("Company details updated successfully");
      setEditModalOpen(false);
      load();
    } catch (err) {
      toast.error(err.response?.data?.message || "Failed to update company details");
    } finally {
      setSavingEdit(false);
    }
  };

  const submitReset = async (event) => {
    event.preventDefault();
    try {
      setSaving(true);
      await axios.put(`${API_URL}/users/${resetTarget.id}/password`, { newPassword: resetPassword });
      toast.success(`Password reset for ${resetTarget.name}`);
      setResetTarget(null);
      setResetPassword("");
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not reset the password");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <PlatformLayout title="Company">
        <div className="cc-pl-card">
          <div className="cc-pl-empty">Loading company…</div>
        </div>
      </PlatformLayout>
    );
  }

  if (!company) {
    return (
      <PlatformLayout title="Company">
        <div className="cc-pl-card">
          <div className="cc-pl-empty">This company could not be found.</div>
        </div>
      </PlatformLayout>
    );
  }

  const expiry = company.subscriptionExpiresAt ? moment(company.subscriptionExpiresAt) : null;
  const lapsed = expiry && expiry.isBefore(moment());

  return (
    <PlatformLayout
      title={company.name}
      subtitle={`${company.slug} · created ${moment(company.createdAt).format("DD MMM YYYY")}`}
      actions={
        <>
          <button
            type="button"
            className="cc-pl-btn ghost"
            onClick={() => navigate("/platform/companies")}
          >
            <ArrowLeft size={15} />
            Back
          </button>
          <button
            type="button"
            className="cc-pl-btn ghost"
            onClick={handleOpenEditModal}
          >
            <Pencil size={15} />
            Edit company
          </button>
          {company.status === "suspended" ? (
            <button type="button" className="cc-pl-btn" onClick={() => setStatusModal("active")}>
              Reactivate
            </button>
          ) : (
            <button
              type="button"
              className="cc-pl-btn danger"
              onClick={() => setStatusModal("suspended")}
            >
              Suspend
            </button>
          )}
        </>
      }
    >
      {company.status === "suspended" ? (
        <div className="cc-pl-note warn" style={{ marginBottom: 16 }}>
          This company is suspended. Every one of its users is locked out of the admin panel and the
          mobile app until it is reactivated.
        </div>
      ) : null}
      {lapsed ? (
        <div className="cc-pl-note warn" style={{ marginBottom: 16 }}>
          The subscription lapsed on {expiry.format("DD MMM YYYY")}. Access is blocked until the
          renewal date is extended.
        </div>
      ) : null}

      <div className="cc-pl-stats">
        <div className="cc-pl-stat">
          <span>Status</span>
          <strong style={{ fontSize: 18 }}>
            <span className={`cc-pl-pill ${company.status}`}>{company.status}</span>
          </strong>
        </div>
        <div className="cc-pl-stat">
          <span>Seats</span>
          <strong style={{ fontSize: 18 }}>
            <SeatMeter used={company.seatsUsed} limit={company.seatLimit} />
          </strong>
        </div>
        <div className="cc-pl-stat">
          <span>Leads</span>
          <strong>{usage?.totalLeads ?? 0}</strong>
          <em>
            {usage?.lastLeadAt
              ? `last ${moment(usage.lastLeadAt).format("DD MMM YYYY")}`
              : "none yet"}
          </em>
        </div>
        <div className="cc-pl-stat">
          <span>Renews</span>
          <strong style={{ fontSize: 18 }}>
            {expiry ? expiry.format("DD MMM YYYY") : "—"}
          </strong>
          <em>{expiry ? expiry.fromNow() : "no expiry set"}</em>
        </div>
      </div>

      <div className="cc-pl-cols">
        <div style={{ display: "grid", gap: 16 }}>
          <section className="cc-pl-card">
            <div className="cc-pl-card-head">
              <h2>Company Brand & Logo</h2>
            </div>
            <div className="cc-pl-card-body" style={{ display: "flex", alignItems: "center", gap: 18, flexWrap: "wrap" }}>
              {company.logoUrl ? (
                <img
                  src={resolveLogoUrl(company.logoUrl)}
                  alt={company.name}
                  style={{
                    width: 76,
                    height: 76,
                    objectFit: "contain",
                    borderRadius: 12,
                    background: "#fff",
                    border: "1px solid var(--pl-border)",
                    padding: 6,
                  }}
                  onError={(e) => {
                    e.target.style.display = "none";
                  }}
                />
              ) : (
                <div
                  style={{
                    width: 76,
                    height: 76,
                    borderRadius: 12,
                    background: "linear-gradient(135deg, #10B981, #047857)",
                    color: "#fff",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    fontSize: 28,
                    fontWeight: 800,
                  }}
                >
                  {company.name?.charAt(0)?.toUpperCase() || "C"}
                </div>
              )}
              <div style={{ flex: 1, minWidth: 200 }}>
                <div style={{ fontWeight: 600, fontSize: 15, marginBottom: 4 }}>
                  {company.logoUrl ? "Company Logo Active" : "No Custom Logo"}
                </div>
                <p style={{ margin: "0 0 12px 0", fontSize: 13, color: "var(--pl-muted)" }}>
                  This logo is displayed in the CRM Admin Panel's sidebar for all users of this company.
                </p>
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap", alignItems: "center" }}>
                  <label className="cc-pl-btn sm" style={{ cursor: "pointer", display: "inline-flex" }}>
                    <UploadCloud size={14} />
                    <span>{uploadingLogo ? "Uploading…" : company.logoUrl ? "Change logo" : "Upload logo"}</span>
                    <input
                      type="file"
                      accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif"
                      style={{ display: "none" }}
                      disabled={uploadingLogo}
                      onChange={handleLogoUpload}
                    />
                  </label>
                  <button
                    type="button"
                    className="cc-pl-btn sm ghost"
                    onClick={handleOpenEditModal}
                  >
                    <Pencil size={14} /> Edit details
                  </button>
                </div>
              </div>
            </div>
          </section>

          <section className="cc-pl-card">
            <div className="cc-pl-card-head">
              <h2>Administrators</h2>
              <button type="button" className="cc-pl-btn sm" onClick={() => setAdminModal(true)}>
                <Plus size={15} />
                Add admin
              </button>
            </div>
            <div className="cc-pl-table-wrap">
              <table className="cc-pl-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Contact</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {!company.admins?.length ? (
                    <tr>
                      <td colSpan={4} className="cc-pl-empty">
                        This company has no administrator — it cannot be used until one is added.
                      </td>
                    </tr>
                  ) : (
                    company.admins.map((admin) => (
                      <tr key={admin.id}>
                        <td className="cc-pl-strong">{admin.name}</td>
                        <td>
                          <div>{admin.phone}</div>
                          <div className="cc-pl-sub">{admin.email || "no email"}</div>
                        </td>
                        <td>
                          <span
                            className={`cc-pl-pill ${admin.status === "active" ? "active" : "muted"}`}
                          >
                            {admin.status}
                          </span>
                        </td>
                        <td className="cc-pl-row-actions">
                          <button
                            type="button"
                            className="cc-pl-btn ghost sm"
                            onClick={() => setResetTarget(admin)}
                          >
                            <KeyRound size={14} />
                            Reset password
                          </button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </section>

          <section className="cc-pl-card">
            <div className="cc-pl-card-head">
              <h2>Usage</h2>
            </div>
            <div className="cc-pl-card-body">
              <dl className="cc-pl-kv">
                <dt>Users by role</dt>
                <dd>
                  {usage && Object.keys(usage.usersByRole || {}).length
                    ? Object.entries(usage.usersByRole).map(([role, count]) => (
                        <span key={role} className="cc-pl-pill muted" style={{ marginRight: 6 }}>
                          {role.toLowerCase().replace("_", " ")} · {count}
                        </span>
                      ))
                    : "—"}
                </dd>
                <dt>Branches</dt>
                <dd>
                  {company.branches?.length
                    ? company.branches.map((b) => b.name + (b.city ? ` (${b.city})` : "")).join(", ")
                    : "—"}
                </dd>
                <dt>Seats remaining</dt>
                <dd>{usage?.seatsRemaining ?? "no cap"}</dd>
              </dl>
            </div>
          </section>
        </div>

        <section className="cc-pl-card">
          <div className="cc-pl-card-head">
            <h2>Subscription</h2>
          </div>
          <form className="cc-pl-card-body" onSubmit={saveSubscription}>
            <label className="cc-pl-field">
              <span>Plan</span>
              <select
                value={form.planId}
                onChange={(event) => {
                  const selectedPlanId = event.target.value;
                  const selectedPlan = plans.find((p) => String(p.id) === String(selectedPlanId));
                  setForm((p) => ({
                    ...p,
                    planId: selectedPlanId,
                    maxUsers: selectedPlan?.maxEmployees ? String(selectedPlan.maxEmployees) : p.maxUsers,
                  }));
                }}
              >
                <option value="">No plan</option>
                {plans.map((plan) => (
                  <option key={plan.id} value={plan.id}>
                    {plan.name} — ₹{plan.priceMonthly}/mo, {plan.maxEmployees} seats
                  </option>
                ))}
              </select>
            </label>

            <label className="cc-pl-field">
              <span>Allowed Employees / Seats</span>
              <input
                type="number"
                min={1}
                value={form.maxUsers}
                placeholder="e.g. 10, 25, 50"
                onChange={(event) => setForm((p) => ({ ...p, maxUsers: event.target.value }))}
              />
            </label>
            <p className="cc-pl-hint">Custom seat allocation for this company. You can increase or decrease this limit at any time.</p>

            <label className="cc-pl-field">
              <span>Renews on</span>
              <input
                type="date"
                value={form.subscriptionExpiresAt}
                onChange={(event) =>
                  setForm((p) => ({ ...p, subscriptionExpiresAt: event.target.value }))
                }
              />
            </label>
            <p className="cc-pl-hint">Leave empty for no expiry. A past date blocks all access.</p>

            <button type="submit" className="cc-pl-btn" disabled={saving} style={{ width: "100%" }}>
              {saving ? "Saving…" : "Save subscription"}
            </button>
          </form>
        </section>
      </div>

      {statusModal ? (
        <div className="cc-pl-backdrop" onClick={() => !saving && setStatusModal(null)}>
          <div className="cc-pl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-pl-modal-head">
              <h3>{statusModal === "suspended" ? "Suspend company" : "Reactivate company"}</h3>
              <button type="button" onClick={() => setStatusModal(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <div className="cc-pl-modal-body">
              {statusModal === "suspended" ? (
                <>
                  <p className="cc-pl-note warn">
                    Every user at {company.name} loses access immediately — admin panel and mobile
                    app both. Their data is untouched and returns when you reactivate.
                  </p>
                  <label className="cc-pl-field" style={{ marginTop: 14 }}>
                    <span>Reason</span>
                    <textarea
                      value={statusReason}
                      onChange={(event) => setStatusReason(event.target.value)}
                      placeholder="Non-payment, trial ended, customer request…"
                      required
                    />
                  </label>
                  <p className="cc-pl-hint">Recorded on the audit trail. Required.</p>
                </>
              ) : (
                <p className="cc-pl-note">
                  Restores access for every active user at {company.name}.
                </p>
              )}
            </div>
            <div className="cc-pl-modal-foot">
              <button
                type="button"
                className="cc-pl-btn ghost"
                onClick={() => setStatusModal(null)}
                disabled={saving}
              >
                Cancel
              </button>
              <button
                type="button"
                className={`cc-pl-btn ${statusModal === "suspended" ? "danger" : ""}`}
                onClick={changeStatus}
                disabled={saving || (statusModal === "suspended" && !statusReason.trim())}
              >
                {saving ? "Working…" : statusModal === "suspended" ? "Suspend" : "Reactivate"}
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {adminModal ? (
        <div className="cc-pl-backdrop" onClick={() => !saving && setAdminModal(false)}>
          <div className="cc-pl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-pl-modal-head">
              <h3>Add company admin</h3>
              <button type="button" onClick={() => setAdminModal(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={addAdmin}>
              <div className="cc-pl-modal-body">
                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Name</span>
                    <input
                      value={adminForm.name}
                      onChange={(event) =>
                        setAdminForm((p) => ({ ...p, name: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="cc-pl-field">
                    <span>Phone</span>
                    <input
                      value={adminForm.phone}
                      onChange={(event) =>
                        setAdminForm((p) => ({ ...p, phone: event.target.value }))
                      }
                      required
                    />
                  </label>
                </div>
                <label className="cc-pl-field">
                  <span>Email</span>
                  <input
                    type="email"
                    value={adminForm.email}
                    onChange={(event) => setAdminForm((p) => ({ ...p, email: event.target.value }))}
                  />
                </label>
                <label className="cc-pl-field">
                  <span>Temporary password</span>
                  <input
                    value={adminForm.password}
                    minLength={8}
                    onChange={(event) =>
                      setAdminForm((p) => ({ ...p, password: event.target.value }))
                    }
                    required
                  />
                </label>
                <p className="cc-pl-hint">
                  Counts against this company's seats, like any other user.
                </p>
              </div>
              <div className="cc-pl-modal-foot">
                <button
                  type="button"
                  className="cc-pl-btn ghost"
                  onClick={() => setAdminModal(false)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-pl-btn" disabled={saving}>
                  {saving ? "Adding…" : "Add admin"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {resetTarget ? (
        <div className="cc-pl-backdrop" onClick={() => !saving && setResetTarget(null)}>
          <div className="cc-pl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-pl-modal-head">
              <h3>Reset password — {resetTarget.name}</h3>
              <button type="button" onClick={() => setResetTarget(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitReset}>
              <div className="cc-pl-modal-body">
                <label className="cc-pl-field">
                  <span>New password</span>
                  <input
                    value={resetPassword}
                    onChange={(event) => setResetPassword(event.target.value)}
                    minLength={8}
                    required
                  />
                </label>
                <p className="cc-pl-hint">
                  At least 8 characters. The reset is recorded on the company's audit trail.
                </p>
              </div>
              <div className="cc-pl-modal-foot">
                <button
                  type="button"
                  className="cc-pl-btn ghost"
                  onClick={() => setResetTarget(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-pl-btn" disabled={saving}>
                  {saving ? "Resetting…" : "Reset password"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}

      {/* Edit Company Modal */}
      {editModalOpen ? (
        <div className="cc-pl-backdrop" onClick={() => !savingEdit && setEditModalOpen(false)}>
          <div className="cc-pl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-pl-modal-head">
              <h3>Edit Company - {company.name}</h3>
              <button type="button" onClick={() => setEditModalOpen(false)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submitEditCompany}>
              <div className="cc-pl-modal-body">
                <label className="cc-pl-field">
                  <span>Company name</span>
                  <input
                    value={editCompanyForm.name}
                    onChange={(e) => setEditCompanyForm((p) => ({ ...p, name: e.target.value }))}
                    required
                  />
                </label>

                {/* Company Logo Upload / Edit Field */}
                <div className="cc-pl-field">
                  <span>Company Logo</span>
                  {editCompanyForm.logoPreview ? (
                    <div className="cc-pl-logo-preview-box">
                      <img
                        src={editCompanyForm.logoPreview}
                        alt="Logo preview"
                        className="cc-pl-logo-img-preview"
                      />
                      <div className="cc-pl-logo-preview-info">
                        <strong>{editCompanyForm.logoFile?.name || "Current Logo"}</strong>
                        <span>{editCompanyForm.logoFile ? `${(editCompanyForm.logoFile.size / 1024).toFixed(1)} KB` : "Uploaded"}</span>
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
                        <strong>Click to upload or replace company logo</strong>
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
                      value={editCompanyForm.email}
                      onChange={(e) => setEditCompanyForm((p) => ({ ...p, email: e.target.value }))}
                    />
                  </label>
                  <label className="cc-pl-field">
                    <span>Phone</span>
                    <input
                      value={editCompanyForm.phone}
                      onChange={(e) => setEditCompanyForm((p) => ({ ...p, phone: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Plan</span>
                    <select
                      value={editCompanyForm.planId}
                      onChange={(event) => {
                        const pid = event.target.value;
                        const pObj = plans.find((p) => String(p.id) === String(pid));
                        setEditCompanyForm((prev) => ({
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
                      value={editCompanyForm.maxUsers}
                      onChange={(e) => setEditCompanyForm((p) => ({ ...p, maxUsers: e.target.value }))}
                    />
                  </label>
                </div>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Status</span>
                    <select
                      value={editCompanyForm.status}
                      onChange={(e) => setEditCompanyForm((p) => ({ ...p, status: e.target.value }))}
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
                      value={editCompanyForm.subscriptionExpiresAt}
                      onChange={(e) => setEditCompanyForm((p) => ({ ...p, subscriptionExpiresAt: e.target.value }))}
                    />
                  </label>
                </div>
              </div>

              <div className="cc-pl-modal-foot">
                <button
                  type="button"
                  className="cc-pl-btn ghost"
                  onClick={() => setEditModalOpen(false)}
                  disabled={savingEdit}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-pl-btn" disabled={savingEdit}>
                  {savingEdit ? "Saving changes…" : "Save changes"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PlatformLayout>
  );
}

export default CompanyDetailScreen;
