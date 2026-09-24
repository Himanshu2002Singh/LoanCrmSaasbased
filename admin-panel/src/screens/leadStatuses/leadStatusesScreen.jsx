import React, { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "../../config";
import { PlusIcon, TrashIcon } from "@heroicons/react/24/outline";

const defaultForm = {
  name: "",
  team: "calling",
  sort_order: 100,
  is_initial: false,
  is_file_login: false,
};

function LeadStatusesScreen() {
  const [statuses, setStatuses] = useState([]);
  const [formData, setFormData] = useState(defaultForm);
  const [isSaving, setIsSaving] = useState(false);

  const fetchStatuses = async () => {
    const response = await axios.get(`${API_URL}/lead-statuses`, {
      params: { includeInactive: true },
    });
    setStatuses(response.data.statuses || []);
  };

  useEffect(() => {
    fetchStatuses();
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreate = async (e) => {
    e.preventDefault();
    setIsSaving(true);
    try {
      await axios.post(`${API_URL}/lead-statuses`, formData);
      setFormData(defaultForm);
      fetchStatuses();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to create status");
    } finally {
      setIsSaving(false);
    }
  };

  const handleDelete = async (status) => {
    if (!window.confirm(`Delete "${status.name}" status?`)) return;

    try {
      await axios.delete(`${API_URL}/lead-statuses/${status.status_id}`);
      fetchStatuses();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to delete status");
    }
  };

  const handleToggleActive = async (status) => {
    try {
      await axios.put(`${API_URL}/lead-statuses/${status.status_id}`, {
        is_active: !status.is_active,
      });
      fetchStatuses();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to update status");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-gray-800">Lead Statuses</h2>
      </div>

      <form onSubmit={handleCreate} className="bg-white border border-gray-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <input
            name="name"
            value={formData.name}
            onChange={handleChange}
            placeholder="Status name"
            className="border rounded px-3 py-2 text-sm"
            required
          />
          <select
            name="team"
            value={formData.team}
            onChange={handleChange}
            className="border rounded px-3 py-2 text-sm"
          >
            <option value="calling">Sales Team</option>
            <option value="operations">Operations Team</option>
            <option value="both">Both Teams</option>
          </select>
          <input
            name="sort_order"
            type="number"
            value={formData.sort_order}
            onChange={handleChange}
            className="border rounded px-3 py-2 text-sm"
            placeholder="Order"
          />
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              name="is_initial"
              type="checkbox"
              checked={formData.is_initial}
              onChange={handleChange}
            />
            Initial
          </label>
          <label className="flex items-center gap-2 text-sm text-gray-700">
            <input
              name="is_file_login"
              type="checkbox"
              checked={formData.is_file_login}
              onChange={handleChange}
            />
            File Login
          </label>
        </div>
        <button
          type="submit"
          disabled={isSaving}
          className="mt-4 inline-flex items-center gap-2 bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700 disabled:bg-gray-300"
        >
          <PlusIcon className="h-5 w-5" />
          Add Status
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-gray-100">
            <tr>
              <th className="p-3 text-left text-xs font-semibold text-gray-700">Status</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-700">Team</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-700">Flags</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-700">Order</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-700">Active</th>
              <th className="p-3 text-left text-xs font-semibold text-gray-700">Actions</th>
            </tr>
          </thead>
          <tbody>
            {statuses.map((status) => (
              <tr key={status.status_id} className="border-t">
                <td className="p-3 text-sm text-gray-800">{status.name}</td>
                <td className="p-3 text-sm text-gray-800 capitalize">{status.team === 'calling' ? 'Sales Team' : status.team}</td>
                <td className="p-3 text-sm text-gray-600">
                  {status.is_initial && <span className="mr-2">Initial</span>}
                  {status.is_file_login && <span className="mr-2">File Login</span>}
                  {status.is_protected && <span>System</span>}
                </td>
                <td className="p-3 text-sm text-gray-800">{status.sort_order}</td>
                <td className="p-3">
                  <button
                    onClick={() => handleToggleActive(status)}
                    className={`px-3 py-1 rounded text-xs ${
                      status.is_active ? "bg-green-100 text-green-700" : "bg-gray-200 text-gray-700"
                    }`}
                  >
                    {status.is_active ? "Active" : "Inactive"}
                  </button>
                </td>
                <td className="p-3">
                  <button
                    onClick={() => handleDelete(status)}
                    disabled={status.is_protected || status.is_initial || status.is_file_login}
                    className="text-red-600 disabled:text-gray-300"
                    title="Delete"
                  >
                    <TrashIcon className="h-5 w-5" />
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export default LeadStatusesScreen;
