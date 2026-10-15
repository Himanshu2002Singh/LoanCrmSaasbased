const express = require("express");
const router = express.Router();
const docReqController = require("../controllers/documentRequestController");
const docController = require("../controllers/documentController");
const upload = require("../middlewares/upload_middleware");

/**
 * Public Routes - No JWT Authentication Required
 * Allows customers, banks, and applicants to securely view and download documents
 */
router.get("/document-requests/:token", docReqController.getPublicRequest);
router.post(
  "/document-requests/:token/upload",
  upload.any(),
  docReqController.publicUploadDocument
);
router.post(
  "/document-requests/:token/submit-notes",
  docReqController.publicSubmitNotes
);
router.get(
  "/document-requests/:token/download-all",
  docReqController.publicDownloadRequestZip
);
router.get(
  "/document-requests/:token/documents/:docId/download",
  docReqController.publicDownloadRequestedDoc
);
router.delete(
  "/document-requests/:token/documents/:docId",
  docReqController.publicDeleteRequestedDoc
);

// Public document download & view endpoints (Used in Bank RM emails and public portals)
router.get("/documents/:id/download", docController.downloadDocument);
router.get("/documents/:id/view", docController.viewDocument);
router.get("/documents/lead/:leadId/download-all", docController.downloadAllLeadDocuments);
router.get("/documents/application/:applicationId/download-all", docController.downloadAllApplicationDocuments);

// Google Play Store Account Deletion Request Endpoint
router.post("/account-deletion-request", (req, res) => {
  const { name, phone, email, company, reason } = req.body || {};
  console.log(
    `[ACCOUNT DELETION REQUEST] Time: ${new Date().toISOString()} | Name: ${name} | Phone: ${phone} | Email: ${email} | Company: ${company} | Reason: ${reason}`
  );

  return res.status(200).json({
    success: true,
    message:
      "Your account deletion request has been registered successfully. Your account and associated data will be permanently deleted within 48 hours.",
    eta: "48 hours",
    submittedAt: new Date().toISOString(),
  });
});

module.exports = router;
