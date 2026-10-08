const express = require("express");
const router = express.Router();
const leadStatusController = require("../controllers/leadStatusController");
const { isAuthenticated } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.manageLeadStatuses || permissions.manageSettings) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageLeadStatuses",
    message: "Access restricted: You do not have permission to manage lead statuses. Please contact your company administrator.",
  });
};

const canDelete = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.manageLeadStatuses || permissions.manageSettings || permissions.deleteRecords) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageLeadStatuses",
    message: "Access restricted: You do not have permission to delete lead statuses. Please contact your company administrator.",
  });
};

router.use(isAuthenticated);

router.get("/", leadStatusController.getLeadStatuses);
router.post("/", canEdit, leadStatusController.createLeadStatus);
router.put("/:id", canEdit, leadStatusController.updateLeadStatus);
router.delete("/:id", canDelete, leadStatusController.deleteLeadStatus);

module.exports = router;

