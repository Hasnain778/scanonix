"use client";

import { useCallback, useMemo, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import {
  PROTECT_PDF_AES256_SUCCESS,
  PROTECT_PDF_PRIVACY_COPY,
} from "@/lib/security-tools/pdf/protect-constants";
import { submitSecurityToolForm } from "@/lib/security-tools/client";
import { downloadBlob } from "@/lib/tools/download";
import { detectExistingDigitalSignatures, DIGITAL_SIGNATURE_WARNING } from "@/lib/tools/fill-pdf";
import { isAcceptedPdfFile } from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";

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
          autoComplete="new-password"
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

export function ProtectPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [hasExistingSignatures, setHasExistingSignatures] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const passwordsMatch = useMemo(
    () => !confirmPassword || password === confirmPassword,
    [confirmPassword, password],
  );

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

    setStatus("loading");
    setMessage(undefined);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);
    formData.append("confirmPassword", confirmPassword);

    const result = await submitSecurityToolForm("/api/tools/security/protect-pdf", formData);

    if (!result.ok) {
      setStatus("error");
      setMessage(result.message);
      return;
    }

    downloadBlob(result.blob, result.fileName);
    setStatus("success");
    setMessage(`${PROTECT_PDF_AES256_SUCCESS}. Passwords are never stored.`);
  }, [confirmPassword, file, password]);

  return (
    <SecurityToolWorkspace
      toolName="Protect PDF"
      gateDescription="Add password protection to your PDF. Upgrade to Pro to encrypt and download."
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
            hint="Drop a PDF file or click to browse"
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
                Password protection rewrites the PDF and may invalidate existing signatures.
              </p>
            </div>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <PasswordField
              label="Password"
              value={password}
              onChange={setPassword}
              visible={showPassword}
              onToggleVisible={() => setShowPassword((current) => !current)}
            />
            <PasswordField
              label="Confirm password"
              value={confirmPassword}
              onChange={setConfirmPassword}
              visible={showPassword}
              onToggleVisible={() => setShowPassword((current) => !current)}
            />
          </div>

          {!passwordsMatch ? (
            <p className="text-sm text-red-300">Passwords do not match.</p>
          ) : null}

          <p className="text-xs text-scanonix-muted">{PROTECT_PDF_PRIVACY_COPY}</p>

          <ToolStatusBanner status={status} message={message} />

          <ActionButton
            onClick={() => void handleProtect()}
            disabled={
              !file ||
              !password ||
              !confirmPassword ||
              !passwordsMatch ||
              showGate ||
              !isPro ||
              status === "loading"
            }
            loading={status === "loading"}
          >
            {showGate ? "Upgrade to Pro to protect" : "Protect & download PDF"}
          </ActionButton>
        </div>
      )}
    </SecurityToolWorkspace>
  );
}
