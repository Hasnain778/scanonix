"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { getAnonymousUploadLimit } from "@/lib/plan/tool-access";
import {
  addPageNumbersToPdf,
  AddPageNumbersError,
  buildNumberedPdfFilename,
  canExportPageNumbersWorkspace,
  createDefaultPageNumberOptions,
  DEFAULT_PAGE_NUMBER_COLOR,
  FORMAT_OPTIONS,
  getAddPageNumbersErrorMessage,
  isAcceptedPageNumbersPdfFile,
  loadPageNumberDocumentState,
  MARGIN_PRESET_OPTIONS,
  MAX_PAGE_NUMBER_FONT_SIZE,
  MAX_STARTING_NUMBER,
  MIN_PAGE_NUMBER_FONT_SIZE,
  MIN_STARTING_NUMBER,
  PAGE_NUMBERS_UI_PRIVACY_COPY,
  resolvePageSelection,
  resolvePreviewNumbering,
  validateHexColor,
  type PageNumberDocumentState,
  type PageNumberFormat,
  type PageNumberOptions,
  type PageNumberPosition,
} from "@/lib/tools/add-page-numbers";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { PageNumberPreview } from "./PageNumberPreview";
import { PositionPicker } from "./PositionPicker";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  document: PageNumberDocumentState;
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M12 4v6" />
    </svg>
  );
}

