const express = require("express");
const router = express.Router();
const multer = require("multer");
const leadController = require("../controllers/leadController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const upload = multer({ storage: multer.memoryStorage() });
const canAssign = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.reassignLeads === false) {
    return res.status(403).json({
      code: "PERMISSION_DENIED",
      permission: "reassignLeads",
      message: "Access restricted: You do not have permission to reassign leads. Please contact your company administrator.",
    });
  }
  if (
    [ROLES.MANAGER, ROLES.OPS, ROLES.EMPLOYEE].includes(req.user.role) ||
    permissions.reassignLeads ||
    permissions.assignLeads ||
    permissions.manageLeads
  ) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "reassignLeads",
    message: "Access restricted: You do not have permission to reassign leads. Please contact your company administrator.",
  });
};

router.use(isAuthenticated);

// Fixed segments first, so they are not swallowed by /:id.
router.get("/sample-excel", leadController.downloadSampleExcel);
router.get("/unassigned", leadController.getUnassignedLeads);
router.get("/followups", leadController.getFollowups);
router.get("/counts", leadController.getLeadCounts);
router.post("/import", canAssign, upload.single("file"), leadController.importLeadsFromExcel);
router.post("/reassign", canAssign, leadController.reassignLeadsBulk);
router.post("/assign/:userId", canAssign, leadController.assignUnassignedLeads);

const canCreateLead = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.createLead !== undefined ? permissions.createLead : permissions.manageLeads !== false) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "createLead",
    message: "Access restricted: You do not have permission to create leads. Please contact your company administrator.",
  });
};

const canEditLead = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  
  // Sales (EMPLOYEE), Manager (MANAGER), and Operations (OPS) are all permitted to edit leads
  if ([ROLES.MANAGER, ROLES.OPS, ROLES.EMPLOYEE].includes(req.user.role)) {
    const permissions = req.permissions || {};
    if (permissions.editLead === false) {
      return res.status(403).json({
        code: "PERMISSION_DENIED",
        permission: "editLead",
        message: "Access restricted: You do not have permission to edit leads. Please contact your company administrator.",
      });
    }
    return next();
  }

  const permissions = req.permissions || {};
  if (permissions.editLead !== undefined ? permissions.editLead : permissions.manageLeads !== false) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "editLead",
    message: "Access restricted: You do not have permission to edit leads. Please contact your company administrator.",
  });
};

const canDeleteLead = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.deleteRecords || (req.user.role === ROLES.MANAGER && permissions.deleteRecords !== false)) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "deleteRecords",
    message: "Access restricted: You do not have permission to delete leads. Please contact your company administrator.",
  });
};

router.get("/", leadController.getLeads);
router.post("/", canCreateLead, leadController.createLead);
router.get("/:id", leadController.getLeadById);
router.put("/:id", canEditLead, leadController.updateLead);
router.patch("/:id", canEditLead, leadController.updateLead);
router.post("/:id/remarks", canEditLead, leadController.addLeadRemark);
router.put("/:id/status", leadController.updateLeadStatus);
router.patch("/:id/status", leadController.updateLeadStatus);
router.patch("/:id/assign", canAssign, leadController.assignLeadSingle);
router.delete("/:id", canDeleteLead, leadController.deleteLead);

module.exports = router;

