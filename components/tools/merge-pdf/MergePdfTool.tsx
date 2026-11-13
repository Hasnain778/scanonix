"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Plus } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { MergeDocumentGrid } from "@/components/tools/merge-pdf/MergeDocumentGrid";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-wave4b.css";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import { createFileId, formatFileSize } from "@/lib/tools/format-utils";
import { mergePdfs } from "@/lib/tools/merge-pdf/merge-pdfs";
import { getPdfPageCount, isAcceptedPdfFile } from "@/lib/tools/pdf-utils";
import type { PdfFileItem, ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";

const PRIVACY_MESSAGE =
  "Your files are processed locally in your browser and never uploaded to any server. Scanonix does not store or access your documents.";

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
      const gate = await gateToolOperation("merge-pdf");
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

  const primaryLabel = hasResult
    ? "Download PDF"
    : status === "loading"
      ? "Merging PDFs…"
      : "Merge PDFs";

  return (
    <div className="ux-wave4b overflow-x-hidden">
      <div className="ux-wave4b-banner">
        <ToolStatusBanner
          status={status}
          message={statusMessage}
          progress={progress}
        />
      </div>

      {files.length === 0 ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="PDF"
            toLabel="PDF"
            buttonLabel="Upload PDFs"
            prompt="Upload or drag PDF files here."
            formats="PDF"
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple
            disabled={isBusy}
            onFilesSelected={addFiles}
          />
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>
      ) : (
        <div className="ux-workspace" data-tool-workspace="active">
          <div className="ux-stage">
            <div className="ux-command">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">
                  {files.length} PDF{files.length === 1 ? "" : "s"}
                  {totalPages > 0 ? ` · ${totalPages} pages` : ""}
                  {` · ${formatFileSize(totalSize)}`}
                </p>
                <p className="mt-0.5 text-xs text-scanonix-muted">
                  {hasResult ? "Your merged PDF is ready to download." : mergeHint}
                </p>
              </div>
              <div className="ux-command-actions">
                <ActionButton
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={handleAddMoreClick}
                >
                  <span className="inline-flex items-center justify-center gap-1.5">
                    <Plus className="h-3.5 w-3.5" aria-hidden="true" />
                    Add PDFs
                  </span>
                </ActionButton>
                {hasResult ? (
                  <ActionButton
                    variant="ghost"
                    size="sm"
                    disabled={isBusy}
                    onClick={handleChangeOrder}
                  >
                    Change order
                  </ActionButton>
                ) : null}
                <ActionButton
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={clearAll}
                >
                  {hasResult ? "Start over" : "Clear all"}
                </ActionButton>
                <ActionButton
                  size="lg"
                  className="ux-command-primary"
                  loading={hasResult ? isDownloading : status === "loading"}
                  disabled={hasResult ? isBusy || !mergedBlob : !canMerge || isBusy}
                  onClick={() => {
                    if (hasResult) {
                      void handleDownload();
                    } else {
                      void handleMerge();
                    }
                  }}
                >
                  {primaryLabel}
                </ActionButton>
              </div>
            </div>

            <p className="ux-wave4b-hint">
              Arrange your PDFs in the order they should appear. Drag a file,
              or use the up and down buttons.
            </p>

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
            />

            {hasResult && mergedBlob ? (
              <div className="space-y-4 px-1">
                <div>
                  <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                    Result
                  </p>
                  <p className="mt-1.5 text-sm font-semibold text-green-700 [[data-theme=dark]_&]:text-green-400">
                    <span aria-hidden="true">✓ </span>
                    PDFs merged
                  </p>
                  <p className="mt-1 text-xs text-scanonix-muted">
                    Your merged PDF is ready to download.
                  </p>
                </div>
                <dl className="ux-wave4b-stats text-sm">
                  <div>
                    <dt className="text-scanonix-muted">Files merged</dt>
                    <dd className="font-semibold text-foreground">{files.length}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Total pages</dt>
                    <dd className="font-semibold text-foreground">{totalPages}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Output size</dt>
                    <dd className="font-semibold text-foreground">
                      {formatFileSize(mergedBlob.size)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Filename</dt>
                    <dd className="min-w-0 truncate font-semibold text-foreground">
                      scanonix-merged.pdf
                    </dd>
                  </div>
                </dl>
              </div>
            ) : (
              <div className="space-y-4 px-1">
                <dl className="ux-wave4b-stats text-sm">
                  <div>
                    <dt className="text-scanonix-muted">PDF files</dt>
                    <dd className="font-semibold text-foreground">{files.length}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Total pages</dt>
                    <dd className="font-semibold text-foreground">
                      {isReadingPages ? "…" : totalPages}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Total size</dt>
                    <dd className="font-semibold text-foreground">
                      {formatFileSize(totalSize)}
                    </dd>
                  </div>
                </dl>
                <p className="text-xs text-scanonix-muted">Order follows the file list.</p>
              </div>
            )}

            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </div>
        </div>
      )}
    </div>
  );
}
