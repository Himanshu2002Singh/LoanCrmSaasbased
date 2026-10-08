const express = require("express");
const router = express.Router();
const branchController = require("../controllers/branchController");
const { isAuthenticated } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEditSettings = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to update settings.",
  });
};

// Office location, allowed radius, working hours and the late threshold are
// branch columns, so the settings screen reads and writes a branch.
router.get("/", isAuthenticated, branchController.getSettings);
router.put("/", isAuthenticated, canEditSettings, branchController.updateSettings);

module.exports = router;

