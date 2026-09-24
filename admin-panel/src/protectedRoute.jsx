import React from 'react';
import { Navigate } from 'react-router-dom';

function ProtectedRoute({ children, allowedRoles = ["manager", "operations"] }) {
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
    if (employeeRole === "operations") {
      return <Navigate to="/operations" replace />;
    }
    if (employeeRole === "banker") {
      return <Navigate to="/banker" replace />;
    }
    localStorage.clear();
    return <Navigate to="/login" replace />;
  }

  return children;
}

export default ProtectedRoute;
