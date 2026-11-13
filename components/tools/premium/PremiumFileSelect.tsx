"use client";

import { useCallback, useRef, useState } from "react";
import { ChevronsRight, FileText, Image as ImageIcon, Upload } from "lucide-react";

type ConversionMark = "images-to-pdf" | "pdf-to-images";

interface PremiumFileSelectProps {
  conversion?: ConversionMark;
  fromLabel?: string;
  toLabel?: string;
  buttonLabel: string;
  prompt: string;
  formats: string;
  accept?: string;
  multiple?: boolean;
  disabled?: boolean;
  className?: string;
  validateFile?: (file: File) => boolean;
  onFilesSelected: (files: File[]) => void;
  onInvalidFiles?: (files: File[]) => void;
  inputId?: string;
  inputDataAttributes?: Record<string, string>;
}

/**
 * Centered conversion card for Scanonix file tools.
 * Opt-in. Text, URL, camera, and full-screen editor tools do not use it.
 */
export function PremiumFileSelect({
  conversion,
  fromLabel,
  toLabel,
  buttonLabel,
  prompt,
  formats,
  accept,
  multiple = true,
  disabled = false,
  className = "",
  validateFile,
  onFilesSelected,
  onInvalidFiles,
  inputId,
  inputDataAttributes,
}: PremiumFileSelectProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);
  const fromIsPdf = conversion === "pdf-to-images";
  const useFormatMarks = Boolean(fromLabel && toLabel);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return;
      const files = Array.from(fileList);
      const validFiles = validateFile ? files.filter(validateFile) : files;
      const invalidFiles = validateFile
        ? files.filter((file) => !validateFile(file))
        : [];
      if (invalidFiles.length > 0) onInvalidFiles?.(invalidFiles);
      if (validFiles.length > 0) onFilesSelected(validFiles);
    },
    [disabled, onFilesSelected, onInvalidFiles, validateFile],
  );

  return (
    <section
      aria-label={buttonLabel}
      onDragOver={(event) => {
        event.preventDefault();
        if (!disabled) setIsDragging(true);
      }}
      onDragLeave={(event) => {
        event.preventDefault();
        setIsDragging(false);
      }}
      onDrop={(event) => {
        event.preventDefault();
        setIsDragging(false);
        handleFiles(event.dataTransfer.files);
      }}
      className={`ux-upload ${className} ${isDragging ? "is-dragging" : ""} ${disabled ? "is-disabled" : ""}`}
    >
      <div className="ux-upload-marks" aria-hidden="true">
        {useFormatMarks ? (
          <>
            <span className="ux-upload-mark ux-upload-mark-label">{fromLabel}</span>
            <ChevronsRight className="ux-upload-chevron" strokeWidth={1.75} />
            <span className="ux-upload-mark ux-upload-mark-label">{toLabel}</span>
          </>
        ) : (
          <>
            <span className="ux-upload-mark">
              {fromIsPdf ? <FileText strokeWidth={1.75} /> : <ImageIcon strokeWidth={1.75} />}
            </span>
            <ChevronsRight className="ux-upload-chevron" strokeWidth={1.75} />
            <span className="ux-upload-mark">
              {fromIsPdf ? <ImageIcon strokeWidth={1.75} /> : <FileText strokeWidth={1.75} />}
            </span>
          </>
        )}
      </div>
      <p className="ux-upload-prompt">{prompt}</p>
      <p className="ux-upload-formats">{formats}</p>
      <button
        type="button"
        disabled={disabled}
        onClick={() => inputRef.current?.click()}
        className="ux-upload-button"
      >
        <Upload aria-hidden="true" strokeWidth={2} />
        {buttonLabel}
      </button>
      <input
        ref={inputRef}
        id={inputId}
        type="file"
        accept={accept}
        multiple={multiple}
        disabled={disabled}
        className="sr-only"
        {...inputDataAttributes}
        onChange={(event) => {
          handleFiles(event.target.files);
          event.target.value = "";
        }}
      />
    </section>
  );
}
