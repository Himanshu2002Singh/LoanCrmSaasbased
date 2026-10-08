import React, { useState, useEffect } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  X,
  Link,
  Copy,
  Share2,
  CheckCircle2,
  ExternalLink,
  Plus,
  Trash2,
  Sparkles,
  Clock,
  ShieldCheck,
  Send,
  MessageSquare,
  FileCheck,
  Check,
  Mail,
} from "lucide-react";
import API_URL, { CLIENT_PORTAL_URL } from "../../config";

export default function LeadDocumentRequestModal({
  isOpen,
  onClose,
  lead,
  onSuccess,
}) {
  const [loadingConfig, setLoadingConfig] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [presets, setPresets] = useState({});
  const [masterDocs, setMasterDocs] = useState([]);
  const [selectedDocs, setSelectedDocs] = useState([]);
  const [customDocTitle, setCustomDocTitle] = useState("");
  const [customDocCategory, setCustomDocCategory] = useState("OTHER");
  const [expiryDays, setExpiryDays] = useState(7);
  const [customMessage, setCustomMessage] = useState("");
  const [generatedResult, setGeneratedResult] = useState(null);
  const [copiedLink, setCopiedLink] = useState(false);
  const [copiedMsg, setCopiedMsg] = useState(false);
  const [customerEmail, setCustomerEmail] = useState("");
  const [sendAlsoEmail, setSendAlsoEmail] = useState(true);
  const [sendingEmail, setSendingEmail] = useState(false);
  const [emailSentSuccess, setEmailSentSuccess] = useState(false);

  useEffect(() => {
    if (lead?.customer?.email) {
      setCustomerEmail(lead.customer.email);
    }
  }, [lead]);

  // Fetch document config and presets
  const fetchConfigs = async () => {
    try {
      setLoadingConfig(true);
      const token = localStorage.getItem("token");
      const res = await axios.get(`${API_URL}/document-requests/config-docs`, {
        headers: { Authorization: `Bearer ${token}` },
      });

      if (res.data?.success) {
        setPresets(res.data.presets || {});
        setMasterDocs(res.data.masterDocs || []);

        // Default: match lead loanType to preset if possible
        const loanTypeUpper = String(lead?.loanType || "").toUpperCase();
        if (loanTypeUpper.includes("BUSINESS") || loanTypeUpper.includes("MSME")) {
          applyPreset(res.data.presets?.BUSINESS || []);
        } else if (
          loanTypeUpper.includes("HOME") ||
          loanTypeUpper.includes("PROPERTY") ||
          loanTypeUpper.includes("LAP")
        ) {
          applyPreset(res.data.presets?.PROPERTY || []);
        } else {
          // Default to Salaried / Personal loan preset
          applyPreset(res.data.presets?.SALARIED || []);
        }
      }
    } catch (err) {
      console.error("Config fetch error:", err);
      toast.error("Could not load document presets");
    } finally {
      setLoadingConfig(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      setGeneratedResult(null);
      setCopiedLink(false);
      setCopiedMsg(false);
      setCustomDocTitle("");
      setExpiryDays(7);
      setCustomMessage(
        `Hi ${lead?.customer?.name || "Customer"}, please upload the requested documents to process your ${
          lead?.loanType || "loan"
        } application.`
      );
      fetchConfigs();
    }
  }, [isOpen, lead]);

  const applyPreset = (presetDocs) => {
    if (!Array.isArray(presetDocs)) return;
    setSelectedDocs(
      presetDocs.map((doc, idx) => ({
        id: `slot_${idx}_${Date.now()}`,
        title: doc.title,
        docType: doc.docType,
        category: doc.category || "KYC",
        isRequired: doc.isRequired !== false,
        description: doc.description || "",
      }))
    );
  };

  const handleToggleDoc = (doc) => {
    const exists = selectedDocs.some(
      (d) => d.docType === doc.docType || d.title.toLowerCase() === doc.title.toLowerCase()
    );
    if (exists) {
      setSelectedDocs(
        selectedDocs.filter(
          (d) => d.docType !== doc.docType && d.title.toLowerCase() !== doc.title.toLowerCase()
        )
      );
    } else {
      setSelectedDocs([
        ...selectedDocs,
        {
          id: `slot_${Date.now()}_${selectedDocs.length}`,
          title: doc.title,
          docType: doc.docType,
          category: doc.category || "KYC",
          isRequired: true,
          description: doc.description || "",
        },
      ]);
    }
  };

  const handleToggleRequired = (docIndex) => {
    setSelectedDocs((prev) =>
      prev.map((d, idx) => (idx === docIndex ? { ...d, isRequired: !d.isRequired } : d))
    );
  };

  const handleRemoveDoc = (docIndex) => {
    setSelectedDocs((prev) => prev.filter((_, idx) => idx !== docIndex));
  };

  const handleAddCustomDoc = (e) => {
    e.preventDefault();
    if (!customDocTitle.trim()) return;

    const newDoc = {
      id: `custom_${Date.now()}`,
      title: customDocTitle.trim(),
      docType: customDocTitle.trim().toUpperCase().replace(/\s+/g, "_"),
      category: customDocCategory,
      isRequired: true,
      description: "Custom requested document",
    };

    setSelectedDocs([...selectedDocs, newDoc]);
    setCustomDocTitle("");
  };

  // Generate the upload link
  const handleGenerateLink = async () => {
    if (selectedDocs.length === 0) {
      toast.error("Please select at least one document to request from the customer");
      return;
    }

    try {
      setSubmitting(true);
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/document-requests`,
        {
          leadId: lead.id,
          title: `${lead.loanType || "Loan"} Document Verification`,
          requiredDocs: selectedDocs,
          expiryDays,
          customMessage,
        },
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (res.data?.success) {
        const reqData = res.data.data;
        const baseUrl = CLIENT_PORTAL_URL || "https://loan-crm-saasbased.vercel.app";
        const uploadUrl = `${baseUrl.replace(/\/+$/, "")}/upload-docs/${reqData.token}`;
        const finalWhatsappText = (reqData.whatsappMessageTemplate || "").replace(
          "{{UPLOAD_URL}}",
          uploadUrl
        );

        setGeneratedResult({
          ...reqData,
          uploadUrl,
          finalWhatsappText,
        });

        toast.success("Unique secure upload link generated!");
        if (onSuccess) onSuccess();
      }
    } catch (err) {
      console.error("Generate error:", err);
      toast.error(err.response?.data?.message || "Failed to generate link");
    } finally {
      setSubmitting(false);
    }
  };

  // Copy helpers
  const handleCopyLink = () => {
    if (!generatedResult?.uploadUrl) return;
    navigator.clipboard.writeText(generatedResult.uploadUrl);
    setCopiedLink(true);
    toast.success("Upload Link copied to clipboard!");
    setTimeout(() => setCopiedLink(false), 2500);
  };

  const handleCopyWhatsappText = () => {
    if (!generatedResult?.finalWhatsappText) return;
    navigator.clipboard.writeText(generatedResult.finalWhatsappText);
    setCopiedMsg(true);
    toast.success("WhatsApp message copied!");
    setTimeout(() => setCopiedMsg(false), 2500);
  };

  const handleOpenWhatsapp = () => {
    if (!generatedResult?.finalWhatsappText) return;
    let phone = (lead?.customer?.mobile || "").replace(/[^0-9]/g, "");
    if (phone.length === 10) phone = `91${phone}`;

    const encoded = encodeURIComponent(generatedResult.finalWhatsappText);
    const waUrl = phone
      ? `https://wa.me/${phone}?text=${encoded}`
      : `https://wa.me/?text=${encoded}`;

    window.open(waUrl, "_blank");
  };

  const handleSendEmail = async () => {
    if (!customerEmail.trim()) {
      toast.warning("Please enter a customer email address");
      return;
    }
    if (!generatedResult?.id) return;

    setSendingEmail(true);
    try {
      const token = localStorage.getItem("token");
      const res = await axios.post(
        `${API_URL}/document-requests/${generatedResult.id}/send-email`,
        { recipientEmail: customerEmail.trim() },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.data?.success) {
        setEmailSentSuccess(true);
        toast.success(res.data.message || `Upload link successfully emailed to ${customerEmail}!`);
      }
    } catch (err) {
      console.error("Email send error:", err);
      toast.error(err.response?.data?.message || "Failed to send email to customer");
    } finally {
      setSendingEmail(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-sm animate-fadeIn">
      <div className="bg-white border border-slate-200 rounded-2xl w-full max-w-2xl max-h-[90vh] flex flex-col shadow-2xl overflow-hidden text-slate-900">
        {/* Header */}
        <div className="px-5 py-4 border-b border-slate-200 flex items-center justify-between bg-white">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-blue-50 text-blue-600 border border-blue-100 flex items-center justify-center">
              <Link size={18} />
            </div>
            <div>
              <h3 className="font-bold text-slate-900 text-base leading-tight">
                {generatedResult ? "Share Document Upload Link" : "Create Customer Document Upload Link"}
              </h3>
              <p className="text-xs text-slate-500 font-medium">
                Lead #{lead?.id} &bull; {lead?.customer?.name || "Customer"} ({lead?.loanType || "Loan"})
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="flex-1 overflow-y-auto p-5 space-y-5 bg-white">
          {generatedResult ? (
            /* STEP 2: SHARE GENERATED LINK */
            <div className="space-y-5 animate-fadeIn">
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
                <CheckCircle2 size={24} className="text-emerald-600 shrink-0" />
                <div>
                  <h4 className="font-bold text-emerald-800 text-sm">
                    Link Generated Successfully!
                  </h4>
                  <p className="text-xs text-emerald-700 mt-0.5">
                    Customer can open this link on their mobile or desktop to upload documents directly without needing a CRM password.
                  </p>
                </div>
              </div>

              {/* Unique Link Box */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-1.5">
                  Secure Customer Upload Link
                </label>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    readOnly
                    value={generatedResult.uploadUrl}
                    className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-blue-700 font-mono select-all focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleCopyLink}
                    className={`px-4 py-2.5 rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shrink-0 ${
                      copiedLink
                        ? "bg-emerald-600 text-white"
                        : "bg-blue-600 hover:bg-blue-700 text-white shadow-sm"
                    }`}
                  >
                    {copiedLink ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedLink ? "Copied!" : "Copy Link"}</span>
                  </button>
                  <a
                    href={generatedResult.uploadUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="p-2.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-slate-700 transition-all border border-slate-300"
                    title="Open Customer View"
                  >
                    <ExternalLink size={16} />
                  </a>
                </div>
              </div>

              {/* Instant WhatsApp Share */}
              <div className="bg-emerald-50/60 border border-emerald-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-emerald-800 font-bold text-sm">
                    <MessageSquare size={16} className="text-emerald-600" />
                    <span>One-Click WhatsApp Sharing</span>
                  </div>
                  {lead?.customer?.mobile && (
                    <span className="text-xs text-slate-500 font-mono font-medium">
                      Customer Phone: {lead.customer.mobile}
                    </span>
                  )}
                </div>

                <div className="bg-white border border-slate-300 rounded-lg p-3 text-xs text-slate-800 font-mono whitespace-pre-wrap max-h-36 overflow-y-auto leading-relaxed shadow-inner">
                  {generatedResult.finalWhatsappText}
                </div>

                <div className="flex items-center gap-2.5 pt-1">
                  <button
                    onClick={handleOpenWhatsapp}
                    className="flex-1 py-2.5 px-4 bg-[#25D366] hover:bg-[#20ba5a] text-slate-950 font-bold rounded-xl text-xs transition-all flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Send size={14} />
                    <span>Send directly on WhatsApp</span>
                  </button>

                  <button
                    onClick={handleCopyWhatsappText}
                    className="py-2.5 px-3.5 bg-white hover:bg-slate-100 text-slate-700 rounded-xl text-xs font-medium transition-all flex items-center gap-1.5 border border-slate-300 shadow-sm"
                  >
                    {copiedMsg ? <Check size={14} /> : <Copy size={14} />}
                    <span>{copiedMsg ? "Copied" : "Copy Text"}</span>
                  </button>
                </div>
              </div>

              {/* Instant Email Notification */}
              <div className="bg-blue-50/60 border border-blue-200 rounded-xl p-4 space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-blue-900 font-bold text-sm">
                    <Mail size={16} className="text-blue-600" />
                    <span>Email Document Request to Customer</span>
                  </div>
                  {emailSentSuccess && (
                    <span className="text-[11px] font-bold text-emerald-700 bg-emerald-100 px-2.5 py-0.5 rounded-full flex items-center gap-1">
                      <Check size={11} /> Sent Successfully
                    </span>
                  )}
                </div>

                <p className="text-xs text-slate-600 leading-relaxed">
                  Sends an official email with company branding, requested document checklist, and a secure 1-click upload link to the customer.
                </p>

                <div className="flex items-center gap-2">
                  <input
                    type="email"
                    placeholder="customer@example.com"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    className="flex-1 bg-white border border-slate-300 rounded-xl px-3.5 py-2 text-xs text-slate-900 focus:outline-none focus:border-blue-500"
                  />
                  <button
                    onClick={handleSendEmail}
                    disabled={sendingEmail || !customerEmail.trim()}
                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white font-bold rounded-xl text-xs transition-all flex items-center gap-1.5 shrink-0 shadow-sm"
                  >
                    <Send size={13} className={sendingEmail ? "animate-spin" : ""} />
                    <span>{sendingEmail ? "Sending..." : "Send via Email"}</span>
                  </button>
                </div>
              </div>

              {/* Summary of Selected Documents */}
              <div className="border border-slate-200 rounded-xl p-3.5 bg-slate-50">
                <div className="text-xs font-bold text-slate-700 mb-2 flex items-center justify-between">
                  <span>Requested Documents ({selectedDocs.length}):</span>
                  {expiryDays > 0 && (
                    <span className="text-amber-700 text-[11px] font-semibold flex items-center gap-1">
                      <Clock size={11} /> Valid for {expiryDays} days
                    </span>
                  )}
                </div>
                <div className="flex flex-wrap gap-1.5">
                  {selectedDocs.map((d, i) => (
                    <span
                      key={i}
                      className="px-2.5 py-1 rounded-lg text-xs bg-white border border-slate-200 text-slate-700 font-medium flex items-center gap-1 shadow-sm"
                    >
                      <FileCheck size={12} className="text-blue-600" />
                      <span>{d.title}</span>
                      {d.isRequired && <span className="text-rose-600 text-[10px] font-bold">*</span>}
                    </span>
                  ))}
                </div>
              </div>
            </div>
          ) : (
            /* STEP 1: SELECT DOCUMENTS & CONFIGURE LINK */
            <div className="space-y-5">
              {/* Presets Bar */}
              <div>
                <label className="text-xs font-bold text-slate-700 uppercase tracking-wider block mb-2 flex items-center gap-1.5">
                  <Sparkles size={13} className="text-amber-500" />
                  <span>Quick Templates (Click to Auto-fill)</span>
                </label>
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => applyPreset(presets.SALARIED)}
                    className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 border border-blue-200 text-xs font-semibold transition-all"
                  >
                    💼 Salaried Loan
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(presets.BUSINESS)}
                    className="px-3 py-1.5 rounded-lg bg-purple-50 hover:bg-purple-100 text-purple-700 border border-purple-200 text-xs font-semibold transition-all"
                  >
                    🏢 Business Loan
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(presets.PROPERTY)}
                    className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 text-xs font-semibold transition-all"
                  >
                    🏠 Property / LAP
                  </button>
                  <button
                    type="button"
                    onClick={() => applyPreset(presets.BASIC_KYC)}
                    className="px-3 py-1.5 rounded-lg bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200 text-xs font-semibold transition-all"
                  >
                    🪪 Basic KYC
                  </button>
                  <button
                    type="button"
                    onClick={() => setSelectedDocs([])}
                    className="px-2.5 py-1.5 rounded-lg bg-slate-100 hover:bg-slate-200 text-slate-600 hover:text-slate-900 text-xs font-medium transition-all ml-auto"
                  >
                    Clear All
                  </button>
                </div>
              </div>

              {/* Selected Documents Checklist */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                    Selected Documents to Request ({selectedDocs.length})
                  </label>
                  <span className="text-[11px] text-slate-500 font-medium">
                    Click *Required to toggle mandatory status
                  </span>
                </div>

                {selectedDocs.length === 0 ? (
                  <div className="border border-dashed border-slate-300 rounded-xl p-6 text-center text-xs text-slate-500 bg-slate-50">
                    No documents selected yet. Choose a preset above or add documents below.
                  </div>
                ) : (
                  <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                    {selectedDocs.map((doc, idx) => (
                      <div
                        key={idx}
                        className="flex items-center justify-between bg-slate-50 border border-slate-200 rounded-xl px-3 py-2 text-xs"
                      >
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileCheck size={14} className="text-blue-600 shrink-0" />
                          <span className="font-semibold text-slate-900 truncate">{doc.title}</span>
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-white border border-slate-200 text-slate-600 font-medium">
                            {doc.category || "KYC"}
                          </span>
                        </div>

                        <div className="flex items-center gap-2 shrink-0">
                          <button
                            type="button"
                            onClick={() => handleToggleRequired(idx)}
                            className={`px-2 py-0.5 rounded text-[10px] font-bold transition-all ${
                              doc.isRequired
                                ? "bg-rose-50 text-rose-700 border border-rose-200"
                                : "bg-slate-100 text-slate-600 border border-slate-200"
                            }`}
                          >
                            {doc.isRequired ? "Mandatory *" : "Optional"}
                          </button>
                          <button
                            type="button"
                            onClick={() => handleRemoveDoc(idx)}
                            className="p-1 text-slate-400 hover:text-rose-600 transition-all"
                            title="Remove"
                          >
                            <Trash2 size={13} />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              {/* Add Custom Document */}
              <form onSubmit={handleAddCustomDoc} className="flex gap-2">
                <input
                  type="text"
                  placeholder="+ Add another document title (e.g. Electricity Bill, Rent Agreement...)"
                  value={customDocTitle}
                  onChange={(e) => setCustomDocTitle(e.target.value)}
                  className="flex-1 bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                />
                <select
                  value={customDocCategory}
                  onChange={(e) => setCustomDocCategory(e.target.value)}
                  className="bg-white border border-slate-300 rounded-xl px-2.5 py-2 text-xs text-slate-700 font-medium focus:outline-none focus:border-blue-500"
                >
                  <option value="KYC">KYC</option>
                  <option value="INCOME">Income</option>
                  <option value="BANKING">Banking</option>
                  <option value="PROPERTY">Property</option>
                  <option value="BUSINESS">Business</option>
                  <option value="OTHER">Other</option>
                </select>
                <button
                  type="submit"
                  disabled={!customDocTitle.trim()}
                  className="px-3.5 py-2 rounded-xl bg-slate-100 hover:bg-slate-200 border border-slate-300 disabled:opacity-40 text-slate-800 text-xs font-semibold transition-all flex items-center gap-1"
                >
                  <Plus size={14} />
                  <span>Add</span>
                </button>
              </form>

              {/* Link Settings: Expiry & Custom Message */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 pt-2 border-t border-slate-200">
                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Link Validity / Expiry
                  </label>
                  <select
                    value={expiryDays}
                    onChange={(e) => setExpiryDays(Number(e.target.value))}
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 font-medium focus:outline-none focus:border-blue-500"
                  >
                    <option value={1}>24 Hours (1 Day)</option>
                    <option value={3}>3 Days</option>
                    <option value={7}>7 Days (Recommended)</option>
                    <option value={15}>15 Days</option>
                    <option value={30}>30 Days</option>
                    <option value={0}>No Expiry</option>
                  </select>
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Customer Email
                  </label>
                  <input
                    type="email"
                    value={customerEmail}
                    onChange={(e) => setCustomerEmail(e.target.value)}
                    placeholder="customer@email.com"
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>

                <div>
                  <label className="text-xs font-bold text-slate-700 block mb-1">
                    Custom Note for Customer
                  </label>
                  <input
                    type="text"
                    value={customMessage}
                    onChange={(e) => setCustomMessage(e.target.value)}
                    placeholder="Pre-filled note..."
                    className="w-full bg-white border border-slate-300 rounded-xl px-3 py-2 text-xs text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Footer Actions */}
        <div className="px-5 py-4 border-t border-slate-200 bg-slate-50 flex items-center justify-between">
          {generatedResult ? (
            <>
              <button
                type="button"
                onClick={() => setGeneratedResult(null)}
                className="text-xs text-slate-600 hover:text-slate-900 font-medium transition-all underline"
              >
                &larr; Create another link
              </button>
              <button
                type="button"
                onClick={onClose}
                className="py-2 px-5 bg-blue-600 hover:bg-blue-700 text-white rounded-xl text-xs font-bold transition-all shadow-sm"
              >
                Done
              </button>
            </>
          ) : (
            <>
              <div className="text-xs text-slate-500 flex items-center gap-1.5 font-medium">
                <ShieldCheck size={14} className="text-emerald-600" />
                <span>Encrypted &amp; trackable link</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={onClose}
                  className="py-2 px-4 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 hover:bg-slate-200 transition-all"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={handleGenerateLink}
                  disabled={submitting || selectedDocs.length === 0}
                  className="py-2 px-5 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-bold transition-all shadow-sm flex items-center gap-1.5"
                >
                  <Link size={14} />
                  <span>{submitting ? "Generating..." : "Generate Secure Link"}</span>
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
