const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload_middleware");
const templateController = require("../controllers/templateController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.OPS].includes(req.user.role)) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to manage templates.",
  });
};

router.use(isAuthenticated);

router.get("/", templateController.getTemplates);
router.post("/", canEdit, (upload.uploadTemplate || upload).single("file"), templateController.createTemplate);
router.put("/:id", canEdit, templateController.updateTemplate);
router.delete("/:id", canEdit, templateController.deleteTemplate);


module.exports = router;
