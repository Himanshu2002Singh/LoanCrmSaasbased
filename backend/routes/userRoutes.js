const express = require("express");
const router = express.Router();
const multer = require("multer");
const userController = require("../controllers/userController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const upload = multer({ storage: multer.memoryStorage() });
const canManageUsers = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN || req.user.role === ROLES.MANAGER) return next();
  const permissions = req.permissions || {};
  if (permissions.manageUsers) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageUsers",
    message: "Access restricted: You do not have permission to manage users.",
  });
};
const adminOnly = requireRole(ROLES.COMPANY_ADMIN);


router.use(isAuthenticated);

// Fixed segments first, so they are not swallowed by /:id.
router.get("/seats", requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER), userController.getSeatUsage);
router.get("/permissions/metadata", userController.getPermissionMetadata);
router.post("/import", canManageUsers, upload.single("file"), userController.importUsersFromExcel);
router.get("/", requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS, ROLES.EMPLOYEE, ROLES.FINANCE), userController.getUsers);
router.get("/:id", requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER, ROLES.OPS, ROLES.EMPLOYEE, ROLES.FINANCE), userController.getUserById);

router.post("/", canManageUsers, userController.createUser);
router.put("/:id/permissions", adminOnly, userController.updateUserPermissions);
router.put("/:id/password", canManageUsers, userController.resetPassword);
router.put("/:id", canManageUsers, userController.updateUser);
router.delete("/:id", adminOnly, userController.deactivateUser);

module.exports = router;
