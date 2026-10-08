const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");
const { uploadLogo } = require("../middlewares/upload_middleware");

router.use(isAuthenticated);

const canManageCompany = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to modify company settings.",
  });
};

router.post(
  "/upload-logo",
  canManageCompany,
  uploadLogo.single("logo"),
  companyController.uploadLogo
);

// Company & Subscription Profile for the logged-in tenant
router.get(
  "/profile",
  companyController.getMyCompanyProfile
);

router.put(
  "/profile",
  canManageCompany,
  companyController.updateMyCompanyProfile
);


module.exports = router;
