"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { PdfPreviewGrid } from "@/components/tools/pdf-to-image/PdfPreviewGrid";
import { RotationPanel } from "@/components/tools/rotate-pdf/RotationPanel";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/ux-pdf-pages.css";
import "@/styles/ux-reset-file-pair.css";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  buildRotatedPdfFilename,
  rotatePdfPages,
} from "@/lib/tools/rotate-pdf/rotate-pdf";
import {
  getPdfRotateErrorMessage,
  PdfRotateError,
  type PdfRotationDegrees,
} from "@/lib/tools/rotate-pdf/types";
import {
  getPdfPageCountFromBytes,
  isAcceptedPdfFile,
} from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface UploadedPdfState {
  file: File;
  pageCount: number;
  pdfBytes: ArrayBuffer;
}

export function RotatePdfTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [rotation, setRotation] = useState<PdfRotationDegrees>(90);
  const [applyToAll, setApplyToAll] = useState(true);
  const [selectedPages, setSelectedPages] = useState<number[]>([]);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFilename, setResultFilename] = useState("scanonix-rotated.pdf");
  const [rotatedPageCount, setRotatedPageCount] = useState(0);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const resultBlobRef = useRef<Blob | null>(null);

  const isBusy = status === "loading" || isReadingPdf || isDownloading;
  const hasResult = resultBlob !== null && status === "success";

  const pagesToRotate = useMemo(() => {
    if (!uploadedPdf) return [];
    if (applyToAll) {
      return Array.from({ length: uploadedPdf.pageCount }, (_, index) => index + 1);
    }
    return [...selectedPages].sort((a, b) => a - b);
  }, [uploadedPdf, applyToAll, selectedPages]);

  /** Highlight planned rotation targets on the real preview grid. */
  const highlightedPages = useMemo(() => pagesToRotate, [pagesToRotate]);

  const canRotate =
    uploadedPdf !== null &&
    pagesToRotate.length > 0 &&
    !isBusy;

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
    setRotatedPageCount(0);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const resetTool = useCallback(() => {
    resultBlobRef.current = null;
    setUploadedPdf(null);
    setSelectedPages([]);
    setApplyToAll(true);
    setRotation(90);
    setResultBlob(null);
    setResultFilename("scanonix-rotated.pdf");
    setRotatedPageCount(0);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsReadingPdf(true);
    setStatus("idle");
    setStatusMessage(undefined);
    setResultBlob(null);
    setProgress(undefined);

    try {
      const pdfBytes = await file.arrayBuffer();
      const pageCount = await getPdfPageCountFromBytes(pdfBytes);

      if (pageCount === 0) {
        setStatus("error");
        setStatusMessage("This PDF contains no pages to rotate.");
        setUploadedPdf(null);
        return;
      }

      setUploadedPdf({ file, pageCount, pdfBytes });
      setSelectedPages([]);
      setApplyToAll(true);
      setResultFilename(buildRotatedPdfFilename(file.name));
    } catch (error) {
      setStatus("error");
      setStatusMessage(getPdfRotateErrorMessage(error));
      setUploadedPdf(null);
    } finally {
      setIsReadingPdf(false);
    }
  }, []);

  const togglePage = useCallback(
    (page: number) => {
      invalidateResult();
      setSelectedPages((current) =>
        current.includes(page)
          ? current.filter((value) => value !== page)
          : [...current, page].sort((a, b) => a - b),
      );
    },
    [invalidateResult],
  );

  const handleRotate = async () => {
    if (!uploadedPdf || !canRotate) return;

    const attempt = createProcessAttempt("rotate-pdf");

    const gate = await gateToolOperation("rotate-pdf");
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setStatusMessage(undefined);
    setProgress({ current: 0, total: pagesToRotate.length });
    setResultBlob(null);

    try {
      const blob = await rotatePdfPages(
        uploadedPdf.pdfBytes,
        pagesToRotate,
        rotation,
        (current, total) => setProgress({ current, total }),
      );

      setResultBlob(blob);
      attempt.success(1);
      setRotatedPageCount(pagesToRotate.length);
      setStatus("success");
      setStatusMessage(
        `Rotated ${pagesToRotate.length} page${pagesToRotate.length === 1 ? "" : "s"} by ${rotation}° — ready to download.`,
      );
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof PdfRotateError
          ? error.message
          : getPdfRotateErrorMessage(error),
      );
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const blob = resultBlobRef.current ?? resultBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, resultFilename, buildToolDownloadMeta("rotate-pdf", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  const handleChangeSettings = useCallback(() => {
    invalidateResult();
  }, [invalidateResult]);

  const rotateHint =
    !applyToAll && selectedPages.length === 0
      ? "Select at least one page to rotate."
      : canRotate
        ? `Ready to rotate ${pagesToRotate.length} page${pagesToRotate.length === 1 ? "" : "s"} by ${rotation}°.`
        : "Configure rotation options.";

  const primaryLabel = hasResult
    ? "Download rotated PDF"
    : status === "loading"
      ? "Rotating…"
      : "Rotate PDF";

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
            toLabel="PDF"
            buttonLabel="Upload a PDF"
            prompt="Upload or drag a PDF here."
            formats="PDF"
            accept={ACCEPTED_PDF_EXTENSIONS}
            validateFile={isAcceptedPdfFile}
            multiple={false}
            disabled={isBusy}
            onFilesSelected={handleUpload}
          />
          <PrivacyNotice />
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
                  {formatFileSize(uploadedPdf.file.size)} · {uploadedPdf.pageCount}{" "}
                  page{uploadedPdf.pageCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="ux-command-actions">
                <ActionButton
                  variant="ghost"
                  size="sm"
                  disabled={isBusy}
                  onClick={resetTool}
                >
                  {hasResult ? "Start over" : "Remove PDF"}
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
                  loading={hasResult ? isDownloading : status === "loading"}
                  disabled={hasResult ? isBusy : !canRotate}
                  onClick={() => {
                    if (hasResult) {
                      void handleDownload();
                    } else {
                      handleRotate();
                    }
                  }}
                >
                  {primaryLabel}
                </ActionButton>
              </div>
            </div>

            <div className="ux-pdf-layout">
              <div className="ux-pdf-preview space-y-3">
                {applyToAll && (
                  <p className="text-xs text-scanonix-muted">
                    All {uploadedPdf.pageCount} page
                    {uploadedPdf.pageCount === 1 ? "" : "s"} will be rotated.
                    Switch to “Selected pages only” to pick individual pages.
                  </p>
                )}
                <PdfPreviewGrid
                  key={`${uploadedPdf.file.name}-${uploadedPdf.pageCount}`}
                  pdfBytes={uploadedPdf.pdfBytes}
                  totalPages={uploadedPdf.pageCount}
                  selectedPages={selectedPages}
                  highlightedPages={highlightedPages}
                  selectable={!applyToAll}
                  onTogglePage={togglePage}
                  onSelectAll={() => {
                    invalidateResult();
                    setSelectedPages(
                      Array.from(
                        { length: uploadedPdf.pageCount },
                        (_, index) => index + 1,
                      ),
                    );
                  }}
                  onClearSelection={() => {
                    invalidateResult();
                    setSelectedPages([]);
                  }}
                  disabled={isBusy}
                />
              </div>

              <section className="ux-pdf-settings" aria-label="Rotate PDF controls">
              {hasResult && resultBlob ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-green-700">
                      ✓ Rotation complete
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your rotated PDF is ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Pages rotated</dt>
                      <dd className="font-semibold text-foreground">
                        {rotatedPageCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Angle</dt>
                      <dd className="font-semibold text-foreground">
                        {rotation}°
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
                  <RotationPanel
                    compact
                    rotation={rotation}
                    applyToAll={applyToAll}
                    selectedCount={selectedPages.length}
                    totalPages={uploadedPdf.pageCount}
                    disabled={isBusy}
                    onRotationChange={(value) => {
                      invalidateResult();
                      setRotation(value);
                    }}
                    onApplyToAllChange={(value) => {
                      invalidateResult();
                      setApplyToAll(value);
                    }}
                  />
                  <p className="ux-pdf-note">{rotateHint}</p>
                  <div className="border-t border-border/80 pt-4">
                    <PrivacyNotice />
                  </div>
                </div>
              )}
              </section>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
