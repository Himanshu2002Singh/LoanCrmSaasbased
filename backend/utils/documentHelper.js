const path = require("path");
const fs = require("fs");

/**
 * Robustly resolve the local filesystem path for any fileUrl or fileName
 * Checks across /uploads/documents, /uploads, /uploads/templates, /uploads/logos
 */
const resolveDiskFilePath = (fileUrlOrPath) => {
  if (!fileUrlOrPath) return null;

  let raw = String(fileUrlOrPath).trim();

  // If it's a full URL (e.g. http://localhost:5002/uploads/documents/file.pdf)
  try {
    if (raw.startsWith("http://") || raw.startsWith("https://")) {
      const parsed = new URL(raw);
      raw = parsed.pathname;
    }
  } catch (e) {
    // Ignore URL parse error
  }

  // Extract base filename and clean relative path
  const baseName = path.basename(raw);
  const cleanRelative = raw.replace(/^\/+/, "");

  const backendRoot = path.join(__dirname, "..");

  const candidates = [
    // 1. Exact relative path from backend root (e.g. uploads/documents/xyz.pdf)
    path.join(backendRoot, cleanRelative),
    // 2. uploads/documents/<baseName>
    path.join(backendRoot, "uploads", "documents", baseName),
    // 3. uploads/<baseName>
    path.join(backendRoot, "uploads", baseName),
    // 4. uploads/templates/<baseName>
    path.join(backendRoot, "uploads", "templates", baseName),
    // 5. uploads/logos/<baseName>
    path.join(backendRoot, "uploads", "logos", baseName),
    // 6. Absolute path if passed as absolute
    path.isAbsolute(raw) ? raw : null,
  ].filter(Boolean);

  for (const candidate of candidates) {
    if (fs.existsSync(candidate)) {
      return candidate;
    }
  }

  return null;
};

/**
 * Determine the public base URL of the API server
 * Checks environment variable or request headers (supports reverse proxies)
 */
const getPublicApiBaseUrl = (req = null) => {
  if (process.env.API_BASE_URL && process.env.API_BASE_URL.trim()) {
    return process.env.API_BASE_URL.trim().replace(/\/+$/, "");
  }

  if (req) {
    const proto = req.headers["x-forwarded-proto"] || req.protocol || "http";
    const host = req.headers["x-forwarded-host"] || req.get("host");
    if (host) {
      return `${proto}://${host}`.replace(/\/+$/, "");
    }
  }

  const port = process.env.PORT || 5002;
  return `http://localhost:${port}`;
};

/**
 * Build public download and view URLs for a document
 */
const getPublicDocumentUrls = (doc, req = null) => {
  const base = getPublicApiBaseUrl(req);
  const docId = typeof doc === "object" ? doc.id : doc;
  return {
    downloadUrl: `${base}/api/public/documents/${docId}/download`,
    viewUrl: `${base}/api/public/documents/${docId}/view`,
  };
};

module.exports = {
  resolveDiskFilePath,
  getPublicApiBaseUrl,
  getPublicDocumentUrls,
};
