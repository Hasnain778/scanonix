"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { UpgradeRequiredNotice } from "@/components/plan/UsageBanner";
import { ActionButton } from "@/components/ui/ActionButton";
import { BeforeAfterSlider } from "@/components/tools/background-remover/BeforeAfterSlider";
import { BackgroundRemoverPrivacyNotice } from "@/components/tools/background-remover/BackgroundRemoverPrivacyNotice";
import { BackgroundRemoverProcessingPanel } from "@/components/tools/background-remover/BackgroundRemoverProcessingPanel";
import { BackgroundRemoverProgressBanner } from "@/components/tools/background-remover/BackgroundRemoverProgressBanner";
import { ImageStudioControls } from "@/components/tools/background-remover/ImageStudioControls";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import type { StudioBackgroundOptions } from "@/lib/tools/background-remover/export-image";
import { renderStudioImage } from "@/lib/tools/background-remover/export-image";
import {
  ACCEPTED_BACKGROUND_REMOVER_EXTENSIONS,
  canAcceptBackgroundRemoverFile,
  getBackgroundRemoverFileError,
  validateBackgroundRemoverFile,
} from "@/lib/tools/background-remover/file-validation";
import { submitBackgroundRemovalForm } from "@/lib/tools/background-remover/client";
import { buildOptimizationNotice } from "@/lib/tools/background-remover/processing-limits";
import {
  advanceStagedProgress,
  computeStagedProgressPercent,
  getStagedProgressSnapshot,
  resolveSuccessProgressPercent,
  STAGED_PROGRESS_TICK_MS,
  type StagedProgressSnapshot,
} from "@/lib/tools/background-remover/staged-progress";
import { BackgroundRemoverError } from "@/lib/tools/background-remover/types";
import {
  calculateOutputDimensions,
  getExportFilename,
  isPremiumResolution,
  type ExportFormat,
  type ResolutionPresetId,
} from "@/lib/tools/background-remover/studio-types";
import { useUsageSummary } from "@/hooks/useUsageSummary";
import { authorizeBackgroundExport } from "@/lib/plan/tool-gate";
import { validateAnonymousUploadSize } from "@/lib/plan/tool-access";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface UploadedImageMeta {
  file: File;
  width: number;
  height: number;
  originalWidth: number;
  originalHeight: number;
  wasOptimized: boolean;
}

const DEFAULT_BACKGROUND: StudioBackgroundOptions = {
  mode: "transparent",
  customColor: "#ff6a00",
  gradientStart: "#ff6a00",
  gradientEnd: "#121212",
  backgroundImageUrl: null,
};

function ImageDropIcon() {
  return (
    <svg
      className="h-7 w-7"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={1.75}
      aria-hidden="true"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"
      />
    </svg>
  );
}

