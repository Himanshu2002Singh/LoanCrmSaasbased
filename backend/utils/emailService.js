const nodemailer = require("nodemailer");
const path = require("path");
const fs = require("fs");

/**
 * Configure Nodemailer Transporter
 * Reads SMTP credentials from environment variables.
 * Falls back gracefully to Ethereal / simulated transport if SMTP is not provided.
 */
let transporter = null;
let etherealAccount = null;

const getTransporter = async () => {
  if (transporter) return transporter;

  const host = process.env.SMTP_HOST;
  const port = parseInt(process.env.SMTP_PORT || "587", 10);
  const user = process.env.SMTP_USER;
  const pass = process.env.SMTP_PASS;

  if (host && user && pass) {
    transporter = nodemailer.createTransport({
      host,
      port,
      secure: port === 465,
      auth: { user, pass },
      tls: { rejectUnauthorized: false },
    });
    return transporter;
  }

  // If in development and no SMTP configured, use ethereal or json transport
  try {
    if (!etherealAccount) {
      etherealAccount = await nodemailer.createTestAccount();
    }
    transporter = nodemailer.createTransport({
      host: "smtp.ethereal.email",
      port: 587,
      secure: false,
      auth: {
        user: etherealAccount.user,
        pass: etherealAccount.pass,
      },
    });
    console.log("[EmailService] Using Ethereal test mailer account:", etherealAccount.user);
    return transporter;
  } catch (err) {
    console.warn("[EmailService] Ethereal fallback failed, using simulated transport:", err.message);
    transporter = nodemailer.createTransport({
      jsonTransport: true,
    });
    return transporter;
  }
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
 * @param {Object} options
 * @param {string|string[]} options.to - Primary recipient(s)
 * @param {string|string[]} [options.cc] - Carbon copy recipient(s)
 * @param {string} options.subject - Email subject
 * @param {string} [options.text] - Plain text body
 * @param {string} [options.html] - HTML body
 * @param {Array} [options.attachments] - Array of attachment objects
 * @param {string} [options.from] - Sender address
 */
const sendMail = async ({ to, cc, bcc, subject, text, html, attachments = [], from }) => {
  const mailer = await getTransporter();

  const defaultFrom =
    from ||
    process.env.SMTP_FROM ||
    (etherealAccount ? `"Loan Operations CRM" <${etherealAccount.user}>` : '"CapitalCare Operations" <no-reply@crm.com>');

  // Process attachments
  const processedAttachments = [];
  for (const item of attachments) {
    if (typeof item === "string") {
      // Local path or URL
      let filePath = item;
      if (filePath.startsWith("/uploads/")) {
        filePath = path.join(__dirname, "..", filePath);
      }
      if (fs.existsSync(filePath)) {
        processedAttachments.push({
          filename: path.basename(filePath),
          path: filePath,
        });
      }
    } else if (item && typeof item === "object") {
      let filePath = item.path || item.fileUrl;
      if (filePath && filePath.startsWith("/uploads/")) {
        filePath = path.join(__dirname, "..", filePath);
      }

      if (filePath && fs.existsSync(filePath)) {
        processedAttachments.push({
          filename: item.filename || item.fileName || path.basename(filePath),
          path: filePath,
          contentType: item.contentType,
        });
      } else if (item.content) {
        processedAttachments.push({
          filename: item.filename || "attachment.pdf",
          content: item.content,
          contentType: item.contentType,
        });
      }
    }
  }

  const mailOptions = {
    from: defaultFrom,
    to: Array.isArray(to) ? to.join(", ") : to,
    cc: cc ? (Array.isArray(cc) ? cc.join(", ") : cc) : undefined,
    bcc: bcc ? (Array.isArray(bcc) ? bcc.join(", ") : bcc) : undefined,
    subject,
    text: text || undefined,
    html: html || (text ? text.replace(/\n/g, "<br/>") : undefined),
    attachments: processedAttachments,
  };

  const info = await mailer.sendMail(mailOptions);

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
  };
};

module.exports = {
  getTransporter,
  interpolate,
  sendMail,
};
