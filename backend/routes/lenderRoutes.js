const express = require("express");
const router = express.Router();
const lenderController = require("../controllers/lenderController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canView = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.OPS, ROLES.MANAGER, ROLES.BANKER].includes(req.user.role)) {
    return next();
  }
  const permissions = req.permissions || {};
  if (permissions.viewLenders !== false && (permissions.viewLenders || permissions.manageSettings)) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "viewLenders",
    message: "Access restricted: You do not have permission to view lenders.",
  });
};

const canCreate = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN].includes(req.user.role)) return next();
  const permissions = req.permissions || {};
  if (permissions.createLender === false) {
    return res.status(403).json({
      code: "PERMISSION_DENIED",
      permission: "createLender",
      message: "Access restricted: You do not have permission to add lenders.",
    });
  }
  if (permissions.createLender || permissions.manageSettings || [ROLES.OPS, ROLES.MANAGER].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "createLender",
    message: "Access restricted: You do not have permission to add lenders.",
  });
};

const canEdit = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN].includes(req.user.role)) return next();
  const permissions = req.permissions || {};
  if (permissions.editLender === false) {
    return res.status(403).json({
      code: "PERMISSION_DENIED",
      permission: "editLender",
      message: "Access restricted: You do not have permission to edit lenders.",
    });
  }
  if (permissions.editLender || permissions.manageSettings || [ROLES.OPS, ROLES.MANAGER].includes(req.user.role)) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "editLender",
    message: "Access restricted: You do not have permission to edit lenders.",
  });
};

const canDelete = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings || permissions.deleteRecords) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to delete lenders.",
  });
};

router.use(isAuthenticated);

router.get("/", canView, lenderController.getLenders);
router.post("/", canCreate, lenderController.createLender);
router.get("/:id", canView, lenderController.getLenderById);
router.put("/:id", canEdit, lenderController.updateLender);
router.delete("/:id", canDelete, lenderController.deleteLender);


module.exports = router;
