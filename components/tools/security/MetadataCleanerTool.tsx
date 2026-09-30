"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { Eraser } from "lucide-react";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";
import "@/styles/simple-document-action-premium.css";
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

function MetadataAccessNote({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="max-w-[36rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
        Pro required
      </p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        Metadata cleaning is available with Scanonix Pro.
      </p>
      <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-2">
        {isAuthenticated ? (
          <CheckoutButton
            plan="pro"
            interval="monthly"
            label="Upgrade to Pro"
            sourceSurface={ANALYTICS_SURFACES.SECURITY_GATE}
          />
        ) : (
          <Link
            href="/login"
            className="inline-flex items-center rounded-lg border border-border px-3 py-1.5 text-sm font-semibold text-foreground transition hover:border-scanonix-orange/45"
          >
            Sign in
          </Link>
        )}
        <Link
          href="/pricing"
          onClick={() => {
            trackEvent("upgrade_click", {
              source_surface: ANALYTICS_SURFACES.SECURITY_GATE,
              tier: "pro",
              tool_slug: "metadata-cleaner",
            });
          }}
          className="text-sm font-medium text-foreground-secondary transition hover:text-foreground"
        >
          View Pro
        </Link>
      </div>
    </div>
  );
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
      gate="none"
    >
      {({ isPro, showGate, isAuthenticated }) => {
        const stickyVisible = Boolean(file) && isPro;
        const primaryLabel = showGate
          ? "Upgrade to Pro to clean metadata"
          : isBusy
            ? "Removing metadata\u2026"
            : hasResult
              ? "Clean again"
              : "Remove metadata";

        return (
          <div className="simple-document-action-premium space-y-5 overflow-x-hidden">
            <ToolStatusBanner status={status} message={message} />

            <ToolWorkspaceShell
              isEmpty={!file}
              empty={
                <>
                  <FileDropZone
                    className="simple-doc-drop"
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
                  <div className="simple-doc-privacy">
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </div>
                  {showGate ? (
                    <MetadataAccessNote isAuthenticated={isAuthenticated} />
                  ) : null}
                </>
              }
              workArea={
                file ? (
                  <div className="simple-doc-block w-full lg:max-w-[36rem]">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center text-scanonix-orange">
                          <MetadataDropIcon className="h-4 w-4" />
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
                      Removes hidden EXIF and PDF metadata. File content is preserved.
                    </p>

                    <div className={stickyVisible ? "mt-5 hidden lg:block" : "mt-5"}>
                      <ActionButton
                        size="lg"
                        className="h-12 w-full shadow-[var(--shadow-orange-sm)]"
                        onClick={() => {
                          void handleClean();
                        }}
                        disabled={!file || showGate || !isPro || status === "loading"}
                        loading={status === "loading"}
                      >
                        {primaryLabel}
                      </ActionButton>
                    </div>

                    {showGate ? (
                      <div className="mt-5">
                        <MetadataAccessNote isAuthenticated={isAuthenticated} />
                      </div>
                    ) : null}

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
              primaryLabel={
                isBusy ? "Removing metadata\u2026" : hasResult ? "Clean again" : "Remove metadata"
              }
              primaryLoading={isBusy}
              primaryDisabled={!file || showGate || !isPro || isBusy}
              showPrimaryOnError
              onPrimaryClick={() => {
                void handleClean();
              }}
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
