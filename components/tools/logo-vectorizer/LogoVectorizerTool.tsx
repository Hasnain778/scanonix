"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { PenLine } from "lucide-react";
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

function VectorizeDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <PenLine className={className} aria-hidden="true" strokeWidth={1.75} />;
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
        file ? (hasResult ? "pb-8" : "pb-4") : ""
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
              label="Drop a logo to vectorize"
              hint={`PNG, JPG or WebP — up to ${MAX_MB}MB · Best for logos, icons and simple artwork`}
              disabled={isBusy}
              validateFile={isSupportedRaster}
              icon={<VectorizeDropIcon />}
              onInvalidFiles={() => {
                setMessage(
                  `Please choose a PNG, JPG or WebP image up to ${MAX_MB}MB.`,
                );
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
            {/* Right pad clears ToolFinder FAB on narrow screens */}
            <div className="pr-24 sm:pr-36 lg:pr-0">
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </>
        }
        workArea={
          file ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5 pr-16 sm:pr-0 lg:pr-0">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <VectorizeDropIcon className="h-4 w-4" />
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
                    {hasResult ? "Vectorize another" : "Replace image"}
                  </ActionButton>
                </div>
              </div>

              {/*
                ToolFinder FAB sits at fixed right-4 above the sticky CTA on mobile.
                Right pad keeps preview / guidance clear of the launcher through <lg.
              */}
              <div className="bg-surface-muted/30 p-3 pr-24 sm:p-4 sm:pr-36 lg:pr-4">
                {hasResult && resultPreviewUrl ? (
                  <div className="space-y-3">
                    <div className="grid gap-3 sm:grid-cols-2">
                      {previewUrl ? (
                        <div className="space-y-1.5">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-scanonix-muted">
                            Original
                          </p>
                          <div className="overflow-hidden rounded-xl border border-scanonix-border bg-[var(--surface-muted)]">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="Original logo"
                              className="max-h-52 w-full object-contain sm:max-h-60"
                            />
                          </div>
                        </div>
                      ) : null}
                      <div className="space-y-1.5">
                        <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-scanonix-muted">
                          SVG preview
                        </p>
                        <div className="overflow-hidden rounded-xl border border-scanonix-border bg-[var(--surface-muted)]">
                          {/* Object URL of server-generated SVG (not user markup). */}
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img
                            src={resultPreviewUrl}
                            alt="Vectorized SVG preview"
                            className="max-h-52 w-full object-contain sm:max-h-60"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                ) : previewUrl ? (
                  <div className="space-y-2">
                    <div className="overflow-hidden rounded-xl border border-scanonix-border bg-[var(--surface-muted)]">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Logo preview"
                        className="max-h-80 w-full object-contain"
                      />
                    </div>
                    <p className="text-sm text-scanonix-muted">
                      Best results come from simple logos and flat artwork.
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
                aria-label="Logo vectorizer result"
                className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)] max-md:mb-10 lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:mb-0 lg:w-[320px] lg:shrink-0"
                data-tool-control-panel=""
              >
                {/*
                  Extra bottom margin + right pad on mobile so result metadata can
                  scroll fully clear of sticky Download CTA and ToolFinder FAB.
                */}
                <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3 pr-24 sm:px-4 sm:pr-36 lg:pr-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1 text-sm font-semibold text-green-700">
                      ✓ SVG ready
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-surface-muted/60 text-sm">
                    {naturalSize ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Source</dt>
                        <dd className="font-semibold text-foreground">
                          {naturalSize.width} × {naturalSize.height}px
                        </dd>
                      </div>
                    ) : null}
                    {stats.width && stats.height ? (
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">SVG size</dt>
                        <dd className="font-semibold text-foreground">
                          {stats.width} × {stats.height}px
                        </dd>
                      </div>
                    ) : null}
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">Original file</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(stats.originalSize)}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-1.5">
                      <dt className="text-scanonix-muted">SVG file</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(stats.outputSize)}
                      </dd>
                    </div>
                    {resultFileName ? (
                      <div className="flex min-w-0 items-baseline justify-between gap-3 px-3 py-1.5">
                        <dt className="shrink-0 text-scanonix-muted">Filename</dt>
                        <dd className="truncate font-semibold text-foreground">
                          {resultFileName}
                        </dd>
                      </div>
                    ) : null}
                  </dl>
                </div>

                <div className="hidden shrink-0 space-y-2 border-t border-border bg-surface-muted/50 px-3.5 py-3 sm:block sm:px-4">
                  <ActionButton
                    variant="primary"
                    size="md"
                    className="w-full rounded-xl"
                    onClick={handleDownload}
                  >
                    Download SVG
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="md"
                    className="w-full rounded-xl"
                    onClick={resetTool}
                  >
                    Vectorize another
                  </ActionButton>
                </div>
              </aside>
            ) : (
              <ToolControlPanel
                aria-label="Logo Vectorizer controls"
                footer={
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      Best for logos, icons and flat artwork. Photos may look noisy.
                    </p>
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full shadow-[var(--shadow-orange-sm)]"
                        loading={isBusy}
                        disabled={!file || isBusy}
                        onClick={() => {
                          void handleVectorize();
                        }}
                      >
                        {isBusy ? "Vectorizing…" : "Vectorize Logo"}
                      </ActionButton>
                    </div>
                  </div>
                }
              >
                <div className="space-y-4">
                  <div>
                    <div className="flex items-center gap-2">
                      <PenLine
                        className="h-4 w-4 text-scanonix-orange"
                        aria-hidden="true"
                        strokeWidth={1.75}
                      />
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Logo Vectorizer
                      </p>
                    </div>
                    <p className="mt-3 text-sm text-scanonix-muted">
                      Turn logos and simple images into real SVG vector paths.
                    </p>
                  </div>
                  <div className="border-t border-border/80 pt-3 pr-24 sm:pr-36 lg:pr-0">
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
        primaryLabel={hasResult ? "Download SVG" : "Vectorize Logo"}
        primaryLoading={!hasResult && isBusy}
        primaryDisabled={hasResult ? isBusy || !resultBlob : !file || isBusy}
        showPrimaryOnError
        onPrimaryClick={() => {
          if (hasResult) {
            handleDownload();
          } else {
            void handleVectorize();
          }
        }}
        onStartOver={hasResult ? resetTool : undefined}
        startOverLabel="Vectorize another"
        startOverDisabled={isBusy}
        secondaryLabel={!hasResult && file ? "Replace image" : undefined}
        onSecondaryClick={!hasResult && file ? resetTool : undefined}
      />
    </div>
  );
}
