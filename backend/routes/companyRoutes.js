const express = require("express");
const router = express.Router();
const companyController = require("../controllers/companyController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

router.use(isAuthenticated);

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
