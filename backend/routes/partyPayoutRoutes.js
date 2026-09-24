const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/auth");
const {
  getPartyPayoutSummary,
  getPartyLedgerDetail,
  recordPartyPayment,
  deletePartyPayment,
  searchCompanyLeads,
  linkLeadToParty,
} = require("../controllers/partyPayoutController");

router.get("/summary", isAuthenticated, getPartyPayoutSummary);
router.get("/leads/search", isAuthenticated, searchCompanyLeads);
router.get("/:partyName/ledger", isAuthenticated, getPartyLedgerDetail);
router.post("/:partyName/link-lead", isAuthenticated, linkLeadToParty);
router.post("/payments", isAuthenticated, recordPartyPayment);
router.delete("/payments/:id", isAuthenticated, deletePartyPayment);

module.exports = router;
