import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  FileText,
  Image as ImageIcon,
  Paperclip,
  Plus,
  Search,
  Trash2,
  X,
} from "lucide-react";
import API_URL from "../../config";

const FILE_TYPE_OPTIONS = [
  { value: "", label: "All types" },
  { value: "none", label: "Text only" },
  { value: "image", label: "Image" },
  { value: "attachment", label: "Attachment" },
];

const emptyForm = () => ({
  name: "",
  description: "",
  fileType: "image",
  file: null,
});

const getFileUrl = (fileUrl) => {
  if (!fileUrl) return "";
  if (fileUrl.startsWith("http")) return fileUrl;
  const apiOrigin = API_URL.replace(/\/api\/?$/, "");
  return `${apiOrigin}${fileUrl.startsWith("/") ? "" : "/"}${fileUrl}`;
};

export default function TemplateScreenRedesign() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [descTemplate, setDescTemplate] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const fetchTemplates = async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/templates`, { params: { limit: 200 } });
      setTemplates(res.data?.data || []);
    } catch (error) {
      console.error("Error fetching templates", error);
      toast.error("Could not load templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchTemplates();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => setDebouncedSearchTerm(searchTerm), 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const handleSubmit = async () => {
    if (!form.name.trim()) {
      toast.error("Template name is required");
      return;
    }
    // A template is a stored file, so there is nothing to save without one.
    if (!form.file) {
      toast.error("Attach a file for this template");
      return;
    }
    setSubmitting(true);
    try {
      const payload = new FormData();
      payload.append("name", form.name);
      payload.append("file", form.file);
      await axios.post(`${API_URL}/templates`, payload);
      toast.success("Template created");
      fetchTemplates();
      setAddOpen(false);
      setForm(emptyForm());
    } catch (error) {
      console.error(error);
      toast.error(error.response?.data?.message || "Failed to create template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`${API_URL}/templates/${deleteTarget.id}`);
      toast.success("Template deleted");
      setDeleteTarget(null);
      fetchTemplates();
    } catch (error) {
      console.error(error);
      toast.error("Failed to delete template");
    }
  };

  const filtered = useMemo(() => {
    return templates.filter((template) => {
      if (typeFilter && (template.fileType || "none") !== typeFilter) return false;
      if (!debouncedSearchTerm.trim()) return true;
      const query = debouncedSearchTerm.toLowerCase();
      return (
        String(template.name || "").toLowerCase().includes(query) ||
        String(template.description || "").toLowerCase().includes(query)
      );
    });
  }, [templates, debouncedSearchTerm, typeFilter]);

  return (
    <div className="cc-report-redesign cc-templates">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      <section className="cc-report-panel">
        <div className="cc-tpl-toolbar">
          <label className="cc-report-search cc-tpl-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search templates by name or body..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <label className="cc-tpl-filter">
            Type
            <select value={typeFilter} onChange={(event) => setTypeFilter(event.target.value)}>
              {FILE_TYPE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cc-tpl-btn primary"
            onClick={() => {
              setForm(emptyForm());
              setAddOpen(true);
            }}
          >
            <Plus size={16} /> New template
          </button>
        </div>
      </section>

      <section className="cc-report-panel">
        <div className="cc-report-table-head">
          <h2>Templates <span className="cc-tpl-count">({filtered.length})</span></h2>
        </div>

        <div className="cc-report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Name</th>
                <th>File</th>
                <th>Body preview</th>
                <th>Type</th>
                <th>Added</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={6} className="cc-report-empty">Loading templates...</td></tr>
              ) : filtered.length === 0 ? (
                <tr>
                  <td colSpan={6} className="cc-report-empty">
                    {templates.length === 0
                      ? "No templates yet. Click New template to create one."
                      : "No templates match the filters"}
                  </td>
                </tr>
              ) : (
                filtered.map((template) => {
                  const fileType = template.fileType || "none";
                  const bodyText = template.description || "";
                  const preview = bodyText.length > 90 ? `${bodyText.slice(0, 90)}...` : bodyText;
                  return (
                    <tr key={template.id}>
                      <td style={{ fontWeight: 600, minWidth: 160 }}>{template.name || "--"}</td>
                      <td>
                        {fileType === "image" && template.fileUrl ? (
                          <a
                            href={getFileUrl(template.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="cc-tpl-thumb-link"
                          >
                            <img src={getFileUrl(template.fileUrl)} alt={template.name} />
                          </a>
                        ) : template.fileUrl ? (
                          <a
                            href={getFileUrl(template.fileUrl)}
                            target="_blank"
                            rel="noreferrer"
                            className="cc-tpl-file-link"
                          >
                            <Paperclip size={14} /> View file
                          </a>
                        ) : (
                          <span className="cc-tpl-empty-file">—</span>
                        )}
                      </td>
                      <td>
                        {bodyText ? (
                          <button
                            type="button"
                            className="cc-tpl-body-btn"
                            onClick={() => setDescTemplate(template)}
                            title="Open full body"
                          >
                            {preview}
                          </button>
                        ) : (
                          "--"
                        )}
                      </td>
                      <td>
                        <span className={`cc-tpl-type-pill type-${fileType}`}>
                          {fileType === "image" ? <ImageIcon size={12} /> :
                           fileType === "attachment" ? <Paperclip size={12} /> :
                           <FileText size={12} />}
                          {fileType === "none" ? "Text" : fileType}
                        </span>
                      </td>
                      <td className="cc-tpl-date">
                        {template.createdAt ? moment(template.createdAt).format("DD MMM YYYY, HH:mm") : "--"}
                      </td>
                      <td>
                        <button
                          type="button"
                          className="cc-tpl-icon-btn danger"
                          onClick={() => setDeleteTarget(template)}
                          title="Delete template"
                        >
                          <Trash2 size={14} />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </section>

      {descTemplate ? (
        <div className="cc-tpl-overlay" onClick={() => setDescTemplate(null)}>
          <div className="cc-tpl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-tpl-modal-head">
              <div>
                <h3>{descTemplate.name}</h3>
                <small>Added {descTemplate.createdAt ? moment(descTemplate.createdAt).format("DD MMM YYYY, HH:mm") : "--"}</small>
              </div>
              <button type="button" onClick={() => setDescTemplate(null)}><X size={16} /></button>
            </div>
            {descTemplate.fileUrl && descTemplate.fileType === "image" ? (
              <img src={getFileUrl(descTemplate.fileUrl)} alt={descTemplate.name} className="cc-tpl-modal-thumb" />
            ) : null}
            {descTemplate.fileUrl && descTemplate.fileType === "attachment" ? (
              <a
                href={getFileUrl(descTemplate.fileUrl)}
                target="_blank"
                rel="noreferrer"
                className="cc-tpl-file-link"
                style={{ alignSelf: "flex-start" }}
              >
                <Paperclip size={14} /> Open attachment
              </a>
            ) : null}
            <pre className="cc-tpl-modal-body">{descTemplate.description || "No body"}</pre>
            <div style={{ display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="cc-tpl-btn ghost"
                onClick={() => {
                  navigator.clipboard?.writeText(descTemplate.description || "");
                  toast.success("Body copied to clipboard");
                }}
              >
                Copy body
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {deleteTarget ? (
        <div className="cc-tpl-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cc-tpl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-tpl-modal-head">
              <h3>Delete template?</h3>
              <button type="button" onClick={() => setDeleteTarget(null)}><X size={16} /></button>
            </div>
            <p style={{ margin: 0, color: "#475569", fontSize: 14 }}>
              This permanently deletes <strong>{deleteTarget.name}</strong>. This cannot be undone.
            </p>
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
              <button type="button" className="cc-tpl-btn ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="cc-tpl-btn primary danger" onClick={handleDelete}>
                Delete
              </button>
            </div>
          </div>
        </div>
      ) : null}

      {addOpen ? (
        <div className="cc-tpl-overlay" onClick={() => setAddOpen(false)}>
          <div className="cc-tpl-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-tpl-modal-head">
              <h3>New template</h3>
              <button type="button" onClick={() => setAddOpen(false)}><X size={16} /></button>
            </div>
            <form
              className="cc-tpl-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleSubmit();
              }}
            >
              <label className="cc-form-field">
                <span>Template name *</span>
                <input
                  type="text"
                  value={form.name}
                  onChange={(event) => setForm({ ...form, name: event.target.value })}
                  placeholder="e.g. PL Salaried Documents"
                />
              </label>
              <label className="cc-form-field">
                <span>Attachment type</span>
                <select
                  value={form.fileType}
                  onChange={(event) => setForm({ ...form, fileType: event.target.value, file: null })}
                >
                  <option value="image">Image</option>
                  <option value="attachment">Attachment (PDF)</option>
                </select>
              </label>
              <label className="cc-form-field">
                <span>{form.fileType === "image" ? "Image file" : "PDF file"}</span>
                <input
                  type="file"
                  accept={form.fileType === "image" ? "image/*" : "application/pdf"}
                  onChange={(event) => setForm({ ...form, file: event.target.files[0] || null })}
                />
              </label>
              <div style={{ display: "flex", justifyContent: "flex-end", gap: 8 }}>
                <button type="button" className="cc-tpl-btn ghost" onClick={() => setAddOpen(false)}>
                  Cancel
                </button>
                <button type="submit" className="cc-tpl-btn primary" disabled={submitting}>
                  {submitting ? "Creating..." : "Create template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = `
  .cc-tpl-toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
  .cc-tpl-search { flex:1 1 260px; min-width:220px; max-width:420px; }
  .cc-tpl-search input { appearance:none; -webkit-appearance:none; height:38px; padding:8px 12px 8px 40px; border:1px solid #d5ded7; border-radius:10px; background:#fff; font-size:13px; color:#0f172a; outline:none; width:100%; }
  .cc-tpl-search input:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); }
  .cc-tpl-filter { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569; }
  .cc-tpl-filter select { padding:8px 12px; border:1px solid #d5ded7; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; min-width:140px; }
  .cc-tpl-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; margin-left:auto; }
  .cc-tpl-btn.primary { background:#047857; color:#fff; }
  .cc-tpl-btn.primary.danger { background:#dc2626; }
  .cc-tpl-btn.primary:hover:not(:disabled) { filter:brightness(0.96); }
  .cc-tpl-btn.ghost { background:#fff; color:#0f172a; border:1px solid #d5ded7; margin-left:0; }
  .cc-tpl-btn:disabled { opacity:0.5; cursor:not-allowed; }

  .cc-tpl-count { font-size:13px; color:#475569; margin-left:2px; }

  .cc-tpl-thumb-link img { display:block; width:56px; height:56px; object-fit:cover; border-radius:8px; border:1px solid #eef1ee; }
  .cc-tpl-file-link { display:inline-flex; align-items:center; gap:6px; color:#047857; text-decoration:none; font-size:13px; font-weight:500; }
  .cc-tpl-file-link:hover { text-decoration:underline; }
  .cc-tpl-empty-file { color:#cbd5e1; font-family:ui-monospace,monospace; }

  .cc-tpl-body-btn { border:0; background:transparent; text-align:left; color:#0f172a; cursor:pointer; font-size:13px; padding:0; max-width:360px; display:block; line-height:1.4; }
  .cc-tpl-body-btn:hover { color:#047857; }

  .cc-tpl-type-pill { display:inline-flex; align-items:center; gap:5px; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:600; text-transform:capitalize; }
  .cc-tpl-type-pill.type-none { background:#f1f5f9; color:#475569; }
  .cc-tpl-type-pill.type-image { background:#eef2ff; color:#4338ca; }
  .cc-tpl-type-pill.type-attachment { background:#fef3c7; color:#b45309; }

  .cc-tpl-date { font-size:12.5px; color:#475569; white-space:nowrap; }

  .cc-tpl-icon-btn { width:32px; height:32px; border-radius:8px; border:1px solid #d5ded7; background:#fff; display:grid; place-items:center; color:#475569; cursor:pointer; }
  .cc-tpl-icon-btn:hover { color:#047857; border-color:#047857; }
  .cc-tpl-icon-btn.danger:hover { color:#dc2626; border-color:#dc2626; }

  .cc-tpl-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:70; display:grid; place-items:center; padding:16px; }
  .cc-tpl-modal { background:#fff; border-radius:16px; padding:22px; width:100%; max-width:640px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }
  .cc-tpl-modal-head { display:flex; align-items:flex-start; justify-content:space-between; gap:12px; }
  .cc-tpl-modal-head h3 { margin:0; font-size:17px; font-weight:700; color:#0f172a; }
  .cc-tpl-modal-head small { display:block; font-size:11.5px; color:#94a3b8; margin-top:2px; }
  .cc-tpl-modal-head button { border:0; background:#f1f5f9; color:#475569; width:30px; height:30px; border-radius:8px; cursor:pointer; display:grid; place-items:center; flex:none; }
  .cc-tpl-modal-head button:hover { background:#e2e8f0; color:#0f172a; }

  .cc-tpl-modal-thumb { max-width:100%; max-height:280px; border-radius:12px; border:1px solid #eef1ee; align-self:flex-start; }
  .cc-tpl-modal-body { margin:0; padding:14px 16px; border:1px solid #eef1ee; border-radius:12px; background:#f8fafc; font-size:13px; color:#334155; white-space:pre-wrap; word-break:break-word; font-family:inherit; max-height:340px; overflow-y:auto; }

  .cc-tpl-form { display:flex; flex-direction:column; gap:12px; }
  .cc-form-field { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569; }
  .cc-form-field input, .cc-form-field select, .cc-form-field textarea { padding:8px 12px; border:1px solid #d5ded7; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; font-family:inherit; }
  .cc-form-field input[type="file"] { padding:6px 8px; }
  .cc-form-field input:focus, .cc-form-field select:focus, .cc-form-field textarea:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }
`;
