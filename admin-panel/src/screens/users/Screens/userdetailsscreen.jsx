import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import axios from 'axios';
import API_URL from "../../../config";
import { ToastContainer, toast } from 'react-toastify';
import 'react-toastify/dist/ReactToastify.css';

const UserDetailScreen = () => {
  const { emp_id } = useParams();
  const [employee, setEmployee] = useState(null);
  const [leads, setLeads] = useState([]);
  const [calls, setCalls] = useState([]);
  const [tasks, setTasks] = useState([]);
  const [totalLeads, setTotalLeads] = useState(0);
  const [totalCalls, setTotalCalls] = useState(0);
  const [totalTasks, setTotalTasks] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const navigate = useNavigate();
  
  // Toggle states
  const [showLeads, setShowLeads] = useState(true);
  const [showCalls, setShowCalls] = useState(true);
  const [showTasks, setShowTasks] = useState(true);
  
  // Pagination states
  const [leadsPage, setLeadsPage] = useState(1);
  const [callsPage, setCallsPage] = useState(1);
  const [tasksPage, setTasksPage] = useState(1);
  const [leadsPerPage, setLeadsPerPage] = useState(10);
  const [callsPerPage, setCallsPerPage] = useState(10);
  const [tasksPerPage, setTasksPerPage] = useState(10);
  
  // Document states
  const [selectedFiles, setSelectedFiles] = useState(null);
  const [uploadingDocs, setUploadingDocs] = useState(false);

  const fetchEmployee = async () => {
    try {
      setLoading(true);
      const empResponse = await axios.get(`${API_URL}/employees/${emp_id}`);
      setEmployee(empResponse.data);
      setLoading(false);
    } catch (err) {
      setError(err.message);
      setLoading(false);
    }
  };

  useEffect(() => {
    if (emp_id) fetchEmployee();
  }, [emp_id]);

  // Fetch leads
  useEffect(() => {
    const fetchLeads = async () => {
      try {
        const response = await axios.get(`${API_URL}/leads/${emp_id}`, {
          params: { page: leadsPage, limit: leadsPerPage }
        });
        setLeads(response.data?.data || (Array.isArray(response.data) ? response.data : []));
        setTotalLeads(response.data?.pagination?.totalItems || (Array.isArray(response.data) ? response.data.length : 0));
      } catch (err) {
        console.error("Error fetching leads", err);
      }
    };
    if (emp_id) fetchLeads();
  }, [emp_id, leadsPage, leadsPerPage]);

  // Fetch calls
  useEffect(() => {
    const fetchCalls = async () => {
      try {
        const response = await axios.get(`${API_URL}/calls/${emp_id}`, {
          params: { page: callsPage, limit: callsPerPage }
        });
        setCalls(response.data?.calls || []);
        setTotalCalls(response.data?.pagination?.totalItems || (Array.isArray(response.data?.calls) ? response.data.calls.length : 0));
      } catch (err) {
        console.error("Error fetching calls", err);
      }
    };
    if (emp_id) fetchCalls();
  }, [emp_id, callsPage, callsPerPage]);

  // Fetch tasks
  useEffect(() => {
    const fetchTasks = async () => {
      try {
        const response = await axios.get(`${API_URL}/task/${emp_id}`, {
          params: { page: tasksPage, limit: tasksPerPage }
        });
        setTasks(response.data?.tasks || []);
        setTotalTasks(response.data?.pagination?.totalItems || (Array.isArray(response.data?.tasks) ? response.data.tasks.length : 0));
      } catch (err) {
        console.error("Error fetching tasks", err);
      }
    };
    if (emp_id) fetchTasks();
  }, [emp_id, tasksPage, tasksPerPage]);

  const ItemsPerPageDropdown = ({ value, options = [10, 20, 50, 100], onChange }) => (
    <div className="flex items-center space-x-2">
      <span className="text-sm text-gray-500">Show</span>
      <select 
        value={value} 
        onChange={(e) => onChange(Number(e.target.value))}
        className="border border-gray-300 rounded px-2 py-1 text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
      >
        {options.map((count) => (
          <option key={count} value={count}>{count}</option>
        ))}
      </select>
      <span className="text-sm text-gray-500">entries</span>
    </div>
  );

  const handleFileChange = (e) => {
    setSelectedFiles(e.target.files);
  };

  const handleUploadDocuments = async () => {
    if (!selectedFiles || selectedFiles.length === 0) {
      toast.error("Please select at least one file to upload");
      return;
    }

    const formData = new FormData();
    for (let i = 0; i < selectedFiles.length; i++) {
      formData.append("documents", selectedFiles[i]);
    }

    setUploadingDocs(true);
    try {
      await axios.post(`${API_URL}/employees/${emp_id}/documents`, formData, {
        headers: { "Content-Type": "multipart/form-data" }
      });
      toast.success("Documents uploaded successfully");
      setSelectedFiles(null);
      document.getElementById('fileUploadInput').value = "";
      fetchEmployee();
    } catch (err) {
      console.error(err);
      toast.error("Failed to upload documents");
    } finally {
      setUploadingDocs(false);
    }
  };

  const handleDeleteDocument = async (docName) => {
    if (!window.confirm(`Are you sure you want to delete ${docName}?`)) return;

    try {
      await axios.delete(`${API_URL}/employees/${emp_id}/documents/${docName}`);
      toast.success("Document deleted successfully");
      fetchEmployee();
    } catch (err) {
      console.error(err);
      toast.error("Failed to delete document");
    }
  };

  const paginatedLeads = leads;
  const paginatedCalls = calls;
  const paginatedTasks = tasks;

  const totalLeadsPages = Math.ceil(totalLeads / leadsPerPage);
  const totalCallsPages = Math.ceil(totalCalls / callsPerPage);
  const totalTasksPages = Math.ceil(totalTasks / tasksPerPage);

  if (loading) return <div className="text-center py-8">Loading...</div>;
  if (error) return <div className="text-center py-8 text-red-500">Error: {error}</div>;
  if (!employee) return <div className="text-center py-8">Employee not found</div>;

  return (
    <div className="container mx-auto px-4 py-8">
      {/* Profile Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex-1">
          <h1 className="text-3xl font-bold text-gray-800">{employee.ename}</h1>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
            <div>
              <p className="text-gray-600">Employee ID</p>
              <p className="font-medium">{employee.emp_id}</p>
            </div>
            <div>
              <p className="text-gray-600">Username</p>
              <p className="font-medium">{employee.username || "N/A"}</p>
            </div>
            <div>
              <p className="text-gray-600">Phone Number</p>
              <p className="font-medium">{employee.phone}</p>
            </div>
            <div>
              <p className="text-gray-600">Email</p>
              <p className="font-medium">{employee.email}</p>
            </div>
            <div>
              <p className="text-gray-600">Password</p>
              <p className="font-medium">{employee.password}</p>
            </div>
            <div>
              <p className="text-gray-600">Role</p>
              <p className="font-medium capitalize">{employee.role === 'calling' || !employee.role ? "Sales Manager" : employee.role}</p>
            </div>
            <div>
              <p className="text-gray-600">Status</p>
              <p className="font-medium capitalize">{employee.status || "active"}</p>
            </div>
          </div>
        </div>
      </div>

      {/* Documents Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <h2 className="text-xl font-semibold text-gray-800 mb-4">Employee Documents</h2>
        
        <div className="mb-6">
          <input 
            type="file" 
            id="fileUploadInput"
            multiple 
            onChange={handleFileChange}
            className="mb-2 block w-full text-sm text-gray-500
              file:mr-4 file:py-2 file:px-4
              file:rounded-md file:border-0
              file:text-sm file:font-semibold
              file:bg-blue-50 file:text-blue-700
              hover:file:bg-blue-100"
          />
          <button 
            onClick={handleUploadDocuments}
            disabled={uploadingDocs}
            className={`px-4 py-2 text-white rounded ${uploadingDocs ? 'bg-gray-400' : 'bg-blue-500 hover:bg-blue-600'}`}
          >
            {uploadingDocs ? "Uploading..." : "Upload Documents"}
          </button>
        </div>

        {employee?.documents && employee.documents.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {employee.documents.map((doc, index) => (
              <div key={index} className="flex justify-between items-center p-3 border rounded shadow-sm bg-gray-50">
                <a href={`${API_URL.replace('/api', '')}${doc.url}`} target="_blank" rel="noreferrer" className="text-blue-600 hover:underline flex items-center">
                  <svg className="w-5 h-5 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15.172 7l-6.586 6.586a2 2 0 102.828 2.828l6.414-6.586a4 4 0 00-5.656-5.656l-6.415 6.585a6 6 0 108.486 8.486L20.5 13"></path></svg>
                  {doc.name}
                </a>
                <button onClick={() => handleDeleteDocument(doc.name)} className="text-red-500 hover:text-red-700">
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path></svg>
                </button>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-gray-500">No documents uploaded yet.</p>
        )}
      </div>

      {/* Leads Section */}
      <div className="bg-white rounded-lg shadow-md p-6 mb-8">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Associated Leads</h2>
          <ItemsPerPageDropdown 
            value={leadsPerPage} 
            onChange={(value) => {
              setLeadsPerPage(value);
              setLeadsPage(1); // Reset to first page when changing items per page
            }} 
          />
          <button 
            onClick={() => setShowLeads(!showLeads)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showLeads ? 'Hide' : 'Show'} Leads ({totalLeads})
          </button>
        </div>
        
        {showLeads && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Email</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Phone</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedLeads.map((lead) => (
                    <tr key={lead.lead_id} className="hover:bg-gray-50" onClick = {()=> navigate(`/lead-details/${lead.lead_id}`)}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{lead.lead_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{lead.name}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.email}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{lead.number}</td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${lead.status === 'Converted' ? 'bg-green-100 text-green-800' : 
                            lead.status === 'In Progress' ? 'bg-blue-100 text-blue-800' : 
                            'bg-yellow-100 text-yellow-800'}`}>
                          {lead.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {leads.length === 0 && (
                <p className="text-center py-4 text-gray-500">No leads found for this employee</p>
              )}
            </div>
            
            {/* Leads Pagination */}
            {totalLeads > leadsPerPage && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setLeadsPage(prev => Math.max(prev - 1, 1))}
                  disabled={leadsPage === 1}
                  className={`px-3 py-1 rounded ${leadsPage === 1 ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  Previous
                </button>
                <span>Page {leadsPage} of {totalLeadsPages}</span>
                <button
                  onClick={() => setLeadsPage(prev => Math.min(prev + 1, totalLeadsPages))}
                  disabled={leadsPage === totalLeadsPages}
                  className={`px-3 py-1 rounded ${leadsPage === totalLeadsPages ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* Calls Section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Call Logs</h2>
          <ItemsPerPageDropdown 
            value={callsPerPage} 
            onChange={(value) => {
              setCallsPerPage(value);
              setCallsPage(1);
            }} 
          />
          <button 
            onClick={() => setShowCalls(!showCalls)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showCalls ? 'Hide' : 'Show'} Calls ({totalCalls})
          </button>
        </div>
        
        {showCalls && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Call ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Number</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Remark</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">At</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedCalls.map((call) => (
                    <tr key={call.call_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{call.call_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {call.name}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{call.number} </td>
                      <td className="px-6 py-4 whitespace-normal break-words max-w-md text-sm text-gray-500">
                        {call.remark}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {new Date(call.createdAt).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {calls.length === 0 && (
                <p className="text-center py-4 text-gray-500">No call logs found for this employee</p>
              )}
            </div>
            
            {/* Calls Pagination */}
            {totalCalls > callsPerPage && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setCallsPage(prev => Math.max(prev - 1, 1))}
                  disabled={callsPage === 1}
                  className={`px-3 py-1 rounded ${callsPage === 1 ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  Previous
                </button>
                <span>Page {callsPage} of {totalCallsPages}</span>
                <button
                  onClick={() => setCallsPage(prev => Math.min(prev + 1, totalCallsPages))}
                  disabled={callsPage === totalCallsPages}
                  className={`px-3 py-1 rounded ${callsPage === totalCallsPages ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      {/* task section */}
      <div className="bg-white rounded-lg shadow-md p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-gray-800">Tasks</h2>
          <ItemsPerPageDropdown 
            value={tasksPerPage} 
            onChange={(value) => {
              setTasksPerPage(value);
              setTasksPage(1);
            }} 
          />
          <button 
            onClick={() => setShowTasks(!showTasks)}
            className="px-3 py-1 bg-blue-500 text-white rounded hover:bg-blue-600"
          >
            {showTasks ? 'Hide' : 'Show'} Tasks ({totalTasks})
          </button>
        </div>
        
        {showTasks && (
          <>
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Task ID</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Title</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Lead Name</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Start Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">End Date</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Priority</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Status</th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Description</th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {paginatedTasks.map((task) => (
                    <tr key={task.task_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{task.task_id}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.title}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">{task.choose_lead} </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.end_date != null ? new Date(task.start_date).toLocaleString():""}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.end_date != null ? new Date(task.end_date).toLocaleString():""}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {task.priority}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm">
                        <span
                          className={`font-medium ${
                            task.status === "Completed"
                              ? "text-green-600"
                              : task.status === "On Going"
                              ? "text-blue-600"
                              : "text-gray-500"
                          }`}
                        >
                          {task.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        <span
                          title={task.description} // Tooltip on hover
                          className="cursor-pointer hover:text-blue-600"
                          // onClick={() => openDescriptionModal(task.description)}
                        >
                          {task.description && task.description.length > 30
                            ? `${task.description.slice(0, 30)}...`
                            : task.description || ""}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {tasks.length === 0 && (
                <p className="text-center py-4 text-gray-500">No tasks found for this employee</p>
              )}
            </div>
            
            {/* Tasks Pagination */}
            {totalTasks > tasksPerPage && (
              <div className="flex justify-between items-center mt-4">
                <button
                  onClick={() => setTasksPage(prev => Math.max(prev - 1, 1))}
                  disabled={tasksPage === 1}
                  className={`px-3 py-1 rounded ${tasksPage === 1 ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  Previous
                </button>
                <span>Page {tasksPage} of {totalTasksPages}</span>
                <button
                  onClick={() => setTasksPage(prev => Math.min(prev + 1, totalTasksPages))}
                  disabled={tasksPage === totalTasksPages}
                  className={`px-3 py-1 rounded ${tasksPage === totalTasksPages ? 'bg-gray-200 cursor-not-allowed' : 'bg-blue-500 text-white hover:bg-blue-600'}`}
                >
                  Next
                </button>
              </div>
            )}
          </>
        )}
      </div>

      <ToastContainer position="top-right" autoClose={3000} />
    </div>
  );
};

export default UserDetailScreen;
