import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import moment from "moment";
import { useNavigate } from "react-router-dom";
import { toast } from "react-toastify";

import API_URL from "../../config";
import PlatformLayout from "../../components/PlatformLayout";

const inr = new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 });

/**
 * What the operator needs on opening the console: how many companies are paying,
 * what that is worth per month, and which subscriptions need chasing. The two
 * renewal lists are the point of the screen — everything else is context.
 */
function PlatformOverview() {
  const navigate = useNavigate();
  const [metrics, setMetrics] = useState(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/platform/metrics`);
      setMetrics(res.data?.data || null);
    } catch (error) {
      console.error("Failed to load platform metrics", error);
      toast.error(error.response?.data?.message || "Could not load platform metrics");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const companies = metrics?.companies || {};

  const renewalRow = (company, lapsed) => {
    const when = moment(company.subscriptionExpiresAt);
    return (
      <tr
        key={company.id}
        className="clickable"
        onClick={() => navigate(`/platform/companies/${company.id}`)}
      >
        <td className="cc-pl-strong">{company.name}</td>
        <td>{when.format("DD MMM YYYY")}</td>
        <td>
          <span className={`cc-pl-pill ${lapsed ? "suspended" : "warn"}`}>
            {lapsed ? `lapsed ${when.fromNow()}` : `renews ${when.fromNow()}`}
          </span>
        </td>
      </tr>
    );
  };

  return (
    <PlatformLayout
      title="Platform overview"
      subtitle="Every company on the product, what they pay, and which subscriptions need chasing."
    >
      <div className="cc-pl-stats">
        <div className="cc-pl-stat">
          <span>Monthly recurring</span>
          <strong>₹{inr.format(metrics?.monthlyRecurringRevenue || 0)}</strong>
          <em>{metrics?.payingCompanies || 0} paying companies</em>
        </div>
        <div className="cc-pl-stat">
          <span>Companies</span>
          <strong>{companies.total || 0}</strong>
          <em>
            {companies.active || 0} active · {companies.trial || 0} trial ·{" "}
            {companies.suspended || 0} suspended
          </em>
        </div>
        <div className="cc-pl-stat">
          <span>Users</span>
          <strong>{inr.format(metrics?.totalUsers || 0)}</strong>
          <em>active seats in use</em>
        </div>
        <div className="cc-pl-stat">
          <span>Leads</span>
          <strong>{inr.format(metrics?.totalLeads || 0)}</strong>
          <em>across all companies</em>
        </div>
      </div>

      <div className="cc-pl-cols">
        <section className="cc-pl-card">
          <div className="cc-pl-card-head">
            <h2>Expiring in the next 30 days</h2>
            <button type="button" className="cc-pl-btn ghost sm" onClick={load}>
              Refresh
            </button>
          </div>
          <div className="cc-pl-table-wrap">
            <table className="cc-pl-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Expires</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="cc-pl-empty">
                      Loading…
                    </td>
                  </tr>
                ) : !metrics?.expiringSoon?.length ? (
                  <tr>
                    <td colSpan={3} className="cc-pl-empty">
                      Nothing due for renewal in the next 30 days
                    </td>
                  </tr>
                ) : (
                  metrics.expiringSoon.map((c) => renewalRow(c, false))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="cc-pl-card">
          <div className="cc-pl-card-head">
            <h2>Already lapsed</h2>
          </div>
          <div className="cc-pl-table-wrap">
            <table className="cc-pl-table">
              <thead>
                <tr>
                  <th>Company</th>
                  <th>Expired</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={3} className="cc-pl-empty">
                      Loading…
                    </td>
                  </tr>
                ) : !metrics?.expired?.length ? (
                  <tr>
                    <td colSpan={3} className="cc-pl-empty">
                      No lapsed subscriptions
                    </td>
                  </tr>
                ) : (
                  metrics.expired.map((c) => renewalRow(c, true))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {!loading && metrics?.expired?.length ? (
        <p className="cc-pl-hint" style={{ marginTop: 12 }}>
          A lapsed subscription already blocks the company's admin panel and mobile app. Extend the
          renewal date from the company page to restore access.
        </p>
      ) : null}
    </PlatformLayout>
  );
}

export default PlatformOverview;
