const { ActivityLog } = require("../models");

/**
 * Writes one immutable audit entry.
 *
 * The audit trail must never break the request that triggered it, so a failure
 * here is logged and swallowed rather than thrown. Pass a transaction when the
 * caller has one so the entry rolls back with the change it describes.
 */
const logActivity = async (
  req,
  { recordType, recordId, action, oldValue = null, newValue = null, remarks = null, companyId = null },
  transaction = null
) => {
  try {
    const resolvedCompanyId = companyId ?? req.user?.companyId ?? null;
    if (!resolvedCompanyId) {
      // ActivityLog.company_id is NOT NULL; a platform-level action (SuperAdmin
      // acting outside any company) has nothing to attach to.
      return null;
    }

    return await ActivityLog.create(
      {
        companyId: resolvedCompanyId,
        recordType,
        recordId,
        action,
        oldValue,
        newValue,
        remarks,
        actorUserId: req.user?.id ?? null,
        sourcePanel: req?.headers?.["x-source-panel"] || "Admin Panel",
        ipAddress: req?.ip || null,
      },
      { transaction }
    );
  } catch (error) {
    console.error("[activity] failed to write audit entry:", error.message);
    return null;
  }
};

/**
 * Returns only the fields that actually changed, as { field: [old, new] },
 * so audit rows carry a diff instead of a full record copy.
 */
const diffFields = (before, after, fields) => {
  const oldValue = {};
  const newValue = {};
  for (const field of fields) {
    if (after[field] === undefined) continue;
    if (before[field] === after[field]) continue;
    oldValue[field] = before[field] ?? null;
    newValue[field] = after[field] ?? null;
  }
  return Object.keys(newValue).length ? { oldValue, newValue } : null;
};

module.exports = { logActivity, diffFields };
