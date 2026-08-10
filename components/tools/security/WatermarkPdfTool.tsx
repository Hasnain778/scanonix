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
import type { WatermarkPosition } from "@/lib/security-tools/pdf/watermark";

const POSITIONS: { value: WatermarkPosition; label: string }[] = [
  { value: "center", label: "Center" },
  { value: "diagonal", label: "Diagonal" },
  { value: "top-left", label: "Top left" },
  { value: "top-right", label: "Top right" },
  { value: "bottom-left", label: "Bottom left" },
  { value: "bottom-right", label: "Bottom right" },
];

export function WatermarkPdfTool() {
  const [file, setFile] = useState<File | null>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [text, setText] = useState("CONFIDENTIAL");
  const [position, setPosition] = useState<WatermarkPosition>("diagonal");
  const [opacity, setOpacity] = useState(0.25);
  const [fontSize, setFontSize] = useState(48);
  const [pageSelection, setPageSelection] = useState("all");
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();

  const handleWatermark = useCallback(async () => {
    if (!file) return;

    setStatus("loading");
    setMessage(undefined);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("text", text);
    formData.append("position", position);
    formData.append("opacity", String(opacity));
    formData.append("fontSize", String(fontSize));
    formData.append("pageSelection", pageSelection);
    if (imageFile) {
      formData.append("image", imageFile);
    }

    const result = await submitSecurityToolForm("/api/tools/security/watermark-pdf", formData);

    if (!result.ok) {
      setStatus("error");
      setMessage(result.message);
      return;
    }

    downloadBlob(result.blob, result.fileName);
    setStatus("success");
    setMessage("Watermarked PDF downloaded.");
  }, [file, fontSize, imageFile, opacity, pageSelection, position, text]);

  return (
    <SecurityToolWorkspace
      toolName="Watermark PDF"
      gateDescription="Add text or image watermarks with custom position and opacity. Upgrade to Pro to apply."
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
            hint="Drop a PDF to watermark"
          />

          {file ? (
            <p className="text-sm text-scanonix-muted">
              Selected: <span className="text-white">{file.name}</span>
            </p>
          ) : null}

          <div className="grid gap-4 sm:grid-cols-2">
            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-white">Watermark text</span>
              <input
                type="text"
                value={text}
                onChange={(event) => setText(event.target.value)}
                className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 text-white"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Optional image watermark</span>
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                onChange={(event) => setImageFile(event.target.files?.[0] ?? null)}
                className="w-full rounded-xl border border-white/10 bg-[#121212] px-3 py-2 text-sm text-white file:mr-3 file:rounded-lg file:border-0 file:bg-scanonix-orange file:px-3 file:py-1.5 file:text-black"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Position</span>
              <select
                value={position}
                onChange={(event) => setPosition(event.target.value as WatermarkPosition)}
                className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 text-white"
              >
                {POSITIONS.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Opacity ({opacity.toFixed(2)})</span>
              <input
                type="range"
                min={0.05}
                max={1}
                step={0.05}
                value={opacity}
                onChange={(event) => setOpacity(Number(event.target.value))}
                className="w-full"
              />
            </label>

            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Font size</span>
              <input
                type="number"
                min={12}
                max={120}
                value={fontSize}
                onChange={(event) => setFontSize(Number(event.target.value))}
                className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 text-white"
              />
            </label>

            <label className="block space-y-2 sm:col-span-2">
              <span className="text-sm font-medium text-white">Pages</span>
              <input
                type="text"
                value={pageSelection}
                onChange={(event) => setPageSelection(event.target.value)}
                placeholder="all or 1,3,5"
                className="w-full rounded-xl border border-white/10 bg-[#121212] px-4 py-2.5 text-white"
              />
            </label>
          </div>

          <ToolStatusBanner status={status} message={message} />

          <ActionButton
            onClick={() => void handleWatermark()}
            disabled={!file || showGate || !isPro || status === "loading"}
            loading={status === "loading"}
          >
            {showGate ? "Upgrade to Pro to watermark" : "Apply watermark & download"}
          </ActionButton>
        </div>
      )}
    </SecurityToolWorkspace>
  );
}
