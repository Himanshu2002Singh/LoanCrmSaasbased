const express = require("express");
const router = express.Router();
const controller = require("../controllers/applicationController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

router.use(isAuthenticated);

const canCreateApplication = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (
    permissions.createLoanApplication ||
    permissions.createApplication ||
    permissions.manageOperations
  ) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "createLoanApplication",
    message: "Access restricted: You do not have permission to create loan applications. Please contact your company administrator.",
  });
};

router.post(
  "/",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  canCreateApplication,
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

router.get("/:id/history", controller.getApplicationHistory);

router.put(
  "/:id/stage-status",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS, ROLES.BANKER),
  controller.updateStageStatus
);

router.patch(
  "/:id/stage-status",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS, ROLES.BANKER),
  controller.updateStageStatus
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
