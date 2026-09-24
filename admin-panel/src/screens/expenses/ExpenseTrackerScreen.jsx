import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  Calendar,
  ChevronLeft,
  ChevronRight,
  Download,
  Edit2,
  Filter,
  Layers,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Trash2,
  TrendingDown,
  TrendingUp,
  Users,
  Wallet,
  X,
  CheckCircle2,
  Clock,
  ArrowUpRight,
  Building,
} from "lucide-react";
import API_URL from "../../config";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 2,
});

const DEFAULT_CATEGORIES = [
  "Office Rent",
  "Electricity & Utility",
  "Tea, Coffee & Pantry",
  "Internet & Phone",
  "Software & Subscriptions",
  "Stationery & Printing",
  "Travel & Fuel",
  "Office Maintenance",
  "Marketing & Advertising",
  "Legal & Accounting",
  "Miscellaneous",
];

const PAYMENT_MODES = ["UPI", "Net Banking", "Credit Card", "Debit Card", "Cash", "Cheque"];

const getTodayMonthStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
};

const formatMonthDisplay = (monthStr) => {
  if (!monthStr) return "";
  const [y, m] = monthStr.split("-");
  const date = new Date(parseInt(y, 10), parseInt(m, 10) - 1, 1);
  return date.toLocaleString("en-IN", { month: "long", year: "numeric" });
};

const emptyForm = () => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    expenseDate: today,
    category: "Office Rent",
    vendorName: "",
    description: "",
    baseAmount: "",
    gstPercent: 18,
    paymentMode: "UPI",
    status: "PAID",
    remarks: "",
  };
};

