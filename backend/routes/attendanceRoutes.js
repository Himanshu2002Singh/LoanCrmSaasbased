const express = require("express");
const router = express.Router();
const attendanceController = require("../controllers/attendanceController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canOverride = requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER);

router.use(isAuthenticated);

router.get("/today", attendanceController.getToday);
router.get("/summary", attendanceController.getSummary);
router.post("/check-in", attendanceController.checkIn);
router.put("/check-out", attendanceController.checkOut);
router.post("/manual", canOverride, attendanceController.createManual);
router.put("/:id/override", canOverride, attendanceController.overrideAttendance);
router.get("/", attendanceController.getAttendance);

module.exports = router;
