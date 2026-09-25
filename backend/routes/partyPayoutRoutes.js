const express = require("express");
const router = express.Router();
const { isAuthenticated, requirePermission } = require("../middlewares/auth");
const {
  getPartyPayoutSummary,
  getPartyLedgerDetail,
  recordPartyPayment,
  deletePartyPayment,
  searchCompanyLeads,
  linkLeadToParty,
} = require("../controllers/partyPayoutController");

router.get("/summary", isAuthenticated, requirePermission("viewConnectors"), getPartyPayoutSummary);
router.get("/leads/search", isAuthenticated, requirePermission("viewConnectors"), searchCompanyLeads);
router.get("/:partyName/ledger", isAuthenticated, requirePermission("viewConnectors"), getPartyLedgerDetail);
router.post("/:partyName/link-lead", isAuthenticated, requirePermission("manageConnectors"), linkLeadToParty);
router.post("/payments", isAuthenticated, requirePermission("manageConnectors"), recordPartyPayment);
router.delete("/payments/:id", isAuthenticated, requirePermission("manageConnectors"), deletePartyPayment);

module.exports = router;
