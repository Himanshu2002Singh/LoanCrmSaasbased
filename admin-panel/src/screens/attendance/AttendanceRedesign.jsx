import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useNavigate } from "react-router-dom";
import { ToastContainer, toast } from "react-toastify";
import "react-toastify/dist/ReactToastify.css";
import {
  AlertCircle,
  ArrowLeft,
  CalendarCheck,
  CalendarDays,
  CheckCircle2,
  Clock,
  Download,
  Edit3,
  ExternalLink,
  MapPin,
  Search,
  ShieldCheck,
  UserCheck,
  X,
} from "lucide-react";
import API_URL from "../../config";
import CcPagination from "../../components/CcPagination";

const PAGE_SIZE = 20;
const FETCH_PAGE_SIZE = 200;
const numberFormatter = new Intl.NumberFormat("en-IN");

const formatTime = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  return date.toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
};

const formatTimeInput = (isoString) => {
  if (!isoString) return "";
  const date = new Date(isoString);
  if (isNaN(date.getTime())) return "";
  const hours = String(date.getHours()).padStart(2, "0");
  const minutes = String(date.getMinutes()).padStart(2, "0");
  return `${hours}:${minutes}`;
};

const formatDateNice = (dateStr) => {
  if (!dateStr) return "";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return dateStr;
  return d.toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
  });
};

const daysInMonth = (monthStr) => {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month, 0).getDate();
};

const weekdayOf = (monthStr, day) => {
  const [year, month] = monthStr.split("-").map(Number);
  return new Date(year, month - 1, day).getDay(); // 0=Sun
};

/**
 * Calculates total decimal working hours from HH:mm time strings.
 */
const calculateWorkingHours = (inTime, outTime) => {
  if (!inTime || !outTime) return "";
  const [inH, inM] = inTime.split(":").map(Number);
  const [outH, outM] = outTime.split(":").map(Number);
  if (isNaN(inH) || isNaN(inM) || isNaN(outH) || isNaN(outM)) return "";
  let inMinutes = inH * 60 + inM;
  let outMinutes = outH * 60 + outM;
  if (outMinutes < inMinutes) {
    outMinutes += 24 * 60; // Crosses midnight
  }
  const diffHours = (outMinutes - inMinutes) / 60;
  return diffHours > 0 ? diffHours.toFixed(2) : "0.00";
};

