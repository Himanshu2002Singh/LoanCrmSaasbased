import React, { useState, useEffect } from "react";
import { useParams } from "react-router-dom";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  ShieldCheck,
  Lock,
  Upload,
  CheckCircle2,
  AlertCircle,
  FileText,
  FileCheck,
  Eye,
  RefreshCw,
  Clock,
  Building2,
  User,
  Calendar,
  Phone,
  FileQuestion,
  Sparkles,
  HelpCircle,
  ArrowRight,
  Check,
  Download,
} from "lucide-react";
import API_URL from "../../config";

export default function CustomerDocumentUploadPortal() {
  const { token } = useParams();
  const [loading, setLoading] = useState(true);
  const [portalData, setPortalData] = useState(null);
  const [errorInfo, setErrorInfo] = useState(null);
  const [uploadingSlots, setUploadingSlots] = useState({}); // { [slotId]: boolean }
  const [customerNotes, setCustomerNotes] = useState("");
  const [savingNotes, setSavingNotes] = useState(false);

  // Fetch upload link details
  const fetchPortalData = async () => {
    try {
      setLoading(true);
      setErrorInfo(null);
      const res = await axios.get(`${API_URL}/public/document-requests/${token}`);
      if (res.data?.success) {
        setPortalData(res.data.data);
      } else {
        setErrorInfo({ title: "Link Not Found", message: "This document upload link could not be loaded." });
      }
    } catch (err) {
      console.error("Portal error:", err);
      const status = err.response?.status;
      const data = err.response?.data;
      if (status === 410) {
        setErrorInfo({
          title: data?.code === "LINK_EXPIRED" ? "Upload Link Expired" : "Link Deactivated",
          message: data?.message || "This link is no longer active. Please contact your loan manager.",
          isExpired: true,
          company: data?.company,
        });
      } else if (status === 404) {
        setErrorInfo({
          title: "Invalid Upload Link",
          message: "The requested upload link was not found. Please verify the URL or contact your loan manager.",
        });
      } else {
        setErrorInfo({
          title: "Temporary Error",
          message: "Unable to load document request. Please refresh or try again later.",
        });
      }
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (token) {
      fetchPortalData();
    }
  }, [token]);

  // Handle uploading file(s) for a specific slot
  const handleFileUpload = async (slot, filesInput) => {
    if (!filesInput) return;
    const files = Array.isArray(filesInput)
      ? filesInput
      : filesInput instanceof FileList
      ? Array.from(filesInput)
      : [filesInput];
    if (files.length === 0) return;

    // Check size limit: 25MB
    const maxSize = 25 * 1024 * 1024;
    for (const file of files) {
      if (file.size > maxSize) {
        toast.error(`"${file.name}" exceeds 25MB limit. Please upload a smaller file.`);
        return;
      }
    }

    const slotId = slot.id;
    setUploadingSlots((prev) => ({ ...prev, [slotId]: true }));

    const formData = new FormData();
    files.forEach((f) => formData.append("files", f));
    formData.append("docSlotId", slot.id);
    formData.append("docType", slot.docType);
    formData.append("docTitle", slot.title);

    try {
      const res = await axios.post(
        `${API_URL}/public/document-requests/${token}/upload`,
        formData,
        { headers: { "Content-Type": "multipart/form-data" } }
      );

      if (res.data?.success) {
        toast.success(`"${slot.title}" uploaded successfully!`);
        await fetchPortalData();
      }
    } catch (err) {
      console.error("Upload error:", err);
      toast.error(err.response?.data?.message || "Failed to upload document. Please try again.");
    } finally {
      setUploadingSlots((prev) => ({ ...prev, [slotId]: false }));
    }
  };

  // Submit optional customer notes
  const handleSubmitNotes = async (e) => {
    e.preventDefault();
    if (!customerNotes.trim()) return;

    setSavingNotes(true);
    try {
      const res = await axios.post(`${API_URL}/public/document-requests/${token}/submit-notes`, {
        customerNotes,
      });
      if (res.data?.success) {
        toast.success("Notes saved for your loan manager!");
        setCustomerNotes("");
      }
    } catch (err) {
      toast.error("Failed to submit notes.");
    } finally {
      setSavingNotes(false);
    }
  };

  // Compute file full URL helper
  const getFileUrl = (url) => {
    if (!url) return "#";
    if (url.startsWith("http")) return url;
    return `${API_URL.replace(/\/api\/?$/, "")}${url}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
        <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin mb-4"></div>
        <h2 className="text-lg font-semibold text-slate-800">Loading Secure Document Portal...</h2>
        <p className="text-slate-500 text-sm mt-1">Connecting with loan verification system...</p>
      </div>
    );
  }

  if (errorInfo) {
    return (
      <div className="min-h-screen bg-slate-50 text-slate-800 flex flex-col items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 text-center shadow-lg">
          <div className="w-14 h-14 bg-red-50 text-red-500 border border-red-200 rounded-2xl flex items-center justify-center mx-auto mb-4">
            <AlertCircle size={28} />
          </div>
          <h2 className="text-xl font-bold text-slate-900 mb-2">{errorInfo.title}</h2>
          <p className="text-slate-600 text-sm mb-6 leading-relaxed">{errorInfo.message}</p>

          {errorInfo.company && (
            <div className="bg-slate-50 rounded-xl p-4 text-left border border-slate-200 mb-6 text-sm">
              <p className="text-slate-500 text-xs font-semibold uppercase tracking-wider mb-2">
                Need Help? Contact Loan Team:
              </p>
              <div className="font-semibold text-slate-800">{errorInfo.company.name}</div>
              {errorInfo.company.phone && (
                <div className="text-slate-600 text-xs mt-1 flex items-center gap-1.5">
                  <Phone size={12} className="text-blue-600" /> {errorInfo.company.phone}
                </div>
              )}
            </div>
          )}

          <button
            onClick={() => window.location.reload()}
            className="w-full py-2.5 px-4 bg-slate-900 hover:bg-slate-800 text-white rounded-xl font-medium text-sm transition-all flex items-center justify-center gap-2"
          >
            <RefreshCw size={15} />
            <span>Try Again</span>
          </button>
        </div>
      </div>
    );
  }

  const { requiredDocs = [], totalDocs = 0, uploadedDocs = 0, company, leadSummary } = portalData || {};
  const progressPercent = totalDocs > 0 ? Math.round((uploadedDocs / totalDocs) * 100) : 0;
  const isAllCompleted = totalDocs > 0 && uploadedDocs === totalDocs;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col font-sans">
      <ToastContainer position="top-center" autoClose={3000} theme="light" />

      {/* Top Security Banner */}
      <div className="bg-blue-50/90 border-b border-blue-100 py-2 px-4 text-xs font-medium text-center text-blue-900 flex items-center justify-center gap-2">
        <Lock size={13} className="text-emerald-600" />
        <span>Bank-Grade 256-Bit SSL Encrypted &bull; Official Loan Document Portal</span>
      </div>

      {/* Header with Company Logo and Name */}
      <header className="border-b border-slate-200 bg-white sticky top-0 z-30 px-4 sm:px-8 py-3.5 flex items-center justify-between shadow-sm">
        <div className="flex items-center gap-3">
          {company?.logoUrl ? (
            <img
              src={getFileUrl(company.logoUrl)}
              alt={company.name}
              className="h-9 w-auto max-w-[150px] object-contain rounded"
            />
          ) : (
            <div className="w-10 h-10 rounded-xl bg-blue-600 flex items-center justify-center text-white font-bold shadow-sm">
              <Building2 size={20} />
            </div>
          )}
          <div>
            <h1 className="font-bold text-slate-900 text-base sm:text-lg leading-tight">
              {company?.name || "Financial Services CRM"}
            </h1>
            <p className="text-xs text-slate-500 font-medium">Document Collection &amp; Verification Hub</p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <div className="hidden sm:flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs font-semibold">
            <ShieldCheck size={14} className="text-emerald-600" />
            <span>Secure Link Active</span>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="flex-1 max-w-4xl w-full mx-auto px-4 py-6 sm:py-8 flex flex-col gap-6">
        {/* Customer & Loan Overview Card */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 sm:p-6 shadow-sm relative overflow-hidden">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-100 pb-5">
            <div>
              <div className="text-xs text-blue-600 font-bold uppercase tracking-wider mb-1 flex items-center gap-1.5">
                <Sparkles size={13} /> Loan Application #{leadSummary?.leadId || "REF"}
              </div>
              <h2 className="text-xl sm:text-2xl font-bold text-slate-900">
                Welcome, {leadSummary?.customerName || "Customer"}
              </h2>
              <p className="text-slate-600 text-xs sm:text-sm mt-0.5">
                Facility Applied: <strong className="text-slate-900">{leadSummary?.loanType || "Loan Facility"}</strong>
                {leadSummary?.requiredAmount && (
                  <span> &bull; ₹{Number(leadSummary.requiredAmount).toLocaleString("en-IN")}</span>
                )}
              </p>
            </div>

            {portalData?.expiresAt && (
              <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 border border-amber-200 px-3 py-1.5 rounded-xl self-start sm:self-auto font-medium">
                <Clock size={14} className="text-amber-600" />
                <span>
                  Valid till:{" "}
                  {new Date(portalData.expiresAt).toLocaleDateString("en-IN", {
                    day: "numeric",
                    month: "short",
                    year: "numeric",
                  })}
                </span>
              </div>
            )}
          </div>

          {/* Custom Message from Loan Officer */}
          {portalData?.customMessage && (
            <div className="mt-4 p-3.5 bg-blue-50 border border-blue-200 rounded-xl text-xs sm:text-sm text-blue-900 leading-relaxed">
              <strong className="font-semibold">Note from Loan Team:</strong> {portalData.customMessage}
            </div>
          )}

          {/* Progress Bar */}
          <div className="mt-5">
            <div className="flex items-center justify-between text-xs sm:text-sm font-medium mb-2">
              <span className="text-slate-700 font-medium">
                Uploaded: <strong className="text-slate-900 font-bold">{uploadedDocs}</strong> of{" "}
                <strong className="text-slate-900 font-bold">{totalDocs}</strong> Documents
              </span>
              <span className={progressPercent === 100 ? "text-emerald-700 font-bold" : "text-blue-700 font-bold"}>
                {progressPercent}% Completed
              </span>
            </div>
            <div className="w-full h-2.5 bg-slate-100 rounded-full overflow-hidden border border-slate-200">
              <div
                className={`h-full transition-all duration-500 rounded-full ${
                  progressPercent === 100 ? "bg-emerald-500" : "bg-blue-600"
                }`}
                style={{ width: `${progressPercent}%` }}
              ></div>
            </div>
          </div>
        </div>

        {/* All Documents Completed Notification Card */}
        {isAllCompleted && (
          <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-5 sm:p-6 text-center shadow-sm">
            <div className="w-14 h-14 bg-emerald-100 text-emerald-600 border border-emerald-200 rounded-full flex items-center justify-center mx-auto mb-3">
              <CheckCircle2 size={32} />
            </div>
            <h3 className="text-lg sm:text-xl font-bold text-slate-900 mb-1">
              All Required Documents Submitted!
            </h3>
            <p className="text-slate-600 text-xs sm:text-sm max-w-lg mx-auto leading-relaxed">
              Thank you! Our operations and verification team have been automatically notified. They are now reviewing
              your application file.
            </p>
          </div>
        )}

        {/* Document Upload Slots Section */}
        <div className="flex flex-col gap-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <h3 className="text-base sm:text-lg font-bold text-slate-900 flex items-center gap-2">
              <FileCheck size={18} className="text-blue-600" />
              <span>Required Documents ({requiredDocs.length})</span>
            </h3>
            <div className="flex items-center gap-2">
              {uploadedDocs > 0 && (
                <a
                  href={`${API_URL}/public/document-requests/${token}/download-all`}
                  className="px-3 py-1.5 rounded-lg bg-emerald-50 hover:bg-emerald-100 text-emerald-700 text-xs font-bold transition-all flex items-center gap-1.5 border border-emerald-200 shadow-sm"
                  title="Download all uploaded documents in a single ZIP"
                >
                  <Download size={13} />
                  <span>Download All ({uploadedDocs})</span>
                </a>
              )}
              <span className="text-xs text-slate-500">Formats: PDF, JPG, PNG (Max 25MB)</span>
            </div>
          </div>

          <div className="grid grid-cols-1 gap-3.5">
            {requiredDocs.map((slot, index) => {
              const isUploaded = slot.status === "UPLOADED";
              const isUploading = uploadingSlots[slot.id];

              return (
                <div
                  key={slot.id || index}
                  className={`rounded-2xl border transition-all duration-200 p-4 sm:p-5 ${
                    isUploaded
                      ? "bg-white border-emerald-300 shadow-sm"
                      : "bg-white border-slate-200 hover:border-slate-300 shadow-sm"
                  }`}
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="flex items-start gap-3">
                      <div
                        className={`w-10 h-10 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                          isUploaded
                            ? "bg-emerald-100 text-emerald-700 border border-emerald-200"
                            : "bg-blue-50 text-blue-600 border border-blue-100"
                        }`}
                      >
                        {isUploaded ? <Check size={20} /> : <FileText size={20} />}
                      </div>

                      <div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <h4 className="font-semibold text-slate-900 text-sm sm:text-base">{slot.title}</h4>
                          {slot.isRequired ? (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              Mandatory *
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              Optional
                            </span>
                          )}
                          {slot.category && (
                            <span className="px-2 py-0.5 rounded-full text-[10px] font-medium bg-slate-100 text-slate-600 border border-slate-200">
                              {slot.category}
                            </span>
                          )}
                        </div>

                        {slot.description && (
                          <p className="text-xs text-slate-500 mt-1 leading-relaxed">{slot.description}</p>
                        )}
                      </div>
                    </div>

                    {/* Status Badge */}
                    <div className="self-end sm:self-center shrink-0">
                      {isUploaded ? (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                          <CheckCircle2 size={13} />
                          <span>Uploaded</span>
                        </div>
                      ) : (
                        <div className="flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-medium bg-amber-50 text-amber-700 border border-amber-200">
                          <Clock size={13} />
                          <span>Pending</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Slot Body: Either Upload Dropzone or Uploaded File Info */}
                  <div className="mt-4 pt-4 border-t border-slate-100">
                    {isUploaded ? (
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-emerald-50/50 rounded-xl p-3 border border-emerald-200">
                        <div className="flex items-center gap-2.5 overflow-hidden">
                          <FileCheck size={18} className="text-emerald-600 shrink-0" />
                          <div className="truncate">
                            <span className="text-xs font-semibold text-slate-900 truncate block">
                              {slot.fileName || "Uploaded File"}
                            </span>
                            <span className="text-[11px] text-slate-500 block">
                              {slot.fileSize ? `${(slot.fileSize / 1024).toFixed(1)} KB &bull; ` : ""}
                              Uploaded on{" "}
                              {slot.uploadedAt
                                ? new Date(slot.uploadedAt).toLocaleDateString("en-IN", {
                                    day: "numeric",
                                    month: "short",
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })
                                : "Today"}
                            </span>
                          </div>
                        </div>

                        <div className="flex items-center gap-2 shrink-0 flex-wrap">
                          {slot.fileUrl && (
                            <>
                              <a
                                href={getFileUrl(slot.fileUrl)}
                                target="_blank"
                                rel="noreferrer"
                                className="px-3 py-1.5 rounded-lg bg-white hover:bg-slate-50 text-slate-700 text-xs font-medium transition-all flex items-center gap-1.5 border border-slate-300 shadow-sm"
                                title="View document in browser"
                              >
                                <Eye size={13} />
                                <span>View</span>
                              </a>
                              <a
                                href={`${API_URL}/public/document-requests/${token}/documents/${slot.documentId || slot.id}/download`}
                                download={slot.fileName || `${slot.title || "document"}.pdf`}
                                className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-semibold transition-all flex items-center gap-1.5 border border-blue-200 shadow-sm"
                                title="Download this document"
                              >
                                <Download size={13} />
                                <span>Download</span>
                              </a>
                            </>
                          )}

                          {/* Re-upload / Replace */}
                          <label className="px-3 py-1.5 rounded-lg bg-blue-50 hover:bg-blue-100 text-blue-700 text-xs font-medium transition-all cursor-pointer flex items-center gap-1.5 border border-blue-200">
                            <RefreshCw size={12} className={isUploading ? "animate-spin" : ""} />
                            <span>{isUploading ? "Uploading..." : "Upload / Replace"}</span>
                            <input
                              type="file"
                              multiple
                              accept="image/*,application/pdf"
                              disabled={isUploading}
                              className="hidden"
                              onChange={(e) => {
                                if (e.target.files && e.target.files.length > 0) {
                                  handleFileUpload(slot, e.target.files);
                                }
                              }}
                            />
                          </label>
                        </div>
                      </div>
                    ) : (
                      <div>
                        <label
                          className={`relative flex flex-col items-center justify-center p-5 border-2 border-dashed rounded-xl transition-all cursor-pointer ${
                            isUploading
                              ? "border-blue-500 bg-blue-50/50 cursor-wait"
                              : "border-slate-300 bg-slate-50/60 hover:border-blue-500 hover:bg-blue-50/30"
                          }`}
                        >
                          <input
                            type="file"
                            multiple
                            accept="image/*,application/pdf"
                            disabled={isUploading}
                            className="hidden"
                            onChange={(e) => {
                              if (e.target.files && e.target.files.length > 0) {
                                handleFileUpload(slot, e.target.files);
                              }
                            }}
                          />

                          {isUploading ? (
                            <div className="flex flex-col items-center justify-center py-2">
                              <RefreshCw size={24} className="text-blue-600 animate-spin mb-2" />
                              <span className="text-xs font-semibold text-blue-700">
                                Uploading {slot.title}...
                              </span>
                            </div>
                          ) : (
                            <div className="flex flex-col items-center justify-center text-center">
                              <div className="w-10 h-10 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mb-2">
                                <Upload size={18} />
                              </div>
                              <span className="text-xs font-semibold text-slate-800">
                                Click to browse or take photo from phone
                              </span>
                              <span className="text-[11px] text-slate-500 mt-0.5">
                                Camera, PDF, JPG, PNG up to 25MB (multiple files supported)
                              </span>
                            </div>
                          )}
                        </label>
                      </div>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Optional Notes for Loan Officer */}
        <div className="bg-white border border-slate-200 rounded-2xl p-5 shadow-sm">
          <h4 className="text-sm font-bold text-slate-900 mb-1 flex items-center gap-1.5">
            <HelpCircle size={15} className="text-blue-600" />
            <span>Have any remarks or questions for your loan manager?</span>
          </h4>
          <p className="text-xs text-slate-500 mb-3">
            If any document is missing or you have questions, leave a message below.
          </p>

          <form onSubmit={handleSubmitNotes} className="flex flex-col gap-2.5">
            <textarea
              rows={3}
              value={customerNotes}
              onChange={(e) => setCustomerNotes(e.target.value)}
              placeholder="e.g. My latest month salary slip will be generated next Monday, uploaded last 2 months for now..."
              className="w-full bg-white border border-slate-300 rounded-xl p-3 text-xs sm:text-sm text-slate-900 placeholder-slate-400 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 transition-all resize-none"
            />
            <button
              type="submit"
              disabled={savingNotes || !customerNotes.trim()}
              className="self-end py-2 px-4 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 text-white rounded-xl text-xs font-semibold transition-all flex items-center gap-1.5 shadow-sm"
            >
              {savingNotes ? (
                <>
                  <RefreshCw size={13} className="animate-spin" />
                  <span>Saving...</span>
                </>
              ) : (
                <>
                  <span>Send Message to Team</span>
                  <ArrowRight size={13} />
                </>
              )}
            </button>
          </form>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 bg-white py-5 px-4 text-center text-xs text-slate-500 mt-auto">
        <p className="font-medium">
          &copy; {new Date().getFullYear()} {company?.name || "Financial Services CRM"}. All rights reserved.
        </p>
        <p className="text-[11px] text-slate-400 mt-1">
          Confidential financial document transmission &bull; Authorized customer verification only.
        </p>
      </footer>
    </div>
  );
}
