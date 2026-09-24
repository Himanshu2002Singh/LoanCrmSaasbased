import React, { useEffect, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { FileSpreadsheet, Percent, Phone, Share2, Upload, User, X } from "lucide-react";
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
  const [commissionPercent, setCommissionPercent] = useState("");
  const [excelDefaultSource, setExcelDefaultSource] = useState("Self");
  const [excelDefaultCommission, setExcelDefaultCommission] = useState("");
  const [sourcesList, setSourcesList] = useState([]);
  const [file, setFile] = useState(null);
  const [submitting, setSubmitting] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    if (!open) return;
    const fetchSources = async () => {
      try {
        const res = await axios.get(`${API_URL}/master-configs/LEAD_SOURCE`, {
          params: { includeInactive: false },
        });
        const items = res.data?.data || [];
        setSourcesList(items);
        // Ensure "Self" exists in choices even if not returned
        const hasSelf = items.some(
          (s) => String(s.value || "").toLowerCase() === "self" || String(s.label || "").toLowerCase() === "self"
        );
        if (!hasSelf) {
          setSourcesList((prev) => [{ id: "self-default", label: "Self", value: "Self" }, ...prev]);
        }
      } catch (err) {
        console.error("Could not fetch lead sources", err);
        setSourcesList([{ id: "self-default", label: "Self", value: "Self" }]);
      }
    };
    fetchSources();
  }, [open]);

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
    setCommissionPercent("");
    setExcelDefaultSource("Self");
    setExcelDefaultCommission("");
    setFile(null);
    setMode("manual");
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
          commission_percent:
            commissionPercent !== "" && !isNaN(parseFloat(commissionPercent))
              ? parseFloat(commissionPercent)
              : null,
        }),
      });
      if (!res.ok) {
        const errData = await res.json().catch(() => ({}));
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
              <span>
                <Phone size={12} /> Contact number <span style={{ color: "#ef4444" }}>*</span>
              </span>
              <input
                type="tel"
                value={contact}
                onChange={(event) => setContact(event.target.value)}
                placeholder="10-digit phone number"
                required
              />
            </label>

            <div style={{ display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "10px" }}>
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
                        {s.label || s.value} {s.commissionPercent ? `(${s.commissionPercent}%)` : ""}
                      </option>
                    ))}
                </select>
              </label>

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
            </div>

            <div className="cc-modal-actions">
              <button type="button" className="cc-modal-btn ghost" onClick={closeAll}>
                Cancel
              </button>
              <button type="submit" className="cc-modal-btn primary" disabled={submitting}>
                {submitting ? "Saving..." : "Add lead"}
              </button>
            </div>
          </form>
        ) : (
          <div className="cc-modal-form">
            <div
              className={`cc-modal-drop ${file ? "has-file" : ""}`}
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload size={20} />
              <p>
                <strong>{file ? file.name : "Click to select an Excel file"}</strong>
              </p>
              <small>.xlsx or .xls</small>
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
  .cc-modal-card { width:100%; max-width:460px; background:#fff; border-radius:18px; padding:22px 22px 20px; display:flex; flex-direction:column; gap:14px; box-shadow:0 20px 60px rgba(15,23,42,0.28); }
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
