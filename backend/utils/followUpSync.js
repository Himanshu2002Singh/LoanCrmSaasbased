const { Op } = require("sequelize");
const { FollowUp, Lead, User } = require("../models");

/**
 * Robustly parses a date or date string.
 * If format is "YYYY-MM-DD", sets the default time to 11:00 AM local time
 * to prevent any UTC/local timezone shifts across midnight boundaries.
 */
function parseScheduledDate(input) {
  if (!input) return null;
  if (input instanceof Date) {
    return isNaN(input.getTime()) ? null : input;
  }
  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return null;

    // Check for "YYYY-MM-DD"
    const match = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (match) {
      const year = parseInt(match[1], 10);
      const month = parseInt(match[2], 10) - 1;
      const day = parseInt(match[3], 10);
      return new Date(year, month, day, 11, 0, 0, 0);
    }

    const parsed = new Date(trimmed);
    return isNaN(parsed.getTime()) ? null : parsed;
  }
  return null;
}

/**
 * Synchronizes a Lead's nextFollowupDate with the FollowUp table.
 * If nextDate is provided:
 *  - Upserts a PENDING follow-up for this lead.
 * If nextDate is null/falsy:
 *  - Closes any existing pending follow-up for this lead.
 */
async function syncLeadFollowUp({ leadId, companyId, nextDate, userId, remarks, reqUser }) {
  if (!leadId) return null;

  try {
    const scheduledAt = parseScheduledDate(nextDate);

    // If a valid scheduled date is provided
    if (scheduledAt) {
      let targetCompanyId = companyId;
      let targetUserId = userId;

      if (!targetCompanyId || !targetUserId) {
        const lead = await Lead.findByPk(leadId, {
          attributes: ["id", "companyId", "assignedEmployeeId", "assignedManagerId"],
        });
        if (lead) {
          targetCompanyId = targetCompanyId || lead.companyId;
          targetUserId = targetUserId || lead.assignedEmployeeId || lead.assignedManagerId || reqUser?.id;
        }
      }

      if (!targetCompanyId && reqUser?.companyId) {
        targetCompanyId = reqUser.companyId;
      }
      if (!targetUserId && reqUser?.id) {
        targetUserId = reqUser.id;
      }

      // Check if a PENDING follow-up already exists for this lead
      const existing = await FollowUp.findOne({
        where: {
          leadId,
          status: "PENDING",
        },
        order: [["scheduledAt", "ASC"]],
      });

      if (existing) {
        await existing.update({
          scheduledAt,
          userId: targetUserId || existing.userId,
          remarks: remarks !== undefined && remarks !== null ? remarks : existing.remarks,
        });
        return existing;
      }

      // Otherwise create a new follow-up
      const created = await FollowUp.create({
        companyId: targetCompanyId,
        leadId,
        userId: targetUserId,
        scheduledAt,
        reminderType: "15m",
        status: "PENDING",
        remarks: remarks || `Follow-up scheduled for ${scheduledAt.toLocaleDateString("en-IN")}`,
      });
      return created;
    } else if (nextDate === null || nextDate === "") {
      // If next meeting is explicitly cleared, complete pending follow-ups
      await FollowUp.update(
        { status: "COMPLETED", remarks: "Cleared via lead update" },
        { where: { leadId, status: "PENDING" } }
      );
    }
  } catch (err) {
    console.error(`[followUpSync] Error syncing followup for lead ${leadId}:`, err);
  }
  return null;
}

/**
 * Backfills any existing leads in the database that have a nextFollowupDate
 * but no corresponding FollowUp record, so that Today / Tomorrow / Overdue
 * screens and metrics accurately count all scheduled leads.
 */
async function autoSyncPendingLeadsToFollowUps(companyId) {
  try {
    const where = {
      nextFollowupDate: { [Op.ne]: null },
    };
    if (companyId) {
      where.companyId = companyId;
    }

    const leads = await Lead.findAll({
      where,
      attributes: ["id", "companyId", "assignedEmployeeId", "assignedManagerId", "nextFollowupDate"],
      limit: 500,
    });

    for (const lead of leads) {
      if (!lead.nextFollowupDate) continue;
      const scheduledAt = parseScheduledDate(lead.nextFollowupDate);
      if (!scheduledAt) continue;

      const existing = await FollowUp.findOne({
        where: { leadId: lead.id, status: "PENDING" },
      });

      if (existing) {
        const existingTime = new Date(existing.scheduledAt).getTime();
        const newTime = scheduledAt.getTime();
        if (isNaN(existingTime) || Math.abs(existingTime - newTime) > 60000) {
          await existing.update({
            scheduledAt,
            userId: lead.assignedEmployeeId || lead.assignedManagerId || existing.userId,
          });
        }
      } else {
        await FollowUp.create({
          companyId: lead.companyId,
          leadId: lead.id,
          userId: lead.assignedEmployeeId || lead.assignedManagerId || 1,
          scheduledAt,
          reminderType: "15m",
          status: "PENDING",
          remarks: "Follow-up synced from lead schedule",
        });
      }
    }
  } catch (err) {
    console.error("[followUpSync] autoSyncPendingLeadsToFollowUps error:", err);
  }
}

module.exports = {
  parseScheduledDate,
  syncLeadFollowUp,
  autoSyncPendingLeadsToFollowUps,
};
