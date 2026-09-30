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
import "@/styles/image-upscaler-premium.css";

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

  useEffect(() => {
    if (!stickyVisible) return;

    const media = window.matchMedia("(max-width: 767px)");
    let indicator: HTMLElement | null = null;

    const findIndicator = () =>
      document
        .querySelector("nextjs-portal")
        ?.shadowRoot?.querySelector<HTMLElement>("#devtools-indicator") ?? null;

    const restore = () => {
      indicator?.style.removeProperty("bottom");
      indicator = null;
    };

    const place = () => {
      const next = findIndicator();
      const bar = document.querySelector<HTMLElement>("[data-sticky-action-bar]");
      const barVisible =
        Boolean(bar) && media.matches && getComputedStyle(bar as HTMLElement).display !== "none";

      if (!next || !barVisible || !bar) {
        restore();
        return;
      }

      const gap = 12;
      const bottom = Math.round(window.innerHeight - bar.getBoundingClientRect().top + gap);
      if (next.style.getPropertyValue("bottom") !== `${bottom}px`) {
        next.style.setProperty("bottom", `${bottom}px`, "important");
      }
      indicator = next;
    };

    place();
    const bar = document.querySelector("[data-sticky-action-bar]");
    const resizeObserver = new ResizeObserver(place);
    if (bar) resizeObserver.observe(bar);
    const portalObserver = new MutationObserver(place);
    portalObserver.observe(document.body, { childList: true });
    media.addEventListener("change", place);
    window.addEventListener("resize", place);

    return () => {
      resizeObserver.disconnect();
      portalObserver.disconnect();
      media.removeEventListener("change", place);
      window.removeEventListener("resize", place);
      restore();
    };
  }, [stickyVisible]);

  const setFilePreview = useCallback((image: File | null) => {
    if (previewUrlRef.current) URL.revokeObjectURL(previewUrlRef.current);

    if (!image) {
      previewUrlRef.current = undefined;
      setPreviewUrl(undefined);
      setNaturalSize(undefined);
      return;
    }

    const next = URL.createObjectURL(image);
    previewUrlRef.current = next;
    setPreviewUrl(next);
    const img = new Image();
    img.onload = () => {
      setNaturalSize({ width: img.naturalWidth, height: img.naturalHeight });
    };
    img.src = next;
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
      <div className="image-upscaler-premium space-y-5 overflow-x-hidden">
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

        {file ? (
          <div data-image-upscaler-header="" className="gap-3">
            <div className="min-w-0">
              <p className="truncate">{file.name}</p>
              <p className="truncate">{formatFileSize(file.size)}</p>
            </div>
            {!isBusy ? (
              <div
                className={
                  hasResult ? "hidden w-full shrink-0 sm:w-auto md:block" : "w-full shrink-0 sm:w-auto"
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
                className="image-upscaler-drop"
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
              <div className="image-upscaler-privacy">
                <PrivacyNotice message={PRIVACY_MESSAGE} />
              </div>
            </>
          }
          workArea={
            showWorkspace ? (
              <div data-image-upscaler-stage="">
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
                    <div className="image-upscaler-compare space-y-4">
                      <div className="grid gap-4 sm:grid-cols-2">
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-scanonix-muted">
                            Original
                          </p>
                          <div className="image-upscaler-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={previewUrl} alt="Original image" />
                          </div>
                        </div>
                        <div className="space-y-2">
                          <p className="text-[11px] font-semibold uppercase tracking-[0.08em] text-scanonix-muted">
                            Upscaled {factor}×
                          </p>
                          <div className="image-upscaler-preview">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={resultPreviewUrl} alt="Upscaled image" />
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
                    <div className="image-upscaler-preview">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img src={previewUrl} alt="Preview" />
                    </div>
                  ) : null}

                  {activeJobId && isBusy ? (
                    <p className="mt-3 text-xs text-scanonix-muted">
                      Job {activeJobId.slice(0, 8)}… — polling every{" "}
                      {UPSCALE_JOB_POLL_INTERVAL_MS / 1000}s
                    </p>
                  ) : null}
              </div>
            ) : null
          }
          controlPanel={
            showWorkspace ? (
              hasResult && resultBlob ? (
                <aside
                  aria-label="Image upscaler result"
                  data-image-upscaler-result=""
                  className="flex w-full min-w-0 flex-col"
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
                            data-upscale-action=""
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
                        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                          Upscale
                        </p>
                        <ProBadge />
                      </div>
                      <div className="mt-2 flex flex-wrap gap-2">
                        {[2, 4].map((value) => (
                          <button
                            key={value}
                            type="button"
                            aria-pressed={factor === value}
                            disabled={isBusy || premiumLocked}
                            onClick={() => setFactor(value as 2 | 4)}
                            className={`image-upscaler-scale rounded-xl border px-4 py-2.5 text-sm font-medium transition ${
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

                    {naturalSize ? (
                      <dl className="image-upscaler-dims">
                        <div>
                          <dt>Original</dt>
                          <dd>
                            {naturalSize.width} × {naturalSize.height}
                          </dd>
                        </div>
                        <div>
                          <dt>Output</dt>
                          <dd>
                            {naturalSize.width * factor} × {naturalSize.height * factor}
                          </dd>
                        </div>
                      </dl>
                    ) : null}

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

                    <div className="image-upscaler-privacy border-t border-border/80 pt-3">
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
