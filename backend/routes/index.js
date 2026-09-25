const express = require("express");
const router = express.Router();

/**
 * Single mount point for the API. app.js only does `app.use("/api", router)`,
 * so every URL prefix is decided here.
 *
 * Every module runs on models/index.js. The legacy controllers that predated
 * the schema rewrite have been replaced, so nothing here is left unmounted.
 */
router.use("/auth", require("./authRoutes"));
router.use("/platform", require("./platformRoutes"));
router.use("/users", require("./userRoutes"));
router.use("/branches", require("./branchRoutes"));
router.use("/master-configs", require("./masterConfigRoutes"));
router.use("/lead-statuses", require("./leadStatusRoutes"));
router.use("/customers", require("./customerRoutes"));
router.use("/leads", require("./leadRoutes"));
router.use("/calls", require("./callRoutes"));
router.use("/followups", require("./followUpRoutes"));
router.use("/tasks", require("./taskRoutes"));
router.use("/documents", require("./documentRoutes"));
router.use("/applications", require("./applicationRoutes"));
router.use("/attendance", require("./attendanceRoutes"));
router.use("/activity", require("./activityRoutes"));
router.use("/lenders", require("./lenderRoutes"));
router.use("/templates", require("./templateRoutes"));
router.use("/reports", require("./reportRoutes"));
router.use("/settings", require("./settingRoutes"));
router.use("/company", require("./companyRoutes"));
router.use("/notifications", require("./notificationRoutes"));
router.use("/party-payouts", require("./partyPayoutRoutes"));
router.use("/payouts", require("./casePayoutRoutes"));
router.use("/expenses", require("./expenseRoutes"));
router.use("/role-permissions", require("./rolePermissionRoutes"));

router.get("/health", (req, res) => {
  res.json({ status: "ok", uptime: process.uptime(), version: "2.0.0" });
});

module.exports = router;
