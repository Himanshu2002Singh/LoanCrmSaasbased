import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link } from "react-router-dom";
import axios from "axios";
import {
  StickyNote,
  Plus,
  Search,
  Pin,
  PinOff,
  Trash2,
  Edit3,
  Calendar,
  User,
  Phone,
  Link2,
  Unlink,
  ExternalLink,
  Tag,
  AlertCircle,
  Clock,
  Filter,
  RefreshCw,
  X,
  Check,
  Building,
  Coins,
  Copy,
  ChevronDown,
  ChevronUp,
  ShieldCheck,
} from "lucide-react";
import API_URL from "../../config";
import RedesignPageFrame from "../../components/RedesignPageFrame";
import { formatLeadCode } from "../../utils/leadUtils";

const COLOR_THEMES = [
  { id: "amber", name: "Amber", bg: "bg-amber-50/90", border: "border-amber-200", badge: "bg-amber-100 text-amber-800", dot: "bg-amber-400" },
  { id: "sky", name: "Sky", bg: "bg-sky-50/90", border: "border-sky-200", badge: "bg-sky-100 text-sky-800", dot: "bg-sky-400" },
  { id: "emerald", name: "Emerald", bg: "bg-emerald-50/90", border: "border-emerald-200", badge: "bg-emerald-100 text-emerald-800", dot: "bg-emerald-400" },
  { id: "purple", name: "Purple", bg: "bg-purple-50/90", border: "border-purple-200", badge: "bg-purple-100 text-purple-800", dot: "bg-purple-400" },
  { id: "rose", name: "Rose", bg: "bg-rose-50/90", border: "border-rose-200", badge: "bg-rose-100 text-rose-800", dot: "bg-rose-400" },
  { id: "slate", name: "Slate", bg: "bg-slate-50/90", border: "border-slate-200", badge: "bg-slate-100 text-slate-800", dot: "bg-slate-400" },
];

