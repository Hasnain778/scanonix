"use client";

import { useCallback, useState } from "react";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProBadge } from "@/components/ui/ProBadge";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { useProAccess } from "@/hooks/useProAccess";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-wave4d.css";
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

function MetadataAccessNote({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="max-w-[36rem]">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
        Pro required
        <ProBadge />
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

  const { loading, isAuthenticated, isPro } = useProAccess();
  const showGate = !isPro;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-foreground-muted">
        Loading security workspace…
      </div>
    );
  }

  const primaryLabel = showGate
          ? "Upgrade to Pro to clean metadata"
          : isBusy
            ? "Removing metadata…"
            : hasResult
              ? "Clean again"
              : "Remove metadata";

        return (
          <div className="ux-wave4d overflow-x-hidden">
            <div className="ux-wave4d-banner">
              <ToolStatusBanner status={status} message={message} />
            </div>

            {!file ? (
              <div data-tool-workspace="empty">
                <PremiumFileSelect
                  fromLabel="File"
                  toLabel="Clean"
                  buttonLabel="Upload a file"
                  prompt="Upload or drag a PDF or image here."
                  formats="PDF, JPG, PNG, WEBP, HEIC, TIFF"
                  accept={ACCEPTED.join(",")}
                  multiple={false}
                  onFilesSelected={(files) => {
                    if (files[0]) {
                      setFile(files[0]);
                      setStatus("idle");
                      setMessage(undefined);
                    }
                  }}
                />
                <p className="ux-wave4d-note">PDF, JPG, PNG, WEBP, HEIC, or TIFF</p>
                <PrivacyNotice message={PRIVACY_MESSAGE} />
                {showGate ? (
                  <div className="ux-wave4d-gate">
                    <MetadataAccessNote isAuthenticated={isAuthenticated} />
                  </div>
                ) : null}
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
                        onClick={() => {
                          void handleClean();
                        }}
                        disabled={!file || showGate || !isPro || status === "loading"}
                        loading={status === "loading"}
                      >
                        {primaryLabel}
                      </ActionButton>
                    </div>
                  </div>

                  <div className="ux-4d-settings">
                    <p className="text-sm leading-relaxed text-foreground">
                      Removes hidden EXIF and PDF metadata. File content is preserved.
                    </p>
                    {showGate ? <MetadataAccessNote isAuthenticated={isAuthenticated} /> : null}
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </div>
                </div>
              </div>
            )}
          </div>
  );
}
