const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");
const { uploadLogo } = require("../middlewares/upload_middleware");

router.use(isAuthenticated);

router.post(
  "/upload-logo",
  requireRole(ROLES.COMPANY_ADMIN),
  uploadLogo.single("logo"),
  companyController.uploadLogo
);

// Company & Subscription Profile for the logged-in tenant
router.get(
  "/profile",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  companyController.getMyCompanyProfile
);

router.put(
  "/profile",
  requireRole(ROLES.COMPANY_ADMIN),
  companyController.updateMyCompanyProfile
);

module.exports = router;
