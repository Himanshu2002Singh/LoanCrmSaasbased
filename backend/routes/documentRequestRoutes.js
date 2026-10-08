const express = require("express");
const router = express.Router();
const controller = require("../controllers/documentRequestController");
const { isAuthenticated } = require("../middlewares/auth");

// All routes here require authentication (CRM staff)
router.use(isAuthenticated);

router.get("/config-docs", controller.getConfigDocs);
router.post("/", controller.createDocumentRequest);
router.get("/lead/:leadId", controller.getRequestsByLead);
router.patch("/:id/cancel", controller.cancelDocumentRequest);
router.post("/:id/send-email", controller.sendDocumentRequestEmail);

module.exports = router;
