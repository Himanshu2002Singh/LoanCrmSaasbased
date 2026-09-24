const express = require("express");
const router = express.Router();
const followUpController = require("../controllers/followUpController");
const { isAuthenticated } = require("../middlewares/auth");

router.use(isAuthenticated);

router.get("/", followUpController.getFollowUps);
router.post("/", followUpController.createFollowUp);
router.put("/:id", followUpController.updateFollowUp);
router.delete("/:id", followUpController.deleteFollowUp);

module.exports = router;
