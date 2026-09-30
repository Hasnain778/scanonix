"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { KeyRound } from "lucide-react";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import {
  UNLOCK_PDF_PRIVACY_COPY,
  UNLOCK_PDF_SUCCESS,
} from "@/lib/security-tools/pdf/unlock-constants";
import type { UnlockPdfErrorCode } from "@/lib/security-tools/pdf/unlock";
import { downloadBlob } from "@/lib/tools/download";
import {
  detectExistingDigitalSignatures,
  DIGITAL_SIGNATURE_WARNING,
} from "@/lib/tools/fill-pdf";
import { formatFileSize } from "@/lib/tools/format-utils";
import { isAcceptedPdfFile } from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import {
  createProcessAttempt,
  httpStatusToErrorCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";

function UnlockAccessNote({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="max-w-[36rem]">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
        Pro required
      </p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        Unlocking protected PDFs is available with Scanonix Pro.
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
              tool_slug: "unlock-pdf",
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

function PasswordField({
  value,
  onChange,
  visible,
  disabled,
}: {
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">PDF password</span>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-field"
        autoComplete="current-password"
        disabled={disabled}
      />
    </label>
  );
}

function unlockErrorMessage(code: UnlockPdfErrorCode | undefined, fallback: string): string {
  switch (code) {
    case "NOT_ENCRYPTED":
      return "This PDF is not password-protected.";
    case "INCORRECT_PASSWORD":
      return "Incorrect password. Enter the current PDF password to unlock.";
    case "UNSUPPORTED_ENCRYPTION":
      return "This PDF uses an encryption type that cannot be unlocked here.";
    case "CORRUPT_PDF":
      return "The uploaded file is not a valid PDF.";
    case "DECRYPTION_FAILED":
      return "Could not unlock this PDF. Check the password and try again.";
    default:
      return fallback;
  }
}

function UnlockDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <KeyRound className={className} aria-hidden="true" strokeWidth={1.75} />;
}

export function UnlockPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingSignatures, setHasExistingSignatures] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const isBusy = status === "loading";
  const hasResult = status === "success";

  const resetTool = useCallback(() => {
    setFile(null);
    setPassword("");
    setShowPassword(false);
    setHasExistingSignatures(false);
    setStatus("idle");
    setMessage(undefined);
  }, []);

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setPassword("");
    setShowPassword(false);
    setStatus("idle");
    setMessage(undefined);

    try {
      const bytes = new Uint8Array(await selectedFile.arrayBuffer());
      setHasExistingSignatures(detectExistingDigitalSignatures(bytes));
    } catch {
      setHasExistingSignatures(false);
    }
  }, []);

  const handleUnlock = useCallback(async () => {
    if (!file) return;

    const attempt = createProcessAttempt("unlock-pdf");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage(undefined);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    const response = await fetch("/api/tools/security/unlock-pdf", {
      method: "POST",
      body: formData,
    });

    if (!response.ok) {
      let errorMessage = "Could not unlock PDF.";
      try {
        const data = (await response.json()) as { error?: string; code?: UnlockPdfErrorCode };
        errorMessage = unlockErrorMessage(data.code, data.error ?? errorMessage);
      } catch {
        errorMessage = response.statusText || errorMessage;
      }

      setStatus("error");
      setMessage(errorMessage);
      attempt.error(httpStatusToErrorCode(response.status));
      return;
    }

    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match?.[1] ?? "document-unlocked.pdf";
    const blob = await response.blob();

    downloadBlob(blob, fileName, buildToolDownloadMeta("unlock-pdf", 1));
    attempt.success(1);
    setStatus("success");
    setMessage(`${UNLOCK_PDF_SUCCESS} Password was not stored.`);
  }, [file, password]);

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

  return (
    <SecurityToolWorkspace toolName="Unlock PDF" gate="none">
      {({ isPro, showGate, isAuthenticated }) => {
        const stickyVisible = Boolean(file) && isPro;
        const canUnlock = Boolean(file) && isPro && !showGate && !isBusy;
        const primaryLabel = showGate
          ? "Upgrade to Pro to unlock"
          : isBusy
            ? "Unlocking…"
            : hasResult
              ? "Unlock again"
              : "Unlock PDF";
        const unlockHint = showGate
          ? "Upgrade to Pro to remove password protection and download."
          : hasResult
            ? "Unlocked file downloaded. Unlock again or start over."
            : "Remove password protection using its current password. Scanonix does not attempt password cracking.";

        return (
          <div className="unlock-pdf-prototype space-y-5 overflow-x-hidden">
            <ToolStatusBanner status={status} message={message} />

            <ToolWorkspaceShell
              isEmpty={!file}
              empty={
                <>
                  <FileDropZone
                    accept={ACCEPTED_PDF_EXTENSIONS}
                    onFilesSelected={(files) => {
                      const pdf = files.find(isAcceptedPdfFile);
                      if (pdf) {
                        void handleFileSelected(pdf);
                      }
                    }}
                    disabled={false}
                    label="Drop a password-protected PDF"
                    hint="Drop a PDF file or click to browse"
                    icon={<UnlockDropIcon />}
                    validateFile={isAcceptedPdfFile}
                    className="unlock-drop"
                  />
                  <div className="unlock-privacy">
                    <PrivacyNotice message={UNLOCK_PDF_PRIVACY_COPY} />
                  </div>
                  {showGate ? (
                    <UnlockAccessNote isAuthenticated={isAuthenticated} />
                  ) : null}
                </>
              }
              workArea={
                file ? (
                  <div className="w-full lg:max-w-[36rem]">
                    <div className="flex flex-col gap-2.5 sm:flex-row sm:items-center sm:justify-between">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-scanonix-orange/10 text-scanonix-orange">
                          <UnlockDropIcon className="h-4 w-4" />
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
                      <div className={stickyVisible ? "hidden lg:block" : undefined}>
                        <ActionButton
                          variant="outline"
                          size="sm"
                          className="w-full rounded-lg sm:w-auto"
                          disabled={isBusy}
                          onClick={resetTool}
                        >
                          {hasResult ? "Start over" : "Choose another PDF"}
                        </ActionButton>
                      </div>
                    </div>

                    {hasExistingSignatures ? (
                      <div className="mt-3 rounded-lg bg-amber-500/10 px-3.5 py-2.5">
                        <p className="text-sm text-foreground">
                          {DIGITAL_SIGNATURE_WARNING}
                        </p>
                        <p className="mt-1 text-xs text-scanonix-muted">
                          Unlocking rewrites the PDF and may invalidate existing
                          signatures.
                        </p>
                      </div>
                    ) : null}

                    <div className="mt-3 space-y-3 rounded-xl bg-surface-strong p-3.5 sm:p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-medium text-foreground">
                          Document password
                        </p>
                        <button
                          type="button"
                          className="unlock-visibility shrink-0 rounded-lg px-2.5 py-1 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground disabled:opacity-50"
                          aria-pressed={showPassword}
                          aria-label={showPassword ? "Hide password" : "Show password"}
                          disabled={isBusy}
                          onClick={() => setShowPassword((current) => !current)}
                        >
                          {showPassword ? "Hide" : "Show"}
                        </button>
                      </div>
                      <PasswordField
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        disabled={isBusy}
                      />
                      {hasResult ? (
                        <div>
                          <p className="text-sm font-semibold text-foreground">
                            Unlocked PDF downloaded
                          </p>
                          <p className="mt-1 text-xs leading-snug text-scanonix-muted">
                            Your download should have started. Unlock again with
                            the same password or start over.
                          </p>
                        </div>
                      ) : null}
                      <div className="unlock-privacy">
                        <PrivacyNotice message={UNLOCK_PDF_PRIVACY_COPY} />
                      </div>
                    </div>

                    <div className="mt-3 flex flex-col gap-2">
                      <p className="text-[11px] leading-snug text-scanonix-muted">
                        {unlockHint}
                      </p>
                      <div className={stickyVisible ? "hidden lg:block" : undefined}>
                        <ActionButton
                          size="lg"
                          className="w-full shadow-[var(--shadow-orange-sm)]"
                          onClick={() => {
                            void handleUnlock();
                          }}
                          disabled={showGate || !canUnlock}
                          loading={isBusy}
                        >
                          {primaryLabel}
                        </ActionButton>
                      </div>
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
                isBusy
                  ? "Unlocking…"
                  : hasResult
                    ? "Unlock again"
                    : "Unlock PDF"
              }
              primaryLoading={isBusy}
              primaryDisabled={!canUnlock}
              showPrimaryOnError
              onPrimaryClick={() => {
                void handleUnlock();
              }}
              secondaryLabel={
                resultActionPhase === "ready" || resultActionPhase === "error"
                  ? "Choose another PDF"
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
