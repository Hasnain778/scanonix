"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageIcon } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import "@/styles/image-processing-premium.css";
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

  return (
    <div className="image-processing-premium space-y-5 overflow-x-hidden">
      <ToolStatusBanner status={status} message={message} />

      <ToolWorkspaceShell
        isEmpty={!file}
        empty={
          <>
            <FileDropZone
              className="image-proc-drop"
              accept={ACCEPT_IMAGES}
              multiple={false}
              label="Drop an image to compress"
              hint={`JPG, PNG, WEBP or HEIC \u2014 up to ${MAX_MB}MB`}
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
            <div className="image-proc-privacy">
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </>
        }
        workArea={
          file ? (
            <div className="image-proc-layout">
              <div className="image-proc-stage min-w-0">
                <div className="flex items-center justify-between gap-3">
                  <div className="flex min-w-0 items-center gap-3">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center text-scanonix-orange">
                      <CompressDropIcon className="h-4 w-4" />
                    </div>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold text-foreground">
                        {file.name}
                      </p>
                      <p className="truncate text-xs text-scanonix-muted">
                        {formatFileSize(file.size)}
                        {stats?.width && stats?.height
                          ? ` \u00B7 ${stats.width} \u00D7 ${stats.height}px`
                          : ""}
                      </p>
                    </div>
                  </div>
                  <div className={hasResult ? "hidden shrink-0 lg:block" : "shrink-0"}>
                    <ActionButton
                      variant="outline"
                      size="sm"
                      className="rounded-lg"
                      disabled={isBusy}
                      onClick={resetTool}
                    >
                      {hasResult ? "Start over" : "Choose another image"}
                    </ActionButton>
                  </div>
                </div>

                {previewUrl ? (
                  <div className="image-proc-preview">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={previewUrl} alt="" />
                  </div>
                ) : null}
              </div>

              <div className="image-proc-controls min-w-0">
                {hasResult && resultBlob && stats ? (
                  <div className="space-y-4">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
                      Result
                    </p>
                    <dl className="image-proc-stats text-sm">
                      <div>
                        <dt className="text-scanonix-muted">Original size</dt>
                        <dd className="font-semibold text-foreground">
                          {formatFileSize(stats.originalSize)}
                        </dd>
                      </div>
                      <div>
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
                        <div>
                          <dt className="text-scanonix-muted">Saved</dt>
                          <dd className="font-semibold text-foreground">
                            {savingsPercent}%{" \u00B7 "}
                            {formatFileSize(stats.originalSize - stats.outputSize)}
                          </dd>
                        </div>
                      ) : null}
                      {stats.width && stats.height ? (
                        <div>
                          <dt className="text-scanonix-muted">Dimensions</dt>
                          <dd className="font-semibold text-foreground">
                            {stats.width} {"\u00D7"} {stats.height}px
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
                          <dd className="min-w-0 truncate font-semibold text-foreground">
                            {resultFileName}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                    {stats.outputSize >= stats.originalSize ? (
                      <p className="text-sm leading-relaxed text-foreground" role="status">
                        No size reduction. This image was already efficiently compressed.
                      </p>
                    ) : null}
                    <div className="hidden lg:block">
                      <ActionButton
                        size="lg"
                        className="h-12 w-full shadow-[var(--shadow-orange-sm)]"
                        disabled={isBusy}
                        onClick={handleDownload}
                      >
                        Download image
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
                        Quality
                      </p>
                      <div className="mt-3 flex items-center justify-between gap-3">
                        <label htmlFor="compress-quality" className="text-sm font-medium text-foreground">
                          Quality
                        </label>
                        <span className="text-sm text-scanonix-orange">
                          {quality}%{" \u00B7 "}
                          {qualityLabel}
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
                    <div className="hidden lg:block">
                      <ActionButton
                        size="lg"
                        className="h-12 w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isBusy}
                        disabled={!file || isBusy}
                        onClick={() => {
                          void handleCompress();
                        }}
                      >
                        {isBusy ? "Compressing\u2026" : "Compress image"}
                      </ActionButton>
                    </div>
                  </div>
                )}
                <div className="image-proc-privacy mt-4">
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
        primaryLabel={
          hasResult ? "Download image" : isBusy ? "Compressing\u2026" : "Compress image"
        }
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