export default function AttendanceRedesign() {
  const navigate = useNavigate();
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().toISOString().slice(0, 7));
  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [employees, setEmployees] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [debouncedSearchTerm, setDebouncedSearchTerm] = useState("");
  const [currentPage, setCurrentPage] = useState(1);

  // Modal State: "info" | "override" | null
  const [activeModal, setActiveModal] = useState(null);
  const [selectedCell, setSelectedCell] = useState(null);

  const [overrideForm, setOverrideForm] = useState({
    userId: "",
    date: "",
    status: "PRESENT",
    checkInTime: "09:30",
    checkOutTime: "18:30",
    workingHours: "9.00",
    reason: "",
    recordId: null,
  });
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    const debounce = setTimeout(() => {
      setDebouncedSearchTerm(searchTerm);
      setCurrentPage(1);
    }, 400);
    return () => clearTimeout(debounce);
  }, [searchTerm]);

  const loadMonthData = async () => {
    setLoading(true);
    try {
      const all = [];
      for (let page = 1; ; page += 1) {
        const res = await axios.get(`${API_URL}/attendance`, {
          params: { month: selectedMonth, page, limit: FETCH_PAGE_SIZE },
        });
        const batch = res.data?.data || [];
        all.push(...batch);
        if (batch.length < FETCH_PAGE_SIZE || page >= (res.data?.pagination?.totalPages || 1)) break;
      }
      setAttendanceRecords(all);
    } catch (error) {
      console.error("Error fetching attendance", error);
      toast.error(error.response?.data?.message || "Failed to load attendance");
      setAttendanceRecords([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadMonthData();
  }, [selectedMonth]);

  useEffect(() => {
    axios
      .get(`${API_URL}/users`, { params: { limit: FETCH_PAGE_SIZE } })
      .then((res) => setEmployees(res.data?.data || []))
      .catch((error) => {
        console.error("Error fetching employees", error);
        setEmployees([]);
      });
  }, []);

  const totalDays = daysInMonth(selectedMonth);

  const processedData = useMemo(() => {
    const grouped = {};
    for (const record of attendanceRecords) {
      const userId = record.emp_id || record.userId;
      const date = record.date;
      if (!userId || !date) continue;
      const day = new Date(date).getDate();
      if (!grouped[userId]) grouped[userId] = {};

      let state = "absent";
      if (record.status === "PRESENT") state = "full";
      else if (record.status === "LATE") state = "late";
      else if (record.status === "HALF_DAY") state = "half";
      else if (record.status === "ABSENT") state = "absent";

      grouped[userId][day] = {
        recordId: record.id || record.attendance_id,
        state,
        status: record.status,
        startTime: formatTime(record.check_in_time),
        endTime: formatTime(record.check_out_time),
        rawCheckIn: record.check_in_time,
        rawCheckOut: record.check_out_time,
        checkInLat: record.check_in_lat,
        checkInLng: record.check_in_lng,
        checkOutLat: record.check_out_lat,
        checkOutLng: record.check_out_lng,
        workingHours: record.working_hours,
        isManualOverride: Boolean(record.is_manual_override || record.isManualOverride),
        remark: record.override_reason || record.overrideReason || "",
        overriddenBy: record.overridden_by || record.overriddenBy || null,
      };
    }

    return employees.map((employee) => {
      const days = [];
      let full = 0;
      let late = 0;
      let half = 0;
      for (let index = 1; index <= totalDays; index += 1) {
        const record = grouped[employee.id]?.[index];
        if (record) {
          days.push(record);
          if (record.state === "full") full += 1;
          else if (record.state === "late") late += 1;
          else if (record.state === "half") half += 1;
        } else {
          days.push({ state: "absent" });
        }
      }
      return {
        empId: String(employee.id),
        name: employee.name || String(employee.id),
        role: employee.role || "EMPLOYEE",
        total: full + late + half,
        full,
        late,
        half,
        days,
      };
    });
  }, [attendanceRecords, employees, totalDays]);

  const filtered = useMemo(() => {
    if (!debouncedSearchTerm.trim()) return processedData;
    const query = debouncedSearchTerm.toLowerCase();
    return processedData.filter(
      (row) => row.empId.toLowerCase().includes(query) || row.name.toLowerCase().includes(query)
    );
  }, [processedData, debouncedSearchTerm]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE));
  const paged = filtered.slice((currentPage - 1) * PAGE_SIZE, currentPage * PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [selectedMonth]);

  // Step 1: Open Attendance Info Modal on cell click
  const handleCellClick = (employee, dayNumber, existingRecord) => {
    const formattedDate = `${selectedMonth}-${String(dayNumber).padStart(2, "0")}`;

    setSelectedCell({
      employeeId: employee.empId,
      employeeName: employee.name,
      employeeRole: employee.role,
      dayNumber,
      date: formattedDate,
      record: existingRecord,
    });

    const inTimeInput = existingRecord?.rawCheckIn ? formatTimeInput(existingRecord.rawCheckIn) : "09:30";
    const outTimeInput = existingRecord?.rawCheckOut ? formatTimeInput(existingRecord.rawCheckOut) : "18:30";
    const autoHours = calculateWorkingHours(inTimeInput, outTimeInput) || "9.00";

    setOverrideForm({
      userId: employee.empId,
      date: formattedDate,
      status: existingRecord?.status || (existingRecord ? "PRESENT" : "ABSENT"),
      checkInTime: inTimeInput,
      checkOutTime: outTimeInput,
      workingHours: existingRecord?.workingHours ? String(existingRecord.workingHours) : autoHours,
      reason: existingRecord?.remark || "",
      recordId: existingRecord?.recordId || null,
    });

    setActiveModal("info");
  };

  // Step 2: Switch from Info Modal to Override Form Modal
  const handleOpenEditFromInfo = () => {
    setActiveModal("override");
  };

  // Direct open from "+ Manual Override" top button
  const handleOpenGeneralOverride = () => {
    const today = new Date().toISOString().slice(0, 10);
    const firstEmp = employees[0];
    const inTime = "09:30";
    const outTime = "18:30";
    const autoHours = calculateWorkingHours(inTime, outTime) || "9.00";

    setSelectedCell(null);
    setOverrideForm({
      userId: firstEmp?.id ? String(firstEmp.id) : "",
      date: today,
      status: "PRESENT",
      checkInTime: inTime,
      checkOutTime: outTime,
      workingHours: autoHours,
      reason: "",
      recordId: null,
    });
    setActiveModal("override");
  };

  const handleCloseModal = () => {
    setActiveModal(null);
    setSelectedCell(null);
    setSubmitting(false);
  };

  // Handle Time Change with Auto Working Hours Calculation
  const handleTimeChange = (field, value) => {
    const nextForm = { ...overrideForm, [field]: value };
    const inVal = field === "checkInTime" ? value : overrideForm.checkInTime;
    const outVal = field === "checkOutTime" ? value : overrideForm.checkOutTime;

    if (inVal && outVal) {
      const calculated = calculateWorkingHours(inVal, outVal);
      if (calculated) {
        nextForm.workingHours = calculated;
      }
    }
    setOverrideForm(nextForm);
  };

  // Handle Status change (e.g. ABSENT sets hours to 0)
  const handleStatusChange = (status) => {
    const next = { ...overrideForm, status };
    if (status === "ABSENT") {
      next.workingHours = "0.00";
    } else if (status === "HALF_DAY") {
      next.workingHours = next.workingHours && Number(next.workingHours) > 4.5 ? "4.00" : next.workingHours || "4.00";
    } else {
      const autoHours = calculateWorkingHours(next.checkInTime, next.checkOutTime);
      if (autoHours) next.workingHours = autoHours;
    }
    setOverrideForm(next);
  };

  const handleOverrideSubmit = async (e) => {
    e.preventDefault();
    if (!overrideForm.reason.trim()) {
      toast.error("Override reason / justification is mandatory");
      return;
    }
    if (!overrideForm.userId || !overrideForm.date) {
      toast.error("Employee and date are required");
      return;
    }

    setSubmitting(true);
    try {
      let checkInTimeObj = null;
      let checkOutTimeObj = null;

      if (overrideForm.checkInTime) {
        const [h, m] = overrideForm.checkInTime.split(":");
        const d = new Date(overrideForm.date);
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        checkInTimeObj = d.toISOString();
      }

      if (overrideForm.checkOutTime) {
        const [h, m] = overrideForm.checkOutTime.split(":");
        const d = new Date(overrideForm.date);
        d.setHours(parseInt(h, 10), parseInt(m, 10), 0, 0);
        checkOutTimeObj = d.toISOString();
      }

      const workingHoursNum = Number(overrideForm.workingHours) || 0;

      if (overrideForm.recordId) {
        // PUT /api/attendance/:id/override
        await axios.put(`${API_URL}/attendance/${overrideForm.recordId}/override`, {
          status: overrideForm.status,
          reason: overrideForm.reason.trim(),
          checkInTime: checkInTimeObj,
          checkOutTime: checkOutTimeObj,
          workingHours: workingHoursNum,
        });
        toast.success("Attendance successfully overridden!");
      } else {
        // POST /api/attendance/manual
        await axios.post(`${API_URL}/attendance/manual`, {
          userId: Number(overrideForm.userId),
          date: overrideForm.date,
          status: overrideForm.status,
          reason: overrideForm.reason.trim(),
          checkInTime: checkInTimeObj,
          checkOutTime: checkOutTimeObj,
          workingHours: workingHoursNum,
        });
        toast.success("Manual attendance record created successfully!");
      }

      handleCloseModal();
      loadMonthData();
    } catch (error) {
      console.error("Override error:", error);
      toast.error(error.response?.data?.message || "Failed to override attendance");
    } finally {
      setSubmitting(false);
    }
  };

  const downloadExcel = () => {
    const header = [
      "Emp ID",
      "Name",
      "Total",
      "Full",
      "Late",
      "Half Day",
      ...Array.from({ length: totalDays }, (_, index) => `Day ${index + 1}`),
    ];
    const sheetData = [header];
    processedData.forEach((row) => {
      sheetData.push([
        row.empId,
        row.name,
        row.total,
        row.full,
        row.late,
        row.half,
        ...row.days.map((day) => {
          if (day.state === "absent") return "-";
          const symbol = day.state === "late" ? "Late" : day.state === "half" ? "Half Day" : "Full";
          return `${symbol} (${day.startTime || "-"} - ${day.endTime || "-"})${
            day.remark ? `\nRemark: ${day.remark}` : ""
          }`;
        }),
      ]);
    });
    const sheet = XLSX.utils.aoa_to_sheet(sheetData);
    sheet["!cols"] = header.map((title) => ({ wch: Math.max(10, title.length + 2) }));
    const book = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(book, sheet, "Attendance");
    XLSX.writeFile(book, `attendance_${selectedMonth}.xlsx`);
  };

  return (
    <div className="cc-report-redesign cc-attendance">
      <ToastContainer position="top-right" autoClose={3000} />
      <style>{styles}</style>

      <section className="cc-report-panel">
        <div className="cc-att-toolbar">
          <label className="cc-att-month">
            <CalendarDays size={16} />
            <input
              type="month"
              value={selectedMonth}
              onChange={(event) => setSelectedMonth(event.target.value)}
            />
          </label>

          <label className="cc-report-search cc-att-search">
            <Search size={18} />
            <input
              type="search"
              placeholder="Search employee by name or ID..."
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
            />
          </label>

          <div className="cc-att-legend">
            <span className="cc-att-chip full"><i /> Full</span>
            <span className="cc-att-chip late"><i /> Late</span>
            <span className="cc-att-chip half"><i /> Half Day</span>
            <span className="cc-att-chip override"><i /> Overridden (M)</span>
          </div>

          <div className="cc-att-actions">
            <button
              type="button"
              className="cc-att-btn override-btn"
              onClick={handleOpenGeneralOverride}
              title="Manually override or record attendance"
            >
              <Edit3 size={15} /> Manual Override
            </button>

            <button type="button" className="cc-att-btn primary" onClick={downloadExcel}>
              <Download size={15} /> Excel
            </button>
          </div>
        </div>
      </section>

      <section className="cc-report-panel">
        <div className="cc-att-table-wrap">
          <table className="cc-att-table">
            <thead>
              <tr>
                <th className="sticky s0">Emp ID</th>
                <th className="sticky s1">Name</th>
                <th className="sticky s2 mid">Total</th>
                <th className="sticky s3 mid">Full</th>
                <th className="sticky s4 mid">Late</th>
                <th className="sticky s5 mid">Half</th>
                {Array.from({ length: totalDays }, (_, index) => {
                  const day = index + 1;
                  const dow = weekdayOf(selectedMonth, day);
                  const isWeekend = dow === 0 || dow === 6;
                  return (
                    <th key={day} className={`day ${isWeekend ? "weekend" : ""}`}>
                      <b>{day}</b>
                      <small>{"SMTWTFS"[dow]}</small>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={6 + totalDays} className="cc-report-empty">
                    Loading attendance...
                  </td>
                </tr>
              ) : paged.length === 0 ? (
                <tr>
                  <td colSpan={6 + totalDays} className="cc-report-empty">
                    No attendance records match the filters
                  </td>
                </tr>
              ) : (
                paged.map((row) => (
                  <tr key={row.empId} className="cc-att-row">
                    <td
                      className="sticky s0 clickable-emp"
                      onClick={() => navigate(`/userdetail/${row.empId}`)}
                      title="View user details"
                    >
                      {row.empId}
                    </td>
                    <td
                      className="sticky s1 clickable-emp"
                      onClick={() => navigate(`/userdetail/${row.empId}`)}
                      title="View user details"
                    >
                      {row.name}
                    </td>
                    <td className="sticky s2 mid num">{numberFormatter.format(row.total)}</td>
                    <td className="sticky s3 mid num">{numberFormatter.format(row.full)}</td>
                    <td className="sticky s4 mid num">{numberFormatter.format(row.late)}</td>
                    <td className="sticky s5 mid num">{numberFormatter.format(row.half)}</td>

                    {row.days.map((day, index) => {
                      const dayNumber = index + 1;
                      const dow = weekdayOf(selectedMonth, dayNumber);
                      const isWeekend = dow === 0 || dow === 6;
                      const isOverridden = day.isManualOverride;

                      const tooltip =
                        day.state === "absent"
                          ? `Day ${dayNumber}: Absent (Click to view/mark)`
                          : `${day.state === "late" ? "Late" : day.state === "half" ? "Half Day" : "Full"} · ${
                              day.startTime || "--"
                            } → ${day.endTime || "--"}${
                              isOverridden ? `\n★ Manual Override: ${day.remark}` : ""
                            }\n(Click to view details)`;

                      return (
                        <td
                          key={dayNumber}
                          className={`day ${isWeekend ? "weekend" : ""} cell-interactive`}
                          title={tooltip}
                          onClick={() => handleCellClick(row, dayNumber, day.recordId ? day : null)}
                        >
                          <span className={`cc-att-cell ${day.state} ${isOverridden ? "is-overridden" : ""}`}>
                            {day.state === "full" ? "✓" : day.state === "late" ? "L" : day.state === "half" ? "½" : "·"}
                            {isOverridden && <span className="override-star">M</span>}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <CcPagination
          currentPage={currentPage}
          totalPages={totalPages}
          totalItems={filtered.length}
          onPageChange={setCurrentPage}
          itemLabel="employees"
        />
      </section>

      {/* STEP 1: ATTENDANCE INFO MODAL (First view on cell click) */}
      {activeModal === "info" && selectedCell && (
        <div className="cc-modal-overlay" onClick={handleCloseModal}>
          <div className="cc-modal-card cc-info-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div className="cc-modal-head-title">
                <div className="cc-modal-icon-badge info-badge">
                  <UserCheck size={20} />
                </div>
                <div>
                  <p>Attendance Record</p>
                  <h3>{selectedCell.employeeName}</h3>
                </div>
              </div>
              <button type="button" className="cc-modal-close" onClick={handleCloseModal} title="Close">
                <X size={17} />
              </button>
            </div>

            <div className="cc-info-body">
              {/* Top Banner Date & Status */}
              <div className="cc-info-banner">
                <div className="cc-info-date">
                  <CalendarDays size={16} />
                  <span>{formatDateNice(selectedCell.date)}</span>
                </div>

                <div className={`cc-status-badge ${selectedCell.record?.state || "absent"}`}>
                  {selectedCell.record?.state === "full" && <><CheckCircle2 size={14} /> Full Day Present</>}
                  {selectedCell.record?.state === "late" && <><Clock size={14} /> Late Arrival</>}
                  {selectedCell.record?.state === "half" && <><AlertCircle size={14} /> Half Day</>}
                  {(!selectedCell.record || selectedCell.record?.state === "absent") && <><span>·</span> Not Marked / Absent</>}
                </div>
              </div>

              {/* Metrics Grid */}
              <div className="cc-metrics-grid">
                <div className="cc-metric-box">
                  <span className="cc-metric-label"><Clock size={13} /> Check-In Time</span>
                  <strong className="cc-metric-val">
                    {selectedCell.record?.startTime || "--:--"}
                  </strong>
                </div>
                <div className="cc-metric-box">
                  <span className="cc-metric-label"><Clock size={13} /> Check-Out Time</span>
                  <strong className="cc-metric-val">
                    {selectedCell.record?.endTime || "--:--"}
                  </strong>
                </div>
                <div className="cc-metric-box">
                  <span className="cc-metric-label"><ShieldCheck size={13} /> Total Hours</span>
                  <strong className="cc-metric-val highlight">
                    {selectedCell.record?.workingHours ? `${Number(selectedCell.record.workingHours).toFixed(2)} hrs` : "--"}
                  </strong>
                </div>
                <div className="cc-metric-box">
                  <span className="cc-metric-label"><UserCheck size={13} /> Verification</span>
                  <strong className="cc-metric-val">
                    {selectedCell.record?.isManualOverride ? "Manual Override" : selectedCell.record ? "Mobile GPS" : "None"}
                  </strong>
                </div>
              </div>

              {/* Override Justification Notice if Overridden */}
              {selectedCell.record?.isManualOverride && (
                <div className="cc-override-alert">
                  <div className="cc-override-alert-head">
                    <Edit3 size={15} />
                    <strong>Admin Override Reason / Note:</strong>
                  </div>
                  <p>{selectedCell.record.remark || "No remarks provided"}</p>
                </div>
              )}

              {/* GPS Geofence details if marked via GPS */}
              {selectedCell.record?.checkInLat && selectedCell.record?.checkInLng && (
                <div className="cc-gps-summary">
                  <div className="cc-gps-summary-left">
                    <MapPin size={15} />
                    <span>GPS: {Number(selectedCell.record.checkInLat).toFixed(4)}, {Number(selectedCell.record.checkInLng).toFixed(4)}</span>
                  </div>
                  <a
                    href={`https://maps.google.com/?q=${selectedCell.record.checkInLat},${selectedCell.record.checkInLng}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="cc-maps-link"
                  >
                    View Map <ExternalLink size={12} />
                  </a>
                </div>
              )}
            </div>

            <div className="cc-modal-actions">
              <button type="button" className="cc-btn cc-btn-ghost" onClick={handleCloseModal}>
                Close
              </button>
              <button type="button" className="cc-btn cc-btn-primary" onClick={handleOpenEditFromInfo}>
                <Edit3 size={15} /> Edit / Override Attendance
              </button>
            </div>
          </div>
        </div>
      )}

      {/* STEP 2: ATTENDANCE OVERRIDE / MANUAL ENTRY FORM MODAL */}
      {activeModal === "override" && (
        <div className="cc-modal-overlay" onClick={handleCloseModal}>
          <div className="cc-modal-card" onClick={(e) => e.stopPropagation()}>
            <div className="cc-modal-head">
              <div className="cc-modal-head-title">
                <div className="cc-modal-icon-badge">
                  <CalendarCheck size={20} />
                </div>
                <div>
                  <p>Attendance Management</p>
                  <h3>{overrideForm.recordId ? "Override Attendance Record" : "Create Manual Attendance"}</h3>
                </div>
              </div>
              <button type="button" className="cc-modal-close" onClick={handleCloseModal} title="Close">
                <X size={17} />
              </button>
            </div>

            <form className="cc-modal-form" onSubmit={handleOverrideSubmit}>
              <div className="cc-form-grid">
                <label className="cc-field">
                  <span>Employee *</span>
                  <select
                    value={overrideForm.userId}
                    onChange={(e) => setOverrideForm({ ...overrideForm, userId: e.target.value })}
                    required
                    disabled={Boolean(selectedCell?.employeeId)}
                  >
                    <option value="">Select Employee</option>
                    {employees.map((emp) => (
                      <option key={emp.id} value={emp.id}>
                        {emp.name} (ID: {emp.id})
                      </option>
                    ))}
                  </select>
                </label>

                <label className="cc-field">
                  <span>Date *</span>
                  <input
                    type="date"
                    required
                    value={overrideForm.date}
                    onChange={(e) => setOverrideForm({ ...overrideForm, date: e.target.value })}
                  />
                </label>
              </div>

              <div className="cc-form-grid">
                <label className="cc-field">
                  <span>Attendance Status *</span>
                  <select
                    value={overrideForm.status}
                    onChange={(e) => handleStatusChange(e.target.value)}
                    required
                  >
                    <option value="PRESENT">Full Day Present (✓)</option>
                    <option value="LATE">Late Arrival (L)</option>
                    <option value="HALF_DAY">Half Day (½)</option>
                    <option value="ABSENT">Absent (A)</option>
                  </select>
                </label>

                <label className="cc-field">
                  <span>Working Hours (Auto-Calculated)</span>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    max="24"
                    placeholder="9.00"
                    value={overrideForm.workingHours}
                    onChange={(e) => setOverrideForm({ ...overrideForm, workingHours: e.target.value })}
                  />
                  <small className="cc-field-hint">Auto-computes from Check-in & Check-out</small>
                </label>
              </div>

              <div className="cc-form-grid">
                <label className="cc-field">
                  <span>Check-In Time</span>
                  <input
                    type="time"
                    value={overrideForm.checkInTime}
                    onChange={(e) => handleTimeChange("checkInTime", e.target.value)}
                  />
                </label>

                <label className="cc-field">
                  <span>Check-Out Time</span>
                  <input
                    type="time"
                    value={overrideForm.checkOutTime}
                    onChange={(e) => handleTimeChange("checkOutTime", e.target.value)}
                  />
                </label>
              </div>

              <label className="cc-field">
                <span>Reason for Override / Manual Approval *</span>
                <textarea
                  rows={3}
                  required
                  placeholder="e.g. Approved client site visit by manager / Network GPS glitch verified / Medical slip submitted..."
                  value={overrideForm.reason}
                  onChange={(e) => setOverrideForm({ ...overrideForm, reason: e.target.value })}
                />
                <small className="cc-field-hint">
                  This justification will be permanently saved in the immutable audit log.
                </small>
              </label>

              <div className="cc-modal-actions">
                {selectedCell && (
                  <button
                    type="button"
                    className="cc-btn cc-btn-ghost"
                    onClick={() => setActiveModal("info")}
                  >
                    <ArrowLeft size={15} /> Back to Details
                  </button>
                )}
                <button type="button" className="cc-btn cc-btn-ghost" onClick={handleCloseModal}>
                  Cancel
                </button>
                <button type="submit" className="cc-btn cc-btn-primary" disabled={submitting}>
                  {submitting ? "Saving..." : overrideForm.recordId ? "Save Override" : "Create Record"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

const styles = `
  .cc-att-toolbar { display:flex; flex-wrap:wrap; gap:12px; align-items:center; }
  .cc-att-month { display:inline-flex; align-items:center; gap:8px; padding:6px 10px; border:1px solid #d5ded7; border-radius:10px; background:#fff; color:#0f172a; font-size:13px; font-weight:600; }
  .cc-att-month input { appearance:none; border:0; background:transparent; color:#0f172a; font-size:13px; font-weight:600; padding:0; outline:none; font-family:inherit; }
  .cc-att-search { flex:1 1 200px; min-width:180px; max-width:320px; }
  .cc-att-search input { appearance:none; -webkit-appearance:none; height:38px; padding:8px 12px 8px 40px; border:1px solid #d5ded7; border-radius:10px; background:#fff; font-size:13px; color:#0f172a; outline:none; width:100%; }
  .cc-att-search input:focus { border-color:#047857; box-shadow:0 0 0 3px rgba(4,120,87,0.15); }

  .cc-att-legend { display:inline-flex; gap:6px; flex-wrap:wrap; margin-right:auto; }
  .cc-att-chip { display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:999px; font-size:12px; font-weight:600; }
  .cc-att-chip i { width:8px; height:8px; border-radius:50%; }
  .cc-att-chip.full { background:#eef7f2; color:#047857; }
  .cc-att-chip.full i { background:#10b981; }
  .cc-att-chip.late { background:#fef3c7; color:#b45309; }
  .cc-att-chip.late i { background:#f59e0b; }
  .cc-att-chip.half { background:#f3e8ff; color:#7e22ce; }
  .cc-att-chip.half i { background:#a855f7; }
  .cc-att-chip.override { background:#fff7ed; color:#c2410c; border:1px solid #ffedd5; }
  .cc-att-chip.override i { background:#ea580c; }

  .cc-att-actions { display:flex; gap:8px; align-items:center; }
  .cc-att-btn { display:inline-flex; align-items:center; gap:6px; padding:8px 14px; border-radius:10px; font-size:13px; font-weight:600; border:1px solid transparent; cursor:pointer; transition:all 0.15s ease; }
  .cc-att-btn.primary { background:#047857; color:#fff; }
  .cc-att-btn.primary:hover { filter:brightness(0.95); }
  .cc-att-btn.override-btn { background:#fff7ed; color:#c2410c; border:1px solid #fed7aa; }
  .cc-att-btn.override-btn:hover { background:#ffedd5; color:#9a3412; }

  .cc-att-table-wrap { overflow-x:auto; border-radius:12px; border:1px solid #eef1ee; max-height:calc(100vh - 240px); }
  .cc-att-table { border-collapse:separate; border-spacing:0; width:max-content; min-width:100%; font-size:12.5px; text-align:center; }
  .cc-att-table thead th { background:#f8fafc; color:#334155; font-weight:600; font-size:11.5px; text-transform:uppercase; letter-spacing:0.04em; padding:10px 8px; border-bottom:1px solid #eef1ee; white-space:nowrap; position:sticky; top:0; z-index:2; }
  .cc-att-table tbody td { padding:7px 5px; border-bottom:1px solid #eef1ee; white-space:nowrap; background:#fff; }
  .cc-att-table th.sticky, .cc-att-table td.sticky { position:sticky; z-index:3; background:#fff; }
  .cc-att-table thead th.sticky { background:#f8fafc; z-index:5; }
  .cc-att-table .s0 { left:0; text-align:left; padding-left:14px; font-weight:600; color:#0f172a; min-width:70px; }
  .cc-att-table .s1 { left:70px; text-align:left; min-width:135px; }
  .cc-att-table .s2 { left:205px; min-width:50px; border-right:1px solid #eef1ee; }
  .cc-att-table .s3 { left:255px; min-width:50px; }
  .cc-att-table .s4 { left:305px; min-width:50px; }
  .cc-att-table .s5 { left:355px; min-width:50px; border-right:2px solid #d5ded7; }
  .cc-att-table td.num, .cc-att-table th.mid { text-align:center; font-variant-numeric:tabular-nums; }
  .cc-att-table th.day { min-width:32px; padding:6px 4px; text-transform:none; letter-spacing:0; font-size:11px; }
  .cc-att-table th.day b { display:block; font-size:12px; color:#0f172a; }
  .cc-att-table th.day small { display:block; font-size:10px; color:#94a3b8; }
  .cc-att-table th.day.weekend { background:#f1f5f9; }
  .cc-att-table td.day { min-width:32px; padding:3px; }
  .cc-att-table td.day.weekend { background:#f8fafc; }

  .cc-att-cell { display:inline-grid; place-items:center; width:22px; height:22px; border-radius:6px; font-size:11px; font-weight:700; position:relative; user-select:none; }
  .cc-att-cell.full { background:#dcfce7; color:#047857; }
  .cc-att-cell.late { background:#fef3c7; color:#b45309; }
  .cc-att-cell.half { background:#f3e8ff; color:#7e22ce; }
  .cc-att-cell.absent { background:transparent; color:#94a3b8; }
  .cc-att-cell.is-overridden { border:1px solid #f97316; box-shadow:0 0 0 1px #fdba74; }
  .override-star { position:absolute; top:-4px; right:-4px; font-size:8px; font-weight:800; background:#ea580c; color:#fff; border-radius:50%; width:11px; height:11px; display:grid; place-items:center; line-height:1; }

  .cell-interactive { cursor:pointer; }
  .cell-interactive:hover { background:#f0fdf4 !important; }
  .cell-interactive:hover .cc-att-cell { transform:scale(1.15); transition:transform 0.1s; }

  .clickable-emp { cursor:pointer; color:#0f172a; }
  .clickable-emp:hover { color:#047857; text-decoration:underline; }

  /* Modal Styling */
  .cc-modal-overlay { position:fixed; inset:0; background:rgba(15,23,42,0.65); backdrop-filter:blur(3px); z-index:150; display:grid; place-items:center; padding:16px; }
  .cc-modal-card { width:100%; max-width:540px; background:#fff; border-radius:18px; padding:24px; display:flex; flex-direction:column; gap:16px; box-shadow:0 20px 60px rgba(15,23,42,0.3); max-height:92vh; overflow-y:auto; }
  .cc-modal-head { display:flex; justify-content:space-between; align-items:flex-start; }
  .cc-modal-head-title { display:flex; align-items:center; gap:12px; }
  .cc-modal-icon-badge { width:42px; height:42px; border-radius:12px; background:#eef7f2; color:#047857; display:grid; place-items:center; }
  .cc-modal-icon-badge.info-badge { background:#eff6ff; color:#2563eb; }
  .cc-modal-head p { margin:0; font-size:11px; text-transform:uppercase; font-weight:700; color:#047857; letter-spacing:0.05em; }
  .cc-modal-head h3 { margin:2px 0 0 0; font-size:18px; color:#0f172a; font-weight:700; }
  .cc-modal-close { width:32px; height:32px; border-radius:8px; border:0; background:#f1f5f9; color:#64748b; cursor:pointer; display:grid; place-items:center; }
  .cc-modal-close:hover { background:#e2e8f0; color:#0f172a; }

  /* Step 1 Info Modal Body */
  .cc-info-body { display:flex; flex-direction:column; gap:14px; }
  .cc-info-banner { display:flex; justify-content:space-between; align-items:center; padding:12px 14px; background:#f8fafc; border:1px solid #e2e8f0; border-radius:12px; flex-wrap:wrap; gap:8px; }
  .cc-info-date { display:inline-flex; align-items:center; gap:6px; font-weight:700; color:#0f172a; font-size:13.5px; }
  .cc-status-badge { display:inline-flex; align-items:center; gap:6px; padding:5px 10px; border-radius:8px; font-size:12px; font-weight:700; }
  .cc-status-badge.full { background:#dcfce7; color:#047857; }
  .cc-status-badge.late { background:#fef3c7; color:#b45309; }
  .cc-status-badge.half { background:#f3e8ff; color:#7e22ce; }
  .cc-status-badge.absent { background:#fee2e2; color:#b91c1c; }

  .cc-metrics-grid { display:grid; grid-template-columns:1fr 1fr; gap:10px; }
  .cc-metric-box { background:#fff; border:1px solid #e2e8f0; border-radius:12px; padding:12px; display:flex; flex-direction:column; gap:4px; }
  .cc-metric-label { font-size:11.5px; color:#64748b; font-weight:600; display:inline-flex; align-items:center; gap:5px; }
  .cc-metric-val { font-size:16px; font-weight:800; color:#0f172a; }
  .cc-metric-val.highlight { color:#047857; }

  .cc-override-alert { background:#fff7ed; border:1px solid #fed7aa; border-radius:12px; padding:12px; }
  .cc-override-alert-head { display:flex; align-items:center; gap:6px; color:#c2410c; font-size:12.5px; font-weight:700; margin-bottom:4px; }
  .cc-override-alert p { margin:0; font-size:13px; color:#9a3412; line-height:1.4; }

  .cc-gps-summary { display:flex; justify-content:space-between; align-items:center; background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:8px 12px; font-size:12px; color:#64748b; }
  .cc-gps-summary-left { display:flex; align-items:center; gap:6px; }
  .cc-maps-link { color:#047857; text-decoration:none; font-weight:600; display:inline-flex; align-items:center; gap:4px; }
  .cc-maps-link:hover { text-decoration:underline; }

  /* Form Styling */
  .cc-modal-form { display:flex; flex-direction:column; gap:14px; }
  .cc-form-grid { display:grid; grid-template-columns:1fr 1fr; gap:12px; }
  .cc-field { display:flex; flex-direction:column; gap:6px; font-size:12.5px; font-weight:600; color:#334155; }
  .cc-field input, .cc-field textarea, .cc-field select { padding:9px 12px; border:1px solid #cbd5e1; border-radius:10px; font-size:13.5px; color:#0f172a; background:#fff; font-family:inherit; }
  .cc-field input:focus, .cc-field textarea:focus, .cc-field select:focus { border-color:#047857; outline:none; box-shadow:0 0 0 3px rgba(4,120,87,0.12); }
  .cc-field-hint { font-size:11px; color:#64748b; font-weight:400; margin-top:2px; }

  .cc-modal-actions { display:flex; justify-content:flex-end; gap:10px; margin-top:6px; }
  .cc-btn { display:inline-flex; align-items:center; gap:7px; padding:9px 16px; border-radius:10px; font-size:13.5px; font-weight:600; border:1px solid transparent; cursor:pointer; }
  .cc-btn-primary { background:#047857; color:#fff; }
  .cc-btn-primary:hover:not(:disabled) { background:#065f46; }
  .cc-btn-ghost { background:#f1f5f9; color:#334155; }
  .cc-btn-ghost:hover { background:#e2e8f0; }
  .cc-btn:disabled { opacity:0.6; cursor:not-allowed; }
`;
