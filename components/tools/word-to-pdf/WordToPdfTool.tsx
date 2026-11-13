"use client";

import { useCallback, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-wave4d.css";
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

  const primaryLabel = hasResult
    ? "Download PDF"
    : isBusy
      ? "Converting…"
      : "Convert to PDF";

  return (
    <div className="ux-wave4d overflow-x-hidden">
      <div className="ux-wave4d-banner">
        <ToolStatusBanner status={status} message={message} />
      </div>

      {!file ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="DOCX"
            toLabel="PDF"
            buttonLabel="Upload a DOCX"
            prompt="Upload or drag a Word document here."
            formats="DOCX"
            accept={ACCEPT_DOCX}
            multiple={false}
            disabled={isBusy}
            validateFile={(candidate) => isDocxFile(candidate) && !isLegacyDocFile(candidate)}
            onInvalidFiles={(files) => {
              const legacy = files.find(isLegacyDocFile);
              if (legacy) {
                setMessage("Legacy .doc files are not supported. Save as .docx in Word and try again.");
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
          <p className="ux-wave4d-note">.docx only — up to 50MB (CloudConvert, plan limit applies)</p>
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>
      ) : (
        <div className="ux-workspace" data-tool-workspace="active">
          <div className="ux-stage">
            <div className="ux-command">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                <p className="mt-0.5 truncate text-xs text-scanonix-muted">{formatFileSize(file.size)}</p>
              </div>
              <div className="ux-command-actions">
                <ActionButton variant="ghost" size="sm" disabled={isBusy} onClick={resetTool}>
                  {hasResult ? "Start over" : "Choose another file"}
                </ActionButton>
                <ActionButton
                  size="lg"
                  className="ux-command-primary"
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
            </div>
            <div className="ux-4d-settings">
              <p className="text-sm leading-relaxed text-foreground">
                {hasResult
                  ? "PDF ready to download."
                  : isBusy
                    ? "Converting via CloudConvert…"
                    : "Converts this DOCX to a PDF on Scanonix servers."}
              </p>
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
