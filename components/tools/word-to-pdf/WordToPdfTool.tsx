"use client";

import { useCallback, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { submitWordToPdfForm } from "@/lib/tools/document-conversion/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { ToolStatus } from "@/lib/tools/types";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

const ACCEPT_DOCX = ".docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

function isDocxFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return (
    name.endsWith(".docx") ||
    file.type === "application/vnd.openxmlformats-officedocument.wordprocessingml.document"
  );
}

function isLegacyDocFile(file: File): boolean {
  const name = file.name.toLowerCase();
  return name.endsWith(".doc") || file.type === "application/msword";
}

function WordIcon() {
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
    </svg>
  );
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
    downloadBlob(resultBlob, resultFileName ?? "document.pdf", buildToolDownloadMeta("word-to-pdf", 1));
  }, [resultBlob, resultFileName]);

  const resetTool = useCallback(() => {
    setFile(null);
    setResultBlob(null);
    setResultFileName(undefined);
    setStatus("idle");
    setMessage(undefined);
  }, []);

  return (
    <div className="space-y-6">
      {!hasResult ? (
        <>
          <FileDropZone
            accept={ACCEPT_DOCX}
            multiple={false}
            icon={<WordIcon />}
            label="Drop your Word document here"
            hint=".docx only — up to 50MB (CloudConvert, plan limit applies)"
            disabled={isBusy}
            validateFile={(candidate) => isDocxFile(candidate) && !isLegacyDocFile(candidate)}
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
                setStatus("idle");
                setMessage(undefined);
              }
            }}
          />

          {file ? (
            <div className="rounded-xl border border-scanonix-border bg-black/30 px-4 py-3 text-sm text-scanonix-muted">
              Selected: <span className="font-medium text-white">{file.name}</span>
              <span className="mx-2 text-scanonix-muted/50">·</span>
              {formatFileSize(file.size)}
            </div>
          ) : null}

          <ToolStatusBanner status={status} message={message} />

          <div className="hidden sm:block">
            <ActionButton
              size="lg"
              loading={isBusy}
              disabled={!file || isBusy}
              onClick={() => void handleConvert()}
            >
              Convert to PDF
            </ActionButton>
          </div>
        </>
      ) : (
        <ToolResultsPanel
          title="Your PDF is ready"
          primaryLabel="Download PDF"
          onPrimaryClick={handleDownload}
          onStartOver={resetTool}
        >
          {message ? <p className="mb-3 text-sm text-green-400">{message}</p> : null}
          {resultBlob ? (
            <p className="text-sm text-scanonix-muted">
              Output size: <span className="text-white">{formatFileSize(resultBlob.size)}</span>
            </p>
          ) : null}
        </ToolResultsPanel>
      )}

      <PrivacyNotice message="Your document is converted on Scanonix servers via CloudConvert and deleted after processing." />

      <ToolStickyMobileActionBar
        visible={Boolean(file) && !hasResult}
        primaryLabel="Convert to PDF"
        primaryLoading={isBusy}
        primaryDisabled={!file || isBusy}
        onPrimaryClick={() => void handleConvert()}
      />
    </div>
  );
}