export default function ExpenseTrackerScreen() {
  const [selectedMonth, setSelectedMonth] = useState(getTodayMonthStr);
  const [activeTab, setActiveTab] = useState("OFFICE"); // 'OFFICE' | 'STAFF' | 'PARTNER' | 'ANALYTICS'
  
  // Data states
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({ totalBase: 0, totalGst: 0, totalAmount: 0, totalCount: 0 });
  const [summaryData, setSummaryData] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [editExpense, setEditExpense] = useState(null);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const [formData, setFormData] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);

  // Fetch summary data
  const fetchSummary = async (month = selectedMonth) => {
    try {
      setSummaryLoading(true);
      const res = await axios.get(`${API_URL}/expenses/summary`, {
        params: { month },
      });
      if (res.data?.success) {
        setSummaryData(res.data);
      }
    } catch (err) {
      console.error("Error fetching expense summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Fetch expenses list
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/expenses`, {
        params: {
          month: selectedMonth,
          category: selectedCategory,
          status: selectedStatus,
          search: search.trim() || undefined,
          limit: 100,
        },
      });
      if (res.data?.success) {
        setExpenses(res.data.data || []);
        setTotals(res.data.totals || { totalBase: 0, totalGst: 0, totalAmount: 0, totalCount: 0 });
      }
    } catch (err) {
      console.error("Error fetching expenses:", err);
      toast.error("Failed to load expenses");
    } finally {
      setLoading(false);
    }
  };

  // Fetch category list
  const fetchCategories = async () => {
    try {
      const res = await axios.get(`${API_URL}/expenses/categories`);
      if (res.data?.success && res.data.data) {
        setCategories(res.data.data);
      }
    } catch (e) {
      console.error("Error fetching categories:", e);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  useEffect(() => {
    fetchSummary(selectedMonth);
    fetchExpenses();
  }, [selectedMonth, selectedCategory, selectedStatus, search]);

  // Month navigation
  const handlePrevMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const prevDate = new Date(y, m - 2, 1);
    setSelectedMonth(`${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, "0")}`);
  };

  const handleNextMonth = () => {
    const [y, m] = selectedMonth.split("-").map(Number);
    const nextDate = new Date(y, m, 1);
    setSelectedMonth(`${nextDate.getFullYear()}-${String(nextDate.getMonth() + 1).padStart(2, "0")}`);
  };

  // Form helpers
  const handleInputChange = (field, val) => {
    setFormData((prev) => ({ ...prev, [field]: val }));
  };

  // Live calculation for modal
  const computedGstAmount = useMemo(() => {
    const base = parseFloat(formData.baseAmount) || 0;
    const pct = parseFloat(formData.gstPercent) || 0;
    return Math.round(base * (pct / 100) * 100) / 100;
  }, [formData.baseAmount, formData.gstPercent]);

  const computedTotalAmount = useMemo(() => {
    const base = parseFloat(formData.baseAmount) || 0;
    return Math.round((base + computedGstAmount) * 100) / 100;
  }, [formData.baseAmount, computedGstAmount]);

  // Open Edit Modal
  const openEditModal = (exp) => {
    setEditExpense(exp);
    setFormData({
      expenseDate: exp.expenseDate || new Date().toISOString().slice(0, 10),
      category: exp.category || "Miscellaneous",
      vendorName: exp.vendorName || "",
      description: exp.description || "",
      baseAmount: exp.baseAmount || "",
      gstPercent: exp.gstPercent !== undefined ? exp.gstPercent : 18,
      paymentMode: exp.paymentMode || "UPI",
      status: exp.status || "PAID",
      remarks: exp.remarks || "",
    });
  };

  // Save new or updated expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.expenseDate) {
      toast.error("Please select a date");
      return;
    }
    if (!formData.baseAmount || parseFloat(formData.baseAmount) <= 0) {
      toast.error("Please enter a valid base amount");
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        expenseDate: formData.expenseDate,
        category: formData.category,
        vendorName: formData.vendorName,
        description: formData.description,
        baseAmount: parseFloat(formData.baseAmount) || 0,
        gstPercent: parseFloat(formData.gstPercent) || 0,
        paymentMode: formData.paymentMode,
        status: formData.status,
        remarks: formData.remarks,
      };

      if (editExpense) {
        await axios.put(`${API_URL}/expenses/${editExpense.id}`, payload);
        toast.success("Expense updated successfully");
        setEditExpense(null);
      } else {
        await axios.post(`${API_URL}/expenses`, payload);
        toast.success("Expense added successfully");
        setShowAddModal(false);
      }

      setFormData(emptyForm());
      fetchExpenses();
      fetchSummary(selectedMonth);
      fetchCategories();
    } catch (err) {
      console.error("Save error:", err);
      toast.error(err.response?.data?.message || "Failed to save expense");
    } finally {
      setSubmitting(false);
    }
  };

  // Delete expense
  const handleDeleteExpense = async () => {
    if (!deleteExpense) return;
    try {
      await axios.delete(`${API_URL}/expenses/${deleteExpense.id}`);
      toast.success("Expense deleted successfully");
      setDeleteExpense(null);
      fetchExpenses();
      fetchSummary(selectedMonth);
    } catch (err) {
      console.error("Delete error:", err);
      toast.error("Failed to delete expense");
    }
  };

  // Export to CSV
  const handleExportCSV = () => {
    if (!expenses.length) {
      toast.info("No expenses to export");
      return;
    }

    const headers = [
      "Expense ID",
      "Date",
      "Month",
      "Category",
      "Vendor / Payee",
      "Description",
      "Base Amount (₹)",
      "GST %",
      "GST Amount (₹)",
      "Total Amount (₹)",
      "Payment Mode",
      "Status",
      "Remarks",
    ];

    const rows = expenses.map((exp) => [
      `"${exp.expenseCode || ""}"`,
      `"${exp.expenseDate || ""}"`,
      `"${exp.expenseMonth || ""}"`,
      `"${exp.category || ""}"`,
      `"${(exp.vendorName || "").replace(/"/g, '""')}"`,
      `"${(exp.description || "").replace(/"/g, '""')}"`,
      parseFloat(exp.baseAmount || 0).toFixed(2),
      parseFloat(exp.gstPercent || 0).toFixed(2),
      parseFloat(exp.gstAmount || 0).toFixed(2),
      parseFloat(exp.totalAmount || 0).toFixed(2),
      `"${exp.paymentMode || ""}"`,
      `"${exp.status || ""}"`,
      `"${(exp.remarks || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Expenses_${selectedMonth}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const summary = summaryData?.summary || {};

  return (
    <div className="cc-exp-container">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      {/* Top Header & Month Filter Banner */}
      <div className="cc-exp-header-bar">
        <div>
          <div className="cc-exp-breadcrumb">
            <span>Accounting & Finance</span> / <strong>Expense Tracker</strong>
          </div>
          <h1 className="cc-exp-title">Expenses — office running costs</h1>
          <p className="cc-exp-subtitle">
            Month, GST Amount and Total Amount calculate on their own. Complete business outflow audit.
          </p>
        </div>

        <div className="cc-exp-top-actions">
          {/* Month Selector */}
          <div className="cc-exp-month-picker">
            <button type="button" onClick={handlePrevMonth} title="Previous Month" className="cc-exp-month-nav">
              <ChevronLeft size={16} />
            </button>
            <div className="cc-exp-month-display">
              <Calendar size={15} style={{ color: "#047857" }} />
              <span>{formatMonthDisplay(selectedMonth)}</span>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => e.target.value && setSelectedMonth(e.target.value)}
                className="cc-exp-month-hidden-input"
              />
            </div>
            <button type="button" onClick={handleNextMonth} title="Next Month" className="cc-exp-month-nav">
              <ChevronRight size={16} />
            </button>
          </div>

          <button type="button" className="cc-exp-btn secondary" onClick={handleExportCSV}>
            <Download size={15} /> Export CSV
          </button>

          <button
            type="button"
            className="cc-exp-btn primary"
            onClick={() => {
              setFormData(emptyForm());
              setShowAddModal(true);
            }}
          >
            <Plus size={16} /> Add Office Expense
          </button>
        </div>
      </div>

      {/* Overview Metric Summary Cards */}
      <div className="cc-exp-cards-grid">
        {/* Card 1: Total Outflow */}
        <div className="cc-exp-stat-card grand-total">
          <div className="cc-exp-stat-head">
            <span>Total Month Outflow</span>
            <span className="cc-exp-stat-icon red"><TrendingDown size={18} /></span>
          </div>
          <div className="cc-exp-stat-val">
            {currencyFormatter.format(summary.grandTotalExpenses || 0)}
          </div>
          <div className="cc-exp-stat-sub">
            All Costs: Office + Salaries + Incentives + Payouts
          </div>
        </div>

        {/* Card 2: Office Running Costs */}
        <div className="cc-exp-stat-card">
          <div className="cc-exp-stat-head">
            <span>Office Running Costs</span>
            <span className="cc-exp-stat-icon blue"><Building size={18} /></span>
          </div>
          <div className="cc-exp-stat-val">
            {currencyFormatter.format(summary.officeRunningCosts || 0)}
          </div>
          <div className="cc-exp-stat-sub">
            {summary.officeExpenseCount || 0} Bills (Base: {currencyFormatter.format(summary.officeBaseTotal || 0)})
          </div>
        </div>

        {/* Card 3: Staff Salaries */}
        <div className="cc-exp-stat-card">
          <div className="cc-exp-stat-head">
            <span>Staff Salaries (Fixed)</span>
            <span className="cc-exp-stat-icon green"><Users size={18} /></span>
          </div>
          <div className="cc-exp-stat-val">
            {currencyFormatter.format(summary.staffSalaries || 0)}
          </div>
          <div className="cc-exp-stat-sub">
            {summary.employeeCount || 0} active employees on payroll
          </div>
        </div>

        {/* Card 4: Staff Incentives (Manpower) */}
        <div className="cc-exp-stat-card">
          <div className="cc-exp-stat-head">
            <span>Staff Incentives (Deals)</span>
            <span className="cc-exp-stat-icon amber"><Wallet size={18} /></span>
          </div>
          <div className="cc-exp-stat-val" style={{ color: "#d97706" }}>
            {currencyFormatter.format(summary.staffIncentives || 0)}
          </div>
          <div className="cc-exp-stat-sub">
            Earned from Manpower charges on disbursed payouts
          </div>
        </div>

        {/* Card 5: Partner Payouts */}
        <div className="cc-exp-stat-card">
          <div className="cc-exp-stat-head">
            <span>Source / Partner Payouts</span>
            <span className="cc-exp-stat-icon purple"><Layers size={18} /></span>
          </div>
          <div className="cc-exp-stat-val">
            {currencyFormatter.format(summary.partnerPayouts || 0)}
          </div>
          <div className="cc-exp-stat-sub">
            Connector & vendor commissions disbursed
          </div>
        </div>
      </div>

      {/* Tabs Bar */}
      <div className="cc-exp-tabs-container">
        <button
          type="button"
          className={`cc-exp-tab-btn ${activeTab === "OFFICE" ? "active" : ""}`}
          onClick={() => setActiveTab("OFFICE")}
        >
          <Receipt size={16} /> Office Running Costs Table
          <span className="cc-exp-badge">{expenses.length}</span>
        </button>

        <button
          type="button"
          className={`cc-exp-tab-btn ${activeTab === "STAFF" ? "active" : ""}`}
          onClick={() => setActiveTab("STAFF")}
        >
          <Users size={16} /> Staff Salaries & Incentives
          <span className="cc-exp-badge">{summaryData?.staffBreakdown?.length || 0}</span>
        </button>

        <button
          type="button"
          className={`cc-exp-tab-btn ${activeTab === "PARTNER" ? "active" : ""}`}
          onClick={() => setActiveTab("PARTNER")}
        >
          <Layers size={16} /> Deal Wise Incentives & Payouts
          <span className="cc-exp-badge">{summaryData?.incentiveCases?.length || 0}</span>
        </button>

        <button
          type="button"
          className={`cc-exp-tab-btn ${activeTab === "ANALYTICS" ? "active" : ""}`}
          onClick={() => setActiveTab("ANALYTICS")}
        >
          <ArrowUpRight size={16} /> Monthly P&L Overview
        </button>
      </div>

      {/* TAB 1: OFFICE RUNNING COSTS (Exact spreadsheet replica from User's uploaded screenshot) */}
      {activeTab === "OFFICE" && (
        <div className="cc-exp-table-section">
          {/* Table Filters Bar */}
          <div className="cc-exp-filter-bar">
            <div className="cc-exp-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by Expense ID, Vendor, Description, Category..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="cc-exp-select-filters">
              <div className="cc-exp-filter-group">
                <span>Category:</span>
                <select value={selectedCategory} onChange={(e) => setSelectedCategory(e.target.value)}>
                  <option value="ALL">All Categories</option>
                  {categories.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </div>

              <div className="cc-exp-filter-group">
                <span>Status:</span>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="ALL">All Status</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>

              {(search || selectedCategory !== "ALL" || selectedStatus !== "ALL") && (
                <button
                  type="button"
                  className="cc-exp-reset-btn"
                  onClick={() => {
                    setSearch("");
                    setSelectedCategory("ALL");
                    setSelectedStatus("ALL");
                  }}
                >
                  <RefreshCw size={13} /> Reset
                </button>
              )}
            </div>
          </div>

          {/* Spreadsheet-like Table matching the user's uploaded banner & columns */}
          <div className="cc-exp-sheet-wrapper">
            <div className="cc-exp-sheet-header-banner">
              <span>Expenses — office running costs</span>
              <small>Month, GST Amount and Total Amount calculate on their own.</small>
            </div>

            <div className="cc-exp-table-scroll">
              <table className="cc-exp-sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: 110 }}>Expense ID</th>
                    <th style={{ width: 100 }}>Date</th>
                    <th style={{ width: 95 }}>Month</th>
                    <th style={{ width: 150 }}>Category</th>
                    <th style={{ width: 180 }}>Vendor / Payee</th>
                    <th style={{ minWidth: 220 }}>Description</th>
                    <th style={{ width: 120, textAlign: "right" }}>Base Amount (₹)</th>
                    <th style={{ width: 75, textAlign: "center" }}>GST %</th>
                    <th style={{ width: 115, textAlign: "right" }}>GST Amount (₹)</th>
                    <th style={{ width: 130, textAlign: "right" }}>Total Amount (₹)</th>
                    <th style={{ width: 120 }}>Payment Mode</th>
                    <th style={{ width: 95, textAlign: "center" }}>Status</th>
                    <th style={{ minWidth: 160 }}>Remarks</th>
                    <th style={{ width: 85, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={14} className="cc-exp-empty-cell">
                        <RefreshCw size={20} className="cc-spin" /> Loading expenses...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={14} className="cc-exp-empty-cell">
                        No expenses found for this month / filter. Click <strong>"+ Add Office Expense"</strong> to add one.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => {
                      const base = parseFloat(exp.baseAmount) || 0;
                      const gstPct = parseFloat(exp.gstPercent) || 0;
                      const gstAmt = parseFloat(exp.gstAmount) || 0;
                      const total = parseFloat(exp.totalAmount) || 0;

                      return (
                        <tr key={exp.id} className="cc-exp-row">
                          <td>
                            <span className="cc-exp-id-pill">{exp.expenseCode || `EXP-${exp.id}`}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>
                              {exp.expenseDate}
                            </span>
                          </td>
                          <td>
                            <span className="cc-exp-month-tag">{exp.expenseMonth}</span>
                          </td>
                          <td>
                            <span className="cc-exp-cat-badge">{exp.category}</span>
                          </td>
                          <td>
                            <strong style={{ color: "#0f172a", fontSize: 13.5 }}>{exp.vendorName || "--"}</strong>
                          </td>
                          <td>
                            <div className="cc-exp-desc-cell">{exp.description || "--"}</div>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 600 }}>
                            {currencyFormatter.format(base)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className="cc-exp-gst-pct">{gstPct}%</span>
                          </td>
                          <td style={{ textAlign: "right", color: "#64748b", fontWeight: 500 }}>
                            {currencyFormatter.format(gstAmt)}
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, color: "#0f172a" }}>
                            {currencyFormatter.format(total)}
                          </td>
                          <td>
                            <span className="cc-exp-mode-tag">{exp.paymentMode || "UPI"}</span>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`cc-exp-status-pill ${exp.status?.toLowerCase()}`}>
                              {exp.status === "PAID" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                              {exp.status}
                            </span>
                          </td>
                          <td>
                            <div className="cc-exp-remarks-cell">{exp.remarks || "--"}</div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <div className="cc-exp-row-actions">
                              <button
                                type="button"
                                className="cc-exp-act-btn edit"
                                title="Edit Expense"
                                onClick={() => openEditModal(exp)}
                              >
                                <Edit2 size={13} />
                              </button>
                              <button
                                type="button"
                                className="cc-exp-act-btn delete"
                                title="Delete Expense"
                                onClick={() => setDeleteExpense(exp)}
                              >
                                <Trash2 size={13} />
                              </button>
                            </div>
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>

                {/* Table Footer with Summary Totals */}
                {expenses.length > 0 && (
                  <tfoot>
                    <tr className="cc-exp-sheet-total-row">
                      <td colSpan={6} style={{ textAlign: "right", fontWeight: 700, paddingRight: 16 }}>
                        TOTAL SUMMARY ({totals.totalCount} Expenses):
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700 }}>
                        {currencyFormatter.format(totals.totalBase)}
                      </td>
                      <td style={{ textAlign: "center", color: "#64748b" }}>--</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#475569" }}>
                        {currencyFormatter.format(totals.totalGst)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#047857", fontSize: 14 }}>
                        {currencyFormatter.format(totals.totalAmount)}
                      </td>
                      <td colSpan={4}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 2: STAFF SALARIES & INCENTIVES */}
      {activeTab === "STAFF" && (
        <div className="cc-exp-table-section">
          <div className="cc-exp-tab-head-banner">
            <div>
              <h3>Employee Monthly Payroll & Performance Incentives</h3>
              <p>
                Calculates Base Monthly Salary + Case Incentives (Manpower Charges credited on closed deals) for{" "}
                <strong>{formatMonthDisplay(selectedMonth)}</strong>.
              </p>
            </div>
            <div className="cc-exp-tab-head-pills">
              <span className="pill green">
                Total Salary: {currencyFormatter.format(summary.staffSalaries || 0)}
              </span>
              <span className="pill amber">
                Total Incentives: {currencyFormatter.format(summary.staffIncentives || 0)}
              </span>
              <span className="pill total">
                Combined Staff Cost: {currencyFormatter.format(summary.staffTotalCost || 0)}
              </span>
            </div>
          </div>

          <div className="cc-exp-table-scroll">
            <table className="cc-exp-sheet-table">
              <thead>
                <tr>
                  <th style={{ width: 80 }}>Emp ID</th>
                  <th>Employee Name</th>
                  <th>Role / Designation</th>
                  <th>Contact Info</th>
                  <th style={{ width: 140, textAlign: "right" }}>Monthly Base Salary (₹)</th>
                  <th style={{ width: 120, textAlign: "center" }}>Cases Closed</th>
                  <th style={{ width: 160, textAlign: "right" }}>Case Incentives (₹)</th>
                  <th style={{ width: 170, textAlign: "right" }}>Total Month Earning (₹)</th>
                </tr>
              </thead>
              <tbody>
                {!summaryData?.staffBreakdown?.length ? (
                  <tr>
                    <td colSpan={8} className="cc-exp-empty-cell">
                      No active staff found.
                    </td>
                  </tr>
                ) : (
                  summaryData.staffBreakdown.map((emp) => (
                    <tr key={emp.id} className="cc-exp-row">
                      <td style={{ fontWeight: 600 }}>{emp.id}</td>
                      <td>
                        <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                          <span className="cc-exp-user-avatar">
                            {(emp.name || "?").slice(0, 2).toUpperCase()}
                          </span>
                          <div>
                            <strong style={{ color: "#0f172a", fontSize: 13.5 }}>{emp.name}</strong>
                          </div>
                        </div>
                      </td>
                      <td>
                        <span className="cc-exp-role-badge">{emp.role}</span>
                      </td>
                      <td>
                        <div style={{ fontSize: 12, color: "#64748b" }}>
                          <div>{emp.email || "--"}</div>
                          <div>{emp.phone || "--"}</div>
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {currencyFormatter.format(emp.monthlySalary || 0)}
                      </td>
                      <td style={{ textAlign: "center" }}>
                        <span className={`cc-exp-count-badge ${emp.incentiveCount > 0 ? "active" : ""}`}>
                          {emp.incentiveCount}
                        </span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 600, color: emp.totalIncentive > 0 ? "#d97706" : "#64748b" }}>
                        {currencyFormatter.format(emp.totalIncentive || 0)}
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#047857", fontSize: 14 }}>
                        {currencyFormatter.format(emp.totalPayable || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
              <tfoot>
                <tr className="cc-exp-sheet-total-row">
                  <td colSpan={4} style={{ textAlign: "right", fontWeight: 700, paddingRight: 16 }}>
                    GRAND TOTAL STAFF COST:
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 700 }}>
                    {currencyFormatter.format(summary.staffSalaries || 0)}
                  </td>
                  <td style={{ textAlign: "center" }}>--</td>
                  <td style={{ textAlign: "right", fontWeight: 700, color: "#d97706" }}>
                    {currencyFormatter.format(summary.staffIncentives || 0)}
                  </td>
                  <td style={{ textAlign: "right", fontWeight: 800, color: "#047857", fontSize: 14 }}>
                    {currencyFormatter.format(summary.staffTotalCost || 0)}
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 3: DEAL-WISE INCENTIVES & PARTNER COMMISSIONS */}
      {activeTab === "PARTNER" && (
        <div className="cc-exp-table-section">
          <div className="cc-exp-tab-head-banner">
            <div>
              <h3>Disbursed Deal Payouts & Incentive Allocations</h3>
              <p>
                Every completed deal in <strong>{formatMonthDisplay(selectedMonth)}</strong> with its Employee Manpower
                Incentive and Connector Net Payout.
              </p>
            </div>
            <div className="cc-exp-tab-head-pills">
              <span className="pill green">
                Disbursed: {currencyFormatter.format(summary.totalLoanDisbursed || 0)}
              </span>
              <span className="pill amber">
                Total Deal Incentives: {currencyFormatter.format(summary.staffIncentives || 0)}
              </span>
              <span className="pill purple">
                Partner Payouts: {currencyFormatter.format(summary.partnerPayouts || 0)}
              </span>
            </div>
          </div>

          <div className="cc-exp-table-scroll">
            <table className="cc-exp-sheet-table">
              <thead>
                <tr>
                  <th style={{ width: 70 }}>Case #</th>
                  <th>Customer Name</th>
                  <th>Loan Product</th>
                  <th>Bank Name</th>
                  <th>Disbursal Date</th>
                  <th style={{ textAlign: "right" }}>Loan Amount</th>
                  <th style={{ textAlign: "right" }}>Base Commission (₹)</th>
                  <th>Assigned Employee</th>
                  <th style={{ textAlign: "right", color: "#d97706" }}>Staff Incentive (Manpower)</th>
                  <th>Party / Source Name</th>
                  <th style={{ textAlign: "right", color: "#7c3aed" }}>Partner Net Payout</th>
                </tr>
              </thead>
              <tbody>
                {!summaryData?.incentiveCases?.length ? (
                  <tr>
                    <td colSpan={11} className="cc-exp-empty-cell">
                      No disbursed payout cases recorded for this month.
                    </td>
                  </tr>
                ) : (
                  summaryData.incentiveCases.map((c) => (
                    <tr key={c.caseId} className="cc-exp-row">
                      <td style={{ fontWeight: 600 }}>#{c.caseId}</td>
                      <td>
                        <strong style={{ color: "#0f172a" }}>{c.customerName}</strong>
                      </td>
                      <td>{c.loanProduct || "--"}</td>
                      <td>{c.bankName || "--"}</td>
                      <td>{c.disbursalDate || "--"}</td>
                      <td style={{ textAlign: "right", fontWeight: 600 }}>
                        {currencyFormatter.format(c.loanAmount || 0)}
                      </td>
                      <td style={{ textAlign: "right" }}>{currencyFormatter.format(c.baseAmount || 0)}</td>
                      <td>
                        <span className="cc-exp-emp-tag">👤 {c.employeeName}</span>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#d97706" }}>
                        {currencyFormatter.format(c.incentiveAmount || 0)}
                      </td>
                      <td>{c.partyName || "Direct"}</td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: "#7c3aed" }}>
                        {currencyFormatter.format(c.partyNetPayable || 0)}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: MONTHLY P&L & EXPENSE CATEGORY ANALYTICS */}
      {activeTab === "ANALYTICS" && (
        <div className="cc-exp-analytics-section">
          <div className="cc-exp-analytics-grid">
            {/* Category Breakdown Box */}
            <div className="cc-exp-panel-card">
              <h4>Office Expenses by Category</h4>
              <p className="cc-exp-panel-sub">Breakdown of operational bills for {formatMonthDisplay(selectedMonth)}</p>

              {!summaryData?.officeCategoryBreakdown?.length ? (
                <p style={{ color: "#94a3b8", fontSize: 13, padding: "20px 0" }}>No office expenses this month.</p>
              ) : (
                <div className="cc-exp-cat-list">
                  {summaryData.officeCategoryBreakdown.map((item) => {
                    const pct = summary.officeRunningCosts > 0 ? (item.amount / summary.officeRunningCosts) * 100 : 0;
                    return (
                      <div key={item.category} className="cc-exp-cat-row">
                        <div className="cc-exp-cat-info">
                          <span>{item.category}</span>
                          <strong>
                            {currencyFormatter.format(item.amount)}{" "}
                            <small>({pct.toFixed(1)}%)</small>
                          </strong>
                        </div>
                        <div className="cc-exp-progress-bar">
                          <div className="cc-exp-progress-fill" style={{ width: `${Math.min(100, pct)}%` }} />
                        </div>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Monthly Net Position / P&L Card */}
            <div className="cc-exp-panel-card">
              <h4>Monthly Financial Position & Outflow Summary</h4>
              <p className="cc-exp-panel-sub">Net Profit / Margin for {formatMonthDisplay(selectedMonth)}</p>

              <div className="cc-exp-pnl-table">
                <div className="cc-exp-pnl-row">
                  <span>Gross Bank Commission Received:</span>
                  <strong style={{ color: "#047857" }}>
                    +{currencyFormatter.format(summary.bankCommissionReceived || 0)}
                  </strong>
                </div>

                <div className="cc-exp-pnl-divider" />

                <div className="cc-exp-pnl-row">
                  <span>Less: Office Running Costs:</span>
                  <span style={{ color: "#dc2626" }}>-{currencyFormatter.format(summary.officeRunningCosts || 0)}</span>
                </div>
                <div className="cc-exp-pnl-row">
                  <span>Less: Staff Salaries (Fixed):</span>
                  <span style={{ color: "#dc2626" }}>-{currencyFormatter.format(summary.staffSalaries || 0)}</span>
                </div>
                <div className="cc-exp-pnl-row">
                  <span>Less: Staff Incentives (Manpower):</span>
                  <span style={{ color: "#d97706" }}>-{currencyFormatter.format(summary.staffIncentives || 0)}</span>
                </div>
                <div className="cc-exp-pnl-row">
                  <span>Less: Partner / Connector Payouts:</span>
                  <span style={{ color: "#7c3aed" }}>-{currencyFormatter.format(summary.partnerPayouts || 0)}</span>
                </div>

                <div className="cc-exp-pnl-divider" />

                <div className="cc-exp-pnl-row total">
                  <span>Total Monthly Outflow (Expenses):</span>
                  <strong style={{ color: "#b91c1c", fontSize: 15 }}>
                    {currencyFormatter.format(summary.grandTotalExpenses || 0)}
                  </strong>
                </div>

                <div className="cc-exp-pnl-row net">
                  <span>Estimated Net Position (Cash Inflow - Outflows):</span>
                  <strong
                    style={{
                      color: summary.netProfitOrLoss >= 0 ? "#047857" : "#dc2626",
                      fontSize: 16,
                    }}
                  >
                    {currencyFormatter.format(summary.netProfitOrLoss || 0)}
                  </strong>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD / EDIT EXPENSE MODAL */}
      {(showAddModal || editExpense) && (
        <div className="cc-exp-modal-overlay" onClick={() => { setShowAddModal(false); setEditExpense(null); }}>
          <div className="cc-exp-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-exp-modal-head">
              <div>
                <p>{editExpense ? "Edit Record" : "New Entry"}</p>
                <h3>{editExpense ? "Update Office Expense" : "Add Office Running Expense"}</h3>
                <small style={{ color: "#64748b", fontSize: 12 }}>
                  Month, GST Amount and Total Amount calculate on their own.
                </small>
              </div>
              <button
                type="button"
                className="cc-exp-modal-close"
                onClick={() => { setShowAddModal(false); setEditExpense(null); }}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleSaveExpense} className="cc-exp-modal-form">
              <div className="cc-exp-form-grid">
                {/* Date */}
                <label className="cc-exp-field">
                  <span>Date *</span>
                  <input
                    type="date"
                    required
                    value={formData.expenseDate}
                    onChange={(e) => handleInputChange("expenseDate", e.target.value)}
                  />
                </label>

                {/* Month (Auto Calculated Preview) */}
                <label className="cc-exp-field">
                  <span>Month (Auto-calculated)</span>
                  <input
                    type="text"
                    disabled
                    value={formData.expenseDate ? formData.expenseDate.slice(0, 7) : ""}
                    style={{ background: "#f1f5f9", color: "#475569", cursor: "not-allowed" }}
                  />
                </label>

                {/* Category */}
                <label className="cc-exp-field">
                  <span>Category *</span>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange("category", e.target.value)}
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Vendor / Payee */}
                <label className="cc-exp-field">
                  <span>Vendor / Payee</span>
                  <input
                    type="text"
                    placeholder="e.g. DLF Properties, Airtel, Tata Power"
                    value={formData.vendorName}
                    onChange={(e) => handleInputChange("vendorName", e.target.value)}
                  />
                </label>

                {/* Description */}
                <label className="cc-exp-field span-2">
                  <span>Description</span>
                  <input
                    type="text"
                    placeholder="e.g. Office electricity bill for Sep 2026"
                    value={formData.description}
                    onChange={(e) => handleInputChange("description", e.target.value)}
                  />
                </label>

                {/* Base Amount */}
                <label className="cc-exp-field">
                  <span>Base Amount (₹) *</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 15000"
                    value={formData.baseAmount}
                    onChange={(e) => handleInputChange("baseAmount", e.target.value)}
                  />
                </label>

                {/* GST % */}
                <label className="cc-exp-field">
                  <span>GST %</span>
                  <select
                    value={formData.gstPercent}
                    onChange={(e) => handleInputChange("gstPercent", e.target.value)}
                  >
                    <option value={0}>0% (Exempt / Nil)</option>
                    <option value={5}>5%</option>
                    <option value={12}>12%</option>
                    <option value={18}>18% (Standard Services)</option>
                    <option value={28}>28%</option>
                  </select>
                </label>

                {/* GST Amount (Auto Calculated) */}
                <label className="cc-exp-field">
                  <span>GST Amount (₹) [Auto]</span>
                  <div className="cc-exp-computed-val">
                    {currencyFormatter.format(computedGstAmount)}
                  </div>
                </label>

                {/* Total Amount (Auto Calculated) */}
                <label className="cc-exp-field">
                  <span>Total Amount (₹) [Auto]</span>
                  <div className="cc-exp-computed-val highlight">
                    {currencyFormatter.format(computedTotalAmount)}
                  </div>
                </label>

                {/* Payment Mode */}
                <label className="cc-exp-field">
                  <span>Payment Mode</span>
                  <select
                    value={formData.paymentMode}
                    onChange={(e) => handleInputChange("paymentMode", e.target.value)}
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Status */}
                <label className="cc-exp-field">
                  <span>Payment Status</span>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange("status", e.target.value)}
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                  </select>
                </label>

                {/* Remarks */}
                <label className="cc-exp-field span-2">
                  <span>Remarks</span>
                  <textarea
                    rows={2}
                    placeholder="Transaction ref, invoice #, or note..."
                    value={formData.remarks}
                    onChange={(e) => handleInputChange("remarks", e.target.value)}
                  />
                </label>
              </div>

              {/* Action Buttons */}
              <div className="cc-exp-modal-actions">
                <button
                  type="button"
                  className="cc-exp-btn secondary"
                  onClick={() => { setShowAddModal(false); setEditExpense(null); }}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-exp-btn primary" disabled={submitting}>
                  {submitting ? "Saving..." : editExpense ? "Update Expense" : "Save Expense"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {deleteExpense && (
        <div className="cc-exp-modal-overlay" onClick={() => setDeleteExpense(null)}>
          <div className="cc-exp-modal-card" style={{ maxWidth: 440 }} onClick={(e) => e.stopPropagation()}>
            <div className="cc-exp-modal-head">
              <div>
                <p style={{ color: "#dc2626" }}>Delete Confirmation</p>
                <h3>Delete Expense?</h3>
              </div>
              <button type="button" className="cc-exp-modal-close" onClick={() => setDeleteExpense(null)}>
                <X size={18} />
              </button>
            </div>
            <p style={{ fontSize: 13.5, color: "#475569", lineHeight: 1.5, margin: "8px 0 16px" }}>
              Are you sure you want to delete expense{" "}
              <strong>{deleteExpense.expenseCode || `#${deleteExpense.id}`}</strong> ({deleteExpense.category} -{" "}
              {currencyFormatter.format(deleteExpense.totalAmount)})? This action cannot be undone.
            </p>
            <div className="cc-exp-modal-actions">
              <button type="button" className="cc-exp-btn secondary" onClick={() => setDeleteExpense(null)}>
                Cancel
              </button>
              <button
                type="button"
                className="cc-exp-btn danger"
                onClick={handleDeleteExpense}
                style={{ background: "#dc2626", color: "#fff", borderColor: "transparent" }}
              >
                Yes, Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
