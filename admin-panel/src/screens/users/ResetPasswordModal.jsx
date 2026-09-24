import React, { useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  Check,
  Copy,
  Eye,
  EyeOff,
  Key,
  Lock,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  X,
} from "lucide-react";
import API_URL from "../../config";

export default function ResetPasswordModal({ open, onClose, user }) {
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copied, setCopied] = useState(false);

  if (!open || !user) return null;

  const generateRandomPassword = () => {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789";
    const specials = "@#$!";
    let pass = "";
    for (let i = 0; i < 6; i++) {
      pass += chars.charAt(Math.floor(Math.random() * chars.length));
    }
    pass += specials.charAt(Math.floor(Math.random() * specials.length));
    pass += Math.floor(100 + Math.random() * 900); // 3 digits
    setNewPassword(pass);
    setConfirmPassword(pass);
    toast.info("Secure password generated!");
  };

  const copyToClipboard = () => {
    if (!newPassword) return;
    navigator.clipboard.writeText(newPassword);
    setCopied(true);
    toast.success("Password copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!newPassword || newPassword.length < 8) {
      toast.error("Password must be at least 8 characters long");
      return;
    }

    if (newPassword !== confirmPassword) {
      toast.error("Passwords do not match");
      return;
    }

    setSubmitting(true);
    try {
      await axios.put(`${API_URL}/users/${user.id}/password`, {
        newPassword: newPassword.trim(),
      });
      toast.success(`Password for ${user.name || "user"} reset successfully!`);
      handleClose();
    } catch (error) {
      console.error("Reset password error:", error);
      toast.error(error.response?.data?.message || "Failed to reset password");
    } finally {
      setSubmitting(false);
    }
  };

  const handleClose = () => {
    setNewPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setShowConfirm(false);
    setCopied(false);
    onClose();
  };

  const isMatching = newPassword && confirmPassword && newPassword === confirmPassword;
  const isMinLength = newPassword.length >= 8;

  return (
    <div className="cc-pwd-overlay" onClick={handleClose}>
      <style>{styles}</style>
      <div className="cc-pwd-card" onClick={(e) => e.stopPropagation()}>
        {/* Modal Header */}
        <div className="cc-pwd-header">
          <div className="cc-pwd-header-left">
            <div className="cc-pwd-icon-wrap">
              <Key size={20} />
            </div>
            <div>
              <span className="cc-pwd-badge">Security & Access</span>
              <h3 className="cc-pwd-title">Reset Employee Password</h3>
            </div>
          </div>
          <button type="button" className="cc-pwd-close-btn" onClick={handleClose} title="Close">
            <X size={16} />
          </button>
        </div>

        {/* Target Employee Summary Card */}
        <div className="cc-pwd-user-card">
          <div className="cc-pwd-avatar">
            {(user.name || String(user.id) || "?").slice(0, 2).toUpperCase()}
          </div>
          <div className="cc-pwd-user-details">
            <div className="cc-pwd-user-name-row">
              <strong className="cc-pwd-user-name">{user.name || "Employee"}</strong>
              {user.role && <span className="cc-pwd-role-tag">{user.role}</span>}
            </div>
            <span className="cc-pwd-user-email">{user.email || "--"} · ID #{user.id}</span>
          </div>
        </div>

        {/* Form */}
        <form className="cc-pwd-form" onSubmit={handleSubmit}>
          {/* New Password Field */}
          <div className="cc-pwd-field">
            <div className="cc-pwd-label-row">
              <label htmlFor="new-password">New Password *</label>
              <button
                type="button"
                className="cc-pwd-gen-btn"
                onClick={generateRandomPassword}
                title="Generate secure random password"
              >
                <Sparkles size={13} /> Auto-Generate
              </button>
            </div>
            <div className="cc-pwd-input-box">
              <Lock size={15} className="cc-pwd-input-icon" />
              <input
                id="new-password"
                type={showPassword ? "text" : "password"}
                required
                minLength={8}
                placeholder="Enter new password (min. 8 chars)"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
              />
              <div className="cc-pwd-input-actions">
                {newPassword && (
                  <button
                    type="button"
                    className="cc-pwd-icon-action"
                    onClick={copyToClipboard}
                    title="Copy to clipboard"
                  >
                    {copied ? <Check size={14} color="#16a34a" /> : <Copy size={14} />}
                  </button>
                )}
                <button
                  type="button"
                  className="cc-pwd-icon-action"
                  onClick={() => setShowPassword((prev) => !prev)}
                  title={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Confirm Password Field */}
          <div className="cc-pwd-field">
            <label htmlFor="confirm-password">Confirm New Password *</label>
            <div className="cc-pwd-input-box">
              <Lock size={15} className="cc-pwd-input-icon" />
              <input
                id="confirm-password"
                type={showConfirm ? "text" : "password"}
                required
                placeholder="Re-enter new password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
              />
              <div className="cc-pwd-input-actions">
                <button
                  type="button"
                  className="cc-pwd-icon-action"
                  onClick={() => setShowConfirm((prev) => !prev)}
                  title={showConfirm ? "Hide password" : "Show password"}
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>
          </div>

          {/* Realtime Validation Status */}
          <div className="cc-pwd-val-row">
            <span className={`cc-pwd-val-pill ${isMinLength ? "is-valid" : ""}`}>
              <span className="cc-pwd-val-dot" />
              8+ Characters
            </span>
            <span className={`cc-pwd-val-pill ${isMatching ? "is-valid" : ""}`}>
              <span className="cc-pwd-val-dot" />
              Passwords Match
            </span>
          </div>

          {/* Security Notice */}
          <div className="cc-pwd-notice">
            <ShieldAlert size={15} />
            <span>The employee must log in using this new password immediately upon update.</span>
          </div>

          {/* Actions */}
          <div className="cc-pwd-footer">
            <button type="button" className="cc-pwd-btn cc-pwd-btn-ghost" onClick={handleClose}>
              Cancel
            </button>
            <button
              type="submit"
              className="cc-pwd-btn cc-pwd-btn-primary"
              disabled={submitting || !isMinLength || !isMatching}
            >
              {submitting ? "Resetting..." : "Save New Password"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

const styles = `
  .cc-pwd-overlay {
    position: fixed;
    top: 0;
    left: 0;
    right: 0;
    bottom: 0;
    background: rgba(15, 23, 42, 0.65);
    backdrop-filter: blur(4px);
    -webkit-backdrop-filter: blur(4px);
    z-index: 9999;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    animation: ccFadeIn 0.15s ease-out;
  }

  @keyframes ccFadeIn {
    from { opacity: 0; }
    to { opacity: 1; }
  }

  @keyframes ccPopIn {
    from { opacity: 0; transform: scale(0.95) translateY(10px); }
    to { opacity: 1; transform: scale(1) translateY(0); }
  }

  .cc-pwd-card {
    width: 100%;
    max-width: 460px;
    background: #ffffff;
    border-radius: 18px;
    padding: 24px;
    display: flex;
    flex-direction: column;
    gap: 16px;
    box-shadow: 0 25px 60px -12px rgba(15, 23, 42, 0.35);
    border: 1px solid rgba(226, 232, 240, 0.8);
    animation: ccPopIn 0.2s cubic-bezier(0.16, 1, 0.3, 1);
    box-sizing: border-box;
  }

  .cc-pwd-header {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
  }

  .cc-pwd-header-left {
    display: flex;
    align-items: center;
    gap: 12px;
  }

  .cc-pwd-icon-wrap {
    width: 42px;
    height: 42px;
    border-radius: 12px;
    background: #fef3c7;
    color: #b45309;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .cc-pwd-badge {
    font-size: 11px;
    font-weight: 700;
    text-transform: uppercase;
    letter-spacing: 0.06em;
    color: #b45309;
    display: block;
  }

  .cc-pwd-title {
    margin: 2px 0 0 0;
    font-size: 18px;
    font-weight: 700;
    color: #0f172a;
    letter-spacing: -0.01em;
  }

  .cc-pwd-close-btn {
    width: 32px;
    height: 32px;
    border-radius: 8px;
    border: 0;
    background: #f1f5f9;
    color: #64748b;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.15s;
  }

  .cc-pwd-close-btn:hover {
    background: #e2e8f0;
    color: #0f172a;
  }

  /* User Info Strip */
  .cc-pwd-user-card {
    display: flex;
    align-items: center;
    gap: 12px;
    background: #f8fafc;
    border: 1px solid #e2e8f0;
    border-radius: 12px;
    padding: 12px;
  }

  .cc-pwd-avatar {
    width: 38px;
    height: 38px;
    border-radius: 10px;
    background: #047857;
    color: #ffffff;
    font-weight: 700;
    font-size: 13px;
    display: grid;
    place-items: center;
    flex-shrink: 0;
  }

  .cc-pwd-user-details {
    flex: 1;
    min-width: 0;
    display: flex;
    flex-direction: column;
    gap: 2px;
  }

  .cc-pwd-user-name-row {
    display: flex;
    align-items: center;
    gap: 8px;
  }

  .cc-pwd-user-name {
    font-size: 14px;
    font-weight: 700;
    color: #0f172a;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .cc-pwd-role-tag {
    background: #e0f2fe;
    color: #0369a1;
    padding: 2px 7px;
    border-radius: 6px;
    font-size: 10.5px;
    font-weight: 700;
    text-transform: uppercase;
  }

  .cc-pwd-user-email {
    font-size: 12px;
    color: #64748b;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  /* Form */
  .cc-pwd-form {
    display: flex;
    flex-direction: column;
    gap: 14px;
  }

  .cc-pwd-field {
    display: flex;
    flex-direction: column;
    gap: 6px;
  }

  .cc-pwd-label-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }

  .cc-pwd-label-row label, .cc-pwd-field label {
    font-size: 12.5px;
    font-weight: 600;
    color: #334155;
  }

  .cc-pwd-gen-btn {
    background: #f0fdf4;
    border: 1px solid #bbf7d0;
    color: #15803d;
    border-radius: 6px;
    padding: 3px 8px;
    font-size: 11px;
    font-weight: 600;
    cursor: pointer;
    display: inline-flex;
    align-items: center;
    gap: 4px;
    transition: all 0.15s ease;
  }

  .cc-pwd-gen-btn:hover {
    background: #dcfce7;
    color: #166534;
  }

  .cc-pwd-input-box {
    position: relative;
    display: flex;
    align-items: center;
  }

  .cc-pwd-input-icon {
    position: absolute;
    left: 12px;
    color: #94a3b8;
    pointer-events: none;
  }

  .cc-pwd-input-box input {
    width: 100%;
    padding: 10px 72px 10px 36px;
    border: 1px solid #cbd5e1;
    border-radius: 10px;
    font-size: 13.5px;
    color: #0f172a;
    background: #ffffff;
    font-family: inherit;
    box-sizing: border-box;
    transition: border-color 0.15s, box-shadow 0.15s;
  }

  .cc-pwd-input-box input:focus {
    border-color: #047857;
    outline: none;
    box-shadow: 0 0 0 3px rgba(4, 120, 87, 0.15);
  }

  .cc-pwd-input-actions {
    position: absolute;
    right: 6px;
    display: flex;
    align-items: center;
    gap: 3px;
  }

  .cc-pwd-icon-action {
    width: 28px;
    height: 28px;
    border: 0;
    background: transparent;
    color: #64748b;
    border-radius: 6px;
    cursor: pointer;
    display: grid;
    place-items: center;
    transition: all 0.15s;
  }

  .cc-pwd-icon-action:hover {
    background: #f1f5f9;
    color: #0f172a;
  }

  /* Validation Row */
  .cc-pwd-val-row {
    display: flex;
    gap: 8px;
    flex-wrap: wrap;
  }

  .cc-pwd-val-pill {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 4px 10px;
    border-radius: 999px;
    font-size: 11.5px;
    font-weight: 500;
    background: #f1f5f9;
    color: #64748b;
    transition: all 0.15s ease;
  }

  .cc-pwd-val-dot {
    width: 6px;
    height: 6px;
    border-radius: 50%;
    background: #94a3b8;
    transition: all 0.15s ease;
  }

  .cc-pwd-val-pill.is-valid {
    background: #ecfdf5;
    color: #047857;
    font-weight: 600;
  }

  .cc-pwd-val-pill.is-valid .cc-pwd-val-dot {
    background: #10b981;
  }

  /* Notice */
  .cc-pwd-notice {
    display: flex;
    align-items: flex-start;
    gap: 8px;
    font-size: 11.5px;
    color: #92400e;
    background: #fffbeb;
    border: 1px solid #fef3c7;
    border-radius: 8px;
    padding: 8px 10px;
    line-height: 1.4;
  }

  .cc-pwd-notice svg {
    flex-shrink: 0;
    color: #d97706;
    margin-top: 1px;
  }

  /* Footer */
  .cc-pwd-footer {
    display: flex;
    justify-content: flex-end;
    gap: 10px;
    margin-top: 6px;
  }

  .cc-pwd-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding: 9px 18px;
    border-radius: 10px;
    font-size: 13.5px;
    font-weight: 600;
    border: 1px solid transparent;
    cursor: pointer;
    transition: all 0.15s ease;
  }

  .cc-pwd-btn-primary {
    background: #047857;
    color: #ffffff;
  }

  .cc-pwd-btn-primary:hover:not(:disabled) {
    background: #065f46;
  }

  .cc-pwd-btn-primary:disabled {
    opacity: 0.55;
    cursor: not-allowed;
  }

  .cc-pwd-btn-ghost {
    background: #f1f5f9;
    color: #334155;
  }

  .cc-pwd-btn-ghost:hover {
    background: #e2e8f0;
  }
`;
