const express = require("express");
const router = express.Router();
const noteController = require("../controllers/noteController");
const { isAuthenticated } = require("../middlewares/auth");

router.use(isAuthenticated);

router.get("/", noteController.getNotes);
router.get("/my-leads", noteController.getMyAssignableLeads);
router.post("/", noteController.createNote);
router.put("/:id", noteController.updateNote);
router.delete("/:id", noteController.deleteNote);

module.exports = router;
