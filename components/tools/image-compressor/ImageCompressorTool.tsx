"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ImageToolStats } from "@/components/tools/shared/ImageToolStats";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { submitImageToolForm, type ImageToolStats as Stats } from "@/lib/tools/image/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";
import type { ToolStatus } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

const ACCEPT_IMAGES = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";
const MAX_MB = Math.round(FREE_IMAGE_MAX_BYTES / (1024 * 1024));

function isValidImageFile(file: File): boolean {
  return file.size > 0 && file.size <= FREE_IMAGE_MAX_BYTES;
}

export function ImageCompressorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [quality, setQuality] = useState(80);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState<string>();
  const [stats, setStats] = useState<Stats>();
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();
  const previewUrlRef = useRef<string | undefined>(undefined);

  const isBusy = status === "loading";
  const hasResult = status === "success" && resultBlob !== null;

  const setFilePreview = useCallback((image: File | null) => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      const next = image ? URL.createObjectURL(image) : undefined;
      previewUrlRef.current = next;
      return next;
    });
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const qualityLabel = useMemo(() => {
    if (quality >= 90) return "High quality";
    if (quality >= 70) return "Balanced";
    if (quality >= 50) return "Smaller file";
    return "Maximum compression";
  }, [quality]);

  const handleCompress = useCallback(async () => {
    if (!file) return;

    const attempt = createProcessAttempt("image-compressor");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage(undefined);
    setResultBlob(null);
    setStats(undefined);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("quality", String(quality));

    const result = await submitImageToolForm("/api/tools/image/compress", formData);
    if (!result.ok) {
      attempt.error(planErrorMessageToCode(result.message));
      setStatus("error");
      setMessage(result.message);
      return;
    }

    setResultBlob(result.blob);
    setResultFileName(result.fileName);
    setStats({
      ...result.stats,
      originalSize: result.stats.originalSize || file.size,
    });
    attempt.success(1);
    setStatus("success");
  }, [file, quality]);

  const resetTool = useCallback(() => {
    setFilePreview(null);
    setFile(null);
    setResultBlob(null);
    setResultFileName(undefined);
    setStats(undefined);
    setQuality(80);
    setStatus("idle");
    setMessage(undefined);
  }, [setFilePreview]);

  return (
    <div className="space-y-6">
      {!hasResult ? (
        <>
          <FileDropZone
            accept={ACCEPT_IMAGES}
            multiple={false}
            label="Drop an image to compress"
            hint={`JPG, PNG, WEBP or HEIC — up to ${MAX_MB}MB`}
            disabled={isBusy}
            validateFile={isValidImageFile}
            onInvalidFiles={() => {
              setMessage(`Please choose a supported image up to ${MAX_MB}MB.`);
              setStatus("error");
            }}
            onFilesSelected={(files) => {
              const image = files[0];
              if (image) {
                setFilePreview(image);
                setFile(image);
                setStatus("idle");
                setMessage(undefined);
              }
            }}
          />

          {file ? (
            <div className="grid gap-4 lg:grid-cols-2">
              {previewUrl ? (
                <div className="overflow-hidden rounded-xl border border-scanonix-border bg-black/30">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Preview"
                    className="max-h-72 w-full object-contain"
                  />
                </div>
              ) : null}
              <div className="rounded-xl border border-scanonix-border bg-black/30 p-4">
                <p className="text-sm font-medium text-white">{file.name}</p>
                <p className="mt-1 text-sm text-scanonix-muted">{formatFileSize(file.size)}</p>
              </div>
            </div>
          ) : null}

          <div className="glass-card rounded-2xl p-5 sm:p-6">
            <div className="flex items-center justify-between gap-3">
              <label htmlFor="compress-quality" className="text-sm font-medium text-white">
                Quality
              </label>
              <span className="text-sm text-scanonix-orange">{quality}% · {qualityLabel}</span>
            </div>
            <input
              id="compress-quality"
              type="range"
              min={20}
              max={100}
              step={5}
              value={quality}
              onChange={(event) => setQuality(Number(event.target.value))}
              disabled={isBusy}
              className="mt-4 w-full accent-scanonix-orange"
            />
          </div>

          <ToolStatusBanner status={status} message={message} />

          <div className="hidden sm:block">
            <ActionButton
              size="lg"
              loading={isBusy}
              disabled={!file || isBusy}
              onClick={() => void handleCompress()}
            >
              Compress image
            </ActionButton>
          </div>
        </>
      ) : (
        <ToolResultsPanel
          title="Compression complete"
          primaryLabel="Download compressed image"
          onPrimaryClick={() => {
            if (resultBlob) downloadBlob(resultBlob, resultFileName ?? "compressed.jpg", buildToolDownloadMeta("image-compressor", 1));
          }}
          onStartOver={resetTool}
        >
          {stats ? (
            <ImageToolStats
              originalSize={stats.originalSize}
              outputSize={stats.outputSize}
              width={stats.width}
              height={stats.height}
            />
          ) : null}
        </ToolResultsPanel>
      )}

      <PrivacyNotice message="Images are processed on Scanonix servers and deleted after processing." />

      <ToolStickyMobileActionBar
        visible={Boolean(file) && !hasResult}
        primaryLabel="Compress image"
        primaryLoading={isBusy}
        primaryDisabled={!file || isBusy}
        onPrimaryClick={() => void handleCompress()}
      />
    </div>
  );
}
