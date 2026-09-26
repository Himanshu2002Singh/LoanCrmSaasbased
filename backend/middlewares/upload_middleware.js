const multer = require("multer");
const path = require("path");
const fs = require("fs");

const docUploadDir = path.join(__dirname, "..", "uploads", "documents");
fs.mkdirSync(docUploadDir, { recursive: true });

const diskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, docUploadDir);
  },
  filename: (req, file, cb) => {
    const safeName = file.originalname.replace(/[^a-zA-Z0-9.-]/g, "_");
    cb(null, `${Date.now()}-${safeName}`);
  },
});

const fileFilter = (req, file, cb) => {
  const allowed = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf",
    "application/msword",
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "application/vnd.ms-excel",
    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "text/csv",
  ];

  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|pdf|doc|docx|xls|xlsx|csv)$/i)) {
    cb(null, true);
  } else {
    cb(new Error("File format not supported. Only images, PDFs, DOCs, and Excels allowed."));
  }
};

const upload = multer({
  storage: diskStorage,
  fileFilter,
  limits: { fileSize: 15 * 1024 * 1024 }, // 15MB
});

// Dedicated storage and filter for company logos
const logoUploadDir = path.join(__dirname, "..", "uploads", "logos");
fs.mkdirSync(logoUploadDir, { recursive: true });

const logoDiskStorage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, logoUploadDir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const safeName = path
      .basename(file.originalname, ext)
      .replace(/[^a-zA-Z0-9_-]/g, "_");
    cb(null, `logo-${Date.now()}-${safeName}${ext}`);
  },
});

const logoFileFilter = (req, file, cb) => {
  const allowed = ["image/jpeg", "image/png", "image/webp", "image/svg+xml", "image/gif"];
  if (allowed.includes(file.mimetype) || file.originalname.match(/\.(jpg|jpeg|png|webp|svg|gif)$/i)) {
    cb(null, true);
  } else {
    cb(new Error("File format not supported. Only images (PNG, JPG, WEBP, SVG, GIF) are allowed for company logo."));
  }
};

const uploadLogo = multer({
  storage: logoDiskStorage,
  fileFilter: logoFileFilter,
  limits: { fileSize: 5 * 1024 * 1024 }, // 5MB
});

upload.uploadDisk = upload;
upload.uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});
upload.uploadLogo = uploadLogo;

module.exports = upload;
module.exports.uploadLogo = uploadLogo;

