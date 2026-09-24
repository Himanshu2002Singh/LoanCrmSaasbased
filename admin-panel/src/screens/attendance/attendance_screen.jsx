import React, { useEffect, useState } from "react";
import axios from "axios";
import API_URL from "../../config";
import * as XLSX from "xlsx";

const AttendanceScreen = () => {
  const [attendanceData, setAttendanceData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [employees, setEmployees] = useState([]);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const currentMonth = new Date().toISOString().slice(0, 7); // YYYY-MM
    return currentMonth;
  });
  const [currentPage, setCurrentPage] = useState(1);
const recordsPerPage = 20; 
const indexOfLastRecord = currentPage * recordsPerPage;
const indexOfFirstRecord = indexOfLastRecord - recordsPerPage;


  const downloadExcel = () => {
  const sheetData = [
    [
      "Emp ID",
      "Name",
      "Total",
      "Full",
      "Late",
      ...[...Array(totalDays)].map((_, i) => `Day ${i + 1}`),
    ],
  ];

  processedData.forEach((emp) => {
    const row = [
      emp.userId,
      emp.name,
      emp.total,
      emp.full,
      emp.late,
      ...emp.days.map((day) => {
        if (!day.symbol) return "-";
        return `${day.symbol} (${day.startTime || "-"} - ${day.endTime || "-"})\nRemark: ${day.remark || "-"}`;
      }),
    ];
    sheetData.push(row);
  });

  const ws = XLSX.utils.aoa_to_sheet(sheetData);

  // Enable text wrap in all cells
  const range = XLSX.utils.decode_range(ws['!ref']);
  for (let R = range.s.r; R <= range.e.r; ++R) {
    for (let C = range.s.c; C <= range.e.c; ++C) {
      const cellRef = XLSX.utils.encode_cell({ r: R, c: C });
      if (!ws[cellRef]) continue;
      if (!ws[cellRef].s) ws[cellRef].s = {};
      ws[cellRef].s.alignment = { wrapText: true, vertical: "top" };
    }
  }

  // Auto column widths
  const colWidths = sheetData[0].map((_, colIndex) => {
    let maxLength = 10;
    sheetData.forEach(row => {
      const val = row[colIndex];
      const len = val ? val.toString().length : 0;
      if (len > maxLength) maxLength = len;
    });
    return { wch: maxLength + 2 }; // Add padding
  });
  ws['!cols'] = colWidths;

  // Bold headers (first row)
  sheetData[0].forEach((_, i) => {
    const cellRef = XLSX.utils.encode_cell({ r: 0, c: i });
    if (ws[cellRef]) {
      ws[cellRef].s = {
        ...(ws[cellRef].s || {}),
        font: { bold: true },
        alignment: { wrapText: true, horizontal: "center" },
      };
    }
  });

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, "Attendance");

  // Important: apply style support
  XLSX.writeFile(wb, `attendance_${selectedMonth}.xlsx`, { cellStyles: true });
};


  const formatToLocalTime = (isoString) => {
    if (!isoString) return "-";
    const date = new Date(isoString);
    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit",
    });
  };
  // Fetch attendance data
  useEffect(() => {
    const fetchAttendance = async () => {
      try {
        setLoading(true);
        const response = await axios.get(
          `${API_URL}/monthlyattendance/${selectedMonth}`
        );
        setAttendanceData(response.data.data || response.data.attendance || []);
        
      } catch (error) {
        console.error("Error fetching attendance data", error);
      } finally {
        setLoading(false);
      }
    };

    fetchAttendance();
  }, [selectedMonth]);

  // Fetch employee list
  useEffect(() => {
    const fetchEmployees = async () => {
      try {
        const res = await axios.get(`${API_URL}/employees`);
        setEmployees(res.data.employees);
      } catch (error) {
        console.error("Error fetching employees:", error);
      }
    };

    fetchEmployees();
  }, []);

  // Helpers
  const getDaysInMonth = (monthStr) => {
    const [year, month] = monthStr.split("-").map(Number);
    return new Date(year, month, 0).getDate();
  };

  // Group attendance by userId and date
  const groupedAttendance = {};
  attendanceData.forEach((record) => {
    const { userId, date, isLate, startTime, endTime, remark } = record;
    const day = new Date(date).getDate();
    if (!groupedAttendance[userId]) groupedAttendance[userId] = {};
    groupedAttendance[userId][day] = {
    symbol: isLate ? "🟨" : "✅",
    className: isLate ? "bg-yellow-100" : "bg-green-100",
    startTime : formatToLocalTime(startTime),
    endTime : formatToLocalTime(endTime),
    remark,
  };
  });

  // Final processed data
  const totalDays = getDaysInMonth(selectedMonth);
  const processedData = employees.map((emp) => {
    const days = [];
    let full = 0;
    let late = 0;

    for (let i = 1; i <= totalDays; i++) {
      const status = groupedAttendance[emp.emp_id]?.[i];
      if (status) {
        days.push(status); // already contains symbol, className, startTime, etc.
        if(status.symbol === "✅") {
          full++;
        }else if(status.symbol === "🟨"){
          late++;
        }
      } else {
        days.push({ symbol: "", className: "" });
      }
    }

    return {
      userId: emp.emp_id,
      name: emp.ename,
      total: full + late,
      full,
      late,
      days,
    };
  });

  const currentRecords = processedData.slice(indexOfFirstRecord, indexOfLastRecord);

