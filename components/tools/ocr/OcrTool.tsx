"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { OcrFilePreview } from "@/components/tools/ocr/OcrFilePreview";
import { OcrLanguageSelect } from "@/components/tools/ocr/OcrLanguageSelect";
import { OcrProgressBanner } from "@/components/tools/ocr/OcrProgressBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
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
  type OcrLanguageCode,
  type OcrProgressPhase,
} from "@/lib/tools/ocr/languages";
import { renderPagePreviewDataUrl } from "@/lib/tools/pdf-to-image/pdf-render";
import { getPdfPageCountFromBytes } from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface UploadedOcrFile {
  file: File;
  previewUrl: string | null;
  isPdf: boolean;
  pageCount?: number;
}

function OcrDropIcon() {
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
        d="M9 12h6m-6-4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V15a2 2 0 01-2 2z"
      />
    </svg>
  );
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

  return (
    <div className="space-y-8">
      <OcrProgressBanner
        status={isPreparing ? "loading" : status}
        phase={ocrPhase}
        message={
          isPreparing ? "Preparing file…" : statusMessage
        }
        progress={progress}
      />

      {!uploadedFile && (
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
          />
          <PrivacyNotice />
        </>
      )}

      {uploadedFile && (
        <>
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h2 className="text-lg font-semibold text-foreground">Uploaded file</h2>
              <p className="mt-1 text-sm text-foreground-muted">
                {uploadedFile.file.name} · {formatFileSize(uploadedFile.file.size)}
              </p>
            </div>
            <ActionButton
              variant="outline"
              className="w-full sm:w-auto"
              disabled={isBusy}
              onClick={resetTool}
            >
              Upload another file
            </ActionButton>
          </div>

          <div className="grid gap-6 lg:grid-cols-2">
            <OcrFilePreview
              fileName={uploadedFile.file.name}
              fileSizeLabel={formatFileSize(uploadedFile.file.size)}
              previewUrl={uploadedFile.previewUrl}
              isPdf={uploadedFile.isPdf}
              pageCount={uploadedFile.pageCount}
            />
            <OcrLanguageSelect
              value={language}
              onChange={setLanguage}
              disabled={isBusy}
            />
          </div>

          <div className="flex flex-col gap-3 sm:flex-row">
            <ActionButton
              size="lg"
              className="w-full sm:w-auto"
              loading={status === "loading"}
              disabled={isBusy}
              onClick={handleExtract}
            >
              {status === "loading" ? "Extracting text…" : "Extract text"}
            </ActionButton>
          </div>

          {(extractedText || status === "success") && (
            <div className="space-y-6">
              <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <h2 className="mb-4 text-lg font-semibold text-foreground">
                  Extracted text
                </h2>

                <textarea
                  value={extractedText}
                  onChange={(event) => setExtractedText(event.target.value)}
                  dir="auto"
                  rows={16}
                  placeholder="Extracted text will appear here…"
                  className="input-field min-h-[320px] resize-y leading-relaxed"
                />
              </div>

              {hasResult && (
                <ToolResultsPanel
                  primaryLabel={copyFeedback ?? "Copy text"}
                  primaryDisabled={!extractedText || isBusy}
                  onPrimaryClick={handleCopy}
                  onStartOver={resetTool}
                >
                  <p className="text-sm text-scanonix-muted">
                    {extractedText.length.toLocaleString()} characters extracted
                    · {language.toUpperCase()}
                  </p>
                  <div className="mt-3">
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full sm:w-auto"
                      loading={isDownloading}
                      disabled={!extractedText || isBusy}
                      onClick={handleDownload}
                    >
                      Download as TXT
                    </ActionButton>
                  </div>
                </ToolResultsPanel>
              )}
            </div>
          )}

          <PrivacyNotice />
        </>
      )}

      <ToolStickyMobileActionBar
        visible={hasResult}
        primaryLabel={copyFeedback ?? "Copy text"}
        primaryDisabled={!extractedText || isBusy}
        onPrimaryClick={handleCopy}
        secondaryLabel="Start over"
        onSecondaryClick={resetTool}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
