"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-wave4c.css";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { submitImageToolForm, type ImageToolStats as Stats } from "@/lib/tools/image/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";
import type { ToolStatus } from "@/lib/tools/types";

const ACCEPT_IMAGES = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";
const MAX_MB = Math.round(FREE_IMAGE_MAX_BYTES / (1024 * 1024));
const PRIVACY_MESSAGE =
  "Images are processed on Scanonix servers and deleted after processing.";

function isValidImageFile(file: File): boolean {
  return file.size > 0 && file.size <= FREE_IMAGE_MAX_BYTES;
}

function formatFromFileName(fileName?: string): string | undefined {
  if (!fileName) return undefined;
  const extension = fileName.split(".").pop()?.toUpperCase();
  if (!extension) return undefined;
  if (extension === "JPG" || extension === "JPEG") return "JPEG";
  if (extension === "PNG") return "PNG";
  if (extension === "WEBP") return "WEBP";
  return extension;
}

function previewDisplayWidth(width: number, height: number, maxWidth = 480, maxHeight = 320): number {
  if (width <= 0 || height <= 0) return maxWidth;
  const longSide = Math.max(width, height);
  const scale = Math.min(Math.max(240 / longSide, 1), maxWidth / width, maxHeight / height);
  return Math.max(1, Math.round(width * scale));
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
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string>();
  const [stats, setStats] = useState<Stats>();
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();
  const previewUrlRef = useRef<string | undefined>(undefined);
  const resultPreviewUrlRef = useRef<string | undefined>(undefined);

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
      if (resultPreviewUrlRef.current) URL.revokeObjectURL(resultPreviewUrlRef.current);
    };
  }, []);

  const clearResultPreview = useCallback(() => {
    if (resultPreviewUrlRef.current) {
      URL.revokeObjectURL(resultPreviewUrlRef.current);
      resultPreviewUrlRef.current = undefined;
    }
    setResultPreviewUrl(undefined);
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
    clearResultPreview();
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

    const outputPreview = URL.createObjectURL(result.blob);
    resultPreviewUrlRef.current = outputPreview;
    setResultPreviewUrl(outputPreview);
    setResultBlob(result.blob);
    setResultFileName(result.fileName);
    setStats({
      ...result.stats,
      originalSize: result.stats.originalSize || file.size,
    });
    attempt.success(1);
    setStatus("success");
    setMessage("Image resized successfully!");
  }, [clearResultPreview, file, height, width]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "resized.jpg",
      buildToolDownloadMeta("image-resizer", 1),
    );
    setMessage("Image downloaded successfully!");
  }, [resultBlob, resultFileName]);

  const resetTool = useCallback(() => {
    setFilePreview(null);
    setFile(null);
    setResultBlob(null);
    clearResultPreview();
    setResultFileName(undefined);
    setStats(undefined);
    setWidth("");
    setHeight("");
    setStatus("idle");
    setMessage(undefined);
  }, [clearResultPreview, setFilePreview]);

  const outputFormat = formatFromFileName(resultFileName);
  const requestedWidth = width ? Number(width) : undefined;
  const requestedHeight = height ? Number(height) : undefined;
  const hasRequestedWidth =
    requestedWidth !== undefined && Number.isFinite(requestedWidth) && requestedWidth > 0;
  const hasRequestedHeight =
    requestedHeight !== undefined && Number.isFinite(requestedHeight) && requestedHeight > 0;

  const primaryLabel = hasResult ? "Download image" : isBusy ? "Resizing…" : "Resize image";

  return (
    <div className="ux-wave4c overflow-x-hidden">
      <div className="ux-wave4c-banner">
        <ToolStatusBanner status={status} message={message} />
      </div>
      {!file ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="Image"
            toLabel="Resized"
            buttonLabel="Upload an image"
            prompt="Upload or drag an image here."
            formats="JPG, PNG, WEBP, HEIC"
            accept={ACCEPT_IMAGES}
            multiple={false}
            disabled={isBusy}
            validateFile={isValidImageFile}
            onInvalidFiles={() => {
              setMessage(`Please choose a supported image up to ${MAX_MB}MB.`);
              setStatus("error");
            }}
            onFilesSelected={(files) => {
              const image = files[0];
              if (!image) return;
              setFilePreview(image);
              setFile(image);
              setResultBlob(null);
              clearResultPreview();
              setResultFileName(undefined);
              setStats(undefined);
              setStatus("idle");
              setMessage(undefined);
            }}
          />
          <p className="ux-wave4c-note">JPG, PNG, WEBP or HEIC — up to {MAX_MB}MB</p>
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>
      ) : (
        <div className="ux-workspace" data-tool-workspace="active">
          <div className="ux-stage">
            <div className="ux-command">
              <div className="min-w-0">
                <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                <p className="mt-0.5 truncate text-xs text-scanonix-muted">
                  {formatFileSize(file.size)}
                  {naturalSize ? ` · ${naturalSize.width} × ${naturalSize.height}px` : ""}
                </p>
              </div>
              <div className="ux-command-actions">
                <ActionButton variant="ghost" size="sm" disabled={isBusy} onClick={resetTool}>
                  {hasResult ? "Start over" : "Choose another image"}
                </ActionButton>
                <ActionButton
                  size="lg"
                  className="ux-command-primary"
                  loading={!hasResult && isBusy}
                  disabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
                  onClick={() => {
                    if (hasResult) handleDownload();
                    else void handleResize();
                  }}
                >
                  {primaryLabel}
                </ActionButton>
              </div>
            </div>

            {hasResult && resultPreviewUrl ? (
              <div>
                <p className="ux-4c-kicker">Resized</p>
                <div className="ux-4c-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={resultPreviewUrl}
                    alt="Resized image preview"
                    style={
                      stats?.width && stats?.height
                        ? { width: previewDisplayWidth(stats.width, stats.height) }
                        : undefined
                    }
                  />
                </div>
              </div>
            ) : previewUrl ? (
              <div>
                <p className="ux-4c-kicker">Original</p>
                <div className="ux-4c-preview">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={previewUrl}
                    alt="Original image preview"
                    style={
                      naturalSize
                        ? { width: previewDisplayWidth(naturalSize.width, naturalSize.height) }
                        : undefined
                    }
                  />
                </div>
              </div>
            ) : null}

            {hasResult && resultBlob && stats ? (
              <div className="ux-4c-result">
                <dl className="ux-4c-stats text-sm">
                  {naturalSize ? (
                    <div>
                      <dt className="text-scanonix-muted">Original</dt>
                      <dd className="font-semibold text-foreground">
                        {naturalSize.width} × {naturalSize.height}px
                      </dd>
                    </div>
                  ) : null}
                  {hasRequestedWidth || hasRequestedHeight ? (
                    <div>
                      <dt className="text-scanonix-muted">Requested</dt>
                      <dd className="font-semibold text-foreground">
                        {hasRequestedWidth ? requestedWidth : "—"} × {hasRequestedHeight ? requestedHeight : "—"}px
                      </dd>
                    </div>
                  ) : null}
                  {stats.width && stats.height ? (
                    <div>
                      <dt className="text-scanonix-muted">Output</dt>
                      <dd className="font-semibold text-foreground">
                        {stats.width} × {stats.height}px
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-scanonix-muted">Original size</dt>
                    <dd className="font-semibold text-foreground">{formatFileSize(stats.originalSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Output size</dt>
                    <dd className="font-semibold text-foreground">{formatFileSize(stats.outputSize)}</dd>
                  </div>
                  {stats.outputSize < stats.originalSize ? (
                    <div>
                      <dt className="text-scanonix-muted">Saved</dt>
                      <dd className="font-semibold text-foreground">
                        {Math.round(((stats.originalSize - stats.outputSize) / stats.originalSize) * 100)}
                        % · {formatFileSize(stats.originalSize - stats.outputSize)}
                      </dd>
                    </div>
                  ) : null}
                  {outputFormat ? (
                    <div>
                      <dt className="text-scanonix-muted">Output format</dt>
                      <dd className="font-semibold text-foreground">{outputFormat}</dd>
                    </div>
                  ) : null}
                  {resultFileName ? (
                    <div>
                      <dt className="shrink-0 text-scanonix-muted">Output file</dt>
                      <dd className="min-w-0 truncate font-semibold text-foreground">{resultFileName}</dd>
                    </div>
                  ) : null}
                </dl>
                {stats.outputSize === stats.originalSize ? (
                  <p className="text-sm leading-relaxed text-foreground" role="status">
                    No size reduction. Resize changes dimensions; file size may stay similar.
                  </p>
                ) : null}
                {stats.outputSize > stats.originalSize ? (
                  <p className="text-sm leading-relaxed text-foreground" role="status">
                    Output is larger by {formatFileSize(stats.outputSize - stats.originalSize)}. Resize targets
                    dimensions, not compression.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="ux-4c-settings">
                <div className="ux-4c-dimensions">
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-sm font-medium text-foreground">Width (px)</span>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={width}
                      onChange={(event) => handleWidthChange(event.target.value)}
                      disabled={isBusy}
                      className="input-field"
                    />
                  </label>
                  <label className="block min-w-0 space-y-1.5">
                    <span className="text-sm font-medium text-foreground">Height (px)</span>
                    <input
                      type="number"
                      min={1}
                      max={10000}
                      value={height}
                      onChange={(event) => handleHeightChange(event.target.value)}
                      disabled={isBusy}
                      className="input-field"
                    />
                  </label>
                </div>
                <label className="flex items-center gap-2 text-sm text-foreground">
                  <input
                    type="checkbox"
                    checked={lockAspect}
                    onChange={(event) => setLockAspect(event.target.checked)}
                    disabled={isBusy}
                    className="accent-scanonix-orange"
                  />
                  Maintain aspect ratio
                </label>
                <p className="ux-wave4c-hint">Image fits within the requested dimensions.</p>
              </div>
            )}
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </div>
        </div>
      )}
    </div>
  );
}
