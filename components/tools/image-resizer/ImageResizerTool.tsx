"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Scaling } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
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

function ResizeDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <Scaling className={className} aria-hidden="true" strokeWidth={1.75} />;
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
  }, [clearResultPreview, file, height, width]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "resized.jpg",
      buildToolDownloadMeta("image-resizer", 1),
    );
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

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

  const outputFormat = formatFromFileName(resultFileName);
  const requestedWidth = width ? Number(width) : undefined;
  const requestedHeight = height ? Number(height) : undefined;
  const hasRequestedWidth =
    requestedWidth !== undefined && Number.isFinite(requestedWidth) && requestedWidth > 0;
  const hasRequestedHeight =
    requestedHeight !== undefined && Number.isFinite(requestedHeight) && requestedHeight > 0;

  const resizeHint = !file
    ? "Upload an image before resizing."
    : isBusy
      ? "Resizing on Scanonix servers…"
      : "Ready to resize within the requested dimensions.";

  return (
    <div className="space-y-5 overflow-x-hidden">
      <ToolStatusBanner status={status} message={message} />

      <ToolWorkspaceShell
        isEmpty={!file}
        empty={
          <>
            <FileDropZone
              accept={ACCEPT_IMAGES}
              multiple={false}
              label="Drop an image to resize"
              hint={`JPG, PNG, WEBP or HEIC — up to ${MAX_MB}MB`}
              disabled={isBusy}
              validateFile={isValidImageFile}
              icon={<ResizeDropIcon />}
              onInvalidFiles={() => {
                setMessage(`Please choose a supported image up to ${MAX_MB}MB.`);
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
                  setStatus("idle");
                  setMessage(undefined);
                }
              }}
            />
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </>
        }
        workArea={
          file ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <ResizeDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(file.size)}
                      {naturalSize
                        ? ` · ${naturalSize.width} × ${naturalSize.height}px`
                        : ""}
                    </p>
                  </div>
                </div>
                <div
                  className={
                    hasResult
                      ? "hidden w-full sm:w-auto md:block"
                      : "w-full sm:w-auto"
                  }
                >
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={resetTool}
                  >
                    {hasResult ? "Start over" : "Upload another"}
                  </ActionButton>
                </div>
              </div>

              <div className="bg-surface-muted/30 p-3 sm:p-4">
                {hasResult && resultPreviewUrl ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-scanonix-muted">
                      Output preview
                    </p>
                    <div className="overflow-hidden rounded-xl border border-scanonix-border bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={resultPreviewUrl}
                        alt="Resized image preview"
                        className="max-h-52 w-full object-contain sm:max-h-60"
                      />
                    </div>
                    {previewUrl ? (
                      <p className="truncate text-[11px] text-scanonix-muted">
                        Source
                        {naturalSize
                          ? `: ${naturalSize.width} × ${naturalSize.height}px`
                          : ""}
                        {" · "}
                        {formatFileSize(file.size)}
                      </p>
                    ) : null}
                  </div>
                ) : previewUrl ? (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-xl border border-scanonix-border bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-80 w-full object-contain"
                      />
                    </div>
                    {naturalSize ? (
                      <p className="text-sm text-scanonix-muted">
                        Original {naturalSize.width} × {naturalSize.height}px
                      </p>
                    ) : null}
                  </div>
                ) : null}
              </div>
            </div>
          ) : null
        }
        controlPanel={
          file ? (
            hasResult && resultBlob && stats ? (
              <aside
                aria-label="Image resizer result"
                className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)] lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:w-[320px] lg:shrink-0"
                data-tool-control-panel=""
              >
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3 sm:px-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      ✓ Resize complete
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-surface-muted/60 text-sm">
                    {naturalSize ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Original</dt>
                        <dd className="font-semibold text-foreground">
                          {naturalSize.width} × {naturalSize.height}px
                        </dd>
                      </div>
                    ) : null}
                    {hasRequestedWidth || hasRequestedHeight ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Requested</dt>
                        <dd className="font-semibold text-foreground">
                          {hasRequestedWidth ? requestedWidth : "—"} ×{" "}
                          {hasRequestedHeight ? requestedHeight : "—"}px
                        </dd>
                      </div>
                    ) : null}
                    {stats.width && stats.height ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Output</dt>
                        <dd className="font-semibold text-foreground">
                          {stats.width} × {stats.height}px
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Original size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(stats.originalSize)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Output size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(stats.outputSize)}
                      </dd>
                    </div>
                    {stats.outputSize < stats.originalSize ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Saved</dt>
                        <dd className="font-semibold text-foreground">
                          {Math.round(
                            ((stats.originalSize - stats.outputSize) /
                              stats.originalSize) *
                              100,
                          )}
                          % ·{" "}
                          {formatFileSize(stats.originalSize - stats.outputSize)}
                        </dd>
                      </div>
                    ) : null}
                    {outputFormat ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Output format</dt>
                        <dd className="font-semibold text-foreground">
                          {outputFormat}
                        </dd>
                      </div>
                    ) : null}
                    {resultFileName ? (
                      <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-1.5">
                        <dt className="shrink-0 text-scanonix-muted">Filename</dt>
                        <dd className="truncate font-semibold text-foreground">
                          {resultFileName}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  {stats.outputSize === stats.originalSize ? (
                    <div
                      className="rounded-lg border border-border bg-surface-muted/80 px-2.5 py-2"
                      role="status"
                    >
                      <p className="text-sm font-medium text-foreground">
                        No size reduction
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-scanonix-muted">
                        Resize changes dimensions; file size may stay similar.
                      </p>
                    </div>
                  ) : null}
                  {stats.outputSize > stats.originalSize ? (
                    <div
                      className="rounded-lg border border-border bg-surface-muted/80 px-2.5 py-2"
                      role="status"
                    >
                      <p className="text-sm font-medium text-foreground">
                        Output is larger
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-scanonix-muted">
                        {formatFileSize(stats.outputSize - stats.originalSize)}{" "}
                        larger than the original. Resize targets dimensions, not
                        compression.
                      </p>
                    </div>
                  ) : null}
                </div>

                <div className="hidden shrink-0 border-t border-border bg-surface-raised/80 px-3.5 py-2.5 sm:px-4 md:block">
                  <div className="flex flex-col gap-1.5">
                    <ActionButton
                      size="md"
                      className="w-full whitespace-nowrap"
                      disabled={isBusy}
                      onClick={handleDownload}
                    >
                      Download image
                    </ActionButton>
                    <ActionButton
                      variant="outline"
                      size="md"
                      className="w-full whitespace-nowrap"
                      disabled={isBusy}
                      onClick={resetTool}
                    >
                      Start over
                    </ActionButton>
                  </div>
                </div>
              </aside>
            ) : (
              <ToolControlPanel
                aria-label="Image resizer controls"
                footer={
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {resizeHint}
                    </p>
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isBusy}
                        disabled={!file || isBusy}
                        onClick={() => {
                          void handleResize();
                        }}
                      >
                        {isBusy ? "Resizing…" : "Resize image"}
                      </ActionButton>
                    </div>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <Scaling
                        className="h-4 w-4 text-scanonix-orange"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Resize image
                      </p>
                    </div>

                    <div className="mt-3 grid gap-3">
                      <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-foreground">
                          Width (px)
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={width}
                          onChange={(event) =>
                            handleWidthChange(event.target.value)
                          }
                          disabled={isBusy}
                          className="input-field"
                        />
                      </label>
                      <label className="block space-y-1.5">
                        <span className="text-sm font-medium text-foreground">
                          Height (px)
                        </span>
                        <input
                          type="number"
                          min={1}
                          max={10000}
                          value={height}
                          onChange={(event) =>
                            handleHeightChange(event.target.value)
                          }
                          disabled={isBusy}
                          className="input-field"
                        />
                      </label>
                      <label className="flex items-center gap-2 text-sm text-scanonix-muted">
                        <input
                          type="checkbox"
                          checked={lockAspect}
                          onChange={(event) =>
                            setLockAspect(event.target.checked)
                          }
                          disabled={isBusy}
                          className="accent-scanonix-orange"
                        />
                        Maintain aspect ratio
                      </label>
                      <p className="text-[11px] leading-snug text-scanonix-muted">
                        Image fits within the requested dimensions.
                      </p>
                    </div>
                  </div>

                  <div className="border-t border-border/80 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Summary
                    </p>
                    <dl className="mt-2 space-y-2 text-sm">
                      {naturalSize ? (
                        <div className="flex justify-between gap-3">
                          <dt className="text-scanonix-muted">Original</dt>
                          <dd className="font-medium text-foreground">
                            {naturalSize.width} × {naturalSize.height}px
                          </dd>
                        </div>
                      ) : null}
                      {(hasRequestedWidth || hasRequestedHeight) && (
                        <div className="flex justify-between gap-3">
                          <dt className="text-scanonix-muted">Requested</dt>
                          <dd className="font-medium text-foreground">
                            {hasRequestedWidth ? requestedWidth : "—"} ×{" "}
                            {hasRequestedHeight ? requestedHeight : "—"}px
                          </dd>
                        </div>
                      )}
                      <div className="flex justify-between gap-3">
                        <dt className="text-scanonix-muted">Aspect ratio</dt>
                        <dd className="font-medium text-foreground">
                          {lockAspect ? "Locked" : "Unlocked"}
                        </dd>
                      </div>
                    </dl>
                  </div>

                  <div className="border-t border-border/80 pt-3">
                    <p className="mb-2 text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Privacy
                    </p>
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </div>
                </div>
              </ToolControlPanel>
            )
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={Boolean(file)}
        phase={resultActionPhase}
        primaryLabel={hasResult ? "Download image" : "Resize image"}
        primaryLoading={!hasResult && isBusy}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => {
          if (hasResult) {
            handleDownload();
          } else {
            void handleResize();
          }
        }}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
