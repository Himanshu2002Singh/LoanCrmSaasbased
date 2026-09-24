const express = require("express");
const router = express.Router();
const activityController = require("../controllers/activityController");
const { isAuthenticated } = require("../middlewares/auth");

router.use(isAuthenticated);

router.get("/", activityController.getActivity);
router.get("/:recordType/:recordId", activityController.getRecordTimeline);

module.exports = router;
