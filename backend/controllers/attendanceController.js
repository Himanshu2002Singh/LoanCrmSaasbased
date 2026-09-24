const { Op, fn, col } = require("sequelize");
const { Attendance, User, Branch } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");
const {
  HALF_DAY_HOURS,
  lateCutoffMinutes,
  parseMinutes,
  LATE_THRESHOLD_MINUTES,
} = require("../config/attendanceRules");

const STATUSES = ["PRESENT", "HALF_DAY", "LATE", "ABSENT"];
const SORTABLE = ["date", "checkInTime", "workingHours", "status"];

const ATTENDANCE_INCLUDES = [
  { model: User, as: "user", attributes: ["id", "name", "role", "branchId"], required: false },
];

const serialize = (row) => ({
  attendance_id: row.id,
  id: row.id,
  emp_id: row.userId,
  employee: row.user?.name || null,
  date: row.date,
  check_in_time: row.checkInTime,
  check_out_time: row.checkOutTime,
  check_in_lat: row.checkInLat,
  check_in_lng: row.checkInLng,
  check_out_lat: row.checkOutLat,
  check_out_lng: row.checkOutLng,
  working_hours: row.workingHours,
  status: row.status,
  is_manual_override: row.isManualOverride,
  override_reason: row.overrideReason,
  createdAt: row.createdAt,
});

/**
 * The working day is measured in IST regardless of where the server runs, so
 * a check-in just before midnight lands on the right date.
 */
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;
const istNow = () => new Date(Date.now() + IST_OFFSET_MS);
const istDateString = (date = istNow()) => date.toISOString().slice(0, 10);

/**
 * Great-circle distance in metres. Used to decide whether a check-in falls
 * inside the branch's allowed radius.
 */
