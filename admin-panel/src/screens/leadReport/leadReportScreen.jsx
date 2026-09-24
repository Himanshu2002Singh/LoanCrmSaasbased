import React, { useState, useEffect } from 'react';
import { Calendar, User, ChevronDown, ChevronUp, Search } from 'lucide-react';
import API_URL from '../../config';
import axios from "axios";
import moment from "moment";
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

const LeadsReport = () => {
  const { statuses, getStatusNamesWithAll, loading: statusesLoading } = useStatuses();
  const [selectedEmpId, setSelectedEmpId] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [dateRange, setDateRange] = useState({
    startDate: '',
    endDate: ''
  });
  const [leadsData, setLeadsData] = useState([]);
  const [reportStats, setReportStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [allEmployees, setAllEmployees] = useState([]);
  const [searchTerm, setSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalLeadsCount, setTotalLeadsCount] = useState(0);
  const leadsPerPage = 10;

  const statusList = getStatusNamesWithAll();

  // Set default date range (last 30 days)
  useEffect(() => {
    const endDate = new Date();
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - 30);
    
    const formatDate = (date) => {
      return date.toISOString().split('T')[0];
    };

    setDateRange({
      startDate: formatDate(startDate),
      endDate: formatDate(endDate)
    });
  }, []);

  // Fetch all employees
  const fetchAllEmployees = async () => {
    try {
      const response = await axios.get(`${API_URL}/employees`);
      setAllEmployees(response.data.employees);
    } catch (error) {
      console.error("Error fetching employees", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchAllEmployees();
  }, []);

  // Fetch leads data and stats
  useEffect(() => {
    const fetchData = async () => {
      setLoading(true);
      const params = { 
        emp_id: selectedEmpId,
        startDate: dateRange.startDate ? moment(dateRange.startDate).startOf('day').toISOString() : '',
        endDate: dateRange.endDate ? moment(dateRange.endDate).endOf('day').toISOString() : '',
        status: selectedStatus === "All" ? "" : selectedStatus,
        limit: leadsPerPage,
        page: currentPage,
      };

      const statsParams = {
        emp_id: selectedEmpId,
        startDate: dateRange.startDate ? moment(dateRange.startDate).startOf('day').toISOString() : '',
        endDate: dateRange.endDate ? moment(dateRange.endDate).endOf('day').toISOString() : '',
        status: selectedStatus === "All" ? "" : selectedStatus,
      };

      try {
        const [leadResponse, statsResponse] = await Promise.all([
          axios.get(`${API_URL}/getFilteredLeads`, { params }),
          axios.get(`${API_URL}/leadReportStats`, { params: statsParams })
        ]);
        
        setLeadsData(leadResponse.data.data || []);
        if (leadResponse.data.pagination) {
          setTotalPages(leadResponse.data.pagination.totalPages || 1);
          setTotalLeadsCount(leadResponse.data.pagination.totalItems || 0);
        }
        
        setReportStats(statsResponse.data.data);
      } catch (error) {
        console.error("Error fetching data", error);
        setLeadsData([]);
        setReportStats(null);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, [selectedEmpId, dateRange, selectedStatus, currentPage]);

  // Filter leads based on search term for current page leads (Note: full text search requires backend support, so we only filter current page or rely on backend search if implemented)
  const filteredLeads = leadsData.filter(lead => {
    if (!searchTerm) return true;
    const searchLower = searchTerm.toLowerCase();
    return (
      lead.name?.toLowerCase().includes(searchLower) ||
      lead.lead_id?.toString().includes(searchTerm) ||
      lead.number?.includes(searchTerm) ||
      lead.status?.toLowerCase().includes(searchLower) ||
      lead.loan_type?.toLowerCase().includes(searchLower)
    );
  });

  const currentLeads = filteredLeads;

  // Lead status counts - dynamic based on backend statuses
  const leadStatusCounts = reportStats?.leadStatusCounts || {};

  const leadStatusData = statuses.map((status, index) => ({
    name: status.name,
    value: leadStatusCounts[status.name] || 0,
    color: getStatusColor(index),
  })).filter(item => item.value > 0);

  function getStatusColor(index) {
    const colors = [
      '#f59e0b', '#3b82f6', '#60a5fa', '#a5b4fc', '#f87171',
      '#10b981', '#f59e0b', '#3b82f6', '#60a5fa', '#6366f1',
      '#ec4899', '#22d3ee', '#8b5cf6', '#f97316', '#14b8a6'
    ];
    return colors[index % colors.length];
  }

  function getStatusBadgeColor(statusName) {
    const statusIndex = statuses.findIndex(s => s.name === statusName);
    if (statusIndex === -1) return 'bg-gray-100 text-gray-800';
    
    const colorMap = [
      'bg-blue-100 text-blue-800',
      'bg-green-100 text-green-800',
      'bg-yellow-100 text-yellow-800',
      'bg-red-100 text-red-800',
      'bg-purple-100 text-purple-800',
      'bg-pink-100 text-pink-800',
      'bg-indigo-100 text-indigo-800',
      'bg-orange-100 text-orange-800',
      'bg-teal-100 text-teal-800',
      'bg-cyan-100 text-cyan-800'
    ];
    return colorMap[statusIndex % colorMap.length];
  }

  // Loan type counts
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

  // Leads over time data
  const leadsPerDay = reportStats?.leadsPerDay || {};
  const chartData = [];

  if (Object.keys(leadsPerDay).length > 0) {
    const dates = Object.keys(leadsPerDay).map(d => moment(d)).filter(d => d.isValid());
    const minDate = moment.min(dates);
    const maxDate = moment.max(dates);

    for (let m = minDate.clone(); m.isSameOrBefore(maxDate, 'day'); m.add(1, "day")) {
      const dateStr = m.format("YYYY-MM-DD");
      chartData.push({
        date: dateStr,
        leads: leadsPerDay[dateStr] || 0,
      });
    }
  }

  const handleEmployeeChange = (e) => {
    setSelectedEmpId(e.target.value);
  };

  const renderPieChart = (data, title) => {
    const filteredData = data.filter(item => item.value > 0);
    return (
      <div className="bg-white rounded-lg shadow p-4 h-full">
        <h3 className="text-lg font-semibold mb-4">{title}</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <PieChart>
              <Pie
                data={filteredData}
                cx="50%"
                cy="50%"
                labelLine={false}
                outerRadius={80}
                fill="#8884d8"
                dataKey="value"
                label={({ name, value }) => `${name}: ${value}`}
              >
                {filteredData.map((entry, index) => (
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
              layout="vertical"
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
        <h1 className="text-2xl font-bold text-gray-800 mb-6">Leads Report</h1>
        
        {/* Filters Section */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          {/* Employee Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select User</label>
            <div className="relative">
              <select
                value={selectedEmpId}
                onChange={handleEmployeeChange}
                className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">--Select Employee--</option>
                {allEmployees.map(user => (
                  <option key={user.emp_id} value={user.emp_id}>
                    {user.ename} ({user.emp_id})
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* Status Selector */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Select Status</label>
            <div className="relative">
              <select
                value={selectedStatus}
                onChange={(e) => setSelectedStatus(e.target.value)}
                className="block appearance-none w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 pr-8 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                {statusList.map((status, index) => (
                  <option key={index} value={status}>
                    {status}
                  </option>
                ))}
              </select>
              <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-700">
                <ChevronDown className="h-4 w-4" />
              </div>
            </div>
          </div>

          {/* From Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">From Date</label>
            <div className="relative">
              <input
                type="date"
                value={dateRange.startDate}
                onChange={(e) => setDateRange({ ...dateRange, startDate: e.target.value })}
                className="block w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>

          {/* To Date */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">To Date</label>
            <div className="relative">
              <input
                type="date"
                value={dateRange.endDate}
                onChange={(e) => setDateRange({ ...dateRange, endDate: e.target.value })}
                className="block w-full bg-white border border-gray-300 text-gray-700 py-2 px-4 rounded leading-tight focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <div className="absolute inset-y-0 right-0 flex items-center pr-3 pointer-events-none">
                <Calendar className="h-4 w-4 text-gray-400" />
              </div>
            </div>
          </div>
        </div>

        {/* Summary Cards */}
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-8">
          {/* Total Leads*/}
          <div className="bg-blue-50 rounded-lg p-4 border border-blue-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-blue-600">Total Leads</p>
                <p className="text-2xl font-bold text-blue-800">{totalLeadsCount}</p>
              </div>
              <div className="bg-blue-100 p-2 rounded-full">
                <User className="w-5 h-5 text-blue-600" />
              </div>
            </div>
          </div>

          {/* Dynamic status cards - show top 3 statuses by count */}
          {leadStatusData.slice(0, 3).map((status, index) => {
            const bgColorClasses = [
              'bg-green-50 border-green-200 text-green-600 bg-green-100 text-green-800',
              'bg-purple-50 border-purple-200 text-purple-600 bg-purple-100 text-purple-800',
              'bg-yellow-50 border-yellow-200 text-yellow-600 bg-yellow-100 text-yellow-800'
            ];
            const [bgClass, borderClass, textClass, iconBgClass, iconTextClass] = bgColorClasses[index].split(' ');
            return (
              <div key={status.name} className={`${bgClass} rounded-lg p-4 border ${borderClass}`}>
                <div className="flex items-center justify-between">
                  <div>
                    <p className={`text-sm font-medium ${textClass}`}>{status.name}</p>
                    <p className={`text-2xl font-bold ${iconTextClass}`}>
                      {status.value}
                    </p>
                  </div>
                  <div className={`${iconBgClass} p-2 rounded-full`}>
                    <User className={`w-5 h-5 ${textClass}`} />
                  </div>
                </div>
              </div>
            );
          })}
        </div>

        {/* Leads Over Time */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          <div className="bg-white rounded-lg shadow p-4">
            <h3 className="text-lg font-semibold mb-4">Leads Over Time</h3>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="date" tick={{ fontSize: 12 }} />
                  <YAxis />
                  <Tooltip
                    formatter={(value) => [`${value} leads`, 'Count']}
                    labelFormatter={(date) => `Date: ${date}`}
                  />
                  <Legend />
                  <Line
                    type="monotone"
                    dataKey="leads"
                    stroke="#3b82f6"
                    name="Leads"
                    strokeWidth={2}
                    dot={{ r: 4 }}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Leads by Status Bar Chart */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          {renderBarChart(leadStatusData, "Leads by Status")}
        </div>

        {/* Leads by Loan Type Pie Chart */}
        <div className="grid grid-cols-1 gap-6 mb-6">
          {renderPieChart(loanTypeData, "Leads by Loan Type")}
        </div>

        {/* Leads Table Section */}
        <div className="mb-6">
          {/* Search Box */}
          <div className="mb-4 relative">
            <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
              <Search className="h-5 w-5 text-gray-400" />
            </div>
            <input
              type="text"
              placeholder="Search leads by name, ID, phone, status or loan type..."
              className="block w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md leading-5 bg-white placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 sm:text-sm"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>

          {/* Leads Table */}
          <div className="overflow-x-auto bg-white rounded-lg shadow">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Lead ID
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Client Name
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Number
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Status
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Date
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Loan Type
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {currentLeads.length > 0 ? (
                  currentLeads.map((lead) => (
                    <tr key={lead.lead_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {lead.lead_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {lead.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.number}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${getStatusBadgeColor(lead.status)}`}>
                          {lead.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {moment(lead.createdAt).format("DD MMM YYYY")}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {lead.loan_type}
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan="6" className="px-6 py-4 text-center text-sm text-gray-500">
                      {searchTerm ? "No matching leads found" : "No leads available"}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Pagination */}
          {totalPages > 1 && (
            <div className="flex items-center justify-between mt-4">
              <div>
                <p className="text-sm text-gray-700">
                  Page <span className="font-medium">{currentPage}</span> of <span className="font-medium">{totalPages}</span>
                </p>
              </div>
              <div className="flex space-x-2">
                <button
                  onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
                  disabled={currentPage === 1}
                  className={`px-4 py-2 border rounded-md ${currentPage === 1 ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Previous
                </button>
                <button
                  onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
                  disabled={currentPage === totalPages}
                  className={`px-4 py-2 border rounded-md ${currentPage === totalPages ? 'bg-gray-100 text-gray-400 cursor-not-allowed' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
                >
                  Next
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default LeadsReport;