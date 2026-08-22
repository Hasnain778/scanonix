"use client";

import { useCallback, useEffect, useRef, useState } from "react";
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

export function ImageResizerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [width, setWidth] = useState("");
  const [height, setHeight] = useState("");
  const [lockAspect, setLockAspect] = useState(true);
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>();
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
      return undefined;
    });

    if (!image) {
      previewUrlRef.current = undefined;
      setNaturalSize(undefined);
      return;
    }

    const url = URL.createObjectURL(image);
    previewUrlRef.current = url;
    setPreviewUrl(url);

    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
      setWidth(String(img.naturalWidth));
      setHeight(String(img.naturalHeight));
    };
    img.src = url;
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleWidthChange = (value: string) => {
    setWidth(value);
    if (!lockAspect || !naturalSize) return;
    const nextWidth = Number(value);
    if (!Number.isFinite(nextWidth) || nextWidth <= 0) return;
    const ratio = naturalSize.height / naturalSize.width;
    setHeight(String(Math.max(1, Math.round(nextWidth * ratio))));
  };

  const handleHeightChange = (value: string) => {
    setHeight(value);
    if (!lockAspect || !naturalSize) return;
    const nextHeight = Number(value);
    if (!Number.isFinite(nextHeight) || nextHeight <= 0) return;
    const ratio = naturalSize.width / naturalSize.height;
    setWidth(String(Math.max(1, Math.round(nextHeight * ratio))));
  };

  const handleResize = useCallback(async () => {
    if (!file) return;

    const parsedWidth = width ? Number(width) : undefined;
    const parsedHeight = height ? Number(height) : undefined;

    if (!parsedWidth && !parsedHeight) {
      setMessage("Enter a width or height.");
      setStatus("error");
      return;
    }

    const attempt = createProcessAttempt("image-resizer");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage(undefined);
    setResultBlob(null);
    setStats(undefined);

    const formData = new FormData();
    formData.append("file", file);
    if (parsedWidth) formData.append("width", String(parsedWidth));
    if (parsedHeight) formData.append("height", String(parsedHeight));
    formData.append("fit", "inside");

    const result = await submitImageToolForm("/api/tools/image/resize", formData);
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
  }, [file, height, width]);

  const resetTool = useCallback(() => {
    setFilePreview(null);
    setFile(null);
    setResultBlob(null);
    setResultFileName(undefined);
    setStats(undefined);
    setWidth("");
    setHeight("");
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
            label="Drop an image to resize"
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
                {naturalSize ? (
                  <p className="mt-1 text-sm text-scanonix-muted">
                    Original: {naturalSize.width} × {naturalSize.height}px
                  </p>
                ) : null}
              </div>
            </div>
          ) : null}

          <div className="glass-card grid gap-4 rounded-2xl p-5 sm:grid-cols-2 sm:p-6">
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Width (px)</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={width}
                onChange={(event) => handleWidthChange(event.target.value)}
                disabled={isBusy}
                className="w-full rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="block space-y-2">
              <span className="text-sm font-medium text-white">Height (px)</span>
              <input
                type="number"
                min={1}
                max={10000}
                value={height}
                onChange={(event) => handleHeightChange(event.target.value)}
                disabled={isBusy}
                className="w-full rounded-xl border border-scanonix-border bg-black/40 px-4 py-3 text-sm text-white"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-scanonix-muted sm:col-span-2">
              <input
                type="checkbox"
                checked={lockAspect}
                onChange={(event) => setLockAspect(event.target.checked)}
                disabled={isBusy}
                className="accent-scanonix-orange"
              />
              Maintain aspect ratio
            </label>
          </div>

          <ToolStatusBanner status={status} message={message} />

          <div className="hidden sm:block">
            <ActionButton
              size="lg"
              loading={isBusy}
              disabled={!file || isBusy}
              onClick={() => void handleResize()}
            >
              Resize image
            </ActionButton>
          </div>
        </>
      ) : (
        <ToolResultsPanel
          title="Resize complete"
          primaryLabel="Download resized image"
          onPrimaryClick={() => {
            if (resultBlob) downloadBlob(resultBlob, resultFileName ?? "resized.jpg", buildToolDownloadMeta("image-resizer", 1));
          }}
          onStartOver={resetTool}
        >
          {stats ? (
            <ImageToolStats
              originalSize={stats.originalSize}
              outputSize={stats.outputSize}
              width={stats.width}
              height={stats.height}
              showDimensions
            />
          ) : null}
        </ToolResultsPanel>
      )}

      <PrivacyNotice message="Images are processed on Scanonix servers and deleted after processing." />

      <ToolStickyMobileActionBar
        visible={Boolean(file) && !hasResult}
        primaryLabel="Resize image"
        primaryLoading={isBusy}
        primaryDisabled={!file || isBusy}
        onPrimaryClick={() => void handleResize()}
      />
    </div>
  );
}
