"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { SplitModePanel } from "@/components/tools/split-pdf/SplitModePanel";
import { SplitPageGrid } from "@/components/tools/split-pdf/SplitPageGrid";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/ux-pdf-pages.css";
import "@/styles/ux-reset-file-pair.css";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob, packageOutputsForDownload } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  getPdfPageCountFromBytes,
  isAcceptedPdfFile,
} from "@/lib/tools/pdf-utils";
import {
  buildEveryPageGroups,
  buildFixedIntervalGroups,
  buildIndividualSelectionGroup,
  parsePageRangeInput,
} from "@/lib/tools/split-pdf/page-ranges";
import { extractPdfGroups } from "@/lib/tools/split-pdf/split-pdf";
import type { SplitMode, SplitOutput, ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

const PRIVACY_MESSAGE =
  "Your files are processed locally in your browser and never uploaded to any server. Scanonix does not store or access your documents.";

interface UploadedPdfState {
  file: File;
  pageCount: number;
  pdfBytes: ArrayBuffer;
}

interface SplitDownloadState {
  blob: Blob;
  filename: string;
  outputCount: number;
  groups: number[][];
}

export function SplitPdfTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [mode, setMode] = useState<SplitMode>("individual");
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [rangeInput, setRangeInput] = useState("");
  const [interval, setInterval] = useState(2);
  const [splitOutputs, setSplitOutputs] = useState<SplitOutput[] | null>(null);
  const [downloadState, setDownloadState] = useState<SplitDownloadState | null>(
    null,
  );
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const splitOutputsRef = useRef<SplitOutput[] | null>(null);
  const downloadStateRef = useRef<SplitDownloadState | null>(null);

  const isBusy = status === "loading" || isReadingPdf || isDownloading;
  const hasResult = downloadState !== null && status === "success";

  const pageGroupsPreview = useMemo(() => {
    if (!uploadedPdf) return { groups: [] as number[][], error: undefined };

    switch (mode) {
      case "individual":
        return buildIndividualSelectionGroup(
          selectedPages,
          uploadedPdf.pageCount,
        );
      case "ranges":
        return parsePageRangeInput(rangeInput, uploadedPdf.pageCount);
      case "every-page":
        return { groups: buildEveryPageGroups(uploadedPdf.pageCount) };
      case "fixed-interval":
        return buildFixedIntervalGroups(uploadedPdf.pageCount, interval);
      default:
        return { groups: [] };
    }
  }, [uploadedPdf, mode, selectedPages, rangeInput, interval]);

  const rangeError =
    mode === "ranges" && uploadedPdf && rangeInput.trim()
      ? pageGroupsPreview.error
      : undefined;

  const selectedPageCount = useMemo(() => {
    if (pageGroupsPreview.error) return 0;
    return new Set(pageGroupsPreview.groups.flat()).size;
  }, [pageGroupsPreview]);

  useEffect(() => {
    splitOutputsRef.current = splitOutputs;
  }, [splitOutputs]);

  useEffect(() => {
    downloadStateRef.current = downloadState;
  }, [downloadState]);

  useEffect(() => {
    return () => {
      splitOutputsRef.current = null;
      downloadStateRef.current = null;
    };
  }, []);

  const canSplit =
    uploadedPdf !== null &&
    pageGroupsPreview.groups.length > 0 &&
    !pageGroupsPreview.error &&
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
      setMode("individual");
      setSplitOutputs(null);
      setDownloadState(null);
      setProgress(undefined);
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
    splitOutputsRef.current = null;
    downloadStateRef.current = null;
    setSplitOutputs(null);
    setDownloadState(null);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
  }, []);

  const handleSplit = async () => {
    if (!uploadedPdf || !canSplit) return;

    const { groups, error } = pageGroupsPreview;
    if (error || groups.length === 0) {
      setStatus("error");
      setStatusMessage(error ?? "No valid pages selected.");
      return;
    }

    const attempt = createProcessAttempt("split-pdf");

    const gate = await gateToolOperation("split-pdf");
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setStatusMessage(undefined);
    setProgress({ current: 0, total: groups.length });
    setSplitOutputs(null);
    setDownloadState(null);

    try {
      const outputs = await extractPdfGroups(
        uploadedPdf.pdfBytes,
        groups,
        (current, total) => setProgress({ current, total }),
      );

      const { blob: downloadBlob_, filename: downloadFilename } =
        await packageOutputsForDownload(outputs, "scanonix-split-files.zip");

      setSplitOutputs(outputs);
      setDownloadState({
        blob: downloadBlob_,
        filename: downloadFilename,
        outputCount: outputs.length,
        groups,
      });

      attempt.success(outputs.length);
      setStatus("success");
      setStatusMessage(
        `Created ${outputs.length} PDF${outputs.length === 1 ? "" : "s"} — ready to download.`,
      );
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to split PDF",
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
        buildToolDownloadMeta("split-pdf", state.outputCount),
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const invalidateResult = useCallback(() => {
    splitOutputsRef.current = null;
    downloadStateRef.current = null;
    setSplitOutputs(null);
    setDownloadState(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  /** Return to configuration with the same PDF — does not reprocess or clear the file. */
  const handleChangeSettings = useCallback(() => {
    invalidateResult();
  }, [invalidateResult]);

  const handleModeChange = useCallback(
    (nextMode: SplitMode) => {
      invalidateResult();
      setMode(nextMode);
    },
    [invalidateResult],
  );

  const handleRangeInputChange = useCallback(
    (value: string) => {
      invalidateResult();
      setRangeInput(value);
    },
    [invalidateResult],
  );

  const handleIntervalChange = useCallback(
    (value: number) => {
      invalidateResult();
      setInterval(value);
    },
    [invalidateResult],
  );

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

  const splitHint =
    mode === "individual" && selectedPages.length === 0
      ? "Select at least one page to continue."
      : pageGroupsPreview.error
        ? "Fix the errors above before splitting."
        : canSplit
          ? `Ready to create ${pageGroupsPreview.groups.length} file${pageGroupsPreview.groups.length === 1 ? "" : "s"}.`
          : "Configure your split options.";

  const modeSummaryLabel = (() => {
    switch (mode) {
      case "individual":
        return "Select pages";
      case "ranges":
        return "Page ranges";
      case "every-page":
        return "Every page";
      case "fixed-interval":
        return `Every ${interval} page${interval === 1 ? "" : "s"}`;
      default:
        return mode;
    }
  })();

  const primaryLabel = hasResult
    ? downloadState?.outputCount === 1
      ? "Download split PDF"
      : "Download split PDFs (ZIP)"
    : status === "loading"
      ? "Splitting PDF…"
      : "Split PDF";

  return (
    <div className="ux-pdf-pages overflow-x-hidden">
      <div className="ux-pdf-banner">
        <ToolStatusBanner
          status={isReadingPdf ? "loading" : status}
          message={isReadingPdf ? "Reading PDF…" : statusMessage}
          progress={progress}
        />
      </div>

      {!uploadedPdf ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="PDF"
            toLabel="FILES"
            buttonLabel="Upload a PDF"
            prompt="Upload or drag a PDF here."
            formats="PDF"
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            onFilesSelected={handleUpload}
            onInvalidFiles={() => {
              setStatus("error");
              setStatusMessage("Could not read PDF. Please try a different file.");
            }}
          />
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>
      ) : (
        <div className="ux-workspace" data-tool-workspace="active">
          <div className="ux-stage">
            <div className="ux-command">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {uploadedPdf.file.name}
                </p>
                <p className="mt-0.5 text-xs text-scanonix-muted">
                  {formatFileSize(uploadedPdf.file.size)} · {uploadedPdf.pageCount}{" "}
                  page{uploadedPdf.pageCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="ux-command-actions">
                <ActionButton
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={clearPdf}
                >
                  {hasResult ? "Start over" : "Choose another PDF"}
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
                  disabled={hasResult ? isBusy : !canSplit}
                  onClick={() => {
                    if (hasResult) {
                      void handleDownload();
                    } else {
                      void handleSplit();
                    }
                  }}
                >
                  {primaryLabel}
                </ActionButton>
              </div>
            </div>

            <div className="ux-pdf-layout">
              <div className="ux-pdf-preview">
                <SplitPageGrid
                  key={`${uploadedPdf.file.name}-${uploadedPdf.pageCount}`}
                  pdfBytes={uploadedPdf.pdfBytes}
                  totalPages={uploadedPdf.pageCount}
                  mode={mode}
                  selectedPages={selectedPages}
                  pageGroups={pageGroupsPreview.groups}
                  groupsError={pageGroupsPreview.error}
                  selectable={mode === "individual"}
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
              </div>

              <section className="ux-pdf-settings" aria-label="Split PDF controls">
              {hasResult && downloadState ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-green-700 [[data-theme=dark]_&]:text-green-400">
                      ✓ PDF split
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your split{" "}
                      {downloadState.outputCount === 1 ? "PDF is" : "PDFs are"}{" "}
                      ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Files created</dt>
                      <dd className="font-semibold text-foreground">
                        {downloadState.outputCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Package size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(downloadState.blob.size)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Format</dt>
                      <dd className="font-semibold text-foreground">
                        {downloadState.outputCount === 1 ? "PDF" : "ZIP of PDFs"}
                      </dd>
                    </div>
                    <div className="min-w-0 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Filename</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        {downloadState.filename}
                      </dd>
                    </div>
                  </dl>

                  {downloadState.groups.length > 0 && (
                    <div className="space-y-2">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Output files
                      </p>
                      <ul className="max-h-48 space-y-1.5 overflow-y-auto">
                        {downloadState.groups.map((group, index) => (
                          <li
                            key={`${group.join("-")}-${index}`}
                            className="rounded-md border border-border bg-surface-muted/50 px-2.5 py-2 text-xs"
                          >
                            <span className="font-semibold text-foreground">
                              {splitOutputs?.[index]?.filename ??
                                `File ${index + 1}`}
                            </span>
                            <span className="mt-0.5 block text-scanonix-muted">
                              Pages {group.join(", ")}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Split PDF
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-scanonix-muted">
                      Split one PDF into separate files by selected pages,
                      ranges, every page, or fixed intervals.
                    </p>
                  </div>

                  <SplitModePanel
                    mode={mode}
                    onModeChange={handleModeChange}
                    rangeInput={rangeInput}
                    onRangeInputChange={handleRangeInputChange}
                    interval={interval}
                    onIntervalChange={handleIntervalChange}
                    rangeError={rangeError}
                    disabled={isBusy}
                  />

                  <section className="space-y-2 border-t border-border/80 pt-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Summary
                    </h2>
                    <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Total pages</dt>
                        <dd className="font-semibold text-foreground">
                          {uploadedPdf.pageCount}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Method</dt>
                        <dd className="font-semibold text-foreground">
                          {modeSummaryLabel}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Selected pages</dt>
                        <dd className="font-semibold text-foreground">
                          {pageGroupsPreview.error ? "—" : selectedPageCount}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Output files</dt>
                        <dd className="font-semibold text-foreground">
                          {pageGroupsPreview.error
                            ? "—"
                            : pageGroupsPreview.groups.length}
                        </dd>
                      </div>
                    </dl>

                    {!pageGroupsPreview.error &&
                      pageGroupsPreview.groups.length > 0 &&
                      mode !== "individual" && (
                        <ul className="mt-2 max-h-40 space-y-1.5 overflow-y-auto">
                          {pageGroupsPreview.groups.map((group, index) => (
                            <li
                              key={`${group.join("-")}-${index}`}
                              className="rounded-md border border-border bg-surface px-2.5 py-2 text-xs"
                            >
                              <span className="font-semibold text-scanonix-orange">
                                File {index + 1}
                              </span>
                              <span className="mt-0.5 block text-scanonix-muted">
                                Pages {group.join(", ")}
                              </span>
                            </li>
                          ))}
                        </ul>
                      )}
                  </section>

                  <p className="ux-pdf-note">{splitHint}</p>
                  <div className="border-t border-border/80 pt-4">
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </div>
                </div>
              )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
