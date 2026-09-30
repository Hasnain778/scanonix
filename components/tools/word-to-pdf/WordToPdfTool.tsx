"use client";

import { useCallback, useMemo, useState } from "react";
import { FileText } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import "@/styles/simple-document-action-premium.css";
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

  const stickyVisible = Boolean(file);
  const primaryLabel = hasResult
    ? "Download PDF"
    : isBusy
      ? "Converting\u2026"
      : "Convert to PDF";

  return (
    <div className="simple-document-action-premium space-y-5 overflow-x-hidden">
      <ToolStatusBanner status={status} message={message} />

      <ToolWorkspaceShell
        isEmpty={!file}
        empty={
          <>
            <FileDropZone
              className="simple-doc-drop"
              accept={ACCEPT_DOCX}
              multiple={false}
              icon={<WordDropIcon />}
              label="Drop your Word document here"
              hint=".docx only \u2014 up to 50MB (CloudConvert, plan limit applies)"
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
            <div className="simple-doc-privacy">
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </>
        }
        workArea={
          file ? (
            <div className="simple-doc-block w-full lg:max-w-[36rem]">
              <div className="flex items-center justify-between gap-3">
                <div className="flex min-w-0 items-center gap-3">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center text-scanonix-orange">
                    <WordDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {file.name}
                    </p>
                    <p className="truncate text-xs text-scanonix-muted">
                      {formatFileSize(file.size)}
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
                  ? "PDF ready to download."
                  : isBusy
                    ? "Converting via CloudConvert\u2026"
                    : "Converts this DOCX to a PDF on Scanonix servers."}
              </p>

              <div className={stickyVisible ? "mt-5 hidden lg:block" : "mt-5"}>
                <ActionButton
                  size="lg"
                  className="h-12 w-full shadow-[var(--shadow-orange-sm)]"
                  loading={hasResult ? false : isBusy}
                  disabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
                  onClick={() => {
                    if (hasResult) handleDownload();
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
        primaryLoading={!hasResult && isBusy}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => {
          if (hasResult) handleDownload();
          else void handleConvert();
        }}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
