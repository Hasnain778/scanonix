"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileDigit } from "lucide-react";
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
import { PageNumberThumbGrid } from "./PageNumberThumbGrid";
import { PositionPicker } from "./PositionPicker";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  document: PageNumberDocumentState;
}

function PageNumbersDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <FileDigit className={className} aria-hidden="true" strokeWidth={1.75} />
  );
}

export function AddPageNumbersTool() {
  const defaults = createDefaultPageNumberOptions();

  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
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

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (isExporting || isReadingPdf) return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedPdf !== null && pageCount > 0) return "ready";
    return "idle";
  }, [isExporting, isReadingPdf, hasResult, status, uploadedPdf, pageCount]);

  const stickyVisible = Boolean(
    uploadedPdf && (hasResult || canExport || isExporting),
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

    const attempt = createProcessAttempt("add-page-numbers");
    if (!attempt?.markStarted()) return;

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
      attempt.success(1);
      setStatus("success");
      setStatusMessage("Numbered PDF ready to download.");
    } catch (error) {
      attempt.error("unknown");
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
      downloadBlob(blob, resultFilename, buildToolDownloadMeta("add-page-numbers", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleChangeSettings = useCallback(() => {
    invalidateResult();
  }, [invalidateResult]);

  const exportHint = canExport
    ? `Ready to number ${selection.pages.length || pageCount} page${
        (selection.pages.length || pageCount) === 1 ? "" : "s"
      }.`
    : selection.error
      ? "Fix the page range before continuing."
      : "Configure numbering options.";

  const settingsBody = uploadedPdf ? (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <FileDigit
            className="h-4 w-4 text-scanonix-orange"
            aria-hidden="true"
          />
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Add page numbers
          </p>
        </div>
        <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
          Choose where and how page numbers appear in your PDF.
        </p>
      </div>

      <section className="grid grid-cols-1 gap-3 sm:grid-cols-2">
        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Position
          </p>
          <PositionPicker
            value={position}
            disabled={isBusy}
            onChange={(nextPosition) => {
              setPosition(nextPosition);
              handleSettingChange();
            }}
          />
        </div>

        <div className="space-y-2">
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Margin
          </p>
          <div className="flex flex-col gap-1.5">
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
                  className={`rounded-md border px-3 py-2 text-left text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_35%,transparent)]"
                      : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-2 border-t border-border/80 pt-4">
        <label className="block text-sm">
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            First number
          </span>
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
            className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-foreground focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
          />
        </label>

        <div>
          <span className="mb-1.5 block text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Format
          </span>
          <div className="grid grid-cols-2 gap-1.5">
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
                  className={`rounded-md border px-2.5 py-2 text-left transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
                      : "border-border/80 bg-surface-muted/80 text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
                  }`}
                >
                  <span
                    className={`block text-sm font-semibold ${
                      selected ? "text-foreground" : "text-scanonix-muted"
                    }`}
                  >
                    {example ?? option.example}
                  </span>
                  <span className="mt-0.5 block text-[10px] text-scanonix-muted">
                    {option.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </section>

      <section className="space-y-2.5 border-t border-border/80 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
          Which pages do you want to number?
        </p>
        <div className="space-y-2">
          <label className="flex items-center gap-3 text-sm text-foreground">
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
          <label className="flex items-center gap-3 text-sm text-foreground">
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
            Custom range
          </label>
          {!allPages && (
            <div>
              <label
                className="mb-1 block text-xs text-scanonix-muted"
                htmlFor="add-page-numbers-range"
              >
                Page range
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
                className="w-full rounded-lg border border-border bg-surface-muted px-3 py-2 text-sm text-foreground placeholder:text-scanonix-muted/70 focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
              />
              {selection.error && (
                <p className="mt-2 text-xs text-red-400">{selection.error}</p>
              )}
              {!selection.error && selection.pages.length > 0 && (
                <p className="mt-2 text-xs text-scanonix-muted">
                  {selection.pages.length} page
                  {selection.pages.length === 1 ? "" : "s"} selected
                </p>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2 border-t border-border/80 pt-4">
        <label className="block text-sm">
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Size
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
            className="w-full rounded-lg border border-border bg-surface-muted px-2.5 py-2 text-sm text-foreground focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
            aria-label="Font size"
          />
        </label>
        <div>
          <span className="mb-1 block text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Color
          </span>
          <div className="flex items-center gap-2">
            <input
              type="color"
              value={
                /^#[0-9a-fA-F]{6}$/.test(color)
                  ? color
                  : DEFAULT_PAGE_NUMBER_COLOR
              }
              disabled={isBusy}
              onChange={(event) => handleColorChange(event.target.value)}
              className="h-9 w-10 cursor-pointer rounded-md border border-border bg-surface-muted p-0.5"
              aria-label="Page number color"
            />
            <input
              type="text"
              value={color}
              disabled={isBusy}
              onChange={(event) => handleColorChange(event.target.value)}
              onBlur={handleColorBlur}
              placeholder="#000000"
              className="min-w-0 flex-1 rounded-lg border border-border bg-surface-muted px-2 py-1.5 font-mono text-xs text-foreground focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
              aria-label="Page number hex color"
            />
          </div>
        </div>
      </section>

      <div className="border-t border-border/80 pt-3">
        <PrivacyNotice message={PAGE_NUMBERS_UI_PRIVACY_COPY} />
      </div>
    </div>
  ) : null;

  return (
    <div className="space-y-5 overflow-x-hidden">
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
              validateFile={isAcceptedPageNumbersPdfFile}
              multiple={false}
              disabled={isBusy}
              label="Drop a PDF file here to add page numbers"
              hint="or click to browse — processed locally in your browser"
              icon={<PageNumbersDropIcon />}
            />
            <PrivacyNotice message={PAGE_NUMBERS_UI_PRIVACY_COPY} />
          </>
        }
        workArea={
          uploadedPdf ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <PageNumbersDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedPdf.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedPdf.file.size)} · {pageCount} page
                      {pageCount === 1 ? "" : "s"}
                      {!allPages && selection.pages.length > 0
                        ? ` · ${selection.pages.length} selected`
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

              <div className="bg-surface-muted/30 p-3 sm:p-4">
                <PageNumberThumbGrid
                  pdfBytes={uploadedPdf.bytes}
                  totalPages={pageCount}
                  numberedPages={selection.pages}
                  allPages={allPages}
                  pageRangeInput={pageRangeInput}
                  startingNumber={startingNumber}
                  format={format}
                  position={position}
                  disabled={isBusy}
                />
              </div>
            </div>
          ) : null
        }
        controlPanel={
          uploadedPdf ? (
            <ToolControlPanel
              aria-label="Page number controls"
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
                        Download PDF
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
                        onClick={resetWorkspace}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {exportHint}
                    </p>
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
                        onClick={handleExport}
                      >
                        {isExporting ? "Adding…" : "Add page numbers"}
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
                    <p className="mt-1.5 text-sm font-semibold text-green-700">
                      ✓ Page numbers added
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your numbered PDF is ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Pages numbered</dt>
                      <dd className="font-semibold text-foreground">
                        {selection.pages.length || pageCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">File size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(resultBlob.size)}
                      </dd>
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
                settingsBody
              )}
            </ToolControlPanel>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={stickyVisible}
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download PDF" : "Add page numbers"}
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
