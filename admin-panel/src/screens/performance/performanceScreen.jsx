import React, { useState, useEffect } from 'react';
import moment from "moment";
import { 
  Calendar, 
  ChevronDown, 
  ChevronUp, 
  BarChart2, 
  PieChart as PieChartIcon, 
  Users, 
  Phone, 
  FileText, 
  CheckCircle, 
  XCircle,
  Clock,
  UserCheck,
  ListChecks,
  Search
} from 'lucide-react';
import axios from "axios";
import { useStatuses } from '../../contexts/StatusContext';
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  PieChart,
  Pie,
  Legend,
  LineChart,
  Line,
  CartesianGrid
} from "recharts";
import API_URL from '../../config';

const PerformanceScreen = () => {
  const { statuses } = useStatuses();
  const [employee, setEmployee] = useState(null);
  const [allEmployees, setAllEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [fromDate, setFromDate] = useState('');
  const [toDate, setToDate] = useState('');
  const [calls, setCalls] = useState([]); // Kept for state shape but not used for aggregate
  const [reportStats, setReportStats] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');

  // Use reportStats from backend
  const totalCalls = reportStats?.totalCalls || 0;
  const totalTasks = reportStats?.totalTasks || 0;
  const totalAttendance = reportStats?.totalAttendance || 0;
  const totalLeads = reportStats?.totalLeads || 0;

  // Task status counts
  const tasksCounts = reportStats?.tasksStatusCounts || {};
  const initialTasks = tasksCounts['Initial'] || 0;
  const onGoingTasks = tasksCounts['On Going'] || 0;
  const completedTasks = tasksCounts['Completed'] || 0;

  // Attendance status counts
  const fullAttendance = reportStats?.fullAttendance || 0;
  const lateAttendance = reportStats?.lateAttendance || 0;

  // Lead status counts
  const leadStatusCounts = reportStats?.leadStatusCounts || {};

  const activeStatusName = statuses.length > 1 ? statuses[1].name : (statuses.length > 0 ? statuses[0].name : "Interested");
  const interestedCount = leadStatusCounts[activeStatusName] || 0;

  // Data for charts
  const taskStatusData = [
    { name: 'Initial', value: initialTasks, color: '#f59e0b' },
    { name: 'On Going', value: onGoingTasks, color: '#3b82f6' },
    { name: 'Completed', value: completedTasks, color: '#10b981' }
  ];

  const attendanceData = [
    { name: 'Present', value: fullAttendance, color: '#10b981' },
    { name: 'Late', value: lateAttendance, color: '#f59e0b' },
  ];

  const leadStatusData = statuses.map((status, idx) => {
    const colors = [
      "#f59e0b", "#3b82f6", "#60a5fa", "#a5b4fc", "#f87171",
      "#10b981", "#f59e0b", "#3b82f6", "#60a5fa", "#6366f1",
      "#ec4899", "#22d3ee"
    ];
    return {
      name: status.name,
      value: leadStatusCounts[status.name] || 0,
      color: colors[idx % colors.length]
    };
  });

  const backendLoanCounts = reportStats?.loanTypeCounts || {};
  const loanTypeData = [
    { name: 'Home Loans', value: backendLoanCounts['Home Loan'] || 0, color: '#3b82f6' },
    { name: 'User Car Loans', value: backendLoanCounts['User Car Loan'] || 0, color: '#f97316' },
    { name: 'Business Loans', value: backendLoanCounts['Business Loan'] || 0, color: '#f59e0b' },
    { name: 'Personal Loans', value: backendLoanCounts['Personal Loan'] || 0, color: '#10b981' },
    { name: 'DOD Loans', value: backendLoanCounts['DOD'] || 0, color: '#f43f5e' },
    { name: 'Mortgage Loans', value: backendLoanCounts['Mortgage Loan'] || 0, color: '#8b5cf6' },
    { name: 'CC/OD', value: backendLoanCounts['CC/OD'] || 0, color: '#4ade80' },
    { name: 'CGTMSME', value: backendLoanCounts['CGTMSME'] || 0, color: '#a78bfa' },
    { name: 'Mutual Fund', value: backendLoanCounts['Mutual Fund'] || 0, color: '#8b5cf6' },
    { name: 'Insurance', value: backendLoanCounts['Insurance'] || 0, color: '#ec4899' },
    { name: 'Other', value: backendLoanCounts['Other'] || 0, color: '#f43f5e' }
  ];

  // Fetch all employees on component mount
  useEffect(() => {
    const fetchAllEmployees = async () => {
      try {
        const response = await axios.get(`${API_URL}/employees`);
        setAllEmployees(response.data.employees);
      } catch (error) {
        console.error("Error fetching employees", error);
      } finally{
        setLoading(false);
      }
    };
    
    fetchAllEmployees();
  }, []);

  // Set default dates (last 30 days)
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const formatDate = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };

    setFromDate(formatDate(startDate));
    setToDate(formatDate(endDate));
  }, []);

  // Fetch performance data when dates or selected employee changes
  useEffect(() => {
    if (fromDate && toDate && employee) {
      fetchData();
    }
  }, [fromDate, toDate, employee]);

  const fetchData = async () => {
    try {
      if(employee!==null){
        setLoading(true);
      }
      
      const params = { 
        startDate: fromDate ? moment(fromDate).startOf('day').toISOString() : '',
        endDate: toDate ? moment(toDate).endOf('day').toISOString() : '',
        userId : employee.emp_id,
      };

      const response = await axios.get(`${API_URL}/performanceStats`, { params });
      setReportStats(response.data.data);
      setLoading(false);
    } catch (error) {
      console.error("Error fetching performance data", error);
      setLoading(false);
    }
  };

  const handleEmployeeChange = (e) => {
    const val = e.target.value;
    if (!val) {
      setEmployee(null);
      return;
    }
    try {
      const selectedEmp = JSON.parse(val);
      setEmployee(selectedEmp);
    } catch (err) {
      console.error("Error parsing employee:", err);
      setEmployee(null);
    }
  };

  const renderPieChart = (data, title) => {
    return (
      <div className="bg-white rounded-lg shadow p-4 h-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={data}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${(value)}`}
              >
                {data.map((entry, index) => (
                  <Cell key={`cell-${index}`} fill={entry.color} />
                ))}
              </Pie>
              <Tooltip 
                formatter={(value) => [`${value}`, 'Count']}
                labelFormatter={(name) => `Status: ${name}`}
              />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        </div>
      </div>
    );
  };