.cc-exp-container {
  display: flex;
  flex-direction: column;
  gap: 18px;
  padding: 20px 24px 60px;
  background: #f8fafc;
  min-height: 100vh;
  font-family: inherit;
}

.cc-exp-header-bar {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 16px;
  background: #ffffff;
  padding: 18px 22px;
  border-radius: 14px;
  border: 1px solid #e2e8f0;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}

.cc-exp-breadcrumb {
  font-size: 11.5px;
  color: #64748b;
  margin-bottom: 4px;
  text-transform: uppercase;
  letter-spacing: 0.05em;
}
.cc-exp-breadcrumb strong { color: #047857; }

.cc-exp-title {
  font-size: 22px;
  font-weight: 700;
  color: #0f172a;
  margin: 0;
}

.cc-exp-subtitle {
  font-size: 13px;
  color: #64748b;
  margin: 3px 0 0;
}

.cc-exp-top-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}

/* Month picker */
.cc-exp-month-picker {
  display: inline-flex;
  align-items: center;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  border-radius: 9px;
  padding: 3px 4px;
}
.cc-exp-month-nav {
  background: transparent;
  border: none;
  cursor: pointer;
  padding: 6px;
  border-radius: 6px;
  display: grid;
  place-items: center;
  color: #475569;
}
.cc-exp-month-nav:hover {
  background: #e2e8f0;
  color: #0f172a;
}
.cc-exp-month-display {
  position: relative;
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 10px;
  font-size: 13px;
  font-weight: 600;
  color: #0f172a;
  cursor: pointer;
}
.cc-exp-month-hidden-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}

