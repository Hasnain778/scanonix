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
import { VECTORIZE_MAX_BYTES } from "@/lib/design/vectorize/types";
import { submitImageToolForm, type ImageToolStats as Stats } from "@/lib/tools/image/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";
import type { ToolStatus } from "@/lib/tools/types";

const ACCEPT_IMAGES = ".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp";
const MAX_BYTES = Math.min(VECTORIZE_MAX_BYTES, FREE_IMAGE_MAX_BYTES);
const MAX_MB = Math.round(MAX_BYTES / (1024 * 1024));
const PRIVACY_MESSAGE =
  "Images are processed on Scanonix servers and deleted after processing.";

const ALLOWED_EXT = new Set(["jpg", "jpeg", "png", "webp"]);

function isSupportedRaster(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_BYTES) return false;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXT.has(ext)) return true;
  const type = file.type.toLowerCase();
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

function previewDisplayWidth(width: number, height: number, maxWidth = 480, maxHeight = 320): number {
  if (width <= 0 || height <= 0) return maxWidth;
  const longSide = Math.max(width, height);
  const scale = Math.min(Math.max(240 / longSide, 1), maxWidth / width, maxHeight / height);
  return Math.max(1, Math.round(width * scale));
}

export function LogoVectorizerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
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

  const handleVectorize = useCallback(async () => {
    if (!file || isBusy) return;

    const attempt = createProcessAttempt("logo-vectorizer");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage("Tracing logo into SVG paths…");
    setResultBlob(null);
    clearResultPreview();
    setStats(undefined);

    const formData = new FormData();
    formData.append("file", file);

    const result = await submitImageToolForm("/api/tools/logo-vectorizer", formData);
    if (!result.ok) {
      attempt.error(planErrorMessageToCode(result.message));
      setStatus("error");
      setMessage(result.message);
      return;
    }

    // Preview via object URL — SVG is tracer-generated; avoid injecting raw markup.
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
    // ToolStatusBanner defaults to PDF copy when message is omitted — set SVG-specific text.
    setMessage("SVG downloaded successfully!");
  }, [clearResultPreview, file, isBusy]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "logo-vector.svg",
      buildToolDownloadMeta("logo-vectorizer", 1),
    );
    setStatus("success");
    setMessage("SVG downloaded successfully!");
  }, [resultBlob, resultFileName]);

  const resetTool = useCallback(() => {
    setFilePreview(null);
    setFile(null);
    setResultBlob(null);
    clearResultPreview();
    setResultFileName(undefined);
    setStats(undefined);
    setStatus("idle");
    setMessage(undefined);
  }, [clearResultPreview, setFilePreview]);

  const primaryLabel = hasResult ? "Download SVG" : isBusy ? "Vectorizing…" : "Vectorize Logo";

  return (
    <div className="ux-wave4c overflow-x-hidden">
      <div className="ux-wave4c-banner">
        <ToolStatusBanner status={status} message={message} />
      </div>
      {!file ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="Logo"
            toLabel="SVG"
            buttonLabel="Upload a logo"
            prompt="Upload or drag a logo here."
            formats="PNG, JPG, WEBP"
            accept={ACCEPT_IMAGES}
            multiple={false}
            disabled={isBusy}
            validateFile={isSupportedRaster}
            onInvalidFiles={() => {
              setMessage(`Please choose a PNG, JPG or WebP image up to ${MAX_MB}MB.`);
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
          <p className="ux-wave4c-note">
            PNG, JPG or WebP — up to {MAX_MB}MB · Best for logos, icons and simple artwork
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
                  {hasResult ? "Vectorize another" : "Replace image"}
                </ActionButton>
                <ActionButton
                  size="lg"
                  className="ux-command-primary"
                  loading={!hasResult && isBusy}
                  disabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
                  onClick={() => {
                    if (hasResult) handleDownload();
                    else void handleVectorize();
                  }}
                >
                  {primaryLabel}
                </ActionButton>
              </div>
            </div>
            {hasResult && resultPreviewUrl ? (
              <div className="ux-4c-compare">
                {previewUrl ? (
                  <div>
                    <p className="ux-4c-kicker">Original</p>
                    <div className="ux-4c-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Original logo"
                        style={
                          naturalSize
                            ? { width: previewDisplayWidth(naturalSize.width, naturalSize.height, 420, 260) }
                            : undefined
                        }
                      />
                    </div>
                  </div>
                ) : null}
                <div>
                  <p className="ux-4c-kicker">SVG preview</p>
                  <div className="ux-4c-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={resultPreviewUrl}
                      alt="Vectorized SVG preview"
                      style={{
                        width: previewDisplayWidth(
                          stats?.width || naturalSize?.width || 240,
                          stats?.height || naturalSize?.height || 160,
                          420,
                          260,
                        ),
                      }}
                    />
                  </div>
                </div>
              </div>
            ) : previewUrl ? (
              <div className="ux-4c-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Logo preview"
                  style={
                    naturalSize
                      ? { width: previewDisplayWidth(naturalSize.width, naturalSize.height) }
                      : undefined
                  }
                />
              </div>
            ) : null}
            {hasResult && resultBlob && stats ? (
              <dl className="ux-4c-stats ux-4c-result text-sm">
                {naturalSize ? (
                  <div>
                    <dt className="text-scanonix-muted">Source</dt>
                    <dd className="font-semibold text-foreground">{naturalSize.width} × {naturalSize.height}px</dd>
                  </div>
                ) : null}
                {stats.width && stats.height ? (
                  <div>
                    <dt className="text-scanonix-muted">SVG size</dt>
                    <dd className="font-semibold text-foreground">{stats.width} × {stats.height}px</dd>
                  </div>
                ) : null}
                <div>
                  <dt className="text-scanonix-muted">Original file</dt>
                  <dd className="font-semibold text-foreground">{formatFileSize(stats.originalSize)}</dd>
                </div>
                <div>
                  <dt className="text-scanonix-muted">SVG file</dt>
                  <dd className="font-semibold text-foreground">{formatFileSize(stats.outputSize)}</dd>
                </div>
                {resultFileName ? (
                  <div>
                    <dt className="shrink-0 text-scanonix-muted">Filename</dt>
                    <dd className="min-w-0 truncate font-semibold text-foreground">{resultFileName}</dd>
                  </div>
                ) : null}
              </dl>
            ) : (
              <p className="ux-wave4c-hint">
                Turn logos and simple images into real SVG vector paths. Best for logos, icons and flat artwork. Photos may look noisy.
              </p>
            )}
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </div>
        </div>
      )}
    </div>
  );
}
