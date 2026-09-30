"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileArchive } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { CompressDocumentOverview } from "@/components/tools/compress-pdf/CompressDocumentOverview";
import { formatCompressPdfSavingsLabel } from "@/components/tools/compress-pdf/savings-label";
import { CompressionLevelPanel } from "@/components/tools/compress-pdf/CompressionLevelPanel";
import { CompressProgressBanner } from "@/components/tools/compress-pdf/CompressProgressBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import { compressPdfViaServer } from "@/lib/tools/compress-pdf/client";
import {
  type CompressionLevel,
  type CompressProgressPhase,
  LARGE_PDF_BYTES,
  LARGE_PDF_PAGES,
  PdfCompressionError,
  calculateSavingsPercent,
  COMPRESSION_LEVELS,
} from "@/lib/tools/compress-pdf/compression-levels";
import { useProAccess } from "@/hooks/useProAccess";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  getPdfPageCountFromBytes,
  isAcceptedPdfFile,
} from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

const PRIVACY_MESSAGE =
  "Your file is securely processed on Scanonix servers to compress the PDF.";

interface UploadedPdfState {
  file: File;
  pageCount: number;
  pdfBytes: ArrayBuffer;
}

function CompressDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <FileArchive className={className} aria-hidden="true" strokeWidth={1.75} />
  );
}

