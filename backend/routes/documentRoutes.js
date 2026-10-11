const express = require("express");
const router = express.Router();
const controller = require("../controllers/documentController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const upload = require("../middlewares/upload_middleware");
const { ROLES } = require("../constants/roles");

router.use(isAuthenticated);

router.post("/", upload.any(), controller.uploadDocument);
router.get("/", controller.listDocuments);
router.get("/lead/:leadId/download-all", controller.downloadAllLeadDocuments);
router.get("/application/:applicationId/download-all", controller.downloadAllApplicationDocuments);
router.get("/:id", controller.getDocumentById);
router.get("/:id/download", controller.downloadDocument);
router.get("/:id/view", controller.viewDocument);

router.patch(
  "/:id/verify",
  requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS),
  controller.verifyDocument
);

const canDeleteDocument = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if ([ROLES.SUPERADMIN, ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS].includes(req.user.role)) return next();
  const permissions = req.permissions || {};
  if (permissions.deleteRecords || permissions.manageOperations) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "deleteRecords",
    message: "Access restricted: You do not have permission to delete documents.",
  });
};

router.delete(
  "/:id",
  canDeleteDocument,
  controller.deleteDocument
);


module.exports = router;
