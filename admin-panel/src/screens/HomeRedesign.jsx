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
import API_URL from "../config";
import LeadsPopup from "../components/leadsPopup";

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
  const [stats, setStats] = useState({
    counts: {
      totalCalls: 0,
      totalLeads: 0,
      todayFollowups: 0,
      tomorrowFollowups: 0,
      pendingFollowups: 0,
    },
    leadStatusCounts: {},
    loanTypeCounts: {},
    employeeStats: [],
  });
  const [filteredLeadStats, setFilteredLeadStats] = useState(null);

  const fetchData = async (startDate, endDate) => {
    try {
      const response = await axios.get(`${API_URL}/reports/dashboard`, {
        params: { fromDate: startDate, toDate: endDate },
      });
      if (response.data?.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats", error);
    }
  };

  useEffect(() => {
    fetchData(fromDate, toDate);
  }, [fromDate, toDate]);

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
          // The endpoint counts by employee and date only, so a chosen status
          // is applied here by keeping just that slice of the status counts.
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

  return (
    <div className="cc-dashboard">
      <LeadsPopup
        isOpen={showPopup}
        onClose={() => setShowPopup(false)}
        title={modalTitle}
        startDate={fromDate}
        endDate={toDate}
      />

      <section className="cc-kpi-strip">
        <button type="button" onClick={() => openMetric("Total Leads")}>
          <strong>{numberFormatter.format(totalFilteredLeads)}</strong>
          <span>{isFiltered ? "Filtered leads" : "Total leads"}</span>
        </button>
        <button type="button" onClick={() => openMetric("Total Calls")}>
          <strong>{numberFormatter.format(selectedEmployeeCalls)}</strong>
          <span>Calls</span>
        </button>
        <button type="button" onClick={() => openMetric("Today Followups")}>
          <strong>{numberFormatter.format(stats.counts?.todayFollowups || 0)}</strong>
          <span>Today's follow-ups</span>
        </button>
        <button type="button" onClick={() => openMetric("Pending Followups")}>
          <strong className="cc-danger-text">{numberFormatter.format(overdueCount)}</strong>
          <span>Overdue</span>
        </button>
      </section>

      <FullWidthBarChart title="Leads by Status" data={leadStatusData} minWidth={1180} />
      <FullWidthBarChart title="Leads by Loan Type" data={loanTypeData} minWidth={960} />

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

export default HomeRedesign;
