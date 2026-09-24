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

upload.uploadDisk = upload;
upload.uploadMemory = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 15 * 1024 * 1024 },
});

module.exports = upload;
