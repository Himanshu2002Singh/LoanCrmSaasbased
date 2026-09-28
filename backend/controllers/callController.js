const { Op, fn, col } = require("sequelize");
const { CallLog, Lead, Customer, User } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity } = require("../utils/activity");
const { parseScheduledDate, syncLeadFollowUp } = require("../utils/followUpSync");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { visibilityScope, dateRangeWhere } = require("./leadController");
const { ROLES } = require("../constants/roles");

/**
 * Outcomes a call can end on. Free text is rejected so the calling reports
 * stay countable.
 */
const CALL_STATUSES = [
  "CONNECTED",
  "NOT_CONNECTED",
  "BUSY",
  "SWITCHED_OFF",
  "INVALID_NUMBER",
  "CALL_BACK_LATER",
  "INTERESTED",
  "NOT_INTERESTED",
];

const SORTABLE = ["createdAt", "durationSec", "callStatus"];

const CALL_INCLUDES = [
  {
    model: Lead,
    as: "lead",
    required: false,
    include: [{ model: Customer, as: "customer", attributes: ["id", "name", "mobile"] }],
  },
  { model: User, as: "user", attributes: ["id", "name", "role"], required: false },
];

const serializeCall = (call) => ({
  call_id: call.id,
  id: call.id,
  lead_id: call.leadId,
  emp_id: call.userId,
  caller: call.user?.name || null,
  customer_name: call.lead?.customer?.name || null,
  customer_number: call.lead?.customer?.mobile || null,
  call_status: call.callStatus,
  duration: call.durationSec,
  remarks: call.remarks,
  recording_url: call.recordingUrl,
  createdAt: call.createdAt,
});

/**
 * A caller may only see their own calls; managers see their team's, and admins
 * and ops see everything. Scoping happens on the call's own user_id, which is
 * simpler than reaching through the lead.
 */
const callScope = async (req) => {
  if (req.user.role === ROLES.EMPLOYEE) return { userId: req.user.id };
  if (req.user.role === ROLES.MANAGER) {
    const subordinates = await User.findAll({
      where: { companyId: req.user.companyId, managerId: req.user.id },
      attributes: ["id"],
      raw: true,
    });
    const teamIds = [req.user.id, ...subordinates.map((u) => u.id)];
    return { userId: { [Op.in]: teamIds } };
  }
  return {};
};

/**
 * POST /api/calls
 */
