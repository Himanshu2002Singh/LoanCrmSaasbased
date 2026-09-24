const express = require("express");
const router = express.Router();
const controller = require("../controllers/notificationController");
const { isAuthenticated } = require("../middlewares/auth");

router.use(isAuthenticated);

router.get("/", controller.getMyNotifications);
router.patch("/read-all", controller.markAllAsRead);
router.patch("/:id/read", controller.markAsRead);
router.delete("/:id", controller.deleteNotification);

module.exports = router;
