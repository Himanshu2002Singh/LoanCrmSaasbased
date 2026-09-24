import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { CalendarDays, Search, User, Users } from "lucide-react";
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

import API_URL from "../../config";
import CcPagination from "../../components/CcPagination";
import { useStatuses } from "../../contexts/StatusContext";

// Loan products are configured per company, so the labels are read rather
// than listed here.

const chartColors = ["#047857", "#16a34a", "#f59e0b", "#3b82f6", "#8b5cf6", "#f97316", "#14b8a6", "#6366f1"];
const numberFormatter = new Intl.NumberFormat("en-IN");

const getDefaultDateRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);

  return {
    startDate: startDate.toISOString().split("T")[0],
    endDate: endDate.toISOString().split("T")[0],
  };
};

function LeadReportRedesign() {
  const { statuses, getStatusNamesWithAll } = useStatuses();
  const defaultRange = useMemo(getDefaultDateRange, []);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("All");
  const [dateRange, setDateRange] = useState(defaultRange);
  const [leads, setLeads] = useState([]);
  const [reportStats, setReportStats] = useState({ leadStatusCounts: {}, loanTypeCounts: {} });
  const [loanTypes, setLoanTypes] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const statusList = getStatusNamesWithAll();
  const leadsPerPage = 10;

  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const response = await axios.get(`${API_URL}/users`, { params: { limit: 200 } });
        setEmployees(response.data?.data || []);
        const products = await axios.get(`${API_URL}/master-configs/LOAN_PRODUCT`);
        setLoanTypes(products.data?.data || []);
      } catch (error) {
        console.error("Error fetching employees", error);
      }
    };

    fetchEmployees();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  useEffect(() => {
    const fetchReport = async () => {
      setLoading(true);
      // The API widens a calendar date to the whole day itself; a full
      // timestamp is rejected.
      const startDate = dateRange.startDate ? moment(dateRange.startDate).format("YYYY-MM-DD") : "";
      const endDate = dateRange.endDate ? moment(dateRange.endDate).format("YYYY-MM-DD") : "";
      const status = selectedStatus === "All" ? "" : selectedStatus;

      try {
        const [leadResponse, statsResponse] = await Promise.all([
          axios.get(`${API_URL}/leads`, {
            params: {
              assignedEmployeeId: selectedEmpId || undefined,
              fromDate: startDate,
              toDate: endDate,
              status: status || undefined,
              limit: leadsPerPage,
              page: currentPage,
            },
          }),
          // The status and loan-type breakdowns for the same filters.
          axios.get(`${API_URL}/reports/dashboard`, {
            params: {
              employeeId: selectedEmpId || undefined,
              fromDate: startDate,
              toDate: endDate,
            },
          }),
        ]);

        setLeads(leadResponse.data?.data || []);
        setTotalPages(leadResponse.data?.pagination?.totalPages || 1);
        setTotalLeadsCount(leadResponse.data?.pagination?.totalItems || 0);
        setReportStats({
          leadStatusCounts: statsResponse.data?.leadStatusCounts || {},
          loanTypeCounts: statsResponse.data?.loanTypeCounts || {},
        });
      } catch (error) {
        console.error("Error fetching lead report", error);
        setLeads([]);
        setTotalPages(1);
        setTotalLeadsCount(0);
      } finally {
        setLoading(false);
      }
    };

    fetchReport();
  }, [currentPage, dateRange.endDate, dateRange.startDate, selectedEmpId, selectedStatus]);

  const leadStatusData = useMemo(() => {
    const counts = reportStats.leadStatusCounts || {};
    return statuses
      .map((status, index) => ({
        name: status.name,
        value: counts[status.name] || 0,
        color: status.color || chartColors[index % chartColors.length],
      }))
      .filter((item) => item.value > 0);
  }, [reportStats.leadStatusCounts, statuses]);

  const loanTypeData = useMemo(() => {
    const counts = reportStats.loanTypeCounts || {};
    return loanTypes
      .map((loan, index) => ({
        name: loan.label,
        value: counts[loan.value] || 0,
        color: chartColors[index % chartColors.length],
      }))
      .filter((item) => item.value > 0);
  }, [reportStats.loanTypeCounts, loanTypes]);

  const visibleLeads = leads.filter((lead) => {
    if (!debouncedSearchTerm.trim()) return true;
    const query = debouncedSearchTerm.toLowerCase();
    return [lead.lead_id, lead.name, lead.number, lead.status, lead.loan_type]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(query));
  });

  const topCards = leadStatusData.slice(0, 3);

  const updateDate = (key, value) => {
    setCurrentPage(1);
    setDateRange((current) => ({ ...current, [key]: value }));
  };

  return (
    <div className="cc-report-redesign">
      <section className="cc-report-filters">
        <label>
          <span>Select user</span>
          <select
            value={selectedEmpId}
            onChange={(event) => {
              setSelectedEmpId(event.target.value);
              setCurrentPage(1);
            }}
          >
            <option value="">All employees</option>
            {employees.map((employee) => (
              <option key={employee.id} value={employee.id}>
                {employee.name} ({employee.id})
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Select status</span>
          <select
            value={selectedStatus}
            onChange={(event) => {
              setSelectedStatus(event.target.value);
              setCurrentPage(1);
            }}
          >
            {statusList.map((status) => (
              <option key={status} value={status}>
                {status}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>From date</span>
          <input type="date" value={dateRange.startDate} max={dateRange.endDate} onChange={(event) => updateDate("startDate", event.target.value)} />
        </label>
        <label>
          <span>To date</span>
          <input type="date" value={dateRange.endDate} min={dateRange.startDate} onChange={(event) => updateDate("endDate", event.target.value)} />
        </label>
      </section>

      <section className="cc-report-cards">
        <MetricCard label="Total leads" value={totalLeadsCount} icon={Users} />
        {topCards.map((card, index) => (
          <MetricCard key={card.name} label={card.name} value={card.value} icon={User} color={chartColors[(index + 1) % chartColors.length]} />
        ))}
      </section>

      <ReportBarPanel title="Leads by Status" data={leadStatusData} />
      <ReportBarPanel title="Leads by Loan Type" data={loanTypeData} />

      <section className="cc-report-panel">
        <div className="cc-report-table-head">
          <h2>Lead details</h2>
          <label className="cc-report-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search leads by name, ID, phone, status or loan type..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
        </div>

        <div className="cc-report-table-scroll">
          <table>
            <thead>
              <tr>
                <th>Lead ID</th>
                <th>Client name</th>
                <th>Number</th>
                <th>Status</th>
                <th>Date</th>
                <th>Loan type</th>
              </tr>
            </thead>
            <tbody>
              {visibleLeads.length ? (
                visibleLeads.map((lead) => (
                  <tr key={lead.lead_id}>
                    <td>{lead.lead_id}</td>
                    <td>{lead.name || "--"}</td>
                    <td>{lead.number || "--"}</td>
                    <td>
                      <span className="cc-report-status">{lead.status || "--"}</span>
                    </td>
                    <td>{lead.createdAt ? moment(lead.createdAt).format("DD MMM YYYY") : "--"}</td>
                    <td>{lead.loan_type || "--"}</td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="6" className="cc-report-empty">
                    {loading ? "Loading leads..." : "No leads found"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <CcPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={totalLeadsCount}
          onPageChange={setCurrentPage}
          itemLabel="leads"
        />
      </section>
    </div>
  );
}

function MetricCard(props) {
  const { label, value, color = "#047857" } = props;
  const Icon = props.icon;
  return (
    <article className="cc-report-card" style={{ "--card-color": color }}>
      <div>
        <span>{label}</span>
        <strong>{numberFormatter.format(value || 0)}</strong>
      </div>
      <i>
        <Icon size={20} />
      </i>
    </article>
  );
}

function ReportBarPanel({ title, data }) {
  return (
    <section className="cc-report-panel">
      <h2>{title}</h2>
      <div className="cc-report-chart cc-report-bar" style={{ height: Math.max(280, data.length * 34) }}>
        {data.length ? (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 28, left: 18, bottom: 10 }}>
              <CartesianGrid stroke="#e6ece9" strokeDasharray="3 3" horizontal={false} />
              <XAxis type="number" tick={{ fontSize: 11, fill: "#475569" }} />
              <YAxis dataKey="name" type="category" width={132} tick={{ fontSize: 12, fill: "#334155" }} interval={0} />
              <Tooltip />
              <Bar dataKey="value" radius={[0, 8, 8, 0]} barSize={18}>
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        ) : (
          <EmptyChart icon={CalendarDays} text="No data for selected filters" />
        )}
      </div>
    </section>
  );
}

function EmptyChart(props) {
  const Icon = props.icon;
  return (
    <div className="cc-report-empty-chart">
      <Icon size={24} />
      <span>{props.text}</span>
    </div>
  );
}

export default LeadReportRedesign;
