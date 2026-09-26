const express = require("express");
const router = express.Router();
const controller = require("../controllers/emailTemplateController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

router.use(isAuthenticated);

router.get("/", controller.getEmailTemplates);

// SMTP / Gmail configuration routes
router.get("/smtp/config", controller.getSmtpConfig);
router.put(
  "/smtp/config",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.updateSmtpConfig
);
router.post(
  "/smtp/test",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.testSmtpConfig
);

router.get("/:id", controller.getEmailTemplateById);

router.post(
  "/",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.createEmailTemplate
);

router.put(
  "/:id",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.updateEmailTemplate
);

router.delete(
  "/:id",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.deleteEmailTemplate
);

module.exports = router;
