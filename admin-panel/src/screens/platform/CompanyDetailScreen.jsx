import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { useNavigate, useParams } from "react-router-dom";
import { toast } from "react-toastify";
import { ArrowLeft, KeyRound, Plus, X } from "lucide-react";

import API_URL from "../../config";
import PlatformLayout from "../../components/PlatformLayout";
import SeatMeter from "./SeatMeter";

function CompanyDetailScreen() {
  const { id } = useParams();
  const navigate = useNavigate();

  const [company, setCompany] = useState(null);
  const [usage, setUsage] = useState(null);
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [form, setForm] = useState({ planId: "", maxUsers: "", subscriptionExpiresAt: "" });
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
    </PlatformLayout>
  );
}

export default CompanyDetailScreen;
