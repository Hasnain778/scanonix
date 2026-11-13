"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-fix01.css";
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
        <div className="ux-fix01 ux-fix01-inline" data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="Image"
            toLabel="QR"
            buttonLabel="Upload image"
            prompt="Upload or drag a QR image here."
            formats="JPG, JPEG, PNG, or WEBP"
            accept={ACCEPTED_QR_SCANNER_EXTENSIONS}
            multiple={false}
            disabled={disabled}
            validateFile={isAcceptedQrScannerFile}
            onFilesSelected={(files) => {
              void handleUpload(files);
            }}
          />
        </div>
      ) : (
        <div className="qr-upload-preview overflow-hidden rounded-xl bg-black/40">
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
