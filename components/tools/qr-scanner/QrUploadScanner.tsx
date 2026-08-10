"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { decodeQrFromFile } from "@/lib/tools/qr-scanner/decode-qr";
import {
  ACCEPTED_QR_SCANNER_EXTENSIONS,
  isAcceptedQrScannerFile,
  validateQrScannerFile,
} from "@/lib/tools/qr-scanner/file-validation";
import type { ParsedQrResult, QrScannerState } from "@/lib/tools/qr-scanner/types";

interface QrUploadScannerProps {
  onStateChange: (state: QrScannerState, message?: string) => void;
  onDetected: (result: ParsedQrResult) => void;
  disabled?: boolean;
}

function ImageDropIcon() {
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

export function QrUploadScanner({
  onStateChange,
  onDetected,
  disabled = false,
}: QrUploadScannerProps) {
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const previewRef = useRef<string | null>(null);

  const revokePreview = useCallback(() => {
    if (previewRef.current) {
      URL.revokeObjectURL(previewRef.current);
      previewRef.current = null;
    }
    setPreviewUrl(null);
  }, []);

  useEffect(() => {
    return () => {
      if (previewRef.current) {
        URL.revokeObjectURL(previewRef.current);
      }
    };
  }, []);

  const handleUpload = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file || disabled) return;

      revokePreview();

      const validationError = validateQrScannerFile(file);
      if (validationError) {
        onStateChange("no-qr-found", validationError);
        return;
      }

      const objectUrl = URL.createObjectURL(file);
      previewRef.current = objectUrl;
      setPreviewUrl(objectUrl);
      onStateChange("scanning");

      try {
        const result = await decodeQrFromFile(file);
        if (result) {
          onDetected(result);
          onStateChange("detected");
        } else {
          onStateChange("no-qr-found");
        }
      } catch {
        onStateChange("no-qr-found");
      }
    },
    [disabled, onDetected, onStateChange, revokePreview],
  );

  return (
    <div className="space-y-4">
      {!previewUrl ? (
        <FileDropZone
          onFilesSelected={handleUpload}
          accept={ACCEPTED_QR_SCANNER_EXTENSIONS}
          validateFile={isAcceptedQrScannerFile}
          multiple={false}
          disabled={disabled}
          label="Drop an image containing a QR code"
          hint="JPG, JPEG, PNG, or WEBP"
          icon={<ImageDropIcon />}
        />
      ) : (
        <div className="overflow-hidden rounded-2xl border border-scanonix-border bg-black/40">
          <div className="flex aspect-[4/3] items-center justify-center p-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewUrl}
              alt="Uploaded image preview for QR scanning"
              className="max-h-full max-w-full object-contain"
            />
          </div>
        </div>
      )}
    </div>
  );
}
