"use client";

import { useCallback, useMemo, useState } from "react";
import { KeyRound, Shield } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
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

const GATE_DESCRIPTION =
  "Remove password protection using its current password. Upgrade to Pro to unlock.";

function UnlockDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <KeyRound className={className} aria-hidden="true" strokeWidth={1.75} />;
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

function PasswordField({
  label,
  value,
  onChange,
  visible,
  onToggleVisible,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="input-field pr-12"
          autoComplete="current-password"
          disabled={disabled}
        />
        <button
          type="button"
          onClick={onToggleVisible}
          disabled={disabled}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-scanonix-muted transition-colors hover:text-foreground disabled:opacity-50"
          aria-label={visible ? "Hide password" : "Show password"}
        >
          {visible ? "Hide" : "Show"}
        </button>
      </div>
    </label>
  );
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
    <SecurityToolWorkspace
      toolName="Unlock PDF"
      gateDescription={GATE_DESCRIPTION}
    >
      {({ isPro, showGate }) => {
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
          <div className="space-y-5 overflow-x-hidden">
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
                  />
                  <PrivacyNotice message={UNLOCK_PDF_PRIVACY_COPY} />
                </>
              }
              workArea={
                file ? (
                  <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
                    <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                      <div className="flex min-w-0 items-center gap-2.5">
                        <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
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
                          {hasResult ? "Start over" : "Choose another PDF"}
                        </ActionButton>
                      </div>
                    </div>

                    {hasExistingSignatures ? (
                      <div className="border-b border-amber-500/30 bg-amber-500/10 px-3.5 py-2.5 sm:px-4">
                        <p className="text-sm text-foreground">
                          {DIGITAL_SIGNATURE_WARNING}
                        </p>
                        <p className="mt-1 text-xs text-scanonix-muted">
                          Unlocking rewrites the PDF and may invalidate existing
                          signatures.
                        </p>
                      </div>
                    ) : null}

                    <div className="space-y-3 bg-surface-muted/30 p-3 sm:p-4">
                      <div className="rounded-xl border border-border bg-surface px-3.5 py-3">
                        <p className="text-sm font-semibold text-foreground">
                          {hasResult
                            ? "Unlocked PDF downloaded"
                            : "Ready to unlock PDF"}
                        </p>
                        <p className="mt-1 text-xs leading-snug text-scanonix-muted">
                          {hasResult
                            ? "Your download should have started. Unlock again with the same password or start over."
                            : "Enter the current PDF password in the control panel. Passwords are never stored or logged."}
                        </p>
                      </div>
                    </div>
                  </div>
                ) : null
              }
              controlPanel={
                file ? (
                  <ToolControlPanel
                    aria-label="Unlock PDF controls"
                    footer={
                      <div className="flex flex-col gap-2">
                        <p className="text-[11px] leading-snug text-scanonix-muted">
                          {unlockHint}
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
                              void handleUnlock();
                            }}
                            disabled={showGate || !canUnlock}
                            loading={isBusy}
                          >
                            {primaryLabel}
                          </ActionButton>
                        </div>
                        {stickyVisible ? (
                          <div className="hidden md:block">
                            <ActionButton
                              variant="outline"
                              size="lg"
                              className="w-full"
                              disabled={isBusy}
                              onClick={resetTool}
                            >
                              {hasResult ? "Start over" : "Choose another PDF"}
                            </ActionButton>
                          </div>
                        ) : null}
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
                            Unlock PDF
                          </p>
                        </div>
                        <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
                          Remove password protection using the current PDF
                          password.
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
                      </dl>

                      <PasswordField
                        label="PDF password"
                        value={password}
                        onChange={setPassword}
                        visible={showPassword}
                        onToggleVisible={() =>
                          setShowPassword((current) => !current)
                        }
                        disabled={isBusy}
                      />

                      <div className="border-t border-border/80 pt-3">
                        <PrivacyNotice message={UNLOCK_PDF_PRIVACY_COPY} />
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
