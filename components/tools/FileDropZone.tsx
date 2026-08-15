"use client";

import { useCallback, useRef, useState, type ReactNode } from "react";

export interface FileDropZoneProps {
  onFilesSelected: (files: File[]) => void;
  accept?: string;
  multiple?: boolean;
  label?: string;
  hint?: string;
  disabled?: boolean;
  validateFile?: (file: File) => boolean;
  onInvalidFiles?: (files: File[]) => void;
  icon?: ReactNode;
  className?: string;
  inputId?: string;
  inputDataAttributes?: Record<string, string>;
}

function DefaultFileIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

export function FileDropZone({
  onFilesSelected,
  accept,
  multiple = true,
  label = "Drop files here",
  hint = "or click to browse",
  disabled = false,
  validateFile,
  onInvalidFiles,
  icon,
  className = "",
  inputId,
  inputDataAttributes,
}: FileDropZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFiles = useCallback(
    (fileList: FileList | null) => {
      if (!fileList || disabled) return;

      const files = Array.from(fileList);
      const validFiles = validateFile
        ? files.filter(validateFile)
        : files;
      const invalidFiles = validateFile
        ? files.filter((file) => !validateFile(file))
        : [];

      if (invalidFiles.length > 0) {
        onInvalidFiles?.(invalidFiles);
      }

      if (validFiles.length > 0) {
        onFilesSelected(validFiles);
      }
    },
    [disabled, onFilesSelected, onInvalidFiles, validateFile],
  );

  const onDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    if (!disabled) setIsDragging(true);
  };

  const onDragLeave = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
  };

  const onDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setIsDragging(false);
    handleFiles(event.dataTransfer.files);
  };

  return (
    <div
      role="button"
      tabIndex={disabled ? -1 : 0}
      aria-disabled={disabled}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          inputRef.current?.click();
        }
      }}
      onClick={() => !disabled && inputRef.current?.click()}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={`relative cursor-pointer rounded-2xl border-2 border-dashed p-8 text-center transition-all duration-300 sm:p-12 ${className} ${
        disabled
          ? "cursor-not-allowed opacity-50"
          : isDragging
            ? "glass-card scale-[1.01] border-scanonix-orange glow-orange-sm"
            : "glass-card border-white/10 hover:border-scanonix-orange/40 hover:glow-orange-sm"
      }`}
    >
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

      <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-scanonix-orange/10 text-scanonix-orange">
        {icon ?? <DefaultFileIcon />}
      </div>

      <p className="text-base font-semibold text-white">{label}</p>
      <p className="mt-1 text-sm text-scanonix-muted">{hint}</p>
    </div>
  );
}
