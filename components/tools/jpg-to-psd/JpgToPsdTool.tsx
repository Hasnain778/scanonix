"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumFileSelect } from "@/components/tools/premium/PremiumFileSelect";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import "@/styles/ux-reset-file-pair.css";
import "@/styles/ux-wave4b.css";
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

const ACCEPT_IMAGES = ".jpg,.jpeg,image/jpeg";
const MAX_BYTES = FREE_IMAGE_MAX_BYTES;
const MAX_MB = Math.round(MAX_BYTES / (1024 * 1024));
const PRIVACY_MESSAGE =
  "Images are processed on Scanonix servers and deleted after processing.";

const ALLOWED_EXT = new Set(["jpg", "jpeg"]);
const PREVIEW_MAX_WIDTH = 480;
const PREVIEW_MAX_HEIGHT = 320;
const PREVIEW_MIN_LONG_SIDE = 240;

/** Scale a small image up to a readable size without exceeding the preview box. */
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

function isSupportedJpeg(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_BYTES) return false;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXT.has(ext)) return true;
  const type = file.type.toLowerCase();
  return type === "image/jpeg" || type === "image/jpg";
}

export function JpgToPsdTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
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
    };
    img.src = url;
  }, []);

  useEffect(() => {
    return () => {
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
    };
  }, []);

  const handleConvert = useCallback(async () => {
    if (!file || isBusy) return;

    const attempt = createProcessAttempt("jpg-to-psd");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage("Converting JPG into a PSD file…");
    setResultBlob(null);
    setStats(undefined);

    const formData = new FormData();
    formData.append("file", file);

    const result = await submitImageToolForm("/api/tools/jpg-to-psd", formData);
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
    setMessage("PSD ready!");
  }, [file, isBusy]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "image.psd",
      buildToolDownloadMeta("jpg-to-psd", 1),
    );
    setStatus("success");
    setMessage("PSD downloaded successfully!");
  }, [resultBlob, resultFileName]);

  const resetTool = useCallback(() => {
    setFilePreview(null);
    setFile(null);
    setResultBlob(null);
    setResultFileName(undefined);
    setStats(undefined);
    setStatus("idle");
    setMessage(undefined);
  }, [setFilePreview]);

  const primaryLabel = hasResult
    ? "Download PSD"
    : isBusy
      ? "Converting…"
      : "Convert to PSD";

  return (
    <div className="ux-wave4b overflow-x-hidden">
      <div className="ux-wave4b-banner">
        <ToolStatusBanner status={status} message={message} />
      </div>

      {!file ? (
        <div data-tool-workspace="empty">
          <PremiumFileSelect
            fromLabel="JPG"
            toLabel="PSD"
            buttonLabel="Upload a JPG"
            prompt="Upload or drag a JPG here."
            formats="JPG, JPEG"
            accept={ACCEPT_IMAGES}
            multiple={false}
            disabled={isBusy}
            validateFile={isSupportedJpeg}
            onInvalidFiles={() => {
              setMessage(`Please choose a JPG/JPEG image up to ${MAX_MB}MB.`);
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
          <p className="ux-wave4b-note">
            JPG — up to {MAX_MB}MB · Output is a single raster layer PSD
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
                  {hasResult ? "Convert another" : "Replace image"}
                </ActionButton>
                <ActionButton
                  size="lg"
                  className="ux-command-primary"
                  loading={isBusy && !hasResult}
                  disabled={hasResult ? !resultBlob : !file || isBusy}
                  onClick={() => {
                    if (hasResult) handleDownload();
                    else void handleConvert();
                  }}
                >
                  {primaryLabel}
                </ActionButton>
              </div>
            </div>

            {previewUrl ? (
              <div className="ux-preview-stage ux-psd-preview">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Original JPG preview"
                  style={
                    naturalSize
                      ? { width: previewDisplayWidth(naturalSize.width, naturalSize.height) }
                      : undefined
                  }
                />
              </div>
            ) : null}

            {hasResult && resultBlob && stats ? (
              <div className="space-y-4 px-1">
                <dl className="ux-wave4b-stats text-sm">
                  {naturalSize ? (
                    <div>
                      <dt className="text-scanonix-muted">Source</dt>
                      <dd className="font-semibold text-foreground">
                        {naturalSize.width} × {naturalSize.height}px
                      </dd>
                    </div>
                  ) : null}
                  {stats.width && stats.height ? (
                    <div>
                      <dt className="text-scanonix-muted">PSD size</dt>
                      <dd className="font-semibold text-foreground">
                        {stats.width} × {stats.height}px
                      </dd>
                    </div>
                  ) : null}
                  <div>
                    <dt className="text-scanonix-muted">Original file</dt>
                    <dd className="font-semibold text-foreground">{formatFileSize(stats.originalSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">PSD file</dt>
                    <dd className="font-semibold text-foreground">{formatFileSize(stats.outputSize)}</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Color mode</dt>
                    <dd className="font-semibold text-foreground">RGB 8-bit</dd>
                  </div>
                  <div>
                    <dt className="text-scanonix-muted">Layers</dt>
                    <dd className="font-semibold text-foreground">1 raster layer</dd>
                  </div>
                  {resultFileName ? (
                    <div>
                      <dt className="shrink-0 text-scanonix-muted">Filename</dt>
                      <dd className="min-w-0 truncate font-semibold text-foreground">{resultFileName}</dd>
                    </div>
                  ) : null}
                </dl>
                <p className="text-sm leading-relaxed text-scanonix-muted">
                  JPG files do not contain editable Photoshop layers, text, or smart objects, so those cannot be reconstructed.
                </p>
              </div>
            ) : (
              <p className="px-1 text-sm leading-relaxed text-foreground">
                Convert JPG images into PSD files with your image on a single raster layer. Output is a standard PSD with one raster layer, not editable design layers recovered from the JPG.
              </p>
            )}

            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </div>
        </div>
      )}
    </div>
  );
}
