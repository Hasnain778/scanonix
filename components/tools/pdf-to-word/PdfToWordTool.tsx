"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProToolGate } from "@/components/plan/ProToolGate";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PdfToWordProgressBanner } from "@/components/tools/pdf-to-word/PdfToWordProgressBanner";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
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

  const convertHint = !uploadedPdf
    ? "Upload a PDF before converting."
    : status === "loading"
      ? "Converting via CloudConvert…"
      : isReading
        ? "Reading PDF…"
        : "Ready to convert this PDF to Word.";

  return (
    <ProToolGate
      toolName="PDF to Word"
      description="Sign in and upgrade to Scanonix Pro to convert PDFs to editable Word documents with CloudConvert."
    >
      <div className="space-y-5 overflow-x-hidden">
        <PdfToWordProgressBanner
          status={isReading ? "loading" : status}
          phase={phase}
          message={isReading ? "Reading PDF…" : statusMessage}
        />

        <ToolWorkspaceShell
          isEmpty={!uploadedPdf}
          empty={
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
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </>
          }
          workArea={
            uploadedPdf ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
                <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                  <div className="flex min-w-0 items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                      <PdfDropIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {uploadedPdf.file.name}
                      </p>
                      <p className="truncate text-[11px] text-scanonix-muted">
                        {formatFileSize(uploadedPdf.file.size)} ·{" "}
                        {uploadedPdf.pageCount} page
                        {uploadedPdf.pageCount === 1 ? "" : "s"} · PDF
                      </p>
                    </div>
                  </div>
                  <div
                    className={`w-full sm:w-auto ${hasResult ? "hidden md:block" : ""}`.trim()}
                  >
                    <ActionButton
                      variant="outline"
                      size="sm"
                      className="w-full rounded-lg sm:w-auto"
                      disabled={isBusy}
                      onClick={resetTool}
                    >
                      {hasResult ? "Start over" : "Upload another"}
                    </ActionButton>
                  </div>
                </div>

                <div className="bg-surface-muted/30 p-4 sm:p-5">
                  <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-border bg-surface px-5 py-8 text-center sm:py-10">
                    <div className="flex h-12 w-12 items-center justify-center rounded-xl border border-border bg-surface-muted text-scanonix-orange">
                      <PdfDropIcon className="h-6 w-6" />
                    </div>
                    <div className="min-w-0 space-y-1">
                      <p className="text-sm font-semibold text-foreground">
                        PDF document
                      </p>
                      <p className="truncate text-sm text-scanonix-muted">
                        {uploadedPdf.file.name}
                      </p>
                      <p className="text-xs text-scanonix-muted">
                        {formatFileSize(uploadedPdf.file.size)} ·{" "}
                        {uploadedPdf.pageCount} page
                        {uploadedPdf.pageCount === 1 ? "" : "s"}
                      </p>
                    </div>
                    <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted/80 px-3 py-1.5 text-xs font-medium text-foreground">
                      <span>PDF</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-scanonix-orange"
                        aria-hidden="true"
                        strokeWidth={2}
                      />
                      <span>DOCX</span>
                    </div>
                  </div>
                </div>
              </div>
            ) : null
          }
          controlPanel={
            uploadedPdf ? (
              hasResult && docxBlob ? (
                <aside
                  aria-label="PDF to Word result"
                  className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)] lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:w-[320px] lg:shrink-0"
                  data-tool-control-panel=""
                >
                  <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3 sm:px-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Result
                      </p>
                      <p className="mt-1 text-sm font-semibold text-green-700">
                        ✓ Word document ready
                      </p>
                    </div>

                    <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-surface-muted/60 text-sm">
                      <div className="min-w-0 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Original</dt>
                        <dd className="mt-0.5 truncate font-semibold text-foreground">
                          {uploadedPdf.file.name}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Original size</dt>
                        <dd className="font-semibold text-foreground">
                          {formatFileSize(uploadedPdf.file.size)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Pages</dt>
                        <dd className="font-semibold text-foreground">
                          {uploadedPdf.pageCount}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Format</dt>
                        <dd className="font-semibold text-foreground">DOCX</dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Output size</dt>
                        <dd className="font-semibold text-foreground">
                          {formatFileSize(docxBlob.size)}
                        </dd>
                      </div>
                      <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-1.5">
                        <dt className="shrink-0 text-scanonix-muted">Filename</dt>
                        <dd className="truncate font-semibold text-foreground">
                          {resultFileName ?? "scanonix-converted.docx"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="hidden shrink-0 border-t border-border bg-surface-raised/80 px-3.5 py-2.5 sm:px-4 md:block">
                    <div className="flex flex-col gap-1.5">
                      <ActionButton
                        size="md"
                        className="w-full whitespace-nowrap"
                        loading={isDownloading}
                        disabled={isBusy || !docxBlob}
                        onClick={() => {
                          void handleDownload();
                        }}
                      >
                        Download Word Document
                      </ActionButton>
                      <ActionButton
                        variant="outline"
                        size="md"
                        className="w-full whitespace-nowrap"
                        disabled={isBusy}
                        onClick={resetTool}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                </aside>
              ) : (
                <ToolControlPanel
                  aria-label="PDF to Word controls"
                  footer={
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] leading-snug text-scanonix-muted">
                        {convertHint}
                      </p>
                      <div className="hidden md:block">
                        <ActionButton
                          size="lg"
                          className="w-full shadow-[var(--shadow-orange-sm)]"
                          loading={status === "loading"}
                          disabled={!uploadedPdf || isBusy}
                          onClick={() => {
                            void handleConvert();
                          }}
                        >
                          {status === "loading"
                            ? "Converting…"
                            : "Convert to Word"}
                        </ActionButton>
                      </div>
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <FileText
                          className="h-4 w-4 text-scanonix-orange"
                          aria-hidden="true"
                          strokeWidth={1.75}
                        />
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                          PDF to Word
                        </p>
                      </div>
                    </div>

                    <div className="border-t border-border/80 pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Format
                      </p>
                      <p className="mt-1.5 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                        <span>PDF</span>
                        <ArrowRight
                          className="h-3.5 w-3.5 text-scanonix-orange"
                          aria-hidden="true"
                          strokeWidth={2}
                        />
                        <span>DOCX</span>
                      </p>
                    </div>

                    <div className="border-t border-border/80 pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Document
                      </p>
                      <dl className="mt-2 space-y-2 text-sm">
                        <div className="min-w-0">
                          <dt className="text-scanonix-muted">Filename</dt>
                          <dd className="mt-0.5 truncate font-medium text-foreground">
                            {uploadedPdf.file.name}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-scanonix-muted">File size</dt>
                          <dd className="font-medium text-foreground">
                            {formatFileSize(uploadedPdf.file.size)}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3">
                          <dt className="text-scanonix-muted">Pages</dt>
                          <dd className="font-medium text-foreground">
                            {uploadedPdf.pageCount}
                          </dd>
                        </div>
                      </dl>
                    </div>

                    <div className="border-t border-border/80 pt-3">
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Conversion
                      </p>
                      <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
                        CloudConvert-backed Word conversion. Complex layouts may
                        still need light editing afterward.
                      </p>
                    </div>

                    <div className="border-t border-border/80 pt-3">
                      <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Privacy
                      </p>
                      <PrivacyNotice message={PRIVACY_MESSAGE} />
                    </div>
                  </div>
                </ToolControlPanel>
              )
            ) : null
          }
        />

        <ToolStickyMobileActionBar
          visible={Boolean(uploadedPdf)}
          phase={resultActionPhase}
          primaryLabel={
            hasResult ? "Download Word Document" : "Convert to Word"
          }
          primaryLoading={
            hasResult ? isDownloading : status === "loading" || isReading
          }
          primaryDisabled={
            hasResult ? isBusy || !docxBlob : !uploadedPdf || isBusy
          }
          showPrimaryOnError
          onPrimaryClick={() => {
            if (hasResult) {
              void handleDownload();
            } else {
              void handleConvert();
            }
          }}
          onStartOver={hasResult ? resetTool : undefined}
          startOverLabel="Start over"
          startOverDisabled={isBusy}
        />
      </div>
    </ProToolGate>
  );
}
