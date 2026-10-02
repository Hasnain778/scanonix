"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ScanText } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { OcrFilePreview } from "@/components/tools/ocr/OcrFilePreview";
import { OcrLanguageSelect } from "@/components/tools/ocr/OcrLanguageSelect";
import { OcrProgressBanner } from "@/components/tools/ocr/OcrProgressBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import {
  assertSupportedOcrFile,
  isAcceptedOcrFile,
  isOcrPdfFile,
  OCR_ACCEPTED_EXTENSIONS,
} from "@/lib/tools/ocr/file-validation";
import { extractTextFromFile } from "@/lib/tools/ocr/extract-text";
import {
  OcrExtractionError,
  OCR_LANGUAGES,
  type OcrLanguageCode,
  type OcrProgressPhase,
} from "@/lib/tools/ocr/languages";
import { renderPagePreviewDataUrl } from "@/lib/tools/pdf-to-image/pdf-render";
import "@/styles/ocr-premium.css";
import { getPdfPageCountFromBytes } from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";

const PRIVACY_MESSAGE =
  "Your file is processed locally in your browser.";

interface UploadedOcrFile {
  file: File;
  previewUrl: string | null;
  isPdf: boolean;
  pageCount?: number;
}

function OcrDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <ScanText className={className} aria-hidden="true" strokeWidth={1.75} />;
}

function fileTypeLabel(uploaded: UploadedOcrFile): string {
  if (uploaded.isPdf) return "PDF";
  const extension = uploaded.file.name.split(".").pop()?.toUpperCase();
  return extension || "Image";
}

function languageLabel(code: OcrLanguageCode): string {
  return OCR_LANGUAGES.find((entry) => entry.code === code)?.label ?? code.toUpperCase();
}

