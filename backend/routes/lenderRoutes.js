const express = require("express");
const router = express.Router();
const lenderController = require("../controllers/lenderController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = requireRole(ROLES.COMPANY_ADMIN, ROLES.OPS);

router.use(isAuthenticated);

router.get("/", lenderController.getLenders);
router.post("/", canEdit, lenderController.createLender);
router.get("/:id", lenderController.getLenderById);
router.put("/:id", canEdit, lenderController.updateLender);
router.delete("/:id", requireRole(ROLES.COMPANY_ADMIN), lenderController.deleteLender);

module.exports = router;
