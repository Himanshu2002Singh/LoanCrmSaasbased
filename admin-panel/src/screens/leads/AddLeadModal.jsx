import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  FileSpreadsheet,
  Percent,
  Phone,
  Share2,
  Upload,
  User,
  X,
  Download,
  Info,
  ChevronDown,
  ChevronUp,
  CheckCircle2,
  AlertCircle,
  Coins,
} from "lucide-react";
import * as XLSX from "xlsx";
import API_URL from "../../config";

const MODES = [
  { key: "manual", label: "Manual", icon: User },
  { key: "excel", label: "Excel upload", icon: FileSpreadsheet },
];

export default function AddLeadModal({ open, onClose, onCreated }) {
  const [mode, setMode] = useState("manual");
  const [name, setName] = useState("");
  const [contact, setContact] = useState("");
  const [source, setSource] = useState("Self");
  const [loanType, setLoanType] = useState("");
  const [commissionPercent, setCommissionPercent] = useState("");
  const [initialRemark, setInitialRemark] = useState("");
  const [excelDefaultSource, setExcelDefaultSource] = useState("Self");
  const [excelDefaultCommission, setExcelDefaultCommission] = useState("");
  const [sourcesList, setSourcesList] = useState([]);
  const [loanProductsList, setLoanProductsList] = useState([]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const [showFormatGuide, setShowFormatGuide] = useState(false);
  const [duplicateAlert, setDuplicateAlert] = useState(null);
  const [checkingDuplicate, setCheckingDuplicate] = useState(false);
  const fileInputRef = useRef(null);

  const userRole = localStorage.getItem("userRole") || "";
  const employeeRole = localStorage.getItem("employeeRole") || "";
  const isEmployee =
    userRole.toUpperCase() === "EMPLOYEE" ||
    ["calling", "employee"].includes(employeeRole?.toLowerCase());

  const userPermissions = (() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  })();

  const canViewCommission = !isEmployee && Boolean(userPermissions.viewPayouts || userPermissions.viewConnectors || userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN");
  const canUploadExcel = !isEmployee && userPermissions.exportData !== false;

  useEffect(() => {
    if (!open) return;
    const fetchConfigs = async () => {
      try {
        const [sourceRes, loanProdRes] = await Promise.all([
          axios.get(`${API_URL}/master-configs/LEAD_SOURCE`, { params: { includeInactive: false } }),
          axios.get(`${API_URL}/master-configs/LOAN_PRODUCT`, { params: { includeInactive: false } }).catch(() => ({ data: { data: [] } })),
        ]);
        const items = sourceRes.data?.data || [];
        setSourcesList(items);
        setLoanProductsList(loanProdRes.data?.data || []);
        // Ensure "Self" exists in choices even if not returned
        const hasSelf = items.some(
          (s) => String(s.value || "").toLowerCase() === "self" || String(s.label || "").toLowerCase() === "self"
        );
        if (!hasSelf) {
          setSourcesList((prev) => [{ id: "self-default", label: "Self", value: "Self" }, ...prev]);
        }
      } catch (err) {
        console.error("Could not fetch master configs", err);
        setSourcesList([{ id: "self-default", label: "Self", value: "Self" }]);
      }
    };
    fetchConfigs();
  }, [open]);

  // Live duplicate phone check on 10 digits
  useEffect(() => {
    if (!open) return;
    const cleanNumber = (contact || "").replace(/\D/g, "").slice(-10);
    if (cleanNumber.length < 10) {
      setDuplicateAlert(null);
      setCheckingDuplicate(false);
      return;
    }

    let active = true;
    setCheckingDuplicate(true);
    const timer = setTimeout(async () => {
      try {
        const token = localStorage.getItem("token");
        const res = await axios.get(`${API_URL}/leads/check-duplicate`, {
          params: { number: cleanNumber },
          headers: token ? { Authorization: `Bearer ${token}` } : {},
        });
        if (active) {
          if (res.data?.isDuplicate) {
            setDuplicateAlert(res.data);
          } else {
            setDuplicateAlert(null);
          }
        }
      } catch (err) {
        console.error("Duplicate check error:", err);
      } finally {
        if (active) setCheckingDuplicate(false);
      }
    }, 300);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [contact, open]);

  if (!open) return null;

  const handleSourceChange = (val) => {
    setSource(val);
    const matched = sourcesList.find(
      (s) => (s.label || s.value) === val || s.value === val
    );
    if (matched && (matched.commissionPercent !== undefined && matched.commissionPercent !== null)) {
      setCommissionPercent(String(matched.commissionPercent));
    }
  };

  const handleExcelSourceChange = (val) => {
    setExcelDefaultSource(val);
    const matched = sourcesList.find(
      (s) => (s.label || s.value) === val || s.value === val
    );
    if (matched && (matched.commissionPercent !== undefined && matched.commissionPercent !== null)) {
      setExcelDefaultCommission(String(matched.commissionPercent));
    }
  };

  const reset = () => {
    setName("");
    setContact("");
    setSource("Self");
    setLoanType("");
    setCommissionPercent("");
    setInitialRemark("");
    setExcelDefaultSource("Self");
    setExcelDefaultCommission("");
    setFile(null);
    setMode("manual");
    setDuplicateAlert(null);
    setCheckingDuplicate(false);
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const closeAll = () => {
    reset();
    onClose?.();
  };

  const handleManual = async (event) => {
    event.preventDefault();
    if (!contact.trim() || !name.trim()) {
      toast.error("Name and contact number are required");
      return;
    }

    if (duplicateAlert) {
      toast.error("Bhai number same hai! Repeated number par lead add nahi ho sakti.");
      return;
    }

    setSubmitting(true);
    try {
      const token = localStorage.getItem("token");
      const res = await fetch(`${API_URL}/leads`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          name: name.trim(),
          number: contact.trim(),
          source: (source || "").trim() || "Self",
          loan_type: (loanType || "").trim() || undefined,
          remark: initialRemark.trim() || undefined,
          commission_percent:
            commissionPercent !== "" && !isNaN(parseFloat(commissionPercent))
              ? parseFloat(commissionPercent)
              : null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
        if (res.status === 409 || errData.isDuplicate) {
          setDuplicateAlert(errData);
          toast.error(errData.message || "Bhai number same hai! Repeated number par lead add nahi hogi.");
          return;
        }
        throw new Error(errData.message || "Failed to add lead");
      }
      await res.json();
      toast.success("Lead added successfully");
      onCreated?.();
      closeAll();
    } catch (error) {
      toast.error(error.message || "Failed to add lead");
    } finally {
      setSubmitting(false);
    }
  };

  const handleExcel = async () => {
    if (!file) {
      toast.error("Select an Excel file first");
      return;
    }
    setSubmitting(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("defaultSource", (excelDefaultSource || "").trim() || "Self");
      if (excelDefaultCommission !== "" && !isNaN(parseFloat(excelDefaultCommission))) {
        form.append("defaultCommission", parseFloat(excelDefaultCommission));
      }

      const token = localStorage.getItem("token");
      const res = await axios.post(`${API_URL}/leads/import`, form, {
        headers: {
          "Content-Type": "multipart/form-data",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
      });
      toast.success(res.data?.message || "Leads uploaded");
      onCreated?.();
      closeAll();
    } catch (error) {
      toast.error(error.response?.data?.message || error.message || "Upload failed");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadSampleExcel = () => {
    try {
      const sampleData = [
        {
          "Name": "Rahul Sharma",
          "Mobile": "9876543210",
          "Source / Party": "Self",
          "Commission %": 1.5,
          "Remarks": "Interested in loan, callback requested after 4 PM",
        },
        {
          "Name": "Priya Patel",
          "Mobile": "9812345678",
          "Source / Party": "DSA Partner",
          "Commission %": 1.0,
          "Remarks": "Looking for lowest interest rate",
        },
        {
          "Name": "Vikram Singh",
          "Mobile": "9765432109",
          "Source / Party": "Direct",
          "Commission %": 0.0,
          "Remarks": "Urgent requirement",
        },
      ];

      const instructionsData = [
        {
          "Column Name": "Name",
          "Required": "YES (Mandatory)",
          "Description": "Full name of the customer or lead",
          "Accepted Formats / Example": "Rahul Sharma, Priya Patel",
        },
        {
          "Column Name": "Mobile",
          "Required": "YES (Mandatory)",
          "Description": "10-digit mobile phone number",
          "Accepted Formats / Example": "9876543210 (digits only or with +91)",
        },
        {
          "Column Name": "Source / Party",
          "Required": "Optional",
          "Description": "Channel or DSA/Party name. If blank, uses modal default setting.",
          "Accepted Formats / Example": "Self, Direct, DSA Partner, ABC Agency",
        },
        {
          "Column Name": "Commission %",
          "Required": "Optional",
          "Description": "Payout commission rate for party. If blank, uses modal default setting.",
          "Accepted Formats / Example": "1.5, 2.0 (numbers only)",
        },
        {
          "Column Name": "Remarks",
          "Required": "Optional",
          "Description": "Initial discussion notes or callback time",
          "Accepted Formats / Example": "Customer requested callback after 4 PM",
        },
      ];

      const workbook = XLSX.utils.book_new();

      const wsSample = XLSX.utils.json_to_sheet(sampleData);
      wsSample["!cols"] = [
        { wch: 22 }, { wch: 16 }, { wch: 20 }, { wch: 16 }, { wch: 45 }
      ];
      XLSX.utils.book_append_sheet(workbook, wsSample, "Sample Leads");

      const wsGuide = XLSX.utils.json_to_sheet(instructionsData);
      wsGuide["!cols"] = [
        { wch: 18 }, { wch: 16 }, { wch: 44 }, { wch: 32 }
      ];
      XLSX.utils.book_append_sheet(workbook, wsGuide, "Format Guide & Rules");

      XLSX.writeFile(workbook, "Sample_Leads_Template.xlsx");
      toast.success("Sample Excel template downloaded successfully!");
    } catch (err) {
      console.error("Failed to generate sample excel:", err);
      const token = localStorage.getItem("token");
      window.open(`${API_URL}/leads/sample-excel?token=${token}`, "_blank");
    }
  };

  return (
    <div className="cc-modal-overlay" onClick={closeAll}>
      <style>{styles}</style>
      <div className="cc-modal-card" onClick={(event) => event.stopPropagation()}>
        <div className="cc-modal-head">
          <div>
            <p>New</p>
            <h3>Add lead</h3>
          </div>
          <button type="button" onClick={closeAll} title="Close">
            <X size={16} />
          </button>
        </div>

        {canUploadExcel && (
          <div className="cc-modal-tabs">
            {MODES.map((entry) => {
              const Icon = entry.icon;
              return (
                <button
                  key={entry.key}
                  type="button"
                  className={`cc-modal-tab ${mode === entry.key ? "on" : ""}`}
                  onClick={() => setMode(entry.key)}
                >
                  <Icon size={14} /> {entry.label}
                </button>
              );
            })}
          </div>
        )}

        {mode === "manual" ? (
          <form className="cc-modal-form" onSubmit={handleManual}>
            <label className="cc-modal-field">
              <span>Name <span style={{ color: "#ef4444" }}>*</span></span>
              <input
                type="text"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="e.g. Rahul Verma"
                required
              />
            </label>
            <label className="cc-modal-field">
              <span style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                <span>
                  <Phone size={12} color={duplicateAlert ? "#dc2626" : undefined} /> Contact number <span style={{ color: "#ef4444" }}>*</span>
                </span>
                {checkingDuplicate && (
                  <span style={{ fontSize: "11px", color: "#64748b", fontWeight: 500 }}>
                    Checking number...
                  </span>
                )}
              </span>
              <input
                type="tel"
                value={contact}
                onChange={(event) => {
                  setContact(event.target.value);
                  if (duplicateAlert) setDuplicateAlert(null);
                }}
                placeholder="10-digit phone number"
                required
                style={{
                  border: duplicateAlert ? "2px solid #ef4444" : undefined,
                  background: duplicateAlert ? "#fef2f2" : undefined,
                  color: duplicateAlert ? "#b91c1c" : undefined,
                  fontWeight: duplicateAlert ? 700 : undefined,
                }}
              />
              {duplicateAlert && (
                <div
                  style={{
                    background: "#fef2f2",
                    border: "1.5px solid #f87171",
                    borderRadius: "8px",
                    padding: "10px 12px",
                    marginTop: "6px",
                    color: "#991b1b",
                    fontSize: "12px",
                    display: "flex",
                    alignItems: "flex-start",
                    gap: "8px",
                    boxShadow: "0 2px 6px rgba(239, 68, 68, 0.15)",
                  }}
                >
                  <AlertCircle size={18} color="#dc2626" style={{ flexShrink: 0, marginTop: "2px" }} />
                  <div>
                    <div style={{ fontWeight: 800, color: "#b91c1c", fontSize: "13px" }}>
                      ⚠️ Bhai number same hai! Repeated Number!
                    </div>
                    <div style={{ marginTop: "2px", color: "#7f1d1d", fontSize: "12px" }}>
                      Yeh phone number pehle se system mein exist karta hai. Same number par duplicate lead add nahi ho sakti (Creation Blocked).
                    </div>
                    {duplicateAlert.customer && (
                      <div
                        style={{
                          marginTop: "6px",
                          background: "#fee2e2",
                          borderRadius: "6px",
                          padding: "6px 8px",
                          fontSize: "11.5px",
                          color: "#991b1b",
                        }}
                      >
                        <strong>Registered Customer:</strong> {duplicateAlert.customer.name} ({duplicateAlert.customer.mobile})
                        {duplicateAlert.lead && (
                          <>
                            <br />
                            <strong>Existing Lead:</strong> Lead #{duplicateAlert.lead.id} &bull; Status:{" "}
                            <strong>{duplicateAlert.lead.status}</strong> &bull; Product:{" "}
                            {duplicateAlert.lead.loanType} &bull; Assigned:{" "}
                            {duplicateAlert.lead.assignedTo || "Unassigned"}
                          </>
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )}
            </label>

            <div style={{ display: "grid", gridTemplateColumns: canViewCommission ? "1.3fr 1fr" : "1fr", gap: "10px" }}>
              <label className="cc-modal-field">
                <span>
                  <Share2 size={12} /> Source / Party <span style={{ fontWeight: 400, color: "#94a3b8" }}>(Optional)</span>
                </span>
                <select
                  value={source}
                  onChange={(event) => handleSourceChange(event.target.value)}
                >
                  <option value="Self">Self (Default)</option>
                  {sourcesList
                    .filter((s) => String(s.value || "").toLowerCase() !== "self")
                    .map((s) => (
                      <option key={s.id || s.value} value={s.label || s.value}>
                        {s.label || s.value} {canViewCommission && s.commissionPercent ? `(${s.commissionPercent}%)` : ""}
                      </option>
                    ))}
                </select>
              </label>

              {canViewCommission && (
                <label className="cc-modal-field">
                  <span>
                    <Percent size={12} /> Commission (%) <span style={{ fontWeight: 400, color: "#94a3b8" }}>(Optional)</span>
                  </span>
                  <div style={{ position: "relative" }}>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={commissionPercent}
                      onChange={(event) => setCommissionPercent(event.target.value)}
                      placeholder="e.g. 1.5"
                      style={{ paddingRight: "26px", width: "100%", boxSizing: "border-box" }}
                    />
                    <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontWeight: 700, fontSize: "12px", pointerEvents: "none" }}>%</span>
                  </div>
                </label>
              )}

              <label className="cc-modal-field" style={{ gridColumn: "1 / -1" }}>
                <span>
                  <Coins size={12} /> Loan Product / Type <span style={{ fontWeight: 400, color: "#94a3b8" }}>(Optional)</span>
                </span>
                <select
                  value={loanType}
                  onChange={(event) => setLoanType(event.target.value)}
                >
                  <option value="">Select Loan Product (Optional)</option>
                  {loanProductsList.map((lp) => (
                    <option key={lp.id || lp.value} value={lp.label || lp.value}>
                      {lp.label || lp.value}
                    </option>
                  ))}
                </select>
              </label>

              <label className="cc-modal-field" style={{ gridColumn: "1 / -1" }}>
                <span>Initial Remark <span style={{ fontWeight: 400, color: "#94a3b8" }}>(Optional)</span></span>
                <input
                  type="text"
                  value={initialRemark}
                  onChange={(event) => setInitialRemark(event.target.value)}
                  placeholder="e.g. Interested in loan, callback requested after 4 PM"
                  style={{ width: "100%", boxSizing: "border-box" }}
                />
              </label>
            </div>

            <div className="cc-modal-actions">
              <button type="button" className="cc-modal-btn ghost" onClick={closeAll}>
                Cancel
              </button>
              <button
                type="submit"
                className="cc-modal-btn primary"
                disabled={submitting || checkingDuplicate || Boolean(duplicateAlert)}
                style={{
                  ...(duplicateAlert
                    ? {
                        background: "#ef4444",
                        borderColor: "#ef4444",
                        cursor: "not-allowed",
                        opacity: 0.9,
                      }
                    : {}),
                }}
              >
                {duplicateAlert
                  ? "Blocked: Number Same Hai"
                  : submitting
                  ? "Saving..."
                  : "Add lead"}
              </button>
            </div>
          </form>
        ) : (
          <div className="cc-modal-form">
            {/* Sample Excel Template Download & Format Guide Banner */}
            <div
              style={{
                background: "#f0fdf4",
                border: "1.5px solid #86efac",
                borderRadius: "12px",
                padding: "12px 14px",
                display: "flex",
                flexDirection: "column",
                gap: "8px",
              }}
            >
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "10px", flexWrap: "wrap" }}>
                <div style={{ display: "flex", alignItems: "center", gap: "8px" }}>
                  <div style={{
                    width: "32px",
                    height: "32px",
                    borderRadius: "8px",
                    background: "#059669",
                    color: "#fff",
                    display: "grid",
                    placeItems: "center",
                    flexShrink: 0
                  }}>
                    <FileSpreadsheet size={18} />
                  </div>
                  <div>
                    <strong style={{ fontSize: "13px", color: "#065f46", display: "block" }}>
                      Sample Excel Template
                    </strong>
                    <span style={{ fontSize: "11px", color: "#166534" }}>
                      Download ready-to-use template with sample leads &amp; rules
                    </span>
                  </div>
                </div>

                <button
                  type="button"
                  onClick={downloadSampleExcel}
                  style={{
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "6px",
                    padding: "7px 12px",
                    background: "#047857",
                    color: "#fff",
                    border: "none",
                    borderRadius: "8px",
                    fontSize: "12px",
                    fontWeight: 700,
                    cursor: "pointer",
                    boxShadow: "0 2px 4px rgba(4, 120, 87, 0.25)"
                  }}
                  title="Download Sample Excel Template"
                >
                  <Download size={14} /> Download Sample
                </button>
              </div>

              {/* Collapsible Format Guide */}
              <div style={{ borderTop: "1px dashed #a7f3d0", paddingTop: "8px", marginTop: "2px" }}>
                <button
                  type="button"
                  onClick={() => setShowFormatGuide(!showFormatGuide)}
                  style={{
                    background: "none",
                    border: "none",
                    color: "#047857",
                    fontSize: "11.5px",
                    fontWeight: 600,
                    cursor: "pointer",
                    padding: 0,
                    display: "inline-flex",
                    alignItems: "center",
                    gap: "4px"
                  }}
                >
                  <Info size={13} />
                  {showFormatGuide ? "Hide Column Guidelines" : "View Column Guidelines & Required Format"}
                  {showFormatGuide ? <ChevronUp size={13} /> : <ChevronDown size={13} />}
                </button>

                {showFormatGuide && (
                  <div style={{
                    marginTop: "8px",
                    background: "#fff",
                    border: "1px solid #bbf7d0",
                    borderRadius: "8px",
                    padding: "8px 10px",
                    fontSize: "11px",
                    color: "#334155",
                    maxHeight: "170px",
                    overflowY: "auto"
                  }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", textAlign: "left" }}>
                      <thead>
                        <tr style={{ borderBottom: "1px solid #e2e8f0", color: "#065f46" }}>
                          <th style={{ padding: "4px 6px" }}>Column</th>
                          <th style={{ padding: "4px 6px" }}>Status</th>
                          <th style={{ padding: "4px 6px" }}>Sample Value</th>
                        </tr>
                      </thead>
                      <tbody>
                        <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "4px 6px", fontWeight: 700 }}>Name</td>
                          <td style={{ padding: "4px 6px", color: "#dc2626", fontWeight: 700 }}>Required</td>
                          <td style={{ padding: "4px 6px" }}>Rahul Sharma</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "4px 6px", fontWeight: 700 }}>Mobile</td>
                          <td style={{ padding: "4px 6px", color: "#dc2626", fontWeight: 700 }}>Required (10 digits)</td>
                          <td style={{ padding: "4px 6px" }}>9876543210</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "4px 6px", fontWeight: 600 }}>Source / Party</td>
                          <td style={{ padding: "4px 6px", color: "#64748b" }}>Optional (default: Self)</td>
                          <td style={{ padding: "4px 6px" }}>Direct / DSA Partner</td>
                        </tr>
                        <tr style={{ borderBottom: "1px solid #f1f5f9" }}>
                          <td style={{ padding: "4px 6px", fontWeight: 600 }}>Commission %</td>
                          <td style={{ padding: "4px 6px", color: "#64748b" }}>Optional</td>
                          <td style={{ padding: "4px 6px" }}>1.5</td>
                        </tr>
                        <tr>
                          <td style={{ padding: "4px 6px", fontWeight: 600 }}>Remarks</td>
                          <td style={{ padding: "4px 6px", color: "#64748b" }}>Optional</td>
                          <td style={{ padding: "4px 6px" }}>Interested in loan, callback after 4 PM</td>
                        </tr>
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>

            {/* File Drop Area */}
            <div
              className={`cc-modal-drop ${file ? "has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
            >
              {file ? (
                <CheckCircle2 size={24} style={{ color: "#047857" }} />
              ) : (
                <Upload size={22} />
              )}
              <p>
                <strong>{file ? file.name : "Click to select your filled Excel file"}</strong>
              </p>
              <small>
                {file ? `${(file.size / 1024).toFixed(1)} KB • Click to change file` : "Supports .xlsx and .xls formats"}
              </small>
              <input
                ref={fileInputRef}
                type="file"
                accept=".xlsx,.xls"
                style={{ display: "none" }}
                onChange={(event) => setFile(event.target.files?.[0] || null)}
              />
            </div>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "10px" }}>
              <label className="cc-modal-field">
                <span>
                  <Share2 size={12} /> Default Source / Party
                </span>
                <select
                  value={excelDefaultSource}
                  onChange={(event) => handleExcelSourceChange(event.target.value)}
                >
                  <option value="Self">Self (Default)</option>
                  {sourcesList
                    .filter((s) => String(s.value || "").toLowerCase() !== "self")
                    .map((s) => (
                      <option key={s.id || s.value} value={s.label || s.value}>
                        {s.label || s.value} {s.commissionPercent ? `(${s.commissionPercent}%)` : ""}
                      </option>
                    ))}
                </select>
              </label>

              <label className="cc-modal-field">
                <span>
                  <Percent size={12} /> Default Commission (%)
                </span>
                <div style={{ position: "relative" }}>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="100"
                    value={excelDefaultCommission}
                    onChange={(event) => setExcelDefaultCommission(event.target.value)}
                    placeholder="e.g. 1.5"
                    style={{ paddingRight: "26px", width: "100%", boxSizing: "border-box" }}
                  />
                  <span style={{ position: "absolute", right: "10px", top: "50%", transform: "translateY(-50%)", color: "#94a3b8", fontWeight: 700, fontSize: "12px", pointerEvents: "none" }}>%</span>
                </div>
              </label>
            </div>
            <small style={{ fontSize: "11px", color: "#64748b", marginTop: "-4px" }}>
              💡 Excel me Source aur Commission columns optional hain. Agar blank chhodte hain, toh upar diye gaye default values use honge.
            </small>

            <div className="cc-modal-actions">
              <button type="button" className="cc-modal-btn ghost" onClick={closeAll}>
                Cancel
              </button>
              <button
                type="button"
                className="cc-modal-btn primary"
                onClick={handleExcel}
                disabled={submitting || !file}
              >
                {submitting ? "Uploading..." : "Upload leads"}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

const styles = `
  .cc-modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.6); z-index:120; display:grid; place-items:center; padding:16px; }
  .cc-modal-card { width:100%; max-width:520px; background:#fff; border-radius:18px; padding:22px 22px 20px; display:flex; flex-direction:column; gap:14px; box-shadow:0 20px 60px rgba(15,23,42,0.28); }
  .cc-modal-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .cc-modal-head p { margin:0; font-size:11px; letter-spacing:0.08em; text-transform:uppercase; color:#047857; font-weight:700; }
  .cc-modal-head h3 { margin:2px 0 0; font-size:19px; color:#0f172a; font-weight:700; }
  .cc-modal-head button { border:0; background:#f1f5f9; color:#475569; width:32px; height:32px; border-radius:9px; cursor:pointer; display:grid; place-items:center; }
  .cc-modal-head button:hover { background:#e2e8f0; color:#0f172a; }

  .cc-modal-tabs { display:inline-flex; padding:4px; background:#f1f5f9; border-radius:11px; gap:2px; align-self:flex-start; }
  .cc-modal-tab { display:inline-flex; align-items:center; gap:6px; padding:7px 12px; border-radius:8px; font-size:12.5px; font-weight:600; color:#475569; background:transparent; border:0; cursor:pointer; }
  .cc-modal-tab.on { background:#fff; color:#0f172a; box-shadow:0 1px 3px rgba(15,23,42,0.08); }

  .cc-modal-form { display:flex; flex-direction:column; gap:12px; }
  .cc-modal-field { display:flex; flex-direction:column; gap:5px; font-size:12px; color:#475569; font-weight:600; }
  .cc-modal-field span { display:inline-flex; align-items:center; gap:5px; }
  .cc-modal-field input, .cc-modal-field select { padding:10px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px; color:#0f172a; background:#fff; font-family:inherit; font-weight:500; }
  .cc-modal-field input:focus, .cc-modal-field select:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }

  .cc-modal-drop { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:6px; text-align:center; padding:28px 20px; border:1.5px dashed #cbd5e1; border-radius:12px; background:#f8fafc; color:#475569; cursor:pointer; transition:border-color .12s, background-color .12s; }
  .cc-modal-drop:hover { border-color:#047857; background:#eef7f2; color:#047857; }
  .cc-modal-drop.has-file { border-color:#047857; background:#eef7f2; color:#065f46; }
  .cc-modal-drop p { margin:0; font-size:14px; }
  .cc-modal-drop small { font-size:12px; color:#94a3b8; }

  .cc-modal-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:4px; }
  .cc-modal-btn { display:inline-flex; align-items:center; gap:6px; padding:9px 16px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; }
  .cc-modal-btn.primary { background:#047857; color:#fff; }
  .cc-modal-btn.primary:hover:not(:disabled) { filter:brightness(0.96); }
  .cc-modal-btn.ghost { background:#fff; color:#0f172a; border:1px solid #cbd5e1; }
  .cc-modal-btn:disabled { opacity:0.5; cursor:not-allowed; }
`;
