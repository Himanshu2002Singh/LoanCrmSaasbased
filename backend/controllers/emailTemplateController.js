const { EmailTemplate, Company } = require("../models");
const { companyScope, belongsToScope } = require("../middlewares/auth");
const { testSmtpConnection } = require("../utils/emailService");

const DEFAULT_TEMPLATES = [
  {
    name: "Standard Bank Loan Application Docket",
    subject: "[Loan Docket] Application Submission - {{customer_name}} | {{loan_product}} (Ref: {{application_number}})",
    content: `Dear {{bank_rm_name}} & Credit Underwriting Team,

Greetings from {{company_name}}!

Please find attached the loan application file and verified applicant documents for processing:

Applicant Overview:
• Customer Name: {{customer_name}}
• Contact Number: {{mobile}}
• Email: {{email}}
• PAN Number: {{pan}}
• Loan Product: {{loan_product}}
• Applied Loan Amount: ₹{{loan_amount}}
• Application Reference: {{application_number}}
• Target Bank: {{bank_name}}

Attached Documents for Review:
{{documents_list}}

Our operations team has verified the KYC and banking documents. Kindly initiate file login and share the Bank Application / LAN number.

Best regards,
{{sender_name}}
Operations Desk | {{company_name}}`,
    category: "LOAN_SUBMISSION",
    isDefault: true,
  },
  {
    name: "Urgent Loan Sanction Request",
    subject: "[URGENT] Fast-Track Loan File Login - {{customer_name}} | ₹{{loan_amount}} (Ref: {{application_number}})",
    content: `Dear {{bank_rm_name}},

We request you to prioritize and expedite the processing of the attached loan application:

• Customer Name: {{customer_name}}
• Mobile Number: {{mobile}}
• Loan Product: {{loan_product}}
• Applied Amount: ₹{{loan_amount}}
• Application No: {{application_number}}

Attached Documents:
{{documents_list}}

All customer verification checkpoints have been completed. Please initiate the underwriting at the earliest.

Warm regards,
{{sender_name}}
Operations Team
{{company_name}}`,
    category: "LOAN_SUBMISSION",
    isDefault: false,
  },
  {
    name: "Additional Documents & Clarification",
    subject: "Additional KYC & Income Documents Submission - {{customer_name}} (Ref: {{application_number}})",
    content: `Dear {{bank_rm_name}},

In reference to application #{{application_number}} for {{customer_name}}, please find attached the requested additional documents for clearing queries:

Attached Documents:
{{documents_list}}

Kindly proceed with final sanction / disbursal at the earliest.

Thank you,
{{sender_name}}
{{company_name}}`,
    category: "QUERY_RESPONSE",
    isDefault: false,
  },
];

/**
 * Seed default templates if none exist for company
 */
const seedDefaultsIfEmpty = async (companyId) => {
  if (!companyId) return;
  const count = await EmailTemplate.count({ where: { companyId } });
  if (count === 0) {
    for (const tpl of DEFAULT_TEMPLATES) {
      await EmailTemplate.create({
        ...tpl,
        companyId,
        isActive: true,
      });
    }
  }
};

/**
 * GET /api/email-templates
 */
exports.getEmailTemplates = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    if (companyId) {
      await seedDefaultsIfEmpty(companyId);
    }

    const where = companyScope(req);
    if (req.query.category) {
      where.category = req.query.category;
    }
    if (req.query.includeInactive !== "true") {
      where.isActive = true;
    }

    const templates = await EmailTemplate.findAll({
      where,
      order: [
        ["isDefault", "DESC"],
        ["updatedAt", "DESC"],
      ],
    });

    return res.json({
      success: true,
      data: templates,
      templates,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/email-templates/:id
 */
exports.getEmailTemplateById = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template || !belongsToScope(req, template)) {
      return res.status(404).json({ message: "Template not found" });
    }
    return res.json({ success: true, data: template });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/email-templates
 */
exports.createEmailTemplate = async (req, res, next) => {
  try {
    const { name, subject, content, category, isDefault } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ message: "Template name is required" });
    }
    if (!subject || !subject.trim()) {
      return res.status(400).json({ message: "Email subject is required" });
    }
    if (!content || !content.trim()) {
      return res.status(400).json({ message: "Email content / body is required" });
    }

    const companyId = req.user.companyId;

    if (isDefault) {
      // Unset previous defaults
      await EmailTemplate.update({ isDefault: false }, { where: { companyId } });
    }

    const template = await EmailTemplate.create({
      companyId,
      name: name.trim(),
      subject: subject.trim(),
      content: content.trim(),
      category: category ? category.trim() : "LOAN_SUBMISSION",
      isDefault: Boolean(isDefault),
      isActive: true,
    });

    return res.status(201).json({
      message: "Email template created successfully",
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/email-templates/:id
 */
exports.updateEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template || !belongsToScope(req, template)) {
      return res.status(404).json({ message: "Template not found" });
    }

    const { name, subject, content, category, isDefault, isActive } = req.body;

    if (isDefault && !template.isDefault) {
      await EmailTemplate.update(
        { isDefault: false },
        { where: { companyId: template.companyId } }
      );
    }

    await template.update({
      name: name !== undefined ? name.trim() : template.name,
      subject: subject !== undefined ? subject.trim() : template.subject,
      content: content !== undefined ? content.trim() : template.content,
      category: category !== undefined ? category.trim() : template.category,
      isDefault: isDefault !== undefined ? Boolean(isDefault) : template.isDefault,
      isActive: isActive !== undefined ? Boolean(isActive) : template.isActive,
    });

    return res.json({
      message: "Email template updated successfully",
      data: template,
    });
  } catch (error) {
    next(error);
  }
};

