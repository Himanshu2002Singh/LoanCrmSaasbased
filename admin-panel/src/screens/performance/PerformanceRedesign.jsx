import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import moment from "moment";
import { ListChecks, Phone, UserCheck, Users } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import API_URL from "../../config";
import { useStatuses } from "../../contexts/StatusContext";

const numberFormatter = new Intl.NumberFormat("en-IN");

// Loan products are configured per company, so the labels are read rather
// than listed here.

const CHART_COLORS = [
  "#047857",
  "#16a34a",
  "#f59e0b",
  "#3b82f6",
  "#8b5cf6",
  "#f97316",
  "#0891b2",
  "#db2777",
  "#22c55e",
  "#dc2626",
  "#14b8a6",
];

const KPI_TONE = {
  blue: { bg: "#eff6ff", border: "#bfdbfe", text: "#1d4ed8", icon: "#1d4ed8" },
  green: { bg: "#eef7f2", border: "#c7e0d4", text: "#065f46", icon: "#047857" },
  purple: { bg: "#f5f3ff", border: "#ddd6fe", text: "#5b21b6", icon: "#7c3aed" },
  indigo: { bg: "#eef2ff", border: "#c7d2fe", text: "#3730a3", icon: "#4338ca" },
};

const getDefaultRange = () => {
  const endDate = new Date();
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - 30);
  const format = (date) => date.toISOString().slice(0, 10);
  return { from: format(startDate), to: format(endDate) };
};

