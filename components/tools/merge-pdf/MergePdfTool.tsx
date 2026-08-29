"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PdfFileList } from "@/components/tools/PdfFileList";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ResultActionBar } from "@/components/tools/ResultActionBar";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import { createFileId, formatFileSize } from "@/lib/tools/format-utils";
import { mergePdfs } from "@/lib/tools/merge-pdf/merge-pdfs";
import { getPdfPageCount, isAcceptedPdfFile } from "@/lib/tools/pdf-utils";
import type { PdfFileItem, ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

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
        d="M14 3v4a2 2 0 002 2h4M12 11v6m-3-3h6"
      />
    </svg>
  );
}

export function MergePdfTool() {
  const [files, setFiles] = useState<PdfFileItem[]>([]);
  const [mergedBlob, setMergedBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const mergedBlobRef = useRef<Blob | null>(null);

  const isBusy = status === "loading" || isDownloading;
  const canMerge = files.length >= 2 && !files.some((file) => file.pageCount === null);
  const isReadingPages = files.some((file) => file.pageCount === null);
  const hasResult = mergedBlob !== null && status === "success";

  /** Presentational adapter only — does not replace the ToolStatus state machine. */
  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (canMerge) return "ready";
    return "idle";
  }, [status, hasResult, canMerge]);

  useEffect(() => {
    mergedBlobRef.current = mergedBlob;
  }, [mergedBlob]);

  useEffect(() => {
    return () => {
      mergedBlobRef.current = null;
    };
  }, []);

  const loadPageCount = useCallback(async (id: string, file: File) => {
    try {
      const pageCount = await getPdfPageCount(file);
      setFiles((current) =>
        current.map((item) =>
          item.id === id ? { ...item, pageCount, pageCountError: undefined } : item,
        ),
      );
    } catch {
      setFiles((current) =>
        current.map((item) =>
          item.id === id
            ? {
                ...item,
                pageCount: 0,
                pageCountError: "Could not read PDF",
              }
            : item,
        ),
      );
    }
  }, []);

  const addFiles = useCallback(
    (selectedFiles: File[]) => {
      const newItems: PdfFileItem[] = selectedFiles.map((file) => ({
        id: createFileId(),
        file,
        pageCount: null,
      }));

      setFiles((current) => [...current, ...newItems]);
      setStatus("idle");
      setStatusMessage(undefined);
      setMergedBlob(null);

      newItems.forEach((item) => {
        void loadPageCount(item.id, item.file);
      });
    },
    [loadPageCount],
  );

  const removeFile = useCallback((id: string) => {
    setFiles((current) => current.filter((file) => file.id !== id));
    setMergedBlob(null);
    setStatus("idle");
    setStatusMessage(undefined);
  }, []);

  const reorderFiles = useCallback((fromIndex: number, toIndex: number) => {
    setFiles((current) => {
      const updated = [...current];
      const [moved] = updated.splice(fromIndex, 1);
      updated.splice(toIndex, 0, moved);
      return updated;
    });
    setMergedBlob(null);
    setStatus("idle");
    setStatusMessage(undefined);
  }, []);

  const clearAll = useCallback(() => {
    setFiles([]);
    mergedBlobRef.current = null;
    setMergedBlob(null);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
  }, []);

  const handleMerge = async () => {
    if (!canMerge || isBusy) return;

    const attempt = createProcessAttempt("merge-pdf");

    const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);
    const gate = await gateToolOperation("merge-pdf", totalBytes);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setStatusMessage(undefined);
    setProgress({ current: 0, total: files.length });
    setMergedBlob(null);

    try {
      const blob = await mergePdfs(
        files.map((item) => item.file),
        (current, total) => setProgress({ current, total }),
      );

      const totalPages = files.reduce(
        (sum, file) => sum + (file.pageCount ?? 0),
        0,
      );

      setMergedBlob(blob);
      attempt.success(1);
      setStatus("success");
      setStatusMessage(
        `Merged ${files.length} PDFs (${totalPages} pages) — ready to download.`,
      );
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Failed to merge PDFs",
      );
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const blob = mergedBlobRef.current ?? mergedBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, "scanonix-merged.pdf", buildToolDownloadMeta("merge-pdf", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  const totalPages = files.reduce((sum, file) => sum + (file.pageCount ?? 0), 0);

  return (
    <div className="space-y-8">
      <ToolStatusBanner
        status={status}
        message={statusMessage}
        progress={progress}
      />

      <FileDropZone
        onFilesSelected={addFiles}
        accept={ACCEPTED_PDF_EXTENSIONS}
        validateFile={isAcceptedPdfFile}
        disabled={isBusy}
        label="Drop PDF files here to merge"
        hint="or click to browse — PDF files only"
        icon={<PdfDropIcon />}
      />

      {files.length > 0 && (
        <>
          <PdfFileList
            files={files}
            onRemove={removeFile}
            onReorder={reorderFiles}
            disabled={isBusy}
          />

          {hasResult && mergedBlob && (
            <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
              <h2 className="mb-2 text-lg font-semibold text-foreground">Results</h2>
              <p className="text-sm text-scanonix-muted">
                {files.length} files · {totalPages} pages ·{" "}
                {formatFileSize(mergedBlob.size)}
              </p>
              <div className="mt-5">
                <ResultActionBar
                  phase={resultActionPhase}
                  primary={{
                    label: "Download merged PDF",
                    onClick: () => {
                      void handleDownload();
                    },
                    loading: isDownloading,
                    disabled: isBusy,
                  }}
                  startOver={{
                    label: "Start over",
                    onClick: clearAll,
                    disabled: isBusy,
                  }}
                />
              </div>
            </div>
          )}

          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h2 className="text-lg font-semibold text-foreground">Merge PDFs</h2>
                <p className="mt-1 text-sm text-scanonix-muted">
                  {files.length < 2
                    ? "Add at least 2 PDF files to merge."
                    : isReadingPages
                      ? "Reading page counts…"
                      : `Ready to merge ${files.length} files in order.`}
                </p>
              </div>

              <div className="flex flex-col gap-3 sm:flex-row">
                <ActionButton
                  size="lg"
                  className="w-full sm:w-auto"
                  loading={status === "loading"}
                  disabled={!canMerge || isBusy}
                  onClick={() => {
                    void handleMerge();
                  }}
                >
                  {status === "loading" ? "Merging PDFs…" : "Merge PDFs"}
                </ActionButton>
                {!hasResult && (
                  <ActionButton
                    variant="outline"
                    className="w-full sm:w-auto"
                    disabled={isBusy}
                    onClick={clearAll}
                  >
                    Clear all
                  </ActionButton>
                )}
              </div>
            </div>

            <div className="mt-4 border-t border-scanonix-border pt-4">
              <PrivacyNotice />
            </div>
          </div>
        </>
      )}

      {files.length === 0 && <PrivacyNotice />}

      {/*
        Opt-in result mode (phase prop). Ready-state merge CTA stays inline only —
        sticky must never show Download before hasResult.
      */}
      <ToolStickyMobileActionBar
        visible={hasResult}
        phase={resultActionPhase}
        primaryLabel="Download merged PDF"
        primaryLoading={isDownloading}
        primaryDisabled={isBusy}
        onPrimaryClick={() => {
          void handleDownload();
        }}
        onStartOver={clearAll}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
