"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import {
  ChevronLeft,
  ChevronRight,
  FilePen,
  List,
  ZoomIn,
  ZoomOut,
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

function FillPdfDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <FilePen className={className} aria-hidden="true" strokeWidth={1.75} />
  );
}

function ToolbarIconButton({
  label,
  disabled,
  active,
  onClick,
  children,
}: {
  label: string;
  disabled?: boolean;
  active?: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      aria-pressed={active}
      disabled={disabled}
      onClick={onClick}
      className={`inline-flex h-8 w-8 items-center justify-center rounded-md border transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-40 ${
        active
          ? "border-scanonix-orange bg-scanonix-orange/15 text-scanonix-orange shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
          : "border-border bg-surface-muted/80 text-scanonix-muted hover:border-scanonix-orange/40 hover:bg-surface-muted hover:text-foreground"
      }`}
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
    ? {
        label: "Download filled PDF",
        onClick: () => {
          void handleDownload();
        },
        loading: isDownloading,
      }
    : { label: "Done", onClick: handleExport, loading: isExporting };

  const handleChangeSettings = useCallback(() => {
    resultBlobRef.current = null;
    setResultBlob(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const exportHint = canExport
    ? "Finish editing, then export your filled PDF."
    : needsSignatureAck && workspace && !workspace.digitalSignatureAcknowledged
      ? "Acknowledge the signature warning to continue."
      : "Fill form fields on the page, then export.";

  const selectedField = useMemo(() => {
    if (!uploadedPdf || !workspace?.selectedFieldName) {
      return null;
    }

    return (
      uploadedPdf.document.fields.find(
        (field) => field.name === workspace.selectedFieldName,
      ) ?? null
    );
  }, [uploadedPdf, workspace]);

  const settingsBody =
    uploadedPdf && workspaceWithErrors ? (
      <div className="space-y-4">
        <div>
          <div className="flex items-center gap-2">
            <FilePen
              className="h-4 w-4 text-scanonix-orange"
              aria-hidden="true"
            />
            <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
              Fill PDF
            </p>
          </div>
          <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
            Edit form fields on the page. Use Fields to jump between inputs.
          </p>
        </div>

        <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
          <div className="flex justify-between gap-3 px-3 py-2.5">
            <dt className="text-scanonix-muted">Page</dt>
            <dd className="font-semibold text-foreground">
              {currentPageIndex + 1} / {pageCount}
            </dd>
          </div>
          <div className="flex justify-between gap-3 px-3 py-2.5">
            <dt className="text-scanonix-muted">Fields</dt>
            <dd className="font-semibold text-foreground">{fieldCount}</dd>
          </div>
          {fieldsSummary && (
            <div className="flex justify-between gap-3 px-3 py-2.5">
              <dt className="text-scanonix-muted">Progress</dt>
              <dd className="font-semibold text-foreground">
                {fieldsSummary.completed}/{fieldsSummary.total}
              </dd>
            </div>
          )}
          {fieldsSummary && fieldsSummary.requiredRemaining > 0 && (
            <div className="flex justify-between gap-3 px-3 py-2.5">
              <dt className="text-scanonix-muted">Required left</dt>
              <dd className="font-semibold text-foreground">
                {fieldsSummary.requiredRemaining}
              </dd>
            </div>
          )}
          {selectedField && (
            <div className="min-w-0 px-3 py-2.5">
              <dt className="text-scanonix-muted">Selected</dt>
              <dd className="mt-0.5 truncate font-semibold text-foreground">
                {selectedField.name}
              </dd>
              <dd className="mt-0.5 text-[11px] uppercase tracking-wide text-scanonix-muted">
                {selectedField.kind.toLowerCase()}
                {selectedField.readOnly ? " · read-only" : ""}
                {selectedField.required ? " · required" : ""}
              </dd>
            </div>
          )}
        </dl>

        <div className="flex flex-col gap-2">
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full rounded-lg"
            disabled={isBusy}
            onClick={() => setFieldsNavigatorOpen(true)}
          >
            <List className="mr-2 h-4 w-4" aria-hidden="true" />
            {fieldsSummary?.buttonLabel ?? "Open fields"}
          </ActionButton>
          <ActionButton
            variant="outline"
            size="lg"
            className="w-full rounded-lg"
            disabled={isBusy}
            onClick={handleResetForm}
          >
            Reset fields
          </ActionButton>
        </div>

        {needsSignatureAck && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-3 py-3">
            <p className="text-[11px] font-bold uppercase tracking-[0.06em] text-amber-700 dark:text-amber-400">
              Signature notice
            </p>
            <p className="mt-1.5 text-xs leading-relaxed text-foreground">
              {DIGITAL_SIGNATURE_WARNING}
            </p>
            <label className="mt-2.5 flex items-start gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                checked={workspaceWithErrors.digitalSignatureAcknowledged}
                disabled={isBusy}
                onChange={(event) =>
                  handleSignatureAckChange(event.target.checked)
                }
                className="mt-0.5 h-4 w-4 accent-scanonix-orange"
              />
              I understand that editing may invalidate existing digital
              signatures.
            </label>
          </div>
        )}

        <div className="border-t border-border/80 pt-3">
          <PrivacyNotice message={FILL_PDF_UI_PRIVACY_COPY} />
        </div>
      </div>
    ) : null;

  return (
    <div className="space-y-5 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF form…" : statusMessage}
      />

      <ToolWorkspaceShell
        isEmpty={!uploadedPdf || !workspaceWithErrors}
        empty={
          <>
            <FileDropZone
              onFilesSelected={handleUpload}
              accept={ACCEPTED_PDF_EXTENSIONS}
              validateFile={isAcceptedPdfFile}
              multiple={false}
              disabled={isBusy}
              label="Drop a PDF form here to fill fields"
              hint="or click to browse — processed locally in your browser"
              icon={<FillPdfDropIcon />}
            />
            <PrivacyNotice message={FILL_PDF_UI_PRIVACY_COPY} />
          </>
        }
        workArea={
          uploadedPdf && workspaceWithErrors ? (
            <div
              data-fill-pdf-workspace
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]"
            >
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <FillPdfDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedPdf.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedPdf.file.size)} · {pageCount} page
                      {pageCount === 1 ? "" : "s"}
                      {fieldCount > 0
                        ? ` · ${fieldCount} field${fieldCount === 1 ? "" : "s"}`
                        : ""}
                    </p>
                  </div>
                </div>
                <div
                  className={
                    hasResult
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

              <div
                data-fill-pdf-toolbar
                className="flex flex-wrap items-center gap-x-2 gap-y-2 border-b border-border/80 bg-surface px-3 py-2 sm:px-4"
              >
                <div className="flex items-center gap-1.5">
                  <ToolbarIconButton
                    label="Previous page"
                    disabled={currentPageIndex <= 0 || isBusy}
                    onClick={() =>
                      setCurrentPageIndex(Math.max(0, currentPageIndex - 1))
                    }
                  >
                    <ChevronLeft className="h-4 w-4" aria-hidden="true" />
                  </ToolbarIconButton>
                  <span className="min-w-[4.75rem] text-center text-xs font-medium text-foreground sm:text-sm">
                    Page {currentPageIndex + 1}/{pageCount}
                  </span>
                  <ToolbarIconButton
                    label="Next page"
                    disabled={currentPageIndex >= pageCount - 1 || isBusy}
                    onClick={() =>
                      setCurrentPageIndex(
                        Math.min(pageCount - 1, currentPageIndex + 1),
                      )
                    }
                  >
                    <ChevronRight className="h-4 w-4" aria-hidden="true" />
                  </ToolbarIconButton>
                </div>

                <span
                  className="hidden h-4 w-px bg-border sm:inline"
                  aria-hidden="true"
                />

                <div className="flex items-center gap-1.5">
                  <ToolbarIconButton
                    label="Zoom out"
                    disabled={isBusy}
                    onClick={handleZoomOut}
                  >
                    <ZoomOut className="h-4 w-4" aria-hidden="true" />
                  </ToolbarIconButton>
                  <button
                    type="button"
                    className="min-w-[3.25rem] rounded-md border border-border bg-surface-muted/80 px-2 py-1.5 text-xs font-medium text-scanonix-muted transition hover:border-scanonix-orange/40 hover:text-foreground"
                    onClick={handleFitWidth}
                    title="Fit width"
                    disabled={isBusy}
                  >
                    {fitWidth ? "Fit" : formatFillPdfZoomPercent(zoomFactor)}
                  </button>
                  <ToolbarIconButton
                    label="Zoom in"
                    disabled={isBusy}
                    onClick={handleZoomIn}
                  >
                    <ZoomIn className="h-4 w-4" aria-hidden="true" />
                  </ToolbarIconButton>
                  <ToolbarIconButton
                    label="Fit width"
                    disabled={isBusy}
                    active={fitWidth}
                    onClick={handleFitWidth}
                  >
                    <span className="text-[10px] font-bold leading-none">
                      Fit
                    </span>
                  </ToolbarIconButton>
                </div>

                {showTextFormatToolbar && selectedTextFormat && (
                  <>
                    <span
                      className="hidden h-4 w-px bg-border sm:inline"
                      aria-hidden="true"
                    />
                    <TextFormatToolbar
                      format={selectedTextFormat}
                      disabled={isBusy}
                      onChange={handleTextFormatChange}
                    />
                  </>
                )}

                <div className="ml-auto flex flex-wrap items-center gap-2">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="rounded-lg"
                    disabled={isBusy}
                    onClick={() => setFieldsNavigatorOpen(true)}
                    aria-expanded={fieldsNavigatorOpen}
                  >
                    <List className="mr-1.5 h-3.5 w-3.5" aria-hidden="true" />
                    {fieldsSummary?.buttonLabel ?? "Fields"}
                  </ActionButton>
                </div>
              </div>

              <div className="bg-surface-muted/30 p-3 sm:p-4">
                <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
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
              </div>

              <FieldsNavigator
                open={fieldsNavigatorOpen}
                fields={uploadedPdf.document.fields}
                workspace={workspaceWithErrors}
                onClose={() => setFieldsNavigatorOpen(false)}
                onFieldSelect={handleFieldSelect}
              />
            </div>
          ) : null
        }
        controlPanel={
          uploadedPdf && workspaceWithErrors ? (
            <ToolControlPanel
              aria-label="Fill PDF controls"
              footer={
                hasResult && resultBlob ? (
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
                        Download filled PDF
                      </ActionButton>
                    </div>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={handleChangeSettings}
                    >
                      Edit
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
                  <div className="space-y-2">
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
                        loading={primaryAction.loading}
                        disabled={!canExport || isBusy}
                        onClick={primaryAction.onClick}
                      >
                        {primaryAction.label}
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
                      ✓ PDF ready
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your filled PDF is ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Fields</dt>
                      <dd className="font-semibold text-foreground">
                        {fieldCount}
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
                settingsBody
              )}
            </ToolControlPanel>
          ) : null
        }
      />

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
