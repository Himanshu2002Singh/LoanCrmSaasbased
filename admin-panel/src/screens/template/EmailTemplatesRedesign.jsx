import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Check,
  CheckCircle2,
  Copy,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  HelpCircle,
  Info,
  KeyRound,
  Lock,
  Mail,
  Pencil,
  Plus,
  RefreshCw,
  Search,
  Send,
  Server,
  Settings,
  ShieldCheck,
  Sparkles,
  Star,
  Trash2,
  X,
} from "lucide-react";
import API_URL from "../../config";

const VARIABLE_TAGS = [
  { tag: "{{customer_name}}", label: "Customer Name", desc: "e.g. Rajesh Sharma" },
  { tag: "{{application_number}}", label: "App Ref #", desc: "e.g. APP-2026-0042" },
  { tag: "{{loan_product}}", label: "Loan Product", desc: "e.g. Home Loan, Business Loan" },
  { tag: "{{loan_amount}}", label: "Loan Amount", desc: "e.g. 25,00,000" },
  { tag: "{{bank_name}}", label: "Bank Name", desc: "e.g. HDFC Bank, ICICI Bank" },
  { tag: "{{bank_rm_name}}", label: "Bank RM Name", desc: "e.g. Amit Verma" },
  { tag: "{{mobile}}", label: "Customer Mobile", desc: "e.g. 9876543210" },
  { tag: "{{email}}", label: "Customer Email", desc: "e.g. applicant@gmail.com" },
  { tag: "{{pan}}", label: "PAN Number", desc: "e.g. ABCDE1234F" },
  { tag: "{{documents_list}}", label: "Attached Docs List", desc: "Bullet list of uploaded KYC docs" },
  { tag: "{{company_name}}", label: "Your Company", desc: "e.g. CapitalCare Financial" },
  { tag: "{{sender_name}}", label: "Sender Name", desc: "Name of the logged-in Operations user" },
];

const SAMPLE_DATA = {
  customer_name: "Rahul Verma",
  application_number: "APP-2026-0128",
  loan_product: "Personal Loan",
  loan_amount: "15,00,000",
  bank_name: "HDFC Bank",
  bank_rm_name: "Rajesh Sharma",
  mobile: "9876543210",
  email: "rahul.verma@example.com",
  pan: "ABCDE1234F",
  company_name: "CapitalCare Financial",
  sender_name: "Operations Team",
  documents_list: "• PAN Card (pan_card.pdf)\n• Aadhaar Card (aadhaar.pdf)\n• Last 6 Months Bank Statement (bank_statement.pdf)\n• Last 3 Months Salary Slips (salary_slips.pdf)",
};

const renderSampleText = (text = "") => {
  let res = text;
  for (const [k, v] of Object.entries(SAMPLE_DATA)) {
    res = res.replace(new RegExp(`\\{\\{\\s*${k}\\s*\\}\\}`, "g"), v);
  }
  return res;
};

const emptyForm = () => ({
  name: "",
  subject: "",
  content: "",
  category: "LOAN_SUBMISSION",
  isDefault: false,
});

const emptySmtpForm = () => ({
  service: "gmail",
  user: "",
  pass: "",
  senderName: "",
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  isConfigured: true,
});

