const { Branch, User, Company } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const {
  WORK_START_TIME,
  WORK_END_TIME,
  LATE_THRESHOLD_MINUTES,
} = require("../config/attendanceRules");

const SEARCHABLE = ["name", "city", "state"];
const SORTABLE = ["name", "city", "createdAt"];

const EDITABLE = [
  "name",
  "city",
  "state",
  "address",
  "officeLat",
  "officeLng",
  "geoRadiusMeters",
  "workStartTime",
  "workEndTime",
  "lateBufferMinutes",
  "halfDayHours",
];

const BRANCH_ALIASES = {
  office_lat: "officeLat",
  office_lng: "officeLng",
  geo_radius_meters: "geoRadiusMeters",
  work_start_time: "workStartTime",
  work_end_time: "workEndTime",
  late_buffer_minutes: "lateBufferMinutes",
  half_day_hours: "halfDayHours",
};

const pick = (body, fields, aliases = BRANCH_ALIASES) => {
  const data = {};
  const source = { ...body };
  for (const [from, to] of Object.entries(aliases)) {
    if (source[from] !== undefined && source[to] === undefined) source[to] = source[from];
  }
  for (const field of fields) {
    if (source[field] === undefined) continue;
    data[field] = typeof source[field] === "string" ? source[field].trim() : source[field];
  }
  return data;
};

const validateGeo = (data) => {
  if (data.officeLat !== undefined && data.officeLat !== null && Math.abs(Number(data.officeLat)) > 90) {
    return "officeLat must be between -90 and 90";
  }
  if (data.officeLng !== undefined && data.officeLng !== null && Math.abs(Number(data.officeLng)) > 180) {
    return "officeLng must be between -180 and 180";
  }
  if (data.geoRadiusMeters !== undefined && data.geoRadiusMeters !== null && Number(data.geoRadiusMeters) < 10) {
    return "geoRadiusMeters must be at least 10";
  }
  return null;
};

/**
 * GET /api/branches
 */
