const { Company } = require("../models");
const { logActivity } = require("../utils/activity");
const {
  PERMISSION_DEFINITIONS,
  DEFAULT_ROLE_PERMISSIONS,
  resolveUserPermissions,
} = require("../constants/permissions");
const { ROLES } = require("../constants/roles");

/**
 * Calculate effective permissions for all primary roles given company role overrides
 */
const buildEffectiveRolePermissions = (companyRolePermissions = {}) => {
  const roles = [ROLES.MANAGER, ROLES.OPS, ROLES.EMPLOYEE, ROLES.BANKER];
  const effective = {};

  for (const r of roles) {
    const defaultPerms = DEFAULT_ROLE_PERMISSIONS[r] || {};
    const companyOverride = companyRolePermissions[r] || {};
    effective[r] = {
      ...defaultPerms,
      ...companyOverride,
    };
  }

  // Admin always has full access
  effective[ROLES.COMPANY_ADMIN] = { ...DEFAULT_ROLE_PERMISSIONS.COMPANY_ADMIN };
  effective[ROLES.SUPERADMIN] = { ...DEFAULT_ROLE_PERMISSIONS.SUPERADMIN };

  return effective;
};

/**
 * GET /api/role-permissions
 * Returns permission definitions, default role permissions, company customized overrides, and effective permissions.
 */
exports.getRolePermissions = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "No company associated with user" });
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const companyRolePermissions = company.rolePermissions || {};
    const effective = buildEffectiveRolePermissions(companyRolePermissions);

    return res.status(200).json({
      success: true,
      definitions: PERMISSION_DEFINITIONS,
      roleDefaults: DEFAULT_ROLE_PERMISSIONS,
      companyRolePermissions: companyRolePermissions,
      effectiveRolePermissions: effective,
    });
  } catch (err) {
    console.error("[role-permissions] getRolePermissions error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

/**
 * PUT /api/role-permissions
 * Update company-wide role permissions. Only COMPANY_ADMIN can execute this.
 */
exports.updateRolePermissions = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "No company associated with user" });
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    let currentCompanyPerms = company.rolePermissions || {};
    if (typeof currentCompanyPerms === "string") {
      try {
        currentCompanyPerms = JSON.parse(currentCompanyPerms);
      } catch {
        currentCompanyPerms = {};
      }
    }

    // Support either { role: "MANAGER", permissions: { ... } } or { rolePermissions: { MANAGER: { ... }, OPS: { ... } } }
    let updatedRolePerms = { ...currentCompanyPerms };

    if (req.body.role && req.body.permissions !== undefined) {
      const targetRole = req.body.role.toUpperCase();
      if ([ROLES.COMPANY_ADMIN, ROLES.SUPERADMIN].includes(targetRole)) {
        return res.status(400).json({ message: "Admin role permissions cannot be customized" });
      }
      updatedRolePerms[targetRole] = req.body.permissions;
    } else if (req.body.rolePermissions && typeof req.body.rolePermissions === "object") {
      for (const [r, perms] of Object.entries(req.body.rolePermissions)) {
        const roleKey = r.toUpperCase();
        if ([ROLES.COMPANY_ADMIN, ROLES.SUPERADMIN].includes(roleKey)) continue;
        updatedRolePerms[roleKey] = perms;
      }
    } else {
      return res.status(400).json({ message: "Invalid payload: specify role & permissions or rolePermissions map" });
    }

    await company.update({ rolePermissions: updatedRolePerms });

    await logActivity(req, {
      recordType: "Other",
      recordId: company.id,
      action: "UPDATED",
      remarks: `Updated company role-wise permissions`,
    });

    const effective = buildEffectiveRolePermissions(updatedRolePerms);

    return res.status(200).json({
      success: true,
      message: "Role permissions saved successfully for your company",
      companyRolePermissions: updatedRolePerms,
      effectiveRolePermissions: effective,
    });
  } catch (err) {
    console.error("[role-permissions] updateRolePermissions error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};

/**
 * POST /api/role-permissions/reset
 * Reset role permissions back to default system standards.
 */
exports.resetRolePermissions = async (req, res) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "No company associated with user" });
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const targetRole = req.body.role ? req.body.role.toUpperCase() : null;
    let updatedRolePerms = company.rolePermissions || {};

    if (targetRole) {
      delete updatedRolePerms[targetRole];
    } else {
      updatedRolePerms = null;
    }

    await company.update({ rolePermissions: updatedRolePerms });

    await logActivity(req, {
      recordType: "Other",
      recordId: company.id,
      action: "UPDATED",
      remarks: targetRole
        ? `Reset ${targetRole} permissions back to system defaults`
        : `Reset all company role permissions back to system defaults`,
    });

    const effective = buildEffectiveRolePermissions(updatedRolePerms || {});

    return res.status(200).json({
      success: true,
      message: targetRole
        ? `Reset ${targetRole} permissions back to default system settings`
        : "Reset all role permissions back to default system settings",
      companyRolePermissions: updatedRolePerms || {},
      effectiveRolePermissions: effective,
    });
  } catch (err) {
    console.error("[role-permissions] resetRolePermissions error:", err);
    return res.status(500).json({ message: "Internal server error", error: err.message });
  }
};
