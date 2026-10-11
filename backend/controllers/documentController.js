const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const { Op } = require("sequelize");
const { Document, Customer, Lead, Application, User } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { resolveDiskFilePath, getPublicDocumentUrls } = require("../utils/documentHelper");

/**
 * @desc    Upload a new KYC / Loan document
 * @route   POST /api/documents
 */
const uploadDocument = async (req, res, next) => {
  try {
    const rawFiles = req.files && req.files.length > 0 ? req.files : (req.file ? [req.file] : []);
    if (rawFiles.length === 0) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { customerId, leadId, applicationId, docType } = req.body;
    if (!docType) {
      return res.status(400).json({ message: "Document type (docType) is required" });
    }

    // Check maximum 25MB file size limit
    const maxBytes = 25 * 1024 * 1024;
    for (const f of rawFiles) {
      if (f.size > maxBytes) {
        return res.status(400).json({
          message: `File "${f.originalname}" exceeds the 25MB maximum size limit.`
        });
      }
    }

    const createdDocs = [];
    for (const f of rawFiles) {
      const fileUrl = `/uploads/documents/${f.filename}`;
      const fileName = f.originalname;

      const document = await Document.create({
        companyId: req.companyId,
        customerId: customerId ? parseInt(customerId, 10) : null,
        leadId: leadId ? parseInt(leadId, 10) : null,
        applicationId: applicationId ? parseInt(applicationId, 10) : null,
        docType: docType.trim(),
        fileUrl,
        fileName,
        uploadedBy: req.user.id,
        verificationStatus: "PENDING",
      });

      await logActivity(req, {
        recordType: "Document",
        recordId: document.id,
        action: "DOC_UPLOADED",
        newValue: { docType: document.docType, fileName: document.fileName },
        remarks: `Uploaded ${document.docType} file: ${document.fileName}`,
      });

      createdDocs.push(document);
    }

    return res.status(201).json({
      message: `${createdDocs.length} document(s) uploaded successfully`,
      documents: createdDocs,
      document: createdDocs[0],
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    List documents with filters & pagination
 * @route   GET /api/documents
 */
const listDocuments = async (req, res, next) => {
  try {
    const { customerId, leadId, applicationId, docType, verificationStatus } = req.query;

    const { limit, offset, order, where, page } = buildQuery(req.query, {
      searchable: ["fileName", "docType"],
      sortable: ["createdAt", "docType", "verificationStatus"],
      defaultSort: ["createdAt", "DESC"],
    });

    Object.assign(where, companyScope(req));

    if (customerId) where.customerId = parseInt(customerId, 10);
    if (leadId) where.leadId = parseInt(leadId, 10);
    if (applicationId) where.applicationId = parseInt(applicationId, 10);
    if (docType && docType !== "ALL") where.docType = docType;
    if (verificationStatus && verificationStatus !== "ALL") where.verificationStatus = verificationStatus;

    const { count, rows } = await Document.findAndCountAll({
      where,
      limit,
      offset,
      order,
      include: [
        { model: User, as: "uploader", attributes: ["id", "name", "role"] },
        { model: User, as: "verifiedBy", attributes: ["id", "name", "role"] },
        { model: Customer, as: "customer", attributes: ["id", "name", "mobile"], required: false },
      ],
    });

    const payload = paginated({ count, rows, page, limit });
    payload.documents = payload.data;
    return res.json(payload);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get document details by ID
 * @route   GET /api/documents/:id
 */
const getDocumentById = async (req, res, next) => {
  try {
    const document = await Document.findByPk(req.params.id, {
      include: [
        { model: User, as: "uploader", attributes: ["id", "name", "role"] },
        { model: User, as: "verifiedBy", attributes: ["id", "name", "role"] },
        { model: Customer, as: "customer", required: false },
        { model: Lead, as: "lead", required: false },
        { model: Application, as: "application", required: false },
      ],
    });

    if (!document || !belongsToScope(req, document)) {
      return res.status(404).json({ message: "Document not found" });
    }

    return res.json({ document });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Verify or Reject a document (Ops / Manager action)
 * @route   PATCH /api/documents/:id/verify
 */
const verifyDocument = async (req, res, next) => {
  try {
    const { status, rejectionReason } = req.body;
    const allowed = ["PENDING", "VERIFIED", "REJECTED", "REUPLOAD_REQUIRED"];

    if (!status || !allowed.includes(status)) {
      return res.status(400).json({
        message: `Status must be one of: ${allowed.join(", ")}`,
      });
    }

    if ((status === "REJECTED" || status === "REUPLOAD_REQUIRED") && !rejectionReason) {
      return res.status(400).json({
        message: "Rejection reason is required when rejecting a document",
      });
    }

    const document = await Document.findByPk(req.params.id);
    if (!document || !belongsToScope(req, document)) {
      return res.status(404).json({ message: "Document not found" });
    }

    const before = {
      verificationStatus: document.verificationStatus,
      rejectionReason: document.rejectionReason,
    };

    document.verificationStatus = status;
    document.verifiedBy = req.user.id;
    document.rejectionReason = status === "VERIFIED" ? null : rejectionReason || null;
    await document.save();

    const diff = diffFields(before, document.toJSON(), ["verificationStatus", "rejectionReason"]);
    if (diff) {
      await logActivity(req, {
        recordType: "Document",
        recordId: document.id,
        action: status === "VERIFIED" ? "VERIFIED" : "STATUS_CHANGED",
        ...diff,
        remarks: `Document ${document.docType} marked as ${status}${rejectionReason ? `: ${rejectionReason}` : ""}`,
      });
    }

    return res.json({
      message: `Document ${status.toLowerCase()} successfully`,
      document,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Delete a document
 * @route   DELETE /api/documents/:id
 */
const deleteDocument = async (req, res, next) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document || !belongsToScope(req, document)) {
      return res.status(404).json({ message: "Document not found" });
    }

    const snapshot = { docType: document.docType, fileName: document.fileName };
    await document.destroy();

    await logActivity(req, {
      recordType: "Document",
      recordId: document.id,
      action: "DELETED",
      oldValue: snapshot,
      remarks: `Deleted document ${snapshot.docType}: ${snapshot.fileName}`,
    });

    return res.json({ message: "Document deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download a document directly with original filename
 * @route   GET /api/documents/:id/download
 */
const downloadDocument = async (req, res, next) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (!document.fileUrl) {
      return res.status(404).json({ message: "No file associated with this document" });
    }

    const filePath = resolveDiskFilePath(document.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        message: `File does not exist on server storage: ${document.fileName || document.fileUrl}`,
      });
    }

    const ext = path.extname(filePath) || ".pdf";
    const downloadFileName =
      document.fileName ||
      `${(document.docType || "document").replace(/\s+/g, "_")}${ext}`;

    return res.download(filePath, downloadFileName);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    View a document inline in browser
 * @route   GET /api/documents/:id/view
 */
const viewDocument = async (req, res, next) => {
  try {
    const document = await Document.findByPk(req.params.id);
    if (!document) {
      return res.status(404).json({ message: "Document not found" });
    }

    if (!document.fileUrl) {
      return res.status(404).json({ message: "No file associated with this document" });
    }

    const filePath = resolveDiskFilePath(document.fileUrl);
    if (!filePath || !fs.existsSync(filePath)) {
      return res.status(404).json({
        message: `File does not exist on server storage: ${document.fileName || document.fileUrl}`,
      });
    }

    return res.sendFile(filePath);
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download all documents for a Lead as a single ZIP archive
 * @route   GET /api/documents/lead/:leadId/download-all
 */
const downloadAllLeadDocuments = async (req, res, next) => {
  try {
    const { leadId } = req.params;
    const lead = await Lead.findByPk(leadId, {
      include: [{ model: Customer, as: "customer" }],
    });

    if (!lead) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const leadApps = await Application.findAll({
      where: { leadId: parseInt(leadId, 10) },
      attributes: ["id"],
    });
    const appIds = leadApps.map((a) => a.id);

    const docs = await Document.findAll({
      where: {
        [Op.or]: [
          { leadId: parseInt(leadId, 10) },
          ...(appIds.length > 0 ? [{ applicationId: { [Op.in]: appIds } }] : []),
        ],
      },
    });

    if (!docs || docs.length === 0) {
      return res.status(404).json({ message: "No documents found for this lead" });
    }

    const customerName = (lead.customer?.name || "Customer").replace(/[^a-zA-Z0-9_-]/g, "_");
    const zipFileName = `Lead_${lead.id}_${customerName}_Documents.zip`;

    res.attachment(zipFileName);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("[archive error]", err);
      if (!res.headersSent) res.status(500).send({ message: err.message });
    });

    archive.pipe(res);

    let addedCount = 0;
    const addedNames = new Set();

    for (const doc of docs) {
      const diskPath = resolveDiskFilePath(doc.fileUrl);
      if (diskPath && fs.existsSync(diskPath)) {
        const ext = path.extname(diskPath) || ".pdf";
        let entryName = doc.fileName || `${doc.docType}${ext}`;
        // Prevent duplicate file name collisions in the zip
        if (addedNames.has(entryName)) {
          entryName = `${doc.docType}_${doc.id}_${entryName}`;
        }
        addedNames.add(entryName);
        archive.file(diskPath, { name: entryName });
        addedCount++;
      }
    }

    if (addedCount === 0) {
      archive.append("No readable document files found on disk.", { name: "README.txt" });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Download all documents for an Application as a single ZIP archive
 * @route   GET /api/documents/application/:applicationId/download-all
 */
const downloadAllApplicationDocuments = async (req, res, next) => {
  try {
    const { applicationId } = req.params;
    const application = await Application.findByPk(applicationId, {
      include: [
        { model: Customer, as: "customer" },
        { model: Document, as: "documents" },
      ],
    });

    if (!application) {
      return res.status(404).json({ message: "Application not found" });
    }

    let docs = application.documents || [];
    if (docs.length === 0) {
      // Fallback: check documents linked by applicationId
      docs = await Document.findAll({
        where: { applicationId: parseInt(applicationId, 10) },
      });
    }

    if (application.leadId) {
      // Also combine KYC documents linked by parent leadId
      const leadDocs = await Document.findAll({
        where: { leadId: application.leadId },
      });
      const seenIds = new Set(docs.map((d) => d.id));
      for (const ld of leadDocs) {
        if (!seenIds.has(ld.id)) {
          docs.push(ld);
          seenIds.add(ld.id);
        }
      }
    }

    if (!docs || docs.length === 0) {
      return res.status(404).json({ message: "No documents attached to this loan application" });
    }

    const appRef = (application.applicationNumber || `APP_${application.id}`).replace(/[^a-zA-Z0-9_-]/g, "_");
    const zipFileName = `${appRef}_Docket_Documents.zip`;

    res.attachment(zipFileName);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("[archive error]", err);
      if (!res.headersSent) res.status(500).send({ message: err.message });
    });

    archive.pipe(res);

    let addedCount = 0;
    const addedNames = new Set();

    for (const doc of docs) {
      const diskPath = resolveDiskFilePath(doc.fileUrl);
      if (diskPath && fs.existsSync(diskPath)) {
        const ext = path.extname(diskPath) || ".pdf";
        let entryName = doc.fileName || `${doc.docType}${ext}`;
        if (addedNames.has(entryName)) {
          entryName = `${doc.docType}_${doc.id}_${entryName}`;
        }
        addedNames.add(entryName);
        archive.file(diskPath, { name: entryName });
        addedCount++;
      }
    }

    if (addedCount === 0) {
      archive.append("No readable document files found on disk.", { name: "README.txt" });
    }

    await archive.finalize();
  } catch (error) {
    next(error);
  }
};

module.exports = {
  uploadDocument,
  listDocuments,
  getDocumentById,
  verifyDocument,
  deleteDocument,
  downloadDocument,
  viewDocument,
  downloadAllLeadDocuments,
  downloadAllApplicationDocuments,
};

