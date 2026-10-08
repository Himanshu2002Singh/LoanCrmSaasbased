const jwt = require("jsonwebtoken");
const { User, Company, Plan } = require("../models");
const { ROLES, USER_STATUSES } = require("../constants/roles");
const { subscriptionBlock } = require("../services/provisioning");
const { resolveUserPermissions } = require("../constants/permissions");

const SECRET_KEY = process.env.SECRET_KEY || "capitalcare-dev-secret";

/**
 * Verifies the bearer token and reloads the user, so a deactivated or deleted
 * account stops working immediately instead of at token expiry.
 *
 * The company's company is loaded on the same query so a suspended or expired
 * subscription is refused here rather than at each route. Every request from
 * the admin panel and the mobile app passes through this, so cutting a company
 * off is one status change and takes effect on their next call.
 *
 * Populates:
 *   req.user        - the User instance with effectivePermissions
 *   req.permissions - effective resolved boolean permissions
 *   req.company     - their Company with its Plan, null for SUPERADMIN
 *   req.companyId   - company scope, null for SUPERADMIN acting platform-wide
 */
const isAuthenticated = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(" ")[1] || req.query.token;
    if (!token) {
      return res.status(401).json({ message: "Authorization token is required" });
    }

    let payload;
    try {
      payload = jwt.verify(token, SECRET_KEY);
    } catch (err) {
      return res.status(401).json({ message: "Invalid or expired token" });
    }

    const user = await User.findByPk(payload.id, {
      include: [
        {
          model: Company,
          as: "company",
          required: false,
          include: [{ model: Plan, as: "plan", required: false }],
        },
      ],
    });
    if (!user) {
      return res.status(401).json({ message: "Account no longer exists" });
    }
    if (user.status !== USER_STATUSES.ACTIVE) {
      return res.status(403).json({ message: "Account is not active" });
    }

    // The platform operator has no company of their own, so nothing to block.
    if (user.role !== ROLES.SUPERADMIN) {
      const blocked = subscriptionBlock(user.company);
      if (blocked) {
        return res.status(blocked.status).json({
          code: blocked.code,
          message: blocked.message,
          planStatus: blocked.planStatus,
          expiredAt: blocked.expiredAt,
        });
      }
    }

    const effectivePermissions = resolveUserPermissions(user);
    user.setDataValue("effectivePermissions", effectivePermissions);
    req.user = user;
    req.permissions = effectivePermissions;
    req.company = user.company || null;
    req.companyId = user.companyId;
    return next();
  } catch (error) {
    console.error("[auth] isAuthenticated error:", error);
    return res.status(500).json({ message: "Internal Server Error" });
  }
};

/**
 * Permission-based access control. Usage: requirePermission("viewPayouts")
 * SUPERADMIN and COMPANY_ADMIN bypass every check.
 */
const requirePermission = (permissionKey) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) {
    return next();
  }
  const permissions = req.permissions || resolveUserPermissions(req.user);
  if (permissions && permissions[permissionKey]) {
    return next();
  }
  return res.status(403).json({
    code: "PERMISSION_DENIED",
    permission: permissionKey,
    message: `Access restricted: You do not have '${permissionKey}' permission. Please contact your company administrator.`,
  });
};

/**
 * Module + action RBAC. Usage: requireRole(ROLES.COMPANY_ADMIN, ROLES.MANAGER)
 * SUPERADMIN passes every check.
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ message: "Authentication required" });
  }
  if (req.user.role === ROLES.SUPERADMIN) return next();
  if (!roles.includes(req.user.role)) {
    return res.status(403).json({ message: "You do not have access to this resource" });
  }
  return next();
};

/**
 * Plan feature gating. Usage: requirePlanFeature("ops")
 *
 * Reads the flag off the company's plan (plans.features_json), so a module the
 * customer has not bought answers 402 rather than quietly working. A company on
 * no plan at all is treated as having no paid features.
 */
const requirePlanFeature = (feature) => (req, res, next) => {
  if (req.user?.role === ROLES.SUPERADMIN) return next();

  const features = req.company?.plan?.featuresJson || {};
  if (features[feature]) return next();

  return res.status(402).json({
    code: "FEATURE_NOT_IN_PLAN",
    feature,
    message: `Your plan does not include ${feature}. Contact your account manager to upgrade.`,
  });
};

const requireSuperAdmin = (req, res, next) => {
  if (req.user?.role !== ROLES.SUPERADMIN) {
    return res.status(403).json({ message: "Platform administrator access required" });
  }
  return next();
};

/**
 * Row-level company scope. Returns the `where` fragment a controller must spread
 * into every query: SUPERADMIN may read across companies (optionally narrowed
 * with ?companyId=), everyone else is pinned to their own.
 */
const companyScope = (req) => {
  if (req.user?.role === ROLES.SUPERADMIN) {
    const requested = parseInt(req.query.companyId, 10);
    return Number.isNaN(requested) ? {} : { companyId: requested };
  }
  return { companyId: req.user.companyId };
};

/**
 * Guards a record fetched by id against cross-company access.
 */
const belongsToScope = (req, record) => {
  if (!record) return false;
  if (req.user?.role === ROLES.SUPERADMIN) return true;
  return record.companyId === req.user.companyId;
};

module.exports = {
  isAuthenticated,
  authenticateToken: isAuthenticated,
  requireRole,
  requirePermission,
  requireSuperAdmin,
  requirePlanFeature,
  companyScope,
  belongsToScope,
  SECRET_KEY,
};
