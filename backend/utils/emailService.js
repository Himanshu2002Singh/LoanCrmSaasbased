const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");
const { Op } = require("sequelize");
const { Company } = require("../models");
const { resolveDiskFilePath } = require("./documentHelper");

/**
 * Global fallback transporter (from env vars or Ethereal)
 */
let defaultTransporter = null;
let etherealAccount = null;

const getSystemFallbackTransporter = async () => {
  if (defaultTransporter) return defaultTransporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    defaultTransporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
    return defaultTransporter;
  }

  // Development fallback to ethereal test mailer
  try {
    if (!etherealAccount) {
      etherealAccount = await nodemailer.createTestAccount();
    }
    defaultTransporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass,
      },
    });
    console.log("[EmailService] Using Ethereal test mailer account:", etherealAccount.user);
    return defaultTransporter;
  } catch (err) {
    console.warn("[EmailService] Ethereal fallback failed, using simulated transport:", err.message);
    defaultTransporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return defaultTransporter;
  }
};

/**
 * Build a Nodemailer Transporter from custom SMTP config
 * e.g. Gmail App Password or custom SMTP server
 */
const createTransporterFromConfig = (config) => {
  if (!config || !config.user || !config.pass) return null;

  const isGmail =
    (config.host && config.host.includes("gmail")) ||
    config.service === "gmail" ||
    (config.user && config.user.toLowerCase().endsWith("@gmail.com"));

  const host = config.host || (isGmail ? "smtp.gmail.com" : "smtp.gmail.com");
  const port = parseInt(config.port || (isGmail ? "465" : "587"), 10);
  const secure = config.secure !== undefined ? Boolean(config.secure) : port === 465;

  const user = config.user.trim();
  // Strip whitespace in Gmail 16-character App Password (e.g. 'abcd efgh ijkl mnop' -> 'abcdefghijklmnop')
  const pass = isGmail ? config.pass.replace(/\s+/g, "") : config.pass.trim();

  return nodemailer.createTransport({
    host,
    port,
    secure,
    auth: {
      user,
      pass,
    },
    tls: {
      rejectUnauthorized: false,
    },
  });
};

/**
 * Verify SMTP Connection and optionally send a test verification email
 */
const testSmtpConnection = async (config, testToEmail = null) => {
  if (!config || !config.user || !config.pass) {
    throw new Error("Missing required SMTP credentials (Email / Username and Password).");
  }

  const mailer = createTransporterFromConfig(config);
  if (!mailer) {
    throw new Error("Could not initialize mail transporter with the provided credentials.");
  }

  // 1. Verify SMTP connection & auth credentials
  try {
    await mailer.verify();
  } catch (err) {
    let friendlyError = err.message || "Failed to authenticate with SMTP server.";
    if (
      err.code === "EAUTH" ||
      err.responseCode === 535 ||
      err.message.includes("Username and Password not accepted")
    ) {
      friendlyError =
        "Invalid Gmail / SMTP credentials. If you are using Gmail, please ensure 2-Step Verification is enabled on your Google Account and generate a 16-character App Password (not your normal Google account password).";
    }
    const customErr = new Error(friendlyError);
    customErr.originalError = err;
    throw customErr;
  }

  // 2. If test email requested, send a test email
  let sendResult = null;
  if (testToEmail) {
    const senderName = config.senderName ? config.senderName.trim() : "Loan CRM Operations";
    const fromAddress = `"${senderName}" <${config.user.trim()}>`;

    sendResult = await mailer.sendMail({
      from: fromAddress,
      to: testToEmail.trim(),
      subject: "✅ Test Email: CRM Gmail & SMTP Configuration Successful",
      html: `
        <div style="font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; max-width: 600px; margin: 0 auto; border: 1px solid #e2e8f0; border-radius: 12px; overflow: hidden; background: #ffffff;">
          <div style="background: linear-gradient(135deg, #047857 0%, #065f46 100%); padding: 24px 28px; color: #ffffff;">
            <div style="font-size: 11px; text-transform: uppercase; letter-spacing: 0.1em; opacity: 0.85; margin-bottom: 4px;">System Verification</div>
            <h2 style="margin: 0; font-size: 20px; font-weight: 700;">✅ SMTP Integration Verified!</h2>
          </div>
          <div style="padding: 24px 28px;">
            <p style="font-size: 14.5px; color: #334155; line-height: 1.6; margin-top: 0;">
              Congratulations! Your outgoing email integration has been connected successfully.
            </p>
            <div style="background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 8px; padding: 16px 20px; margin: 20px 0;">
              <table style="width: 100%; border-collapse: collapse; font-size: 13px; color: #475569;">
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; width: 140px; color: #1e293b;">Sender Email:</td>
                  <td style="padding: 6px 0; color: #047857; font-weight: 700;">${config.user}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">Display Name:</td>
                  <td style="padding: 6px 0;">${senderName}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">SMTP Server:</td>
                  <td style="padding: 6px 0;">${config.host || "smtp.gmail.com"}:${config.port || 465}</td>
                </tr>
                <tr>
                  <td style="padding: 6px 0; font-weight: 600; color: #1e293b;">Connection Status:</td>
                  <td style="padding: 6px 0; color: #047857; font-weight: 700;">Active &amp; Authenticated</td>
                </tr>
              </table>
            </div>
            <p style="font-size: 13px; color: #64748b; line-height: 1.6; margin-bottom: 0;">
              All loan application dockets, KYC documents, banker notifications, and partner emails dispatched from CapitalCare CRM will now be sent directly through this verified email account.
            </p>
          </div>
          <div style="background: #f1f5f9; padding: 14px 28px; font-size: 11.5px; color: #94a3b8; border-top: 1px solid #e2e8f0;">
            Sent automatically by CapitalCare CRM Operations Engine
          </div>
        </div>
      `,
    });
  }

  return { success: true, sendResult };
};

