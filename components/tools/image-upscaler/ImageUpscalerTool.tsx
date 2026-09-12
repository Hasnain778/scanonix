"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import Link from "next/link";
import { Sparkles } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumAiToolGate } from "@/components/plan/PremiumAiToolGate";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { ProBadge } from "@/components/ui/ProBadge";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ImageToolStats } from "@/components/tools/shared/ImageToolStats";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ImageUpscalerProcessingPanel } from "@/components/tools/image-upscaler/ImageUpscalerProcessingPanel";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { getUpscaleJobProgressSnapshot } from "@/lib/upscale-jobs/progress";
import { getUpscaleJobPollAction } from "@/lib/upscale-jobs/terminal-status";
import type { UpscaleJobPublicStatus } from "@/lib/upscale-jobs/types";
import {
  clearStoredUpscaleJobId,
  fetchUpscaleJobResult,
  fetchUpscaleJobStatus,
  readStoredUpscaleJobId,
  submitImageUpscaleForm,
  UPSCALE_JOB_POLL_INTERVAL_MS,
  waitForUpscaleJobCompletion,
} from "@/lib/tools/image-upscaler/client";
import type { ImageToolStats as Stats } from "@/lib/tools/image/client";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";
import type { ToolStatus } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

const ACCEPT_IMAGES = ".jpg,.jpeg,.png,.webp,.heic,.heif,image/*";
const MAX_MB = Math.round(FREE_IMAGE_MAX_BYTES / (1024 * 1024));
const PRIVACY_MESSAGE =
  "Images are processed on Scanonix servers with Pro AI access and deleted after processing.";

function isValidImageFile(file: File): boolean {
  return file.size > 0 && file.size <= FREE_IMAGE_MAX_BYTES;
}

function jobProgressFromStatus(status: UpscaleJobPublicStatus) {
  return getUpscaleJobProgressSnapshot(status.status, status.stage, status.progress);
}

function UpscaleDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <Sparkles className={className} aria-hidden="true" strokeWidth={1.75} />;
}

