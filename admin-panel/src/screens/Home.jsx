import React, { useState, useEffect } from 'react';
import { Calendar, ChevronDown, ChevronUp, BarChart2, PieChart as PieChartIcon, Users, Phone, FileText, CheckCircle, XCircle } from 'lucide-react';
import axios from "axios";
import API_URL from "../config";
import { useStatuses } from '../contexts/StatusContext';
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
} from "recharts";
import LeadsPopup from '../components/leadsPopup';
import { useNavigate } from "react-router-dom";

const Home = () => {
  const { statuses } = useStatuses();
  const [showPopup, setShowPopup] = useState(false);
  const [modalTitle, setModalTitle] = useState('');
  const [stats, setStats] = useState({
    counts: {
      totalCalls: 0,
      totalLeads: 0,
      todayFollowups: 0,
      tomorrowFollowups: 0,
      pendingFollowups: 0
    },
    leadStatusCounts: {},
    loanTypeCounts: {},
    employeeStats: []
  });

  const employeeStats = stats.employeeStats || [];
  const navigate = useNavigate();
  
  const getTodayRange = () => {
    const now = new Date();
    const firstDay = new Date(now);
    firstDay.setDate(firstDay.getDate() - 30);
    const lastDay = new Date(now.getFullYear(), now.getMonth(), now.getDate()+1);
    const format = (date) => {
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      return `${year}-${month}-${day}`;
    };
    return {
      from: format(firstDay),
      to: format(lastDay),
    };
  };

  const { from, to } = getTodayRange();
  const [fromDate, setFromDate] = useState(from);
  const [toDate, setToDate] = useState(to);

  useEffect(() => {
    fetchData(fromDate, toDate);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fromDate, toDate]);

  const fetchData = async (startDate, endDate) => {
    try {
      const response = await axios.get(`${API_URL}/dashboardStats`, {
        params: { startDate, endDate },
      });
      if (response.data?.success) {
        setStats(response.data);
      }
    } catch (error) {
      console.error("Error fetching dashboard stats", error);
    }
  };

  const handleMetricClick = (title) => {
    setModalTitle(title);
    setShowPopup(true);
  };

  const metricsData1 = [
    { title: 'Total Calls', value: stats.counts.totalCalls, icon: <Phone className="w-5 h-5" />},
    { title: 'Total Leads', value: stats.counts.totalLeads, icon: <Users className="w-5 h-5" />},
    { title: 'Today Followups', value: stats.counts.todayFollowups, icon: <Calendar className="w-5 h-5" />},
    { title: 'Tomorrow Followups', value: stats.counts.tomorrowFollowups, icon: <Calendar className="w-5 h-5" />},
  ];

  const matricsData2 = [
    ...statuses.map((status, idx) => {
      const value = stats.leadStatusCounts[status.name] || 0;
      const icons = [
        <Users className="w-5 h-5" />,
        <CheckCircle className="w-5 h-5" />,
        <FileText className="w-5 h-5" />,
        <XCircle className="w-5 h-5" />,
        <Calendar className="w-5 h-5" />
      ];
      return {
        title: status.name,
        value: value,
        icon: icons[idx % icons.length]
      };
    }),
    { title: 'Pending Followups', value: stats.counts.pendingFollowups, icon: <Calendar className="w-5 h-5" /> }
  ];

  const leadsData = statuses.map((status, idx) => {
    const value = stats.leadStatusCounts[status.name] || 0;

    return {
      name: status.name,
      value: value,
      color: status.color || [
        "#6366f1",
        "#3b82f6",
        "#60a5fa",
        "#a5b4fc",
        "#f87171",
        "#10b981",
        "#f59e0b",
        "#6366f1",
        "#ec4899",
        "#22d3ee",
      ][idx % 10],
    };
  });

  const pieData = [
    { name: 'Home Loans', value: stats.loanTypeCounts['Home Loan'] || 0, color: '#3b82f6' },
    { name: 'User Car Loans', value: stats.loanTypeCounts['User Car Loan'] || 0, color: '#f97316' },
    { name: 'Business Loans', value: stats.loanTypeCounts['Business Loan'] || 0, color: '#f59e0b' },
    { name: 'Personal Loans', value: stats.loanTypeCounts['Personal Loan'] || 0, color: '#10b981' },
    { name: 'DOD Loans', value: stats.loanTypeCounts['DOD'] || 0, color: '#f43f5e' },
    { name: 'Mortgage Loans', value: stats.loanTypeCounts['Mortgage Loan'] || 0, color: '#8b5cf6' },
    { name: 'CC/OD', value: stats.loanTypeCounts['CC/OD'] || 0, color: '#4ade80' },
    { name: 'CGTMSME', value: stats.loanTypeCounts['CGTMSME'] || 0, color: '#a78bfa' },
    { name: 'Mutual Fund', value: stats.loanTypeCounts['Mutual Fund'] || 0, color: '#8b5cf6' },
    { name: 'Insurance', value: stats.loanTypeCounts['Insurance'] || 0, color: '#ec4899' },
    { name: 'Other', value: stats.loanTypeCounts['Other'] || 0, color: '#f43f5e' }
  ];

  const MetricCard = ({ title, value, icon}) => (
    <div 
      onClick={() => handleMetricClick(title)}
      className="bg-gradient-to-br from-white to-gray-50 rounded-xl shadow-sm border border-gray-100 p-6 hover:shadow-md transition-all duration-300 group cursor-pointer"
    >
      <div className="flex justify-between items-start">
        <div>
          <h3 className="text-gray-500 text-sm font-medium mb-2 flex items-center gap-2">
            {icon} {title}
          </h3>
          <p className="text-3xl font-bold text-gray-900">{value}</p>
        </div>
      </div>
    </div>
  );

  const CustomPieChart = ({ data }) => {
    return (
      <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
        <h2 className="text-lg font-semibold text-gray-700 mb-4">
          Leads by Loan Type
        </h2>

        <div className="flex flex-col md:flex-row justify-center items-center gap-8">
          {/* Pie Chart */}
          <div className="w-full md:w-1/2 h-[300px]">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie
                  data={data}
                  dataKey="value"
                  nameKey="name"
                  cx="50%"
                  cy="50%"
                  outerRadius={90}
                  label
                >
                  {data.map((entry, index) => (
                    <Cell key={`cell-${index}`} fill={entry.color} />
                  ))}
                </Pie>
                <Tooltip
                  contentStyle={{ fontSize: "13px" }}
                  labelStyle={{ fontWeight: "bold" }}
                />
              </PieChart>
            </ResponsiveContainer>
          </div>

          {/* Legend on the right */}
          <div className="flex flex-col space-y-2">
            {data.map((entry, index) => (
              <div key={index} className="flex items-center gap-2">
                <span
                  className="w-4 h-4 rounded-full inline-block"
                  style={{ backgroundColor: entry.color }}
                ></span>
                <span className="text-sm text-gray-700 font-medium">
                  {entry.name}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  };

  const CustomBarChart = ({ data, title = "Bar Chart", height = 380 }) => {
    return (
      <div
        className="w-full bg-white p-4 rounded-xl shadow-md"
        style={{ height: `${height}px` }}
      >
        <h2 className="text-lg font-semibold text-gray-700 mb-4">{title}</h2>
        <ResponsiveContainer width="100%" height="100%">
          <BarChart
            data={data}
            barSize={28}
            barGap={2}
            barCategoryGap="20%"
            margin={{ top: 20, right: 30, left: 20, bottom: 80 }}
          >
            <XAxis
              dataKey="name"
              tick={{ fontSize: 11 }}
              angle={-45}
              textAnchor="end"
              interval={0}
            />
            <YAxis />
            <Tooltip
              contentStyle={{ fontSize: "13px" }}
              labelStyle={{ fontWeight: "bold" }}
            />
            <Bar dataKey="value" radius={[6, 6, 0, 0]}>
              {data.map((entry, index) => (
                <Cell key={`cell-${index}`} fill={entry.color} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>
    );
  };

  return (
    <div className="flex flex-col items-center bg-gradient-to-b from-gray-50 to-gray-100 min-h-screen p-6 md:p-8 space-y-8">
      <div className="w-full max-w-7xl">
        <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-8 gap-4">
          <h1 className="text-3xl md:text-4xl font-bold text-gray-800">
            Dashboard
          </h1>

          <div className="flex items-end gap-4 bg-white p-3 rounded-md shadow-sm border">
            {/* From Date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-600 mb-1">From Date</label>
              <input
                type="date"
                value={fromDate}
                max={new Date().toISOString().split("T")[0]}
                onChange={(e) => setFromDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>

            {/* To Date */}
            <div className="flex flex-col">
              <label className="text-sm font-medium text-gray-600 mb-1">To Date</label>
              <input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                className="border rounded px-2 py-1 text-sm"
              />
            </div>

            {/* Go Button */}
            <div className="flex items-end">
              <button
                onClick={() => fetchData(fromDate, toDate)}
                className="bg-blue-600 text-white px-4 py-2 rounded-md hover:bg-blue-700 transition font-medium text-sm"
              >
                Go
              </button>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {metricsData1.map((metric, index) => (
            <MetricCard 
              key={index}
              title={metric.title} 
              value={metric.value} 
              icon={metric.icon}
            />
          ))}
        </div>
        
        <LeadsPopup
          isOpen={showPopup}
          onClose={() => setShowPopup(false)}
          title={modalTitle}
          startDate={fromDate}
          endDate={toDate}
        />

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 mb-8">
          <h2 className="text-2xl font-bold mb-6 text-gray-800 flex items-center gap-2">
            <Users className="w-6 h-6 text-blue-500" /> Lead Status Overview
          </h2>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
            {matricsData2.map((metric, index) => (
              <MetricCard 
                key={index}
                title={metric.title} 
                value={metric.value} 
                icon={metric.icon}
              />
            ))}
          </div>

          <CustomBarChart data={leadsData} title="Leads by Status" />
        </div>

        <div className="grid grid-cols-1 gap-8 mb-8">
          <CustomPieChart data={pieData} />
          <CustomBarChart data={pieData} title="Leads by Loan Type" height={400} />
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200 bg-gradient-to-r from-blue-50 to-gray-50">
            <h3 className="text-xl font-semibold text-gray-800 flex items-center gap-2">
              <Users className="w-5 h-5 text-blue-500" /> Employee Performance
            </h3>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">#</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Employee</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Calls</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Total Leads</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Interested Leads</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {employeeStats.map((emp, idx) => (
                  <tr onClick={() => navigate(`/userdetail/${emp.id}`)} key={idx} className="hover:bg-gray-50 transition-colors duration-150 cursor-pointer">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{emp.id}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <div className="flex items-center">
                        <div className="flex-shrink-0 h-10 w-10 flex items-center justify-center rounded-full bg-blue-100 text-blue-600 font-medium">
                          {emp.avatar}
                        </div>
                        <div className="ml-4">
                          <div className="text-sm font-medium text-gray-900">{emp.name}</div>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{emp.totalCalls}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{emp.totalLeads}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-700">{emp.interestedLeads}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="bg-gray-50 px-6 py-3 flex items-center justify-between border-t border-gray-200">
            <div className="flex space-x-2">
              {/* Pagination buttons can be added here if needed */}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Home;