import React, { useState, useEffect } from "react";
import { useParams, useNavigate } from "react-router-dom";
import axios from "axios";
import { toast } from "react-toastify";
import API_URL from "../../../config";
import { useStatuses } from "../../../contexts/StatusContext";

const LeadEditScreen = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const { getStatusNames } = useStatuses();

  const [lead, setLead] = useState({
    name: "",
    email: "",
    number: "",
    person_id: "",
    owner: "",
    status: "",
    source: "",
    commission_percent: "",
    priority: "",
    next_meeting: "",
    loan_type: "",
    est_budget: "",
    refrence: "",
    address: "",
    description: "",
    remark: "",
  });

  const [employees, setEmployees] = useState([]);
  const [sources, setSources] = useState([]);
  const [isLoading, setIsLoading] = useState(false);
  const [isFetching, setIsFetching] = useState(true);

  const userRole = localStorage.getItem("userRole") || "";
  const employeeRole = localStorage.getItem("employeeRole") || "";
  const isEmployee =
    userRole.toUpperCase() === "EMPLOYEE" ||
    ["calling", "employee"].includes(employeeRole?.toLowerCase());

  const userPermissions = (() => {
    try {
      return JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch {
      return {};
    }
  })();

  const isCompanyAdmin = userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN";
  const isAllowedRole =
    isCompanyAdmin ||
    ["MANAGER", "OPS", "EMPLOYEE"].includes(userRole.toUpperCase()) ||
    ["manager", "operations", "calling", "employee", "sales"].includes(employeeRole?.toLowerCase());
  const canEditLead = isAllowedRole && userPermissions.editLead !== false;
  const canAssignLead =
    isCompanyAdmin ||
    ["MANAGER", "OPS"].includes(userRole.toUpperCase()) ||
    ["manager", "operations", "sales"].includes(employeeRole?.toLowerCase()) ||
    Boolean(userPermissions.assignLead || userPermissions.manageLeads);
  const canViewCommission = !isEmployee && Boolean(userPermissions.viewPayouts || userPermissions.viewConnectors || userRole === "COMPANY_ADMIN" || userRole === "SUPERADMIN");

  useEffect(() => {
    if (!canEditLead) {
      toast.error("You do not have permission to edit leads");
      navigate("/leads", { replace: true });
      return;
    }
    fetchLeadDetails();
    fetchEmployees();
    fetchSources();
  }, [id, canEditLead]);

  const fetchLeadDetails = async () => {
    try {
      const response = await axios.get(`${API_URL}/leads/${id}`);
      const data = response.data?.data;
      if (data) {
        if (data.is_read_only) {
          toast.warning(`This lead is currently assigned to ${data.current_owner || data.owner || "another staff member"}. It is in read-only mode for you.`);
          navigate(`/lead/${id}`, { replace: true });
          return;
        }
        setLead({
          name: data.name || "",
          email: data.email || "",
          number: data.number || data.mobile || data.phone || data.customer?.mobile || "",
          person_id: data.person_id || "",
          owner: data.owner || "",
          status: data.status || "",
          source: data.source || "",
          commission_percent:
            data.commission_percent !== null && data.commission_percent !== undefined
              ? data.commission_percent
              : "",
          priority: data.priority || "",
          next_meeting: data.next_meeting ? String(data.next_meeting).split("T")[0] : "",
          loan_type: data.loan_type || "",
          est_budget: data.est_budget || "",
          monthly_income: data.monthly_income || data.income || "",
          refrence: data.refrence || "",
          address: data.address || "",
          description: data.description || "",
          remark: data.latest_remark || data.last_remark || data.remark || "",
        });
      }
    } catch (error) {
      console.error("Error fetching lead details: ", error);
      toast.error("Failed to fetch lead details.");
    } finally {
      setIsFetching(false);
    }
  };

  const fetchEmployees = async () => {
    try {
      const response = await axios.get(`${API_URL}/users`, { params: { limit: 200 } });
      setEmployees(response.data?.data || []);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchSources = async () => {
    try {
      const res = await axios.get(`${API_URL}/master-configs/LEAD_SOURCE`, {
        params: { includeInactive: false },
      });
      setSources(res.data?.data || []);
    } catch (err) {
      console.error("Error fetching sources:", err);
    }
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setLead((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleEmployeeChange = (e) => {
    const selectedEmp = employees.find((emp) => String(emp.id) === e.target.value);
    setLead((prev) => ({
      ...prev,
      person_id: selectedEmp?.id || "",
      owner: selectedEmp?.name || "",
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);

    try {
      const payload = {
        ...lead,
        mobile: lead.number,
        number: lead.number,
        phone: lead.number,
        commission_percent:
          lead.commission_percent !== "" && !isNaN(parseFloat(lead.commission_percent))
            ? parseFloat(lead.commission_percent)
            : null,
      };
      await axios.put(`${API_URL}/leads/${id}`, payload);
      toast.success("Lead updated successfully!");
      navigate("/leads");
    } catch (error) {
      console.error("Error updating lead:", error);
      toast.error("Failed to update lead.");
    } finally {
      setIsLoading(false);
    }
  };

  if (isFetching) {
    return <div className="p-6">Loading Lead details...</div>;
  }

  return (
    <div className="p-6 bg-white shadow rounded-lg max-w-4xl mx-auto mt-4">
      <div className="flex justify-between items-center mb-6">
        <h2 className="text-2xl font-bold text-gray-800">Edit Lead ({id})</h2>
        <button
          onClick={() => navigate("/leads")}
          className="bg-gray-500 text-white px-4 py-2 rounded hover:bg-gray-700"
        >
          Back
        </button>
      </div>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-gray-700">Name</label>
            <input
              type="text"
              name="name"
              value={lead.name}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Email</label>
            <input
              type="email"
              name="email"
              value={lead.email}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Phone</label>
            <input
              type="text"
              name="number"
              value={lead.number}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
              required
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Assigned To</label>
            <select
              value={lead.person_id}
              onChange={handleEmployeeChange}
              disabled={!canAssignLead}
              className={`mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 ${!canAssignLead ? "bg-gray-100 text-gray-500 cursor-not-allowed" : "bg-white"}`}
            >
              <option value="" disabled>Select Employee</option>
              {employees.map((emp) => (
                <option key={emp.id} value={emp.id}>
                  {emp.id} ─ {emp.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Status</label>
            <select
              name="status"
              value={lead.status}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="" disabled>Select Status</option>
              {getStatusNames().map((statusName, index) => (
                <option key={index} value={statusName}>
                  {statusName}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Source / Party</label>
            <select
              name="source"
              value={lead.source || "Self"}
              onChange={(e) => {
                const val = e.target.value;
                const matched = sources.find((s) => (s.label || s.value) === val || s.value === val);
                setLead((prev) => ({
                  ...prev,
                  source: val,
                  ...(canViewCommission && matched && matched.commissionPercent !== undefined && matched.commissionPercent !== null && !prev.commission_percent
                    ? { commission_percent: String(matched.commissionPercent) }
                    : {}),
                }));
              }}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2 bg-white"
            >
              <option value="Self">Self (Default)</option>
              {sources
                .filter((s) => String(s.value || "").toLowerCase() !== "self")
                .map((s) => (
                  <option key={s.id || s.value} value={s.label || s.value}>
                    {s.label || s.value} {canViewCommission && s.commissionPercent ? `(${s.commissionPercent}%)` : ""}
                  </option>
                ))}
              {lead.source &&
                lead.source.toLowerCase() !== "self" &&
                !sources.some((s) => (s.label || s.value) === lead.source) && (
                  <option value={lead.source}>{lead.source}</option>
                )}
            </select>
          </div>
          {canViewCommission && (
            <div>
              <label className="block text-sm font-medium text-gray-700">Commission (%)</label>
              <div className="relative mt-1">
                <input
                  type="number"
                  step="0.01"
                  min="0"
                  max="100"
                  name="commission_percent"
                  value={lead.commission_percent}
                  onChange={handleInputChange}
                  placeholder="e.g. 1.5"
                  className="block w-full border border-gray-300 rounded-md shadow-sm p-2 pr-8"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 font-semibold text-sm pointer-events-none">%</span>
              </div>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700">Priority</label>
            <select
              name="priority"
              value={lead.priority}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            >
              <option value="">Select Priority</option>
              <option value="High">High</option>
              <option value="Medium">Medium</option>
              <option value="Low">Low</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Next Meeting Date</label>
            <input
              type="date"
              name="next_meeting"
              value={lead.next_meeting}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Loan Type</label>
            <input
              type="text"
              name="loan_type"
              value={lead.loan_type}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Estimated Budget</label>
            <input
              type="text"
              name="est_budget"
              value={lead.est_budget}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Monthly Income (₹)</label>
            <input
              type="number"
              name="monthly_income"
              value={lead.monthly_income}
              onChange={handleInputChange}
              placeholder="e.g. 50000"
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Reference</label>
            <input
              type="text"
              name="refrence"
              value={lead.refrence}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700">Remark</label>
            <input
              type="text"
              name="remark"
              value={lead.remark}
              onChange={handleInputChange}
              className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            />
          </div>
        </div>

        <div>
          <label className="block text-sm font-medium text-gray-700">Address</label>
          <textarea
            name="address"
            value={lead.address}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            rows="2"
          ></textarea>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700">Description</label>
          <textarea
            name="description"
            value={lead.description}
            onChange={handleInputChange}
            className="mt-1 block w-full border border-gray-300 rounded-md shadow-sm p-2"
            rows="3"
          ></textarea>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="bg-blue-600 text-white px-6 py-2 rounded-md hover:bg-blue-800"
            disabled={isLoading}
          >
            {isLoading ? "Saving..." : "Save Changes"}
          </button>
        </div>
      </form>
    </div>
  );
};

export default LeadEditScreen;
