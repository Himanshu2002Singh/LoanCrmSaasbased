import React from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { Building2, LayoutDashboard, LogOut, Package } from "lucide-react";

import "../screens/platform/platform.css";
import CrmLogo from "./CrmLogo";

const NAV = [
  { to: "/platform", label: "Overview", icon: LayoutDashboard, exact: true },
  { to: "/platform/companies", label: "Companies", icon: Building2 },
  { to: "/platform/plans", label: "Plans", icon: Package },
];

/**
 * Shell for the platform console. It deliberately does not reuse
 * AdminRedesignLayout: that sidebar is a company's own navigation, and an
 * operator acting across every company should never be looking at it. The amber
 * "platform" marker keeps the two consoles apart at a glance.
 */
function PlatformLayout({ children, title, subtitle, actions }) {
  const location = useLocation();
  const navigate = useNavigate();

  const name = localStorage.getItem("name") || "Super Admin";
  const email = localStorage.getItem("email") || "";

  const isActive = (item) =>
    item.exact ? location.pathname === item.to : location.pathname.startsWith(item.to);

  const logout = () => {
    localStorage.clear();
    navigate("/login", { replace: true });
  };

  return (
    <div className="cc-pl cc-pl-shell">
      <aside className="cc-pl-side">
        <div className="cc-pl-brand" style={{ padding: "16px 14px" }}>
          <CrmLogo height={34} />
        </div>

        <nav className="cc-pl-nav">
          {NAV.map((item) => {
            const Icon = item.icon;
            return (
              <Link key={item.to} to={item.to} className={isActive(item) ? "active" : ""}>
                <Icon size={17} />
                {item.label}
              </Link>
            );
          })}
        </nav>

        <div className="cc-pl-side-foot">
          <div className="cc-pl-who">
            <i>{name.charAt(0).toUpperCase()}</i>
            <div>
              {name}
              <small>{email}</small>
            </div>
          </div>
          <button type="button" className="cc-pl-logout" onClick={logout}>
            <LogOut size={15} />
            Log out
          </button>
        </div>
      </aside>

      <main className="cc-pl-main">
        <header className="cc-pl-head">
          <div>
            <h1>{title}</h1>
            {subtitle ? <p>{subtitle}</p> : null}
          </div>
          {actions ? <div className="cc-pl-row-actions">{actions}</div> : null}
        </header>
        {children}
      </main>
    </div>
  );
}

export default PlatformLayout;
