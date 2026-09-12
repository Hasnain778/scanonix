"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PdfPreviewGrid } from "@/components/tools/pdf-to-image/PdfPreviewGrid";
import { PdfToImageOptionsPanel } from "@/components/tools/pdf-to-image/PdfToImageOptionsPanel";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import {
  createProcessAttempt,
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
import type { ResultActionPhase } from "@/components/tools/result-action-types";

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

  /** Presentational adapter only — does not replace the ToolStatus state machine. */
  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (canConvert) return "ready";
    return "idle";
  }, [status, hasResult, canConvert]);

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

  /** Return to configuration with the same PDF — does not reprocess or clear the file. */
  const handleChangeSettings = useCallback(() => {
    downloadStateRef.current = null;
    setDownloadState(null);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
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
      downloadBlob(
        state.blob,
        state.filename,
        buildToolDownloadMeta("pdf-to-image", state.outputCount),
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const convertHint = pagesToConvert.error
    ? pagesToConvert.error
    : mode === "individual" && selectedPages.length === 0
      ? "Select at least one page to continue."
      : canConvert
        ? `Ready to convert ${pagesToConvert.pages.length} page${pagesToConvert.pages.length === 1 ? "" : "s"} to ${format.toUpperCase()}.`
        : "Configure your export options.";

  return (
    <div className="space-y-5">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
        progress={progress}
      />

      <ToolWorkspaceShell
        isEmpty={!uploadedPdf}
        empty={
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
        }
        workArea={
          uploadedPdf ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <svg
                      className="h-4 w-4"
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
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedPdf.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedPdf.file.size)} ·{" "}
                      {uploadedPdf.pageCount} page
                      {uploadedPdf.pageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div
                  className={
                    hasResult
                      ? "hidden w-full sm:w-auto md:block"
                      : "w-full sm:w-auto"
                  }
                >
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={clearPdf}
                  >
                    {hasResult ? "Start over" : "Remove PDF"}
                  </ActionButton>
                </div>
              </div>

              <div className="bg-surface-muted/30 p-3 sm:p-4">
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
              </div>
            </div>
          ) : null
        }
        controlPanel={
          uploadedPdf ? (
            <ToolControlPanel
              aria-label="PDF to image controls"
              footer={
                hasResult && downloadState ? (
                  <div className="flex flex-col gap-2">
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full"
                        loading={isDownloading}
                        disabled={isBusy}
                        onClick={() => {
                          void handleDownload();
                        }}
                      >
                        {downloadState.outputCount === 1
                          ? "Download image"
                          : "Download images (ZIP)"}
                      </ActionButton>
                    </div>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={handleChangeSettings}
                    >
                      Change settings
                    </ActionButton>
                    <div className="hidden md:block">
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={clearPdf}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {convertHint}
                    </p>
                    <ActionButton
                      size="lg"
                      className="w-full shadow-[var(--shadow-orange-sm)]"
                      loading={status === "loading"}
                      disabled={!canConvert}
                      onClick={handleConvert}
                    >
                      {status === "loading"
                        ? "Converting…"
                        : "Convert to images"}
                    </ActionButton>
                  </div>
                )
              }
            >
              {hasResult && downloadState ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-green-700">
                      ✓ Conversion complete
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your images are ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Images</dt>
                      <dd className="font-semibold text-foreground">
                        {downloadState.outputCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Format</dt>
                      <dd className="font-semibold text-foreground">
                        {format.toUpperCase()}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Package size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(downloadState.blob.size)}
                      </dd>
                    </div>
                    <div className="min-w-0 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Filename</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        {downloadState.filename}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="space-y-5">
                  <PdfToImageOptionsPanel
                    compact
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
                  <div className="border-t border-border/80 pt-4">
                    <PrivacyNotice />
                  </div>
                </div>
              )}
            </ToolControlPanel>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={hasResult}
        phase={resultActionPhase}
        primaryLabel={
          downloadState?.outputCount === 1
            ? "Download image"
            : "Download images"
        }
        primaryLoading={isDownloading}
        primaryDisabled={isBusy}
        onPrimaryClick={() => {
          void handleDownload();
        }}
        onStartOver={clearPdf}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
