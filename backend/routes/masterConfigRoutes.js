const express = require("express");
const router = express.Router();
const masterConfigController = require("../controllers/masterConfigController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const canEdit = requireRole(ROLES.COMPANY_ADMIN);

router.use(isAuthenticated);

router.get("/", masterConfigController.listAll);
router.get("/:configType", masterConfigController.list);
router.post("/:configType", canEdit, masterConfigController.create);
router.put("/:configType/reorder", canEdit, masterConfigController.reorder);
router.put("/:id", canEdit, masterConfigController.update);
router.delete("/:id", canEdit, masterConfigController.remove);

module.exports = router;
