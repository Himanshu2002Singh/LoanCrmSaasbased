import React, { useCallback, useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  ArrowDownLeft,
  ArrowRight,
  ArrowUpRight,
  Building2,
  Calendar,
  CalendarDays,
  CheckCircle2,
  Clock,
  Coins,
  CreditCard,
  Download,
  Edit3,
  Eye,
  FileCheck,
  FileSpreadsheet,
  FileText,
  Filter,
  IndianRupee,
  Layers,
  Link as LinkIcon,
  MinusCircle,
  Percent,
  Plus,
  Printer,
  Receipt,
  RefreshCw,
  Search,
  Send,
  Share2,
  Sliders,
  TrendingUp,
  Upload,
  User,
  Wallet,
  Wrench,
  X,
} from "lucide-react";
import API_URL from "../../config";

const currencyFormatter = new Intl.NumberFormat("en-IN", {
  style: "currency",
  currency: "INR",
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat("en-IN", {
  maximumFractionDigits: 0,
});

export default function CasePayoutsScreen() {
  const userRole = (localStorage.getItem("userRole") || "").toUpperCase();
  const employeeRole = (localStorage.getItem("employeeRole") || "").toLowerCase();
  const isCompanyAdmin =
    ["COMPANY_ADMIN", "SUPERADMIN"].includes(userRole) ||
    ["admin", "superadmin"].includes(employeeRole);

  const userPermissions = useMemo(() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  }, []);

  const canManagePayouts =
    isCompanyAdmin ||
    ["FINANCE", "OPS"].includes(userRole) ||
    Boolean(userPermissions.managePayouts);

  // Main Tab: "cases" (Disbursed Case Payouts) | "journal" (Payment Ledger matching sheet)
  const [activeMainTab, setActiveMainTab] = useState("cases");

  // Add Payout Modal State
  const [addPayoutModalOpen, setAddPayoutModalOpen] = useState(false);
  const [savingNewPayout, setSavingNewPayout] = useState(false);
  const [leadsList, setLeadsList] = useState([]);
  const [loadingLeads, setLoadingLeads] = useState(false);
  const [selectedLeadId, setSelectedLeadId] = useState("");
  const [addForm, setAddForm] = useState({
    leadId: "",
    customerName: "",
    customerMobile: "",
    customerEmail: "",
    loanProduct: "Personal Loan",
    bankName: "HDFC Bank",
    loanAmount: "",
    bankCommissionPercent: 2.0,
    baseAmount: "",
    bankGstPercent: 18,
    bankGstAmount: 0,
    bankTdsPercent: 5,
    bankTdsAmount: 0,
    bankNetReceivable: 0,
    disbursalDate: new Date().toISOString().split("T")[0],
    payoutType: "VENDOR",
    partyName: "Direct",
    partyCode: "",
    partyCommissionPercent: 50.0,
    partyCommissionDue: 0,
    extraCharges: 0,
    partyNetPayable: 0,
    netMargin: 0,
    notes: "",
  });
  const [loanProductsList, setLoanProductsList] = useState([]);

  // Excel Bulk Upload Modal State
  const [bulkUploadModalOpen, setBulkUploadModalOpen] = useState(false);
  const [bulkUploadedFile, setBulkUploadedFile] = useState(null);
  const [bulkParsedRows, setBulkParsedRows] = useState([]);
  const [isReadingExcel, setIsReadingExcel] = useState(false);
  const [isSubmittingBulk, setIsSubmittingBulk] = useState(false);
  const [bulkImportResult, setBulkImportResult] = useState(null);

  // Cases List State
  const [cases, setCases] = useState([]);
  const [grandTotals, setGrandTotals] = useState({
    totalCases: 0,
    totalLoanVolume: 0,
    totalDisbursedVolume: 0,
    totalBaseAmount: 0,
    totalBankCommissionDue: 0,
    totalBankReceived: 0,
    totalBankRemainingDue: 0,
    totalPartyCommissionDue: 0,
    totalPartyTds: 0,
    totalPartyGst: 0,
    totalExtraCharges: 0,
    totalPartyNetPayable: 0,
    totalPartyPaid: 0,
    totalPartyRemainingDue: 0,
    totalNetMargin: 0,
  });
  const [loading, setLoading] = useState(true);

  // Journal List State
  const [journalEntries, setJournalEntries] = useState([]);
  const [journalTotals, setJournalTotals] = useState({
    totalEntries: 0,
    totalDebit: 0,
    totalCredit: 0,
    totalNetCashOut: 0,
    finalBalance: 0,
  });
  const [journalLoading, setJournalLoading] = useState(false);

  // Filter States
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterPeriodType, setFilterPeriodType] = useState("all"); // "all" | "month" | "fy" | "custom"
  const [selectedMonth, setSelectedMonth] = useState("");
  const [selectedFY, setSelectedFY] = useState("");
  const [customFromDate, setCustomFromDate] = useState("");
  const [customToDate, setCustomToDate] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL"); // "ALL" | "BANK_DUE" | "PARTY_DUE" | "SETTLED"
  const [bankFilter, setBankFilter] = useState("");
  const [partyFilter, setPartyFilter] = useState("");

  // Modals State
  const [editModalOpen, setEditModalOpen] = useState(false);
  const [editingCase, setEditingCase] = useState(null);
  const [editForm, setEditForm] = useState({
    loanAmount: "",
    bankCommissionPercent: "",
    baseAmount: "",
    disbursalDate: "",
    bankGstPercent: 18,
    bankTdsPercent: 5,
    partyCommissionPercent: "",
    partyCommissionDue: "",
    partyTdsPercent: 0,
    partyTdsAmount: 0,
    partyGstPercent: 0,
    partyGstAmount: 0,
    extraCharges: 0,
    partyNetPayable: "",
    invoiceNumber: "",
    invoiceDate: "",
    notes: "",
  });
  const [savingEdit, setSavingEdit] = useState(false);

  // Bank Receipt Modal
  const [bankReceiptModalOpen, setBankReceiptModalOpen] = useState(false);
  const [receiptTargetCase, setReceiptTargetCase] = useState(null);
  const [receiptForm, setReceiptForm] = useState({
    grossAmount: "",
    gstAmount: "",
    tdsAmount: "",
    receiptDate: new Date().toISOString().split("T")[0],
    paymentMode: "NEFT",
    referenceNumber: "",
    notes: "",
  });
  const [recordingReceipt, setRecordingReceipt] = useState(false);

  // Party Payout Modal
  const [partyPayoutModalOpen, setPartyPayoutModalOpen] = useState(false);
  const [payoutTargetCase, setPayoutTargetCase] = useState(null);
  const [payoutForm, setPayoutForm] = useState({
    amount: "",
    paymentDate: new Date().toISOString().split("T")[0],
    paymentMode: "BANK_TRANSFER",
    referenceNumber: "",
    notes: "",
  });
  const [recordingPartyPayout, setRecordingPartyPayout] = useState(false);

  // Invoice Modal
  const [invoiceModalOpen, setInvoiceModalOpen] = useState(false);
  const [invoiceData, setInvoiceData] = useState(null);
  const [invoiceLoading, setInvoiceLoading] = useState(false);
  const [invoiceViewType, setInvoiceViewType] = useState("BANK"); // "BANK" | "CONNECTOR"

  // GSTR Reflection Modal
  const [gstrModalOpen, setGstrModalOpen] = useState(false);
  const [gstrTargetCase, setGstrTargetCase] = useState(null);
  const [gstrForm, setGstrForm] = useState({
    gstrStatus: "PENDING",
    gstrAmount: 0,
    gstrReceivedAmount: 0,
    notes: "",
  });
  const [savingGstr, setSavingGstr] = useState(false);

  // Payment History Modal
  const [paymentHistoryModalOpen, setPaymentHistoryModalOpen] = useState(false);
  const [historyTargetCase, setHistoryTargetCase] = useState(null);
  const [historyData, setHistoryData] = useState(null);
  const [loadingHistory, setLoadingHistory] = useState(false);
  const [historyTab, setHistoryTab] = useState("ALL"); // "ALL" | "BANK" | "PARTY"

  // Financial Years
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

  // Available Months
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

  // Debounce search
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedSearch(searchTerm), 300);
    return () => clearTimeout(timer);
  }, [searchTerm]);

  useEffect(() => {
    axios
      .get(`${API_URL}/master-configs/LOAN_PRODUCT`, { params: { includeInactive: false } })
      .then((res) => setLoanProductsList(res.data?.data || []))
      .catch(() => setLoanProductsList([]));
  }, []);

  // Fetch Disbursed Case Payouts
  const fetchCasePayouts = useCallback(async () => {
    setLoading(true);
    try {
      const params = {
        search: debouncedSearch || undefined,
        fromDate: filterPeriodType === "custom" && customFromDate ? customFromDate : undefined,
        toDate: filterPeriodType === "custom" && customToDate ? customToDate : undefined,
        month: filterPeriodType === "month" && selectedMonth ? selectedMonth : undefined,
        financialYear: filterPeriodType === "fy" && selectedFY ? selectedFY : undefined,
        bankName: bankFilter || undefined,
        partyName: partyFilter || undefined,
        status: statusFilter !== "ALL" ? statusFilter : undefined,
      };

      const res = await axios.get(`${API_URL}/payouts/cases`, { params });
      setCases(res.data?.cases || []);
      setGrandTotals(
        res.data?.grandTotals || {
          totalCases: 0,
          totalLoanVolume: 0,
          totalDisbursedVolume: 0,
          totalBaseAmount: 0,
          totalBankCommissionDue: 0,
          totalBankReceived: 0,
          totalBankRemainingDue: 0,
          totalPartyCommissionDue: 0,
          totalPartyTds: 0,
          totalPartyGst: 0,
          totalExtraCharges: 0,
          totalPartyNetPayable: 0,
          totalPartyPaid: 0,
          totalPartyRemainingDue: 0,
          totalNetMargin: 0,
        }
      );
    } catch (err) {
      console.error("Error fetching case payouts:", err);
      toast.error(err.response?.data?.message || "Could not load case payouts");
      setCases([]);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    filterPeriodType,
    customFromDate,
    customToDate,
    selectedMonth,
    selectedFY,
    bankFilter,
    partyFilter,
    statusFilter,
  ]);

  // Fetch Payment Journal (Ledger)
  const fetchPaymentJournal = useCallback(async () => {
    setJournalLoading(true);
    try {
      const params = {
        search: debouncedSearch || undefined,
        fromDate: filterPeriodType === "custom" && customFromDate ? customFromDate : undefined,
        toDate: filterPeriodType === "custom" && customToDate ? customToDate : undefined,
        month: filterPeriodType === "month" && selectedMonth ? selectedMonth : undefined,
        financialYear: filterPeriodType === "fy" && selectedFY ? selectedFY : undefined,
        partyName: partyFilter || undefined,
      };
      const res = await axios.get(`${API_URL}/payouts/journal`, { params });
      setJournalEntries(res.data?.journal || []);
      setJournalTotals(
        res.data?.totals || {
          totalEntries: 0,
          totalDebit: 0,
          totalCredit: 0,
          totalNetCashOut: 0,
          finalBalance: 0,
        }
      );
    } catch (err) {
      console.error("Error fetching payment journal:", err);
      toast.error("Could not load payment journal");
    } finally {
      setJournalLoading(false);
    }
  }, [
    debouncedSearch,
    filterPeriodType,
    customFromDate,
    customToDate,
    selectedMonth,
    selectedFY,
    partyFilter,
  ]);

  useEffect(() => {
    if (activeMainTab === "cases") {
      fetchCasePayouts();
    } else {
      fetchPaymentJournal();
    }
  }, [activeMainTab, fetchCasePayouts, fetchPaymentJournal]);

  // Unique Banks & Parties for Filter Dropdowns
  const uniqueBanks = useMemo(() => {
    const set = new Set();
    cases.forEach((c) => {
      if (c.bankName) set.add(c.bankName);
    });
    return Array.from(set);
  }, [cases]);

  const uniqueParties = useMemo(() => {
    const set = new Set();
    cases.forEach((c) => {
      if (c.partyName) set.add(c.partyName);
    });
    return Array.from(set);
  }, [cases]);

  // Open Edit Rates & Deductions Modal
  const openEditModal = (item) => {
    setEditingCase(item);
    const loanAmt = item.loanAmount !== undefined && item.loanAmount !== null ? parseFloat(item.loanAmount) : 0;
    const bankPct = item.bankCommissionPercent !== undefined && item.bankCommissionPercent !== null ? parseFloat(item.bankCommissionPercent) : 2.0;
    const baseAmt = item.baseAmount !== undefined && item.baseAmount !== null ? parseFloat(item.baseAmount) : Math.round((loanAmt * bankPct) / 100);

    // Corporate DSA Charge deducted from Gross Bank Commission Base:
    const corpDsaPct = item.corporateDsaPercent !== undefined && item.corporateDsaPercent !== null ? parseFloat(item.corporateDsaPercent) : 0.0;
    const corpDsaAmt = item.corporateDsaAmount !== undefined && item.corporateDsaAmount !== null ? parseFloat(item.corporateDsaAmount) : Math.round((baseAmt * corpDsaPct) / 100);
    // Actual Amount after Corporate DSA Charge:
    const actualAmt = item.actualAmount !== undefined && item.actualAmount !== null && parseFloat(item.actualAmount) > 0 ? parseFloat(item.actualAmount) : Math.max(0, baseAmt - corpDsaAmt);

    const bGstPct = item.bankGstPercent !== undefined && item.bankGstPercent !== null ? parseFloat(item.bankGstPercent) : 18;
    const bGstAmt = item.bankGstAmount !== undefined && item.bankGstAmount !== null ? parseFloat(item.bankGstAmount) : Math.round((actualAmt * bGstPct) / 100);
    const bTdsPct = item.bankTdsPercent !== undefined && item.bankTdsPercent !== null ? parseFloat(item.bankTdsPercent) : 5;
    const bTdsAmt = item.bankTdsAmount !== undefined && item.bankTdsAmount !== null ? parseFloat(item.bankTdsAmount) : Math.round((actualAmt * bTdsPct) / 100);

    // Bank Net Receivable = Actual Amount - bTdsAmt (GST is separate, NOT subtracted from net receivable!)
    const bankNet = Math.max(0, actualAmt - bTdsAmt);

    const isSelfCase =
      item.payoutType === "SELF" ||
      (item.partyName || "").toLowerCase() === "self" ||
      (item.partyName || "").toLowerCase() === "direct";

    const pType = isSelfCase ? "SELF" : "VENDOR";

    const partyPct = item.partyCommissionPercent !== undefined && item.partyCommissionPercent !== null ? parseFloat(item.partyCommissionPercent) : (isSelfCase ? 0 : 50.0);
    const partyGross = isSelfCase ? 0 : (item.partyCommissionDue !== undefined && item.partyCommissionDue !== null ? parseFloat(item.partyCommissionDue) : Math.round((baseAmt * partyPct) / 100));

    const tdsPct = isSelfCase ? 0 : (item.partyTdsPercent !== undefined && item.partyTdsPercent !== null ? parseFloat(item.partyTdsPercent) : 0);
    const tdsAmt = isSelfCase ? 0 : (item.partyTdsAmount !== undefined && item.partyTdsAmount !== null ? parseFloat(item.partyTdsAmount) : Math.round((partyGross * tdsPct) / 100));
    const gstPct = isSelfCase ? 0 : (item.partyGstPercent !== undefined && item.partyGstPercent !== null ? parseFloat(item.partyGstPercent) : 0);
    const gstAmt = isSelfCase ? 0 : (item.partyGstAmount !== undefined && item.partyGstAmount !== null ? parseFloat(item.partyGstAmount) : Math.round((partyGross * gstPct) / 100));
    const extra = item.extraCharges !== undefined && item.extraCharges !== null ? parseFloat(item.extraCharges) : 0;
    const netPayable = isSelfCase ? 0 : (item.partyNetPayable !== undefined && item.partyNetPayable !== null ? parseFloat(item.partyNetPayable) : Math.max(0, partyGross - tdsAmt - gstAmt - extra));
    const margin = Math.round(bankNet - (isSelfCase ? 0 : netPayable) - extra);

    setEditForm({
      loanAmount: loanAmt,
      bankCommissionPercent: bankPct,
      baseAmount: baseAmt,
      corporateDsaPercent: corpDsaPct,
      corporateDsaAmount: corpDsaAmt,
      actualAmount: actualAmt,
      disbursalDate: item.disbursalDate || "",
      bankGstPercent: bGstPct,
      bankGstAmount: bGstAmt,
      bankTdsPercent: bTdsPct,
      bankTdsAmount: bTdsAmt,
      bankNetReceivable: bankNet,
      payoutType: pType,
      partyName: isSelfCase ? "Self" : (item.partyName || "Direct"),
      partyCommissionPercent: isSelfCase ? 0 : partyPct,
      partyCommissionDue: partyGross,
      partyTdsPercent: tdsPct,
      partyTdsAmount: tdsAmt,
      partyGstPercent: gstPct,
      partyGstAmount: gstAmt,
      extraCharges: extra,
      partyNetPayable: netPayable,
      netMargin: margin,
      gstrStatus: item.gstrStatus || "PENDING",
      gstrAmount: parseFloat(item.gstrAmount || bGstAmt),
      gstrReceivedAmount: parseFloat(item.gstrReceivedAmount || 0),
      invoiceNumber: item.invoiceNumber || "",
      invoiceDate: item.invoiceDate || "",
      notes: item.notes || "",
    });
    setEditModalOpen(true);
  };

  // Centralized real-time recalculator for edit modal
  const recomputeEditForm = (updates) => {
    setEditForm((prev) => {
      const merged = { ...prev, ...updates };

      const loan = parseFloat(merged.loanAmount) || 0;
      const bankPct = parseFloat(merged.bankCommissionPercent) || 0;

      // 1. Bank Gross Base Commission
      let base = parseFloat(merged.baseAmount) || 0;
      if (updates.loanAmount !== undefined || updates.bankCommissionPercent !== undefined || merged.baseAmount === "" || merged.baseAmount === undefined) {
        base = Math.round((loan * bankPct) / 100);
      } else if (updates.baseAmount !== undefined) {
        base = parseFloat(updates.baseAmount) || 0;
      }

      // 2. Corporate DSA Charge (%) and Amount (₹)
      const corpDsaPct = parseFloat(merged.corporateDsaPercent) || 0;
      let corpDsaAmt = parseFloat(merged.corporateDsaAmount) || 0;
      if (updates.corporateDsaPercent !== undefined || updates.loanAmount !== undefined || updates.bankCommissionPercent !== undefined || updates.baseAmount !== undefined) {
        corpDsaAmt = Math.round((base * corpDsaPct) / 100);
      } else if (updates.corporateDsaAmount !== undefined) {
        corpDsaAmt = parseFloat(updates.corporateDsaAmount) || 0;
      }

      // 3. Actual Amount after Corporate DSA Charge
      const actualAmt = Math.max(0, base - corpDsaAmt);

      // 4. On this Actual Amount, calculate Bank TDS and GST:
      const bGstPct = parseFloat(merged.bankGstPercent) || 0;
      let bGstAmt = parseFloat(merged.bankGstAmount) || 0;
      if (updates.bankGstPercent !== undefined || updates.baseAmount !== undefined || updates.loanAmount !== undefined || updates.bankCommissionPercent !== undefined || updates.corporateDsaPercent !== undefined || updates.corporateDsaAmount !== undefined) {
        bGstAmt = Math.round((actualAmt * bGstPct) / 100);
      } else if (updates.bankGstAmount !== undefined) {
        bGstAmt = parseFloat(updates.bankGstAmount) || 0;
      }

      const bTdsPct = parseFloat(merged.bankTdsPercent) || 0;
      let bTdsAmt = parseFloat(merged.bankTdsAmount) || 0;
      if (updates.bankTdsPercent !== undefined || updates.baseAmount !== undefined || updates.loanAmount !== undefined || updates.bankCommissionPercent !== undefined || updates.corporateDsaPercent !== undefined || updates.corporateDsaAmount !== undefined) {
        bTdsAmt = Math.round((actualAmt * bTdsPct) / 100);
      } else if (updates.bankTdsAmount !== undefined) {
        bTdsAmt = parseFloat(updates.bankTdsAmount) || 0;
      }

      // 5. Final Bank Net Receivable: Actual Amount - bTdsAmt (GST is separate, NOT subtracted from net!)
      const bankNet = Math.max(0, actualAmt - bTdsAmt);

      // 6. Payout Mode: SELF vs VENDOR
      const isSelf = merged.payoutType === "SELF";
      const manpower = parseFloat(merged.extraCharges) || 0;

      let pPct = 0;
      let partyGross = 0;
      let pTdsPct = 0;
      let pTdsAmt = 0;
      let pGstPct = 0;
      let pGstAmt = 0;
      let partyNet = 0;

      if (isSelf) {
        pPct = 0;
        partyGross = 0;
        partyNet = 0;
      } else {
        pPct = parseFloat(merged.partyCommissionPercent) || 0;
        partyGross = Math.round((base * pPct) / 100);

        pTdsPct = parseFloat(merged.partyTdsPercent) || 0;
        pTdsAmt = parseFloat(merged.partyTdsAmount) || 0;
        if (updates.partyTdsPercent !== undefined || updates.partyCommissionPercent !== undefined || updates.baseAmount !== undefined || updates.loanAmount !== undefined) {
          pTdsAmt = Math.round((partyGross * pTdsPct) / 100);
        } else if (updates.partyTdsAmount !== undefined) {
          pTdsAmt = parseFloat(updates.partyTdsAmount) || 0;
        }

        pGstPct = parseFloat(merged.partyGstPercent) || 0;
        pGstAmt = parseFloat(merged.partyGstAmount) || 0;
        if (updates.partyGstPercent !== undefined || updates.partyCommissionPercent !== undefined || updates.baseAmount !== undefined || updates.loanAmount !== undefined) {
          pGstAmt = Math.round((partyGross * pGstPct) / 100);
        } else if (updates.partyGstAmount !== undefined) {
          pGstAmt = parseFloat(updates.partyGstAmount) || 0;
        }

        partyNet = Math.max(0, partyGross - pTdsAmt - pGstAmt - manpower);
      }

      const margin = Math.round(bankNet - (isSelf ? 0 : partyNet) - manpower);

      return {
        ...merged,
        baseAmount: base,
        corporateDsaPercent: corpDsaPct,
        corporateDsaAmount: corpDsaAmt,
        actualAmount: actualAmt,
        bankGstAmount: bGstAmt,
        bankTdsAmount: bTdsAmt,
        bankNetReceivable: bankNet,
        partyCommissionPercent: pPct,
        partyCommissionDue: partyGross,
        partyTdsPercent: pTdsPct,
        partyTdsAmount: pTdsAmt,
        partyGstPercent: pGstPct,
        partyGstAmount: pGstAmt,
        partyNetPayable: partyNet,
        netMargin: margin,
        gstrAmount: bGstAmt,
      };
    });
  };

  // Submit Rate Edit
  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingCase) return;
    setSavingEdit(true);
    try {
      await axios.put(`${API_URL}/payouts/cases/${editingCase.id}`, editForm);
      toast.success("Case rates, credit base & deductions updated successfully!");
      setEditModalOpen(false);
      fetchCasePayouts();
    } catch (err) {
      console.error("Error updating case rates:", err);
      toast.error(err.response?.data?.message || "Failed to update case rates");
    } finally {
      setSavingEdit(false);
    }
  };

  // Open Add Payout Modal
  const openAddPayoutModal = async () => {
    const today = new Date().toISOString().split("T")[0];
    const initialForm = {
      leadId: "",
      customerName: "",
      customerMobile: "",
      customerEmail: "",
      loanProduct: "Personal Loan",
      bankName: "HDFC Bank",
      loanAmount: "",
      bankCommissionPercent: 2.0,
      baseAmount: "",
      corporateDsaPercent: 0,
      corporateDsaAmount: 0,
      actualAmount: 0,
      bankGstPercent: 18,
      bankGstAmount: 0,
      bankTdsPercent: 5,
      bankTdsAmount: 0,
      bankNetReceivable: 0,
      disbursalDate: today,
      payoutType: "VENDOR",
      partyName: "Direct",
      partyCode: "",
      partyCommissionPercent: 50.0,
      partyCommissionDue: 0,
      extraCharges: 0,
      partyNetPayable: 0,
      netMargin: 0,
      notes: "",
    };
    setAddForm(initialForm);
    setSelectedLeadId("");
    setAddPayoutModalOpen(true);

    try {
      setLoadingLeads(true);
      const res = await axios.get(`${API_URL}/leads`, { params: { limit: 150 } });
      const rawLeads = res.data?.leads || res.data?.data || [];
      setLeadsList(rawLeads);
    } catch (err) {
      console.warn("Could not prefetch leads list:", err);
    } finally {
      setLoadingLeads(false);
    }
  };

  // Real-time calculation helper for Add Modal
  const recomputeAddForm = (updates) => {
    setAddForm((prev) => {
      const merged = { ...prev, ...updates };
      const loan = parseFloat(merged.loanAmount) || 0;
      const bankPct = parseFloat(merged.bankCommissionPercent) || 0;

      // 1. Bank Gross Base Commission
      let base = 0;
      if (
        updates.loanAmount !== undefined ||
        updates.bankCommissionPercent !== undefined ||
        merged.baseAmount === "" ||
        merged.baseAmount === undefined
      ) {
        base = Math.round((loan * bankPct) / 100);
      } else if (updates.baseAmount !== undefined) {
        base = parseFloat(updates.baseAmount) || 0;
      } else {
        base = parseFloat(merged.baseAmount) || Math.round((loan * bankPct) / 100);
      }

      // 2. Corporate DSA Charge (%) and Amount (₹)
      const corpDsaPct = parseFloat(merged.corporateDsaPercent) || 0;
      let corpDsaAmt = parseFloat(merged.corporateDsaAmount) || 0;
      if (updates.corporateDsaPercent !== undefined || updates.loanAmount !== undefined || updates.bankCommissionPercent !== undefined || updates.baseAmount !== undefined) {
        corpDsaAmt = Math.round((base * corpDsaPct) / 100);
      } else if (updates.corporateDsaAmount !== undefined) {
        corpDsaAmt = parseFloat(updates.corporateDsaAmount) || 0;
      }

      // 3. Actual Amount after Corporate DSA Charge
      const actualAmt = Math.max(0, base - corpDsaAmt);

      // 4. On this Actual Amount, calculate Bank TDS and GST:
      const bGstPct = parseFloat(merged.bankGstPercent ?? 18) || 0;
      const bGstAmt = Math.round((actualAmt * bGstPct) / 100);

      const bTdsPct = parseFloat(merged.bankTdsPercent ?? 5) || 0;
      const bTdsAmt = Math.round((actualAmt * bTdsPct) / 100);

      // 5. Final Net Receivable = Actual Amount - bTdsAmt (GST is separate, NOT subtracted!)
      const bankNet = Math.max(0, actualAmt - bTdsAmt);

      const isSelf = merged.payoutType === "SELF";
      const manpower = parseFloat(merged.extraCharges) || 0;

      let partyCommPct = isSelf ? 0 : (parseFloat(merged.partyCommissionPercent ?? 50) || 0);
      let partyCommDue = isSelf ? 0 : Math.round((base * partyCommPct) / 100);
      let partyNet = isSelf ? 0 : Math.max(0, partyCommDue - manpower);
      let margin = Math.round(bankNet - (isSelf ? 0 : partyNet) - manpower);

      return {
        ...merged,
        baseAmount: base,
        corporateDsaPercent: corpDsaPct,
        corporateDsaAmount: corpDsaAmt,
        actualAmount: actualAmt,
        bankGstAmount: bGstAmt,
        bankTdsAmount: bTdsAmt,
        bankNetReceivable: bankNet,
        partyCommissionPercent: partyCommPct,
        partyCommissionDue: partyCommDue,
        partyNetPayable: partyNet,
        netMargin: margin,
      };
    });
  };

  // Lead selection auto-filler
  const handleSelectLead = (leadId) => {
    setSelectedLeadId(leadId);
    if (!leadId) {
      recomputeAddForm({ leadId: "" });
      return;
    }
    const lead = leadsList.find((l) => String(l.id) === String(leadId));
    if (!lead) return;

    const custName = lead.customer?.name || lead.name || "";
    const custMobile = lead.customer?.mobile || lead.mobile || "";
    const custEmail = lead.customer?.email || lead.email || "";
    const lType = lead.loanType || "Personal Loan";
    const bName = lead.bank_name || lead.applications?.[0]?.lender?.name || "HDFC Bank";
    const lAmt = parseFloat(lead.sanctioned_amount || lead.requiredAmount || 0) || "";
    const pName = lead.leadSource || "Direct";
    const isSelf = pName.toLowerCase() === "self" || pName.toLowerCase() === "direct";
    const pPct = isSelf ? 0 : (lead.commissionPercent !== null && lead.commissionPercent !== undefined ? parseFloat(lead.commissionPercent) : 50.0);

    recomputeAddForm({
      leadId: lead.id,
      customerName: custName,
      customerMobile: custMobile,
      customerEmail: custEmail,
      loanProduct: lType,
      bankName: bName,
      loanAmount: lAmt,
      payoutType: isSelf ? "SELF" : "VENDOR",
      partyName: pName,
      partyCommissionPercent: pPct,
    });
  };

  // Submit Add Payout
  const handleAddPayoutSubmit = async (e) => {
    e.preventDefault();
    if (!addForm.customerName && !addForm.leadId) {
      toast.error("Please enter Customer Name or choose an existing Lead");
      return;
    }
    const loanAmt = parseFloat(addForm.loanAmount);
    if (!loanAmt || loanAmt <= 0) {
      toast.error("Please enter a valid Loan Disbursed Amount");
      return;
    }

    setSavingNewPayout(true);
    try {
      const payload = {
        leadId: addForm.leadId ? parseInt(addForm.leadId, 10) : undefined,
        customerName: addForm.customerName ? addForm.customerName.trim() : undefined,
        customerMobile: addForm.customerMobile ? String(addForm.customerMobile).trim() : undefined,
        customerEmail: addForm.customerEmail ? addForm.customerEmail.trim() : undefined,
        loanProduct: addForm.loanProduct || "Personal Loan",
        bankName: addForm.bankName || "Bank",
        loanAmount: loanAmt,
        bankCommissionPercent: parseFloat(addForm.bankCommissionPercent) || 2.0,
        baseAmount: addForm.baseAmount ? parseFloat(addForm.baseAmount) : undefined,
        corporateDsaPercent: parseFloat(addForm.corporateDsaPercent) || 0,
        corporateDsaAmount: parseFloat(addForm.corporateDsaAmount) || 0,
        actualAmount: parseFloat(addForm.actualAmount) || 0,
        bankGstPercent: parseFloat(addForm.bankGstPercent) || 18,
        bankTdsPercent: parseFloat(addForm.bankTdsPercent) || 5,
        disbursalDate: addForm.disbursalDate || new Date().toISOString().split("T")[0],
        partyName: addForm.payoutType === "SELF" ? "Self" : (addForm.partyName || "Direct"),
        partyCode: addForm.partyCode || undefined,
        partyCommissionPercent: addForm.payoutType === "SELF" ? 0 : (parseFloat(addForm.partyCommissionPercent) || 0),
        extraCharges: parseFloat(addForm.extraCharges) || 0,
        notes: addForm.notes || undefined,
      };

      const res = await axios.post(`${API_URL}/payouts/cases`, payload);
      toast.success(res.data?.message || "Case payout recorded successfully!");
      setAddPayoutModalOpen(false);
      fetchCasePayouts();
    } catch (err) {
      console.error("Failed to record case payout:", err);
      toast.error(err.response?.data?.message || "Failed to record case payout");
    } finally {
      setSavingNewPayout(false);
    }
  };

  // -------------------------------------------------------------
  // EXCEL BULK UPLOAD & SAMPLE TEMPLATE HANDLERS
  // -------------------------------------------------------------
  const resetBulkUpload = () => {
    setBulkUploadedFile(null);
    setBulkParsedRows([]);
    setBulkImportResult(null);
    setIsReadingExcel(false);
    setIsSubmittingBulk(false);
  };

  // Helper to parse dates from Excel (numeric serials, DD-MM-YYYY, YYYY-MM-DD)
  const parseExcelDate = (val) => {
    if (!val) return new Date().toISOString().split("T")[0];
    if (typeof val === "number") {
      const date = new Date(Math.round((val - 25569) * 86400 * 1000));
      if (!isNaN(date.getTime())) {
        return date.toISOString().split("T")[0];
      }
    }
    const str = String(val).trim();
    const dmyMatch = str.match(/^(\d{1,2})[-/](\d{1,2})[-/](\d{4})$/);
    if (dmyMatch) {
      const day = dmyMatch[1].padStart(2, "0");
      const month = dmyMatch[2].padStart(2, "0");
      const year = dmyMatch[3];
      return `${year}-${month}-${day}`;
    }
    const parsed = new Date(str);
    if (!isNaN(parsed.getTime())) {
      return parsed.toISOString().split("T")[0];
    }
    return new Date().toISOString().split("T")[0];
  };

  // Step 1: Download Pre-Formatted Excel Template with Dummy Data
  const downloadSampleExcelTemplate = () => {
    const todayStr = new Date().toISOString().split("T")[0];
    const sampleRows = [
      {
        "Customer Name*": "Ramesh Kumar Sharma",
        "Customer Mobile": "9876543210",
        "Customer Email": "ramesh.sharma@example.com",
        "Loan Product": "Personal Loan",
        "Bank / Lender Name*": "HDFC Bank",
        "Loan Disbursed Amount*": 500000,
        "Bank Commission %": 2.0,
        "Base Commission Amount (Optional)": "",
        "Corporate DSA %": 0,
        "Bank TDS %": 5,
        "Bank GST %": 18,
        "Disbursal Date (YYYY-MM-DD)": todayStr,
        "Payout Type (Self/Vendor)": "Vendor",
        "Party / Connector Name": "Apex Finance DSA",
        "Party Code": "DSA-101",
        "Party Commission %": 50.0,
        "Extra Charges / Staff Cost": 0,
        "Notes": "October personal loan batch case",
      },
      {
        "Customer Name*": "Priya Rajesh Patel",
        "Customer Mobile": "9812345678",
        "Customer Email": "priya.patel@example.com",
        "Loan Product": "Home Loan",
        "Bank / Lender Name*": "State Bank of India",
        "Loan Disbursed Amount*": 3500000,
        "Bank Commission %": 1.5,
        "Base Commission Amount (Optional)": "",
        "Corporate DSA %": 0,
        "Bank TDS %": 5,
        "Bank GST %": 18,
        "Disbursal Date (YYYY-MM-DD)": todayStr,
        "Payout Type (Self/Vendor)": "Self",
        "Party / Connector Name": "Self",
        "Party Code": "",
        "Party Commission %": 0,
        "Extra Charges / Staff Cost": 0,
        "Notes": "Direct branch walk-in customer",
      },
      {
        "Customer Name*": "Rajesh Kumar Verma",
        "Customer Mobile": "9823456789",
        "Customer Email": "rajesh.verma@example.com",
        "Loan Product": "Business Loan",
        "Bank / Lender Name*": "ICICI Bank",
        "Loan Disbursed Amount*": 1500000,
        "Bank Commission %": 2.5,
        "Base Commission Amount (Optional)": "",
        "Corporate DSA %": 0,
        "Bank TDS %": 5,
        "Bank GST %": 18,
        "Disbursal Date (YYYY-MM-DD)": todayStr,
        "Payout Type (Self/Vendor)": "Vendor",
        "Party / Connector Name": "Smart Capital Partners",
        "Party Code": "DSA-204",
        "Party Commission %": 60.0,
        "Extra Charges / Staff Cost": 500,
        "Notes": "MSME business expansion loan",
      },
    ];

    const worksheet = XLSX.utils.json_to_sheet(sampleRows);

    // Set clean column widths for optimal viewing
    worksheet["!cols"] = [
      { wch: 25 }, // Customer Name*
      { wch: 18 }, // Customer Mobile
      { wch: 28 }, // Customer Email
      { wch: 18 }, // Loan Product
      { wch: 24 }, // Bank / Lender Name*
      { wch: 24 }, // Loan Disbursed Amount*
      { wch: 20 }, // Bank Commission %
      { wch: 32 }, // Base Commission Amount (Optional)
      { wch: 18 }, // Corporate DSA %
      { wch: 14 }, // Bank TDS %
      { wch: 14 }, // Bank GST %
      { wch: 26 }, // Disbursal Date (YYYY-MM-DD)
      { wch: 24 }, // Payout Type (Self/Vendor)
      { wch: 26 }, // Party / Connector Name
      { wch: 16 }, // Party Code
      { wch: 20 }, // Party Commission %
      { wch: 26 }, // Extra Charges / Staff Cost
      { wch: 32 }, // Notes
    ];

    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "Sample Payout Cases");
    XLSX.writeFile(workbook, "Sample_Case_Payouts_Template.xlsx");
    toast.success("Sample Excel Template downloaded with dummy data!");
  };

  // Step 2: Handle Excel File Upload & Parse Rows
  const handleExcelFileChange = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setBulkUploadedFile(file);
    setIsReadingExcel(true);
    setBulkImportResult(null);

    const reader = new FileReader();
    reader.onload = (evt) => {
      try {
        const data = new Uint8Array(evt.target.result);
        const workbook = XLSX.read(data, { type: "array" });
        const firstSheetName = workbook.SheetNames[0];
        if (!firstSheetName) {
          toast.error("The uploaded file does not contain any sheets.");
          setIsReadingExcel(false);
          return;
        }

        const worksheet = workbook.Sheets[firstSheetName];
        const rawJson = XLSX.utils.sheet_to_json(worksheet, { defval: "" });

        if (!rawJson || rawJson.length === 0) {
          toast.warning("The selected sheet is empty.");
          setBulkParsedRows([]);
          setIsReadingExcel(false);
          return;
        }

        // Helper to find value from row case-insensitively
        const findVal = (row, ...keys) => {
          const rowKeys = Object.keys(row);
          for (const k of keys) {
            const normalizedK = k.toLowerCase().replace(/[^a-z0-9]/g, "");
            const match = rowKeys.find(
              (rk) => rk.toLowerCase().replace(/[^a-z0-9]/g, "") === normalizedK
            );
            if (match && row[match] !== undefined && row[match] !== null && String(row[match]).trim() !== "") {
              return row[match];
            }
          }
          return "";
        };

        const parsedRows = rawJson.map((row, idx) => {
          const customerName = String(
            findVal(row, "customer name", "client name", "customer", "name", "applicant name")
          ).trim();
          const customerMobile = String(
            findVal(row, "customer mobile", "mobile", "phone", "contact", "mobile number")
          ).trim();
          const customerEmail = String(
            findVal(row, "customer email", "email", "email address")
          ).trim();
          const loanProduct = String(
            findVal(row, "loan product", "loan type", "product", "loan_type") || "Personal Loan"
          ).trim();
          const bankName = String(
            findVal(row, "bank lender name", "bank / lender name", "bank name", "bank", "lender") || "Bank"
          ).trim();

          const rawAmount = findVal(
            row,
            "loan disbursed amount",
            "loan amount",
            "disbursed amount",
            "disbursement amount",
            "amount",
            "sanctioned amount"
          );
          const loanAmount = parseFloat(String(rawAmount).replace(/[^0-9.]/g, "")) || 0;

          const rawBankPct = findVal(row, "bank commission %", "bank comm %", "bank commission", "bank %");
          const bankCommissionPercent = rawBankPct !== "" ? parseFloat(rawBankPct) : 2.0;

          const rawBaseAmt = findVal(row, "base commission amount", "base amount", "gross bank comm base");
          const baseAmount = rawBaseAmt !== "" ? parseFloat(rawBaseAmt) : Math.round((loanAmount * (bankCommissionPercent || 2.0)) / 100);

          const rawCorpDsaPct = findVal(row, "corporate dsa %", "corp dsa %", "dsa %");
          const corporateDsaPercent = rawCorpDsaPct !== "" ? parseFloat(rawCorpDsaPct) : 0;
          const corporateDsaAmount = Math.round((baseAmount * corporateDsaPercent) / 100);
          const actualAmount = Math.max(0, baseAmount - corporateDsaAmount);

          const rawBankTdsPct = findVal(row, "bank tds %", "tds %", "bank tds");
          const bankTdsPercent = rawBankTdsPct !== "" ? parseFloat(rawBankTdsPct) : 5;
          const bankTdsAmount = Math.round((actualAmount * bankTdsPercent) / 100);

          const rawBankGstPct = findVal(row, "bank gst %", "gst %", "bank gst");
          const bankGstPercent = rawBankGstPct !== "" ? parseFloat(rawBankGstPct) : 18;
          const bankGstAmount = Math.round((actualAmount * bankGstPercent) / 100);

          const bankNetReceivable = Math.max(0, actualAmount - bankTdsAmount);

          const rawDate = findVal(row, "disbursal date", "date", "disbursement date");
          const disbursalDate = parseExcelDate(rawDate);

          const rawPartyName = String(
            findVal(row, "party connector name", "connector / party", "party name", "connector name", "party", "source") || "Self"
          ).trim();
          const rawPayoutType = String(findVal(row, "payout type", "type", "sourcing type") || "").toUpperCase();
          const isSelf =
            rawPartyName.toLowerCase() === "self" ||
            rawPartyName.toLowerCase() === "direct" ||
            rawPayoutType === "SELF";
          const payoutType = isSelf ? "SELF" : "VENDOR";

          const partyCode = String(findVal(row, "party code", "connector code", "code") || "").trim();

          const rawPartyCommPct = findVal(row, "party commission %", "party comm %", "party %", "connector %");
          const partyCommissionPercent = isSelf ? 0 : rawPartyCommPct !== "" ? parseFloat(rawPartyCommPct) : 50.0;
          const partyCommissionDue = isSelf ? 0 : Math.round((baseAmount * partyCommissionPercent) / 100);

          const rawExtra = findVal(row, "extra charges", "staff cost", "manpower cost", "deductions");
          const extraCharges = rawExtra !== "" ? parseFloat(rawExtra) : 0;
          const partyNetPayable = isSelf ? 0 : Math.max(0, partyCommissionDue - extraCharges);
          const netMargin = Math.round(bankNetReceivable - (isSelf ? 0 : partyNetPayable) - extraCharges);

          const notes = String(findVal(row, "notes", "remarks", "comment") || "").trim();

          const issues = [];
          if (!customerName) issues.push("Missing Customer Name");
          if (!loanAmount || loanAmount <= 0) issues.push("Invalid / Missing Loan Amount");

          return {
            rowIndex: idx + 1,
            customerName,
            customerMobile,
            customerEmail,
            loanProduct,
            bankName,
            loanAmount,
            bankCommissionPercent,
            baseAmount,
            corporateDsaPercent,
            corporateDsaAmount,
            actualAmount,
            bankTdsPercent,
            bankTdsAmount,
            bankGstPercent,
            bankGstAmount,
            bankNetReceivable,
            disbursalDate,
            payoutType,
            partyName: rawPartyName,
            partyCode,
            partyCommissionPercent,
            partyCommissionDue,
            extraCharges,
            partyNetPayable,
            netMargin,
            notes,
            isValid: issues.length === 0,
            issues,
          };
        });

        setBulkParsedRows(parsedRows);
        toast.info(`Parsed ${parsedRows.length} rows from file. Please review and confirm.`);
      } catch (err) {
        console.error("Error reading Excel:", err);
        toast.error("Failed to parse Excel file. Please verify the format.");
      } finally {
        setIsReadingExcel(false);
      }
    };

    reader.readAsArrayBuffer(file);
  };

  // Step 3: Submit Valid Parsed Cases to Backend API
  const handleBulkImportSubmit = async () => {
    const validRows = bulkParsedRows.filter((r) => r.isValid);
    if (!validRows.length) {
      toast.error("No valid rows to import. Please fix rows with errors.");
      return;
    }

    try {
      setIsSubmittingBulk(true);
      const payload = validRows.map((r) => ({
        customerName: r.customerName,
        customerMobile: r.customerMobile,
        customerEmail: r.customerEmail,
        loanProduct: r.loanProduct,
        bankName: r.bankName,
        loanAmount: r.loanAmount,
        bankCommissionPercent: r.bankCommissionPercent,
        baseAmount: r.baseAmount,
        corporateDsaPercent: r.corporateDsaPercent,
        corporateDsaAmount: r.corporateDsaAmount,
        bankTdsPercent: r.bankTdsPercent,
        bankGstPercent: r.bankGstPercent,
        disbursalDate: r.disbursalDate,
        payoutType: r.payoutType,
        partyName: r.partyName,
        partyCode: r.partyCode,
        partyCommissionPercent: r.partyCommissionPercent,
        extraCharges: r.extraCharges,
        notes: r.notes,
      }));

      const res = await axios.post(`${API_URL}/payouts/cases/bulk`, { cases: payload });
      if (res.data?.success) {
        setBulkImportResult(res.data);
        toast.success(`Successfully imported ${res.data.importedCount} case(s)!`);
        fetchCasePayouts();
      } else {
        toast.warn(res.data?.message || "Import completed with warnings");
      }
    } catch (err) {
      console.error("Bulk import failed:", err);
      toast.error(err.response?.data?.message || "Bulk import failed. Please try again.");
    } finally {
      setIsSubmittingBulk(false);
    }
  };

  // Open Bank Receipt Modal with exact max calculation
  const openBankReceiptModal = (item) => {
    setReceiptTargetCase(item);
    const baseComm = parseFloat(item.baseAmount || 0);
    const corpDsaCharge = parseFloat(item.corporateDsaAmount) || Math.round((baseComm * (parseFloat(item.corporateDsaPercent) || 0)) / 100);
    const actualAmt = parseFloat(item.actualAmount) || Math.max(0, baseComm - corpDsaCharge);
    const tdsAmt = parseFloat(item.bankTdsAmount || 0);
    const maxNetReceivable = Math.max(0, actualAmt - tdsAmt);
    const alreadyReceived = parseFloat(item.bankReceivedAmount || 0);
    const remaining = Math.max(0, maxNetReceivable - alreadyReceived);
    const gstAmt = parseFloat(item.bankGstAmount || 0);

    setReceiptForm({
      grossAmount: remaining > 0 ? remaining : "",
      gstAmount: gstAmt,
      tdsAmount: tdsAmt,
      receiptDate: new Date().toISOString().split("T")[0],
      paymentMode: "NEFT",
      referenceNumber: "",
      notes: `Bank commission received for Lead #${item.leadId} (${item.customerName})`,
    });
    setBankReceiptModalOpen(true);
  };

  // Submit Bank Receipt with strict validation check
  const handleBankReceiptSubmit = async (e) => {
    e.preventDefault();
    if (!receiptTargetCase || !receiptForm.grossAmount || parseFloat(receiptForm.grossAmount) <= 0) {
      toast.warning("Please enter a valid receipt amount");
      return;
    }
    const baseComm = parseFloat(receiptTargetCase.baseAmount || 0);
    const isSelfCase = receiptTargetCase.payoutType === "SELF" || (receiptTargetCase.partyName || "").toLowerCase() === "self" || (receiptTargetCase.partyName || "").toLowerCase() === "direct";
    const corpDsaComm = isSelfCase ? 0 : parseFloat(receiptTargetCase.partyCommissionDue || 0);
    const tdsAmt = parseFloat(receiptTargetCase.bankTdsAmount || 0);
    const maxNetReceivable = Math.max(0, baseComm - corpDsaComm - tdsAmt);
    const alreadyReceived = parseFloat(receiptTargetCase.bankReceivedAmount || 0);
    const maxAllowedNow = Math.max(0, maxNetReceivable - alreadyReceived);

    if (parseFloat(receiptForm.grossAmount) > maxAllowedNow + 0.01) {
      toast.error(`Amount cannot exceed maximum eligible receivable of ₹${Math.round(maxAllowedNow).toLocaleString("en-IN")}`);
      return;
    }

    setRecordingReceipt(true);
    try {
      await axios.post(`${API_URL}/payouts/cases/${receiptTargetCase.id}/bank-receipt`, receiptForm);
      toast.success("Bank commission receipt recorded successfully!");
      setBankReceiptModalOpen(false);
      fetchCasePayouts();
      if (paymentHistoryModalOpen && historyTargetCase?.id === receiptTargetCase.id) {
        openPaymentHistoryModal(receiptTargetCase);
      }
    } catch (err) {
      console.error("Error recording bank receipt:", err);
      toast.error(err.response?.data?.message || "Failed to record bank receipt");
    } finally {
      setRecordingReceipt(false);
    }
  };

  // Open GSTR Status Modal
  const openGstrModal = (item) => {
    setGstrTargetCase(item);
    const bGstAmt = parseFloat(item.bankGstAmount) || 0;
    const gstrAmt = parseFloat(item.gstrAmount) || bGstAmt;
    setGstrForm({
      gstrStatus: item.gstrStatus || "PENDING",
      gstrAmount: gstrAmt,
      gstrReceivedAmount: parseFloat(item.gstrReceivedAmount || 0),
      notes: item.notes || "",
    });
    setGstrModalOpen(true);
  };

  // Submit GSTR Status Update
  const handleGstrSubmit = async (e) => {
    e.preventDefault();
    if (!gstrTargetCase) return;
    setSavingGstr(true);
    try {
      await axios.put(`${API_URL}/payouts/cases/${gstrTargetCase.id}/gstr-status`, gstrForm);
      toast.success("GST status updated successfully!");
      setGstrModalOpen(false);
      fetchCasePayouts();
      if (paymentHistoryModalOpen && historyTargetCase?.id === gstrTargetCase.id) {
        openPaymentHistoryModal(gstrTargetCase);
      }
    } catch (err) {
      console.error("Error updating GST status:", err);
      toast.error(err.response?.data?.message || "Failed to update GST status");
    } finally {
      setSavingGstr(false);
    }
  };

  // Open Payment History Modal
  const openPaymentHistoryModal = async (item) => {
    setHistoryTargetCase(item);
    setPaymentHistoryModalOpen(true);
    setLoadingHistory(true);
    setHistoryData(null);
    try {
      const res = await axios.get(`${API_URL}/payouts/cases/${item.id}/payment-history`);
      setHistoryData(res.data);
    } catch (err) {
      console.error("Error fetching payment history:", err);
      toast.error("Failed to load payment history for this lead");
    } finally {
      setLoadingHistory(false);
    }
  };

  // Open Party Payout Modal
  const openPartyPayoutModal = (item) => {
    setPayoutTargetCase(item);
    const remaining = Math.max(0, parseFloat(item.partyRemainingDue || 0));
    setPayoutForm({
      amount: remaining > 0 ? remaining : "",
      paymentDate: new Date().toISOString().split("T")[0],
      paymentMode: "BANK_TRANSFER",
      referenceNumber: "",
      notes: `Payout to ${item.partyName} for Lead #${item.leadId} (${item.customerName})`,
    });
    setPartyPayoutModalOpen(true);
  };

  // Submit Party Payout
  const handlePartyPayoutSubmit = async (e) => {
    e.preventDefault();
    if (!payoutTargetCase || !payoutForm.amount || parseFloat(payoutForm.amount) <= 0) {
      toast.warning("Please enter a valid payout amount");
      return;
    }
    setRecordingPartyPayout(true);
    try {
      await axios.post(`${API_URL}/payouts/cases/${payoutTargetCase.id}/party-payment`, payoutForm);
      toast.success("Party payout recorded & ledger automatically updated!");
      setPartyPayoutModalOpen(false);
      fetchCasePayouts();
    } catch (err) {
      console.error("Error recording party payout:", err);
      toast.error(err.response?.data?.message || "Failed to record party payout");
    } finally {
      setRecordingPartyPayout(false);
    }
  };

  // Open Invoice / Slip Modal
  const openInvoiceModal = async (item) => {
    setInvoiceModalOpen(true);
    setInvoiceLoading(true);
    setInvoiceData(null);
    try {
      const res = await axios.get(`${API_URL}/payouts/cases/${item.id}/invoice`);
      setInvoiceData(res.data?.invoice);
    } catch (err) {
      console.error("Error fetching invoice data:", err);
      toast.error("Could not generate invoice preview");
      setInvoiceModalOpen(false);
    } finally {
      setInvoiceLoading(false);
    }
  };

  // Print Invoice
  const handlePrintInvoice = () => {
    window.print();
  };

  // Export Cases to Excel
  const handleExportCasesExcel = () => {
    if (!cases.length) {
      toast.info("No cases to export");
      return;
    }
    const data = cases.map((c) => {
      const isSelf = c.payoutType === "SELF" || (c.partyName || "").toLowerCase() === "self" || (c.partyName || "").toLowerCase() === "direct";
      const bGst = parseFloat(c.bankGstAmount) || Math.round(((parseFloat(c.baseAmount) || 0) * (parseFloat(c.bankGstPercent) || 0)) / 100);
      const bTds = parseFloat(c.bankTdsAmount) || Math.round(((parseFloat(c.baseAmount) || 0) * (parseFloat(c.bankTdsPercent) || 0)) / 100);
      const bNet = parseFloat(c.bankNetReceivable) || Math.max(0, (parseFloat(c.baseAmount) || 0) - bGst - bTds);
      return {
        "Lead ID": `#${c.leadId}`,
        "Customer Name": c.customerName,
        "Mobile": c.customerMobile || "—",
        "Loan Product": c.loanProduct,
        "Assigned Bank": c.bankName,
        "Disbursal Date": c.disbursalDate || "—",
        "Loan Disbursed (₹)": c.loanAmount || c.baseAmount,
        "Bank Comm %": `${c.bankCommissionPercent}%`,
        "Gross Bank Comm Base (₹)": c.baseAmount,
        "Bank GST Deducted (₹)": bGst,
        "Bank TDS Deducted (₹)": bTds,
        "Bank Net Receivable (₹)": bNet,
        "Bank Received (₹)": c.bankReceivedAmount,
        "Bank Remaining Due (₹)": c.bankRemainingDue,
        "Case Sourcing Type": isSelf ? "Self (In-House)" : "Vendor (Connector)",
        "Connector / Party": isSelf ? "Self" : (c.partyName || "Direct"),
        "Party Code": isSelf ? "—" : (c.partyCode || "—"),
        "Party Comm % (on Bank Net)": isSelf ? "0%" : `${c.partyCommissionPercent}%`,
        "Gross Party Comm (₹)": isSelf ? 0 : c.partyCommissionDue,
        "Vendor TDS Deducted (₹)": isSelf ? 0 : (c.partyTdsAmount || 0),
        "Vendor GST Deducted (₹)": isSelf ? 0 : (c.partyGstAmount || 0),
        "Manpower / Staff Cost (₹)": c.extraCharges || 0,
        "Final Net Payable (₹)": isSelf ? 0 : (c.partyNetPayable || c.partyCommissionDue),
        "Party Paid (₹)": isSelf ? 0 : c.partyPaidAmount,
        "Party Remaining (₹)": isSelf ? 0 : c.partyRemainingDue,
        "Net Company Margin (₹)": c.netMargin,
        "Invoice #": c.invoiceNumber || "—",
        "Status": c.status,
      };
    });

    // Grand total row
    data.push({
      "Lead ID": "GRAND TOTAL",
      "Customer Name": `Total Cases: ${grandTotals.totalCases}`,
      "Mobile": "—",
      "Loan Product": "—",
      "Assigned Bank": "—",
      "Disbursal Date": "—",
      "Loan Disbursed (₹)": grandTotals.totalLoanVolume || grandTotals.totalDisbursedVolume,
      "Bank Comm %": "—",
      "Gross Bank Comm Base (₹)": grandTotals.totalBaseAmount,
      "Bank GST Deducted (₹)": "—",
      "Bank TDS Deducted (₹)": "—",
      "Bank Net Receivable (₹)": grandTotals.totalBankCommissionDue,
      "Bank Received (₹)": grandTotals.totalBankReceived,
      "Bank Remaining Due (₹)": grandTotals.totalBankRemainingDue,
      "Case Sourcing Type": "—",
      "Connector / Party": "—",
      "Party Code": "—",
      "Party Comm % (on Bank Net)": "—",
      "Gross Party Comm (₹)": grandTotals.totalPartyCommissionDue,
      "Vendor TDS Deducted (₹)": grandTotals.totalPartyTds,
      "Vendor GST Deducted (₹)": grandTotals.totalPartyGst,
      "Manpower / Staff Cost (₹)": grandTotals.totalExtraCharges,
      "Final Net Payable (₹)": grandTotals.totalPartyNetPayable,
      "Party Paid (₹)": grandTotals.totalPartyPaid,
      "Party Remaining (₹)": grandTotals.totalPartyRemainingDue,
      "Net Company Margin (₹)": grandTotals.totalNetMargin,
      "Invoice #": "—",
      "Status": "—",
    });

    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Disbursed Payouts");
    XLSX.writeFile(wb, `Disbursed_Payouts_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Disbursed Case Payouts exported to Excel!");
  };

  // Export Journal to Excel (Matching exact columns in screenshot)
  const handleExportJournalExcel = () => {
    if (!journalEntries.length) {
      toast.info("No journal entries to export");
      return;
    }
    const data = journalEntries.map((j) => ({
      "Payment Ref": j.paymentRef,
      "Date": j.date,
      "Party / Connector": j.partyName,
      "Party Code": j.partyCode,
      "Transaction Type": j.transactionType,
      "Lead ID (optional)": j.leadId,
      "Case Position": j.casePosition,
      "Paid / Debit (₹)": j.paidDebit,
      "Refund / Credit (₹)": j.refundCredit,
      "Net Cash Out (₹)": j.netCashOut,
      "Payment Mode": j.paymentMode,
      "Bank Ref / UTR": j.referenceNumber,
      "Running Balance (₹)": j.runningBalance,
      "Allocation Status": j.allocationStatus,
      "Remarks": j.remarks,
    }));

    const sheet = XLSX.utils.json_to_sheet(data);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, sheet, "Payment Journal");
    XLSX.writeFile(wb, `Payment_Journal_Ledger_${new Date().toISOString().split("T")[0]}.xlsx`);
    toast.success("Payment Journal exported to Excel!");
  };

  const resetAllFilters = () => {
    setFilterPeriodType("all");
    setCustomFromDate("");
    setCustomToDate("");
    setSelectedMonth("");
    setSelectedFY("");
    setSearchTerm("");
    setStatusFilter("ALL");
    setBankFilter("");
    setPartyFilter("");
  };

  const hasActiveFilters =
    filterPeriodType !== "all" ||
    Boolean(searchTerm) ||
    statusFilter !== "ALL" ||
    Boolean(bankFilter) ||
    Boolean(partyFilter);

  return (
    <div className="cc-payouts-page-container">
      <style>{payoutScreenStyles}</style>
      <ToastContainer position="top-right" autoClose={3000} />

      {/* Header Panel */}
      <section className="cc-report-panel cc-phead-panel">
        <div className="cc-phead-row">
          <div>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <h1 className="cc-phead-title">Disbursements &amp; Case Payouts</h1>
              <span className="cc-phead-badge">Commission &amp; Billing</span>
            </div>
            <p className="cc-phead-sub">
              Manage loan disbursals, bank commission credit values, vendor payouts, TDS/GST deductions &amp; invoices.
            </p>
          </div>

          <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
            {canManagePayouts && activeMainTab === "cases" && (
              <button
                type="button"
                className="cc-pbtn primary"
                onClick={openAddPayoutModal}
                style={{
                  background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                  color: "#ffffff",
                  borderColor: "#059669",
                  fontWeight: 700,
                  boxShadow: "0 2px 6px rgba(5,150,105,0.25)",
                }}
                title="Create / Record a new Case Payout"
              >
                <Plus size={16} /> + Record Case Payout
              </button>
            )}

            {canManagePayouts && activeMainTab === "cases" && (
              <button
                type="button"
                className="cc-pbtn secondary"
                onClick={() => {
                  resetBulkUpload();
                  setBulkUploadModalOpen(true);
                }}
                style={{
                  background: "#f0fdf4",
                  color: "#166534",
                  borderColor: "#86efac",
                  fontWeight: 700,
                  boxShadow: "0 1px 3px rgba(22,101,52,0.1)",
                  display: "flex",
                  alignItems: "center",
                  gap: 6,
                }}
                title="Bulk upload cases via Excel sheet with sample template"
              >
                <Upload size={16} /> Import from Excel
              </button>
            )}

            {activeMainTab === "cases" ? (
              <button
                type="button"
                className="cc-pbtn secondary"
                onClick={handleExportCasesExcel}
                title="Download Excel Sheet"
              >
                <Download size={15} /> Export Payouts Sheet
              </button>
            ) : (
              <button
                type="button"
                className="cc-pbtn primary"
                onClick={handleExportJournalExcel}
                title="Download Journal Sheet"
              >
                <Download size={15} /> Export Journal Sheet
              </button>
            )}
          </div>
        </div>

        {/* Main Tab Navigation */}
        <div className="cc-main-nav-tabs">
          <button
            type="button"
            className={activeMainTab === "cases" ? "active" : ""}
            onClick={() => setActiveMainTab("cases")}
          >
            <FileSpreadsheet size={15} /> Disbursed Case Payouts &amp; Billing ({grandTotals.totalCases})
          </button>
          <button
            type="button"
            className={activeMainTab === "journal" ? "active" : ""}
            onClick={() => setActiveMainTab("journal")}
          >
            <Receipt size={15} /> Party Payment Journal (Ledger)
          </button>
        </div>
      </section>

      {/* KPI CARDS (Shows on Cases View) */}
      {activeMainTab === "cases" && (
        <section className="cc-pkpi-grid">
          {/* KPI 1: Loan Disbursed Volume */}
          <div className="cc-pkpi-card">
            <div className="cc-pkpi-top">
              <span className="cc-pkpi-label">Disbursed Loan Volume</span>
              <div className="cc-pkpi-icon blue">
                <Coins size={16} />
              </div>
            </div>
            <div className="cc-pkpi-val">
              {currencyFormatter.format(grandTotals.totalLoanVolume || grandTotals.totalDisbursedVolume)}
            </div>
            <div className="cc-pkpi-sub">Across {grandTotals.totalCases} closed loan leads</div>
          </div>

          {/* KPI 2: Credit Amount / Base Inflow from Bank */}
          <div className="cc-pkpi-card highlight-green">
            <div className="cc-pkpi-top">
              <span className="cc-pkpi-label">Credit Base (Bank Comm)</span>
              <div className="cc-pkpi-icon emerald">
                <ArrowDownLeft size={16} />
              </div>
            </div>
            <div className="cc-pkpi-val" style={{ color: "#047857" }}>
              {currencyFormatter.format(grandTotals.totalBaseAmount || grandTotals.totalBankCommissionDue)}
            </div>
            <div className="cc-pkpi-sub">
              Received: <strong>{currencyFormatter.format(grandTotals.totalBankReceived)}</strong> • Due:{" "}
              <strong style={{ color: "#b45309" }}>{currencyFormatter.format(grandTotals.totalBankRemainingDue)}</strong>
            </div>
          </div>

          {/* KPI 3: Vendor Gross Commission */}
          <div className="cc-pkpi-card">
            <div className="cc-pkpi-top">
              <span className="cc-pkpi-label">Vendor Gross Comm</span>
              <div className="cc-pkpi-icon purple">
                <ArrowUpRight size={16} />
              </div>
            </div>
            <div className="cc-pkpi-val" style={{ color: "#7c3aed" }}>
              {currencyFormatter.format(grandTotals.totalPartyCommissionDue)}
            </div>
            <div className="cc-pkpi-sub">Calculated on Credit Base Value</div>
          </div>

          {/* KPI 4: Vendor Net Payable (After Deductions) */}
          <div className="cc-pkpi-card highlight-amber">
            <div className="cc-pkpi-top">
              <span className="cc-pkpi-label">Vendor Net Payable</span>
              <div className="cc-pkpi-icon amber">
                <Wallet size={16} />
              </div>
            </div>
            <div className="cc-pkpi-val" style={{ color: "#92400e" }}>
              {currencyFormatter.format(grandTotals.totalPartyNetPayable || grandTotals.totalPartyCommissionDue)}
            </div>
            <div className="cc-pkpi-sub">
              Paid: <strong>{currencyFormatter.format(grandTotals.totalPartyPaid)}</strong> • Due:{" "}
              <strong style={{ color: "#b45309" }}>{currencyFormatter.format(grandTotals.totalPartyRemainingDue)}</strong>
            </div>
          </div>

          {/* KPI 5: Net Company Spread / Margin */}
          <div className="cc-pkpi-card highlight-cyan">
            <div className="cc-pkpi-top">
              <span className="cc-pkpi-label">Net Company Spread</span>
              <div className="cc-pkpi-icon cyan">
                <TrendingUp size={16} />
              </div>
            </div>
            <div className="cc-pkpi-val" style={{ color: "#0284c7" }}>
              {currencyFormatter.format(grandTotals.totalNetMargin)}
            </div>
            <div className="cc-pkpi-sub">Bank Credit − Vendor Net Outflow</div>
          </div>
        </section>
      )}

      {/* FILTER TOOLBAR */}
      <section className="cc-pfilter-panel">
        <div className="cc-pfilter-bar">
          {/* Search Box */}
          <div className="cc-psearch-box">
            <Search size={15} />
            <input
              type="text"
              placeholder={
                activeMainTab === "cases"
                  ? "Search customer, mobile, bank, vendor/party, lead #, invoice #..."
                  : "Search party name, code, UTR #, remarks..."
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            {searchTerm && (
              <button
                type="button"
                onClick={() => setSearchTerm("")}
                style={{ border: 0, background: "transparent", cursor: "pointer", color: "#94a3b8" }}
              >
                <X size={14} />
              </button>
            )}
          </div>

          {/* Period Selector */}
          <div className="cc-pcontrol">
            <select
              className="cc-pselect"
              value={filterPeriodType}
              onChange={(e) => setFilterPeriodType(e.target.value)}
            >
              <option value="all">All Dates / Lifetime</option>
              <option value="month">Specific Month</option>
              <option value="fy">Financial Year</option>
              <option value="custom">Custom Date Range</option>
            </select>
          </div>

          {/* Month Dropdown */}
          {filterPeriodType === "month" && (
            <div className="cc-pcontrol">
              <select
                className="cc-pselect highlight"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
              >
                <option value="">Select Month</option>
                {availableMonths.map((m) => (
                  <option key={m.val} value={m.val}>
                    {m.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Financial Year Dropdown */}
          {filterPeriodType === "fy" && (
            <div className="cc-pcontrol">
              <select
                className="cc-pselect highlight"
                value={selectedFY}
                onChange={(e) => setSelectedFY(e.target.value)}
              >
                <option value="">Select FY</option>
                {financialYears.map((fy) => (
                  <option key={fy} value={fy}>
                    FY {fy}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Custom Date Range */}
          {filterPeriodType === "custom" && (
            <div className="cc-pdate-range">
              <input
                type="date"
                className="cc-pdate-input"
                value={customFromDate}
                onChange={(e) => setCustomFromDate(e.target.value)}
              />
              <span style={{ fontSize: 12, color: "#64748b" }}>to</span>
              <input
                type="date"
                className="cc-pdate-input"
                value={customToDate}
                onChange={(e) => setCustomToDate(e.target.value)}
              />
            </div>
          )}

          {/* Bank Filter (for Cases tab) */}
          {activeMainTab === "cases" && (
            <div className="cc-pcontrol">
              <select
                className="cc-pselect"
                value={bankFilter}
                onChange={(e) => setBankFilter(e.target.value)}
              >
                <option value="">All Banks / Lenders</option>
                {uniqueBanks.map((b) => (
                  <option key={b} value={b}>
                    {b}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Party Filter */}
          <div className="cc-pcontrol">
            <select
              className="cc-pselect"
              value={partyFilter}
              onChange={(e) => setPartyFilter(e.target.value)}
            >
              <option value="">All Connectors / Sources</option>
              {uniqueParties.map((p) => (
                <option key={p} value={p}>
                  {p}
                </option>
              ))}
            </select>
          </div>

          {/* Status Tabs (for Cases tab) */}
          {activeMainTab === "cases" && (
            <div className="cc-pstatus-pills">
              {[
                { key: "ALL", label: "All" },
                { key: "BANK_DUE", label: "Bank Due" },
                { key: "PARTY_DUE", label: "Vendor Due" },
                { key: "SETTLED", label: "Fully Settled" },
              ].map((s) => (
                <button
                  key={s.key}
                  type="button"
                  className={statusFilter === s.key ? "active" : ""}
                  onClick={() => setStatusFilter(s.key)}
                >
                  {s.label}
                </button>
              ))}
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              className="cc-pclear-btn"
              onClick={resetAllFilters}
              title="Clear all filters"
            >
              <X size={14} /> Clear
            </button>
          )}

          <button
            type="button"
            className="cc-prefresh-btn"
            onClick={activeMainTab === "cases" ? fetchCasePayouts : fetchPaymentJournal}
            title="Refresh data"
          >
            <RefreshCw size={14} className={loading || journalLoading ? "cc-spin" : ""} />
          </button>
        </div>
      </section>

      {/* TAB 1: DISBURSED CASE PAYOUTS & BILLING */}
      {activeMainTab === "cases" && (
        <section className="cc-report-panel cc-table-panel">
          <div className="cc-table-scroll-wrap">
            <table className="cc-payouts-table">
              <thead>
                <tr>
                  <th>Lead &amp; Customer</th>
                  <th>Loan &amp; Disbursal</th>
                  <th>Loan Amount (₹)</th>
                  <th>Bank %</th>
                  <th className="th-credit">Bank Gross Base (₹)</th>
                  <th>Bank Net Receivable (₹)</th>
                  <th>GST Status</th>
                  <th>Vendor / Type</th>
                  <th>Vendor %</th>
                  <th>Vendor Gross (₹)</th>
                  <th className="th-deduct">Deductions (Taxes/Staff)</th>
                  <th className="th-net">Party Net Payable (₹)</th>
                  <th>Party Paid / Due</th>
                  <th className="th-margin">Company Margin (₹)</th>
                  <th>Invoice / Taxes</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading ? (
                  <tr>
                    <td colSpan={16} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      <RefreshCw size={24} className="cc-spin" style={{ marginBottom: 10 }} />
                      <p>Loading disbursed cases &amp; payout balances...</p>
                    </td>
                  </tr>
                ) : cases.length === 0 ? (
                  <tr>
                    <td colSpan={16} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                      No completed or disbursed loan cases match the selected filters.
                    </td>
                  </tr>
                ) : (
                  cases.map((c) => {
                    const isSelfCase =
                      c.payoutType === "SELF" ||
                      (c.partyName || "").toLowerCase() === "self" ||
                      (c.partyName || "").toLowerCase() === "direct";

                    const baseComm = parseFloat(c.baseAmount || 0);
                    const corpDsaChargePct = parseFloat(c.corporateDsaPercent || 0);
                    const corpDsaChargeAmt = parseFloat(c.corporateDsaAmount) || Math.round((baseComm * corpDsaChargePct) / 100);
                    const actualAmt = parseFloat(c.actualAmount) || Math.max(0, baseComm - corpDsaChargeAmt);
                    const bGstAmt = parseFloat(c.bankGstAmount) || Math.round((actualAmt * (parseFloat(c.bankGstPercent) || 18)) / 100);
                    const bTdsAmt = parseFloat(c.bankTdsAmount) || Math.round((actualAmt * (parseFloat(c.bankTdsPercent) || 5)) / 100);
                    const bNet = parseFloat(c.bankNetReceivable) || Math.max(0, actualAmt - bTdsAmt);

                    const totalDeductions = isSelfCase
                      ? (parseFloat(c.extraCharges) || 0)
                      : (parseFloat(c.partyTdsAmount) || 0) + (parseFloat(c.partyGstAmount) || 0) + (parseFloat(c.extraCharges) || 0);

                    const netPayable = isSelfCase
                      ? 0
                      : parseFloat(c.partyNetPayable) || Math.max(0, parseFloat(c.partyCommissionDue || 0) - totalDeductions);

                    return (
                      <tr key={c.id}>
                        {/* 1. Lead & Customer */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
                            <span className="cc-lead-badge">#{c.leadId}</span>
                            {(c.application?.applicationNumber || c.lead?.applications?.[0]?.applicationNumber) && (
                              <span
                                className="cc-app-badge"
                                title="Loan Application Number"
                                style={{
                                  fontSize: 11,
                                  background: "#f1f5f9",
                                  border: "1px solid #cbd5e1",
                                  padding: "1px 6px",
                                  borderRadius: 4,
                                  color: "#334155",
                                  fontWeight: 600,
                                }}
                              >
                                {c.application?.applicationNumber || c.lead?.applications?.[0]?.applicationNumber}
                              </span>
                            )}
                            <strong style={{ fontSize: 13, color: "#0f172a" }}>{c.customerName}</strong>
                          </div>
                          <small style={{ color: "#64748b", fontSize: 11, display: "block", marginTop: 2 }}>
                            {c.customerMobile || "—"}
                          </small>
                        </td>

                        {/* 2. Loan & Disbursal Date */}
                        <td>
                          <span className="cc-product-pill">{c.loanProduct}</span>
                          <div style={{ fontSize: 11, color: "#475569", marginTop: 3 }}>
                            {c.disbursalDate ? new Date(c.disbursalDate).toLocaleDateString("en-IN") : "—"}
                          </div>
                        </td>

                        {/* 3. Loan Disbursed Amount */}
                        <td>
                          <strong style={{ fontSize: 13, color: "#0f172a" }}>
                            {currencyFormatter.format(c.loanAmount || c.baseAmount)}
                          </strong>
                        </td>

                        {/* 4. Bank Commission % */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                            <span className="cc-rate-tag green">{c.bankCommissionPercent}%</span>
                            <button
                              type="button"
                              className="cc-inline-edit-btn"
                              onClick={() => openEditModal(c)}
                              title="Edit Bank %"
                            >
                              <Edit3 size={11} />
                            </button>
                          </div>
                          <small style={{ color: "#64748b", fontSize: 10, display: "block", marginTop: 2 }}>
                            {c.bankName}
                          </small>
                        </td>

                        {/* 5. Gross Base Amount from Bank */}
                        <td className="cell-credit">
                          <strong style={{ fontSize: 13.5, color: "#047857" }}>
                            {currencyFormatter.format(c.baseAmount)}
                          </strong>
                          <div style={{ fontSize: 10.5, color: "#059669" }}>
                            Gross ({c.bankCommissionPercent}%)
                          </div>
                          {corpDsaChargeAmt > 0 && (
                            <div style={{ fontSize: 10, color: "#dc2626", marginTop: 2 }}>
                              - Corp DSA ({corpDsaChargePct}%): ₹{numberFormatter.format(corpDsaChargeAmt)}
                            </div>
                          )}
                          <div style={{ fontSize: 10.5, color: "#166534", fontWeight: 700, marginTop: 2 }}>
                            Actual: {currencyFormatter.format(actualAmt)}
                          </div>
                        </td>

                        {/* 6. Bank Net Receivable: (Actual Amount - TDS = Net Inflow, GST Separate) */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 4, flexWrap: "wrap" }}>
                            <span style={{ fontSize: 10.5, color: "#64748b" }}>Net:</span>
                            <strong style={{ fontSize: 13.5, color: "#047857" }}>{currencyFormatter.format(bNet)}</strong>
                          </div>
                          <div style={{ fontSize: 10, color: "#dc2626", marginTop: 1 }}>
                            ₹{numberFormatter.format(actualAmt)} − TDS ₹{numberFormatter.format(bTdsAmt)} ({c.bankTdsPercent || 5}%)
                          </div>
                          <div style={{ fontSize: 10, color: "#0369a1", fontWeight: 700, marginTop: 2, background: "#f0f9ff", border: "1px solid #bae6fd", padding: "1px 5px", borderRadius: 4, display: "inline-block" }}>
                            GST: ₹{numberFormatter.format(bGstAmt)} ({c.bankGstPercent || 18}%) <span style={{ color: "#64748b", fontWeight: 400 }}>[Separate]</span>
                          </div>
                          <div style={{ fontSize: 10.5, marginTop: 3 }}>
                            <span style={{ color: "#059669" }}>Rec: <strong>{currencyFormatter.format(c.bankReceivedAmount)}</strong></span>
                            {" • "}
                            <span style={{ color: c.bankRemainingDue > 0 ? "#b45309" : "#64748b" }}>Due: <strong>{currencyFormatter.format(c.bankRemainingDue)}</strong></span>
                          </div>
                        </td>

                        {/* 7. GST Status */}
                        <td>
                          <div style={{ display: "flex", alignItems: "center", gap: 5, flexWrap: "wrap" }}>
                            {c.gstrStatus === "COMPLETE" ? (
                              <span
                                style={{
                                  background: "#ecfdf5",
                                  color: "#047857",
                                  border: "1px solid #a7f3d0",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <CheckCircle2 size={11} /> Complete
                              </span>
                            ) : c.gstrStatus === "PARTIALLY_COMPLETE" ? (
                              <span
                                style={{
                                  background: "#eff6ff",
                                  color: "#1d4ed8",
                                  border: "1px solid #bfdbfe",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <Clock size={11} /> Partial
                              </span>
                            ) : (
                              <span
                                style={{
                                  background: "#fffbeb",
                                  color: "#b45309",
                                  border: "1px solid #fde68a",
                                  fontSize: 11,
                                  fontWeight: 700,
                                  padding: "2px 7px",
                                  borderRadius: 6,
                                  display: "inline-flex",
                                  alignItems: "center",
                                  gap: 3,
                                }}
                              >
                                <AlertCircle size={11} /> Pending
                              </span>
                            )}
                            <button
                              type="button"
                              className="cc-inline-edit-btn"
                              onClick={() => openGstrModal(c)}
                              title="Update GST Status & Reflected Amount"
                            >
                              <Edit3 size={11} />
                            </button>
                          </div>
                          <div style={{ fontSize: 10, color: "#475569", marginTop: 3 }}>
                            {c.gstrStatus === "PARTIALLY_COMPLETE" ? (
                              <span>
                                ₹{numberFormatter.format(c.gstrReceivedAmount || 0)} / ₹{numberFormatter.format(c.gstrAmount || bGstAmt)}
                              </span>
                            ) : c.gstrStatus === "COMPLETE" ? (
                              <span style={{ color: "#047857", fontWeight: 600 }}>
                                Full ₹{numberFormatter.format(c.gstrReceivedAmount || c.gstrAmount || bGstAmt)}
                              </span>
                            ) : (
                              <span style={{ color: "#94a3b8" }}>
                                Exp: ₹{numberFormatter.format(c.gstrAmount || bGstAmt)}
                              </span>
                            )}
                          </div>
                        </td>

                        {/* 8. Vendor / Connector / Self */}
                        <td>
                          {isSelfCase ? (
                            <span className="cc-party-pill" style={{ background: "#e0e7ff", color: "#3730a3", border: "1px solid #c7d2fe", fontWeight: 700 }}>
                              🏢 Self Sourced
                            </span>
                          ) : (
                            <div style={{ display: "flex", alignItems: "center", gap: 5 }}>
                              <span className="cc-party-pill">{c.partyName || "Direct"}</span>
                              {c.partyCode && <span className="cc-code-mini">{c.partyCode}</span>}
                            </div>
                          )}
                        </td>

                        {/* 9. Vendor % */}
                        <td>
                          {isSelfCase ? (
                            <span style={{ color: "#94a3b8", fontSize: 11 }}>—</span>
                          ) : (
                            <>
                              <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                                <span className="cc-rate-tag purple">{c.partyCommissionPercent}%</span>
                                <button
                                  type="button"
                                  className="cc-inline-edit-btn"
                                  onClick={() => openEditModal(c)}
                                  title="Edit Vendor %"
                                >
                                  <Edit3 size={11} />
                                </button>
                              </div>
                              <small style={{ color: "#7c3aed", fontSize: 10, display: "block", marginTop: 2 }}>
                                on Gross
                              </small>
                            </>
                          )}
                        </td>

                        {/* 10. Gross Vendor Commission */}
                        <td>
                          {isSelfCase ? (
                            <span style={{ color: "#94a3b8", fontSize: 11 }}>₹0 (Self)</span>
                          ) : (
                            <strong style={{ fontSize: 13, color: "#7c3aed" }}>
                              {currencyFormatter.format(c.partyCommissionDue)}
                            </strong>
                          )}
                        </td>

                        {/* 11. Deductions (TDS, GST, Manpower) */}
                        <td className="cell-deduct">
                          {isSelfCase ? (
                            parseFloat(c.extraCharges) > 0 ? (
                              <div style={{ fontSize: 11, color: "#d97706", fontWeight: 700 }}>
                                - Manpower: {currencyFormatter.format(c.extraCharges)}
                              </div>
                            ) : (
                              <span style={{ fontSize: 11, color: "#94a3b8" }}>₹0 Deductions</span>
                            )
                          ) : totalDeductions > 0 ? (
                            <div style={{ fontSize: 11, lineHeight: "1.3" }}>
                              {parseFloat(c.partyTdsAmount) > 0 && (
                                <div style={{ color: "#dc2626" }}>
                                  - TDS: {currencyFormatter.format(c.partyTdsAmount)} ({c.partyTdsPercent}%)
                                </div>
                              )}
                              {parseFloat(c.partyGstAmount) > 0 && (
                                <div style={{ color: "#dc2626" }}>
                                  - GST: {currencyFormatter.format(c.partyGstAmount)} ({c.partyGstPercent}%)
                                </div>
                              )}
                              {parseFloat(c.extraCharges) > 0 && (
                                <div style={{ color: "#d97706", fontWeight: 600 }}>
                                  - Manpower (Staff Incentive): {currencyFormatter.format(c.extraCharges)}
                                </div>
                              )}
                              <div style={{ fontWeight: 700, color: "#92400e", borderTop: "1px dashed #fde68a", marginTop: 2, paddingTop: 2 }}>
                                Total: -{currencyFormatter.format(totalDeductions)}
                              </div>
                            </div>
                          ) : (
                            <span style={{ fontSize: 11, color: "#94a3b8" }}>₹0 Deductions</span>
                          )}
                        </td>

                        {/* 12. Final Net Payable to Vendor */}
                        <td className="cell-net">
                          {isSelfCase ? (
                            <div>
                              <strong style={{ fontSize: 13, color: "#059669" }}>₹0</strong>
                              <div style={{ fontSize: 10, color: "#64748b" }}>(100% to Company)</div>
                            </div>
                          ) : (
                            <div>
                              <strong style={{ fontSize: 13.5, color: "#6d28d9" }}>
                                {currencyFormatter.format(netPayable)}
                              </strong>
                              <div style={{ fontSize: 10, color: "#7c3aed" }}>
                                (Net Outflow)
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 13. Vendor Paid & Remaining Due */}
                        <td>
                          {isSelfCase ? (
                            <span style={{ color: "#94a3b8", fontSize: 11 }}>N/A (Self)</span>
                          ) : (
                            <div>
                              <div style={{ fontSize: 11, color: "#059669" }}>
                                Paid: <strong>{currencyFormatter.format(c.partyPaidAmount)}</strong>
                              </div>
                              <div style={{ fontSize: 11, color: c.partyRemainingDue > 0 ? "#b45309" : "#64748b" }}>
                                Due: <strong>{currencyFormatter.format(c.partyRemainingDue)}</strong>
                              </div>
                            </div>
                          )}
                        </td>

                        {/* 14. Net Company Margin */}
                        <td className="cell-margin">
                          <strong
                            style={{
                              fontSize: 13.5,
                              color: c.netMargin >= 0 ? "#047857" : "#dc2626",
                            }}
                          >
                            {currencyFormatter.format(c.netMargin)}
                          </strong>
                          <small style={{ display: "block", color: isSelfCase ? "#047857" : "#64748b", fontSize: 10 }}>
                            {isSelfCase ? "Net Inflow − Manpower" : "Spread Profit"}
                          </small>
                        </td>

                        {/* 15. Invoice / Taxes */}
                        <td>
                          <div style={{ fontSize: 11, color: "#475569" }}>
                            GST: {c.bankGstPercent}% • TDS: {c.bankTdsPercent}%
                          </div>
                          <small style={{ color: "#64748b", fontSize: 10 }}>
                            {c.invoiceNumber || "No Invoice"}
                          </small>
                        </td>

                        {/* 16. Actions */}
                        <td>
                          <div style={{ display: "flex", gap: 5, alignItems: "center", flexWrap: "wrap" }}>
                            <button
                              type="button"
                              className="cc-action-btn edit"
                              onClick={() => openEditModal(c)}
                              title="Edit Bank %, Base Value, Deductions & Manpower"
                            >
                              <Sliders size={12} /> Edit
                            </button>
                            <button
                              type="button"
                              className="cc-action-btn receive"
                              onClick={() => openBankReceiptModal(c)}
                              title="Record payment received from Bank"
                            >
                              + Bank Rec
                            </button>
                            {!isSelfCase && (
                              <button
                                type="button"
                                className="cc-action-btn pay"
                                onClick={() => openPartyPayoutModal(c)}
                                title="Record commission payout to Connector"
                              >
                                + Pay Party
                              </button>
                            )}
                            <button
                              type="button"
                              className="cc-action-btn invoice"
                              onClick={() => openInvoiceModal(c)}
                              title="View & Download Bank Tax Invoice / Connector Voucher"
                            >
                              <Printer size={12} />
                            </button>
                            <button
                              type="button"
                              className="cc-action-btn"
                              style={{
                                background: "#f0fdf4",
                                border: "1px solid #bbf7d0",
                                color: "#166534",
                                fontWeight: 600,
                                display: "inline-flex",
                                alignItems: "center",
                                gap: 3,
                                padding: "4px 7px",
                                borderRadius: 6,
                                fontSize: 11,
                                cursor: "pointer",
                              }}
                              onClick={() => openPaymentHistoryModal(c)}
                              title="View Payment History & Ledger for this Lead"
                            >
                              <Receipt size={12} /> History
                            </button>
                          </div>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>

              {/* Grand Total Footer */}
              {!loading && cases.length > 0 && (
                <tfoot>
                  <tr className="cc-total-footer-row">
                    <td>
                      <strong>GRAND TOTAL</strong>
                    </td>
                    <td>
                      <span className="cc-code-mini total">CASES: {grandTotals.totalCases}</span>
                    </td>
                    <td>
                      <strong>
                        {currencyFormatter.format(grandTotals.totalLoanVolume || grandTotals.totalDisbursedVolume)}
                      </strong>
                    </td>
                    <td>—</td>
                    <td className="cell-credit">
                      <strong style={{ color: "#047857", fontSize: 13.5 }}>
                        {currencyFormatter.format(grandTotals.totalBaseAmount)}
                      </strong>
                    </td>
                    <td>
                      <div style={{ fontSize: 11 }}>
                        Net Due: {currencyFormatter.format(grandTotals.totalBankCommissionDue)}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#059669" }}>
                        Rec: {currencyFormatter.format(grandTotals.totalBankReceived)}
                      </div>
                      <div style={{ color: "#b45309", fontWeight: 700, fontSize: 11 }}>
                        Due: {currencyFormatter.format(grandTotals.totalBankRemainingDue)}
                      </div>
                    </td>
                    <td>
                      <div style={{ fontSize: 11, fontWeight: 700, color: "#0369a1" }}>
                        GST: {currencyFormatter.format(grandTotals.totalGstrAmount || grandTotals.totalBankGst || 0)}
                      </div>
                      <div style={{ fontSize: 10.5, color: "#047857" }}>
                        Reflected: {currencyFormatter.format(grandTotals.totalGstrReceived || 0)}
                      </div>
                    </td>
                    <td>—</td>
                    <td>—</td>
                    <td>
                      <strong style={{ color: "#7c3aed" }}>
                        {currencyFormatter.format(grandTotals.totalPartyCommissionDue)}
                      </strong>
                    </td>
                    <td className="cell-deduct">
                      <strong style={{ color: "#b45309" }}>
                        -{currencyFormatter.format((grandTotals.totalPartyTds || 0) + (grandTotals.totalPartyGst || 0) + (grandTotals.totalExtraCharges || 0))}
                      </strong>
                    </td>
                    <td className="cell-net">
                      <strong style={{ color: "#6d28d9", fontSize: 13.5 }}>
                        {currencyFormatter.format(grandTotals.totalPartyNetPayable)}
                      </strong>
                    </td>
                    <td>
                      <div style={{ fontSize: 11 }}>
                        Paid: {currencyFormatter.format(grandTotals.totalPartyPaid)}
                      </div>
                      <div style={{ color: "#b45309", fontWeight: 700 }}>
                        Due: {currencyFormatter.format(grandTotals.totalPartyRemainingDue)}
                      </div>
                    </td>
                    <td className="cell-margin">
                      <strong style={{ color: "#0284c7" }}>
                        {currencyFormatter.format(grandTotals.totalNetMargin)}
                      </strong>
                    </td>
                    <td colSpan={2}>—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* TAB 2: PARTY PAYMENT JOURNAL (MATCHING EXACT COLUMNS IN SCREENSHOT) */}
      {activeMainTab === "journal" && (
        <section className="cc-report-panel cc-table-panel">
          <div className="cc-table-scroll-wrap">
            <table className="cc-journal-table">
              <thead>
                <tr>
                  <th>Payment Ref</th>
                  <th>Date</th>
                  <th>Party / Connector</th>
                  <th>Party Code</th>
                  <th>Transaction Type</th>
                  <th>Lead ID (optional)</th>
                  <th>Case Position</th>
                  <th>Paid / Debit (₹)</th>
                  <th>Refund / Credit (₹)</th>
                  <th>Net Cash Out (₹)</th>
                  <th>Payment Mode</th>
                  <th>Bank Ref / UTR</th>
                  <th>Running Balance (₹)</th>
                  <th>Allocation Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {journalLoading ? (
                  <tr>
                    <td colSpan={15} style={{ textAlign: "center", padding: "40px", color: "#64748b" }}>
                      <RefreshCw size={24} className="cc-spin" style={{ marginBottom: 10 }} />
                      <p>Loading party payment journal...</p>
                    </td>
                  </tr>
                ) : journalEntries.length === 0 ? (
                  <tr>
                    <td colSpan={15} style={{ textAlign: "center", padding: "40px", color: "#94a3b8" }}>
                      No party payment transactions recorded for selected filters.
                    </td>
                  </tr>
                ) : (
                  journalEntries.map((j) => (
                    <tr key={j.id}>
                      <td>
                        <span className="cc-pref-tag">{j.paymentRef}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11.5, color: "#334155" }}>
                          {j.date ? new Date(j.date).toLocaleDateString("en-IN") : "—"}
                        </span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 12.5, color: "#0f172a" }}>{j.partyName}</strong>
                      </td>
                      <td>
                        <span className="cc-code-mini">{j.partyCode}</span>
                      </td>
                      <td>
                        <span
                          className={`cc-tx-type-tag ${
                            j.rawType === "ADVANCE"
                              ? "advance"
                              : j.rawType === "REFUND_CREDIT"
                              ? "refund"
                              : "settlement"
                          }`}
                        >
                          {j.transactionType}
                        </span>
                      </td>
                      <td>
                        {j.leadId && j.leadId !== "—" ? (
                          <span className="cc-lead-badge">#{j.leadId}</span>
                        ) : (
                          <span style={{ color: "#94a3b8" }}>—</span>
                        )}
                      </td>
                      <td>
                        <span style={{ fontSize: 11.5, color: "#475569" }}>{j.casePosition}</span>
                      </td>
                      <td>
                        <strong style={{ fontSize: 12.5, color: j.paidDebit > 0 ? "#047857" : "#94a3b8" }}>
                          {j.paidDebit > 0 ? currencyFormatter.format(j.paidDebit) : "—"}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ fontSize: 12.5, color: j.refundCredit > 0 ? "#dc2626" : "#94a3b8" }}>
                          {j.refundCredit > 0 ? currencyFormatter.format(j.refundCredit) : "—"}
                        </strong>
                      </td>
                      <td>
                        <strong style={{ fontSize: 12.5, color: "#0f172a" }}>
                          {currencyFormatter.format(j.netCashOut)}
                        </strong>
                      </td>
                      <td>
                        <span className="cc-mode-tag">{j.paymentMode}</span>
                      </td>
                      <td>
                        <code style={{ fontSize: 11, color: "#334155", background: "#f1f5f9", padding: "1px 4px", borderRadius: 3 }}>
                          {j.referenceNumber}
                        </code>
                      </td>
                      <td>
                        <strong style={{ fontSize: 13, color: "#0284c7" }}>
                          {currencyFormatter.format(j.runningBalance)}
                        </strong>
                      </td>
                      <td>
                        <span className="cc-alloc-tag">{j.allocationStatus}</span>
                      </td>
                      <td>
                        <span style={{ fontSize: 11.5, color: "#64748b" }}>{j.remarks}</span>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>

              {/* Journal Total Footer */}
              {!journalLoading && journalEntries.length > 0 && (
                <tfoot>
                  <tr className="cc-total-footer-row">
                    <td>
                      <strong>TOTALS</strong>
                    </td>
                    <td colSpan={6}>
                      <span className="cc-code-mini total">Entries: {journalTotals.totalEntries}</span>
                    </td>
                    <td>
                      <strong style={{ color: "#047857" }}>
                        {currencyFormatter.format(journalTotals.totalDebit)}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: "#dc2626" }}>
                        {currencyFormatter.format(journalTotals.totalCredit)}
                      </strong>
                    </td>
                    <td>
                      <strong style={{ color: "#047857" }}>
                        {currencyFormatter.format(journalTotals.totalNetCashOut)}
                      </strong>
                    </td>
                    <td colSpan={2}>—</td>
                    <td>
                      <strong style={{ color: "#0284c7" }}>
                        {currencyFormatter.format(journalTotals.finalBalance)}
                      </strong>
                    </td>
                    <td colSpan={2}>—</td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>
        </section>
      )}

      {/* MODAL 1: RECORD BANK COMMISSION RECEIPT */}
      {bankReceiptModalOpen && receiptTargetCase && (
        <div className="cc-modal-overlay" onClick={() => setBankReceiptModalOpen(false)}>
          <div className="cc-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <div>
                <h3>Record Bank Payment Received</h3>
                <p>
                  Receive loan commission payout from <strong>{receiptTargetCase.bankName}</strong> for Lead #
                  {receiptTargetCase.leadId}
                </p>
              </div>
              <button
                type="button"
                className="cc-modal-close"
                onClick={() => setBankReceiptModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleBankReceiptSubmit} className="cc-modal-form">
              {/* Summary Card & Calculation Breakdown */}
              {(() => {
                const baseComm = parseFloat(receiptTargetCase.baseAmount || receiptTargetCase.bankCommissionDue || 0);
                const isSelfCase = receiptTargetCase.payoutType === "SELF" || (receiptTargetCase.partyName || "").toLowerCase() === "self" || (receiptTargetCase.partyName || "").toLowerCase() === "direct";
                const corpDsaComm = isSelfCase ? 0 : parseFloat(receiptTargetCase.partyCommissionDue || 0);
                const remainingAfterDsa = Math.max(0, baseComm - corpDsaComm);
                const tdsAmt = parseFloat(receiptTargetCase.bankTdsAmount || 0);
                const gstAmt = parseFloat(receiptTargetCase.bankGstAmount || receiptTargetCase.gstrAmount || 0);
                const maxNetReceivable = Math.max(0, remainingAfterDsa - tdsAmt);
                const alreadyReceived = parseFloat(receiptTargetCase.bankReceivedAmount || 0);
                const maxAllowedNow = Math.max(0, maxNetReceivable - alreadyReceived);
                const enteredGross = parseFloat(receiptForm.grossAmount || 0);
                const isExceeded = enteredGross > maxAllowedNow + 0.01;

                return (
                  <>
                    <div className="cc-modal-summary-banner" style={{ gridTemplateColumns: "1.2fr 1fr 1fr 1fr" }}>
                      <div>
                        <small>Customer &amp; Loan</small>
                        <strong>{receiptTargetCase.customerName}</strong>
                        <span style={{ fontSize: 11, color: "#64748b" }}>{receiptTargetCase.loanProduct}</span>
                      </div>
                      <div>
                        <small>Disbursed Loan</small>
                        <strong>{currencyFormatter.format(receiptTargetCase.loanAmount || 0)}</strong>
                      </div>
                      <div>
                        <small>Gross Bank Comm</small>
                        <strong style={{ color: "#047857" }}>
                          {currencyFormatter.format(baseComm)}
                        </strong>
                      </div>
                      <div>
                        <small>Corp DSA Comm</small>
                        <strong style={{ color: "#7c3aed" }}>
                          {corpDsaComm > 0 ? `-${currencyFormatter.format(corpDsaComm)}` : "₹0 (Self/Direct)"}
                        </strong>
                      </div>
                    </div>

                    {/* Formula Explanation Banner */}
                    <div style={{ background: "#f0fdf4", border: "1px solid #bbf7d0", borderRadius: 8, padding: "10px 14px", fontSize: 12 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
                        <span style={{ fontWeight: 700, color: "#166534" }}>Calculation Formula: (Bank Comm − DSA Comm) − TDS</span>
                        <span style={{ fontWeight: 800, color: "#15803d", fontSize: 13 }}>
                          ₹{Math.round(remainingAfterDsa).toLocaleString("en-IN")} − ₹{Math.round(tdsAmt).toLocaleString("en-IN")} = ₹{Math.round(maxNetReceivable).toLocaleString("en-IN")} (Net X)
                        </span>
                      </div>
                      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr 1.2fr", gap: 8, color: "#166534", fontSize: 11.5, borderTop: "1px dashed #86efac", paddingTop: 6 }}>
                        <div>Already Received: <strong>₹{Math.round(alreadyReceived).toLocaleString("en-IN")}</strong></div>
                        <div>GST [Separate] (Y): <strong style={{ color: "#0284c7" }}>₹{Math.round(gstAmt).toLocaleString("en-IN")}</strong></div>
                        <div style={{ textAlign: "right" }}>Max Allowed Now: <strong style={{ color: isExceeded ? "#dc2626" : "#166534", fontSize: 13 }}>₹{Math.round(maxAllowedNow).toLocaleString("en-IN")}</strong></div>
                      </div>
                    </div>

                    {/* Validation Alert */}
                    {isExceeded && (
                      <div style={{ background: "#fef2f2", border: "1px solid #fecaca", borderRadius: 8, padding: "10px 12px", color: "#b91c1c", fontSize: 12, display: "flex", alignItems: "center", gap: 8 }}>
                        <AlertCircle size={18} style={{ flexShrink: 0 }} />
                        <span>
                          <strong>Validation Restriction:</strong> You entered ₹{Math.round(enteredGross).toLocaleString("en-IN")}, which exceeds the maximum eligible balance of <strong>₹{Math.round(maxAllowedNow).toLocaleString("en-IN")}</strong>. You cannot record more than the eligible net receivable!
                        </span>
                      </div>
                    )}
                  </>
                );
              })()}

              {/* Gross Amount & Receipt Date */}
              <div className="cc-form-row">
                <div className="cc-fgroup">
                  <label>Gross Commission Amount (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    max={(() => {
                      const baseComm = parseFloat(receiptTargetCase.baseAmount || 0);
                      const isSelfCase = receiptTargetCase.payoutType === "SELF" || (receiptTargetCase.partyName || "").toLowerCase() === "self" || (receiptTargetCase.partyName || "").toLowerCase() === "direct";
                      const corpDsaComm = isSelfCase ? 0 : parseFloat(receiptTargetCase.partyCommissionDue || 0);
                      const tdsAmt = parseFloat(receiptTargetCase.bankTdsAmount || 0);
                      const maxNetReceivable = Math.max(0, baseComm - corpDsaComm - tdsAmt);
                      const alreadyReceived = parseFloat(receiptTargetCase.bankReceivedAmount || 0);
                      return Math.max(0, maxNetReceivable - alreadyReceived);
                    })()}
                    required
                    placeholder="e.g. 25000"
                    value={receiptForm.grossAmount}
                    onChange={(e) => {
                      const val = e.target.value;
                      const g = parseFloat(val) || 0;
                      const gst = Math.round((g * parseFloat(receiptTargetCase.bankGstPercent || 18)) / 100);
                      const tds = Math.round((g * parseFloat(receiptTargetCase.bankTdsPercent || 5)) / 100);
                      setReceiptForm((prev) => ({
                        ...prev,
                        grossAmount: val,
                        gstAmount: gst,
                        tdsAmount: tds,
                      }));
                    }}
                  />
                </div>
                <div className="cc-fgroup">
                  <label>Receipt Date *</label>
                  <input
                    type="date"
                    required
                    value={receiptForm.receiptDate}
                    onChange={(e) => setReceiptForm((prev) => ({ ...prev, receiptDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* GST & TDS Row */}
              <div className="cc-form-row">
                <div className="cc-fgroup">
                  <label>GST ({receiptTargetCase.bankGstPercent || 18}%) ₹ [Separate]</label>
                  <input
                    type="number"
                    step="0.01"
                    value={receiptForm.gstAmount}
                    onChange={(e) => setReceiptForm((prev) => ({ ...prev, gstAmount: e.target.value }))}
                  />
                </div>
                <div className="cc-fgroup">
                  <label>TDS Deducted ({receiptTargetCase.bankTdsPercent || 5}%) ₹</label>
                  <input
                    type="number"
                    step="0.01"
                    value={receiptForm.tdsAmount}
                    onChange={(e) => setReceiptForm((prev) => ({ ...prev, tdsAmount: e.target.value }))}
                  />
                </div>
              </div>

              {/* Net Bank Credit Preview */}
              <div className="cc-net-credit-box">
                <span>Net Bank Account Credit:</span>
                <strong>
                  {currencyFormatter.format(
                    (parseFloat(receiptForm.grossAmount) || 0) +
                      (parseFloat(receiptForm.gstAmount) || 0) -
                      (parseFloat(receiptForm.tdsAmount) || 0)
                  )}
                </strong>
              </div>

              {/* Payment Mode & UTR */}
              <div className="cc-form-row">
                <div className="cc-fgroup">
                  <label>Payment Mode *</label>
                  <select
                    value={receiptForm.paymentMode}
                    onChange={(e) => setReceiptForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                  >
                    <option value="NEFT">NEFT / RTGS / IMPS</option>
                    <option value="DIRECT_CREDIT">Direct Bank Credit</option>
                    <option value="CHEQUE">Cheque</option>
                  </select>
                </div>
                <div className="cc-fgroup">
                  <label>Bank Reference / UTR Number</label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC12345678"
                    value={receiptForm.referenceNumber}
                    onChange={(e) => setReceiptForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="cc-fgroup">
                <label>Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={receiptForm.notes}
                  onChange={(e) => setReceiptForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-pbtn secondary"
                  onClick={() => setBankReceiptModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-pbtn primary"
                  disabled={
                    recordingReceipt ||
                    !receiptForm.grossAmount ||
                    parseFloat(receiptForm.grossAmount) <= 0 ||
                    (() => {
                      const baseComm = parseFloat(receiptTargetCase.baseAmount || 0);
                      const isSelfCase = receiptTargetCase.payoutType === "SELF" || (receiptTargetCase.partyName || "").toLowerCase() === "self" || (receiptTargetCase.partyName || "").toLowerCase() === "direct";
                      const corpDsaComm = isSelfCase ? 0 : parseFloat(receiptTargetCase.partyCommissionDue || 0);
                      const tdsAmt = parseFloat(receiptTargetCase.bankTdsAmount || 0);
                      const maxNetReceivable = Math.max(0, baseComm - corpDsaComm - tdsAmt);
                      const alreadyReceived = parseFloat(receiptTargetCase.bankReceivedAmount || 0);
                      const maxAllowedNow = Math.max(0, maxNetReceivable - alreadyReceived);
                      return parseFloat(receiptForm.grossAmount || 0) > maxAllowedNow + 0.01;
                    })()
                  }
                >
                  {recordingReceipt ? "Recording..." : "Save Bank Receipt & Update Balance"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 2: RECORD CONNECTOR PAYOUT */}
      {partyPayoutModalOpen && payoutTargetCase && (
        <div className="cc-modal-overlay" onClick={() => setPartyPayoutModalOpen(false)}>
          <div className="cc-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <div>
                <h3>Record Connector Commission Payout</h3>
                <p>
                  Pay commission to <strong>{payoutTargetCase.partyName}</strong> for Lead #
                  {payoutTargetCase.leadId}
                </p>
              </div>
              <button
                type="button"
                className="cc-modal-close"
                onClick={() => setPartyPayoutModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handlePartyPayoutSubmit} className="cc-modal-form">
              {/* Summary Card */}
              <div className="cc-modal-summary-banner">
                <div>
                  <small>Connector / Party</small>
                  <strong>{payoutTargetCase.partyName}</strong> ({payoutTargetCase.partyCode})
                </div>
                <div>
                  <small>Customer Case</small>
                  <strong>{payoutTargetCase.customerName}</strong>
                </div>
                <div>
                  <small>Net Payable</small>
                  <strong style={{ color: "#7c3aed" }}>
                    {currencyFormatter.format(payoutTargetCase.partyNetPayable || payoutTargetCase.partyCommissionDue)}
                  </strong>
                </div>
                <div>
                  <small>Remaining Due</small>
                  <strong style={{ color: "#b45309" }}>
                    {currencyFormatter.format(payoutTargetCase.partyRemainingDue)}
                  </strong>
                </div>
              </div>

              {/* Amount & Date */}
              <div className="cc-form-row">
                <div className="cc-fgroup">
                  <label>Amount to Pay (₹) *</label>
                  <input
                    type="number"
                    step="0.01"
                    min="1"
                    required
                    placeholder="e.g. 15000"
                    value={payoutForm.amount}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, amount: e.target.value }))}
                  />
                </div>
                <div className="cc-fgroup">
                  <label>Payment Date *</label>
                  <input
                    type="date"
                    required
                    value={payoutForm.paymentDate}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, paymentDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Payment Mode & Reference */}
              <div className="cc-form-row">
                <div className="cc-fgroup">
                  <label>Payment Mode *</label>
                  <select
                    value={payoutForm.paymentMode}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, paymentMode: e.target.value }))}
                  >
                    <option value="BANK_TRANSFER">Bank Transfer (NEFT / RTGS)</option>
                    <option value="UPI">UPI</option>
                    <option value="CHEQUE">Cheque</option>
                    <option value="CASH">Cash</option>
                  </select>
                </div>
                <div className="cc-fgroup">
                  <label>Bank Ref / UTR / Cheque #</label>
                  <input
                    type="text"
                    placeholder="e.g. UTR987654321"
                    value={payoutForm.referenceNumber}
                    onChange={(e) => setPayoutForm((prev) => ({ ...prev, referenceNumber: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="cc-fgroup">
                <label>Remarks / Notes</label>
                <textarea
                  rows={2}
                  value={payoutForm.notes}
                  onChange={(e) => setPayoutForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div style={{ fontSize: 11.5, color: "#64748b", background: "#f8fafc", padding: "8px 12px", borderRadius: 6, border: "1px solid #e2e8f0" }}>
                ℹ️ This transaction will automatically update both this Case balance and the <strong>Party / Connector Details (`/party-payouts`)</strong> ledger in real time.
              </div>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-pbtn secondary"
                  onClick={() => setPartyPayoutModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-pbtn primary" disabled={recordingPartyPayout}>
                  {recordingPartyPayout ? "Recording..." : "Save Payout & Update Ledger"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 3: EDIT RATES, CREDIT BASE & DEDUCTIONS */}
      {editModalOpen && editingCase && (
        <div className="cc-modal-overlay" onClick={() => setEditModalOpen(false)}>
          <div className="cc-modal-box" style={{ maxWidth: 680 }} onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header">
              <div>
                <h3>Edit Rates, Credit Base &amp; Deductions</h3>
                <p>
                  Lead #{editingCase.leadId} • {editingCase.customerName} ({editingCase.bankName})
                </p>
              </div>
              <button
                type="button"
                className="cc-modal-close"
                onClick={() => setEditModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="cc-modal-form">
              {/* TOP SEGMENTED SWITCHER: SELF / DIRECT VS VENDOR / CONNECTOR */}
              <div style={{ display: "flex", gap: 10, background: "#f1f5f9", padding: "6px", borderRadius: 10, marginBottom: 4 }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12.5,
                    border: "1px solid",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: editForm.payoutType === "SELF" ? "#4f46e5" : "transparent",
                    color: editForm.payoutType === "SELF" ? "#fff" : "#475569",
                    borderColor: editForm.payoutType === "SELF" ? "#4338ca" : "transparent",
                    boxShadow: editForm.payoutType === "SELF" ? "0 2px 4px rgba(79,70,229,0.25)" : "none",
                    transition: "all 0.15s",
                  }}
                  onClick={() => recomputeEditForm({ payoutType: "SELF", partyName: "Self" })}
                >
                  <Building2 size={15} /> 🏢 Self / In-House Case
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12.5,
                    border: "1px solid",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: editForm.payoutType === "VENDOR" ? "#7c3aed" : "transparent",
                    color: editForm.payoutType === "VENDOR" ? "#fff" : "#475569",
                    borderColor: editForm.payoutType === "VENDOR" ? "#6d28d9" : "transparent",
                    boxShadow: editForm.payoutType === "VENDOR" ? "0 2px 4px rgba(124,58,237,0.25)" : "none",
                    transition: "all 0.15s",
                  }}
                  onClick={() =>
                    recomputeEditForm({
                      payoutType: "VENDOR",
                      partyName:
                        editingCase.partyName && editingCase.partyName.toLowerCase() !== "self"
                          ? editingCase.partyName
                          : "Channel Partner",
                    })
                  }
                >
                  <Wallet size={15} /> 🤝 Vendor / Connector Case
                </button>
              </div>

              {/* SECTION 1: BANK INFLOW & BANK DEDUCTIONS */}
              <div style={{ background: "#f0fdf4", padding: "14px", borderRadius: 10, border: "1px solid #bbf7d0" }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={16} color="#166534" />
                    <strong style={{ fontSize: 13, color: "#166534" }}>
                      1. Bank Commission Inflow ({editingCase.bankName})
                    </strong>
                  </div>
                  <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>
                    Gross me se Corporate DSA cut hoga, Actual Amount pe TDS minus hokar Net aayega (GST alag rahega)
                  </span>
                </div>

                <div className="cc-form-row" style={{ gridTemplateColumns: "1.2fr 0.8fr 1.2fr" }}>
                  <div className="cc-fgroup">
                    <label>Loan Disbursed Amount (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      value={editForm.loanAmount}
                      onChange={(e) => recomputeEditForm({ loanAmount: e.target.value })}
                    />
                  </div>

                  <div className="cc-fgroup">
                    <label>Bank Comm % *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      required
                      value={editForm.bankCommissionPercent}
                      onChange={(e) => recomputeEditForm({ bankCommissionPercent: e.target.value })}
                    />
                  </div>

                  <div className="cc-fgroup">
                    <label>Gross Bank Comm Base (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      required
                      style={{ fontWeight: 700, color: "#047857" }}
                      value={editForm.baseAmount}
                      onChange={(e) => recomputeEditForm({ baseAmount: e.target.value })}
                    />
                    <small style={{ color: "#64748b", fontSize: 10 }}>Calculated: Loan × Bank Comm %</small>
                  </div>
                </div>

                {/* Corporate DSA Deductions Row */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #86efac" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#166534", display: "block", marginBottom: 6 }}>
                    Corporate DSA Deductions (Deducted directly from Gross Bank Commission):
                  </span>
                  <div className="cc-form-row" style={{ gridTemplateColumns: "1fr 1fr 1.2fr" }}>
                    <div className="cc-fgroup">
                      <label>Corporate DSA Charge %</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={editForm.corporateDsaPercent}
                        onChange={(e) => recomputeEditForm({ corporateDsaPercent: e.target.value })}
                      />
                      <small style={{ color: "#dc2626", fontSize: 10.5, fontWeight: 600 }}>
                        - DSA Charge: ₹{numberFormatter.format(editForm.corporateDsaAmount || 0)}
                      </small>
                    </div>

                    <div className="cc-fgroup">
                      <label>Corporate DSA Charge (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={editForm.corporateDsaAmount}
                        onChange={(e) => recomputeEditForm({ corporateDsaAmount: e.target.value })}
                      />
                      <small style={{ color: "#64748b", fontSize: 10 }}>Gross × Corp DSA %</small>
                    </div>

                    <div className="cc-fgroup">
                      <label style={{ color: "#047857", fontWeight: 700 }}>Actual Amount (₹) *</label>
                      <input
                        type="number"
                        step="0.01"
                        readOnly
                        style={{ fontWeight: 800, color: "#047857", background: "#dcfce7", borderColor: "#86efac" }}
                        value={editForm.actualAmount}
                      />
                      <small style={{ color: "#15803d", fontSize: 10, fontWeight: 600 }}>
                        Gross ₹{numberFormatter.format(editForm.baseAmount || 0)} − DSA ₹{numberFormatter.format(editForm.corporateDsaAmount || 0)}
                      </small>
                    </div>
                  </div>
                </div>

                {/* Bank Deductions Row: TDS & GST on Actual Amount */}
                <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #86efac" }}>
                  <span style={{ fontSize: 11.5, fontWeight: 700, color: "#166534", display: "block", marginBottom: 6 }}>
                    Bank Taxes (Applicable on Actual Amount: ₹{numberFormatter.format(editForm.actualAmount || 0)}):
                  </span>
                  <div className="cc-form-row" style={{ gridTemplateColumns: "1fr 1fr 1fr" }}>
                    <div className="cc-fgroup">
                      <label>Bank TDS % (Deducted)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.bankTdsPercent}
                        onChange={(e) => recomputeEditForm({ bankTdsPercent: e.target.value })}
                      />
                      <small style={{ color: "#dc2626", fontSize: 10.5, fontWeight: 600 }}>
                        - TDS: ₹{numberFormatter.format(editForm.bankTdsAmount || 0)}
                      </small>
                    </div>

                    <div className="cc-fgroup">
                      <label>GST % (Kept Separate)</label>
                      <input
                        type="number"
                        step="0.01"
                        value={editForm.bankGstPercent}
                        onChange={(e) => recomputeEditForm({ bankGstPercent: e.target.value })}
                      />
                      <small style={{ color: "#2563eb", fontSize: 10.5, fontWeight: 600 }}>
                        GST Amount: ₹{numberFormatter.format(editForm.bankGstAmount || 0)} (Alag rahega)
                      </small>
                    </div>

                    <div className="cc-fgroup">
                      <label>Disbursal Date</label>
                      <input
                        type="date"
                        value={editForm.disbursalDate}
                        onChange={(e) => recomputeEditForm({ disbursalDate: e.target.value })}
                      />
                    </div>
                  </div>
                </div>

                {/* Bank Net Payable Highlight Box */}
                <div
                  style={{
                    marginTop: 12,
                    padding: "10px 14px",
                    background: "#dcfce7",
                    border: "1.5px solid #86efac",
                    borderRadius: 8,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "space-between",
                    flexWrap: "wrap",
                    gap: 8,
                  }}
                >
                  <div>
                    <span style={{ fontSize: 11, color: "#166534", fontWeight: 700, display: "block" }}>
                      BANK NET PAYABLE / RECEIVABLE AMOUNT:
                    </span>
                    <span style={{ fontSize: 11.5, color: "#15803d", fontWeight: 600 }}>
                      Actual Amount ₹{numberFormatter.format(editForm.actualAmount || 0)} − Bank TDS ₹{numberFormatter.format(editForm.bankTdsAmount || 0)} = ₹{numberFormatter.format(editForm.bankNetReceivable || 0)}
                    </span>
                    <div style={{ fontSize: 11, color: "#2563eb", fontWeight: 600, marginTop: 3 }}>
                      GST Amount (Separate): ₹{numberFormatter.format(editForm.bankGstAmount || 0)} (Net inflow me se minus nahi kiya gaya hai)
                    </div>
                  </div>
                  <div style={{ textAlign: "right" }}>
                    <strong style={{ fontSize: 18, color: "#047857" }}>
                      {currencyFormatter.format(editForm.bankNetReceivable || 0)}
                    </strong>
                    <div style={{ fontSize: 10, color: "#166534" }}>Actual Net Inflow from Bank</div>
                  </div>
                </div>
              </div>

              {/* SECTION 2: SELF / IN-HOUSE CASE VS VENDOR CASE */}
              {editForm.payoutType === "SELF" ? (
                /* SELF CASE */
                <div style={{ background: "#eef2ff", padding: "14px", borderRadius: 10, border: "1.5px solid #c7d2fe" }}>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, marginBottom: 8 }}>
                    <Building2 size={16} color="#3730a3" />
                    <strong style={{ fontSize: 13, color: "#3730a3" }}>
                      2. Self / In-House Case: Manpower Cost &amp; Company Margin
                    </strong>
                  </div>

                  <div
                    style={{
                      background: "#fff",
                      border: "1px solid #c7d2fe",
                      borderRadius: 8,
                      padding: "10px 12px",
                      marginBottom: 12,
                      fontSize: 12,
                      color: "#3730a3",
                      lineHeight: "1.4",
                    }}
                  >
                    🏢 <strong>Direct In-House Lead:</strong> Is case me koi external vendor commission nahi hai. 
                    Kewal <strong>Manpower Cost (Staff Incentive)</strong> deduct hoga aur bacha hua saara amount 
                    company ka hi net margin hoga.
                  </div>

                  <div className="cc-form-row" style={{ gridTemplateColumns: "1fr 1fr" }}>
                    <div className="cc-fgroup">
                      <label style={{ color: "#3730a3", fontWeight: 700 }}>
                        Manpower / Staff Processing Cost (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        placeholder="e.g. 500 or 1000"
                        style={{ borderColor: "#a5b4fc", fontWeight: 700, color: "#b45309" }}
                        value={editForm.extraCharges}
                        onChange={(e) => recomputeEditForm({ extraCharges: e.target.value })}
                      />
                      <small style={{ color: "#64748b", fontSize: 10.5 }}>
                        File process karne wale staff ka incentive / operational manpower cost.
                      </small>
                    </div>

                    <div className="cc-fgroup">
                      <label style={{ color: "#166534", fontWeight: 700 }}>Company Net Profit Margin (₹)</label>
                      <input
                        type="text"
                        readOnly
                        style={{
                          background: "#ecfdf5",
                          borderColor: "#86efac",
                          fontWeight: 800,
                          fontSize: 15,
                          color: "#047857",
                        }}
                        value={currencyFormatter.format(editForm.netMargin || 0)}
                      />
                      <small style={{ color: "#047857", fontSize: 10.5, fontWeight: 600 }}>
                        = Bank Net Inflow (₹{numberFormatter.format(editForm.bankNetReceivable || 0)}) − Manpower (₹{numberFormatter.format(editForm.extraCharges || 0)})
                      </small>
                    </div>
                  </div>
                </div>
              ) : (
                /* VENDOR / CONNECTOR CASE */
                <div style={{ background: "#f5f3ff", padding: "14px", borderRadius: 10, border: "1px solid #ddd6fe" }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <div style={{ display: "flex", alignItems: "center", gap: 6 }}>
                      <Wallet size={16} color="#5b21b6" />
                      <strong style={{ fontSize: 13, color: "#5b21b6" }}>
                        2. Vendor Commission, Deductions &amp; Manpower
                      </strong>
                    </div>
                    <span style={{ fontSize: 11, color: "#6d28d9", fontWeight: 600 }}>
                      Vendor payment me se GST, TDS aur Manpower cut hoga
                    </span>
                  </div>

                  <div className="cc-form-row" style={{ gridTemplateColumns: "1.2fr 0.8fr 1fr" }}>
                    <div className="cc-fgroup">
                      <label>Vendor / Connector Name</label>
                      <input
                        type="text"
                        placeholder="e.g. Ramesh DSA"
                        value={editForm.partyName}
                        onChange={(e) => recomputeEditForm({ partyName: e.target.value })}
                      />
                    </div>

                    <div className="cc-fgroup">
                      <label>Vendor Comm % *</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        required
                        value={editForm.partyCommissionPercent}
                        onChange={(e) => recomputeEditForm({ partyCommissionPercent: e.target.value })}
                      />
                      <small style={{ color: "#64748b", fontSize: 10 }}>on Bank Net (After Bank GST &amp; TDS)</small>
                    </div>

                    <div className="cc-fgroup">
                      <label>Gross Vendor Comm (₹)</label>
                      <input
                        type="number"
                        step="0.01"
                        readOnly
                        style={{ background: "#ede9fe", fontWeight: 700, color: "#6d28d9" }}
                        value={editForm.partyCommissionDue}
                      />
                    </div>
                  </div>

                  {/* DEDUCTIONS ROW: TDS, GST, MANPOWER */}
                  <div style={{ marginTop: 10, paddingTop: 10, borderTop: "1px dashed #c4b5fd" }}>
                    <span style={{ fontSize: 11.5, fontWeight: 700, color: "#6b21a8", display: "block", marginBottom: 6 }}>
                      Vendor Deductions (Vendor payment me se cut hone wale charges):
                    </span>

                    <div className="cc-form-row" style={{ gridTemplateColumns: "1fr 1fr 1.2fr" }}>
                      <div className="cc-fgroup">
                        <label>Vendor TDS %</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0%"
                          value={editForm.partyTdsPercent}
                          onChange={(e) => recomputeEditForm({ partyTdsPercent: e.target.value })}
                        />
                        <small style={{ color: "#dc2626", fontSize: 10.5, fontWeight: 600 }}>
                          - TDS: ₹{numberFormatter.format(editForm.partyTdsAmount || 0)}
                        </small>
                      </div>

                      <div className="cc-fgroup">
                        <label>Vendor GST %</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="0%"
                          value={editForm.partyGstPercent}
                          onChange={(e) => recomputeEditForm({ partyGstPercent: e.target.value })}
                        />
                        <small style={{ color: "#dc2626", fontSize: 10.5, fontWeight: 600 }}>
                          - GST: ₹{numberFormatter.format(editForm.partyGstAmount || 0)}
                        </small>
                      </div>

                      <div className="cc-fgroup">
                        <label>Manpower Cost / Incentive (₹)</label>
                        <input
                          type="number"
                          step="0.01"
                          min="0"
                          placeholder="₹0"
                          value={editForm.extraCharges}
                          onChange={(e) => recomputeEditForm({ extraCharges: e.target.value })}
                        />
                        <small style={{ color: "#d97706", fontSize: 10.5, fontWeight: 600 }}>
                          - Manpower: ₹{numberFormatter.format(editForm.extraCharges || 0)}
                        </small>
                      </div>
                    </div>

                    {/* Vendor Net Highlight Box */}
                    <div
                      style={{
                        marginTop: 10,
                        padding: "8px 12px",
                        background: "#ede9fe",
                        border: "1px solid #c4b5fd",
                        borderRadius: 6,
                        display: "flex",
                        justifyContent: "space-between",
                        alignItems: "center",
                      }}
                    >
                      <span style={{ fontSize: 11.5, color: "#5b21b6", fontWeight: 600 }}>
                        Vendor Final Net Payable:
                      </span>
                      <strong style={{ fontSize: 15, color: "#6d28d9" }}>
                        {currencyFormatter.format(editForm.partyNetPayable || 0)}
                      </strong>
                    </div>
                  </div>
                </div>
              )}

              {/* SECTION 3: LIVE REAL-TIME FINANCIAL SUMMARY STRIP */}
              <div className="cc-calc-preview" style={{ background: "#f8fafc", padding: "12px", borderRadius: 8 }}>
                <div>
                  <small>Bank Gross Base</small>
                  <strong style={{ color: "#047857" }}>
                    {currencyFormatter.format(parseFloat(editForm.baseAmount) || 0)}
                  </strong>
                </div>
                <div>
                  <small>Corp DSA Deduct</small>
                  <strong style={{ color: "#dc2626" }}>
                    -{currencyFormatter.format(parseFloat(editForm.corporateDsaAmount) || 0)}
                  </strong>
                </div>
                <div>
                  <small>Actual Amount</small>
                  <strong style={{ color: "#047857" }}>
                    {currencyFormatter.format(parseFloat(editForm.actualAmount) || 0)}
                  </strong>
                </div>
                <div>
                  <small>Bank TDS (5%)</small>
                  <strong style={{ color: "#dc2626" }}>
                    -{currencyFormatter.format(parseFloat(editForm.bankTdsAmount) || 0)}
                  </strong>
                </div>
                <div>
                  <small>Bank Net Inflow</small>
                  <strong style={{ color: "#047857", fontSize: 13 }}>
                    {currencyFormatter.format(parseFloat(editForm.bankNetReceivable) || 0)}
                  </strong>
                </div>
                <div>
                  <small>GST (Separate)</small>
                  <strong style={{ color: "#2563eb" }}>
                    {currencyFormatter.format(parseFloat(editForm.bankGstAmount) || 0)}
                  </strong>
                </div>
                <div>
                  <small>{editForm.payoutType === "SELF" ? "Manpower Cost" : "Vendor Net Outflow"}</small>
                  <strong style={{ color: editForm.payoutType === "SELF" ? "#d97706" : "#6d28d9" }}>
                    {editForm.payoutType === "SELF"
                      ? `-${currencyFormatter.format(parseFloat(editForm.extraCharges) || 0)}`
                      : currencyFormatter.format(parseFloat(editForm.partyNetPayable) || 0)}
                  </strong>
                </div>
                <div>
                  <small>Company Margin</small>
                  <strong style={{ color: "#047857", fontSize: 14 }}>
                    {currencyFormatter.format(parseFloat(editForm.netMargin) || 0)}
                  </strong>
                </div>
              </div>

              {/* Invoicing Info */}
              <div className="cc-form-row">
                <div className="cc-fgroup">
                  <label>Invoice Number</label>
                  <input
                    type="text"
                    placeholder="e.g. INV-2026-0042"
                    value={editForm.invoiceNumber}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, invoiceNumber: e.target.value }))}
                  />
                </div>
                <div className="cc-fgroup">
                  <label>Invoice Date</label>
                  <input
                    type="date"
                    value={editForm.invoiceDate}
                    onChange={(e) => setEditForm((prev) => ({ ...prev, invoiceDate: e.target.value }))}
                  />
                </div>
              </div>

              {/* Notes */}
              <div className="cc-fgroup">
                <label>Notes / Remarks</label>
                <textarea
                  rows={2}
                  value={editForm.notes}
                  onChange={(e) => setEditForm((prev) => ({ ...prev, notes: e.target.value }))}
                />
              </div>

              <div className="cc-modal-actions">
                <button
                  type="button"
                  className="cc-pbtn secondary"
                  onClick={() => setEditModalOpen(false)}
                >
                  Cancel
                </button>
                <button type="submit" className="cc-pbtn primary" disabled={savingEdit}>
                  {savingEdit ? "Updating..." : "Save Rates, Deductions & Payout"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 4: INVOICE VIEWER & PRINT / PDF MODAL */}
      {invoiceModalOpen && (
        <div className="cc-modal-overlay" onClick={() => setInvoiceModalOpen(false)}>
          <div className="cc-modal-box cc-invoice-modal-box" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header no-print">
              <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                <h3>Commission Billing &amp; Invoicing</h3>
                <div className="cc-inv-toggle">
                  <button
                    type="button"
                    className={invoiceViewType === "BANK" ? "active" : ""}
                    onClick={() => setInvoiceViewType("BANK")}
                  >
                    Bank Tax Invoice
                  </button>
                  <button
                    type="button"
                    className={invoiceViewType === "CONNECTOR" ? "active" : ""}
                    onClick={() => setInvoiceViewType("CONNECTOR")}
                  >
                    Connector Payout Slip
                  </button>
                </div>
              </div>

              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button type="button" className="cc-pbtn primary small" onClick={handlePrintInvoice}>
                  <Printer size={14} /> Print / Save PDF
                </button>
                <button
                  type="button"
                  className="cc-modal-close"
                  onClick={() => setInvoiceModalOpen(false)}
                >
                  <X size={18} />
                </button>
              </div>
            </div>

            <div className="cc-invoice-content-wrap">
              {invoiceData && (!invoiceData.company?.gstin || invoiceData.company.gstin === "GSTIN Not Specified" || !invoiceData.company?.address || invoiceData.company.address.includes("Address Not Configured")) && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", padding: "8px 14px", borderRadius: 8, marginBottom: 12, fontSize: 12, color: "#92400e", display: "flex", alignItems: "center", justifyContent: "space-between" }} className="no-print">
                  <span>⚠️ Company GSTIN or Registered Address is not configured. Update your legal company details in Settings.</span>
                  <a href="/settings" style={{ color: "#047857", fontWeight: 700, textDecoration: "underline" }}>Open Settings</a>
                </div>
              )}
              {invoiceLoading || !invoiceData ? (
                <div style={{ textAlign: "center", padding: "50px", color: "#64748b" }}>
                  <RefreshCw size={24} className="cc-spin" style={{ marginBottom: 10 }} />
                  <p>Loading invoice details...</p>
                </div>
              ) : invoiceViewType === "BANK" ? (
                /* VIEW 1: OFFICIAL BANK TAX INVOICE */
                <div className="cc-printable-invoice" id="printable-bank-invoice">
                  {/* Header */}
                  <div className="cc-inv-header">
                    <div>
                      <h2 className="cc-inv-company-name">{invoiceData.company?.name}</h2>
                      <p className="cc-inv-company-sub">Loan Distribution &amp; Financial Syndication Partner</p>
                      <p className="cc-inv-meta-line">{invoiceData.company?.address}</p>
                      <p className="cc-inv-meta-line">
                        GSTIN: <strong>{invoiceData.company?.gstin}</strong> | PAN: <strong>{invoiceData.company?.pan}</strong>
                      </p>
                      <p className="cc-inv-meta-line">
                        Email: {invoiceData.company?.email} | Phone: {invoiceData.company?.phone}
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="cc-inv-title-badge">TAX INVOICE</div>
                      <div className="cc-inv-prop-row">
                        <span>Invoice No:</span>
                        <strong>{invoiceData.invoiceNumber}</strong>
                      </div>
                      <div className="cc-inv-prop-row">
                        <span>Invoice Date:</span>
                        <strong>
                          {invoiceData.invoiceDate ? new Date(invoiceData.invoiceDate).toLocaleDateString("en-IN") : "—"}
                        </strong>
                      </div>
                      <div className="cc-inv-prop-row">
                        <span>Status:</span>
                        <span className="cc-inv-status-pill">{invoiceData.invoiceStatus}</span>
                      </div>
                    </div>
                  </div>

                  {/* Bill To & Case Reference */}
                  <div className="cc-inv-billto-grid">
                    <div className="cc-bill-box">
                      <small>BILLED TO (LENDER / BANK):</small>
                      <strong>{invoiceData.billTo?.bankName}</strong>
                      <p>{invoiceData.billTo?.lenderType} Partner</p>
                      <p>Attn: {invoiceData.billTo?.contactPerson}</p>
                    </div>
                    <div className="cc-bill-box">
                      <small>BORROWER &amp; DISBURSAL DETAILS:</small>
                      <strong>{invoiceData.caseDetails?.customerName}</strong>
                      <p>Loan Product: {invoiceData.caseDetails?.loanProduct}</p>
                      <p>
                        Loan Disbursed: <strong>{currencyFormatter.format(invoiceData.caseDetails?.loanAmount || invoiceData.caseDetails?.baseAmount || 0)}</strong>
                      </p>
                      <p>
                        Disbursal Date:{" "}
                        {invoiceData.caseDetails?.disbursalDate
                          ? new Date(invoiceData.caseDetails.disbursalDate).toLocaleDateString("en-IN")
                          : "—"}
                      </p>
                    </div>
                  </div>

                  {/* Items Table */}
                  <table className="cc-inv-items-table">
                    <thead>
                      <tr>
                        <th>#</th>
                        <th>Description of Services</th>
                        <th>HSN/SAC</th>
                        <th>Disbursed Base</th>
                        <th>Payout Rate</th>
                        <th style={{ textAlign: "right" }}>Taxable Value (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>1</td>
                        <td>
                          <strong>Loan Distribution &amp; Processing Commission</strong>
                          <p style={{ margin: "2px 0 0", fontSize: 11, color: "#64748b" }}>
                            Borrower: {invoiceData.caseDetails?.customerName} • Lead #{invoiceData.caseDetails?.leadId}
                          </p>
                        </td>
                        <td>997119</td>
                        <td>{currencyFormatter.format(invoiceData.caseDetails?.loanAmount || invoiceData.caseDetails?.baseAmount || 0)}</td>
                        <td>{invoiceData.caseDetails?.bankCommissionPercent}%</td>
                        <td style={{ textAlign: "right" }}>
                          <strong>{currencyFormatter.format(invoiceData.caseDetails?.baseAmount || invoiceData.caseDetails?.bankCommissionDue || 0)}</strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  {/* Summary & Tax Breakdown */}
                  <div className="cc-inv-calc-split">
                    <div className="cc-inv-bank-meta">
                      <small style={{ fontWeight: 700, color: "#475569", display: "block", marginBottom: 6 }}>
                        REMITTANCE ACCOUNT DETAILS:
                      </small>
                      <p>Bank: <strong>{invoiceData.company?.bankName}</strong></p>
                      <p>A/C Number: <strong>{invoiceData.company?.accountNumber}</strong></p>
                      <p>IFSC: <strong>{invoiceData.company?.ifsc}</strong></p>
                      <p>Branch: <strong>{invoiceData.company?.branch}</strong></p>
                    </div>

                    <div className="cc-inv-totals-box">
                      <div className="cc-inv-trow">
                        <span>Taxable Value:</span>
                        <strong>{currencyFormatter.format(invoiceData.caseDetails?.baseAmount || invoiceData.caseDetails?.bankCommissionDue || 0)}</strong>
                      </div>
                      <div className="cc-inv-trow">
                        <span>GST ({invoiceData.caseDetails?.bankGstPercent}%):</span>
                        <strong>+{currencyFormatter.format(invoiceData.caseDetails?.gstAmount || 0)}</strong>
                      </div>
                      <div className="cc-inv-trow gross">
                        <span>Gross Invoice Value:</span>
                        <strong>{currencyFormatter.format(invoiceData.caseDetails?.grossInvoiceValue || 0)}</strong>
                      </div>
                      <div className="cc-inv-trow">
                        <span>Less TDS ({invoiceData.caseDetails?.bankTdsPercent}%):</span>
                        <strong style={{ color: "#dc2626" }}>
                          -{currencyFormatter.format(invoiceData.caseDetails?.tdsAmount || 0)}
                        </strong>
                      </div>
                      <div className="cc-inv-trow net">
                        <span>Net Payable by Bank:</span>
                        <strong>{currencyFormatter.format(invoiceData.caseDetails?.netReceivableFromBank || 0)}</strong>
                      </div>
                    </div>
                  </div>

                  {/* Signatory Footer */}
                  <div className="cc-inv-footer">
                    <div>
                      <p style={{ fontSize: 11, color: "#64748b" }}>
                        Terms: Payment due within 15 days of invoice date. Computer generated document.
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 12, fontWeight: 700, color: "#0f172a" }}>
                        For {invoiceData.company?.name}
                      </p>
                      <div style={{ height: 45 }} />
                      <p style={{ fontSize: 11, color: "#475569", borderTop: "1px solid #cbd5e1", paddingTop: 4 }}>
                        Authorized Signatory
                      </p>
                    </div>
                  </div>
                </div>
              ) : (
                /* VIEW 2: CONNECTOR PAYOUT VOUCHER / SLIP */
                <div className="cc-printable-invoice" id="printable-connector-slip">
                  <div className="cc-inv-header">
                    <div>
                      <h2 className="cc-inv-company-name">{invoiceData.company?.name}</h2>
                      <p className="cc-inv-company-sub">Channel Partner &amp; Connector Payout Voucher</p>
                      <p className="cc-inv-meta-line">{invoiceData.company?.address}</p>
                      {invoiceData.company?.gstin && (
                        <p className="cc-inv-meta-line">
                          GSTIN: <strong>{invoiceData.company?.gstin}</strong> | PAN: <strong>{invoiceData.company?.pan}</strong>
                        </p>
                      )}
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div className="cc-inv-title-badge" style={{ background: "#7c3aed" }}>
                        PAYOUT VOUCHER
                      </div>
                      <div className="cc-inv-prop-row">
                        <span>Voucher Ref:</span>
                        <strong>VCH-{invoiceData.caseDetails?.leadId}</strong>
                      </div>
                      <div className="cc-inv-prop-row">
                        <span>Date:</span>
                        <strong>{new Date().toLocaleDateString("en-IN")}</strong>
                      </div>
                    </div>
                  </div>

                  <div className="cc-inv-billto-grid">
                    <div className="cc-bill-box">
                      <small>PAYEE / CONNECTOR:</small>
                      <strong>{invoiceData.connectorDetails?.partyName}</strong>
                      <p>Party Code: <strong>{invoiceData.connectorDetails?.partyCode || "—"}</strong></p>
                    </div>
                    <div className="cc-bill-box">
                      <small>BORROWER &amp; LOAN REFERENCE:</small>
                      <strong>{invoiceData.caseDetails?.customerName}</strong>
                      <p>Loan Product: {invoiceData.caseDetails?.loanProduct}</p>
                      <p>Disbursed Base: {currencyFormatter.format(invoiceData.caseDetails?.baseAmount || 0)}</p>
                    </div>
                  </div>

                  <table className="cc-inv-items-table">
                    <thead>
                      <tr>
                        <th>Case Ref</th>
                        <th>Borrower</th>
                        <th>Credit Base</th>
                        <th>Comm Rate</th>
                        <th>Gross Due</th>
                        <th>TDS</th>
                        <th>GST</th>
                        <th>Charges</th>
                        <th style={{ textAlign: "right" }}>Net Payable (₹)</th>
                      </tr>
                    </thead>
                    <tbody>
                      <tr>
                        <td>Lead #{invoiceData.caseDetails?.leadId}</td>
                        <td>{invoiceData.caseDetails?.customerName}</td>
                        <td>{currencyFormatter.format(invoiceData.caseDetails?.baseAmount || 0)}</td>
                        <td>{invoiceData.connectorDetails?.partyCommissionPercent}%</td>
                        <td>{currencyFormatter.format(invoiceData.connectorDetails?.partyCommissionDue || 0)}</td>
                        <td style={{ color: "#dc2626" }}>-{currencyFormatter.format(invoiceData.connectorDetails?.partyTdsAmount || 0)}</td>
                        <td style={{ color: "#dc2626" }}>-{currencyFormatter.format(invoiceData.connectorDetails?.partyGstAmount || 0)}</td>
                        <td style={{ color: "#b45309" }}>-{currencyFormatter.format(invoiceData.connectorDetails?.extraCharges || 0)}</td>
                        <td style={{ textAlign: "right" }}>
                          <strong style={{ color: "#7c3aed" }}>
                            {currencyFormatter.format(invoiceData.connectorDetails?.netPayableToParty || 0)}
                          </strong>
                        </td>
                      </tr>
                    </tbody>
                  </table>

                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", background: "#f8fafc", padding: "14px 18px", borderRadius: 8, margin: "18px 0" }}>
                    <div>
                      <small style={{ color: "#64748b" }}>Amount Paid So Far:</small>
                      <div style={{ fontSize: 15, fontWeight: 800, color: "#047857" }}>
                        {currencyFormatter.format(invoiceData.connectorDetails?.partyPaidAmount || 0)}
                      </div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <small style={{ color: "#64748b" }}>Remaining Balance Due:</small>
                      <div style={{ fontSize: 16, fontWeight: 800, color: "#b45309" }}>
                        {currencyFormatter.format(invoiceData.connectorDetails?.partyRemainingDue || 0)}
                      </div>
                    </div>
                  </div>

                  <div className="cc-inv-footer">
                    <div>
                      <p style={{ fontSize: 11, color: "#64748b" }}>
                        Receiver's Signature: _______________________
                      </p>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <p style={{ fontSize: 12, fontWeight: 700 }}>For {invoiceData.company?.name}</p>
                      <div style={{ height: 40 }} />
                      <p style={{ fontSize: 11, color: "#475569", borderTop: "1px solid #cbd5e1" }}>
                        Authorized Signatory
                      </p>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ADD / RECORD CASE PAYOUT MODAL */}
      {addPayoutModalOpen && (
        <div className="cc-modal-overlay" onClick={() => setAddPayoutModalOpen(false)}>
          <div className="cc-modal-box" style={{ maxWidth: 740, maxHeight: "90vh", overflowY: "auto" }} onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-header" style={{ position: "sticky", top: 0, background: "#fff", zIndex: 10, borderBottom: "1px solid #e2e8f0" }}>
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>Record Case Payout</h3>
                  <span style={{ background: "#ecfdf5", color: "#047857", fontSize: 11, fontWeight: 700, padding: "2px 8px", borderRadius: 999, border: "1px solid #a7f3d0" }}>
                    Disbursement &amp; Billing
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Record disbursed loan case, bank commission receivable, party sourcing share &amp; margin
                </p>
              </div>
              <button
                type="button"
                className="cc-modal-close"
                onClick={() => setAddPayoutModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleAddPayoutSubmit} className="cc-modal-form" style={{ padding: "16px 20px" }}>
              {/* BULK EXCEL SHORTCUT BANNER */}
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
                  padding: "10px 14px",
                  borderRadius: 8,
                  border: "1px solid #bbf7d0",
                  marginBottom: 14,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <FileSpreadsheet size={18} color="#15803d" />
                  <span style={{ fontSize: 12.5, color: "#166534", fontWeight: 600 }}>
                    Adding multiple loan cases? You can bulk import via Excel with sample template!
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setAddPayoutModalOpen(false);
                    resetBulkUpload();
                    setBulkUploadModalOpen(true);
                  }}
                  style={{
                    background: "#16a34a",
                    color: "#ffffff",
                    border: "none",
                    padding: "5px 12px",
                    borderRadius: 6,
                    fontSize: 12,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 5,
                    whiteSpace: "nowrap",
                    boxShadow: "0 1px 3px rgba(22,163,74,0.3)",
                  }}
                >
                  <Upload size={13} /> Excel Import
                </button>
              </div>

              {/* SECTION 0: LINK TO AN EXISTING LEAD (OPTIONAL SHORTCUT) */}
              <div style={{ background: "#f8fafc", padding: "12px 14px", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 6 }}>
                  <label style={{ fontSize: 12, fontWeight: 700, color: "#334155", display: "flex", alignItems: "center", gap: 6 }}>
                    <LinkIcon size={14} color="#0284c7" /> ⚡ Link to Existing Lead (Optional Auto-Fill)
                  </label>
                  {selectedLeadId && (
                    <button
                      type="button"
                      onClick={() => handleSelectLead("")}
                      style={{ fontSize: 11, color: "#ef4444", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}
                    >
                      Clear Selection
                    </button>
                  )}
                </div>
                <select
                  value={selectedLeadId}
                  onChange={(e) => handleSelectLead(e.target.value)}
                  style={{
                    width: "100%",
                    padding: "8px 10px",
                    borderRadius: 8,
                    border: "1px solid #cbd5e1",
                    fontSize: 13,
                    background: "#fff",
                    color: "#0f172a",
                  }}
                  disabled={loadingLeads}
                >
                  <option value="">-- Choose from existing leads or create fresh case below --</option>
                  {leadsList.map((ld) => {
                    const cName = ld.customer?.name || ld.name || "Customer";
                    const cAmt = ld.sanctioned_amount || ld.requiredAmount || 0;
                    const cBank = ld.bank_name || ld.applications?.[0]?.lender?.name || "";
                    const cType = ld.loanType || "";
                    return (
                      <option key={ld.id} value={ld.id}>
                        Lead #{ld.id} — {cName} ({cType}{cAmt ? ` • ₹${numberFormatter.format(cAmt)}` : ""}{cBank ? ` • ${cBank}` : ""})
                      </option>
                    );
                  })}
                </select>
                {loadingLeads && (
                  <small style={{ color: "#64748b", display: "block", marginTop: 4 }}>
                    <RefreshCw size={11} className="cc-spin" /> Loading company leads...
                  </small>
                )}
              </div>

              {/* TOP SEGMENTED SWITCHER: SELF / DIRECT VS VENDOR / CONNECTOR */}
              <div style={{ display: "flex", gap: 10, background: "#f1f5f9", padding: "6px", borderRadius: 10, marginBottom: 14 }}>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12.5,
                    border: "1px solid",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: addForm.payoutType === "SELF" ? "#4f46e5" : "transparent",
                    color: addForm.payoutType === "SELF" ? "#fff" : "#475569",
                    borderColor: addForm.payoutType === "SELF" ? "#4338ca" : "transparent",
                    boxShadow: addForm.payoutType === "SELF" ? "0 2px 4px rgba(79,70,229,0.25)" : "none",
                    transition: "all 0.15s",
                  }}
                  onClick={() => recomputeAddForm({ payoutType: "SELF", partyName: "Self" })}
                >
                  <Building2 size={15} /> 🏢 Self / Direct Case
                </button>
                <button
                  type="button"
                  style={{
                    flex: 1,
                    padding: "9px 12px",
                    borderRadius: 8,
                    fontWeight: 700,
                    fontSize: 12.5,
                    border: "1px solid",
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    gap: 6,
                    background: addForm.payoutType === "VENDOR" ? "#7c3aed" : "transparent",
                    color: addForm.payoutType === "VENDOR" ? "#fff" : "#475569",
                    borderColor: addForm.payoutType === "VENDOR" ? "#6d28d9" : "transparent",
                    boxShadow: addForm.payoutType === "VENDOR" ? "0 2px 4px rgba(124,58,237,0.25)" : "none",
                    transition: "all 0.15s",
                  }}
                  onClick={() =>
                    recomputeAddForm({
                      payoutType: "VENDOR",
                      partyName: addForm.partyName && addForm.partyName.toLowerCase() !== "self" ? addForm.partyName : "Direct",
                    })
                  }
                >
                  <Wallet size={15} /> 🤝 Channel Partner / Connector Case
                </button>
              </div>

              {/* SECTION 1: CUSTOMER & DEAL DETAILS */}
              <div style={{ background: "#f8fafc", padding: "14px", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 14 }}>
                <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6, marginBottom: 10 }}>
                  <User size={15} color="#2563eb" /> 1. Customer &amp; Loan Disbursal Details
                </strong>

                <div className="cc-form-row" style={{ gridTemplateColumns: "1.4fr 1.2fr 1fr" }}>
                  <div className="cc-fgroup">
                    <label>Customer Full Name *</label>
                    <input
                      type="text"
                      required
                      placeholder="e.g. Ramesh Kumar"
                      value={addForm.customerName}
                      onChange={(e) => setAddForm({ ...addForm, customerName: e.target.value })}
                    />
                  </div>
                  <div className="cc-fgroup">
                    <label>Customer Email</label>
                    <input
                      type="email"
                      placeholder="e.g. ramesh@example.com"
                      value={addForm.customerEmail}
                      onChange={(e) => setAddForm({ ...addForm, customerEmail: e.target.value })}
                    />
                  </div>
                  <div className="cc-fgroup">
                    <label>Customer Mobile</label>
                    <input
                      type="text"
                      placeholder="e.g. 9876543210"
                      value={addForm.customerMobile}
                      onChange={(e) => setAddForm({ ...addForm, customerMobile: e.target.value })}
                    />
                  </div>
                </div>

                <div className="cc-form-row" style={{ gridTemplateColumns: "1fr 1fr 1.2fr 1fr", marginTop: 8 }}>
                  <div className="cc-fgroup">
                    <label>Loan Product / Type</label>
                    <select
                      value={addForm.loanProduct}
                      onChange={(e) => setAddForm({ ...addForm, loanProduct: e.target.value })}
                    >
                      <option value="">-- Select Loan Product --</option>
                      {loanProductsList && loanProductsList.length > 0 ? (
                        loanProductsList.map((p) => {
                          const val = p.label || p.value || p.configLabel || p.configValue;
                          return (
                            <option key={p.id || val} value={val}>
                              {p.label || p.value || p.configLabel || p.configValue}
                            </option>
                          );
                        })
                      ) : (
                        <>
                          <option value="Personal Loan">Personal Loan</option>
                          <option value="Business Loan">Business Loan</option>
                          <option value="Home Loan">Home Loan</option>
                          <option value="Loan Against Property (LAP)">Loan Against Property (LAP)</option>
                          <option value="Car Loan">Car Loan</option>
                          <option value="Gold Loan">Gold Loan</option>
                          <option value="Education Loan">Education Loan</option>
                          <option value="Professional Loan">Professional Loan</option>
                        </>
                      )}
                      {addForm.loanProduct && loanProductsList.length > 0 && !loanProductsList.some(p => (p.label || p.value || p.configValue || p.configLabel || "").toLowerCase() === addForm.loanProduct.toLowerCase()) && (
                        <option value={addForm.loanProduct}>{addForm.loanProduct} (Current)</option>
                      )}
                    </select>
                  </div>

                  <div className="cc-fgroup">
                    <label>Bank / Lender Name *</label>
                    <input
                      type="text"
                      list="bankSuggestions"
                      required
                      placeholder="e.g. HDFC Bank"
                      value={addForm.bankName}
                      onChange={(e) => setAddForm({ ...addForm, bankName: e.target.value })}
                    />
                    <datalist id="bankSuggestions">
                      <option value="HDFC Bank" />
                      <option value="ICICI Bank" />
                      <option value="Axis Bank" />
                      <option value="State Bank of India (SBI)" />
                      <option value="Kotak Mahindra Bank" />
                      <option value="Bajaj Finserv" />
                      <option value="Tata Capital" />
                      <option value="IDFC First Bank" />
                      <option value="Punjab National Bank" />
                      <option value="Bank of Baroda" />
                    </datalist>
                  </div>

                  <div className="cc-fgroup">
                    <label>Loan Amount Disbursed (₹) *</label>
                    <input
                      type="number"
                      step="0.01"
                      min="1"
                      required
                      placeholder="e.g. 500000"
                      value={addForm.loanAmount}
                      onChange={(e) => recomputeAddForm({ loanAmount: e.target.value })}
                    />
                  </div>

                  <div className="cc-fgroup">
                    <label>Disbursal Date</label>
                    <input
                      type="date"
                      value={addForm.disbursalDate}
                      onChange={(e) => setAddForm({ ...addForm, disbursalDate: e.target.value })}
                    />
                  </div>
                </div>
              </div>

              {/* SECTION 2: BANK COMMISSION, CORPORATE DSA & NET INFLOW */}
              <div style={{ background: "#f0fdf4", padding: "14px", borderRadius: 10, border: "1px solid #bbf7d0", marginBottom: 14 }}>
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                  <strong style={{ fontSize: 13, color: "#166534", display: "flex", alignItems: "center", gap: 6 }}>
                    <Building2 size={15} color="#166534" /> 2. Bank Commission, Corporate DSA &amp; Net Inflow
                  </strong>
                  <span style={{ fontSize: 11, color: "#15803d", fontWeight: 600 }}>
                    Gross me se Corporate DSA cut hoga, Actual Amount pe TDS minus hokar Net aayega (GST alag rahega)
                  </span>
                </div>

                <div className="cc-form-row" style={{ gridTemplateColumns: "0.8fr 1.2fr 1fr 1fr 1.2fr" }}>
                  <div className="cc-fgroup">
                    <label>Bank Comm (%)</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={addForm.bankCommissionPercent}
                      onChange={(e) => recomputeAddForm({ bankCommissionPercent: e.target.value })}
                    />
                  </div>

                  <div className="cc-fgroup">
                    <label>Gross Base (₹)</label>
                    <input
                      type="number"
                      step="0.01"
                      value={addForm.baseAmount}
                      onChange={(e) => recomputeAddForm({ baseAmount: e.target.value })}
                    />
                  </div>

                  <div className="cc-fgroup">
                    <label>Corp DSA %</label>
                    <input
                      type="number"
                      step="0.01"
                      min="0"
                      max="100"
                      value={addForm.corporateDsaPercent}
                      onChange={(e) => recomputeAddForm({ corporateDsaPercent: e.target.value })}
                    />
                    <small style={{ color: "#dc2626", fontSize: 10.5, fontWeight: 600 }}>
                      -₹{numberFormatter.format(addForm.corporateDsaAmount || 0)}
                    </small>
                  </div>

                  <div className="cc-fgroup">
                    <label style={{ color: "#166534", fontWeight: 700 }}>Actual Amount (₹)</label>
                    <div style={{ fontSize: 13, fontWeight: 800, color: "#166534", padding: "6px 0" }}>
                      {currencyFormatter.format(addForm.actualAmount || 0)}
                    </div>
                  </div>

                  <div className="cc-fgroup">
                    <label>TDS (5%) Deduct</label>
                    <div style={{ fontSize: 12.5, fontWeight: 700, color: "#dc2626", padding: "6px 0" }}>
                      -{currencyFormatter.format(addForm.bankTdsAmount || 0)}
                    </div>
                  </div>
                </div>

                <div
                  style={{
                    marginTop: 10,
                    padding: "8px 12px",
                    background: "#dcfce7",
                    border: "1px solid #86efac",
                    borderRadius: 6,
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 6,
                  }}
                >
                  <div style={{ fontSize: 11.5, color: "#166534" }}>
                    <strong>Net Inflow: </strong> Actual ₹{numberFormatter.format(addForm.actualAmount || 0)} − TDS ₹{numberFormatter.format(addForm.bankTdsAmount || 0)}
                    <span style={{ marginLeft: 10, color: "#2563eb", fontWeight: 600 }}>
                      | GST (Separate): ₹{numberFormatter.format(addForm.bankGstAmount || 0)}
                    </span>
                  </div>
                  <strong style={{ fontSize: 15, color: "#047857" }}>
                    {currencyFormatter.format(addForm.bankNetReceivable || 0)}
                  </strong>
                </div>
              </div>

              {/* SECTION 3: SOURCING CHANNEL / CONNECTOR PAYOUT */}
              {addForm.payoutType === "VENDOR" ? (
                <div style={{ background: "#faf5ff", padding: "14px", borderRadius: 10, border: "1px solid #e9d5ff", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
                    <strong style={{ fontSize: 13, color: "#6b21a8", display: "flex", alignItems: "center", gap: 6 }}>
                      <Wallet size={15} color="#6b21a8" /> 3. Sourcing Partner / Connector Share
                    </strong>
                    <span style={{ fontSize: 11, color: "#7e22ce", fontWeight: 600 }}>
                      Calculated on Bank Net Receivable ({currencyFormatter.format(addForm.bankNetReceivable || 0)})
                    </span>
                  </div>

                  <div className="cc-form-row" style={{ gridTemplateColumns: "1.4fr 1fr 1fr 1.2fr" }}>
                    <div className="cc-fgroup">
                      <label>Party / Connector Name *</label>
                      <input
                        type="text"
                        placeholder="e.g. Direct / DSA Partner Name"
                        value={addForm.partyName}
                        onChange={(e) => setAddForm({ ...addForm, partyName: e.target.value })}
                      />
                    </div>

                    <div className="cc-fgroup">
                      <label>Party Code (Optional)</label>
                      <input
                        type="text"
                        placeholder="e.g. PTY-001"
                        value={addForm.partyCode}
                        onChange={(e) => setAddForm({ ...addForm, partyCode: e.target.value })}
                      />
                    </div>

                    <div className="cc-fgroup">
                      <label>Party Share (%)</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max="100"
                        value={addForm.partyCommissionPercent}
                        onChange={(e) => recomputeAddForm({ partyCommissionPercent: e.target.value })}
                      />
                    </div>

                    <div className="cc-fgroup">
                      <label>Party Net Payable</label>
                      <div style={{ fontSize: 14, fontWeight: 800, color: "#7c3aed", padding: "7px 0" }}>
                        {currencyFormatter.format(addForm.partyNetPayable || 0)}
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                <div style={{ background: "#eef2ff", padding: "14px", borderRadius: 10, border: "1px solid #c7d2fe", marginBottom: 14 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <strong style={{ fontSize: 13, color: "#3730a3", display: "flex", alignItems: "center", gap: 6 }}>
                        <Building2 size={15} color="#3730a3" /> In-House Deal (Self Sourced)
                      </strong>
                      <p style={{ margin: "4px 0 0", fontSize: 11.5, color: "#4f46e5" }}>
                        No connector commission is payable. Entire bank net receivable is retained as company earnings.
                      </p>
                    </div>
                    <span style={{ fontSize: 13, fontWeight: 800, color: "#3730a3" }}>
                      Vendor Share: ₹0
                    </span>
                  </div>
                </div>
              )}

              {/* SECTION 4: REAL-TIME SUMMARY BREAKDOWN CARD */}
              <div style={{ background: "#f8fafc", padding: "14px 18px", borderRadius: 10, border: "1px solid #e2e8f0", marginBottom: 14 }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 12 }}>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Loan Disbursed
                    </span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#0f172a" }}>
                      {currencyFormatter.format(parseFloat(addForm.loanAmount) || 0)}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Bank Inflow (Net)
                    </span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#059669" }}>
                      {currencyFormatter.format(addForm.bankNetReceivable || 0)}
                    </div>
                  </div>
                  <div>
                    <span style={{ fontSize: 11, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>
                      Party Payout
                    </span>
                    <div style={{ fontSize: 16, fontWeight: 800, color: "#7c3aed" }}>
                      {currencyFormatter.format(addForm.partyNetPayable || 0)}
                    </div>
                  </div>
                  <div style={{ borderLeft: "2px solid #cbd5e1", paddingLeft: 16 }}>
                    <span style={{ fontSize: 11, color: "#047857", textTransform: "uppercase", fontWeight: 800 }}>
                      Net Company Margin
                    </span>
                    <div style={{ fontSize: 18, fontWeight: 900, color: "#047857" }}>
                      {currencyFormatter.format(addForm.netMargin || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* NOTES */}
              <div className="cc-fgroup" style={{ marginBottom: 14 }}>
                <label>Notes / Internal Remarks</label>
                <textarea
                  rows={2}
                  placeholder="Optional internal remarks about this case payout..."
                  value={addForm.notes}
                  onChange={(e) => setAddForm({ ...addForm, notes: e.target.value })}
                />
              </div>

              {/* ACTIONS */}
              <div className="cc-modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="cc-pbtn secondary"
                  onClick={() => setAddPayoutModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-pbtn primary"
                  disabled={savingNewPayout}
                  style={{
                    background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                    color: "#fff",
                    borderColor: "#059669",
                    fontWeight: 700,
                    minWidth: 160,
                  }}
                >
                  {savingNewPayout ? (
                    <>
                      <RefreshCw size={14} className="cc-spin" /> Recording Payout...
                    </>
                  ) : (
                    <>
                      <CheckCircle2 size={15} /> Save &amp; Record Case Payout
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BULK EXCEL UPLOAD MODAL */}
      {bulkUploadModalOpen && (
        <div className="cc-modal-overlay" onClick={() => setBulkUploadModalOpen(false)}>
          <div
            className="cc-modal-box"
            style={{ maxWidth: 960, width: "95%", maxHeight: "92vh", overflowY: "auto" }}
            onClick={(e) => e.stopPropagation()}
          >
            <div
              className="cc-modal-header"
              style={{
                position: "sticky",
                top: 0,
                background: "#fff",
                zIndex: 10,
                borderBottom: "1px solid #e2e8f0",
                display: "flex",
                justifyContent: "space-between",
                alignItems: "center",
                padding: "16px 20px",
              }}
            >
              <div>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <h3 style={{ margin: 0, fontSize: 18, fontWeight: 800, color: "#0f172a" }}>
                    Bulk Import Disbursed Cases from Excel
                  </h3>
                  <span
                    style={{
                      background: "#ecfdf5",
                      color: "#047857",
                      fontSize: 11,
                      fontWeight: 700,
                      padding: "2px 8px",
                      borderRadius: 999,
                      border: "1px solid #a7f3d0",
                    }}
                  >
                    Excel / CSV Upload
                  </span>
                </div>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Upload multiple loan disbursal cases at once. Financials, bank receivables, vendor payouts &amp; margins calculate automatically.
                </p>
              </div>
              <button
                type="button"
                className="cc-modal-close"
                onClick={() => setBulkUploadModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <div style={{ padding: "20px" }}>
              {/* STEP 1: DOWNLOAD SAMPLE EXCEL BANNER */}
              <div
                style={{
                  background: "linear-gradient(135deg, #f0fdf4 0%, #ecfdf5 100%)",
                  border: "1px solid #bbf7d0",
                  borderRadius: 10,
                  padding: "14px 18px",
                  marginBottom: 20,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "space-between",
                  flexWrap: "wrap",
                  gap: 12,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", gap: 12 }}>
                  <div
                    style={{
                      background: "#dcfce7",
                      color: "#166534",
                      borderRadius: 8,
                      padding: "9px",
                      display: "flex",
                    }}
                  >
                    <FileSpreadsheet size={24} />
                  </div>
                  <div>
                    <h4 style={{ margin: "0 0 3px", fontSize: 14, fontWeight: 700, color: "#166534" }}>
                      Step 1: Download Sample Excel Template (With Realistic Sample Data)
                    </h4>
                    <p style={{ margin: 0, fontSize: 12.5, color: "#15803d" }}>
                      Download our ready-to-fill template pre-populated with sample cases (Self case, Vendor/DSA case) to match column headers accurately.
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={downloadSampleExcelTemplate}
                  style={{
                    background: "#16a34a",
                    color: "#ffffff",
                    border: "none",
                    borderRadius: 8,
                    padding: "9px 16px",
                    fontSize: 13,
                    fontWeight: 700,
                    cursor: "pointer",
                    display: "flex",
                    alignItems: "center",
                    gap: 8,
                    boxShadow: "0 2px 5px rgba(22,163,74,0.3)",
                  }}
                >
                  <Download size={16} /> Download Sample Template (.xlsx)
                </button>
              </div>

              {/* STEP 2: UPLOAD FILE AREA / DROPZONE */}
              <div style={{ marginBottom: 20 }}>
                <label
                  style={{
                    display: "block",
                    fontSize: 13,
                    fontWeight: 700,
                    color: "#334155",
                    marginBottom: 8,
                  }}
                >
                  Step 2: Upload Your Excel File (.xlsx, .xls, .csv)
                </label>
                <div
                  style={{
                    border: "2px dashed #cbd5e1",
                    borderRadius: 12,
                    padding: "26px 20px",
                    textAlign: "center",
                    background: "#f8fafc",
                    position: "relative",
                    cursor: "pointer",
                    transition: "all 0.2s ease",
                  }}
                  onDragOver={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "#0284c7";
                    e.currentTarget.style.background = "#f0f9ff";
                  }}
                  onDragLeave={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.background = "#f8fafc";
                  }}
                  onDrop={(e) => {
                    e.preventDefault();
                    e.currentTarget.style.borderColor = "#cbd5e1";
                    e.currentTarget.style.background = "#f8fafc";
                    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
                      handleExcelFileChange({ target: { files: e.dataTransfer.files } });
                    }
                  }}
                >
                  <input
                    type="file"
                    accept=".xlsx, .xls, .csv"
                    onChange={handleExcelFileChange}
                    style={{
                      position: "absolute",
                      top: 0,
                      left: 0,
                      width: "100%",
                      height: "100%",
                      opacity: 0,
                      cursor: "pointer",
                    }}
                  />
                  <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 8 }}>
                    <div
                      style={{
                        background: "#e0f2fe",
                        color: "#0369a1",
                        borderRadius: "50%",
                        padding: 12,
                        display: "inline-flex",
                      }}
                    >
                      <Upload size={28} />
                    </div>
                    <div style={{ fontSize: 14, fontWeight: 700, color: "#1e293b" }}>
                      {bulkUploadedFile ? bulkUploadedFile.name : "Click to browse or drag and drop your Excel sheet here"}
                    </div>
                    <div style={{ fontSize: 12, color: "#64748b" }}>
                      {bulkUploadedFile
                        ? `${(bulkUploadedFile.size / 1024).toFixed(1)} KB • Click or drop another file to change`
                        : "Supports .xlsx, .xls, and .csv files"}
                    </div>
                  </div>
                </div>
              </div>

              {isReadingExcel && (
                <div style={{ textAlign: "center", padding: "20px 0", color: "#0284c7" }}>
                  <RefreshCw size={24} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                  <p style={{ marginTop: 8, fontSize: 13, fontWeight: 600 }}>Reading and validating Excel sheet...</p>
                </div>
              )}

              {/* STEP 3: PREVIEW OF PARSED ROWS */}
              {bulkParsedRows.length > 0 && (
                <div style={{ marginTop: 20 }}>
                  {/* KPI SUMMARY CARDS */}
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 12,
                      marginBottom: 16,
                    }}
                  >
                    <div
                      style={{
                        background: "#f8fafc",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #e2e8f0",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#64748b", fontWeight: 700 }}>TOTAL ROWS</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#0f172a", marginTop: 2 }}>
                        {bulkParsedRows.length}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#f0fdf4",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #bbf7d0",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#166534", fontWeight: 700 }}>READY TO IMPORT</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#15803d", marginTop: 2 }}>
                        {bulkParsedRows.filter((r) => r.isValid).length}
                      </div>
                    </div>

                    {bulkParsedRows.filter((r) => !r.isValid).length > 0 && (
                      <div
                        style={{
                          background: "#fef2f2",
                          padding: "10px 14px",
                          borderRadius: 8,
                          border: "1px solid #fecaca",
                        }}
                      >
                        <div style={{ fontSize: 11, color: "#991b1b", fontWeight: 700 }}>ERRORS / SKIPPED</div>
                        <div style={{ fontSize: 18, fontWeight: 800, color: "#dc2626", marginTop: 2 }}>
                          {bulkParsedRows.filter((r) => !r.isValid).length}
                        </div>
                      </div>
                    )}

                    <div
                      style={{
                        background: "#eff6ff",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #bfdbfe",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#1e40af", fontWeight: 700 }}>TOTAL LOAN VOLUME</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#1d4ed8", marginTop: 2 }}>
                        ₹
                        {numberFormatter.format(
                          bulkParsedRows
                            .filter((r) => r.isValid)
                            .reduce((sum, r) => sum + (parseFloat(r.loanAmount) || 0), 0)
                        )}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fdf4ff",
                        padding: "10px 14px",
                        borderRadius: 8,
                        border: "1px solid #f0abfc",
                      }}
                    >
                      <div style={{ fontSize: 11, color: "#86198f", fontWeight: 700 }}>EST. NET MARGIN</div>
                      <div style={{ fontSize: 18, fontWeight: 800, color: "#a21caf", marginTop: 2 }}>
                        ₹
                        {numberFormatter.format(
                          bulkParsedRows
                            .filter((r) => r.isValid)
                            .reduce((sum, r) => sum + (parseFloat(r.netMargin) || 0), 0)
                        )}
                      </div>
                    </div>
                  </div>

                  {/* PREVIEW TABLE */}
                  <div
                    style={{
                      border: "1px solid #e2e8f0",
                      borderRadius: 8,
                      overflowX: "auto",
                      maxHeight: 340,
                      overflowY: "auto",
                    }}
                  >
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12 }}>
                      <thead>
                        <tr
                          style={{
                            background: "#f8fafc",
                            borderBottom: "1px solid #e2e8f0",
                            position: "sticky",
                            top: 0,
                            zIndex: 2,
                          }}
                        >
                          <th style={{ padding: "8px 10px", textAlign: "center" }}>#</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Status</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Customer Name</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Mobile</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Loan Product</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Bank / Lender</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Loan Disbursed</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Bank Comm %</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Net Receivable</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Party / Sourcing</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Party Payable</th>
                          <th style={{ padding: "8px 10px", textAlign: "right" }}>Net Margin</th>
                          <th style={{ padding: "8px 10px", textAlign: "left" }}>Disbursal Date</th>
                        </tr>
                      </thead>
                      <tbody>
                        {bulkParsedRows.map((r, i) => (
                          <tr
                            key={i}
                            style={{
                              borderBottom: "1px solid #f1f5f9",
                              background: r.isValid ? (i % 2 === 0 ? "#ffffff" : "#fcfcfc") : "#fff1f2",
                            }}
                          >
                            <td style={{ padding: "8px 10px", textAlign: "center", color: "#64748b" }}>
                              {r.rowIndex}
                            </td>
                            <td style={{ padding: "8px 10px" }}>
                              {r.isValid ? (
                                <span
                                  style={{
                                    background: "#dcfce7",
                                    color: "#166534",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                  }}
                                >
                                  ✓ Valid
                                </span>
                              ) : (
                                <span
                                  style={{
                                    background: "#fee2e2",
                                    color: "#991b1b",
                                    fontSize: 10,
                                    fontWeight: 700,
                                    padding: "2px 6px",
                                    borderRadius: 4,
                                  }}
                                  title={r.issues.join(", ")}
                                >
                                  ⚠ {r.issues[0]}
                                </span>
                              )}
                            </td>
                            <td style={{ padding: "8px 10px", fontWeight: 600, color: "#0f172a" }}>
                              {r.customerName || "—"}
                            </td>
                            <td style={{ padding: "8px 10px", color: "#475569" }}>{r.customerMobile || "—"}</td>
                            <td style={{ padding: "8px 10px", color: "#475569" }}>{r.loanProduct}</td>
                            <td style={{ padding: "8px 10px", color: "#475569" }}>{r.bankName}</td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#047857" }}>
                              ₹{numberFormatter.format(r.loanAmount || 0)}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#475569" }}>
                              {r.bankCommissionPercent}%
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 600, color: "#1d4ed8" }}>
                              ₹{numberFormatter.format(r.bankNetReceivable || 0)}
                            </td>
                            <td style={{ padding: "8px 10px", color: "#475569" }}>
                              {r.partyName} {r.partyCode ? `(${r.partyCode})` : ""}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", color: "#b91c1c" }}>
                              ₹{numberFormatter.format(r.partyNetPayable || 0)}
                            </td>
                            <td style={{ padding: "8px 10px", textAlign: "right", fontWeight: 700, color: "#15803d" }}>
                              ₹{numberFormatter.format(r.netMargin || 0)}
                            </td>
                            <td style={{ padding: "8px 10px", color: "#64748b" }}>{r.disbursalDate || "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>

                  {/* IMPORT RESULT NOTIFICATION */}
                  {bulkImportResult && (
                    <div
                      style={{
                        marginTop: 16,
                        padding: "12px 16px",
                        borderRadius: 8,
                        background: bulkImportResult.failedCount === 0 ? "#f0fdf4" : "#fffbeb",
                        border: `1px solid ${bulkImportResult.failedCount === 0 ? "#86efac" : "#fde68a"}`,
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 8,
                          fontWeight: 700,
                          color: bulkImportResult.failedCount === 0 ? "#166534" : "#b45309",
                        }}
                      >
                        <CheckCircle2 size={18} />
                        <span>{bulkImportResult.message}</span>
                      </div>
                      {bulkImportResult.errors && bulkImportResult.errors.length > 0 && (
                        <div style={{ marginTop: 8, fontSize: 12, color: "#b91c1c" }}>
                          <div style={{ fontWeight: 600 }}>Failed rows details:</div>
                          <ul style={{ margin: "4px 0 0", paddingLeft: 20 }}>
                            {bulkImportResult.errors.map((err, idx) => (
                              <li key={idx}>
                                Row {err.row} ({err.customerName}): {err.error}
                              </li>
                            ))}
                          </ul>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              )}

              {/* MODAL FOOTER */}
              <div
                style={{
                  marginTop: 24,
                  paddingTop: 16,
                  borderTop: "1px solid #e2e8f0",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                }}
              >
                <div>
                  {bulkParsedRows.length > 0 && (
                    <button
                      type="button"
                      onClick={resetBulkUpload}
                      disabled={isSubmittingBulk}
                      style={{
                        background: "none",
                        border: "none",
                        color: "#64748b",
                        fontSize: 13,
                        cursor: "pointer",
                        fontWeight: 600,
                        textDecoration: "underline",
                      }}
                    >
                      Clear / Choose another file
                    </button>
                  )}
                </div>

                <div style={{ display: "flex", gap: 10 }}>
                  <button
                    type="button"
                    className="cc-pbtn secondary"
                    onClick={() => setBulkUploadModalOpen(false)}
                    disabled={isSubmittingBulk}
                  >
                    Close
                  </button>
                  <button
                    type="button"
                    className="cc-pbtn primary"
                    onClick={handleBulkImportSubmit}
                    disabled={
                      isSubmittingBulk ||
                      bulkParsedRows.filter((r) => r.isValid).length === 0 ||
                      (bulkImportResult && bulkImportResult.importedCount > 0)
                    }
                    style={{
                      background: "linear-gradient(135deg, #059669 0%, #047857 100%)",
                      color: "#ffffff",
                      borderColor: "#059669",
                      fontWeight: 700,
                      boxShadow: "0 2px 6px rgba(5,150,105,0.25)",
                      display: "flex",
                      alignItems: "center",
                      gap: 6,
                    }}
                  >
                    {isSubmittingBulk ? (
                      <>
                        <RefreshCw size={15} className="spin" style={{ animation: "spin 1s linear infinite" }} />
                        Importing Cases...
                      </>
                    ) : bulkImportResult && bulkImportResult.importedCount > 0 ? (
                      <>
                        <CheckCircle2 size={15} /> Cases Imported!
                      </>
                    ) : (
                      <>
                        <Upload size={15} />
                        Import {bulkParsedRows.filter((r) => r.isValid).length || 0} Case(s) to CRM
                      </>
                    )}
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MODAL 5: UPDATE GST STATUS */}
      {gstrModalOpen && gstrTargetCase && (
        <div className="cc-modal-overlay" onClick={() => setGstrModalOpen(false)}>
          <div className="cc-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 540 }}>
            <div className="cc-modal-header" style={{ borderBottom: "1px solid #e2e8f0" }}>
              <div>
                <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a", display: "flex", alignItems: "center", gap: 8 }}>
                  <FileSpreadsheet size={19} color="#059669" /> GST Status
                </h3>
                <p style={{ margin: "3px 0 0", fontSize: 12.5, color: "#64748b" }}>
                  Track GST reflection for Lead #{gstrTargetCase.leadId} &bull; {gstrTargetCase.customerName}
                </p>
              </div>
              <button
                type="button"
                className="cc-modal-close"
                onClick={() => setGstrModalOpen(false)}
              >
                <X size={18} />
              </button>
            </div>

            <form onSubmit={handleGstrSubmit} className="cc-modal-form" style={{ padding: "18px 20px" }}>
              {/* Summary info card */}
              <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10, fontSize: 12.5 }}>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", fontWeight: 700 }}>Bank / Lender</span>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>{gstrTargetCase.bankName || "—"}</div>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", fontWeight: 700 }}>Disbursed Loan</span>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>{currencyFormatter.format(gstrTargetCase.loanAmount || 0)}</div>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", fontWeight: 700 }}>Actual Amount (Bank − Corp DSA)</span>
                    <div style={{ fontWeight: 600, color: "#1e293b" }}>
                      {currencyFormatter.format(
                        gstrTargetCase.actualAmount !== undefined && gstrTargetCase.actualAmount !== null
                          ? parseFloat(gstrTargetCase.actualAmount)
                          : Math.max(0, parseFloat(gstrTargetCase.baseAmount || 0) - parseFloat(gstrTargetCase.corporateDsaAmount || 0))
                      )}
                    </div>
                  </div>
                  <div>
                    <span style={{ color: "#64748b", fontSize: 10.5, textTransform: "uppercase", fontWeight: 700 }}>GST Amount (Y Amount)</span>
                    <div style={{ fontWeight: 800, color: "#0284c7" }}>
                      {currencyFormatter.format(gstrForm.gstrAmount || gstrTargetCase.bankGstAmount || 0)}
                    </div>
                  </div>
                </div>
              </div>

              {/* Status Select */}
              <div className="cc-fgroup" style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 700, fontSize: 13, color: "#334155", marginBottom: 4 }}>
                  GST Reflection Status *
                </label>
                <select
                  value={gstrForm.gstrStatus}
                  onChange={(e) => {
                    const st = e.target.value;
                    const fullAmt = parseFloat(gstrForm.gstrAmount) || 0;
                    setGstrForm((prev) => ({
                      ...prev,
                      gstrStatus: st,
                      gstrReceivedAmount: st === "COMPLETE" ? fullAmt : (st === "PENDING" ? 0 : prev.gstrReceivedAmount),
                    }));
                  }}
                  style={{ width: "100%", padding: "9px 12px", borderRadius: 8, border: "1px solid #cbd5e1", fontSize: 13.5 }}
                >
                  <option value="PENDING">⏳ Pending (Not reflected yet on portal)</option>
                  <option value="PARTIALLY_COMPLETE">⚠️ Partially Complete (Partial GST reflected)</option>
                  <option value="COMPLETE">✅ Complete (Full GST reflected on portal)</option>
                </select>
              </div>

              {/* Partially complete received amount */}
              {gstrForm.gstrStatus === "PARTIALLY_COMPLETE" && (
                <div style={{ background: "#fffbeb", border: "1px solid #fde68a", borderRadius: 8, padding: "12px 14px", marginBottom: 14 }}>
                  <div className="cc-form-row" style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
                    <div className="cc-fgroup">
                      <label style={{ fontWeight: 700, fontSize: 12, color: "#92400e" }}>
                        Received / Reflected GST Amount (₹) *
                      </label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        max={gstrForm.gstrAmount}
                        required
                        value={gstrForm.gstrReceivedAmount}
                        onChange={(e) => setGstrForm((prev) => ({ ...prev, gstrReceivedAmount: e.target.value }))}
                        style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #f59e0b", fontSize: 13 }}
                      />
                    </div>
                    <div className="cc-fgroup">
                      <label style={{ fontWeight: 700, fontSize: 12, color: "#92400e" }}>
                        Pending GST to Reflect (₹)
                      </label>
                      <div style={{ padding: "8px 0", fontWeight: 700, color: "#b45309", fontSize: 13.5 }}>
                        {currencyFormatter.format(Math.max(0, (parseFloat(gstrForm.gstrAmount) || 0) - (parseFloat(gstrForm.gstrReceivedAmount) || 0)))}
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: 11, color: "#78350f", marginTop: 4 }}>
                    Enter the partial amount of GST claimed or reflected on the portal so far.
                  </div>
                </div>
              )}

              {/* GST Expected Amount */}
              <div className="cc-fgroup" style={{ marginBottom: 14 }}>
                <label style={{ fontWeight: 600, fontSize: 12.5, color: "#475569" }}>
                  GST Amount (Y Amount) ₹
                </label>
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  value={gstrForm.gstrAmount}
                  onChange={(e) => setGstrForm((prev) => ({ ...prev, gstrAmount: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              {/* Notes */}
              <div className="cc-fgroup" style={{ marginBottom: 16 }}>
                <label style={{ fontWeight: 600, fontSize: 12.5, color: "#475569" }}>
                  GST Reference / Remarks
                </label>
                <textarea
                  rows={2}
                  placeholder="e.g. Reflected in GSTR-2B for Oct 2026 / Portal ARN..."
                  value={gstrForm.notes}
                  onChange={(e) => setGstrForm((prev) => ({ ...prev, notes: e.target.value }))}
                  style={{ width: "100%", padding: "8px 10px", borderRadius: 6, border: "1px solid #cbd5e1", fontSize: 13 }}
                />
              </div>

              {/* Actions */}
              <div className="cc-modal-actions" style={{ display: "flex", justifyContent: "flex-end", gap: 10 }}>
                <button
                  type="button"
                  className="cc-pbtn secondary"
                  onClick={() => setGstrModalOpen(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="cc-pbtn primary"
                  disabled={savingGstr}
                  style={{ background: "#059669", color: "#fff", borderColor: "#059669", fontWeight: 700 }}
                >
                  {savingGstr ? "Updating..." : "Save GST Status"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL 6: PAYMENT HISTORY & TRANSACTION LEDGER */}
      {paymentHistoryModalOpen && historyTargetCase && (
        <div className="cc-modal-overlay" onClick={() => setPaymentHistoryModalOpen(false)}>
          <div className="cc-modal-box cc-history-modal-box" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 940, width: "95%" }}>
            {/* Modal Header */}
            <div className="cc-modal-header" style={{ borderBottom: "1px solid #e2e8f0", padding: "16px 20px" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                <div style={{ width: 38, height: 38, borderRadius: 8, background: "#ecfdf5", display: "flex", alignItems: "center", justifyContent: "center" }}>
                  <Receipt size={20} color="#059669" />
                </div>
                <div>
                  <h3 style={{ margin: 0, fontSize: 17, color: "#0f172a" }}>
                    Payment History &amp; Ledger &bull; Lead #{historyTargetCase.leadId}
                  </h3>
                  <p style={{ margin: "2px 0 0", fontSize: 12.5, color: "#64748b" }}>
                    <strong>{historyTargetCase.customerName}</strong> &bull; {historyTargetCase.loanProduct} &bull; {historyTargetCase.bankName || "Bank"}
                  </p>
                </div>
              </div>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <button
                  type="button"
                  className="cc-pbtn secondary"
                  style={{ padding: "6px 10px", fontSize: 12, display: "flex", alignItems: "center", gap: 5 }}
                  onClick={() => openPaymentHistoryModal(historyTargetCase)}
                  title="Refresh payment records"
                >
                  <RefreshCw size={13} className={loadingHistory ? "cc-spin" : ""} /> Refresh
                </button>
                <button
                  type="button"
                  className="cc-modal-close"
                  onClick={() => setPaymentHistoryModalOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
            </div>

            <div style={{ padding: "18px 20px", maxHeight: "80vh", overflowY: "auto" }}>
              {/* Formula & Calculation Breakdown Summary */}
              {(() => {
                const calc = historyData?.calculations || {
                  loanAmount: parseFloat(historyTargetCase.loanAmount || 0),
                  bankCommission: parseFloat(historyTargetCase.baseAmount || 0),
                  bankCommissionPercent: parseFloat(historyTargetCase.bankCommissionPercent || 0),
                  corporateDsaPercent: parseFloat(historyTargetCase.corporateDsaPercent || 0),
                  corporateDsaCommission: parseFloat(historyTargetCase.corporateDsaAmount || 0),
                  corporateDsaAmount: parseFloat(historyTargetCase.corporateDsaAmount || 0),
                  partyCommissionPercent: parseFloat(historyTargetCase.partyCommissionPercent || 0),
                  actualAmount: parseFloat(historyTargetCase.actualAmount || Math.max(0, parseFloat(historyTargetCase.baseAmount || 0) - parseFloat(historyTargetCase.corporateDsaAmount || 0))),
                  remainingAfterDsa: parseFloat(historyTargetCase.actualAmount || Math.max(0, parseFloat(historyTargetCase.baseAmount || 0) - parseFloat(historyTargetCase.corporateDsaAmount || 0))),
                  tdsPercent: parseFloat(historyTargetCase.bankTdsPercent || 5),
                  tdsAmount: parseFloat(historyTargetCase.bankTdsAmount || 0),
                  netReceivable: parseFloat(historyTargetCase.bankNetReceivable || Math.max(0, (parseFloat(historyTargetCase.actualAmount || historyTargetCase.baseAmount || 0) - parseFloat(historyTargetCase.corporateDsaAmount || 0)) - parseFloat(historyTargetCase.bankTdsAmount || 0))),
                  gstPercent: parseFloat(historyTargetCase.bankGstPercent || 18),
                  gstAmount: parseFloat(historyTargetCase.bankGstAmount || historyTargetCase.gstrAmount || 0),
                  bankReceivedAmount: parseFloat(historyTargetCase.bankReceivedAmount || 0),
                  bankRemainingDue: Math.max(0, parseFloat(historyTargetCase.bankRemainingDue || 0)),
                  partyNetPayable: parseFloat(historyTargetCase.partyNetPayable || 0),
                  partyPaidAmount: parseFloat(historyTargetCase.partyPaidAmount || 0),
                  partyRemainingDue: parseFloat(historyTargetCase.partyRemainingDue || 0),
                  gstrStatus: historyTargetCase.gstrStatus || "PENDING",
                  gstrAmount: parseFloat(historyTargetCase.gstrAmount || historyTargetCase.bankGstAmount || 0),
                  gstrReceivedAmount: parseFloat(historyTargetCase.gstrReceivedAmount || 0),
                };

                return (
                  <>
                    {/* Calculation Steps Grid */}
                    <div style={{ background: "#f8fafc", border: "1px solid #e2e8f0", borderRadius: 10, padding: "14px", marginBottom: 16 }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 10 }}>
                        <strong style={{ fontSize: 13, color: "#1e293b", display: "flex", alignItems: "center", gap: 6 }}>
                          <IndianRupee size={15} color="#059669" /> Commission &amp; Tax Calculation Breakdown
                        </strong>
                        <span style={{ fontSize: 11, color: "#64748b", fontWeight: 600 }}>
                          Rule: (Gross Bank Comm − Corp DSA Charge) − TDS = Net X &bull; GST (Y) Kept Separate
                        </span>
                      </div>

                      <div style={{ display: "grid", gridTemplateColumns: "1.2fr auto 1.2fr auto 1.2fr auto 1.2fr auto 1.4fr 1.4fr", alignItems: "center", gap: 6, textAlign: "center" }}>
                        {/* Step 1: Gross Bank Comm */}
                        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 6px" }}>
                          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>1. Bank Gross</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#047857" }}>
                            {currencyFormatter.format(calc.bankCommission)}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>{calc.bankCommissionPercent}%</div>
                        </div>

                        <span style={{ fontSize: 16, fontWeight: 800, color: "#94a3b8" }}>−</span>

                        {/* Step 2: Corp DSA Comm */}
                        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 6px" }}>
                          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>2. Corp DSA</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#7c3aed" }}>
                            {currencyFormatter.format(calc.corporateDsaAmount || calc.corporateDsaCommission || 0)}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>{calc.corporateDsaPercent || 0}%</div>
                        </div>

                        <span style={{ fontSize: 16, fontWeight: 800, color: "#94a3b8" }}>=</span>

                        {/* Step 3: Actual Amount */}
                        <div style={{ background: "#fff", border: "1px solid #e2e8f0", borderRadius: 8, padding: "8px 6px" }}>
                          <div style={{ fontSize: 10, color: "#64748b", textTransform: "uppercase", fontWeight: 700 }}>3. Actual Amount</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#0f172a" }}>
                            {currencyFormatter.format(calc.actualAmount || calc.remainingAfterDsa || 0)}
                          </div>
                          <div style={{ fontSize: 10, color: "#64748b" }}>Bank − DSA</div>
                        </div>

                        <span style={{ fontSize: 16, fontWeight: 800, color: "#94a3b8" }}>−</span>

                        {/* Step 4: TDS Deducted */}
                        <div style={{ background: "#fff", border: "1px solid #fecaca", borderRadius: 8, padding: "8px 6px" }}>
                          <div style={{ fontSize: 10, color: "#b91c1c", textTransform: "uppercase", fontWeight: 700 }}>4. TDS ({calc.tdsPercent}%)</div>
                          <div style={{ fontSize: 14, fontWeight: 800, color: "#dc2626" }}>
                            -{currencyFormatter.format(calc.tdsAmount)}
                          </div>
                          <div style={{ fontSize: 10, color: "#b91c1c" }}>Deducted</div>
                        </div>

                        <span style={{ fontSize: 16, fontWeight: 800, color: "#94a3b8" }}>=</span>

                        {/* Step 5: Net Bank Receivable (X) */}
                        <div style={{ background: "#ecfdf5", border: "2px solid #86efac", borderRadius: 8, padding: "8px 6px" }}>
                          <div style={{ fontSize: 10, color: "#047857", textTransform: "uppercase", fontWeight: 800 }}>Net Receivable (X)</div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: "#047857" }}>
                            {currencyFormatter.format(calc.netReceivable)}
                          </div>
                          <div style={{ fontSize: 10, color: "#15803d", fontWeight: 700 }}>Actual − TDS</div>
                        </div>

                        {/* Step 6: GST (Y) [Separate] */}
                        <div style={{ background: "#f0f9ff", border: "1px solid #bae6fd", borderRadius: 8, padding: "8px 6px" }}>
                          <div style={{ fontSize: 10, color: "#0369a1", textTransform: "uppercase", fontWeight: 800 }}>GST [Separate] (Y)</div>
                          <div style={{ fontSize: 15, fontWeight: 900, color: "#0284c7" }}>
                            {currencyFormatter.format(calc.gstAmount)}
                          </div>
                          <div style={{ fontSize: 10, color: "#0284c7" }}>
                            {calc.gstrStatus === "COMPLETE" ? "GST Complete" : calc.gstrStatus === "PARTIALLY_COMPLETE" ? `Partial ₹${Math.round(calc.gstrReceivedAmount)}` : "GST Pending"}
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Settlement Balances & Quick Actions (2 Cards) */}
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 14, marginBottom: 18 }}>
                      {/* Bank Inflow Card */}
                      <div style={{ background: "#fff", border: "1px solid #bbf7d0", borderRadius: 10, padding: "14px", position: "relative" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#166534", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                              <ArrowDownLeft size={14} color="#166534" /> Bank Inward (Commission Received)
                            </span>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#047857", marginTop: 2 }}>
                              {currencyFormatter.format(calc.bankReceivedAmount)}
                              <span style={{ fontSize: 12, fontWeight: 500, color: "#64748b" }}> / {currencyFormatter.format(calc.netReceivable)}</span>
                            </div>
                          </div>
                          <button
                            type="button"
                            className="cc-pbtn primary"
                            style={{ padding: "6px 10px", fontSize: 11.5, background: "#059669", borderColor: "#059669", display: "flex", alignItems: "center", gap: 4 }}
                            onClick={() => {
                              openBankReceiptModal(historyTargetCase);
                            }}
                          >
                            <Plus size={13} /> Record Receipt
                          </button>
                        </div>
                        {/* Progress Bar */}
                        <div style={{ width: "100%", background: "#e2e8f0", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                          <div
                            style={{
                              width: `${Math.min(100, (calc.bankReceivedAmount / (calc.netReceivable || 1)) * 100)}%`,
                              background: "#059669",
                              height: "100%",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#475569" }}>
                          <span>Pending from Bank: <strong style={{ color: calc.bankRemainingDue > 0 ? "#b45309" : "#047857" }}>{currencyFormatter.format(calc.bankRemainingDue)}</strong></span>
                          <span>{calc.bankRemainingDue <= 0 ? "✅ Fully Received" : "⏳ Balance Pending"}</span>
                        </div>
                      </div>

                      {/* Connector Outflow Card */}
                      <div style={{ background: "#fff", border: "1px solid #e9d5ff", borderRadius: 10, padding: "14px" }}>
                        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: 8 }}>
                          <div>
                            <span style={{ fontSize: 11, fontWeight: 700, color: "#6b21a8", textTransform: "uppercase", display: "flex", alignItems: "center", gap: 5 }}>
                              <ArrowUpRight size={14} color="#6b21a8" /> Connector / DSA Outflow ({historyTargetCase.partyName || "Connector"})
                            </span>
                            <div style={{ fontSize: 18, fontWeight: 800, color: "#7c3aed", marginTop: 2 }}>
                              {currencyFormatter.format(calc.partyPaidAmount)}
                              <span style={{ fontSize: 12, fontWeight: 500, color: "#64748b" }}> / {currencyFormatter.format(calc.partyNetPayable)}</span>
                            </div>
                          </div>
                          {historyTargetCase.payoutType !== "SELF" && (
                            <button
                              type="button"
                              className="cc-pbtn primary"
                              style={{ padding: "6px 10px", fontSize: 11.5, background: "#7c3aed", borderColor: "#7c3aed", display: "flex", alignItems: "center", gap: 4 }}
                              onClick={() => {
                                openPartyPayoutModal(historyTargetCase);
                              }}
                            >
                              <Plus size={13} /> Record Payout
                            </button>
                          )}
                        </div>
                        {/* Progress Bar */}
                        <div style={{ width: "100%", background: "#e2e8f0", height: 6, borderRadius: 3, overflow: "hidden", marginBottom: 6 }}>
                          <div
                            style={{
                              width: `${Math.min(100, (calc.partyPaidAmount / (calc.partyNetPayable || 1)) * 100)}%`,
                              background: "#7c3aed",
                              height: "100%",
                            }}
                          />
                        </div>
                        <div style={{ display: "flex", justifyContent: "space-between", fontSize: 11.5, color: "#475569" }}>
                          <span>Pending to Pay: <strong style={{ color: calc.partyRemainingDue > 0 ? "#b45309" : "#047857" }}>{currencyFormatter.format(calc.partyRemainingDue)}</strong></span>
                          <span>{calc.partyRemainingDue <= 0 ? "✅ Fully Settled" : "⏳ Payout Due"}</span>
                        </div>
                      </div>
                    </div>
                  </>
                );
              })()}

              {/* Transactions History Header & Tabs */}
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("ALL")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      border: "1px solid",
                      cursor: "pointer",
                      background: historyTab === "ALL" ? "#0f172a" : "#fff",
                      color: historyTab === "ALL" ? "#fff" : "#475569",
                      borderColor: historyTab === "ALL" ? "#0f172a" : "#cbd5e1",
                    }}
                  >
                    All Transactions ({historyData?.transactions?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("BANK")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      border: "1px solid",
                      cursor: "pointer",
                      background: historyTab === "BANK" ? "#059669" : "#fff",
                      color: historyTab === "BANK" ? "#fff" : "#059669",
                      borderColor: historyTab === "BANK" ? "#059669" : "#cbd5e1",
                    }}
                  >
                    Bank Receipts ({historyData?.bankReceipts?.length || 0})
                  </button>
                  <button
                    type="button"
                    onClick={() => setHistoryTab("PARTY")}
                    style={{
                      padding: "6px 12px",
                      borderRadius: 6,
                      fontSize: 12,
                      fontWeight: 700,
                      border: "1px solid",
                      cursor: "pointer",
                      background: historyTab === "PARTY" ? "#7c3aed" : "#fff",
                      color: historyTab === "PARTY" ? "#fff" : "#7c3aed",
                      borderColor: historyTab === "PARTY" ? "#7c3aed" : "#cbd5e1",
                    }}
                  >
                    Connector Payouts ({historyData?.partyPayments?.length || 0})
                  </button>
                </div>
                <button
                  type="button"
                  onClick={() => openGstrModal(historyTargetCase)}
                  className="cc-pbtn secondary"
                  style={{ padding: "5px 10px", fontSize: 11.5, display: "flex", alignItems: "center", gap: 5 }}
                >
                  <FileSpreadsheet size={13} color="#059669" /> Update GST Status
                </button>
              </div>

              {/* Transactions Ledger Table */}
              {loadingHistory ? (
                <div style={{ padding: "40px 0", textAlign: "center", color: "#64748b" }}>
                  <RefreshCw size={24} className="cc-spin" style={{ margin: "0 auto 10px" }} />
                  <p style={{ margin: 0, fontSize: 13 }}>Loading payment transactions for Lead #{historyTargetCase.leadId}...</p>
                </div>
              ) : (() => {
                const txList = (historyData?.transactions || []).filter((tx) => {
                  if (historyTab === "BANK") return tx.category === "BANK_RECEIPT";
                  if (historyTab === "PARTY") return tx.category === "PARTY_PAYOUT";
                  return true;
                });

                if (txList.length === 0) {
                  return (
                    <div style={{ padding: "36px 0", textAlign: "center", background: "#f8fafc", borderRadius: 8, border: "1px dashed #cbd5e1" }}>
                      <Clock size={28} color="#94a3b8" style={{ margin: "0 auto 8px" }} />
                      <div style={{ fontWeight: 700, color: "#475569", fontSize: 14 }}>No Payment Records Found</div>
                      <p style={{ margin: "4px 0 12px", fontSize: 12, color: "#64748b" }}>
                        No transactions have been recorded yet for this case payout.
                      </p>
                      <button
                        type="button"
                        className="cc-pbtn primary"
                        style={{ fontSize: 12, padding: "6px 12px", background: "#059669", borderColor: "#059669" }}
                        onClick={() => openBankReceiptModal(historyTargetCase)}
                      >
                        Record First Bank Receipt
                      </button>
                    </div>
                  );
                }

                return (
                  <div style={{ overflowX: "auto", border: "1px solid #e2e8f0", borderRadius: 8 }}>
                    <table style={{ width: "100%", borderCollapse: "collapse", fontSize: 12, textAlign: "left" }}>
                      <thead>
                        <tr style={{ background: "#f8fafc", borderBottom: "1px solid #e2e8f0", color: "#475569" }}>
                          <th style={{ padding: "9px 12px" }}>Date</th>
                          <th style={{ padding: "9px 12px" }}>Category &bull; Type</th>
                          <th style={{ padding: "9px 12px" }}>Party / Bank</th>
                          <th style={{ padding: "9px 12px" }}>Payment Mode &bull; UTR</th>
                          <th style={{ padding: "9px 12px", textAlign: "right" }}>Gross (₹)</th>
                          <th style={{ padding: "9px 12px", textAlign: "right" }}>Taxes / Deductions</th>
                          <th style={{ padding: "9px 12px", textAlign: "right" }}>Net Amount (₹)</th>
                          <th style={{ padding: "9px 12px" }}>Logged By</th>
                          <th style={{ padding: "9px 12px" }}>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {txList.map((tx) => {
                          const isInward = tx.category === "BANK_RECEIPT";
                          return (
                            <tr key={tx.id} style={{ borderBottom: "1px solid #f1f5f9" }}>
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap", fontWeight: 600 }}>
                                {tx.date ? new Date(tx.date).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" }) : "—"}
                              </td>
                              <td style={{ padding: "9px 12px", whiteSpace: "nowrap" }}>
                                {isInward ? (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#ecfdf5", color: "#047857", border: "1px solid #a7f3d0", padding: "2px 7px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                    <ArrowDownLeft size={12} /> Bank Inflow
                                  </span>
                                ) : (
                                  <span style={{ display: "inline-flex", alignItems: "center", gap: 4, background: "#faf5ff", color: "#7c3aed", border: "1px solid #e9d5ff", padding: "2px 7px", borderRadius: 4, fontWeight: 700, fontSize: 11 }}>
                                    <ArrowUpRight size={12} /> Connector Payout
                                  </span>
                                )}
                              </td>
                              <td style={{ padding: "9px 12px", fontWeight: 600, color: "#1e293b" }}>
                                {tx.partyOrBank}
                              </td>
                              <td style={{ padding: "9px 12px" }}>
                                <div style={{ fontWeight: 600, color: "#334155" }}>{tx.paymentMode || "NEFT"}</div>
                                <div style={{ fontSize: 11, color: "#64748b" }}>{tx.referenceNumber && tx.referenceNumber !== "—" ? `Ref: ${tx.referenceNumber}` : "No UTR"}</div>
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 700 }}>
                                {currencyFormatter.format(tx.amount)}
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontSize: 11, color: "#64748b" }}>
                                {isInward ? (
                                  <>
                                    {tx.gstAmount > 0 && <span style={{ color: "#0284c7" }}>+₹{Math.round(tx.gstAmount)} GST </span>}
                                    {tx.tdsAmount > 0 && <span style={{ color: "#dc2626" }}>-₹{Math.round(tx.tdsAmount)} TDS</span>}
                                    {!tx.gstAmount && !tx.tdsAmount && "—"}
                                  </>
                                ) : (
                                  "—"
                                )}
                              </td>
                              <td style={{ padding: "9px 12px", textAlign: "right", fontWeight: 800, color: isInward ? "#047857" : "#7c3aed" }}>
                                {currencyFormatter.format(tx.netAmount)}
                              </td>
                              <td style={{ padding: "9px 12px", color: "#64748b", fontSize: 11.5 }}>
                                {tx.recordedBy}
                              </td>
                              <td style={{ padding: "9px 12px", color: "#475569", maxWidth: 160, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }} title={tx.notes}>
                                {tx.notes || "—"}
                              </td>
                            </tr>
                          );
                        })}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>

            {/* Modal Footer */}
            <div className="cc-modal-actions" style={{ padding: "12px 20px", borderTop: "1px solid #e2e8f0", display: "flex", justifyContent: "flex-end" }}>
              <button
                type="button"
                className="cc-pbtn secondary"
                onClick={() => setPaymentHistoryModalOpen(false)}
              >
                Close Ledger
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

const payoutScreenStyles = `
  .cc-payouts-page-container {
    padding: 20px;
    background: #f8fafc;
    min-height: 100vh;
  }
  .cc-phead-panel {
    padding: 16px 22px;
    margin-bottom: 16px;
    background: #fff;
    border-radius: 12px;
    border: 1px solid #e2e8f0;
  }
  .cc-phead-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    flex-wrap: wrap;
    gap: 12px;
  }
  .cc-phead-title {
    margin: 0;
    font-size: 22px;
    font-weight: 800;
    color: #0f172a;
  }
  .cc-phead-badge {
    background: #ecfdf5;
    color: #047857;
    font-size: 11px;
    font-weight: 700;
    padding: 2px 8px;
    border-radius: 999px;
    border: 1px solid #a7f3d0;
  }
  .cc-phead-sub {
    margin: 4px 0 0;
    font-size: 13px;
    color: #64748b;
  }

  .cc-main-nav-tabs {
    display: flex;
    gap: 8px;
    margin-top: 14px;
    border-top: 1px solid #f1f5f9;
    padding-top: 12px;
  }
  .cc-main-nav-tabs button {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 700;
    border: 1px solid transparent;
    cursor: pointer;
    background: #f1f5f9;
    color: #475569;
    transition: all 0.15s;
  }
  .cc-main-nav-tabs button.active {
    background: #047857;
    color: #fff;
    box-shadow: 0 2px 4px rgba(4, 120, 87, 0.2);
  }

  /* KPI Grid */
  .cc-pkpi-grid {
    display: grid;
    grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
    gap: 14px;
    margin-bottom: 16px;
  }
  .cc-pkpi-card {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 14px 16px;
    box-shadow: 0 1px 3px rgba(15, 23, 42, 0.04);
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cc-pkpi-card.highlight-amber {
    background: #fffbeb;
    border-color: #fde68a;
  }
  .cc-pkpi-card.highlight-green {
    background: #f0fdf4;
    border-color: #bbf7d0;
  }
  .cc-pkpi-card.highlight-cyan {
    background: #f0f9ff;
    border-color: #bae6fd;
  }
  .cc-pkpi-top {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .cc-pkpi-label {
    font-size: 11px;
    font-weight: 700;
    color: #64748b;
    text-transform: uppercase;
  }
  .cc-pkpi-icon {
    width: 30px;
    height: 30px;
    border-radius: 7px;
    display: grid;
    place-items: center;
  }
  .cc-pkpi-icon.blue { background: #eff6ff; color: #2563eb; }
  .cc-pkpi-icon.emerald { background: #ecfdf5; color: #059669; }
  .cc-pkpi-icon.amber { background: #fef3c7; color: #d97706; }
  .cc-pkpi-icon.purple { background: #f5f3ff; color: #7c3aed; }
  .cc-pkpi-icon.cyan { background: #ecfeff; color: #0891b2; }

  .cc-pkpi-val {
    font-size: 18px;
    font-weight: 800;
    color: #0f172a;
  }
  .cc-pkpi-sub {
    font-size: 11px;
    color: #94a3b8;
  }

  /* Filters */
  .cc-pfilter-panel {
    background: #fff;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px 16px;
    margin-bottom: 16px;
  }
  .cc-pfilter-bar {
    display: flex;
    align-items: center;
    gap: 8px;
    flex-wrap: wrap;
  }
  .cc-psearch-box {
    position: relative;
    display: flex;
    align-items: center;
    flex: 1 1 240px;
    min-width: 200px;
    height: 38px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 0 10px 0 32px;
    background: #fff;
  }
  .cc-psearch-box svg { position: absolute; left: 10px; color: #94a3b8; }
  .cc-psearch-box input { border: 0; outline: none; font-size: 12.5px; width: 100%; color: #0f172a; }

  .cc-pselect {
    height: 38px;
    padding: 0 12px;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    background: #fff;
    font-size: 12px;
    font-weight: 500;
    color: #1e293b;
    outline: none;
    cursor: pointer;
  }
  .cc-pselect.highlight {
    background: #f0fdf4;
    border-color: #86efac;
    color: #047857;
    font-weight: 700;
  }
  .cc-pdate-range {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    background: #f8fafc;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 2px 8px;
    height: 38px;
  }
  .cc-pdate-input {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 3px 6px;
    font-size: 11.5px;
    outline: none;
  }
  .cc-pstatus-pills {
    display: inline-flex;
    background: #f1f5f9;
    border-radius: 8px;
    padding: 3px;
    gap: 2px;
  }
  .cc-pstatus-pills button {
    border: 0;
    background: transparent;
    padding: 5px 10px;
    border-radius: 6px;
    font-size: 11.5px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
  }
  .cc-pstatus-pills button.active {
    background: #fff;
    color: #0f172a;
    box-shadow: 0 1px 2px rgba(0,0,0,0.06);
    font-weight: 700;
  }
  .cc-pclear-btn {
    display: inline-flex;
    align-items: center;
    gap: 4px;
    padding: 0 10px;
    height: 38px;
    border-radius: 8px;
    background: #fef2f2;
    color: #be123c;
    border: 1px solid #fecdd3;
    font-size: 11.5px;
    font-weight: 700;
    cursor: pointer;
  }
  .cc-prefresh-btn {
    width: 38px;
    height: 38px;
    border-radius: 8px;
    border: 1px solid #cbd5e1;
    background: #fff;
    display: grid;
    place-items: center;
    color: #475569;
    cursor: pointer;
  }

  /* Table & Crisp Excel-like Borders */
  .cc-table-panel {
    background: #fff;
    border: 1px solid #94a3b8;
    border-radius: 8px;
    overflow: hidden;
    box-shadow: 0 1px 4px rgba(0, 0, 0, 0.06);
  }
  .cc-table-scroll-wrap {
    overflow-x: auto;
    position: relative;
    max-height: calc(100vh - 280px);
  }
  .cc-payouts-table, .cc-journal-table {
    width: 100%;
    border-collapse: collapse;
    font-size: 12px;
    border: 1px solid #94a3b8;
  }
  .cc-payouts-table th, .cc-journal-table th {
    background: #f1f5f9;
    color: #0f172a;
    font-size: 11px;
    font-weight: 800;
    text-transform: uppercase;
    letter-spacing: 0.3px;
    padding: 10px 10px;
    border: 1px solid #cbd5e1;
    border-bottom: 2.5px solid #475569;
    text-align: left;
    white-space: nowrap;
    position: sticky;
    top: 0;
    z-index: 5;
  }
  .cc-payouts-table th.th-credit {
    background: #dcfce7 !important;
    color: #14532d !important;
    border-left: 2px solid #86efac;
    border-right: 2px solid #86efac;
    border-bottom: 2.5px solid #16a34a;
  }
  .cc-payouts-table th.th-deduct {
    background: #fef3c7 !important;
    color: #78350f !important;
    border-left: 2px solid #fde68a;
    border-right: 2px solid #fde68a;
    border-bottom: 2.5px solid #d97706;
  }
  .cc-payouts-table th.th-net {
    background: #ede9fe !important;
    color: #4c1d95 !important;
    border-left: 2px solid #c4b5fd;
    border-right: 2px solid #c4b5fd;
    border-bottom: 2.5px solid #7c3aed;
  }
  .cc-payouts-table th.th-margin {
    background: #e0f2fe !important;
    color: #0369a1 !important;
    border-left: 2px solid #7dd3fc;
    border-right: 2px solid #7dd3fc;
    border-bottom: 2.5px solid #0284c7;
  }

  .cc-payouts-table td, .cc-journal-table td {
    padding: 8px 10px;
    border: 1px solid #cbd5e1;
    vertical-align: middle;
    background: #ffffff;
    transition: background 0.08s ease;
  }

  /* Alternate Row Striping */
  .cc-payouts-table tbody tr:nth-child(even) td,
  .cc-journal-table tbody tr:nth-child(even) td {
    background: #f8fafc;
  }

  /* Row Hover Highlighting */
  .cc-payouts-table tbody tr:hover td,
  .cc-journal-table tbody tr:hover td {
    background: #e2e8f0 !important;
  }

  /* Special Highlight Cells with Clear Boundaries */
  .cc-payouts-table td.cell-credit {
    background: #f0fdf4 !important;
    border-left: 2px solid #86efac !important;
    border-right: 2px solid #86efac !important;
  }
  .cc-payouts-table tbody tr:hover td.cell-credit {
    background: #dcfce7 !important;
  }

  .cc-payouts-table td.cell-deduct {
    background: #fffbeb !important;
    border-left: 2px solid #fde68a !important;
    border-right: 2px solid #fde68a !important;
  }
  .cc-payouts-table tbody tr:hover td.cell-deduct {
    background: #fef3c7 !important;
  }

  .cc-payouts-table td.cell-net {
    background: #f5f3ff !important;
    border-left: 2px solid #c4b5fd !important;
    border-right: 2px solid #c4b5fd !important;
  }
  .cc-payouts-table tbody tr:hover td.cell-net {
    background: #ede9fe !important;
  }

  .cc-payouts-table td.cell-margin {
    background: #f0f9ff !important;
    border-left: 2px solid #7dd3fc !important;
    border-right: 2px solid #7dd3fc !important;
  }
  .cc-payouts-table tbody tr:hover td.cell-margin {
    background: #e0f2fe !important;
  }

  /* Total Footer Row with Solid Double Borders */
  .cc-total-footer-row td {
    background: #e2e8f0 !important;
    border-top: 3px double #334155 !important;
    border-bottom: 3px double #334155 !important;
    border-left: 1px solid #94a3b8;
    border-right: 1px solid #94a3b8;
    padding: 10px 10px;
    font-weight: 800;
    color: #0f172a;
  }
  .cc-total-footer-row td.cell-credit {
    background: #dcfce7 !important;
  }
  .cc-total-footer-row td.cell-deduct {
    background: #fef3c7 !important;
  }
  .cc-total-footer-row td.cell-net {
    background: #ede9fe !important;
  }
  .cc-total-footer-row td.cell-margin {
    background: #e0f2fe !important;
  }

  /* Pills & Tags */
  .cc-lead-badge {
    display: inline-block;
    background: #e2e8f0;
    color: #334155;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 800;
  }
  .cc-product-pill {
    display: inline-block;
    background: #f1f5f9;
    color: #1e293b;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
  }
  .cc-party-pill {
    display: inline-block;
    background: #eff6ff;
    color: #2563eb;
    padding: 2px 7px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
  }
  .cc-code-mini {
    display: inline-block;
    background: #e2e8f0;
    color: #475569;
    padding: 1px 5px;
    border-radius: 3px;
    font-size: 10px;
    font-weight: 700;
  }
  .cc-code-mini.total { background: #047857; color: #fff; }

  .cc-rate-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 700;
  }
  .cc-rate-tag.green { background: #ecfdf5; color: #047857; border: 1px solid #a7f3d0; }
  .cc-rate-tag.purple { background: #f5f3ff; color: #7c3aed; border: 1px solid #ddd6fe; }

  .cc-inline-edit-btn {
    border: 0;
    background: #f1f5f9;
    color: #64748b;
    border-radius: 4px;
    padding: 2px 4px;
    cursor: pointer;
    display: inline-grid;
    place-items: center;
  }
  .cc-inline-edit-btn:hover { background: #cbd5e1; color: #0f172a; }

  .cc-action-btn {
    border: 1px solid transparent;
    border-radius: 6px;
    padding: 4px 8px;
    font-size: 11px;
    font-weight: 700;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 3px;
    transition: all 0.1s;
  }
  .cc-action-btn.receive { background: #ecfdf5; color: #047857; border-color: #a7f3d0; }
  .cc-action-btn.receive:hover { background: #047857; color: #fff; }
  .cc-action-btn.pay { background: #f5f3ff; color: #7c3aed; border-color: #ddd6fe; }
  .cc-action-btn.pay:hover { background: #7c3aed; color: #fff; }
  .cc-action-btn.edit { background: #f8fafc; color: #475569; border-color: #cbd5e1; }
  .cc-action-btn.edit:hover { background: #e2e8f0; color: #0f172a; }
  .cc-action-btn.invoice { background: #e0f2fe; color: #0284c7; border-color: #bae6fd; }
  .cc-action-btn.invoice:hover { background: #0284c7; color: #fff; }

  /* Journal Pills */
  .cc-pref-tag {
    font-family: monospace;
    font-size: 11.5px;
    color: #0f172a;
    background: #f1f5f9;
    padding: 2px 6px;
    border-radius: 4px;
  }
  .cc-tx-type-tag {
    display: inline-block;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 700;
  }
  .cc-tx-type-tag.settlement { background: #ecfdf5; color: #047857; }
  .cc-tx-type-tag.advance { background: #fffbeb; color: #b45309; }
  .cc-tx-type-tag.refund { background: #fef2f2; color: #dc2626; }

  .cc-mode-tag {
    display: inline-block;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10.5px;
    color: #475569;
  }
  .cc-alloc-tag {
    display: inline-block;
    background: #f1f5f9;
    color: #334155;
    padding: 2px 6px;
    border-radius: 4px;
    font-size: 10.5px;
    font-weight: 600;
  }

  /* Modals */
  .cc-modal-overlay {
    position: fixed;
    inset: 0;
    background: rgba(15, 23, 42, 0.6);
    backdrop-filter: blur(2px);
    display: flex;
    justify-content: center;
    align-items: center;
    z-index: 1000;
    padding: 16px;
  }
  .cc-modal-box {
    background: #fff;
    border-radius: 12px;
    box-shadow: 0 20px 25px -5px rgba(0, 0, 0, 0.1);
    width: 100%;
    max-width: 540px;
    max-height: 90vh;
    overflow-y: auto;
  }
  .cc-invoice-modal-box {
    max-width: 860px;
  }
  .cc-modal-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    padding: 16px 20px;
    border-bottom: 1px solid #e2e8f0;
  }
  .cc-modal-header h3 {
    margin: 0;
    font-size: 16px;
    font-weight: 800;
    color: #0f172a;
  }
  .cc-modal-header p {
    margin: 3px 0 0;
    font-size: 12px;
    color: #64748b;
  }
  .cc-modal-close {
    border: 0;
    background: transparent;
    cursor: pointer;
    color: #94a3b8;
  }
  .cc-modal-close:hover { color: #0f172a; }

  .cc-modal-form {
    padding: 18px 20px;
    display: flex;
    flex-direction: column;
    gap: 12px;
  }
  .cc-modal-summary-banner {
    display: grid;
    grid-template-columns: repeat(4, 1fr);
    gap: 8px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px 12px;
  }
  .cc-modal-summary-banner div {
    display: flex;
    flex-direction: column;
  }
  .cc-modal-summary-banner small {
    font-size: 10px;
    color: #64748b;
    text-transform: uppercase;
  }
  .cc-modal-summary-banner strong {
    font-size: 12.5px;
    color: #0f172a;
  }

  .cc-form-row {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 12px;
  }
  .cc-fgroup {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .cc-fgroup label {
    font-size: 11.5px;
    font-weight: 600;
    color: #475569;
  }
  .cc-fgroup input, .cc-fgroup select, .cc-fgroup textarea {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    padding: 7px 10px;
    font-size: 12.5px;
    color: #0f172a;
    outline: none;
  }
  .cc-fgroup input:focus, .cc-fgroup select:focus, .cc-fgroup textarea:focus {
    border-color: #047857;
  }

  .cc-net-credit-box {
    display: flex;
    justify-content: space-between;
    align-items: center;
    background: #ecfdf5;
    border: 1px solid #a7f3d0;
    border-radius: 6px;
    padding: 8px 12px;
    font-size: 12.5px;
    color: #047857;
  }
  .cc-net-credit-box strong {
    font-size: 14px;
  }

  .cc-calc-preview {
    display: grid;
    grid-template-columns: repeat(5, 1fr);
    gap: 6px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 8px;
    padding: 10px;
    text-align: center;
  }
  .cc-calc-preview div {
    display: flex;
    flex-direction: column;
    gap: 2px;
  }
  .cc-calc-preview small {
    font-size: 10px;
    color: #64748b;
  }
  .cc-calc-preview strong {
    font-size: 12px;
  }

  .cc-modal-actions {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 8px;
  }

  /* Buttons */
  .cc-pbtn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 8px 14px;
    border-radius: 8px;
    font-size: 12.5px;
    font-weight: 700;
    cursor: pointer;
    border: 1px solid transparent;
    transition: all 0.15s;
  }
  .cc-pbtn.primary {
    background: #047857;
    color: #fff;
  }
  .cc-pbtn.primary:hover {
    background: #065f46;
  }
  .cc-pbtn.secondary {
    background: #f1f5f9;
    color: #475569;
    border-color: #cbd5e1;
  }
  .cc-pbtn.secondary:hover {
    background: #e2e8f0;
  }
  .cc-pbtn.small {
    padding: 5px 10px;
    font-size: 11.5px;
  }

  /* Invoice Styles */
  .cc-inv-toggle {
    display: inline-flex;
    background: #f1f5f9;
    padding: 2px;
    border-radius: 6px;
    gap: 2px;
  }
  .cc-inv-toggle button {
    border: 0;
    background: transparent;
    padding: 4px 8px;
    border-radius: 4px;
    font-size: 11px;
    font-weight: 600;
    color: #64748b;
    cursor: pointer;
  }
  .cc-inv-toggle button.active {
    background: #fff;
    color: #0f172a;
    box-shadow: 0 1px 2px rgba(0,0,0,0.05);
  }

  .cc-invoice-content-wrap {
    padding: 20px;
  }
  .cc-printable-invoice {
    background: #fff;
    border: 1px solid #cbd5e1;
    border-radius: 8px;
    padding: 24px;
  }
  .cc-inv-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    border-bottom: 2px solid #0f172a;
    padding-bottom: 16px;
    margin-bottom: 16px;
  }
  .cc-inv-company-name {
    margin: 0;
    font-size: 20px;
    font-weight: 800;
    color: #0f172a;
  }
  .cc-inv-company-sub {
    margin: 2px 0 6px;
    font-size: 12px;
    color: #64748b;
  }
  .cc-inv-meta-line {
    margin: 2px 0;
    font-size: 11px;
    color: #475569;
  }
  .cc-inv-title-badge {
    display: inline-block;
    background: #047857;
    color: #fff;
    font-size: 12px;
    font-weight: 800;
    padding: 4px 12px;
    border-radius: 4px;
    margin-bottom: 6px;
  }
  .cc-inv-prop-row {
    font-size: 11.5px;
    margin: 3px 0;
    color: #334155;
  }
  .cc-inv-prop-row span {
    color: #64748b;
    margin-right: 6px;
  }
  .cc-inv-status-pill {
    background: #ecfdf5;
    color: #047857;
    border: 1px solid #a7f3d0;
    padding: 1px 6px;
    border-radius: 4px;
    font-size: 10px;
    font-weight: 700;
  }

  .cc-inv-billto-grid {
    display: grid;
    grid-template-columns: 1fr 1fr;
    gap: 16px;
    margin-bottom: 16px;
  }
  .cc-bill-box {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
  }
  .cc-bill-box small {
    display: block;
    font-size: 10px;
    font-weight: 700;
    color: #64748b;
    margin-bottom: 4px;
  }
  .cc-bill-box strong {
    font-size: 13px;
    color: #0f172a;
  }
  .cc-bill-box p {
    margin: 3px 0 0;
    font-size: 11.5px;
    color: #475569;
  }

  .cc-inv-items-table {
    width: 100%;
    border-collapse: collapse;
    margin-bottom: 16px;
  }
  .cc-inv-items-table th {
    background: #f1f5f9;
    border: 1px solid #cbd5e1;
    padding: 8px 10px;
    font-size: 11px;
    text-transform: uppercase;
    text-align: left;
    color: #334155;
  }
  .cc-inv-items-table td {
    border: 1px solid #e2e8f0;
    padding: 10px;
    font-size: 12px;
    color: #0f172a;
  }

  .cc-inv-calc-split {
    display: grid;
    grid-template-columns: 1.2fr 1fr;
    gap: 16px;
    margin-bottom: 20px;
  }
  .cc-inv-bank-meta {
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 6px;
    padding: 12px;
    font-size: 11.5px;
  }
  .cc-inv-bank-meta p {
    margin: 4px 0;
    color: #334155;
  }

  .cc-inv-totals-box {
    border: 1px solid #cbd5e1;
    border-radius: 6px;
    overflow: hidden;
  }
  .cc-inv-trow {
    display: flex;
    justify-content: space-between;
    padding: 6px 12px;
    border-bottom: 1px solid #f1f5f9;
    font-size: 12px;
    color: #334155;
  }
  .cc-inv-trow.gross {
    background: #f8fafc;
    font-weight: 700;
  }
  .cc-inv-trow.net {
    background: #ecfdf5;
    border-bottom: 0;
    color: #047857;
    font-weight: 800;
    font-size: 13.5px;
    padding: 8px 12px;
  }

  .cc-inv-footer {
    display: flex;
    justify-content: space-between;
    align-items: flex-end;
    border-top: 1px solid #e2e8f0;
    padding-top: 14px;
    margin-top: 20px;
  }

  .cc-spin {
    animation: ccSpin 1s linear infinite;
  }
  @keyframes ccSpin {
    from { transform: rotate(0deg); }
    to { transform: rotate(360deg); }
  }

  @media print {
    body * {
      visibility: hidden;
    }
    .cc-printable-invoice, .cc-printable-invoice * {
      visibility: visible;
    }
    .cc-printable-invoice {
      position: absolute;
      left: 0;
      top: 0;
      width: 100%;
      border: 0 !important;
      padding: 0 !important;
    }
    .no-print {
      display: none !important;
    }
  }
`;