/* Buttons */
.cc-exp-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 13px;
  font-weight: 600;
  padding: 8px 14px;
  border-radius: 9px;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s;
}
.cc-exp-btn.primary {
  background: #047857;
  color: #ffffff;
}
.cc-exp-btn.primary:hover:not(:disabled) {
  background: #065f46;
}
.cc-exp-btn.secondary {
  background: #ffffff;
  color: #334155;
  border-color: #cbd5e1;
}
.cc-exp-btn.secondary:hover {
  background: #f1f5f9;
}

/* Summary cards */
.cc-exp-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
  gap: 14px;
}
.cc-exp-stat-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 16px 18px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
  display: flex;
  flex-direction: column;
  gap: 6px;
}
.cc-exp-stat-card.grand-total {
  border-left: 4px solid #b91c1c;
  background: linear-gradient(135deg, #fff5f5 0%, #ffffff 100%);
}
.cc-exp-stat-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12px;
  font-weight: 600;
  color: #64748b;
  text-transform: uppercase;
  letter-spacing: 0.04em;
}
.cc-exp-stat-icon {
  width: 32px;
  height: 32px;
  border-radius: 8px;
  display: grid;
  place-items: center;
}
.cc-exp-stat-icon.red { background: #fee2e2; color: #dc2626; }
.cc-exp-stat-icon.blue { background: #e0f2fe; color: #0284c7; }
.cc-exp-stat-icon.green { background: #dcfce7; color: #16a34a; }
.cc-exp-stat-icon.amber { background: #fef3c7; color: #d97706; }
.cc-exp-stat-icon.purple { background: #f3e8ff; color: #9333ea; }

.cc-exp-stat-val {
  font-size: 21px;
  font-weight: 800;
  color: #0f172a;
}
.cc-exp-stat-sub {
  font-size: 11.5px;
  color: #64748b;
}

/* Tabs */
.cc-exp-tabs-container {
  display: flex;
  align-items: center;
  gap: 8px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 2px;
  overflow-x: auto;
}
.cc-exp-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 16px;
  font-size: 13.5px;
  font-weight: 600;
  background: transparent;
  color: #64748b;
  border: none;
  border-radius: 8px 8px 0 0;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.cc-exp-tab-btn:hover {
  color: #0f172a;
  background: #f1f5f9;
}
.cc-exp-tab-btn.active {
  color: #047857;
  background: #ffffff;
  border-bottom: 3px solid #047857;
  font-weight: 700;
}
.cc-exp-badge {
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: #e2e8f0;
  color: #334155;
}
.cc-exp-tab-btn.active .cc-exp-badge {
  background: #dcfce7;
  color: #047857;
}

/* Table Section */
.cc-exp-table-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.cc-exp-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #ffffff;
  padding: 12px 16px;
  border-radius: 10px;
  border: 1px solid #e2e8f0;
}
.cc-exp-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 7px 12px;
  flex: 1 1 260px;
}
.cc-exp-search-box input {
  border: none;
  background: transparent;
  outline: none;
  width: 100%;
  font-size: 13px;
  color: #0f172a;
}
.cc-exp-select-filters {
  display: flex;
  align-items: center;
  gap: 12px;
  flex-wrap: wrap;
}
.cc-exp-filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12px;
  color: #64748b;
  font-weight: 600;
}
.cc-exp-filter-group select {
  padding: 6px 10px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  font-size: 12.5px;
  background: #fff;
  color: #0f172a;
}
.cc-exp-reset-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  border: 1px solid #cbd5e1;
  background: #f8fafc;
  color: #64748b;
  padding: 6px 10px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
  cursor: pointer;
}

/* User's Exact Sheet Wrapper and Header Banner */
.cc-exp-sheet-wrapper {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #1e3a8a;
  overflow: hidden;
  box-shadow: 0 4px 14px rgba(15, 23, 42, 0.06);
}
.cc-exp-sheet-header-banner {
  background: #173d6d;
  color: #ffffff;
  padding: 12px 18px;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  text-align: center;
}
.cc-exp-sheet-header-banner span {
  font-size: 16px;
  font-weight: 700;
  letter-spacing: 0.02em;
}
.cc-exp-sheet-header-banner small {
  font-size: 12px;
  color: #cbd5e1;
  font-style: italic;
  margin-top: 2px;
}

.cc-exp-table-scroll {
  overflow-x: auto;
  max-width: 100%;
}
.cc-exp-sheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
}
.cc-exp-sheet-table th {
  background: #1b4980;
  color: #ffffff;
  font-weight: 600;
  font-size: 12px;
  padding: 10px 12px;
  border: 1px solid #143763;
  white-space: nowrap;
  letter-spacing: 0.02em;
}
.cc-exp-sheet-table td {
  padding: 9px 12px;
  border: 1px solid #e2e8f0;
  vertical-align: middle;
  background: #ffffff;
}
.cc-exp-sheet-table tbody tr:hover td {
  background: #f8fafc;
}

