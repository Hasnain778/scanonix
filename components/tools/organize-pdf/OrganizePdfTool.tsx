"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/ux-pdf-pages.css";
import "@/styles/ux-reset-file-pair.css";
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

  const primaryLabel = hasResult
    ? "Download PDF"
    : isExporting
      ? "Organizing…"
      : "Export organized PDF";

  return (
    <div className="ux-pdf-pages overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
        progress={progress}
      />

      {!uploadedPdf ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="PDF"
            toLabel="ORDER"
            buttonLabel="Upload a PDF"
            prompt="Upload or drag a PDF here."
            formats="PDF"
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            onFilesSelected={handleUpload}
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
              <div className="ux-command-actions">
                <ActionButton
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={resetWorkspace}
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
                  loading={hasResult ? isDownloading : isExporting}
                  disabled={hasResult ? isDownloading : !canExport}
                  onClick={() => {
                    if (hasResult) {
                      void handleDownload();
                    } else {
                      void handleExport();
                    }
                  }}
                >
                  {primaryLabel}
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

            <div className="space-y-3">
              {hasResult && resultBlob ? (
                <div className="space-y-3">
                  <p className="text-sm font-semibold text-green-700 [[data-theme=dark]_&]:text-green-400">
                    ✓ Organize complete
                  </p>
                  <p className="text-xs text-scanonix-muted">
                    Your reorganized PDF is ready to download.
                  </p>
                  <dl className="space-y-2 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-scanonix-muted">Pages</dt>
                      <dd className="font-semibold text-foreground">{pages.length}</dd>
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
                </div>
              ) : (
                <p className="ux-pdf-note">{exportHint}</p>
              )}
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
