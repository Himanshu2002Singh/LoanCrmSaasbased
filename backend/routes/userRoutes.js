const express = require("express");
const router = express.Router();
const multer = require("multer");
const userController = require("../controllers/userController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const upload = multer({ storage: multer.memoryStorage() });
const canManageUsers = requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER);
const adminOnly = requireRole(ROLES.COMPANY_ADMIN);

router.use(isAuthenticated);

// Fixed segments first, so they are not swallowed by /:id.
router.get("/seats", requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER), userController.getSeatUsage);
router.post("/import", canManageUsers, upload.single("file"), userController.importUsersFromExcel);
router.get("/", requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS), userController.getUsers);
router.get("/:id", requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS), userController.getUserById);

router.post("/", canManageUsers, userController.createUser);
router.put("/:id", canManageUsers, userController.updateUser);
router.put("/:id/password", canManageUsers, userController.resetPassword);
router.delete("/:id", adminOnly, userController.deactivateUser);

module.exports = router;
