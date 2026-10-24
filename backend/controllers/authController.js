const jwt = require("jsonwebtoken");
const { Op } = require("sequelize");
const { User, Company, Branch } = require("../models");
const { SECRET_KEY } = require("../middlewares/auth");
const { ROLES, USER_STATUSES, ADMIN_PANEL_ROLES } = require("../constants/roles");
const { logActivity } = require("../utils/activity");
const { subscriptionBlock } = require("../services/provisioning");

const TOKEN_TTL = process.env.JWT_EXPIRES_IN || "30d";

const issueToken = (user) =>
  jwt.sign(
    { id: user.id, role: user.role, companyId: user.companyId },
    SECRET_KEY,
    { expiresIn: TOKEN_TTL }
  );

const { resolveUserPermissions } = require("../constants/permissions");

const publicUser = (user) => {
  const resolvedPermissions = resolveUserPermissions(user);
  return {
    id: user.id,
    name: user.name,
    email: user.email,
    phone: user.phone,
    role: user.role,
    status: user.status,
    companyId: user.companyId,
    managerId: user.managerId,
    permissions: user.permissions || null,
    resolvedPermissions: resolvedPermissions,
    company: user.company
      ? {
          id: user.company.id,
          name: user.company.name,
          slug: user.company.slug,
          logoUrl: user.company.logoUrl || null,
          status: user.company.status,
          subscriptionExpiresAt: user.company.subscriptionExpiresAt,
          isExpired: user.company.subscriptionExpiresAt ? new Date(user.company.subscriptionExpiresAt) < new Date() : false,
        }
      : null,
    branch: user.branch
      ? {
          id: user.branch.id,
          name: user.branch.name,
          city: user.branch.city,
          state: user.branch.state,
          address: user.branch.address,
          office_lat: user.branch.officeLat != null ? Number(user.branch.officeLat) : null,
          office_lng: user.branch.officeLng != null ? Number(user.branch.officeLng) : null,
          geo_radius_meters: user.branch.geoRadiusMeters || 200,
          officeLat: user.branch.officeLat != null ? Number(user.branch.officeLat) : null,
          officeLng: user.branch.officeLng != null ? Number(user.branch.officeLng) : null,
          geoRadiusMeters: user.branch.geoRadiusMeters || 200,
        }
      : null,
    isSuperAdmin: user.role === ROLES.SUPERADMIN,
    canAccessAdminPanel: ADMIN_PANEL_ROLES.includes(user.role),
  };
};

/**
 * POST /api/auth/login
 * Accepts { identifier | email | phone, password }. One endpoint for every
 * role: SUPERADMIN signs in here too, the role in the response decides the
 * landing panel.
 */
