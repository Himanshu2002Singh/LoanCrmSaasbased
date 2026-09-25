const express = require("express");
const router = express.Router();
const rolePermissionController = require("../controllers/rolePermissionController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const adminOnly = requireRole(ROLES.COMPANY_ADMIN);

router.use(isAuthenticated);

router.get("/", rolePermissionController.getRolePermissions);
router.put("/", adminOnly, rolePermissionController.updateRolePermissions);
router.post("/reset", adminOnly, rolePermissionController.resetRolePermissions);

module.exports = router;
