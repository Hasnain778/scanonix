"use client";

import { useCallback, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { SecurityToolWorkspace } from "@/components/tools/security/SecurityToolWorkspace";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { submitSecurityToolForm } from "@/lib/security-tools/client";
import { configurePdfWorker } from "@/lib/pdf/configure-worker";
import type { RedactionArea } from "@/lib/security-tools/pdf/redact";
import { downloadBlob } from "@/lib/tools/download";
import { isAcceptedPdfFile } from "@/lib/tools/pdf-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { ACCEPTED_PDF_EXTENSIONS } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

async function findRedactionAreas(
  bytes: ArrayBuffer,
  query: string,
): Promise<RedactionArea[]> {
  await configurePdfWorker();
  const pdfjs = await import("pdfjs-dist");

  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const areas: RedactionArea[] = [];
  const normalizedQuery = query.trim().toLowerCase();

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!("str" in item) || !normalizedQuery) continue;
      if (!item.str.toLowerCase().includes(normalizedQuery)) continue;

      const transform = item.transform;
      const x = transform[4] ?? 0;
      const y = transform[5] ?? 0;
      const width = item.width ?? normalizedQuery.length * 8;
      const height = item.height ?? 12;

      areas.push({
        pageIndex,
        x,
        y: viewport.height - y - height,
        width,
        height,
      });
    }
  }

  return areas;
}

export function RedactPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [searchText, setSearchText] = useState("");
  const [confirmed, setConfirmed] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const handleRedact = useCallback(async () => {
    if (!file || !confirmed) return;

    setStatus("loading");
    setMessage(undefined);

    try {
      const bytes = await file.arrayBuffer();
      const areas = await findRedactionAreas(bytes, searchText);

      if (areas.length === 0) {
        setStatus("error");
        setMessage("No matching text found to redact.");
        return;
      }

      const formData = new FormData();
      formData.append("file", file);
      formData.append("areas", JSON.stringify(areas));

      const result = await submitSecurityToolForm("/api/tools/security/redact-pdf", formData);

      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        return;
      }

      downloadBlob(result.blob, result.fileName, buildToolDownloadMeta("redact-pdf", 1));
      setStatus("success");
      setMessage("Redacted PDF downloaded. Review the output before sharing.");
    } catch (error) {
      setStatus("error");
      setMessage(error instanceof Error ? error.message : "Redaction failed.");
    }
  }, [confirmed, file, searchText]);

  return (
    <SecurityToolWorkspace
      toolName="Redact PDF"
      gateDescription="Permanently remove sensitive text from PDFs. Upgrade to Pro to redact and download."
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
                setConfirmed(false);
              }
            }}
            disabled={false}
            hint="Drop a PDF to redact sensitive content"
          />

          <label className="block space-y-2">
            <span className="text-sm font-medium text-white">Text to redact</span>
            <input
              type="text"
              value={searchText}
              onChange={(event) => setSearchText(event.target.value)}
              placeholder="e.g. Social Security Number, email, account ID"
              className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 text-white"
            />
          </label>

          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            Secure redaction runs on the server and removes underlying text from the PDF
            content stream — not just a visual black box. This cannot be undone — review
            carefully before downloading.
          </div>

          <label className="flex items-start gap-3 text-sm text-scanonix-muted">
            <input
              type="checkbox"
              checked={confirmed}
              onChange={(event) => setConfirmed(event.target.checked)}
              className="mt-1"
            />
            <span>I understand redaction is permanent and I have reviewed the selected content.</span>
          </label>

          <ToolStatusBanner status={status} message={message} />

          <ActionButton
            onClick={() => void handleRedact()}
            disabled={!file || !searchText.trim() || !confirmed || showGate || !isPro || status === "loading"}
            loading={status === "loading"}
          >
            {showGate ? "Upgrade to Pro to redact" : "Redact permanently & download"}
          </ActionButton>
        </div>
      )}
    </SecurityToolWorkspace>
  );
}
