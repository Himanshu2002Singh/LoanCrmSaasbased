import React, { useEffect, useId, useRef, useState } from "react";
import axios from "axios";
import { toast } from "react-toastify";
import {
  AlertCircle,
  CheckCircle2,
  FileSpreadsheet,
  UploadCloud,
  X,
} from "lucide-react";

import API_URL from "../../config";
import "./EmployeeImportModal.css";

const ACCEPTED_EXTENSIONS = ["xlsx", "xls", "csv"];

const formatFileSize = (bytes) => {
  if (!Number.isFinite(bytes) || bytes <= 0) return "Excel file";
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

const isAcceptedFile = (file) => {
  const extension = file?.name?.split(".").pop()?.toLowerCase();
  return Boolean(extension && ACCEPTED_EXTENSIONS.includes(extension));
};

function EmployeeImportModal({ open, onClose, onImported }) {
  const titleId = useId();
  const descriptionId = useId();
  const fileInputRef = useRef(null);
  const closeButtonRef = useRef(null);
  const [currentFile, setCurrentFile] = useState(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [errorMessage, setErrorMessage] = useState("");

  useEffect(() => {
    if (!open) return undefined;

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    closeButtonRef.current?.focus();

    const handleKeyDown = (event) => {
      if (event.key === "Escape" && !isUploading) onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      window.removeEventListener("keydown", handleKeyDown);
    };
  }, [isUploading, onClose, open]);

  useEffect(() => {
    if (open) return;
    setCurrentFile(null);
    setErrorMessage("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  }, [open]);

  if (!open) return null;

  const selectFile = (file) => {
    setErrorMessage("");

    if (!file) {
      setCurrentFile(null);
      return;
    }

    if (!isAcceptedFile(file)) {
      setCurrentFile(null);
      setErrorMessage("Choose an .xlsx, .xls, or .csv file.");
      return;
    }

    setCurrentFile(file);
  };

  const handleFileChange = (event) => {
    selectFile(event.target.files?.[0]);
  };

  const handleDrop = (event) => {
    event.preventDefault();
    setIsDragging(false);
    selectFile(event.dataTransfer.files?.[0]);
  };

  const handleClose = () => {
    if (!isUploading) onClose();
  };

  const handleSubmit = async () => {
    if (!currentFile) {
      setErrorMessage("Select an employee file before importing.");
      return;
    }

    const formData = new FormData();
    formData.append("file", currentFile);
    setErrorMessage("");
    setIsUploading(true);

    try {
      const res = await axios.post(`${API_URL}/users/import`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      // Rows are skipped for their own reasons and for a full plan, so the
      // count matters more than the fact that the upload succeeded.
      const { imported = 0, skipped = 0 } = res.data || {};
      if (skipped) {
        toast.warning(`${imported} employee(s) imported, ${skipped} skipped`);
      } else {
        toast.success(`${imported} employee(s) imported`);
      }
      setIsUploading(false);
      setCurrentFile(null);
      onImported?.();
      onClose();
    } catch (error) {
      console.error("Error uploading file", error);
      setErrorMessage("The file could not be imported. Check its contents and try again.");
      setIsUploading(false);
    }
  };

  return (
    <div
      className="cc-import-backdrop"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) handleClose();
      }}
    >
      <section
        className="cc-import-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <header className="cc-import-header">
          <span className="cc-import-heading-icon" aria-hidden="true">
            <FileSpreadsheet size={22} />
          </span>
          <div>
            <p className="cc-import-eyebrow">Employee management</p>
            <h2 id={titleId}>Import employees</h2>
            <p id={descriptionId}>Upload an Excel or CSV file to add employees in one step.</p>
          </div>
          <button
            ref={closeButtonRef}
            type="button"
            className="cc-import-close"
            onClick={handleClose}
            disabled={isUploading}
            aria-label="Close employee import"
          >
            <X size={20} />
          </button>
        </header>

        <div className="cc-import-body">
          <input
            ref={fileInputRef}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="cc-import-file-input"
            id="cc-employee-import-file"
            onChange={handleFileChange}
          />

          <label
            htmlFor="cc-employee-import-file"
            className={`cc-import-dropzone${isDragging ? " is-dragging" : ""}`}
            onDragEnter={(event) => {
              event.preventDefault();
              setIsDragging(true);
            }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) setIsDragging(false);
            }}
            onDrop={handleDrop}
          >
            <span className="cc-import-upload-icon" aria-hidden="true">
              <UploadCloud size={25} />
            </span>
            <strong>Drop your employee file here</strong>
            <span>
              or <b>browse from your computer</b>
            </span>
            <small>Supported formats: XLSX, XLS, and CSV</small>
          </label>

          {currentFile ? (
            <div className="cc-import-selected" aria-live="polite">
              <span className="cc-import-file-icon" aria-hidden="true">
                <FileSpreadsheet size={21} />
              </span>
              <span className="cc-import-file-copy">
                <strong title={currentFile.name}>{currentFile.name}</strong>
                <small>{formatFileSize(currentFile.size)} · Ready to import</small>
              </span>
              <CheckCircle2 className="cc-import-ready-icon" size={19} aria-label="File ready" />
              <button
                type="button"
                className="cc-import-remove"
                onClick={() => {
                  setCurrentFile(null);
                  setErrorMessage("");
                  if (fileInputRef.current) fileInputRef.current.value = "";
                }}
                disabled={isUploading}
              >
                Remove
              </button>
            </div>
          ) : null}

          {errorMessage ? (
            <p className="cc-import-error" role="alert">
              <AlertCircle size={16} />
              {errorMessage}
            </p>
          ) : null}
        </div>

        <footer className="cc-import-footer">
          <button
            type="button"
            className="cc-import-button secondary"
            onClick={handleClose}
            disabled={isUploading}
          >
            Cancel
          </button>
          <button
            type="button"
            className="cc-import-button primary"
            onClick={handleSubmit}
            disabled={isUploading}
          >
            {isUploading ? (
              <>
                <span className="cc-import-spinner" aria-hidden="true" />
                Importing…
              </>
            ) : (
              <>
                <UploadCloud size={17} />
                Import employees
              </>
            )}
          </button>
        </footer>
      </section>
    </div>
  );
}

export default EmployeeImportModal;
