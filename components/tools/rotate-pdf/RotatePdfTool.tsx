"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { RotationPanel } from "@/components/tools/rotate-pdf/RotationPanel";
import { PdfPageGrid } from "@/components/tools/split-pdf/PdfPageGrid";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  buildRotatedPdfFilename,
  rotatePdfPages,
} from "@/lib/tools/rotate-pdf/rotate-pdf";
import {
  getPdfRotateErrorMessage,
  PdfRotateError,
  type PdfRotationDegrees,
} from "@/lib/tools/rotate-pdf/types";
import {
  getPdfPageCountFromBytes,
  isAcceptedPdfFile,
} from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

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
        d="M4 4v5h5M20 4v5h-5M4 20v-5h5M20 20v-5h-5"
      />
    </svg>
  );
}

export function RotatePdfTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [rotation, setRotation] = useState<PdfRotationDegrees>(90);
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("scanonix-rotated.pdf");
  const [rotatedPageCount, setRotatedPageCount] = useState(0);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const resultBlobRef = useRef<Blob | null>(null);

  const isBusy = status === "loading" || isReadingPdf || isDownloading;
  const hasResult = resultBlob !== null && status === "success";

  const pagesToRotate = useMemo(() => {
    if (!uploadedPdf) return [];
    if (applyToAll) {
      return Array.from({ length: uploadedPdf.pageCount }, (_, index) => index + 1);
    }
    return [...selectedPages].sort((a, b) => a - b);
  }, [uploadedPdf, applyToAll, selectedPages]);

  const canRotate =
    uploadedPdf !== null &&
    pagesToRotate.length > 0 &&
    !isBusy;

  useEffect(() => {
    resultBlobRef.current = resultBlob;
  }, [resultBlob]);

  useEffect(() => {
    return () => {
      resultBlobRef.current = null;
    };
  }, []);

  const invalidateResult = useCallback(() => {
    resultBlobRef.current = null;
    setResultBlob(null);
    setRotatedPageCount(0);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const resetTool = useCallback(() => {
    resultBlobRef.current = null;
    setUploadedPdf(null);
    setSelectedPages([]);
    setApplyToAll(true);
    setRotation(90);
    setResultBlob(null);
    setResultFilename("scanonix-rotated.pdf");
    setRotatedPageCount(0);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsReadingPdf(true);
    setStatus("idle");
    setStatusMessage(undefined);
    setResultBlob(null);
    setProgress(undefined);

    try {
      const pdfBytes = await file.arrayBuffer();
      const pageCount = await getPdfPageCountFromBytes(pdfBytes);

      if (pageCount === 0) {
        setStatus("error");
        setStatusMessage("This PDF contains no pages to rotate.");
        setUploadedPdf(null);
        return;
      }

      setUploadedPdf({ file, pageCount, pdfBytes });
      setSelectedPages([]);
      setApplyToAll(true);
      setResultFilename(buildRotatedPdfFilename(file.name));
    } catch (error) {
      setStatus("error");
      setStatusMessage(getPdfRotateErrorMessage(error));
      setUploadedPdf(null);
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const togglePage = useCallback(
    (page: number) => {
      invalidateResult();
      setSelectedPages((current) =>
        current.includes(page)
          ? current.filter((value) => value !== page)
          : [...current, page].sort((a, b) => a - b),
      );
    },
    [invalidateResult],
  );

  const handleRotate = async () => {
    if (!uploadedPdf || !canRotate) return;

    const attempt = createProcessAttempt("rotate-pdf");

    const gate = await gateToolOperation("rotate-pdf", uploadedPdf.file.size);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setStatusMessage(undefined);
    setProgress({ current: 0, total: pagesToRotate.length });
    setResultBlob(null);

    try {
      const blob = await rotatePdfPages(
        uploadedPdf.pdfBytes,
        pagesToRotate,
        rotation,
        (current, total) => setProgress({ current, total }),
      );

      setResultBlob(blob);
      attempt.success(1);
      setRotatedPageCount(pagesToRotate.length);
      setStatus("success");
      setStatusMessage(
        `Rotated ${pagesToRotate.length} page${pagesToRotate.length === 1 ? "" : "s"} by ${rotation}° — ready to download.`,
      );
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof PdfRotateError
          ? error.message
          : getPdfRotateErrorMessage(error),
      );
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const blob = resultBlobRef.current ?? resultBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, resultFilename, buildToolDownloadMeta("rotate-pdf", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
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
            label="Drop a PDF file here to rotate pages"
            hint="or click to browse — processed locally in your browser"
            icon={<PdfDropIcon />}
          />
          <PrivacyNotice />
        </>
      )}

      {uploadedPdf && (
        <>
          <div className="flex flex-col gap-4 rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
            <div className="flex items-center gap-4">
              <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-scanonix-border bg-black/40 text-scanonix-orange">
                <PdfDropIcon />
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
            {!hasResult && (
              <ActionButton
                variant="outline"
                className="w-full sm:w-auto"
                disabled={isBusy}
                onClick={resetTool}
              >
                Start over
              </ActionButton>
            )}
          </div>

          <RotationPanel
            rotation={rotation}
            applyToAll={applyToAll}
            selectedCount={selectedPages.length}
            totalPages={uploadedPdf.pageCount}
            disabled={isBusy}
            onRotationChange={(value) => {
              invalidateResult();
              setRotation(value);
            }}
            onApplyToAllChange={(value) => {
              invalidateResult();
              setApplyToAll(value);
            }}
          />

          {!applyToAll && (
            <PdfPageGrid
              totalPages={uploadedPdf.pageCount}
              selectedPages={selectedPages}
              onTogglePage={togglePage}
              onSelectAll={() => {
                invalidateResult();
                setSelectedPages(
                  Array.from(
                    { length: uploadedPdf.pageCount },
                    (_, index) => index + 1,
                  ),
                );
              }}
              onClearSelection={() => {
                invalidateResult();
                setSelectedPages([]);
              }}
              disabled={isBusy}
            />
          )}

          {hasResult && resultBlob && (
            <ToolResultsPanel
              primaryLabel="Download rotated PDF"
              primaryLoading={isDownloading}
              primaryDisabled={isBusy}
              onPrimaryClick={handleDownload}
              onStartOver={resetTool}
            >
              <p className="text-sm text-scanonix-muted">
                {rotatedPageCount} page{rotatedPageCount === 1 ? "" : "s"} rotated
                by {rotation}° · {formatFileSize(resultBlob.size)} ·{" "}
                {resultFilename}
              </p>
            </ToolResultsPanel>
          )}

          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Rotate PDF</h2>
                <p className="mt-1 text-sm text-scanonix-muted">
                  {!applyToAll && selectedPages.length === 0
                    ? "Select at least one page to rotate."
                    : canRotate
                      ? `Ready to rotate ${pagesToRotate.length} page${pagesToRotate.length === 1 ? "" : "s"} by ${rotation}° locally in your browser.`
                      : "Configure rotation options above."}
                </p>
              </div>

              <ActionButton
                size="lg"
                className="w-full sm:w-auto"
                loading={status === "loading"}
                disabled={!canRotate}
                onClick={handleRotate}
              >
                {status === "loading" ? "Rotating…" : "Rotate PDF"}
              </ActionButton>
            </div>

            <div className="mt-4 border-t border-scanonix-border pt-4">
              <PrivacyNotice />
            </div>
          </div>
        </>
      )}

      <ToolStickyMobileActionBar
        visible={hasResult}
        primaryLabel="Download rotated PDF"
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
