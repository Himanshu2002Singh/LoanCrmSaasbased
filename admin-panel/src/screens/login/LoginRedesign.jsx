import React, { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router-dom";
import {
  AlertTriangle,
  ArrowRight,
  Eye,
  EyeOff,
  LockKeyhole,
  ShieldCheck,
  UserRound,
} from "lucide-react";

import API_URL from "../../config";
import "./LoginRedesign.css";
import CrmLogo from "../../components/CrmLogo";

// The screens read `employeeRole` as the old lowercase vocabulary, while the
// API now answers with the User role enum. Translate once here so the rest of
// the panel keeps working until each screen moves to the new names.
const PANEL_ROLE = {
  SUPERADMIN: "manager",
  COMPANY_ADMIN: "manager",
  MANAGER: "manager",
  OPS: "operations",
  EMPLOYEE: "calling",
  BANKER: "banker",
};

function LoginRedesign() {
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [errorInfo, setErrorInfo] = useState(null);
  const navigate = useNavigate();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorInfo(null);

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier: username,
        password,
      });

      const { id, name, email, role, canAccessAdminPanel } = response.data.user;
      const panelRole = PANEL_ROLE[role] || "calling";

      if (!canAccessAdminPanel) {
        localStorage.clear();
        setErrorInfo({
          type: "access_denied",
          title: "Access Denied",
          message: "This account cannot access the admin panel.",
        });
        return;
      }

      localStorage.setItem("isLogin", "true");
      localStorage.setItem("name", name);
      localStorage.setItem("email", email || "");
      localStorage.setItem("employeeId", id);
      localStorage.setItem("employeeRole", panelRole);
      localStorage.setItem("userRole", role);
      localStorage.setItem("token", response.data.token);

      // A super admin operates the platform, not a company, so they land on
      // their own console. Bankers land on the banker underwriting portal.
      if (role === "SUPERADMIN") {
        navigate("/platform");
      } else if (panelRole === "banker") {
        navigate("/banker");
      } else if (panelRole === "operations") {
        navigate("/operations");
      } else {
        navigate("/");
      }
    } catch (error) {
      const data = error.response?.data;
      const isSubExpired = data?.code === "SUBSCRIPTION_EXPIRED" || (data?.message && data.message.toLowerCase().includes("subscription has expired"));
      const isSuspended = data?.code === "COMPANY_SUSPENDED";

      if (isSubExpired) {
        setErrorInfo({
          type: "subscription_expired",
          title: "Subscription Plan Expired",
          message: data?.message || "Your company's CRM subscription plan has expired. Please contact support or renew your plan.",
        });
      } else if (isSuspended) {
        setErrorInfo({
          type: "company_suspended",
          title: "Account Suspended",
          message: data?.message || "Your company account has been suspended. Please contact platform support.",
        });
      } else {
        setErrorInfo({
          type: "general",
          title: "Login Failed",
          message: data?.message || "Invalid credentials or server unreachable.",
        });
      }
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <main className="cc-login">
      <section className="cc-login-brand" aria-label="CRM Workspace introduction">
        <div className="cc-login-brand-inner">
          <div className="cc-login-logo">
            <CrmLogo height={46} />
          </div>

          <div className="cc-login-brand-copy">
            <p className="cc-login-eyebrow">
              <span aria-hidden="true" />
              Business workspace
            </p>
            <h1>Run your financial operations with clarity.</h1>
            <p>
              Leads, team activity, and performance reporting in one focused workspace.
            </p>
          </div>

          <div className="cc-login-trust">
            <ShieldCheck size={20} aria-hidden="true" />
            <span>
              <strong>Protected admin access</strong>
              <small>Available to authorized team members only</small>
            </span>
          </div>
        </div>
        <span className="cc-login-orbit one" aria-hidden="true" />
        <span className="cc-login-orbit two" aria-hidden="true" />
      </section>

      <section className="cc-login-form-side">
        <div className="cc-login-card">
          <div className="cc-login-mobile-logo">
            <CrmLogo height={36} />
          </div>

          <div className="cc-login-card-heading">
            <span className="cc-login-portal-label">Admin portal</span>
            <h2>Welcome back</h2>
            <p>Enter your account details to continue to your workspace.</p>
          </div>

          {errorInfo && (
            <div
              style={{
                display: "flex",
                alignItems: "flex-start",
                gap: "10px",
                padding: "12px 14px",
                borderRadius: "12px",
                marginBottom: "16px",
                fontSize: "13px",
                lineHeight: "1.4",
                background: errorInfo.type === "subscription_expired" ? "#fff1f2" : "#fef2f2",
                border: errorInfo.type === "subscription_expired" ? "1px solid #fecdd3" : "1px solid #fee2e2",
                color: errorInfo.type === "subscription_expired" ? "#be123c" : "#b91c1c",
              }}
            >
              <AlertTriangle size={18} style={{ flexShrink: 0, marginTop: "2px" }} />
              <div>
                <strong style={{ display: "block", marginBottom: "2px", fontWeight: 700 }}>
                  {errorInfo.title}
                </strong>
                <span>{errorInfo.message}</span>
              </div>
            </div>
          )}

          <form className="cc-login-form" onSubmit={handleSubmit}>
            <label className="cc-login-field">
              <span>Email or phone</span>
              <span className="cc-login-input-wrap">
                <UserRound size={18} aria-hidden="true" />
                <input
                  type="text"
                  placeholder="Enter your email or phone"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  autoComplete="username"
                  autoFocus
                  required
                />
              </span>
            </label>

            <label className="cc-login-field">
              <span>Password</span>
              <span className="cc-login-input-wrap">
                <LockKeyhole size={18} aria-hidden="true" />
                <input
                  type={showPassword ? "text" : "password"}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="cc-login-password-toggle"
                  onClick={() => setShowPassword((visible) => !visible)}
                  aria-label={showPassword ? "Hide password" : "Show password"}
                  aria-pressed={showPassword}
                >
                  {showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
                </button>
              </span>
            </label>

            <button type="submit" className="cc-login-submit" disabled={isSubmitting}>
              <span>{isSubmitting ? "Signing in…" : "Sign in"}</span>
              {isSubmitting ? <i className="cc-login-spinner" aria-hidden="true" /> : <ArrowRight size={18} />}
            </button>
          </form>

          <p className="cc-login-security-note">
            <ShieldCheck size={15} aria-hidden="true" />
            Your credentials are used only to verify access.
          </p>
        </div>

        <p className="cc-login-copyright">© {new Date().getFullYear()} Capital Care</p>
      </section>
    </main>
  );
}

export default LoginRedesign;
