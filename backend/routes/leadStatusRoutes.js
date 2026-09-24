const express = require("express");
const router = express.Router();
const leadStatusController = require("../controllers/leadStatusController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = requireRole(ROLES.COMPANY_ADMIN);

router.use(isAuthenticated);

router.get("/", leadStatusController.getLeadStatuses);
router.post("/", canEdit, leadStatusController.createLeadStatus);
router.put("/:id", canEdit, leadStatusController.updateLeadStatus);
router.delete("/:id", canEdit, leadStatusController.deleteLeadStatus);

module.exports = router;
