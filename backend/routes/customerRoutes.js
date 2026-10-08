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
const canDeleteCustomer = (req, res, next) => {
  if (!req.user) return res.status(401).json({ message: "Authentication required" });
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) return next();
  const permissions = req.permissions || {};
  if (permissions.deleteRecords) return next();
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: "deleteRecords",
    message: "Access restricted: You do not have permission to delete customer records.",
  });
};

router.delete("/:id", canDeleteCustomer, customerController.deleteCustomer);


module.exports = router;
