const express = require("express");
const router = express.Router();
const { isAuthenticated, requirePermission } = require("../middlewares/auth");
const {
  getPartyPayoutSummary,
  getPartyLedgerDetail,
  recordPartyPayment,
  updatePartyPayment,
  deletePartyPayment,
  bulkUploadPartyPayments,
  updateParty,
  bulkUploadParties,
  searchCompanyLeads,
  linkLeadToParty,
} = require("../controllers/partyPayoutController");

router.get("/summary", isAuthenticated, requirePermission("viewConnectors"), getPartyPayoutSummary);
router.get("/leads/search", isAuthenticated, requirePermission("viewConnectors"), searchCompanyLeads);
router.get("/:partyName/ledger", isAuthenticated, requirePermission("viewConnectors"), getPartyLedgerDetail);
router.post("/:partyName/link-lead", isAuthenticated, requirePermission("manageConnectors"), linkLeadToParty);
router.put("/parties/:id", isAuthenticated, requirePermission("manageConnectors"), updateParty);
router.post("/parties/bulk-upload", isAuthenticated, requirePermission("manageConnectors"), bulkUploadParties);
router.post("/payments", isAuthenticated, requirePermission("manageConnectors"), recordPartyPayment);
router.put("/payments/:id", isAuthenticated, requirePermission("manageConnectors"), updatePartyPayment);
router.delete("/payments/:id", isAuthenticated, requirePermission("manageConnectors"), deletePartyPayment);
router.post("/:partyName/payments/bulk-upload", isAuthenticated, requirePermission("manageConnectors"), bulkUploadPartyPayments);

module.exports = router;
