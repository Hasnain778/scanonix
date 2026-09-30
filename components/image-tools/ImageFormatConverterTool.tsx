"use client";

import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ChangeEvent,
} from "react";
import { FileImage } from "lucide-react";
import type { ImageConverterDefinition } from "@/constants/image-tools";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { ImagePreviewGrid } from "@/components/tools/ImagePreviewGrid";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import "@/styles/image-converter-premium.css";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";
import {
  convertImageFiles,
  detectTransparencyForFiles,
} from "@/lib/image/convert-format";
import {
  FORMAT_LABELS,
  formatAcceptAttribute,
  validateFormatFile,
} from "@/lib/image/formats";
import { gateToolOperation } from "@/lib/plan/tool-gate";
import { downloadBlob, packageOutputsForDownload } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import { createImageId, getImageDimensions } from "@/lib/tools/image-utils";
import type { JpgImageItem, ToolStatus } from "@/lib/tools/types";

const PRIVACY_MESSAGE =
  "Your images are processed locally in your browser and never uploaded to any server. Scanonix does not store or access your documents.";

interface DownloadState {
  blob: Blob;
  filename: string;
  outputCount: number;
}

interface ImageFormatConverterToolProps {
  config: ImageConverterDefinition;
}

function ConverterIcon({ className = "h-7 w-7" }: { className?: string }) {
  return (
    <FileImage className={className} strokeWidth={1.75} aria-hidden="true" />
  );
}

