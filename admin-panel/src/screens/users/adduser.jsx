import React, { useState } from "react";
import axios from "axios";
import API_URL from "../../config";

const AddUser = ({ handleCloseaddcallformModal, onCreated }) => {
  const [formData, setFormData] = useState({
    emp_id: "",
    ename: "",
    email: "",
    phone: "",
    username: "",
    password: "",
    role: "calling",
    status: "active",
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: value,
      ...(name === "emp_id" && !prev.username ? { username: value } : {}),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      await axios.post(`${API_URL}/add-employee`, formData);
      onCreated?.();
      handleCloseaddcallformModal();
    } catch (error) {
      alert(error.response?.data?.message || "Unable to add employee");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="max-w-md w-full">
      <div className="p-8 rounded-2xl bg-white shadow max-h-[90vh] overflow-y-auto">
        {" "}
        <div className="flex justify-between">
          <h2 className="text-gray-800 text-center text-2xl font-bold">
            Add Employee
          </h2>
          <svg
            onClick={handleCloseaddcallformModal}
            xmlns="http://www.w3.org/2000/svg"
            className="w-3 ml-2 cursor-pointer shrink-0 fill-gray-400 hover:fill-red-500"
            viewBox="0 0 320.591 320.591"
          >
            <path
              d="M30.391 318.583a30.37 30.37 0 0 1-21.56-7.288c-11.774-11.844-11.774-30.973 0-42.817L266.643 10.665c12.246-11.459 31.462-10.822 42.921 1.424 10.362 11.074 10.966 28.095 1.414 39.875L51.647 311.295a30.366 30.366 0 0 1-21.256 7.288z"
              data-original="#000000"
            ></path>
            <path
              d="M287.9 318.583a30.37 30.37 0 0 1-21.257-8.806L8.83 51.963C-2.078 39.225-.595 20.055 12.143 9.146c11.369-9.736 28.136-9.736 39.504 0l259.331 257.813c12.243 11.462 12.876 30.679 1.414 42.922-.456.487-.927.958-1.414 1.414a30.368 30.368 0 0 1-23.078 7.288z"
              data-original="#000000"
            ></path>
          </svg>
        </div>
        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div>
            <label className="text-gray-800 text-sm mb-2 block">
              Employee ID
            </label>
            <input
              name="emp_id"
              type="text"
              required
              value={formData.emp_id}
              onChange={handleChange}
              className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
              placeholder="Enter employee ID"
            />
          </div>

          <div>
            <label className="text-gray-800 text-sm mb-2 block">Name</label>
            <input
              name="ename"
              type="text"
              required
              value={formData.ename}
              onChange={handleChange}
              className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
              placeholder="Enter employee name"
            />
          </div>

          <div>
            <label className="text-gray-800 text-sm mb-2 block">
              Email
            </label>
            <input
              name="email"
              type="email"
              required
              value={formData.email}
              onChange={handleChange}
              className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
              placeholder="Enter email"
            />
          </div>

          <div>
            <label className="text-gray-800 text-sm mb-2 block">Phone</label>
            <input
              name="phone"
              type="text"
              required
              value={formData.phone}
              onChange={handleChange}
              className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
              placeholder="Enter phone number"
            />
          </div>

          <div>
            <label className="text-gray-800 text-sm mb-2 block">Username</label>
            <input
              name="username"
              type="text"
              required
              value={formData.username}
              onChange={handleChange}
              className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
              placeholder="Enter username"
            />
          </div>

          <div>
            <label className="text-gray-800 text-sm mb-2 block">Password</label>
            <input
              name="password"
              type="text"
              required
              value={formData.password}
              onChange={handleChange}
              className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
              placeholder="Enter password"
            />
          </div>

          <div>
            <label className="text-gray-800 text-sm mb-2 block">Role</label>
            <select
              name="role"
              value={formData.role}
              onChange={handleChange}
              className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
            >
              <option value="calling">Sales Manager</option>
              <option value="manager">Manager</option>
              <option value="operations">Operations Employee</option>
            </select>
          </div>

          <div>
            <label className="text-gray-800 text-sm mb-2 block">Status</label>
            <select
              name="status"
              value={formData.status}
              onChange={handleChange}
              className="w-full text-gray-800 text-sm border border-gray-300 px-4 py-3 rounded-md outline-blue-600"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          <div className="!mt-8">
            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-3 px-4 text-sm tracking-wide rounded-lg text-white bg-blue-600 hover:bg-blue-700 focus:outline-none disabled:bg-gray-300"
            >
              {isSubmitting ? "Adding..." : "Add"}
            </button>
          </div>
          {/* <p className="text-gray-800 text-sm !mt-8 text-center">
                Don't have an account?{" "}
                <a
                  href="javascript:void(0);"
                  className="text-blue-600 hover:underline ml-1 whitespace-nowrap font-semibold"
                >
                  Register here
                </a>
              </p> */}
        </form>
      </div>
    </div>
  );
};

export default AddUser;