const distanceMeters = (lat1, lng1, lat2, lng2) => {
  const R = 6371000;
  const toRad = (deg) => (deg * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * R * Math.asin(Math.sqrt(a));
};

/**
 * Late is measured against branch's start time + late buffer if configured,
 * otherwise fallback to the deployment-wide global start time + buffer.
 */
const classifyCheckIn = (checkInAt, branch = null) => {
  const actualMinutes = checkInAt.getUTCHours() * 60 + checkInAt.getUTCMinutes();
  let cutoff = lateCutoffMinutes();
  if (branch?.workStartTime) {
    const startM = parseMinutes(branch.workStartTime);
    const buffer =
      branch.lateBufferMinutes !== null && branch.lateBufferMinutes !== undefined
        ? Number(branch.lateBufferMinutes)
        : LATE_THRESHOLD_MINUTES;
    cutoff = startM + buffer;
  }
  return actualMinutes > cutoff ? "LATE" : "PRESENT";
};

const scope = async (req) => {
  if (req.user.role === ROLES.EMPLOYEE) return { userId: req.user.id };
  if (req.user.role === ROLES.MANAGER) {
    const team = await User.findAll({
      where: { companyId: req.user.companyId, managerId: req.user.id },
      attributes: ["id"],
      raw: true,
    });
    return { userId: { [Op.in]: [req.user.id, ...team.map((u) => u.id)] } };
  }
  return {};
};

/**
 * POST /api/attendance/check-in
 * Body: { lat, lng, remark }
 */
exports.checkIn = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const today = istDateString();

    const existing = await Attendance.findOne({ where: { userId: req.user.id, date: today } });
    if (existing) {
      return res.status(409).json({ message: "Attendance already marked today", data: serialize(existing) });
    }

    let branch = req.user.branchId ? await Branch.findByPk(req.user.branchId) : null;
    if (!branch && req.user.companyId) {
      branch = await Branch.findOne({ where: { companyId: req.user.companyId } });
    }

    // Geofence, but only where the branch actually has coordinates configured.
    if (branch?.officeLat && branch?.officeLng) {
      if (lat === undefined || lng === undefined || lat === null || lng === null || (Number(lat) === 0 && Number(lng) === 0)) {
        return res.status(400).json({ message: "Valid GPS latitude and longitude are required to mark attendance" });
      }
      const distance = distanceMeters(Number(lat), Number(lng), Number(branch.officeLat), Number(branch.officeLng));
      if (distance > branch.geoRadiusMeters) {
        return res.status(403).json({
          message: `You are ${Math.round(distance)}m from ${branch.name}; the allowed radius is ${branch.geoRadiusMeters}m`,
          distanceMeters: Math.round(distance),
          allowedRadius: branch.geoRadiusMeters,
        });
      }
    }

    const now = istNow();
    const attendance = await Attendance.create({
      companyId: req.user.companyId,
      userId: req.user.id,
      date: today,
      checkInTime: now,
      checkInLat: lat ?? null,
      checkInLng: lng ?? null,
      status: classifyCheckIn(now, branch),
    });

    await logActivity(req, {
      recordType: "Attendance",
      recordId: attendance.id,
      action: "CREATED",
      newValue: { date: today, status: attendance.status },
      remarks: req.body.remark || null,
      companyId: req.user.companyId,
    });

    return res.status(201).json({ message: "Attendance marked", data: serialize(attendance) });
  } catch (error) {
    console.error("[attendance] checkIn error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/attendance/check-out
 * Closes today's open record and stores the hours worked.
 */
exports.checkOut = async (req, res) => {
  try {
    const { lat, lng } = req.body;
    const today = istDateString();

    const attendance = await Attendance.findOne({ where: { userId: req.user.id, date: today } });
    if (!attendance) {
      return res.status(404).json({ message: "No check-in found for today" });
    }
    if (attendance.checkOutTime) {
      return res.status(409).json({ message: "Attendance already closed", data: serialize(attendance) });
    }

    let branch = req.user.branchId ? await Branch.findByPk(req.user.branchId) : null;
    if (!branch && req.user.companyId) {
      branch = await Branch.findOne({ where: { companyId: req.user.companyId } });
    }

    const now = istNow();
    const hours = (now - new Date(attendance.checkInTime)) / 3600000;
    const halfDayThreshold =
      branch?.halfDayHours !== null && branch?.halfDayHours !== undefined
        ? Number(branch.halfDayHours)
        : HALF_DAY_HOURS;

    await attendance.update({
      checkOutTime: now,
      checkOutLat: lat ?? null,
      checkOutLng: lng ?? null,
      workingHours: Math.max(Number(hours.toFixed(2)), 0),
      // A short day is a half day unless the check-in was already marked late.
      status: hours < halfDayThreshold ? "HALF_DAY" : attendance.status,
    });

    await logActivity(req, {
      recordType: "Attendance",
      recordId: attendance.id,
      action: "UPDATED",
      newValue: { checkOutTime: now, workingHours: attendance.workingHours, status: attendance.status },
      companyId: req.user.companyId,
    });

    return res.status(200).json({ message: "Checked out", data: serialize(attendance) });
  } catch (error) {
    console.error("[attendance] checkOut error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/attendance/today - what the mobile app asks on launch.
 */
exports.getToday = async (req, res) => {
  try {
    const attendance = await Attendance.findOne({
      where: { userId: req.user.id, date: istDateString() },
      include: ATTENDANCE_INCLUDES,
    });

    return res.status(200).json({
      message: "success",
      checkedIn: Boolean(attendance),
      checkedOut: Boolean(attendance?.checkOutTime),
      data: attendance ? serialize(attendance) : null,
    });
  } catch (error) {
    console.error("[attendance] getToday error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/attendance
 * ?page&limit&sortBy&sortDir&userId&status&fromDate&toDate&month=YYYY-MM
 */
exports.getAttendance = async (req, res) => {
  try {
    const { limit, offset, order, page } = buildQuery(req.query, {
      sortable: SORTABLE,
      defaultSort: ["date", "DESC"],
    });

    const where = { ...companyScope(req), ...(await scope(req)) };

    if (req.query.userId && req.user.role !== ROLES.EMPLOYEE) {
      where.userId = parseInt(req.query.userId, 10);
    }
    if (req.query.status) where.status = String(req.query.status).toUpperCase();

    if (req.query.month) {
      // YYYY-MM covers that calendar month.
      const [year, month] = req.query.month.split("-").map(Number);
      const start = `${req.query.month}-01`;
      const end = new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10);
      where.date = { [Op.between]: [start, end] };
    } else if (req.query.fromDate || req.query.toDate) {
      where.date = {};
      if (req.query.fromDate) where.date[Op.gte] = req.query.fromDate;
      if (req.query.toDate) where.date[Op.lte] = req.query.toDate;
    }

    const { count, rows } = await Attendance.findAndCountAll({
      where,
      include: ATTENDANCE_INCLUDES,
      limit,
      offset,
      order,
      distinct: true,
    });

    const payload = paginated({ count, rows: rows.map(serialize), page, limit });
    payload.pagination.totalItems = count;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[attendance] getAttendance error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/attendance/summary - present/late/half-day counts and hours, for
 * the dashboards and the monthly view.
 */
exports.getSummary = async (req, res) => {
  try {
    const where = { ...companyScope(req), ...(await scope(req)) };
    if (req.query.userId && req.user.role !== ROLES.EMPLOYEE) {
      where.userId = parseInt(req.query.userId, 10);
    }
    if (req.query.month) {
      const [year, month] = req.query.month.split("-").map(Number);
      where.date = {
        [Op.between]: [`${req.query.month}-01`, new Date(Date.UTC(year, month, 0)).toISOString().slice(0, 10)],
      };
    }

    const [byStatus, totals] = await Promise.all([
      Attendance.findAll({
        where,
        attributes: ["status", [fn("COUNT", col("id")), "count"]],
        group: ["status"],
        raw: true,
      }),
      Attendance.findOne({
        where,
        attributes: [
          [fn("COUNT", col("id")), "days"],
          [fn("COALESCE", fn("SUM", col("working_hours")), 0), "totalHours"],
        ],
        raw: true,
      }),
    ]);

    const counts = Object.fromEntries(STATUSES.map((s) => [s, 0]));
    for (const row of byStatus) counts[row.status] = Number(row.count);

    return res.status(200).json({
      message: "success",
      data: {
        daysMarked: Number(totals.days || 0),
        totalHours: Number(totals.totalHours || 0),
        ...counts,
      },
    });
  } catch (error) {
    console.error("[attendance] getSummary error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/attendance/:id/override - manager or admin correction. The reason
 * is mandatory and the record is flagged, so a hand-edited day stays
 * distinguishable from one the employee marked themselves.
 */
exports.overrideAttendance = async (req, res) => {
  try {
    const { status, reason, checkInTime, checkOutTime, workingHours } = req.body;

    if (!reason || !String(reason).trim()) {
      return res.status(400).json({ message: "reason is required for a manual override" });
    }
    if (status && !STATUSES.includes(String(status).toUpperCase())) {
      return res.status(400).json({ message: `status must be one of: ${STATUSES.join(", ")}` });
    }

    const attendance = await Attendance.findByPk(req.params.id);
    if (!attendance || !belongsToScope(req, attendance)) {
      return res.status(404).json({ message: "Attendance record not found" });
    }

    const before = { ...attendance.get({ plain: true }) };

    let effectiveHours = workingHours !== undefined && workingHours !== null && workingHours !== "" ? Number(workingHours) : undefined;
    const effectiveIn = checkInTime !== undefined ? checkInTime : attendance.checkInTime;
    const effectiveOut = checkOutTime !== undefined ? checkOutTime : attendance.checkOutTime;

    if (effectiveHours === undefined && effectiveIn && effectiveOut) {
      const diffMs = new Date(effectiveOut) - new Date(effectiveIn);
      if (diffMs > 0) {
        effectiveHours = Math.max(Number((diffMs / 3600000).toFixed(2)), 0);
      }
    }

    await attendance.update({
      ...(status ? { status: String(status).toUpperCase() } : {}),
      ...(checkInTime !== undefined ? { checkInTime } : {}),
      ...(checkOutTime !== undefined ? { checkOutTime } : {}),
      ...(effectiveHours !== undefined ? { workingHours: effectiveHours } : {}),
      isManualOverride: true,
      overrideReason: String(reason).trim(),
      overriddenBy: req.user.id,
    });

    await logActivity(req, {
      recordType: "Attendance",
      recordId: attendance.id,
      action: "STATUS_CHANGED",
      oldValue: { status: before.status, workingHours: before.workingHours },
      newValue: { status: attendance.status, workingHours: attendance.workingHours },
      remarks: `Manual override: ${reason}`,
      companyId: attendance.companyId,
    });

    return res.status(200).json({ message: "Attendance overridden", data: serialize(attendance) });
  } catch (error) {
    console.error("[attendance] overrideAttendance error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/attendance/manual - create a record for someone who could not
 * mark their own, e.g. a day spent at a customer site.
 */
exports.createManual = async (req, res) => {
  try {
    const { userId, date, status, reason, checkInTime, checkOutTime, workingHours } = req.body;

    if (!userId || !date || !reason) {
      return res.status(400).json({ message: "userId, date and reason are required" });
    }
    if (status && !STATUSES.includes(String(status).toUpperCase())) {
      return res.status(400).json({ message: `status must be one of: ${STATUSES.join(", ")}` });
    }

    const user = await User.findByPk(userId);
    if (!user || user.companyId !== req.user.companyId) {
      return res.status(404).json({ message: "User not found" });
    }

    const existing = await Attendance.findOne({ where: { userId, date } });
    if (existing) {
      return res.status(409).json({ message: "A record already exists for that day" });
    }

    let calculatedHours = workingHours !== undefined && workingHours !== null && workingHours !== "" ? Number(workingHours) : null;
    if (calculatedHours === null && checkInTime && checkOutTime) {
      const diffMs = new Date(checkOutTime) - new Date(checkInTime);
      if (diffMs > 0) {
        calculatedHours = Math.max(Number((diffMs / 3600000).toFixed(2)), 0);
      }
    }

    const attendance = await Attendance.create({
      companyId: req.user.companyId,
      userId,
      date,
      status: String(status || "PRESENT").toUpperCase(),
      workingHours: calculatedHours,
      checkInTime: checkInTime ?? null,
      checkOutTime: checkOutTime ?? null,
      isManualOverride: true,
      overrideReason: String(reason).trim(),
      overriddenBy: req.user.id,
    });

    await logActivity(req, {
      recordType: "Attendance",
      recordId: attendance.id,
      action: "CREATED",
      newValue: { userId, date, status: attendance.status },
      remarks: `Manual entry: ${reason}`,
      companyId: req.user.companyId,
    });

    return res.status(201).json({ message: "Attendance recorded", data: serialize(attendance) });
  } catch (error) {
    console.error("[attendance] createManual error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.distanceMeters = distanceMeters;
exports.istDateString = istDateString;