export default function PerformanceRedesign() {
  const { statuses } = useStatuses();
  const defaults = useMemo(getDefaultRange, []);
  const [employees, setEmployees] = useState([]);
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [dateRange, setDateRange] = useState(defaults);
  const [reportStats, setReportStats] = useState(null);
  const [loading, setLoading] = useState(false);
  const [empListLoading, setEmpListLoading] = useState(true);
  const [loanTypes, setLoanTypes] = useState([]);

  useEffect(() => {
    const fetchEmployees = async () => {
      setEmpListLoading(true);
      try {
        const res = await axios.get(`${API_URL}/users`, { params: { limit: 200 } });
        setEmployees(res.data?.data || []);
        const products = await axios.get(`${API_URL}/master-configs/LOAN_PRODUCT`);
        setLoanTypes(products.data?.data || []);
      } catch (error) {
        console.error("Error fetching employees", error);
      } finally {
        setEmpListLoading(false);
      }
    };
    fetchEmployees();
  }, []);

  useEffect(() => {
    if (!selectedEmpId || !dateRange.from || !dateRange.to) return;
    let cancelled = false;
    const fetchStats = async () => {
      setLoading(true);
      try {
        // The reports take a plain calendar date and widen it to the whole day
        // themselves; a full timestamp is rejected.
        const fromDate = moment(dateRange.from).format("YYYY-MM-DD");
        const toDate = moment(dateRange.to).format("YYYY-MM-DD");
        // The KPI figures and the two breakdowns come from different reports,
        // so both are read and folded into one shape for the charts.
        const [perfRes, dashRes] = await Promise.all([
          axios.get(`${API_URL}/reports/performance`, {
            params: { fromDate, toDate, employeeId: selectedEmpId },
          }),
          axios.get(`${API_URL}/reports/dashboard`, {
            params: { fromDate, toDate, employeeId: selectedEmpId },
          }),
        ]);

        const perf = perfRes.data?.employees?.[0] || {};
        const totalTasksCount = perf.totalTasks || 0;
        const completed = perf.completedTasks || 0;
        const present = perf.daysPresent || 0;
        const late = perf.lateDays || 0;

        if (!cancelled) {
          setReportStats({
            totalCalls: perf.totalCalls || 0,
            totalTasks: totalTasksCount,
            totalAttendance: present,
            totalLeads: perf.totalLeads || 0,
            tasksStatusCounts: {
              Completed: completed,
              Open: Math.max(totalTasksCount - completed, 0),
            },
            fullAttendance: Math.max(present - late, 0),
            lateAttendance: late,
            leadStatusCounts: dashRes.data?.leadStatusCounts || {},
            loanTypeCounts: dashRes.data?.loanTypeCounts || {},
          });
        }
      } catch (error) {
        console.error("Error fetching performance stats", error);
        if (!cancelled) setReportStats(null);
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    fetchStats();
    return () => {
      cancelled = true;
    };
  }, [selectedEmpId, dateRange.from, dateRange.to]);

  const totalCalls = reportStats?.totalCalls || 0;
  const totalTasks = reportStats?.totalTasks || 0;
  const totalAttendance = reportStats?.totalAttendance || 0;
  const totalLeads = reportStats?.totalLeads || 0;

  const tasksCounts = reportStats?.tasksStatusCounts || {};
  const openTasks = tasksCounts.Open || 0;
  const completedTasks = tasksCounts.Completed || 0;

  const fullAttendance = reportStats?.fullAttendance || 0;
  const lateAttendance = reportStats?.lateAttendance || 0;

  const leadStatusCounts = reportStats?.leadStatusCounts || {};
  const activeStatusName =
    statuses.length > 1 ? statuses[1].name : statuses.length > 0 ? statuses[0].name : "Interested";
  const interestedCount = leadStatusCounts[activeStatusName] || 0;

  const taskStatusData = [
    { name: "Open", value: openTasks, color: "#f59e0b" },
    { name: "Completed", value: completedTasks, color: "#10b981" },
  ].filter((entry) => entry.value > 0);

  const attendanceData = [
    { name: "Present", value: fullAttendance, color: "#10b981" },
    { name: "Late", value: lateAttendance, color: "#f59e0b" },
  ].filter((entry) => entry.value > 0);

  const leadStatusData = useMemo(
    () =>
      statuses
        .map((status, index) => ({
          name: status.name,
          value: leadStatusCounts[status.name] || 0,
          color: status.color || CHART_COLORS[index % CHART_COLORS.length],
        }))
        .filter((entry) => entry.value > 0),
    [statuses, leadStatusCounts]
  );

  const loanTypeCounts = reportStats?.loanTypeCounts || {};
  const loanTypeData = useMemo(
    () =>
      loanTypes
        .map((loan, index) => ({
          name: loan.label,
          value: loanTypeCounts[loan.value] || 0,
          color: CHART_COLORS[index % CHART_COLORS.length],
        }))
        .filter((entry) => entry.value > 0),
    [loanTypeCounts, loanTypes]
  );

  const selectedEmployee = employees.find((emp) => String(emp.id) === String(selectedEmpId)) || null;

  return (
    <div className="cc-report-redesign cc-perf">
      <style>{styles}</style>

      <section className="cc-report-panel">
        <div className="cc-perf-toolbar">
          <div className="cc-perf-title">
            <h1>Employee performance</h1>
            {selectedEmployee ? (
              <p>
                <strong>{selectedEmployee.name}</strong>
                <span>&middot; {selectedEmployee.id}</span>
                <span>&middot; {moment(dateRange.from).format("DD MMM YYYY")} → {moment(dateRange.to).format("DD MMM YYYY")}</span>
              </p>
            ) : (
              <p>Pick an employee to load their calls, tasks, attendance and leads.</p>
            )}
          </div>
          <div className="cc-perf-controls">
            <label className="cc-perf-field">
              <span>Employee</span>
              <select
                value={selectedEmpId}
                onChange={(event) => setSelectedEmpId(event.target.value)}
                disabled={empListLoading}
              >
                <option value="">{empListLoading ? "Loading..." : "Select employee"}</option>
                {employees.map((emp) => (
                  <option key={emp.id} value={emp.id}>
                    {emp.name} ({emp.id})
                  </option>
                ))}
              </select>
            </label>
            <label className="cc-perf-field">
              <span>From date</span>
              <input
                type="date"
                value={dateRange.from}
                max={dateRange.to}
                onChange={(event) => setDateRange((prev) => ({ ...prev, from: event.target.value }))}
              />
            </label>
            <label className="cc-perf-field">
              <span>To date</span>
              <input
                type="date"
                value={dateRange.to}
                min={dateRange.from}
                onChange={(event) => setDateRange((prev) => ({ ...prev, to: event.target.value }))}
              />
            </label>
          </div>
        </div>
      </section>

      {!selectedEmpId ? (
        <section className="cc-report-panel cc-perf-empty">
          <Users size={28} />
          <h2>Select an employee</h2>
          <p>Pick an employee above to see their calls, tasks, attendance and lead performance for the selected date range.</p>
        </section>
      ) : (
        <>
          <section className="cc-perf-kpis">
            <KpiCard
              label="Total calls"
              value={totalCalls}
              hint="in selected range"
              icon={<Phone size={18} />}
              tone="blue"
              loading={loading}
            />
            <KpiCard
              label="Total tasks"
              value={totalTasks}
              hint={`${completedTasks} completed`}
              icon={<ListChecks size={18} />}
              tone="green"
              loading={loading}
            />
            <KpiCard
              label="Total attendance"
              value={totalAttendance}
              hint={`${lateAttendance} late arrivals`}
              icon={<UserCheck size={18} />}
              tone="purple"
              loading={loading}
            />
            <KpiCard
              label="Total leads"
              value={totalLeads}
              hint={`${interestedCount} ${activeStatusName.toLowerCase()}`}
              icon={<Users size={18} />}
              tone="indigo"
              loading={loading}
            />
          </section>

          <div className="cc-perf-grid-2">
            <PieCard title="Task status" data={taskStatusData} loading={loading} />
            <PieCard title="Attendance" data={attendanceData} loading={loading} />
          </div>

          <BarCard title="Leads by status" data={leadStatusData} loading={loading} />
          <BarCard title="Leads by loan type" data={loanTypeData} loading={loading} />

        </>
      )}
    </div>
  );
}

function KpiCard({ label, value, hint, icon, tone = "blue", loading }) {
  const palette = KPI_TONE[tone] || KPI_TONE.blue;
  return (
    <article
      className="cc-perf-kpi"
      style={{
        background: palette.bg,
        borderColor: palette.border,
      }}
    >
      <div>
        <span style={{ color: palette.text }}>{label}</span>
        <strong style={{ color: palette.text }}>
          {loading ? <span className="cc-perf-skel-inline" /> : numberFormatter.format(value || 0)}
        </strong>
        {hint ? <small>{hint}</small> : null}
      </div>
      <i style={{ background: "#fff", color: palette.icon }}>{icon}</i>
    </article>
  );
}

function PieCard({ title, data, loading }) {
  return (
    <section className="cc-report-panel">
      <h2>{title}</h2>
      <div className="cc-perf-chart" style={{ height: 280 }}>
        {loading ? (
          <SkeletonChart />
        ) : data.length === 0 ? (
          <EmptyChart text="No data for this range" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                innerRadius={48}
                outerRadius={90}
                paddingAngle={2}
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {data.map((entry) => (
                  <Cell key={entry.name} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip />
              <Legend verticalAlign="bottom" iconType="circle" wrapperStyle={{ fontSize: 12 }} />
            </PieChart>
          </ResponsiveContainer>
        )}
      </div>
    </section>
  );
}

function BarCard({ title, data, loading }) {
  return (
    <section className="cc-report-panel">
      <h2>{title}</h2>
      <div
        className="cc-perf-chart"
        style={{ height: Math.max(220, data.length * 34 + 60) }}
      >
        {loading ? (
          <SkeletonChart />
        ) : data.length === 0 ? (
          <EmptyChart text="No data for this range" />
        ) : (
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={data} layout="vertical" margin={{ top: 10, right: 28, left: 16, bottom: 10 }}>
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
        )}
      </div>
    </section>
  );
}

function EmptyChart({ text }) {
  return <div className="cc-perf-empty-chart">{text}</div>;
}

function SkeletonChart() {
  return <div className="cc-perf-skeleton" />;
}

const styles = `
  .cc-perf-toolbar { display:flex; flex-wrap:wrap; justify-content:space-between; align-items:flex-end; gap:16px; }
  .cc-perf-title h1 { margin:0; font-size:22px; font-weight:700; color:#0f172a; letter-spacing:-0.01em; }
  .cc-perf-title p { margin:6px 0 0; font-size:13px; color:#475569; display:flex; flex-wrap:wrap; gap:6px; align-items:center; }
  .cc-perf-title p strong { color:#0f172a; font-weight:600; }
  .cc-perf-title p span { color:#94a3b8; }

  .cc-perf-controls { display:flex; flex-wrap:wrap; gap:10px; }
  .cc-perf-field { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569; }
  .cc-perf-field select, .cc-perf-field input { padding:8px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; min-width:160px; }
  .cc-perf-field select:focus, .cc-perf-field input:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }

  .cc-perf-empty { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:8px; padding:60px 20px; text-align:center; color:#475569; }
  .cc-perf-empty h2 { margin:0; font-size:18px; font-weight:700; color:#0f172a; }
  .cc-perf-empty p { margin:0; font-size:13.5px; max-width:420px; }

  .cc-perf-kpis { display:grid; grid-template-columns:repeat(auto-fit,minmax(200px,1fr)); gap:14px; }
  .cc-perf-kpi { display:flex; align-items:center; justify-content:space-between; gap:14px; border:1px solid #e2e8f0; border-radius:14px; padding:16px 18px; }
  .cc-perf-kpi span { display:block; font-size:12px; font-weight:600; letter-spacing:0.03em; text-transform:uppercase; }
  .cc-perf-kpi strong { display:block; margin-top:4px; font-size:26px; font-weight:700; letter-spacing:-0.01em; font-variant-numeric:tabular-nums; }
  .cc-perf-kpi small { display:block; margin-top:4px; font-size:12px; color:#64748b; }
  .cc-perf-kpi i { display:grid; place-items:center; width:44px; height:44px; border-radius:12px; border:1px solid rgba(15,23,42,0.06); font-style:normal; }
  .cc-perf-skel-inline { display:inline-block; width:60px; height:22px; border-radius:6px; background:linear-gradient(90deg,#e2e8f0,#f1f5f9,#e2e8f0); background-size:200% 100%; animation:cc-perf-skel 1.2s linear infinite; vertical-align:middle; }

  .cc-perf-grid-2 { display:grid; grid-template-columns:repeat(auto-fit,minmax(320px,1fr)); gap:16px; }
  .cc-perf-chart { width:100%; }
  .cc-perf-empty-chart { display:grid; place-items:center; height:100%; color:#94a3b8; font-size:13px; }
  .cc-perf-skeleton { width:100%; height:100%; border-radius:12px; background:linear-gradient(90deg,#f1f5f9,#e2e8f0,#f1f5f9); background-size:200% 100%; animation:cc-perf-skel 1.4s linear infinite; }

  @keyframes cc-perf-skel { 0%{background-position:200% 0;} 100%{background-position:-200% 0;} }
`;
