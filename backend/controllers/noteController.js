const { Op } = require("sequelize");
const { Note, Lead, Customer, User } = require("../models");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");

const NOTE_INCLUDES = [
  {
    model: User,
    as: "user",
    attributes: ["id", "name", "email", "role"],
    required: false,
  },
  {
    model: Lead,
    as: "lead",
    required: false,
    attributes: ["id", "loanType", "requiredAmount", "status", "assignedEmployeeId"],
    include: [
      {
        model: Customer,
        as: "customer",
        attributes: ["id", "name", "mobile", "city"],
        required: false,
      },
    ],
  },
];

/**
 * GET /api/notes
 * Fetch notes for the authenticated user / company
 */
exports.getNotes = async (req, res) => {
  try {
    const where = {
      ...companyScope(req),
    };

    // Strictly private: Quick notes are only visible to the user who created them (not even admin)
    where.userId = req.user.id;

    if (req.query.leadId) {
      where.leadId = parseInt(req.query.leadId, 10);
    }

    if (req.query.priority && ["LOW", "NORMAL", "HIGH", "URGENT"].includes(req.query.priority.toUpperCase())) {
      where.priority = req.query.priority.toUpperCase();
    }

    if (req.query.isPinned !== undefined) {
      where.isPinned = req.query.isPinned === "true" || req.query.isPinned === true;
    }

    if (req.query.date) {
      where.noteDate = req.query.date;
    }

    if (req.query.search) {
      const q = `%${req.query.search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.like]: q } },
        { content: { [Op.like]: q } },
      ];
    }

    const notes = await Note.findAll({
      where,
      include: NOTE_INCLUDES,
      order: [
        ["isPinned", "DESC"],
        ["noteDate", "DESC"],
        ["createdAt", "DESC"],
      ],
    });

    return res.status(200).json({
      success: true,
      data: notes,
      count: notes.length,
    });
  } catch (error) {
    console.error("[notes] getNotes error:", error);
    return res.status(500).json({ message: "Failed to fetch notes", error: error.message });
  }
};

const validateLeadOwnership = async (req, lead) => {
  if (!lead || !belongsToScope(req, lead)) {
    return { ok: false, message: "Specified lead does not exist in your company" };
  }

  // Superadmin or Company Admin can connect any lead
  if (req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN) {
    return { ok: true };
  }

  // Frontline Employee can only connect leads assigned to them
  if (req.user.role === ROLES.EMPLOYEE) {
    if (lead.assignedEmployeeId === req.user.id || lead.assignedManagerId === req.user.id) {
      return { ok: true };
    }
    return {
      ok: false,
      message: "Aap sirf apni assigned leads ko hi note ke sath connect kar sakte hain.",
    };
  }

  // Manager can connect their own or team's leads
  if (req.user.role === ROLES.MANAGER) {
    if (lead.assignedEmployeeId === req.user.id || lead.assignedManagerId === req.user.id) {
      return { ok: true };
    }
    const subordinates = await User.findAll({
      where: { companyId: req.user.companyId, managerId: req.user.id },
      attributes: ["id"],
      raw: true,
    });
    const teamIds = subordinates.map((u) => u.id);
    if (teamIds.includes(lead.assignedEmployeeId)) {
      return { ok: true };
    }
    return {
      ok: false,
      message: "Aap sirf apni ya apni team ki assigned leads ko hi note ke sath connect kar sakte hain.",
    };
  }

  return { ok: true };
};

/**
 * GET /api/notes/my-leads
 * Returns the leads that the current user can attach to notes:
 * - Admin can see and search any company lead
 * - Employee can only see their assigned leads
 * - Manager can see their own + subordinates' leads
 */
exports.getMyAssignableLeads = async (req, res) => {
  try {
    const where = {
      ...companyScope(req),
    };

    const isAdmin =
      req.user.role === ROLES.SUPERADMIN || req.user.role === ROLES.COMPANY_ADMIN;

    if (!isAdmin) {
      if (req.user.role === ROLES.EMPLOYEE) {
        where[Op.or] = [
          { assignedEmployeeId: req.user.id },
          { assignedManagerId: req.user.id },
        ];
      } else if (req.user.role === ROLES.MANAGER) {
        const subordinates = await User.findAll({
          where: { companyId: req.user.companyId, managerId: req.user.id },
          attributes: ["id"],
          raw: true,
        });
        const teamIds = [req.user.id, ...subordinates.map((u) => u.id)];
        where[Op.or] = [
          { assignedEmployeeId: { [Op.in]: teamIds } },
          { assignedManagerId: req.user.id },
        ];
      }
    }

    if (req.query.search && req.query.search.trim()) {
      const q = `%${req.query.search.trim()}%`;
      const searchOr = [
        { "$customer.name$": { [Op.like]: q } },
        { "$customer.mobile$": { [Op.like]: q } },
        { loanType: { [Op.like]: q } },
      ];
      const parsedId = parseInt(req.query.search.trim(), 10);
      if (!isNaN(parsedId)) {
        searchOr.push({ id: parsedId });
      }
      where[Op.and] = [where[Op.and] || {}, { [Op.or]: searchOr }];
    }

    const leads = await Lead.findAll({
      where,
      attributes: ["id", "loanType", "requiredAmount", "status", "assignedEmployeeId"],
      include: [
        {
          model: Customer,
          as: "customer",
          attributes: ["id", "name", "mobile", "city"],
          required: false,
        },
      ],
      order: [["updatedAt", "DESC"]],
      limit: req.query.limit ? parseInt(req.query.limit, 10) : 100,
    });

    const formatted = leads.map((ld) => ({
      id: ld.id,
      lead_id: ld.id,
      lead_number: `LD-${ld.id}`,
      customer_name: ld.customer?.name || "Customer",
      customer_mobile: ld.customer?.mobile || "",
      customer_city: ld.customer?.city || "",
      loan_type: ld.loanType || "",
      loan_amount: ld.requiredAmount || 0,
      status: ld.status || "",
    }));

    return res.status(200).json({
      success: true,
      isAdmin,
      count: formatted.length,
      data: formatted,
    });
  } catch (error) {
    console.error("[notes] getMyAssignableLeads error:", error);
    return res.status(500).json({ message: "Failed to fetch leads", error: error.message });
  }
};

/**
 * POST /api/notes
 * Create a new personal or work note, optionally connecting a lead
 */
exports.createNote = async (req, res) => {
  try {
    const { title, content, leadId, color, priority, isPinned, noteDate } = req.body;

    if (!title && !content) {
      return res.status(400).json({ message: "Note title or content is required" });
    }

    let validLeadId = null;
    if (leadId) {
      const parsedLeadId = parseInt(leadId, 10);
      const lead = await Lead.findByPk(parsedLeadId);
      const ownershipCheck = await validateLeadOwnership(req, lead);
      if (!ownershipCheck.ok) {
        return res.status(403).json({ message: ownershipCheck.message });
      }
      validLeadId = parsedLeadId;
    }

    const note = await Note.create({
      companyId: req.user.companyId,
      userId: req.user.id,
      leadId: validLeadId,
      title: title?.trim() || "Untitled Note",
      content: content?.trim() || "",
      color: color || "amber",
      priority: priority ? priority.toUpperCase() : "NORMAL",
      isPinned: Boolean(isPinned),
      noteDate: noteDate || new Date().toISOString().split("T")[0],
    });

    const populated = await Note.findByPk(note.id, { include: NOTE_INCLUDES });
    return res.status(201).json({
      success: true,
      message: "Note created successfully",
      data: populated,
    });
  } catch (error) {
    console.error("[notes] createNote error:", error);
    return res.status(500).json({ message: "Failed to create note", error: error.message });
  }
};

/**
 * PUT /api/notes/:id
 * Update an existing note
 */
exports.updateNote = async (req, res) => {
  try {
    const note = await Note.findByPk(req.params.id);
    if (!note || !belongsToScope(req, note)) {
      return res.status(404).json({ message: "Note not found" });
    }

    // Strictly private: Only the creator can edit their note (not even admin)
    if (note.userId !== req.user.id) {
      return res.status(403).json({ message: "You can only edit your own notes" });
    }

    const { title, content, leadId, color, priority, isPinned, noteDate } = req.body;

    let validLeadId = note.leadId;
    if (leadId !== undefined) {
      if (leadId === null || leadId === "") {
        validLeadId = null;
      } else {
        const parsedLeadId = parseInt(leadId, 10);
        const lead = await Lead.findByPk(parsedLeadId);
        const ownershipCheck = await validateLeadOwnership(req, lead);
        if (!ownershipCheck.ok) {
          return res.status(403).json({ message: ownershipCheck.message });
        }
        validLeadId = parsedLeadId;
      }
    }

    await note.update({
      ...(title !== undefined && { title: title.trim() }),
      ...(content !== undefined && { content: content.trim() }),
      ...(color !== undefined && { color }),
      ...(priority !== undefined && { priority: priority.toUpperCase() }),
      ...(isPinned !== undefined && { isPinned: Boolean(isPinned) }),
      ...(noteDate !== undefined && { noteDate }),
      leadId: validLeadId,
    });

    const populated = await Note.findByPk(note.id, { include: NOTE_INCLUDES });
    return res.status(200).json({
      success: true,
      message: "Note updated successfully",
      data: populated,
    });
  } catch (error) {
    console.error("[notes] updateNote error:", error);
    return res.status(500).json({ message: "Failed to update note", error: error.message });
  }
};

/**
 * DELETE /api/notes/:id
 * Delete a note
 */
exports.deleteNote = async (req, res) => {
  try {
    const note = await Note.findByPk(req.params.id);
    if (!note || !belongsToScope(req, note)) {
      return res.status(404).json({ message: "Note not found" });
    }

    // Strictly private: Only the creator can delete their note (not even admin)
    if (note.userId !== req.user.id) {
      return res.status(403).json({ message: "You can only delete your own notes" });
    }

    await note.destroy();
    return res.status(200).json({ success: true, message: "Note deleted successfully" });
  } catch (error) {
    console.error("[notes] deleteNote error:", error);
    return res.status(500).json({ message: "Failed to delete note", error: error.message });
  }
};