.cc-exp-id-pill {
  font-size: 11.5px;
  font-weight: 700;
  color: #1e3a8a;
  background: #eff6ff;
  border: 1px solid #bfdbfe;
  padding: 2px 7px;
  border-radius: 6px;
}
.cc-exp-month-tag {
  font-size: 11.5px;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 5px;
  font-weight: 600;
}
.cc-exp-cat-badge {
  display: inline-block;
  font-size: 11.5px;
  font-weight: 600;
  color: #0369a1;
  background: #e0f2fe;
  padding: 2px 8px;
  border-radius: 999px;
  white-space: nowrap;
}
.cc-exp-gst-pct {
  font-size: 11.5px;
  font-weight: 700;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 6px;
  border-radius: 4px;
}
.cc-exp-mode-tag {
  font-size: 11px;
  font-weight: 600;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  padding: 2px 6px;
  border-radius: 5px;
}
.cc-exp-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  font-size: 11px;
  font-weight: 700;
  padding: 2px 8px;
  border-radius: 999px;
  text-transform: uppercase;
}
.cc-exp-status-pill.paid {
  background: #dcfce7;
  color: #15803d;
}
.cc-exp-status-pill.pending {
  background: #fef3c7;
  color: #b45309;
}

.cc-exp-desc-cell, .cc-exp-remarks-cell {
  font-size: 12px;
  color: #475569;
  max-width: 260px;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.cc-exp-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cc-exp-act-btn {
  border: none;
  background: transparent;
  padding: 4px;
  border-radius: 6px;
  cursor: pointer;
  color: #64748b;
  display: grid;
  place-items: center;
}
.cc-exp-act-btn.edit:hover {
  background: #e0f2fe;
  color: #0284c7;
}
.cc-exp-act-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

.cc-exp-sheet-total-row td {
  background: #f1f5f9 !important;
  border-top: 2px solid #cbd5e1 !important;
}

.cc-exp-empty-cell {
  text-align: center;
  padding: 36px !important;
  color: #64748b;
  font-size: 14px;
}

/* Staff tab banner */
.cc-exp-tab-head-banner {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
}
.cc-exp-tab-head-banner h3 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
}
.cc-exp-tab-head-banner p {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: #64748b;
}
.cc-exp-tab-head-pills {
  display: flex;
  align-items: center;
  gap: 8px;
  flex-wrap: wrap;
}
.cc-exp-tab-head-pills .pill {
  padding: 5px 12px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
}
.cc-exp-tab-head-pills .pill.green { background: #dcfce7; color: #15803d; }
.cc-exp-tab-head-pills .pill.amber { background: #fef3c7; color: #b45309; }
.cc-exp-tab-head-pills .pill.purple { background: #f3e8ff; color: #7e22ce; }
.cc-exp-tab-head-pills .pill.total { background: #0f172a; color: #ffffff; }

.cc-exp-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #e2e8f0;
  color: #334155;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
}
.cc-exp-role-badge {
  font-size: 11.5px;
  font-weight: 600;
  color: #475569;
  background: #f1f5f9;
  padding: 2px 7px;
  border-radius: 5px;
}
.cc-exp-count-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 999px;
  font-size: 11.5px;
  font-weight: 700;
  background: #f1f5f9;
  color: #64748b;
}
.cc-exp-count-badge.active {
  background: #fef3c7;
  color: #b45309;
}
.cc-exp-emp-tag {
  font-size: 12px;
  font-weight: 600;
  color: #1e3a8a;
  background: #eff6ff;
  padding: 2px 8px;
  border-radius: 6px;
}

/* Analytics section */
.cc-exp-analytics-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cc-exp-analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(360px, 1fr));
  gap: 16px;
}
.cc-exp-panel-card {
  background: #ffffff;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
  padding: 20px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.02);
}
.cc-exp-panel-card h4 {
  margin: 0;
  font-size: 16px;
  color: #0f172a;
  font-weight: 700;
}
.cc-exp-panel-sub {
  margin: 3px 0 16px;
  font-size: 12.5px;
  color: #64748b;
}
.cc-exp-cat-list {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-exp-cat-row {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.cc-exp-cat-info {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 12.5px;
  color: #334155;
}
.cc-exp-progress-bar {
  width: 100%;
  height: 7px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}
.cc-exp-progress-fill {
  height: 100%;
  background: #0284c7;
  border-radius: 999px;
}

.cc-exp-pnl-table {
  display: flex;
  flex-direction: column;
  gap: 10px;
}
.cc-exp-pnl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13.5px;
  color: #334155;
}
.cc-exp-pnl-row.total {
  font-weight: 700;
  padding: 6px 0;
}
.cc-exp-pnl-row.net {
  background: #f8fafc;
  padding: 10px 14px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-top: 4px;
}
.cc-exp-pnl-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 2px 0;
}