const renderBarChart = (data, title, dataKey = "value") => {
  return (
    <div className="bg-white rounded-2xl shadow-lg p-6 h-full">
      <h3 className="text-xl font-bold text-gray-800 mb-6">{title}</h3>
      <div className="h-[500px]">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            margin={{
              top: 10,
              right: 30,
              left: 40,
              bottom: 20,
            }}
            layout="vertical" // Horizontal bars
          >
            <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
            <XAxis type="number" tick={{ fontSize: 12, fill: "#4b5563" }} />
            <YAxis
              dataKey="name"
              type="category"
              width={120}
              tick={{ fontSize: 12, fill: "#4b5563", fontWeight: 500 }}
              interval={0} 
            />
            <Tooltip
              contentStyle={{ backgroundColor: "#f9fafb", borderRadius: "8px", borderColor: "#e5e7eb" }}
              formatter={(value) => [`${value}`, 'Count']}
              labelFormatter={(name) => `Category: ${name}`}
            />
            <Legend wrapperStyle={{ fontSize: 12, color: "#4b5563" }} />
            <Bar dataKey={dataKey} radius={[8, 8, 8, 8]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color || "#3b82f6"} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
};

  const callsPerDay = reportStats?.callsPerDay || {};

  // 🔥 3. Fill all dates (even with 0 calls)
  const chartData = [];
  if (Object.keys(callsPerDay).length > 0) {
    const dates = Object.keys(callsPerDay).map(d => moment(d)).filter(d => d.isValid());
    const minDate = moment.min(dates);
    const maxDate = moment.max(dates);

    for (let m = minDate.clone(); m.isSameOrBefore(maxDate, 'day'); m.add(1, "day")) {
      const dateStr = m.format("YYYY-MM-DD");
      chartData.push({
        date: dateStr,
        calls: callsPerDay[dateStr] || 0,
      });
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center items-center h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">
              Employee Performance Dashboard
            </h1>
            {employee && (
              <p className="text-gray-600">
                {employee.ename} - {employee.emp_id}
              </p>
            )}
            <p className="text-gray-600 mt-1">
              {new Date(fromDate).toLocaleDateString()} to {new Date(toDate).toLocaleDateString()}
            </p>
          </div>
          
          <div className="flex flex-col md:flex-row gap-4 mt-4 md:mt-0">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Select Employee</label>
              <select
                value={employee ? JSON.stringify(employee) : ""}
                onChange={handleEmployeeChange}
                className="border rounded-md px-3 py-2 text-sm w-full md:w-64 focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Select Employee</option>
                {allEmployees.map((emp) => (
                  <option key={emp.emp_id} value={JSON.stringify(emp)}>
                    {emp.ename} ({emp.emp_id})
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded-md px-3 py-2 text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>

        {!employee ? (
          <div className="text-center py-8 text-gray-500">
            Please select an employee to view performance data
          </div>
        ) : (
          <>
            {/* Summary Cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
              <div className="bg-blue-50 rounded-lg p-4 border border-blue-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-blue-600">Total Calls</p>
                    <p className="text-2xl font-bold text-blue-800">{totalCalls}</p>
                    <p className="text-xs text-blue-500 mt-1">Last 30 days</p>
                  </div>
                  <div className="bg-blue-100 p-3 rounded-full">
                    <Phone className="w-6 h-6 text-blue-600" />
                  </div>
                </div>
              </div>

              <div className="bg-green-50 rounded-lg p-4 border border-green-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-green-600">Total Tasks</p>
                    <p className="text-2xl font-bold text-green-800">{totalTasks}</p>
                    <p className="text-xs text-green-500 mt-1">{completedTasks} completed</p>
                  </div>
                  <div className="bg-green-100 p-3 rounded-full">
                    <ListChecks className="w-6 h-6 text-green-600" />
                  </div>
                </div>
              </div>

              <div className="bg-purple-50 rounded-lg p-4 border border-purple-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-purple-600">Total Attendance</p>
                    <p className="text-2xl font-bold text-purple-800">{totalAttendance}</p>
                    <p className="text-xs text-purple-500 mt-1">{lateAttendance} late arrivals</p>
                  </div>
                  <div className="bg-purple-100 p-3 rounded-full">
                    <UserCheck className="w-6 h-6 text-purple-600" />
                  </div>
                </div>
              </div>

              <div className="bg-indigo-50 rounded-lg p-4 border border-indigo-200 hover:shadow-md transition-shadow">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm font-medium text-indigo-600">Total Leads</p>
                    <p className="text-2xl font-bold text-indigo-800">{totalLeads}</p>
                    <p className="text-xs text-indigo-500 mt-1">{interestedCount} {activeStatusName.toLowerCase()}</p>
                  </div>
                  <div className="bg-indigo-100 p-3 rounded-full">
                    <Users className="w-6 h-6 text-indigo-600" />
                  </div>
                </div>
              </div>
            </div>

            {/* Charts Section */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
              {renderPieChart(taskStatusData, "Task Status Distribution")}
              {renderPieChart(attendanceData, "Attendance Status")}
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              {renderBarChart(leadStatusData, "Leads by Status")}
            </div>

            <div className="grid grid-cols-1 gap-6 mb-6">
              {renderBarChart(loanTypeData, "Leads by Loan Type")}
            </div>

            {/* Calls Over Time Chart */}
            <div className="grid grid-cols-1 gap-6 mb-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h3 className="text-lg font-semibold mb-4">Calls Over Time</h3>
        <div className="h-80">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis
                dataKey="date"
                tick={{ fontSize: 12 }}
              />
              <YAxis />
              <Tooltip
                formatter={(value) => [`${value} calls`, 'Count']}
                labelFormatter={(date) => `Date: ${date}`}
              />
              <Legend />
              <Line
                type="monotone"
                dataKey="calls"
                stroke="#3b82f6"
                name="Calls"
                strokeWidth={2}
                dot={{ r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </div>
    </div>
  
          </>
        )}
      </div>
    </div>
  );
};

export default PerformanceScreen;