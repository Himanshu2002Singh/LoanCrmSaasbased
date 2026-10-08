const express = require("express");
const router = express.Router();
const lenderController = require("../controllers/lenderController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.OPS].includes(req.user.role)) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to manage lenders.",
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

router.get("/", lenderController.getLenders);
router.post("/", canEdit, lenderController.createLender);
router.get("/:id", lenderController.getLenderById);
router.put("/:id", canEdit, lenderController.updateLender);
router.delete("/:id", canDelete, lenderController.deleteLender);


module.exports = router;
