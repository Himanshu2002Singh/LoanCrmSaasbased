import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import {
  AlertCircle,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Eye,
  FileCheck,
  FileClock,
  FileText,
  Filter,
  IndianRupee,
  Layers,
  PhoneCall,
  RefreshCw,
  Send,
  TrendingUp,
  UserCheck,
  Users,
  Wallet,
} from "lucide-react";
import API_URL from "../config";
import LeadsPopup from "../components/leadsPopup";
import ExecutiveFinanceOverview from "../components/ExecutiveFinanceOverview";

const statusLabels = [
  "Fresh Lead",
  "Interested",
  "Call Back",
  "Follow up",
  "No Requirement",
  "Call Not Pick",
  "Not Pick",
  "Not Connected",
  "Document Pending",
  "Document Rejected",
  "File Login",
  "Invalid Number",
  "Number buzy",
  "number swtich off",
  "Loan Section",
  "Loan Disbursement",
];

const loanTypes = [
  { label: "Home Loans", key: "Home Loan" },
  { label: "User Car Loans", key: "User Car Loan" },
  { label: "Business Loans", key: "Business Loan" },
  { label: "Personal Loans", key: "Personal Loan" },
  { label: "DOD Loans", key: "DOD" },
  { label: "Mortgage Loans", key: "Mortgage Loan" },
  { label: "CC/OD", key: "CC/OD" },
  { label: "CGTMSME", key: "CGTMSME" },
  { label: "Mutual Fund", key: "Mutual Fund" },
  { label: "Insurance", key: "Insurance" },
  { label: "Other", key: "Other" },
];

const chartColors = [
  "#047857",
  "#16a34a",
  "#86efac",
  "#3b82f6",
  "#8b5cf6",
  "#f97316",
  "#eab308",
  "#0ea5e9",
  "#ec4899",
  "#ef4444",
  "#14b8a6",
  "#6366f1",
];

const numberFormatter = new Intl.NumberFormat("en-IN");
const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const getTodayRange = () => {
  const now = new Date();
  const firstDay = new Date(now);
  firstDay.setDate(firstDay.getDate() - 30);
  const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1);
  const format = (date) => {
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, "0");
    const day = String(date.getDate()).padStart(2, "0");
    return `${year}-${month}-${day}`;
  };

  return {
    from: format(firstDay),
    to: format(lastDay),
  };
};

