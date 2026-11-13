"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PdfPreviewGrid } from "@/components/tools/pdf-to-image/PdfPreviewGrid";
import { PdfToImageOptionsPanel } from "@/components/tools/pdf-to-image/PdfToImageOptionsPanel";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/pdf-page-tools-premium.css";
import "@/styles/ux-reset-file-pair.css";
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

const PRIVACY_MESSAGE = "Processed in your browser. The PDF is not uploaded.";

interface UploadedPdfState {
  file: File;
  pageCount: number;
  pdfBytes: ArrayBuffer;
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

    const gate = await gateToolOperation("pdf-to-image");
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

  return (
    <div className="ux-premium ux-reset-file pdf-page-tools-premium">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
        progress={progress}
      />

      {!uploadedPdf ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            conversion="pdf-to-images"
            buttonLabel="Upload a PDF"
            prompt="Upload or drag a PDF here."
            formats="PDF"
            accept={ACCEPTED_PDF_EXTENSIONS}
            multiple={false}
            validateFile={isAcceptedPdfFile}
            disabled={isBusy}
            onFilesSelected={handleUpload}
            onInvalidFiles={() => {
              setStatus("error");
              setStatusMessage("Choose a PDF file.");
            }}
          />
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>
      ) : (
        <div className="ux-workspace" data-tool-workspace="active">
          <div className="ux-stage">
          <div className="ux-command">
            <div className="min-w-0">
              <p className="truncate text-sm font-medium text-foreground">
                {uploadedPdf.file.name}
              </p>
              <p className="truncate text-xs text-foreground-muted">
                {formatFileSize(uploadedPdf.file.size)} · {uploadedPdf.pageCount} page
                {uploadedPdf.pageCount === 1 ? "" : "s"}
              </p>
            </div>
            <div className="ux-command-actions">
              <ActionButton variant="ghost" size="sm" disabled={isBusy} onClick={clearPdf}>
                {hasResult ? "Start over" : "Remove PDF"}
              </ActionButton>
              {hasResult ? (
                <ActionButton
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleChangeSettings}
                >
                  Change settings
                </ActionButton>
              ) : null}
              <ActionButton
                size="lg"
                className="ux-command-primary"
                loading={hasResult ? isDownloading : status === "loading"}
                disabled={hasResult ? isBusy : !canConvert}
                onClick={() => {
                  if (hasResult) void handleDownload();
                  else void handleConvert();
                }}
              >
                {hasResult
                  ? downloadState?.outputCount === 1
                    ? "Download image"
                    : "Download images (ZIP)"
                  : status === "loading"
                    ? "Converting…"
                    : "Convert to images"}
              </ActionButton>
            </div>
          </div>

          {hasResult && downloadState ? (
            <p className="ux-result-line truncate">
              {downloadState.outputCount} image{downloadState.outputCount === 1 ? "" : "s"}
              {" · "}
              {format.toUpperCase()}
              {" · "}
              {formatFileSize(downloadState.blob.size)}
              {" · "}
              {downloadState.filename}
            </p>
          ) : (
            <>
              <PdfToImageOptionsPanel
                presentation="inline"
                advancedDisclosure
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
            </>
          )}

          <div className="ux-preview-stage">
          <PdfPreviewGrid
            key={uploadedPdf.file.name + "-" + uploadedPdf.pageCount}
            pdfBytes={uploadedPdf.pdfBytes}
            totalPages={uploadedPdf.pageCount}
            selectedPages={selectedPages}
            highlightedPages={highlightedPages}
            selectable={mode === "individual"}
            onTogglePage={togglePage}
            onSelectAll={() => setSelectedPages(buildAllPagesList(uploadedPdf.pageCount))}
            onClearSelection={() => setSelectedPages([])}
            disabled={isBusy}
          />
          </div>
          </div>
        </div>
      )}
    </div>
  );
}