export function OcrTool() {
  const [uploadedFile, setUploadedFile] = useState<UploadedOcrFile | null>(null);
  const [language, setLanguage] = useState<OcrLanguageCode>("eng");
  const [extractedText, setExtractedText] = useState("");
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [ocrPhase, setOcrPhase] = useState<OcrProgressPhase>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isPreparing, setIsPreparing] = useState(false);
  const [copyFeedback, setCopyFeedback] = useState<string>();
  const [isDownloading, setIsDownloading] = useState(false);

  const previewUrlRef = useRef<string | null>(null);
  const extractedTextRef = useRef("");

  const isBusy = status === "loading" || isPreparing || isDownloading;
  const hasResult = extractedText.length > 0 && status === "success";
  const showExtractedWorkspace =
    extractedText.length > 0 || status === "success" || status === "loading";

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading" || isPreparing) return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedFile) return "ready";
    return "idle";
  }, [status, isPreparing, hasResult, uploadedFile]);

  useEffect(() => {
    extractedTextRef.current = extractedText;
  }, [extractedText]);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) {
        URL.revokeObjectURL(previewUrlRef.current);
      }
    };
  }, []);

  const revokePreview = useCallback(() => {
    if (previewUrlRef.current) {
      URL.revokeObjectURL(previewUrlRef.current);
      previewUrlRef.current = null;
    }
  }, []);

  const resetTool = useCallback(() => {
    revokePreview();
    setUploadedFile(null);
    setExtractedText("");
    setStatus("idle");
    setOcrPhase(undefined);
    setStatusMessage(undefined);
    setProgress(undefined);
    setCopyFeedback(undefined);
    setIsDownloading(false);
  }, [revokePreview]);

  const handleUpload = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      setIsPreparing(true);
      setStatus("idle");
      setStatusMessage(undefined);
      setExtractedText("");
      setCopyFeedback(undefined);
      revokePreview();

      try {
        assertSupportedOcrFile(file);

        const isPdf = isOcrPdfFile(file);
        let previewUrl: string | null = null;
        let pageCount: number | undefined;

        if (isPdf) {
          const pdfBytes = await file.arrayBuffer();

          try {
            pageCount = await getPdfPageCountFromBytes(pdfBytes);
            previewUrl = await renderPagePreviewDataUrl(pdfBytes, 1, 0.75);
          } catch (error) {
            const message =
              error &&
              typeof error === "object" &&
              ("name" in error || "message" in error) &&
              ((error as { name?: string }).name === "PasswordException" ||
                /password/i.test((error as { message?: string }).message ?? ""))
                ? "This PDF is password-protected. Remove the password and try again."
                : "Could not open this PDF. It may be corrupted or unsupported.";

            throw new OcrExtractionError(
              /password/i.test(message) ? "PASSWORD_PDF" : "OCR_FAILURE",
              message,
            );
          }
        } else {
          previewUrl = URL.createObjectURL(file);
          previewUrlRef.current = previewUrl;
        }

        setUploadedFile({ file, previewUrl, isPdf, pageCount });
      } catch (error) {
        setStatus("error");
        setStatusMessage(
          error instanceof OcrExtractionError
            ? error.message
            : "Could not prepare this file for OCR.",
        );
        setUploadedFile(null);
      } finally {
        setIsPreparing(false);
      }
    },
    [revokePreview],
  );

  const handleExtract = async () => {
    if (!uploadedFile || isBusy) return;

    const attempt = createProcessAttempt("ocr");

    const gate = await gateToolOperation("ocr", uploadedFile.file.size);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setOcrPhase("preparing");
    setStatusMessage(undefined);
    setProgress(undefined);
    setCopyFeedback(undefined);

    try {
      const text = await extractTextFromFile(
        uploadedFile.file,
        language,
        (phase, detail) => {
          setOcrPhase(phase);
          if (detail?.current && detail?.total) {
            setProgress({ current: detail.current, total: detail.total });
          }
        },
      );

      setExtractedText(text);
      attempt.success(1);
      setStatus("success");
      setOcrPhase("complete");
      setStatusMessage("Complete — text extracted successfully!");
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setOcrPhase(undefined);
      setStatusMessage(
        error instanceof OcrExtractionError
          ? error.message
          : "OCR failed to extract text. Please try again.",
      );
      setProgress(undefined);
    }
  };

  const handleCopy = async () => {
    if (!extractedText) return;

    try {
      await navigator.clipboard.writeText(extractedText);
      setCopyFeedback("Copied!");
      window.setTimeout(() => setCopyFeedback(undefined), 2000);
    } catch {
      setCopyFeedback("Copy failed");
    }
  };

  const handleDownload = async () => {
    const text = extractedTextRef.current || extractedText;
    if (!text || isDownloading) return;

    setIsDownloading(true);
    try {
      const blob = new Blob([text], {
        type: "text/plain;charset=utf-8",
      });
      downloadBlob(blob, "scanonix-ocr.txt", buildToolDownloadMeta("ocr", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  const extractHint = !uploadedFile
    ? "Upload a document before extracting text."
    : status === "loading"
      ? progress
        ? `Processing page ${progress.current} of ${progress.total}…`
        : "Extracting text…"
      : "Ready to extract text from this document.";

  return (
    <div className="ocr-premium space-y-5">
      <OcrProgressBanner
        status={isPreparing ? "loading" : status}
        phase={ocrPhase}
        message={isPreparing ? "Preparing file…" : statusMessage}
        progress={progress}
      />

      <ToolWorkspaceShell
        isEmpty={!uploadedFile}
        empty={
          <>
            <FileDropZone
              onFilesSelected={handleUpload}
              accept={OCR_ACCEPTED_EXTENSIONS}
              validateFile={isAcceptedOcrFile}
              multiple={false}
              disabled={isBusy}
              label="Drop a file here for OCR"
              hint="or click to browse — JPG, JPEG, PNG, WEBP, or PDF"
              icon={<OcrDropIcon />}
              className="ocr-drop"
            />
            <p className="text-center text-sm text-scanonix-muted">
              Extract editable text from images and PDFs.
            </p>
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </>
        }
        workArea={
          uploadedFile ? (
            <div className="ocr-source">
              <div className="ocr-filebar">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <OcrDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedFile.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedFile.file.size)} ·{" "}
                      {fileTypeLabel(uploadedFile)}
                      {uploadedFile.isPdf && uploadedFile.pageCount !== undefined
                        ? ` · ${uploadedFile.pageCount} page${uploadedFile.pageCount === 1 ? "" : "s"}`
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
                    className="w-full whitespace-nowrap rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={resetTool}
                  >
                    {hasResult ? "Start over" : "Upload another file"}
                  </ActionButton>
                </div>
              </div>

              {uploadedFile.isPdf ? (
                <p className="px-4 pt-3 text-[11px] text-scanonix-muted">
                  Page 1 preview — OCR processes all pages in this PDF.
                </p>
              ) : null}
              <OcrFilePreview
                fileName={uploadedFile.file.name}
                previewUrl={uploadedFile.previewUrl}
                isPdf={uploadedFile.isPdf}
              />

              {showExtractedWorkspace ? (
                <div className="ocr-result">
                  <div className="ocr-result-head">
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground">
                        Extracted text
                      </p>
                      <p className="text-[11px] text-scanonix-muted">
                        Edit the text before copying or downloading.
                      </p>
                    </div>
                    <div className="ocr-result-actions">
                      <ActionButton
                        size="sm"
                        className="hidden md:inline-flex"
                        disabled={!extractedText || isBusy}
                        onClick={() => {
                          void handleCopy();
                        }}
                      >
                        {copyFeedback ?? "Copy text"}
                      </ActionButton>
                      <ActionButton
                        variant="outline"
                        size="sm"
                        className="whitespace-nowrap"
                        loading={isDownloading}
                        disabled={!extractedText || isBusy}
                        onClick={() => {
                          void handleDownload();
                        }}
                      >
                        Download TXT
                      </ActionButton>
                    </div>
                  </div>
                  <textarea
                    value={extractedText}
                    onChange={(event) => setExtractedText(event.target.value)}
                    dir="auto"
                    rows={16}
                    placeholder="Extracted text will appear here…"
                    className="input-field ocr-result-text"
                  />
                  <p className="mt-2 text-[11px] text-scanonix-muted">
                    Downloads as scanonix-ocr.txt
                  </p>
                </div>
              ) : null}
            </div>
          ) : null
        }
        controlPanel={
          uploadedFile ? (
            <ToolControlPanel
              aria-label="OCR controls"
              footer={
                hasResult ? (
                  <ActionButton
                    variant="outline"
                    size="lg"
                    className="w-full whitespace-nowrap"
                    disabled={isBusy}
                    onClick={() => {
                      void handleExtract();
                    }}
                  >
                    Extract again
                  </ActionButton>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {extractHint}
                    </p>
                    <ActionButton
                      size="lg"
                      className="w-full whitespace-nowrap shadow-[var(--shadow-orange-sm)]"
                      loading={status === "loading"}
                      disabled={isBusy}
                      onClick={() => {
                        void handleExtract();
                      }}
                    >
                      {status === "loading" ? "Extracting text…" : "Extract text"}
                    </ActionButton>
                  </div>
                )
              }
            >
              {hasResult ? (
                <div className="space-y-3">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-green-700 [[data-theme=dark]_&]:text-green-400">
                      ✓ Text extracted
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Edit the text, then copy or download.
                    </p>
                  </div>
                  <p className="text-xs text-scanonix-muted">
                    Language · {languageLabel(language)}
                  </p>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      OCR
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-scanonix-muted">
                      Extract editable text from your document.
                    </p>
                  </div>

                  <OcrLanguageSelect
                    value={language}
                    onChange={setLanguage}
                    disabled={isBusy}
                  />

                  <section className="space-y-2 border-t border-border/80 pt-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Privacy
                    </h2>
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </section>
                </div>
              )}
            </ToolControlPanel>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={hasResult}
        phase={resultActionPhase}
        primaryLabel={copyFeedback ?? "Copy text"}
        primaryDisabled={!extractedText || isBusy}
        onPrimaryClick={() => {
          void handleCopy();
        }}
        secondaryLabel="Start over"
        onSecondaryClick={resetTool}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
