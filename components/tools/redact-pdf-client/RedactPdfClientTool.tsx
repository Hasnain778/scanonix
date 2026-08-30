"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { isAcceptedPdfFile } from "@/lib/pdf/core";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { getRedactPdfErrorMessage } from "@/lib/tools/redact-pdf/errors";
import { MAX_REDACT_PDF_BYTES } from "@/lib/tools/redact-pdf/limits";
import { loadRedactionDocumentState } from "@/lib/tools/redact-pdf/redaction-state";
import {
  addRedactionToState,
  applyRedactionsToDocumentState,
  canExportRedactWorkspace,
  clearAllRedactions,
  clearRedactionsForPage,
  commitRedactionHistory,
  computeFitWidthZoom,
  createRedactionHistory,
  detectRedactPdfWarnings,
  DIGITAL_SIGNATURE_REDACT_WARNING,
  getActivePageRedactions,
  isRedactDrawModeActive,
  REDACT_DRAW_MODE,
  REDACT_FORM_ANNOTATION_WARNING,
  REDACT_PERMANENT_APPLIED_COPY,
  REDACT_PRIVACY_COPY,
  REDACT_RASTER_QUALITY_COPY,
  REDACT_SANITIZATION_LIMITATION_COPY,
  redoRedactionHistory,
  removeRedactionFromState,
  resolveRedactExportErrorMessage,
  shouldShowFormAnnotationWarning,
  stepRedactZoom,
  undoRedactionHistory,
  updateRedactionInState,
  type RedactionHistoryState,
} from "@/lib/tools/redact-pdf/workspace-ui";
import type {
  RedactionDocumentState,
  RedactionPageEntry,
} from "@/lib/tools/redact-pdf/types";
import { RedactPdfError } from "@/lib/tools/redact-pdf/types";
import type { NormalizedRedactionRect } from "@/lib/tools/redact-pdf/types";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { RedactPdfPreview } from "./RedactPdfPreview";
import { RedactionsDrawer } from "./RedactionsDrawer";
import { createProcessAttempt, planErrorMessageToCode } from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface RedactPdfClientToolProps {
  /** When true, export is blocked until the user upgrades to Pro. */
  proGateActive?: boolean;
  /** Tool id for entitlement quota on export. */
  toolId?: string;
}

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  document: RedactionDocumentState;
  hasExistingDigitalSignatures: boolean;
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
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M12 4v6" />
    </svg>
  );
}

