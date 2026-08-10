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

export function UnlockPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [password, setPassword] = useState("");
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const handleUnlock = useCallback(async () => {
    if (!file) return;

    setStatus("loading");
    setMessage(undefined);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("password", password);

    const result = await submitSecurityToolForm("/api/tools/security/unlock-pdf", formData);

    if (!result.ok) {
      setStatus("error");
      setMessage(result.message);
      return;
    }

    downloadBlob(result.blob, result.fileName);
    setStatus("success");
    setMessage("Unlocked PDF downloaded. Password was not stored.");
  }, [file, password]);

  return (
    <SecurityToolWorkspace
      toolName="Unlock PDF"
      gateDescription="Remove PDF password protection with the correct password. Upgrade to Pro to unlock."
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
            hint="Drop a password-protected PDF"
          />

          {file ? (
            <p className="text-sm text-scanonix-muted">
              Selected: <span className="text-white">{file.name}</span>
            </p>
          ) : null}

          <label className="block space-y-2">
            <span className="text-sm font-medium text-white">PDF password</span>
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
              className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 text-white"
              autoComplete="current-password"
            />
          </label>

          <p className="text-xs text-scanonix-muted">
            Only the correct password can unlock this PDF. Scanonix does not attempt password cracking.
          </p>

          <ToolStatusBanner status={status} message={message} />

          <ActionButton
            onClick={() => void handleUnlock()}
            disabled={!file || !password || showGate || !isPro || status === "loading"}
            loading={status === "loading"}
          >
            {showGate ? "Upgrade to Pro to unlock" : "Unlock & download PDF"}
          </ActionButton>
        </div>
      )}
    </SecurityToolWorkspace>
  );
}
