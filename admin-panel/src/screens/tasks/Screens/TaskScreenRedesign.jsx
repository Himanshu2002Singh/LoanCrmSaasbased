import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import DatePicker from "react-datepicker";
import "react-datepicker/dist/react-datepicker.css";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  CalendarClock,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  ChevronUp,
  Plus,
  Search,
  X,
} from "lucide-react";
import API_URL from "../../../config";
import CcPagination from "../../../components/CcPagination";

const PRIORITY_OPTIONS = ["LOW", "MEDIUM", "HIGH"];
const STATUS_OPTIONS = ["PENDING", "IN_PROGRESS", "COMPLETED"];
const PRIORITY_LABELS = { LOW: "Low", MEDIUM: "Medium", HIGH: "High" };
const STATUS_LABELS = { PENDING: "Pending", IN_PROGRESS: "In progress", COMPLETED: "Completed" };
const PAGE_SIZE = 8;

const priorityClass = (priority) => {
  switch (priority) {
    case "HIGH":
      return "cc-task-pill priority-high";
    case "MEDIUM":
      return "cc-task-pill priority-medium";
    default:
      return "cc-task-pill priority-low";
  }
};

const statusClass = (status) => {
  switch (status) {
    case "COMPLETED":
      return "cc-task-pill status-done";
    case "IN_PROGRESS":
      return "cc-task-pill status-progress";
    default:
      return "cc-task-pill status-idle";
  }
};

const emptyTask = () => ({
  title: "",
  due_date: null,
  priority: "LOW",
  description: "",
  emp_id: "",
  status: "PENDING",
});

