const express = require("express");
const router = express.Router();
const { isAuthenticated, requirePermission } = require("../middlewares/auth");
const {
  getDisbursedPayouts,
  createCasePayout,
  updateCasePayoutRates,
  recordBankReceipt,
  recordPartyPayoutForCase,
  getPaymentJournal,
  getInvoiceData,
  updateGstrStatus,
  getCasePaymentHistory,
} = require("../controllers/casePayoutController");

router.get("/cases", isAuthenticated, requirePermission("viewPayouts"), getDisbursedPayouts);
router.post("/cases", isAuthenticated, requirePermission("managePayouts"), createCasePayout);
router.put("/cases/:id", isAuthenticated, requirePermission("managePayouts"), updateCasePayoutRates);
router.put("/cases/:id/gstr-status", isAuthenticated, requirePermission("managePayouts"), updateGstrStatus);
router.post("/cases/:id/bank-receipt", isAuthenticated, requirePermission("managePayouts"), recordBankReceipt);
router.post("/cases/:id/party-payment", isAuthenticated, requirePermission("managePayouts"), recordPartyPayoutForCase);
router.get("/cases/:id/invoice", isAuthenticated, requirePermission("viewPayouts"), getInvoiceData);
router.get("/cases/:id/payment-history", isAuthenticated, requirePermission("viewPayouts"), getCasePaymentHistory);
router.get("/journal", isAuthenticated, requirePermission("viewPayouts"), getPaymentJournal);

module.exports = router;
