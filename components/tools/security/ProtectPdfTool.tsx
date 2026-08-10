"use client";

import { useCallback, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { submitSecurityToolForm } from "@/lib/security-tools/client";
import { downloadBlob } from "@/lib/tools/download";
import { isAcceptedPdfFile } from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";

export function ProtectPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const handleProtect = useCallback(async () => {
    if (!file) return;

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
    setMessage("Protected PDF downloaded. Passwords are never stored.");
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
                setFile(pdf);
                setStatus("idle");
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

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Password</span>
              <input
                type="password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 text-white"
                autoComplete="new-password"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Confirm password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(event) => setConfirmPassword(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 text-white"
                autoComplete="new-password"
              />
            </label>
          </div>

          <ToolStatusBanner status={status} message={message} />

          <ActionButton
            onClick={() => void handleProtect()}
            disabled={!file || !password || showGate || !isPro || status === "loading"}
            loading={status === "loading"}
          >
            {showGate ? "Upgrade to Pro to protect" : "Protect & download PDF"}
          </ActionButton>
        </div>
      )}
    </SecurityToolWorkspace>
  );
}
