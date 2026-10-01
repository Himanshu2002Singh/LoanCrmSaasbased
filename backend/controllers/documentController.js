const { Document, Customer, Lead, Application, User } = require("../models");
const { buildQuery, paginated } = require("../utils/query");
const { logActivity, diffFields } = require("../utils/activity");
const { companyScope, belongsToScope } = require("../middlewares/auth");

/**
 * @desc    Upload a new KYC / Loan document
 * @route   POST /api/documents
 */
const uploadDocument = async (req, res, next) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: "No file uploaded" });
    }

    const { customerId, leadId, applicationId, docType } = req.body;
    if (!docType) {
      return res.status(400).json({ message: "Document type (docType) is required" });
    }

    const fileUrl = `/uploads/documents/${req.file.filename}`;
    const fileName = req.file.originalname;

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

    return res.status(201).json({
      message: "Document uploaded successfully",
      document,
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

module.exports = {
  uploadDocument,
  listDocuments,
  getDocumentById,
  verifyDocument,
  deleteDocument,
};
