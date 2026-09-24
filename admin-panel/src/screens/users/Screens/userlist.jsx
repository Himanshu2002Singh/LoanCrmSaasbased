import React, { useEffect, useState } from "react";
import AddUser from "../adduser";
import AddUserExcel from "../addUserExcel";
import API_URL from "../../../config";
import axios from "axios";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import { useNavigate } from "react-router-dom";

const UserList = () => {
  const [isFormModalOpen, setIsFormModalOpen] = useState(false);
  const [isExcelModalOpen, setIsExcelModalOpen] = useState(false);
  const [users, setUsers] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [totalPages, setTotalPages] = useState(0);
  const [isLoading, setIsLoading] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showDeleteModal, setShowDeleteModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState(null);
  const [showTransferModal, setShowTransferModal] = useState(false);
  const [transferTargetId, setTransferTargetId] = useState("");
  const [allEmployees, setAllEmployees] = useState([]);

  const fetchAllEmployees = async () => {
    try {
      const response = await axios.get(`${API_URL}/employees?limit=10000`);
      if (response.data.message === "success") {
        setAllEmployees(response.data.employees);
      }
    } catch (error) {
      console.error("Error fetching all employees:", error);
    }
  };

  useEffect(() => {
    fetchAllEmployees();
  }, []);

  const itemsPerPage = 50;
  const navigate = useNavigate();

  const fetchUsers = async (page, search = "") => {
    setIsLoading(true);
    try {
      const response = await axios.get(
        `${API_URL}/employees?page=${page}&limit=${itemsPerPage}&search=${search}`
      );
      if (response.data.message === "success") {
        setUsers(response.data.employees);
        setTotalPages(response.data.pagination.totalPages);
      }
    } catch (error) {
      console.error("Error fetching users:", error);
    }
    setIsLoading(false);
  };

  useEffect(() => {
    const delayDebounceFn = setTimeout(() => {
      fetchUsers(currentPage, searchTerm);
    }, 500);

    return () => clearTimeout(delayDebounceFn);
  }, [currentPage, searchTerm]);

  const handleDeleteUser = async (employeeId) => {
    try {
      await toast.promise(axios.delete(`${API_URL}/delete_employee/${employeeId}`), {
        pending: "Deleting user...",
        success: `EmployeeId ${employeeId} deleted successfully!`,
        error: "Error deleting user. Please try again.",
      });

      // Update UI by filtering out the deleted user
      setUsers((prevUsers) => prevUsers.filter((user) => user.emp_id !== employeeId));
    } catch (error) {
      console.error("Error deleting user:", error);
    }
  };

  const handleUpdateUser = async () => {
    try {
      const response = await axios.put(`${API_URL}/update_employee/${selectedUser.emp_id}`, selectedUser);
      if (response.data.message === 'Employee data updated successfully') {
        toast.success("User updated successfully!");
        setUsers((prevUsers) =>
          prevUsers.map((user) =>
            user.emp_id === selectedUser.emp_id ? selectedUser : user
          )
        );
      } else {
        toast.error("Failed to update user.");
      }
    } catch (error) {
      console.error("Error updating user:", error);
      toast.error("Error updating user. Please try again.");
    }
  }

  const handleTransferLeads = async () => {
    if (!transferTargetId) {
      toast.error("Please select a target employee.");
      return;
    }
    const targetEmp = allEmployees.find(e => e.emp_id === transferTargetId);
    try {
      const response = await axios.post(`${API_URL}/reassignLeadsBulk`, {
        from_emp_id: selectedUser.emp_id,
        to_emp_id: transferTargetId,
        to_owner_name: targetEmp.ename
      });
      toast.success(response.data.message || "Leads transferred successfully!");
      setShowTransferModal(false);
      setTransferTargetId("");
    } catch (error) {
      console.error(error);
      toast.error("Failed to transfer leads.");
    }
  };

  // const users = [
  //   {
  //     id: 1,
  //     name: " Doe",
  //     email: "john@example.com",
  //     role: "Admin",
  //     joinedAt: "2022-05-15",
  //   },
  //   {
  //     id: 2,
  //     name: "Jane Smith",
  //     email: "jane@example.com",
  //     role: "User",
  //     joinedAt: "2022-07-20",
  //   },
  //   {
  //     id: 3,
  //     name: "Alen Doe",
  //     email: "alen@example.com",
  //     role: "User",
  //     joinedAt: "2022-07-21",
  //   },
  //   // Add more users here
  // ];

  const handleopenaddcallformModal = () => {
    setIsFormModalOpen(true);
  };

  const handleCloseaddcallformModal = () => {
    setIsFormModalOpen(false);
  };

  const handleopenaddcallExcelModal = () => {
    setIsExcelModalOpen(true);
  };

  const handleCloseaddcallExcelModal = () => {
    setIsExcelModalOpen(false);
  };

  return (
    <div>
      <ToastContainer position="bottom-right" />

      {isFormModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center" onClick={handleCloseaddcallformModal}>
          {" "}
          <div className="p-6 rounded w-11/12 md:w-1/2 lg:w-1/3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
              <AddUser
                handleCloseaddcallformModal={handleCloseaddcallformModal}
                onCreated={() => fetchUsers(currentPage, searchTerm)}
              />
          </div>
        </div>
      )}
      {isExcelModalOpen && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center" onClick={handleCloseaddcallExcelModal}>
          {" "}
          <div className="p-6 rounded w-11/12 md:w-1/2 lg:w-1/3 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
            <AddUserExcel
              handleCloseaddcallExcelModal={handleCloseaddcallExcelModal}
            />
          </div>
        </div>
      )}

      <div className="font-sans overflow-x-auto">
        {" "}
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-lg font-semibold">Employee List</h2>
          <div>
            <input
              type="text"
              placeholder="Search by name, email, employee ID or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-2/6 mr-2 px-4 py-2 border rounded-lg focus:outline-none focus:border-blue-500"
            />

            <button
              onClick={handleopenaddcallformModal}
              className="mr-2 bg-blue-500 text-white px-4 py-2 rounded hover:bg-blue-700"
            >
              Add User
            </button>
            <button
              onClick={handleopenaddcallExcelModal}
              className="bg-green-500 text-white px-4 py-2 rounded hover:bg-green-700"
            >
              Upload using Excel
            </button>
          </div>
        </div>
        <table className="min-w-full bg-white">
          <thead className="bg-gray-100 whitespace-nowrap">
            <tr>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">
                Employee Id
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">
                Name
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">
                Email
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">
                Phonenumber
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">
                Role
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">
                Status
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">
                Password
              </th>
              <th className="p-4 text-left text-xs font-semibold text-gray-800">
                Actions
              </th>
            </tr>
          </thead>

          <tbody className="whitespace-nowrap">
            {users.map((user) => (
              <tr
                key={user.id}
                className="hover:bg-gray-50"
                
              >
                <td onClick={() => navigate(`/userdetail/${user.emp_id}`)} className="p-4 text-[15px] text-gray-800">{user.emp_id}</td>
                <td onClick={() => navigate(`/userdetail/${user.emp_id}`)} className="p-4 text-[15px] text-gray-800">{user.ename}</td>
                <td onClick={() => navigate(`/userdetail/${user.emp_id}`)} className="p-4 text-[15px] text-gray-800">{user.email}</td>
                <td onClick={() => navigate(`/userdetail/${user.emp_id}`)} className="p-4 text-[15px] text-gray-800">{user.phone}</td>
                <td onClick={() => navigate(`/userdetail/${user.emp_id}`)} className="p-4 text-[15px] text-gray-800 capitalize">
                  {user.role === 'calling' || !user.role ? "Sales Manager" : user.role}
                </td>
                <td onClick={() => navigate(`/userdetail/${user.emp_id}`)} className="p-4 text-[15px] text-gray-800 capitalize">
                  {user.status || "active"}
                </td>
                <td onClick={() => navigate(`/userdetail/${user.emp_id}`)} className="p-4 text-[15px] text-gray-800">
                  {user.password}
                </td>

                <td className="p-4">
                  <button onClick={() => {
                    setSelectedUser(user);
                    setShowEditModal(true);
                  }} className="mr-4" title="Edit">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 fill-blue-500 hover:fill-blue-700"
                      viewBox="0 0 348.882 348.882"
                    >
                      <path
                        d="m333.988 11.758-.42-.383A43.363 43.363 0 0 0 304.258 0a43.579 43.579 0 0 0-32.104 14.153L116.803 184.231a14.993 14.993 0 0 0-3.154 5.37l-18.267 54.762c-2.112 6.331-1.052 13.333 2.835 18.729 3.918 5.438 10.23 8.685 16.886 8.685h.001c2.879 0 5.693-.592 8.362-1.76l52.89-23.138a14.985 14.985 0 0 0 5.063-3.626L336.771 73.176c16.166-17.697 14.919-45.247-2.783-61.418zM130.381 234.247l10.719-32.134.904-.99 20.316 18.556-.904.99-31.035 13.578zm184.24-181.304L182.553 197.53l-20.316-18.556L294.305 34.386c2.583-2.828 6.118-4.386 9.954-4.386 3.365 0 6.588 1.252 9.082 3.53l.419.383c5.484 5.009 5.87 13.546.861 19.03z"
                        data-original="#000000"
                      />
                      <path
                        d="M303.85 138.388c-8.284 0-15 6.716-15 15v127.347c0 21.034-17.113 38.147-38.147 38.147H68.904c-21.035 0-38.147-17.113-38.147-38.147V100.413c0-21.034 17.113-38.147 38.147-38.147h131.587c8.284 0 15-6.716 15-15s-6.716-15-15-15H68.904C31.327 32.266.757 62.837.757 100.413v180.321c0 37.576 30.571 68.147 68.147 68.147h181.798c37.576 0 68.147-30.571 68.147-68.147V153.388c.001-8.284-6.715-15-14.999-15z"
                        data-original="#000000"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setShowDeleteModal(true);
                    }}
                    title="Delete"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 fill-red-500 hover:fill-red-700"
                      viewBox="0 0 24 24"
                    >
                      <path
                        d="M19 7a1 1 0 0 0-1 1v11.191A1.92 1.92 0 0 1 15.99 21H8.01A1.92 1.92 0 0 1 6 19.191V8a1 1 0 0 0-2 0v11.191A3.918 3.918 0 0 0 8.01 23h7.98A3.918 3.918 0 0 0 20 19.191V8a1 1 0 0 0-1-1Zm1-3h-4V2a1 1 0 0 0-1-1H9a1 1 0 0 0-1 1v2H4a1 1 0 0 0 0 2h16a1 1 0 0 0 0-2ZM10 4V3h4v1Z"
                        data-original="#000000"
                      />
                      <path
                        d="M11 17v-7a1 1 0 0 0-2 0v7a1 1 0 0 0 2 0Zm4 0v-7a1 1 0 0 0-2 0v7a1 1 0 0 0 2 0Z"
                        data-original="#000000"
                      />
                    </svg>
                  </button>
                  <button
                    onClick={() => {
                      setSelectedUser(user);
                      setShowTransferModal(true);
                    }}
                    title="Transfer Leads"
                    className="ml-4"
                  >
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="w-5 fill-green-500 hover:fill-green-700"
                      viewBox="0 0 24 24"
                    >
                      <path d="M16 11V7l5 5-5 5v-4H4v-2h12zm-8 4v4l-5-5 5-5v4h12v2H8z" />
                    </svg>
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {isLoading && (
        <div className="flex justify-center mt-4">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
        </div>
      )}
      <div className="flex justify-center mt-4 gap-2">
        <button
          onClick={() => setCurrentPage((prev) => Math.max(prev - 1, 1))}
          disabled={currentPage === 1}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          Previous
        </button>
        <span className="px-4 py-2">
          Page {currentPage} of {totalPages}
        </span>
        <button
          onClick={() => setCurrentPage((prev) => prev + 1)}
          disabled={currentPage === totalPages}
          className="px-4 py-2 bg-blue-500 text-white rounded disabled:bg-gray-300"
        >
          Next
        </button>
      </div>

      {/* delete Confirmation Modal */}
      {showDeleteModal && selectedUser && (
        <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50" onClick={() => setShowDeleteModal(false)}>
          <div className="bg-white p-6 rounded shadow-md w-80" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-semibold mb-4">Confirm Delete</h2>
            <p className="mb-4">Are you sure you want to delete <strong>{selectedUser.ename}</strong>?</p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteModal(false)}
                className="px-4 py-2 bg-gray-200 rounded"
              >
                Cancel
              </button>
              <button
                onClick={() => {
                  handleDeleteUser(selectedUser.emp_id);
                  setShowDeleteModal(false);
                }}
                className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {showTransferModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex justify-center items-center z-50">
          <div className="bg-white p-6 rounded-lg w-96 max-w-full">
            <h3 className="text-lg font-semibold mb-4">Transfer Leads</h3>
            <p className="text-sm text-gray-600 mb-4">
              Transfer all leads from <span className="font-bold">{selectedUser?.ename}</span> to:
            </p>
            <select
              value={transferTargetId}
              onChange={(e) => setTransferTargetId(e.target.value)}
              className="w-full border p-2 rounded mb-4"
            >
              <option value="" disabled>Select Target Employee</option>
              {allEmployees.map(emp => (
                <option key={emp.emp_id} value={emp.emp_id}>
                  {emp.emp_id} - {emp.ename}
                </option>
              ))}
            </select>
            <div className="flex justify-end gap-2 mt-4">
              <button
                className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                onClick={() => {
                  setShowTransferModal(false);
                  setTransferTargetId("");
                }}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-blue-500 text-white rounded hover:bg-blue-600"
                onClick={handleTransferLeads}
              >
                Transfer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit User Modal */}
      {showEditModal && selectedUser && (
  <div className="fixed inset-0 flex justify-center items-center bg-black bg-opacity-50 z-50" onClick={() => setShowEditModal(false)}>
    <div className="bg-white p-6 rounded shadow-md w-96 max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
      <h2 className="text-lg font-semibold mb-4">Update User</h2>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          handleUpdateUser(); // define this
          setShowEditModal(false);
        }}
        className="space-y-4"
      >
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
          <input
            type="text"
            value={selectedUser.ename || ''}
            onChange={(e) => setSelectedUser({ ...selectedUser, ename: e.target.value })}
            className="w-full border px-3 py-2 rounded"
            placeholder="Name"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Username</label>
          <input
            type="text"
            value={selectedUser.username || ''}
            onChange={(e) => setSelectedUser({ ...selectedUser, username: e.target.value })}
            className="w-full border px-3 py-2 rounded"
            placeholder="Username"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
          <input
            type="email"
            value={selectedUser.email || ''}
            onChange={(e) => setSelectedUser({ ...selectedUser, email: e.target.value })}
            className="w-full border px-3 py-2 rounded"
            placeholder="Email"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
          <input
            type="text"
            value={selectedUser.phone || ''}
            onChange={(e) => setSelectedUser({ ...selectedUser, phone: e.target.value })}
            className="w-full border px-3 py-2 rounded"
            placeholder="Phone Number"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
          <input
            type="text"
            value={selectedUser.password || ''}
            onChange={(e) => setSelectedUser({ ...selectedUser, password: e.target.value })}
            className="w-full border px-3 py-2 rounded"
            placeholder="Password"
          />
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
          <select
            value={selectedUser.role || "calling"}
            onChange={(e) => setSelectedUser({ ...selectedUser, role: e.target.value })}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="calling">Sales Manager</option>
            <option value="manager">Manager</option>
            <option value="operations">Operations Employee</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
          <select
            value={selectedUser.status || "active"}
            onChange={(e) => setSelectedUser({ ...selectedUser, status: e.target.value })}
            className="w-full border px-3 py-2 rounded"
          >
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
        </div>
        <div className="flex justify-end gap-3 mt-4">
          <button
            type="button"
            onClick={() => setShowEditModal(false)}
            className="px-4 py-2 bg-gray-200 rounded"
          >
            Cancel
          </button>
          <button
            type="submit"
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
          >
            Update
          </button>
        </div>
      </form>
    </div>
  </div>
)}


    </div>
  );
};

export default UserList;
