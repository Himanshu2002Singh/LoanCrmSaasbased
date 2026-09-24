const express = require("express");
const router = express.Router();
const customerController = require("../controllers/customerController");
const { isAuthenticated, requireRole } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

router.use(isAuthenticated);

router.get("/", customerController.getCustomers);
router.get("/by-mobile/:mobile", customerController.getCustomerByMobile);
router.get("/:id", customerController.getCustomerById);
router.post("/", customerController.createCustomer);
router.put("/:id", customerController.updateCustomer);
router.delete("/:id", requireRole(ROLES.COMPANY_ADMIN), customerController.deleteCustomer);

module.exports = router;
