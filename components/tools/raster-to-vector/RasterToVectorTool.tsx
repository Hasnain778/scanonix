"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PenTool } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import "@/styles/image-conversion-premium.css";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import { VECTORIZE_MAX_BYTES } from "@/lib/design/vectorize/types";
import {
  RASTER_COLOR_COUNTS,
  RASTER_DEFAULTS,
  RASTER_DETAIL_LEVELS,
  RASTER_SMOOTHING_LEVELS,
  type RasterColorCount,
  type RasterDetailLevel,
  type RasterSmoothingLevel,
} from "@/lib/design/vectorize/raster-to-vector-options";
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

type AppliedSettings = {
  colorCount: RasterColorCount;
  detail: RasterDetailLevel;
  smoothing: RasterSmoothingLevel;
  ignoreBackground: boolean;
};

function isSupportedRaster(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_BYTES) return false;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXT.has(ext)) return true;
  const type = file.type.toLowerCase();
  return type === "image/jpeg" || type === "image/png" || type === "image/webp";
}

function ConvertDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <PenTool className={className} aria-hidden="true" strokeWidth={1.75} />;
}

function FieldLabel({
  htmlFor,
  children,
  hint,
}: {
  htmlFor: string;
  children: string;
  hint: string;
}) {
  return (
    <div className="space-y-1">
      <label htmlFor={htmlFor} className="text-sm font-semibold text-foreground">
        {children}
      </label>
      <p className="text-[11px] leading-snug text-scanonix-muted">{hint}</p>
    </div>
  );
}

const selectClassName =
  "mt-1.5 w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-foreground outline-none focus-visible:border-scanonix-orange focus-visible:ring-2 focus-visible:ring-scanonix-orange/25";