export default function NotesScreen() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("All");
  const [leadConnectedFilter, setLeadConnectedFilter] = useState("All"); // All | with_lead | without_lead

  // Create / Edit Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [formTitle, setFormTitle] = useState("");
  const [formContent, setFormContent] = useState("");
  const [formColor, setFormColor] = useState("amber");
  const [formPriority, setFormPriority] = useState("NORMAL");
  const [formIsPinned, setFormIsPinned] = useState(false);
  const [formNoteDate, setFormNoteDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [selectedLead, setSelectedLead] = useState(null);

  // Assigned Leads for current user
  const [assignedLeads, setAssignedLeads] = useState([]);
  const [loadingAssignableLeads, setLoadingAssignableLeads] = useState(false);
  const [isUserAdmin, setIsUserAdmin] = useState(false);
  const [leadSearchTerm, setLeadSearchTerm] = useState("");
  const [showLeadDropdown, setShowLeadDropdown] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  const currentUserId = parseInt(localStorage.getItem("userId") || "0", 10);
  const userRole = (localStorage.getItem("userRole") || "").toUpperCase();
  const employeeRole = (localStorage.getItem("employeeRole") || "").toLowerCase();
  const isAdminOrManager =
    ["COMPANY_ADMIN", "SUPERADMIN", "MANAGER", "OPERATIONS", "OPS"].includes(userRole) ||
    ["admin", "manager", "operations"].includes(employeeRole);

  // Load assignable leads for the current user (only their assigned leads, or all if Admin)
  const loadAssignableLeads = useCallback(async (search = "") => {
    try {
      setLoadingAssignableLeads(true);
      const res = await axios.get(`${API_URL}/notes/my-leads`, {
        params: { search: search.trim() || undefined, limit: 150 },
      });
      setAssignedLeads(res.data.data || []);
      setIsUserAdmin(Boolean(res.data.isAdmin));
    } catch (err) {
      console.error("Error fetching assignable leads:", err);
      setAssignedLeads([]);
    } finally {
      setLoadingAssignableLeads(false);
    }
  }, []);

  // Filter assigned leads locally in real-time
  const filteredAssignableLeads = useMemo(() => {
    if (!leadSearchTerm.trim()) return assignedLeads;
    const q = leadSearchTerm.toLowerCase().trim();
    return assignedLeads.filter(
      (ld) =>
        ld.customer_name?.toLowerCase().includes(q) ||
        ld.customer_mobile?.includes(q) ||
        ld.loan_type?.toLowerCase().includes(q) ||
        String(ld.id).includes(q) ||
        ld.lead_number?.toLowerCase().includes(q)
    );
  }, [assignedLeads, leadSearchTerm]);

  // Debounce server search if typed search isn't satisfied locally
  useEffect(() => {
    if (!leadSearchTerm.trim() || leadSearchTerm.trim().length < 2) return;
    const timer = setTimeout(() => {
      loadAssignableLeads(leadSearchTerm);
    }, 400);
    return () => clearTimeout(timer);
  }, [leadSearchTerm, loadAssignableLeads]);

  // Fetch Notes
  const fetchNotes = useCallback(async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/notes`);
      const data = res.data.data || [];
      setNotes(data);
    } catch (err) {
      console.error("Failed to fetch notes:", err);
      setNotes([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchNotes();
  }, [fetchNotes]);

  // Open Create Modal
  const handleOpenCreate = () => {
    setEditingNote(null);
    setFormTitle("");
    setFormContent("");
    setFormColor("amber");
    setFormPriority("NORMAL");
    setFormIsPinned(false);
    setFormNoteDate(new Date().toISOString().split("T")[0]);
    setSelectedLead(null);
    setLeadSearchTerm("");
    setShowLeadDropdown(false);
    setIsModalOpen(true);
    loadAssignableLeads("");
  };

  // Open Edit Modal
  const handleOpenEdit = (note) => {
    setEditingNote(note);
    setFormTitle(note.title || "");
    setFormContent(note.content || "");
    setFormColor(note.color || "amber");
    setFormPriority(note.priority || "NORMAL");
    setFormIsPinned(Boolean(note.isPinned));
    setFormNoteDate(note.noteDate || new Date().toISOString().split("T")[0]);

    if (note.lead) {
      setSelectedLead({
        id: note.lead.id,
        lead_id: note.lead.id,
        lead_number: formatLeadCode(note.lead),
        customer_name: note.lead.customer?.name || "Customer",
        customer_mobile: note.lead.customer?.mobile || "",
        loan_type: note.lead.loanType || "",
        loan_amount: note.lead.loanAmount || 0,
        status: note.lead.status || "",
      });
    } else {
      setSelectedLead(null);
    }
    setLeadSearchTerm("");
    setShowLeadDropdown(false);
    setIsModalOpen(true);
    loadAssignableLeads("");
  };

  // Select Lead
  const handleSelectLead = (lead) => {
    setSelectedLead({
      id: lead.lead_id || lead.id,
      lead_id: lead.lead_id || lead.id,
      lead_number: formatLeadCode(lead),
      customer_name: lead.customer_name || lead.customer?.name || lead.name || "Customer",
      customer_mobile: lead.customer_mobile || lead.customer?.mobile || lead.mobile || "",
      loan_type: lead.loan_type || lead.loanType || "",
      loan_amount: lead.loan_amount || lead.loanAmount || 0,
      status: lead.status || "",
    });
    setLeadSearchTerm("");
    setShowLeadDropdown(false);
  };

  // Remove Selected Lead
  const handleRemoveLead = () => {
    setSelectedLead(null);
    setLeadSearchTerm("");
  };

  // Save Note (Create or Update)
  const handleSubmitNote = async (e) => {
    e.preventDefault();
    if (!formTitle.trim() && !formContent.trim()) {
      alert("Please provide at least a title or note content");
      return;
    }

    try {
      setSubmitting(true);
      const payload = {
        title: formTitle.trim() || "Untitled Note",
        content: formContent.trim(),
        color: formColor,
        priority: formPriority,
        isPinned: formIsPinned,
        noteDate: formNoteDate,
        leadId: selectedLead ? (selectedLead.id || selectedLead.lead_id) : null,
      };

      if (editingNote) {
        await axios.put(`${API_URL}/notes/${editingNote.id}`, payload);
      } else {
        await axios.post(`${API_URL}/notes`, payload);
      }

      setIsModalOpen(false);
      fetchNotes();
    } catch (err) {
      console.error("Failed to save note:", err);
      alert("Failed to save note: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  // Toggle Pin directly from card
  const handleTogglePin = async (note) => {
    try {
      await axios.put(`${API_URL}/notes/${note.id}`, {
        isPinned: !note.isPinned,
      });
      fetchNotes();
    } catch (err) {
      console.error("Failed to toggle pin:", err);
    }
  };

  // Delete Note
  const handleDeleteNote = async (noteId) => {
    if (!window.confirm("Are you sure you want to delete this note?")) return;
    try {
      await axios.delete(`${API_URL}/notes/${noteId}`);
      fetchNotes();
    } catch (err) {
      console.error("Failed to delete note:", err);
      alert("Failed to delete note: " + (err.response?.data?.message || err.message));
    }
  };

  const handleCopy = (id, text) => {
    if (!text) return;
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  // Filtered Notes
  const filteredNotes = useMemo(() => {
    return notes.filter((n) => {
      // Search
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase();
        const matchesTitle = n.title?.toLowerCase().includes(q);
        const matchesContent = n.content?.toLowerCase().includes(q);
        const matchesCustomer = n.lead?.customer?.name?.toLowerCase().includes(q);
        const matchesMobile = n.lead?.customer?.mobile?.includes(q);
        const matchesLeadId = String(n.leadId || "").includes(q);
        if (!matchesTitle && !matchesContent && !matchesCustomer && !matchesMobile && !matchesLeadId) {
          return false;
        }
      }

      // Priority
      if (priorityFilter !== "All" && n.priority !== priorityFilter) {
        return false;
      }

      // Lead connection
      if (leadConnectedFilter === "with_lead" && !n.leadId) {
        return false;
      }
      if (leadConnectedFilter === "without_lead" && n.leadId) {
        return false;
      }

      return true;
    });
  }, [notes, searchQuery, priorityFilter, leadConnectedFilter]);

  const getColorTheme = (colorId) => {
    return COLOR_THEMES.find((c) => c.id === colorId) || COLOR_THEMES[0];
  };

  const formatCurrency = (amt) => {
    if (!amt) return "₹0";
    const num = Number(amt);
    if (isNaN(num)) return `₹${amt}`;
    if (num >= 10000000) return `₹${(num / 10000000).toFixed(2)} Cr`;
    if (num >= 100000) return `₹${(num / 100000).toFixed(2)} L`;
    return `₹${num.toLocaleString("en-IN")}`;
  };

  return (
    <RedesignPageFrame pageKey="notes">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1 flex-wrap">
              <span className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                <StickyNote className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold text-slate-900">Quick Notes & Lead Scratchpad</h1>
              <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-50 text-emerald-700 border border-emerald-200">
                <ShieldCheck className="w-3.5 h-3.5 text-emerald-600" />
                100% Private to You
              </span>
            </div>
            <p className="text-sm text-slate-500">
              Private quick notes & personal reminders. Only you can view or manage your notes (not visible to anyone else, including Admin).
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchNotes}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-semibold text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-amber-600" : ""}`} />
              Refresh
            </button>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2.5 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create New Note
            </button>
          </div>
        </div>

        {/* Filter Bar */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-stretch md:items-center justify-between gap-3">
          <div className="relative flex-1">
            <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
            <input
              type="text"
              placeholder="Search notes, text, client name, mobile, lead ID..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full pl-9 pr-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          <div className="flex flex-wrap items-center gap-2">
            {/* Priority Filter */}
            <select
              value={priorityFilter}
              onChange={(e) => setPriorityFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="All">All Priorities</option>
              <option value="URGENT">Urgent Priority</option>
              <option value="HIGH">High Priority</option>
              <option value="NORMAL">Normal Priority</option>
              <option value="LOW">Low Priority</option>
            </select>

            {/* Lead Connection Filter */}
            <select
              value={leadConnectedFilter}
              onChange={(e) => setLeadConnectedFilter(e.target.value)}
              className="px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
            >
              <option value="All">All Notes</option>
              <option value="with_lead">With Connected Lead</option>
              <option value="without_lead">General Notes Only</option>
            </select>

            <div className="px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 font-medium">
              Total: <span className="font-bold text-slate-900">{filteredNotes.length}</span>
            </div>
          </div>
        </div>

        {/* Notes Grid */}
        {loading ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
            <RefreshCw className="w-8 h-8 animate-spin text-amber-600 mx-auto mb-3" />
            <p className="text-sm font-medium text-slate-600">Loading your notes...</p>
          </div>
        ) : filteredNotes.length === 0 ? (
          <div className="p-16 text-center bg-white rounded-2xl border border-slate-200 shadow-sm">
            <StickyNote className="w-12 h-12 text-slate-300 mx-auto mb-3" />
            <h3 className="text-base font-semibold text-slate-800 mb-1">No notes found</h3>
            <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
              {searchQuery || priorityFilter !== "All" || leadConnectedFilter !== "All"
                ? "No notes matched your search and filter criteria."
                : "Create your first personal note or connect a lead from your pipeline."}
            </p>
            <button
              onClick={handleOpenCreate}
              className="inline-flex items-center gap-2 px-4 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus className="w-4 h-4" />
              Create Note Now
            </button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
            {filteredNotes.map((note) => {
              const theme = getColorTheme(note.color);
              const isUrgent = note.priority === "URGENT";
              const isHigh = note.priority === "HIGH";
              const canEdit = !note.userId || note.userId === currentUserId;

              return (
                <div
                  key={note.id}
                  className={`rounded-2xl p-5 border ${theme.border} ${theme.bg} shadow-xs hover:shadow-md transition-all flex flex-col justify-between relative group`}
                >
                  {/* Top Bar inside card */}
                  <div>
                    <div className="flex items-start justify-between gap-2 mb-2">
                      <div className="flex flex-wrap items-center gap-1.5">
                        {note.isPinned && (
                          <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-200 text-amber-900 border border-amber-300">
                            <Pin className="w-2.5 h-2.5 fill-current" />
                            Pinned
                          </span>
                        )}
                        <span
                          className={`inline-block px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isUrgent
                              ? "bg-rose-100 text-rose-800 border border-rose-200"
                              : isHigh
                              ? "bg-orange-100 text-orange-800 border border-orange-200"
                              : "bg-slate-100 text-slate-700"
                          }`}
                        >
                          {note.priority}
                        </span>
                        {note.noteDate && (
                          <span className="text-[11px] text-slate-500 flex items-center gap-1 font-medium">
                            <Calendar className="w-3 h-3 text-slate-400" />
                            {new Date(note.noteDate).toLocaleDateString("en-IN", {
                              day: "numeric",
                              month: "short",
                            })}
                          </span>
                        )}
                      </div>

                      {/* Card Action Icons */}
                      <div className="flex items-center gap-1 opacity-80 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => handleTogglePin(note)}
                          title={note.isPinned ? "Unpin note" : "Pin note to top"}
                          className="p-1 rounded text-slate-400 hover:text-amber-600 hover:bg-white/80"
                        >
                          {note.isPinned ? (
                            <PinOff className="w-3.5 h-3.5" />
                          ) : (
                            <Pin className="w-3.5 h-3.5" />
                          )}
                        </button>
                        {canEdit && (
                          <>
                            <button
                              onClick={() => handleOpenEdit(note)}
                              title="Edit note"
                              className="p-1 rounded text-slate-400 hover:text-indigo-600 hover:bg-white/80"
                            >
                              <Edit3 className="w-3.5 h-3.5" />
                            </button>
                            <button
                              onClick={() => handleDeleteNote(note.id)}
                              title="Delete note"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-white/80"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </>
                        )}
                      </div>
                    </div>

                    {/* Title */}
                    <h3 className="font-bold text-slate-900 text-base mb-1.5 leading-snug">
                      {note.title}
                    </h3>

                    {/* Content */}
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed mb-4">
                      {note.content}
                    </p>
                  </div>

                  {/* Bottom section: Connected Lead + Author */}
                  <div className="space-y-3 pt-3 border-t border-slate-200/60 mt-auto">
                    {/* Connected Lead Box */}
                    {note.lead ? (
                      <div className="p-3 bg-white/90 rounded-xl border border-slate-200/80 shadow-2xs space-y-1.5">
                        <div className="flex items-center justify-between">
                          <span className="inline-flex items-center gap-1 text-[11px] font-bold text-indigo-700">
                            <Link2 className="w-3 h-3" />
                            Connected Lead: #{formatLeadCode(note.lead)}
                          </span>
                          <Link
                            to={`/lead-details/${note.lead.id}`}
                            className="inline-flex items-center gap-1 px-2 py-0.5 text-[10px] font-semibold text-indigo-600 hover:text-indigo-800 bg-indigo-50 hover:bg-indigo-100 rounded-md transition-colors"
                          >
                            <span>Open</span>
                            <ExternalLink className="w-2.5 h-2.5" />
                          </Link>
                        </div>

                        <div className="text-xs font-semibold text-slate-800 flex items-center justify-between">
                          <span>{note.lead.customer?.name || "Customer"}</span>
                          {note.lead.status && (
                            <span className="text-[10px] font-medium px-1.5 py-0.2 rounded bg-slate-100 text-slate-600">
                              {note.lead.status}
                            </span>
                          )}
                        </div>

                        <div className="flex items-center justify-between text-[11px] text-slate-500">
                          <span className="flex items-center gap-1">
                            <Phone className="w-3 h-3 text-slate-400" />
                            {note.lead.customer?.mobile || "--"}
                          </span>
                          <span className="font-medium text-slate-700">
                            {note.lead.loanType} &bull; {formatCurrency(note.lead.loanAmount)}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <div className="text-[11px] text-slate-400 flex items-center gap-1 italic">
                        <Tag className="w-3 h-3 text-slate-300" />
                        General note &bull; No lead connected
                      </div>
                    )}

                    {/* Author & Footer info */}
                    <div className="flex items-center justify-between text-[10px] text-slate-500">
                      <span className="flex items-center gap-1 font-semibold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                        <ShieldCheck className="w-3 h-3 text-emerald-600" />
                        Only you
                      </span>
                      {note.createdAt && (
                        <span>
                          {new Date(note.createdAt).toLocaleTimeString("en-IN", {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </span>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Create / Edit Note Modal */}
        {isModalOpen && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-xl w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in duration-200 max-h-[90vh] overflow-y-auto">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div className="flex items-center gap-2">
                  <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                    <StickyNote className="w-5 h-5" />
                  </span>
                  <div>
                    <h3 className="text-lg font-bold text-slate-900">
                      {editingNote ? "Edit Note" : "Create New Note"}
                    </h3>
                    <p className="text-xs text-slate-500">
                      Add details, set priority, and link any client lead.
                    </p>
                  </div>
                </div>
                <button
                  onClick={() => setIsModalOpen(false)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSubmitNote} className="space-y-4">
                {/* Title */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Note Title
                  </label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Call back customer regarding salary slips, DSA follow-up..."
                    value={formTitle}
                    onChange={(e) => setFormTitle(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Content */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Note Content / Remarks
                  </label>
                  <textarea
                    rows={4}
                    placeholder="Write detailed notes, points discussed, document numbers, or next steps..."
                    value={formContent}
                    onChange={(e) => setFormContent(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Connected Lead Picker */}
                <div className="p-3.5 bg-slate-50 rounded-xl border border-slate-200 space-y-2.5">
                  <div className="flex items-center justify-between">
                    <label className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                      <Link2 className="w-3.5 h-3.5 text-indigo-600" />
                      Connect A Lead (Optional)
                    </label>
                    <div className="flex items-center gap-2">
                      {isUserAdmin ? (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-purple-100 text-purple-700">
                          <ShieldCheck className="w-3 h-3" />
                          Admin: All Leads Available
                        </span>
                      ) : (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-indigo-100 text-indigo-700">
                          <User className="w-3 h-3" />
                          My Assigned Leads ({assignedLeads.length})
                        </span>
                      )}
                      {selectedLead && (
                        <button
                          type="button"
                          onClick={handleRemoveLead}
                          className="text-[11px] font-semibold text-rose-600 hover:underline flex items-center gap-1"
                        >
                          <Unlink className="w-3 h-3" />
                          Disconnect
                        </button>
                      )}
                    </div>
                  </div>

                  {/* If lead is selected, show selected lead card */}
                  {selectedLead && (
                    <div className="p-3 bg-white rounded-xl border border-indigo-200 shadow-2xs space-y-1.5">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-bold text-indigo-700 flex items-center gap-1.5">
                          <span>{selectedLead.lead_number}</span>
                          <span className="text-slate-400">&bull;</span>
                          <span className="text-slate-800">{selectedLead.customer_name}</span>
                        </span>
                        <div className="flex items-center gap-1.5">
                          <span className="text-[10px] px-1.5 py-0.5 rounded bg-slate-100 text-slate-600 font-semibold">
                            {selectedLead.status || "Lead"}
                          </span>
                          <button
                            type="button"
                            onClick={() => setShowLeadDropdown(!showLeadDropdown)}
                            className="text-[11px] font-semibold text-indigo-600 hover:text-indigo-800 hover:underline"
                          >
                            {showLeadDropdown ? "Hide List" : "Change Lead"}
                          </button>
                        </div>
                      </div>
                      <div className="text-[11px] text-slate-500 flex items-center justify-between">
                        <span className="flex items-center gap-1">
                          <Phone className="w-3 h-3 text-slate-400" />
                          {selectedLead.customer_mobile || "--"}
                        </span>
                        <span className="font-semibold text-slate-700">
                          {selectedLead.loan_type} &bull; {formatCurrency(selectedLead.loan_amount)}
                        </span>
                      </div>
                    </div>
                  )}

                  {/* Dropdown Trigger button if no lead selected or when user clicks Change */}
                  {!selectedLead && (
                    <button
                      type="button"
                      onClick={() => setShowLeadDropdown(!showLeadDropdown)}
                      className="w-full px-3 py-2 text-xs border border-slate-300 rounded-xl bg-white text-slate-700 hover:border-indigo-400 flex items-center justify-between transition-colors shadow-2xs"
                    >
                      <span className="flex items-center gap-2">
                        <User className="w-3.5 h-3.5 text-slate-400" />
                        <span>
                          {loadingAssignableLeads
                            ? "Loading your assigned leads..."
                            : assignedLeads.length > 0
                            ? `Select from assigned leads (${assignedLeads.length} available)...`
                            : isUserAdmin
                            ? "Click to select or search company leads..."
                            : "No assigned leads found for your profile"}
                        </span>
                      </span>
                      {showLeadDropdown ? (
                        <ChevronUp className="w-4 h-4 text-slate-400" />
                      ) : (
                        <ChevronDown className="w-4 h-4 text-slate-400" />
                      )}
                    </button>
                  )}

                  {/* Dropdown Popover */}
                  {showLeadDropdown && (
                    <div className="bg-white rounded-xl border border-slate-200 shadow-xl overflow-hidden animate-in fade-in duration-150">
                      {/* Search Filter inside dropdown */}
                      <div className="p-2 border-b border-slate-100 bg-slate-50/70">
                        <div className="relative">
                          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2" />
                          <input
                            type="text"
                            placeholder="Filter assigned leads by name, phone, loan product..."
                            value={leadSearchTerm}
                            onChange={(e) => setLeadSearchTerm(e.target.value)}
                            autoFocus
                            className="w-full pl-8 pr-7 py-1.5 text-xs border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                          />
                          {leadSearchTerm && (
                            <button
                              type="button"
                              onClick={() => setLeadSearchTerm("")}
                              className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                            >
                              <X className="w-3 h-3" />
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Leads List */}
                      <div className="max-h-56 overflow-y-auto divide-y divide-slate-100">
                        {loadingAssignableLeads ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            Loading assigned leads...
                          </div>
                        ) : filteredAssignableLeads.length === 0 ? (
                          <div className="p-4 text-center text-xs text-slate-500">
                            No assigned leads found {leadSearchTerm ? `matching "${leadSearchTerm}"` : ""}.
                          </div>
                        ) : (
                          filteredAssignableLeads.map((ld) => {
                            const isSelected = selectedLead && (selectedLead.id === ld.id || selectedLead.lead_id === ld.id);
                            return (
                              <button
                                key={ld.id}
                                type="button"
                                onClick={() => handleSelectLead(ld)}
                                className={`w-full text-left p-2.5 hover:bg-indigo-50/80 transition-colors flex items-center justify-between ${
                                  isSelected ? "bg-indigo-50/50" : ""
                                }`}
                              >
                                <div className="space-y-0.5">
                                  <div className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                                    <span>{ld.customer_name}</span>
                                    {ld.customer_city && (
                                      <span className="text-[10px] text-slate-400 font-normal">
                                        ({ld.customer_city})
                                      </span>
                                    )}
                                  </div>
                                  <div className="text-[11px] text-slate-500 flex items-center gap-2">
                                    <span>{ld.customer_mobile || "No Mobile"}</span>
                                    <span>&bull;</span>
                                    <span className="font-medium text-slate-700">
                                      {ld.loan_type} ({formatCurrency(ld.loan_amount)})
                                    </span>
                                  </div>
                                </div>
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-[10px] font-bold text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded">
                                    {ld.lead_number}
                                  </span>
                                  {ld.status && (
                                    <span className="text-[9px] font-medium text-slate-500">
                                      {ld.status}
                                    </span>
                                  )}
                                </div>
                              </button>
                            );
                          })
                        )}
                      </div>

                      {/* Dropdown Footer */}
                      <div className="p-2 border-t border-slate-100 bg-slate-50/50 flex items-center justify-between text-[11px]">
                        <span className="text-slate-500">
                          {filteredAssignableLeads.length} leads listed
                        </span>
                        <div className="flex items-center gap-2">
                          {selectedLead && (
                            <button
                              type="button"
                              onClick={handleRemoveLead}
                              className="text-rose-600 hover:underline font-semibold"
                            >
                              Clear Selection
                            </button>
                          )}
                          <button
                            type="button"
                            onClick={() => setShowLeadDropdown(false)}
                            className="text-slate-600 hover:text-slate-800 font-semibold"
                          >
                            Close List
                          </button>
                        </div>
                      </div>
                    </div>
                  )}

                  <p className="text-[10px] text-slate-500">
                    {isUserAdmin
                      ? "Admin access: Aap company ki kisi bhi lead ko connect kar sakte hain."
                      : "Aap sirf apni assigned leads ko hi note ke sath connect kar sakte hain."}
                  </p>
                </div>

                {/* Priority & Date */}
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Priority Level
                    </label>
                    <select
                      value={formPriority}
                      onChange={(e) => setFormPriority(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="LOW">Low</option>
                      <option value="NORMAL">Normal</option>
                      <option value="HIGH">High</option>
                      <option value="URGENT">Urgent</option>
                    </select>
                  </div>

                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      Note Date
                    </label>
                    <input
                      type="date"
                      value={formNoteDate}
                      onChange={(e) => setFormNoteDate(e.target.value)}
                      className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    />
                  </div>
                </div>

                {/* Color Selector */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                    Color Theme
                  </label>
                  <div className="flex items-center gap-2">
                    {COLOR_THEMES.map((c) => (
                      <button
                        key={c.id}
                        type="button"
                        onClick={() => setFormColor(c.id)}
                        className={`w-7 h-7 rounded-full border-2 flex items-center justify-center transition-transform ${c.dot} ${
                          formColor === c.id ? "border-slate-800 scale-110 shadow-sm" : "border-transparent opacity-80"
                        }`}
                        title={c.name}
                      >
                        {formColor === c.id && <Check className="w-3.5 h-3.5 text-white" />}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Pin to top checkbox */}
                <div className="flex items-center gap-2 pt-1">
                  <input
                    type="checkbox"
                    id="formIsPinned"
                    checked={formIsPinned}
                    onChange={(e) => setFormIsPinned(e.target.checked)}
                    className="w-4 h-4 rounded text-indigo-600 focus:ring-indigo-500 border-slate-300"
                  />
                  <label htmlFor="formIsPinned" className="text-xs font-medium text-slate-700 select-none">
                    Pin this note to the top of your board
                  </label>
                </div>

                {/* Footer Buttons */}
                <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setIsModalOpen(false)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
                  >
                    {submitting ? "Saving..." : editingNote ? "Update Note" : "Create Note"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}
      </div>
    </RedesignPageFrame>
  );
}
