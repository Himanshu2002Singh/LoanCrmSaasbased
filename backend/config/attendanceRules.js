/**
 * Attendance timing rules.
 *
 * The branches table carries the office coordinates and the allowed radius, so
 * geofencing reads from the branch. It carries no working hours, which is why
 * the late cutoff and the half-day threshold are process configuration here
 * rather than per-branch data. Changing them is a deploy, not an admin edit,
 * and every branch in the deployment shares them.
 */
const WORK_START_TIME = process.env.WORK_START_TIME || "10:00";
const WORK_END_TIME = process.env.WORK_END_TIME || "19:00";
const LATE_THRESHOLD_MINUTES = parseInt(process.env.LATE_THRESHOLD_MINUTES || "10", 10);
const HALF_DAY_HOURS = parseFloat(process.env.HALF_DAY_HOURS || "4");

const parseMinutes = (hhmm) => {
  const [hours, minutes] = String(hhmm).split(":").map(Number);
  return hours * 60 + (minutes || 0);
};

const workStartMinutes = () => parseMinutes(WORK_START_TIME);
const lateCutoffMinutes = () => workStartMinutes() + LATE_THRESHOLD_MINUTES;

module.exports = {
  WORK_START_TIME,
  WORK_END_TIME,
  LATE_THRESHOLD_MINUTES,
  HALF_DAY_HOURS,
  parseMinutes,
  workStartMinutes,
  lateCutoffMinutes,
};
