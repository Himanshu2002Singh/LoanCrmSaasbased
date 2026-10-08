const express = require("express");
const router = express.Router();
const branchController = require("../controllers/branchController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.manageSettings) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "manageSettings",
    message: "Access restricted: You do not have permission to manage branches.",
  });
};

router.use(isAuthenticated);

router.get("/", branchController.getBranches);
router.get("/:id", branchController.getBranchById);
router.post("/", canEdit, branchController.createBranch);
router.put("/:id", canEdit, branchController.updateBranch);
router.delete("/:id", canEdit, branchController.deleteBranch);


module.exports = router;
