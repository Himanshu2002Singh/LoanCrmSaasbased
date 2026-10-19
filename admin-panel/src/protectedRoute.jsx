import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({
  children,
  allowedRoles = [
    "admin",
    "manager",
    "operations",
    "calling",
    "employee",
    "finance",
    "banker",
    "sales",
    "ops",
  ],
  requiredPermission = null,
}) {
  const isLogin = localStorage.getItem("isLogin");
  const employeeRole = (localStorage.getItem("employeeRole") || "").toLowerCase();
  const userRole = (localStorage.getItem("userRole") || "").toUpperCase();

  if (!isLogin) {
    return <Navigate to="/login" replace />;
  }

  // The platform console is reserved exclusively for the platform Superadmin
  const isSuperadminOnly = allowedRoles.length === 1 && allowedRoles[0] === "superadmin";
  if (isSuperadminOnly) {
    return userRole === "SUPERADMIN" ? children : <Navigate to="/" replace />;
  }

  // A super admin has no company of their own, so send them to the platform console
  if (userRole === "SUPERADMIN") {
    return <Navigate to="/platform" replace />;
  }

  const normalizedAllowedRoles = allowedRoles.map((r) => r.toLowerCase());

  // Permission Check for Company users (Company Admin has all permissions)
  const isCompanyAdmin =
    ["COMPANY_ADMIN", "SUPERADMIN"].includes(userRole) ||
    ["admin", "superadmin"].includes(employeeRole);

  const hasRoleAccess =
    isCompanyAdmin ||
    normalizedAllowedRoles.includes(employeeRole) ||
    (employeeRole === "calling" && normalizedAllowedRoles.includes("employee")) ||
    (employeeRole === "employee" && normalizedAllowedRoles.includes("calling")) ||
    (employeeRole === "operations" && normalizedAllowedRoles.includes("ops")) ||
    (employeeRole === "ops" && normalizedAllowedRoles.includes("operations"));

  if (!hasRoleAccess) {
    if (employeeRole === "finance" || userRole === "FINANCE") {
      return <Navigate to="/case-payouts" replace />;
    }
    if (employeeRole === "operations" || employeeRole === "ops") {
      return <Navigate to="/operations" replace />;
    }
    if (employeeRole === "banker") {
      return <Navigate to="/banker" replace />;
    }
    if (["calling", "employee"].includes(employeeRole) || userRole === "EMPLOYEE") {
      return <Navigate to="/leads" replace />;
    }
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  if (requiredPermission && !isCompanyAdmin) {
    let permissions = {};
    try {
      permissions = JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch (e) {
      permissions = {};
    }

    const isConfidential = [
      "viewPayouts",
      "managePayouts",
      "viewConnectors",
      "manageConnectors",
    ].includes(requiredPermission);

    let hasPermission = false;
    if (requiredPermission === "viewExpenses") {
      // Expense by Employees is universal for all staff roles
      hasPermission = true;
    } else if (permissions[requiredPermission] === true) {
      hasPermission = true;
    } else if (permissions[requiredPermission] === false) {
      hasPermission = false;
    } else if (isConfidential) {
      hasPermission = employeeRole === "finance" || userRole === "FINANCE";
    } else {
      hasPermission = Boolean(permissions.manageSettings);
    }

    if (!hasPermission) {
      if (requiredPermission === "manageSettings") {
        return <Navigate to="/profile" replace />;
      }
      const fallbackHome =
        employeeRole === "finance" || userRole === "FINANCE"
          ? "/case-payouts"
          : employeeRole === "operations"
          ? "/operations"
          : employeeRole === "banker"
          ? "/banker"
          : employeeRole === "calling" || employeeRole === "employee" || userRole === "EMPLOYEE"
          ? "/leads"
          : "/";
      return <Navigate to={fallbackHome} replace />;
    }
  }

  return children;
}

export default ProtectedRoute;
