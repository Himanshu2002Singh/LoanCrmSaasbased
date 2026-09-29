const express = require("express");
const router = express.Router();
const upload = require("../middlewares/upload_middleware");
const templateController = require("../controllers/templateController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = requireRole(ROLES.COMPANY_ADMIN, ROLES.OPS);

router.use(isAuthenticated);

router.get("/", templateController.getTemplates);
router.post("/", canEdit, (upload.uploadTemplate || upload).single("file"), templateController.createTemplate);
router.put("/:id", canEdit, templateController.updateTemplate);
router.delete("/:id", canEdit, templateController.deleteTemplate);

module.exports = router;