const totalPages = Math.ceil(processedData.length / recordsPerPage);

  const renderPageNumbers = () => {
  const maxVisible = 5;
  let startPage = Math.max(currentPage - Math.floor(maxVisible / 2), 1);
  let endPage = startPage + maxVisible - 1;

  if (endPage > totalPages) {
    endPage = totalPages;
    startPage = Math.max(endPage - maxVisible + 1, 1);
  }

  const pages = [];

  if (currentPage > 1) {
    pages.push(
      <button
        key="prev"
        onClick={() => setCurrentPage(currentPage - 1)}
        className="px-3 py-1 border bg-white"
      >
        Prev
      </button>
    );
  }

  for (let i = startPage; i <= endPage; i++) {
    pages.push(
      <button
        key={i}
        onClick={() => setCurrentPage(i)}
        className={`px-3 py-1 border ${
          i === currentPage ? "bg-blue-500 text-white" : "bg-white"
        }`}
      >
        {i}
      </button>
    );
  }

  if (currentPage < totalPages) {
    pages.push(
      <button
        key="next"
        onClick={() => setCurrentPage(currentPage + 1)}
        className="px-3 py-1 border bg-white"
      >
        Next
      </button>
    );
  }

  return pages;
};


  return (
    <div className="p-4 overflow-auto">
      <h2 className="text-2xl font-semibold mb-4">Attendance</h2>
      <div className="flex items-center justify-between flex-wrap mb-4">
        <label className="block">
          <span className="font-medium">Select Month:</span>
          <input
            type="month"
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value)}
            className="border rounded px-2 py-1 ml-2"
          />
        </label>

        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2 px-2 py-1 bg-green-100 rounded">
            <span className="text-lg">✅</span>
            <span className="text-sm">Full Day</span>
          </div>
          <div className="flex items-center gap-2 px-2 py-1 bg-yellow-100 rounded">
            <span className="text-lg">🟨</span>
            <span className="text-sm">Late</span>
          </div>
        </div>
        
        <button
    onClick={downloadExcel}
    className="bg-blue-600 text-white px-4 py-2 rounded shadow hover:bg-blue-700 transition-all"
  >
    Download Excel
  </button>

      </div>



      {loading ? (
        <p className="mt-4">Loading attendance...</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full border text-sm text-center border-collapse">
            <thead className="bg-gray-100 sticky top-0 z-10">
              <tr>
                <th className="border px-2 py-1">Emp ID</th>
                <th className="border px-2 py-1">Name</th>
                <th className="border px-2 py-1">Total</th>
                <th className="border px-2 py-1">Full</th>
                <th className="border px-2 py-1">Late</th>
                {[...Array(totalDays)].map((_, i) => (
                  <th key={i} className="border px-1 py-1 text-xs">{i + 1}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {currentRecords.map((emp, idx) => (
                <tr key={idx} className="hover:bg-gray-50">
                  <td className="border px-2 py-1 font-medium">{emp.userId}</td>
                  <td className="border px-2 py-1">{emp.name}</td>
                  <td className="border px-2 py-1">{emp.total}</td>
                  <td className="border px-2 py-1">{emp.full}</td>
                  <td className="border px-2 py-1">{emp.late}</td>
                  {emp.days.map((day, i) => (
                    <td
                      key={i}
                      className={`border px-1 py-1 ${day.className}`}
                      title={
                        day.symbol
                          ? `Start: ${day.startTime || "-"}\nClose: ${day.endTime || "-"}\nRemark: ${day.remark || "-"}`
                          : ""
                      }
                    >
                      {day.symbol}
                    </td>

                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <div className="flex gap-2 justify-center mt-4 flex-wrap">
  {renderPageNumbers()}
</div>
    </div>
  );
};

export default AttendanceScreen;