export default function TaskScreenRedesign() {
  const [employees, setEmployees] = useState([]);
  const [tasksByEmp, setTasksByEmp] = useState({});
  const [expandedEmp, setExpandedEmp] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [priorityFilter, setPriorityFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [modalDesc, setModalDesc] = useState("");
  const [showAddModal, setShowAddModal] = useState(false);
  const [newTask, setNewTask] = useState(emptyTask);
  const [submitting, setSubmitting] = useState(false);
  const [loadingEmps, setLoadingEmps] = useState(true);
  const [currentPage, setCurrentPage] = useState(1);

  const fetchEmployees = async () => {
    setLoadingEmps(true);
    try {
      const res = await axios.get(`${API_URL}/users`, { params: { limit: 200 } });
      setEmployees(res.data?.data || []);
    } catch (error) {
      console.error("Error fetching employees", error);
      toast.error("Could not load employees");
    } finally {
      setLoadingEmps(false);
    }
  };

  const fetchTasksForEmployee = async (empId) => {
    try {
      const res = await axios.get(`${API_URL}/tasks`, { params: { userId: empId, limit: 200 } });
      setTasksByEmp((prev) => ({ ...prev, [empId]: res.data?.data || [] }));
    } catch (error) {
      console.error(`Error fetching tasks for ${empId}`, error);
      setTasksByEmp((prev) => ({ ...prev, [empId]: [] }));
    }
  };

  useEffect(() => {
    fetchEmployees();
  }, []);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const handleToggle = (empId) => {
    if (expandedEmp === empId) {
      setExpandedEmp(null);
      return;
    }
    setExpandedEmp(empId);
    if (!tasksByEmp[empId]) fetchTasksForEmployee(empId);
  };

  const handleAddTask = async () => {
    if (!newTask.title.trim() || !newTask.emp_id) {
      toast.error("Title and assignee are required");
      return;
    }
    setSubmitting(true);
    try {
      const payload = {
        ...newTask,
        due_date: newTask.due_date ? newTask.due_date.toISOString() : null,
      };
      await axios.post(`${API_URL}/tasks`, payload);
      toast.success("Task created");
      fetchTasksForEmployee(newTask.emp_id);
      setExpandedEmp(newTask.emp_id);
      setShowAddModal(false);
      setNewTask(emptyTask());
    } catch (error) {
      console.error("Error adding task", error);
      toast.error("Failed to create task");
    } finally {
      setSubmitting(false);
    }
  };

  const filteredEmployees = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return employees;
    const query = debouncedSearchTerm.toLowerCase();
    return employees.filter(
      (emp) =>
        String(emp.id).toLowerCase().includes(query) ||
        String(emp.name || "").toLowerCase().includes(query)
    );
  }, [employees, debouncedSearchTerm]);

  const totalPages = Math.max(1, Math.ceil(filteredEmployees.length / PAGE_SIZE));
  const pagedEmployees = useMemo(
    () => filteredEmployees.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE),
    [filteredEmployees, currentPage]
  );

  useEffect(() => {
    if (currentPage > totalPages) setCurrentPage(totalPages);
  }, [totalPages, currentPage]);

  // Auto-load tasks for every employee visible on the current page.
  useEffect(() => {
    const needed = pagedEmployees.filter((emp) => !tasksByEmp[emp.id]);
    if (needed.length === 0) return;
    let cancelled = false;
    Promise.all(
      needed.map((emp) =>
        axios
          .get(`${API_URL}/tasks`, { params: { userId: emp.id, limit: 200 } })
          .then((res) => ({ empId: emp.id, tasks: res.data?.data || [] }))
          .catch(() => ({ empId: emp.id, tasks: [] }))
      )
    ).then((results) => {
      if (cancelled) return;
      setTasksByEmp((prev) => {
        const next = { ...prev };
        for (const result of results) next[result.empId] = result.tasks;
        return next;
      });
    });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pagedEmployees]);

  const filterTasks = (tasks) => {
    if (!priorityFilter && !statusFilter) return tasks;
    return tasks.filter((task) => {
      if (priorityFilter && task.priority !== priorityFilter) return false;
      if (statusFilter && task.status !== statusFilter) return false;
      return true;
    });
  };

  return (
    <div className="cc-report-redesign cc-tasks-redesign">
      <ToastContainer position="bottom-right" />
      <style>{styles}</style>

      <section className="cc-report-panel">
        <div className="cc-tasks-toolbar">
          <label className="cc-report-search cc-tasks-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search employee by name or ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>
          <label className="cc-tasks-filter">
            Priority
            <select value={priorityFilter} onChange={(event) => setPriorityFilter(event.target.value)}>
              <option value="">All</option>
              {PRIORITY_OPTIONS.map((option) => (
                <option key={option} value={option}>{PRIORITY_LABELS[option]}</option>
              ))}
            </select>
          </label>
          <label className="cc-tasks-filter">
            Status
            <select value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="">All</option>
              {STATUS_OPTIONS.map((option) => (
                <option key={option} value={option}>{STATUS_LABELS[option]}</option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="cc-tasks-btn primary"
            onClick={() => {
              setNewTask(emptyTask());
              setShowAddModal(true);
            }}
          >
            <Plus size={16} /> Add task
          </button>
        </div>
      </section>

      <div className="cc-tasks-list">
        {loadingEmps ? (
          <section className="cc-report-panel cc-tasks-empty">Loading employees...</section>
        ) : filteredEmployees.length === 0 ? (
          <section className="cc-report-panel cc-tasks-empty">No employees match the filter</section>
        ) : (
          pagedEmployees.map((emp) => {
            const empTasks = tasksByEmp[emp.id];
            const isExpanded = expandedEmp === emp.id;
            const filteredEmpTasks = empTasks ? filterTasks(empTasks) : null;
            const totalShown = filteredEmpTasks ? filteredEmpTasks.length : empTasks?.length ?? 0;
            return (
              <section key={emp.id} className="cc-report-panel cc-tasks-emp">
                <button type="button" className="cc-tasks-emp-head" onClick={() => handleToggle(emp.id)}>
                  <span className="cc-tasks-emp-left">
                    <span className="cc-tasks-avatar">
                      {(emp.name || String(emp.id) || "?").slice(0, 2).toUpperCase()}
                    </span>
                    <span>
                      <strong>{emp.name || "Unnamed"}</strong>
                      <small>{emp.id}</small>
                    </span>
                  </span>
                  <span className="cc-tasks-emp-right">
                    {empTasks ? (
                      <span className="cc-tasks-count">{totalShown} task{totalShown === 1 ? "" : "s"}</span>
                    ) : (
                      <span className="cc-tasks-count muted">Loading...</span>
                    )}
                    {isExpanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                  </span>
                </button>

                {isExpanded ? (
                  <div className="cc-tasks-emp-body">
                    {!empTasks ? (
                      <p className="cc-report-empty" style={{ padding: "18px 0" }}>Loading tasks...</p>
                    ) : filteredEmpTasks.length === 0 ? (
                      <p className="cc-report-empty" style={{ padding: "18px 0" }}>
                        {empTasks.length === 0
                          ? "No tasks assigned yet. Click Add task to create one."
                          : "No tasks match the priority / status filter"}
                      </p>
                    ) : (
                      <div className="cc-report-table-scroll">
                        <table>
                          <thead>
                            <tr>
                              <th>Title</th>
                              <th>Due</th>
                              <th>Lead</th>
                              <th>Priority</th>
                              <th>Status</th>
                              <th>Description</th>
                            </tr>
                          </thead>
                          <tbody>
                            {filteredEmpTasks.map((task) => (
                              <tr key={task.id || task.task_id}>
                                <td style={{ fontWeight: 600 }}>{task.title}</td>
                                <td>
                                  {task.due_date ? new Date(task.due_date).toLocaleString() : "--"}
                                </td>
                                <td>{task.customer_name || task.lead_id || "--"}</td>
                                <td>
                                  <span className={priorityClass(task.priority)}>{PRIORITY_LABELS[task.priority] || task.priority}</span>
                                </td>
                                <td>
                                  <span className={statusClass(task.status)}>{STATUS_LABELS[task.status] || task.status}</span>
                                </td>
                                <td>
                                  {task.description ? (
                                    <button
                                      type="button"
                                      className="cc-tasks-desc"
                                      onClick={() => setModalDesc(task.description)}
                                      title="Open description"
                                    >
                                      {task.description.length > 40
                                        ? `${task.description.slice(0, 40)}...`
                                        : task.description}
                                    </button>
                                  ) : (
                                    "--"
                                  )}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    )}
                  </div>
                ) : null}
              </section>
            );
          })
        )}

        {filteredEmployees.length > 0 ? (
          <section className="cc-report-panel cc-tasks-pager">
            <CcPagination
              currentPage={currentPage}
              totalPages={totalPages}
              totalItems={filteredEmployees.length}
              onPageChange={setCurrentPage}
              itemLabel="employees"
            />
          </section>
        ) : null}
      </div>

      {modalDesc ? (
        <div className="cc-tasks-overlay" onClick={() => setModalDesc("")}>
          <div className="cc-tasks-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-tasks-modal-head">
              <h3>Task description</h3>
              <button type="button" onClick={() => setModalDesc("")}><X size={16} /></button>
            </div>
            <p style={{ whiteSpace: "pre-wrap", margin: 0, color: "#334155" }}>{modalDesc}</p>
          </div>
        </div>
      ) : null}

      {showAddModal ? (
        <div className="cc-tasks-overlay" onClick={() => setShowAddModal(false)}>
          <div className="cc-tasks-modal" onClick={(event) => event.stopPropagation()}>
            <div className="cc-tasks-modal-head">
              <h3>Add new task</h3>
              <button type="button" onClick={() => setShowAddModal(false)}><X size={16} /></button>
            </div>
            <form
              className="cc-tasks-form"
              onSubmit={(event) => {
                event.preventDefault();
                handleAddTask();
              }}
            >
              <label className="cc-form-field">
                <span>Title *</span>
                <input
                  type="text"
                  value={newTask.title}
                  onChange={(event) => setNewTask({ ...newTask, title: event.target.value })}
                  placeholder="e.g. Follow up with Acme lead"
                />
              </label>
              <div className="cc-tasks-form-row">
                <label className="cc-form-field">
                  <span>Due date & time</span>
                  <DatePicker
                    selected={newTask.due_date}
                    onChange={(date) => setNewTask({ ...newTask, due_date: date })}
                    showTimeSelect
                    dateFormat="dd MMM yyyy, hh:mm aa"
                    placeholderText="Pick a due date"
                  />
                </label>
              </div>
              <div className="cc-tasks-form-row">
                <label className="cc-form-field">
                  <span>Priority</span>
                  <select
                    value={newTask.priority}
                    onChange={(event) => setNewTask({ ...newTask, priority: event.target.value })}
                  >
                    {PRIORITY_OPTIONS.map((option) => (
                      <option key={option} value={option}>{PRIORITY_LABELS[option]}</option>
                    ))}
                  </select>
                </label>
                <label className="cc-form-field">
                  <span>Assign to *</span>
                  <select
                    value={newTask.emp_id}
                    onChange={(event) => setNewTask({ ...newTask, emp_id: event.target.value })}
                  >
                    <option value="">Select employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} ({emp.id})
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <label className="cc-form-field">
                <span>Description</span>
                <textarea
                  rows={4}
                  value={newTask.description}
                  onChange={(event) => setNewTask({ ...newTask, description: event.target.value })}
                  placeholder="Extra context, deliverables, links..."
                />
              </label>
              <div className="cc-tasks-form-actions">
                <button type="button" className="cc-tasks-btn ghost" onClick={() => setShowAddModal(false)}>
                  Cancel
                </button>
                <button type="submit" className="cc-tasks-btn primary" disabled={submitting}>
                  <CalendarClock size={14} />
                  {submitting ? "Creating..." : "Create task"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </div>
  );
}

const styles = `
  .cc-tasks-toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:flex-end; }
  .cc-tasks-search { flex:1 1 260px; min-width:220px; max-width:420px; }
  .cc-tasks-search input { appearance:none; -webkit-appearance:none; height:38px; padding:8px 12px 8px 40px; border:1px solid #d5ded7; border-radius:10px; background:#fff; font-size:13px; color:#0f172a; outline:none; width:100%; }
  .cc-tasks-search input:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); }
  .cc-tasks-filter { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569; }
  .cc-tasks-filter select { padding:8px 12px; border:1px solid #d5ded7; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; min-width:140px; }
  .cc-tasks-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; margin-left:auto; }
  .cc-tasks-btn.primary { background:#047857; color:#fff; }
  .cc-tasks-btn.primary:hover:not(:disabled) { filter:brightness(0.96); }
  .cc-tasks-btn.ghost { background:#fff; color:#0f172a; border:1px solid #d5ded7; margin-left:0; }
  .cc-tasks-btn:disabled { opacity:0.5; cursor:not-allowed; }

  .cc-tasks-list { display:flex; flex-direction:column; gap:14px; }
  .cc-tasks-emp { padding:0; overflow:hidden; }
  .cc-tasks-emp-head { display:flex; align-items:center; justify-content:space-between; width:100%; padding:14px 18px; background:#fff; border:0; cursor:pointer; text-align:left; }
  .cc-tasks-emp-head:hover { background:#f8fafc; }
  .cc-tasks-emp-left { display:inline-flex; align-items:center; gap:12px; }
  .cc-tasks-avatar { width:38px; height:38px; border-radius:50%; background:#eef7f2; color:#047857; display:grid; place-items:center; font-size:13px; font-weight:700; }
  .cc-tasks-emp-left strong { display:block; font-size:14px; color:#0f172a; }
  .cc-tasks-emp-left small { display:block; font-size:11.5px; color:#94a3b8; }
  .cc-tasks-emp-right { display:inline-flex; align-items:center; gap:10px; color:#475569; }
  .cc-tasks-count { display:inline-flex; padding:3px 10px; border-radius:999px; background:#eef7f2; color:#047857; font-size:12px; font-weight:600; }
  .cc-tasks-count.muted { background:#f1f5f9; color:#94a3b8; }

  .cc-tasks-emp-body { padding:0 18px 18px; border-top:1px solid #eef1ee; }

  .cc-task-pill { display:inline-flex; padding:3px 10px; border-radius:999px; font-size:11.5px; font-weight:600; }
  .cc-task-pill.priority-high { background:#fee2e2; color:#b91c1c; }
  .cc-task-pill.priority-medium { background:#fef3c7; color:#b45309; }
  .cc-task-pill.priority-low { background:#eef7f2; color:#047857; }
  .cc-task-pill.status-done { background:#eef7f2; color:#047857; }
  .cc-task-pill.status-progress { background:#eef2ff; color:#4338ca; }
  .cc-task-pill.status-idle { background:#f1f5f9; color:#475569; }

  .cc-tasks-desc { border:0; background:transparent; text-align:left; color:#047857; cursor:pointer; font-size:13px; padding:0; }
  .cc-tasks-desc:hover { text-decoration:underline; }

  .cc-tasks-empty { text-align:center; color:#475569; font-size:14px; padding:30px 20px; }

  .cc-tasks-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.55); z-index:70; display:grid; place-items:center; padding:16px; }
  .cc-tasks-modal { background:#fff; border-radius:16px; padding:22px; width:100%; max-width:640px; max-height:90vh; overflow-y:auto; display:flex; flex-direction:column; gap:14px; }
  .cc-tasks-modal-head { display:flex; align-items:center; justify-content:space-between; }
  .cc-tasks-modal-head h3 { margin:0; font-size:17px; font-weight:700; color:#0f172a; }
  .cc-tasks-modal-head button { border:0; background:#f1f5f9; color:#475569; width:30px; height:30px; border-radius:8px; cursor:pointer; display:grid; place-items:center; }
  .cc-tasks-modal-head button:hover { background:#e2e8f0; color:#0f172a; }

  .cc-tasks-form { display:flex; flex-direction:column; gap:12px; }
  .cc-tasks-form-row { display:grid; grid-template-columns:repeat(auto-fit,minmax(220px,1fr)); gap:12px; }
  .cc-form-field { display:flex; flex-direction:column; gap:4px; font-size:12px; color:#475569; }
  .cc-form-field input, .cc-form-field select, .cc-form-field textarea { padding:8px 12px; border:1px solid #d5ded7; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; font-family:inherit; }
  .cc-form-field input:focus, .cc-form-field select:focus, .cc-form-field textarea:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); outline:none; }
  .cc-tasks-form .react-datepicker-wrapper { width:100%; }
  .cc-tasks-form .react-datepicker__input-container input { padding:8px 12px; border:1px solid #d5ded7; border-radius:10px; font-size:13px; color:#0f172a; background:#fff; width:100%; font-family:inherit; }
  .cc-tasks-form-actions { display:flex; justify-content:flex-end; gap:8px; margin-top:4px; }

  .cc-tasks-pager { padding:14px 18px; }
  .cc-tasks-pagination { padding:0; margin:0; gap:12px; flex-wrap:wrap; }
  .cc-tasks-pagination > span { font-size:13px; color:#475569; }
  .cc-tasks-pagination > span b { color:#0f172a; font-weight:600; }
  .cc-tasks-pagination div { gap:6px; }
  .cc-tasks-pagination button { border-radius:10px !important; padding:8px 14px !important; font-size:13px !important; font-weight:600 !important; }
`;
