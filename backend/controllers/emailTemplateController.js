const { EmailTemplate, Company } = require("../models");
const { Op } = require("sequelize");
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
  {
    name: "Customer KYC & Document Upload Request Link",
    subject: "Important: Upload KYC & Verification Documents for Your {{loan_product}} Application",
    content: `Dear {{customer_name}},

Greetings from {{company_name}}!

To proceed with and fast-track the sanctioning of your {{loan_product}} application, please upload your verification documents using our secure document portal:

{{upload_link}}

Requested Documents:
{{documents_list}}

If you have any questions or require assistance, please contact your Loan Officer {{officer_name}} ({{officer_phone}}).

Best regards,
Operations Desk
{{company_name}}`,
    category: "CUSTOMER_REQUEST",
    isDefault: true,
  },
];

/**
 * Robust company resolver supporting company users and platform superadmins
 */
const resolveCompanyId = (req) => {
  if (req.companyId) return req.companyId;
  if (req.user?.companyId) return req.user.companyId;
  const q = parseInt(req.query?.companyId || req.headers?.["x-company-id"] || req.body?.companyId, 10);
  if (!Number.isNaN(q)) return q;
  // Default fallback for SuperAdmin / platform context
  return 1;
};

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
    const companyId = resolveCompanyId(req);
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

    const companyId = resolveCompanyId(req);
    if (!companyId) {
      return res.status(400).json({ message: "No company associated with user" });
    }

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
    // Prevent 304 stale caching so admin panel always gets latest verified SMTP credentials
    res.set("Cache-Control", "no-store, no-cache, must-revalidate, proxy-revalidate");
    res.set("Pragma", "no-cache");
    res.set("Expires", "0");

    const companyId = resolveCompanyId(req);
    let company = companyId ? await Company.findByPk(companyId, {
      attributes: ["id", "name", "email", "smtpConfig"],
    }) : null;

    const parseCfg = (raw) => {
      if (!raw) return null;
      let c = raw;
      if (typeof c === "string") {
        try { c = JSON.parse(c); } catch { return null; }
      }
      return c && c.user ? c : null;
    };

    let cfg = parseCfg(company?.smtpConfig);

    // Fallback A: Default Platform Company (Company 1)
    if (!cfg && companyId !== 1) {
      const comp1 = await Company.findByPk(1, {
        attributes: ["id", "name", "email", "smtpConfig"],
      });
      cfg = parseCfg(comp1?.smtpConfig);
      if (cfg) company = comp1;
    }

    // Fallback B: ANY company in the database that has valid smtpConfig
    if (!cfg) {
      const anyComp = await Company.findOne({
        where: { smtpConfig: { [Op.ne]: null } },
        attributes: ["id", "name", "email", "smtpConfig"],
      });
      cfg = parseCfg(anyComp?.smtpConfig);
      if (cfg) company = anyComp;
    }

    cfg = cfg || {};
    return res.json({
      success: true,
      data: {
        service: cfg.service || "gmail",
        user: cfg.user || "",
        senderName: cfg.senderName || company?.name || "Operations Desk",
        host: cfg.host || "smtp.gmail.com",
        port: cfg.port || 465,
        secure: cfg.secure !== undefined ? Boolean(cfg.secure) : true,
        isConfigured: Boolean(cfg.user && (cfg.isConfigured !== false || cfg.pass)),
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
    const companyId = resolveCompanyId(req);
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

    // Clean Google 16-character App Password whitespace (e.g. 'abcd efgh ijkl mnop' -> 'abcdefghijklmnop')
    const sanitizedPassword = isGmail && finalPassword ? finalPassword.replace(/\s+/g, "") : (finalPassword || "").trim();

    const updatedConfig = {
      service: isGmail ? "gmail" : service || "custom",
      user: user ? user.trim() : "",
      pass: sanitizedPassword,
      senderName: senderName ? senderName.trim() : company.name || "Operations Desk",
      host: finalHost,
      port: finalPort,
      secure: finalSecure,
      isConfigured: Boolean(isConfigured),
      updatedAt: new Date().toISOString(),
    };

    await company.update({ smtpConfig: updatedConfig });

    // Sync to Company 1 and User company so all scopes share verified outgoing email
    if (company.id !== 1) {
      const comp1 = await Company.findByPk(1);
      if (comp1) await comp1.update({ smtpConfig: updatedConfig });
    }
    if (req.user?.companyId && req.user.companyId !== company.id) {
      const userComp = await Company.findByPk(req.user.companyId);
      if (userComp) await userComp.update({ smtpConfig: updatedConfig });
    }

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
 * Test the SMTP / Gmail credentials and optionally send a test email.
 * If credentials authenticate and test email succeeds, auto-saves the configuration!
 */
exports.testSmtpConfig = async (req, res, next) => {
  try {
    const companyId = resolveCompanyId(req);
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
    const rawPass = pass && pass.trim() ? pass.trim() : existingConfig.pass;

    if (!finalUser) {
      return res.status(400).json({ message: "Sender email is required to test connection" });
    }
    if (!rawPass) {
      return res.status(400).json({ message: "Password / App Password is required to test connection" });
    }

    const isGmail = service === "gmail" || (finalUser && finalUser.toLowerCase().endsWith("@gmail.com"));
    const finalHost = host ? host.trim() : isGmail ? "smtp.gmail.com" : "smtp.gmail.com";
    const finalPort = port ? parseInt(port, 10) : isGmail ? 465 : 587;
    const finalSecure = secure !== undefined ? Boolean(secure) : finalPort === 465;

    // Clean Google App Password spaces if present
    const sanitizedPass = isGmail ? rawPass.replace(/\s+/g, "") : rawPass.trim();

    const testConfig = {
      service: isGmail ? "gmail" : service,
      user: finalUser,
      pass: sanitizedPass,
      senderName: senderName || company?.name || "Operations Desk",
      host: finalHost,
      port: finalPort,
      secure: finalSecure,
    };

    const targetRecipient = testToEmail && testToEmail.trim() ? testToEmail.trim() : finalUser;
    const result = await testSmtpConnection(testConfig, targetRecipient);

    // AUTO-SAVE VERIFIED CONFIGURATION:
    // If the test succeeded, these credentials are verified to be working.
    // Automatically persist to Company so the user never gets "SMTP not configured" even if they close the test modal!
    let savedData = null;
    if (company) {
      const verifiedConfig = {
        service: isGmail ? "gmail" : service || "custom",
        user: finalUser,
        pass: sanitizedPass,
        senderName: (senderName || company.name || "Operations Desk").trim(),
        host: finalHost,
        port: finalPort,
        secure: finalSecure,
        isConfigured: true,
        updatedAt: new Date().toISOString(),
      };
      await company.update({ smtpConfig: verifiedConfig });

      // Sync verified config to Company 1 and User company as well
      if (company.id !== 1) {
        const comp1 = await Company.findByPk(1);
        if (comp1) await comp1.update({ smtpConfig: verifiedConfig });
      }
      if (req.user?.companyId && req.user.companyId !== company.id) {
        const userComp = await Company.findByPk(req.user.companyId);
        if (userComp) await userComp.update({ smtpConfig: verifiedConfig });
      }
      savedData = {
        service: verifiedConfig.service,
        user: verifiedConfig.user,
        senderName: verifiedConfig.senderName,
        host: verifiedConfig.host,
        port: verifiedConfig.port,
        secure: verifiedConfig.secure,
        isConfigured: true,
        hasPassword: true,
      };
    }

    return res.json({
      success: true,
      message: `Authentication verified successfully! A test email was sent to ${targetRecipient}`,
      result,
      isSaved: Boolean(company),
      data: savedData,
    });
  } catch (error) {
    console.error("[emailTemplateController] testSmtpConfig error:", error);
    return res.status(400).json({
      success: false,
      message: error.message || "Failed to connect to SMTP server with the provided credentials.",
    });
  }
};