export default function EmailTemplatesRedesign() {
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");

  const [modalOpen, setModalOpen] = useState(false);
  const [editingTemplate, setEditingTemplate] = useState(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  const [previewTemplate, setPreviewTemplate] = useState(null);
  const [deleteTarget, setDeleteTarget] = useState(null);

  // Outgoing Email & Gmail SMTP Configuration State
  const [smtpConfig, setSmtpConfig] = useState(null);
  const [smtpLoading, setSmtpLoading] = useState(false);
  const [smtpModalOpen, setSmtpModalOpen] = useState(false);
  const [smtpForm, setSmtpForm] = useState(emptySmtpForm);
  const [showPassword, setShowPassword] = useState(false);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [smtpSaving, setSmtpSaving] = useState(false);
  const [smtpTesting, setSmtpTesting] = useState(false);
  const [testEmail, setTestEmail] = useState("");
  const [testFeedback, setTestFeedback] = useState(null);

  const subjectInputRef = useRef(null);
  const contentInputRef = useRef(null);

  const fetchTemplates = useCallback(async () => {
    setLoading(true);
    try {
      const res = await axios.get(`${API_URL}/email-templates`, {
        params: { includeInactive: true },
      });
      setTemplates(res.data?.templates || res.data?.data || []);
    } catch (error) {
      console.error("Error fetching email templates:", error);
      toast.error("Could not load email templates");
      setTemplates([]);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSmtpConfig = useCallback(async () => {
    setSmtpLoading(true);
    try {
      const res = await axios.get(`${API_URL}/email-templates/smtp/config`);
      if (res.data?.success && res.data?.data) {
        setSmtpConfig(res.data.data);
      }
    } catch (error) {
      console.warn("Could not fetch SMTP config:", error.message);
    } finally {
      setSmtpLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchTemplates();
    fetchSmtpConfig();
  }, [fetchTemplates, fetchSmtpConfig]);

  const openCreateModal = () => {
    setEditingTemplate(null);
    setForm(emptyForm());
    setModalOpen(true);
  };

  const openEditModal = (tpl) => {
    setEditingTemplate(tpl);
    setForm({
      name: tpl.name || "",
      subject: tpl.subject || "",
      content: tpl.content || "",
      category: tpl.category || "LOAN_SUBMISSION",
      isDefault: Boolean(tpl.isDefault),
    });
    setModalOpen(true);
  };

  const openSmtpModal = () => {
    const isCustom =
      smtpConfig?.service !== "gmail" &&
      smtpConfig?.host &&
      smtpConfig?.host !== "smtp.gmail.com";

    setSmtpForm({
      service: smtpConfig?.service || "gmail",
      user: smtpConfig?.user || "",
      pass: "", // Keep empty so existing saved password is unchanged unless user types a new one
      senderName:
        smtpConfig?.senderName ||
        localStorage.getItem("name") ||
        "CapitalCare Operations",
      host: smtpConfig?.host || "smtp.gmail.com",
      port: smtpConfig?.port || 465,
      secure: smtpConfig?.secure !== undefined ? smtpConfig.secure : true,
      isConfigured:
        smtpConfig?.isConfigured !== undefined ? smtpConfig.isConfigured : true,
    });
    setTestEmail(smtpConfig?.user || localStorage.getItem("email") || "");
    setTestFeedback(null);
    setShowPassword(false);
    setShowAdvanced(Boolean(isCustom));
    setSmtpModalOpen(true);
  };

  const handleServicePresetChange = (serviceType) => {
    if (serviceType === "gmail") {
      setSmtpForm((prev) => ({
        ...prev,
        service: "gmail",
        host: "smtp.gmail.com",
        port: 465,
        secure: true,
      }));
      setShowAdvanced(false);
    } else {
      setSmtpForm((prev) => ({
        ...prev,
        service: "custom",
        host: prev.host === "smtp.gmail.com" ? "" : prev.host,
        port: prev.port || 587,
        secure: prev.secure !== undefined ? prev.secure : false,
      }));
      setShowAdvanced(true);
    }
  };

  const handleSaveSmtp = async (e) => {
    e.preventDefault();
    if (!smtpForm.user || !smtpForm.user.trim()) {
      toast.error("Please enter a valid sender email address");
      return;
    }
    if (!smtpConfig?.hasPassword && (!smtpForm.pass || !smtpForm.pass.trim())) {
      toast.error("Please enter your Gmail App Password / Email Password");
      return;
    }

    setSmtpSaving(true);
    try {
      const res = await axios.put(`${API_URL}/email-templates/smtp/config`, smtpForm);
      if (res.data?.success) {
        setSmtpConfig(res.data.data);
        toast.success("Outgoing email & password saved successfully!");
        setSmtpModalOpen(false);
      }
    } catch (err) {
      console.error("Save SMTP error:", err);
      toast.error(err.response?.data?.message || "Failed to save SMTP configuration");
    } finally {
      setSmtpSaving(false);
    }
  };

  const handleTestSmtp = async () => {
    if (!smtpForm.user || !smtpForm.user.trim()) {
      toast.warning("Please enter a sender email address first");
      return;
    }
    if (!smtpConfig?.hasPassword && (!smtpForm.pass || !smtpForm.pass.trim())) {
      toast.warning("Please enter your Gmail App Password to test connection");
      return;
    }

    setSmtpTesting(true);
    setTestFeedback(null);
    try {
      const res = await axios.post(`${API_URL}/email-templates/smtp/test`, {
        ...smtpForm,
        testToEmail: testEmail.trim() || smtpForm.user.trim(),
      });
      if (res.data?.success) {
        setTestFeedback({
          type: "success",
          message:
            res.data.message ||
            `Authentication successful! A test email was delivered to ${testEmail || smtpForm.user}`,
        });
        toast.success("SMTP connection verified!");
      }
    } catch (err) {
      console.error("Test SMTP error:", err);
      setTestFeedback({
        type: "error",
        message:
          err.response?.data?.message ||
          err.message ||
          "Failed to authenticate with SMTP server. Please verify your App Password and try again.",
      });
    } finally {
      setSmtpTesting(false);
    }
  };

  const insertVariable = (tag, target = "content") => {
    if (target === "subject") {
      const input = subjectInputRef.current;
      if (input) {
        const start = input.selectionStart || 0;
        const end = input.selectionEnd || 0;
        const oldVal = form.subject || "";
        const newVal = oldVal.substring(0, start) + tag + oldVal.substring(end);
        setForm((prev) => ({ ...prev, subject: newVal }));
        setTimeout(() => {
          input.focus();
          input.setSelectionRange(start + tag.length, start + tag.length);
        }, 50);
      } else {
        setForm((prev) => ({ ...prev, subject: (prev.subject || "") + " " + tag }));
      }
    } else {
      const textarea = contentInputRef.current;
      if (textarea) {
        const start = textarea.selectionStart || 0;
        const end = textarea.selectionEnd || 0;
        const oldVal = form.content || "";
        const newVal = oldVal.substring(0, start) + tag + oldVal.substring(end);
        setForm((prev) => ({ ...prev, content: newVal }));
        setTimeout(() => {
          textarea.focus();
          textarea.setSelectionRange(start + tag.length, start + tag.length);
        }, 50);
      } else {
        setForm((prev) => ({ ...prev, content: (prev.content || "") + "\n" + tag }));
      }
    }
  };

  const handleCopyTag = (tag) => {
    navigator.clipboard.writeText(tag);
    toast.info(`Copied ${tag} to clipboard`);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!form.name.trim() || !form.subject.trim() || !form.content.trim()) {
      toast.error("Template Name, Subject, and Body Content are required");
      return;
    }

    setSubmitting(true);
    try {
      if (editingTemplate) {
        await axios.put(`${API_URL}/email-templates/${editingTemplate.id}`, form);
        toast.success("Template updated successfully");
      } else {
        await axios.post(`${API_URL}/email-templates`, form);
        toast.success("New template created successfully");
      }
      setModalOpen(false);
      fetchTemplates();
    } catch (error) {
      console.error("Save template error:", error);
      toast.error(error.response?.data?.message || "Failed to save template");
    } finally {
      setSubmitting(false);
    }
  };

  const handleSetDefault = async (tpl) => {
    try {
      await axios.put(`${API_URL}/email-templates/${tpl.id}`, { isDefault: true });
      toast.success(`"${tpl.name}" is now the default dispatch template`);
      fetchTemplates();
    } catch (error) {
      console.error("Set default error:", error);
      toast.error("Failed to set default template");
    }
  };

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await axios.delete(`${API_URL}/email-templates/${deleteTarget.id}`);
      toast.success("Template deleted successfully");
      setDeleteTarget(null);
      fetchTemplates();
    } catch (error) {
      console.error("Delete template error:", error);
      toast.error(error.response?.data?.message || "Failed to delete template");
    }
  };

  const filteredTemplates = useMemo(() => {
    return templates.filter((tpl) => {
      if (categoryFilter && tpl.category !== categoryFilter) return false;
      if (!searchTerm) return true;
      const q = searchTerm.toLowerCase();
      return (
        String(tpl.name || "").toLowerCase().includes(q) ||
        String(tpl.subject || "").toLowerCase().includes(q) ||
        String(tpl.content || "").toLowerCase().includes(q)
      );
    });
  }, [templates, searchTerm, categoryFilter]);

  return (
    <div className="cc-etpl-container">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      {/* Top Header */}
      <section className="cc-etpl-header-panel">
        <div className="cc-etpl-header-text">
          <div className="cc-etpl-badge-pill">
            <Mail size={13} /> Loan Dispatch Communication Hub
          </div>
          <h1>Email &amp; Subject Templates</h1>
          <p>
            Configure pre-approved email subjects, dynamic message templates, and your outgoing Gmail / SMTP sender credentials used when emailing loan applications to Bank Relationship Managers.
          </p>
        </div>

        <div className="cc-etpl-header-actions">
          <button
            type="button"
            className="cc-etpl-btn secondary"
            onClick={openSmtpModal}
            title="Configure company Gmail ID and App Password"
          >
            <Settings size={15} />
            <span>Sender Gmail / SMTP</span>
            {smtpConfig?.isConfigured && smtpConfig?.user && (
              <span className="cc-header-active-dot" title="Active & Connected" />
            )}
          </button>
          <button type="button" className="cc-etpl-btn primary" onClick={openCreateModal}>
            <Plus size={16} /> Create Template
          </button>
        </div>
      </section>

      {/* Outgoing Email & SMTP Sender Account Status Banner */}
      <section className="cc-smtp-banner-wrapper">
        {smtpLoading ? (
          <div className="cc-smtp-banner loading">
            <RefreshCw className="cc-spin" size={16} style={{ color: "#047857" }} />
            <span>Checking outgoing email configuration...</span>
          </div>
        ) : smtpConfig?.isConfigured && smtpConfig?.user ? (
          <div className="cc-smtp-banner configured">
            <div className="cc-smtp-banner-left">
              <div className="cc-smtp-status-dot active" />
              <div>
                <div className="cc-smtp-banner-title">
                  <span>Outgoing Sender Email:</span>{" "}
                  <strong>{smtpConfig.user}</strong>
                  <span className="cc-smtp-badge-active">
                    <CheckCircle2 size={12} /> Connected &amp; Authenticated
                  </span>
                </div>
                <div className="cc-smtp-banner-sub">
                  Sender Name: <strong>{smtpConfig.senderName}</strong> • Server:{" "}
                  <code>{smtpConfig.host}:{smtpConfig.port}</code> • Bankers, lenders, and vendors receive emails directly from your email address.
                </div>
              </div>
            </div>
            <div className="cc-smtp-banner-actions">
              <button
                type="button"
                className="cc-smtp-btn-sm ghost"
                onClick={openSmtpModal}
              >
                <Send size={13} /> Test Email
              </button>
              <button
                type="button"
                className="cc-smtp-btn-sm primary"
                onClick={openSmtpModal}
              >
                <Pencil size={13} /> Edit Gmail &amp; Password
              </button>
            </div>
          </div>
        ) : (
          <div className="cc-smtp-banner warning">
            <div className="cc-smtp-banner-left">
              <div className="cc-smtp-status-dot warning" />
              <div>
                <div className="cc-smtp-banner-title" style={{ color: "#9a3412" }}>
                  ⚠️ Outgoing Sender Email &amp; Password Not Configured
                </div>
                <div className="cc-smtp-banner-sub" style={{ color: "#c2410c" }}>
                  Bankers are currently receiving files via the system fallback mailer. Set your company Gmail ID and App Password so all emails are sent directly from your own domain or Gmail account.
                </div>
              </div>
            </div>
            <button
              type="button"
              className="cc-smtp-btn-action"
              onClick={openSmtpModal}
            >
              <KeyRound size={14} /> Set Up Gmail &amp; Password
            </button>
          </div>
        )}
      </section>

      {/* Dynamic Placeholder Variable Helper Bar */}
      <section className="cc-etpl-tags-bar">
        <div className="cc-etpl-tags-head">
          <span className="cc-etpl-tags-title">
            <Sparkles size={14} style={{ color: "#d97706" }} /> Dynamic Variables (Click to copy into Subject or Body):
          </span>
          <span style={{ fontSize: 11.5, color: "#64748b" }}>
            These tags automatically replace with actual customer and application details at the time of email dispatch.
          </span>
        </div>
        <div className="cc-etpl-tags-scroll">
          {VARIABLE_TAGS.map((v) => (
            <button
              key={v.tag}
              type="button"
              className="cc-etpl-tag-chip"
              onClick={() => handleCopyTag(v.tag)}
              title={`${v.desc} — Click to copy`}
            >
              <code>{v.tag}</code>
              <span>{v.label}</span>
              <Copy size={11} className="copy-icon" />
            </button>
          ))}
        </div>
      </section>

      {/* Filter and Search Bar */}
      <section className="cc-etpl-toolbar">
        <label className="cc-etpl-search-shell">
          <Search size={17} />
          <input
            type="search"
            placeholder="Search templates by name, subject keyword, or content..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm && (
            <button
              type="button"
              className="cc-etpl-search-clear"
              onClick={() => setSearchTerm("")}
              title="Clear search"
            >
              <X size={14} />
            </button>
          )}
        </label>

        <label className="cc-etpl-filter-select">
          Category
          <select value={categoryFilter} onChange={(e) => setCategoryFilter(e.target.value)}>
            <option value="">All Categories</option>
            <option value="LOAN_SUBMISSION">Loan Application Submission</option>
            <option value="QUERY_RESPONSE">Query &amp; Clarification</option>
            <option value="GENERAL">General Notice</option>
          </select>
        </label>

        <div className="cc-etpl-count-tag">
          {filteredTemplates.length} {filteredTemplates.length === 1 ? "Template" : "Templates"}
        </div>
      </section>

      {/* Templates Grid List */}
      <section className="cc-etpl-grid">
        {loading ? (
          <div className="cc-etpl-empty-card">
            <RefreshCw className="cc-spin" size={24} style={{ color: "#047857", marginBottom: 8 }} />
            <p>Loading email templates...</p>
          </div>
        ) : filteredTemplates.length === 0 ? (
          <div className="cc-etpl-empty-card">
            <FileText size={32} style={{ color: "#94a3b8", marginBottom: 10 }} />
            <h3>No Templates Found</h3>
            <p>
              {searchTerm || categoryFilter
                ? "No email templates match your search criteria. Try clearing the filter."
                : "No email templates are configured yet. Click 'Create Email Template' to create your first standard dispatch template."}
            </p>
            <button type="button" className="cc-etpl-btn primary" onClick={openCreateModal} style={{ marginTop: 14 }}>
              <Plus size={15} /> Add Template
            </button>
          </div>
        ) : (
          filteredTemplates.map((tpl) => (
            <div key={tpl.id} className={`cc-etpl-card ${tpl.isDefault ? "default" : ""}`}>
              <div className="cc-etpl-card-head">
                <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                    <span className="cc-etpl-cat-pill">{tpl.category || "LOAN_SUBMISSION"}</span>
                    {tpl.isDefault && (
                      <span className="cc-etpl-default-badge">
                        <Star size={11} fill="#d97706" color="#d97706" /> Default Dispatch
                      </span>
                    )}
                  </div>
                  <h3 className="cc-etpl-card-title">{tpl.name}</h3>
                </div>

                <div className="cc-etpl-card-actions">
                  {!tpl.isDefault && (
                    <button
                      type="button"
                      className="cc-etpl-icon-btn star"
                      title="Set as Default Template"
                      onClick={() => handleSetDefault(tpl)}
                    >
                      <Star size={14} />
                    </button>
                  )}
                  <button
                    type="button"
                    className="cc-etpl-icon-btn"
                    title="Edit Template"
                    onClick={() => openEditModal(tpl)}
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    className="cc-etpl-icon-btn danger"
                    title="Delete Template"
                    onClick={() => setDeleteTarget(tpl)}
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              <div className="cc-etpl-subject-preview">
                <span className="cc-etpl-subject-lbl">Subject Line:</span>
                <p className="cc-etpl-subject-text">{tpl.subject}</p>
              </div>

              <div className="cc-etpl-body-preview">
                <span className="cc-etpl-subject-lbl" style={{ marginBottom: 4 }}>Message Body:</span>
                <p className="cc-etpl-body-text">{tpl.content}</p>
              </div>

              <div className="cc-etpl-card-footer">
                <button
                  type="button"
                  className="cc-etpl-preview-link"
                  onClick={() => setPreviewTemplate(tpl)}
                >
                  <Eye size={13} /> Live Preview with Sample Data
                </button>
                <span style={{ fontSize: 11, color: "#94a3b8" }}>
                  Updated {new Date(tpl.updatedAt || tpl.createdAt).toLocaleDateString()}
                </span>
              </div>
            </div>
          ))
        )}
      </section>

      {/* CREATE / EDIT TEMPLATE MODAL */}
      {modalOpen && (
        <div className="cc-etpl-overlay" onClick={() => setModalOpen(false)}>
          <div className="cc-etpl-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cc-etpl-modal-head">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>
                  {editingTemplate ? "Update Existing Template" : "New Email Template"}
                </span>
                <h2 style={{ margin: "2px 0 0", fontSize: 18, color: "#0f172a" }}>
                  {editingTemplate ? editingTemplate.name : "Create Loan Dispatch Email Template"}
                </h2>
              </div>
              <button type="button" className="cc-etpl-modal-close" onClick={() => setModalOpen(false)}>
                <X size={17} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="cc-etpl-form">
              <div className="cc-etpl-form-row">
                <label className="cc-etpl-field grow">
                  Template Name *
                  <input
                    type="text"
                    value={form.name}
                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                    placeholder="e.g. Standard Bank Loan Application Docket"
                    required
                  />
                </label>

                <label className="cc-etpl-field" style={{ minWidth: 200 }}>
                  Category
                  <select
                    value={form.category}
                    onChange={(e) => setForm({ ...form, category: e.target.value })}
                  >
                    <option value="LOAN_SUBMISSION">Loan Application Submission</option>
                    <option value="QUERY_RESPONSE">Query &amp; Clarification</option>
                    <option value="GENERAL">General Notice</option>
                  </select>
                </label>
              </div>

              {/* Subject Line Field */}
              <div className="cc-etpl-field-block">
                <div className="cc-etpl-field-head">
                  <div className="cc-etpl-field-title">
                    <span>Email Subject Line *</span>
                    <small>Supports dynamic placeholders like <code>{`{{customer_name}}`}</code>, <code>{`{{loan_product}}`}</code></small>
                  </div>
                  <div className="cc-etpl-quick-tags">
                    <span style={{ fontSize: 11, color: "#64748b" }}>Insert:</span>
                    {["{{customer_name}}", "{{loan_product}}", "{{application_number}}", "{{loan_amount}}"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="cc-etpl-insert-btn"
                        onClick={() => insertVariable(t, "subject")}
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
                <input
                  ref={subjectInputRef}
                  type="text"
                  value={form.subject}
                  onChange={(e) => setForm({ ...form, subject: e.target.value })}
                  placeholder="[Loan Docket] Application Submission - {{customer_name}} | {{loan_product}} (Ref: {{application_number}})"
                  required
                />
              </div>

              {/* Body Content Field */}
              <div className="cc-etpl-field-block">
                <div className="cc-etpl-field-head">
                  <div className="cc-etpl-field-title">
                    <span>Email Message Body *</span>
                    <small>Supports multiline text and dynamic customer/bank tags.</small>
                  </div>
                  <div className="cc-etpl-quick-tags">
                    <span style={{ fontSize: 11, color: "#64748b" }}>Insert:</span>
                    {["{{bank_rm_name}}", "{{customer_name}}", "{{documents_list}}", "{{company_name}}", "{{sender_name}}"].map((t) => (
                      <button
                        key={t}
                        type="button"
                        className="cc-etpl-insert-btn"
                        onClick={() => insertVariable(t, "content")}
                      >
                        + {t}
                      </button>
                    ))}
                  </div>
                </div>
                <textarea
                  ref={contentInputRef}
                  rows={9}
                  value={form.content}
                  onChange={(e) => setForm({ ...form, content: e.target.value })}
                  placeholder="Dear {{bank_rm_name}},&#10;&#10;Please find attached the loan application and KYC documents for {{customer_name}}...&#10;&#10;Attached Documents:&#10;{{documents_list}}&#10;&#10;Best regards,&#10;{{sender_name}}&#10;{{company_name}}"
                  required
                />
              </div>

              <label className="cc-etpl-checkbox-label">
                <input
                  type="checkbox"
                  checked={form.isDefault}
                  onChange={(e) => setForm({ ...form, isDefault: e.target.checked })}
                />
                <span>Set as Default Template for Operations Email Dispatch</span>
              </label>

              <div className="cc-etpl-modal-actions">
                <button
                  type="button"
                  className="cc-etpl-btn ghost"
                  onClick={() => setModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-etpl-btn primary" disabled={submitting}>
                  {submitting ? "Saving..." : editingTemplate ? "Save Changes" : "Create Template"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* GMAIL & SMTP CONFIGURATION MODAL */}
      {smtpModalOpen && (
        <div className="cc-etpl-overlay" onClick={() => setSmtpModalOpen(false)}>
          <div className="cc-etpl-modal smtp-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cc-etpl-modal-head">
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div className="cc-smtp-icon-box">
                  <Mail size={22} color="#047857" />
                </div>
                <div>
                  <span style={{ fontSize: 11, fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>
                    Outgoing Email Engine
                  </span>
                  <h2 style={{ margin: "2px 0 0", fontSize: 18, color: "#0f172a" }}>
                    Set Sender Email &amp; Password (Gmail / SMTP)
                  </h2>
                </div>
              </div>
              <button
                type="button"
                className="cc-etpl-modal-close"
                onClick={() => setSmtpModalOpen(false)}
              >
                <X size={17} />
              </button>
            </div>

            {/* Service Type Selector */}
            <div className="cc-smtp-service-tabs">
              <button
                type="button"
                className={`cc-smtp-tab ${smtpForm.service === "gmail" ? "active" : ""}`}
                onClick={() => handleServicePresetChange("gmail")}
              >
                <img
                  src="https://www.gstatic.com/images/branding/product/1x/gmail_2020q4_32dp.png"
                  alt="Gmail"
                  width="18"
                  height="18"
                  style={{ verticalAlign: "middle" }}
                />
                <span>Gmail / Google Workspace (Recommended)</span>
              </button>
              <button
                type="button"
                className={`cc-smtp-tab ${smtpForm.service === "custom" ? "active" : ""}`}
                onClick={() => handleServicePresetChange("custom")}
              >
                <Server size={16} />
                <span>Custom SMTP Server (Zoho, Outlook, Private)</span>
              </button>
            </div>

            {/* How-to guide callout for Gmail App Password */}
            {smtpForm.service === "gmail" && (
              <div className="cc-smtp-guide-box">
                <div className="cc-smtp-guide-head">
                  <KeyRound size={15} color="#d97706" />
                  <strong>How to set up Gmail App Password (1-minute guide):</strong>
                </div>
                <ol className="cc-smtp-guide-steps">
                  <li>
                    Log in to your Google Account at{" "}
                    <a
                      href="https://myaccount.google.com/security"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cc-smtp-ext-link"
                    >
                      myaccount.google.com/security <ExternalLink size={11} />
                    </a>
                  </li>
                  <li>
                    Ensure <strong>2-Step Verification</strong> is turned <strong>ON</strong>.
                  </li>
                  <li>
                    Open{" "}
                    <a
                      href="https://myaccount.google.com/apppasswords"
                      target="_blank"
                      rel="noopener noreferrer"
                      className="cc-smtp-ext-link"
                    >
                      App Passwords <ExternalLink size={11} />
                    </a>
                    , enter app name as <code>Loan CRM Mailer</code>, and click <strong>Create</strong>.
                  </li>
                  <li>
                    Copy the generated <strong>16-character code</strong> (e.g. <code>abcd efgh ijkl mnop</code>) and paste it into the password box below.
                  </li>
                </ol>
              </div>
            )}

            <form onSubmit={handleSaveSmtp} className="cc-etpl-form">
              <div className="cc-etpl-form-row">
                <label className="cc-etpl-field grow">
                  Sender Email Address *
                  <div className="cc-input-icon-shell">
                    <Mail size={15} className="input-left-icon" />
                    <input
                      type="email"
                      value={smtpForm.user}
                      onChange={(e) => setSmtpForm({ ...smtpForm, user: e.target.value })}
                      placeholder={
                        smtpForm.service === "gmail"
                          ? "e.g. operations@gmail.com"
                          : "e.g. loan-desk@yourcompany.com"
                      }
                      required
                    />
                  </div>
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Bankers and partners will see this address in the "From:" header.
                  </span>
                </label>

                <label className="cc-etpl-field grow">
                  Sender Display Name
                  <input
                    type="text"
                    value={smtpForm.senderName}
                    onChange={(e) => setSmtpForm({ ...smtpForm, senderName: e.target.value })}
                    placeholder="e.g. CapitalCare Operations Desk"
                  />
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    Name shown beside your email in inbox.
                  </span>
                </label>
              </div>

              {/* Password / App Password field with Eye Toggle */}
              <div className="cc-etpl-field">
                <label style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                  <span>
                    {smtpForm.service === "gmail"
                      ? "Gmail 16-Digit App Password *"
                      : "SMTP Password *"}
                  </span>
                  {smtpConfig?.hasPassword && (
                    <span className="cc-saved-pwd-tag">
                      <Lock size={11} /> Password is currently saved
                    </span>
                  )}
                </label>
                <div className="cc-input-icon-shell">
                  <Lock size={15} className="input-left-icon" />
                  <input
                    type={showPassword ? "text" : "password"}
                    value={smtpForm.pass}
                    onChange={(e) => setSmtpForm({ ...smtpForm, pass: e.target.value })}
                    placeholder={
                      smtpConfig?.hasPassword
                        ? "•••••••••••••••• (Leave blank to keep existing password)"
                        : "Enter 16-character Google App Password"
                    }
                    autoComplete="new-password"
                  />
                  <button
                    type="button"
                    className="input-eye-toggle"
                    onClick={() => setShowPassword(!showPassword)}
                    title={showPassword ? "Hide password" : "Show password"}
                  >
                    {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {smtpConfig?.hasPassword && (
                  <span style={{ fontSize: 11, color: "#64748b" }}>
                    A password is already saved securely. Only enter a value here if you want to update/change it.
                  </span>
                )}
              </div>

              {/* Advanced Server Details Accordion */}
              {smtpForm.service === "custom" || showAdvanced ? (
                <div className="cc-smtp-advanced-box">
                  <div style={{ fontSize: 12, fontWeight: 700, color: "#1e293b", marginBottom: 8, display: "flex", alignItems: "center", gap: 6 }}>
                    <Server size={14} color="#4338ca" /> Advanced SMTP Server Parameters
                  </div>
                  <div className="cc-etpl-form-row">
                    <label className="cc-etpl-field grow">
                      SMTP Host
                      <input
                        type="text"
                        value={smtpForm.host}
                        onChange={(e) => setSmtpForm({ ...smtpForm, host: e.target.value })}
                        placeholder="e.g. smtp.gmail.com or smtp.zoho.in"
                      />
                    </label>
                    <label className="cc-etpl-field" style={{ width: 100 }}>
                      Port
                      <input
                        type="number"
                        value={smtpForm.port}
                        onChange={(e) => setSmtpForm({ ...smtpForm, port: parseInt(e.target.value, 10) })}
                        placeholder="465"
                      />
                    </label>
                    <label className="cc-etpl-field" style={{ width: 140 }}>
                      Encryption
                      <select
                        value={smtpForm.secure ? "ssl" : "tls"}
                        onChange={(e) =>
                          setSmtpForm({
                            ...smtpForm,
                            secure: e.target.value === "ssl",
                            port: e.target.value === "ssl" ? 465 : 587,
                          })
                        }
                      >
                        <option value="ssl">SSL (Port 465)</option>
                        <option value="tls">TLS / STARTTLS (Port 587)</option>
                      </select>
                    </label>
                  </div>
                </div>
              ) : (
                <button
                  type="button"
                  className="cc-smtp-toggle-adv-btn"
                  onClick={() => setShowAdvanced(true)}
                >
                  <Server size={12} /> Show Custom SMTP Server &amp; Port Settings
                </button>
              )}

              {/* Real-time Test Email Section */}
              <div className="cc-smtp-test-section">
                <div className="cc-smtp-test-head">
                  <Send size={14} color="#047857" />
                  <strong>Test SMTP Connection &amp; Send Verification Email:</strong>
                </div>
                <div className="cc-smtp-test-input-row">
                  <input
                    type="email"
                    value={testEmail}
                    onChange={(e) => setTestEmail(e.target.value)}
                    placeholder="Recipient email address for test message"
                    className="cc-smtp-test-input"
                  />
                  <button
                    type="button"
                    className="cc-smtp-test-btn"
                    onClick={handleTestSmtp}
                    disabled={smtpTesting}
                  >
                    {smtpTesting ? (
                      <>
                        <RefreshCw className="cc-spin" size={13} /> Testing...
                      </>
                    ) : (
                      <>
                        <Send size={13} /> Test &amp; Send Sample
                      </>
                    )}
                  </button>
                </div>

                {testFeedback && (
                  <div className={`cc-smtp-feedback-card ${testFeedback.type}`}>
                    {testFeedback.type === "success" ? (
                      <CheckCircle2 size={16} />
                    ) : (
                      <Info size={16} />
                    )}
                    <span>{testFeedback.message}</span>
                  </div>
                )}
              </div>

              {/* Action Buttons */}
              <div className="cc-etpl-modal-actions">
                <button
                  type="button"
                  className="cc-etpl-btn ghost"
                  onClick={() => setSmtpModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-etpl-btn primary"
                  disabled={smtpSaving}
                >
                  {smtpSaving ? (
                    <>
                      <RefreshCw className="cc-spin" size={14} /> Saving...
                    </>
                  ) : (
                    <>
                      <Check size={15} /> Save Email &amp; Password
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Live Sample Preview Modal */}
      {previewTemplate && (
        <div className="cc-etpl-overlay" onClick={() => setPreviewTemplate(null)}>
          <div className="cc-etpl-modal preview" onClick={(e) => e.stopPropagation()}>
            <div className="cc-etpl-modal-head">
              <div>
                <span style={{ fontSize: 11, fontWeight: 700, color: "#4338ca", textTransform: "uppercase" }}>
                  Email Rendering Preview
                </span>
                <h2 style={{ margin: "2px 0 0", fontSize: 17, color: "#0f172a" }}>
                  {previewTemplate.name}
                </h2>
              </div>
              <button type="button" className="cc-etpl-modal-close" onClick={() => setPreviewTemplate(null)}>
                <X size={17} />
              </button>
            </div>

            <div className="cc-email-preview-envelope">
              <div className="cc-email-preview-headers">
                <div className="cc-email-hdr-row">
                  <strong>From:</strong>{" "}
                  <span>
                    {smtpConfig?.user
                      ? `"${smtpConfig.senderName || 'Operations Desk'}" <${smtpConfig.user}>`
                      : "Operations Desk <operations@capitalcare.com>"}
                  </span>
                </div>
                <div className="cc-email-hdr-row">
                  <strong>To:</strong> <span>rajesh.sharma@hdfcbank.com (Bank RM)</span>
                </div>
                <div className="cc-email-hdr-row">
                  <strong>Subject:</strong>{" "}
                  <span style={{ fontWeight: 700, color: "#0f172a" }}>
                    {renderSampleText(previewTemplate.subject)}
                  </span>
                </div>
                <div className="cc-email-hdr-row">
                  <strong>Attachments:</strong>{" "}
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                    <span className="cc-etpl-sample-att-badge">📎 PAN Card (pan_card.pdf)</span>
                    <span className="cc-etpl-sample-att-badge">📎 Aadhaar Card (aadhaar.pdf)</span>
                    <span className="cc-etpl-sample-att-badge">📎 Salary Slips (salary_slips.pdf)</span>
                  </div>
                </div>
              </div>

              <div className="cc-email-preview-body">
                <div style={{ whiteSpace: "pre-wrap", fontSize: 13.5, lineHeight: 1.65, color: "#334155" }}>
                  {renderSampleText(previewTemplate.content)}
                </div>
              </div>
            </div>

            <div className="cc-etpl-modal-actions">
              <button
                type="button"
                className="cc-etpl-btn ghost"
                onClick={() => setPreviewTemplate(null)}
              >
                Close Preview
              </button>
              <button
                type="button"
                className="cc-etpl-btn primary"
                onClick={() => {
                  const t = previewTemplate;
                  setPreviewTemplate(null);
                  openEditModal(t);
                }}
              >
                <Pencil size={14} /> Edit This Template
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {deleteTarget && (
        <div className="cc-etpl-overlay" onClick={() => setDeleteTarget(null)}>
          <div className="cc-etpl-modal danger-confirm" onClick={(e) => e.stopPropagation()}>
            <div className="cc-etpl-modal-head">
              <h2 style={{ margin: 0, fontSize: 17, color: "#dc2626" }}>Delete Email Template?</h2>
              <button type="button" className="cc-etpl-modal-close" onClick={() => setDeleteTarget(null)}>
                <X size={17} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5, margin: "6px 0 0" }}>
              Are you sure you want to permanently delete <strong>"{deleteTarget.name}"</strong>?
              Operations agents will no longer be able to select this template.
            </p>
            <div className="cc-etpl-modal-actions" style={{ marginTop: 12 }}>
              <button type="button" className="cc-etpl-btn ghost" onClick={() => setDeleteTarget(null)}>
                Cancel
              </button>
              <button type="button" className="cc-etpl-btn primary danger" onClick={handleDelete}>
                <Trash2 size={14} /> Delete Template
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
  .cc-etpl-container {
    display: flex;
    flex-direction: column;
    gap: 18px;
    padding: 22px 26px 60px;
    background: #f8fafc;
    min-height: 100vh;
    box-sizing: border-box;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Helvetica, Arial, sans-serif;
  }

  .cc-etpl-header-panel {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 16px;
    background: linear-gradient(135deg, #ffffff 0%, #f8fafc 100%);
    border: 1px solid #e2e8f0;
    border-radius: 16px;
    padding: 22px 26px;
    box-shadow: 0 2px 10px rgba(15,23,42,0.03);
  }
  .cc-etpl-header-text { max-width: 780px; }
  .cc-etpl-badge-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 3px 10px;
    border-radius: 999px;
    background: #ecfdf5;
    color: #047857;
    font-size: 11.5px;
    font-weight: 700;
    margin-bottom: 8px;
    border: 1px solid #bbf7d0;
  }
  .cc-etpl-header-text h1 { margin: 0; font-size: 22px; font-weight: 800; color: #0f172a; }
  .cc-etpl-header-text p { margin: 6px 0 0; font-size: 13px; color: #64748b; line-height: 1.55; }
  .cc-etpl-header-actions {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cc-header-active-dot {
    width: 8px;
    height: 8px;
    border-radius: 50%;
    background: #10b981;
    display: inline-block;
    box-shadow: 0 0 0 2px #ecfdf5;
  }

  /* SMTP Status Banner */
  .cc-smtp-banner-wrapper { width: 100%; }
  .cc-smtp-banner {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
    padding: 14px 20px;
    border-radius: 14px;
    box-shadow: 0 2px 8px rgba(15,23,42,0.02);
  }
  .cc-smtp-banner.configured {
    background: linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%);
    border: 1px solid #a7f3d0;
  }
  .cc-smtp-banner.warning {
    background: linear-gradient(135deg, #fffbeb 0%, #fef3c7 100%);
    border: 1px solid #fde68a;
  }
  .cc-smtp-banner.loading {
    background: #f8fafc;
    border: 1px dashed #cbd5e1;
    display: flex;
    align-items: center;
    gap: 10px;
    font-size: 13px;
    color: #64748b;
  }
  .cc-smtp-banner-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }
  .cc-smtp-status-dot {
    width: 12px;
    height: 12px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .cc-smtp-status-dot.active {
    background: #10b981;
    box-shadow: 0 0 0 4px #d1fae5;
  }
  .cc-smtp-status-dot.warning {
    background: #f59e0b;
    box-shadow: 0 0 0 4px #fef3c7;
  }
  .cc-smtp-banner-title {
    font-size: 13.5px;
    font-weight: 600;
    color: #0f172a;
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cc-smtp-badge-active {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 999px;
    background: #dcfce7;
    color: #15803d;
    border: 1px solid #86efac;
  }
  .cc-smtp-banner-sub {
    font-size: 12px;
    color: #475569;
    margin-top: 3px;
  }
  .cc-smtp-banner-sub code {
    background: rgba(255,255,255,0.7);
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 11px;
  }
  .cc-smtp-banner-actions {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .cc-smtp-btn-sm {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 6px 12px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all .12s;
  }
  .cc-smtp-btn-sm.primary {
    background: #047857;
    color: #fff;
  }
  .cc-smtp-btn-sm.primary:hover {
    background: #065f46;
  }
  .cc-smtp-btn-sm.ghost {
    background: #fff;
    color: #047857;
    border-color: #a7f3d0;
  }
  .cc-smtp-btn-sm.ghost:hover {
    background: #f0fdf4;
  }
  .cc-smtp-btn-action {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 9px;
    background: #d97706;
    color: #fff;
    border: none;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    transition: all .12s;
  }
  .cc-smtp-btn-action:hover {
    background: #b45309;
    transform: translateY(-1px);
  }

  /* Tags helper bar */
  .cc-etpl-tags-bar {
    background: #fffbeb;
    border: 1px solid #fde68a;
    border-radius: 14px;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 10px;
  }
  .cc-etpl-tags-head {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cc-etpl-tags-title {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    font-weight: 700;
    color: #92400e;
  }
  .cc-etpl-tags-scroll {
    display: flex;
    flex-wrap: wrap;
    gap: 6px;
    align-items: center;
  }
  .cc-etpl-tag-chip {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 9px;
    border-radius: 8px;
    background: #ffffff;
    border: 1px solid #fcd34d;
    font-size: 11.5px;
    color: #78350f;
    cursor: pointer;
    transition: all .15s ease;
    user-select: none;
  }
  .cc-etpl-tag-chip:hover {
    background: #fef3c7;
    border-color: #f59e0b;
    transform: translateY(-1px);
  }
  .cc-etpl-tag-chip code { font-weight: 700; font-size: 11px; color: #b45309; }
  .cc-etpl-tag-chip .copy-icon { color: #d97706; opacity: 0.7; }

  /* Toolbar */
  .cc-etpl-toolbar {
    display: flex;
    flex-wrap: wrap;
    gap: 12px;
    align-items: center;
    background: #fff;
    padding: 12px 16px;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
  }
  .cc-etpl-search-shell {
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
  .cc-etpl-search-shell:focus-within {
    border-color: #047857;
    box-shadow: 0 0 0 3px rgba(4,120,87,0.12);
  }
  .cc-etpl-search-shell svg {
    position: absolute;
    left: 12px;
    color: #94a3b8;
    pointer-events: none;
  }
  .cc-etpl-search-shell input {
    flex: 1;
    border: 0;
    outline: none;
    background: transparent;
    font-size: 13px;
    color: #0f172a;
  }
  .cc-etpl-search-clear {
    border: 0;
    background: #f1f5f9;
    color: #475569;
    width: 20px;
    height: 20px;
    border-radius: 50%;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .cc-etpl-filter-select {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #475569;
    text-transform: uppercase;
  }
  .cc-etpl-filter-select select {
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 13px;
    color: #0f172a;
    background: #fff;
    height: 40px;
  }
  .cc-etpl-count-tag {
    margin-left: auto;
    font-size: 12.5px;
    font-weight: 700;
    color: #64748b;
    padding: 4px 10px;
    background: #f1f5f9;
    border-radius: 999px;
  }

  /* Grid & Cards */
  .cc-etpl-grid {
    display: grid;
    grid-template-columns: repeat(auto-fill, minmax(380px, 1fr));
    gap: 16px;
  }
  .cc-etpl-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 14px;
    padding: 18px;
    display: flex;
    flex-direction: column;
    gap: 12px;
    box-shadow: 0 2px 8px rgba(15,23,42,0.03);
    transition: all .15s ease;
    position: relative;
  }
  .cc-etpl-card:hover {
    border-color: #cbd5e1;
    box-shadow: 0 6px 16px rgba(15,23,42,0.06);
  }
  .cc-etpl-card.default {
    border-color: #fde68a;
    background: linear-gradient(180deg, #fffdfa 0%, #ffffff 100%);
  }
  
  .cc-etpl-card-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 10px;
  }
  .cc-etpl-card-title {
    margin: 0;
    font-size: 15px;
    font-weight: 700;
    color: #0f172a;
    line-height: 1.35;
  }
  .cc-etpl-default-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 7px;
    border-radius: 999px;
    background: #fef3c7;
    color: #b45309;
    font-size: 11px;
    font-weight: 700;
    border: 1px solid #fde68a;
  }
  .cc-etpl-cat-pill {
    display: inline-block;
    padding: 2px 8px;
    border-radius: 6px;
    background: #f1f5f9;
    color: #475569;
    font-size: 11px;
    font-weight: 600;
    text-transform: uppercase;
    letter-spacing: 0.04em;
  }

  .cc-etpl-card-actions {
    display: inline-flex;
    align-items: center;
    gap: 5px;
  }
  .cc-etpl-icon-btn {
    width: 30px;
    height: 30px;
    border-radius: 8px;
    border: 1px solid #e2e8f0;
    background: #fff;
    display: grid;
    place-items: center;
    color: #475569;
    cursor: pointer;
    transition: all .12s;
  }
  .cc-etpl-icon-btn:hover {
    color: #047857;
    border-color: #047857;
    background: #f0fdf4;
  }
  .cc-etpl-icon-btn.star:hover {
    color: #d97706;
    border-color: #fde68a;
    background: #fef3c7;
  }
  .cc-etpl-icon-btn.danger:hover {
    color: #dc2626;
    border-color: #dc2626;
    background: #fef2f2;
  }

  .cc-etpl-subject-preview {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 10px 12px;
  }
  .cc-etpl-subject-lbl {
    display: block;
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    margin-bottom: 2px;
  }
  .cc-etpl-subject-text {
    margin: 0;
    font-size: 13px;
    font-weight: 600;
    color: #0f172a;
    word-break: break-word;
  }

  .cc-etpl-body-preview {
    background: #fafafa;
    border: 1px dashed #cbd5e1;
    border-radius: 10px;
    padding: 10px 12px;
    max-height: 120px;
    overflow-y: auto;
  }
  .cc-etpl-body-text {
    margin: 0;
    font-size: 12px;
    font-family: inherit;
    color: #475569;
    white-space: pre-wrap;
    line-height: 1.5;
  }

  .cc-etpl-card-footer {
    margin-top: auto;
    display: flex;
    justify-content: space-between;
    align-items: center;
    border-top: 1px solid #f1f5f9;
    padding-top: 10px;
  }
  .cc-etpl-preview-link {
    border: 0;
    background: none;
    padding: 0;
    color: #047857;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .cc-etpl-preview-link:hover {
    text-decoration: underline;
    color: #065f46;
  }

  .cc-etpl-empty-card {
    grid-column: 1 / -1;
    background: #fff;
    border: 1px dashed #cbd5e1;
    border-radius: 16px;
    padding: 48px 24px;
    text-align: center;
    color: #64748b;
  }
  .cc-etpl-empty-card h3 { margin: 0; font-size: 16px; color: #0f172a; font-weight: 700; }
  .cc-etpl-empty-card p { margin: 6px auto 0; max-width: 440px; font-size: 13px; line-height: 1.5; }

  /* Modals */
  .cc-etpl-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15,23,42,0.6);
    z-index: 1000;
    display: grid;
    place-items: center;
    padding: 16px;
  }
  .cc-etpl-modal {
    width: 100%;
    max-width: 740px;
    background: #fff;
    border-radius: 18px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 20px 60px rgba(15,23,42,0.25);
    max-height: 92vh;
    overflow-y: auto;
  }
  .cc-etpl-modal.preview { max-width: 680px; }
  .cc-etpl-modal.smtp-modal { max-width: 680px; }
  .cc-etpl-modal.danger-confirm { max-width: 440px; }
  .cc-etpl-modal-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
  }
  .cc-etpl-modal-close {
    border: 0;
    background: #f1f5f9;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    cursor: pointer;
    color: #475569;
  }

  .cc-etpl-form { display: flex; flex-direction: column; gap: 14px; }
  .cc-etpl-form-row { display: flex; gap: 12px; flex-wrap: wrap; }
  .cc-etpl-field {
    display: flex;
    flex-direction: column;
    gap: 4px;
    font-size: 12px;
    color: #475569;
    font-weight: 600;
  }
  .cc-etpl-field.grow { flex: 1; min-width: 220px; }
  .cc-etpl-field input, .cc-etpl-field select {
    padding: 9px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 13px;
    color: #0f172a;
    background: #fff;
    font-family: inherit;
  }
  .cc-etpl-field input:focus, .cc-etpl-field select:focus {
    border-color: #047857;
    outline: none;
    box-shadow: 0 0 0 3px rgba(4,120,87,0.12);
  }

  .cc-input-icon-shell {
    position: relative;
    display: flex;
    align-items: center;
  }
  .cc-input-icon-shell input {
    width: 100%;
    padding-left: 36px !important;
    padding-right: 38px !important;
  }
  .input-left-icon {
    position: absolute;
    left: 12px;
    color: #94a3b8;
    pointer-events: none;
  }
  .input-eye-toggle {
    position: absolute;
    right: 10px;
    background: none;
    border: none;
    color: #64748b;
    cursor: pointer;
    display: grid;
    place-items: center;
    padding: 4px;
  }
  .input-eye-toggle:hover { color: #0f172a; }

  .cc-saved-pwd-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11px;
    color: #047857;
    font-weight: 600;
  }

  /* SMTP Specific Styles */
  .cc-smtp-icon-box {
    width: 44px;
    height: 44px;
    border-radius: 12px;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    display: grid;
    place-items: center;
  }
  .cc-smtp-service-tabs {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 10px;
    background: #f1f5f9;
    padding: 4px;
    border-radius: 12px;
  }
  .cc-smtp-tab {
    display: flex;
    align-items: center;
    justify-content: center;
    gap: 8px;
    padding: 10px 14px;
    border-radius: 9px;
    border: 1px solid transparent;
    background: transparent;
    font-size: 12.5px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    transition: all .15s;
  }
  .cc-smtp-tab.active {
    background: #ffffff;
    color: #0f172a;
    border-color: #cbd5e1;
    box-shadow: 0 2px 6px rgba(15,23,42,0.06);
  }

  .cc-smtp-guide-box {
    background: #fffdf5;
    border: 1px solid #fde68a;
    border-radius: 12px;
    padding: 14px 18px;
  }
  .cc-smtp-guide-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #92400e;
    margin-bottom: 6px;
  }
  .cc-smtp-guide-steps {
    margin: 0;
    padding-left: 18px;
    font-size: 12px;
    color: #78350f;
    line-height: 1.6;
  }
  .cc-smtp-guide-steps li { margin-bottom: 3px; }
  .cc-smtp-guide-steps code {
    background: #fef3c7;
    padding: 1px 4px;
    border-radius: 4px;
    font-weight: 700;
  }
  .cc-smtp-ext-link {
    color: #047857;
    font-weight: 700;
    text-decoration: underline;
    display: inline-flex;
    align-items: center;
    gap: 3px;
  }

  .cc-smtp-advanced-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px;
  }
  .cc-smtp-toggle-adv-btn {
    border: 0;
    background: none;
    color: #4338ca;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 5px;
    align-self: flex-start;
  }
  .cc-smtp-toggle-adv-btn:hover { text-decoration: underline; }

  .cc-smtp-test-section {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .cc-smtp-test-head {
    display: flex;
    align-items: center;
    gap: 6px;
    font-size: 12.5px;
    color: #1e293b;
  }
  .cc-smtp-test-input-row {
    display: flex;
    gap: 8px;
  }
  .cc-smtp-test-input {
    flex: 1;
    padding: 8px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    font-size: 12.5px;
  }
  .cc-smtp-test-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    background: #047857;
    color: #fff;
    border: none;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
    white-space: nowrap;
  }
  .cc-smtp-test-btn:disabled { opacity: 0.6; cursor: not-allowed; }
  .cc-smtp-feedback-card {
    padding: 10px 12px;
    border-radius: 8px;
    font-size: 12px;
    line-height: 1.45;
    display: flex;
    align-items: flex-start;
    gap: 8px;
  }
  .cc-smtp-feedback-card.success {
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    color: #065f46;
  }
  .cc-smtp-feedback-card.error {
    background: #fef2f2;
    border: 1px solid #fecaca;
    color: #991b1b;
  }

  /* Field blocks */
  .cc-etpl-field-block { display: flex; flex-direction: column; gap: 6px; }
  .cc-etpl-field-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cc-etpl-field-title span { display: block; font-size: 12px; font-weight: 700; color: #334155; }
  .cc-etpl-field-title small { display: block; font-size: 11px; color: #64748b; font-weight: 400; }
  .cc-etpl-quick-tags { display: inline-flex; align-items: center; gap: 5px; flex-wrap: wrap; }
  .cc-etpl-insert-btn {
    border: 1px dashed #cbd5e1;
    background: #f8fafc;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 11px;
    color: #047857;
    font-weight: 600;
    cursor: pointer;
    transition: all .12s;
  }
  .cc-etpl-insert-btn:hover { background: #ecfdf5; border-color: #047857; }

  .cc-etpl-field-block input, .cc-etpl-field-block textarea {
    width: 100%;
    box-sizing: border-box;
    padding: 10px 12px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 13px;
    color: #0f172a;
    font-family: inherit;
    line-height: 1.5;
    resize: vertical;
  }
  .cc-etpl-field-block input:focus, .cc-etpl-field-block textarea:focus {
    border-color: #047857;
    outline: none;
    box-shadow: 0 0 0 3px rgba(4,120,87,0.12);
  }

  .cc-etpl-checkbox-label {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    font-size: 13px;
    color: #334155;
    font-weight: 500;
    cursor: pointer;
  }
  .cc-etpl-checkbox-label input { width: 16px; height: 16px; cursor: pointer; accent-color: #047857; }

  .cc-email-preview-envelope {
    border: 1px solid #cbd5e1;
    border-radius: 12px;
    overflow: hidden;
    background: #fff;
    box-shadow: 0 4px 12px rgba(15,23,42,0.06);
  }
  .cc-email-preview-headers {
    background: #f8fafc;
    border-bottom: 1px solid #e2e8f0;
    padding: 14px 18px;
    display: flex;
    flex-direction: column;
    gap: 6px;
    font-size: 12.5px;
  }
  .cc-email-hdr-row { display: flex; gap: 8px; }
  .cc-email-hdr-row strong { color: #64748b; min-width: 80px; }
  .cc-etpl-sample-att-badge {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 2px 8px;
    border-radius: 6px;
    background: #ecfdf5;
    color: #047857;
    font-weight: 600;
    font-size: 11.5px;
    border: 1px solid #bbf7d0;
  }
  .cc-email-preview-body { padding: 20px; background: #fff; max-height: 340px; overflow-y: auto; }

  .cc-etpl-modal-actions { display: flex; justify-content: flex-end; gap: 10px; margin-top: 10px; }
  .cc-etpl-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 10px;
    font-size: 13px;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all .12s;
  }
  .cc-etpl-btn.primary { background: #047857; color: #fff; }
  .cc-etpl-btn.primary:hover { background: #065f46; }
  .cc-etpl-btn.secondary { background: #ffffff; color: #047857; border-color: #a7f3d0; }
  .cc-etpl-btn.secondary:hover { background: #ecfdf5; border-color: #047857; }
  .cc-etpl-btn.primary.danger { background: #dc2626; }
  .cc-etpl-btn.primary.danger:hover { background: #b91c1c; }
  .cc-etpl-btn.ghost { background: #fff; color: #0f172a; border-color: #cbd5e1; }
  .cc-etpl-btn.ghost:hover { background: #f8fafc; }
`;
