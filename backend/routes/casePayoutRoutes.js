const express = require("express");
const router = express.Router();
const { isAuthenticated } = require("../middlewares/auth");
const {
  getDisbursedPayouts,
  updateCasePayoutRates,
  recordBankReceipt,
  recordPartyPayoutForCase,
  getPaymentJournal,
  getInvoiceData,
} = require("../controllers/casePayoutController");

router.get("/cases", isAuthenticated, getDisbursedPayouts);
router.put("/cases/:id", isAuthenticated, updateCasePayoutRates);
router.post("/cases/:id/bank-receipt", isAuthenticated, recordBankReceipt);
router.post("/cases/:id/party-payment", isAuthenticated, recordPartyPayoutForCase);
router.get("/cases/:id/invoice", isAuthenticated, getInvoiceData);
router.get("/journal", isAuthenticated, getPaymentJournal);

module.exports = router;
