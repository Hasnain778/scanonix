"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
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
  "Images are uploaded to Scanonix for processing and deleted after processing.";

function isValidImageFile(file: File): boolean {
  return file.size > 0 && file.size <= FREE_IMAGE_MAX_BYTES;
}

function CompressDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <ImageIcon className={className} aria-hidden="true" strokeWidth={1.75} />;
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

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

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
  }, [file, quality]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "compressed.jpg",
      buildToolDownloadMeta("image-compressor", 1),
    );
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

  const compressHint = !file
    ? "Upload an image before compressing."
    : isBusy
      ? "Compressing on Scanonix servers…"
      : `Ready to compress at ${quality}% · ${qualityLabel}.`;

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
              label="Drop an image to compress"
              hint={`JPG, PNG, WEBP or HEIC — up to ${MAX_MB}MB`}
              disabled={isBusy}
              validateFile={isValidImageFile}
              icon={<CompressDropIcon />}
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
                    <CompressDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(file.size)}
                      {stats?.width && stats?.height
                        ? ` · ${stats.width} × ${stats.height}px`
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

              {previewUrl ? (
                <div className="bg-surface-muted/30 p-3 sm:p-4">
                  <div className="overflow-hidden rounded-xl border border-scanonix-border bg-black/30">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt="Preview"
                      className={`w-full object-contain ${
                        hasResult ? "max-h-52 sm:max-h-60" : "max-h-80"
                      }`}
                    />
                  </div>
                </div>
              ) : null}
            </div>
          ) : null
        }
        controlPanel={
          file ? (
            hasResult && resultBlob && stats ? (
              <aside
                aria-label="Image compressor result"
                className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)] lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:w-[320px] lg:shrink-0"
                data-tool-control-panel=""
              >
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3 sm:px-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      ✓ Compression complete
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Original size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(stats.originalSize)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">
                        {stats.outputSize < stats.originalSize
                          ? "Compressed size"
                          : "Output size"}
                      </dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(stats.outputSize)}
                      </dd>
                    </div>
                    {stats.outputSize < stats.originalSize &&
                    savingsPercent != null &&
                    savingsPercent > 0 ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Saved</dt>
                        <dd className="font-semibold text-foreground">
                          {savingsPercent}% ·{" "}
                          {formatFileSize(stats.originalSize - stats.outputSize)}
                        </dd>
                      </div>
                    ) : null}
                    {stats.width && stats.height ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Dimensions</dt>
                        <dd className="font-semibold text-foreground">
                          {stats.width} × {stats.height}px
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

                  {stats.outputSize >= stats.originalSize ? (
                    <div
                      className="rounded-lg border border-border bg-surface-muted/80 px-2.5 py-2"
                      role="status"
                    >
                      <p className="text-sm font-medium text-foreground">
                        No size reduction
                      </p>
                      <p className="mt-0.5 text-[11px] leading-snug text-scanonix-muted">
                        This image was already efficiently compressed.
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
                aria-label="Image compressor controls"
                footer={
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {compressHint}
                    </p>
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isBusy}
                        disabled={!file || isBusy}
                        onClick={() => {
                          void handleCompress();
                        }}
                      >
                        {isBusy ? "Compressing…" : "Compress image"}
                      </ActionButton>
                    </div>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <ImageIcon
                        className="h-4 w-4 text-scanonix-orange"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Quality
                      </p>
                    </div>
                    <div className="mt-3 flex items-center justify-between gap-3">
                      <label
                        htmlFor="compress-quality"
                        className="text-sm font-medium text-foreground"
                      >
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
                      className="mt-4 w-full accent-scanonix-orange"
                    />
                  </div>

                  <div className="border-t border-border/80 pt-3">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Summary
                    </p>
                    <dl className="mt-2 space-y-2 text-sm">
                      <div className="flex justify-between gap-3">
                        <dt className="text-scanonix-muted">File</dt>
                        <dd className="max-w-[55%] truncate font-medium text-foreground">
                          {file.name}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-scanonix-muted">Original size</dt>
                        <dd className="font-medium text-foreground">
                          {formatFileSize(file.size)}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3">
                        <dt className="text-scanonix-muted">Quality</dt>
                        <dd className="font-medium text-foreground">
                          {quality}% · {qualityLabel}
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
        primaryLabel={hasResult ? "Download image" : "Compress image"}
        primaryLoading={!hasResult && isBusy}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => {
          if (hasResult) {
            handleDownload();
          } else {
            void handleCompress();
          }
        }}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
