import React, { useEffect, useState, useMemo } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import { Link } from "react-router-dom";
import {
  User,
  Mail,
  Phone,
  ShieldCheck,
  Building2,
  MapPin,
  KeyRound,
  Eye,
  EyeOff,
  Save,
  CheckCircle2,
  XCircle,
  Loader2,
  ChevronRight,
  Home,
} from "lucide-react";
import API_URL from "../../config";
import "./ProfileScreen.css";

const ROLE_DISPLAY_NAMES = {
  SUPERADMIN: "Platform Super Admin",
  COMPANY_ADMIN: "Company Administrator",
  MANAGER: "Team Manager",
  OPS: "Operations Officer",
  EMPLOYEE: "Sales / Telecaller",
  BANKER: "Bank Underwriter",
  FINANCE: "Finance & Accounts",
};

export default function ProfileScreen() {
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);

  // User Profile State
  const [user, setUser] = useState({
    id: "",
    name: "",
    email: "",
    phone: "",
    role: "",
    branch: null,
    company: null,
  });

  // Password Form State
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showCurrentPassword, setShowCurrentPassword] = useState(false);
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const fetchUserProfile = async () => {
    try {
      setLoading(true);
      const res = await axios.get(`${API_URL}/auth/me`);
      const u = res.data?.user || res.data?.data;
      if (u) {
        setUser({
          id: u.id,
          name: u.name || "",
          email: u.email || "",
          phone: u.phone || "",
          role: u.role || localStorage.getItem("userRole") || "EMPLOYEE",
          branch: u.branch || null,
          company: u.company || null,
        });

        if (u.name) localStorage.setItem("name", u.name);
        if (u.email) localStorage.setItem("email", u.email);
        if (u.resolvedPermissions) {
          localStorage.setItem("userPermissions", JSON.stringify(u.resolvedPermissions));
          window.dispatchEvent(new CustomEvent("permissions_updated"));
        }
      }
    } catch (err) {
      console.error("Failed to fetch user profile:", err);
      // Fallback to localStorage data
      setUser((prev) => ({
        ...prev,
        name: localStorage.getItem("name") || "",
        email: localStorage.getItem("email") || "",
        role: localStorage.getItem("userRole") || "EMPLOYEE",
      }));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const initials = useMemo(() => {
    return (
      user.name
        .split(" ")
        .filter(Boolean)
        .slice(0, 2)
        .map((p) => p[0])
        .join("")
        .toUpperCase() || "ME"
    );
  }, [user.name]);

  const roleLabel = ROLE_DISPLAY_NAMES[user.role] || user.role;

  // Save profile changes (Name, Email, Phone)
  const handleSaveProfile = async (e) => {
    e.preventDefault();
    if (!user.name.trim()) {
      toast.error("Full Name is required");
      return;
    }
    if (!user.email.trim()) {
      toast.error("Email Address is required");
      return;
    }

    try {
      setSavingProfile(true);
      const res = await axios.put(`${API_URL}/auth/profile`, {
        name: user.name.trim(),
        email: user.email.trim(),
        phone: user.phone.trim(),
      });

      const updatedUser = res.data?.user || res.data?.data;
      if (updatedUser) {
        localStorage.setItem("name", updatedUser.name);
        localStorage.setItem("email", updatedUser.email);
        setUser((prev) => ({
          ...prev,
          name: updatedUser.name,
          email: updatedUser.email,
          phone: updatedUser.phone,
        }));
      } else {
        localStorage.setItem("name", user.name.trim());
        localStorage.setItem("email", user.email.trim());
      }

      window.dispatchEvent(new Event("storage"));
      window.dispatchEvent(new CustomEvent("user_profile_updated"));
      toast.success(res.data?.message || "Profile details updated successfully!");
    } catch (err) {
      console.error("Error updating profile:", err);
      toast.error(err.response?.data?.message || "Failed to update profile details");
    } finally {
      setSavingProfile(false);
    }
  };

  // Change password
  const handleChangePassword = async (e) => {
    e.preventDefault();

    if (!currentPassword) {
      toast.error("Please enter your current password");
      return;
    }
    if (!newPassword) {
      toast.error("Please enter your new password");
      return;
    }
    if (newPassword.length < 8) {
      toast.error("New password must be at least 8 characters");
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirm password do not match");
      return;
    }
    if (currentPassword === newPassword) {
      toast.error("New password cannot be the same as current password");
      return;
    }

    try {
      setSavingPassword(true);
      const res = await axios.put(`${API_URL}/auth/password`, {
        currentPassword,
        newPassword,
      });

      toast.success(res.data?.message || "Password changed successfully!");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      console.error("Error changing password:", err);
      toast.error(err.response?.data?.message || "Failed to change password");
    } finally {
      setSavingPassword(false);
    }
  };

  const isPasswordLengthValid = newPassword.length >= 8;
  const isPasswordMatchValid = Boolean(newPassword && newPassword === confirmPassword);

  if (loading) {
    return (
      <div className="cc-profile-container" style={{ textAlign: "center", padding: "80px 20px" }}>
        <Loader2 className="animate-spin" size={36} style={{ margin: "0 auto 16px", color: "#047857" }} />
        <p style={{ color: "#64748b", fontSize: "15px" }}>Loading your profile...</p>
      </div>
    );
  }

  return (
    <div className="cc-profile-container">
      {/* Header & Breadcrumb */}
      <div className="cc-profile-header">
        <div className="cc-profile-breadcrumb">
          <Link to="/" style={{ display: "inline-flex", alignItems: "center", gap: "4px" }}>
            <Home size={14} /> Home
          </Link>
          <ChevronRight size={12} />
          <span>Profile</span>
        </div>
        <h1 className="cc-profile-title">My Profile</h1>
        <p className="cc-profile-subtitle">
          Manage your account information, personal contact details, and password security.
        </p>
      </div>

      {/* Hero Banner */}
      <div className="cc-profile-hero">
        <div className="cc-profile-hero-inner">
          <div className="cc-profile-avatar-large">{initials}</div>
          <div className="cc-profile-hero-meta">
            <h2>{user.name || "My Account"}</h2>
            <div className="cc-profile-hero-tags">
              <span className="cc-profile-badge role">
                <ShieldCheck size={13} /> {roleLabel}
              </span>
              {user.branch?.name && (
                <span className="cc-profile-badge branch">
                  <MapPin size={13} /> {user.branch.name}
                </span>
              )}
              {user.company?.name && (
                <span className="cc-profile-badge branch">
                  <Building2 size={13} /> {user.company.name}
                </span>
              )}
              <span className="cc-profile-badge status">
                <span className="cc-profile-status-dot" /> Active Account
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Two Column Grid */}
      <div className="cc-profile-grid">
        {/* Personal Details Card */}
        <div className="cc-profile-card">
          <div className="cc-profile-card-header">
            <div className="cc-profile-icon-wrap green">
              <User size={20} />
            </div>
            <div>
              <h3>Personal Information</h3>
              <p>Update your display name, contact phone, and email address</p>
            </div>
          </div>

          <form className="cc-profile-form" onSubmit={handleSaveProfile}>
            <div className="cc-form-group">
              <label htmlFor="user-name">Full Name</label>
              <div className="cc-input-wrap">
                <User size={16} className="cc-input-icon" />
                <input
                  id="user-name"
                  type="text"
                  placeholder="Enter full name"
                  value={user.name}
                  onChange={(e) => setUser({ ...user, name: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="cc-form-group">
              <label htmlFor="user-email">Email Address</label>
              <div className="cc-input-wrap">
                <Mail size={16} className="cc-input-icon" />
                <input
                  id="user-email"
                  type="email"
                  placeholder="Enter email address"
                  value={user.email}
                  onChange={(e) => setUser({ ...user, email: e.target.value })}
                  required
                />
              </div>
            </div>

            <div className="cc-form-group">
              <label htmlFor="user-phone">Phone Number</label>
              <div className="cc-input-wrap">
                <Phone size={16} className="cc-input-icon" />
                <input
                  id="user-phone"
                  type="tel"
                  placeholder="Enter phone number"
                  value={user.phone}
                  onChange={(e) => setUser({ ...user, phone: e.target.value })}
                />
              </div>
            </div>

            <div className="cc-form-group">
              <label>Designated Role</label>
              <div className="cc-input-wrap">
                <ShieldCheck size={16} className="cc-input-icon" />
                <input type="text" value={roleLabel} disabled />
              </div>
            </div>

            {user.company?.name && (
              <div className="cc-form-group">
                <label>Company / Organization</label>
                <div className="cc-input-wrap">
                  <Building2 size={16} className="cc-input-icon" />
                  <input type="text" value={user.company.name} disabled />
                </div>
              </div>
            )}

            <button type="submit" className="cc-profile-btn primary" disabled={savingProfile}>
              {savingProfile ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Saving Changes...
                </>
              ) : (
                <>
                  <Save size={16} /> Save Profile Details
                </>
              )}
            </button>
          </form>
        </div>

        {/* Change Password Card */}
        <div className="cc-profile-card">
          <div className="cc-profile-card-header">
            <div className="cc-profile-icon-wrap indigo">
              <KeyRound size={20} />
            </div>
            <div>
              <h3>Security & Password</h3>
              <p>Change your account password to keep your credentials safe</p>
            </div>
          </div>

          <form className="cc-profile-form" onSubmit={handleChangePassword}>
            <div className="cc-form-group">
              <label htmlFor="current-pw">Current Password</label>
              <div className="cc-input-wrap">
                <KeyRound size={16} className="cc-input-icon" />
                <input
                  id="current-pw"
                  type={showCurrentPassword ? "text" : "password"}
                  placeholder="Enter current password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  autoComplete="current-password"
                  required
                />
                <button
                  type="button"
                  className="cc-pw-toggle"
                  onClick={() => setShowCurrentPassword(!showCurrentPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showCurrentPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="cc-form-group">
              <label htmlFor="new-pw">New Password</label>
              <div className="cc-input-wrap">
                <KeyRound size={16} className="cc-input-icon" />
                <input
                  id="new-pw"
                  type={showNewPassword ? "text" : "password"}
                  placeholder="Enter new password (min. 8 characters)"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="cc-pw-toggle"
                  onClick={() => setShowNewPassword(!showNewPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showNewPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            <div className="cc-form-group">
              <label htmlFor="confirm-pw">Confirm New Password</label>
              <div className="cc-input-wrap">
                <KeyRound size={16} className="cc-input-icon" />
                <input
                  id="confirm-pw"
                  type={showConfirmPassword ? "text" : "password"}
                  placeholder="Re-type new password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  autoComplete="new-password"
                  required
                />
                <button
                  type="button"
                  className="cc-pw-toggle"
                  onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                  aria-label="Toggle password visibility"
                >
                  {showConfirmPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                </button>
              </div>
            </div>

            {/* Password Validation Requirements */}
            {newPassword && (
              <div className="cc-pw-rules">
                <p>Password Checklist:</p>
                <div className={`cc-pw-rule-item ${isPasswordLengthValid ? "valid" : ""}`}>
                  {isPasswordLengthValid ? <CheckCircle2 size={13} color="#047857" /> : <XCircle size={13} />}
                  <span>Minimum 8 characters</span>
                </div>
                <div className={`cc-pw-rule-item ${isPasswordMatchValid ? "valid" : ""}`}>
                  {isPasswordMatchValid ? <CheckCircle2 size={13} color="#047857" /> : <XCircle size={13} />}
                  <span>Passwords match</span>
                </div>
              </div>
            )}

            <button
              type="submit"
              className="cc-profile-btn indigo"
              disabled={savingPassword || (newPassword && (!isPasswordLengthValid || !isPasswordMatchValid))}
            >
              {savingPassword ? (
                <>
                  <Loader2 className="animate-spin" size={16} /> Updating Password...
                </>
              ) : (
                <>
                  <KeyRound size={16} /> Update Password
                </>
              )}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
