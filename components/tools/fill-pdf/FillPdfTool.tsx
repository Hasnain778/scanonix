"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ResultActionBar } from "@/components/tools/ResultActionBar";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { isAcceptedPdfFile } from "@/lib/pdf/core";
import { getAnonymousUploadLimit } from "@/lib/plan/tool-access";
import {
  buildFilledPdfFilename,
  canExportFillPdfWorkspace,
  computeFieldErrors,
  DIGITAL_SIGNATURE_WARNING,
  fillPdfForm,
  FillPdfError,
  FILL_PDF_UI_PRIVACY_COPY,
  formatFillPdfZoomPercent,
  getFieldsNavigatorSummary,
  getSelectedFieldPageIndex,
  getSelectedTextFormatState,
  isSelectedTextField,
  loadFillPdfDocumentState,
  mapEngineErrorToMessage,
  mapValidationErrorToMessage,
  needsDigitalSignatureAcknowledgment,
  resetWorkspaceFormValues,
  sanitizeUserFacingError,
  stepFillPdfZoomFactor,
  updateSelectedTextFormatState,
  type FillPdfDocumentState,
  type FillPdfWorkspaceState,
  buildInitialWorkspaceState,
} from "@/lib/tools/fill-pdf";
import { TextFormatToolbar } from "./TextFormatToolbar";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { FormEditState } from "@/lib/tools/fill-pdf/types";
import type { TextFormatState } from "@/lib/tools/fill-pdf/text-appearance";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { FieldsNavigator } from "./FieldsNavigator";
import { PdfFormPreview } from "./PdfFormPreview";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  document: FillPdfDocumentState;
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

function ToolbarIconButton({
  label,
  disabled,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      disabled={disabled}
      onClick={onClick}
      className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-border text-foreground-muted transition hover:border-scanonix-orange/40 hover:bg-surface-muted hover:text-foreground disabled:cursor-not-allowed disabled:opacity-40"
    >
      {children}
    </button>
  );
}

function mapUploadError(error: unknown): string {
  if (error instanceof FillPdfError) {
    return mapEngineErrorToMessage(error.code, sanitizeUserFacingError(error.message));
  }

  if (error instanceof Error) {
    return sanitizeUserFacingError(error.message) ?? error.message;
  }

  return "Something went wrong while reading this PDF form.";
}

