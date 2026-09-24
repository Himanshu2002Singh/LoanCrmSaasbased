import React, { useCallback, useEffect, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  CheckCircle2,
  Clock,
  ExternalLink,
  Filter,
  HelpCircle,
  MessageSquare,
  RefreshCw,
  Search,
  Send,
  User,
  X,
} from "lucide-react";
import API_URL from "../../config";
import CcPagination from "../../components/CcPagination";

const PAGE_SIZE = 20;

export default function BankerQueriesScreen() {
  const [queries, setQueries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState("ALL");
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);

  // Response / Resolution Modal for Ops or Admin
  const [resolveTarget, setResolveTarget] = useState(null);
  const [responseText, setResponseText] = useState("");
  const [resolving, setResolving] = useState(false);

  const employeeRole = localStorage.getItem("employeeRole");
  const isBanker = employeeRole === "banker";

  const fetchQueries = useCallback(async (page = 1) => {
    setLoading(true);
    try {
      const params = {
        page,
        limit: PAGE_SIZE,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
        search: debouncedSearch || undefined,
      };
      const res = await axios.get(`${API_URL}/applications/queries/all`, { params });
      setQueries(res.data?.queries || []);
      const pagination = res.data?.pagination || {};
      setTotalPages(pagination.totalPages || 1);
      setTotalItems(pagination.totalItems || 0);
    } catch (error) {
      console.error("Error fetching queries:", error);
      toast.error("Could not load clarification queries");
      setQueries([]);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, debouncedSearch]);

  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedSearch(searchTerm);
      setCurrentPage(1);
    }, 350);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    fetchQueries(currentPage);
  }, [fetchQueries, currentPage]);

  const handleResolveSubmit = async (e) => {
    e?.preventDefault();
    if (!responseText.trim()) {
      toast.warning("Please enter a response to resolve this query");
      return;
    }
    setResolving(true);
    try {
      await axios.patch(
        `${API_URL}/applications/${resolveTarget.applicationId}/queries/${resolveTarget.id}/resolve`,
        { responseText: responseText.trim() }
      );
      toast.success("Query resolved and answer sent to Banker!");
      setResolveTarget(null);
      setResponseText("");
      fetchQueries(currentPage);
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to resolve query");
    } finally {
      setResolving(false);
    }
  };

  return (
    <div className="cc-report-redesign cc-queries-screen">
      <ToastContainer position="bottom-right" />
      <style>{queryStyles}</style>

      {/* Top Filter Bar */}
      <section className="cc-report-panel cc-query-topbar">
        <label className="cc-query-search">
          <Search size={18} />
          <input
            type="search"
            placeholder="Search queries by text, customer, or application..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="cc-query-search-clear"
              onClick={() => setSearchTerm("")}
            >
              <X size={14} />
            </button>
          )}
        </label>

        <div className="cc-query-tabs">
          {[
            { key: "ALL", label: "All Queries" },
            { key: "OPEN", label: "Open Queries" },
            { key: "RESOLVED", label: "Resolved" },
          ].map((tab) => (
            <button
              key={tab.key}
              type="button"
              className={statusFilter === tab.key ? "active" : ""}
              onClick={() => {
                setStatusFilter(tab.key);
                setCurrentPage(1);
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <button
          type="button"
          className="cc-query-refresh"
          onClick={() => fetchQueries(currentPage)}
          title="Refresh"
        >
          <RefreshCw size={16} />
        </button>
      </section>

      {/* Queries List */}
      <section className="cc-report-panel">
        <div className="cc-report-table-head">
          <h2>
            Banker Clarification Queries <span className="cc-query-count">({totalItems})</span>
          </h2>
          <p className="cc-query-sub">
            {isBanker
              ? "Clarification queries you have raised on customer documents & application details."
              : "Clarification queries raised by Bank / NBFC underwriting officers requiring Operations answers."}
          </p>
        </div>

        <div className="cc-queries-grid">
          {loading ? (
            <p className="cc-report-empty">Loading clarification queries...</p>
          ) : queries.length === 0 ? (
            <p className="cc-report-empty">No clarification queries found.</p>
          ) : (
            queries.map((q) => (
              <div
                key={q.id}
                className={`cc-query-card ${q.status === "RESOLVED" ? "resolved" : "open"}`}
              >
                <div className="cc-query-card-header">
                  <div className="cc-query-card-meta">
                    <span className={`cc-query-badge ${q.status === "RESOLVED" ? "resolved" : "open"}`}>
                      {q.status === "RESOLVED" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                      {q.status}
                    </span>
                    <strong className="cc-query-app-id">
                      {q.application?.applicationNumber || `App #${q.applicationId}`}
                    </strong>
                    <span className="cc-query-cust-name">
                      • {q.application?.customer?.name || "Customer"}
                    </span>
                  </div>
                  <span className="cc-query-time">
                    {new Date(q.createdAt).toLocaleString("en-IN", {
                      dateStyle: "medium",
                      timeStyle: "short",
                    })}
                  </span>
                </div>

                <div className="cc-query-card-body">
                  <div className="cc-query-question">
                    <HelpCircle size={18} className="cc-query-q-icon" />
                    <div>
                      <label>Banker Query ({q.banker?.name || "Banker"}):</label>
                      <p>{q.queryText}</p>
                    </div>
                  </div>

                  {q.responseText ? (
                    <div className="cc-query-answer">
                      <CheckCircle2 size={18} className="cc-query-a-icon" />
                      <div>
                        <label>Operations Resolution ({q.resolvedByOps?.name || "Operations"}):</label>
                        <p>{q.responseText}</p>
                      </div>
                    </div>
                  ) : (
                    <div className="cc-query-awaiting">
                      <Clock size={14} />
                      <span>Pending resolution from Operations team</span>
                      {!isBanker && (
                        <button
                          type="button"
                          className="cc-query-resolve-action"
                          onClick={() => {
                            setResolveTarget(q);
                            setResponseText("");
                          }}
                        >
                          Answer &amp; Resolve Query
                        </button>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
        </div>

        <CcPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalItems}
          onPageChange={setCurrentPage}
          itemLabel="queries"
        />
      </section>

      {/* Answer / Resolution Modal */}
      {resolveTarget && (
        <div className="cc-modal-overlay" onClick={() => setResolveTarget(null)}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div>
                <p>Operations Clarification</p>
                <h3>Reply &amp; Resolve Banker Query</h3>
              </div>
              <button type="button" onClick={() => setResolveTarget(null)}>
                <X size={16} />
              </button>
            </div>

            <form className="cc-modal-form" onSubmit={handleResolveSubmit}>
              <div
                style={{
                  background: "#fff1f2",
                  border: "1px solid #fecdd3",
                  borderRadius: 10,
                  padding: "10px 14px",
                  fontSize: 13,
                  color: "#9f1239",
                }}
              >
                <strong>Banker Query:</strong> {resolveTarget.queryText}
              </div>

              <label className="cc-modal-field">
                <span>Operations Response / Clarification Details *</span>
                <textarea
                  rows={4}
                  placeholder="e.g. Customer has submitted the 3 months salary slips. We have verified and uploaded them under documents."
                  value={responseText}
                  onChange={(e) => setResponseText(e.target.value)}
                  autoFocus
                  required
                />
              </label>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-modal-btn ghost"
                  onClick={() => setResolveTarget(null)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-modal-btn primary"
                  disabled={resolving}
                >
                  <Send size={15} /> {resolving ? "Resolving..." : "Submit Answer"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const queryStyles = `
  .cc-query-topbar {
    display: flex;
    align-items: center;
    gap: 12px;
    flex-wrap: wrap;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .cc-query-search {
    position: relative;
    flex: 1 1 260px;
    min-width: 220px;
    display: flex;
    align-items: center;
    height: 40px;
    padding: 0 12px 0 38px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    background: #fff;
  }
  .cc-query-search svg {
    position: absolute;
    left: 12px;
    color: #94a3b8;
  }
  .cc-query-search input {
    width: 100%;
    border: 0;
    outline: none;
    font-size: 13px;
    color: #0f172a;
  }
  .cc-query-search-clear {
    border: 0;
    background: #f1f5f9;
    border-radius: 50%;
    width: 20px;
    height: 20px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .cc-query-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 10px;
    gap: 2px;
  }
  .cc-query-tabs button {
    border: 0;
    background: transparent;
    padding: 7px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
  }
  .cc-query-tabs button.active {
    background: #fff;
    color: #047857;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
  .cc-query-refresh {
    border: 1px solid #cbd5e1;
    background: #fff;
    width: 38px;
    height: 38px;
    border-radius: 10px;
    display: grid;
    place-items: center;
    color: #475569;
    cursor: pointer;
  }
  .cc-query-refresh:hover {
    color: #047857;
    border-color: #047857;
  }

  .cc-query-count { font-size: 13px; color: #64748b; font-weight: 600; }
  .cc-query-sub { font-size: 12.5px; color: #64748b; margin: 2px 0 0; }

  .cc-queries-grid {
    display: flex;
    flex-direction: column;
    gap: 12px;
    margin-top: 14px;
  }
  .cc-query-card {
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 16px;
    background: #fff;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cc-query-card.open { border-left: 4px solid #f43f5e; }
  .cc-query-card.resolved { border-left: 4px solid #10b981; }

  .cc-query-card-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
    border-bottom: 1px solid #f1f5f9;
    padding-bottom: 10px;
  }
  .cc-query-card-meta {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cc-query-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
  }
  .cc-query-badge.open { background: #fff1f2; color: #be123c; }
  .cc-query-badge.resolved { background: #dcfce7; color: #166534; }
  .cc-query-app-id { font-size: 13.5px; color: #0f172a; }
  .cc-query-cust-name { font-size: 13px; color: #64748b; }
  .cc-query-time { font-size: 11.5px; color: #94a3b8; }

  .cc-query-card-body {
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cc-query-question {
    display: flex;
    gap: 10px;
    align-items: flex-start;
  }
  .cc-query-q-icon { color: #e11d48; margin-top: 2px; flex-shrink: 0; }
  .cc-query-question label { display: block; font-size: 11.5px; font-weight: 700; color: #e11d48; text-transform: uppercase; }
  .cc-query-question p { margin: 2px 0 0; font-size: 13.5px; color: #0f172a; line-height: 1.4; }

  .cc-query-answer {
    display: flex;
    gap: 10px;
    align-items: flex-start;
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    border-radius: 10px;
    padding: 10px 14px;
  }
  .cc-query-a-icon { color: #16a34a; margin-top: 2px; flex-shrink: 0; }
  .cc-query-answer label { display: block; font-size: 11.5px; font-weight: 700; color: #166534; text-transform: uppercase; }
  .cc-query-answer p { margin: 2px 0 0; font-size: 13px; color: #065f46; line-height: 1.4; }

  .cc-query-awaiting {
    display: flex;
    align-items: center;
    justify-content: space-between;
    gap: 10px;
    background: #fff1f2;
    border: 1px dashed #fecdd3;
    border-radius: 8px;
    padding: 8px 14px;
    font-size: 12.5px;
    color: #be123c;
    flex-wrap: wrap;
  }
  .cc-query-resolve-action {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 6px 14px;
    border-radius: 8px;
    background: #047857;
    color: #fff;
    border: 0;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .cc-query-resolve-action:hover { background: #065f46; }
`;
