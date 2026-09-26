const express = require("express");
const router = express.Router();
const controller = require("../controllers/applicationController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

router.use(isAuthenticated);

router.post(
  "/",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.createApplication
);

router.get("/stats", controller.getBankerStats);
router.get("/queries/all", controller.listAllQueries);

router.get("/", controller.listApplications);
router.get("/:id", controller.getApplicationById);

router.patch(
  "/:id",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.updateApplication
);

router.post(
  "/:id/send-to-bank",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.sendApplicationToBank
);

router.patch(
  "/:id/status",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS, ROLES.BANKER),
  controller.updateStatus
);

router.post(
  "/:id/queries",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS, ROLES.BANKER),
  controller.createBankerQuery
);

router.patch(
  "/:id/queries/:queryId/resolve",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.resolveBankerQuery
);

module.exports = router;