/* Modal styles */
.cc-exp-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.6);
  z-index: 150;
  display: grid;
  place-items: center;
  padding: 16px;
}
.cc-exp-modal-card {
  width: 100%;
  max-width: 660px;
  background: #ffffff;
  border-radius: 16px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  gap: 16px;
  box-shadow: 0 24px 60px rgba(15, 23, 42, 0.3);
  max-height: 92vh;
  overflow-y: auto;
}
.cc-exp-modal-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 12px;
}
.cc-exp-modal-head p {
  margin: 0;
  font-size: 11px;
  font-weight: 700;
  color: #047857;
  text-transform: uppercase;
  letter-spacing: 0.08em;
}
.cc-exp-modal-head h3 {
  margin: 2px 0 0;
  font-size: 19px;
  color: #0f172a;
}
.cc-exp-modal-close {
  border: none;
  background: #f1f5f9;
  color: #64748b;
  width: 32px;
  height: 32px;
  border-radius: 8px;
  cursor: pointer;
  display: grid;
  place-items: center;
}
.cc-exp-modal-close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.cc-exp-modal-form {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cc-exp-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px;
}
.cc-exp-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
  font-size: 12px;
  font-weight: 600;
  color: #475569;
}
.cc-exp-field.span-2 {
  grid-column: span 2;
}
.cc-exp-field input,
.cc-exp-field select,
.cc-exp-field textarea {
  padding: 9px 12px;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  font-size: 13.5px;
  color: #0f172a;
  background: #ffffff;
  font-family: inherit;
}
.cc-exp-field input:focus,
.cc-exp-field select:focus,
.cc-exp-field textarea:focus {
  outline: none;
  border-color: #047857;
  box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.15);
}
.cc-exp-computed-val {
  padding: 9px 12px;
  border-radius: 8px;
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  font-size: 13.5px;
  font-weight: 700;
  color: #334155;
}
.cc-exp-computed-val.highlight {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #047857;
  font-size: 15px;
}

.cc-exp-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 6px;
  border-top: 1px solid #f1f5f9;
}

@keyframes spin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}
.cc-spin {
  animation: spin 1s linear infinite;
}
`;
