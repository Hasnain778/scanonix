"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
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
  "Images are uploaded to Scanonix for processing and deleted after processing.";

function isValidImageFile(file: File): boolean {
  return file.size > 0 && file.size <= FREE_IMAGE_MAX_BYTES;
}

const PREVIEW_MAX_WIDTH = 480;
const PREVIEW_MAX_HEIGHT = 320;
const PREVIEW_MIN_LONG_SIDE = 240;

function previewDisplayWidth(width: number, height: number): number {
  if (width <= 0 || height <= 0) return PREVIEW_MAX_WIDTH;
  const longSide = Math.max(width, height);
  const scale = Math.min(
    Math.max(PREVIEW_MIN_LONG_SIDE / longSide, 1),
    PREVIEW_MAX_WIDTH / width,
    PREVIEW_MAX_HEIGHT / height,
  );
  return Math.max(1, Math.round(width * scale));
}

function calculateSavingsPercent(originalSize: number, outputSize: number): number {
  if (originalSize <= 0) return 0;
  const saved = Math.max(0, originalSize - outputSize);
  return Math.round((saved / originalSize) * 100);
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

export function ImageCompressorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>();
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
    };
    img.src = url;
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

  const savingsPercent = useMemo(() => {
    if (!stats) return null;
    return calculateSavingsPercent(stats.originalSize, stats.outputSize);
  }, [stats]);

  const outputFormat = formatFromFileName(resultFileName);

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
    setMessage("Image compressed successfully!");
  }, [file, quality]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "compressed.jpg",
      buildToolDownloadMeta("image-compressor", 1),
    );
    setMessage("Image downloaded successfully!");
  }, [resultBlob, resultFileName]);

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

  const primaryLabel = hasResult
    ? "Download image"
    : isBusy
      ? "Compressing…"
      : "Compress image";

  return (
    <div className="ux-wave4c overflow-x-hidden">
      <div className="ux-wave4c-banner">
        <ToolStatusBanner status={status} message={message} />
      </div>

      {!file ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="Image"
            toLabel="Smaller"
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
              setResultFileName(undefined);
              setStats(undefined);
              setStatus("idle");
              setMessage(undefined);
            }}
          />
          <p className="ux-wave4c-note">
            JPG, PNG, WEBP or HEIC — up to {MAX_MB}MB
          </p>
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
                    else void handleCompress();
                  }}
                >
                  {primaryLabel}
                </ActionButton>
              </div>
            </div>

            {previewUrl ? (
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
                  <div>
                    <dt className="text-scanonix-muted">Original size</dt>
                    <dd className="font-semibold text-foreground">{formatFileSize(stats.originalSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">
                      {stats.outputSize < stats.originalSize ? "Compressed size" : "Output size"}
                    </dt>
                    <dd className="font-semibold text-foreground">{formatFileSize(stats.outputSize)}</dd>
                  </div>
                  {stats.outputSize < stats.originalSize && savingsPercent != null && savingsPercent > 0 ? (
                    <div>
                      <dt className="text-scanonix-muted">Saved</dt>
                      <dd className="font-semibold text-foreground">
                        {savingsPercent}% · {formatFileSize(stats.originalSize - stats.outputSize)}
                      </dd>
                    </div>
                  ) : null}
                  {stats.width && stats.height ? (
                    <div>
                      <dt className="text-scanonix-muted">Dimensions</dt>
                      <dd className="font-semibold text-foreground">
                        {stats.width} × {stats.height}px
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
                {stats.outputSize >= stats.originalSize ? (
                  <p className="text-sm leading-relaxed text-foreground" role="status">
                    No size reduction. This image was already efficiently compressed.
                  </p>
                ) : null}
              </div>
            ) : (
              <div className="ux-4c-settings">
                <div className="flex items-center justify-between gap-3">
                  <label htmlFor="compress-quality" className="text-sm font-medium text-foreground">
                    Quality
                  </label>
                  <span className="text-sm text-scanonix-orange">
                    {quality}% · {qualityLabel}
                  </span>
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
                  className="w-full accent-scanonix-orange"
                />
              </div>
            )}

            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </div>
        </div>
      )}
    </div>
  );
}
