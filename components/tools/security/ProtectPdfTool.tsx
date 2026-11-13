"use client";

import { useCallback, useMemo, useState } from "react";
import Link from "next/link";
import { CheckoutButton } from "@/components/billing/CheckoutButton";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProBadge } from "@/components/ui/ProBadge";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { useProAccess } from "@/hooks/useProAccess";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-wave4d.css";
import {
  PROTECT_PDF_AES256_SUCCESS,
  PROTECT_PDF_PRIVACY_COPY,
} from "@/lib/security-tools/pdf/protect-constants";
import { submitSecurityToolForm } from "@/lib/security-tools/client";
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
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { ANALYTICS_SURFACES } from "@/lib/analytics/surfaces";
import { trackEvent } from "@/lib/analytics/ga4";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

function ProtectAccessNote({ isAuthenticated }: { isAuthenticated: boolean }) {
  return (
    <div className="max-w-[36rem]">
      <p className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
        Pro required
        <ProBadge />
      </p>
      <p className="mt-1 text-sm leading-relaxed text-foreground">
        Password protection is available with Scanonix Pro.
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
              tool_slug: "protect-pdf",
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
  label,
  value,
  onChange,
  visible,
  disabled,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  disabled?: boolean;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-foreground">{label}</span>
      <input
        type={visible ? "text" : "password"}
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="input-field"
        autoComplete="new-password"
        disabled={disabled}
      />
    </label>
  );
}

export function ProtectPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingSignatures, setHasExistingSignatures] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const isBusy = status === "loading";
  const hasResult = status === "success";

  const passwordsMatch = useMemo(
    () => !confirmPassword || password === confirmPassword,
    [confirmPassword, password],
  );

  const resetTool = useCallback(() => {
    setFile(null);
    setPassword("");
    setConfirmPassword("");
    setShowPassword(false);
    setHasExistingSignatures(false);
    setStatus("idle");
    setMessage(undefined);
  }, []);

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
    setPassword("");
    setConfirmPassword("");
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

  const handleProtect = useCallback(async () => {
    if (!file) return;

    if (!password) {
      setStatus("error");
      setMessage("Enter a password.");
      return;
    }

    if (password.length < 4) {
      setStatus("error");
      setMessage("Password must be at least 4 characters.");
      return;
    }

    if (password !== confirmPassword) {
      setStatus("error");
      setMessage("Passwords do not match.");
      return;
    }

    const attempt = createProcessAttempt("protect-pdf");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage(undefined);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);

    const result = await submitSecurityToolForm(
      "/api/tools/security/protect-pdf",
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
      buildToolDownloadMeta("protect-pdf", 1),
    );
    attempt.success(1);
    setStatus("success");
    setMessage(`${PROTECT_PDF_AES256_SUCCESS}. Passwords are never stored.`);
  }, [confirmPassword, file, password]);

  const { loading, isAuthenticated, isPro } = useProAccess();
  const showGate = !isPro;

  if (loading) {
    return (
      <div className="rounded-2xl border border-border bg-surface p-8 text-center text-foreground-muted">
        Loading security workspace…
      </div>
    );
  }

  const canProtect =
          Boolean(file) &&
          Boolean(password) &&
          Boolean(confirmPassword) &&
          passwordsMatch &&
          isPro &&
          !showGate &&
          !isBusy;
        const primaryLabel = showGate
          ? "Upgrade to Pro to protect"
          : isBusy
            ? "Protecting…"
            : hasResult
              ? "Protect again"
              : "Protect PDF";
        const protectHint = showGate
          ? "Upgrade to Pro to encrypt and download your PDF."
          : hasResult
            ? "Protected file downloaded. Protect again or start over."
            : "Encrypts with AES-256 and downloads automatically.";

        return (
          <div className="ux-wave4d overflow-x-hidden">
            <div className="ux-wave4d-banner">
              <ToolStatusBanner status={status} message={message} />
            </div>

            {!file ? (
              <div data-tool-workspace="empty">
                <PremiumFileSelect
                  fromLabel="PDF"
                  toLabel="Locked"
                  buttonLabel="Upload a PDF"
                  prompt="Upload or drag a PDF here."
                  formats="PDF"
                  accept={ACCEPTED_PDF_EXTENSIONS}
                  multiple={false}
                  validateFile={isAcceptedPdfFile}
                  onFilesSelected={(files) => {
                    const pdf = files.find(isAcceptedPdfFile);
                    if (pdf) void handleFileSelected(pdf);
                  }}
                />
                <p className="ux-wave4d-note">PDF · Password is never stored</p>
                <PrivacyNotice message={PROTECT_PDF_PRIVACY_COPY} />
                {showGate ? (
                  <div className="ux-wave4d-gate">
                    <ProtectAccessNote isAuthenticated={isAuthenticated} />
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
                        {hasResult ? "Start over" : "Choose another PDF"}
                      </ActionButton>
                      <ActionButton
                        size="lg"
                        className="ux-command-primary"
                        onClick={() => {
                          void handleProtect();
                        }}
                        disabled={showGate || !canProtect}
                        loading={isBusy}
                      >
                        {primaryLabel}
                      </ActionButton>
                    </div>
                  </div>

                  {hasExistingSignatures ? (
                    <div className="ux-wave4d-warning">
                      <p className="text-sm text-foreground">{DIGITAL_SIGNATURE_WARNING}</p>
                      <p className="mt-1 text-xs text-scanonix-muted">
                        Password protection rewrites the PDF and may invalidate existing signatures.
                      </p>
                    </div>
                  ) : null}

                  <div className="ux-4d-settings">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-medium text-foreground">Password protection</p>
                      <button
                        type="button"
                        className="shrink-0 rounded-lg px-2.5 py-1 text-sm font-medium text-foreground-secondary transition-colors hover:text-foreground disabled:opacity-50"
                        aria-pressed={showPassword}
                        aria-label={showPassword ? "Hide passwords" : "Show passwords"}
                        disabled={isBusy}
                        onClick={() => setShowPassword((current) => !current)}
                      >
                        {showPassword ? "Hide" : "Show"}
                      </button>
                    </div>
                    <PasswordField
                      label="Password"
                      value={password}
                      onChange={setPassword}
                      visible={showPassword}
                      disabled={isBusy}
                    />
                    <PasswordField
                      label="Confirm password"
                      value={confirmPassword}
                      onChange={setConfirmPassword}
                      visible={showPassword}
                      disabled={isBusy}
                    />
                    <p className="text-xs leading-relaxed text-scanonix-muted">At least 4 characters.</p>
                    {!passwordsMatch ? (
                      <p className="text-sm text-red-600 [[data-theme=dark]_&]:text-red-400">
                        Passwords do not match.
                      </p>
                    ) : null}
                    {hasResult ? (
                      <div>
                        <p className="text-sm font-semibold text-foreground">Protected PDF downloaded</p>
                        <p className="mt-1 text-xs leading-snug text-scanonix-muted">
                          Your download should have started. Protect again with the same passwords or start over.
                        </p>
                      </div>
                    ) : null}
                    <p className="ux-wave4d-hint">{protectHint}</p>
                    {showGate ? <ProtectAccessNote isAuthenticated={isAuthenticated} /> : null}
                    <PrivacyNotice message={PROTECT_PDF_PRIVACY_COPY} />
                  </div>
                </div>
              </div>
            )}
          </div>
  );
}
