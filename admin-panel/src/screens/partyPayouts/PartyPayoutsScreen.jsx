import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  CreditCard,
  Download,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  IndianRupee,
  Layers,
  Link as LinkIcon,
  Plus,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Share2,
  Trash2,
  TrendingUp,
  User,
  Wallet,
  X,
  XCircle,
} from "lucide-react";
import API_URL from "../../config";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN");

export default function PartyPayoutsScreen() {
  const [loading, setLoading] = useState(true);
  const [summaryData, setSummaryData] = useState([]);
  const [grandTotals, setGrandTotals] = useState({
    totalConnectors: 0,
    disbursedCases: 0,
    caseLinkedDue: 0,
    linkedPayments: 0,
    unallocatedAdvances: 0,
    refundsCredits: 0,
    netCashTransferred: 0,
    payableAfterTransfers: 0,
    advanceBalance: 0,
  });

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [statusTab, setStatusTab] = useState("ALL"); // ALL | PENDING | SETTLED | ADVANCE_PAID
  const [filterPeriodType, setFilterPeriodType] = useState("all"); // all | custom | month | fy
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedFY, setSelectedFY] = useState("");

  // Drawer & Ledger State for Selected Party
  const [selectedParty, setSelectedParty] = useState(null);
  const [ledgerLoading, setLedgerLoading] = useState(false);
  const [ledgerData, setLedgerData] = useState({
    party: null,
    balances: {},
    cases: [],
    payments: [],
  });
  const [activeLedgerTab, setActiveLedgerTab] = useState("cases"); // "cases" | "payments"

  // Drawer Leads Search & Filter State
  const [drawerLeadSearch, setDrawerLeadSearch] = useState("");
  const [drawerLeadFilter, setDrawerLeadFilter] = useState("ALL"); // "ALL" | "DISBURSED" | "PENDING"

  // Payment Recording Modal State
  const [paymentModalOpen, setPaymentModalOpen] = useState(false);
  const [paymentTargetParty, setPaymentTargetParty] = useState(null);
  const [paymentForm, setPaymentForm] = useState({
    partyName: "",
    partyCode: "",
    paymentType: "LINKED_PAYMENT", // LINKED_PAYMENT | ADVANCE | REFUND_CREDIT
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "BANK_TRANSFER",
    referenceNumber: "",
    leadId: "",
    notes: "",
  });
  const [submittingPayment, setSubmittingPayment] = useState(false);
  const [deletingPaymentId, setDeletingPaymentId] = useState(null);

  // Searchable Lead Picker in Payment Modal
  const [modalLeadSearch, setModalLeadSearch] = useState("");
  const [partyLeadsForModal, setPartyLeadsForModal] = useState([]);
  const [loadingPartyLeadsForModal, setLoadingPartyLeadsForModal] = useState(false);
  const [selectedLeadForPayment, setSelectedLeadForPayment] = useState(null);

  // Assign / Link Lead Modal State
  const [linkLeadModalOpen, setLinkLeadModalOpen] = useState(false);
  const [linkLeadSearch, setLinkLeadSearch] = useState("");
  const [linkLeadResults, setLinkLeadResults] = useState([]);
  const [linkLeadSearching, setLinkLeadSearching] = useState(false);
  const [selectedLeadToLink, setSelectedLeadToLink] = useState(null);
  const [linkLeadCommission, setLinkLeadCommission] = useState("");
  const [submittingLinkLead, setSubmittingLinkLead] = useState(false);

  // Financial Years list
  const financialYears = useMemo(() => {
    const currentYear = new Date().getFullYear();
    const currentMonth = new Date().getMonth() + 1;
    const baseYear = currentMonth >= 4 ? currentYear : currentYear - 1;
    const list = [];
    for (let y = baseYear + 1; y >= baseYear - 3; y--) {
      list.push(`${y}-${String(y + 1).slice(-2)}`);
    }
    return list;
  }, []);

  // Available past and upcoming months
  const availableMonths = useMemo(() => {
    const list = [];
    const now = new Date();
    for (let i = 0; i < 18; i++) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const val = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleString("en-IN", { month: "short", year: "numeric" });
      list.push({ val, label });
    }
    return list;
  }, []);

  // Debounce Search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  // Fetch Summary Table Data
  const fetchSummary = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: debouncedSearch || undefined,
        fromDate: filterPeriodType === "custom" && customFromDate ? customFromDate : undefined,
        toDate: filterPeriodType === "custom" && customToDate ? customToDate : undefined,
        month: filterPeriodType === "month" && selectedMonth ? selectedMonth : undefined,
        financialYear: filterPeriodType === "fy" && selectedFY ? selectedFY : undefined,
      };

      const res = await axios.get(`${API_URL}/party-payouts/summary`, { params });
      setSummaryData(res.data?.summary || []);
      setGrandTotals(
        res.data?.grandTotals || {
          totalConnectors: 0,
          disbursedCases: 0,
          caseLinkedDue: 0,
          linkedPayments: 0,
          unallocatedAdvances: 0,
          refundsCredits: 0,
          netCashTransferred: 0,
          payableAfterTransfers: 0,
          advanceBalance: 0,
        }
      );
    } catch (error) {
      console.error("Error fetching party payouts summary:", error);
      toast.error(error.response?.data?.message || "Could not load party payout summary");
      setSummaryData([]);
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch, filterPeriodType, customFromDate, customToDate, selectedMonth, selectedFY]);

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

  // Fetch Specific Party Ledger & Cases
  const openPartyLedger = async (party) => {
    setSelectedParty(party);
    setLedgerLoading(true);
    setActiveLedgerTab("cases");
    try {
      const partyName = encodeURIComponent(party.partyName);
      const res = await axios.get(`${API_URL}/party-payouts/${partyName}/ledger`);
      setLedgerData(
        res.data || {
          party,
          balances: {},
          cases: [],
          payments: [],
        }
      );
    } catch (error) {
      console.error("Error fetching party ledger:", error);
      toast.error("Could not load ledger details for " + party.partyName);
    } finally {
      setLedgerLoading(false);
    }
  };

  // Fetch / populate party's leads for selection in modal
  const loadLeadsForPartyModal = async (partyName) => {
    setLoadingPartyLeadsForModal(true);
    try {
      const res = await axios.get(`${API_URL}/party-payouts/leads/search`, {
        params: { partyName },
      });
      setPartyLeadsForModal(res.data?.leads || []);
    } catch (err) {
      console.error("Error fetching leads for party modal:", err);
      setPartyLeadsForModal([]);
    } finally {
      setLoadingPartyLeadsForModal(false);
    }
  };

  // Open Payment Modal
  const openRecordPaymentModal = (party, prefillLead = null) => {
    setPaymentTargetParty(party);
    setSelectedLeadForPayment(prefillLead || null);
    setModalLeadSearch("");
    const defaultAmount =
      prefillLead?.remainingDue !== undefined && prefillLead.remainingDue !== null && parseFloat(prefillLead.remainingDue) > 0
        ? String(prefillLead.remainingDue)
        : prefillLead?.netPayable !== undefined && prefillLead.netPayable !== null && parseFloat(prefillLead.netPayable) > 0
        ? String(prefillLead.netPayable)
        : prefillLead?.commissionDue
        ? String(prefillLead.commissionDue)
        : "";

    setPaymentForm({
      partyName: party.partyName,
      partyCode: party.partyCode || "",
      paymentType: prefillLead ? "LINKED_PAYMENT" : "ADVANCE",
      amount: defaultAmount,
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMode: "BANK_TRANSFER",
      referenceNumber: "",
      leadId: prefillLead?.leadId || "",
      notes: prefillLead ? `Commission payout for Lead #${prefillLead.leadId} (${prefillLead.customerName})` : "",
    });
    setPaymentModalOpen(true);

    if (selectedParty && selectedParty.partyName === party.partyName && ledgerData.cases?.length > 0) {
      setPartyLeadsForModal(ledgerData.cases);
    } else {
      loadLeadsForPartyModal(party.partyName);
    }
  };

  const handlePartyChangeInModal = (newPartyName) => {
    const found = summaryData.find((s) => s.partyName === newPartyName);
    setPaymentForm((prev) => ({
      ...prev,
      partyName: newPartyName,
      partyCode: found?.partyCode || "",
      leadId: "",
    }));
    setSelectedLeadForPayment(null);
    loadLeadsForPartyModal(newPartyName);
  };

  const handleSelectLeadInModal = (lead) => {
    setSelectedLeadForPayment(lead);
    const suggestedAmount =
      lead.remainingDue !== undefined && lead.remainingDue !== null && parseFloat(lead.remainingDue) > 0
        ? String(lead.remainingDue)
        : lead.netPayable !== undefined && lead.netPayable !== null && parseFloat(lead.netPayable) > 0
        ? String(lead.netPayable)
        : lead.commissionDue > 0
        ? String(lead.commissionDue)
        : "";

    setPaymentForm((prev) => ({
      ...prev,
      leadId: lead.leadId,
      amount:
        prev.amount && parseFloat(prev.amount) > 0
          ? prev.amount
          : suggestedAmount || prev.amount,
      notes:
        prev.notes ||
        `Commission payout for Lead #${lead.leadId} (${lead.customerName} - ${lead.loanProduct})`,
    }));
  };

  const handleClearSelectedLeadInModal = () => {
    setSelectedLeadForPayment(null);
    setPaymentForm((prev) => ({
      ...prev,
      leadId: "",
    }));
  };

  // Assign / Link Lead Modal Handlers
  const openLinkLeadModal = (party) => {
    setSelectedParty(party);
    setLinkLeadSearch("");
    setLinkLeadResults([]);
    setSelectedLeadToLink(null);
    setLinkLeadCommission(party?.defaultCommissionPercent ?? "");
    setLinkLeadModalOpen(true);
  };

  const handleSearchLeadsToLink = async (query) => {
    setLinkLeadSearch(query);
    if (!query || query.trim().length < 2) {
      setLinkLeadResults([]);
      return;
    }
    setLinkLeadSearching(true);
    try {
      const res = await axios.get(`${API_URL}/party-payouts/leads/search`, {
        params: { q: query.trim() },
      });
      setLinkLeadResults(res.data?.leads || []);
    } catch (err) {
      console.error("Error searching leads:", err);
    } finally {
      setLinkLeadSearching(false);
    }
  };

  const handleConfirmLinkLead = async () => {
    if (!selectedLeadToLink || !selectedParty) return;
    setSubmittingLinkLead(true);
    try {
      const partyName = selectedParty.partyName;
      await axios.post(`${API_URL}/party-payouts/${encodeURIComponent(partyName)}/link-lead`, {
        leadId: selectedLeadToLink.leadId,
        commissionPercent: linkLeadCommission !== "" ? parseFloat(linkLeadCommission) : undefined,
      });
      toast.success(`Lead #${selectedLeadToLink.leadId} successfully assigned to ${partyName}!`);
      setLinkLeadModalOpen(false);
      openPartyLedger(selectedParty);
      fetchSummary();
    } catch (err) {
      console.error("Error linking lead to party:", err);
      toast.error(err.response?.data?.message || "Failed to link lead to party");
    } finally {
      setSubmittingLinkLead(false);
    }
  };

  // Submit Payment
  const handlePaymentSubmit = async (e) => {
    e.preventDefault();
    if (!paymentForm.partyName || !paymentForm.amount || parseFloat(paymentForm.amount) <= 0) {
      toast.warning("Please enter a valid payment amount");
      return;
    }

    setSubmittingPayment(true);
    try {
      await axios.post(`${API_URL}/party-payouts/payments`, paymentForm);
      toast.success(
        `₹${numberFormatter.format(paymentForm.amount)} recorded for ${paymentForm.partyName} successfully!`
      );
      setPaymentModalOpen(false);

      // Refresh summary
      fetchSummary();

      // Refresh open drawer if active
      if (selectedParty && selectedParty.partyName === paymentForm.partyName) {
        openPartyLedger(selectedParty);
      }
    } catch (error) {
      console.error("Error recording payment:", error);
      toast.error(error.response?.data?.message || "Failed to record payment");
    } finally {
      setSubmittingPayment(false);
    }
  };

  // Delete Payment
  const handleDeletePayment = async (paymentId) => {
    if (!window.confirm("Are you sure you want to delete / reverse this payment entry?")) {
      return;
    }
    setDeletingPaymentId(paymentId);
    try {
      await axios.delete(`${API_URL}/party-payouts/payments/${paymentId}`);
      toast.success("Payment entry removed successfully!");
      fetchSummary();
      if (selectedParty) {
        openPartyLedger(selectedParty);
      }
    } catch (error) {
      console.error("Error deleting payment:", error);
      toast.error(error.response?.data?.message || "Failed to delete payment entry");
    } finally {
      setDeletingPaymentId(null);
    }
  };

  // Filtered Summary List by Tab
  const filteredSummary = useMemo(() => {
    if (statusTab === "ALL") return summaryData;
    if (statusTab === "PENDING") {
      return summaryData.filter((s) => s.payableAfterTransfers > 0);
    }
    if (statusTab === "SETTLED") {
      return summaryData.filter((s) => s.payableAfterTransfers === 0 && s.caseLinkedDue > 0);
    }
    if (statusTab === "ADVANCE_PAID") {
      return summaryData.filter((s) => s.advanceBalance > 0);
    }
    return summaryData;
  }, [summaryData, statusTab]);

  // Filtered Leads in the Connector Drawer
  const filteredDrawerLeads = useMemo(() => {
    const all = ledgerData.cases || [];
    let list = all;
    if (drawerLeadFilter === "DISBURSED") {
      list = list.filter((c) => c.isDisbursed);
    } else if (drawerLeadFilter === "PENDING") {
      list = list.filter((c) => !c.isDisbursed);
    }
    if (drawerLeadSearch && drawerLeadSearch.trim()) {
      const q = drawerLeadSearch.trim().toLowerCase();
      list = list.filter(
        (c) =>
          String(c.leadId).includes(q) ||
          (c.customerName && c.customerName.toLowerCase().includes(q)) ||
          (c.customerMobile && c.customerMobile.toLowerCase().includes(q)) ||
          (c.bankName && c.bankName.toLowerCase().includes(q)) ||
          (c.loanProduct && c.loanProduct.toLowerCase().includes(q)) ||
          (c.applicationNumber && c.applicationNumber.toLowerCase().includes(q)) ||
          (c.status && c.status.toLowerCase().includes(q))
      );
    }
    return list;
  }, [ledgerData.cases, drawerLeadFilter, drawerLeadSearch]);

  // Filtered Leads inside the Payment Modal Picker
  const filteredPartyLeadsForModal = useMemo(() => {
    if (!modalLeadSearch || !modalLeadSearch.trim()) {
      return partyLeadsForModal;
    }
    const q = modalLeadSearch.trim().toLowerCase();
    return partyLeadsForModal.filter(
      (l) =>
        String(l.leadId).includes(q) ||
        (l.customerName && l.customerName.toLowerCase().includes(q)) ||
        (l.customerMobile && l.customerMobile.toLowerCase().includes(q)) ||
        (l.bankName && l.bankName.toLowerCase().includes(q)) ||
        (l.loanProduct && l.loanProduct.toLowerCase().includes(q)) ||
        (l.status && l.status.toLowerCase().includes(q))
    );
  }, [partyLeadsForModal, modalLeadSearch]);

  // Export to Excel Matching the Sheet
  const handleExportExcel = () => {
    if (!summaryData.length) {
      toast.info("No data available to export");
      return;
    }

    const data = summaryData.map((row) => ({
      "Party / Connector": row.partyName,
      "Party Code": row.partyCode,
      "Disbursed Cases": row.disbursedCases,
      "Case-linked Due (₹)": row.caseLinkedDue,
      "Linked Payments (₹)": row.linkedPayments,
      "Unallocated Advances (₹)": row.unallocatedAdvances,
      "Refunds / Credits (₹)": row.refundsCredits,
      "Net Cash Transferred (₹)": row.netCashTransferred,
      "Payable After Transfers (₹)": row.payableAfterTransfers,
      "Advance Balance (₹)": row.advanceBalance,
      "Status":
        row.status === "SETTLED"
          ? "Settled"
          : row.status === "PENDING"
          ? "Pending Payout"
          : row.status === "ADVANCE_PAID"
          ? "Advance Paid"
          : "No Cases",
    }));

    // Add Grand Total row
    data.push({
      "Party / Connector": "GRAND TOTAL",
      "Party Code": "TOTALS",
      "Disbursed Cases": grandTotals.disbursedCases,
      "Case-linked Due (₹)": grandTotals.caseLinkedDue,
      "Linked Payments (₹)": grandTotals.linkedPayments,
      "Unallocated Advances (₹)": grandTotals.unallocatedAdvances,
      "Refunds / Credits (₹)": grandTotals.refundsCredits,
      "Net Cash Transferred (₹)": grandTotals.netCashTransferred,
      "Payable After Transfers (₹)": grandTotals.payableAfterTransfers,
      "Advance Balance (₹)": grandTotals.advanceBalance,
      "Status": "—",
    });

    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Party Summary");
    XLSX.writeFile(wb, `Party_Summary_Ledger_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Party Summary exported to Excel successfully!");
  };

  const hasActiveFilters =
    filterPeriodType !== "all" || Boolean(searchTerm) || statusTab !== "ALL";

  const resetAllFilters = () => {
    setFilterPeriodType("all");
    setCustomFromDate("");
    setCustomToDate("");
    setSelectedMonth("");
    setSelectedFY("");
    setSearchTerm("");
    setStatusTab("ALL");
  };

  return (
    <div className="cc-party-payouts-container">
      <style>{partyPayoutStyles}</style>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header Panel */}
      <section className="cc-report-panel cc-payout-header-panel">
        <div className="cc-payout-header-cluster">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="cc-payout-title">Party / Connector Summary</h1>
              <span className="cc-payout-badge">Payouts &amp; Ledger</span>
            </div>
            <p className="cc-payout-sub">
              What each connector is owed vs. already paid, tracked per Party Code.
            </p>
          </div>

          <div style={{ display: "flex", gap: 10, alignItems: "center", flexWrap: "wrap" }}>
            <button
              type="button"
              className="cc-payout-btn secondary"
              onClick={handleExportExcel}
              title="Download Excel matching Party Summary sheet"
            >
              <Download size={15} /> Export Sheet
            </button>
            <button
              type="button"
              className="cc-payout-btn primary"
              onClick={() => {
                const firstParty = summaryData[0] || { partyName: "Direct", partyCode: "—" };
                openRecordPaymentModal(firstParty);
              }}
            >
              <Plus size={15} /> Record Payment / Advance
            </button>
          </div>
        </div>
      </section>

      {/* KPI Overview Cards */}
      <section className="cc-payout-kpi-grid">
        <div className="cc-payout-kpi-card">
          <div className="cc-kpi-meta">
            <span className="cc-kpi-label">Disbursed Cases</span>
            <div className="cc-kpi-icon blue">
              <FileCheck size={18} />
            </div>
          </div>
          <strong className="cc-kpi-val">{numberFormatter.format(grandTotals.disbursedCases)}</strong>
          <small className="cc-kpi-sub">Across {grandTotals.totalConnectors} connectors</small>
        </div>

        <div className="cc-payout-kpi-card">
          <div className="cc-kpi-meta">
            <span className="cc-kpi-label">Case-linked Due</span>
            <div className="cc-kpi-icon purple">
              <Coins size={18} />
            </div>
          </div>
          <strong className="cc-kpi-val">{currencyFormatter.format(grandTotals.caseLinkedDue)}</strong>
          <small className="cc-kpi-sub">Commission earned by connectors</small>
        </div>

        <div className="cc-payout-kpi-card">
          <div className="cc-kpi-meta">
            <span className="cc-kpi-label">Net Cash Transferred</span>
            <div className="cc-kpi-icon emerald">
              <TrendingUp size={18} />
            </div>
          </div>
          <strong className="cc-kpi-val">{currencyFormatter.format(grandTotals.netCashTransferred)}</strong>
          <small className="cc-kpi-sub">
            Linked: {currencyFormatter.format(grandTotals.linkedPayments)} • Adv: {currencyFormatter.format(grandTotals.unallocatedAdvances)}
          </small>
        </div>

        <div className="cc-payout-kpi-card highlight-payable">
          <div className="cc-kpi-meta">
            <span className="cc-kpi-label">Payable After Transfers</span>
            <div className="cc-kpi-icon amber">
              <Wallet size={18} />
            </div>
          </div>
          <strong className="cc-kpi-val payable">{currencyFormatter.format(grandTotals.payableAfterTransfers)}</strong>
          <small className="cc-kpi-sub">Remaining balance to be paid</small>
        </div>

        <div className="cc-payout-kpi-card">
          <div className="cc-kpi-meta">
            <span className="cc-kpi-label">Advance Balance</span>
            <div className="cc-kpi-icon cyan">
              <Receipt size={18} />
            </div>
          </div>
          <strong className="cc-kpi-val advance">{currencyFormatter.format(grandTotals.advanceBalance)}</strong>
          <small className="cc-kpi-sub">Unadjusted advance credit surplus</small>
        </div>
      </section>

      {/* Filtration Toolbar */}
      <section className="cc-report-panel cc-payout-filter-panel">
        <div className="cc-payout-filter-bar">
          {/* Search Box */}
          <label className="cc-payout-search-box">
            <Search size={16} />
            <input
              type="search"
              placeholder="Search by Party / Connector Name or Party Code (e.g. PTY-001)..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                className="cc-search-clear"
                onClick={() => setSearchTerm("")}
              >
                <X size={13} />
              </button>
            )}
          </label>

          {/* Time Period Filter Type */}
          <div className="cc-payout-filter-control">
            <CalendarDays size={14} className="cc-filter-icon" />
            <select
              value={filterPeriodType}
              onChange={(e) => {
                const val = e.target.value;
                setFilterPeriodType(val);
                if (val === "month" && !selectedMonth && availableMonths.length > 0) {
                  setSelectedMonth(availableMonths[0].val);
                }
                if (val === "fy" && !selectedFY && financialYears.length > 0) {
                  setSelectedFY(financialYears[0]);
                }
              }}
              className="cc-payout-select"
              title="Filter by Period (Date, Month, Financial Year)"
            >
              <option value="all">📅 All Dates</option>
              <option value="custom">📆 Date Wise (Range)</option>
              <option value="month">🗓️ Month Wise</option>
              <option value="fy">📊 Financial Year Wise</option>
            </select>
          </div>

          {/* Custom Date Range */}
          {filterPeriodType === "custom" && (
            <div className="cc-payout-date-range-inputs">
              <label className="cc-date-field">
                <span>From:</span>
                <input
                  type="date"
                  value={customFromDate}
                  onChange={(e) => setCustomFromDate(e.target.value)}
                  className="cc-payout-date-input"
                />
              </label>
              <label className="cc-date-field">
                <span>To:</span>
                <input
                  type="date"
                  value={customToDate}
                  onChange={(e) => setCustomToDate(e.target.value)}
                  className="cc-payout-date-input"
                />
              </label>
            </div>
          )}

          {/* Month Selector */}
          {filterPeriodType === "month" && (
            <div className="cc-payout-filter-control">
              <select
                value={selectedMonth || availableMonths[0]?.val}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="cc-payout-select highlight"
              >
                {availableMonths.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Financial Year Selector */}
          {filterPeriodType === "fy" && (
            <div className="cc-payout-filter-control">
              <select
                value={selectedFY || financialYears[0]}
                onChange={(e) => setSelectedFY(e.target.value)}
                className="cc-payout-select highlight"
              >
                {financialYears.map((fy) => (
                  <option key={fy} value={fy}>
                    FY {fy} (Apr - Mar)
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              type="button"
              className="cc-payout-clear-filters-btn"
              onClick={resetAllFilters}
              title="Reset All Filters"
            >
              <X size={13} /> Clear Filters
            </button>
          )}

          {/* Refresh Button */}
          <button
            type="button"
            className="cc-payout-icon-refresh"
            onClick={fetchSummary}
            title="Refresh Summary"
          >
            <RefreshCw size={15} />
          </button>
        </div>

        {/* Status Tabs */}
        <div className="cc-payout-status-tabs" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={statusTab === "ALL" ? "active" : ""}
            onClick={() => setStatusTab("ALL")}
          >
            All Connectors ({summaryData.length})
          </button>
          <button
            type="button"
            className={`amber-tab ${statusTab === "PENDING" ? "active" : ""}`}
            onClick={() => setStatusTab("PENDING")}
          >
            ⏳ Pending Payouts ({summaryData.filter((s) => s.payableAfterTransfers > 0).length})
          </button>
          <button
            type="button"
            className={`green-tab ${statusTab === "SETTLED" ? "active" : ""}`}
            onClick={() => setStatusTab("SETTLED")}
          >
            ✅ Settled ({summaryData.filter((s) => s.payableAfterTransfers === 0 && s.caseLinkedDue > 0).length})
          </button>
          <button
            type="button"
            className={`blue-tab ${statusTab === "ADVANCE_PAID" ? "active" : ""}`}
            onClick={() => setStatusTab("ADVANCE_PAID")}
          >
            💳 Advance Paid ({summaryData.filter((s) => s.advanceBalance > 0).length})
          </button>
        </div>
      </section>

      {/* Main Party Summary Table */}
      <section className="cc-report-panel">
        <div className="cc-report-table-scroll">
          <table className="cc-payout-summary-table">
            <thead>
              <tr>
                <th>Party / Connector</th>
                <th>Party Code</th>
                <th>Disbursed Cases</th>
                <th>Case-linked Due (₹)</th>
                <th>Linked Payments (₹)</th>
                <th>Unallocated Advances (₹)</th>
                <th>Refunds / Credits (₹)</th>
                <th>Net Cash Transferred (₹)</th>
                <th>Payable After Transfers (₹)</th>
                <th>Advance Balance (₹)</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={12} className="cc-report-empty">
                    Loading party connector summary...
                  </td>
                </tr>
              ) : filteredSummary.length === 0 ? (
                <tr>
                  <td colSpan={12} className="cc-report-empty">
                    No connectors match the selected filters.
                  </td>
                </tr>
              ) : (
                filteredSummary.map((row) => (
                  <tr
                    key={row.id || row.partyName}
                    className="cc-payout-table-row"
                    onClick={() => openPartyLedger(row)}
                  >
                    <td>
                      <div style={{ display: "flex", alignItems: "center", gap: 9 }}>
                        <span
                          className="cc-party-dot"
                          style={{ background: row.colorCode || "#3b82f6" }}
                        />
                        <div>
                          <strong style={{ fontSize: 13.5, color: "#0f172a" }}>
                            {row.partyName}
                          </strong>
                          {row.defaultCommissionPercent > 0 && (
                            <small style={{ display: "block", color: "#64748b", fontSize: 11 }}>
                              Comm: {row.defaultCommissionPercent}%
                            </small>
                          )}
                        </div>
                      </div>
                    </td>
                    <td>
                      <span className="cc-party-code-tag">{row.partyCode}</span>
                    </td>
                    <td>
                      <span className="cc-case-count-tag">{row.disbursedCases}</span>
                    </td>
                    <td>
                      <strong>{currencyFormatter.format(row.caseLinkedDue)}</strong>
                    </td>
                    <td>{currencyFormatter.format(row.linkedPayments)}</td>
                    <td>
                      {row.unallocatedAdvances > 0 ? (
                        <span style={{ color: "#0284c7", fontWeight: 600 }}>
                          {currencyFormatter.format(row.unallocatedAdvances)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {row.refundsCredits > 0 ? (
                        <span style={{ color: "#dc2626" }}>
                          -{currencyFormatter.format(row.refundsCredits)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      <strong>{currencyFormatter.format(row.netCashTransferred)}</strong>
                    </td>
                    <td>
                      {row.payableAfterTransfers > 0 ? (
                        <span className="cc-val-badge payable">
                          {currencyFormatter.format(row.payableAfterTransfers)}
                        </span>
                      ) : row.caseLinkedDue > 0 ? (
                        <span className="cc-val-badge zero">₹0</span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {row.advanceBalance > 0 ? (
                        <span className="cc-val-badge advance">
                          {currencyFormatter.format(row.advanceBalance)}
                        </span>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td>
                      {row.status === "SETTLED" ? (
                        <span className="cc-status-pill green">
                          <CheckCircle2 size={12} /> Settled
                        </span>
                      ) : row.status === "PENDING" ? (
                        <span className="cc-status-pill amber">
                          <Clock size={12} /> Pending
                        </span>
                      ) : row.status === "ADVANCE_PAID" ? (
                        <span className="cc-status-pill blue">
                          <CreditCard size={12} /> Advance
                        </span>
                      ) : (
                        <span className="cc-status-pill gray">No Cases</span>
                      )}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
                        <button
                          type="button"
                          className="cc-payout-row-btn"
                          onClick={() => openPartyLedger(row)}
                          title="View Ledger & Case Breakdown"
                        >
                          <Eye size={13} /> View
                        </button>
                        <button
                          type="button"
                          className="cc-payout-row-btn pay"
                          onClick={() => openRecordPaymentModal(row)}
                          title="Record Payment / Advance"
                        >
                          <IndianRupee size={12} /> Pay
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
            {/* Table Footer with Grand Totals */}
            {!loading && filteredSummary.length > 0 && (
              <tfoot>
                <tr className="cc-payout-total-row">
                  <td>
                    <strong>GRAND TOTAL</strong>
                  </td>
                  <td>
                    <span className="cc-party-code-tag total">TOTALS</span>
                  </td>
                  <td>
                    <strong>{grandTotals.disbursedCases}</strong>
                  </td>
                  <td>
                    <strong>{currencyFormatter.format(grandTotals.caseLinkedDue)}</strong>
                  </td>
                  <td>
                    <strong>{currencyFormatter.format(grandTotals.linkedPayments)}</strong>
                  </td>
                  <td>
                    <strong>{currencyFormatter.format(grandTotals.unallocatedAdvances)}</strong>
                  </td>
                  <td>
                    <strong>
                      {grandTotals.refundsCredits > 0
                        ? `-${currencyFormatter.format(grandTotals.refundsCredits)}`
                        : "—"}
                    </strong>
                  </td>
                  <td>
                    <strong>{currencyFormatter.format(grandTotals.netCashTransferred)}</strong>
                  </td>
                  <td>
                    <strong style={{ color: "#d97706" }}>
                      {currencyFormatter.format(grandTotals.payableAfterTransfers)}
                    </strong>
                  </td>
                  <td>
                    <strong style={{ color: "#0284c7" }}>
                      {currencyFormatter.format(grandTotals.advanceBalance)}
                    </strong>
                  </td>
                  <td colSpan={2}>—</td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </section>

      {/* DETAILED CONNECTOR LEDGER DRAWER */}
      {selectedParty && (
        <div className="cc-drawer-overlay" onClick={() => setSelectedParty(null)}>
          <aside className="cc-payout-drawer" onClick={(e) => e.stopPropagation()}>
            <div className="cc-drawer-header">
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                  <h2>{selectedParty.partyName}</h2>
                  <span className="cc-party-code-tag header">{selectedParty.partyCode}</span>
                </div>
                <p>
                  Connector Ledger Breakdown • Disbursed Cases &amp; Payment History
                </p>
              </div>
              <button
                type="button"
                className="cc-drawer-close"
                onClick={() => setSelectedParty(null)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="cc-drawer-body">
              {/* Balances Highlight Card */}
              <div className="cc-ledger-balance-box">
                <div className="cc-lbox-item">
                  <small>Case-linked Due</small>
                  <strong>{currencyFormatter.format(ledgerData.balances?.caseLinkedDue || 0)}</strong>
                </div>
                <div className="cc-lbox-item">
                  <small>Net Paid</small>
                  <strong style={{ color: "#047857" }}>
                    {currencyFormatter.format(ledgerData.balances?.netCashTransferred || 0)}
                  </strong>
                </div>
                <div className="cc-lbox-item">
                  <small>Unallocated Advances</small>
                  <strong style={{ color: "#0284c7" }}>
                    {currencyFormatter.format(ledgerData.balances?.unallocatedAdvances || 0)}
                  </strong>
                </div>
                <div className="cc-lbox-item highlight">
                  <small>Payable Remaining</small>
                  <strong style={{ color: "#b45309" }}>
                    {currencyFormatter.format(ledgerData.balances?.payableAfterTransfers || 0)}
                  </strong>
                </div>
              </div>

              {/* Action Toolbar */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", margin: "14px 0", flexWrap: "wrap", gap: 8 }}>
                <div className="cc-ledger-nav-tabs">
                  <button
                    type="button"
                    className={activeLedgerTab === "cases" ? "active" : ""}
                    onClick={() => setActiveLedgerTab("cases")}
                  >
                    <FileText size={14} /> Linked Leads ({ledgerData.cases?.length || 0})
                  </button>
                  <button
                    type="button"
                    className={activeLedgerTab === "payments" ? "active" : ""}
                    onClick={() => setActiveLedgerTab("payments")}
                  >
                    <Receipt size={14} /> Payment History ({ledgerData.payments?.length || 0})
                  </button>
                </div>

                <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                  <button
                    type="button"
                    className="cc-payout-btn secondary small"
                    onClick={() => openLinkLeadModal(selectedParty)}
                    title="Attach or assign an existing CRM lead to this party"
                  >
                    <LinkIcon size={14} /> Assign / Link Lead
                  </button>
                  <button
                    type="button"
                    className="cc-payout-btn primary small"
                    onClick={() => openRecordPaymentModal(selectedParty)}
                  >
                    <Plus size={14} /> Add Payment / Advance
                  </button>
                </div>
              </div>

              {ledgerLoading ? (
                <div style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                  <RefreshCw className="cc-spin" size={24} style={{ marginBottom: 10 }} />
                  <p>Loading ledger records...</p>
                </div>
              ) : activeLedgerTab === "cases" ? (
                /* TAB 1: ALL LINKED LEADS & CASES BREAKDOWN */
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  {/* Sub-toolbar with Search & Status Pills */}
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 10, flexWrap: "wrap" }}>
                    {/* Status Pills */}
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        className={`cc-lead-subtab-btn ${drawerLeadFilter === "ALL" ? "active" : ""}`}
                        onClick={() => setDrawerLeadFilter("ALL")}
                      >
                        All Leads ({ledgerData.cases?.length || 0})
                      </button>
                      <button
                        type="button"
                        className={`cc-lead-subtab-btn ${drawerLeadFilter === "DISBURSED" ? "active" : ""}`}
                        onClick={() => setDrawerLeadFilter("DISBURSED")}
                      >
                        Disbursed ({ledgerData.cases?.filter((c) => c.isDisbursed).length || 0})
                      </button>
                      <button
                        type="button"
                        className={`cc-lead-subtab-btn ${drawerLeadFilter === "PENDING" ? "active" : ""}`}
                        onClick={() => setDrawerLeadFilter("PENDING")}
                      >
                        In Process ({(ledgerData.cases?.length || 0) - (ledgerData.cases?.filter((c) => c.isDisbursed).length || 0)})
                      </button>
                    </div>

                    {/* Search Box */}
                    <div className="cc-drawer-search-box">
                      <Search size={14} color="#94a3b8" />
                      <input
                        type="text"
                        placeholder="Search customer, mobile, bank, lead #..."
                        value={drawerLeadSearch}
                        onChange={(e) => setDrawerLeadSearch(e.target.value)}
                      />
                      {drawerLeadSearch && (
                        <button
                          type="button"
                          onClick={() => setDrawerLeadSearch("")}
                          style={{ border: 0, background: "transparent", cursor: "pointer", color: "#94a3b8" }}
                        >
                          <X size={14} />
                        </button>
                      )}
                    </div>
                  </div>

                  <div className="cc-ledger-table-wrap">
                    <table className="cc-ledger-table">
                      <thead>
                        <tr>
                          <th>Lead & App</th>
                          <th>Customer</th>
                          <th>Loan Product</th>
                          <th>Bank</th>
                          <th>Loan Disbursed</th>
                          <th>Bank Base Payout (₹)</th>
                          <th>DSA Comm % (on Bank Net)</th>
                          <th>Party Due (₹)</th>
                          <th>Paid / Remaining</th>
                          <th>Status</th>
                          <th>Date</th>
                          <th>Action</th>
                        </tr>
                      </thead>
                      <tbody>
                        {filteredDrawerLeads.length === 0 ? (
                          <tr>
                            <td colSpan={12} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                              {drawerLeadSearch
                                ? `No leads matching "${drawerLeadSearch}" found for this party.`
                                : "No leads associated with this connector yet."}
                            </td>
                          </tr>
                        ) : (
                          filteredDrawerLeads.map((c) => {
                            const isDisbursed = c.isDisbursed;
                            const dsaDue = parseFloat(
                              c.netPayable !== undefined && c.netPayable !== null ? c.netPayable : c.commissionDue || 0
                            );
                            const partyPaid = parseFloat(c.paidAmount || 0);
                            const remaining = parseFloat(
                              c.remainingDue !== undefined ? c.remainingDue : Math.max(0, dsaDue - partyPaid)
                            );

                            return (
                              <tr key={c.leadId}>
                                <td>
                                  <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                                    <span className="cc-lead-id-tag">#{c.leadId}</span>
                                    {c.applicationNumber && (
                                      <span
                                        style={{
                                          fontSize: 10,
                                          background: "#f1f5f9",
                                          border: "1px solid #cbd5e1",
                                          padding: "1px 5px",
                                          borderRadius: 4,
                                          color: "#475569",
                                          fontWeight: 600,
                                        }}
                                      >
                                        {c.applicationNumber}
                                      </span>
                                    )}
                                  </div>
                                </td>
                                <td>
                                  <strong style={{ fontSize: 13, color: "#0f172a" }}>{c.customerName}</strong>
                                  <small style={{ display: "block", color: "#64748b", fontSize: 11 }}>
                                    {c.customerMobile}
                                  </small>
                                </td>
                                <td>
                                  <span className="cc-product-tag" style={{ fontSize: 11.5, background: "#f8fafc", border: "1px solid #e2e8f0", padding: "2px 7px", borderRadius: 4, color: "#334155" }}>
                                    {c.loanProduct}
                                  </span>
                                </td>
                                <td>
                                  {c.bankName ? (
                                    <span className="cc-ledger-bank-tag">
                                      <Building2 size={12} /> {c.bankName}
                                    </span>
                                  ) : (
                                    <span style={{ color: "#94a3b8" }}>—</span>
                                  )}
                                </td>
                                <td>
                                  <strong style={{ fontSize: 13, color: "#0f172a" }}>
                                    {currencyFormatter.format(c.loanAmount || c.baseAmount || 0)}
                                  </strong>
                                </td>
                                <td>
                                  {isDisbursed && c.bankBaseAmount > 0 ? (
                                    <div>
                                      <strong style={{ fontSize: 13, color: "#047857" }}>
                                        {currencyFormatter.format(c.bankBaseAmount)}
                                      </strong>
                                      {c.bankNetReceivable > 0 && (
                                        <small style={{ display: "block", color: "#059669", fontSize: 10.5 }}>
                                          Net Bank: {currencyFormatter.format(c.bankNetReceivable)}
                                        </small>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: "#94a3b8" }}>—</span>
                                  )}
                                </td>
                                <td>
                                  {isDisbursed ? (
                                    <div>
                                      <span className="cc-rate-tag purple">{c.commissionPercent}%</span>
                                      <small style={{ display: "block", color: "#7c3aed", fontSize: 10, marginTop: 2 }}>
                                        on Bank Net
                                      </small>
                                    </div>
                                  ) : (
                                    <span>{c.commissionPercent}%</span>
                                  )}
                                </td>
                                <td>
                                  {isDisbursed ? (
                                    <div>
                                      <strong style={{ fontSize: 13, color: dsaDue > 0 ? "#047857" : "#64748b" }}>
                                        {currencyFormatter.format(dsaDue)}
                                      </strong>
                                      {c.commissionDue > dsaDue && (
                                        <small style={{ display: "block", color: "#64748b", fontSize: 10 }}>
                                          Gross: {currencyFormatter.format(c.commissionDue)}
                                        </small>
                                      )}
                                    </div>
                                  ) : (
                                    <span style={{ color: "#94a3b8" }}>₹0 (Pipeline)</span>
                                  )}
                                </td>
                                <td>
                                  {isDisbursed ? (
                                    <div style={{ fontSize: 11 }}>
                                      {partyPaid > 0 && (
                                        <div style={{ color: "#059669", fontWeight: 600 }}>
                                          Paid: {currencyFormatter.format(partyPaid)}
                                        </div>
                                      )}
                                      <div style={{ color: remaining > 0 ? "#b45309" : "#64748b" }}>
                                        Rem: {currencyFormatter.format(remaining)}
                                      </div>
                                    </div>
                                  ) : (
                                    <span style={{ color: "#94a3b8" }}>—</span>
                                  )}
                                </td>
                                <td>
                                  <span
                                    className={`cc-lead-status-pill ${
                                      isDisbursed
                                        ? remaining === 0 && dsaDue > 0
                                          ? "settled"
                                          : partyPaid > 0
                                          ? "partial"
                                          : "disbursed"
                                        : "pending"
                                    }`}
                                  >
                                    {isDisbursed
                                      ? remaining === 0 && dsaDue > 0
                                        ? "SETTLED"
                                        : partyPaid > 0
                                        ? "PARTIALLY PAID"
                                        : "DISBURSED"
                                      : (c.status || "IN_PROGRESS").replace(/_/g, " ")}
                                  </span>
                                </td>
                                <td>{new Date(c.date).toLocaleDateString("en-IN")}</td>
                                <td>
                                  <button
                                    type="button"
                                    className="cc-ledger-pay-btn"
                                    onClick={() => openRecordPaymentModal(selectedParty, c)}
                                    title="Pay / Settle against this lead"
                                  >
                                    {remaining === 0 && isDisbursed && dsaDue > 0
                                      ? "View / Pay"
                                      : isDisbursed
                                      ? "Settle Case"
                                      : "Select & Pay"}
                                  </button>
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                /* TAB 2: PAYMENT & ADVANCE HISTORY */
                <div className="cc-ledger-table-wrap">
                  <table className="cc-ledger-table">
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Type</th>
                        <th>Amount (₹)</th>
                        <th>Mode</th>
                        <th>Ref / UTR #</th>
                        <th>Notes / Remark</th>
                        <th>Recorded By</th>
                        <th>Action</th>
                      </tr>
                    </thead>
                    <tbody>
                      {(ledgerData.payments || []).length === 0 ? (
                        <tr>
                          <td colSpan={8} style={{ textAlign: "center", padding: "30px", color: "#94a3b8" }}>
                            No payment transactions recorded for this connector yet.
                          </td>
                        </tr>
                      ) : (
                        (ledgerData.payments || []).map((p) => (
                          <tr key={p.id}>
                            <td>
                              <strong>{new Date(p.paymentDate).toLocaleDateString("en-IN")}</strong>
                            </td>
                            <td>
                              {p.paymentType === "ADVANCE" ? (
                                <span className="cc-tx-type advance">Advance</span>
                              ) : p.paymentType === "REFUND_CREDIT" ? (
                                <span className="cc-tx-type refund">Refund/Credit</span>
                              ) : (
                                <span className="cc-tx-type settlement">Settlement</span>
                              )}
                            </td>
                            <td>
                              <strong style={{ color: p.paymentType === "REFUND_CREDIT" ? "#dc2626" : "#047857", fontSize: 13 }}>
                                {p.paymentType === "REFUND_CREDIT" ? "-" : "+"}
                                {currencyFormatter.format(p.amount)}
                              </strong>
                            </td>
                            <td>
                              <span className="cc-tx-mode">{p.paymentMode?.replace(/_/g, " ")}</span>
                            </td>
                            <td>{p.referenceNumber || "—"}</td>
                            <td>
                              <small style={{ color: "#475569" }}>{p.notes || "—"}</small>
                            </td>
                            <td>
                              <small style={{ color: "#64748b" }}>{p.recordedBy?.name || "Admin"}</small>
                            </td>
                            <td>
                              <button
                                type="button"
                                className="cc-ledger-del-btn"
                                onClick={() => handleDeletePayment(p.id)}
                                disabled={deletingPaymentId === p.id}
                                title="Delete / Reverse Payment"
                              >
                                <Trash2 size={13} />
                              </button>
                            </td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </aside>
        </div>
      )}

      {/* RECORD PAYMENT / ADVANCE MODAL */}
      {paymentModalOpen && (
        <div className="cc-modal-overlay" onClick={() => setPaymentModalOpen(false)}>
          <div className="cc-payment-modal" onClick={(e) => e.stopPropagation()}>
            <div className="cc-pmodal-header">
              <div>
                <h3>Record Payment / Advance</h3>
                <p>Transfer payout or advance credit to connector</p>
              </div>
              <button
                type="button"
                className="cc-pmodal-close"
                onClick={() => setPaymentModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePaymentSubmit} className="cc-pmodal-form">
              {/* Connector Selector / Display */}
              <div className="cc-form-group">
                <label>Connector / Party Name *</label>
                <select
                  value={paymentForm.partyName}
                  onChange={(e) => handlePartyChangeInModal(e.target.value)}
                  required
                >
                  {summaryData.map((s) => (
                    <option key={s.id || s.partyName} value={s.partyName}>
                      {s.partyName} {s.partyCode ? `(${s.partyCode})` : ""}
                    </option>
                  ))}
                </select>
              </div>

              {/* Payment Type */}
              <div className="cc-form-group">
                <label>Transaction Type *</label>
                <div className="cc-ptype-selector">
                  <label className={`cc-ptype-option ${paymentForm.paymentType === "LINKED_PAYMENT" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="paymentType"
                      value="LINKED_PAYMENT"
                      checked={paymentForm.paymentType === "LINKED_PAYMENT"}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                    />
                    <span>💼 Linked Case Payment</span>
                  </label>
                  <label className={`cc-ptype-option ${paymentForm.paymentType === "ADVANCE" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="paymentType"
                      value="ADVANCE"
                      checked={paymentForm.paymentType === "ADVANCE"}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                    />
                    <span>💳 Unallocated Advance</span>
                  </label>
                  <label className={`cc-ptype-option ${paymentForm.paymentType === "REFUND_CREDIT" ? "active" : ""}`}>
                    <input
                      type="radio"
                      name="paymentType"
                      value="REFUND_CREDIT"
                      checked={paymentForm.paymentType === "REFUND_CREDIT"}
                      onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentType: e.target.value }))}
                    />
                    <span>🔄 Refund / Credit</span>
                  </label>
                </div>
              </div>

              {/* Amount & Date Row */}
              <div className="cc-form-row">
                <div className="cc-form-group">
                  <label>Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    placeholder="e.g. 15000"
                    value={paymentForm.amount}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, amount: e.target.value }))}
                    required
                  />
                </div>
                <div className="cc-form-group">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    value={paymentForm.paymentDate}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                    required
                  />
                </div>
              </div>

              {/* Payment Mode & Reference Number Row */}
              <div className="cc-form-row">
                <div className="cc-form-group">
                  <label>Payment Mode *</label>
                  <select
                    value={paymentForm.paymentMode}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT/RTGS/IMPS)</option>
                    <option value="UPI">UPI / GooglePay / PhonePe</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
                <div className="cc-form-group">
                  <label>UTR / Ref / Cheque No</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR12345678"
                    value={paymentForm.referenceNumber}
                    onChange={(e) => setPaymentForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                  />
                </div>
              </div>

              {/* Searchable Lead Selector for this Connector */}
              <div className="cc-form-group">
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 2 }}>
                  <label>
                    Link to Lead {paymentForm.paymentType === "LINKED_PAYMENT" ? "*" : "(Optional)"}
                  </label>
                  {selectedLeadForPayment && (
                    <button
                      type="button"
                      onClick={handleClearSelectedLeadInModal}
                      style={{
                        border: 0,
                        background: "transparent",
                        color: "#be123c",
                        fontSize: 11,
                        fontWeight: 600,
                        cursor: "pointer",
                      }}
                    >
                      ✕ Clear Selection
                    </button>
                  )}
                </div>

                {/* If a lead is currently selected, display its card */}
                {selectedLeadForPayment ? (
                  <div className="cc-selected-lead-card">
                    <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start" }}>
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                          <span className="cc-lead-id-tag">#{selectedLeadForPayment.leadId}</span>
                          <strong style={{ fontSize: 13, color: "#0f172a" }}>
                            {selectedLeadForPayment.customerName}
                          </strong>
                          <span style={{ fontSize: 11, color: "#64748b" }}>
                            ({selectedLeadForPayment.customerMobile})
                          </span>
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 4 }}>
                          {selectedLeadForPayment.loanProduct} • {selectedLeadForPayment.bankName || "Bank not assigned"} • Disbursed: {currencyFormatter.format(selectedLeadForPayment.loanAmount || selectedLeadForPayment.baseAmount || 0)}
                          {selectedLeadForPayment.bankBaseAmount > 0 && ` • Bank Base: ${currencyFormatter.format(selectedLeadForPayment.bankBaseAmount)}`}
                        </div>
                      </div>
                      <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                        <div style={{ fontSize: 10, color: "#64748b" }}>
                          {selectedLeadForPayment.bankBaseAmount > 0
                            ? `Net Due (${selectedLeadForPayment.commissionPercent}% on Bank Base)`
                            : `Net Due (${selectedLeadForPayment.commissionPercent}%)`}
                        </div>
                        <strong style={{ fontSize: 13, color: "#047857" }}>
                          {currencyFormatter.format(
                            selectedLeadForPayment.remainingDue !== undefined
                              ? selectedLeadForPayment.remainingDue
                              : (selectedLeadForPayment.commissionDue || 0)
                          )}
                        </strong>
                      </div>
                    </div>
                  </div>
                ) : (
                  /* Searchable Lead Picker Dropdown / Box */
                  <div className="cc-modal-lead-picker">
                    <div className="cc-modal-lead-search">
                      <Search size={14} color="#94a3b8" />
                      <input
                        type="text"
                        placeholder={`Search ${partyLeadsForModal.length} leads of this party (name, phone, bank, #)...`}
                        value={modalLeadSearch}
                        onChange={(e) => setModalLeadSearch(e.target.value)}
                      />
                      {modalLeadSearch && (
                        <button
                          type="button"
                          onClick={() => setModalLeadSearch("")}
                          style={{ border: 0, background: "transparent", cursor: "pointer", color: "#94a3b8" }}
                        >
                          <X size={12} />
                        </button>
                      )}
                    </div>

                    <div className="cc-modal-lead-list">
                      {loadingPartyLeadsForModal ? (
                        <div style={{ padding: "12px", textAlign: "center", color: "#64748b", fontSize: 12 }}>
                          <RefreshCw size={13} className="cc-spin" style={{ display: "inline-block", marginRight: 6 }} />
                          Loading leads for {paymentForm.partyName}...
                        </div>
                      ) : filteredPartyLeadsForModal.length === 0 ? (
                        <div style={{ padding: "12px", textAlign: "center", color: "#94a3b8", fontSize: 12 }}>
                          {modalLeadSearch
                            ? `No leads matching "${modalLeadSearch}"`
                            : `No leads currently linked to ${paymentForm.partyName}`}
                        </div>
                      ) : (
                        filteredPartyLeadsForModal.slice(0, 20).map((l) => (
                          <div
                            key={l.leadId}
                            className={`cc-modal-lead-item ${paymentForm.leadId === l.leadId ? "active" : ""}`}
                            onClick={() => handleSelectLeadInModal(l)}
                          >
                            <div style={{ flex: 1, minWidth: 0 }}>
                              <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                                <span className="cc-item-lead-id">#{l.leadId}</span>
                                <strong style={{ fontSize: 12, color: "#1e293b" }}>{l.customerName}</strong>
                                <span style={{ fontSize: 11, color: "#64748b" }}>{l.customerMobile}</span>
                                <span className={`cc-lead-mini-tag ${l.isDisbursed ? "disbursed" : "pending"}`}>
                                  {l.isDisbursed ? "Disbursed" : (l.status || "Pending").slice(0, 14)}
                                </span>
                              </div>
                              <div style={{ fontSize: 11, color: "#64748b", marginTop: 2, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                                {l.loanProduct} {l.bankName ? `• ${l.bankName}` : ""} • Disbursed: ₹{numberFormatter.format(l.loanAmount || l.baseAmount || 0)}
                                {l.bankBaseAmount > 0 ? ` • Bank Base: ₹${numberFormatter.format(l.bankBaseAmount)}` : ""}
                              </div>
                            </div>
                            <div style={{ textAlign: "right", whiteSpace: "nowrap", paddingLeft: 8 }}>
                              <div style={{ fontSize: 10, color: "#64748b" }}>
                                {l.bankBaseAmount > 0 ? `Due (${l.commissionPercent}% on Bank Base)` : `Due (${l.commissionPercent}%)`}
                              </div>
                              <strong style={{ fontSize: 12, color: (l.remainingDue || l.commissionDue) > 0 ? "#047857" : "#64748b" }}>
                                {currencyFormatter.format(l.remainingDue !== undefined ? l.remainingDue : (l.commissionDue || 0))}
                              </strong>
                              <div style={{ fontSize: 10, color: "#2563eb", fontWeight: 700, marginTop: 2 }}>
                                Set Lead →
                              </div>
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                )}
              </div>

              {/* Remarks / Notes */}
              <div className="cc-form-group">
                <label>Remarks / Notes</label>
                <textarea
                  rows={2}
                  placeholder="e.g. Commission payout for September disbursement or advance given..."
                  value={paymentForm.notes}
                  onChange={(e) => setPaymentForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="cc-pmodal-actions">
                <button
                  type="button"
                  className="cc-payout-btn secondary"
                  onClick={() => setPaymentModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-payout-btn primary"
                  disabled={submittingPayment}
                >
                  {submittingPayment ? "Recording..." : "Save Payment & Update Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ASSIGN / LINK LEAD TO CONNECTOR MODAL */}
      {linkLeadModalOpen && (
        <div className="cc-modal-overlay" onClick={() => setLinkLeadModalOpen(false)}>
          <div className="cc-payment-modal" style={{ maxWidth: 580 }} onClick={(e) => e.stopPropagation()}>
            <div className="cc-pmodal-header">
              <div>
                <h3>Assign / Link Lead to Party</h3>
                <p>
                  Attach an existing CRM lead to <strong>{selectedParty?.partyName}</strong>
                </p>
              </div>
              <button
                type="button"
                className="cc-pmodal-close"
                onClick={() => setLinkLeadModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div className="cc-pmodal-form">
              {/* Search Input */}
              <div className="cc-form-group">
                <label>Search Lead (Customer Name, Mobile No. or Lead ID) *</label>
                <div className="cc-payout-search-box" style={{ width: "100%", height: 40 }}>
                  <Search size={16} />
                  <input
                    type="text"
                    placeholder="Type customer name, phone, or lead number..."
                    value={linkLeadSearch}
                    onChange={(e) => handleSearchLeadsToLink(e.target.value)}
                    autoFocus
                  />
                  {linkLeadSearch && (
                    <button
                      type="button"
                      onClick={() => handleSearchLeadsToLink("")}
                      style={{ border: 0, background: "transparent", cursor: "pointer", color: "#94a3b8" }}
                    >
                      <X size={14} />
                    </button>
                  )}
                </div>
              </div>

              {/* Search Results list */}
              {linkLeadSearching ? (
                <div style={{ textAlign: "center", padding: "20px", color: "#64748b", fontSize: 12 }}>
                  <RefreshCw size={16} className="cc-spin" style={{ display: "inline-block", marginRight: 6 }} />
                  Searching leads...
                </div>
              ) : linkLeadResults.length > 0 ? (
                <div className="cc-modal-lead-list" style={{ maxHeight: 220 }}>
                  {linkLeadResults.map((l) => (
                    <div
                      key={l.leadId}
                      className={`cc-modal-lead-item ${selectedLeadToLink?.leadId === l.leadId ? "active" : ""}`}
                      onClick={() => setSelectedLeadToLink(l)}
                    >
                      <div>
                        <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                          <span className="cc-item-lead-id">#{l.leadId}</span>
                          <strong style={{ fontSize: 13, color: "#0f172a" }}>{l.customerName}</strong>
                          <span style={{ fontSize: 11, color: "#64748b" }}>({l.customerMobile})</span>
                        </div>
                        <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                          {l.loanProduct} {l.bankName ? `• ${l.bankName}` : ""} • Current Source: <strong>{l.leadSource || "Self"}</strong>
                        </div>
                      </div>
                      <div style={{ textAlign: "right" }}>
                        <span className={`cc-lead-mini-tag ${l.isDisbursed ? "disbursed" : "pending"}`}>
                          {l.isDisbursed ? "Disbursed" : l.status}
                        </span>
                        <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 700, marginTop: 4 }}>
                          {selectedLeadToLink?.leadId === l.leadId ? "✓ Selected" : "Select →"}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              ) : linkLeadSearch.length >= 2 ? (
                <p style={{ fontSize: 12, color: "#94a3b8", textAlign: "center", margin: "10px 0" }}>
                  No leads found matching "{linkLeadSearch}"
                </p>
              ) : (
                <p style={{ fontSize: 12, color: "#64748b", margin: "4px 0" }}>
                  Type at least 2 characters of customer name or mobile number to search.
                </p>
              )}

              {/* Selected Lead Confirmation Card */}
              {selectedLeadToLink && (
                <div className="cc-selected-lead-card" style={{ borderColor: "#86efac", background: "#f0fdf4" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center" }}>
                    <div>
                      <span style={{ fontSize: 11, fontWeight: 700, color: "#047857", textTransform: "uppercase" }}>
                        Selected Lead to Assign:
                      </span>
                      <div style={{ fontSize: 13, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                        #{selectedLeadToLink.leadId} - {selectedLeadToLink.customerName} ({selectedLeadToLink.customerMobile})
                      </div>
                      <div style={{ fontSize: 11, color: "#475569", marginTop: 2 }}>
                        {selectedLeadToLink.loanProduct} • Loan: {currencyFormatter.format(selectedLeadToLink.baseAmount)}
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={() => setSelectedLeadToLink(null)}
                      style={{ border: 0, background: "transparent", color: "#dc2626", fontSize: 11, cursor: "pointer", fontWeight: 600 }}
                    >
                      Change
                    </button>
                  </div>

                  <div style={{ marginTop: 12, paddingTop: 10, borderTop: "1px dashed #bbf7d0", display: "flex", alignItems: "center", gap: 10 }}>
                    <label style={{ fontSize: 12, fontWeight: 600, color: "#065f46", whiteSpace: "nowrap" }}>
                      Party Commission %:
                    </label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      style={{ width: 100, padding: "5px 8px", borderRadius: 6, border: "1px solid #86efac", fontSize: 13 }}
                      value={linkLeadCommission}
                      onChange={(e) => setLinkLeadCommission(e.target.value)}
                      placeholder="e.g. 1.5"
                    />
                    <span style={{ fontSize: 11, color: "#64748b" }}>
                      (Defaults to connector rate: {selectedParty?.defaultCommissionPercent || 0}%)
                    </span>
                  </div>
                </div>
              )}

              <div className="cc-pmodal-actions">
                <button
                  type="button"
                  className="cc-payout-btn secondary"
                  onClick={() => setLinkLeadModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="cc-payout-btn primary"
                  onClick={handleConfirmLinkLead}
                  disabled={!selectedLeadToLink || submittingLinkLead}
                >
                  {submittingLinkLead ? (
                    <>
                      <RefreshCw size={14} className="cc-spin" /> Assigning...
                    </>
                  ) : (
                    `Assign to ${selectedParty?.partyName}`
                  )}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const partyPayoutStyles = `
  .cc-party-payouts-container {
    padding: 20px;
    background: #f8fafc;
    min-height: 100vh;
  }
  .cc-payout-header-panel {
    padding: 16px 22px;
    margin-bottom: 16px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }
  .cc-payout-header-cluster {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 14px;
  }
  .cc-payout-title {
    margin: 0;
    font-size: 21px;
    font-weight: 800;
    color: #0f172a;
    letter-spacing: -0.3px;
  }
  .cc-payout-badge {
    background: #eef2ff;
    color: #4338ca;
    font-size: 11.5px;
    font-weight: 700;
    padding: 3px 10px;
    border-radius: 999px;
  }
  .cc-payout-sub {
    margin: 4px 0 0;
    font-size: 13px;
    color: #64748b;
  }

  .cc-payout-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 16px;
    border-radius: 9px;
    font-size: 12.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
    border: 0;
  }
  .cc-payout-btn.primary {
    background: #047857;
    color: #fff;
  }
  .cc-payout-btn.primary:hover {
    background: #065f46;
  }
  .cc-payout-btn.primary.small {
    padding: 6px 12px;
    font-size: 12px;
  }
  .cc-payout-btn.secondary {
    background: #fff;
    color: #334155;
    border: 1px solid #cbd5e1;
  }
  .cc-payout-btn.secondary:hover {
    background: #f1f5f9;
  }

  /* KPI Grid */
  .cc-payout-kpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px;
    margin-bottom: 18px;
  }
  .cc-payout-kpi-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px 16px;
    display: flex;
    flex-direction: column;
    gap: 4px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
  }
  .cc-payout-kpi-card.highlight-payable {
    border-color: #fde68a;
    background: #fffbeb;
  }
  .cc-kpi-meta {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cc-kpi-label {
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    text-transform: uppercase;
    letter-spacing: 0.3px;
  }
  .cc-kpi-icon {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: grid;
    place-items: center;
  }
  .cc-kpi-icon.blue { background: #eff6ff; color: #2563eb; }
  .cc-kpi-icon.purple { background: #f5f3ff; color: #7c3aed; }
  .cc-kpi-icon.emerald { background: #ecfdf5; color: #059669; }
  .cc-kpi-icon.amber { background: #fef3c7; color: #d97706; }
  .cc-kpi-icon.cyan { background: #ecfeff; color: #0891b2; }

  .cc-kpi-val {
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
  }
  .cc-kpi-val.payable { color: #b45309; }
  .cc-kpi-val.advance { color: #0284c7; }
  .cc-kpi-sub {
    font-size: 11px;
    color: #94a3b8;
  }

  /* Filters */
  .cc-payout-filter-panel {
    padding: 14px 18px;
    margin-bottom: 16px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }
  .cc-payout-filter-bar {
    display: flex;
    align-items: center;
    gap: 10px;
    flex-wrap: wrap;
  }
  .cc-payout-search-box {
    position: relative;
    flex: 1 1 240px;
    min-width: 200px;
    display: flex;
    align-items: center;
    height: 38px;
    padding: 0 10px 0 34px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    background: #fff;
  }
  .cc-payout-search-box svg { position: absolute; left: 10px; color: #94a3b8; }
  .cc-payout-search-box input { width: 100%; border: 0; outline: none; font-size: 13px; color: #0f172a; }

  .cc-payout-filter-control {
    position: relative;
    display: inline-flex;
    align-items: center;
  }
  .cc-payout-select {
    height: 38px;
    padding: 0 12px 0 32px;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    background: #fff;
    font-size: 12.5px;
    font-weight: 500;
    color: #1e293b;
    outline: none;
    cursor: pointer;
  }
  .cc-payout-select.highlight {
    background: #f0fdf4;
    border-color: #86efac;
    color: #047857;
    font-weight: 600;
    padding-left: 12px;
  }
  .cc-payout-date-range-inputs {
    display: inline-flex;
    align-items: center;
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 9px;
    padding: 2px 8px;
    height: 38px;
  }
  .cc-payout-date-input {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 3px 6px;
    font-size: 12px;
    outline: none;
    background: #fff;
  }
  .cc-payout-clear-filters-btn {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    padding: 0 12px;
    height: 38px;
    border-radius: 9px;
    background: #fef2f2;
    color: #be123c;
    border: 1px solid #fecdd3;
    font-size: 12px;
    font-weight: 600;
    cursor: pointer;
  }
  .cc-payout-icon-refresh {
    border: 1px solid #cbd5e1;
    background: #fff;
    width: 38px;
    height: 38px;
    border-radius: 9px;
    display: grid;
    place-items: center;
    color: #475569;
    cursor: pointer;
  }

  .cc-payout-status-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 10px;
    gap: 2px;
    overflow-x: auto;
  }
  .cc-payout-status-tabs button {
    border: 0;
    background: transparent;
    padding: 6px 14px;
    border-radius: 8px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
    white-space: nowrap;
  }
  .cc-payout-status-tabs button.active {
    background: #fff;
    color: #0f172a;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.08);
  }
  .cc-payout-status-tabs button.amber-tab.active { background: #d97706; color: #fff; }
  .cc-payout-status-tabs button.green-tab.active { background: #047857; color: #fff; }
  .cc-payout-status-tabs button.blue-tab.active { background: #0284c7; color: #fff; }

  /* Summary Table */
  .cc-payout-summary-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12.5px;
  }
  .cc-payout-summary-table th {
    background: #1e293b;
    color: #f8fafc;
    padding: 10px 12px;
    font-size: 11.5px;
    font-weight: 700;
    text-align: left;
    white-space: nowrap;
    border-right: 1px solid #334155;
  }
  .cc-payout-summary-table td {
    padding: 11px 12px;
    border-bottom: 1px solid #f1f5f9;
    border-right: 1px solid #f8fafc;
    vertical-align: middle;
  }
  .cc-payout-table-row {
    cursor: pointer;
    transition: background 0.1s;
  }
  .cc-payout-table-row:hover {
    background: #f8fafc;
  }
  .cc-payout-total-row td {
    background: #f1f5f9;
    font-weight: 700;
    border-top: 2px solid #cbd5e1;
    border-bottom: 2px solid #cbd5e1;
  }

  .cc-party-dot {
    width: 9px;
    height: 9px;
    border-radius: 50%;
    flex-shrink: 0;
  }
  .cc-party-code-tag {
    font-family: monospace;
    font-size: 11.5px;
    font-weight: 700;
    background: #f1f5f9;
    color: #334155;
    padding: 2px 7px;
    border-radius: 5px;
    border: 1px solid #e2e8f0;
  }
  .cc-party-code-tag.header {
    background: #e0f2fe;
    color: #0369a1;
    border-color: #bae6fd;
    font-size: 13px;
  }
  .cc-party-code-tag.total { background: #e2e8f0; }

  .cc-case-count-tag {
    display: inline-flex;
    justify-content: center;
    align-items: center;
    min-width: 24px;
    height: 24px;
    border-radius: 999px;
    background: #eff6ff;
    color: #1d4ed8;
    font-weight: 700;
    font-size: 11.5px;
  }

  .cc-val-badge {
    display: inline-block;
    padding: 3px 8px;
    border-radius: 6px;
    font-weight: 700;
    font-size: 12px;
  }
  .cc-val-badge.payable {
    background: #fef3c7;
    color: #b45309;
    border: 1px solid #fde68a;
  }
  .cc-val-badge.advance {
    background: #e0f2fe;
    color: #0369a1;
    border: 1px solid #bae6fd;
  }
  .cc-val-badge.zero {
    background: #f1f5f9;
    color: #94a3b8;
  }

  .cc-status-pill {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 3px 8px;
    border-radius: 999px;
    font-size: 11px;
    font-weight: 700;
  }
  .cc-status-pill.green { background: #ecfdf5; color: #047857; border: 1px solid #10b981; }
  .cc-status-pill.amber { background: #fffbeb; color: #b45309; border: 1px solid #fcd34d; }
  .cc-status-pill.blue { background: #f0f9ff; color: #0284c7; border: 1px solid #7dd3fc; }
  .cc-status-pill.gray { background: #f1f5f9; color: #64748b; }

  .cc-payout-row-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 4px 9px;
    border-radius: 6px;
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #475569;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
  }
  .cc-payout-row-btn:hover { background: #f8fafc; color: #0f172a; }
  .cc-payout-row-btn.pay { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .cc-payout-row-btn.pay:hover { background: #047857; color: #fff; }

  /* Drawer */
  .cc-drawer-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.45);
    backdrop-filter: blur(2px);
    z-index: 9999;
    display: flex;
    justify-content: flex-end;
  }
  .cc-payout-drawer {
    width: 100%;
    max-width: 860px;
    background: #fff;
    height: 100vh;
    display: flex;
    flex-direction: column;
    box-shadow: -10px 0 30px rgba(0, 0, 0, 0.18);
  }
  .cc-drawer-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 20px 24px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .cc-drawer-header h2 { margin: 0; font-size: 20px; font-weight: 800; color: #0f172a; }
  .cc-drawer-header p { margin: 4px 0 0; font-size: 12.5px; color: #64748b; }
  .cc-drawer-close {
    border: 0;
    background: #e2e8f0;
    color: #475569;
    width: 32px;
    height: 32px;
    border-radius: 8px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .cc-drawer-body {
    flex: 1;
    overflow-y: auto;
    padding: 20px 24px;
  }

  .cc-ledger-balance-box {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
    padding: 12px 16px;
  }
  .cc-lbox-item small { display: block; font-size: 11px; color: #64748b; font-weight: 600; text-transform: uppercase; }
  .cc-lbox-item strong { font-size: 16px; font-weight: 800; color: #0f172a; }
  .cc-lbox-item.highlight { background: #fffbeb; padding: 4px 8px; border-radius: 6px; border: 1px solid #fde68a; }

  .cc-ledger-nav-tabs {
    display: inline-flex;
    background: #f1f5f9;
    padding: 3px;
    border-radius: 9px;
    gap: 2px;
  }
  .cc-ledger-nav-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 5px;
    border: 0;
    background: transparent;
    padding: 6px 12px;
    border-radius: 7px;
    font-size: 12px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
  }
  .cc-ledger-nav-tabs button.active {
    background: #fff;
    color: #047857;
    box-shadow: 0 1px 2px rgba(15, 23, 42, 0.08);
  }

  .cc-ledger-table-wrap {
    overflow-x: auto;
    border: 1px solid #e2e8f0;
    border-radius: 10px;
  }
  .cc-ledger-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
  }
  .cc-ledger-table th {
    background: #f8fafc;
    color: #475569;
    padding: 9px 12px;
    font-size: 11px;
    font-weight: 700;
    text-align: left;
    border-bottom: 1px solid #e2e8f0;
    white-space: nowrap;
  }
  .cc-ledger-table td {
    padding: 10px 12px;
    border-bottom: 1px solid #f1f5f9;
    vertical-align: middle;
  }
  .cc-ledger-bank-tag {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    font-size: 11.5px;
    color: #4338ca;
    font-weight: 600;
  }
  .cc-ledger-pay-btn {
    border: 1px solid #a7f3d0;
    background: #ecfdf5;
    color: #047857;
    padding: 4px 8px;
    border-radius: 6px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
  }
  .cc-ledger-pay-btn:hover { background: #047857; color: #fff; }

  .cc-tx-type {
    display: inline-block;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
  }
  .cc-tx-type.settlement { background: #ecfdf5; color: #047857; }
  .cc-tx-type.advance { background: #e0f2fe; color: #0284c7; }
  .cc-tx-type.refund { background: #fef2f2; color: #b91c1c; }
  .cc-tx-mode { font-size: 11px; font-weight: 600; color: #475569; }

  .cc-ledger-del-btn {
    border: 0;
    background: #fef2f2;
    color: #b91c1c;
    width: 26px;
    height: 26px;
    border-radius: 6px;
    display: grid;
    place-items: center;
    cursor: pointer;
  }
  .cc-ledger-del-btn:hover { background: #fee2e2; }

  /* Payment Modal */
  .cc-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.5);
    backdrop-filter: blur(2px);
    z-index: 10000;
    display: grid;
    place-items: center;
    padding: 16px;
  }
  .cc-payment-modal {
    width: 100%;
    max-width: 520px;
    background: #fff;
    border-radius: 14px;
    box-shadow: 0 20px 40px rgba(0, 0, 0, 0.2);
    overflow: hidden;
  }
  .cc-pmodal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 18px 20px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .cc-pmodal-header h3 { margin: 0; font-size: 17px; font-weight: 800; color: #0f172a; }
  .cc-pmodal-header p { margin: 3px 0 0; font-size: 12px; color: #64748b; }
  .cc-pmodal-close { border: 0; background: #e2e8f0; color: #475569; width: 28px; height: 28px; border-radius: 6px; display: grid; place-items: center; cursor: pointer; }

  .cc-pmodal-form { padding: 20px; display: flex; flex-direction: column; gap: 14px; }
  .cc-form-group { display: flex; flex-direction: column; gap: 5px; }
  .cc-form-group label { font-size: 12px; font-weight: 600; color: #334155; }
  .cc-form-group input, .cc-form-group select, .cc-form-group textarea {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 12px;
    font-size: 13px;
    outline: none;
    color: #0f172a;
    background: #fff;
  }
  .cc-form-group input:focus, .cc-form-group select:focus, .cc-form-group textarea:focus {
    border-color: #047857;
    box-shadow: 0 0 0 2px rgba(4, 120, 87, 0.15);
  }
  .cc-form-row { display: grid; grid-template-columns: 1fr 1fr; gap: 12px; }

  .cc-ptype-selector {
    display: grid;
    grid-template-columns: repeat(3, 1fr);
    gap: 8px;
  }
  .cc-ptype-option {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 8px 6px;
    text-align: center;
    font-size: 11px;
    font-weight: 600;
    color: #475569;
    cursor: pointer;
    background: #f8fafc;
    transition: all 0.1s;
    display: flex;
    align-items: center;
    justify-content: center;
  }
  .cc-ptype-option input { display: none; }
  .cc-ptype-option.active {
    background: #ecfdf5;
    border-color: #10b981;
    color: #047857;
    font-weight: 700;
  }
  .cc-pmodal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
    padding-top: 14px;
    border-top: 1px solid #f1f5f9;
  }

  /* Subtabs & search box inside Drawer */
  .cc-lead-subtab-btn {
    border: 1px solid #cbd5e1;
    background: #fff;
    color: #475569;
    padding: 4px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    cursor: pointer;
    transition: all 0.15s;
  }
  .cc-lead-subtab-btn:hover {
    background: #f1f5f9;
  }
  .cc-lead-subtab-btn.active {
    background: #047857;
    border-color: #047857;
    color: #fff;
  }
  .cc-drawer-search-box {
    position: relative;
    display: flex;
    align-items: center;
    border: 1px solid #cbd5e1;
    border-radius: 7px;
    padding: 4px 8px;
    background: #fff;
    width: 260px;
  }
  .cc-drawer-search-box input {
    border: 0 !important;
    outline: none !important;
    font-size: 12px !important;
    width: 100% !important;
    margin-left: 6px !important;
    color: #0f172a !important;
    padding: 0 !important;
  }
  .cc-lead-status-pill {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
    text-transform: uppercase;
  }
  .cc-lead-status-pill.disbursed {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
  }
  .cc-lead-status-pill.pending {
    background: #fffbeb;
    color: #b45309;
    border: 1px solid #fde68a;
  }

  /* Searchable Lead Picker in Payment Modal */
  .cc-modal-lead-picker {
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    overflow: hidden;
    background: #fff;
  }
  .cc-modal-lead-search {
    display: flex;
    align-items: center;
    padding: 6px 10px;
    border-bottom: 1px solid #e2e8f0;
    background: #f8fafc;
  }
  .cc-modal-lead-search input {
    border: 0 !important;
    background: transparent !important;
    font-size: 12px !important;
    padding: 2px 6px !important;
    width: 100% !important;
    box-shadow: none !important;
  }
  .cc-modal-lead-list {
    max-height: 180px;
    overflow-y: auto;
    display: flex;
    flex-direction: column;
  }
  .cc-modal-lead-item {
    display: flex;
    justify-content: space-between;
    align-items: center;
    padding: 8px 12px;
    border-bottom: 1px solid #f1f5f9;
    cursor: pointer;
    transition: background 0.1s;
  }
  .cc-modal-lead-item:hover {
    background: #f8fafc;
  }
  .cc-modal-lead-item.active {
    background: #ecfdf5;
    border-left: 3px solid #047857;
  }
  .cc-item-lead-id {
    display: inline-block;
    background: #e2e8f0;
    color: #334155;
    padding: 1px 5px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
  }
  .cc-lead-mini-tag {
    display: inline-block;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 9.5px;
    font-weight: 700;
  }
  .cc-lead-mini-tag.disbursed { background: #dcfce7; color: #15803d; }
  .cc-lead-mini-tag.pending { background: #fef3c7; color: #b45309; }

  .cc-selected-lead-card {
    border: 1px solid #93c5fd;
    background: #eff6ff;
    padding: 10px 14px;
    border-radius: 8px;
  }
  .cc-lead-id-tag {
    background: #bfdbfe;
    color: #1e40af;
    font-size: 11px;
    font-weight: 800;
    padding: 1px 6px;
    border-radius: 4px;
  }
`;
