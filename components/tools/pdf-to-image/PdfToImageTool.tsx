"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PdfPreviewGrid } from "@/components/tools/pdf-to-image/PdfPreviewGrid";
import { PdfToImageOptionsPanel } from "@/components/tools/pdf-to-image/PdfToImageOptionsPanel";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import {
  downloadBlob,
  packageOutputsForDownload,
} from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  convertPdfPagesToImages,
} from "@/lib/tools/pdf-to-image/convert-pdf-to-images";
import {
  getPdfPageCountFromBytes,
  isAcceptedPdfFile,
} from "@/lib/tools/pdf-utils";
import {
  buildAllPagesList,
  parsePageRangeInputToFlatPages,
} from "@/lib/tools/split-pdf/page-ranges";
import type {
  ImageExportFormat,
  ImageExportQuality,
  ImageExportScale,
  PdfToImageMode,
  ToolStatus,
} from "@/lib/tools/types";
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
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14"
      />
    </svg>
  );
}

interface ImageDownloadState {
  blob: Blob;
  filename: string;
  outputCount: number;
}

export function PdfToImageTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [mode, setMode] = useState<PdfToImageMode>("all");
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [rangeInput, setRangeInput] = useState("");
  const [format, setFormat] = useState<ImageExportFormat>("jpg");
  const [quality, setQuality] = useState<ImageExportQuality>("high");
  const [scale, setScale] = useState<ImageExportScale>(2);
  const [downloadState, setDownloadState] = useState<ImageDownloadState | null>(
    null,
  );
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadStateRef = useRef<ImageDownloadState | null>(null);

  const isBusy = status === "loading" || isReadingPdf || isDownloading;
  const hasResult = downloadState !== null && status === "success";

  useEffect(() => {
    downloadStateRef.current = downloadState;
  }, [downloadState]);

  useEffect(() => {
    return () => {
      downloadStateRef.current = null;
    };
  }, []);

  const pagesToConvert = useMemo(() => {
    if (!uploadedPdf) {
      return { pages: [] as number[], error: undefined };
    }

    switch (mode) {
      case "all":
        return { pages: buildAllPagesList(uploadedPdf.pageCount) };
      case "individual":
        if (selectedPages.length === 0) {
          return { pages: [], error: "Select at least one page." };
        }
        return {
          pages: [...selectedPages].sort((a, b) => a - b),
        };
      case "ranges":
        if (!rangeInput.trim()) {
          return { pages: [], error: "Enter at least one page range." };
        }
        return parsePageRangeInputToFlatPages(
          rangeInput,
          uploadedPdf.pageCount,
        );
      default:
        return { pages: [] };
    }
  }, [uploadedPdf, mode, selectedPages, rangeInput]);

  const rangeError =
    mode === "ranges" && uploadedPdf && rangeInput.trim()
      ? pagesToConvert.error
      : undefined;

  const highlightedPages = pagesToConvert.pages;

  const canConvert =
    uploadedPdf !== null &&
    pagesToConvert.pages.length > 0 &&
    !pagesToConvert.error &&
    !isBusy;

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsReadingPdf(true);
    setStatus("idle");
    setStatusMessage(undefined);

    try {
      const pdfBytes = await file.arrayBuffer();
      const pageCount = await getPdfPageCountFromBytes(pdfBytes);

      setUploadedPdf({ file, pageCount, pdfBytes });
      setSelectedPages([]);
      setRangeInput("");
      setMode("all");
    } catch {
      setStatus("error");
      setStatusMessage("Could not read PDF. Please try a different file.");
      setUploadedPdf(null);
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const clearPdf = useCallback(() => {
    setUploadedPdf(null);
    setSelectedPages([]);
    setRangeInput("");
    downloadStateRef.current = null;
    setDownloadState(null);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
  }, []);

  const togglePage = useCallback((page: number) => {
    setSelectedPages((current) =>
      current.includes(page)
        ? current.filter((value) => value !== page)
        : [...current, page].sort((a, b) => a - b),
    );
  }, []);

  const handleConvert = async () => {
    if (!uploadedPdf || !canConvert) return;

    const { pages, error } = pagesToConvert;
    if (error || pages.length === 0) {
      setStatus("error");
      setStatusMessage(error ?? "No valid pages selected.");
      return;
    }

    const attempt = createProcessAttempt("pdf-to-image");

    const gate = await gateToolOperation("pdf-to-image", uploadedPdf.file.size);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setStatusMessage(undefined);
    setProgress({ current: 0, total: pages.length });
    setDownloadState(null);

    try {
      const outputs = await convertPdfPagesToImages(
        uploadedPdf.pdfBytes,
        pages,
        { format, quality, scale },
        (current, total) => setProgress({ current, total }),
      );

      const { blob, filename } = await packageOutputsForDownload(
        outputs,
        "scanonix-pdf-images.zip",
      );

      setDownloadState({
        blob,
        filename,
        outputCount: outputs.length,
      });

      attempt.success(outputs.length);
      setStatus("success");
      setStatusMessage(
        `Converted ${outputs.length} page${outputs.length === 1 ? "" : "s"} — ready to download.`,
      );
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to convert PDF",
      );
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const state = downloadStateRef.current ?? downloadState;
    if (!state || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(state.blob, state.filename, buildToolDownloadMeta("pdf-to-image", state.outputCount));
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
            label="Drop a PDF file here to convert"
            hint="or click to browse — one PDF at a time"
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
              onClick={clearPdf}
            >
              {hasResult ? "Start over" : "Remove PDF"}
            </ActionButton>
          </div>

          <PdfToImageOptionsPanel
            mode={mode}
            onModeChange={setMode}
            rangeInput={rangeInput}
            onRangeInputChange={setRangeInput}
            format={format}
            onFormatChange={setFormat}
            quality={quality}
            onQualityChange={setQuality}
            scale={scale}
            onScaleChange={setScale}
            rangeError={rangeError}
            disabled={isBusy}
          />

          <PdfPreviewGrid
            key={`${uploadedPdf.file.name}-${uploadedPdf.pageCount}`}
            pdfBytes={uploadedPdf.pdfBytes}
            totalPages={uploadedPdf.pageCount}
            selectedPages={selectedPages}
            highlightedPages={highlightedPages}
            selectable={mode === "individual"}
            onTogglePage={togglePage}
            onSelectAll={() =>
              setSelectedPages(buildAllPagesList(uploadedPdf.pageCount))
            }
            onClearSelection={() => setSelectedPages([])}
            disabled={isBusy}
          />

          {hasResult && downloadState && (
            <ToolResultsPanel
              primaryLabel={
                downloadState.outputCount === 1
                  ? "Download image"
                  : "Download images (ZIP)"
              }
              primaryLoading={isDownloading}
              primaryDisabled={isBusy}
              onPrimaryClick={handleDownload}
              onStartOver={clearPdf}
            >
              <p className="text-sm text-scanonix-muted">
                {downloadState.outputCount} image
                {downloadState.outputCount === 1 ? "" : "s"} ·{" "}
                {formatFileSize(downloadState.blob.size)} ·{" "}
                {format.toUpperCase()} · {downloadState.filename}
              </p>
            </ToolResultsPanel>
          )}

          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Convert to images
                </h2>
                <p className="mt-1 text-sm text-scanonix-muted">
                  {pagesToConvert.error
                    ? pagesToConvert.error
                    : mode === "individual" && selectedPages.length === 0
                      ? "Select at least one page to continue."
                      : canConvert
                        ? `Ready to convert ${pagesToConvert.pages.length} page${pagesToConvert.pages.length === 1 ? "" : "s"} to ${format.toUpperCase()}.`
                        : "Configure your export options above."}
                </p>
              </div>

              <ActionButton
                size="lg"
                className="w-full sm:w-auto"
                loading={status === "loading"}
                disabled={!canConvert}
                onClick={handleConvert}
              >
                {status === "loading" ? "Converting…" : "Convert to images"}
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
        primaryLabel={
          downloadState?.outputCount === 1 ? "Download image" : "Download images"
        }
        primaryLoading={isDownloading}
        primaryDisabled={isBusy}
        onPrimaryClick={handleDownload}
        secondaryLabel="Start over"
        onSecondaryClick={clearPdf}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
