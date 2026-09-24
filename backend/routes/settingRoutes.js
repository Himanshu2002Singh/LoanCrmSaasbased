const express = require("express");
const router = express.Router();
const branchController = require("../controllers/branchController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

// Office location, allowed radius, working hours and the late threshold are
// branch columns, so the settings screen reads and writes a branch.
router.get("/", isAuthenticated, branchController.getSettings);
router.put("/", isAuthenticated, requireRole(ROLES.COMPANY_ADMIN), branchController.updateSettings);

module.exports = router;
