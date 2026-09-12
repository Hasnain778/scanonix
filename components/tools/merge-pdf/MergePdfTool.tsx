"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Combine, Files, Plus } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { MergeDocumentGrid } from "@/components/tools/merge-pdf/MergeDocumentGrid";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { validateAnonymousUploadSize } from "@/lib/plan/tool-access";
import { downloadBlob } from "@/lib/tools/download";
import { createFileId, formatFileSize } from "@/lib/tools/format-utils";
import { mergePdfs } from "@/lib/tools/merge-pdf/merge-pdfs";
import { getPdfPageCount, isAcceptedPdfFile } from "@/lib/tools/pdf-utils";
import type { PdfFileItem, ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";

const PRIVACY_MESSAGE =
  "Your files are processed locally in your browser and never uploaded to any server. Scanonix does not store or access your documents.";

function MergeDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <Combine className={className} aria-hidden="true" strokeWidth={1.75} />
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

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (canMerge) return "ready";
    return "idle";
  }, [status, hasResult, canMerge]);

  const stickyVisible = Boolean(files.length > 0 && (canMerge || hasResult || status === "loading" || status === "error"));

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

  const handleChangeOrder = useCallback(() => {
    mergedBlobRef.current = null;
    setMergedBlob(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const handleMerge = async () => {
    if (!canMerge || isBusy) return;

    const totalBytes = files.reduce((sum, item) => sum + item.file.size, 0);

    // Non-consuming plan size check first (same helper gateToolOperation uses for free tools).
    const sizeError = validateAnonymousUploadSize("merge-pdf", totalBytes);
    if (sizeError) {
      setStatus("error");
      setStatusMessage(sizeError);
      return;
    }

    const attempt = createProcessAttempt("merge-pdf");
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

      // Consume only after a successful client merge.
      const gate = await gateToolOperation("merge-pdf", totalBytes);
      if (!gate.ok) {
        attempt.error(planErrorMessageToCode(gate.message));
        setStatus("error");
        setStatusMessage(gate.message);
        setProgress(undefined);
        return;
      }

      const totalPagesMerged = files.reduce(
        (sum, file) => sum + (file.pageCount ?? 0),
        0,
      );

      setMergedBlob(blob);
      attempt.success(1);
      setStatus("success");
      setStatusMessage(
        `Merged ${files.length} PDFs (${totalPagesMerged} pages) — ready to download.`,
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
      downloadBlob(
        blob,
        "scanonix-merged.pdf",
        buildToolDownloadMeta("merge-pdf", 1),
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const handleAddMoreClick = useCallback(() => {
    if (isBusy) return;
    addMoreInputRef.current?.click();
  }, [isBusy]);

  const handleAddMoreChange = useCallback(
    (event: React.ChangeEvent<HTMLInputElement>) => {
      const list = event.target.files;
      if (!list || list.length === 0) return;

      const selected = Array.from(list).filter(isAcceptedPdfFile);
      if (selected.length > 0) {
        addFiles(selected);
      }
      event.target.value = "";
    },
    [addFiles],
  );

  const totalPages = files.reduce((sum, file) => sum + (file.pageCount ?? 0), 0);
  const totalSize = files.reduce((sum, file) => sum + file.file.size, 0);

  const mergeHint =
    files.length < 2
      ? "Add at least 2 PDF files to merge."
      : isReadingPages
        ? "Reading page counts…"
        : status === "loading"
          ? "Merging PDFs…"
          : `Ready to merge ${files.length} PDFs.`;

  return (
    <div
      className={`space-y-5 overflow-x-hidden md:pb-0 ${
        stickyVisible ? "pb-40" : "pb-8"
      }`}
    >
      <ToolStatusBanner
        status={status}
        message={statusMessage}
        progress={progress}
      />

      <ToolWorkspaceShell
        isEmpty={files.length === 0}
        empty={
          <>
            <FileDropZone
              onFilesSelected={addFiles}
              accept={ACCEPTED_PDF_EXTENSIONS}
              validateFile={isAcceptedPdfFile}
              disabled={isBusy}
              label="Drop PDF files here to merge"
              hint="or click to browse — PDF files only"
              icon={<MergeDropIcon />}
            />
            <div className="pr-24 sm:pr-36 lg:pr-0">
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </>
        }
        workArea={
          files.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <Files className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      Merge workspace
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {files.length} PDF{files.length === 1 ? "" : "s"}
                      {totalPages > 0 ? ` · ${totalPages} pages` : ""}
                      {` · ${formatFileSize(totalSize)}`}
                    </p>
                  </div>
                </div>
                <div
                  className={`w-full sm:w-auto ${hasResult ? "hidden md:block" : ""}`.trim()}
                >
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={clearAll}
                  >
                    {hasResult ? "Start over" : "Clear all"}
                  </ActionButton>
                </div>
              </div>

              <div className="bg-surface-muted/30 p-3 sm:p-4">
                <input
                  ref={addMoreInputRef}
                  type="file"
                  accept={ACCEPTED_PDF_EXTENSIONS}
                  multiple
                  disabled={isBusy}
                  className="sr-only"
                  aria-hidden="true"
                  tabIndex={-1}
                  onChange={handleAddMoreChange}
                />
                <MergeDocumentGrid
                  files={files}
                  onRemove={removeFile}
                  onReorder={reorderFiles}
                  disabled={isBusy}
                  headerAction={
                    <ActionButton
                      variant="outline"
                      size="sm"
                      className="w-full rounded-lg sm:w-auto"
                      disabled={isBusy}
                      onClick={handleAddMoreClick}
                    >
                      <span className="inline-flex items-center justify-center gap-1.5">
                        <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                        Add PDFs
                      </span>
                    </ActionButton>
                  }
                />
              </div>
            </div>
          ) : null
        }
        controlPanel={
          files.length > 0 ? (
            <ToolControlPanel
              aria-label="Merge PDF controls"
              footer={
                hasResult && mergedBlob ? (
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
                      onClick={handleChangeOrder}
                    >
                      Change order
                    </ActionButton>
                    <div className="hidden md:block">
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={clearAll}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {mergeHint}
                    </p>
                    <div className="hidden md:block space-y-2">
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={status === "loading"}
                        disabled={!canMerge || isBusy}
                        onClick={() => {
                          void handleMerge();
                        }}
                      >
                        {status === "loading" ? "Merging PDFs…" : "Merge PDFs"}
                      </ActionButton>
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={clearAll}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                )
              }
            >
              {hasResult && mergedBlob ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-foreground">
                      <span className="text-green-600" aria-hidden="true">
                        ✓{" "}
                      </span>
                      PDFs merged
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your merged PDF is ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Files merged</dt>
                      <dd className="font-semibold text-foreground">
                        {files.length}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Total pages</dt>
                      <dd className="font-semibold text-foreground">
                        {totalPages}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Output size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(mergedBlob.size)}
                      </dd>
                    </div>
                    <div className="min-w-0 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Filename</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        scanonix-merged.pdf
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Combine
                        className="h-4 w-4 text-scanonix-orange"
                        aria-hidden="true"
                      />
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Merge PDF
                      </p>
                    </div>
                    <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
                      Combine your PDFs in the order shown.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">PDF files</dt>
                      <dd className="font-semibold text-foreground">
                        {files.length}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Total pages</dt>
                      <dd className="font-semibold text-foreground">
                        {isReadingPages ? "…" : totalPages}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Total size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(totalSize)}
                      </dd>
                    </div>
                  </dl>

                  <div>
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Merge order
                    </p>
                    <ol className="max-h-48 space-y-1.5 overflow-y-auto rounded-xl border border-border bg-surface-muted/40 p-2.5 text-sm">
                      {files.map((item, index) => (
                        <li
                          key={item.id}
                          className="flex min-w-0 items-center gap-2 rounded-md px-1.5 py-1"
                        >
                          <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded border border-scanonix-orange/30 bg-scanonix-orange/10 text-[10px] font-bold text-scanonix-orange">
                            {index + 1}
                          </span>
                          <span className="min-w-0 truncate text-foreground">
                            {item.file.name}
                          </span>
                        </li>
                      ))}
                    </ol>
                  </div>

                  <div className="border-t border-border/80 pt-3 pr-24 sm:pr-36 lg:pr-0">
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </div>
                </div>
              )}
            </ToolControlPanel>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={stickyVisible}
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download PDF" : "Merge PDFs"}
        primaryLoading={hasResult ? isDownloading : status === "loading"}
        primaryDisabled={hasResult ? isBusy || !mergedBlob : !canMerge || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => {
          if (hasResult) {
            void handleDownload();
          } else {
            void handleMerge();
          }
        }}
        onStartOver={hasResult || files.length > 0 ? clearAll : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