exports.login = async (req, res) => {
  const identifier = (req.body.identifier || req.body.email || req.body.phone || "").trim();
  const { password } = req.body;

  if (!identifier || !password) {
    return res.status(400).json({ message: "Email or phone and password are required" });
  }

  try {
    const user = await User.findOne({
      where: { [Op.or]: [{ email: identifier }, { phone: identifier }] },
      include: [
        { model: Company, as: "company", required: false },
        { model: Branch, as: "branch", required: false },
      ],
    });
    console.log("User found:", user ? await user.comparePassword(password) : "No user found");

    // Same message for unknown account and wrong password, so the endpoint
    // cannot be used to enumerate users.
    if (!user || !(await user.comparePassword(password))) {
      return res.status(401).json({ message: "Invalid credentials" });
    }

    if (user.status !== USER_STATUSES.ACTIVE) {
      return res.status(403).json({ message: "Account is not active" });
    }

    // Fallback to company's branch if user has no explicit branch set
    if (!user.branch && user.companyId) {
      user.branch = await Branch.findOne({ where: { companyId: user.companyId } });
      if (user.branch && !user.branchId) {
        await user.update({ branchId: user.branch.id });
      }
    }

    // Suspended or lapsed companies are refused at the door, with a distinct code
    // so the client can say why instead of showing a generic auth failure.
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

    req.user = user;
    await logActivity(req, {
      recordType: "User",
      recordId: user.id,
      action: "UPDATED",
      remarks: "Signed in",
    });

    return res.status(200).json({
      message: "Login successful",
      token: issueToken(user),
      user: publicUser(user),
    });
  } catch (error) {
    console.error("[auth] login error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/auth/me - who the current token belongs to.
 */
exports.me = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Company, as: "company", required: false },
        { model: Branch, as: "branch", required: false },
      ],
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }
    if (!user.branch && user.companyId) {
      user.branch = await Branch.findOne({ where: { companyId: user.companyId } });
      if (user.branch && !user.branchId) {
        await user.update({ branchId: user.branch.id });
      }
    }
    return res.status(200).json({ message: "success", user: publicUser(user) });
  } catch (error) {
    console.error("[auth] me error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/auth/password - the signed-in user changes their own password.
 */
exports.changePassword = async (req, res) => {
  const { currentPassword, newPassword } = req.body;

  if (!currentPassword || !newPassword) {
    return res.status(400).json({ message: "currentPassword and newPassword are required" });
  }
  if (String(newPassword).length < 8) {
    return res.status(400).json({ message: "New password must be at least 8 characters" });
  }

  try {
    const user = await User.findByPk(req.user.id);
    if (!(await user.comparePassword(currentPassword))) {
      return res.status(401).json({ message: "Current password is incorrect" });
    }

    user.password = newPassword; // hashed by the beforeUpdate hook
    await user.save();

    await logActivity(req, {
      recordType: "User",
      recordId: user.id,
      action: "UPDATED",
      remarks: "Changed own password",
    });

    return res.status(200).json({ message: "Password updated" });
  } catch (error) {
    console.error("[auth] changePassword error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/auth/profile - user updates their own profile details (name, email, phone)
 */
exports.updateProfile = async (req, res) => {
  try {
    const user = await User.findByPk(req.user.id, {
      include: [
        { model: Company, as: "company", required: false },
        { model: Branch, as: "branch", required: false },
      ],
    });
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    const { name, phone, email } = req.body;
    const updates = {};
    if (name && typeof name === "string" && name.trim()) {
      updates.name = name.trim();
    }
    if (phone !== undefined) {
      updates.phone = typeof phone === "string" ? phone.trim() : phone;
    }
    if (email && typeof email === "string" && email.trim() && email.trim().toLowerCase() !== user.email?.toLowerCase()) {
      const emailTrimmed = email.trim().toLowerCase();
      const existing = await User.findOne({
        where: { email: emailTrimmed, id: { [Op.ne]: user.id } },
      });
      if (existing) {
        return res.status(409).json({ message: "Email is already in use by another account" });
      }
      updates.email = emailTrimmed;
    }

    if (Object.keys(updates).length > 0) {
      await user.update(updates);
    }

    await logActivity(req, {
      recordType: "User",
      recordId: user.id,
      action: "UPDATED",
      remarks: "Updated own profile details",
    });

    return res.status(200).json({
      message: "Profile updated successfully",
      user: publicUser(user),
    });
  } catch (error) {
    console.error("[auth] updateProfile error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/auth/delete-account
 * Apple App Store Guideline 5.1.1(v) Compliant
 * Permanently removes user account, credentials, and personal telemetry without delay.
 */
exports.deleteAccount = async (req, res) => {
  try {
    const userId = req.user.id;
    const user = await User.findByPk(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found" });
    }

    if (user.role === ROLES.SUPERADMIN) {
      return res.status(403).json({
        message: "Platform SuperAdmin accounts cannot be deleted directly from mobile app.",
      });
    }

    const {
      Attendance,
      Notification,
      Note,
      Task,
      FollowUp,
      Lead,
      CallLog,
    } = require("../models");

    // 1. Permanently delete user personal telemetry & private records
    if (Attendance) await Attendance.destroy({ where: { userId } }).catch(() => {});
    if (Notification) await Notification.destroy({ where: { recipientId: userId } }).catch(() => {});
    if (Note) await Note.destroy({ where: { userId } }).catch(() => {});
    if (Task) await Task.destroy({ where: { userId } }).catch(() => {});
    if (FollowUp) await FollowUp.destroy({ where: { userId } }).catch(() => {});
    if (CallLog) await CallLog.destroy({ where: { userId } }).catch(() => {});

    // 2. Unassign any leads currently assigned to this user
    if (Lead) {
      await Lead.update(
        { assignedEmployeeId: null },
        { where: { assignedEmployeeId: userId } }
      ).catch(() => {});
      await Lead.update(
        { assignedManagerId: null },
        { where: { assignedManagerId: userId } }
      ).catch(() => {});
    }

    // 3. Clear subordinate manager relationships
    await User.update(
      { managerId: null },
      { where: { managerId: userId } }
    ).catch(() => {});

    // 4. Log deletion for compliance audit before hard delete
    await logActivity(req, {
      recordType: "User",
      recordId: user.id,
      action: "DELETED",
      remarks: `User ${user.name} (${user.email || user.phone}) permanently deleted their account via mobile app in compliance with App Store guidelines.`,
      companyId: user.companyId,
    }).catch(() => {});

    // 5. Real hard delete from database
    await user.destroy();

    return res.status(200).json({
      success: true,
      message: "Your account and associated personal data have been permanently deleted.",
    });
  } catch (error) {
    console.error("[auth] deleteAccount error:", error);
    return res.status(500).json({
      message: "Failed to delete account. Please try again or contact support.",
      error: error.message,
    });
  }
};

exports.publicUser = publicUser;

