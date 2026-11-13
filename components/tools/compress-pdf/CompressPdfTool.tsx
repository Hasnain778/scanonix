"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { CompressDocumentOverview } from "@/components/tools/compress-pdf/CompressDocumentOverview";
import { formatCompressPdfSavingsLabel } from "@/components/tools/compress-pdf/savings-label";
import { CompressionLevelPanel } from "@/components/tools/compress-pdf/CompressionLevelPanel";
import { CompressProgressBanner } from "@/components/tools/compress-pdf/CompressProgressBanner";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-wave4d.css";
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

  const primaryLabel = hasResult
    ? "Download PDF"
    : isCompressing
      ? "Compressing…"
      : "Compress PDF";

  return (
    <div className="ux-wave4d overflow-x-hidden">
      <div className="ux-wave4d-banner">
        <CompressProgressBanner
          status={isReading ? "loading" : status}
          phase={phase}
          message={isReading ? "Reading PDF…" : statusMessage}
          progress={progress}
        />
      </div>

      {!uploadedPdf ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="PDF"
            toLabel="Smaller"
            buttonLabel="Upload a PDF"
            prompt="Upload or drag a PDF here."
            formats="PDF"
            accept={ACCEPTED_PDF_EXTENSIONS}
            multiple={false}
            disabled={isBusy}
            validateFile={isAcceptedPdfFile}
            onFilesSelected={(files) => {
              void handleUpload(files);
            }}
          />
          <p className="ux-wave4d-note">One PDF at a time</p>
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
                <p className="mt-0.5 truncate text-xs text-scanonix-muted">
                  {formatFileSize(uploadedPdf.file.size)} · {uploadedPdf.pageCount} page
                  {uploadedPdf.pageCount === 1 ? "" : "s"}
                </p>
              </div>
              <div className="ux-command-actions">
                <ActionButton variant="ghost" size="sm" disabled={isBusy} onClick={resetTool}>
                  {hasResult ? "Start over" : "Choose another PDF"}
                </ActionButton>
                <ActionButton
                  size="lg"
                  className="ux-command-primary"
                  loading={hasResult ? isDownloading : isCompressing}
                  disabled={hasResult ? isBusy || !compressedBlob : isBusy}
                  onClick={() => {
                    if (hasResult) void handleDownload();
                    else void handleCompress();
                  }}
                >
                  {primaryLabel}
                </ActionButton>
              </div>
            </div>

            {isLargePdf ? (
              <div className="ux-wave4d-warning text-sm text-foreground">
                This is a large PDF. Server compression may take longer to complete.
              </div>
            ) : null}

            <CompressDocumentOverview
              pdfBytes={uploadedPdf.pdfBytes}
              pageCount={uploadedPdf.pageCount}
              fileName={uploadedPdf.file.name}
              level={level}
              isCompressing={isCompressing}
              compressedSize={compressedBlob?.size ?? null}
              hasResult={hasResult}
            />

            {hasResult && compressedBlob ? (
              <div className="ux-4d-result">
                <div>
                  <p className="ux-wave4d-note text-left">
                    {reduced ? "Compression complete" : "No smaller file"}
                  </p>
                  <p className="mt-1 text-sm text-foreground">
                    {reduced
                      ? "Your compressed PDF is ready to download."
                      : "This PDF is already well optimized. No smaller result was produced."}
                  </p>
                </div>
                <dl className="ux-4d-stats text-sm">
                  <div>
                    <dt className="text-scanonix-muted">Original size</dt>
                    <dd className="font-semibold text-foreground">{formatFileSize(uploadedPdf.file.size)}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Compressed size</dt>
                    <dd className="font-semibold text-foreground">{formatFileSize(compressedBlob.size)}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Saved</dt>
                    <dd className="font-semibold text-foreground">
                      {savingsPercent != null && savingsPercent > 0
                        ? formatCompressPdfSavingsLabel(uploadedPdf.file.size, compressedBlob.size, savingsPercent)
                        : "No reduction"}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Filename</dt>
                    <dd className="min-w-0 truncate font-semibold text-foreground">scanonix-compressed.pdf</dd>
                  </div>
                </dl>
                <ActionButton variant="ghost" size="sm" disabled={isBusy} onClick={handleChangeSettings}>
                  Change settings
                </ActionButton>
              </div>
            ) : (
              <div className="ux-4d-settings">
                <p className="text-sm leading-snug text-scanonix-muted">
                  Reduce PDF file size with server-side compression while preserving selectable text.
                </p>
                <CompressionLevelPanel
                  level={level}
                  onLevelChange={setLevel}
                  originalSize={uploadedPdf.file.size}
                  disabled={isBusy}
                  isPro={isPro}
                />
                <p className="ux-wave4d-hint">{compressHint}</p>
              </div>
            )}

            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </div>
        </div>
      )}
    </div>
  );
}
