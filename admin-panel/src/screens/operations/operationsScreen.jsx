import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import API_URL from "../../config";

const OperationsScreen = () => {
  const navigate = useNavigate();
  const employeeId = localStorage.getItem("employeeId");
  const employeeRole = localStorage.getItem("employeeRole");
  const [leads, setLeads] = useState([]);
  const [statuses, setStatuses] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  const filteredLeads = useMemo(() => {
    const term = searchTerm.trim().toLowerCase();
    if (!term) return leads;

    return leads.filter((lead) =>
      [lead.name, lead.number, lead.owner, lead.status, lead.loan_type]
        .filter(Boolean)
        .some((value) => String(value).toLowerCase().includes(term))
    );
  }, [leads, searchTerm]);

  const fetchStatuses = async () => {
    const response = await axios.get(`${API_URL}/lead-statuses`, {
      params: { team: "operations" },
    });
    setStatuses(response.data.statuses || []);
  };

  const fetchOperationLeads = async () => {
    setIsLoading(true);
    try {
      const endpoint =
        employeeRole === "manager" ? `${API_URL}/leads` : `${API_URL}/leads/${employeeId}`;
      const response = await axios.get(endpoint, {
        params: {
          limit: 20,
          page: currentPage,
          fromDate: fromDate || undefined,
          toDate: toDate || undefined,
          team: "operations"
        }
      });
      
      const responseData = response.data?.data || response.data?.leads || (Array.isArray(response.data) ? response.data : []);
      
      setLeads(responseData);

      if (response.data?.pagination) {
        setTotalPages(response.data.pagination.totalPages || 1);
        setCurrentPage(response.data.pagination.currentPage || 1);
      }
    } catch (error) {
      console.error("Error fetching operation leads:", error);
      toast.error("Unable to load operation leads");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  useEffect(() => {
    fetchOperationLeads();
  }, [fromDate, toDate, currentPage]);

  const handleStatusChange = async (lead, statusId) => {
    const nextStatus = statuses.find((status) => String(status.status_id) === statusId);
    if (!nextStatus) return;

    try {
      await axios.put(`${API_URL}/leads/${lead.lead_id}`, {
        status_id: nextStatus.status_id,
        changed_by_emp_id: employeeId,
        changed_by_role: employeeRole,
      });
      toast.success("Lead status updated");
      fetchOperationLeads();
    } catch (error) {
      console.error("Error updating operation lead:", error);
      toast.error(error.response?.data?.message || "Unable to update lead");
    }
  };

  return (
    <div>
      <ToastContainer position="bottom-right" />

      <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div>
          <h2 className="text-xl font-semibold text-gray-800">Operations</h2>
          <p className="text-sm text-gray-500">File login and operations-stage leads</p>
        </div>
        <div className="flex flex-wrap items-center gap-2 w-full md:w-auto">
          <input
            type="date"
            value={fromDate}
            onChange={(e) => setFromDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
            title="From Date"
          />
          <span className="text-gray-500">to</span>
          <input
            type="date"
            value={toDate}
            onChange={(e) => setToDate(e.target.value)}
            className="px-3 py-2 border rounded-md text-sm"
            title="To Date"
          />
          <input
            type="text"
            placeholder="Search operation leads..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full md:w-[280px] px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
          />
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-lg overflow-x-auto">
        <table className="min-w-full">
          <thead className="bg-gray-100 whitespace-nowrap">
            <tr>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">Lead Id</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">Name</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">Phone</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">Owner</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">Loan Type</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">Status</th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">Actions</th>
            </tr>
          </thead>
          <tbody className="whitespace-nowrap">
            {filteredLeads.map((lead) => (
              <tr key={lead.lead_id} className="border-t hover:bg-gray-50">
                <td className="p-4 text-sm text-gray-800">{lead.lead_id}</td>
                <td className="p-4 text-sm text-gray-800">{lead.name || "--"}</td>
                <td className="p-4 text-sm text-gray-800">{lead.number || "--"}</td>
                <td className="p-4 text-sm text-gray-800">{lead.owner || "Unassigned"}</td>
                <td className="p-4 text-sm text-gray-800">{lead.loan_type || "--"}</td>
                <td className="p-4 text-sm text-gray-800">
                  <select
                    value={lead.status_id || ""}
                    onChange={(e) => handleStatusChange(lead, e.target.value)}
                    className="border px-3 py-2 rounded text-sm min-w-[170px]"
                  >
                    <option value="" disabled>Select Status</option>
                    {statuses.map((status) => (
                      <option key={status.status_id} value={status.status_id}>
                        {status.name}
                      </option>
                    ))}
                  </select>
                </td>
                <td className="p-4">
                  <button
                    onClick={() => navigate(`/lead-details/${lead.lead_id}`)}
                    className="text-blue-600 hover:text-blue-800 text-sm font-medium"
                  >
                    View
                  </button>
                </td>
              </tr>
            ))}
            {!isLoading && filteredLeads.length === 0 && (
              <tr>
                <td colSpan="7" className="p-6 text-center text-sm text-gray-500">
                  No operation leads found
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {isLoading && (
        <div className="flex justify-center mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}

      {/* Pagination Controls */}
      {!isLoading && totalPages > 1 && (
        <div className="flex items-center justify-between mt-6 bg-white p-4 border border-gray-200 rounded-lg">
          <button
            onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
            disabled={currentPage === 1 || isLoading}
            className="px-4 py-2 border rounded-md disabled:opacity-50 hover:bg-gray-50 font-medium text-sm"
          >
            Previous
          </button>
          <span className="text-gray-600 text-sm font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <button
            onClick={() => setCurrentPage((prev) => Math.min(prev + 1, totalPages))}
            disabled={currentPage === totalPages || isLoading}
            className="px-4 py-2 border rounded-md disabled:opacity-50 hover:bg-gray-50 font-medium text-sm"
          >
            Next
          </button>
        </div>
      )}
    </div>
  );
};

export default OperationsScreen;
