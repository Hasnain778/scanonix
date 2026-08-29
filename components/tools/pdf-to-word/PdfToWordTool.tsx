"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProToolGate } from "@/components/plan/ProToolGate";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PdfToWordProgressBanner } from "@/components/tools/pdf-to-word/PdfToWordProgressBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  createProcessAttempt,
  httpStatusToErrorCode,
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

interface UploadedPdfState {
  file: File;
  pageCount: number;
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

  const handleConvert = async () => {
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
  };

  const handleDownload = async () => {
    const blob = docxBlobRef.current ?? docxBlob;
    if (!blob || isDownloading) return;

    setIsDownloading(true);
    try {
      downloadBlob(blob, resultFileName ?? "scanonix-converted.docx", buildToolDownloadMeta("pdf-to-word", 1));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <ProToolGate
      toolName="PDF to Word"
      description="Sign in and upgrade to Scanonix Pro to convert PDFs to editable Word documents with CloudConvert."
    >
      <div className="space-y-8">
        <PdfToWordProgressBanner
          status={isReading ? "loading" : status}
          phase={phase}
          message={isReading ? "Reading PDF…" : statusMessage}
        />

        {!uploadedPdf && (
          <>
            <FileDropZone
              onFilesSelected={handleUpload}
              accept={ACCEPTED_PDF_EXTENSIONS}
              validateFile={isAcceptedPdfFile}
              multiple={false}
              disabled={isBusy}
              label="Drop a PDF file here to convert"
              hint="or click to browse — Pro feature, server-side conversion"
              icon={<PdfDropIcon />}
            />
            <PrivacyNotice message="Your PDF is converted on Scanonix servers via CloudConvert and deleted after processing." />
          </>
        )}

        {uploadedPdf && (
          <>
            <div className="flex flex-col gap-4 rounded-2xl border border-border bg-surface p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl border border-border bg-surface-muted text-scanonix-orange">
                  <PdfDropIcon />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-foreground">
                    {uploadedPdf.file.name}
                  </p>
                  <p className="mt-1 text-sm text-foreground-muted">
                    {formatFileSize(uploadedPdf.file.size)} ·{" "}
                    {uploadedPdf.pageCount} page
                    {uploadedPdf.pageCount === 1 ? "" : "s"}
                  </p>
                </div>
              </div>
              {!docxBlob && (
                <ActionButton
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={isBusy}
                  onClick={resetTool}
                >
                  Start over
                </ActionButton>
              )}
            </div>

            <div className="rounded-xl border border-border bg-surface-muted px-4 py-3 text-sm text-foreground-muted">
              <p>
                Conversion uses CloudConvert for high-fidelity PDF→Word output.
                Complex layouts may still need light editing afterward.
              </p>
            </div>

            {docxBlob && status === "success" && (
              <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
                <h2 className="mb-2 text-lg font-semibold text-foreground">Results</h2>
                <p className="text-sm text-foreground-muted">
                  Output size: {formatFileSize(docxBlob.size)}
                </p>

                <div className="mt-5 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                  <ActionButton
                    size="lg"
                    className="w-full sm:w-auto"
                    loading={isDownloading}
                    disabled={isBusy || !docxBlob}
                    onClick={handleDownload}
                  >
                    Download Word Document
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="lg"
                    className="w-full sm:w-auto"
                    disabled={isBusy}
                    onClick={resetTool}
                  >
                    Start over
                  </ActionButton>
                </div>
              </div>
            )}

            <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
              <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
                <ActionButton
                  size="lg"
                  className="w-full sm:w-auto"
                  loading={status === "loading"}
                  disabled={isBusy}
                  onClick={handleConvert}
                >
                  {status === "loading" ? "Converting…" : "Convert to Word"}
                </ActionButton>
              </div>

              <div className="mt-4 border-t border-scanonix-border pt-4">
                <PrivacyNotice message="Your PDF is converted on Scanonix servers via CloudConvert and deleted after processing." />
              </div>
            </div>
          </>
        )}

        <ToolStickyMobileActionBar
          visible={Boolean(docxBlob && status === "success")}
          primaryLabel="Download Word Document"
          primaryLoading={isDownloading}
          primaryDisabled={isBusy}
          onPrimaryClick={handleDownload}
          secondaryLabel="Start over"
          onSecondaryClick={resetTool}
          secondaryDisabled={isBusy}
        />
      </div>
    </ProToolGate>
  );
}
