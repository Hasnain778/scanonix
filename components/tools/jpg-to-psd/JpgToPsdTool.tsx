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

const ACCEPT_IMAGES = ".jpg,.jpeg,image/jpeg";
const MAX_BYTES = FREE_IMAGE_MAX_BYTES;
const MAX_MB = Math.round(MAX_BYTES / (1024 * 1024));
const PRIVACY_MESSAGE =
  "Images are processed on Scanonix servers and deleted after processing.";

const ALLOWED_EXT = new Set(["jpg", "jpeg"]);

function isSupportedJpeg(file: File): boolean {
  if (file.size <= 0 || file.size > MAX_BYTES) return false;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  if (ALLOWED_EXT.has(ext)) return true;
  const type = file.type.toLowerCase();
  return type === "image/jpeg" || type === "image/jpg";
}

function ConvertDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <ImageIcon className={className} aria-hidden="true" strokeWidth={1.75} />;
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

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

  return (
    <div
      className={`space-y-5 overflow-x-hidden md:pb-0 ${
        // Mobile-only bottom room so the result card can scroll fully above the
        // fixed Download / Convert another bar. Desktop (md+) stays flush.
        file ? (hasResult ? "pb-40 md:pb-0" : "pb-4 md:pb-0") : ""
      }`}
    >
      <ToolStatusBanner status={status} message={message} />

      <ToolWorkspaceShell
        isEmpty={!file}
        empty={
          <>
            <FileDropZone
              accept={ACCEPT_IMAGES}
              multiple={false}
              label="Drop a JPG to convert"
              hint={`JPG or JPEG — up to ${MAX_MB}MB · Output is a single raster layer PSD`}
              disabled={isBusy}
              validateFile={isSupportedJpeg}
              icon={<ConvertDropIcon />}
              onInvalidFiles={() => {
                setMessage(`Please choose a JPG/JPEG image up to ${MAX_MB}MB.`);
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
            <div className="pr-32 sm:pr-40 lg:pr-0">
              <p className="mb-3 text-sm text-scanonix-muted">
                Convert JPG images into PSD files with your image on a single raster
                layer. JPG files do not contain editable Photoshop layers, text, or
                smart objects, so those cannot be reconstructed.
              </p>
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </>
        }
        workArea={
          file ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5 pr-28 sm:pr-0 lg:pr-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <ConvertDropIcon className="h-4 w-4" />
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
                    {hasResult ? "Convert another" : "Replace image"}
                  </ActionButton>
                </div>
              </div>

              {/*
                Mobile Tools FAB clearance: pr-32 / sm:pr-40; explicit pl/pr only.
              */}
              <div className="bg-surface-muted/30 pb-3 pl-3 pr-32 pt-3 sm:pb-4 sm:pl-4 sm:pr-40 sm:pt-4 lg:pr-4">
                {previewUrl ? (
                  <div className="space-y-2">
                    <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-scanonix-muted">
                      Original
                    </p>
                    <div className="overflow-hidden rounded-xl border border-scanonix-border bg-[var(--surface-muted)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Original JPG preview"
                        className="max-h-80 w-full object-contain"
                      />
                    </div>
                    <p className="text-sm text-scanonix-muted">
                      Convert JPG images into PSD files with your image on a single
                      raster layer.
                    </p>
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
                aria-label="JPG to PSD result"
                className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)] max-md:mb-36 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:mb-0 lg:w-[320px] lg:shrink-0"
                data-tool-control-panel=""
              >
                {/*
                  Mobile: extra right pad clears Tools FAB over metadata values;
                  keep lg:pr-4 so desktop result rail matches approved layout.
                */}
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain py-3 pl-3.5 pr-40 sm:py-3 sm:pl-4 sm:pr-44 lg:pl-4 lg:pr-4">
                  <div className="pr-2 lg:pr-0">
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      ✓ PSD ready
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-surface-muted/60 text-sm">
                    {naturalSize ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Source</dt>
                        <dd className="min-w-0 break-words text-right font-semibold text-foreground">
                          {naturalSize.width} × {naturalSize.height}px
                        </dd>
                      </div>
                    ) : null}
                    {stats.width && stats.height ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">PSD size</dt>
                        <dd className="min-w-0 break-words text-right font-semibold text-foreground">
                          {stats.width} × {stats.height}px
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Original file</dt>
                      <dd className="min-w-0 break-words text-right font-semibold text-foreground">
                        {formatFileSize(stats.originalSize)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">PSD file</dt>
                      <dd className="min-w-0 break-words text-right font-semibold text-foreground">
                        {formatFileSize(stats.outputSize)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Color mode</dt>
                      <dd className="min-w-0 break-words text-right font-semibold text-foreground">
                        RGB 8-bit
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Layers</dt>
                      <dd className="min-w-0 break-words text-right font-semibold text-foreground">
                        1 raster layer
                      </dd>
                    </div>
                    {resultFileName ? (
                      <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-1.5">
                        <dt className="shrink-0 text-scanonix-muted">Filename</dt>
                        <dd className="min-w-0 truncate text-right font-semibold text-foreground">
                          {resultFileName}
                        </dd>
                      </div>
                    ) : null}
                  </dl>

                  <p className="pr-2 text-[11px] leading-snug text-scanonix-muted lg:pr-0">
                    JPG files do not contain editable Photoshop layers, text, or smart
                    objects, so those cannot be reconstructed.
                  </p>
                </div>

                <div className="hidden shrink-0 space-y-2 border-t border-border bg-surface-muted/50 px-3.5 py-3 sm:block sm:px-4">
                  <ActionButton
                    variant="primary"
                    size="md"
                    className="w-full rounded-xl"
                    onClick={handleDownload}
                  >
                    Download PSD
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="md"
                    className="w-full rounded-xl"
                    onClick={resetTool}
                  >
                    Convert another
                  </ActionButton>
                </div>
              </aside>
            ) : (
              <ToolControlPanel
                aria-label="JPG to PSD controls"
                footer={
                  <div className="flex flex-col gap-2 pr-32 sm:pr-40 lg:pr-0">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      Output is a standard PSD with one raster layer — not editable
                      design layers recovered from the JPG.
                    </p>
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isBusy}
                        disabled={!file || isBusy}
                        onClick={() => {
                          void handleConvert();
                        }}
                      >
                        {isBusy ? "Converting…" : "Convert to PSD"}
                      </ActionButton>
                    </div>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div className="pr-32 sm:pr-40 lg:pr-0">
                    <div className="flex items-center gap-2">
                      <ImageIcon
                        className="h-4 w-4 text-scanonix-orange"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        JPG to PSD
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-scanonix-muted">
                      Convert JPG images into PSD files with your image on a single
                      raster layer.
                    </p>
                  </div>
                  <div className="border-t border-border/80 pt-3 pr-32 sm:pr-40 lg:pr-0">
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
        primaryLabel={hasResult ? "Download PSD" : "Convert to PSD"}
        primaryLoading={!hasResult && isBusy}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => {
          if (hasResult) {
            handleDownload();
          } else {
            void handleConvert();
          }
        }}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Convert another"
        startOverDisabled={isBusy}
        secondaryLabel={!hasResult && file ? "Replace image" : undefined}
        onSecondaryClick={!hasResult && file ? resetTool : undefined}
      />
    </div>
  );
}
