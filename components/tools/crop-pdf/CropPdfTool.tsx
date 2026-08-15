"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
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
  CROP_NOT_REDACTION_WARNING,
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

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  document: CropDocumentState;
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 8h16M8 4v16M16 4v16" />
    </svg>
  );
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
      setStatus("success");
      setStatusMessage("Cropped PDF ready to download.");
    } catch (error) {
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
      downloadBlob(blob, resultFilename);
    } finally {
      setIsDownloading(false);
    }
  };

  const compatiblePageCount = currentPage
    ? countCompatiblePages(pages, currentPage.id)
    : 0;

  return (
    <div className="space-y-8 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
      />

      {!uploadedPdf && (
        <>
          <FileDropZone
            onFilesSelected={handleUpload}
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            label="Drop a PDF file here to crop"
            hint="or click to browse — processed locally in your browser"
            icon={<PdfDropIcon />}
          />
          <PrivacyNotice message={CROP_PRIVACY_COPY} />
        </>
      )}

      {uploadedPdf && currentPage && (
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
                  {formatFileSize(uploadedPdf.file.size)} · {pageCount} page
                  {pageCount === 1 ? "" : "s"}
                  {customCropCount > 0
                    ? ` · ${customCropCount} cropped`
                    : ""}
                </p>
              </div>
            </div>
            <ActionButton
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isBusy}
              onClick={resetWorkspace}
            >
              Choose another PDF
            </ActionButton>
          </div>

          <div className="space-y-4 rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Page editor</h2>
                <p className="mt-1 text-sm text-scanonix-muted">
                  Page {currentPageIndex + 1} of {pageCount}
                  {hasCustomCrop(currentPage)
                    ? " · custom crop"
                    : " · full visible area"}
                </p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <ActionButton
                  variant="outline"
                  size="sm"
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
                  className="rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
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
                  disabled={currentPageIndex >= pageCount - 1 || isBusy}
                  onClick={() =>
                    setCurrentPageIndex((index) =>
                      Math.min(pageCount - 1, index + 1),
                    )
                  }
                >
                  Next
                </ActionButton>
              </div>
            </div>

            <CropPageEditor
              pageEntry={currentPage}
              pdfBytes={uploadedPdf.bytes}
              crop={currentPage.normalizedCropRect}
              disabled={isBusy}
              onCropChange={handleCropChange}
            />

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
              {(
                [
                  ["xPercent", "Left (%)"],
                  ["yPercent", "Top (%)"],
                  ["widthPercent", "Width (%)"],
                  ["heightPercent", "Height (%)"],
                ] as const
              ).map(([field, label]) => {
                const percentInputs = normalizedCropToPercentInputs(
                  currentPage.normalizedCropRect,
                );
                return (
                  <label key={field} className="block text-sm">
                    <span className="mb-1 block text-scanonix-muted">{label}</span>
                    <input
                      type="number"
                      min={0}
                      max={100}
                      step={0.1}
                      disabled={isBusy}
                      value={percentInputs[field]}
                      onChange={(event) =>
                        handlePercentInputChange(field, event.target.value)
                      }
                      className="w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
                    />
                  </label>
                );
              })}
            </div>

            <div className="flex flex-wrap gap-2">
              <ActionButton
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={handleApplyCurrentPage}
              >
                Apply to current page
              </ActionButton>
              <ActionButton
                variant="outline"
                size="sm"
                disabled={isBusy || compatiblePageCount <= 1}
                onClick={handleApplyCompatiblePages}
              >
                Apply to compatible pages ({compatiblePageCount})
              </ActionButton>
              <ActionButton
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={handleResetCurrentPage}
              >
                Reset current page
              </ActionButton>
              <ActionButton
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={handleResetAllPages}
              >
                Reset all pages
              </ActionButton>
            </div>
          </div>

          {hasResult && resultBlob && (
            <ToolResultsPanel
              primaryLabel="Download cropped PDF"
              primaryLoading={isDownloading}
              primaryDisabled={isBusy}
              onPrimaryClick={handleDownload}
              onStartOver={resetWorkspace}
            >
              <p className="text-sm text-scanonix-muted">
                {customCropCount} cropped page{customCropCount === 1 ? "" : "s"} ·{" "}
                {formatFileSize(resultBlob.size)} · {resultFilename}
              </p>
            </ToolResultsPanel>
          )}

          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Export cropped PDF</h2>
                <p className="mt-1 text-sm text-scanonix-muted">
                  {canExport
                    ? "Export applies your crop selections to a new PDF for download."
                    : "Add a PDF before exporting."}
                </p>
                <p className="mt-2 text-xs text-amber-200/90">{CROP_NOT_REDACTION_WARNING}</p>
              </div>
              <ActionButton
                size="lg"
                className="w-full sm:w-auto"
                loading={isExporting}
                disabled={!canExport}
                onClick={handleExport}
              >
                {isExporting ? "Exporting…" : "Export cropped PDF"}
              </ActionButton>
            </div>
            <div className="mt-4 border-t border-scanonix-border pt-4">
              <PrivacyNotice message={CROP_PRIVACY_COPY} />
            </div>
          </div>
        </>
      )}

      <ToolStickyMobileActionBar
        visible={Boolean(uploadedPdf && (hasResult || canExport))}
        primaryLabel={hasResult ? "Download cropped PDF" : "Export cropped PDF"}
        primaryLoading={hasResult ? isDownloading : isExporting}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !canExport}
        onPrimaryClick={hasResult ? handleDownload : handleExport}
        secondaryLabel={uploadedPdf ? "Choose another PDF" : undefined}
        onSecondaryClick={uploadedPdf ? resetWorkspace : undefined}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
