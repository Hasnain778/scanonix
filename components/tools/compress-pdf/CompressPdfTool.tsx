"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { CompressionLevelPanel } from "@/components/tools/compress-pdf/CompressionLevelPanel";
import { CompressionStats } from "@/components/tools/compress-pdf/CompressionStats";
import { CompressProgressBanner } from "@/components/tools/compress-pdf/CompressProgressBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { compressPdfViaServer } from "@/lib/tools/compress-pdf/client";
import {
  type CompressionLevel,
  type CompressProgressPhase,
  LARGE_PDF_BYTES,
  LARGE_PDF_PAGES,
  PdfCompressionError,
} from "@/lib/tools/compress-pdf/compression-levels";
import { useProAccess } from "@/hooks/useProAccess";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  getPdfPageCountFromBytes,
  isAcceptedPdfFile,
} from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";

interface UploadedPdfState {
  file: File;
  pageCount: number;
  pdfBytes: ArrayBuffer;
}

function PdfDropIcon() {
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
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M8 3H3v5M16 3h5v5M16 21h5v-5M8 21H3v-5"
      />
    </svg>
  );
}

export function CompressPdfTool() {
  const { isPro } = useProAccess();
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [level, setLevel] = useState<CompressionLevel>("light");
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [phase, setPhase] = useState<CompressProgressPhase>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isReading, setIsReading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const compressedBlobRef = useRef<Blob | null>(null);

  const isBusy = status === "loading" || isReading || isDownloading;
  const hasResult = compressedBlob !== null && status === "success";

  useEffect(() => {
    compressedBlobRef.current = compressedBlob;
  }, [compressedBlob]);

  useEffect(() => {
    return () => {
      compressedBlobRef.current = null;
    };
  }, []);

  const isLargePdf = useMemo(() => {
    if (!uploadedPdf) return false;
    return (
      uploadedPdf.file.size > LARGE_PDF_BYTES ||
      uploadedPdf.pageCount > LARGE_PDF_PAGES
    );
  }, [uploadedPdf]);

  const resetTool = useCallback(() => {
    compressedBlobRef.current = null;
    setUploadedPdf(null);
    setCompressedBlob(null);
    setLevel("recommended");
    setStatus("idle");
    setPhase(undefined);
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsReading(true);
    setStatus("idle");
    setStatusMessage(undefined);
    setCompressedBlob(null);
    setPhase(undefined);

    try {
      const pdfBytes = await file.arrayBuffer();
      const pageCount = await getPdfPageCountFromBytes(pdfBytes);
      setUploadedPdf({ file, pageCount, pdfBytes });
      setLevel("light");
    } catch (error) {
      const message =
        error &&
        typeof error === "object" &&
        ("name" in error || "message" in error) &&
        ((error as { name?: string }).name === "PasswordException" ||
          /password/i.test((error as { message?: string }).message ?? ""))
          ? "This PDF is password-protected. Remove the password and try again."
          : "Could not read this PDF. The file may be corrupt or unsupported.";

      setStatus("error");
      setStatusMessage(message);
      setUploadedPdf(null);
    } finally {
      setIsReading(false);
    }
  }, []);

  const handleCompress = async () => {
    if (!uploadedPdf || isBusy) return;

    const gate = await gateToolOperation("compress-pdf", uploadedPdf.file.size);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    setStatus("loading");
    setPhase("uploading");
    setStatusMessage(undefined);
    setProgress(undefined);
    setCompressedBlob(null);

    try {
      const blob = await compressPdfViaServer({
        file: uploadedPdf.file,
        level,
        onProgress: (nextPhase) => {
          setPhase(nextPhase);
        },
      });

      setCompressedBlob(blob);
      setStatus("success");
      setPhase("complete");

      const savedBytes = uploadedPdf.file.size - blob.size;
      if (savedBytes > 0) {
        setStatusMessage(`Complete — saved ${formatFileSize(savedBytes)}.`);
      } else if (blob.size < uploadedPdf.file.size) {
        setStatusMessage("Complete — file size reduced slightly. Download to compare.");
      } else {
        setStatusMessage(
          "Complete — this PDF is already well optimized. Ghostscript could not reduce size further without quality loss.",
        );
      }
      setProgress(undefined);
    } catch (error) {
      setStatus("error");
      setPhase(undefined);
      setStatusMessage(
        error instanceof PdfCompressionError
          ? error.message
          : "Compression failed. Please try again.",
      );
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const blob = compressedBlobRef.current ?? compressedBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, "scanonix-compressed.pdf");
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <CompressProgressBanner
        status={isReading ? "loading" : status}
        phase={phase}
        message={isReading ? "Reading PDF…" : statusMessage}
        progress={progress}
      />

      {!uploadedPdf && (
        <>
          <FileDropZone
            onFilesSelected={handleUpload}
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            label="Drop a PDF file here to compress"
            hint="or click to browse — one PDF at a time"
            icon={<PdfDropIcon />}
          />
          <PrivacyNotice message="Your file is securely processed on Scanonix servers to compress the PDF." />
        </>
      )}

      {uploadedPdf && (
        <>
          <div className="flex flex-col gap-4 rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-scanonix-border bg-black/40 text-scanonix-orange">
                <svg
                  className="h-6 w-6"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.75}
                  aria-hidden="true"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
                  />
                </svg>
              </div>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold text-white">
                  {uploadedPdf.file.name}
                </p>
                <p className="mt-1 text-sm text-scanonix-muted">
                  {formatFileSize(uploadedPdf.file.size)} ·{" "}
                  {uploadedPdf.pageCount} page
                  {uploadedPdf.pageCount === 1 ? "" : "s"}
                </p>
              </div>
            </div>
            <ActionButton
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isBusy}
              onClick={resetTool}
            >
              Start over
            </ActionButton>
          </div>

          {isLargePdf && (
            <div className="rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm text-yellow-200">
              This is a large PDF. Server compression may take longer to complete.
            </div>
          )}

          <CompressionLevelPanel
            level={level}
            onLevelChange={setLevel}
            originalSize={uploadedPdf.file.size}
            disabled={isBusy}
            isPro={isPro}
          />

          {compressedBlob && hasResult && uploadedPdf && (
            <ToolResultsPanel
              primaryLabel="Download compressed PDF"
              primaryLoading={isDownloading}
              primaryDisabled={isBusy}
              onPrimaryClick={handleDownload}
              onStartOver={resetTool}
            >
              <CompressionStats
                originalSize={uploadedPdf.file.size}
                compressedSize={compressedBlob.size}
              />
            </ToolResultsPanel>
          )}

          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
              <ActionButton
                size="lg"
                className="w-full sm:w-auto"
                loading={status === "loading"}
                disabled={isBusy}
                onClick={handleCompress}
              >
                {status === "loading" ? "Compressing…" : "Compress PDF"}
              </ActionButton>
            </div>

            <div className="mt-4 border-t border-scanonix-border pt-4">
              <PrivacyNotice message="Your file is securely processed on Scanonix servers to compress the PDF." />
            </div>
          </div>
        </>
      )}

      <ToolStickyMobileActionBar
        visible={Boolean(uploadedPdf && hasResult)}
        primaryLabel="Download compressed PDF"
        primaryLoading={isDownloading}
        primaryDisabled={isBusy}
        onPrimaryClick={handleDownload}
        secondaryLabel="Start over"
        onSecondaryClick={resetTool}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
