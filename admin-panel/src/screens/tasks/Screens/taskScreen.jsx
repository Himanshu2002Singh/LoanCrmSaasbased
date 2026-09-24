import React, { useState, useEffect } from "react";
import { FaChevronDown, FaChevronUp } from "react-icons/fa";
import API_URL from "../../../config";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";

function TaskScreen() {
  const [employees, setEmployees] = useState([]);
  const [tasks, setTasks] = useState({});
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [modalDesc, setModalDesc] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState({
    title: "",
    start_date: "",
    end_date: "",
    priority: "Low",
    description: "",
    emp_id: "",
    assigned_by_name : "Admin",
    assigned_by_id : "CC055",
    status : "Initial"
  });

  useEffect(() => {
    fetchEmployees();
  }, []);

  const fetchEmployees = async () => {
    try {
      const res = await axios.get(`${API_URL}/employees`);
      setEmployees(res.data.employees);
    } catch (error) {
      console.error("Error fetching employees:", error);
    }
  };

  const fetchTasksForEmployee = async (empId) => {
  try {
    const res = await axios.get(`${API_URL}/task/${empId}`);
    const filteredTasks = res.data.tasks.filter((task) => task.assigned_by_name === "Admin");
    setTasks((prev) => ({ ...prev, [empId]: filteredTasks }));
  } catch (error) {
    console.error(`Error fetching tasks for employee ${empId}:`, error);
  }
};


  const handleEmployeeClick = (empId) => {
    if (expandedEmp === empId) {
      setExpandedEmp(null);
    } else {
      setExpandedEmp(empId);
      if (!tasks[empId]) {
        fetchTasksForEmployee(empId);
      }
    }
  };

  const handleAddTaskSubmit = async () => {
    if (!newTask.title || !newTask.emp_id) {
      alert("Please fill required fields (Title, Assigned To)");
      return;
    }
    console.log(newTask.emp_id);
    try {
      await axios.post(`${API_URL}/add_task`, newTask);
      alert("Task added successfully!");
      fetchTasksForEmployee(newTask.emp_id);
      setShowAddModal(false);
      setNewTask({
        title: "",
        start_date: "",
        end_date: "",
        priority: "Low",
        description: "",
        emp_id: "",
        assigned_by_name : "Admin",
        assigned_by_id : "CC055",
        status : "Initial"
      });
    } catch (error) {
      console.error("Error adding task:", error);
      alert("Failed to add task");
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6">
      <h2 className="text-2xl font-bold mb-6 text-center text-gray-700">Employee Task List</h2>

      <div className="flex justify-end max-w-5xl mx-auto mb-6">
        <button
          onClick={() => setShowAddModal(true)}
          className="bg-blue-600 text-white px-4 py-2 rounded hover:bg-blue-700"
        >
          Add Task
        </button>
      </div>

      <div className="space-y-5 max-w-5xl mx-auto">
        {employees.map((emp) => (
          <div
            key={emp.emp_id}
            className="rounded-xl shadow-md hover:shadow-lg transition duration-300 border-l-8 border-blue-900 hover:bg-blue-50"
          >
            <div
              className="flex justify-between items-center p-4 cursor-pointer bg-blue-50 rounded-t-xl hover:bg-blue-100"
              onClick={() => handleEmployeeClick(emp.emp_id)}
            >
              <div>
                <p className="font-semibold text-lg text-gray-800">{emp.ename}</p>
                <p className="text-gray-600 text-sm">Employee ID: {emp.emp_id}</p>
              </div>
              <div className="text-gray-600">
                {expandedEmp === emp.emp_id ? <FaChevronUp size={20} /> : <FaChevronDown size={20} />}
              </div>
            </div>

            {expandedEmp === emp.emp_id && (
              <div className="mt-2 p-4 bg-white rounded-b-xl overflow-x-auto">
                <table className="min-w-full text-sm text-left border-collapse">
                  <thead>
                    <tr className="bg-blue-100">
                      <th className="p-3">Title</th>
                      <th className="p-3">Start DateTime</th>
                      <th className="p-3">End DateTime</th>
                      <th className="p-3">Priority</th>
                      <th className="p-3">Status</th>
                      <th className="p-3">Description</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(tasks[emp.emp_id] || []).map((task) => (
                      <tr key={task.id} className="hover:bg-blue-50 border-b">
                        <td className="p-3 font-medium">{task.title}</td>
                        <td className="p-3">{new Date(task.start_date).toLocaleString()}</td>
                        <td className="p-3">{new Date(task.end_date).toLocaleString()}</td>

                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${task.priority === "High" ? "bg-red-100 text-red-600" : task.priority === "Medium" ? "bg-yellow-100 text-yellow-600" : "bg-green-100 text-green-600"}`}>{task.priority}</span>
                        </td>
                        <td className="p-3">
                          <span className={`px-2 py-1 rounded-full text-xs font-semibold ${task.status === "Completed" ? "bg-green-100 text-green-600" : task.status === "On Going" ? "bg-blue-100 text-blue-600" : "bg-gray-200 text-gray-600"}`}>{task.status}</span>
                        </td>
                        <td className="p-3">
                          <span className="cursor-pointer text-blue-500 hover:underline" title={task.description} onClick={() => setModalDesc(task.description)}>
                            {task.description.length > 30 ? task.description.slice(0, 30) + "..." : task.description}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>

                {(!tasks[emp.emp_id] || tasks[emp.emp_id].length === 0) && (
                  <p className="text-gray-500 mt-2">No tasks found.</p>
                )}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Task Description Modal */}
      {modalDesc && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => setModalDesc("")}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xl w-full relative" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setModalDesc("")}
            >
              &times;
            </button>
            <h3 className="text-2xl font-bold mb-4">Task Description</h3>
            <p className="text-gray-600 leading-relaxed whitespace-pre-wrap">{modalDesc}</p>
          </div>
        </div>
      )}

      {/* Add Task Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black bg-opacity-40 backdrop-blur-sm flex items-center justify-center z-50 px-4" onClick={() => setShowAddModal(false)}>
          <div className="bg-white rounded-2xl shadow-2xl p-6 max-w-xl w-full relative" onClick={(e) => e.stopPropagation()}>
            <button
              className="absolute top-3 right-4 text-gray-400 hover:text-gray-700 text-2xl"
              onClick={() => setShowAddModal(false)}
            >
              &times;
            </button>
            <h3 className="text-xl font-bold mb-4">Add New Task</h3>
            <div className="space-y-4">
              <input type="text" placeholder="Title *" value={newTask.title} onChange={(e) => setNewTask({ ...newTask, title: e.target.value })} className="w-full border p-2 rounded" />
              <DatePicker
  selected={newTask.start_date}
  onChange={(date) => setNewTask({ ...newTask, start_date: date })}
  showTimeSelect
  dateFormat="dd/MM/yyyy h:mm aa"
  placeholderText="Start DateTime"
  className="w-full border p-2 rounded"
/>

<DatePicker
  selected={newTask.end_date}
  onChange={(date) => setNewTask({ ...newTask, end_date: date })}
  showTimeSelect
  dateFormat="dd/MM/yyyy h:mm aa"
  placeholderText="End DateTime"
  className="w-full border p-2 rounded"
/>
              <select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value })} className="w-full border p-2 rounded">
                <option value="Low">Low</option>
                <option value="Medium">Medium</option>
                <option value="High">High</option>
              </select>
              <textarea placeholder="Description" value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} className="w-full border p-2 rounded" />
              <select value={newTask.emp_id} onChange={(e) => setNewTask({ ...newTask, emp_id: e.target.value })} className="w-full border p-2 rounded">
                <option value="">-- Assign To * --</option>
                {employees.map((emp) => (
                  <option key={emp.emp_id} value={emp.emp_id}>{emp.ename} (ID: {emp.emp_id})</option>
                ))}
              </select>
              <button onClick={handleAddTaskSubmit} className="bg-green-600 text-white px-4 py-2 rounded hover:bg-green-700">Submit</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export default TaskScreen;