/**
 * Replace placeholders like {{customer_name}} in template string
 */
const interpolate = (templateText = "", data = {}) => {
  if (!templateText) return "";
  return templateText.replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (match, key) => {
    if (data[key] !== undefined && data[key] !== null) {
      return String(data[key]);
    }
    return match;
  });
};

/**
 * Send an email with optional attachments
 * Automatically loads the tenant's company SMTP credentials if available.
 * @param {Object} options
 * @param {number} [options.companyId] - Tenant company ID to fetch custom SMTP
 * @param {Object} [options.smtpConfig] - Direct custom SMTP credentials
 * @param {string|string[]} options.to - Primary recipient(s)
 * @param {string|string[]} [options.cc] - Carbon copy recipient(s)
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {Array} [options.attachments] - Array of attachment objects
 * @param {string} [options.from] - Sender address
 */
const sendMail = async ({
  companyId,
  smtpConfig,
  to,
  cc,
  bcc,
  subject,
  text,
  html,
  attachments = [],
  from,
}) => {
  let activeTransporter = null;
  let activeFrom = from;

  const extractValidSmtpConfig = (raw) => {
    if (!raw) return null;
    let cfg = raw;
    if (typeof cfg === "string") {
      try {
        cfg = JSON.parse(cfg);
      } catch {
        return null;
      }
    }
    if (cfg && cfg.user && cfg.pass && cfg.isConfigured !== false) {
      return cfg;
    }
    return null;
  };

  // 1. Check if direct smtpConfig is passed
  let resolvedConfig = extractValidSmtpConfig(smtpConfig);

  // 2. Otherwise look up Company's saved smtpConfig
  if (!resolvedConfig) {
    try {
      // Step A: Target company
      if (companyId) {
        const targetComp = await Company.findByPk(companyId, {
          attributes: ["id", "name", "email", "smtpConfig"],
        });
        resolvedConfig = extractValidSmtpConfig(targetComp?.smtpConfig);
      }

      // Step B: Default platform company (Company 1)
      if (!resolvedConfig && companyId !== 1) {
        const comp1 = await Company.findByPk(1, {
          attributes: ["id", "name", "email", "smtpConfig"],
        });
        resolvedConfig = extractValidSmtpConfig(comp1?.smtpConfig);
      }

      // Step C: ANY company in the database that has valid configured SMTP credentials
      if (!resolvedConfig) {
        const anyComp = await Company.findAll({
          attributes: ["id", "name", "email", "smtpConfig"],
          where: {
            smtpConfig: { [Op.ne]: null },
          },
        });
        for (const c of anyComp) {
          const valid = extractValidSmtpConfig(c.smtpConfig);
          if (valid) {
            resolvedConfig = valid;
            break;
          }
        }
      }
    } catch (e) {
      console.warn("[EmailService] Failed to load company SMTP config:", e.message);
    }
  }

  // 3. If valid tenant SMTP config found, create custom transporter
  if (resolvedConfig && resolvedConfig.user && resolvedConfig.pass) {
    try {
      activeTransporter = createTransporterFromConfig(resolvedConfig);
      if (!activeFrom) {
        const senderName = resolvedConfig.senderName ? resolvedConfig.senderName.trim() : "Operations Desk";
        activeFrom = `"${senderName}" <${resolvedConfig.user.trim()}>`;
      }
    } catch (e) {
      console.warn("[EmailService] Failed to create custom transporter, falling back to default:", e.message);
      activeTransporter = null;
    }
  }

  // 4. Fallback to system transporter if no tenant SMTP is configured
  if (!activeTransporter) {
    const hasSystemSmtp = Boolean(
      process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS
    );

    if (!hasSystemSmtp && (!resolvedConfig || !resolvedConfig.user || !resolvedConfig.pass)) {
      throw new Error(
        "Outgoing email (SMTP) is not configured for your company. Please configure your company Gmail ID and 16-character App Password in Settings > Email Templates to dispatch emails directly to bank RMs."
      );
    }

    activeTransporter = await getSystemFallbackTransporter();
    if (!activeFrom) {
      activeFrom =
        process.env.SMTP_FROM ||
        (etherealAccount
          ? `"Loan Operations CRM" <${etherealAccount.user}>`
          : '"CapitalCare Operations" <no-reply@crm.com>');
    }
  }

  // Process attachments using robust resolver
  const processedAttachments = [];
  for (const item of attachments) {
    if (typeof item === "string") {
      const diskPath = resolveDiskFilePath(item);
      if (diskPath) {
        processedAttachments.push({
          filename: path.basename(diskPath),
          path: diskPath,
        });
      } else {
        console.warn(`[EmailService] Attachment string path not found on disk: ${item}`);
      }
    } else if (item && typeof item === "object") {
      const targetPath = item.path || item.fileUrl;
      const diskPath = targetPath ? resolveDiskFilePath(targetPath) : null;

      if (diskPath) {
        processedAttachments.push({
          filename: item.filename || item.fileName || path.basename(diskPath),
          path: diskPath,
          contentType: item.contentType,
        });
      } else if (item.content) {
        processedAttachments.push({
          filename: item.filename || "attachment.pdf",
          content: item.content,
          contentType: item.contentType,
        });
      } else {
        console.warn(`[EmailService] Attachment object file not found on disk:`, item);
      }
    }
  }

  const mailOptions = {
    from: activeFrom,
    to: Array.isArray(to) ? to.join(", ") : to,
    cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : undefined,
    bcc: bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc) : undefined,
    subject,
    text: text || undefined,
    html: html || (text ? text.replace(/\n/g, "<br/>") : undefined),
    attachments: processedAttachments,
  };

  try {
    const info = await activeTransporter.sendMail(mailOptions);

    let previewUrl = null;
    try {
      previewUrl = nodemailer.getTestMessageUrl(info);
      if (previewUrl) {
        console.log("[EmailService] Test Message Preview URL:", previewUrl);
      }
    } catch {
      // Ignore
    }

    return {
      success: true,
      messageId: info.messageId,
      previewUrl,
      accepted: info.accepted,
      rejected: info.rejected,
      sentFrom: activeFrom,
    };
  } catch (err) {
    if (resolvedConfig && resolvedConfig.user) {
      console.error(`[EmailService] Failed to send email using company SMTP (${resolvedConfig.user}):`, err.message);
      let friendlyError = err.message || "Failed to send email via company SMTP.";
      if (err.code === "EAUTH" || err.responseCode === 535 || err.message.includes("Invalid login")) {
        friendlyError = `Authentication failed for ${resolvedConfig.user}. Please check your Gmail App Password / SMTP credentials in Settings > Email Templates.`;
      }
      const customErr = new Error(friendlyError);
      customErr.originalError = err;
      throw customErr;
    }
    throw err;
  }
};

module.exports = {
  createTransporterFromConfig,
  testSmtpConnection,
  interpolate,
  sendMail,
};
