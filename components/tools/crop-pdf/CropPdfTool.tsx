"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Crop } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { getAnonymousUploadLimit } from "@/lib/plan/tool-access";
import { isAcceptedPdfFile } from "@/lib/pdf/core";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  applyNormalizedCropToPages,
  buildCroppedPdfFilename,
  canExportCropPdf,
  canExportCropWorkspace,
  countCompatiblePages,
  countCustomCropPages,
  cropPdfDocument,
  CROP_PRIVACY_COPY,
  CropPdfError,
  formatApplyCropSummary,
  getCropPdfErrorMessage,
  hasCustomCrop,
  loadCropDocumentState,
  normalizedCropFromPercentInputs,
  normalizedCropToPercentInputs,
  resetAllCrops,
  resetPageCrop,
  setCropForPage,
  type CropDocumentState,
  type CropPageEntry,
  type NormalizedCropRect,
} from "@/lib/tools/crop-pdf";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { CropPageEditor } from "./CropPageEditor";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import "@/styles/crop-pdf-premium.css";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  document: CropDocumentState;
}

function CropDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <Crop className={className} aria-hidden="true" strokeWidth={1.75} />;
}

export function CropPdfTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("scanonix-cropped.pdf");

  const resultBlobRef = useRef<Blob | null>(null);

  const pages = uploadedPdf?.document.pages ?? [];
  const currentPage: CropPageEntry | undefined = pages[currentPageIndex];
  const pageCount = pages.length;
  const customCropCount = countCustomCropPages(pages);
  const isBusy = isReadingPdf || isExporting || isDownloading;
  const hasResult = resultBlob !== null && status === "success";
  const canExport =
    uploadedPdf !== null &&
    canExportCropPdf(uploadedPdf.document) &&
    canExportCropWorkspace(pageCount, isExporting);

  /**
   * Dual-phase adapter (editor ready → export processing → download success).
   * Does not replace crop/export state machines.
   */
  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (isExporting || status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedPdf !== null && pageCount > 0) return "ready";
    return "idle";
  }, [isExporting, status, hasResult, uploadedPdf, pageCount]);

  useEffect(() => {
    resultBlobRef.current = resultBlob;
  }, [resultBlob]);

  useEffect(() => {
    return () => {
      resultBlobRef.current = null;
    };
  }, []);

  const resetWorkspace = useCallback(() => {
    resultBlobRef.current = null;
    setUploadedPdf(null);
    setCurrentPageIndex(0);
    setResultBlob(null);
    setResultFilename("scanonix-cropped.pdf");
    setStatus("idle");
    setStatusMessage(undefined);
    setIsExporting(false);
    setIsDownloading(false);
  }, []);

  const invalidateResult = useCallback(() => {
    resultBlobRef.current = null;
    setResultBlob(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const handleChangeCrop = useCallback(() => {
    invalidateResult();
  }, [invalidateResult]);

  const updateDocument = useCallback(
    (document: CropDocumentState) => {
      if (!uploadedPdf) return;
      invalidateResult();
      setUploadedPdf({ ...uploadedPdf, document });
    },
    [uploadedPdf, invalidateResult],
  );

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (!isAcceptedPdfFile(file)) {
      setStatus("error");
      setStatusMessage("Please upload a PDF file.");
      return;
    }

    if (file.size > getAnonymousUploadLimit()) {
      const maxMb = Math.round(getAnonymousUploadLimit() / (1024 * 1024));
      setStatus("error");
      setStatusMessage(`File exceeds the ${maxMb}MB upload limit.`);
      return;
    }

    setIsReadingPdf(true);
    setStatus("idle");
    setStatusMessage(undefined);
    setResultBlob(null);

    try {
      const bytes = await file.arrayBuffer();
      const document = await loadCropDocumentState(bytes, {
        byteLength: file.size,
      });

      setUploadedPdf({ file, bytes, document });
      setCurrentPageIndex(0);
      setResultFilename(buildCroppedPdfFilename(file.name));
    } catch (error) {
      setUploadedPdf(null);
      setStatus("error");
      setStatusMessage(
        error instanceof CropPdfError
          ? error.message
          : getCropPdfErrorMessage(error),
      );
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const handleCropChange = useCallback(
    (crop: NormalizedCropRect) => {
      if (!uploadedPdf || !currentPage) return;
      try {
        updateDocument(setCropForPage(uploadedPdf.document, currentPage.id, crop));
        setStatus("idle");
        setStatusMessage(undefined);
      } catch (error) {
        setStatus("error");
        setStatusMessage(getCropPdfErrorMessage(error));
      }
    },
    [uploadedPdf, currentPage, updateDocument],
  );

  const handleApplyCurrentPage = useCallback(() => {
    if (!uploadedPdf || !currentPage) return;
    try {
      updateDocument(
        setCropForPage(
          uploadedPdf.document,
          currentPage.id,
          currentPage.normalizedCropRect,
        ),
      );
      setStatus("idle");
      setStatusMessage(`Crop applied to page ${currentPageIndex + 1}.`);
    } catch (error) {
      setStatus("error");
      setStatusMessage(getCropPdfErrorMessage(error));
    }
  }, [uploadedPdf, currentPage, currentPageIndex, updateDocument]);

  const handleApplyCompatiblePages = useCallback(() => {
    if (!uploadedPdf || !currentPage) return;

    try {
      const targetPageIds = pages.map((page) => page.id);
      const result = applyNormalizedCropToPages(
        uploadedPdf.document,
        currentPage.id,
        targetPageIds,
      );
      updateDocument(result.state);
      setStatus("idle");
      setStatusMessage(formatApplyCropSummary(result));
    } catch (error) {
      setStatus("error");
      setStatusMessage(getCropPdfErrorMessage(error));
    }
  }, [uploadedPdf, currentPage, pages, updateDocument]);

  const handleResetCurrentPage = useCallback(() => {
    if (!uploadedPdf || !currentPage) return;
    updateDocument(resetPageCrop(uploadedPdf.document, currentPage.id));
    setStatus("idle");
    setStatusMessage(`Reset crop on page ${currentPageIndex + 1}.`);
  }, [uploadedPdf, currentPage, currentPageIndex, updateDocument]);

  const handleResetAllPages = useCallback(() => {
    if (!uploadedPdf) return;
    updateDocument(resetAllCrops(uploadedPdf.document));
    setStatus("idle");
    setStatusMessage("Reset all page crops.");
  }, [uploadedPdf, updateDocument]);

  const handlePercentInputChange = (
    field: "xPercent" | "yPercent" | "widthPercent" | "heightPercent",
    value: string,
  ) => {
    if (!currentPage) return;
    const parsed = Number.parseFloat(value);
    if (!Number.isFinite(parsed)) return;

    const nextInputs = {
      ...normalizedCropToPercentInputs(currentPage.normalizedCropRect),
      [field]: parsed,
    };

    try {
      const crop = normalizedCropFromPercentInputs(nextInputs);
      handleCropChange(crop);
    } catch (error) {
      setStatus("error");
      setStatusMessage(getCropPdfErrorMessage(error));
    }
  };

  const handleExport = async () => {
    if (!uploadedPdf || !canExport || isExporting) return;

    const attempt = createProcessAttempt("crop-pdf");
    if (!attempt?.markStarted()) return;

    setIsExporting(true);
    setStatus("loading");
    setStatusMessage("Creating cropped PDF…");
    setResultBlob(null);

    try {
      const blob = await cropPdfDocument(
        uploadedPdf.bytes,
        uploadedPdf.document,
        (current, total) => {
          setStatusMessage(`Applying crops (${current}/${total})…`);
        },
      );

      setResultBlob(blob);
      attempt.success(1);
      setStatus("success");
      setStatusMessage("Cropped PDF ready to download.");
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof CropPdfError
          ? error.message
          : getCropPdfErrorMessage(error),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    const blob = resultBlobRef.current ?? resultBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, resultFilename, buildToolDownloadMeta("crop-pdf", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  const compatiblePageCount = currentPage
    ? countCompatiblePages(pages, currentPage.id)
    : 0;

  const stickyVisible = Boolean(
    uploadedPdf && (hasResult || canExport || isExporting),
  );

  const exportHint = !canExport
    ? "Add a PDF before exporting."
    : isExporting
      ? "Creating cropped PDF\u2026"
      : customCropCount > 0
        ? "Ready to export"
        : "No crop changes yet";

  const percentInputs = currentPage
    ? normalizedCropToPercentInputs(currentPage.normalizedCropRect)
    : null;

  return (
    <div className="crop-pdf-premium space-y-5 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
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
              label="Drop a PDF file here to crop"
              hint="or click to browse — processed locally in your browser"
              icon={<CropDropIcon />}
              className="crop-pdf-drop"
            />
            <PrivacyNotice message={CROP_PRIVACY_COPY} />
          </>
        }
        workArea={
          uploadedPdf && currentPage ? (
            <div className="crop-stage overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="crop-stage-bar flex flex-col gap-1.5 border-b border-border/80 bg-surface-muted/40 px-0.5 py-1 sm:flex-row sm:items-center sm:justify-between">
                <div className="flex min-w-0 items-center gap-2">
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md border border-border bg-surface text-scanonix-orange">
                    <CropDropIcon className="h-3.5 w-3.5" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedPdf.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedPdf.file.size)} · {pageCount} page
                      {pageCount === 1 ? "" : "s"}
                      {customCropCount > 0
                        ? ` · ${customCropCount} cropped`
                        : ""}
                    </p>
                  </div>
                </div>
                <div
                  className={
                    stickyVisible
                      ? "hidden w-full sm:w-auto md:block"
                      : "w-full sm:w-auto"
                  }
                >
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={resetWorkspace}
                  >
                    {hasResult ? "Start over" : "Choose another PDF"}
                  </ActionButton>
                </div>
              </div>

              <div className="crop-page-toolbar flex flex-wrap items-center gap-1.5 px-0 py-0.5">
                <ActionButton
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={currentPageIndex <= 0 || isBusy}
                  onClick={() =>
                    setCurrentPageIndex((index) => Math.max(0, index - 1))
                  }
                >
                  Previous
                </ActionButton>
                <label className="sr-only" htmlFor="crop-pdf-page-select">
                  Select page
                </label>
                <select
                  id="crop-pdf-page-select"
                  value={currentPageIndex}
                  disabled={isBusy}
                  onChange={(event) =>
                    setCurrentPageIndex(Number(event.target.value))
                  }
                  className="select-field crop-page-select text-sm"
                >
                  {pages.map((page, index) => (
                    <option key={page.id} value={index}>
                      Page {index + 1}
                      {hasCustomCrop(page) ? " (cropped)" : ""}
                    </option>
                  ))}
                </select>
                <ActionButton
                  variant="outline"
                  size="sm"
                  className="rounded-lg"
                  disabled={currentPageIndex >= pageCount - 1 || isBusy}
                  onClick={() =>
                    setCurrentPageIndex((index) =>
                      Math.min(pageCount - 1, index + 1),
                    )
                  }
                >
                  Next
                </ActionButton>
                <p className="crop-page-status min-w-0 truncate text-[11px] text-scanonix-muted">
                  Page {currentPageIndex + 1} of {pageCount}
                  {" \u00B7 "}
                  {hasCustomCrop(currentPage)
                    ? "Custom crop on this page"
                    : "Full visible area"}
                </p>
              </div>

              <div className="crop-canvas pt-1.5">
                <CropPageEditor
                  pageEntry={currentPage}
                  pdfBytes={uploadedPdf.bytes}
                  crop={currentPage.normalizedCropRect}
                  disabled={isBusy}
                  onCropChange={handleCropChange}
                />
              </div>
            </div>
          ) : null
        }
        controlPanel={
          uploadedPdf && currentPage && percentInputs ? (
            <ToolControlPanel
              aria-label="Crop PDF controls"
              footer={
                hasResult && resultBlob ? (
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
                        Download cropped PDF
                      </ActionButton>
                    </div>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={handleChangeCrop}
                    >
                      Change crop
                    </ActionButton>
                  </div>
                ) : (
                  <div className="flex flex-col gap-1.5">
                    <p className="crop-export-cue">{exportHint}</p>
                    <div
                      className={
                        stickyVisible ? "hidden md:block" : undefined
                      }
                    >
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isExporting}
                        disabled={!canExport}
                        onClick={() => {
                          void handleExport();
                        }}
                      >
                        {isExporting ? "Exporting…" : "Export cropped PDF"}
                      </ActionButton>
                    </div>
                  </div>
                )
              }
            >
              {hasResult && resultBlob ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-green-700 [[data-theme=dark]_&]:text-green-400">
                      ✓ PDF cropped
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your cropped PDF is ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Pages cropped</dt>
                      <dd className="font-semibold text-foreground">
                        {customCropCount} of {pageCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Output size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(resultBlob.size)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Format</dt>
                      <dd className="font-semibold text-foreground">PDF</dd>
                    </div>
                    <div className="min-w-0 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Filename</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        {resultFilename}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="crop-inspector">
                  <div className="crop-inspector-intro">
                    <p className="crop-inspector-title">Crop settings</p>
                    <p className="crop-inspector-lead">
                      Drag the orange frame, or enter exact values.
                    </p>
                  </div>

                  <section className="crop-section">
                    <h2 className="crop-section-label">Crop area</h2>
                    <div className="crop-fields">
                      {(
                        [
                          ["xPercent", "Left", "Left percent"],
                          ["yPercent", "Top", "Top percent"],
                          ["widthPercent", "Width", "Width percent"],
                          ["heightPercent", "Height", "Height percent"],
                        ] as const
                      ).map(([field, label, accessibleName]) => (
                        <label key={field} className="crop-field">
                          <span className="crop-field-label">{label}</span>
                          <span className="crop-field-control">
                            <input
                              type="number"
                              min={0}
                              max={100}
                              step={0.1}
                              disabled={isBusy}
                              aria-label={accessibleName}
                              value={percentInputs[field]}
                              onChange={(event) =>
                                handlePercentInputChange(field, event.target.value)
                              }
                              className="input-field"
                            />
                            <span className="crop-field-unit" aria-hidden="true">
                              %
                            </span>
                          </span>
                        </label>
                      ))}
                    </div>
                  </section>

                  <section className="crop-section">
                    <h2 className="crop-section-label">Apply</h2>
                    <div className="crop-apply-stack">
                      <ActionButton
                        variant="outline"
                        size="sm"
                        className="crop-apply w-full justify-center"
                        disabled={isBusy}
                        onClick={handleApplyCurrentPage}
                      >
                        Apply to current page
                      </ActionButton>
                      <ActionButton
                        variant="outline"
                        size="sm"
                        className="crop-apply w-full justify-center"
                        disabled={isBusy || compatiblePageCount <= 1}
                        title="Pages that share this rotation and visible size, within 0.5 pt."
                        onClick={handleApplyCompatiblePages}
                      >
                        Apply to compatible pages ({compatiblePageCount})
                      </ActionButton>
                      <p className="crop-caption">Same rotation and page size.</p>
                    </div>
                  </section>

                  <section className="crop-section">
                    <h2 className="crop-section-label">Reset</h2>
                    <div className="crop-reset-row">
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        className="crop-reset"
                        disabled={isBusy}
                        onClick={handleResetCurrentPage}
                      >
                        Reset current page
                      </ActionButton>
                      <ActionButton
                        variant="ghost"
                        size="sm"
                        className="crop-reset"
                        disabled={isBusy}
                        onClick={handleResetAllPages}
                      >
                        Reset all pages
                      </ActionButton>
                    </div>
                  </section>

                  <p className="crop-warning">
                    <span className="crop-warning-mark" aria-hidden="true">
                      !
                    </span>
                    <span>
                      <strong>Not secure redaction.</strong> Content outside the
                      crop stays in the file.
                    </span>
                  </p>
                  <p className="crop-trust">
                    <svg
                      viewBox="0 0 16 16"
                      aria-hidden="true"
                      className="crop-trust-icon"
                    >
                      <path
                        fill="currentColor"
                        fillRule="evenodd"
                        d="M8 1.2 3.2 3v4.1c0 2.7 1.9 5.2 4.8 6.1 2.9-.9 4.8-3.4 4.8-6.1V3L8 1.2Zm0 1.5 3.3 1.3v3.1c0 2.1-1.4 4-3.3 4.8-1.9-.8-3.3-2.7-3.3-4.8V4L8 2.7Z"
                      />
                    </svg>
                    Processed locally. Not uploaded.
                  </p>
                </div>
              )}
            </ToolControlPanel>
          ) : null
        }
      />

      {/*
        Dual-phase sticky (opt-in phase API):
        ready/processing → Export cropped PDF (+ Choose another PDF)
        success → Download cropped PDF + Start over
      */}
      <ToolStickyMobileActionBar
        visible={stickyVisible}
        phase={resultActionPhase}
        primaryLabel={
          hasResult ? "Download cropped PDF" : "Export cropped PDF"
        }
        primaryLoading={hasResult ? isDownloading : isExporting}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !canExport}
        onPrimaryClick={() => {
          if (hasResult) {
            void handleDownload();
          } else {
            void handleExport();
          }
        }}
        secondaryLabel={
          resultActionPhase === "ready" && uploadedPdf
            ? "Choose another PDF"
            : undefined
        }
        onSecondaryClick={
          resultActionPhase === "ready" && uploadedPdf
            ? resetWorkspace
            : undefined
        }
        secondaryDisabled={isBusy}
        onStartOver={hasResult ? resetWorkspace : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