export function FillPdfTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [workspace, setWorkspace] = useState<FillPdfWorkspaceState | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [fieldsNavigatorOpen, setFieldsNavigatorOpen] = useState(false);
  const [zoomFactor, setZoomFactor] = useState(1);
  const [fitWidth, setFitWidth] = useState(true);

  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("document-filled.pdf");

  const resultBlobRef = useRef<Blob | null>(null);

  const pageCount = uploadedPdf?.document.pageCount ?? 0;
  const fieldCount = uploadedPdf?.document.fields.length ?? 0;
  const isBusy = isReadingPdf || isExporting || isDownloading;
  const hasResult = resultBlob !== null && status === "success";

  const fieldErrors = useMemo(() => {
    if (!uploadedPdf || !workspace) {
      return {};
    }

    return computeFieldErrors(
      uploadedPdf.document.fields,
      workspace.editState,
      workspace.initialValues,
    );
  }, [uploadedPdf, workspace]);

  const workspaceWithErrors = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return {
      ...workspace,
      fieldErrors,
    };
  }, [workspace, fieldErrors]);

  const fieldsSummary = useMemo(() => {
    if (!uploadedPdf || !workspace) {
      return null;
    }

    return getFieldsNavigatorSummary(
      uploadedPdf.document.fields,
      workspace.editState,
    );
  }, [uploadedPdf, workspace]);

  const selectedTextFormat = useMemo(() => {
    if (!workspace) {
      return null;
    }

    return getSelectedTextFormatState(workspace);
  }, [workspace]);

  const showTextFormatToolbar = useMemo(() => {
    if (!uploadedPdf || !workspace) {
      return false;
    }

    return isSelectedTextField(
      uploadedPdf.document.fields,
      workspace.selectedFieldName,
    );
  }, [uploadedPdf, workspace]);

  const needsSignatureAck = uploadedPdf
    ? needsDigitalSignatureAcknowledgment(uploadedPdf.document.warnings)
    : false;

  const canExport = useMemo(
    () =>
      uploadedPdf !== null &&
      workspace !== null &&
      canExportFillPdfWorkspace({
        pageCount,
        fieldCount,
        isExporting,
        fieldErrors,
        warnings: uploadedPdf.document.warnings,
        digitalSignatureAcknowledged: workspace?.digitalSignatureAcknowledged ?? false,
      }),
    [uploadedPdf, workspace, pageCount, fieldCount, isExporting, fieldErrors],
  );

  /**
   * Dual-phase adapter (editor Done → processing → download success).
   * Ready secondary keeps Fields navigator open; Start Over only on success.
   */
  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (isExporting || isReadingPdf) return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedPdf !== null && workspace !== null && pageCount > 0) return "ready";
    return "idle";
  }, [isExporting, isReadingPdf, hasResult, status, uploadedPdf, workspace, pageCount]);

  const stickyVisible = Boolean(
    uploadedPdf && (hasResult || canExport || isExporting),
  );

  useEffect(() => {
    resultBlobRef.current = resultBlob;
  }, [resultBlob]);

  useEffect(() => {
    return () => {
      resultBlobRef.current = null;
    };
  }, []);

  const resetWorkspace = useCallback(() => {
    resultBlobRef.current = null;
    setUploadedPdf(null);
    setWorkspace(null);
    setCurrentPageIndex(0);
    setFieldsNavigatorOpen(false);
    setZoomFactor(1);
    setFitWidth(true);
    setResultBlob(null);
    setResultFilename("document-filled.pdf");
    setStatus("idle");
    setStatusMessage(undefined);
    setIsExporting(false);
    setIsDownloading(false);
  }, []);

  const invalidateResult = useCallback(() => {
    resultBlobRef.current = null;
    setResultBlob(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (!isAcceptedPdfFile(file)) {
      setStatus("error");
      setStatusMessage(mapEngineErrorToMessage("WRONG_FILE_TYPE"));
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

    try {
      const bytes = await file.arrayBuffer();
      const document = await loadFillPdfDocumentState(bytes, {
        byteLength: file.size,
      });

      setUploadedPdf({ file, bytes, document });
      setWorkspace(
        buildInitialWorkspaceState(document.fields, document.initialValues),
      );
      setCurrentPageIndex(0);
      setFieldsNavigatorOpen(false);
      setZoomFactor(1);
      setFitWidth(true);
      setResultFilename(buildFilledPdfFilename(file.name));
    } catch (error) {
      setUploadedPdf(null);
      setWorkspace(null);
      setStatus("error");
      setStatusMessage(mapUploadError(error));
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const handleFieldChange = useCallback(
    (nextState: FormEditState, fieldName: string) => {
      if (!uploadedPdf || !workspace) {
        return;
      }

      invalidateResult();
      setStatus("idle");
      setStatusMessage(undefined);

      const pageIndex = getSelectedFieldPageIndex(
        uploadedPdf.document.fields,
        fieldName,
      );
      if (pageIndex !== null) {
        setCurrentPageIndex(pageIndex);
      }

      setWorkspace((current) => {
        if (!current) {
          return current;
        }

        return {
          ...current,
          editState: nextState,
          selectedFieldName: fieldName,
        };
      });
    },
    [uploadedPdf, workspace, invalidateResult],
  );

  const handleFieldSelect = useCallback(
    (fieldName: string) => {
      if (uploadedPdf) {
        const pageIndex = getSelectedFieldPageIndex(
          uploadedPdf.document.fields,
          fieldName,
        );
        if (pageIndex !== null) {
          setCurrentPageIndex(pageIndex);
        }
      }

      setWorkspace((current) =>
        current
          ? {
              ...current,
              selectedFieldName: fieldName,
            }
          : current,
      );
    },
    [uploadedPdf],
  );

  const handleResetForm = useCallback(() => {
    if (!workspace) {
      return;
    }

    const confirmed = window.confirm(
      "Reset all fields to their original values from when this PDF was loaded?",
    );
    if (!confirmed) {
      return;
    }

    invalidateResult();
    setStatus("idle");
    setStatusMessage(undefined);
    setWorkspace((current) =>
      current
        ? {
            ...current,
            ...resetWorkspaceFormValues(
              current.initialValues,
              current.initialTextFormatState,
            ),
            digitalSignatureAcknowledged: false,
          }
        : current,
    );
  }, [workspace, invalidateResult]);

  const handleSignatureAckChange = useCallback(
    (acknowledged: boolean) => {
      setWorkspace((current) =>
        current
          ? {
              ...current,
              digitalSignatureAcknowledged: acknowledged,
            }
          : current,
      );
    },
    [],
  );

  const handleTextFormatChange = useCallback(
    (patch: Partial<TextFormatState>) => {
      invalidateResult();
      setStatus("idle");
      setStatusMessage(undefined);
      setWorkspace((current) =>
        current ? updateSelectedTextFormatState(current, patch) : current,
      );
    },
    [invalidateResult],
  );

  const handleZoomOut = () => {
    setFitWidth(false);
    setZoomFactor((current) => stepFillPdfZoomFactor(current, -0.25));
  };

  const handleZoomIn = () => {
    setFitWidth(false);
    setZoomFactor((current) => stepFillPdfZoomFactor(current, 0.25));
  };

  const handleFitWidth = () => {
    setFitWidth(true);
    setZoomFactor(1);
  };

  const effectiveZoom = fitWidth ? 1 : zoomFactor;

  const handleExport = async () => {
    if (!uploadedPdf || !workspace || !canExport || isExporting) {
      return;
    }

    const attempt = createProcessAttempt("fill-pdf");
    if (!attempt?.markStarted()) return;

    setIsExporting(true);
    setStatus("loading");
    setStatusMessage("Filling PDF form…");
    setResultBlob(null);

    try {
      const result = await fillPdfForm(uploadedPdf.bytes, workspace.editState, {
        textFormatState: workspace.textFormatState,
      });
      const blob = new Blob([Uint8Array.from(result.bytes)], {
        type: "application/pdf",
      });
      setResultBlob(blob);
      setResultFilename(result.filename);
      attempt.success(1);
      setStatus("success");
      setStatusMessage("Filled PDF ready to download.");
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof FillPdfError
          ? mapEngineErrorToMessage(
              error.code,
              sanitizeUserFacingError(error.message),
            )
          : mapValidationErrorToMessage(error),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const handleDownload = async () => {
    const blob = resultBlobRef.current ?? resultBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, resultFilename, buildToolDownloadMeta("fill-pdf", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  const primaryAction = hasResult
    ? { label: "Download filled PDF", onClick: handleDownload, loading: isDownloading }
    : { label: "Done", onClick: handleExport, loading: isExporting };

  return (
    <div className="space-y-6 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF form…" : statusMessage}
      />

      {!uploadedPdf && (
        <>
          <FileDropZone
            onFilesSelected={handleUpload}
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            label="Drop a PDF form here to fill fields"
            hint="or click to browse — processed locally in your browser"
            icon={<PdfDropIcon />}
          />
          <PrivacyNotice message={FILL_PDF_UI_PRIVACY_COPY} />
        </>
      )}

      {uploadedPdf && workspaceWithErrors && (
        <div
          data-fill-pdf-workspace
          className="overflow-hidden rounded-xl border border-border/80 bg-surface"
        >
          {/* Compact editor toolbar */}
          <div
            data-fill-pdf-toolbar
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-border/80 px-3 py-2 sm:px-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2 sm:min-w-[8rem] sm:flex-none">
              <span className="shrink-0 text-sm font-semibold text-foreground">Fill PDF</span>
              <span
                className="hidden truncate text-xs text-foreground-muted sm:inline"
                title={uploadedPdf.file.name}
              >
                {uploadedPdf.file.name}
              </span>
            </div>

            <div className="flex flex-wrap items-center justify-center gap-1.5 sm:flex-1">
              <ToolbarIconButton
                label="Previous page"
                disabled={currentPageIndex <= 0 || isBusy}
                onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
              >
                ←
              </ToolbarIconButton>
              <span className="min-w-[4.5rem] text-center text-xs text-foreground-muted sm:text-sm">
                Page {currentPageIndex + 1}/{pageCount}
              </span>
              <ToolbarIconButton
                label="Next page"
                disabled={currentPageIndex >= pageCount - 1 || isBusy}
                onClick={() =>
                  setCurrentPageIndex(Math.min(pageCount - 1, currentPageIndex + 1))
                }
              >
                →
              </ToolbarIconButton>

              <span className="mx-1 hidden h-4 w-px bg-border sm:inline" aria-hidden="true" />

              <ToolbarIconButton
                label="Zoom out"
                disabled={isBusy}
                onClick={handleZoomOut}
              >
                −
              </ToolbarIconButton>
              <button
                type="button"
                className="min-w-[3rem] rounded-lg px-1.5 py-1 text-xs text-foreground-muted hover:bg-surface-muted hover:text-foreground"
                onClick={handleFitWidth}
                title="Fit width"
              >
                {fitWidth ? "Fit" : formatFillPdfZoomPercent(zoomFactor)}
              </button>
              <ToolbarIconButton label="Zoom in" disabled={isBusy} onClick={handleZoomIn}>
                +
              </ToolbarIconButton>
              <ActionButton
                variant="ghost"
                size="sm"
                className="hidden sm:inline-flex"
                disabled={isBusy}
                onClick={handleFitWidth}
              >
                Fit width
              </ActionButton>

              {showTextFormatToolbar && selectedTextFormat && (
                <>
                  <span className="mx-1 hidden h-4 w-px bg-border sm:inline" aria-hidden="true" />
                  <TextFormatToolbar
                    format={selectedTextFormat}
                    disabled={isBusy}
                    onChange={handleTextFormatChange}
                  />
                </>
              )}
            </div>

            <div className="flex w-full flex-wrap items-center justify-end gap-2 sm:w-auto sm:flex-none">
              <ActionButton
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={resetWorkspace}
                className="hidden sm:inline-flex"
              >
                Choose another
              </ActionButton>
              <ActionButton
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={handleResetForm}
              >
                Reset
              </ActionButton>
              <ActionButton
                variant="outline"
                size="sm"
                disabled={isBusy}
                onClick={() => setFieldsNavigatorOpen(true)}
                aria-expanded={fieldsNavigatorOpen}
              >
                {fieldsSummary?.buttonLabel ?? "Fields"}
              </ActionButton>
              <ActionButton
                size="sm"
                loading={primaryAction.loading}
                disabled={
                  hasResult ? isBusy || !resultBlob : !canExport || isBusy
                }
                onClick={primaryAction.onClick}
                className="hidden sm:inline-flex"
              >
                {primaryAction.label}
              </ActionButton>
            </div>
          </div>

          {/* PDF-first editor canvas */}
          <div className="bg-surface-muted">
            <PdfFormPreview
              pdfBytes={uploadedPdf.bytes}
              pageCount={pageCount}
              currentPageIndex={currentPageIndex}
              fields={uploadedPdf.document.fields}
              editState={workspaceWithErrors.editState}
              textFormatState={workspaceWithErrors.textFormatState}
              fieldErrors={workspaceWithErrors.fieldErrors}
              selectedFieldName={workspaceWithErrors.selectedFieldName}
              zoomFactor={effectiveZoom}
              disabled={isBusy}
              onFieldChange={handleFieldChange}
              onFieldSelect={handleFieldSelect}
            />
          </div>

          {needsSignatureAck && (
            <div className="border-t border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-foreground">{DIGITAL_SIGNATURE_WARNING}</p>
              <label className="mt-2 flex items-start gap-3 text-sm text-foreground">
                <input
                  type="checkbox"
                  checked={workspaceWithErrors.digitalSignatureAcknowledged}
                  disabled={isBusy}
                  onChange={(event) =>
                    handleSignatureAckChange(event.target.checked)
                  }
                  className="mt-0.5 h-4 w-4 accent-scanonix-orange"
                />
                I understand that editing may invalidate existing digital signatures.
              </label>
            </div>
          )}

          {hasResult && resultBlob && (
            <div className="border-t border-border/80 px-4 py-3">
              <h2 className="mb-1 text-base font-semibold text-foreground">Results</h2>
              <p className="text-sm text-foreground-muted">
                {fieldCount} field{fieldCount === 1 ? "" : "s"} ·{" "}
                {formatFileSize(resultBlob.size)} · {resultFilename}
              </p>
              <div className="mt-4">
                <ResultActionBar
                  phase={resultActionPhase}
                  primary={{
                    label: "Download filled PDF",
                    onClick: () => {
                      void handleDownload();
                    },
                    loading: isDownloading,
                    disabled: isBusy,
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

          <div className="border-t border-border/80 px-4 py-2">
            <PrivacyNotice message={FILL_PDF_UI_PRIVACY_COPY} />
          </div>

          <FieldsNavigator
            open={fieldsNavigatorOpen}
            fields={uploadedPdf.document.fields}
            workspace={workspaceWithErrors}
            onClose={() => setFieldsNavigatorOpen(false)}
            onFieldSelect={handleFieldSelect}
          />
        </div>
      )}

      {/*
        Dual-phase sticky (opt-in phase API):
        ready/processing → Done (+ Fields navigator — not Start Over)
        success → Download filled PDF + Start over
        Fields remains available in the editor toolbar after success.
      */}
      <ToolStickyMobileActionBar
        visible={stickyVisible}
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download filled PDF" : "Done"}
        primaryLoading={hasResult ? isDownloading : isExporting}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !canExport}
        onPrimaryClick={() => {
          if (hasResult) {
            void handleDownload();
          } else {
            void handleExport();
          }
        }}
        secondaryLabel={
          resultActionPhase === "ready" && uploadedPdf ? "Fields" : undefined
        }
        onSecondaryClick={
          resultActionPhase === "ready" && uploadedPdf
            ? () => setFieldsNavigatorOpen(true)
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
