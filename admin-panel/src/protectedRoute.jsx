import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, allowedRoles = ["manager", "operations"], requiredPermission = null }) {
  const isLogin = localStorage.getItem("isLogin");
  const employeeRole = localStorage.getItem("employeeRole");
  // The platform console is keyed on the real API role, not the translated
  // panel role, because a super admin is not a company user at all.
  const userRole = localStorage.getItem("userRole");

  if (!isLogin) {
    return <Navigate to="/login" replace />;
  }

  if (allowedRoles.includes("superadmin")) {
    return userRole === "SUPERADMIN" ? children : <Navigate to="/" replace />;
  }

  // A super admin has no company of their own, so a company screen would show
  // them nothing; send them to their own console instead.
  if (userRole === "SUPERADMIN") {
    return <Navigate to="/platform" replace />;
  }

  if (!allowedRoles.includes(employeeRole)) {
    if (employeeRole === "finance" || userRole === "FINANCE") {
      return <Navigate to="/case-payouts" replace />;
    }
    if (employeeRole === "operations") {
      return <Navigate to="/operations" replace />;
    }
    if (employeeRole === "banker") {
      return <Navigate to="/banker" replace />;
    }
    if (employeeRole === "calling" || employeeRole === "employee" || userRole === "EMPLOYEE") {
      return <Navigate to="/leads" replace />;
    }
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  // Permission Check for Company users (Company Admin has all permissions)
  if (requiredPermission && userRole !== "COMPANY_ADMIN" && userRole !== "SUPERADMIN") {
    let permissions = {};
    try {
      permissions = JSON.parse(localStorage.getItem("userPermissions") || "{}");
    } catch (e) {
      permissions = {};
    }

    const hasPermission = Boolean(permissions[requiredPermission] || permissions.manageSettings);
    if (!hasPermission || (permissions[requiredPermission] === false && !permissions.manageSettings)) {
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