export function CompressPdfTool() {
  const { isPro } = useProAccess();
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [level, setLevel] = useState<CompressionLevel>("light");
  const [compressedBlob, setCompressedBlob] = useState<Blob | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [phase, setPhase] = useState<CompressProgressPhase>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isReading, setIsReading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const compressedBlobRef = useRef<Blob | null>(null);

  const isBusy = status === "loading" || isReading || isDownloading;
  const hasResult = compressedBlob !== null && status === "success";
  const isCompressing = status === "loading";

  useEffect(() => {
    compressedBlobRef.current = compressedBlob;
  }, [compressedBlob]);

  useEffect(() => {
    return () => {
      compressedBlobRef.current = null;
    };
  }, []);

  const isLargePdf = useMemo(() => {
    if (!uploadedPdf) return false;
    return (
      uploadedPdf.file.size > LARGE_PDF_BYTES ||
      uploadedPdf.pageCount > LARGE_PDF_PAGES
    );
  }, [uploadedPdf]);

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (isCompressing || isReading) return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedPdf !== null) return "ready";
    return "idle";
  }, [isCompressing, isReading, hasResult, status, uploadedPdf]);

  const stickyVisible = Boolean(uploadedPdf);

  const resetTool = useCallback(() => {
    compressedBlobRef.current = null;
    setUploadedPdf(null);
    setCompressedBlob(null);
    setLevel("recommended");
    setStatus("idle");
    setPhase(undefined);
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
  }, []);

  const handleChangeSettings = useCallback(() => {
    compressedBlobRef.current = null;
    setCompressedBlob(null);
    if (status === "success") {
      setStatus("idle");
      setPhase(undefined);
      setStatusMessage(undefined);
    }
  }, [status]);

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsReading(true);
    setStatus("idle");
    setStatusMessage(undefined);
    setCompressedBlob(null);
    setPhase(undefined);

    try {
      const pdfBytes = await file.arrayBuffer();
      const pageCount = await getPdfPageCountFromBytes(pdfBytes);
      setUploadedPdf({ file, pageCount, pdfBytes });
      setLevel("light");
    } catch (error) {
      const message =
        error &&
        typeof error === "object" &&
        ("name" in error || "message" in error) &&
        ((error as { name?: string }).name === "PasswordException" ||
          /password/i.test((error as { message?: string }).message ?? ""))
          ? "This PDF is password-protected. Remove the password and try again."
          : "Could not read this PDF. The file may be corrupt or unsupported.";

      setStatus("error");
      setStatusMessage(message);
      setUploadedPdf(null);
    } finally {
      setIsReading(false);
    }
  }, []);

  const handleCompress = async () => {
    if (!uploadedPdf || isBusy) return;

    const attempt = createProcessAttempt("compress-pdf");

    const gate = await gateToolOperation("compress-pdf", uploadedPdf.file.size);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setPhase("uploading");
    setStatusMessage(undefined);
    setProgress(undefined);
    setCompressedBlob(null);

    try {
      const candidate = await compressPdfViaServer({
        file: uploadedPdf.file,
        level,
        onProgress: (nextPhase) => {
          setPhase(nextPhase);
        },
      });
      const resultBlob =
        candidate.size < uploadedPdf.file.size ? candidate : uploadedPdf.file;

      setCompressedBlob(resultBlob);
      attempt.success(1);
      setStatus("success");
      setPhase("complete");

      const savedBytes = uploadedPdf.file.size - resultBlob.size;
      if (savedBytes > 0) {
        setStatusMessage(`Complete — saved ${formatFileSize(savedBytes)}.`);
      } else {
        setStatusMessage(
          "This PDF is already well optimized. No smaller result was produced.",
        );
      }
      setProgress(undefined);
    } catch (error) {
      attempt.error(
        error instanceof PdfCompressionError
          ? planErrorMessageToCode(error.message)
          : "unknown",
      );
      setStatus("error");
      setPhase(undefined);
      setStatusMessage(
        error instanceof PdfCompressionError
          ? error.message
          : "Compression failed. Please try again.",
      );
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const blob = compressedBlobRef.current ?? compressedBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(
        blob,
        "scanonix-compressed.pdf",
        buildToolDownloadMeta("compress-pdf", 1),
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const compressHint = isCompressing
    ? "Compression in progress…"
    : `Ready to compress with ${COMPRESSION_LEVELS[level].label.toLowerCase()}.`;

  const savingsPercent =
    hasResult && compressedBlob && uploadedPdf
      ? calculateSavingsPercent(uploadedPdf.file.size, compressedBlob.size)
      : null;
  const reduced =
    hasResult &&
    compressedBlob != null &&
    uploadedPdf != null &&
    compressedBlob.size < uploadedPdf.file.size;

  return (
    <div className="compress-pdf-prototype space-y-5 overflow-x-hidden">
      <CompressProgressBanner
        status={isReading ? "loading" : status}
        phase={phase}
        message={isReading ? "Reading PDF…" : statusMessage}
        progress={progress}
      />

      <ToolWorkspaceShell
        isEmpty={!uploadedPdf}
        empty={
          <>
            <FileDropZone
              className="compress-drop"
              onFilesSelected={handleUpload}
              accept={ACCEPTED_PDF_EXTENSIONS}
              validateFile={isAcceptedPdfFile}
              multiple={false}
              disabled={isBusy}
              label="Drop a PDF file here to compress"
              hint="or click to browse — one PDF at a time"
              icon={<CompressDropIcon />}
            />
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </>
        }
        workArea={
          uploadedPdf ? (
            <div className="w-full max-w-[16.5rem] sm:max-w-[17rem] lg:max-w-[28rem]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 flex-1 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-scanonix-orange/10 text-scanonix-orange">
                    <CompressDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedPdf.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedPdf.file.size)} ·{" "}
                      {uploadedPdf.pageCount} page
                      {uploadedPdf.pageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div className="hidden shrink-0 lg:block">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={resetTool}
                  >
                    {hasResult ? "Start over" : "Choose another PDF"}
                  </ActionButton>
                </div>
              </div>

              {isLargePdf && (
                <div className="mt-3 rounded-lg bg-amber-500/10 px-3 py-2 text-sm text-foreground">
                  This is a large PDF. Server compression may take longer to
                  complete.
                </div>
              )}

              <div className="mt-3 w-fit max-w-full rounded-xl bg-surface-strong p-3 sm:p-4">
                <CompressDocumentOverview
                  pdfBytes={uploadedPdf.pdfBytes}
                  pageCount={uploadedPdf.pageCount}
                  fileName={uploadedPdf.file.name}
                  level={level}
                  isCompressing={isCompressing}
                  compressedSize={compressedBlob?.size ?? null}
                  hasResult={hasResult}
                />
              </div>
            </div>
          ) : null
        }
        controlPanel={
          uploadedPdf ? (
            <ToolControlPanel
              aria-label="Compress PDF controls"
              footer={
                hasResult && compressedBlob ? (
                  <div className="flex flex-col gap-2">
                    <div className="hidden lg:block">
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
                      onClick={handleChangeSettings}
                    >
                      Change settings
                    </ActionButton>
                    <div className="hidden lg:block">
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={resetTool}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {compressHint}
                    </p>
                    <div className="hidden lg:block">
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isCompressing}
                        disabled={isBusy}
                        onClick={() => {
                          void handleCompress();
                        }}
                      >
                        {isCompressing ? "Compressing…" : "Compress PDF"}
                      </ActionButton>
                    </div>
                  </div>
                )
              }
            >
              {hasResult && compressedBlob ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p
                      className={`mt-1.5 text-sm font-semibold ${
                        reduced
                          ? "text-emerald-800 [[data-theme=dark]_&]:text-emerald-300"
                          : "text-foreground"
                      }`}
                    >
                      {reduced ? "✓ Compression complete" : "No smaller file"}
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      {reduced
                        ? "Your compressed PDF is ready to download."
                        : "This PDF is already well optimized. No smaller result was produced."}
                    </p>
                  </div>

                  <dl className="space-y-2.5 text-sm">
                    <div className="flex justify-between gap-3">
                      <dt className="text-scanonix-muted">Original size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(uploadedPdf.file.size)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-scanonix-muted">Compressed size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(compressedBlob.size)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3">
                      <dt className="text-scanonix-muted">Saved</dt>
                      <dd className="font-semibold text-foreground">
                        {savingsPercent != null && savingsPercent > 0
                          ? formatCompressPdfSavingsLabel(
                              uploadedPdf.file.size,
                              compressedBlob.size,
                              savingsPercent,
                            )
                          : "No reduction"}
                      </dd>
                    </div>
                    <div className="min-w-0">
                      <dt className="text-scanonix-muted">Filename</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        scanonix-compressed.pdf
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <FileArchive
                        className="h-4 w-4 text-scanonix-orange"
                        aria-hidden="true"
                      />
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Settings
                      </p>
                    </div>
                    <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
                      Reduce PDF file size with server-side compression while
                      preserving selectable text.
                    </p>
                  </div>

                  <CompressionLevelPanel
                    level={level}
                    onLevelChange={setLevel}
                    originalSize={uploadedPdf.file.size}
                    disabled={isBusy}
                    isPro={isPro}
                  />

                  <div className="compress-privacy">
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </div>
                </div>
              )}
            </ToolControlPanel>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        stickyUntil="lg"
        visible={stickyVisible}
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download PDF" : "Compress PDF"}
        primaryLoading={hasResult ? isDownloading : isCompressing}
        primaryDisabled={hasResult ? isBusy || !compressedBlob : isBusy}
        showPrimaryOnError
        onPrimaryClick={() => {
          if (hasResult) {
            void handleDownload();
          } else {
            void handleCompress();
          }
        }}
        secondaryLabel={
          resultActionPhase === "ready" && uploadedPdf
            ? "Choose another PDF"
            : undefined
        }
        onSecondaryClick={
          resultActionPhase === "ready" && uploadedPdf ? resetTool : undefined
        }
        secondaryDisabled={isBusy}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
