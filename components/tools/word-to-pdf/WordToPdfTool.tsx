"use client";

import { useCallback, useMemo, useState } from "react";
import { ArrowRight, FileText } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { submitWordToPdfForm } from "@/lib/tools/document-conversion/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { ToolStatus } from "@/lib/tools/types";

const ACCEPT_DOCX =
  ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PRIVACY_MESSAGE =
  "Your document is converted on Scanonix servers via CloudConvert and deleted after processing.";

function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".docx") ||
    file.type ===
      "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isLegacyDocFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".doc") || file.type === "application/msword";
}

function WordDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <FileText className={className} aria-hidden="true" strokeWidth={1.75} />;
}

export function WordToPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState<string>();
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const isBusy = status === "loading";
  const hasResult = status === "success" && resultBlob !== null;

  const handleConvert = useCallback(async () => {
    if (!file) return;

    const attempt = createProcessAttempt("word-to-pdf");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage(undefined);
    setResultBlob(null);

    const formData = new FormData();
    formData.append("file", file);

    const result = await submitWordToPdfForm(formData);
    if (!result.ok) {
      attempt.error(planErrorMessageToCode(result.message));
      setStatus("error");
      setMessage(result.message);
      return;
    }

    setResultBlob(result.blob);
    setResultFileName(result.fileName);
    attempt.success(1);
    setStatus("success");
    setMessage("PDF ready to download.");
  }, [file]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "document.pdf",
      buildToolDownloadMeta("word-to-pdf", 1),
    );
  }, [resultBlob, resultFileName]);

  const resetTool = useCallback(() => {
    setFile(null);
    setResultBlob(null);
    setResultFileName(undefined);
    setStatus("idle");
    setMessage(undefined);
  }, []);

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

  const convertHint = !file
    ? "Upload a Word document before converting."
    : isBusy
      ? "Converting via CloudConvert…"
      : "Ready to convert this DOCX to PDF.";

  return (
    <div className="space-y-5 overflow-x-hidden">
      <ToolStatusBanner status={status} message={message} />

      <ToolWorkspaceShell
        isEmpty={!file}
        empty={
          <>
            <FileDropZone
              accept={ACCEPT_DOCX}
              multiple={false}
              icon={<WordDropIcon />}
              label="Drop your Word document here"
              hint=".docx only — up to 50MB (CloudConvert, plan limit applies)"
              disabled={isBusy}
              validateFile={(candidate) =>
                isDocxFile(candidate) && !isLegacyDocFile(candidate)
              }
              onInvalidFiles={(files) => {
                const legacy = files.find(isLegacyDocFile);
                if (legacy) {
                  setMessage(
                    "Legacy .doc files are not supported. Save as .docx in Word and try again.",
                  );
                  setStatus("error");
                  return;
                }
                setMessage("Only .docx Word documents are supported.");
                setStatus("error");
              }}
              onFilesSelected={(files) => {
                const docx = files[0];
                if (docx) {
                  setFile(docx);
                  setResultBlob(null);
                  setResultFileName(undefined);
                  setStatus("idle");
                  setMessage(undefined);
                }
              }}
            />
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </>
        }
        workArea={
          file ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <WordDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(file.size)} · DOCX
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
                    <WordDropIcon className="h-6 w-6" />
                  </div>
                  <div className="min-w-0 space-y-1">
                    <p className="text-sm font-semibold text-foreground">
                      Word document
                    </p>
                    <p className="truncate text-sm text-scanonix-muted">
                      {file.name}
                    </p>
                    <p className="text-xs text-scanonix-muted">
                      {formatFileSize(file.size)}
                    </p>
                  </div>
                  <div className="inline-flex items-center gap-2 rounded-lg border border-border bg-surface-muted/80 px-3 py-1.5 text-xs font-medium text-foreground">
                    <span>DOCX</span>
                    <ArrowRight
                      className="h-3.5 w-3.5 text-scanonix-orange"
                      aria-hidden="true"
                      strokeWidth={2}
                    />
                    <span>PDF</span>
                  </div>
                </div>
              </div>
            </div>
          ) : null
        }
        controlPanel={
          file ? (
            hasResult && resultBlob ? (
              <aside
                aria-label="Word to PDF result"
                className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)] lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:w-[320px] lg:shrink-0"
                data-tool-control-panel=""
              >
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3 sm:px-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      ✓ PDF ready
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-surface-muted/60 text-sm">
                    <div className="min-w-0 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Original</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        {file.name}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Original size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(file.size)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Format</dt>
                      <dd className="font-semibold text-foreground">PDF</dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Output size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(resultBlob.size)}
                      </dd>
                    </div>
                    <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-1.5">
                      <dt className="shrink-0 text-scanonix-muted">Filename</dt>
                      <dd className="truncate font-semibold text-foreground">
                        {resultFileName ?? "document.pdf"}
                      </dd>
                    </div>
                  </dl>
                </div>

                <div className="hidden shrink-0 border-t border-border bg-surface-raised/80 px-3.5 py-2.5 sm:px-4 md:block">
                  <div className="flex flex-col gap-1.5">
                    <ActionButton
                      size="md"
                      className="w-full whitespace-nowrap"
                      disabled={isBusy}
                      onClick={handleDownload}
                    >
                      Download PDF
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
                aria-label="Word to PDF controls"
                footer={
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {convertHint}
                    </p>
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isBusy}
                        disabled={!file || isBusy}
                        onClick={() => {
                          void handleConvert();
                        }}
                      >
                        {isBusy ? "Converting…" : "Convert to PDF"}
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
                        Word to PDF
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/80 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Format
                    </p>
                    <p className="mt-1.5 inline-flex items-center gap-2 text-sm font-medium text-foreground">
                      <span>DOCX</span>
                      <ArrowRight
                        className="h-3.5 w-3.5 text-scanonix-orange"
                        aria-hidden="true"
                        strokeWidth={2}
                      />
                      <span>PDF</span>
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
                          {file.name}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-scanonix-muted">File size</dt>
                        <dd className="font-medium text-foreground">
                          {formatFileSize(file.size)}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="border-t border-border/80 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Conversion
                    </p>
                    <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
                      CloudConvert-backed PDF conversion
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
        visible={Boolean(file)}
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download PDF" : "Convert to PDF"}
        primaryLoading={!hasResult && isBusy}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => {
          if (hasResult) {
            handleDownload();
          } else {
            void handleConvert();
          }
        }}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
