import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Pencil, Plus, Trash2, X } from "lucide-react";

import API_URL from "../../config";
import PlatformLayout from "../../components/PlatformLayout";

/**
 * The feature flags a plan can carry. These are the keys the backend reads out
 * of plans.features_json when gating a module, so the list is fixed here rather
 * than free-typed — a typo would silently gate nothing.
 */
const FEATURES = [
  { key: "leads", label: "Leads" },
  { key: "calling", label: "Calling" },
  { key: "ops", label: "Operations" },
  { key: "bankerPortal", label: "Banker portal" },
  { key: "gpsAttendance", label: "GPS attendance" },
];

const emptyForm = {
  name: "",
  priceMonthly: "",
  maxEmployees: "",
  featuresJson: { leads: true, calling: true },
};

function PlansScreen() {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/platform/plans`, { params: { limit: 100 } });
      setPlans(res.data?.data || []);
    } catch (error) {
      console.error("Failed to load plans", error);
      toast.error(error.response?.data?.message || "Could not load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const openCreate = () => {
    setForm(emptyForm);
    setEditing("new");
  };

  const openEdit = (plan) => {
    setForm({
      name: plan.name,
      priceMonthly: String(plan.priceMonthly ?? ""),
      maxEmployees: String(plan.maxEmployees ?? ""),
      featuresJson: plan.featuresJson || {},
    });
    setEditing(plan);
  };

  const toggleFeature = (key) =>
    setForm((prev) => ({
      ...prev,
      featuresJson: { ...prev.featuresJson, [key]: !prev.featuresJson?.[key] },
    }));

  const submit = async (event) => {
    event.preventDefault();
    const payload = {
      name: form.name,
      priceMonthly: Number(form.priceMonthly || 0),
      maxEmployees: Number(form.maxEmployees || 1),
      featuresJson: form.featuresJson,
    };

    try {
      setSaving(true);
      if (editing === "new") {
        await axios.post(`${API_URL}/platform/plans`, payload);
        toast.success("Plan created");
      } else {
        const res = await axios.put(`${API_URL}/platform/plans/${editing.id}`, payload);
        // Lowering the seat ceiling can leave companies above it; the API says so.
        if (res.data?.warning) toast.warn(res.data.warning);
        else toast.success("Plan updated");
      }
      setEditing(null);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not save the plan");
    } finally {
      setSaving(false);
    }
  };

  const remove = async (plan) => {
    if (!window.confirm(`Delete the ${plan.name} plan?`)) return;
    try {
      const res = await axios.delete(`${API_URL}/platform/plans/${plan.id}`);
      toast.success(res.data.message);
      load();
    } catch (error) {
      toast.error(error.response?.data?.message || "Could not delete the plan");
    }
  };

  return (
    <PlatformLayout
      title="Plans"
      subtitle="What you sell: price, seat ceiling and the modules each plan unlocks."
      actions={
        <button type="button" className="cc-pl-btn" onClick={openCreate}>
          <Plus size={16} />
          New plan
        </button>
      }
    >
      <section className="cc-pl-card">
        <div className="cc-pl-table-wrap">
          <table className="cc-pl-table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Price</th>
                <th>Seats</th>
                <th>Features</th>
                <th>Companies</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6} className="cc-pl-empty">
                    Loading plans…
                  </td>
                </tr>
              ) : !plans.length ? (
                <tr>
                  <td colSpan={6} className="cc-pl-empty">
                    No plans yet — create one before provisioning a company
                  </td>
                </tr>
              ) : (
                plans.map((plan) => (
                  <tr key={plan.id}>
                    <td className="cc-pl-strong">{plan.name}</td>
                    <td>₹{Number(plan.priceMonthly).toLocaleString("en-IN")}/mo</td>
                    <td>{plan.maxEmployees}</td>
                    <td>
                      {FEATURES.filter((f) => plan.featuresJson?.[f.key]).map((f) => (
                        <span key={f.key} className="cc-pl-pill active" style={{ marginRight: 6 }}>
                          {f.label}
                        </span>
                      ))}
                      {!FEATURES.some((f) => plan.featuresJson?.[f.key]) ? (
                        <span className="cc-pl-sub">none</span>
                      ) : null}
                    </td>
                    <td>{plan.companyCount}</td>
                    <td className="cc-pl-row-actions">
                      <button
                        type="button"
                        className="cc-pl-btn ghost sm"
                        onClick={() => openEdit(plan)}
                      >
                        <Pencil size={14} />
                        Edit
                      </button>
                      <button
                        type="button"
                        className="cc-pl-btn ghost sm"
                        onClick={() => remove(plan)}
                      >
                        <Trash2 size={14} />
                        Delete
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>

      <p className="cc-pl-hint" style={{ marginTop: 12 }}>
        A plan with companies on it cannot be deleted — move them to another plan first.
      </p>

      {editing ? (
        <div className="cc-pl-backdrop" onClick={() => !saving && setEditing(null)}>
          <div className="cc-pl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-pl-modal-head">
              <h3>{editing === "new" ? "New plan" : `Edit ${editing.name}`}</h3>
              <button type="button" onClick={() => setEditing(null)} aria-label="Close">
                <X size={18} />
              </button>
            </div>
            <form onSubmit={submit}>
              <div className="cc-pl-modal-body">
                <label className="cc-pl-field">
                  <span>Plan name</span>
                  <input
                    value={form.name}
                    onChange={(event) => setForm((p) => ({ ...p, name: event.target.value }))}
                    required
                  />
                </label>

                <div className="cc-pl-grid2">
                  <label className="cc-pl-field">
                    <span>Price per month (₹)</span>
                    <input
                      type="number"
                      min={0}
                      value={form.priceMonthly}
                      onChange={(event) =>
                        setForm((p) => ({ ...p, priceMonthly: event.target.value }))
                      }
                      required
                    />
                  </label>
                  <label className="cc-pl-field">
                    <span>Seat ceiling</span>
                    <input
                      type="number"
                      min={1}
                      value={form.maxEmployees}
                      onChange={(event) =>
                        setForm((p) => ({ ...p, maxEmployees: event.target.value }))
                      }
                      required
                    />
                  </label>
                </div>

                <div className="cc-pl-field">
                  <span>Modules included</span>
                  <div className="cc-pl-checks">
                    {FEATURES.map((feature) => (
                      <label
                        key={feature.key}
                        className={`cc-pl-check ${form.featuresJson?.[feature.key] ? "on" : ""}`}
                      >
                        <input
                          type="checkbox"
                          checked={Boolean(form.featuresJson?.[feature.key])}
                          onChange={() => toggleFeature(feature.key)}
                        />
                        {feature.label}
                      </label>
                    ))}
                  </div>
                </div>

              </div>

              <div className="cc-pl-modal-foot">
                <button
                  type="button"
                  className="cc-pl-btn ghost"
                  onClick={() => setEditing(null)}
                  disabled={saving}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-pl-btn" disabled={saving}>
                  {saving ? "Saving…" : "Save plan"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </PlatformLayout>
  );
}

export default PlansScreen;
