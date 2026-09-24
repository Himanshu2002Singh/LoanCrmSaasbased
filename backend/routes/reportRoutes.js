const express = require("express");
const router = express.Router();
const reportController = require("../controllers/reportController");
const { isAuthenticated } = require("../middlewares/auth");

router.use(isAuthenticated);

router.get("/dashboard", reportController.getDashboard);
router.get("/leads", reportController.getLeadReport);
router.get("/performance", reportController.getPerformance);

module.exports = router;
