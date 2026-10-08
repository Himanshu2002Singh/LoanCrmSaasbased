const express = require("express");
const router = express.Router();
const controller = require("../controllers/emailTemplateController");
const { isAuthenticated } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canManageEmail = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS].includes(req.user.role)) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to manage email templates.",
  });
};

router.use(isAuthenticated);

router.get("/", controller.getEmailTemplates);

// SMTP / Gmail configuration routes
router.get("/smtp/config", controller.getSmtpConfig);
router.put("/smtp/config", canManageEmail, controller.updateSmtpConfig);
router.post("/smtp/test", canManageEmail, controller.testSmtpConfig);

router.get("/:id", controller.getEmailTemplateById);
router.post("/", canManageEmail, controller.createEmailTemplate);
router.put("/:id", canManageEmail, controller.updateEmailTemplate);
router.delete("/:id", canManageEmail, controller.deleteEmailTemplate);

module.exports = router;

