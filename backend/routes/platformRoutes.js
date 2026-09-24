const express = require("express");
const router = express.Router();
const planController = require("../controllers/planController");
const companyController = require("../controllers/companyController");
const { isAuthenticated, requireSuperAdmin } = require("../middlewares/auth");

// The platform operator's own surface: companies, plans and access. Nothing here
// belongs to any one company, so the whole router is superadmin-only.
router.use(isAuthenticated, requireSuperAdmin);

router.get("/metrics", companyController.getPlatformMetrics);

router.get("/plans", planController.getPlans);
router.post("/plans", planController.createPlan);
router.get("/plans/:id", planController.getPlanById);
router.put("/plans/:id", planController.updatePlan);
router.delete("/plans/:id", planController.deletePlan);

router.get("/companies", companyController.getCompanies);
router.post("/companies", companyController.createCompany);
router.get("/companies/:id", companyController.getCompanyById);
router.put("/companies/:id", companyController.updateCompany);
router.put("/companies/:id/status", companyController.setCompanyStatus);
router.get("/companies/:id/usage", companyController.getCompanyUsage);
router.post("/companies/:id/admins", companyController.createCompanyAdmin);

module.exports = router;