exports.getBranches = async (req, res) => {
  try {
    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: SEARCHABLE,
      sortable: SORTABLE,
      defaultSort: ["name", "ASC"],
      defaultLimit: 100,
    });

    Object.assign(where, companyScope(req));

    const { count, rows } = await Branch.findAndCountAll({ where, limit, offset, order });
    return res.status(200).json(paginated({ count, rows, page, limit }));
  } catch (error) {
    console.error("[branches] getBranches error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/branches/:id
 */
exports.getBranchById = async (req, res) => {
  try {
    const branch = await Branch.findByPk(req.params.id);
    if (!branch || !belongsToScope(req, branch)) {
      return res.status(404).json({ message: "Branch not found" });
    }
    return res.status(200).json({ message: "success", data: branch });
  } catch (error) {
    console.error("[branches] getBranchById error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/branches
 */
exports.createBranch = async (req, res) => {
  try {
    const data = pick(req.body, EDITABLE);
    if (!data.name) {
      return res.status(400).json({ message: "name is required" });
    }

    const geoError = validateGeo(data);
    if (geoError) return res.status(400).json({ message: geoError });

    const companyId = req.user.companyId || parseInt(req.body.companyId, 10);
    if (!companyId) {
      return res.status(400).json({ message: "companyId is required" });
    }

    const branch = await Branch.create({ ...data, companyId });

    await logActivity(req, {
      recordType: "Branch",
      recordId: branch.id,
      action: "CREATED",
      newValue: { name: branch.name, city: branch.city },
      companyId,
    });

    return res.status(201).json({ message: "Branch created", data: branch });
  } catch (error) {
    console.error("[branches] createBranch error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/branches/:id
 * Also the write path for the settings screen: the office location and the
 * allowed radius are branch properties.
 */
exports.updateBranch = async (req, res) => {
  try {
    const branch = await Branch.findByPk(req.params.id);
    if (!branch || !belongsToScope(req, branch)) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const data = pick(req.body, EDITABLE);
    const geoError = validateGeo(data);
    if (geoError) return res.status(400).json({ message: geoError });

    const before = { ...branch.get({ plain: true }) };
    await branch.update(data);

    const diff = diffFields(before, { ...branch.get({ plain: true }) }, EDITABLE);
    if (diff) {
      await logActivity(req, {
        recordType: "Branch",
        recordId: branch.id,
        action: "UPDATED",
        ...diff,
        companyId: branch.companyId,
      });
    }

    return res.status(200).json({ message: "Branch updated", data: branch });
  } catch (error) {
    console.error("[branches] updateBranch error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/branches/:id - refused while staff are still posted there,
 * since users.branch_id would silently null out.
 */
exports.deleteBranch = async (req, res) => {
  try {
    const branch = await Branch.findByPk(req.params.id);
    if (!branch || !belongsToScope(req, branch)) {
      return res.status(404).json({ message: "Branch not found" });
    }

    const staffCount = await User.count({ where: { branchId: branch.id } });
    if (staffCount) {
      return res.status(409).json({ message: `${staffCount} user(s) are assigned to this branch` });
    }

    await logActivity(req, {
      recordType: "Branch",
      recordId: branch.id,
      action: "DELETED",
      oldValue: { name: branch.name, city: branch.city },
      companyId: branch.companyId,
    });

    await branch.destroy();
    return res.status(200).json({ message: "Branch deleted" });
  } catch (error) {
    console.error("[branches] deleteBranch error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * GET /api/settings
 *
 * Kept in the old flat shape the settings screen already reads. The location
 * comes from the branch (?branchId= picks one, otherwise the caller's own);
 * the timings come from the shared attendance rules and cannot be edited here.
 */
exports.getSettings = async (req, res) => {
  try {
    const branchId = parseInt(req.query.branchId, 10) || req.user.branchId;
    const branch = branchId
      ? await Branch.findByPk(branchId)
      : await Branch.findOne({ where: companyScope(req), order: [["id", "ASC"]] });

    if (!branch || !belongsToScope(req, branch)) {
      return res.status(404).json({ message: "No branch configured" });
    }

    const companyId = req.user.companyId || (branch ? branch.companyId : 1);
    const company = await Company.findByPk(companyId);

    return res.status(200).json({
      success: true,
      data: {
        branch_id: branch.id,
        branch_name: branch.name,
        company_details: {
          id: company?.id,
          name: company?.name || "",
          gst_number: company?.gstNumber || "",
          pan_number: company?.panNumber || "",
          address: company?.address || "",
          city: company?.city || "",
          state: company?.state || "",
          pincode: company?.pincode || "",
          email: company?.email || "",
          phone: company?.phone || "",
          bank_name: company?.bankName || "",
          account_number: company?.accountNumber || "",
          ifsc_code: company?.ifscCode || "",
          bank_branch: company?.bankBranch || "",
        },
        office_location: {
          lat: branch.officeLat,
          lng: branch.officeLng,
          radius: branch.geoRadiusMeters,
        },
        office_timings: {
          in_time: branch.workStartTime || WORK_START_TIME,
          out_time: branch.workEndTime || WORK_END_TIME,
          late_buffer: branch.lateBufferMinutes !== null && branch.lateBufferMinutes !== undefined ? branch.lateBufferMinutes : LATE_THRESHOLD_MINUTES,
        },
        office_timings_editable: true,
      },
    });
  } catch (error) {
    console.error("[settings] getSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};

/**
 * PUT /api/settings - accepts location and timings to update branch configuration.
 */
exports.updateSettings = async (req, res) => {
  try {
    const { office_location: location, office_timings: timings, branch_id: bodyBranchId, company_details: companyInput } = req.body;

    const branchId = parseInt(bodyBranchId, 10) || req.user.branchId;
    const branch = branchId
      ? await Branch.findByPk(branchId)
      : await Branch.findOne({ where: companyScope(req), order: [["id", "ASC"]] });

    if (!branch || !belongsToScope(req, branch)) {
      return res.status(404).json({ message: "No branch configured" });
    }

    // Update Company GST, Address, and Remittance details if provided
    const companyPayload = companyInput || req.body;
    const companyId = req.user.companyId || (branch ? branch.companyId : 1);
    const company = await Company.findByPk(companyId);
    let updatedCompany = company;
    if (company && companyPayload) {
      const compData = {};
      if (companyPayload.company_name !== undefined) compData.name = companyPayload.company_name;
      if (companyPayload.gst_number !== undefined || companyPayload.gstNumber !== undefined) {
        compData.gstNumber = (companyPayload.gst_number || companyPayload.gstNumber || "").trim().toUpperCase();
      }
      if (companyPayload.pan_number !== undefined || companyPayload.panNumber !== undefined) {
        compData.panNumber = (companyPayload.pan_number || companyPayload.panNumber || "").trim().toUpperCase();
      }
      if (companyPayload.address !== undefined) compData.address = companyPayload.address;
      if (companyPayload.city !== undefined && companyInput) compData.city = companyPayload.city;
      if (companyPayload.state !== undefined && companyInput) compData.state = companyPayload.state;
      if (companyPayload.pincode !== undefined) compData.pincode = companyPayload.pincode;
      if (companyPayload.email !== undefined && companyInput) compData.email = companyPayload.email;
      if (companyPayload.phone !== undefined && companyInput) compData.phone = companyPayload.phone;
      if (companyPayload.bank_name !== undefined || companyPayload.bankName !== undefined) {
        compData.bankName = companyPayload.bank_name || companyPayload.bankName;
      }
      if (companyPayload.account_number !== undefined || companyPayload.accountNumber !== undefined) {
        compData.accountNumber = companyPayload.account_number || companyPayload.accountNumber;
      }
      if (companyPayload.ifsc_code !== undefined || companyPayload.ifscCode !== undefined) {
        compData.ifscCode = (companyPayload.ifsc_code || companyPayload.ifscCode || "").trim().toUpperCase();
      }
      if (companyPayload.bank_branch !== undefined || companyPayload.bankBranch !== undefined) {
        compData.bankBranch = companyPayload.bank_branch || companyPayload.bankBranch;
      }

      if (Object.keys(compData).length > 0) {
        await company.update(compData);
        updatedCompany = company;
      }
    }

    const data = {};
    if (location) {
      if (location.lat !== undefined) data.officeLat = location.lat;
      if (location.lng !== undefined) data.officeLng = location.lng;
      if (location.radius !== undefined) data.geoRadiusMeters = location.radius;
    }

    if (timings) {
      if (timings.in_time !== undefined) data.workStartTime = timings.in_time;
      if (timings.out_time !== undefined) data.workEndTime = timings.out_time;
      if (timings.late_buffer !== undefined) data.lateBufferMinutes = Number(timings.late_buffer);
    }

    const geoError = validateGeo(data);
    if (geoError) return res.status(400).json({ success: false, message: geoError });

    const before = { ...branch.get({ plain: true }) };
    if (Object.keys(data).length > 0) {
      await branch.update(data);
    }

    const diff = diffFields(before, { ...branch.get({ plain: true }) }, EDITABLE);
    if (diff) {
      await logActivity(req, {
        recordType: "Branch",
        recordId: branch.id,
        action: "UPDATED",
        ...diff,
        remarks: "Branch location / timings updated via settings",
        companyId: branch.companyId,
      });
    }

    return res.status(200).json({
      success: true,
      message: "Settings updated successfully",
      data: {
        company_details: {
          id: updatedCompany?.id,
          name: updatedCompany?.name || "",
          gst_number: updatedCompany?.gstNumber || "",
          pan_number: updatedCompany?.panNumber || "",
          address: updatedCompany?.address || "",
          city: updatedCompany?.city || "",
          state: updatedCompany?.state || "",
          pincode: updatedCompany?.pincode || "",
          email: updatedCompany?.email || "",
          phone: updatedCompany?.phone || "",
          bank_name: updatedCompany?.bankName || "",
          account_number: updatedCompany?.accountNumber || "",
          ifsc_code: updatedCompany?.ifscCode || "",
          bank_branch: updatedCompany?.bankBranch || "",
        },
        office_timings: {
          in_time: branch.workStartTime || WORK_START_TIME,
          out_time: branch.workEndTime || WORK_END_TIME,
          late_buffer: branch.lateBufferMinutes !== null && branch.lateBufferMinutes !== undefined ? branch.lateBufferMinutes : LATE_THRESHOLD_MINUTES,
        },
      },
    });
  } catch (error) {
    console.error("[settings] updateSettings error:", error);
    return res.status(500).json({ success: false, message: "Internal Server Error" });
  }
};
