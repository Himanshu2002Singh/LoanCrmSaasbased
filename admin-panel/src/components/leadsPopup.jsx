import React, { useState, useEffect } from 'react';
import axios from 'axios';
import API_URL from '../config';

const LeadsPopup = ({ isOpen, onClose, title, startDate, endDate }) => {
  const [leads, setLeads] = useState([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [totalItems, setTotalItems] = useState(0);
  const [loading, setLoading] = useState(false);
  const limit = 10;

  // Reset page to 1 whenever popup is opened or title changes
  useEffect(() => {
    if (isOpen) {
      setPage(1);
      setLeads([]);
      setTotalPages(1);
      setTotalItems(0);
    }
  }, [isOpen, title]);

  useEffect(() => {
    if (!isOpen || !title) return;

    const fetchPopupData = async () => {
      setLoading(true);
      try {
        // The follow-up list is windowed rather than filtered by an explicit
        // date, so each tile maps onto the window that matches it.
        const FOLLOWUP_WINDOW = {
          'Today Followups': 'today',
          'Tomorrow Followups': 'upcoming',
          'Pending Followups': 'overdue',
        };

        let response;
        if (title === 'Total Calls') {
          response = await axios.get(`${API_URL}/calls`, {
            params: { fromDate: startDate, toDate: endDate, page, limit }
          });
        } else if (FOLLOWUP_WINDOW[title]) {
          response = await axios.get(`${API_URL}/followups`, {
            params: { window: FOLLOWUP_WINDOW[title], page, limit }
          });
        } else if (title === 'Total Leads') {
          response = await axios.get(`${API_URL}/leads`, {
            params: { fromDate: startDate, toDate: endDate, page, limit }
          });
        } else {
          // A specific status (e.g. "Fresh Lead", "Interested", etc.)
          response = await axios.get(`${API_URL}/leads`, {
            params: { fromDate: startDate, toDate: endDate, status: title, page, limit }
          });
        }

        setLeads(response.data.data || []);
        setTotalItems(response.data.pagination?.totalItems || response.data.pagination?.total || 0);
        setTotalPages(response.data.pagination?.totalPages || 1);
      } catch (error) {
        console.error("Error fetching popup data", error);
        setLeads([]);
      } finally {
        setLoading(false);
      }
    };

    fetchPopupData();
  }, [isOpen, title, startDate, endDate, page]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-40 flex justify-center items-center z-50" onClick={onClose}>
      <div className="bg-white rounded-xl shadow-lg p-6 w-[95%] max-w-4xl max-h-[90%] overflow-y-auto relative flex flex-col" onClick={(e) => e.stopPropagation()}>
        {/* Close (X) Button */}
        <button
          className="absolute top-4 right-6 text-2xl font-bold text-gray-500 hover:text-red-500"
          onClick={onClose}
        >
          ×
        </button>

        {/* Modal Title */}
        <h2 className="text-2xl font-semibold mb-6 text-center">{title}</h2>

        {/* Loading Spinner or Leads Table */}
        {loading ? (
          <div className="flex justify-center items-center py-12 my-auto">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
          </div>
        ) : leads.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-100">
                <tr>
                  {title === "Total Calls" ? (
                    <>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Call ID</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Number</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Remark</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">At</th>
                    </>
                  ) : (
                    <>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Lead ID</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Name</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Phone</th>
                      <th className="px-4 py-2 text-left text-sm font-semibold text-gray-700">Assigned To</th>
                    </>
                  )}
                </tr>
              </thead>

              <tbody className="bg-white divide-y divide-gray-100">
                {leads.map((lead, index) => (
                  <tr key={index} className="hover:bg-gray-50 transition">
                    {title === "Total Calls" ? (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-800">{lead.call_id}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{lead.customer_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{lead.customer_number}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{lead.remarks}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">
                          {new Date(lead.createdAt).toLocaleString('en-IN', {
                            dateStyle: 'medium',
                            timeStyle: 'short',
                          })}
                        </td>
                      </>
                    ) : (
                      <>
                        <td className="px-4 py-2 text-sm text-gray-800">{lead.lead_id}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{lead.name || lead.customer_name}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{lead.number || lead.customer_number}</td>
                        <td className="px-4 py-2 text-sm text-gray-800">{lead.owner || 'Unassigned'}</td>
                      </>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <p className="text-gray-600 text-center py-12">No data to display.</p>
        )}

        {/* Pagination Controls */}
        {!loading && totalPages > 1 && (
          <div className="flex justify-between items-center mt-6 pt-4 border-t border-gray-100">
            <button
              onClick={() => setPage(p => Math.max(p - 1, 1))}
              disabled={page === 1}
              className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Previous
            </button>
            <span className="text-sm text-gray-600 font-medium">
              Page {page} of {totalPages} ({totalItems} items)
            </span>
            <button
              onClick={() => setPage(p => Math.min(p + 1, totalPages))}
              disabled={page === totalPages}
              className="px-4 py-2 text-sm font-medium bg-gray-100 text-gray-700 rounded-md hover:bg-gray-200 disabled:opacity-50 disabled:cursor-not-allowed transition"
            >
              Next
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default LeadsPopup;
