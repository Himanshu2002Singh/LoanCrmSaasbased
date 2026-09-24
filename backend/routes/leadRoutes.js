const express = require("express");
const router = express.Router();
const multer = require("multer");
const leadController = require("../controllers/leadController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const upload = multer({ storage: multer.memoryStorage() });
const canAssign = requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER);

router.use(isAuthenticated);

// Fixed segments first, so they are not swallowed by /:id.
router.get("/unassigned", leadController.getUnassignedLeads);
router.get("/followups", leadController.getFollowups);
router.get("/counts", leadController.getLeadCounts);
router.post("/import", canAssign, upload.single("file"), leadController.importLeadsFromExcel);
router.post("/reassign", canAssign, leadController.reassignLeadsBulk);
router.post("/assign/:userId", canAssign, leadController.assignUnassignedLeads);

router.get("/", leadController.getLeads);
router.post("/", leadController.createLead);
router.get("/:id", leadController.getLeadById);
router.put("/:id", leadController.updateLead);
router.put("/:id/status", leadController.updateLeadStatus);
router.delete("/:id", requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER), leadController.deleteLead);

module.exports = router;