export function AddPageNumbersTool() {
  const defaults = createDefaultPageNumberOptions();

  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [allPages, setAllPages] = useState(defaults.allPages);
  const [pageRangeInput, setPageRangeInput] = useState(defaults.pageRangeInput);
  const [startingNumber, setStartingNumber] = useState(defaults.startingNumber);
  const [format, setFormat] = useState<PageNumberFormat>(defaults.format);
  const [position, setPosition] = useState<PageNumberPosition>(defaults.position);
  const [fontSize, setFontSize] = useState(defaults.fontSize);
  const [margin, setMargin] = useState(defaults.margin);
  const [color, setColor] = useState(defaults.color);

  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("scanonix-numbered.pdf");

  const resultBlobRef = useRef<Blob | null>(null);

  const pageCount = uploadedPdf?.document.pageCount ?? 0;
  const currentPageEntry = uploadedPdf?.document.pages[currentPageIndex];
  const isBusy = isReadingPdf || isExporting || isDownloading;
  const hasResult = resultBlob !== null && status === "success";

  const selection = useMemo(() => {
    if (!uploadedPdf) {
      return { pages: [] as number[], error: undefined as string | undefined };
    }
    return resolvePageSelection(allPages, pageRangeInput, pageCount);
  }, [uploadedPdf, allPages, pageRangeInput, pageCount]);

  const canExport = useMemo(
    () =>
      uploadedPdf !== null &&
      canExportPageNumbersWorkspace(
        pageCount,
        isExporting,
        selection.error,
        selection.pages.length,
      ),
    [uploadedPdf, pageCount, isExporting, selection.error, selection.pages.length],
  );

  const numberingOptions: PageNumberOptions = useMemo(
    () => ({
      allPages,
      pageRangeInput,
      startingNumber,
      format,
      position,
      fontSize,
      margin,
      color,
    }),
    [
      allPages,
      pageRangeInput,
      startingNumber,
      format,
      position,
      fontSize,
      margin,
      color,
    ],
  );

  useEffect(() => {
    resultBlobRef.current = resultBlob;
  }, [resultBlob]);

  useEffect(() => {
    return () => {
      resultBlobRef.current = null;
    };
  }, []);

  const resetSettings = useCallback(() => {
    const nextDefaults = createDefaultPageNumberOptions();
    setAllPages(nextDefaults.allPages);
    setPageRangeInput(nextDefaults.pageRangeInput);
    setStartingNumber(nextDefaults.startingNumber);
    setFormat(nextDefaults.format);
    setPosition(nextDefaults.position);
    setFontSize(nextDefaults.fontSize);
    setMargin(nextDefaults.margin);
    setColor(nextDefaults.color);
  }, []);

  const resetWorkspace = useCallback(() => {
    resultBlobRef.current = null;
    setUploadedPdf(null);
    setCurrentPageIndex(0);
    setResultBlob(null);
    setResultFilename("scanonix-numbered.pdf");
    setStatus("idle");
    setStatusMessage(undefined);
    setIsExporting(false);
    setIsDownloading(false);
    resetSettings();
  }, [resetSettings]);

  const invalidateResult = useCallback(() => {
    resultBlobRef.current = null;
    setResultBlob(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (!isAcceptedPageNumbersPdfFile(file)) {
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
      const document = await loadPageNumberDocumentState(bytes, {
        byteLength: file.size,
      });

      setUploadedPdf({ file, bytes, document });
      setCurrentPageIndex(0);
      setResultFilename(buildNumberedPdfFilename(file.name));
      resetSettings();
    } catch (error) {
      setUploadedPdf(null);
      setStatus("error");
      setStatusMessage(
        error instanceof AddPageNumbersError
          ? error.message
          : getAddPageNumbersErrorMessage(error),
      );
    } finally {
      setIsReadingPdf(false);
    }
  }, [resetSettings]);

  const handleSettingChange = useCallback(() => {
    invalidateResult();
    setStatus("idle");
    setStatusMessage(undefined);
  }, [invalidateResult]);

  const handleColorChange = (nextColor: string) => {
    setColor(nextColor);
    handleSettingChange();
  };

  const handleColorBlur = () => {
    try {
      validateHexColor(color);
      setStatus("idle");
      setStatusMessage(undefined);
    } catch (error) {
      setStatus("error");
      setStatusMessage(getAddPageNumbersErrorMessage(error));
    }
  };

  const handleExport = async () => {
    if (!uploadedPdf || !canExport || isExporting) return;

    setIsExporting(true);
    setStatus("loading");
    setStatusMessage("Adding page numbers…");
    setResultBlob(null);

    try {
      const bytes = await addPageNumbersToPdf(
        uploadedPdf.bytes,
        numberingOptions,
        (current, total) => {
          setStatusMessage(`Numbering pages (${current}/${total})…`);
        },
      );

      const blob = new Blob([Uint8Array.from(bytes)], { type: "application/pdf" });
      setResultBlob(blob);
      setStatus("success");
      setStatusMessage("Numbered PDF ready to download.");
    } catch (error) {
      setStatus("error");
      setStatusMessage(
        error instanceof AddPageNumbersError
          ? error.message
          : getAddPageNumbersErrorMessage(error),
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

  const previewNumbering = uploadedPdf
    ? resolvePreviewNumbering(
        allPages,
        pageRangeInput,
        pageCount,
        currentPageIndex,
        startingNumber,
        format,
      )
    : null;

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
            validateFile={isAcceptedPageNumbersPdfFile}
            multiple={false}
            disabled={isBusy}
            label="Drop a PDF file here to add page numbers"
            hint="or click to browse — processed locally in your browser"
            icon={<PdfDropIcon />}
          />
          <PrivacyNotice message={PAGE_NUMBERS_UI_PRIVACY_COPY} />
        </>
      )}

      {uploadedPdf && currentPageEntry && (
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
                  {!allPages && selection.pages.length > 0
                    ? ` · ${selection.pages.length} selected`
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

          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_360px]">
            <div className="space-y-4 rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
              <PageNumberPreview
                pageEntry={currentPageEntry}
                pdfBytes={uploadedPdf.bytes}
                pageCount={pageCount}
                currentPageIndex={currentPageIndex}
                onPageChange={setCurrentPageIndex}
                allPages={allPages}
                pageRangeInput={pageRangeInput}
                startingNumber={startingNumber}
                format={format}
                position={position}
                fontSize={fontSize}
                margin={margin}
                color={color}
                disabled={isBusy}
              />
              {previewNumbering?.isNumbered && previewNumbering.text && (
                <p className="text-sm text-scanonix-muted">
                  Preview shows <span className="text-white">{previewNumbering.text}</span> on
                  this page.
                </p>
              )}
            </div>

            <div className="space-y-6 rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
              <div>
                <h2 className="text-lg font-semibold text-white">Numbering settings</h2>
                <p className="mt-1 text-sm text-scanonix-muted">
                  Choose which pages to number and how they appear.
                </p>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-white">Pages to number</legend>
                <label className="flex items-center gap-3 text-sm text-scanonix-muted">
                  <input
                    type="radio"
                    name="page-selection"
                    checked={allPages}
                    disabled={isBusy}
                    onChange={() => {
                      setAllPages(true);
                      handleSettingChange();
                    }}
                    className="h-4 w-4 accent-scanonix-orange"
                  />
                  All pages
                </label>
                <label className="flex items-center gap-3 text-sm text-scanonix-muted">
                  <input
                    type="radio"
                    name="page-selection"
                    checked={!allPages}
                    disabled={isBusy}
                    onChange={() => {
                      setAllPages(false);
                      handleSettingChange();
                    }}
                    className="h-4 w-4 accent-scanonix-orange"
                  />
                  Custom pages
                </label>
                {!allPages && (
                  <div>
                    <label className="sr-only" htmlFor="add-page-numbers-range">
                      Custom page range
                    </label>
                    <input
                      id="add-page-numbers-range"
                      type="text"
                      value={pageRangeInput}
                      disabled={isBusy}
                      placeholder="e.g. 1-5, 8, 10-12"
                      onChange={(event) => {
                        setPageRangeInput(event.target.value);
                        handleSettingChange();
                      }}
                      className="w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-sm text-white placeholder:text-scanonix-muted/70 focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
                    />
                    {selection.error && (
                      <p className="mt-2 text-xs text-red-300">{selection.error}</p>
                    )}
                    {!selection.error && selection.pages.length > 0 && (
                      <p className="mt-2 text-xs text-scanonix-muted">
                        {selection.pages.length} page
                        {selection.pages.length === 1 ? "" : "s"} selected
                      </p>
                    )}
                  </div>
                )}
              </fieldset>

              <label className="block text-sm">
                <span className="mb-1 block text-scanonix-muted">Starting number</span>
                <input
                  type="number"
                  min={MIN_STARTING_NUMBER}
                  max={MAX_STARTING_NUMBER}
                  step={1}
                  value={startingNumber}
                  disabled={isBusy}
                  onChange={(event) => {
                    setStartingNumber(Number(event.target.value));
                    handleSettingChange();
                  }}
                  className="w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
                />
              </label>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-white">Format</legend>
                <div className="grid grid-cols-2 gap-2">
                  {FORMAT_OPTIONS.map((option) => {
                    const selected = format === option.value;
                    const example = resolvePreviewNumbering(
                      true,
                      "",
                      Math.max(pageCount, 1),
                      0,
                      1,
                      option.value,
                    ).text;

                    return (
                      <button
                        key={option.value}
                        type="button"
                        disabled={isBusy}
                        aria-pressed={selected}
                        onClick={() => {
                          setFormat(option.value);
                          handleSettingChange();
                        }}
                        className={`rounded-xl border px-3 py-3 text-left transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? "border-scanonix-orange bg-scanonix-orange/10"
                            : "border-scanonix-border bg-black/30 hover:border-scanonix-orange/50"
                        }`}
                      >
                        <span className="block text-sm font-medium text-white">
                          {example ?? option.example}
                        </span>
                        <span className="mt-1 block text-xs text-scanonix-muted">
                          {option.label}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </fieldset>

              <div className="space-y-3">
                <p className="text-sm font-medium text-white">Position</p>
                <PositionPicker
                  value={position}
                  disabled={isBusy}
                  onChange={(nextPosition) => {
                    setPosition(nextPosition);
                    handleSettingChange();
                  }}
                />
              </div>

              <label className="block text-sm">
                <span className="mb-1 block text-scanonix-muted">
                  Font size ({MIN_PAGE_NUMBER_FONT_SIZE}–{MAX_PAGE_NUMBER_FONT_SIZE} pt)
                </span>
                <input
                  type="number"
                  min={MIN_PAGE_NUMBER_FONT_SIZE}
                  max={MAX_PAGE_NUMBER_FONT_SIZE}
                  step={1}
                  value={fontSize}
                  disabled={isBusy}
                  onChange={(event) => {
                    setFontSize(Number(event.target.value));
                    handleSettingChange();
                  }}
                  className="w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
                />
              </label>

              <div className="space-y-2">
                <span className="block text-sm text-scanonix-muted">Color</span>
                <div className="flex items-center gap-3">
                  <input
                    type="color"
                    value={
                      /^#[0-9a-fA-F]{6}$/.test(color)
                        ? color
                        : DEFAULT_PAGE_NUMBER_COLOR
                    }
                    disabled={isBusy}
                    onChange={(event) => handleColorChange(event.target.value)}
                    className="h-11 w-14 cursor-pointer rounded-lg border border-scanonix-border bg-black/40 p-1"
                    aria-label="Page number color"
                  />
                  <input
                    type="text"
                    value={color}
                    disabled={isBusy}
                    onChange={(event) => handleColorChange(event.target.value)}
                    onBlur={handleColorBlur}
                    placeholder="#000000"
                    className="min-w-0 flex-1 rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 font-mono text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
                    aria-label="Page number hex color"
                  />
                </div>
              </div>

              <fieldset className="space-y-3">
                <legend className="text-sm font-medium text-white">Margin</legend>
                <div className="flex flex-wrap gap-2">
                  {MARGIN_PRESET_OPTIONS.map((preset) => {
                    const selected = margin === preset.value;
                    return (
                      <button
                        key={preset.value}
                        type="button"
                        disabled={isBusy}
                        aria-pressed={selected}
                        onClick={() => {
                          setMargin(preset.value);
                          handleSettingChange();
                        }}
                        className={`rounded-xl border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                          selected
                            ? "border-scanonix-orange bg-scanonix-orange/10 text-white"
                            : "border-scanonix-border bg-black/30 text-scanonix-muted hover:border-scanonix-orange/50"
                        }`}
                      >
                        {preset.label}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            </div>
          </div>

          {hasResult && resultBlob && (
            <ToolResultsPanel
              primaryLabel="Download numbered PDF"
              primaryLoading={isDownloading}
              primaryDisabled={isBusy}
              onPrimaryClick={handleDownload}
              onStartOver={resetWorkspace}
            >
              <p className="text-sm text-scanonix-muted">
                {selection.pages.length || pageCount} numbered page
                {(selection.pages.length || pageCount) === 1 ? "" : "s"} ·{" "}
                {formatFileSize(resultBlob.size)} · {resultFilename}
              </p>
            </ToolResultsPanel>
          )}

          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Export numbered PDF</h2>
                <p className="mt-1 text-sm text-scanonix-muted">
                  {canExport
                    ? "Export adds page numbers to a new PDF for download."
                    : selection.error
                      ? "Fix the page range before exporting."
                      : "Add a PDF before exporting."}
                </p>
              </div>
              <ActionButton
                size="lg"
                className="hidden w-full sm:w-auto xl:inline-flex"
                loading={isExporting}
                disabled={!canExport}
                onClick={handleExport}
              >
                {isExporting ? "Exporting…" : "Export numbered PDF"}
              </ActionButton>
            </div>
            <div className="mt-4 border-t border-scanonix-border pt-4">
              <PrivacyNotice message={PAGE_NUMBERS_UI_PRIVACY_COPY} />
            </div>
          </div>
        </>
      )}

      <ToolStickyMobileActionBar
        visible={Boolean(uploadedPdf && (hasResult || canExport))}
        primaryLabel={hasResult ? "Download numbered PDF" : "Export numbered PDF"}
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
