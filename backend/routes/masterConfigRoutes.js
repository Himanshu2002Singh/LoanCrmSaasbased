const express = require("express");
const router = express.Router();
const masterConfigController = require("../controllers/masterConfigController");
const { isAuthenticated } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings) return next();

  const configType = (req.params.configType || req.query.configType || req.body.configType || "").toUpperCase();
  if (configType === "LEAD_SOURCE" && permissions.manageLeadSources) return next();
  if (configType === "LOAN_PRODUCT" && permissions.manageLoanProducts) return next();
  if (configType === "LEAD_STATUS" && permissions.manageLeadStatuses) return next();

  // If modifying an existing item by ID, allow if they have any of the config permissions
  if (req.params.id && (permissions.manageLeadSources || permissions.manageLoanProducts || permissions.manageLeadStatuses)) {
    return next();
  }

  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to configure master settings. Please contact your company administrator.",
  });
};

const canDelete = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings || permissions.deleteRecords) return next();
  if (permissions.manageLeadSources || permissions.manageLoanProducts || permissions.manageLeadStatuses) return next();

  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to delete master configurations. Please contact your company administrator.",
  });
};


router.use(isAuthenticated);

router.get("/", masterConfigController.listAll);
router.get("/:configType", masterConfigController.list);
router.post("/:configType", canEdit, masterConfigController.create);
router.put("/:configType/reorder", canEdit, masterConfigController.reorder);
router.put("/:id", canEdit, masterConfigController.update);
router.delete("/:id", canDelete, masterConfigController.remove);

module.exports = router;

