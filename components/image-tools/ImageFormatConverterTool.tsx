"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FileImage } from "lucide-react";
import type { ImageConverterDefinition } from "@/constants/image-tools";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { ImagePreviewGrid } from "@/components/tools/ImagePreviewGrid";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolResultsPanel } from "@/components/tools/ToolResultsPanel";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { FormatDirection } from "@/components/image-tools/FormatDirection";
import {
  convertImageFiles,
  detectTransparencyForFiles,
} from "@/lib/image/convert-format";
import { formatAcceptAttribute, validateFormatFile } from "@/lib/image/formats";
import {
  createProcessAttempt,
  planErrorMessageToCode,
} from "@/lib/analytics/process-lifecycle";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob, packageOutputsForDownload } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { createImageId, getImageDimensions } from "@/lib/tools/image-utils";
import type { JpgImageItem, ToolStatus } from "@/lib/tools/types";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface DownloadState {
  blob: Blob;
  filename: string;
  outputCount: number;
}

interface ImageFormatConverterToolProps {
  config: ImageConverterDefinition;
}

export function ImageFormatConverterTool({ config }: ImageFormatConverterToolProps) {
  const [images, setImages] = useState<JpgImageItem[]>([]);
  const [quality, setQuality] = useState(92);
  const [backgroundColor, setBackgroundColor] = useState("#ffffff");
  const [transparencyDetected, setTransparencyDetected] = useState(false);
  const [downloadState, setDownloadState] = useState<DownloadState | null>(null);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();
  const [progress, setProgress] = useState<{ current: number; total: number }>();
  const [isDownloading, setIsDownloading] = useState(false);

  const downloadStateRef = useRef<DownloadState | null>(null);
  const imagesRef = useRef(images);

  const accept = useMemo(() => formatAcceptAttribute(config.from), [config.from]);
  const validateFile = useCallback(
    (file: File) => validateFormatFile(file, config.from),
    [config.from],
  );
  const isBusy = status === "loading" || isDownloading;
  const hasResult = downloadState !== null && status === "success";
  const needsBackground = config.to === "jpg";
  const showTransparencyWarning =
    needsBackground && images.length > 0 && transparencyDetected;

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    downloadStateRef.current = downloadState;
  }, [downloadState]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
    };
  }, []);

  useEffect(() => {
    if (images.length === 0 || !needsBackground) {
      return;
    }

    let cancelled = false;

    void detectTransparencyForFiles(
      images.map((item) => item.file),
      config.from,
    ).then((hasTransparency) => {
      if (!cancelled) setTransparencyDetected(hasTransparency);
    });

    return () => {
      cancelled = true;
    };
  }, [config.from, images, needsBackground]);

  const invalidateResult = useCallback(() => {
    downloadStateRef.current = null;
    setDownloadState(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [status]);

  const loadDimensions = useCallback(async (id: string, file: File) => {
    try {
      const { width, height } = await getImageDimensions(file);
      setImages((current) =>
        current.map((item) => (item.id === id ? { ...item, width, height } : item)),
      );
    } catch {
      setImages((current) =>
        current.map((item) => (item.id === id ? { ...item, width: null, height: null } : item)),
      );
    }
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const newImages: JpgImageItem[] = files.map((file) => ({
        id: createImageId(),
        file,
        previewUrl: URL.createObjectURL(file),
        width: null,
        height: null,
      }));

      setImages((current) => [...current, ...newImages]);
      setStatus("idle");
      setStatusMessage(undefined);
      invalidateResult();
      newImages.forEach((item) => void loadDimensions(item.id, item.file));
    },
    [invalidateResult, loadDimensions],
  );

  const removeImage = useCallback(
    (id: string) => {
      setImages((current) => {
        const target = current.find((image) => image.id === id);
        if (target) URL.revokeObjectURL(target.previewUrl);
        return current.filter((image) => image.id !== id);
      });
      invalidateResult();
    },
    [invalidateResult],
  );

  const reorderImages = useCallback(
    (fromIndex: number, toIndex: number) => {
      setImages((current) => {
        const updated = [...current];
        const [moved] = updated.splice(fromIndex, 1);
        updated.splice(toIndex, 0, moved);
        return updated;
      });
      invalidateResult();
    },
    [invalidateResult],
  );

  const clearAll = useCallback(() => {
    setImages((current) => {
      current.forEach((image) => URL.revokeObjectURL(image.previewUrl));
      return [];
    });
    downloadStateRef.current = null;
    setDownloadState(null);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
    setTransparencyDetected(false);
  }, []);

  const handleConvert = async () => {
    if (images.length === 0 || isBusy) return;

    const attempt = createProcessAttempt(config.slug);

    const totalBytes = images.reduce((sum, item) => sum + item.file.size, 0);
    const gate = await gateToolOperation(config.slug, totalBytes);
    if (!gate.ok) {
      setStatus("error");
      setStatusMessage(gate.message);
      return;
    }

    if (!attempt?.markStarted()) return;

    setStatus("loading");
    setStatusMessage(undefined);
    setProgress({ current: 0, total: images.length });
    setDownloadState(null);

    try {
      const outputs = await convertImageFiles(
        images.map((item) => item.file),
        {
          from: config.from,
          to: config.to,
          quality: quality / 100,
          backgroundColor,
        },
        (current, total) => setProgress({ current, total }),
      );

      const zipName = `scanonix-${config.slug}.zip`;
      const { blob, filename } = await packageOutputsForDownload(outputs, zipName);

      setDownloadState({
        blob,
        filename,
        outputCount: outputs.length,
      });
      attempt.success(outputs.length);
      setStatus("success");
      setStatusMessage(
        `Converted ${outputs.length} image${outputs.length === 1 ? "" : "s"} — ready to download.`,
      );
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(error instanceof Error ? error.message : "Conversion failed");
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const state = downloadStateRef.current ?? downloadState;
    if (!state || isDownloading) return;
    setIsDownloading(true);
    try {
      downloadBlob(state.blob, state.filename, buildToolDownloadMeta(config.slug, state.outputCount));
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <div className="space-y-8">
      <div className="rounded-2xl border border-border bg-surface p-5 sm:p-6">
        <FormatDirection from={config.from} to={config.to} size="lg" />
        <p className="mt-4 text-sm text-foreground-muted">
          Supports {config.acceptExtensions.replaceAll(",", ", ")} · Output {config.outputLabel}
        </p>
      </div>

      {showTransparencyWarning && needsBackground ? (
        <div className="rounded-2xl border border-amber-500/25 bg-amber-500/10 px-4 py-3 text-sm text-amber-100/90">
          JPG does not support transparency. Transparent areas will be flattened onto your selected
          background colour.
        </div>
      ) : null}

      <ToolStatusBanner status={status} message={statusMessage} progress={progress} />

      <FileDropZone
        onFilesSelected={addFiles}
        accept={accept}
        validateFile={validateFile}
        disabled={isBusy}
        label={`Drop ${config.from.toUpperCase()} images here`}
        hint={`or click to browse — ${config.acceptExtensions}`}
        icon={<FileImage className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />}
      />

      {images.length > 0 ? (
        <>
          <ImagePreviewGrid
            images={images}
            onRemove={removeImage}
            onReorder={reorderImages}
            showDimensions
            disabled={isBusy}
          />

          {hasResult && downloadState ? (
            <ToolResultsPanel
              primaryLabel={
                downloadState.outputCount === 1
                  ? `Download ${config.outputLabel}`
                  : `Download ${config.outputLabel} (ZIP)`
              }
              primaryLoading={isDownloading}
              primaryDisabled={isBusy}
              onPrimaryClick={handleDownload}
              onStartOver={clearAll}
            >
              <p className="text-sm text-scanonix-muted">
                {downloadState.outputCount} file{downloadState.outputCount === 1 ? "" : "s"} ·{" "}
                {formatFileSize(downloadState.blob.size)} · {downloadState.filename}
              </p>
            </ToolResultsPanel>
          ) : null}

          <div className="grid gap-6 lg:grid-cols-[1fr_280px]">
            <div className="space-y-4 rounded-2xl border border-border bg-surface p-5">
              {(config.to === "jpg" || config.to === "webp") && (
                <div>
                  <label htmlFor="quality" className="text-sm font-medium text-foreground">
                    Quality ({quality}%)
                  </label>
                  <input
                    id="quality"
                    type="range"
                    min={60}
                    max={100}
                    value={quality}
                    disabled={isBusy}
                    onChange={(event) => {
                      invalidateResult();
                      setQuality(Number(event.target.value));
                    }}
                    className="mt-3 w-full accent-scanonix-orange"
                  />
                </div>
              )}
              {needsBackground ? (
                <div>
                  <label htmlFor="background-color" className="text-sm font-medium text-foreground">
                    Background colour
                  </label>
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      id="background-color"
                      type="color"
                      value={backgroundColor}
                      disabled={isBusy}
                      onChange={(event) => {
                        invalidateResult();
                        setBackgroundColor(event.target.value);
                      }}
                      className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
                    />
                    <span className="font-mono text-sm text-foreground-muted">{backgroundColor}</span>
                  </div>
                </div>
              ) : null}
            </div>

            <div className="flex flex-col justify-end gap-3">
              <ActionButton
                size="lg"
                className="w-full"
                loading={status === "loading"}
                disabled={images.length === 0 || isBusy}
                onClick={handleConvert}
              >
                {status === "loading" ? "Converting…" : `Convert to ${config.outputLabel}`}
              </ActionButton>
              {!hasResult ? (
                <ActionButton variant="outline" className="w-full" disabled={isBusy} onClick={clearAll}>
                  Reset
                </ActionButton>
              ) : null}
              <PrivacyNotice />
            </div>
          </div>
        </>
      ) : (
        <PrivacyNotice />
      )}

      <ToolStickyMobileActionBar
        visible={hasResult}
        primaryLabel={
          downloadState?.outputCount === 1
            ? `Download ${config.outputLabel}`
            : `Download ${config.outputLabel}s`
        }
        primaryLoading={isDownloading}
        primaryDisabled={isBusy}
        onPrimaryClick={handleDownload}
        secondaryLabel="Reset"
        onSecondaryClick={clearAll}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
