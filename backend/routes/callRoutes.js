const express = require("express");
const router = express.Router();
const callController = require("../controllers/callController");
const { isAuthenticated } = require("../middlewares/auth");

router.use(isAuthenticated);

router.get("/stats", callController.getCallStats);
router.get("/", callController.getCalls);
router.post("/", callController.createCall);
router.get("/:id", callController.getCallById);
router.put("/:id", callController.updateCall);

module.exports = router;
