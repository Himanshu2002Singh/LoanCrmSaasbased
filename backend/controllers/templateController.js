const fs = require("fs");
const path = require("path");
const { Op } = require("sequelize");
const { Document, User } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");

/**
 * Templates are company-level Document rows: customerId, leadId and
 * applicationId stay null and docType carries this marker, so every query here
 * must filter on it or real customer documents would leak into the list (and
 * could be deleted through it).
 */
const TEMPLATE_DOC_TYPE = "TEMPLATE";

const SEARCHABLE = ["fileName"];
const SORTABLE = ["fileName", "createdAt"];
// The template screen still sends sortBy=name; the column behind it is file_name.
const SORT_ALIASES = { name: "fileName" };
const UPLOAD_DIR = path.join(__dirname, "..", "uploads", "templates");

/**
 * Files are stored as a path and served as an absolute URL, so the same row
 * works whichever host the API is reached on.
 */
const toPublicUrl = (req, fileUrl) => {
  if (!fileUrl) return null;
  if (fileUrl.startsWith("http")) return fileUrl;
  return `${req.protocol}://${req.get("host")}${fileUrl}`;
};

const removeStoredFile = (fileUrl) => {
  if (!fileUrl || !fileUrl.startsWith("/uploads/templates/")) return;
  const filePath = path.join(UPLOAD_DIR, path.basename(fileUrl));
  fs.unlink(filePath, (err) => {
    if (err && err.code !== "ENOENT") {
      console.error("[templates] could not remove file:", err.message);
    }
  });
};

/**
 * There is no file-type column, so the type is read back off the stored path
 * (the display name the caller typed need not carry an extension).
 */
const fileTypeOf = (row) => {
  const ext = path.extname(row.fileUrl || "") || path.extname(row.fileName || "");
  return ext ? ext.replace(".", "").toUpperCase() : null;
};

const serialize = (req, row) => {
  const fileType = fileTypeOf(row);
  const fileUrl = toPublicUrl(req, row.fileUrl);
  return {
    id: row.id,
    template_id: row.id,
    name: row.fileName,
    fileType,
    file_type: fileType,
    fileUrl,
    file_url: fileUrl,
    uploaded_by: row.uploadedBy,
    uploader: row.uploader?.name || null,
    createdAt: row.createdAt,
  };
};

const withSortAlias = (query = {}) => {
  const alias = SORT_ALIASES[query.sortBy];
  return alias ? { ...query, sortBy: alias } : query;
};

/**
 * GET /api/templates
 */
exports.getTemplates = async (req, res) => {
  try {
    const { limit, offset, order, where, page } = buildQuery(withSortAlias(req.query), {
      searchable: SEARCHABLE,
      sortable: SORTABLE,
      defaultSort: ["createdAt", "DESC"],
      defaultLimit: 100,
    });

    Object.assign(where, companyScope(req), { docType: TEMPLATE_DOC_TYPE });

    if (req.query.fileType) {
      // Match on the extension of the stored path, the only place the type lives.
      where.fileUrl = { [Op.like]: `%.${String(req.query.fileType).trim()}` };
    }

    const { count, rows } = await Document.findAndCountAll({
      where,
      include: [{ model: User, as: "uploader", attributes: ["id", "name"], required: false }],
      limit,
      offset,
      order,
      distinct: true,
    });

    const payload = paginated({ count, rows: rows.map((r) => serialize(req, r)), page, limit });
    payload.pagination.totalItems = count;
    // The template screen reads a bare `templates` array.
    payload.templates = payload.data;
    return res.status(200).json(payload);
  } catch (error) {
    console.error("[templates] getTemplates error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * POST /api/templates - multipart, field name `file`.
 */
exports.createTemplate = async (req, res) => {
  try {
    const name = (req.body.name || "").trim();
    if (!name) {
      if (req.file) removeStoredFile(`/uploads/templates/${req.file.filename}`);
      return res.status(400).json({ message: "name is required" });
    }
    // file_url, file_name and uploaded_by are all NOT NULL, so a row cannot be
    // written without an upload behind it.
    if (!req.file) {
      return res.status(400).json({ message: "A template file is required" });
    }

    const template = await Document.create({
      companyId: req.user.companyId,
      customerId: null,
      leadId: null,
      applicationId: null,
      docType: TEMPLATE_DOC_TYPE,
      fileName: name,
      fileUrl: `/uploads/templates/${req.file.filename}`,
      uploadedBy: req.user.id,
    });

    await logActivity(req, {
      recordType: "Document",
      recordId: template.id,
      action: "DOC_UPLOADED",
      newValue: { name: template.fileName, fileType: fileTypeOf(template) },
      companyId: req.user.companyId,
    });

    return res.status(201).json({ message: "Template created", data: serialize(req, template) });
  } catch (error) {
    if (req.file) removeStoredFile(`/uploads/templates/${req.file.filename}`);
    console.error("[templates] createTemplate error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * PUT /api/templates/:id - renames the template; replace the file by uploading
 * a new template and deleting this one.
 */
exports.updateTemplate = async (req, res) => {
  try {
    const template = await Document.findOne({
      where: { id: req.params.id, docType: TEMPLATE_DOC_TYPE },
    });
    if (!template || !belongsToScope(req, template)) {
      return res.status(404).json({ message: "Template not found" });
    }

    if (req.body.name !== undefined) {
      const name = String(req.body.name).trim();
      if (!name) {
        return res.status(400).json({ message: "name cannot be empty" });
      }
      await template.update({ fileName: name });
    }

    return res.status(200).json({ message: "Template updated", data: serialize(req, template) });
  } catch (error) {
    console.error("[templates] updateTemplate error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};

/**
 * DELETE /api/templates/:id - removes the row and the file behind it.
 */
exports.deleteTemplate = async (req, res) => {
  try {
    const template = await Document.findOne({
      where: { id: req.params.id, docType: TEMPLATE_DOC_TYPE },
    });
    if (!template || !belongsToScope(req, template)) {
      return res.status(404).json({ message: "Template not found" });
    }

    await logActivity(req, {
      recordType: "Document",
      recordId: template.id,
      action: "DELETED",
      oldValue: { name: template.fileName },
      companyId: template.companyId,
    });

    const fileUrl = template.fileUrl;
    await template.destroy();
    removeStoredFile(fileUrl);

    return res.status(200).json({ message: "Template deleted" });
  } catch (error) {
    console.error("[templates] deleteTemplate error:", error);
    return res.status(500).json({ message: "Internal Server Error", error: error.message });
  }
};