export function BackgroundRemoverTool() {
  const { summary, refresh: refreshUsage } = useUsageSummary();
  const isPremium = summary?.allow4KExport ?? false;
  const usageExhausted = summary !== null && summary.remaining <= 0;

  const [uploadedImage, setUploadedImage] = useState<UploadedImageMeta | null>(null);
  const [originalPreviewUrl, setOriginalPreviewUrl] = useState<string | null>(null);
  const [processedPreviewUrl, setProcessedPreviewUrl] = useState<string | null>(null);
  const [transparentBlob, setTransparentBlob] = useState<Blob | null>(null);
  const [background, setBackground] =
    useState<StudioBackgroundOptions>(DEFAULT_BACKGROUND);
  const [resolutionPreset, setResolutionPreset] =
    useState<ResolutionPresetId>("hd");
  const [exportFormat, setExportFormat] = useState<ExportFormat>("png");
  const [exportQuality, setExportQuality] = useState(0.92);
  const [zoom, setZoom] = useState(1);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [stagedProgress, setStagedProgress] = useState<StagedProgressSnapshot>(
    getStagedProgressSnapshot(0),
  );
  const [isDownloading, setIsDownloading] = useState(false);

  const originalPreviewRef = useRef<string | null>(null);
  const processedPreviewRef = useRef<string | null>(null);
  const transparentBlobRef = useRef<Blob | null>(null);
  const backgroundImageUrlRef = useRef<string | null>(null);
  const isProcessingRef = useRef(false);
  const progressStartedAtRef = useRef<number | null>(null);
  const progressPercentRef = useRef(0);
  const progressTimerRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const isBusy = status === "loading" || isDownloading;

  const activePreset: ResolutionPresetId =
    !isPremium && isPremiumResolution(resolutionPreset) ? "hd" : resolutionPreset;

  const outputDimensions = useMemo(() => {
    if (!uploadedImage) {
      return { width: 0, height: 0 };
    }
    return calculateOutputDimensions(
      uploadedImage.width,
      uploadedImage.height,
      activePreset,
    );
  }, [uploadedImage, activePreset]);

  const stopProgressTimer = useCallback(() => {
    if (progressTimerRef.current) {
      clearInterval(progressTimerRef.current);
      progressTimerRef.current = null;
    }
  }, []);

  const revokePreviewUrls = useCallback(() => {
    if (originalPreviewRef.current) {
      URL.revokeObjectURL(originalPreviewRef.current);
      originalPreviewRef.current = null;
    }
    if (processedPreviewRef.current) {
      URL.revokeObjectURL(processedPreviewRef.current);
      processedPreviewRef.current = null;
    }
  }, []);

  const resetProgressState = useCallback(() => {
    stopProgressTimer();
    progressStartedAtRef.current = null;
    progressPercentRef.current = 0;
    setStagedProgress(getStagedProgressSnapshot(0));
  }, [stopProgressTimer]);

  const startProgressTimer = useCallback(() => {
    stopProgressTimer();
    progressStartedAtRef.current = Date.now();
    progressPercentRef.current = 0;
    setStagedProgress(getStagedProgressSnapshot(0));

    progressTimerRef.current = setInterval(() => {
      const startedAt = progressStartedAtRef.current;
      if (startedAt === null) return;

      const elapsedMs = Date.now() - startedAt;
      const next = advanceStagedProgress(
        progressPercentRef.current,
        computeStagedProgressPercent(elapsedMs),
      );
      progressPercentRef.current = next;
      setStagedProgress(getStagedProgressSnapshot(next));
    }, STAGED_PROGRESS_TICK_MS);
  }, [stopProgressTimer]);

  useEffect(() => {
    backgroundImageUrlRef.current = background.backgroundImageUrl;
  }, [background.backgroundImageUrl]);

  useEffect(() => {
    transparentBlobRef.current = transparentBlob;
  }, [transparentBlob]);

  useEffect(() => {
    return () => {
      stopProgressTimer();
      revokePreviewUrls();
      if (backgroundImageUrlRef.current) {
        URL.revokeObjectURL(backgroundImageUrlRef.current);
        backgroundImageUrlRef.current = null;
      }
    };
  }, [revokePreviewUrls, stopProgressTimer]);

  const resetTool = useCallback(() => {
    setBackground((current) => {
      if (current.backgroundImageUrl) {
        URL.revokeObjectURL(current.backgroundImageUrl);
      }
      return DEFAULT_BACKGROUND;
    });
    revokePreviewUrls();
    transparentBlobRef.current = null;
    setUploadedImage(null);
    setOriginalPreviewUrl(null);
    setProcessedPreviewUrl(null);
    setTransparentBlob(null);
    setResolutionPreset("hd");
    setExportFormat("png");
    setExportQuality(0.92);
    setZoom(1);
    setStatus("idle");
    setStatusMessage(undefined);
    resetProgressState();
    setIsDownloading(false);
    isProcessingRef.current = false;
  }, [resetProgressState, revokePreviewUrls]);

  const processImage = useCallback(
    async (file: File, originalUrl: string) => {
      if (isProcessingRef.current) return;
      isProcessingRef.current = true;

      setStatus("loading");
      setStatusMessage(undefined);
      setProcessedPreviewUrl(null);
      setTransparentBlob(null);
      setUploadedImage(null);
      setZoom(1);
      startProgressTimer();

      if (processedPreviewRef.current) {
        URL.revokeObjectURL(processedPreviewRef.current);
        processedPreviewRef.current = null;
      }

      let attempt: ReturnType<typeof createProcessAttempt> = null;

      try {
        const uploadLimitError = validateAnonymousUploadSize(
          "background-remover",
          file.size,
        );
        if (uploadLimitError) {
          stopProgressTimer();
          setStatus("error");
          setStatusMessage(uploadLimitError);
          resetProgressState();
          setOriginalPreviewUrl(null);
          URL.revokeObjectURL(originalUrl);
          originalPreviewRef.current = null;
          return;
        }

        attempt = createProcessAttempt("background-remover");
        if (!attempt?.markStarted()) {
          return;
        }

        await validateBackgroundRemoverFile(file);

        const formData = new FormData();
        formData.append("file", file);

        const result = await submitBackgroundRemovalForm(formData);
        if (!result.ok) {
          throw new BackgroundRemoverError(
            result.code === "no_subject" ? "NO_SUBJECT" : "FAILURE",
            result.message,
          );
        }

        stopProgressTimer();
        const completePercent = resolveSuccessProgressPercent();
        progressPercentRef.current = completePercent;
        setStagedProgress(getStagedProgressSnapshot(completePercent));

        const processed = result.result;
        setUploadedImage({
          file,
          width: processed.width,
          height: processed.height,
          originalWidth: processed.originalWidth,
          originalHeight: processed.originalHeight,
          wasOptimized: processed.wasOptimized,
        });

        processedPreviewRef.current = processed.previewUrl;
        setProcessedPreviewUrl(processed.previewUrl);
        setTransparentBlob(processed.transparentBlob);
        transparentBlobRef.current = processed.transparentBlob;
        attempt?.success(1);
        setStatus("success");
        setStatusMessage(
          processed.wasOptimized
            ? buildOptimizationNotice(
                processed.originalWidth,
                processed.originalHeight,
                processed.width,
                processed.height,
                isPremium,
              )
            : "Complete — background removed! Open the studio to edit and export.",
        );
        void refreshUsage();
      } catch (error) {
        attempt?.error(
          error instanceof BackgroundRemoverError
            ? planErrorMessageToCode(error.message)
            : "unknown",
        );
        stopProgressTimer();
        setStatus("error");
        setStatusMessage(
          error instanceof BackgroundRemoverError
            ? error.message
            : "Background removal failed. Please try again.",
        );
        resetProgressState();
        setUploadedImage(null);
        setProcessedPreviewUrl(null);
        setTransparentBlob(null);
        setOriginalPreviewUrl(null);
        URL.revokeObjectURL(originalUrl);
        originalPreviewRef.current = null;
      } finally {
        isProcessingRef.current = false;
      }
    },
    [isPremium, refreshUsage, resetProgressState, startProgressTimer, stopProgressTimer],
  );

  const handleUpload = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file || isBusy) return;

      revokePreviewUrls();
      resetProgressState();

      const originalUrl = URL.createObjectURL(file);
      originalPreviewRef.current = originalUrl;
      setOriginalPreviewUrl(originalUrl);

      await processImage(file, originalUrl);
    },
    [isBusy, processImage, resetProgressState, revokePreviewUrls],
  );

  const handleDownload = async () => {
    const blob = transparentBlobRef.current ?? transparentBlob;
    if (!blob || !uploadedImage || isDownloading) return;

    setIsDownloading(true);

    try {
      const requestedResolution = isPremiumResolution(activePreset) ? "4k" : "hd";
      const auth = await authorizeBackgroundExport(
        requestedResolution,
        uploadedImage.file.size,
      );

      if (!auth.ok) {
        setStatus("error");
        setStatusMessage(auth.message);
        return;
      }

      const exportPreset =
        auth.allowedResolution === "4k" ? activePreset : "hd";

      const outputBlob = await renderStudioImage({
        transparentBlob: blob,
        sourceWidth: uploadedImage.width,
        sourceHeight: uploadedImage.height,
        resolutionPreset: exportPreset,
        background,
        format: exportFormat,
        quality: exportQuality,
      });
      downloadBlob(outputBlob, getExportFilename(exportFormat), buildToolDownloadMeta("background-remover", 1));
    } catch {
      setStatus("error");
      setStatusMessage("Could not prepare the download. Please try again.");
    } finally {
      setIsDownloading(false);
    }
  };

  const handleBackgroundChange = (next: StudioBackgroundOptions) => {
    if (
      background.backgroundImageUrl &&
      background.backgroundImageUrl !== next.backgroundImageUrl
    ) {
      URL.revokeObjectURL(background.backgroundImageUrl);
    }
    setBackground(next);
  };

  const handleInvalidFiles = useCallback(
    (files: File[]) => {
      const file = files[0];
      if (!file) return;

      const message =
        getBackgroundRemoverFileError(file) ??
        "This file cannot be processed. Please choose a JPG, JPEG, PNG, or WEBP image under 25 MB.";

      setStatus("error");
      setStatusMessage(message);
      resetProgressState();
    },
    [resetProgressState],
  );

  const showProcessingPanel =
    status === "loading" && Boolean(originalPreviewUrl);
  const showResults =
    Boolean(processedPreviewUrl && transparentBlob && uploadedImage) &&
    status === "success";

  return (
    <div className="space-y-8">
      {usageExhausted ? (
        <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
          Limit reached — upgrade your plan or wait until your usage resets.
        </div>
      ) : null}

      {!isPremium && <UpgradeRequiredNotice feature="4K export" />}

      {!showProcessingPanel && (
        <BackgroundRemoverProgressBanner
          status={status}
          message={statusMessage}
        />
      )}

      {!uploadedImage && !originalPreviewUrl && status !== "loading" && (
        <>
          <FileDropZone
            onFilesSelected={handleUpload}
            accept={ACCEPTED_BACKGROUND_REMOVER_EXTENSIONS}
            validateFile={canAcceptBackgroundRemoverFile}
            onInvalidFiles={handleInvalidFiles}
            multiple={false}
            disabled={isBusy || usageExhausted}
            label="Drop an image to remove its background"
            hint="JPG, JPEG, PNG, or WEBP — processed on Scanonix servers"
            icon={<ImageDropIcon />}
          />
          <BackgroundRemoverPrivacyNotice />
        </>
      )}

      {showProcessingPanel && originalPreviewUrl && (
        <BackgroundRemoverProcessingPanel
          snapshot={stagedProgress}
          previewUrl={originalPreviewUrl}
        />
      )}

      {(uploadedImage || originalPreviewUrl) && !showProcessingPanel && (
        <>
          {uploadedImage && (
            <div className="flex flex-col gap-4 glass-card rounded-2xl p-5 sm:flex-row sm:items-center sm:justify-between sm:p-6">
              <div className="flex items-center gap-4">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl glass text-scanonix-orange glow-orange-sm">
                  <ImageDropIcon />
                </div>
                <div className="min-w-0">
                  <p className="truncate text-base font-semibold text-white">
                    {uploadedImage.file.name}
                  </p>
                  <p className="mt-1 text-sm text-scanonix-muted">
                    {formatFileSize(uploadedImage.file.size)} ·{" "}
                    {uploadedImage.wasOptimized ? (
                      <>
                        {uploadedImage.originalWidth}×{uploadedImage.originalHeight}px
                        source · optimized to {uploadedImage.width}×
                        {uploadedImage.height}px
                      </>
                    ) : (
                      <>
                        {uploadedImage.width}×{uploadedImage.height}px source
                      </>
                    )}
                  </p>
                </div>
              </div>
              {!transparentBlob && (
                <ActionButton
                  variant="outline"
                  className="w-full sm:w-auto"
                  disabled={isBusy || usageExhausted}
                  onClick={resetTool}
                >
                  Start over
                </ActionButton>
              )}
            </div>
          )}

          {showResults && originalPreviewUrl && processedPreviewUrl && (
            <>
              <ToolResultsPanel
                primaryLabel={`Download ${exportFormat.toUpperCase()}`}
                primaryLoading={isDownloading}
                primaryDisabled={isBusy}
                onPrimaryClick={handleDownload}
                onStartOver={resetTool}
              >
                <p className="text-sm text-scanonix-muted">
                  Background removed · {outputDimensions.width}×
                  {outputDimensions.height}px export · {background.mode} background
                </p>
              </ToolResultsPanel>

              <div className="grid gap-8 xl:grid-cols-[1.1fr_0.9fr]">
                <div className="glass-card rounded-2xl p-5 sm:p-6">
                  <BeforeAfterSlider
                    originalUrl={originalPreviewUrl}
                    resultUrl={processedPreviewUrl}
                    background={background}
                    zoom={zoom}
                  />
                </div>

                <ImageStudioControls
                  background={background}
                  resolutionPreset={activePreset}
                  exportFormat={exportFormat}
                  exportQuality={exportQuality}
                  zoom={zoom}
                  outputWidth={outputDimensions.width}
                  outputHeight={outputDimensions.height}
                  isPremium={isPremium}
                  disabled={isBusy || usageExhausted}
                  onBackgroundChange={handleBackgroundChange}
                  onResolutionChange={(preset) => {
                    if (!isPremium && isPremiumResolution(preset)) {
                      return;
                    }
                    setResolutionPreset(preset);
                  }}
                  onExportFormatChange={setExportFormat}
                  onExportQualityChange={setExportQuality}
                  onZoomChange={setZoom}
                />
              </div>
            </>
          )}

          {transparentBlob && status === "success" && (
            <BackgroundRemoverPrivacyNotice />
          )}
        </>
      )}

      <ToolStickyMobileActionBar
        visible={Boolean(transparentBlob && status === "success")}
        primaryLabel={`Download ${exportFormat.toUpperCase()}`}
        primaryLoading={isDownloading}
        primaryDisabled={isBusy}
        onPrimaryClick={handleDownload}
        secondaryLabel="Start over"
        onSecondaryClick={resetTool}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
