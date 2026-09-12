"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
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
  return <ImageIcon className="h-7 w-7" aria-hidden="true" strokeWidth={1.75} />;
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
      <div className="space-y-1">
        <h3 className="text-base font-semibold text-foreground">Upload QR image</h3>
        <p className="text-sm text-scanonix-muted">
          JPG, JPEG, PNG, or WEBP · single image · max 25 MB
        </p>
      </div>

      {!previewUrl ? (
        <FileDropZone
          onFilesSelected={handleUpload}
          accept={ACCEPTED_QR_SCANNER_EXTENSIONS}
          validateFile={isAcceptedQrScannerFile}
          multiple={false}
          disabled={disabled}
          label="Drop an image containing a QR code"
          hint="JPG, JPEG, PNG, or WEBP · under 25 MB"
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
