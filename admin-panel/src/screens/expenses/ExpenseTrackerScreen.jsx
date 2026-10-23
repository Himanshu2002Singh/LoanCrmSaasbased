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
  UserCheck,
  AlertCircle,
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
  "Client Meeting & Food",
  "Office Maintenance",
  "Marketing & Advertising",
  "Courier & Postage",
  "Mobile Recharge",
  "Staff Welfare",
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

const emptyForm = (type = "OFFICE") => {
  const today = new Date().toISOString().slice(0, 10);
  return {
    expenseDate: today,
    category: type === "EMPLOYEE" ? "Travel & Fuel" : "Office Rent",
    vendorName: "",
    description: "",
    amount: "",
    baseAmount: "",
    gstPercent: type === "EMPLOYEE" ? 0 : 18,
    paymentMode: "UPI",
    status: "PAID",
    remarks: "",
    expenseType: type,
    employeeId: "",
  };
};

export default function ExpenseTrackerScreen() {
  const userRole = localStorage.getItem("userRole") || "";
  const employeeRole = localStorage.getItem("employeeRole") || "";
  const currentUserId = parseInt(localStorage.getItem("employeeId"), 10) || null;
  const currentUserName = localStorage.getItem("name") || "";

  const isCompanyAdmin =
    ["COMPANY_ADMIN", "SUPERADMIN"].includes(userRole.toUpperCase()) ||
    ["admin", "superadmin"].includes(employeeRole?.toLowerCase());

  const userPermissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  }, []);

  const isFinance = userRole.toUpperCase() === "FINANCE" || employeeRole.toLowerCase() === "finance";
  const canViewOfficeExpenses = isCompanyAdmin || isFinance || Boolean(userPermissions.manageExpenses);
  const canViewFullExpenses = canViewOfficeExpenses;

  const [selectedMonth, setSelectedMonth] = useState(getTodayMonthStr);
  // Default tab is always 'EMPLOYEE_EXPENSES' as requested
  const [activeTab, setActiveTab] = useState(canViewFullExpenses ? "EMPLOYEE_EXPENSES" : "MY_EXPENSES");

  // Data states
  const [expenses, setExpenses] = useState([]);
  const [totals, setTotals] = useState({
    totalBase: 0,
    totalGst: 0,
    totalAmount: 0,
    totalPaid: 0,
    totalPending: 0,
    totalCount: 0,
  });
  const [summaryData, setSummaryData] = useState(null);
  const [categories, setCategories] = useState(DEFAULT_CATEGORIES);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [summaryLoading, setSummaryLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("ALL");
  const [selectedStatus, setSelectedStatus] = useState("ALL");
  const [selectedEmployee, setSelectedEmployee] = useState("ALL");

  // Modals
  const [showAddModal, setShowAddModal] = useState(false);
  const [modalExpenseType, setModalExpenseType] = useState("OFFICE"); // 'OFFICE' or 'EMPLOYEE'
  const [editExpense, setEditExpense] = useState(null);
  const [deleteExpense, setDeleteExpense] = useState(null);
  const [formData, setFormData] = useState(() => emptyForm("OFFICE"));
  const [submitting, setSubmitting] = useState(false);

  // Fetch staff list for admin dropdown
  const fetchStaffList = async () => {
    try {
      const res = await axios.get(`${API_URL}/users`, { params: { limit: 200 } });
      if (res.data?.success && res.data.data) {
        setStaffList(res.data.data.filter((u) => u.role !== "SUPERADMIN"));
      }
    } catch (e) {
      // Handled via summaryData fallback
    }
  };

  // Fetch summary data (for admin)
  const fetchSummary = async (month = selectedMonth) => {
    if (!canViewFullExpenses) return;
    try {
      setSummaryLoading(true);
      const res = await axios.get(`${API_URL}/expenses/summary`, {
        params: { month },
      });
      if (res.data?.success) {
        setSummaryData(res.data);
        if (res.data.staffBreakdown && staffList.length === 0) {
          setStaffList(res.data.staffBreakdown);
        }
      }
    } catch (err) {
      console.error("Error fetching expense summary:", err);
    } finally {
      setSummaryLoading(false);
    }
  };

  // Salary Tab States (Tab 3: STAFF)
  const [selectedStaffIds, setSelectedStaffIds] = useState([]);
  const [salaryFilterStatus, setSalaryFilterStatus] = useState("ALL"); // "ALL", "PAID", "PENDING"
  const [salarySearch, setSalarySearch] = useState("");
  const [salaryBulkPaymentMode, setSalaryBulkPaymentMode] = useState("Net Banking");
  const [updatingSalaryId, setUpdatingSalaryId] = useState(null); // specific employee ID or 'bulk'

  // Update Salary Status handler (single or bulk)
  const handleUpdateSalaryStatus = async (employeeIds, targetStatus, paymentMode = "Net Banking") => {
    if (!employeeIds || employeeIds.length === 0) return;
    try {
      setUpdatingSalaryId(employeeIds.length === 1 ? employeeIds[0] : "bulk");
      const res = await axios.post(`${API_URL}/expenses/salary-status`, {
        employeeIds,
        status: targetStatus,
        month: selectedMonth,
        paymentMode: paymentMode || salaryBulkPaymentMode || "Net Banking",
      });

      if (res.data?.success) {
        toast.success(res.data.message || `Salary status updated to ${targetStatus}`);
        if (employeeIds.length > 1) {
          setSelectedStaffIds([]);
        } else {
          setSelectedStaffIds((prev) => prev.filter((id) => id !== employeeIds[0]));
        }
        await fetchSummary(selectedMonth);
      } else {
        toast.error(res.data?.message || "Failed to update salary status");
      }
    } catch (err) {
      console.error("Error updating salary status:", err);
      toast.error(err.response?.data?.message || "Failed to update salary status");
    } finally {
      setUpdatingSalaryId(null);
    }
  };

  const filteredStaffList = useMemo(() => {
    const list = summaryData?.staffBreakdown || [];
    return list.filter((emp) => {
      // Status filter
      if (salaryFilterStatus === "PAID" && emp.salaryStatus !== "PAID") return false;
      if (salaryFilterStatus === "PENDING" && emp.salaryStatus === "PAID") return false;

      // Search filter
      if (salarySearch.trim()) {
        const q = salarySearch.toLowerCase();
        const nameMatch = (emp.name || "").toLowerCase().includes(q);
        const roleMatch = (emp.role || "").toLowerCase().includes(q);
        const emailMatch = (emp.email || "").toLowerCase().includes(q);
        const phoneMatch = (emp.phone || "").toLowerCase().includes(q);
        if (!nameMatch && !roleMatch && !emailMatch && !phoneMatch) return false;
      }
      return true;
    });
  }, [summaryData?.staffBreakdown, salaryFilterStatus, salarySearch]);

  const isAllStaffSelected = useMemo(() => {
    if (!filteredStaffList.length) return false;
    return filteredStaffList.every((emp) => selectedStaffIds.includes(emp.id));
  }, [filteredStaffList, selectedStaffIds]);

  const handleToggleSelectAllStaff = () => {
    if (isAllStaffSelected) {
      const visibleIds = new Set(filteredStaffList.map((e) => e.id));
      setSelectedStaffIds((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      const newIds = new Set([...selectedStaffIds, ...filteredStaffList.map((e) => e.id)]);
      setSelectedStaffIds(Array.from(newIds));
    }
  };

  const handleToggleSelectStaff = (empId) => {
    setSelectedStaffIds((prev) =>
      prev.includes(empId) ? prev.filter((id) => id !== empId) : [...prev, empId]
    );
  };

  // Fetch expenses list
  const fetchExpenses = async () => {
    try {
      setLoading(true);
      const params = {
        month: selectedMonth,
        category: selectedCategory,
        status: selectedStatus,
        search: search.trim() || undefined,
        limit: 150,
      };

      if (canViewFullExpenses) {
        if (activeTab === "OFFICE") {
          params.expenseType = "OFFICE";
        } else if (activeTab === "EMPLOYEE_EXPENSES") {
          params.expenseType = "EMPLOYEE";
          if (selectedEmployee !== "ALL") {
            params.employeeId = selectedEmployee;
          }
        }
      }

      const res = await axios.get(`${API_URL}/expenses`, { params });
      if (res.data?.success) {
        setExpenses(res.data.data || []);
        setTotals(
          res.data.totals || {
            totalBase: 0,
            totalGst: 0,
            totalAmount: 0,
            totalPaid: 0,
            totalPending: 0,
            totalCount: 0,
          }
        );
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
    if (canViewFullExpenses) {
      fetchStaffList();
    }
  }, [canViewFullExpenses]);

  useEffect(() => {
    if (canViewFullExpenses) {
      fetchSummary(selectedMonth);
    }
    fetchExpenses();
  }, [selectedMonth, selectedCategory, selectedStatus, selectedEmployee, search, activeTab, canViewFullExpenses]);

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

  // Live calculation for Office modal
  const computedGstAmount = useMemo(() => {
    const base = parseFloat(formData.baseAmount || formData.amount) || 0;
    const pct = parseFloat(formData.gstPercent) || 0;
    return Math.round(base * (pct / 100) * 100) / 100;
  }, [formData.baseAmount, formData.amount, formData.gstPercent]);

  const computedTotalAmount = useMemo(() => {
    const base = parseFloat(formData.baseAmount || formData.amount) || 0;
    return Math.round((base + computedGstAmount) * 100) / 100;
  }, [formData.baseAmount, formData.amount, computedGstAmount]);

  // Open Add Modal
  const openAddModal = (type = "OFFICE") => {
    const targetType = !canViewFullExpenses ? "EMPLOYEE" : type;
    setModalExpenseType(targetType);
    setEditExpense(null);
    setFormData({
      ...emptyForm(targetType),
      employeeId: canViewFullExpenses && selectedEmployee !== "ALL" ? selectedEmployee : (currentUserId || ""),
    });
    setShowAddModal(true);
  };

  // Open Edit Modal
  const openEditModal = (exp) => {
    setEditExpense(exp);
    const expType = exp.expenseType || "OFFICE";
    setModalExpenseType(expType);
    setFormData({
      expenseDate: exp.expenseDate || new Date().toISOString().slice(0, 10),
      category: exp.category || "Miscellaneous",
      vendorName: exp.vendorName || "",
      description: exp.description || "",
      amount: exp.baseAmount || exp.totalAmount || "",
      baseAmount: exp.baseAmount || exp.totalAmount || "",
      gstPercent: exp.gstPercent !== undefined ? exp.gstPercent : (expType === "EMPLOYEE" ? 0 : 18),
      paymentMode: exp.paymentMode || "UPI",
      status: exp.status || "PAID",
      remarks: exp.remarks || "",
      expenseType: expType,
      employeeId: exp.employeeId || "",
    });
  };

  // Quick toggle between PAID and PENDING for Admin
  const handleQuickStatusToggle = async (exp, newStatus) => {
    try {
      await axios.put(`${API_URL}/expenses/${exp.id}`, { status: newStatus });
      toast.success(`Expense ${exp.expenseCode || ""} marked as ${newStatus}`);
      fetchExpenses();
      if (canViewFullExpenses) fetchSummary(selectedMonth);
    } catch (err) {
      console.error("Status toggle error:", err);
      toast.error(err.response?.data?.message || "Failed to update status");
    }
  };

  // Save new or updated expense
  const handleSaveExpense = async (e) => {
    e.preventDefault();
    if (!formData.expenseDate) {
      toast.error("Please select a date");
      return;
    }
    const valAmount = parseFloat(formData.baseAmount || formData.amount);
    if (!valAmount || valAmount <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setSubmitting(true);
    try {
      const finalType = modalExpenseType || (!canViewFullExpenses ? "EMPLOYEE" : activeTab === "OFFICE" ? "OFFICE" : "EMPLOYEE");
      const payload = {
        expenseDate: formData.expenseDate,
        category: formData.category,
        vendorName: formData.vendorName,
        description: formData.description,
        amount: valAmount,
        baseAmount: valAmount,
        gstPercent: finalType === "EMPLOYEE" ? 0 : parseFloat(formData.gstPercent) || 0,
        paymentMode: formData.paymentMode,
        status: formData.status,
        remarks: formData.remarks,
        expenseType: finalType,
        employeeId: formData.employeeId || undefined,
      };

      if (editExpense) {
        await axios.put(`${API_URL}/expenses/${editExpense.id}`, payload);
        toast.success("Expense updated successfully");
        setEditExpense(null);
      } else {
        await axios.post(`${API_URL}/expenses`, payload);
        toast.success(
          finalType === "EMPLOYEE"
            ? "Employee expense recorded successfully"
            : "Office expense added successfully"
        );
        setShowAddModal(false);
      }

      setFormData(emptyForm(modalExpenseType));
      fetchExpenses();
      if (canViewFullExpenses) fetchSummary(selectedMonth);
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
      if (canViewFullExpenses) fetchSummary(selectedMonth);
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
      "Type",
      "Employee / Submitter",
      "Category",
      "Vendor / Payee",
      "Description",
      "Amount (₹)",
      "Payment Mode",
      "Status",
      "Remarks",
    ];

    const rows = expenses.map((exp) => [
      `"${exp.expenseCode || ""}"`,
      `"${exp.expenseDate || ""}"`,
      `"${exp.expenseType || "OFFICE"}"`,
      `"${(exp.employee?.name || exp.createdBy?.name || "").replace(/"/g, '""')}"`,
      `"${exp.category || ""}"`,
      `"${(exp.vendorName || "").replace(/"/g, '""')}"`,
      `"${(exp.description || "").replace(/"/g, '""')}"`,
      parseFloat(exp.totalAmount || exp.baseAmount || 0).toFixed(2),
      `"${exp.paymentMode || ""}"`,
      `"${exp.status || ""}"`,
      `"${(exp.remarks || "").replace(/"/g, '""')}"`,
    ]);

    const csvContent =
      "data:text/csv;charset=utf-8," + [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
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
            <span>Accounting & Finance</span> /{" "}
            <strong>{canViewFullExpenses ? "Expense Tracker" : "My Expenses & Claims"}</strong>
          </div>
          <h1 className="cc-exp-title">
            {canViewFullExpenses
              ? "Expenses — Business Outflow & Staff Claims"
              : "My Expenses & Reimbursements"}
          </h1>
          <p className="cc-exp-subtitle">
            {canViewFullExpenses
              ? "Office running costs, staff claims, deal payouts, and monthly outflows audit."
              : `Submit and track your business expenses, travel, pantry, meetings and claims.`}
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

          {canViewFullExpenses ? (
            <div style={{ display: "flex", gap: 8 }}>
              <button
                type="button"
                className="cc-exp-btn secondary-btn-green"
                onClick={() => openAddModal("EMPLOYEE")}
                title="Add expense submitted by or for an employee"
              >
                <Users size={15} /> + Add Employee Expense
              </button>
              <button
                type="button"
                className="cc-exp-btn primary"
                onClick={() => openAddModal("OFFICE")}
                title="Add direct office running bill"
              >
                <Plus size={16} /> + Add Office Expense
              </button>
            </div>
          ) : (
            <button
              type="button"
              className="cc-exp-btn primary"
              onClick={() => openAddModal("EMPLOYEE")}
            >
              <Plus size={16} /> + Add New Expense
            </button>
          )}
        </div>
      </div>

      {/* ADMIN OVERVIEW METRIC CARDS */}
      {canViewFullExpenses && (
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
              All Costs: Office + Employee Claims + Salaries + Incentives + Payouts
            </div>
          </div>

          {/* Card 2: Office Running Costs */}
          <div
            className={`cc-exp-stat-card clickable ${activeTab === "OFFICE" ? "active-card" : ""}`}
            onClick={() => setActiveTab("OFFICE")}
          >
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

          {/* Card 3: Expenses by Employees (NEW) */}
          <div
            className={`cc-exp-stat-card clickable ${activeTab === "EMPLOYEE_EXPENSES" ? "active-card" : ""}`}
            onClick={() => setActiveTab("EMPLOYEE_EXPENSES")}
            style={{ borderColor: activeTab === "EMPLOYEE_EXPENSES" ? "#0284c7" : undefined }}
          >
            <div className="cc-exp-stat-head">
              <span style={{ color: "#0369a1", fontWeight: 700 }}>Expenses by Employees</span>
              <span className="cc-exp-stat-icon cyan"><Users size={18} /></span>
            </div>
            <div className="cc-exp-stat-val" style={{ color: "#0284c7" }}>
              {currencyFormatter.format(summary.employeeExpensesTotal || 0)}
            </div>
            <div className="cc-exp-stat-sub">
              Paid: {currencyFormatter.format(summary.employeeExpensesPaid || 0)} | Pending:{" "}
              <strong style={{ color: "#ea580c" }}>{currencyFormatter.format(summary.employeeExpensesPending || 0)}</strong>
            </div>
          </div>

          {/* Card 4: Staff Salaries */}
          <div
            className={`cc-exp-stat-card clickable ${activeTab === "STAFF" ? "active-card" : ""}`}
            onClick={() => setActiveTab("STAFF")}
          >
            <div className="cc-exp-stat-head">
              <span>Staff Salaries (Fixed)</span>
              <span className="cc-exp-stat-icon green"><UserCheck size={18} /></span>
            </div>
            <div className="cc-exp-stat-val">
              {currencyFormatter.format(summary.staffSalaries || 0)}
            </div>
            <div className="cc-exp-stat-sub">
              {summary.employeeCount || 0} active employees on payroll
            </div>
          </div>

          {/* Card 5: Staff Incentives */}
          <div
            className={`cc-exp-stat-card clickable ${activeTab === "PARTNER" ? "active-card" : ""}`}
            onClick={() => setActiveTab("PARTNER")}
          >
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

          {/* Card 6: Partner Payouts */}
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
      )}

      {/* STAFF PORTAL METRIC CARDS (When not admin) */}
      {!canViewFullExpenses && (
        <div className="cc-exp-cards-grid employee-portal-grid">
          <div className="cc-exp-stat-card grand-total">
            <div className="cc-exp-stat-head">
              <span>My Total Month Claims</span>
              <span className="cc-exp-stat-icon blue"><Wallet size={18} /></span>
            </div>
            <div className="cc-exp-stat-val">
              {currencyFormatter.format(totals.totalAmount || 0)}
            </div>
            <div className="cc-exp-stat-sub">
              Total {totals.totalCount || 0} claims submitted in {formatMonthDisplay(selectedMonth)}
            </div>
          </div>

          <div className="cc-exp-stat-card">
            <div className="cc-exp-stat-head">
              <span>Paid / Reimbursed</span>
              <span className="cc-exp-stat-icon green"><CheckCircle2 size={18} /></span>
            </div>
            <div className="cc-exp-stat-val" style={{ color: "#047857" }}>
              {currencyFormatter.format(totals.totalPaid || 0)}
            </div>
            <div className="cc-exp-stat-sub">
              Approved and paid out to you
            </div>
          </div>

          <div className="cc-exp-stat-card">
            <div className="cc-exp-stat-head">
              <span>Pending Reimbursement</span>
              <span className="cc-exp-stat-icon amber"><Clock size={18} /></span>
            </div>
            <div className="cc-exp-stat-val" style={{ color: "#d97706" }}>
              {currencyFormatter.format(totals.totalPending || 0)}
            </div>
            <div className="cc-exp-stat-sub">
              Awaiting admin approval / settlement
            </div>
          </div>
        </div>
      )}

      {/* ADMIN TABS BAR */}
      {canViewFullExpenses && (
        <div className="cc-exp-tabs-container">
          <button
            type="button"
            className={`cc-exp-tab-btn highlight-tab ${activeTab === "EMPLOYEE_EXPENSES" ? "active" : ""}`}
            onClick={() => setActiveTab("EMPLOYEE_EXPENSES")}
          >
            <Users size={16} /> Expenses by Employees
            <span className="cc-exp-badge cyan-badge">
              {summaryData?.summary?.employeeExpenseCount || 0}
            </span>
          </button>

          <button
            type="button"
            className={`cc-exp-tab-btn ${activeTab === "OFFICE" ? "active" : ""}`}
            onClick={() => setActiveTab("OFFICE")}
          >
            <Receipt size={16} /> Office Running Costs Table
            <span className="cc-exp-badge">{summaryData?.summary?.officeExpenseCount || 0}</span>
          </button>

          <button
            type="button"
            className={`cc-exp-tab-btn ${activeTab === "STAFF" ? "active" : ""}`}
            onClick={() => setActiveTab("STAFF")}
          >
            <UserCheck size={16} /> Staff Salaries & Incentives
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
      )}

      {/* TAB 1: OFFICE RUNNING COSTS (Exact spreadsheet replica for Admin) */}
      {canViewFullExpenses && activeTab === "OFFICE" && (
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
                        No office expenses found for this month / filter. Click <strong>"+ Add Office Expense"</strong> to add one.
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

      {/* TAB 2: EXPENSES BY EMPLOYEES (THE NEW REQUESTED TAB FOR ADMIN) */}
      {canViewFullExpenses && activeTab === "EMPLOYEE_EXPENSES" && (
        <div className="cc-exp-table-section">
          {/* Sub-Header Banner */}
          <div className="cc-exp-tab-head-banner cyan-banner">
            <div>
              <h3>Expenses Submitted by Employees & Team Managers</h3>
              <p>
                Claims and business expenses incurred by Sales Managers, Operations Team, Calling Staff and Employees for{" "}
                <strong>{formatMonthDisplay(selectedMonth)}</strong>.
              </p>
            </div>
            <div className="cc-exp-tab-head-pills">
              <span className="pill blue">
                Total Claims: {currencyFormatter.format(summary.employeeExpensesTotal || totals.totalAmount || 0)}
              </span>
              <span className="pill green">
                Paid: {currencyFormatter.format(summary.employeeExpensesPaid || totals.totalPaid || 0)}
              </span>
              <span className="pill amber">
                Pending Reimbursement: {currencyFormatter.format(summary.employeeExpensesPending || totals.totalPending || 0)}
              </span>
            </div>
          </div>

          {/* Table Filters Bar */}
          <div className="cc-exp-filter-bar">
            <div className="cc-exp-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by Employee, Category, Remarks, Code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="cc-exp-select-filters">
              {/* Filter by Employee */}
              <div className="cc-exp-filter-group">
                <span>Employee:</span>
                <select value={selectedEmployee} onChange={(e) => setSelectedEmployee(e.target.value)}>
                  <option value="ALL">All Employees</option>
                  {staffList.map((emp) => (
                    <option key={emp.id} value={emp.id}>
                      {emp.name} ({emp.role})
                    </option>
                  ))}
                </select>
              </div>

              {/* Filter by Category */}
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

              {/* Filter by Status */}
              <div className="cc-exp-filter-group">
                <span>Status:</span>
                <select value={selectedStatus} onChange={(e) => setSelectedStatus(e.target.value)}>
                  <option value="ALL">All Status</option>
                  <option value="PAID">Paid</option>
                  <option value="PENDING">Pending</option>
                </select>
              </div>

              {(search || selectedEmployee !== "ALL" || selectedCategory !== "ALL" || selectedStatus !== "ALL") && (
                <button
                  type="button"
                  className="cc-exp-reset-btn"
                  onClick={() => {
                    setSearch("");
                    setSelectedEmployee("ALL");
                    setSelectedCategory("ALL");
                    setSelectedStatus("ALL");
                  }}
                >
                  <RefreshCw size={13} /> Reset
                </button>
              )}

              <button
                type="button"
                className="cc-exp-btn primary"
                onClick={() => openAddModal("EMPLOYEE")}
                style={{ marginLeft: "auto" }}
              >
                <Plus size={15} /> Add Employee Expense
              </button>
            </div>
          </div>

          {/* Employee Expenses Table */}
          <div className="cc-exp-sheet-wrapper">
            <div className="cc-exp-table-scroll">
              <table className="cc-exp-sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Claim Code</th>
                    <th style={{ width: 105 }}>Date</th>
                    <th>Employee Name & Role</th>
                    <th style={{ width: 160 }}>Category</th>
                    <th style={{ width: 140, textAlign: "right" }}>Amount (₹)</th>
                    <th style={{ width: 130, textAlign: "center" }}>Status</th>
                    <th style={{ width: 120 }}>Payment Mode</th>
                    <th style={{ minWidth: 200 }}>Remarks & Notes</th>
                    <th style={{ width: 130, textAlign: "center" }}>Quick Action</th>
                    <th style={{ width: 85, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={10} className="cc-exp-empty-cell">
                        <RefreshCw size={20} className="cc-spin" /> Loading employee expenses...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={10} className="cc-exp-empty-cell">
                        No employee expenses recorded for this month. Click{" "}
                        <strong>"+ Add Employee Expense"</strong> or wait for employee submissions.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => {
                      const empUser = exp.employee || exp.createdBy;
                      const empName = empUser?.name || "Direct";
                      const empRole = empUser?.role || "EMPLOYEE";
                      const empEmail = empUser?.email || "";
                      const amount = parseFloat(exp.totalAmount || exp.baseAmount || 0);

                      return (
                        <tr key={exp.id} className="cc-exp-row">
                          <td>
                            <span className="cc-exp-id-pill cyan">{exp.expenseCode || `EXP-EMP-${exp.id}`}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>
                              {exp.expenseDate}
                            </span>
                          </td>
                          <td>
                            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                              <span className="cc-exp-user-avatar cyan">
                                {(empName || "?").slice(0, 2).toUpperCase()}
                              </span>
                              <div>
                                <strong style={{ color: "#0f172a", fontSize: 13.5, display: "block" }}>
                                  {empName}
                                </strong>
                                <div style={{ display: "flex", alignItems: "center", gap: 6, marginTop: 2 }}>
                                  <span className={`cc-exp-role-badge ${empRole.toLowerCase()}`}>
                                    {empRole === "OPS" ? "Operations" : empRole === "MANAGER" ? "Sales Manager" : empRole}
                                  </span>
                                  {empEmail && (
                                    <span style={{ fontSize: 11.5, color: "#64748b" }}>{empEmail}</span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </td>
                          <td>
                            <span className="cc-exp-cat-badge">{exp.category}</span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                            {currencyFormatter.format(amount)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`cc-exp-status-pill ${exp.status?.toLowerCase()}`}>
                              {exp.status === "PAID" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                              {exp.status}
                            </span>
                          </td>
                          <td>
                            <span className="cc-exp-mode-tag">{exp.paymentMode || "UPI"}</span>
                          </td>
                          <td>
                            <div className="cc-exp-remarks-cell">
                              {exp.remarks || exp.description || "--"}
                            </div>
                          </td>
                          <td style={{ textAlign: "center" }}>
                            {exp.status === "PENDING" ? (
                              <button
                                type="button"
                                className="cc-exp-quick-pay-btn"
                                onClick={() => handleQuickStatusToggle(exp, "PAID")}
                                title="Click to approve and mark as PAID"
                              >
                                <CheckCircle2 size={12} /> Mark Paid
                              </button>
                            ) : (
                              <button
                                type="button"
                                className="cc-exp-quick-pending-btn"
                                onClick={() => handleQuickStatusToggle(exp, "PENDING")}
                                title="Click to mark as PENDING"
                              >
                                <Clock size={12} /> Mark Pending
                              </button>
                            )}
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
                      <td colSpan={4} style={{ textAlign: "right", fontWeight: 700, paddingRight: 16 }}>
                        TOTAL EMPLOYEE EXPENSES ({totals.totalCount} Claims):
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#0284c7", fontSize: 14 }}>
                        {currencyFormatter.format(totals.totalAmount)}
                      </td>
                      <td colSpan={2} style={{ textAlign: "center", fontSize: 12, color: "#475569" }}>
                        Paid: <strong>{currencyFormatter.format(totals.totalPaid)}</strong> | Pending:{" "}
                        <strong style={{ color: "#ea580c" }}>{currencyFormatter.format(totals.totalPending)}</strong>
                      </td>
                      <td colSpan={3}></td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* STAFF PORTAL VIEW (For Employees, Sales Managers, Operations viewing their own claims) */}
      {!canViewFullExpenses && (
        <div className="cc-exp-table-section">
          {/* Table Filters Bar */}
          <div className="cc-exp-filter-bar">
            <div className="cc-exp-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search your expense remark, category, code..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
              />
            </div>

            <div className="cc-exp-select-filters">
              {/* Category Filter */}
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

              {/* Status Filter */}
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

              <button
                type="button"
                className="cc-exp-btn primary"
                onClick={() => openAddModal("EMPLOYEE")}
                style={{ marginLeft: "auto" }}
              >
                <Plus size={15} /> Add Expense
              </button>
            </div>
          </div>

          {/* Claims Table */}
          <div className="cc-exp-sheet-wrapper">
            <div className="cc-exp-table-scroll">
              <table className="cc-exp-sheet-table">
                <thead>
                  <tr>
                    <th style={{ width: 120 }}>Claim Code</th>
                    <th style={{ width: 105 }}>Date</th>
                    <th style={{ width: 170 }}>Category</th>
                    <th style={{ width: 130, textAlign: "right" }}>Amount (₹)</th>
                    <th style={{ width: 120, textAlign: "center" }}>Status</th>
                    <th style={{ width: 120 }}>Payment Mode</th>
                    <th style={{ minWidth: 220 }}>Remarks & Description</th>
                    <th style={{ width: 85, textAlign: "center" }}>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {loading ? (
                    <tr>
                      <td colSpan={8} className="cc-exp-empty-cell">
                        <RefreshCw size={20} className="cc-spin" /> Loading your expenses...
                      </td>
                    </tr>
                  ) : expenses.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="cc-exp-empty-cell">
                        No expenses found for {formatMonthDisplay(selectedMonth)}. Click{" "}
                        <strong>"+ Add New Expense"</strong> to submit a claim.
                      </td>
                    </tr>
                  ) : (
                    expenses.map((exp) => {
                      const amount = parseFloat(exp.totalAmount || exp.baseAmount || 0);

                      return (
                        <tr key={exp.id} className="cc-exp-row">
                          <td>
                            <span className="cc-exp-id-pill cyan">{exp.expenseCode || `EXP-${exp.id}`}</span>
                          </td>
                          <td>
                            <span style={{ fontWeight: 600, color: "#1e293b", fontSize: 13 }}>
                              {exp.expenseDate}
                            </span>
                          </td>
                          <td>
                            <span className="cc-exp-cat-badge">{exp.category}</span>
                          </td>
                          <td style={{ textAlign: "right", fontWeight: 700, fontSize: 14, color: "#0f172a" }}>
                            {currencyFormatter.format(amount)}
                          </td>
                          <td style={{ textAlign: "center" }}>
                            <span className={`cc-exp-status-pill ${exp.status?.toLowerCase()}`}>
                              {exp.status === "PAID" ? <CheckCircle2 size={12} /> : <Clock size={12} />}
                              {exp.status}
                            </span>
                          </td>
                          <td>
                            <span className="cc-exp-mode-tag">{exp.paymentMode || "UPI"}</span>
                          </td>
                          <td>
                            <div className="cc-exp-remarks-cell">
                              {exp.remarks || exp.description || "--"}
                            </div>
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
                      <td colSpan={3} style={{ textAlign: "right", fontWeight: 700, paddingRight: 16 }}>
                        MY TOTAL CLAIMS ({totals.totalCount} Records):
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 800, color: "#047857", fontSize: 14 }}>
                        {currencyFormatter.format(totals.totalAmount)}
                      </td>
                      <td colSpan={4} style={{ textAlign: "left", paddingLeft: 16, fontSize: 12, color: "#475569" }}>
                        Paid: <strong>{currencyFormatter.format(totals.totalPaid)}</strong> | Pending:{" "}
                        <strong style={{ color: "#ea580c" }}>{currencyFormatter.format(totals.totalPending)}</strong>
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          </div>
        </div>
      )}

      {/* TAB 3: STAFF SALARIES & INCENTIVES (FOR ADMIN) */}
      {canViewFullExpenses && activeTab === "STAFF" && (
        <div className="cc-exp-table-section">
          {/* Top Banner with Key Payroll Metrics */}
          <div className="cc-exp-tab-head-banner">
            <div>
              <h3>Employee Monthly Payroll & Salary Status</h3>
              <p>
                Calculates Base Monthly Salary + Case Incentives for{" "}
                <strong>{formatMonthDisplay(selectedMonth)}</strong>. Mark salaries as PAID or PENDING individually or in bulk.
              </p>
            </div>
            <div className="cc-exp-tab-head-pills">
              <span className="pill total">
                Combined Staff Cost: {currencyFormatter.format(summary.staffTotalCost || 0)}
              </span>
              <span className="pill green">
                <CheckCircle2 size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                Paid: {currencyFormatter.format(summary.staffSalariesPaid || 0)} ({summary.staffPaidCount || 0} Staff)
              </span>
              <span className="pill amber">
                <Clock size={13} style={{ display: "inline", verticalAlign: "middle", marginRight: 4 }} />
                Pending: {currencyFormatter.format(summary.staffSalariesPending || 0)} ({summary.staffPendingCount || 0} Staff)
              </span>
              <span className="pill blue">
                Base Salaries: {currencyFormatter.format(summary.staffSalaries || 0)}
              </span>
              <span className="pill purple">
                Total Incentives: {currencyFormatter.format(summary.staffIncentives || 0)}
              </span>
            </div>
          </div>

          {/* Filter Bar & Search for Staff Salaries */}
          <div className="cc-exp-staff-subbar">
            <div className="cc-exp-staff-filter-tabs">
              <button
                type="button"
                className={`cc-exp-staff-tab-btn ${salaryFilterStatus === "ALL" ? "active" : ""}`}
                onClick={() => setSalaryFilterStatus("ALL")}
              >
                All Staff <span className="badge">{summaryData?.staffBreakdown?.length || 0}</span>
              </button>
              <button
                type="button"
                className={`cc-exp-staff-tab-btn ${salaryFilterStatus === "PAID" ? "active" : ""}`}
                onClick={() => setSalaryFilterStatus("PAID")}
              >
                <CheckCircle2 size={13} style={{ color: "#16a34a" }} />
                Paid <span className="badge">{summary.staffPaidCount || 0}</span>
              </button>
              <button
                type="button"
                className={`cc-exp-staff-tab-btn ${salaryFilterStatus === "PENDING" ? "active" : ""}`}
                onClick={() => setSalaryFilterStatus("PENDING")}
              >
                <Clock size={13} style={{ color: "#d97706" }} />
                Pending <span className="badge">{summary.staffPendingCount || 0}</span>
              </button>
            </div>

            <div className="cc-exp-search-box" style={{ maxWidth: 360 }}>
              <Search size={15} color="#94a3b8" />
              <input
                type="text"
                placeholder="Search staff by name, role, phone..."
                value={salarySearch}
                onChange={(e) => setSalarySearch(e.target.value)}
              />
              {salarySearch && (
                <button
                  type="button"
                  style={{ border: "none", background: "none", cursor: "pointer", padding: 0 }}
                  onClick={() => setSalarySearch("")}
                >
                  <X size={14} color="#94a3b8" />
                </button>
              )}
            </div>
          </div>

          {/* Bulk Selection Action Bar */}
          {selectedStaffIds.length > 0 && (
            <div className="cc-exp-bulk-bar">
              <div className="cc-exp-bulk-info">
                <span className="cc-exp-bulk-check-badge">✓</span>
                <span>
                  <strong>{selectedStaffIds.length}</strong> staff selected (Bulk Action)
                </span>
              </div>

              <div className="cc-exp-bulk-actions">
                <div className="cc-exp-bulk-mode">
                  <label>Mode:</label>
                  <select
                    value={salaryBulkPaymentMode}
                    onChange={(e) => setSalaryBulkPaymentMode(e.target.value)}
                  >
                    {PAYMENT_MODES.map((m) => (
                      <option key={m} value={m}>
                        {m}
                      </option>
                    ))}
                  </select>
                </div>

                <button
                  type="button"
                  className="cc-exp-bulk-btn paid"
                  disabled={updatingSalaryId !== null}
                  onClick={() => handleUpdateSalaryStatus(selectedStaffIds, "PAID", salaryBulkPaymentMode)}
                >
                  {updatingSalaryId === "bulk" ? (
                    <RefreshCw size={14} className="cc-spin" />
                  ) : (
                    <CheckCircle2 size={15} />
                  )}
                  <span>Mark Selected as PAID ({selectedStaffIds.length})</span>
                </button>

                <button
                  type="button"
                  className="cc-exp-bulk-btn pending"
                  disabled={updatingSalaryId !== null}
                  onClick={() => handleUpdateSalaryStatus(selectedStaffIds, "PENDING")}
                >
                  {updatingSalaryId === "bulk" ? (
                    <RefreshCw size={14} className="cc-spin" />
                  ) : (
                    <Clock size={15} />
                  )}
                  <span>Mark Selected as PENDING ({selectedStaffIds.length})</span>
                </button>

                <button
                  type="button"
                  className="cc-exp-bulk-btn clear"
                  onClick={() => setSelectedStaffIds([])}
                  title="Clear Selection"
                >
                  <X size={14} /> Clear
                </button>
              </div>
            </div>
          )}

          {/* Salaries Table */}
          <div className="cc-exp-table-scroll">
            <table className="cc-exp-sheet-table">
              <thead>
                <tr>
                  <th style={{ width: 44, textAlign: "center" }}>
                    <input
                      type="checkbox"
                      className="cc-exp-checkbox"
                      checked={isAllStaffSelected}
                      onChange={handleToggleSelectAllStaff}
                      title="Select / Deselect all visible staff"
                    />
                  </th>
                  <th style={{ width: 70 }}>Emp ID</th>
                  <th>Employee Name</th>
                  <th>Role / Designation</th>
                  <th>Contact Info</th>
                  <th style={{ width: 135, textAlign: "right" }}>Monthly Base Salary (₹)</th>
                  <th style={{ width: 100, textAlign: "center" }}>Cases Closed</th>
                  <th style={{ width: 145, textAlign: "right" }}>Case Incentives (₹)</th>
                  <th style={{ width: 155, textAlign: "right" }}>Total Month Earning (₹)</th>
                  <th style={{ width: 130, textAlign: "center" }}>Salary Status</th>
                  <th style={{ width: 135, textAlign: "center" }}>Change Status</th>
                </tr>
              </thead>
              <tbody>
                {!filteredStaffList.length ? (
                  <tr>
                    <td colSpan={11} className="cc-exp-empty-cell">
                      {summaryLoading ? "Loading staff salary data..." : "No staff found matching filters."}
                    </td>
                  </tr>
                ) : (
                  filteredStaffList.map((emp) => {
                    const isSelected = selectedStaffIds.includes(emp.id);
                    const isPaid = emp.salaryStatus === "PAID";
                    const isUpdatingThis = updatingSalaryId === emp.id;

                    return (
                      <tr key={emp.id} className={`cc-exp-row ${isSelected ? "selected" : ""}`}>
                        {/* Checkbox column for bulk selection */}
                        <td style={{ textAlign: "center" }}>
                          <input
                            type="checkbox"
                            className="cc-exp-checkbox"
                            checked={isSelected}
                            onChange={() => handleToggleSelectStaff(emp.id)}
                            title={`Select ${emp.name}`}
                          />
                        </td>

                        <td style={{ fontWeight: 600 }}>#{emp.id}</td>

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

                        <td
                          style={{
                            textAlign: "right",
                            fontWeight: 600,
                            color: emp.totalIncentive > 0 ? "#d97706" : "#64748b",
                          }}
                        >
                          <div>{currencyFormatter.format(emp.totalIncentive || 0)}</div>
                          {(emp.lgIncentiveTotal > 0 || emp.lcIncentiveTotal > 0) && (
                            <div style={{ display: "flex", gap: 3, justifyContent: "flex-end", marginTop: 3, flexWrap: "wrap" }}>
                              {emp.lgIncentiveTotal > 0 && (
                                <span style={{ fontSize: 9.5, background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "1px 4px", borderRadius: 4, fontWeight: 700 }} title="Lead Generator Incentive">
                                  LG: ₹{Math.round(emp.lgIncentiveTotal).toLocaleString("en-IN")}
                                </span>
                              )}
                              {emp.lcIncentiveTotal > 0 && (
                                <span style={{ fontSize: 9.5, background: "#eff6ff", border: "1px solid #93c5fd", color: "#1e40af", padding: "1px 4px", borderRadius: 4, fontWeight: 700 }} title="Lead Converter (Operations) Incentive">
                                  LC: ₹{Math.round(emp.lcIncentiveTotal).toLocaleString("en-IN")}
                                </span>
                              )}
                            </div>
                          )}
                        </td>

                        <td style={{ textAlign: "right", fontWeight: 800, color: "#047857", fontSize: 14 }}>
                          {currencyFormatter.format(emp.totalPayable || 0)}
                        </td>

                        {/* Salary Status Pill */}
                        <td style={{ textAlign: "center" }}>
                          <div style={{ display: "inline-flex", flexDirection: "column", alignItems: "center", gap: 2 }}>
                            <span className={`cc-exp-status-pill ${isPaid ? "paid" : "pending"}`}>
                              {isPaid ? (
                                <>
                                  <CheckCircle2 size={12} /> PAID
                                </>
                              ) : (
                                <>
                                  <Clock size={12} /> PENDING
                                </>
                              )}
                            </span>
                            {isPaid && (
                              <span style={{ fontSize: 10.5, color: "#64748b" }}>
                                {emp.paymentMode || "Net Banking"}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* Individual Status Actions */}
                        <td style={{ textAlign: "center" }}>
                          <div className="cc-exp-row-status-actions">
                            <select
                              className={`cc-exp-status-dropdown ${isPaid ? "paid" : "pending"}`}
                              value={isPaid ? "PAID" : "PENDING"}
                              disabled={isUpdatingThis}
                              onChange={(e) =>
                                handleUpdateSalaryStatus([emp.id], e.target.value, emp.paymentMode || "Net Banking")
                              }
                              title="Select salary status"
                            >
                              <option value="PAID">✓ PAID</option>
                              <option value="PENDING">⏳ PENDING</option>
                            </select>
                            {isUpdatingThis && (
                              <RefreshCw size={12} className="cc-spin" style={{ color: "#64748b" }} />
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="cc-exp-sheet-total-row">
                  <td colSpan={5} style={{ textAlign: "right", fontWeight: 700, paddingRight: 16 }}>
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
                  <td colSpan={2} style={{ textAlign: "center", fontSize: 12, color: "#475569", fontWeight: 600 }}>
                    <span style={{ color: "#16a34a", marginRight: 8 }}>
                      ✓ {summary.staffPaidCount || 0} Paid
                    </span>
                    <span style={{ color: "#d97706" }}>
                      ⏳ {summary.staffPendingCount || 0} Pending
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </div>
        </div>
      )}

      {/* TAB 4: DEAL-WISE INCENTIVES & PARTNER COMMISSIONS */}
      {canViewFullExpenses && activeTab === "PARTNER" && (
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
                  <th>Assigned Employee / Role</th>
                  <th style={{ textAlign: "right", color: "#d97706" }}>Staff Incentive (LG / LC)</th>
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
                    <tr key={c.uniqueKey || `${c.caseId}_${c.roleTag || 'item'}`} className="cc-exp-row">
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
                        <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                          <span className="cc-exp-emp-tag">👤 {c.employeeName}</span>
                          {c.roleTag === "LG" && (
                            <span style={{ fontSize: 10, background: "#f0fdf4", border: "1px solid #86efac", color: "#166534", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>
                              LG
                            </span>
                          )}
                          {c.roleTag === "LC" && (
                            <span style={{ fontSize: 10, background: "#eff6ff", border: "1px solid #93c5fd", color: "#1e40af", padding: "1px 5px", borderRadius: 4, fontWeight: 800 }}>
                              LC
                            </span>
                          )}
                          {c.roleTag === "MANPOWER" && (
                            <span style={{ fontSize: 10, background: "#fef3c7", border: "1px solid #fde68a", color: "#92400e", padding: "1px 5px", borderRadius: 4, fontWeight: 700 }}>
                              Manpower
                            </span>
                          )}
                        </div>
                      </td>
                      <td style={{ textAlign: "right", fontWeight: 700, color: c.roleTag === "LG" ? "#15803d" : c.roleTag === "LC" ? "#1d4ed8" : "#d97706" }}>
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

      {/* TAB 5: MONTHLY P&L & EXPENSE CATEGORY ANALYTICS */}
      {canViewFullExpenses && activeTab === "ANALYTICS" && (
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
                  <span>Less: Expenses by Employees (Claims):</span>
                  <span style={{ color: "#ea580c" }}>-{currencyFormatter.format(summary.employeeExpensesTotal || 0)}</span>
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
                <h3>
                  {editExpense
                    ? modalExpenseType === "EMPLOYEE"
                      ? "Update Employee Expense Claim"
                      : "Update Office Expense"
                    : modalExpenseType === "EMPLOYEE"
                    ? "Add Employee Expense Claim"
                    : "Add Office Running Expense"}
                </h3>
                <small style={{ color: "#64748b", fontSize: 12 }}>
                  {modalExpenseType === "EMPLOYEE"
                    ? "Record daily expense, travel, pantry, mobile recharge or operational claim."
                    : "Month, GST Amount and Total Amount calculate on their own."}
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
                {/* For Admin adding an employee expense: allow selecting employee */}
                {modalExpenseType === "EMPLOYEE" && canViewFullExpenses && (
                  <label className="cc-exp-field span-2">
                    <span>Select Employee *</span>
                    <select
                      value={formData.employeeId || ""}
                      onChange={(e) => handleInputChange("employeeId", e.target.value)}
                      required
                    >
                      <option value="">-- Choose Employee --</option>
                      {staffList.map((emp) => (
                        <option key={emp.id} value={emp.id}>
                          {emp.name} ({emp.role === "OPS" ? "Operations" : emp.role === "MANAGER" ? "Sales Manager" : emp.role})
                        </option>
                      ))}
                    </select>
                  </label>
                )}

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

                {/* Category */}
                <label className="cc-exp-field">
                  <span>Category *</span>
                  <select
                    value={formData.category}
                    onChange={(e) => handleInputChange("category", e.target.value)}
                    required
                  >
                    {categories.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </label>

                {/* Amount (₹) */}
                <label className="cc-exp-field">
                  <span>Amount (₹) *</span>
                  <input
                    type="number"
                    step="any"
                    min="0"
                    required
                    placeholder="e.g. 500"
                    value={formData.baseAmount || formData.amount}
                    onChange={(e) => {
                      handleInputChange("baseAmount", e.target.value);
                      handleInputChange("amount", e.target.value);
                    }}
                  />
                </label>

                {/* Status: Paid or Pending */}
                <label className="cc-exp-field">
                  <span>Payment Status (Paid ya Pending) *</span>
                  <select
                    value={formData.status}
                    onChange={(e) => handleInputChange("status", e.target.value)}
                  >
                    <option value="PAID">PAID</option>
                    <option value="PENDING">PENDING</option>
                  </select>
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

                {/* If OFFICE expense: show Vendor, GST %, Total */}
                {modalExpenseType === "OFFICE" && (
                  <>
                    <label className="cc-exp-field">
                      <span>Vendor / Payee</span>
                      <input
                        type="text"
                        placeholder="e.g. DLF Properties, Airtel, Tata Power"
                        value={formData.vendorName}
                        onChange={(e) => handleInputChange("vendorName", e.target.value)}
                      />
                    </label>

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

                    <label className="cc-exp-field">
                      <span>Total Amount (Auto Calculated)</span>
                      <div className="cc-exp-computed-val highlight">
                        {currencyFormatter.format(computedTotalAmount)}
                      </div>
                    </label>

                    <label className="cc-exp-field span-2">
                      <span>Description</span>
                      <input
                        type="text"
                        placeholder="e.g. Office electricity bill for Sep 2026"
                        value={formData.description}
                        onChange={(e) => handleInputChange("description", e.target.value)}
                      />
                    </label>
                  </>
                )}

                {/* Remarks */}
                <label className="cc-exp-field span-2">
                  <span>Remarks / Notes *</span>
                  <textarea
                    rows={2}
                    placeholder="Details about this expense, purpose, bill ref..."
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
                  {submitting
                    ? "Saving..."
                    : editExpense
                    ? "Update Expense"
                    : modalExpenseType === "EMPLOYEE"
                    ? "Submit Employee Expense"
                    : "Save Office Expense"}
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
                <p>Confirm Action</p>
                <h3>Delete Expense Record?</h3>
              </div>
              <button
                type="button"
                className="cc-exp-modal-close"
                onClick={() => setDeleteExpense(null)}
              >
                <X size={18} />
              </button>
            </div>
            <div style={{ padding: "18px 24px", color: "#475569", fontSize: 14 }}>
              Are you sure you want to permanently delete expense{" "}
              <strong>{deleteExpense.expenseCode || `#${deleteExpense.id}`}</strong> (
              {currencyFormatter.format(deleteExpense.totalAmount || deleteExpense.baseAmount || 0)})?
            </div>
            <div className="cc-exp-modal-actions">
              <button
                type="button"
                className="cc-exp-btn secondary"
                onClick={() => setDeleteExpense(null)}
              >
                Cancel
              </button>
              <button
                type="button"
                className="cc-exp-btn danger"
                onClick={handleDeleteExpense}
              >
                Delete Expense
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
.cc-exp-btn.primary:hover {
  background: #065f46;
}
.cc-exp-btn.secondary {
  background: #ffffff;
  color: #334155;
  border-color: #cbd5e1;
}
.cc-exp-btn.secondary:hover {
  background: #f8fafc;
  color: #0f172a;
}
.cc-exp-btn.secondary-btn-green {
  background: #ecfdf5;
  color: #047857;
  border-color: #a7f3d0;
}
.cc-exp-btn.secondary-btn-green:hover {
  background: #d1fae5;
  color: #065f46;
}
.cc-exp-btn.danger {
  background: #dc2626;
  color: #ffffff;
}
.cc-exp-btn.danger:hover {
  background: #b91c1c;
}

/* Metric Summary Cards Grid */
.cc-exp-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
  gap: 14px;
}
.cc-exp-cards-grid.employee-portal-grid {
  grid-template-columns: repeat(auto-fit, minmax(260px, 1fr));
}

.cc-exp-stat-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 18px;
  display: flex;
  flex-direction: column;
  gap: 6px;
  box-shadow: 0 1px 2px rgba(0,0,0,0.03);
  transition: all 0.15s ease;
}
.cc-exp-stat-card.clickable {
  cursor: pointer;
}
.cc-exp-stat-card.clickable:hover {
  border-color: #94a3b8;
  transform: translateY(-1px);
}
.cc-exp-stat-card.active-card {
  border-color: #047857;
  background: #fbfdfc;
  box-shadow: 0 0 0 1px #047857;
}

.cc-exp-stat-card.grand-total {
  background: linear-gradient(135deg, #fef2f2 0%, #ffffff 100%);
  border-color: #fecaca;
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
.cc-exp-stat-icon.cyan { background: #e0f2fe; color: #0369a1; }
.cc-exp-stat-icon.green { background: #dcfce7; color: #16a34a; }
.cc-exp-stat-icon.amber { background: #fef3c7; color: #d97706; }
.cc-exp-stat-icon.purple { background: #f3e8ff; color: #9333ea; }

.cc-exp-stat-val {
  font-size: 22px;
  font-weight: 800;
  color: #0f172a;
}
.cc-exp-stat-sub {
  font-size: 11.5px;
  color: #64748b;
  line-height: 1.4;
}

/* Tabs Container */
.cc-exp-tabs-container {
  display: flex;
  gap: 8px;
  border-bottom: 2px solid #e2e8f0;
  padding-bottom: 0px;
  overflow-x: auto;
}
.cc-exp-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 10px 18px;
  font-size: 13.5px;
  font-weight: 600;
  color: #64748b;
  background: transparent;
  border: none;
  border-bottom: 2px solid transparent;
  margin-bottom: -2px;
  cursor: pointer;
  transition: all 0.15s;
  white-space: nowrap;
}
.cc-exp-tab-btn:hover {
  color: #0f172a;
  background: #f1f5f9;
  border-radius: 8px 8px 0 0;
}
.cc-exp-tab-btn.active {
  color: #047857;
  border-bottom-color: #047857;
  font-weight: 700;
}
.cc-exp-tab-btn.highlight-tab.active {
  color: #0284c7;
  border-bottom-color: #0284c7;
}

.cc-exp-badge {
  display: inline-block;
  padding: 2px 7px;
  font-size: 11px;
  font-weight: 700;
  border-radius: 999px;
  background: #e2e8f0;
  color: #475569;
}
.cc-exp-tab-btn.active .cc-exp-badge {
  background: #d1fae5;
  color: #047857;
}
.cc-exp-badge.cyan-badge {
  background: #e0f2fe;
  color: #0369a1;
}

/* Tab Head Banner */
.cc-exp-tab-head-banner {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 16px 20px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 14px;
}
.cc-exp-tab-head-banner.cyan-banner {
  background: linear-gradient(135deg, #f0f9ff 0%, #ffffff 100%);
  border-color: #bae6fd;
}
.cc-exp-tab-head-banner h3 {
  margin: 0;
  font-size: 16px;
  font-weight: 700;
  color: #0f172a;
}
.cc-exp-tab-head-banner p {
  margin: 3px 0 0;
  font-size: 12.5px;
  color: #64748b;
}
.cc-exp-tab-head-pills {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
}
.cc-exp-tab-head-pills .pill {
  padding: 5px 12px;
  border-radius: 7px;
  font-size: 12px;
  font-weight: 600;
}
.cc-exp-tab-head-pills .pill.green { background: #dcfce7; color: #15803d; }
.cc-exp-tab-head-pills .pill.blue { background: #e0f2fe; color: #0284c7; }
.cc-exp-tab-head-pills .pill.amber { background: #fef3c7; color: #b45309; }
.cc-exp-tab-head-pills .pill.purple { background: #f3e8ff; color: #7e22ce; }
.cc-exp-tab-head-pills .pill.total { background: #047857; color: #ffffff; }

/* Table Section */
.cc-exp-table-section {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

/* Filters bar */
.cc-exp-filter-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #ffffff;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}
.cc-exp-search-box {
  display: flex;
  align-items: center;
  gap: 8px;
  background: #f8fafc;
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 6px 12px;
  flex: 1;
  min-width: 240px;
  max-width: 440px;
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
  gap: 10px;
  flex-wrap: wrap;
}
.cc-exp-filter-group {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 500;
  color: #475569;
}
.cc-exp-filter-group select {
  padding: 6px 10px;
  font-size: 12.5px;
  border: 1px solid #cbd5e1;
  border-radius: 7px;
  background: #ffffff;
  color: #0f172a;
  outline: none;
  cursor: pointer;
}
.cc-exp-reset-btn {
  background: #f1f5f9;
  border: 1px solid #cbd5e1;
  color: #475569;
  font-size: 12px;
  padding: 6px 10px;
  border-radius: 7px;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 4px;
}
.cc-exp-reset-btn:hover {
  background: #e2e8f0;
  color: #0f172a;
}

/* Spreadsheet Wrapper */
.cc-exp-sheet-wrapper {
  background: #ffffff;
  border: 1px solid #cbd5e1;
  border-radius: 12px;
  overflow: hidden;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}
.cc-exp-sheet-header-banner {
  background: #f1f5f9;
  border-bottom: 1px solid #cbd5e1;
  padding: 10px 16px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  font-weight: 600;
  color: #334155;
}
.cc-exp-sheet-header-banner small {
  font-weight: 400;
  color: #64748b;
  font-size: 11.5px;
}

.cc-exp-table-scroll {
  overflow-x: auto;
  max-width: 100%;
}
.cc-exp-sheet-table {
  width: 100%;
  border-collapse: collapse;
  font-size: 12.5px;
  text-align: left;
}
.cc-exp-sheet-table th {
  background: #f8fafc;
  color: #475569;
  font-weight: 700;
  font-size: 11.5px;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  padding: 10px 12px;
  border-bottom: 1px solid #cbd5e1;
  white-space: nowrap;
}
.cc-exp-sheet-table td {
  padding: 10px 12px;
  border-bottom: 1px solid #e2e8f0;
  color: #334155;
  vertical-align: middle;
}
.cc-exp-sheet-table tr.cc-exp-row:hover {
  background: #f8fafc;
}
.cc-exp-empty-cell {
  text-align: center;
  padding: 40px !important;
  color: #64748b;
  font-size: 13px;
}

.cc-exp-sheet-total-row td {
  background: #f8fafc;
  font-weight: 700;
  border-top: 2px solid #cbd5e1;
  border-bottom: none;
  padding: 12px;
}

/* Pills and Badges */
.cc-exp-id-pill {
  display: inline-block;
  font-family: monospace;
  font-size: 11.5px;
  font-weight: 700;
  background: #f1f5f9;
  color: #334155;
  padding: 2px 7px;
  border-radius: 5px;
  border: 1px solid #e2e8f0;
}
.cc-exp-id-pill.cyan {
  background: #e0f2fe;
  color: #0369a1;
  border-color: #bae6fd;
}

.cc-exp-month-tag {
  display: inline-block;
  font-size: 11px;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 6px;
  border-radius: 4px;
}

.cc-exp-cat-badge {
  display: inline-block;
  padding: 3px 8px;
  border-radius: 6px;
  font-size: 11.5px;
  font-weight: 600;
  background: #f1f5f9;
  color: #334155;
}

.cc-exp-gst-pct {
  font-weight: 700;
  color: #475569;
  font-size: 11.5px;
}

.cc-exp-mode-tag {
  display: inline-block;
  font-size: 11.5px;
  font-weight: 600;
  background: #f1f5f9;
  color: #475569;
  padding: 2px 7px;
  border-radius: 5px;
}

.cc-exp-status-pill {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 3px 8px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
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

.cc-exp-desc-cell,
.cc-exp-remarks-cell {
  max-width: 260px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}

/* User avatar */
.cc-exp-user-avatar {
  width: 28px;
  height: 28px;
  border-radius: 999px;
  background: #dcfce7;
  color: #15803d;
  display: grid;
  place-items: center;
  font-size: 11px;
  font-weight: 700;
}
.cc-exp-user-avatar.cyan {
  background: #e0f2fe;
  color: #0369a1;
}

.cc-exp-role-badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 4px;
  font-size: 10.5px;
  font-weight: 600;
  text-transform: uppercase;
  background: #f1f5f9;
  color: #475569;
}
.cc-exp-role-badge.manager {
  background: #fef3c7;
  color: #b45309;
}
.cc-exp-role-badge.ops {
  background: #f3e8ff;
  color: #7e22ce;
}
.cc-exp-role-badge.employee {
  background: #e0f2fe;
  color: #0369a1;
}

.cc-exp-count-badge {
  display: inline-block;
  padding: 2px 7px;
  border-radius: 999px;
  font-size: 11px;
  font-weight: 700;
  background: #f1f5f9;
  color: #64748b;
}
.cc-exp-count-badge.active {
  background: #fef3c7;
  color: #b45309;
}

.cc-exp-emp-tag {
  display: inline-block;
  font-size: 12px;
  font-weight: 600;
  color: #334155;
  background: #f1f5f9;
  padding: 3px 8px;
  border-radius: 6px;
}

/* Row Actions */
.cc-exp-row-actions {
  display: inline-flex;
  align-items: center;
  gap: 6px;
}
.cc-exp-act-btn {
  background: transparent;
  border: 1px solid transparent;
  padding: 5px;
  border-radius: 6px;
  cursor: pointer;
  display: grid;
  place-items: center;
  color: #64748b;
  transition: all 0.15s;
}
.cc-exp-act-btn.edit:hover {
  background: #e0f2fe;
  color: #0284c7;
}
.cc-exp-act-btn.delete:hover {
  background: #fee2e2;
  color: #dc2626;
}

/* Quick Pay Button */
.cc-exp-quick-pay-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #ecfdf5;
  color: #047857;
  border: 1px solid #a7f3d0;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s;
}
.cc-exp-quick-pay-btn:hover {
  background: #047857;
  color: #ffffff;
  border-color: #047857;
}

.cc-exp-quick-pending-btn {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  padding: 4px 8px;
  background: #fffbeb;
  color: #b45309;
  border: 1px solid #fde68a;
  border-radius: 6px;
  font-size: 11px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s;
}
.cc-exp-quick-pending-btn:hover {
  background: #d97706;
  color: #ffffff;
  border-color: #d97706;
}

/* Analytics Panels */
.cc-exp-analytics-section {
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cc-exp-analytics-grid {
  display: grid;
  grid-template-columns: repeat(auto-fit, minmax(340px, 1fr));
  gap: 16px;
}
.cc-exp-panel-card {
  background: #ffffff;
  border: 1px solid #e2e8f0;
  border-radius: 12px;
  padding: 20px 22px;
  box-shadow: 0 1px 3px rgba(0,0,0,0.03);
}
.cc-exp-panel-card h4 {
  margin: 0;
  font-size: 15px;
  font-weight: 700;
  color: #0f172a;
}
.cc-exp-panel-sub {
  margin: 2px 0 14px;
  font-size: 12px;
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
}
.cc-exp-cat-info span { color: #334155; }
.cc-exp-cat-info strong { color: #0f172a; }
.cc-exp-cat-info small { color: #64748b; font-weight: 400; }
.cc-exp-progress-bar {
  height: 6px;
  background: #f1f5f9;
  border-radius: 999px;
  overflow: hidden;
}
.cc-exp-progress-fill {
  height: 100%;
  background: #047857;
  border-radius: 999px;
}

/* PnL Card */
.cc-exp-pnl-table {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.cc-exp-pnl-row {
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-size: 13px;
  color: #334155;
}
.cc-exp-pnl-divider {
  height: 1px;
  background: #e2e8f0;
  margin: 4px 0;
}
.cc-exp-pnl-row.total {
  font-weight: 700;
  color: #0f172a;
}
.cc-exp-pnl-row.net {
  background: #f8fafc;
  padding: 8px 10px;
  border-radius: 8px;
  border: 1px solid #e2e8f0;
  margin-top: 4px;
}

/* Modals */
.cc-exp-modal-overlay {
  position: fixed;
  inset: 0;
  background: rgba(15, 23, 42, 0.45);
  backdrop-filter: blur(3px);
  display: grid;
  place-items: center;
  z-index: 999;
  padding: 16px;
}
.cc-exp-modal-card {
  background: #ffffff;
  border-radius: 14px;
  box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1), 0 8px 10px -6px rgba(0,0,0,0.1);
  width: 100%;
  max-width: 620px;
  overflow: hidden;
  max-height: 90vh;
  display: flex;
  flex-direction: column;
}
.cc-exp-modal-head {
  padding: 18px 22px;
  border-bottom: 1px solid #e2e8f0;
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  background: #f8fafc;
}
.cc-exp-modal-head p {
  margin: 0;
  font-size: 11.5px;
  font-weight: 700;
  text-transform: uppercase;
  color: #047857;
  letter-spacing: 0.04em;
}
.cc-exp-modal-head h3 {
  margin: 2px 0 0;
  font-size: 18px;
  font-weight: 700;
  color: #0f172a;
}
.cc-exp-modal-close {
  background: transparent;
  border: none;
  cursor: pointer;
  color: #64748b;
  padding: 4px;
  border-radius: 6px;
}
.cc-exp-modal-close:hover {
  background: #e2e8f0;
  color: #0f172a;
}

.cc-exp-modal-form {
  padding: 20px 22px;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 16px;
}
.cc-exp-form-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 12px 14px;
}
.cc-exp-field {
  display: flex;
  flex-direction: column;
  gap: 5px;
}
.cc-exp-field.span-2 {
  grid-column: span 2;
}
.cc-exp-field span {
  font-size: 12px;
  font-weight: 600;
  color: #334155;
}
.cc-exp-field input,
.cc-exp-field select,
.cc-exp-field textarea {
  border: 1px solid #cbd5e1;
  border-radius: 8px;
  padding: 8px 11px;
  font-size: 13px;
  color: #0f172a;
  outline: none;
  font-family: inherit;
}
.cc-exp-field input:focus,
.cc-exp-field select:focus,
.cc-exp-field textarea:focus {
  border-color: #047857;
  box-shadow: 0 0 0 2px rgba(4, 120, 87, 0.1);
}

.cc-exp-computed-val {
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 8px;
  padding: 8px 11px;
  font-size: 13px;
  font-weight: 700;
  color: #475569;
}
.cc-exp-computed-val.highlight {
  background: #ecfdf5;
  border-color: #a7f3d0;
  color: #047857;
}

.cc-exp-modal-actions {
  display: flex;
  justify-content: flex-end;
  gap: 10px;
  padding-top: 10px;
  border-top: 1px solid #e2e8f0;
}

/* Spin animation */
.cc-spin {
  animation: ccSpin 1s linear infinite;
}
@keyframes ccSpin {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

/* Bulk Action Bar for Salaries */
.cc-exp-bulk-bar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #ffffff;
  padding: 12px 18px;
  border-radius: 12px;
  border: 1.5px solid #10b981;
  box-shadow: 0 4px 14px rgba(16, 185, 129, 0.12);
}
.cc-exp-bulk-info {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 13.5px;
  color: #0f172a;
}
.cc-exp-bulk-check-badge {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 22px;
  height: 22px;
  border-radius: 50%;
  background: #10b981;
  color: #ffffff;
  font-size: 12px;
  font-weight: 700;
}
.cc-exp-bulk-actions {
  display: flex;
  align-items: center;
  gap: 10px;
  flex-wrap: wrap;
}
.cc-exp-bulk-mode {
  display: flex;
  align-items: center;
  gap: 6px;
  font-size: 12.5px;
  font-weight: 600;
  color: #475569;
}
.cc-exp-bulk-mode select {
  padding: 6px 10px;
  border-radius: 8px;
  border: 1px solid #cbd5e1;
  background: #ffffff;
  font-size: 12.5px;
  color: #0f172a;
  outline: none;
  cursor: pointer;
}
.cc-exp-bulk-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 7px 14px;
  border-radius: 8px;
  font-size: 12.5px;
  font-weight: 600;
  border: none;
  cursor: pointer;
  transition: all 0.15s ease;
}
.cc-exp-bulk-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.cc-exp-bulk-btn.paid {
  background: #059669;
  color: #ffffff;
}
.cc-exp-bulk-btn.paid:hover:not(:disabled) {
  background: #047857;
  transform: translateY(-1px);
}
.cc-exp-bulk-btn.pending {
  background: #d97706;
  color: #ffffff;
}
.cc-exp-bulk-btn.pending:hover:not(:disabled) {
  background: #b45309;
  transform: translateY(-1px);
}
.cc-exp-bulk-btn.clear {
  background: #f1f5f9;
  color: #475569;
  border: 1px solid #cbd5e1;
}
.cc-exp-bulk-btn.clear:hover {
  background: #e2e8f0;
}

/* Staff subbar (Filters & Search) */
.cc-exp-staff-subbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  flex-wrap: wrap;
  gap: 12px;
  background: #ffffff;
  padding: 12px 16px;
  border-radius: 12px;
  border: 1px solid #e2e8f0;
}
.cc-exp-staff-filter-tabs {
  display: flex;
  align-items: center;
  gap: 6px;
  background: #f1f5f9;
  padding: 3px;
  border-radius: 9px;
}
.cc-exp-staff-tab-btn {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  padding: 6px 12px;
  border-radius: 7px;
  border: none;
  background: transparent;
  color: #64748b;
  font-size: 12.5px;
  font-weight: 600;
  cursor: pointer;
  transition: all 0.15s ease;
}
.cc-exp-staff-tab-btn.active {
  background: #ffffff;
  color: #0f172a;
  box-shadow: 0 1px 3px rgba(0,0,0,0.06);
}
.cc-exp-staff-tab-btn .badge {
  display: inline-block;
  padding: 1px 6px;
  border-radius: 999px;
  font-size: 11px;
  background: #e2e8f0;
  color: #475569;
}
.cc-exp-staff-tab-btn.active .badge {
  background: #0f172a;
  color: #ffffff;
}

/* Table row actions & status */
.cc-exp-checkbox {
  width: 16px;
  height: 16px;
  accent-color: #059669;
  cursor: pointer;
}
.cc-exp-row.selected {
  background: #f0fdf4 !important;
}
.cc-exp-row-status-actions {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
}
.cc-exp-action-btn {
  display: inline-flex;
  align-items: center;
  gap: 5px;
  padding: 5px 11px;
  border-radius: 7px;
  font-size: 11.5px;
  font-weight: 600;
  cursor: pointer;
  border: 1px solid transparent;
  transition: all 0.15s ease;
}
.cc-exp-action-btn:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.cc-exp-action-btn.mark-paid {
  background: #dcfce7;
  color: #15803d;
  border-color: #86efac;
}
.cc-exp-action-btn.mark-paid:hover:not(:disabled) {
  background: #15803d;
  color: #ffffff;
}
.cc-exp-action-btn.mark-pending {
  background: #fef3c7;
  color: #b45309;
  border-color: #fde68a;
}
.cc-exp-action-btn.mark-pending:hover:not(:disabled) {
  background: #b45309;
  color: #ffffff;
}

.cc-exp-status-dropdown {
  padding: 5px 10px;
  border-radius: 8px;
  font-size: 12px;
  font-weight: 700;
  cursor: pointer;
  outline: none;
  border: 1.5px solid transparent;
  transition: all 0.15s ease;
  font-family: inherit;
}
.cc-exp-status-dropdown:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
.cc-exp-status-dropdown.paid {
  background: #dcfce7;
  color: #15803d;
  border-color: #86efac;
}
.cc-exp-status-dropdown.pending {
  background: #fef3c7;
  color: #b45309;
  border-color: #fde68a;
}

@media (max-width: 768px) {
  .cc-exp-container { padding: 14px 14px 40px; }
  .cc-exp-header-bar { padding: 14px; }
  .cc-exp-cards-grid { grid-template-columns: 1fr; }
  .cc-exp-form-grid { grid-template-columns: 1fr; }
  .cc-exp-field.span-2 { grid-column: span 1; }
  .cc-exp-bulk-bar { flex-direction: column; align-items: flex-start; }
}
`;
