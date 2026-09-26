/**
 * Canonical role names. These mirror the ENUM on the User model, so any change
 * here has to be made on models/User.js as well.
 */
const ROLES = {
  SUPERADMIN: "SUPERADMIN",
  COMPANY_ADMIN: "COMPANY_ADMIN",
  MANAGER: "MANAGER",
  EMPLOYEE: "EMPLOYEE",
  OPS: "OPS",
  BANKER: "BANKER",
};

const ROLE_VALUES = Object.values(ROLES);

const USER_STATUSES = {
  ACTIVE: "active",
  INACTIVE: "inactive",
  SUSPENDED: "suspended",
};

const USER_STATUS_VALUES = Object.values(USER_STATUSES);

// Roles allowed to sign in to the web admin panel / portals.
const ADMIN_PANEL_ROLES = [
  ROLES.SUPERADMIN,
  ROLES.COMPANY_ADMIN,
  ROLES.MANAGER,
  ROLES.OPS,
  ROLES.BANKER,
  ROLES.EMPLOYEE,
];

module.exports = {
  ROLES,
  ROLE_VALUES,
  USER_STATUSES,
  USER_STATUS_VALUES,
  ADMIN_PANEL_ROLES,
};
