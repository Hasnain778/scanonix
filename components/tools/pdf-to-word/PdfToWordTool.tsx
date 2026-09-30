"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProToolGate } from "@/components/plan/ProToolGate";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PdfToWordProgressBanner } from "@/components/tools/pdf-to-word/PdfToWordProgressBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import "@/styles/simple-document-action-premium.css";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { submitPdfToWordForm } from "@/lib/tools/document-conversion/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { PdfToWordProgressPhase } from "@/lib/tools/pdf-to-word/types";
import {
  getPdfPageCountFromBytes,
  isAcceptedPdfFile,
} from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

const PRIVACY_MESSAGE =
  "Your PDF is converted on Scanonix servers via CloudConvert and deleted after processing.";

interface UploadedPdfState {
  file: File;
  pageCount: number;
}

function PdfDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <svg
      className={className}
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
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6z"
      />
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M14 2v6h6M16 13H8M16 17H8M10 9H8"
      />
    </svg>
  );
}

export function PdfToWordTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [docxBlob, setDocxBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState<string>();
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [phase, setPhase] = useState<PdfToWordProgressPhase>();
  const [statusMessage, setStatusMessage] = useState<string>();
  const [isReading, setIsReading] = useState(false);
  const [isDownloading, setIsDownloading] = useState(false);

  const docxBlobRef = useRef<Blob | null>(null);

  const isBusy = status === "loading" || isReading || isDownloading;
  const hasResult = status === "success" && docxBlob !== null;

  useEffect(() => {
    docxBlobRef.current = docxBlob;
  }, [docxBlob]);

  useEffect(() => {
    return () => {
      docxBlobRef.current = null;
    };
  }, []);

  const resetTool = useCallback(() => {
    docxBlobRef.current = null;
    setUploadedPdf(null);
    setDocxBlob(null);
    setResultFileName(undefined);
    setStatus("idle");
    setPhase(undefined);
    setStatusMessage(undefined);
    setIsDownloading(false);
  }, []);

  const handleUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    setIsReading(true);
    setStatus("idle");
    setStatusMessage(undefined);
    setDocxBlob(null);
    setResultFileName(undefined);
    setPhase(undefined);

    try {
      const pdfBytes = await file.arrayBuffer();
      const pageCount = await getPdfPageCountFromBytes(pdfBytes);

      if (pageCount === 0) {
        setStatus("error");
        setStatusMessage("This PDF contains no pages to convert.");
        setUploadedPdf(null);
        return;
      }

      setUploadedPdf({ file, pageCount });
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

  const handleConvert = useCallback(async () => {
    if (!uploadedPdf || isBusy) return;

    const attempt = createProcessAttempt("pdf-to-word");

    const gate = await gateToolOperation("pdf-to-word", uploadedPdf.file.size);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setPhase("processing");
    setStatusMessage(undefined);
    setDocxBlob(null);

    const formData = new FormData();
    formData.append("file", uploadedPdf.file);

    const result = await submitPdfToWordForm(formData);
    if (!result.ok) {
      attempt.error(planErrorMessageToCode(result.message));
      setStatus("error");
      setPhase(undefined);
      setStatusMessage(result.message);
      return;
    }

    setDocxBlob(result.blob);
    setResultFileName(result.fileName);
    attempt.success(1);
    setStatus("success");
    setPhase("complete");
    setStatusMessage("Complete — Word document ready to download!");
  }, [uploadedPdf, isBusy]);

  const handleDownload = useCallback(async () => {
    const blob = docxBlobRef.current ?? docxBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(
        blob,
        resultFileName ?? "scanonix-converted.docx",
        buildToolDownloadMeta("pdf-to-word", 1),
      );
    } finally {
      setIsDownloading(false);
    }
  }, [docxBlob, isDownloading, resultFileName]);

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (isReading || status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedPdf) return "ready";
    return "idle";
  }, [isReading, status, hasResult, uploadedPdf]);

  const stickyVisible = Boolean(uploadedPdf);
  const primaryLabel = hasResult
    ? "Download Word Document"
    : status === "loading" || isReading
      ? isReading
        ? "Reading PDF\u2026"
        : "Converting\u2026"
      : "Convert to Word";

  return (
    <ProToolGate
      toolName="PDF to Word"
      description="Sign in and upgrade to Scanonix Pro to convert PDFs to editable Word documents with CloudConvert."
    >
      <div className="simple-document-action-premium space-y-5 overflow-x-hidden">
        <PdfToWordProgressBanner
          status={isReading ? "loading" : status}
          phase={phase}
          message={isReading ? "Reading PDF\u2026" : statusMessage}
        />

        <ToolWorkspaceShell
          isEmpty={!uploadedPdf}
          empty={
            <>
              <FileDropZone
                className="simple-doc-drop"
                onFilesSelected={handleUpload}
                accept={ACCEPTED_PDF_EXTENSIONS}
                validateFile={isAcceptedPdfFile}
                multiple={false}
                disabled={isBusy}
                label="Drop a PDF file here to convert"
                hint="or click to browse \u2014 Pro feature, server-side conversion"
                icon={<PdfDropIcon />}
              />
              <div className="simple-doc-privacy">
                <PrivacyNotice message={PRIVACY_MESSAGE} />
              </div>
            </>
          }
          workArea={
            uploadedPdf ? (
              <div className="simple-doc-block w-full lg:max-w-[36rem]">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center text-scanonix-orange">
                      <PdfDropIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {uploadedPdf.file.name}
                      </p>
                      <p className="truncate text-xs text-scanonix-muted">
                        {formatFileSize(uploadedPdf.file.size)}
                        {" \u00B7 "}
                        {uploadedPdf.pageCount} page
                        {uploadedPdf.pageCount === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                  <div className={stickyVisible && hasResult ? "hidden shrink-0 lg:block" : "shrink-0"}>
                    <ActionButton
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={isBusy}
                      onClick={resetTool}
                    >
                      {hasResult ? "Start over" : "Choose another file"}
                    </ActionButton>
                  </div>
                </div>

                <p className="mt-4 text-sm leading-relaxed text-foreground">
                  {hasResult
                    ? "Word document ready to download."
                    : status === "loading"
                      ? "Converting via CloudConvert\u2026"
                      : isReading
                        ? "Reading PDF\u2026"
                        : "Converts this PDF to an editable DOCX on Scanonix servers. Complex layouts may still need light editing afterward."}
                </p>

                <div className={stickyVisible ? "mt-5 hidden lg:block" : "mt-5"}>
                  <ActionButton
                    size="lg"
                    className="h-12 w-full shadow-[var(--shadow-orange-sm)]"
                    loading={hasResult ? isDownloading : status === "loading"}
                    disabled={hasResult ? isBusy || !docxBlob : !uploadedPdf || isBusy}
                    onClick={() => {
                      if (hasResult) void handleDownload();
                      else void handleConvert();
                    }}
                  >
                    {primaryLabel}
                  </ActionButton>
                </div>

                <div className="simple-doc-privacy mt-4">
                  <PrivacyNotice message={PRIVACY_MESSAGE} />
                </div>
              </div>
            ) : null
          }
        />

        <ToolStickyMobileActionBar
          visible={stickyVisible}
          stickyUntil="lg"
          phase={resultActionPhase}
          primaryLabel={primaryLabel}
          primaryLoading={hasResult ? isDownloading : status === "loading" || isReading}
          primaryDisabled={hasResult ? isBusy || !docxBlob : !uploadedPdf || isBusy}
          showPrimaryOnError
          onPrimaryClick={() => {
            if (hasResult) void handleDownload();
            else void handleConvert();
          }}
          onStartOver={hasResult ? resetTool : undefined}
          startOverLabel="Start over"
          startOverDisabled={isBusy}
        />
      </div>
    </ProToolGate>
  );
}