export function RasterToVectorTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [naturalSize, setNaturalSize] = useState<{ width: number; height: number }>();
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultFileName, setResultFileName] = useState<string>();
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string>();
  const [stats, setStats] = useState<Stats>();
  const [appliedSettings, setAppliedSettings] = useState<AppliedSettings>();
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();
  const [colorCount, setColorCount] = useState<RasterColorCount>(RASTER_DEFAULTS.colorCount);
  const [detail, setDetail] = useState<RasterDetailLevel>(RASTER_DEFAULTS.detail);
  const [smoothing, setSmoothing] = useState<RasterSmoothingLevel>(
    RASTER_DEFAULTS.smoothing,
  );
  const [ignoreBackground, setIgnoreBackground] = useState<boolean>(
    RASTER_DEFAULTS.ignoreBackground,
  );
  const [settingsOpen, setSettingsOpen] = useState(true);
  const previewUrlRef = useRef<string | undefined>(undefined);
  const resultPreviewUrlRef = useRef<string | undefined>(undefined);

  const isBusy = status === "loading";
  const hasResult = status === "success" && resultBlob !== null;

  const resetControlsToDefaults = useCallback(() => {
    setColorCount(RASTER_DEFAULTS.colorCount);
    setDetail(RASTER_DEFAULTS.detail);
    setSmoothing(RASTER_DEFAULTS.smoothing);
    setIgnoreBackground(RASTER_DEFAULTS.ignoreBackground);
    setSettingsOpen(true);
  }, []);

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

  const handleConvert = useCallback(async () => {
    if (!file || isBusy) return;

    const attempt = createProcessAttempt("raster-to-vector");
    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setMessage("Tracing raster into vector paths…");
    setResultBlob(null);
    clearResultPreview();
    setStats(undefined);
    setAppliedSettings(undefined);

    const formData = new FormData();
    formData.append("file", file);
    formData.append("colorCount", String(colorCount));
    formData.append("detail", detail);
    formData.append("smoothing", smoothing);
    formData.append("ignoreBackground", ignoreBackground ? "true" : "false");

    const result = await submitImageToolForm("/api/tools/raster-to-vector", formData);
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
    setAppliedSettings({
      colorCount,
      detail,
      smoothing,
      ignoreBackground,
    });
    attempt.success(1);
    setStatus("success");
    setMessage("Vector ready!");
  }, [
    clearResultPreview,
    colorCount,
    detail,
    file,
    ignoreBackground,
    isBusy,
    smoothing,
  ]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "raster-vector.svg",
      buildToolDownloadMeta("raster-to-vector", 1),
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
    setAppliedSettings(undefined);
    setStatus("idle");
    setMessage(undefined);
    resetControlsToDefaults();
  }, [clearResultPreview, resetControlsToDefaults, setFilePreview]);

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

  const settingsControls = (
    <div className="space-y-3.5">
      <div>
        <FieldLabel
          htmlFor="raster-colors"
          hint="How many colors to keep in the vector."
        >
          Colors
        </FieldLabel>
        <select
          id="raster-colors"
          className={selectClassName}
          value={colorCount}
          disabled={isBusy || hasResult}
          onChange={(event) =>
            setColorCount(Number(event.target.value) as RasterColorCount)
          }
        >
          {RASTER_COLOR_COUNTS.map((count) => (
            <option key={count} value={count}>
              {count}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel
          htmlFor="raster-detail"
          hint="Higher detail keeps more small shapes; lower detail simplifies the result."
        >
          Detail
        </FieldLabel>
        <select
          id="raster-detail"
          className={selectClassName}
          value={detail}
          disabled={isBusy || hasResult}
          onChange={(event) => setDetail(event.target.value as RasterDetailLevel)}
        >
          {RASTER_DETAIL_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div>
        <FieldLabel
          htmlFor="raster-smoothing"
          hint="Adjust edge smoothing. Softer settings can reduce jagged edges but may lose fine accuracy."
        >
          Smoothing
        </FieldLabel>
        <select
          id="raster-smoothing"
          className={selectClassName}
          value={smoothing}
          disabled={isBusy || hasResult}
          onChange={(event) =>
            setSmoothing(event.target.value as RasterSmoothingLevel)
          }
        >
          {RASTER_SMOOTHING_LEVELS.map((level) => (
            <option key={level} value={level}>
              {level}
            </option>
          ))}
        </select>
      </div>

      <div className="rounded-lg border border-border/80 bg-surface-muted/40 px-3 py-2.5">
        <label className="flex cursor-pointer items-start gap-3">
          <input
            type="checkbox"
            className="mt-0.5 h-4 w-4 rounded border-border text-scanonix-orange focus-visible:ring-scanonix-orange/30"
            checked={ignoreBackground}
            disabled={isBusy || hasResult}
            onChange={(event) => setIgnoreBackground(event.target.checked)}
          />
          <span className="min-w-0">
            <span className="block text-sm font-semibold text-foreground">
              Ignore background
            </span>
            <span className="mt-0.5 block text-[11px] leading-snug text-scanonix-muted">
              Remove a flat white or transparent background when possible.
            </span>
          </span>
        </label>
      </div>
    </div>
  );

  return (
    <div className="image-conversion-premium space-y-5 overflow-x-hidden">
      <ToolStatusBanner status={status} message={message} />
      <ToolWorkspaceShell
        isEmpty={!file}
        empty={
          <>
            <FileDropZone
              className="image-conv-drop"
              accept={ACCEPT_IMAGES}
              multiple={false}
              label="Drop a raster image to vectorize"
              hint={`PNG, JPG or WebP \u2014 up to ${MAX_MB}MB \u00B7 Adjust colors, detail, smoothing and background`}
              disabled={isBusy}
              validateFile={isSupportedRaster}
              icon={<ConvertDropIcon />}
              onInvalidFiles={() => {
                setMessage(`Please choose a PNG, JPG or WebP image up to ${MAX_MB}MB.`);
                setStatus("error");
              }}
              onFilesSelected={(files) => {
                const image = files[0];
                if (image) {
                  setFilePreview(image);
                  setFile(image);
                  setResultBlob(null);
                  clearResultPreview();
                  setResultFileName(undefined);
                  setStats(undefined);
                  setAppliedSettings(undefined);
                  setStatus("idle");
                  setMessage(undefined);
                  setSettingsOpen(true);
                }
              }}
            />
            <div className="image-conv-privacy">
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </>
        }
        workArea={
          file ? (
            <div className="image-conv-split">
              <div className="min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center text-scanonix-orange">
                      <ConvertDropIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">{file.name}</p>
                      <p className="truncate text-xs text-scanonix-muted">
                        {formatFileSize(file.size)}
                        {naturalSize ? ` \u00B7 ${naturalSize.width} \u00D7 ${naturalSize.height}px` : ""}
                      </p>
                    </div>
                  </div>
                  <div className={hasResult ? "hidden shrink-0 lg:block" : "shrink-0"}>
                    <ActionButton variant="outline" size="sm" className="rounded-lg" disabled={isBusy} onClick={resetTool}>
                      {hasResult ? "Convert another" : "Replace image"}
                    </ActionButton>
                  </div>
                </div>
                {hasResult && resultPreviewUrl ? (
                  <div className="image-conv-compare">
                    {previewUrl ? (
                      <div>
                        <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">Original</p>
                        <div className="image-conv-preview">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={previewUrl} alt="Original image" />
                        </div>
                      </div>
                    ) : null}
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">Vector preview</p>
                      <div className="image-conv-preview">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={resultPreviewUrl} alt="Converted vector preview" />
                      </div>
                    </div>
                  </div>
                ) : previewUrl ? (
                  <div className="image-conv-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="Image preview" />
                  </div>
                ) : null}
              </div>
              <div className="min-w-0">
                {hasResult && resultBlob && stats ? (
                  <div className="space-y-4">
                    <dl className="image-conv-stats text-sm">
                      {naturalSize ? (
                        <div>
                          <dt className="text-scanonix-muted">Source</dt>
                          <dd className="font-semibold text-foreground">{naturalSize.width} {"\u00D7"} {naturalSize.height}px</dd>
                        </div>
                      ) : null}
                      {stats.width && stats.height ? (
                        <div>
                          <dt className="text-scanonix-muted">SVG size</dt>
                          <dd className="font-semibold text-foreground">{stats.width} {"\u00D7"} {stats.height}px</dd>
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
                      {appliedSettings ? (
                        <>
                          <div>
                            <dt className="text-scanonix-muted">Colors</dt>
                            <dd className="font-semibold text-foreground">{appliedSettings.colorCount}</dd>
                          </div>
                          <div>
                            <dt className="text-scanonix-muted">Detail</dt>
                            <dd className="font-semibold text-foreground">{appliedSettings.detail}</dd>
                          </div>
                          <div>
                            <dt className="text-scanonix-muted">Smoothing</dt>
                            <dd className="font-semibold text-foreground">{appliedSettings.smoothing}</dd>
                          </div>
                          <div>
                            <dt className="text-scanonix-muted">Background</dt>
                            <dd className="font-semibold text-foreground">
                              {appliedSettings.ignoreBackground ? "Ignore" : "Keep"}
                            </dd>
                          </div>
                        </>
                      ) : null}
                    </dl>
                    <div className="hidden lg:block">
                      <ActionButton size="lg" className="h-12 w-full shadow-[var(--shadow-orange-sm)]" onClick={handleDownload}>
                        Download SVG
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {settingsControls}
                    <div className="hidden lg:block">
                      <ActionButton
                        size="lg"
                        className="h-12 w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isBusy}
                        disabled={!file || isBusy}
                        onClick={() => { void handleConvert(); }}
                      >
                        {isBusy ? "Converting\u2026" : "Convert to Vector"}
                      </ActionButton>
                    </div>
                  </div>
                )}
                <div className="image-conv-privacy mt-4">
                  <PrivacyNotice message={PRIVACY_MESSAGE} />
                </div>
              </div>
            </div>
          ) : null
        }
      />
      <ToolStickyMobileActionBar
        visible={Boolean(file)}
        stickyUntil="lg"
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download SVG" : "Convert to Vector"}
        primaryLoading={!hasResult && isBusy}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => { if (hasResult) handleDownload(); else void handleConvert(); }}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Convert another"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
