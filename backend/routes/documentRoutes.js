const express = require("express");
const router = express.Router();
const controller = require("../controllers/documentController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const upload = require("../middlewares/upload_middleware");
const { ROLES } = require("../constants/roles");

router.use(isAuthenticated);

router.post("/", upload.single("file"), controller.uploadDocument);
router.get("/", controller.listDocuments);
router.get("/:id", controller.getDocumentById);

router.patch(
  "/:id/verify",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.verifyDocument
);

router.delete(
  "/:id",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.deleteDocument
);

module.exports = router;
