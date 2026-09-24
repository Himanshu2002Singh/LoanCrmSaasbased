import React, { useState } from "react";
import API_URL from "../../config";

const AddLead = ({ handleCloseaddcallformModal, onCreated }) => {
  const [formData, setFormData] = useState({
    name: "",
    contact: "",
  });
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");

  const [excelFile, setExcelFile] = useState(null);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/submit-lead`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: JSON.stringify({
          name: formData.name,
          number: formData.contact,
        }),
      });

      if (!response.ok) throw new Error("Failed to add lead");

      await response.json();
      setFormData({ name: "", contact: "" });
      onCreated?.();
      handleCloseaddcallformModal();
    } catch (err) {
      setError(err.message || "Something went wrong");
    } finally {
      setIsLoading(false);
    }
  };

  const handleExcelUpload = async () => {
    if (!excelFile) {
      alert("Please select an Excel file");
      return;
    }

    const formDataToSend = new FormData();
    formDataToSend.append("file", excelFile);

    setIsLoading(true);
    try {
      const token = localStorage.getItem("token");
      const response = await fetch(`${API_URL}/addLeadsFromExcel`, {
        method: "POST",
        headers: {
          ...(token && { Authorization: `Bearer ${token}` }),
        },
        body: formDataToSend,
      });

      if (!response.ok) throw new Error("Upload failed");

      const result = await response.json();
      alert(result.message || "Leads uploaded successfully");
      setExcelFile(null);
      onCreated?.();
      handleCloseaddcallformModal();
    } catch (err) {
      alert(err.message || "Upload failed");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="max-w-md w-full">
      <div className="p-8 rounded-2xl bg-white shadow">
        <div className="flex justify-between items-center">
          <h2 className="text-gray-800 text-2xl font-bold">Add Leads</h2>
          <button onClick={handleCloseaddcallformModal}>
            ❌
          </button>
        </div>

        {error && (
          <div className="mt-4 p-3 bg-red-100 border border-red-400 text-red-700 rounded">
            {error}
          </div>
        )}

        {/* Manual Lead Add */}
        <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
          <div>
            <label className="text-sm block text-gray-800 mb-1">Contact Number</label>
            <input
              name="contact"
              type="text"
              required
              value={formData.contact}
              onChange={handleInputChange}
              placeholder="Enter contact number"
              className="w-full border px-4 py-2 rounded-md"
              disabled={isLoading}
            />
          </div>

          <div>
            <label className="text-sm block text-gray-800 mb-1">Name</label>
            <input
              name="name"
              type="text"
              required
              value={formData.name}
              onChange={handleInputChange}
              placeholder="Enter name"
              className="w-full border px-4 py-2 rounded-md"
              disabled={isLoading}
            />
          </div>

          <button
            type="submit"
            className={`w-full py-3 text-sm rounded-md text-white ${
              isLoading ? "bg-gray-400" : "bg-blue-600 hover:bg-blue-700"
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Adding..." : "Add Lead"}
          </button>
        </form>

        {/* Divider */}
        <div className="my-6 text-center text-sm text-gray-400 border-t pt-4">Or Upload Excel</div>

        {/* Excel Upload Section */}
        <div className="space-y-3">
          <input
            type="file"
            accept=".xlsx,.xls"
            onChange={(e) => setExcelFile(e.target.files[0])}
            className="w-full border px-3 py-2 rounded-md"
          />

          <button
            type="button"
            onClick={handleExcelUpload}
            className={`w-full py-3 text-sm rounded-md text-white ${
              isLoading ? "bg-gray-400" : "bg-green-600 hover:bg-green-700"
            }`}
            disabled={isLoading}
          >
            {isLoading ? "Uploading..." : "Upload Leads"}
          </button>
        </div>
      </div>
    </div>
  );
};

export default AddLead;
