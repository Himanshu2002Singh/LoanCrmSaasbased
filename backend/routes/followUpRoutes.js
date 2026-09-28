const express = require("express");
const router = express.Router();
const followUpController = require("../controllers/followUpController");
const { isAuthenticated } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

router.use(isAuthenticated);

const canFollowupLead = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.followupLead !== undefined ? permissions.followupLead : permissions.manageLeads !== false) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "followupLead",
    message: "Access restricted: You do not have permission to manage lead follow-ups. Please contact your company administrator.",
  });
};

router.get("/", followUpController.getFollowUps);
router.post("/", canFollowupLead, followUpController.createFollowUp);
router.put("/:id", canFollowupLead, followUpController.updateFollowUp);
router.delete("/:id", followUpController.deleteFollowUp);

module.exports = router;
