const crypto = require("crypto");
const path = require("path");
const fs = require("fs");
const archiver = require("archiver");
const { Op } = require("sequelize");
const {
  LeadDocumentRequest,
  Document,
  Lead,
  Customer,
  Company,
  User,
  MasterConfig,
  ActivityLog,
  Notification,
  EmailTemplate,
} = require("../models");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { ROLES } = require("../constants/roles");
const { logActivity } = require("../utils/activity");
const { sendMail, interpolate } = require("../utils/emailService");
const { resolveDiskFilePath, getPublicApiBaseUrl } = require("../utils/documentHelper");

// Standard popular loan document templates for Indian NBFC / Bank loans
const STANDARD_DOC_PRESETS = {
  SALARIED: [
    { title: "PAN Card", docType: "PAN_CARD", category: "KYC", isRequired: true, description: "Clear copy of Applicant PAN Card" },
    { title: "Aadhaar Card (Front & Back)", docType: "AADHAAR_CARD", category: "KYC", isRequired: true, description: "Front and back side of Aadhaar card" },
    { title: "Latest 3 Months Salary Slips", docType: "SALARY_SLIPS", category: "INCOME", isRequired: true, description: "Official salary slips with company stamp/logo" },
    { title: "Latest 6 Months Bank Statement", docType: "BANK_STATEMENT", category: "BANKING", isRequired: true, description: "Salary credit account statement (PDF downloaded from netbanking)" },
    { title: "Form 16 / Latest 2 Years ITR", docType: "FORM_16", category: "INCOME", isRequired: false, description: "Form 16 Part A & B or ITR acknowledgement" },
    { title: "Current Address Proof", docType: "ADDRESS_PROOF", category: "KYC", isRequired: false, description: "Electricity bill, Rent agreement or Gas bill (Last 2 months)" },
    { title: "Passport Size Photograph", docType: "PHOTO", category: "KYC", isRequired: false, description: "Recent clear color photograph" },
  ],
  BUSINESS: [
    { title: "PAN Card (Individual & Entity)", docType: "PAN_CARD", category: "KYC", isRequired: true, description: "Proprietor / Partner / Director PAN card" },
    { title: "Aadhaar Card of Applicant", docType: "AADHAAR_CARD", category: "KYC", isRequired: true, description: "Front & back of Aadhaar card" },
    { title: "Last 2-3 Years ITR with Computation", docType: "ITR_RETURNS", category: "INCOME", isRequired: true, description: "Complete ITR with balance sheet, P&L, and Audit report" },
    { title: "Last 12 Months Current Bank Statement", docType: "BANK_STATEMENT", category: "BANKING", isRequired: true, description: "Primary business operating bank account statement (PDF)" },
    { title: "GST Certificate & Latest 1 Year Returns", docType: "GST_CERTIFICATE", category: "BUSINESS", isRequired: true, description: "GST registration & GSTR-3B filed returns" },
    { title: "Business Proof / MSME / Udyam", docType: "BUSINESS_PROOF", category: "BUSINESS", isRequired: true, description: "Udyam Aadhar, Shop Act License, or Incorporation Certificate" },
    { title: "Office / Business Electricity Bill", docType: "ADDRESS_PROOF", category: "KYC", isRequired: false, description: "Latest electricity bill of business premises" },
  ],
  PROPERTY: [
    { title: "Applicant PAN & Aadhaar", docType: "KYC_COMBO", category: "KYC", isRequired: true, description: "KYC documents of primary applicant and co-applicants" },
    { title: "Complete Property Chain / Title Deed", docType: "PROPERTY_CHAIN", category: "PROPERTY", isRequired: true, description: "Sale deed, conveyance deed, or registry copy" },
    { title: "Sanctioned Map / Building Plan", docType: "SANCTION_MAP", category: "PROPERTY", isRequired: true, description: "Approved building plan from local municipal authority" },
    { title: "Latest Property Tax Receipt", docType: "PROPERTY_TAX", category: "PROPERTY", isRequired: false, description: "Latest paid property tax / mutation receipt" },
    { title: "Allotment Letter / Agreement to Sell", docType: "AGREEMENT_SALE", category: "PROPERTY", isRequired: false, description: "Builder allotment letter or registered sale agreement" },
  ],
  BASIC_KYC: [
    { title: "PAN Card", docType: "PAN_CARD", category: "KYC", isRequired: true, description: "Applicant PAN card" },
    { title: "Aadhaar Card", docType: "AADHAAR_CARD", category: "KYC", isRequired: true, description: "Applicant Aadhaar card" },
    { title: "Passport Photo", docType: "PHOTO", category: "KYC", isRequired: true, description: "Recent passport photo" },
    { title: "Electricity / Utility Bill", docType: "ADDRESS_PROOF", category: "KYC", isRequired: false, description: "Current residence address proof" },
  ],
};