export function ImageFormatConverterTool({
  config,
}: ImageFormatConverterToolProps) {
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
  const addMoreInputRef = useRef<HTMLInputElement>(null);

  const accept = useMemo(
    () => formatAcceptAttribute(config.from),
    [config.from],
  );
  const validateFile = useCallback(
    (file: File) => validateFormatFile(file, config.from),
    [config.from],
  );

  const isBusy = status === "loading" || isDownloading;
  const hasResult = downloadState !== null && status === "success";
  const needsBackground = config.to === "jpg";
  const showQuality = config.to === "jpg" || config.to === "webp";
  const showTransparencyWarning =
    needsBackground && images.length > 0 && transparencyDetected;

  const fromLabel = FORMAT_LABELS[config.from];

  const totalInputBytes = useMemo(
    () => images.reduce((sum, item) => sum + item.file.size, 0),
    [images],
  );

  useEffect(() => {
    imagesRef.current = images;
  }, [images]);

  useEffect(() => {
    downloadStateRef.current = downloadState;
  }, [downloadState]);

  useEffect(() => {
    return () => {
      imagesRef.current.forEach((image) =>
        URL.revokeObjectURL(image.previewUrl),
      );
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
        current.map((item) =>
          item.id === id ? { ...item, width, height } : item,
        ),
      );
    } catch {
      setImages((current) =>
        current.map((item) =>
          item.id === id ? { ...item, width: null, height: null } : item,
        ),
      );
    }
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter(validateFile);
      if (accepted.length === 0) return;

      const newImages: JpgImageItem[] = accepted.map((file) => ({
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
    [invalidateResult, loadDimensions, validateFile],
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
      const { blob, filename } = await packageOutputsForDownload(
        outputs,
        zipName,
      );

      setDownloadState({
        blob,
        filename,
        outputCount: outputs.length,
      });
      attempt.success(outputs.length);
      setStatus("success");
      setStatusMessage(
        `Converted ${outputs.length} image${outputs.length === 1 ? "" : "s"} \u2014 ready to download.`,
      );
      setProgress(undefined);
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof Error ? error.message : "Conversion failed",
      );
      setProgress(undefined);
    }
  };

  const handleDownload = async () => {
    const state = downloadStateRef.current ?? downloadState;
    if (!state || isDownloading) return;
    setIsDownloading(true);
    try {
      downloadBlob(
        state.blob,
        state.filename,
        buildToolDownloadMeta(config.slug, state.outputCount),
      );
    } finally {
      setIsDownloading(false);
    }
  };

  const handleAddMoreChange = (event: ChangeEvent<HTMLInputElement>) => {
    const files = event.target.files ? Array.from(event.target.files) : [];
    event.target.value = "";
    if (files.length > 0) {
      addFiles(files);
    }
  };

  const showOptions = showQuality || needsBackground;
  const primaryLabel = hasResult
    ? downloadState?.outputCount === 1
      ? `Download ${config.outputLabel}`
      : `Download ${config.outputLabel} (ZIP)`
    : status === "loading"
      ? "Converting\u2026"
      : `Convert to ${config.outputLabel}`;

  const runPrimary = () => {
    if (hasResult) {
      void handleDownload();
      return;
    }
    void handleConvert();
  };

  return (
    <div className="image-converter-premium space-y-5 overflow-x-hidden">
      <ToolStatusBanner
        status={status}
        message={statusMessage}
        progress={progress}
      />

      <ToolWorkspaceShell
        isEmpty={images.length === 0}
        empty={
          <>
            <FileDropZone
              className="converter-drop"
              onFilesSelected={addFiles}
              accept={accept}
              validateFile={validateFile}
              disabled={isBusy}
              label={`Drop ${fromLabel} images here`}
              hint={`or click to browse \u2014 ${config.acceptExtensions} \u00B7 Output ${config.outputLabel}`}
              icon={<ConverterIcon />}
            />
            <div className="converter-privacy">
              <PrivacyNotice message={PRIVACY_MESSAGE} />
            </div>
          </>
        }
        workArea={
          images.length > 0 ? (
            <div className="space-y-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-foreground">
                    {images.length} image{images.length === 1 ? "" : "s"}
                    <span className="font-normal text-scanonix-muted">
                      {" \u00B7 "}
                      {formatFileSize(totalInputBytes)}
                    </span>
                  </p>
                  <p className="mt-0.5 text-xs text-scanonix-muted">
                    Drag to reorder.
                    {config.from === "heic"
                      ? " HEIC previews may not display in every browser \u2014 filenames and order still apply."
                      : ""}
                  </p>
                </div>
                <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
                  <input
                    ref={addMoreInputRef}
                    type="file"
                    accept={accept}
                    multiple
                    className="sr-only"
                    disabled={isBusy}
                    onChange={handleAddMoreChange}
                  />
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={() => addMoreInputRef.current?.click()}
                  >
                    Add more
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="sm"
                    className="w-full rounded-lg sm:w-auto"
                    disabled={isBusy}
                    onClick={clearAll}
                  >
                    Start over
                  </ActionButton>
                </div>
              </div>

              <div className="converter-queue min-w-0">
                <ImagePreviewGrid
                  images={images}
                  onRemove={removeImage}
                  onReorder={reorderImages}
                  showDimensions
                  showHeading={false}
                  disabled={isBusy}
                />
              </div>

              {showOptions ? (
                <section
                  className="converter-options max-w-xl space-y-4 rounded-xl border px-4 py-4"
                  data-converter-options=""
                  aria-label="Conversion options"
                >
                  {showQuality ? (
                    <div className="space-y-2">
                      <label
                        htmlFor={`${config.slug}-quality`}
                        className="block text-sm font-medium text-foreground"
                      >
                        Quality ({quality}%)
                      </label>
                      <input
                        id={`${config.slug}-quality`}
                        data-converter-control="quality"
                        type="range"
                        min={60}
                        max={100}
                        value={quality}
                        disabled={isBusy}
                        onChange={(event) => {
                          invalidateResult();
                          setQuality(Number(event.target.value));
                        }}
                        className="converter-quality w-full"
                      />
                    </div>
                  ) : null}

                  {needsBackground ? (
                    <div className="space-y-2">
                      <label
                        htmlFor={`${config.slug}-background-color`}
                        className="block text-sm font-medium text-foreground"
                      >
                        Background colour
                      </label>
                      <div className="flex items-center gap-3">
                        <input
                          id={`${config.slug}-background-color`}
                          data-converter-control="background"
                          type="color"
                          value={backgroundColor}
                          disabled={isBusy}
                          onChange={(event) => {
                            invalidateResult();
                            setBackgroundColor(event.target.value);
                          }}
                          className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
                        />
                        <span className="font-mono text-sm text-scanonix-muted">
                          {backgroundColor}
                        </span>
                      </div>
                      {showTransparencyWarning ? (
                        <p className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground">
                          JPG does not support transparency. Transparent areas
                          will be flattened onto your selected background colour.
                        </p>
                      ) : null}
                    </div>
                  ) : null}
                </section>
              ) : null}

              <div className="hidden lg:block">
                <ActionButton
                  size="lg"
                  className="h-12 min-w-56 px-8 shadow-[var(--shadow-orange-sm)]"
                  data-converter-primary="desktop"
                  loading={hasResult ? isDownloading : status === "loading"}
                  disabled={hasResult ? isBusy : images.length === 0 || isBusy}
                  onClick={runPrimary}
                >
                  {primaryLabel}
                </ActionButton>
              </div>

              <div className="converter-privacy">
                <PrivacyNotice message={PRIVACY_MESSAGE} />
              </div>
            </div>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={images.length > 0}
        stickyUntil="lg"
        primaryLabel={primaryLabel}
        primaryLoading={hasResult ? isDownloading : status === "loading"}
        primaryDisabled={hasResult ? isBusy : images.length === 0 || isBusy}
        onPrimaryClick={runPrimary}
      />
    </div>
  );
}
