const express = require("express");
const router = express.Router();
const controller = require("../controllers/documentRequestController");
const upload = require("../middlewares/upload_middleware");

/**
 * Public Routes - No JWT Authentication Required
 * Allows customers to securely view requested documents and upload files
 */
router.get("/document-requests/:token", controller.getPublicRequest);
router.post(
  "/document-requests/:token/upload",
  upload.single("file"),
  controller.publicUploadDocument
);
router.post(
  "/document-requests/:token/submit-notes",
  controller.publicSubmitNotes
);

module.exports = router;
