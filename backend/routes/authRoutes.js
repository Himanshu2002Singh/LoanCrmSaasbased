const express = require("express");
const router = express.Router();
const authController = require("../controllers/authController");
const { isAuthenticated } = require("../middlewares/auth");

router.post("/login", authController.login);
router.get("/me", isAuthenticated, authController.me);
router.put("/profile", isAuthenticated, authController.updateProfile);
router.put("/password", isAuthenticated, authController.changePassword);
router.delete("/delete-account", isAuthenticated, authController.deleteAccount);

module.exports = router;
