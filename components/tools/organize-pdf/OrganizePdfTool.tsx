"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  FileText,
  LayoutGrid,
  Lightbulb,
  RotateCw,
  Trash2,
} from "lucide-react";
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
  buildOrganizedPdfFilename,
  deletePageById,
  getOrganizePdfErrorMessage,
  loadOrganizeDocumentState,
  movePageFirst,
  movePageLast,
  movePageLeft,
  movePageRight,
  organizePdfFromState,
  OrganizePdfError,
  reorderPages,
  rotatePageById,
  type OrganizeDocumentState,
} from "@/lib/tools/organize-pdf";
import {
  canExportOrganizeWorkspace,
  getWorkspaceSummary,
} from "@/lib/tools/organize-pdf/workspace-ui";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { OrganizePageGrid } from "./OrganizePageGrid";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  initialPageCount: number;
  document: OrganizeDocumentState;
}

const PRIVACY_MESSAGE =
  "Your PDF is organized locally in your browser and is not uploaded to Scanonix servers.";

function OrganizeDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <LayoutGrid className={className} aria-hidden="true" strokeWidth={1.75} />
  );
}

export function OrganizePdfTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("scanonix-organized.pdf");
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();

  const resultBlobRef = useRef<Blob | null>(null);

  const isBusy = status === "loading" || isReadingPdf || isExporting || isDownloading;
  const hasResult = resultBlob !== null && status === "success";
  const pages = uploadedPdf?.document.pages ?? [];
  const canExport =
    uploadedPdf !== null &&
    canExportOrganizeWorkspace(pages.length, isExporting);

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (isExporting || status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedPdf !== null && pages.length > 0) return "ready";
    return "idle";
  }, [isExporting, status, hasResult, uploadedPdf, pages.length]);

  const stickyVisible = Boolean(
    uploadedPdf && (hasResult || canExport || isExporting),
  );

  const summary = uploadedPdf
    ? getWorkspaceSummary(pages, uploadedPdf.initialPageCount)
    : null;

  useEffect(() => {
    resultBlobRef.current = resultBlob;
  }, [resultBlob]);

  useEffect(() => {
    return () => {
      resultBlobRef.current = null;
    };
  }, []);

  const invalidateResult = useCallback(() => {
    resultBlobRef.current = null;
    setResultBlob(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const resetWorkspace = useCallback(() => {
    resultBlobRef.current = null;
    setUploadedPdf(null);
    setResultBlob(null);
    setResultFilename("scanonix-organized.pdf");
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsExporting(false);
    setIsDownloading(false);
  }, []);

  const updateDocument = useCallback(
    (document: OrganizeDocumentState) => {
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
    setProgress(undefined);

    try {
      const bytes = await file.arrayBuffer();
      const document = await loadOrganizeDocumentState(bytes, {
        byteLength: file.size,
      });

      setUploadedPdf({
        file,
        bytes,
        initialPageCount: document.pages.length,
        document,
      });
      setResultFilename(buildOrganizedPdfFilename(file.name));
    } catch (error) {
      setStatus("error");
      setStatusMessage(getOrganizePdfErrorMessage(error));
      setUploadedPdf(null);
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const handleReorder = useCallback(
    (fromIndex: number, toIndex: number) => {
      if (!uploadedPdf) return;
      try {
        updateDocument({
          pages: reorderPages(uploadedPdf.document.pages, fromIndex, toIndex),
        });
      } catch (error) {
        setStatus("error");
        setStatusMessage(getOrganizePdfErrorMessage(error));
      }
    },
    [uploadedPdf, updateDocument],
  );

  const handleMoveFirst = useCallback(
    (pageId: string) => {
      if (!uploadedPdf) return;
      updateDocument({
        pages: movePageFirst(uploadedPdf.document.pages, pageId),
      });
    },
    [uploadedPdf, updateDocument],
  );

  const handleMoveEarlier = useCallback(
    (pageId: string) => {
      if (!uploadedPdf) return;
      updateDocument({
        pages: movePageLeft(uploadedPdf.document.pages, pageId),
      });
    },
    [uploadedPdf, updateDocument],
  );

  const handleMoveLater = useCallback(
    (pageId: string) => {
      if (!uploadedPdf) return;
      updateDocument({
        pages: movePageRight(uploadedPdf.document.pages, pageId),
      });
    },
    [uploadedPdf, updateDocument],
  );

  const handleMoveLast = useCallback(
    (pageId: string) => {
      if (!uploadedPdf) return;
      updateDocument({
        pages: movePageLast(uploadedPdf.document.pages, pageId),
      });
    },
    [uploadedPdf, updateDocument],
  );

  const handleRotate = useCallback(
    (pageId: string) => {
      if (!uploadedPdf) return;
      updateDocument({
        pages: rotatePageById(uploadedPdf.document.pages, pageId),
      });
    },
    [uploadedPdf, updateDocument],
  );

  const handleDelete = useCallback(
    (pageId: string) => {
      if (!uploadedPdf) return;
      try {
        updateDocument({
          pages: deletePageById(uploadedPdf.document.pages, pageId),
        });
        setStatus("idle");
        setStatusMessage(undefined);
      } catch (error) {
        if (
          error instanceof OrganizePdfError &&
          error.code === "CANNOT_DELETE_LAST_PAGE"
        ) {
          setStatus("error");
          setStatusMessage(error.message);
          return;
        }
        setStatus("error");
        setStatusMessage(getOrganizePdfErrorMessage(error));
      }
    },
    [uploadedPdf, updateDocument],
  );

  const handleExport = async () => {
    if (!uploadedPdf || !canExport || isExporting) return;

    const attempt = createProcessAttempt("organize-pdf");
    if (!attempt?.markStarted()) return;

    setIsExporting(true);
    setStatus("loading");
    setStatusMessage("Organizing PDF pages…");
    setProgress(undefined);
    invalidateResult();

    try {
      const blob = await organizePdfFromState(
        uploadedPdf.bytes,
        uploadedPdf.document,
        (current, total) => {
          setProgress({ current, total });
        },
      );

      resultBlobRef.current = blob;
      setResultBlob(blob);
      attempt.success(1);
      setStatus("success");
      setStatusMessage(
        `Organized PDF ready — ${pages.length} page${pages.length === 1 ? "" : "s"}.`,
      );
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(getOrganizePdfErrorMessage(error));
      setResultBlob(null);
    } finally {
      setIsExporting(false);
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    if (!resultBlob || isDownloading) return;

    setIsDownloading(true);
    try {
      await downloadBlob(resultBlob, resultFilename, buildToolDownloadMeta("organize-pdf", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleChangeSettings = useCallback(() => {
    invalidateResult();
  }, [invalidateResult]);

  const exportHint = canExport
    ? `Ready to export ${pages.length} page${pages.length === 1 ? "" : "s"}.`
    : pages.length === 0
      ? "At least one page is required to export."
      : "Organize pages, then export.";

  return (
    <div className="space-y-5 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
        progress={progress}
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
              icon={<OrganizeDropIcon />}
              label="Drop a PDF file here to organize"
              hint="or click to browse — processed locally in your browser"
            />
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </>
        }
        workArea={
          uploadedPdf ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <FileText className="h-4 w-4" aria-hidden="true" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedPdf.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedPdf.file.size)} · {pages.length}{" "}
                      page{pages.length === 1 ? "" : "s"}
                      {summary && summary.deletedCount > 0
                        ? ` · ${summary.deletedCount} deleted`
                        : ""}
                      {summary && summary.rotatedCount > 0
                        ? ` · ${summary.rotatedCount} rotated`
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
                <OrganizePageGrid
                  pdfBytes={uploadedPdf.bytes}
                  pages={pages}
                  disabled={isBusy}
                  onReorder={handleReorder}
                  onMoveFirst={handleMoveFirst}
                  onMoveEarlier={handleMoveEarlier}
                  onMoveLater={handleMoveLater}
                  onMoveLast={handleMoveLast}
                  onRotate={handleRotate}
                  onDelete={handleDelete}
                />
              </div>
            </div>
          ) : null
        }
        controlPanel={
          uploadedPdf ? (
            <ToolControlPanel
              aria-label="Organize PDF controls"
              footer={
                hasResult && resultBlob ? (
                  <div className="flex flex-col gap-2">
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full"
                        loading={isDownloading}
                        disabled={isDownloading}
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
                        {isExporting ? "Organizing…" : "Export organized PDF"}
                      </ActionButton>
                    </div>
                    <div
                      className={
                        stickyVisible ? "hidden md:block" : undefined
                      }
                    >
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
                      ✓ Organize complete
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your reorganized PDF is ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Pages</dt>
                      <dd className="font-semibold text-foreground">
                        {pages.length}
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
                <div className="space-y-5">
                  <div>
                    <div className="flex items-center gap-2">
                      <LayoutGrid
                        className="h-4 w-4 text-scanonix-orange"
                        aria-hidden="true"
                      />
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Organize PDF
                      </p>
                    </div>
                    <p className="mt-2 text-sm leading-snug text-scanonix-muted">
                      Reorder pages, rotate, or delete pages from your PDF.
                    </p>
                  </div>

                  {summary && (
                    <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <dt className="flex items-center gap-2 text-scanonix-muted">
                          <LayoutGrid
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          Total pages
                        </dt>
                        <dd className="font-semibold text-foreground">
                          {summary.currentPages}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <dt className="flex items-center gap-2 text-scanonix-muted">
                          <RotateCw
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          Rotated pages
                        </dt>
                        <dd className="font-semibold text-foreground">
                          {summary.rotatedCount}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <dt className="flex items-center gap-2 text-scanonix-muted">
                          <Trash2
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          Deleted pages
                        </dt>
                        <dd className="font-semibold text-foreground">
                          {summary.deletedCount}
                        </dd>
                      </div>
                      <div className="flex items-center justify-between gap-3 px-3 py-2.5">
                        <dt className="flex items-center gap-2 text-scanonix-muted">
                          <FileText
                            className="h-3.5 w-3.5 shrink-0"
                            aria-hidden="true"
                          />
                          File size
                        </dt>
                        <dd className="font-semibold text-foreground">
                          {formatFileSize(uploadedPdf.file.size)}
                        </dd>
                      </div>
                    </dl>
                  )}

                  <div className="rounded-xl border border-scanonix-orange/25 bg-scanonix-orange/10 px-3 py-3">
                    <div className="flex items-start gap-2.5">
                      <Lightbulb
                        className="mt-0.5 h-4 w-4 shrink-0 text-scanonix-orange"
                        aria-hidden="true"
                      />
                      <div>
                        <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-scanonix-orange">
                          Tip
                        </p>
                        <p className="mt-1 text-xs leading-relaxed text-foreground">
                          Drag and drop pages to reorder. Use the buttons below
                          each page to rotate or delete.
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="border-t border-border/80 pt-4">
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
        primaryLabel={
          hasResult
            ? isDownloading
              ? "Downloading…"
              : "Download PDF"
            : isExporting
              ? "Organizing…"
              : "Export PDF"
        }
        primaryLoading={hasResult ? isDownloading : isExporting}
        primaryDisabled={hasResult ? isDownloading : !canExport}
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
