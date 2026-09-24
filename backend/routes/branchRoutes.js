const express = require("express");
const router = express.Router();
const branchController = require("../controllers/branchController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = requireRole(ROLES.COMPANY_ADMIN);

router.use(isAuthenticated);

router.get("/", branchController.getBranches);
router.get("/:id", branchController.getBranchById);
router.post("/", canEdit, branchController.createBranch);
router.put("/:id", canEdit, branchController.updateBranch);
router.delete("/:id", canEdit, branchController.deleteBranch);

module.exports = router;
