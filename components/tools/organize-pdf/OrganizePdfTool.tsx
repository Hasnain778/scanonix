"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileText, LayoutGrid } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import "@/styles/ordered-collection-premium.css";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
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

    setIsReadingPdf(true);
    setStatus("idle");
    setStatusMessage(undefined);
    setResultBlob(null);
    setProgress(undefined);

    try {
      const bytes = await file.arrayBuffer();
      const document = await loadOrganizeDocumentState(bytes);

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
    <div className="ordered-collection-premium ordered-collection-full space-y-5 overflow-x-hidden">
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
              className="ordered-drop"
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
            <div className="ordered-stage">
              <div className="ordered-stage-bar flex flex-col gap-2.5 py-1 sm:flex-row sm:items-center sm:justify-between">
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
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row sm:items-center">
                  {hasResult && resultBlob ? (
                    <div className={resultActionPhase === "success" ? "hidden lg:block" : undefined}>
                      <ActionButton
                        size="lg"
                        className="w-full sm:w-auto"
                        loading={isDownloading}
                        disabled={isDownloading}
                        onClick={() => {
                          void handleDownload();
                        }}
                      >
                        Download PDF
                      </ActionButton>
                    </div>
                  ) : (
                    <div
                      className={
                        resultActionPhase === "ready" ||
                        resultActionPhase === "processing"
                          ? "hidden lg:block"
                          : undefined
                      }
                    >
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)] sm:w-auto"
                        loading={isExporting}
                        disabled={!canExport}
                        onClick={handleExport}
                      >
                        {isExporting ? "Organizing…" : "Export organized PDF"}
                      </ActionButton>
                    </div>
                  )}
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

              <div className="ordered-stage-grid">
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
              <div className="ordered-actions">
                {hasResult && resultBlob ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Result
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-green-700 [[data-theme=dark]_&]:text-green-400">
                        ✓ Organize complete
                      </p>
                      <p className="mt-1 text-xs text-scanonix-muted">
                        Your reorganized PDF is ready to download.
                      </p>
                    </div>
                    <dl className="space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-scanonix-muted">Pages</dt>
                        <dd className="font-semibold text-foreground">
                          {pages.length}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-scanonix-muted">File size</dt>
                        <dd className="font-semibold text-foreground">
                          {formatFileSize(resultBlob.size)}
                        </dd>
                      </div>
                      <div className="min-w-0">
                        <dt className="text-scanonix-muted">Filename</dt>
                        <dd className="mt-0.5 truncate font-semibold text-foreground">
                          {resultFilename}
                        </dd>
                      </div>
                    </dl>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={handleChangeSettings}
                    >
                      Change settings
                    </ActionButton>
                  </div>
                ) : (
                  <p className="text-[11px] leading-snug text-scanonix-muted">
                    {exportHint}
                  </p>
                )}
                <div className="pt-3">
                  <PrivacyNotice message={PRIVACY_MESSAGE} />
                </div>
              </div>
            </div>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={stickyVisible}
        stickyUntil="lg"
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
      />
    </div>
  );
}
