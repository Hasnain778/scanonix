"use client";

import { useCallback, useMemo, useState } from "react";
import { Eraser, Shield } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import { submitSecurityToolForm } from "@/lib/security-tools/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { ToolStatus } from "@/lib/tools/types";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

const ACCEPTED = [
  ".pdf",
  ".jpg",
  ".jpeg",
  ".png",
  ".webp",
  ".heic",
  ".heif",
  ".tiff",
  ".tif",
];

const PRIVACY_MESSAGE =
  "Files are uploaded to Scanonix for metadata cleaning and deleted after processing. File content is preserved.";

const GATE_DESCRIPTION =
  "Remove hidden EXIF and PDF metadata from files. Upgrade to Pro to clean and download.";

function MetadataDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <Eraser className={className} aria-hidden="true" strokeWidth={1.75} />;
}

export function MetadataCleanerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const isBusy = status === "loading";
  const hasResult = status === "success";

  const resetTool = useCallback(() => {
    setFile(null);
    setStatus("idle");
    setMessage(undefined);
  }, []);

  const handleClean = useCallback(async () => {
    if (!file) return;

    const attempt = createProcessAttempt("metadata-cleaner");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage(undefined);

    const formData = new FormData();
    formData.append("file", file);

    const result = await submitSecurityToolForm(
      "/api/tools/security/metadata-cleaner",
      formData,
    );

    if (!result.ok) {
      attempt.error(planErrorMessageToCode(result.message));
      setStatus("error");
      setMessage(result.message);
      return;
    }

    downloadBlob(
      result.blob,
      result.fileName,
      buildToolDownloadMeta("metadata-cleaner", 1),
    );
    attempt.success(1);
    setStatus("success");
    setMessage("Metadata removed. File content preserved.");
  }, [file]);

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

  return (
    <SecurityToolWorkspace
      toolName="Metadata Cleaner"
      gateDescription={GATE_DESCRIPTION}
    >
      {({ isPro, showGate }) => {
        const stickyVisible = Boolean(file) && isPro;
        const primaryLabel = showGate
          ? "Upgrade to Pro to clean metadata"
          : isBusy
            ? "Removing metadata…"
            : hasResult
              ? "Clean again"
              : "Remove metadata";
        const cleanHint = showGate
          ? "Upgrade to Pro to remove metadata and download a cleaned file."
          : hasResult
            ? "Metadata removed. Run again or choose another file."
            : "Removes hidden EXIF and PDF metadata. File content is preserved.";

        return (
          <div className="space-y-5 overflow-x-hidden">
            <ToolStatusBanner status={status} message={message} />

            <ToolWorkspaceShell
              isEmpty={!file}
              empty={
                <>
                  <FileDropZone
                    accept={ACCEPTED.join(",")}
                    onFilesSelected={(files) => {
                      if (files[0]) {
                        setFile(files[0]);
                        setStatus("idle");
                        setMessage(undefined);
                      }
                    }}
                    disabled={false}
                    label="Drop a PDF or image to clean"
                    hint="PDF, JPG, PNG, WEBP, HEIC, or TIFF"
                    icon={<MetadataDropIcon />}
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
                          <MetadataDropIcon className="h-4 w-4" />
                        </div>
                        <div className="min-w-0">
                          <p className="truncate text-sm font-semibold text-foreground">
                            {file.name}
                          </p>
                          <p className="truncate text-[11px] text-scanonix-muted">
                            {formatFileSize(file.size)}
                          </p>
                        </div>
                      </div>
                      <div
                        className={
                          stickyVisible
                            ? "hidden w-full sm:w-auto md:block"
                            : "w-full sm:w-auto"
                        }
                      >
                        <ActionButton
                          variant="outline"
                          size="sm"
                          className="w-full rounded-lg sm:w-auto"
                          disabled={isBusy}
                          onClick={resetTool}
                        >
                          {hasResult ? "Start over" : "Choose another file"}
                        </ActionButton>
                      </div>
                    </div>

                    <div className="space-y-3 bg-surface-muted/30 p-3 sm:p-4">
                      <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
                        <p className="text-sm font-semibold text-foreground">
                          {hasResult
                            ? "Cleaned file downloaded"
                            : "Ready to remove metadata"}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-scanonix-muted">
                          {hasResult
                            ? "Your download should have started. You can clean this file again or choose another."
                            : "Hidden EXIF and PDF document metadata will be stripped. Visible file content stays intact."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null
              }
              controlPanel={
                file ? (
                  <ToolControlPanel
                    aria-label="Metadata Cleaner controls"
                    footer={
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] leading-snug text-scanonix-muted">
                          {cleanHint}
                        </p>
                        <div
                          className={
                            stickyVisible ? "hidden md:block" : undefined
                          }
                        >
                          <ActionButton
                            size="lg"
                            className="w-full shadow-[var(--shadow-orange-sm)]"
                            onClick={() => {
                              void handleClean();
                            }}
                            disabled={
                              !file || showGate || !isPro || status === "loading"
                            }
                            loading={status === "loading"}
                          >
                            {primaryLabel}
                          </ActionButton>
                        </div>
                        {!stickyVisible ? null : (
                          <div className="hidden md:block">
                            <ActionButton
                              variant="outline"
                              size="lg"
                              className="w-full"
                              disabled={isBusy}
                              onClick={resetTool}
                            >
                              {hasResult ? "Start over" : "Choose another file"}
                            </ActionButton>
                          </div>
                        )}
                      </div>
                    }
                  >
                    <div className="space-y-4">
                      <div>
                        <div className="flex items-center gap-2">
                          <Shield
                            className="h-4 w-4 text-scanonix-orange"
                            aria-hidden="true"
                            strokeWidth={1.75}
                          />
                          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                            Metadata Cleaner
                          </p>
                        </div>
                        <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
                          Strip hidden EXIF and PDF metadata before you share a
                          file.
                        </p>
                      </div>

                      <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                        <div className="min-w-0 px-3 py-2.5">
                          <dt className="text-scanonix-muted">Selected file</dt>
                          <dd className="mt-0.5 truncate font-semibold text-foreground">
                            {file.name}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3 px-3 py-2.5">
                          <dt className="text-scanonix-muted">Size</dt>
                          <dd className="font-semibold text-foreground">
                            {formatFileSize(file.size)}
                          </dd>
                        </div>
                        <div className="px-3 py-2.5">
                          <dt className="text-scanonix-muted">Removes</dt>
                          <dd className="mt-0.5 text-foreground">
                            Hidden EXIF and PDF metadata
                          </dd>
                        </div>
                      </dl>

                      <div className="border-t border-border/80 pt-3">
                        <PrivacyNotice message={PRIVACY_MESSAGE} />
                      </div>
                    </div>
                  </ToolControlPanel>
                ) : null
              }
            />

            <ToolStickyMobileActionBar
              visible={stickyVisible}
              phase={resultActionPhase}
              primaryLabel={
                isBusy
                  ? "Removing metadata…"
                  : hasResult
                    ? "Clean again"
                    : "Remove metadata"
              }
              primaryLoading={isBusy}
              primaryDisabled={!file || showGate || !isPro || isBusy}
              showPrimaryOnError
              onPrimaryClick={() => {
                void handleClean();
              }}
              secondaryLabel={
                resultActionPhase === "ready" || resultActionPhase === "error"
                  ? "Choose another file"
                  : undefined
              }
              onSecondaryClick={
                resultActionPhase === "ready" || resultActionPhase === "error"
                  ? resetTool
                  : undefined
              }
              secondaryDisabled={isBusy}
              onStartOver={hasResult ? resetTool : undefined}
              startOverLabel="Start over"
              startOverDisabled={isBusy}
            />
          </div>
        );
      }}
    </SecurityToolWorkspace>
  );
}
