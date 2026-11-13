"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProToolGate } from "@/components/plan/ProToolGate";
import { PdfToWordProgressBanner } from "@/components/tools/pdf-to-word/PdfToWordProgressBanner";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-wave4e.css";
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

  const primaryLabel = hasResult
    ? "Download Word Document"
    : status === "loading" || isReading
      ? isReading
        ? "Reading PDF…"
        : "Converting…"
      : "Convert to Word";

  return (
    <ProToolGate
      toolName="PDF to Word"
      description="Sign in and upgrade to Scanonix Pro to convert PDFs to editable Word documents with CloudConvert."
    >
      <div className="ux-wave4e overflow-x-hidden">
        <div className="ux-wave4e-banner">
          <PdfToWordProgressBanner
            status={isReading ? "loading" : status}
            phase={phase}
            message={isReading ? "Reading PDF…" : statusMessage}
          />
        </div>

        {!uploadedPdf ? (
          <div data-tool-workspace="empty">
            <PremiumFileSelect
              fromLabel="PDF"
              toLabel="Word"
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
            <p className="ux-wave4e-note">Pro feature · Server-side conversion</p>
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </div>
        ) : (
          <div className="ux-workspace" data-tool-workspace="active">
            <div className="ux-stage">
              <div className="ux-command">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">{uploadedPdf.file.name}</p>
                  <p className="mt-0.5 truncate text-xs text-scanonix-muted">
                    {formatFileSize(uploadedPdf.file.size)} · {uploadedPdf.pageCount} page
                    {uploadedPdf.pageCount === 1 ? "" : "s"}
                  </p>
                </div>
                <div className="ux-command-actions">
                  <ActionButton variant="ghost" size="sm" disabled={isBusy} onClick={resetTool}>
                    {hasResult ? "Start over" : "Choose another file"}
                  </ActionButton>
                  <ActionButton
                    size="lg"
                    className="ux-command-primary"
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
              </div>
              <div className="ux-4e-copy">
                <p className="text-sm leading-relaxed text-foreground">
                  {hasResult
                    ? "Word document ready to download."
                    : status === "loading"
                      ? "Converting via CloudConvert…"
                      : isReading
                        ? "Reading PDF…"
                        : "Converts this PDF to an editable DOCX on Scanonix servers. Complex layouts may still need light editing afterward."}
                </p>
                <div className="mt-4">
                  <PrivacyNotice message={PRIVACY_MESSAGE} />
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </ProToolGate>
  );
}
