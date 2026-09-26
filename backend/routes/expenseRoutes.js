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
router.get("/categories", getCategories);
router.get("/", getExpenses);
router.post("/", createExpense);
router.put("/:id", updateExpense);
router.delete("/:id", deleteExpense);

module.exports = router;
