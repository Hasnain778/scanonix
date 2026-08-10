"use client";

import { useCallback, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { submitSecurityToolForm } from "@/lib/security-tools/client";
import { downloadBlob } from "@/lib/tools/download";
import type { ToolStatus } from "@/lib/tools/types";

const ACCEPTED = [".pdf", ".jpg", ".jpeg", ".png", ".webp", ".heic", ".heif", ".tiff", ".tif"];

export function MetadataCleanerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const handleClean = useCallback(async () => {
    if (!file) return;

    setStatus("loading");
    setMessage(undefined);

    const formData = new FormData();
    formData.append("file", file);

    const result = await submitSecurityToolForm("/api/tools/security/metadata-cleaner", formData);

    if (!result.ok) {
      setStatus("error");
      setMessage(result.message);
      return;
    }

    downloadBlob(result.blob, result.fileName);
    setStatus("success");
    setMessage("Metadata removed. File content preserved.");
  }, [file]);

  return (
    <SecurityToolWorkspace
      toolName="Metadata Cleaner"
      gateDescription="Remove hidden EXIF and PDF metadata from files. Upgrade to Pro to clean and download."
    >
      {({ isPro, showGate }) => (
        <div className="space-y-6">
          <FileDropZone
            accept={ACCEPTED.join(",")}
            onFilesSelected={(files) => {
              if (files[0]) {
                setFile(files[0]);
                setStatus("idle");
              }
            }}
            disabled={false}
            hint="Drop a PDF or image file"
          />

          {file ? (
            <p className="text-sm text-scanonix-muted">
              Selected: <span className="text-white">{file.name}</span>
            </p>
          ) : null}

          <ToolStatusBanner status={status} message={message} />

          <ActionButton
            onClick={() => void handleClean()}
            disabled={!file || showGate || !isPro || status === "loading"}
            loading={status === "loading"}
          >
            {showGate ? "Upgrade to Pro to clean metadata" : "Remove metadata & download"}
          </ActionButton>
        </div>
      )}
    </SecurityToolWorkspace>
  );
}