/**
 * DELETE /api/email-templates/:id
 */
exports.deleteEmailTemplate = async (req, res, next) => {
  try {
    const template = await EmailTemplate.findByPk(req.params.id);
    if (!template || !belongsToScope(req, template)) {
      return res.status(404).json({ message: "Template not found" });
    }

    await template.destroy();
    return res.json({ message: "Email template deleted successfully" });
  } catch (error) {
    next(error);
  }
};

/**
 * GET /api/email-templates/smtp/config
 * Retrieve company's saved SMTP/Gmail configuration (password masked)
 */
exports.getSmtpConfig = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "No company associated with user" });
    }

    const company = await Company.findByPk(companyId, {
      attributes: ["id", "name", "email", "smtpConfig"],
    });

    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const cfg = company.smtpConfig || {};
    return res.json({
      success: true,
      data: {
        service: cfg.service || "gmail",
        user: cfg.user || "",
        senderName: cfg.senderName || company.name || "Operations Desk",
        host: cfg.host || "smtp.gmail.com",
        port: cfg.port || 465,
        secure: cfg.secure !== undefined ? Boolean(cfg.secure) : true,
        isConfigured: Boolean(cfg.isConfigured),
        hasPassword: Boolean(cfg.pass),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * PUT /api/email-templates/smtp/config
 * Save or update company's outgoing SMTP/Gmail credentials
 */
exports.updateSmtpConfig = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    if (!companyId) {
      return res.status(400).json({ message: "No company associated with user" });
    }

    const company = await Company.findByPk(companyId);
    if (!company) {
      return res.status(404).json({ message: "Company not found" });
    }

    const {
      service = "gmail",
      user,
      pass,
      senderName,
      host,
      port,
      secure,
      isConfigured = true,
    } = req.body;

    if (isConfigured && (!user || !user.trim())) {
      return res.status(400).json({ message: "Sender email address is required" });
    }

    const existingConfig = company.smtpConfig || {};
    const finalPassword = pass && pass.trim() ? pass.trim() : existingConfig.pass;

    if (isConfigured && !finalPassword) {
      return res.status(400).json({
        message: "Email password or Gmail App Password is required",
      });
    }

    const isGmail = service === "gmail" || (user && user.toLowerCase().endsWith("@gmail.com"));
    const finalHost = host ? host.trim() : isGmail ? "smtp.gmail.com" : "smtp.gmail.com";
    const finalPort = port ? parseInt(port, 10) : isGmail ? 465 : 587;
    const finalSecure = secure !== undefined ? Boolean(secure) : finalPort === 465;

    const updatedConfig = {
      service: isGmail ? "gmail" : service || "custom",
      user: user ? user.trim() : "",
      pass: finalPassword || "",
      senderName: senderName ? senderName.trim() : company.name || "Operations Desk",
      host: finalHost,
      port: finalPort,
      secure: finalSecure,
      isConfigured: Boolean(isConfigured),
      updatedAt: new Date().toISOString(),
    };

    await company.update({ smtpConfig: updatedConfig });

    return res.json({
      success: true,
      message: "Outgoing email configuration saved successfully",
      data: {
        service: updatedConfig.service,
        user: updatedConfig.user,
        senderName: updatedConfig.senderName,
        host: updatedConfig.host,
        port: updatedConfig.port,
        secure: updatedConfig.secure,
        isConfigured: updatedConfig.isConfigured,
        hasPassword: Boolean(updatedConfig.pass),
      },
    });
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/email-templates/smtp/test
 * Test the SMTP / Gmail credentials and optionally send a test email
 */
exports.testSmtpConfig = async (req, res, next) => {
  try {
    const companyId = req.user.companyId;
    const company = companyId ? await Company.findByPk(companyId) : null;
    const existingConfig = company?.smtpConfig || {};

    const {
      service = "gmail",
      user,
      pass,
      senderName,
      host,
      port,
      secure,
      testToEmail,
    } = req.body;

    const finalUser = user && user.trim() ? user.trim() : existingConfig.user;
    const finalPass = pass && pass.trim() ? pass.trim() : existingConfig.pass;

    if (!finalUser) {
      return res.status(400).json({ message: "Sender email is required to test connection" });
    }
    if (!finalPass) {
      return res.status(400).json({ message: "Password / App Password is required to test connection" });
    }

    const isGmail = service === "gmail" || (finalUser && finalUser.toLowerCase().endsWith("@gmail.com"));
    const finalHost = host ? host.trim() : isGmail ? "smtp.gmail.com" : "smtp.gmail.com";
    const finalPort = port ? parseInt(port, 10) : isGmail ? 465 : 587;
    const finalSecure = secure !== undefined ? Boolean(secure) : finalPort === 465;

    const testConfig = {
      service: isGmail ? "gmail" : service,
      user: finalUser,
      pass: finalPass,
      senderName: senderName || company?.name || "Operations Desk",
      host: finalHost,
      port: finalPort,
      secure: finalSecure,
    };

    const targetRecipient = testToEmail && testToEmail.trim() ? testToEmail.trim() : finalUser;
    const result = await testSmtpConnection(testConfig, targetRecipient);

    return res.json({
      success: true,
      message: `Authentication verified successfully! A test email was sent to ${targetRecipient}`,
      result,
    });
  } catch (error) {
    console.error("[emailTemplateController] testSmtpConfig error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to connect to SMTP server with the provided credentials.",
    });
  }
};