export function ImageUpscalerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
  const [naturalSize, setNaturalSize] = useState<{
    width: number;
    height: number;
  }>();
  const [factor, setFactor] = useState<2 | 4>(2);
  const [resultBlob, setResultBlob] = useState<Blob | null>(null);
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string>();
  const [resultFileName, setResultFileName] = useState<string>();
  const [stats, setStats] = useState<Stats>();
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [message, setMessage] = useState<string>();
  const [jobProgress, setJobProgress] = useState(() =>
    getUpscaleJobProgressSnapshot("queued", "queued", 0),
  );
  const [activeJobId, setActiveJobId] = useState<string | null>(null);

  const previewUrlRef = useRef<string | undefined>(undefined);
  const resultPreviewUrlRef = useRef<string | undefined>(undefined);
  const isProcessingRef = useRef(false);
  const abortControllerRef = useRef<AbortController | null>(null);
  const resumeAttemptedRef = useRef(false);
  const { summary } = useUsageSummary();

  const premiumLocked = summary !== null && !summary.allowPremiumAi;
  const usageExhausted = summary !== null && summary.remaining <= 0;
  const isBusy = status === "loading";
  const hasResult = status === "success" && resultBlob !== null;
  const canRun = Boolean(file) && !isBusy && !premiumLocked && !usageExhausted;
  const showWorkspace = Boolean(file) || isBusy || hasResult;

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (file) return "ready";
    return "idle";
  }, [status, hasResult, file]);

  /** Sticky off while processing; on for ready/error (with file) and result. */
  const stickyVisible = Boolean(file) && (hasResult || !isBusy);

  const setFilePreview = useCallback((image: File | null) => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      const next = image ? URL.createObjectURL(image) : undefined;
      previewUrlRef.current = next;
      return next;
    });

    if (!image) {
      setNaturalSize(undefined);
      return;
    }

    const url = previewUrlRef.current;
    if (!url) return;
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = url;
  }, []);

  const setResultPreview = useCallback((blob: Blob | null) => {
    setResultPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      const next = blob ? URL.createObjectURL(blob) : undefined;
      resultPreviewUrlRef.current = next;
      return next;
    });
  }, []);

  const applyJobStatus = useCallback((jobStatus: UpscaleJobPublicStatus) => {
    setActiveJobId(jobStatus.jobId);
    setFactor(jobStatus.scale);
    setJobProgress(jobProgressFromStatus(jobStatus));
  }, []);

  const finalizeSuccess = useCallback(
    (blob: Blob, fileName: string, nextStats: Stats, sourceFile?: File | null) => {
      setResultBlob(blob);
      setResultPreview(blob);
      setResultFileName(fileName);
      setStats({
        ...nextStats,
        originalSize: nextStats.originalSize || sourceFile?.size || 0,
      });
      setStatus("success");
      setMessage("Image upscaled successfully!");
      setActiveJobId(null);
      clearStoredUpscaleJobId();
    },
    [setResultPreview],
  );

  /** Restores in-flight upscale job — no process lifecycle analytics (130D-FIX1). */
  const resumeStoredJob = useCallback(async () => {
    const storedJobId = readStoredUpscaleJobId();
    if (!storedJobId || isProcessingRef.current) {
      return;
    }

    isProcessingRef.current = true;
    setStatus("loading");
    setMessage(undefined);
    setResultBlob(null);
    setResultPreview(null);
    setStats(undefined);
    setActiveJobId(storedJobId);

    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    try {
      const initial = await fetchUpscaleJobStatus(storedJobId);
      if (!initial.ok) {
        clearStoredUpscaleJobId();
        setStatus("error");
        setMessage(initial.message);
        return;
      }

      applyJobStatus(initial.status);

      const initialAction = getUpscaleJobPollAction(initial.status);
      if (initialAction === "fetch-result") {
        const result = await fetchUpscaleJobResult(storedJobId);
        if (!result.ok) {
          setStatus("error");
          setMessage(result.message);
          return;
        }
        finalizeSuccess(result.blob, result.fileName, result.stats);
        return;
      }

      if (initialAction === "stop-error") {
        clearStoredUpscaleJobId();
        setStatus("error");
        setMessage(initial.status.errorMessage ?? "Upscaling failed — please try again.");
        return;
      }

      const completed = await waitForUpscaleJobCompletion(
        storedJobId,
        applyJobStatus,
        abortControllerRef.current.signal,
      );
      if (!completed.ok) {
        setStatus("error");
        setMessage(completed.message);
        return;
      }

      const result = await fetchUpscaleJobResult(storedJobId);
      if (!result.ok) {
        setStatus("error");
        setMessage(result.message);
        return;
      }

      finalizeSuccess(result.blob, result.fileName, result.stats);
    } catch {
      setStatus("error");
      setMessage("Upscaling failed — please try again.");
    } finally {
      isProcessingRef.current = false;
    }
  }, [applyJobStatus, finalizeSuccess, setResultPreview]);

  useEffect(() => {
    if (resumeAttemptedRef.current) return;
    resumeAttemptedRef.current = true;

    const storedJobId = readStoredUpscaleJobId();
    if (storedJobId) {
      queueMicrotask(() => {
        void resumeStoredJob();
      });
    }
  }, [resumeStoredJob]);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
      if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);
      if (resultPreviewUrlRef.current) URL.revokeObjectURL(resultPreviewUrlRef.current);
    };
  }, []);

  const handleUpscale = useCallback(async () => {
    if (!file || isProcessingRef.current) return;

    const attempt = createProcessAttempt("image-upscaler");
    if (!attempt?.markStarted()) return;

    isProcessingRef.current = true;
    abortControllerRef.current?.abort();
    abortControllerRef.current = new AbortController();

    setStatus("loading");
    setMessage(undefined);
    setResultBlob(null);
    setResultPreview(null);
    setStats(undefined);
    setJobProgress(getUpscaleJobProgressSnapshot("queued", "preparing", 5));

    const formData = new FormData();
    formData.append("file", file);
    formData.append("factor", String(factor));

    try {
      const result = await submitImageUpscaleForm(
        formData,
        applyJobStatus,
        abortControllerRef.current.signal,
      );
      if (!result.ok) {
        attempt.error(planErrorMessageToCode(result.message));
        setStatus("error");
        setMessage(result.message);
        return;
      }

      finalizeSuccess(result.blob, result.fileName, result.stats, file);
      attempt.success(1);
    } catch {
      attempt.error("unknown");
      setStatus("error");
      setMessage("Upscaling failed — please try again.");
    } finally {
      isProcessingRef.current = false;
    }
  }, [applyJobStatus, factor, file, finalizeSuccess, setResultPreview]);

  const handleDownload = useCallback(() => {
    if (!resultBlob) return;
    downloadBlob(
      resultBlob,
      resultFileName ?? "upscaled.jpg",
      buildToolDownloadMeta("image-upscaler", 1),
    );
  }, [resultBlob, resultFileName]);

  const resetTool = useCallback(() => {
    abortControllerRef.current?.abort();
    setFilePreview(null);
    setFile(null);
    setResultBlob(null);
    setResultPreview(null);
    setResultFileName(undefined);
    setStats(undefined);
    setFactor(2);
    setStatus("idle");
    setMessage(undefined);
    setJobProgress(getUpscaleJobProgressSnapshot("queued", "queued", 0));
    setActiveJobId(null);
    clearStoredUpscaleJobId();
    isProcessingRef.current = false;
  }, [setFilePreview, setResultPreview]);

  const upscaleHint = premiumLocked
    ? "Upgrade to Pro to upscale images."
    : usageExhausted
      ? "Limit reached — upgrade for more operations."
      : !file
        ? "Upload an image before upscaling."
        : isBusy
          ? "Upscaling on Scanonix servers…"
          : `Ready to upscale at ${factor}× with Real-ESRGAN.`;

  return (
    <PremiumAiToolGate toolName="Image Upscaler">
      <div className="space-y-5 overflow-x-hidden">
        {premiumLocked ? <UpgradeRequiredNotice feature="Image Upscaler" /> : null}

        {usageExhausted ? (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-foreground">
            Limit reached.{" "}
            <Link
              href="/pricing"
              className="font-semibold text-scanonix-orange hover:underline"
            >
              Upgrade your plan
            </Link>{" "}
            for more operations.
          </div>
        ) : null}

        <ToolStatusBanner status={status} message={message} />

        <ToolWorkspaceShell
          isEmpty={!showWorkspace}
          empty={
            <>
              <div className="flex items-center gap-2">
                <p className="text-sm text-scanonix-muted">
                  Upscale images with Real-ESRGAN AI super-resolution (2× or 4×).
                </p>
                <ProBadge />
              </div>
              <FileDropZone
                accept={ACCEPT_IMAGES}
                multiple={false}
                label="Drop an image to upscale"
                hint={`JPG, PNG, WEBP or HEIC — up to ${MAX_MB}MB`}
                disabled={isBusy || premiumLocked}
                validateFile={isValidImageFile}
                icon={<UpscaleDropIcon />}
                onInvalidFiles={() => {
                  setMessage(`Please choose a supported image up to ${MAX_MB}MB.`);
                  setStatus("error");
                }}
                onFilesSelected={(files) => {
                  const image = files[0];
                  if (image) {
                    setFilePreview(image);
                    setFile(image);
                    setStatus("idle");
                    setMessage(undefined);
                    setJobProgress(getUpscaleJobProgressSnapshot("queued", "queued", 0));
                    setResultBlob(null);
                    setResultPreview(null);
                    setResultFileName(undefined);
                    setStats(undefined);
                    setActiveJobId(null);
                    clearStoredUpscaleJobId();
                  }
                }}
              />
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </>
          }
          workArea={
            showWorkspace ? (
              <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
                {file ? (
                  <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                    <div className="flex min-w-0 items-center gap-2.5">
                      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                        <UpscaleDropIcon className="h-4 w-4" />
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
                    {!isBusy ? (
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
                    ) : null}
                  </div>
                ) : null}

                <div className="bg-surface-muted/30 p-3 sm:p-4">
                  {isBusy && previewUrl ? (
                    <ImageUpscalerProcessingPanel
                      snapshot={jobProgress}
                      previewUrl={previewUrl}
                      factor={factor}
                    />
                  ) : isBusy ? (
                    <div className="rounded-xl border border-border bg-surface px-4 py-5">
                      <p className="text-sm font-medium text-foreground">
                        {jobProgress.label}
                      </p>
                      <p className="mt-1 text-sm font-semibold tabular-nums text-scanonix-orange">
                        {jobProgress.percent}%
                      </p>
                      <p className="mt-2 text-xs text-scanonix-muted">
                        Upscaling at {factor}× with Real-ESRGAN — please keep this tab
                        open.
                      </p>
                    </div>
                  ) : hasResult && previewUrl && resultPreviewUrl ? (
                    <div className="space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-scanonix-muted">
                            Original
                          </p>
                          <div className="overflow-hidden rounded-xl border border-scanonix-border bg-black/30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={previewUrl}
                              alt="Original image"
                              className="max-h-64 w-full object-contain"
                            />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-scanonix-muted">
                            Upscaled {factor}×
                          </p>
                          <div className="overflow-hidden rounded-xl border border-scanonix-orange/30 bg-black/30">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img
                              src={resultPreviewUrl}
                              alt="Upscaled image"
                              className="max-h-64 w-full object-contain"
                            />
                          </div>
                        </div>
                      </div>
                      {stats ? (
                        <ImageToolStats
                          originalSize={stats.originalSize}
                          outputSize={stats.outputSize}
                          width={stats.width}
                          height={stats.height}
                          originalWidth={stats.originalWidth}
                          originalHeight={stats.originalHeight}
                          showDimensions
                        />
                      ) : null}
                    </div>
                  ) : previewUrl ? (
                    <div className="overflow-hidden rounded-xl border border-scanonix-border bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-80 w-full object-contain"
                      />
                    </div>
                  ) : null}

                  {activeJobId && isBusy ? (
                    <p className="mt-3 text-xs text-scanonix-muted">
                      Job {activeJobId.slice(0, 8)}… — polling every{" "}
                      {UPSCALE_JOB_POLL_INTERVAL_MS / 1000}s
                    </p>
                  ) : null}
                </div>
              </div>
            ) : null
          }
          controlPanel={
            showWorkspace ? (
              hasResult && resultBlob ? (
                <aside
                  aria-label="Image upscaler result"
                  className="flex w-full min-w-0 flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)] lg:sticky lg:top-20 lg:max-h-[calc(100vh-5.5rem)] lg:w-[320px] lg:shrink-0"
                  data-tool-control-panel=""
                >
                  <div className="min-h-0 flex-1 space-y-2.5 overflow-y-auto overscroll-contain px-3.5 py-3 sm:px-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Result
                      </p>
                      <p className="mt-1 text-sm font-semibold text-green-700">
                        ✓ Upscale complete
                      </p>
                    </div>

                    <dl className="divide-y divide-border/70 overflow-hidden rounded-lg border border-border bg-surface-muted/60 text-sm">
                      <div className="flex justify-between gap-3 px-3 py-1.5">
                        <dt className="text-scanonix-muted">Scale</dt>
                        <dd className="font-semibold text-foreground">{factor}×</dd>
                      </div>
                      {stats?.originalWidth && stats?.originalHeight ? (
                        <div className="flex justify-between gap-3 px-3 py-1.5">
                          <dt className="text-scanonix-muted">Original</dt>
                          <dd className="font-semibold text-foreground">
                            {stats.originalWidth} × {stats.originalHeight}px
                          </dd>
                        </div>
                      ) : naturalSize ? (
                        <div className="flex justify-between gap-3 px-3 py-1.5">
                          <dt className="text-scanonix-muted">Original</dt>
                          <dd className="font-semibold text-foreground">
                            {naturalSize.width} × {naturalSize.height}px
                          </dd>
                        </div>
                      ) : null}
                      {stats?.width && stats?.height ? (
                        <div className="flex justify-between gap-3 px-3 py-1.5">
                          <dt className="text-scanonix-muted">Output</dt>
                          <dd className="font-semibold text-foreground">
                            {stats.width} × {stats.height}px
                          </dd>
                        </div>
                      ) : null}
                      {stats ? (
                        <>
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
                        </>
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
                  aria-label="Image upscaler controls"
                  footer={
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] leading-snug text-scanonix-muted">
                        {upscaleHint}
                      </p>
                      {!isBusy ? (
                        <div className="hidden md:block">
                          <ActionButton
                            size="md"
                            className="h-11 w-full whitespace-nowrap px-4 text-sm shadow-[var(--shadow-orange-sm)]"
                            disabled={!canRun}
                            onClick={() => void handleUpscale()}
                          >
                            Upscale image
                          </ActionButton>
                        </div>
                      ) : (
                        <p className="text-xs font-medium text-foreground">
                          Processing… {jobProgress.percent}%
                        </p>
                      )}
                    </div>
                  }
                >
                  <div className="space-y-4">
                    <div>
                      <div className="flex items-center gap-2">
                        <Sparkles
                          className="h-4 w-4 text-scanonix-orange"
                          aria-hidden="true"
                          strokeWidth={1.75}
                        />
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                          Image Upscaler
                        </p>
                        <ProBadge />
                      </div>
                      <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
                        Upscale with Real-ESRGAN AI super-resolution.
                      </p>
                    </div>

                    {file ? (
                      <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                        <div className="min-w-0 px-3 py-2.5">
                          <dt className="text-scanonix-muted">Selected file</dt>
                          <dd className="mt-0.5 truncate font-semibold text-foreground">
                            {file.name}
                          </dd>
                        </div>
                        <div className="flex justify-between gap-3 px-3 py-2.5">
                          <dt className="text-scanonix-muted">Size</dt>
                          <dd className="font-semibold text-foreground">
                            {formatFileSize(file.size)}
                          </dd>
                        </div>
                        {naturalSize ? (
                          <div className="flex justify-between gap-3 px-3 py-2.5">
                            <dt className="text-scanonix-muted">Dimensions</dt>
                            <dd className="font-semibold text-foreground">
                              {naturalSize.width} × {naturalSize.height}px
                            </dd>
                          </div>
                        ) : null}
                      </dl>
                    ) : null}

                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Upscale
                      </p>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[2, 4].map((value) => (
                          <button
                            key={value}
                            type="button"
                            disabled={isBusy || premiumLocked}
                            onClick={() => setFactor(value as 2 | 4)}
                            className={`rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
                              factor === value
                                ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground"
                                : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/40"
                            }`}
                          >
                            {value}×
                          </button>
                        ))}
                      </div>
                    </div>

                    {isBusy ? (
                      <div className="rounded-xl border border-border bg-surface-muted/40 px-3 py-2.5">
                        <p className="text-[11px] font-semibold uppercase tracking-wide text-scanonix-muted">
                          Status
                        </p>
                        <p className="mt-1 text-sm font-medium text-foreground">
                          {jobProgress.label}
                        </p>
                        <p className="mt-0.5 text-xs text-scanonix-muted">
                          {jobProgress.percent}% · {factor}×
                        </p>
                      </div>
                    ) : null}

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
          visible={stickyVisible}
          phase={resultActionPhase}
          primaryLabel={hasResult ? "Download image" : "Upscale image"}
          primaryDisabled={hasResult ? !resultBlob : !canRun}
          showPrimaryOnError
          onPrimaryClick={() => {
            if (hasResult) {
              handleDownload();
            } else {
              void handleUpscale();
            }
          }}
          onStartOver={hasResult ? resetTool : undefined}
          startOverLabel="Start over"
          startOverDisabled={isBusy}
        />
      </div>
    </PremiumAiToolGate>
  );
}