/**
 * @desc    Get master document types and suggested presets
 * @route   GET /api/document-requests/config-docs
 */
const getConfigDocs = async (req, res, next) => {
  try {
    const masterConfigs = await MasterConfig.findAll({
      where: {
        companyId: req.companyId,
        configType: "DOC_TYPE",
        isActive: true,
      },
      order: [["orderIndex", "ASC"]],
    });

    const masterDocs = masterConfigs.map((cfg) => ({
      title: cfg.label,
      docType: cfg.value,
      category: "MASTER",
      isRequired: false,
      description: `Official ${cfg.label} required for loan processing`,
    }));

    return res.json({
      success: true,
      masterDocs,
      presets: STANDARD_DOC_PRESETS,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Generate a new Document Upload Link for a Lead
 * @route   POST /api/document-requests
 */
const createDocumentRequest = async (req, res, next) => {
  try {
    const { leadId, title, requiredDocs, expiryDays, customMessage } = req.body;

    if (!leadId) {
      return res.status(400).json({ message: "Lead ID is required" });
    }

    if (!Array.isArray(requiredDocs) || requiredDocs.length === 0) {
      return res.status(400).json({ message: "Please select at least one document to request" });
    }

    // Verify lead exists and belongs to company
    const lead = await Lead.findByPk(leadId, {
      include: [
        { model: Customer, as: "customer" },
        { model: User, as: "assignedEmployee", attributes: ["id", "name", "phone", "email"] },
        { model: User, as: "assignedManager", attributes: ["id", "name", "phone", "email"] },
        { model: Company, as: "company", attributes: ["id", "name", "slug", "phone", "email"] },
      ],
    });

    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    // Check staff permissions
    if (req.user.role === ROLES.EMPLOYEE) {
      if (
        !req.permissions?.viewAllLeads &&
        lead.assignedEmployeeId !== req.user.id &&
        lead.assignedManagerId !== req.user.id
      ) {
        return res.status(403).json({ message: "You do not have access to manage this lead" });
      }
    }

    // Generate unique, secure token (48-char random hex)
    const token = crypto.randomBytes(24).toString("hex");

    // Calculate expiry date
    let expiresAt = null;
    const days = parseInt(expiryDays, 10);
    if (!isNaN(days) && days > 0) {
      expiresAt = new Date(Date.now() + days * 24 * 60 * 60 * 1000);
    }

    // Format normalized requiredDocs array
    const formattedDocs = requiredDocs.map((doc, idx) => ({
      id: doc.id || `doc_${Date.now()}_${idx + 1}`,
      title: String(doc.title || doc.docType || `Document ${idx + 1}`).trim(),
      docType: String(doc.docType || "OTHER_DOCUMENT").toUpperCase().replace(/\s+/g, "_"),
      category: doc.category || "KYC",
      isRequired: doc.isRequired !== false,
      description: doc.description || "",
      status: "PENDING",
      documentId: null,
      fileName: null,
      fileUrl: null,
      fileSize: null,
      uploadedAt: null,
    }));

    const request = await LeadDocumentRequest.create({
      companyId: req.companyId,
      leadId: lead.id,
      token,
      title: title?.trim() || "Loan KYC & Verification Documents Request",
      requiredDocs: formattedDocs,
      status: "PENDING",
      expiresAt,
      createdById: req.user.id,
      customMessage: customMessage?.trim() || null,
      accessCount: 0,
    });

    // Activity log using safe helper
    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "UPDATED",
      remarks: `Generated secure document collection link for ${formattedDocs.length} documents (${formattedDocs.map((d) => d.title).join(", ")})`,
    });

    // Build pre-composed WhatsApp message
    const customerName = lead.customer?.name || "Valued Customer";
    const companyName = lead.company?.name || "CapitalCare Financial";
    const loanInfo = lead.loanType ? `${lead.loanType} application` : "loan application";

    const docBulletList = formattedDocs
      .map((d) => `• ${d.title}${d.isRequired ? " *(Required)*" : ""}`)
      .join("\n");

    const expiryText = expiresAt
      ? `\n⏳ *Link valid till:* ${new Date(expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}`
      : "";

    const clientPortalUrl = process.env.CLIENT_PORTAL_URL || "https://loan-crm-saasbased.vercel.app";
    const liveUploadUrl = `${clientPortalUrl.replace(/\/+$/, "")}/upload-docs/${token}`;
    const whatsappMessage = `Dear ${customerName},\n\nGreetings from *${companyName}*!\n\nTo proceed with your *${loanInfo}*, please upload the required documents using our secure portal link below:\n\n🔗 *Upload Link:* ${liveUploadUrl}\n\n📋 *Requested Documents:*\n${docBulletList}${expiryText}\n\n💡 *Note:* You can take photos from your phone or upload PDF files. No login or password is required.\n\nThank you,\n*${companyName}*`;

    return res.status(201).json({
      success: true,
      message: "Secure document collection link generated successfully",
      data: {
        ...request.toJSON(),
        uploadUrl: liveUploadUrl,
        customerPhone: lead.customer?.mobile || null,
        customerName,
        whatsappMessageTemplate: whatsappMessage,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Get all document requests for a specific lead
 * @route   GET /api/document-requests/lead/:leadId
 */
const getRequestsByLead = async (req, res, next) => {
  try {
    const { leadId } = req.params;

    const lead = await Lead.findByPk(leadId);
    if (!lead || !belongsToScope(req, lead)) {
      return res.status(404).json({ message: "Lead not found" });
    }

    const requests = await LeadDocumentRequest.findAll({
      where: {
        leadId: parseInt(leadId, 10),
        companyId: req.companyId,
      },
      order: [["createdAt", "DESC"]],
      include: [
        { model: User, as: "creator", attributes: ["id", "name", "role", "email"] },
      ],
    });

    // Check expiry dynamically
    const now = new Date();
    const enriched = requests.map((reqItem) => {
      const data = reqItem.toJSON();
      const isExpired = data.expiresAt && new Date(data.expiresAt) < now;
      const totalDocs = (data.requiredDocs || []).length;
      const uploadedDocs = (data.requiredDocs || []).filter((d) => d.status === "UPLOADED").length;
      const requiredPending = (data.requiredDocs || []).filter((d) => d.isRequired && d.status !== "UPLOADED").length;

      return {
        ...data,
        isExpired,
        totalDocs,
        uploadedDocs,
        requiredPending,
        isCompleted: totalDocs > 0 && requiredPending === 0,
      };
    });

    return res.json({
      success: true,
      data: enriched,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Cancel / Expire a document request link
 * @route   PATCH /api/document-requests/:id/cancel
 */
const cancelDocumentRequest = async (req, res, next) => {
  try {
    const request = await LeadDocumentRequest.findByPk(req.params.id);
    if (!request || !belongsToScope(req, request)) {
      return res.status(404).json({ message: "Document request not found" });
    }

    request.status = "CANCELLED";
    await request.save();

    await logActivity(req, {
      recordType: "Lead",
      recordId: request.leadId,
      action: "UPDATED",
      remarks: `Cancelled document upload link #${request.id} (Token: ${request.token.substring(0, 8)}...)`,
    });

    return res.json({
      success: true,
      message: "Document upload link has been cancelled",
      data: request,
    });
  } catch (error) {
    next(error);
  }
};

// ==========================================
// PUBLIC CUSTOMER PORTAL CONTROLLER METHODS
// ==========================================

/**
 * @desc    Fetch public upload request details for customer portal
 * @route   GET /api/public/document-requests/:token
 */
const getPublicRequest = async (req, res, next) => {
  try {
    const { token } = req.params;

    if (!token) {
      return res.status(400).json({ message: "Invalid request token" });
    }

    const request = await LeadDocumentRequest.findOne({
      where: { token },
      include: [
        {
          model: Lead,
          as: "lead",
          include: [
            { model: Customer, as: "customer" },
            { model: User, as: "assignedEmployee", attributes: ["name", "phone", "email"] },
          ],
        },
        {
          model: Company,
          as: "company",
          attributes: ["id", "name", "slug", "logoUrl", "phone", "email"],
        },
      ],
    });

    if (!request) {
      return res.status(404).json({
        code: "LINK_NOT_FOUND",
        message: "This document upload link is invalid or does not exist.",
      });
    }

    if (request.status === "CANCELLED") {
      return res.status(410).json({
        code: "LINK_CANCELLED",
        message: "This document upload link has been cancelled or deactivated by the loan team.",
      });
    }

    const now = new Date();
    if (request.expiresAt && new Date(request.expiresAt) < now) {
      if (request.status !== "EXPIRED") {
        request.status = "EXPIRED";
        await request.save();
      }
      return res.status(410).json({
        code: "LINK_EXPIRED",
        message: "This document upload link has expired. Please contact your loan manager to generate a new link.",
        expiresAt: request.expiresAt,
        company: request.company,
      });
    }

    // Increment access tracking
    request.accessCount += 1;
    request.lastAccessedAt = now;
    await request.save();

    // Prepare safe public response
    const lead = request.lead;
    const customer = lead?.customer;

    // Mask phone number for privacy: e.g. "******4321"
    const rawMobile = customer?.mobile || "";
    const maskedMobile =
      rawMobile.length > 4
        ? `${"*".repeat(rawMobile.length - 4)}${rawMobile.slice(-4)}`
        : rawMobile;

    const totalDocs = (request.requiredDocs || []).length;
    const uploadedDocs = (request.requiredDocs || []).filter((d) => d.status === "UPLOADED").length;
    const allCompleted = totalDocs > 0 && uploadedDocs === totalDocs;

    return res.json({
      success: true,
      data: {
        token: request.token,
        title: request.title,
        status: request.status,
        expiresAt: request.expiresAt,
        customMessage: request.customMessage,
        requiredDocs: request.requiredDocs || [],
        totalDocs,
        uploadedDocs,
        allCompleted,
        company: {
          name: request.company?.name || "Loan Financial Services",
          logoUrl: request.company?.logoUrl || null,
          phone: request.company?.phone || null,
          email: request.company?.email || null,
        },
        leadSummary: {
          leadId: lead?.id,
          customerName: customer?.name || "Customer",
          customerMobile: maskedMobile,
          loanType: lead?.loanType || "Loan Application",
          requiredAmount: lead?.requiredAmount || null,
          relationshipManager: lead?.assignedEmployee?.name || "Loan Officer",
        },
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Customer uploads a document for a specific slot via public link
 * @route   POST /api/public/document-requests/:token/upload
 */
const publicUploadDocument = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { docSlotId, docType } = req.body;

    if (!req.file) {
      return res.status(400).json({ message: "No document file was uploaded" });
    }

    const request = await LeadDocumentRequest.findOne({
      where: { token },
      include: [
        {
          model: Lead,
          as: "lead",
          include: [{ model: Customer, as: "customer" }],
        },
        { model: Company, as: "company" },
      ],
    });

    if (!request) {
      return res.status(404).json({ message: "Upload request link not found" });
    }

    if (request.status === "CANCELLED") {
      return res.status(410).json({ message: "This upload link has been cancelled" });
    }

    if (request.expiresAt && new Date(request.expiresAt) < new Date()) {
      return res.status(410).json({ message: "This upload link has expired" });
    }

    const lead = request.lead;
    if (!lead) {
      return res.status(404).json({ message: "Associated lead record not found" });
    }

    // Correct fileUrl pointing to /uploads/documents/...
    const fileUrl = `/uploads/documents/${req.file.filename}`;
    const fileName = req.file.originalname;

    // Resolve doc type
    let chosenDocType = docType || "OTHER";
    let slotTitle = "Document";

    const requiredDocs = [...(request.requiredDocs || [])];
    const slotIndex = requiredDocs.findIndex(
      (d) => d.id === docSlotId || d.docType === docType
    );

    if (slotIndex !== -1) {
      chosenDocType = requiredDocs[slotIndex].docType || chosenDocType;
      slotTitle = requiredDocs[slotIndex].title || slotTitle;
    }

    // 1. Create or replace Document record
    const document = await Document.create({
      companyId: request.companyId,
      customerId: lead.customerId,
      leadId: lead.id,
      docType: chosenDocType,
      fileUrl,
      fileName,
      uploadedBy: null, // Null indicates self-uploaded by customer
      isCustomerUpload: true,
      customerRequestId: request.id,
      verificationStatus: "PENDING",
    });

    // 2. Update the slot in requiredDocs JSON
    if (slotIndex !== -1) {
      requiredDocs[slotIndex] = {
        ...requiredDocs[slotIndex],
        status: "UPLOADED",
        documentId: document.id,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
      };
    } else {
      // If slot wasn't predefined, add it to requiredDocs
      requiredDocs.push({
        id: `custom_${Date.now()}`,
        title: slotTitle,
        docType: chosenDocType,
        category: "CUSTOMER_UPLOAD",
        isRequired: false,
        status: "UPLOADED",
        documentId: document.id,
        fileName: document.fileName,
        fileUrl: document.fileUrl,
        fileSize: req.file.size,
        uploadedAt: new Date().toISOString(),
      });
    }

    // 3. Check overall completion
    const requiredPending = requiredDocs.filter(
      (d) => d.isRequired && d.status !== "UPLOADED"
    ).length;

    request.requiredDocs = requiredDocs;
    if (requiredPending === 0) {
      request.status = "COMPLETED";
      request.completedAt = new Date();
    } else {
      request.status = "PARTIALLY_UPLOADED";
    }

    await request.save();

    // 4. Log Activity on Lead
    await ActivityLog.create({
      companyId: request.companyId,
      recordType: "Lead",
      recordId: lead.id,
      action: "DOC_UPLOADED",
      remarks: `Customer uploaded ${slotTitle} (${fileName}) via secure upload link`,
    }).catch((err) => console.error("ActivityLog doc uploaded error:", err.message));

    // 5. Notify Staff (Assigned Employee, Assigned Manager, & Operations Team)
    const customerName = lead.customer?.name || "Applicant";
    const notificationTitle = "📄 Document Uploaded by Customer";
    const notificationMsg = `Customer ${customerName} uploaded "${slotTitle}" for Lead #${lead.id} (${lead.loanType || "Loan"}).`;

    const recipients = new Set();
    if (lead.assignedEmployeeId) recipients.add(lead.assignedEmployeeId);
    if (lead.assignedManagerId) recipients.add(lead.assignedManagerId);

    // Find operations team members in the company
    const opsUsers = await User.findAll({
      where: {
        companyId: request.companyId,
        role: [ROLES.OPS, ROLES.COMPANY_ADMIN],
        status: "active",
      },
      attributes: ["id"],
    });
    for (const u of opsUsers) {
      recipients.add(u.id);
    }

    for (const recipientId of recipients) {
      await Notification.create({
        companyId: request.companyId,
        recipientId,
        title: notificationTitle,
        message: notificationMsg,
        type: "doc_uploaded",
        recordId: lead.id,
        isRead: false,
      }).catch((err) => console.error("Error creating notification:", err.message));
    }

    return res.status(201).json({
      success: true,
      message: `"${slotTitle}" uploaded successfully!`,
      data: {
        document,
        slotId: docSlotId,
        status: request.status,
        requiredPending,
        isCompleted: requiredPending === 0,
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Customer submits optional note / confirms submission
 * @route   POST /api/public/document-requests/:token/submit-notes
 */
const publicSubmitNotes = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { customerNotes } = req.body;

    const request = await LeadDocumentRequest.findOne({ where: { token } });
    if (!request) {
      return res.status(404).json({ message: "Document upload request not found" });
    }

    request.customerNotes = customerNotes?.trim() || null;
    await request.save();

    if (request.customerNotes) {
      await ActivityLog.create({
        companyId: request.companyId,
        recordType: "Lead",
        recordId: request.leadId,
        action: "UPDATED",
        remarks: `Customer added note on document upload link: "${request.customerNotes.substring(0, 100)}"`,
      }).catch((err) => console.error("ActivityLog note error:", err.message));
    }

    return res.json({
      success: true,
      message: "Notes submitted successfully",
      customerNotes: request.customerNotes,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Send document collection link to customer via email
 * @route   POST /api/document-requests/:id/send-email
 */
const sendDocumentRequestEmail = async (req, res, next) => {
  try {
    const { id } = req.params;
    const { recipientEmail, customNote } = req.body || {};

    const request = await LeadDocumentRequest.findByPk(id, {
      include: [
        {
          model: Lead,
          as: "lead",
          include: [
            { model: Customer, as: "customer" },
            { model: User, as: "assignedEmployee", attributes: ["name", "phone", "email"] },
            { model: Company, as: "company", attributes: ["id", "name", "phone", "email", "logoUrl"] },
          ],
        },
        { model: Company, as: "company" },
      ],
    });

    if (!request || !belongsToScope(req, request)) {
      return res.status(404).json({ message: "Document request not found" });
    }

    const lead = request.lead;
    const customer = lead?.customer;
    const company = request.company || lead?.company;

    const toEmail = recipientEmail?.trim() || customer?.email;
    if (!toEmail) {
      return res.status(400).json({
        message: "Customer does not have an email address registered. Please provide an email recipient.",
      });
    }

    const clientPortalUrl = process.env.CLIENT_PORTAL_URL || "https://loan-crm-saasbased.vercel.app";
    const uploadUrl = `${clientPortalUrl.replace(/\/+$/, "")}/upload-docs/${request.token}`;
    const customerName = customer?.name || "Valued Applicant";
    const companyName = company?.name || "CapitalCare Financial";
    const loanProduct = lead?.loanType || "Loan";

    const docsListHtml = (request.requiredDocs || [])
      .map(
        (d) => `
        <tr style="border-bottom: 1px solid #e2e8f0;">
          <td style="padding: 10px 14px; font-weight: 600; color: #1e293b; font-size: 13.5px;">
            ${d.title}
          </td>
          <td style="padding: 10px 14px; color: #64748b; font-size: 12px;">
            ${d.category || "KYC"}
          </td>
          <td style="padding: 10px 14px; text-align: right;">
            <span style="display: inline-block; padding: 2px 8px; border-radius: 9999px; font-size: 11px; font-weight: 700; background: ${d.isRequired ? "#fef2f2" : "#f1f5f9"}; color: ${d.isRequired ? "#b91c1c" : "#475569"}; border: 1px solid ${d.isRequired ? "#fecaca" : "#e2e8f0"};">
              ${d.isRequired ? "Required *" : "Optional"}
            </span>
          </td>
        </tr>`
      )
      .join("");

    const expiryNotice = request.expiresAt
      ? `<div style="background: #fffbeb; border: 1px solid #fde68a; border-radius: 8px; padding: 12px 16px; margin: 20px 0; font-size: 12.5px; color: #92400e;">
          ⏳ <strong>Link Validity:</strong> This secure link expires on <strong>${new Date(request.expiresAt).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" })}</strong>. Please upload documents before expiry.
        </div>`
      : "";

    const userNoteHtml = (customNote || request.customMessage)
      ? `<div style="background: #f8fafc; border-left: 4px solid #2563eb; padding: 12px 16px; margin: 16px 0; font-size: 13px; color: #334155;">
          <strong>Message from Loan Officer:</strong><br/>
          ${(customNote || request.customMessage).replace(/\n/g, "<br/>")}
        </div>`
      : "";

    let emailSubject = `Important: Required KYC & Verification Documents for Your ${loanProduct} Application`;
    let mainIntroText = `Greetings from <strong>${companyName}</strong>! To fast-track the underwriting and sanctioning of your <strong>${loanProduct}</strong>, please submit the requested KYC and income verification documents using our secure document portal.`;

    try {
      const customTpl = await EmailTemplate.findOne({
        where: {
          companyId: request.companyId,
          category: "CUSTOMER_REQUEST",
          isActive: true,
        },
        order: [["isDefault", "DESC"], ["updatedAt", "DESC"]],
      });

      if (customTpl) {
        const varMap = {
          customer_name: customerName,
          company_name: companyName,
          loan_product: loanProduct,
          upload_link: uploadUrl,
          lead_id: lead?.id,
          officer_name: lead?.assignedEmployee?.name || "Loan Officer",
          officer_phone: lead?.assignedEmployee?.phone || company?.phone || "",
          documents_list: (request.requiredDocs || []).map((d) => `• ${d.title}${d.isRequired ? " (Required)" : ""}`).join("\n"),
        };
        if (customTpl.subject) {
          emailSubject = interpolate(customTpl.subject, varMap);
        }
        if (customTpl.content) {
          mainIntroText = interpolate(customTpl.content, varMap).replace(/\n/g, "<br/>");
        }
      }
    } catch (tplErr) {
      console.warn("[DocumentRequest] Could not load company email template:", tplErr.message);
    }

    const htmlContent = `
      <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; line-height: 1.6; color: #1e293b; max-width: 620px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
        <div style="background: linear-gradient(135deg, #1e3a8a 0%, #2563eb 100%); color: #ffffff; padding: 26px 30px;">
          <div style="font-size: 11.5px; text-transform: uppercase; letter-spacing: 0.1em; color: #93c5fd; font-weight: 700; margin-bottom: 4px;">Document Verification Portal</div>
          <h2 style="margin: 0; font-size: 22px; font-weight: 700; color: #ffffff;">${companyName}</h2>
          <p style="margin: 6px 0 0; font-size: 13px; color: #dbeafe;">Application Ref: <strong>Lead #${lead?.id}</strong> • ${loanProduct}</p>
        </div>

        <div style="padding: 28px 30px;">
          <p style="font-size: 15px; color: #1e293b; margin-top: 0;">
            Dear <strong>${customerName}</strong>,
          </p>
          <p style="font-size: 13.5px; color: #475569; line-height: 1.65;">
            ${mainIntroText}
          </p>

          ${userNoteHtml}

          <div style="margin: 24px 0 12px 0;">
            <div style="font-size: 13px; font-weight: 700; color: #0f172a; text-transform: uppercase; letter-spacing: 0.05em; margin-bottom: 8px;">
              📋 Requested Documents (${(request.requiredDocs || []).length}):
            </div>
            <table style="width: 100%; border-collapse: collapse; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; overflow: hidden;">
              <thead>
                <tr style="background: #f1f5f9; text-align: left; font-size: 11px; text-transform: uppercase; color: #64748b; letter-spacing: 0.05em;">
                  <th style="padding: 8px 14px;">Document Name</th>
                  <th style="padding: 8px 14px;">Type</th>
                  <th style="padding: 8px 14px; text-align: right;">Requirement</th>
                </tr>
              </thead>
              <tbody>
                ${docsListHtml}
              </tbody>
            </table>
          </div>

          ${expiryNotice}

          <div style="text-align: center; margin: 32px 0 24px 0;">
            <a href="${uploadUrl}" target="_blank" style="display: inline-block; padding: 14px 32px; background: #2563eb; color: #ffffff; text-decoration: none; font-size: 14.5px; font-weight: 700; border-radius: 8px; box-shadow: 0 4px 6px -1px rgba(37, 99, 235, 0.2);">
              📤 Click Here to Upload Documents
            </a>
            <div style="margin-top: 8px; font-size: 11.5px; color: #64748b;">
              No username or password required. You can take photos directly from your smartphone.
            </div>
          </div>

          <div style="border-top: 1px solid #f1f5f9; padding-top: 20px; margin-top: 28px; font-size: 12px; color: #64748b; line-height: 1.6;">
            If you face any issues while uploading, please feel free to contact your Relationship Manager: <strong>${lead?.assignedEmployee?.name || "Loan Operations Desk"}</strong> (${lead?.assignedEmployee?.phone || company?.phone || "Support"}).
          </div>
        </div>

        <div style="background: #f8fafc; padding: 16px 30px; font-size: 11.5px; color: #94a3b8; border-top: 1px solid #e2e8f0; display: flex; justify-content: space-between;">
          <span>© ${new Date().getFullYear()} ${companyName}</span>
          <span>Automated Secure Document Link</span>
        </div>
      </div>
    `;

    const plainText = `Dear ${customerName},\n\nGreetings from ${companyName}!\n\nTo proceed with your ${loanProduct} application, please upload the required documents using our secure portal:\n${uploadUrl}\n\nRequested Documents:\n${(request.requiredDocs || []).map((d) => `• ${d.title}${d.isRequired ? " (Required)" : ""}`).join("\n")}\n\nThank you,\n${companyName}`;

    const mailResult = await sendMail({
      companyId: request.companyId,
      to: toEmail,
      subject: emailSubject,
      text: plainText,
      html: htmlContent,
    });

    await logActivity(req, {
      recordType: "Lead",
      recordId: lead.id,
      action: "UPDATED",
      remarks: `Sent document collection email link to customer at ${toEmail}`,
    });

    return res.json({
      success: true,
      message: `Document collection link emailed successfully to ${toEmail}!`,
      recipientEmail: toEmail,
      mailResult,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * @desc    Customer or Staff downloads all uploaded documents in a request as a ZIP
 * @route   GET /api/public/document-requests/:token/download-all
 */
const publicDownloadRequestZip = async (req, res, next) => {
  try {
    const { token } = req.params;
    const request = await LeadDocumentRequest.findOne({
      where: { token },
      include: [
        {
          model: Lead,
          as: "lead",
          include: [{ model: Customer, as: "customer" }],
        },
      ],
    });

    if (!request) {
      return res.status(404).json({ message: "Document upload request not found" });
    }

    const uploadedDocs = (request.requiredDocs || []).filter(
      (d) => d.status === "UPLOADED" && d.fileUrl
    );

    if (uploadedDocs.length === 0) {
      return res.status(404).json({ message: "No documents have been uploaded for this request yet" });
    }

    const customerName = (request.lead?.customer?.name || "Customer").replace(/[^a-zA-Z0-9_-]/g, "_");
    const zipFileName = `${customerName}_Uploaded_Documents.zip`;

    res.attachment(zipFileName);
    const archive = archiver("zip", { zlib: { level: 9 } });

    archive.on("error", (err) => {
      console.error("[public zip archive error]", err);
      if (!res.headersSent) res.status(500).send({ message: err.message });
    });

    archive.pipe(res);

    let addedCount = 0;
    const addedNames = new Set();

    for (const doc of uploadedDocs) {
      const diskPath = resolveDiskFilePath(doc.fileUrl);
      if (diskPath && fs.existsSync(diskPath)) {
        const ext = path.extname(diskPath) || ".pdf";
        let entryName = doc.fileName || `${doc.title || doc.docType}${ext}`;
        if (addedNames.has(entryName)) {
          entryName = `${doc.docType}_${entryName}`;
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
 * @desc    Download a specific document slot within a public request
 * @route   GET /api/public/document-requests/:token/documents/:docId/download
 */
const publicDownloadRequestedDoc = async (req, res, next) => {
  try {
    const { token, docId } = req.params;
    const request = await LeadDocumentRequest.findOne({ where: { token } });

    if (!request) {
      return res.status(404).json({ message: "Document upload request not found" });
    }

    const slot = (request.requiredDocs || []).find(
      (d) => String(d.id) === String(docId) || String(d.documentId) === String(docId)
    );

    if (!slot || !slot.fileUrl) {
      return res.status(404).json({ message: "Requested document slot has no file" });
    }

    const diskPath = resolveDiskFilePath(slot.fileUrl);
    if (!diskPath || !fs.existsSync(diskPath)) {
      return res.status(404).json({ message: "File does not exist on server storage" });
    }

    const ext = path.extname(diskPath) || ".pdf";
    const downloadFileName = slot.fileName || `${(slot.title || "document").replace(/\s+/g, "_")}${ext}`;

    return res.download(diskPath, downloadFileName);
  } catch (error) {
    next(error);
  }
};

module.exports = {
  getConfigDocs,
  createDocumentRequest,
  getRequestsByLead,
  cancelDocumentRequest,
  getPublicRequest,
  publicUploadDocument,
  publicSubmitNotes,
  sendDocumentRequestEmail,
  publicDownloadRequestZip,
  publicDownloadRequestedDoc,
};

