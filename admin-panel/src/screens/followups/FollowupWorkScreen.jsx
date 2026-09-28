import React, { useState, useEffect, useMemo, useCallback } from "react";
import { Link, useNavigate } from "react-router-dom";
import axios from "axios";
import {
  CalendarClock,
  Calendar,
  Clock,
  Search,
  Filter,
  RefreshCw,
  Phone,
  User,
  CheckCircle2,
  AlertCircle,
  Clock3,
  CalendarCheck,
  ChevronRight,
  ExternalLink,
  MessageSquare,
  Building,
  Coins,
  Copy,
  Check,
  X,
  FileText,
  AlertTriangle,
} from "lucide-react";
import API_URL from "../../config";
import RedesignPageFrame from "../../components/RedesignPageFrame";

const getTodayString = () => {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

const getTomorrowString = () => {
  const d = new Date();
  d.setDate(d.getDate() + 1);
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
};

export default function FollowupWorkScreen() {
  const navigate = useNavigate();

  // State
  const [followups, setFollowups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    todayCount: 0,
    tomorrowCount: 0,
    overdueCount: 0,
    completedCount: 0,
    totalCount: 0,
  });

  // Filter state
  const [activeTab, setActiveTab] = useState("today"); // "today" | "tomorrow" | "overdue" | "completed" | "custom"
  const [selectedDate, setSelectedDate] = useState(getTodayString());
  const [statusFilter, setStatusFilter] = useState("All");
  const [staffFilter, setStaffFilter] = useState("All");
  const [searchQuery, setSearchQuery] = useState("");
  const [employees, setEmployees] = useState([]);

  // Modal for editing/updating remark & status
  const [selectedFollowup, setSelectedFollowup] = useState(null);
  const [editStatus, setEditStatus] = useState("PENDING");
  const [editRemarks, setEditRemarks] = useState("");
  const [editRescheduleDate, setEditRescheduleDate] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [copiedId, setCopiedId] = useState(null);

  // User details
  const employeeRole = (localStorage.getItem("employeeRole") || "").toLowerCase();
  const userRole = (localStorage.getItem("userRole") || "").toUpperCase();
  const isFrontline = userRole === "EMPLOYEE" || employeeRole === "employee" || employeeRole === "calling";

  // Fetch employees for staff dropdown
  useEffect(() => {
    if (!isFrontline) {
      axios
        .get(`${API_URL}/users`, { params: { limit: 100 } })
        .then((res) => {
          const list = res.data.data || res.data || [];
          setEmployees(Array.isArray(list) ? list : []);
        })
        .catch((err) => console.error("Error fetching staff list:", err));
    }
  }, [isFrontline]);

  // Fetch follow-ups based on active tab and filters
  const fetchFollowups = useCallback(async () => {
    try {
      setLoading(true);
      const params = {
        limit: 100,
      };

      if (activeTab === "today") {
        params.window = "today";
      } else if (activeTab === "tomorrow") {
        params.window = "tomorrow";
      } else if (activeTab === "overdue") {
        params.window = "overdue";
      } else if (activeTab === "completed") {
        params.status = "COMPLETED";
      } else if (activeTab === "custom") {
        if (selectedDate) {
          params.date = selectedDate;
        }
      }

      if (statusFilter !== "All" && activeTab !== "completed") {
        params.status = statusFilter;
      }
      if (staffFilter !== "All") {
        params.employeeId = staffFilter;
      }
      if (searchQuery.trim()) {
        params.search = searchQuery.trim();
      }

      const res = await axios.get(`${API_URL}/followups`, { params });
      const data = res.data.data || [];
      setFollowups(data);

      if (res.data.stats) {
        setStats(res.data.stats);
      }
    } catch (error) {
      console.error("Error fetching follow-ups:", error);
      setFollowups([]);
    } finally {
      setLoading(false);
    }
  }, [activeTab, selectedDate, statusFilter, staffFilter, searchQuery]);

  useEffect(() => {
    fetchFollowups();
  }, [fetchFollowups]);

  // Tab change handler
  const handleTabChange = (tab) => {
    setActiveTab(tab);
    if (tab === "today") {
      setSelectedDate(getTodayString());
      setStatusFilter("All");
    } else if (tab === "tomorrow") {
      setSelectedDate(getTomorrowString());
      setStatusFilter("All");
    } else if (tab === "overdue") {
      setStatusFilter("All");
    } else if (tab === "completed") {
      setStatusFilter("COMPLETED");
    }
  };

  // Open modal
  const handleOpenEdit = (item) => {
    setSelectedFollowup(item);
    setEditStatus(item.status || "PENDING");
    setEditRemarks(item.remarks || "");
    if (item.scheduled_at) {
      const dt = new Date(item.scheduled_at);
      const formatted = new Date(dt.getTime() - dt.getTimezoneOffset() * 60000)
        .toISOString()
        .slice(0, 16);
      setEditRescheduleDate(formatted);
    } else {
      setEditRescheduleDate("");
    }
  };

  // Save update
  const handleSaveEdit = async (e) => {
    e.preventDefault();
    if (!selectedFollowup) return;
    try {
      setSubmitting(true);
      const payload = {
        status: editStatus,
        remarks: editRemarks,
      };
      if (editRescheduleDate) {
        payload.scheduled_at = new Date(editRescheduleDate).toISOString();
      }

      await axios.put(`${API_URL}/followups/${selectedFollowup.id}`, payload);
      setSelectedFollowup(null);
      fetchFollowups();
    } catch (err) {
      console.error("Failed to update follow-up:", err);
      alert("Failed to update follow-up: " + (err.response?.data?.message || err.message));
    } finally {
      setSubmitting(false);
    }
  };

  const handleCopyMobile = (id, mobile) => {
    if (!mobile) return;
    navigator.clipboard.writeText(mobile);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const formatScheduledTime = (isoString) => {
    if (!isoString) return "--";
    const date = new Date(isoString);
    if (isNaN(date.getTime())) return "--";
    return date.toLocaleDateString("en-IN", {
      day: "2-digit",
      month: "short",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
      hour12: true,
    });
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
    <RedesignPageFrame pageKey="followup-work">
      <div className="p-4 sm:p-6 max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 bg-white p-6 rounded-2xl border border-slate-200 shadow-sm">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="p-2 bg-indigo-50 text-indigo-600 rounded-xl">
                <CalendarClock className="w-6 h-6" />
              </span>
              <h1 className="text-2xl font-bold text-slate-900">Today's Follow-up & Daily Work</h1>
            </div>
            <p className="text-sm text-slate-500">
              Track client call schedules, meeting remarks, pending follow-ups, and filter by any date.
            </p>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={fetchFollowups}
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-slate-700 bg-slate-50 hover:bg-slate-100 rounded-xl border border-slate-200 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${loading ? "animate-spin text-indigo-600" : ""}`} />
              Refresh
            </button>
            <Link
              to="/leads"
              className="inline-flex items-center gap-2 px-4 py-2 text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 rounded-xl shadow-sm transition-colors"
            >
              <FileText className="w-4 h-4" />
              View All Leads
            </Link>
          </div>
        </div>

        {/* Metric Cards */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          <button
            onClick={() => handleTabChange("today")}
            className={`text-left p-4 rounded-2xl border transition-all ${
              activeTab === "today"
                ? "cc-followup-card-active active bg-emerald-700 border-emerald-800 ring-2 ring-emerald-500/20 shadow-md text-white"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${activeTab === "today" ? "text-white" : "text-slate-500"}`}>
                Today's Followups
              </span>
              <span className={`p-2 rounded-xl transition-colors ${activeTab === "today" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                <Calendar className="w-4 h-4" />
              </span>
            </div>
            <div className={`text-2xl font-extrabold ${activeTab === "today" ? "text-white" : "text-slate-900"}`}>
              {stats.todayCount}
            </div>
            <p className={`text-xs font-medium mt-1 ${activeTab === "today" ? "text-white" : "text-emerald-700"}`}>
              Scheduled for today
            </p>
          </button>

          <button
            onClick={() => handleTabChange("tomorrow")}
            className={`text-left p-4 rounded-2xl border transition-all ${
              activeTab === "tomorrow"
                ? "cc-followup-card-active active bg-emerald-700 border-emerald-800 ring-2 ring-emerald-500/20 shadow-md text-white"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${activeTab === "tomorrow" ? "text-white" : "text-slate-500"}`}>
                Tomorrow
              </span>
              <span className={`p-2 rounded-xl transition-colors ${activeTab === "tomorrow" ? "bg-white/20 text-white" : "bg-blue-100 text-blue-700"}`}>
                <CalendarCheck className="w-4 h-4" />
              </span>
            </div>
            <div className={`text-2xl font-extrabold ${activeTab === "tomorrow" ? "text-white" : "text-slate-900"}`}>
              {stats.tomorrowCount}
            </div>
            <p className={`text-xs font-medium mt-1 ${activeTab === "tomorrow" ? "text-white" : "text-blue-700"}`}>
              Upcoming next day
            </p>
          </button>

          <button
            onClick={() => handleTabChange("overdue")}
            className={`text-left p-4 rounded-2xl border transition-all ${
              activeTab === "overdue"
                ? "cc-followup-card-active active bg-rose-600 border-rose-700 ring-2 ring-rose-500/20 shadow-md text-white"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${activeTab === "overdue" ? "text-white" : "text-slate-500"}`}>
                Overdue / Missed
              </span>
              <span className={`p-2 rounded-xl transition-colors ${activeTab === "overdue" ? "bg-white/20 text-white" : "bg-rose-100 text-rose-600"}`}>
                <AlertTriangle className="w-4 h-4" />
              </span>
            </div>
            <div className={`text-2xl font-extrabold ${activeTab === "overdue" ? "text-white" : "text-rose-600"}`}>
              {stats.overdueCount}
            </div>
            <p className={`text-xs font-medium mt-1 ${activeTab === "overdue" ? "text-white" : "text-rose-500"}`}>
              Action needed
            </p>
          </button>

          <button
            onClick={() => handleTabChange("completed")}
            className={`text-left p-4 rounded-2xl border transition-all ${
              activeTab === "completed"
                ? "cc-followup-card-active active bg-emerald-700 border-emerald-800 ring-2 ring-emerald-500/20 shadow-md text-white"
                : "bg-white border-slate-200 hover:border-slate-300"
            }`}
          >
            <div className="flex items-center justify-between mb-2">
              <span className={`text-xs font-semibold uppercase tracking-wider ${activeTab === "completed" ? "text-white" : "text-slate-500"}`}>
                Completed
              </span>
              <span className={`p-2 rounded-xl transition-colors ${activeTab === "completed" ? "bg-white/20 text-white" : "bg-emerald-100 text-emerald-700"}`}>
                <CheckCircle2 className="w-4 h-4" />
              </span>
            </div>
            <div className={`text-2xl font-extrabold ${activeTab === "completed" ? "text-white" : "text-emerald-600"}`}>
              {stats.completedCount}
            </div>
            <p className={`text-xs font-medium mt-1 ${activeTab === "completed" ? "text-white" : "text-emerald-700"}`}>
              Done & updated
            </p>
          </button>
        </div>

        {/* Quick Filter Tabs & Date Filter Bar */}
        <div className="bg-white p-5 rounded-2xl border border-slate-200 shadow-sm space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-slate-100 pb-4">
            {/* Tabs */}
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => handleTabChange("today")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "today"
                    ? "active bg-emerald-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Today ({stats.todayCount})
              </button>
              <button
                onClick={() => handleTabChange("tomorrow")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "tomorrow"
                    ? "active bg-emerald-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Tomorrow ({stats.tomorrowCount})
              </button>
              <button
                onClick={() => handleTabChange("overdue")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "overdue"
                    ? "active bg-rose-600 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Overdue ({stats.overdueCount})
              </button>
              <button
                onClick={() => handleTabChange("completed")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "completed"
                    ? "active bg-emerald-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Completed ({stats.completedCount})
              </button>
              <button
                onClick={() => handleTabChange("custom")}
                className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-colors ${
                  activeTab === "custom"
                    ? "active bg-emerald-700 text-white shadow-sm"
                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                }`}
              >
                Date Filter
              </button>
            </div>

            {/* Date-wise Filter Input */}
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-slate-500 flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5 text-slate-400" />
                Select Date:
              </span>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => {
                  setSelectedDate(e.target.value);
                  setActiveTab("custom");
                }}
                className="px-3 py-1.5 text-xs font-medium border border-slate-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
              />
              {activeTab === "custom" && (
                <button
                  onClick={() => handleTabChange("today")}
                  className="text-xs text-indigo-600 hover:underline font-medium"
                >
                  Reset to Today
                </button>
              )}
            </div>
          </div>

          {/* Search & Select Filters */}
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3">
            {/* Search */}
            <div className="relative">
              <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder="Search name, phone, remarks..."
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

            {/* Staff Filter (if not frontline) */}
            {!isFrontline ? (
              <div>
                <select
                  value={staffFilter}
                  onChange={(e) => setStaffFilter(e.target.value)}
                  className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700"
                >
                  <option value="All">All Staff / Executives</option>
                  {employees.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name || emp.email} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="flex items-center px-3 py-2 bg-slate-50 border border-slate-200 rounded-xl text-xs text-slate-600">
                <User className="w-3.5 h-3.5 mr-1.5 text-slate-400" />
                My Follow-up Queue
              </div>
            )}

            {/* Status Filter */}
            <div>
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value)}
                disabled={activeTab === "completed"}
                className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white text-slate-700 disabled:bg-slate-50 disabled:text-slate-400"
              >
                <option value="All">All Statuses</option>
                <option value="PENDING">Pending Only</option>
                <option value="OVERDUE">Overdue Only</option>
                <option value="COMPLETED">Completed Only</option>
              </select>
            </div>

            {/* Results Counter */}
            <div className="flex items-center justify-end px-3 py-2 bg-slate-50 border border-slate-100 rounded-xl text-xs text-slate-600 font-medium">
              Showing <span className="font-bold text-slate-900 mx-1">{followups.length}</span> follow-up(s)
            </div>
          </div>
        </div>

        {/* Follow-ups List Table */}
        <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
          {loading ? (
            <div className="p-12 text-center">
              <RefreshCw className="w-8 h-8 animate-spin text-indigo-600 mx-auto mb-3" />
              <p className="text-sm font-medium text-slate-600">Loading scheduled follow-ups...</p>
            </div>
          ) : followups.length === 0 ? (
            <div className="p-12 text-center">
              <CalendarClock className="w-12 h-12 text-slate-300 mx-auto mb-3" />
              <h3 className="text-base font-semibold text-slate-800 mb-1">No follow-ups found</h3>
              <p className="text-sm text-slate-500 max-w-md mx-auto mb-4">
                No scheduled follow-up calls or tasks match your selected date/filter criteria.
              </p>
              <button
                onClick={() => {
                  setActiveTab("today");
                  setSelectedDate(getTodayString());
                  setStatusFilter("All");
                  setStaffFilter("All");
                  setSearchQuery("");
                }}
                className="px-4 py-2 text-xs font-semibold text-indigo-600 bg-indigo-50 hover:bg-indigo-100 rounded-lg transition-colors"
              >
                Reset to Today's Follow-ups
              </button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-xs">
                <thead className="bg-slate-50/80 border-b border-slate-200 text-slate-500 font-semibold uppercase tracking-wider">
                  <tr>
                    <th className="py-3.5 px-4">Customer / Contact</th>
                    <th className="py-3.5 px-4">Lead / Loan</th>
                    <th className="py-3.5 px-4">Scheduled Date & Time</th>
                    <th className="py-3.5 px-4">Status</th>
                    <th className="py-3.5 px-4">Follow-up Remarks</th>
                    <th className="py-3.5 px-4">Assigned Staff</th>
                    <th className="py-3.5 px-4 text-right">Action</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {followups.map((item) => {
                    const isOverdue =
                      item.status !== "COMPLETED" &&
                      item.scheduled_at &&
                      new Date(item.scheduled_at) < new Date();

                    return (
                      <tr key={item.id} className="hover:bg-slate-50/80 transition-colors">
                        {/* Customer */}
                        <td className="py-3.5 px-4">
                          <div className="flex items-center gap-3">
                            <div className="w-8 h-8 rounded-full bg-indigo-50 text-indigo-600 font-bold flex items-center justify-center text-xs shrink-0">
                              {(item.customer_name || "C")[0].toUpperCase()}
                            </div>
                            <div>
                              <div className="font-semibold text-slate-900 text-xs">
                                {item.customer_name || "Unnamed Customer"}
                              </div>
                              <div className="flex items-center gap-2 mt-0.5">
                                <span className="text-[11px] text-slate-500 font-mono">
                                  {item.customer_number || "--"}
                                </span>
                                {item.customer_number && (
                                  <>
                                    <button
                                      onClick={() => handleCopyMobile(item.id, item.customer_number)}
                                      title="Copy Mobile"
                                      className="text-slate-400 hover:text-slate-600"
                                    >
                                      {copiedId === item.id ? (
                                        <Check className="w-3 h-3 text-emerald-600" />
                                      ) : (
                                        <Copy className="w-3 h-3" />
                                      )}
                                    </button>
                                    <a
                                      href={`tel:${item.customer_number}`}
                                      title="Call customer"
                                      className="p-1 rounded bg-emerald-50 text-emerald-600 hover:bg-emerald-100"
                                    >
                                      <Phone className="w-2.5 h-2.5" />
                                    </a>
                                  </>
                                )}
                              </div>
                              {item.customer_city && (
                                <span className="text-[10px] text-slate-400">{item.customer_city}</span>
                              )}
                            </div>
                          </div>
                        </td>

                        {/* Lead / Loan */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-0.5">
                            <Link
                              to={`/lead-details/${item.lead_id}`}
                              className="font-bold text-indigo-600 hover:text-indigo-800 hover:underline flex items-center gap-1"
                            >
                              <span>{item.lead_number || `LD-${item.lead_id}`}</span>
                              <ExternalLink className="w-3 h-3" />
                            </Link>
                            <div className="text-[11px] font-medium text-slate-700">
                              {item.loan_type || "Loan File"}
                            </div>
                            <div className="text-[11px] text-slate-500 font-semibold">
                              {formatCurrency(item.loan_amount)}
                            </div>
                            {item.lead_status && (
                              <span className="inline-block px-1.5 py-0.5 rounded text-[10px] font-semibold bg-slate-100 text-slate-600">
                                {item.lead_status}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Schedule */}
                        <td className="py-3.5 px-4">
                          <div className="space-y-1">
                            <div className="font-semibold text-slate-800 flex items-center gap-1.5">
                              <Clock className="w-3.5 h-3.5 text-slate-400" />
                              {formatScheduledTime(item.scheduled_at)}
                            </div>
                            {item.reminder_type && (
                              <span className="inline-block px-2 py-0.5 rounded-full text-[10px] font-medium bg-indigo-50 text-indigo-600">
                                Reminder: {item.reminder_type}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Status */}
                        <td className="py-3.5 px-4">
                          {item.status === "COMPLETED" ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-emerald-50 text-emerald-700 border border-emerald-200">
                              <CheckCircle2 className="w-3 h-3" />
                              Completed
                            </span>
                          ) : isOverdue ? (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-rose-50 text-rose-700 border border-rose-200">
                              <AlertCircle className="w-3 h-3" />
                              Overdue
                            </span>
                          ) : (
                            <span className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-[11px] font-bold bg-amber-50 text-amber-700 border border-amber-200">
                              <Clock3 className="w-3 h-3" />
                              Pending
                            </span>
                          )}
                        </td>

                        {/* Remarks */}
                        <td className="py-3.5 px-4 max-w-xs">
                          {item.remarks ? (
                            <div className="p-2 bg-slate-50 rounded-lg border border-slate-100 text-slate-700 text-xs line-clamp-3">
                              {item.remarks}
                            </div>
                          ) : (
                            <span className="text-slate-400 italic">No remark logged yet</span>
                          )}
                        </td>

                        {/* Owner / Staff */}
                        <td className="py-3.5 px-4">
                          <div className="text-slate-800 font-medium">{item.owner || "Unassigned"}</div>
                          {item.owner_role && (
                            <span className="text-[10px] text-slate-400 uppercase tracking-wide">
                              {item.owner_role}
                            </span>
                          )}
                        </td>

                        {/* Actions */}
                        <td className="py-3.5 px-4 text-right">
                          <div className="flex items-center justify-end gap-2">
                            <button
                              onClick={() => handleOpenEdit(item)}
                              className="px-3 py-1.5 text-xs font-semibold rounded-lg bg-indigo-50 text-indigo-700 hover:bg-indigo-100 transition-colors"
                            >
                              Update / Remark
                            </button>
                            <Link
                              to={`/lead-details/${item.lead_id}`}
                              className="p-1.5 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                              title="Open Lead"
                            >
                              <ChevronRight className="w-4 h-4" />
                            </Link>
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Update Remark & Status Modal */}
        {selectedFollowup && (
          <div className="fixed inset-0 z-50 bg-slate-900/60 backdrop-blur-xs flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full p-6 shadow-2xl border border-slate-100 animate-in fade-in duration-200">
              <div className="flex items-center justify-between pb-4 border-b border-slate-100 mb-5">
                <div>
                  <h3 className="text-lg font-bold text-slate-900">Update Follow-up & Remarks</h3>
                  <p className="text-xs text-slate-500">
                    Lead: {selectedFollowup.lead_number} &bull; {selectedFollowup.customer_name}
                  </p>
                </div>
                <button
                  onClick={() => setSelectedFollowup(null)}
                  className="p-1 rounded-lg text-slate-400 hover:text-slate-600 hover:bg-slate-100"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <form onSubmit={handleSaveEdit} className="space-y-4">
                {/* Status */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Follow-up Status
                  </label>
                  <select
                    value={editStatus}
                    onChange={(e) => setEditStatus(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="PENDING">Pending (Still Open)</option>
                    <option value="COMPLETED">Completed (Meeting / Call Done)</option>
                    <option value="OVERDUE">Overdue (Customer Didn't Pick / Postponed)</option>
                  </select>
                </div>

                {/* Reschedule Date & Time */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Next Follow-up Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={editRescheduleDate}
                    onChange={(e) => setEditRescheduleDate(e.target.value)}
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                  <p className="text-[10px] text-slate-400 mt-1">
                    Updating this also updates the lead's next follow-up date automatically.
                  </p>
                </div>

                {/* Remarks */}
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    Call / Meeting Remarks & Feedback
                  </label>
                  <textarea
                    rows={4}
                    value={editRemarks}
                    onChange={(e) => setEditRemarks(e.target.value)}
                    placeholder="Enter what was discussed with the customer, document requirement, interest level, or next action..."
                    className="w-full px-3 py-2 text-xs border border-slate-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>

                {/* Modal Footer */}
                <div className="flex items-center justify-end gap-3 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => setSelectedFollowup(null)}
                    className="px-4 py-2 text-xs font-semibold text-slate-600 bg-slate-100 hover:bg-slate-200 rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="px-5 py-2 text-xs font-bold text-white bg-indigo-600 hover:bg-indigo-700 disabled:opacity-50 rounded-xl shadow-sm transition-colors"
                  >
                    {submitting ? "Saving..." : "Save Changes"}
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
