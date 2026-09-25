const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { isAuthenticated, requirePermission } = require("../middlewares/auth");

router.use(isAuthenticated);

router.get("/dashboard", reportController.getDashboard);
router.get("/leads", requirePermission("viewReports"), reportController.getLeadReport);
router.get("/performance", requirePermission("viewReports"), reportController.getPerformance);

module.exports = router;