function HomeRedesign({ dashboardFilters, dashboardFilterOptions }) {
  const { from, to } = useMemo(getTodayRange, []);
  const fromDate = dashboardFilters?.fromDate || from;
  const toDate = dashboardFilters?.toDate || to;
  const selectedEmployeeId = dashboardFilters?.employeeId || "All";
  const selectedStatus = dashboardFilters?.status || "All";
  const statusOptions = dashboardFilterOptions?.statuses?.length ? dashboardFilterOptions.statuses : statusLabels;
  const [showPopup, setShowPopup] = useState(false);
  const [modalTitle, setModalTitle] = useState("");

  // Operations stage filter state
  const [selectedOpsStage, setSelectedOpsStage] = useState("ALL"); // ALL | FILE_LOGIN | LEGAL_PENDING | TECHNICAL_PENDING | SANCTIONED | DISBURSED | REASSIGNED

  // Payouts month filter state
  const [selectedPayoutMonth, setSelectedPayoutMonth] = useState("ALL");

  const [stats, setStats] = useState({
    counts: {
      totalCalls: 0,
      totalLeads: 0,
      todayFollowups: 0,
      tomorrowFollowups: 0,
      pendingFollowups: 0,
      fileLogins: 0,
      disbursements: 0,
      legalPending: 0,
      technicalPending: 0,
      reassignedLeads: 0,
    },
    operationsMetrics: {
      fileLoginCount: 0,
      disbursementCount: 0,
      disbursedAmount: 0,
      sanctionedCount: 0,
      sanctionedAmount: 0,
      legalPendingCount: 0,
      technicalPendingCount: 0,
      reassignedLeadsCount: 0,
    },
    payoutMetrics: {
      canView: false,
      monthlyPayouts: [],
      recentPayouts: [],
      totalDisbursed: 0,
      totalBankCommission: 0,
      totalPartyPayout: 0,
    },
    leadStatusCounts: {},
    loanTypeCounts: {},
    employeeStats: [],
  });
  const [filteredLeadStats, setFilteredLeadStats] = useState(null);

  const fetchData = async (startDate, endDate, empId) => {
    try {
      const params = { fromDate: startDate, toDate: endDate };
      if (empId && empId !== "All") {
        params.employeeId = empId;
      }
      const response = await axios.get(`${API_URL}/reports/dashboard`, { params });
      if (response.data?.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats", error);
    }
  };

  useEffect(() => {
    fetchData(fromDate, toDate, selectedEmployeeId);
  }, [fromDate, toDate, selectedEmployeeId]);

  useEffect(() => {
    const fetchFilteredLeadStats = async () => {
      const hasAdvancedFilter = selectedEmployeeId !== "All" || selectedStatus !== "All";

      if (!hasAdvancedFilter) {
        setFilteredLeadStats(null);
        return;
      }

      try {
        const response = await axios.get(`${API_URL}/reports/dashboard`, {
          params: {
            fromDate,
            toDate,
            employeeId: selectedEmployeeId === "All" ? undefined : selectedEmployeeId,
          },
        });

        if (response.data?.success) {
          const { leadStatusCounts: byStatus = {}, loanTypeCounts: byLoanType = {} } = response.data;
          setFilteredLeadStats({
            leadStatusCounts:
              selectedStatus === "All"
                ? byStatus
                : { [selectedStatus]: byStatus[selectedStatus] || 0 },
            loanTypeCounts: byLoanType,
          });
        }
      } catch (error) {
        console.error("Error fetching filtered dashboard stats", error);
      }
    };

    fetchFilteredLeadStats();
  }, [fromDate, selectedEmployeeId, selectedStatus, toDate]);

  const leadStatusCounts = filteredLeadStats?.leadStatusCounts || stats.leadStatusCounts || {};
  const loanTypeCounts = filteredLeadStats?.loanTypeCounts || stats.loanTypeCounts || {};
  const totalFilteredLeads = filteredLeadStats
    ? Object.values(leadStatusCounts).reduce((total, value) => total + Number(value || 0), 0)
    : stats.counts?.totalLeads || 0;

  const visibleEmployeeStats =
    selectedEmployeeId === "All"
      ? stats.employeeStats || []
      : (stats.employeeStats || []).filter((employee) => String(employee.id) === String(selectedEmployeeId));

  const selectedEmployeeCalls =
    selectedEmployeeId === "All"
      ? stats.counts?.totalCalls || 0
      : visibleEmployeeStats.reduce((total, employee) => total + Number(employee.totalCalls || 0), 0);

  const leadStatusData = statusOptions.map((name, index) => ({
    name,
    value: leadStatusCounts?.[name] || 0,
    color: chartColors[index % chartColors.length],
  }));

  const loanTypeData = loanTypes.map((loan, index) => ({
    name: loan.label,
    value: loanTypeCounts?.[loan.key] || 0,
    color: chartColors[index % chartColors.length],
  }));

  const overdueCount = stats.counts?.pendingFollowups || 0;
  const isFiltered = selectedEmployeeId !== "All" || selectedStatus !== "All";

  const openMetric = (title) => {
    setModalTitle(title);
    setShowPopup(true);
  };

  // Safe Operations Metrics with fallbacks
  const ops = stats.operationsMetrics || {
    fileLoginCount: stats.counts?.fileLogins || 0,
    disbursementCount: stats.counts?.disbursements || 0,
    disbursedAmount: 0,
    sanctionedCount: 0,
    sanctionedAmount: 0,
    legalPendingCount: stats.counts?.legalPending || 0,
    technicalPendingCount: stats.counts?.technicalPending || 0,
    reassignedLeadsCount: stats.counts?.reassignedLeads || 0,
  };

  // Safe Payout Metrics with fallbacks
  const payouts = stats.payoutMetrics || {
    canView: false,
    monthlyPayouts: [],
    recentPayouts: [],
    totalDisbursed: 0,
    totalBankCommission: 0,
    totalPartyPayout: 0,
  };

  const filteredRecentPayouts = useMemo(() => {
    const list = payouts.recentPayouts || [];
    if (!selectedPayoutMonth || selectedPayoutMonth === "ALL") return list;
    return list.filter((p) => {
      const m = p.disbursalDate ? String(p.disbursalDate).slice(0, 7) : "";
      return m === selectedPayoutMonth;
    });
  }, [payouts.recentPayouts, selectedPayoutMonth]);

  const activeMonthlyPayout = useMemo(() => {
    if (!selectedPayoutMonth || selectedPayoutMonth === "ALL") return null;
    return (payouts.monthlyPayouts || []).find((m) => m.month === selectedPayoutMonth) || null;
  }, [payouts.monthlyPayouts, selectedPayoutMonth]);

  return (
    <div className="cc-dashboard">
      <style>{dashboardCustomStyles}</style>
      <LeadsPopup
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        title={modalTitle}
        startDate={fromDate}
        endDate={toDate}
      />

      {/* OPERATIONS PIPELINE & STAGE FILTRATION BAR */}
      <section className="cc-dash-section">
        <div className="cc-ops-filter-bar">
          <div className="cc-ops-filter-header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Layers size={17} color="var(--cc-primary, #047857)" />
              <strong>Operations Pipeline &amp; Stage Filter</strong>
            </div>
            <span style={{ fontSize: 11.5, color: "#64748b" }}>
              Filter by operational case status or click any stage to inspect
            </span>
          </div>

          <div className="cc-ops-filter-pills">
            <button
              type="button"
              className={`cc-ops-pill ${selectedOpsStage === "ALL" ? "active" : ""}`}
              onClick={() => setSelectedOpsStage("ALL")}
            >
              <span>All Stages</span>
              <strong>{numberFormatter.format(totalFilteredLeads)}</strong>
            </button>

            <button
              type="button"
              className={`cc-ops-pill ${selectedOpsStage === "FILE_LOGIN" ? "active" : ""}`}
              onClick={() => {
                setSelectedOpsStage("FILE_LOGIN");
                openMetric("File Login");
              }}
              title="Click to view all File Login leads"
            >
              <FileClock size={13} />
              <span>File Login</span>
              <strong className="badge-blue">{numberFormatter.format(ops.fileLoginCount || 0)}</strong>
            </button>

            <button
              type="button"
              className={`cc-ops-pill ${selectedOpsStage === "LEGAL_PENDING" ? "active" : ""}`}
              onClick={() => {
                setSelectedOpsStage("LEGAL_PENDING");
                openMetric("Legal Pending");
              }}
              title="Click to view all Legal Pending leads"
            >
              <Clock size={13} />
              <span>Legal Pending</span>
              <strong className="badge-amber">{numberFormatter.format(ops.legalPendingCount || 0)}</strong>
            </button>

            <button
              type="button"
              className={`cc-ops-pill ${selectedOpsStage === "TECHNICAL_PENDING" ? "active" : ""}`}
              onClick={() => {
                setSelectedOpsStage("TECHNICAL_PENDING");
                openMetric("Technical Pending");
              }}
              title="Click to view all Technical Pending leads"
            >
              <AlertCircle size={13} />
              <span>Technical Pending</span>
              <strong className="badge-orange">{numberFormatter.format(ops.technicalPendingCount || 0)}</strong>
            </button>

            <button
              type="button"
              className={`cc-ops-pill ${selectedOpsStage === "SANCTIONED" ? "active" : ""}`}
              onClick={() => {
                setSelectedOpsStage("SANCTIONED");
                openMetric("Loan Section");
              }}
              title="Click to view all Sanctioned leads"
            >
              <FileCheck size={13} />
              <span>Sanctioned</span>
              <strong className="badge-purple">{numberFormatter.format(ops.sanctionedCount || 0)}</strong>
            </button>

            <button
              type="button"
              className={`cc-ops-pill ${selectedOpsStage === "DISBURSED" ? "active" : ""}`}
              onClick={() => {
                setSelectedOpsStage("DISBURSED");
                openMetric("Loan Disbursement");
              }}
              title="Click to view all Disbursed leads"
            >
              <CheckCircle2 size={13} />
              <span>Disbursed</span>
              <strong className="badge-emerald">{numberFormatter.format(ops.disbursementCount || 0)}</strong>
            </button>

            <button
              type="button"
              className={`cc-ops-pill ${selectedOpsStage === "REASSIGNED" ? "active" : ""}`}
              onClick={() => setSelectedOpsStage("REASSIGNED")}
              title="Leads transferred to another employee"
            >
              <UserCheck size={13} />
              <span>Reassigned Out</span>
              <strong className="badge-gray">{numberFormatter.format(ops.reassignedLeadsCount || 0)}</strong>
            </button>
          </div>
        </div>
      </section>

      {/* COMPREHENSIVE ROLE-SCOPED KPI GRID */}
      <section className="cc-dash-kpi-grid">
        {/* Total Assigned Leads */}
        <button
          type="button"
          className="cc-dash-kpi-card"
          onClick={() => openMetric("Total Leads")}
        >
          <div className="cc-dash-kpi-top">
            <span className="cc-dash-kpi-label">{isFiltered ? "Filtered Leads" : "Connected Leads"}</span>
            <div className="cc-dash-kpi-icon blue">
              <Users size={16} />
            </div>
          </div>
          <strong className="cc-dash-kpi-val">{numberFormatter.format(totalFilteredLeads)}</strong>
          <span className="cc-dash-kpi-sub">Total leads assigned in your scope</span>
        </button>

        {/* Calls Recorded */}
        <button
          type="button"
          className="cc-dash-kpi-card"
          onClick={() => openMetric("Total Calls")}
        >
          <div className="cc-dash-kpi-top">
            <span className="cc-dash-kpi-label">Calls Logged</span>
            <div className="cc-dash-kpi-icon emerald">
              <PhoneCall size={16} />
            </div>
          </div>
          <strong className="cc-dash-kpi-val">{numberFormatter.format(selectedEmployeeCalls)}</strong>
          <span className="cc-dash-kpi-sub">Calling activities recorded</span>
        </button>

        {/* File Login */}
        <button
          type="button"
          className="cc-dash-kpi-card"
          onClick={() => openMetric("File Login")}
        >
          <div className="cc-dash-kpi-top">
            <span className="cc-dash-kpi-label">File Logins</span>
            <div className="cc-dash-kpi-icon purple">
              <FileClock size={16} />
            </div>
          </div>
          <strong className="cc-dash-kpi-val">{numberFormatter.format(ops.fileLoginCount || 0)}</strong>
          <span className="cc-dash-kpi-sub">Files logged into banks</span>
        </button>

        {/* Legal Pending */}
        <button
          type="button"
          className="cc-dash-kpi-card"
          onClick={() => openMetric("Legal Pending")}
        >
          <div className="cc-dash-kpi-top">
            <span className="cc-dash-kpi-label">Legal Pending</span>
            <div className="cc-dash-kpi-icon amber">
              <Clock size={16} />
            </div>
          </div>
          <strong className="cc-dash-kpi-val amber">{numberFormatter.format(ops.legalPendingCount || 0)}</strong>
          <span className="cc-dash-kpi-sub">Legal verification in queue</span>
        </button>

        {/* Technical Pending */}
        <button
          type="button"
          className="cc-dash-kpi-card"
          onClick={() => openMetric("Technical Pending")}
        >
          <div className="cc-dash-kpi-top">
            <span className="cc-dash-kpi-label">Technical Pending</span>
            <div className="cc-dash-kpi-icon orange">
              <AlertCircle size={16} />
            </div>
          </div>
          <strong className="cc-dash-kpi-val orange">{numberFormatter.format(ops.technicalPendingCount || 0)}</strong>
          <span className="cc-dash-kpi-sub">Property evaluation pending</span>
        </button>

        {/* Disbursed Leads */}
        <button
          type="button"
          className="cc-dash-kpi-card highlight-disbursed"
          onClick={() => openMetric("Loan Disbursement")}
        >
          <div className="cc-dash-kpi-top">
            <span className="cc-dash-kpi-label">Disbursed Leads</span>
            <div className="cc-dash-kpi-icon emerald">
              <CheckCircle2 size={16} />
            </div>
          </div>
          <strong className="cc-dash-kpi-val emerald">{numberFormatter.format(ops.disbursementCount || 0)}</strong>
          <span className="cc-dash-kpi-sub">
            {ops.disbursedAmount > 0
              ? currencyFormatter.format(ops.disbursedAmount)
              : "Cases successfully disbursed"}
          </span>
        </button>

        {/* Reassigned to Another Employee */}
        <button
          type="button"
          className="cc-dash-kpi-card"
          onClick={() => openMetric("Total Leads")}
          title="Leads that were reassigned away to another employee"
        >
          <div className="cc-dash-kpi-top">
            <span className="cc-dash-kpi-label">Reassigned Out</span>
            <div className="cc-dash-kpi-icon cyan">
              <UserCheck size={16} />
            </div>
          </div>
          <strong className="cc-dash-kpi-val cyan">{numberFormatter.format(ops.reassignedLeadsCount || 0)}</strong>
          <span className="cc-dash-kpi-sub">Handed off to another employee</span>
        </button>

        {/* Followups & Overdue */}
        <button
          type="button"
          className="cc-dash-kpi-card"
          onClick={() => openMetric("Pending Followups")}
        >
          <div className="cc-dash-kpi-top">
            <span className="cc-dash-kpi-label">Overdue Follow-ups</span>
            <div className="cc-dash-kpi-icon rose">
              <Clock size={16} />
            </div>
          </div>
          <strong className="cc-dash-kpi-val danger">{numberFormatter.format(overdueCount)}</strong>
          <span className="cc-dash-kpi-sub">
            Today: {numberFormatter.format(stats.counts?.todayFollowups || 0)} • Tmrw: {numberFormatter.format(stats.counts?.tomorrowFollowups || 0)}
          </span>
        </button>
      </section>

      {/* EXECUTIVE FINANCIAL OVERVIEW (Disbursal by month & Cash in vs cash out) */}
      <ExecutiveFinanceOverview payoutMetrics={payouts} />

      {/* MONTH-WISE PAYOUTS & DISBURSAL TRACKING SECTION (Role-based / Payouts Permission Protected) */}
      {payouts.canView && (
        <section className="cc-panel cc-payout-dash-section">
          <div className="cc-payout-dash-header">
            <div>
              <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                <Coins size={18} color="var(--cc-primary, #047857)" />
                <h2 style={{ margin: 0, fontSize: 16.5, fontWeight: 800, color: "#0f172a" }}>
                  Month-Wise Payouts &amp; Disbursal Overview
                </h2>
                <span className="cc-payout-role-tag">Finance &amp; Commission Ledger</span>
              </div>
              <p style={{ margin: "4px 0 0", fontSize: 12.5, color: "#64748b" }}>
                Track when which payouts occurred, loan disbursal amounts, bank commissions &amp; connector settlements
              </p>
            </div>

            {/* Month Filter Selector */}
            <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
              <label style={{ fontSize: 12, fontWeight: 600, color: "#475569" }}>
                Select Month:
              </label>
              <select
                value={selectedPayoutMonth}
                onChange={(e) => setSelectedPayoutMonth(e.target.value)}
                className="cc-dash-select"
              >
                <option value="ALL">All Months ({payouts.monthlyPayouts?.length || 0})</option>
                {(payouts.monthlyPayouts || []).map((m) => (
                  <option key={m.month} value={m.month}>
                    {m.label} ({m.casesCount} cases)
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Monthly Financial Metric Cards */}
          <div className="cc-payout-metric-strip">
            <div className="cc-pm-card">
              <small>Loan Disbursal Volume</small>
              <strong>
                {currencyFormatter.format(
                  activeMonthlyPayout ? activeMonthlyPayout.disbursedAmount : payouts.totalDisbursed || 0
                )}
              </strong>
              <span>
                {activeMonthlyPayout
                  ? `In ${activeMonthlyPayout.label} (${activeMonthlyPayout.casesCount} cases)`
                  : `Across ${payouts.monthlyPayouts?.length || 0} recorded months`}
              </span>
            </div>

            <div className="cc-pm-card">
              <small>Bank Commission Received</small>
              <strong style={{ color: "var(--cc-primary, #047857)" }}>
                {currencyFormatter.format(
                  activeMonthlyPayout ? activeMonthlyPayout.bankCommissionReceived : payouts.totalBankCommission || 0
                )}
              </strong>
              <span>Net bank earnings received</span>
            </div>

            <div className="cc-pm-card">
              <small>Party / Connector Payouts Paid</small>
              <strong style={{ color: "#2563eb" }}>
                {currencyFormatter.format(
                  activeMonthlyPayout ? activeMonthlyPayout.partyPaidAmount : payouts.totalPartyPayout || 0
                )}
              </strong>
              <span>Disbursed commission to connectors</span>
            </div>

            <div className="cc-pm-card">
              <small>Disbursed Cases</small>
              <strong style={{ color: "#7c3aed" }}>
                {numberFormatter.format(
                  activeMonthlyPayout
                    ? activeMonthlyPayout.casesCount
                    : payouts.monthlyPayouts?.reduce((acc, curr) => acc + curr.casesCount, 0) || 0
                )}
              </strong>
              <span>Settled or pending cases</span>
            </div>
          </div>

          {/* Month-Wise Breakdown Cards */}
          {(payouts.monthlyPayouts || []).length > 0 && selectedPayoutMonth === "ALL" && (
            <div style={{ marginTop: 14 }}>
              <h4 style={{ margin: "0 0 10px", fontSize: 13, fontWeight: 700, color: "#334155" }}>
                Month-by-Month Disbursal &amp; Payout Summary:
              </h4>
              <div className="cc-month-cards-grid">
                {(payouts.monthlyPayouts || []).map((m) => (
                  <div
                    key={m.month}
                    className="cc-month-summary-box"
                    onClick={() => setSelectedPayoutMonth(m.month)}
                    title={`Click to filter by ${m.label}`}
                  >
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                      <strong>{m.label}</strong>
                      <span className="cc-month-badge">{m.casesCount} cases</span>
                    </div>
                    <div className="cc-month-stat-row">
                      <span>Disbursed:</span>
                      <strong>{currencyFormatter.format(m.disbursedAmount)}</strong>
                    </div>
                    <div className="cc-month-stat-row">
                      <span>Bank Comm:</span>
                      <strong style={{ color: "var(--cc-primary, #047857)" }}>{currencyFormatter.format(m.bankCommissionReceived)}</strong>
                    </div>
                    <div className="cc-month-stat-row">
                      <span>Party Paid:</span>
                      <strong style={{ color: "#2563eb" }}>{currencyFormatter.format(m.partyPaidAmount)}</strong>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Recent Payouts & Disbursal Transactions Table */}
          <div style={{ marginTop: 16 }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 8 }}>
              <h4 style={{ margin: 0, fontSize: 13, fontWeight: 700, color: "#334155" }}>
                {selectedPayoutMonth === "ALL"
                  ? "Recent Disbursal & Commission Payout Transactions"
                  : `Disbursal Payouts for ${activeMonthlyPayout?.label || selectedPayoutMonth}`}
              </h4>
              <span style={{ fontSize: 11, color: "#64748b" }}>
                Showing {filteredRecentPayouts.length} transactions
              </span>
            </div>

            <div className="cc-table-scroll" style={{ maxHeight: 280 }}>
              <table style={{ width: "100%", fontSize: 12.5 }}>
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Customer Name</th>
                    <th>Bank / Lender</th>
                    <th>Loan Disbursed (₹)</th>
                    <th>Bank Received (₹)</th>
                    <th>Party Paid (₹)</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {filteredRecentPayouts.length === 0 ? (
                    <tr>
                      <td colSpan={7} style={{ textAlign: "center", padding: "24px", color: "#94a3b8" }}>
                        No payout records found for the selected period.
                      </td>
                    </tr>
                  ) : (
                    filteredRecentPayouts.map((row) => (
                      <tr key={row.id}>
                        <td>
                          <strong>{new Date(row.disbursalDate).toLocaleDateString("en-IN")}</strong>
                        </td>
                        <td>
                          <span style={{ fontWeight: 600, color: "#0f172a" }}>{row.customerName}</span>
                        </td>
                        <td>
                          <span className="cc-dash-bank-tag">
                            <Building2 size={11} /> {row.bankName}
                          </span>
                        </td>
                        <td>
                          <strong>{currencyFormatter.format(row.loanAmount || 0)}</strong>
                        </td>
                        <td>
                          <span style={{ color: "var(--cc-primary, #047857)", fontWeight: 600 }}>
                            {currencyFormatter.format(row.bankReceivedAmount || 0)}
                          </span>
                        </td>
                        <td>
                          <span style={{ color: "#2563eb", fontWeight: 600 }}>
                            {currencyFormatter.format(row.partyPaidAmount || 0)}
                          </span>
                        </td>
                        <td>
                          <span
                            className={`cc-dash-status-pill ${
                              row.status === "SETTLED"
                                ? "settled"
                                : row.status === "PARTIALLY_SETTLED"
                                ? "partial"
                                : "pending"
                            }`}
                          >
                            {row.status?.replace(/_/g, " ")}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </section>
      )}

      {/* LEAD CHARTS SECTION */}
      <FullWidthBarChart title="Leads by Status" data={leadStatusData} minWidth={1180} />
      <FullWidthBarChart title="Leads by Loan Type" data={loanTypeData} minWidth={960} />

      {/* EMPLOYEE PERFORMANCE TABLE */}
      <section className="cc-panel cc-table-panel">
        <h2>Employee performance</h2>
        <div className="cc-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Employee</th>
                <th>Total leads</th>
                <th>Calls</th>
                <th>Follow-ups</th>
                <th>Interested Leads</th>
              </tr>
            </thead>
            <tbody>
              {visibleEmployeeStats.length > 0 ? (
                visibleEmployeeStats.map((employee, index) => {
                  const totalLeads = employee.totalLeads || 0;
                  const interestedLeads = employee.interestedLeads || 0;

                  return (
                    <tr key={employee.id || index}>
                      <td>
                        <span className="cc-employee">
                          <span>{employee.avatar || employee.name?.slice(0, 2)?.toUpperCase() || "NA"}</span>
                          {employee.name || "--"}
                        </span>
                      </td>
                      <td>{numberFormatter.format(totalLeads)}</td>
                      <td>{numberFormatter.format(employee.totalCalls || 0)}</td>
                      <td>{numberFormatter.format(employee.todayFollowups || employee.followups || 0)}</td>
                      <td>{numberFormatter.format(interestedLeads)}</td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan="5" className="cc-empty-cell">
                    No employee data available.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
    </div>
  );
}

function FullWidthBarChart({ title, data, minWidth }) {
  return (
    <section className="cc-panel cc-chart-panel">
      <h2>{title}</h2>
      <div className="cc-chart-scroll">
        <div className="cc-chart-inner" style={{ minWidth }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} barSize={28} margin={{ top: 14, right: 22, left: 4, bottom: 8 }}>
              <CartesianGrid stroke="#e5e7eb" strokeDasharray="3 3" vertical={false} />
              <XAxis
                dataKey="name"
                angle={-32}
                textAnchor="end"
                interval={0}
                tick={{ fill: "#334155", fontSize: 11 }}
                height={68}
              />
              <YAxis tick={{ fill: "#475569", fontSize: 11 }} width={40} />
              <Tooltip
                cursor={{ fill: "rgba(4, 120, 87, 0.06)" }}
                contentStyle={{
                  border: "1px solid #d8dedb",
                  borderRadius: 8,
                  boxShadow: "0 12px 30px rgba(15, 23, 42, 0.08)",
                }}
              />
              <Bar dataKey="value" radius={[6, 6, 0, 0]}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
      </div>
    </section>
  );
}

const dashboardCustomStyles = `
  .cc-dash-section {
    margin-bottom: 16px;
  }
  .cc-ops-filter-bar {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 16px;
    box-shadow: 0 4px 12px rgba(15, 23, 42, 0.03);
  }
  .cc-ops-filter-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 10px;
    flex-wrap: wrap;
    gap: 8px;
  }
  .cc-ops-filter-pills {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cc-ops-pill {
    display: inline-flex;
    align-items: center;
    gap: 7px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 6px 12px;
    font-size: 12px;
    font-weight: 600;
    color: #334155;
    cursor: pointer;
    transition: all 0.15s ease;
  }
  .cc-ops-pill:hover {
    background: #f1f5f9;
    border-color: #94a3b8;
  }
  .cc-ops-pill.active {
    background: var(--cc-primary, #047857);
    border-color: var(--cc-primary, #047857);
    color: #fff;
  }
  .cc-ops-pill strong {
    display: inline-block;
    padding: 1px 6px;
    border-radius: 999px;
    font-size: 11px;
    background: #e2e8f0;
    color: #0f172a;
  }
  .cc-ops-pill.active strong {
    background: rgba(255, 255, 255, 0.25);
    color: #fff;
  }
  .cc-ops-pill strong.badge-blue { background: #dbeafe; color: #1e40af; }
  .cc-ops-pill strong.badge-amber { background: #fef3c7; color: #b45309; }
  .cc-ops-pill strong.badge-orange { background: #ffedd5; color: #c2410c; }
  .cc-ops-pill strong.badge-purple { background: #f3e8ff; color: #6b21a8; }
  .cc-ops-pill strong.badge-emerald { background: #dcfce7; color: #15803d; }
  .cc-ops-pill strong.badge-gray { background: #e2e8f0; color: #475569; }

  /* KPI Grid */
  .cc-dash-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(180px, 1fr));
    gap: 12px;
    margin-bottom: 16px;
  }
  .cc-dash-kpi-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    text-align: left;
    cursor: pointer;
    transition: transform 0.12s, box-shadow 0.12s;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.03);
  }
  .cc-dash-kpi-card:hover {
    transform: translateY(-2px);
    box-shadow: 0 8px 20px rgba(15, 23, 42, 0.06);
    border-color: #cbd5e1;
  }
  .cc-dash-kpi-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
    margin-bottom: 6px;
  }
  .cc-dash-kpi-label {
    font-size: 11.5px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.03em;
  }
  .cc-dash-kpi-icon {
    width: 28px;
    height: 28px;
    border-radius: 6px;
    display: grid;
    place-items: center;
  }
  .cc-dash-kpi-icon.blue { background: #eff6ff; color: #2563eb; }
  .cc-dash-kpi-icon.emerald { background: var(--cc-active-badge-bg, #ecfdf5); color: var(--cc-active-badge-text, #047857); }
  .cc-dash-kpi-icon.purple { background: #faf5ff; color: #7c3aed; }
  .cc-dash-kpi-icon.amber { background: #fffbeb; color: #d97706; }
  .cc-dash-kpi-icon.orange { background: #fff7ed; color: #ea580c; }
  .cc-dash-kpi-icon.cyan { background: #ecfeff; color: #0891b2; }
  .cc-dash-kpi-icon.rose { background: #fff1f2; color: #e11d48; }

  .cc-dash-kpi-val {
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
    line-height: 1.15;
    margin-bottom: 4px;
  }
  .cc-dash-kpi-val.emerald { color: var(--cc-primary, #047857); }
  .cc-dash-kpi-val.amber { color: #d97706; }
  .cc-dash-kpi-val.orange { color: #ea580c; }
  .cc-dash-kpi-val.cyan { color: #0891b2; }
  .cc-dash-kpi-val.danger { color: #dc2626; }
  .cc-dash-kpi-sub {
    font-size: 11px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Payout Dashboard Section */
  .cc-payout-dash-section {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 18px 20px;
    margin-bottom: 16px;
    box-shadow: 0 4px 14px rgba(15, 23, 42, 0.04);
  }
  .cc-payout-dash-header {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
    padding-bottom: 14px;
    border-bottom: 1px solid #f1f5f9;
  }
  .cc-payout-role-tag {
    background: var(--cc-active-badge-bg, #ecfdf5);
    color: var(--cc-active-badge-text, #047857);
    font-size: 10.5px;
    font-weight: 700;
    padding: 2px 7px;
    border-radius: 4px;
    border: 1px solid var(--cc-primary-glow, #a7f3d0);
  }
  .cc-dash-select {
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    padding: 6px 10px;
    font-size: 12.5px;
    color: #0f172a;
    background: #fff;
    outline: none;
    font-weight: 600;
  }
  .cc-payout-metric-strip {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(210px, 1fr));
    gap: 12px;
    margin-top: 14px;
  }
  .cc-pm-card {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 9px;
    padding: 12px 14px;
    display: flex;
    flex-direction: column;
    gap: 3px;
  }
  .cc-pm-card small {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
  }
  .cc-pm-card strong {
    font-size: 19px;
    font-weight: 800;
    color: #0f172a;
  }
  .cc-pm-card span {
    font-size: 11px;
    color: #64748b;
  }

  .cc-month-cards-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 10px;
  }
  .cc-month-summary-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
    cursor: pointer;
    transition: all 0.12s;
  }
  .cc-month-summary-box:hover {
    background: #f1f5f9;
    border-color: #cbd5e1;
    transform: translateY(-1px);
  }
  .cc-month-badge {
    background: #e2e8f0;
    color: #334155;
    font-size: 10.5px;
    font-weight: 700;
    padding: 1px 5px;
    border-radius: 4px;
  }
  .cc-month-stat-row {
    display: flex;
    justify-content: space-between;
    font-size: 11.5px;
    color: #475569;
    margin-top: 3px;
  }

  .cc-dash-bank-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    background: #f1f5f9;
    border: 1px solid #e2e8f0;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #334155;
  }
  .cc-dash-status-pill {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .cc-dash-status-pill.settled { background: #dcfce7; color: #15803d; }
  .cc-dash-status-pill.partial { background: #fef3c7; color: #b45309; }
  .cc-dash-status-pill.pending { background: #fee2e2; color: #b91c1c; }
`;

export default HomeRedesign;