export function RedactPdfClientTool({
  proGateActive = false,
  toolId = "redact-pdf",
}: RedactPdfClientToolProps = {}) {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [history, setHistory] = useState<RedactionHistoryState | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [selectedRedactionId, setSelectedRedactionId] = useState<string | null>(
    null,
  );
  const [editorMode] = useState(REDACT_DRAW_MODE);
  const [zoom, setZoom] = useState(1);
  const [baseDisplayWidth, setBaseDisplayWidth] = useState(640);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();

  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("scanonix-redacted.pdf");
  const [resultSize, setResultSize] = useState(0);

  const previewContainerRef = useRef<HTMLDivElement>(null);
  const resultBlobRef = useRef<Blob | null>(null);

  const pages = uploadedPdf?.document.pages ?? [];
  const currentPage: RedactionPageEntry | undefined = pages[currentPageIndex];
  const pageCount = pages.length;
  const redactionCount = uploadedPdf?.document.redactions.length ?? 0;
  const isBusy = isReadingPdf || isExporting;
  const drawModeActive = isRedactDrawModeActive(editorMode);
  const hasResult = resultBlob !== null && status === "success";

  const canExport = useMemo(
    () =>
      uploadedPdf !== null &&
      canExportRedactWorkspace(uploadedPdf.document, isExporting) &&
      !proGateActive,
    [uploadedPdf, isExporting, proGateActive],
  );

  const activePageRedactions = useMemo(() => {
    if (!uploadedPdf || !currentPage) return [];
    return getActivePageRedactions(
      uploadedPdf.document,
      currentPage.sourcePageIndex,
    );
  }, [uploadedPdf, currentPage]);

  const canUndo = (history?.past.length ?? 0) > 0;
  const canRedo = (history?.future.length ?? 0) > 0;

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

  const syncDocumentFromHistory = useCallback(
    (nextHistory: RedactionHistoryState) => {
      if (!uploadedPdf) return;
      setHistory(nextHistory);
      setUploadedPdf({
        ...uploadedPdf,
        document: applyRedactionsToDocumentState(
          uploadedPdf.document,
          nextHistory.present,
        ),
      });
      invalidateResult();
    },
    [uploadedPdf, invalidateResult],
  );

  const commitDocumentChange = useCallback(
    (nextDocument: RedactionDocumentState) => {
      if (!uploadedPdf || !history) return;
      const nextHistory = commitRedactionHistory(
        history,
        nextDocument.redactions,
      );
      setHistory(nextHistory);
      setUploadedPdf({ ...uploadedPdf, document: nextDocument });
      invalidateResult();
    },
    [uploadedPdf, history, invalidateResult],
  );

  const resetWorkspace = useCallback(() => {
    resultBlobRef.current = null;
    setUploadedPdf(null);
    setHistory(null);
    setCurrentPageIndex(0);
    setSelectedRedactionId(null);
    setZoom(1);
    setDrawerOpen(false);
    setResultBlob(null);
    setResultFilename("scanonix-redacted.pdf");
    setResultSize(0);
    setStatus("idle");
    setStatusMessage(undefined);
    setIsExporting(false);
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (!isAcceptedPdfFile(file)) {
      setStatus("error");
      setStatusMessage("Please upload a PDF file.");
      return;
    }

    if (file.size > MAX_REDACT_PDF_BYTES) {
      const maxMb = Math.round(MAX_REDACT_PDF_BYTES / (1024 * 1024));
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
      const document = await loadRedactionDocumentState(bytes, {
        byteLength: file.size,
      });
      const warnings = detectRedactPdfWarnings(bytes);

      setUploadedPdf({
        file,
        bytes,
        document,
        hasExistingDigitalSignatures: warnings.hasExistingDigitalSignatures,
      });
      setHistory(createRedactionHistory(document.redactions));
      setCurrentPageIndex(0);
      setSelectedRedactionId(null);
      setZoom(1);
      setDrawerOpen(false);
    } catch (error) {
      setUploadedPdf(null);
      setHistory(null);
      setStatus("error");
      setStatusMessage(
        error instanceof RedactPdfError
          ? error.message
          : getRedactPdfErrorMessage(error),
      );
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const handleDrawComplete = useCallback(
    (rect: NormalizedRedactionRect) => {
      if (!uploadedPdf || !currentPage) return;
      try {
        const nextDocument = addRedactionToState(
          uploadedPdf.document,
          currentPage.sourcePageIndex,
          rect,
        );
        commitDocumentChange(nextDocument);
        const created = nextDocument.redactions[nextDocument.redactions.length - 1];
        setSelectedRedactionId(created?.id ?? null);
        setStatus("idle");
        setStatusMessage(undefined);
      } catch (error) {
        setStatus("error");
        setStatusMessage(
          error instanceof RedactPdfError
            ? error.message
            : getRedactPdfErrorMessage(error),
        );
      }
    },
    [uploadedPdf, currentPage, commitDocumentChange],
  );

  const handleRedactionChange = useCallback(
    (redactionId: string, rect: NormalizedRedactionRect) => {
      if (!uploadedPdf) return;
      try {
        commitDocumentChange(
          updateRedactionInState(uploadedPdf.document, redactionId, rect),
        );
      } catch (error) {
        setStatus("error");
        setStatusMessage(
          error instanceof RedactPdfError
            ? error.message
            : getRedactPdfErrorMessage(error),
        );
      }
    },
    [uploadedPdf, commitDocumentChange],
  );

  const handleDeleteSelected = useCallback(() => {
    if (!uploadedPdf || !selectedRedactionId) return;
    commitDocumentChange(
      removeRedactionFromState(uploadedPdf.document, selectedRedactionId),
    );
    setSelectedRedactionId(null);
    setStatus("idle");
    setStatusMessage("Redaction deleted.");
  }, [uploadedPdf, selectedRedactionId, commitDocumentChange]);

  const handleClearPage = useCallback(() => {
    if (!uploadedPdf || !currentPage) return;
    if (
      !window.confirm(
        `Clear all redaction marks on page ${currentPageIndex + 1}?`,
      )
    ) {
      return;
    }
    commitDocumentChange(
      clearRedactionsForPage(
        uploadedPdf.document,
        currentPage.sourcePageIndex,
      ),
    );
    setSelectedRedactionId(null);
    setStatus("idle");
    setStatusMessage(`Cleared redactions on page ${currentPageIndex + 1}.`);
  }, [uploadedPdf, currentPage, currentPageIndex, commitDocumentChange]);

  const handleClearAll = useCallback(() => {
    if (!uploadedPdf) return;
    if (!window.confirm("Clear all redaction marks in this document?")) {
      return;
    }
    commitDocumentChange(clearAllRedactions(uploadedPdf.document));
    setSelectedRedactionId(null);
    setStatus("idle");
    setStatusMessage("Cleared all redactions.");
  }, [uploadedPdf, commitDocumentChange]);

  const handleUndo = useCallback(() => {
    if (!history) return;
    const nextHistory = undoRedactionHistory(history);
    if (!nextHistory) return;
    syncDocumentFromHistory(nextHistory);
    setSelectedRedactionId(null);
    setStatus("idle");
    setStatusMessage("Undid last change.");
  }, [history, syncDocumentFromHistory]);

  const handleRedo = useCallback(() => {
    if (!history) return;
    const nextHistory = redoRedactionHistory(history);
    if (!nextHistory) return;
    syncDocumentFromHistory(nextHistory);
    setSelectedRedactionId(null);
    setStatus("idle");
    setStatusMessage("Redid change.");
  }, [history, syncDocumentFromHistory]);

  const handleExport = useCallback(async () => {
    if (!uploadedPdf || !canExport || isExporting || proGateActive) return;

    setIsExporting(true);
    setStatus("loading");
    setStatusMessage("Applying redactions…");
    setResultBlob(null);

    let attempt: ReturnType<typeof createProcessAttempt> = null;

    try {
      const { gateToolOperation } = await import("@/lib/plan/tool-gate");
      const gate = await gateToolOperation(toolId, uploadedPdf.file.size);
      if (!gate.ok) {
        setStatus("error");
        setStatusMessage(gate.message);
        return;
      }

      attempt = createProcessAttempt(toolId);
      if (!attempt?.markStarted()) return;

      const { exportRedactedPdfFromWorkspace } = await import(
        "@/lib/tools/redact-pdf/client-export"
      );
      const result = await exportRedactedPdfFromWorkspace(
        uploadedPdf.bytes,
        uploadedPdf.document,
        uploadedPdf.file.name,
        (current, total) => {
          setStatusMessage(`Applying redactions (${current}/${total})…`);
        },
      );

      const blob = new Blob([Uint8Array.from(result.bytes)], {
        type: "application/pdf",
      });
      setResultBlob(blob);
      setResultFilename(result.filename);
      setResultSize(result.bytes.byteLength);
      attempt.success(1);
      setStatus("success");
      setStatusMessage("Redacted PDF ready.");
    } catch (error) {
      attempt?.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof RedactPdfError
          ? resolveRedactExportErrorMessage(error)
          : resolveRedactExportErrorMessage(error),
      );
    } finally {
      setIsExporting(false);
    }
  }, [uploadedPdf, canExport, isExporting, proGateActive, toolId]);

  const handleDownload = useCallback(() => {
    const blob = resultBlobRef.current ?? resultBlob;
    if (!blob) return;
    downloadBlob(blob, resultFilename, buildToolDownloadMeta(toolId, 1));
  }, [resultBlob, resultFilename]);

  const handleFitWidth = useCallback(() => {
    const containerWidth = previewContainerRef.current?.clientWidth ?? baseDisplayWidth;
    setZoom(computeFitWidthZoom(containerWidth, baseDisplayWidth));
  }, [baseDisplayWidth]);

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (!uploadedPdf || isBusy) return;
      const target = event.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === "INPUT" ||
          target.tagName === "TEXTAREA" ||
          target.tagName === "SELECT" ||
          target.isContentEditable)
      ) {
        return;
      }

      if (event.key === "Delete" || event.key === "Backspace") {
        if (selectedRedactionId) {
          event.preventDefault();
          handleDeleteSelected();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
        event.preventDefault();
        if (event.shiftKey) {
          handleRedo();
        } else {
          handleUndo();
        }
      }

      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "y") {
        event.preventDefault();
        handleRedo();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [
    uploadedPdf,
    isBusy,
    selectedRedactionId,
    handleDeleteSelected,
    handleUndo,
    handleRedo,
  ]);

  return (
    <div className="space-y-8 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
      />

      {!uploadedPdf && (
        <>
          <FileDropZone
            onFilesSelected={handleUpload}
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            inputId="redact-pdf-client-input"
            inputDataAttributes={{ "data-redact-pdf-input": "true" }}
            label="Drop a PDF file here to redact"
            hint="or click to browse — up to 10 MB, processed locally in your browser"
            icon={<PdfDropIcon />}
          />
          <PrivacyNotice message={REDACT_PRIVACY_COPY} />
          <p className="text-sm text-foreground-muted">{REDACT_PERMANENT_APPLIED_COPY}</p>
          <p className="text-sm text-foreground-muted">{REDACT_SANITIZATION_LIMITATION_COPY}</p>
        </>
      )}

      {uploadedPdf && currentPage && !hasResult && (
        <div
          data-redact-pdf-workspace
          className="overflow-hidden rounded-xl border border-border/80 bg-surface"
        >
          <div
            data-redact-pdf-header
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/80 px-3 py-2 sm:px-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-sm font-semibold text-foreground">
                Redact PDF
              </span>
              <span
                className="truncate text-xs text-foreground-muted sm:text-sm"
                title={uploadedPdf.file.name}
              >
                {uploadedPdf.file.name}
              </span>
              <span className="hidden text-xs text-foreground-muted sm:inline">
                · {formatFileSize(uploadedPdf.file.size)}
              </span>
            </div>

            <div
              data-redact-page-nav
              className="flex flex-wrap items-center justify-center gap-1.5 sm:flex-1"
            >
              <ActionButton
                variant="outline"
                size="sm"
                data-redact-page-prev
                disabled={currentPageIndex <= 0 || isBusy}
                onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
              >
                Previous
              </ActionButton>
              <span
                data-redact-page-indicator
                className="min-w-[5rem] text-center text-xs text-foreground-muted sm:text-sm"
              >
                Page {currentPageIndex + 1} / {pageCount}
              </span>
              <ActionButton
                variant="outline"
                size="sm"
                data-redact-page-next
                disabled={currentPageIndex >= pageCount - 1 || isBusy}
                onClick={() =>
                  setCurrentPageIndex(Math.min(pageCount - 1, currentPageIndex + 1))
                }
              >
                Next
              </ActionButton>
            </div>

            <ActionButton
              variant="outline"
              size="sm"
              data-redact-choose-another
              disabled={isBusy}
              onClick={resetWorkspace}
              className="w-full sm:ml-auto sm:w-auto"
            >
              Choose another PDF
            </ActionButton>
          </div>

          {uploadedPdf.hasExistingDigitalSignatures && (
            <div
              data-redact-signature-warning
              className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3"
            >
              <p className="text-sm text-foreground">
                {DIGITAL_SIGNATURE_REDACT_WARNING}
              </p>
            </div>
          )}

          <div
            data-redact-toolbar
            className="flex flex-wrap items-center gap-2 border-b border-border/80 px-3 py-2 sm:px-4"
          >
            <span
              data-redact-draw-mode
              className="rounded-lg border border-scanonix-orange bg-scanonix-orange/10 px-3 py-1.5 text-xs font-medium text-foreground"
            >
              Redact area
            </span>

            <ActionButton
              variant="outline"
              size="sm"
              data-redact-undo
              disabled={!canUndo || isBusy}
              onClick={handleUndo}
            >
              Undo
            </ActionButton>
            <ActionButton
              variant="outline"
              size="sm"
              data-redact-redo
              disabled={!canRedo || isBusy}
              onClick={handleRedo}
            >
              Redo
            </ActionButton>
            <ActionButton
              variant="outline"
              size="sm"
              data-redact-delete-selected
              disabled={!selectedRedactionId || isBusy}
              onClick={handleDeleteSelected}
            >
              Delete selected
            </ActionButton>
            <ActionButton
              variant="outline"
              size="sm"
              data-redact-clear-page
              disabled={activePageRedactions.length === 0 || isBusy}
              onClick={handleClearPage}
            >
              Clear page
            </ActionButton>
            <ActionButton
              variant="outline"
              size="sm"
              data-redact-clear-all
              disabled={redactionCount === 0 || isBusy}
              onClick={handleClearAll}
            >
              Clear all
            </ActionButton>

            <div
              data-redact-zoom-controls
              className="ml-auto flex flex-wrap items-center gap-1.5"
            >
              <ActionButton
                variant="outline"
                size="sm"
                data-redact-zoom-out
                disabled={isBusy}
                onClick={() => setZoom((current) => stepRedactZoom(current, "out"))}
                aria-label="Zoom out"
              >
                −
              </ActionButton>
              <span
                data-redact-zoom-indicator
                className="min-w-[3.5rem] text-center text-xs text-foreground-muted"
              >
                {Math.round(zoom * 100)}%
              </span>
              <ActionButton
                variant="outline"
                size="sm"
                data-redact-zoom-in
                disabled={isBusy}
                onClick={() => setZoom((current) => stepRedactZoom(current, "in"))}
                aria-label="Zoom in"
              >
                +
              </ActionButton>
              <ActionButton
                variant="outline"
                size="sm"
                data-redact-zoom-fit
                disabled={isBusy}
                onClick={handleFitWidth}
              >
                Fit width
              </ActionButton>
            </div>

            <ActionButton
              variant="outline"
              size="sm"
              data-redactions-drawer-toggle
              disabled={isBusy}
              onClick={() => setDrawerOpen((open) => !open)}
            >
              Redactions ({redactionCount})
            </ActionButton>
          </div>

          <div className="space-y-3 px-3 py-3 sm:px-4">
            <p className="text-xs text-foreground-muted">{REDACT_PERMANENT_APPLIED_COPY}</p>
            <p className="text-xs text-foreground-muted">{REDACT_RASTER_QUALITY_COPY}</p>
            <p className="text-xs text-foreground-muted">
              {REDACT_SANITIZATION_LIMITATION_COPY}
            </p>
            {shouldShowFormAnnotationWarning(uploadedPdf.document) && (
              <p
                data-redact-form-warning
                className="text-xs text-foreground"
              >
                {REDACT_FORM_ANNOTATION_WARNING}
              </p>
            )}
          </div>

          <div
            ref={previewContainerRef}
            data-redact-pdf-preview-panel
            className="bg-surface-muted p-4 sm:p-6"
          >
            <RedactPdfPreview
              pageEntry={currentPage}
              pdfBytes={uploadedPdf.bytes}
              redactions={activePageRedactions}
              selectedRedactionId={selectedRedactionId}
              drawModeActive={drawModeActive}
              zoom={zoom}
              disabled={isBusy}
              onSelectRedaction={setSelectedRedactionId}
              onRedactionChange={handleRedactionChange}
              onDrawComplete={handleDrawComplete}
              onBaseDisplaySizeChange={({ width }) => setBaseDisplayWidth(width)}
            />
          </div>

          <div className="border-t border-border/80 p-4 sm:p-5">
            <ActionButton
              size="lg"
              data-redact-export-button
              className="w-full"
              loading={isExporting}
              disabled={!canExport}
              onClick={handleExport}
            >
              {proGateActive
                ? "Upgrade to Pro to export"
                : isExporting
                  ? "Applying redactions…"
                  : "Apply redactions & download"}
            </ActionButton>
            <div className="mt-3">
              <PrivacyNotice message={REDACT_PRIVACY_COPY} />
            </div>
          </div>

          <RedactionsDrawer
            open={drawerOpen}
            state={uploadedPdf.document}
            selectedRedactionId={selectedRedactionId}
            onClose={() => setDrawerOpen(false)}
            onNavigate={(pageIndex, redactionId) => {
              const pageIdx = pages.findIndex(
                (page) => page.sourcePageIndex === pageIndex,
              );
              if (pageIdx >= 0) {
                setCurrentPageIndex(pageIdx);
              }
              setSelectedRedactionId(redactionId);
            }}
          />
        </div>
      )}

      {hasResult && (
        <ToolResultsPanel
          title="Redacted PDF ready"
          primaryLabel="Download PDF"
          onPrimaryClick={handleDownload}
          onStartOver={resetWorkspace}
          startOverLabel="Start over"
        >
          <p className="text-sm text-foreground-muted">
            {resultFilename} · {formatFileSize(resultSize)}
          </p>
        </ToolResultsPanel>
      )}

      <ToolStickyMobileActionBar
        visible={Boolean(uploadedPdf && canExport && !hasResult)}
        primaryLabel={
          proGateActive ? "Upgrade to Pro to export" : "Apply redactions & download"
        }
        primaryLoading={isExporting}
        primaryDisabled={!canExport}
        onPrimaryClick={handleExport}
        secondaryLabel={uploadedPdf ? "Choose another PDF" : undefined}
        onSecondaryClick={uploadedPdf ? resetWorkspace : undefined}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
