"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { PdfPageGrid } from "@/components/tools/split-pdf/PdfPageGrid";
import { SplitModePanel } from "@/components/tools/split-pdf/SplitModePanel";
import { ResultActionBar } from "@/components/tools/ResultActionBar";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
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
import {
  extractPdfGroups,
} from "@/lib/tools/split-pdf/split-pdf";
import type { SplitMode, SplitOutput, ToolStatus } from "@/lib/tools/types";
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
        d="M9 12h6m-3-3v6"
      />
    </svg>
  );
}

interface SplitDownloadState {
  blob: Blob;
  filename: string;
  outputCount: number;
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

  /** Presentational adapter only — does not replace the ToolStatus state machine. */
  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (canSplit) return "ready";
    return "idle";
  }, [status, hasResult, canSplit]);

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

    const gate = await gateToolOperation("split-pdf", uploadedPdf.file.size);
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
      downloadBlob(state.blob, state.filename, buildToolDownloadMeta("split-pdf", state.outputCount));
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

  return (
    <div className="space-y-8">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={
          isReadingPdf ? "Reading PDF…" : statusMessage
        }
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
            label="Drop a PDF file here to split"
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

          <SplitModePanel
            mode={mode}
            onModeChange={setMode}
            rangeInput={rangeInput}
            onRangeInputChange={setRangeInput}
            interval={interval}
            onIntervalChange={setInterval}
            rangeError={rangeError}
            disabled={isBusy}
          />

          {mode === "individual" && (
            <PdfPageGrid
              totalPages={uploadedPdf.pageCount}
              selectedPages={selectedPages}
              onTogglePage={togglePage}
              onSelectAll={() =>
                setSelectedPages(
                  Array.from(
                    { length: uploadedPdf.pageCount },
                    (_, index) => index + 1,
                  ),
                )
              }
              onClearSelection={() => setSelectedPages([])}
              disabled={isBusy}
            />
          )}

          {mode !== "individual" && uploadedPdf.pageCount > 0 && (
            <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
              <h2 className="text-lg font-semibold text-white">Preview</h2>
              <p className="mt-1 text-sm text-scanonix-muted">
                {pageGroupsPreview.error
                  ? pageGroupsPreview.error
                  : `${pageGroupsPreview.groups.length} output file${pageGroupsPreview.groups.length === 1 ? "" : "s"} will be created.`}
              </p>
              {!pageGroupsPreview.error &&
                pageGroupsPreview.groups.length > 0 && (
                  <ul className="mt-4 grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {pageGroupsPreview.groups.map((group, index) => (
                      <li
                        key={`${group.join("-")}-${index}`}
                        className="rounded-xl border border-scanonix-border bg-black/30 px-4 py-3 text-sm text-neutral-300"
                      >
                        <span className="font-semibold text-scanonix-orange">
                          File {index + 1}
                        </span>
                        <span className="mt-1 block text-scanonix-muted">
                          Pages {group.join(", ")}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
            </div>
          )}

          {hasResult && downloadState && (
            <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
              <h2 className="mb-2 text-lg font-semibold text-white">Results</h2>
              <p className="text-sm text-scanonix-muted">
                {downloadState.outputCount} file
                {downloadState.outputCount === 1 ? "" : "s"} ·{" "}
                {formatFileSize(downloadState.blob.size)} ·{" "}
                {downloadState.filename}
              </p>
              <div className="mt-5">
                <ResultActionBar
                  phase={resultActionPhase}
                  primary={{
                    label:
                      downloadState.outputCount === 1
                        ? "Download split PDF"
                        : "Download split PDFs (ZIP)",
                    onClick: () => {
                      void handleDownload();
                    },
                    loading: isDownloading,
                    disabled: isBusy,
                  }}
                  startOver={{
                    label: "Start over",
                    onClick: clearPdf,
                    disabled: isBusy,
                  }}
                />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">Split PDF</h2>
                <p className="mt-1 text-sm text-scanonix-muted">
                  {mode === "individual" && selectedPages.length === 0
                    ? "Select at least one page to continue."
                    : pageGroupsPreview.error
                      ? "Fix the errors above before splitting."
                      : canSplit
                        ? `Ready to create ${pageGroupsPreview.groups.length} file${pageGroupsPreview.groups.length === 1 ? "" : "s"}.`
                        : "Configure your split options above."}
                </p>
              </div>

              <ActionButton
                size="lg"
                className="w-full sm:w-auto"
                loading={status === "loading"}
                disabled={!canSplit}
                onClick={handleSplit}
              >
                {status === "loading" ? "Splitting PDF…" : "Split PDF"}
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
        phase={resultActionPhase}
        primaryLabel={
          downloadState?.outputCount === 1
            ? "Download split PDF"
            : "Download split PDFs"
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
