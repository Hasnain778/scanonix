"use client";

import { useCallback, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import {
  UNLOCK_PDF_PRIVACY_COPY,
  UNLOCK_PDF_SUCCESS,
} from "@/lib/security-tools/pdf/unlock-constants";
import type { UnlockPdfErrorCode } from "@/lib/security-tools/pdf/unlock";
import { downloadBlob } from "@/lib/tools/download";
import { detectExistingDigitalSignatures, DIGITAL_SIGNATURE_WARNING } from "@/lib/tools/fill-pdf";
import { isAcceptedPdfFile } from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";

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
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  visible: boolean;
  onToggleVisible: () => void;
}) {
  return (
    <label className="block space-y-2">
      <span className="text-sm font-medium text-white">{label}</span>
      <div className="relative">
        <input
          type={visible ? "text" : "password"}
          value={value}
          onChange={(event) => onChange(event.target.value)}
          className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 pr-12 text-white"
          autoComplete="current-password"
        />
        <button
          type="button"
          onClick={onToggleVisible}
          className="absolute inset-y-0 right-0 flex items-center px-3 text-scanonix-muted transition-colors hover:text-white"
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

  const handleFileSelected = useCallback(async (selectedFile: File) => {
    setFile(selectedFile);
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
      return;
    }

    const disposition = response.headers.get("Content-Disposition") ?? "";
    const match = disposition.match(/filename="([^"]+)"/);
    const fileName = match?.[1] ?? "document-unlocked.pdf";
    const blob = await response.blob();

    downloadBlob(blob, fileName);
    setStatus("success");
    setMessage(`${UNLOCK_PDF_SUCCESS} Password was not stored.`);
  }, [file, password]);

  return (
    <SecurityToolWorkspace
      toolName="Unlock PDF"
      gateDescription="Remove password protection using its current password. Upgrade to Pro to unlock."
    >
      {({ isPro, showGate }) => (
        <div className="space-y-6">
          <FileDropZone
            accept={ACCEPTED_PDF_EXTENSIONS}
            onFilesSelected={(files) => {
              const pdf = files.find(isAcceptedPdfFile);
              if (pdf) {
                void handleFileSelected(pdf);
              }
            }}
            disabled={false}
            hint="Drop a password-protected PDF"
          />

          {file ? (
            <p className="text-sm text-scanonix-muted">
              Selected: <span className="text-white">{file.name}</span>
            </p>
          ) : null}

          {hasExistingSignatures ? (
            <div className="rounded-xl border border-amber-400/20 bg-amber-500/10 p-4">
              <p className="text-sm text-amber-100/90">{DIGITAL_SIGNATURE_WARNING}</p>
              <p className="mt-2 text-xs text-amber-100/70">
                Unlocking rewrites the PDF and may invalidate existing signatures.
              </p>
            </div>
          ) : null}

          <PasswordField
            label="PDF password"
            value={password}
            onChange={setPassword}
            visible={showPassword}
            onToggleVisible={() => setShowPassword((current) => !current)}
          />

          <p className="text-xs text-scanonix-muted">
            Remove password protection using its current password. Scanonix does not attempt
            password cracking.
          </p>

          <p className="text-xs text-scanonix-muted">{UNLOCK_PDF_PRIVACY_COPY}</p>

          <ToolStatusBanner status={status} message={message} />

          <ActionButton
            onClick={() => void handleUnlock()}
            disabled={!file || showGate || !isPro || status === "loading"}
            loading={status === "loading"}
          >
            {showGate ? "Upgrade to Pro to unlock" : "Unlock & download PDF"}
          </ActionButton>
        </div>
      )}
    </SecurityToolWorkspace>
  );
}