exports.createCall = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    const body = req.body;

    const leadId = body.lead_id ?? body.leadId ?? null;
    let lead = null;
    if (leadId) {
      lead = await Lead.findByPk(leadId);
      if (!lead || !belongsToScope(req, lead)) {
        return res.status(404).json({ message: "Lead not found" });
      }
    }

    const callStatus = String(body.call_status || body.callStatus || "").toUpperCase();
    if (!CALL_STATUSES.includes(callStatus)) {
      return res.status(400).json({ message: `call_status must be one of: ${CALL_STATUSES.join(", ")}` });
    }

    const duration = parseInt(body.duration ?? body.durationSec, 10);
    if (duration !== undefined && !Number.isNaN(duration) && duration < 0) {
      return res.status(400).json({ message: "duration cannot be negative" });
    }

    const call = await CallLog.create({
      companyId,
      leadId: lead?.id ?? null,
      userId: body.emp_id ?? body.userId ?? req.user.id,
      callStatus,
      durationSec: Number.isNaN(duration) ? 0 : duration,
      remarks: body.remarks ?? body.remark ?? null,
      recordingUrl: body.recording_url ?? body.recordingUrl ?? null,
    });

    // A call almost always moves the follow-up date; write it through in the
    // same request so the lead list stays truthful.
    const rawMeeting = body.next_meeting ?? body.nextFollowupDate ?? body.nextMeetingDate ?? body.meetingDate ?? body.meeting_date;
    if (lead && rawMeeting) {
      let combinedMeeting = rawMeeting;
      const rawTime = body.meetingTime ?? body.meeting_time ?? body.nextMeetingTime;
      if (rawTime && typeof rawMeeting === "string" && rawMeeting.length === 10) {
        combinedMeeting = `${rawMeeting}T${rawTime.length === 5 ? rawTime + ":00" : rawTime}`;
      }
      const nextDate = parseScheduledDate(combinedMeeting);
      await lead.update({ nextFollowupDate: nextDate });
      await syncLeadFollowUp({
        leadId: lead.id,
        companyId,
        nextDate,
        userId: body.emp_id ?? body.userId ?? req.user.id,
        remarks: body.remarks ?? body.remark ?? "Follow-up scheduled after call",
        reqUser: req.user,
      });
    }

    if (lead) {
      await logActivity(req, {
        recordType: "Lead",
        recordId: lead.id,
        action: "UPDATED",
        newValue: { callStatus, durationSec: call.durationSec },
        remarks: call.remarks,
        companyId,
      });
    }

    const created = await CallLog.findByPk(call.id, { include: CALL_INCLUDES });
    return res.status(201).json({ message: "Call logged", data: serializeCall(created) });
  } catch (error) {
    console.error("[calls] createCall error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/calls
 * ?page&limit&sortBy&sortDir&leadId&userId&callStatus&fromDate&toDate
 */
exports.getCalls = async (req, res) => {
  try {
    const { limit, offset, order, page, search } = buildQuery(req.query, {
      sortable: SORTABLE,
      defaultSort: ["createdAt", "DESC"],
    });

    const where = {
      ...companyScope(req),
      ...(await callScope(req)),
      ...dateRangeWhere(req.query.fromDate, req.query.toDate),
    };

    if (req.query.leadId) where.leadId = parseInt(req.query.leadId, 10);
    if (req.query.userId && req.user.role !== ROLES.EMPLOYEE) {
      where.userId = parseInt(req.query.userId, 10);
    }
    if (req.query.callStatus) where.callStatus = String(req.query.callStatus).toUpperCase();
    if (search) where.remarks = { [Op.like]: `%${search}%` };

    const { count, rows } = await CallLog.findAndCountAll({
      where,
      include: CALL_INCLUDES,
      limit,
      offset,
      order,
      distinct: true,
    });

    const payload = paginated({ count, rows: rows.map(serializeCall), page, limit });
    payload.pagination.totalItems = count;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[calls] getCalls error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/calls/:id
 */
exports.getCallById = async (req, res) => {
  try {
    const call = await CallLog.findByPk(req.params.id, { include: CALL_INCLUDES });
    if (!call || !belongsToScope(req, call)) {
      return res.status(404).json({ message: "Call not found" });
    }
    if (req.user.role === ROLES.EMPLOYEE && call.userId !== req.user.id) {
      return res.status(404).json({ message: "Call not found" });
    }
    return res.status(200).json({ message: "success", data: serializeCall(call) });
  } catch (error) {
    console.error("[calls] getCallById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/calls/:id - only the remark, outcome, duration and recording may be
 * corrected; who called and when are fixed.
 */
exports.updateCall = async (req, res) => {
  try {
    const call = await CallLog.findByPk(req.params.id);
    if (!call || !belongsToScope(req, call)) {
      return res.status(404).json({ message: "Call not found" });
    }
    if (req.user.role === ROLES.EMPLOYEE && call.userId !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own calls" });
    }

    const data = {};
    if (req.body.call_status || req.body.callStatus) {
      const next = String(req.body.call_status || req.body.callStatus).toUpperCase();
      if (!CALL_STATUSES.includes(next)) {
        return res.status(400).json({ message: `call_status must be one of: ${CALL_STATUSES.join(", ")}` });
      }
      data.callStatus = next;
    }
    if (req.body.remarks !== undefined) data.remarks = req.body.remarks;
    if (req.body.duration !== undefined) data.durationSec = parseInt(req.body.duration, 10) || 0;
    if (req.body.recording_url !== undefined) data.recordingUrl = req.body.recording_url;

    await call.update(data);
    const updated = await CallLog.findByPk(call.id, { include: CALL_INCLUDES });
    return res.status(200).json({ message: "Call updated", data: serializeCall(updated) });
  } catch (error) {
    console.error("[calls] updateCall error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/calls/stats - calling summary for the dashboards.
 */
exports.getCallStats = async (req, res) => {
  try {
    const where = {
      ...companyScope(req),
      ...(await callScope(req)),
      ...dateRangeWhere(req.query.fromDate, req.query.toDate),
    };
    if (req.query.userId && req.user.role !== ROLES.EMPLOYEE) {
      where.userId = parseInt(req.query.userId, 10);
    }

    const [byStatus, totals] = await Promise.all([
      CallLog.findAll({
        where,
        attributes: ["callStatus", [fn("COUNT", col("id")), "count"]],
        group: ["callStatus"],
        raw: true,
      }),
      CallLog.findOne({
        where,
        attributes: [
          [fn("COUNT", col("id")), "totalCalls"],
          [fn("COALESCE", fn("SUM", col("duration_sec")), 0), "totalDuration"],
          [fn("COALESCE", fn("AVG", col("duration_sec")), 0), "avgDuration"],
        ],
        raw: true,
      }),
    ]);

    const counts = Object.fromEntries(CALL_STATUSES.map((s) => [s, 0]));
    for (const row of byStatus) counts[row.callStatus] = Number(row.count);

    return res.status(200).json({
      message: "success",
      data: {
        totalCalls: Number(totals.totalCalls || 0),
        totalDurationSec: Number(totals.totalDuration || 0),
        avgDurationSec: Math.round(Number(totals.avgDuration || 0)),
        connected: counts.CONNECTED,
        byStatus: counts,
      },
    });
  } catch (error) {
    console.error("[calls] getCallStats error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

exports.CALL_STATUSES = CALL_STATUSES;
exports.callScope = callScope;
