"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import Link from "next/link";
import { ActionButton } from "@/components/ui/ActionButton";
import { PremiumAiToolGate } from "@/components/plan/PremiumAiToolGate";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { ProBadge } from "@/components/tools/background-remover/ProBadge";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ImageToolStats } from "@/components/tools/shared/ImageToolStats";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ImageUpscalerProcessingPanel } from "@/components/tools/image-upscaler/ImageUpscalerProcessingPanel";
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

function isValidImageFile(file: File): boolean {
  return file.size > 0 && file.size <= FREE_IMAGE_MAX_BYTES;
}

function jobProgressFromStatus(status: UpscaleJobPublicStatus) {
  return getUpscaleJobProgressSnapshot(status.status, status.stage, status.progress);
}

export function ImageUpscalerTool() {
  const [file, setFile] = useState<File | null>(null);
  const [previewUrl, setPreviewUrl] = useState<string>();
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

  const setFilePreview = useCallback((image: File | null) => {
    setPreviewUrl((current) => {
      if (current) URL.revokeObjectURL(current);
      const next = image ? URL.createObjectURL(image) : undefined;
      previewUrlRef.current = next;
      return next;
    });
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

  return (
    <PremiumAiToolGate toolName="Image Upscaler">
    <div className="space-y-6">
      {premiumLocked ? <UpgradeRequiredNotice feature="Image Upscaler" /> : null}

      {usageExhausted ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Limit reached.{" "}
          <Link href="/pricing" className="font-semibold text-scanonix-orange hover:underline">
            Upgrade your plan
          </Link>{" "}
          for more operations.
        </div>
      ) : null}

      {!hasResult ? (
        <>
          {!isBusy ? (
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

              {file ? (
                <div className="grid gap-4 lg:grid-cols-2">
                  {previewUrl ? (
                    <div className="overflow-hidden rounded-xl border border-scanonix-border bg-black/30">
                      {/* eslint-disable-next-line @next/next/no-img-element */}
                      <img
                        src={previewUrl}
                        alt="Preview"
                        className="max-h-72 w-full object-contain"
                      />
                    </div>
                  ) : null}
                  <div className="rounded-xl border border-border bg-surface-muted p-4">
                    <p className="text-sm font-medium text-foreground">{file.name}</p>
                    <p className="mt-1 text-sm text-scanonix-muted">{formatFileSize(file.size)}</p>
                  </div>
                </div>
              ) : null}

              <div className="glass-card rounded-2xl p-5 sm:p-6">
                <p className="text-sm font-medium text-foreground">Upscale factor</p>
                <div className="mt-4 flex flex-wrap gap-3">
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
            </>
          ) : previewUrl ? (
            <ImageUpscalerProcessingPanel
              snapshot={jobProgress}
              previewUrl={previewUrl}
              factor={factor}
            />
          ) : null}

          {activeJobId && isBusy ? (
            <p className="text-xs text-scanonix-muted">
              Job {activeJobId.slice(0, 8)}… — polling every {UPSCALE_JOB_POLL_INTERVAL_MS / 1000}s
            </p>
          ) : null}

          <ToolStatusBanner status={status} message={message} />

          <div className="hidden sm:block">
            <ActionButton
              size="lg"
              disabled={!canRun}
              onClick={() => void handleUpscale()}
            >
              Upscale image
            </ActionButton>
          </div>
        </>
      ) : (
        <ToolResultsPanel
          title="Upscale complete"
          primaryLabel="Download upscaled image"
          onPrimaryClick={() => {
            if (resultBlob) downloadBlob(resultBlob, resultFileName ?? "upscaled.jpg", buildToolDownloadMeta("image-upscaler", 1));
          }}
          onStartOver={resetTool}
        >
          {previewUrl && resultPreviewUrl ? (
            <div className="mb-5 grid gap-4 sm:grid-cols-2">
              <div className="space-y-2">
                <p className="text-xs font-medium uppercase tracking-wide text-scanonix-muted">
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
                <p className="text-xs font-medium uppercase tracking-wide text-scanonix-muted">
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
          ) : null}

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
        </ToolResultsPanel>
      )}

      <PrivacyNotice message="Images are processed on Scanonix servers with Pro AI access and deleted after processing." />

      <ToolStickyMobileActionBar
        visible={Boolean(file) && !hasResult && !isBusy}
        primaryLabel="Upscale image"
        primaryDisabled={!canRun}
        onPrimaryClick={() => void handleUpscale()}
      />
    </div>
    </PremiumAiToolGate>
  );
}
