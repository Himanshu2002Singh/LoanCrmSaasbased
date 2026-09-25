const express = require("express");
const router = express.Router();
const { isAuthenticated, requirePermission } = require("../middlewares/auth");
const {
  getExpenses,
  getExpenseSummary,
  createExpense,
  updateExpense,
  deleteExpense,
  getCategories,
} = require("../controllers/expenseController");

router.use(isAuthenticated);

router.get("/summary", requirePermission("viewExpenses"), getExpenseSummary);
router.get("/categories", requirePermission("viewExpenses"), getCategories);
router.get("/", requirePermission("viewExpenses"), getExpenses);
router.post("/", requirePermission("manageExpenses"), createExpense);
router.put("/:id", requirePermission("manageExpenses"), updateExpense);
router.delete("/:id", requirePermission("manageExpenses"), deleteExpense);

module.exports = router;
