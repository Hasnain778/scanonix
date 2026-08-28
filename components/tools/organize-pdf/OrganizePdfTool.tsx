"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ResultActionBar } from "@/components/tools/ResultActionBar";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M8 7v12M12 7v12M16 7v12" />
    </svg>
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

  return (
    <div className="space-y-6 overflow-x-hidden">
      {!uploadedPdf && (
        <>
          <FileDropZone
            onFilesSelected={handleUpload}
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            icon={<PdfDropIcon />}
            label="Drop a PDF file here to organize"
            hint="or click to browse — processed locally in your browser"
          />
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </>
      )}

      {uploadedPdf && (
        <>
          <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-white sm:text-base">
                  {uploadedPdf.file.name}
                </p>
                <p className="mt-1 text-xs text-scanonix-muted sm:text-sm">
                  {formatFileSize(uploadedPdf.file.size)} · {pages.length} page
                  {pages.length === 1 ? "" : "s"}
                  {summary && summary.deletedCount > 0
                    ? ` · ${summary.deletedCount} deleted`
                    : ""}
                  {summary && summary.rotatedCount > 0
                    ? ` · ${summary.rotatedCount} rotated`
                    : ""}
                </p>
              </div>
              <ActionButton
                variant="outline"
                size="sm"
                className="shrink-0 rounded-xl"
                disabled={isBusy}
                onClick={resetWorkspace}
              >
                Choose another PDF
              </ActionButton>
            </div>
          </div>

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

          <ToolStatusBanner
            status={isReadingPdf ? "loading" : status}
            message={isReadingPdf ? "Reading PDF…" : statusMessage}
            progress={progress}
          />

          {hasResult && resultBlob && (
            <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
              <h2 className="mb-2 text-lg font-semibold text-white">
                Organized PDF ready
              </h2>
              <p className="text-sm text-scanonix-muted">
                Download your reorganized PDF ({pages.length} page
                {pages.length === 1 ? "" : "s"}).
              </p>
              <div className="mt-5">
                <ResultActionBar
                  phase={resultActionPhase}
                  primary={{
                    label: isDownloading ? "Downloading…" : "Download PDF",
                    onClick: () => {
                      void handleDownload();
                    },
                    loading: isDownloading,
                    disabled: isDownloading,
                  }}
                  startOver={{
                    label: "Start over",
                    onClick: resetWorkspace,
                    disabled: isBusy,
                  }}
                />
              </div>
            </div>
          )}

          <div className="hidden flex-col gap-4 sm:flex">
            <div className="flex flex-wrap items-stretch gap-4">
              <ActionButton
                variant="primary"
                size="lg"
                className="min-h-[3.25rem] shrink-0 rounded-2xl px-8 text-base"
                disabled={!canExport}
                onClick={handleExport}
              >
                {isExporting ? "Organizing…" : "Export organized PDF"}
              </ActionButton>

              {summary && (
                <div className="flex min-w-0 flex-1 flex-wrap gap-2">
                  <div className="rounded-xl border border-scanonix-border bg-scanonix-surface px-4 py-2.5">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-scanonix-muted">
                      Pages
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {summary.currentPages}
                    </p>
                  </div>
                  <div className="rounded-xl border border-scanonix-border bg-scanonix-surface px-4 py-2.5">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-scanonix-muted">
                      Rotated
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {summary.rotatedCount}
                    </p>
                  </div>
                  <div className="rounded-xl border border-scanonix-border bg-scanonix-surface px-4 py-2.5">
                    <p className="text-[0.65rem] font-medium uppercase tracking-wide text-scanonix-muted">
                      File size
                    </p>
                    <p className="text-lg font-semibold text-white">
                      {formatFileSize(uploadedPdf.file.size)}
                    </p>
                  </div>
                </div>
              )}
            </div>
          </div>

          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </>
      )}

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

      {!uploadedPdf && (
        <ToolStatusBanner status={status} message={statusMessage} />
      )}
    </div>
  );
}
