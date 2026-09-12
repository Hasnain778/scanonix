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
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { FormatDirection } from "@/components/image-tools/FormatDirection";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
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
  /** Presentational only — quality/background changes still invalidate via existing handlers. */
  const [showSettingsAfterResult, setShowSettingsAfterResult] = useState(false);

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
  const showResultInspector = hasResult && !showSettingsAfterResult;
  const needsBackground = config.to === "jpg";
  const showQuality = config.to === "jpg" || config.to === "webp";
  const showTransparencyWarning =
    needsBackground && images.length > 0 && transparencyDetected;

  const fromLabel = FORMAT_LABELS[config.from];
  const toLabel = FORMAT_LABELS[config.to];

  const totalInputBytes = useMemo(
    () => images.reduce((sum, item) => sum + item.file.size, 0),
    [images],
  );

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (status === "loading") return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (images.length > 0) return "ready";
    return "idle";
  }, [status, hasResult, images.length]);

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
      setShowSettingsAfterResult(false);
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
      setShowSettingsAfterResult(false);
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
      setShowSettingsAfterResult(false);
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
    setShowSettingsAfterResult(false);
  }, []);

  const handleChangeSettings = useCallback(() => {
    setShowSettingsAfterResult(true);
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
    setShowSettingsAfterResult(false);

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
        `Converted ${outputs.length} image${outputs.length === 1 ? "" : "s"} — ready to download.`,
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

  const convertHint =
    images.length === 0
      ? `Add ${fromLabel} images before converting.`
      : status === "loading"
        ? progress
          ? `Converting… ${progress.current} of ${progress.total}`
          : "Converting…"
        : `Ready to convert ${images.length} image${images.length === 1 ? "" : "s"}.`;

  const downloadPrimaryLabel =
    downloadState?.outputCount === 1
      ? `Download ${config.outputLabel}`
      : `Download ${config.outputLabel}s`;

  return (
    <div className="space-y-5 overflow-x-hidden">
      <ToolStatusBanner
        status={status}
        message={statusMessage}
        progress={progress}
      />

      <ToolWorkspaceShell
        isEmpty={images.length === 0}
        empty={
          <>
            <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
              <FormatDirection from={config.from} to={config.to} size="lg" />
              <p className="mt-3 text-sm text-scanonix-muted">
                Supports {config.acceptExtensions.replaceAll(",", ", ")} ·
                Output {config.outputLabel}
              </p>
            </div>
            <FileDropZone
              onFilesSelected={addFiles}
              accept={accept}
              validateFile={validateFile}
              disabled={isBusy}
              label={`Drop ${fromLabel} images here`}
              hint={`or click to browse — ${config.acceptExtensions}`}
              icon={<ConverterIcon />}
            />
            <PrivacyNotice message={PRIVACY_MESSAGE} />
          </>
        }
        workArea={
          images.length > 0 ? (
            <div className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]">
              <div className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4">
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <ConverterIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {images.length} image{images.length === 1 ? "" : "s"}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(totalInputBytes)} · {fromLabel} → {toLabel}
                    </p>
                  </div>
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
                      onClick={clearAll}
                    >
                      Start over
                    </ActionButton>
                  </div>
                </div>
              </div>

              <div className="border-b border-border/80 bg-surface px-3 py-2 sm:px-4">
                <p className="text-sm font-semibold text-foreground">
                  Conversion queue
                </p>
                <p className="text-[11px] text-scanonix-muted">
                  Drag images to reorder conversion output.
                  {config.from === "heic"
                    ? " HEIC previews may not display in every browser — filenames and order still apply."
                    : ""}
                </p>
              </div>

              <div className="bg-surface-muted/30 p-3 sm:p-4">
                <ImagePreviewGrid
                  images={images}
                  onRemove={removeImage}
                  onReorder={reorderImages}
                  showDimensions
                  disabled={isBusy}
                />
              </div>
            </div>
          ) : null
        }
        controlPanel={
          images.length > 0 ? (
            <ToolControlPanel
              aria-label={`${config.title} controls`}
              footer={
                showResultInspector && downloadState ? (
                  <div className="flex flex-col gap-2">
                    <div className="hidden md:block">
                      <ActionButton
                        size="lg"
                        className="w-full"
                        loading={isDownloading}
                        disabled={isBusy}
                        onClick={() => {
                          void handleDownload();
                        }}
                      >
                        {downloadState.outputCount === 1
                          ? `Download ${config.outputLabel}`
                          : `Download ${config.outputLabel} (ZIP)`}
                      </ActionButton>
                    </div>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={handleChangeSettings}
                    >
                      Change settings
                    </ActionButton>
                    <div className="hidden md:block">
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={clearAll}
                      >
                        Start over
                      </ActionButton>
                    </div>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    <p className="text-[11px] leading-snug text-scanonix-muted">
                      {convertHint}
                    </p>
                    <ActionButton
                      size="lg"
                      className="w-full shadow-[var(--shadow-orange-sm)]"
                      loading={status === "loading"}
                      disabled={images.length === 0 || isBusy}
                      onClick={() => {
                        void handleConvert();
                      }}
                    >
                      {status === "loading"
                        ? "Converting…"
                        : `Convert to ${config.outputLabel}`}
                    </ActionButton>
                    <ActionButton
                      variant="outline"
                      size="lg"
                      className="w-full"
                      disabled={isBusy}
                      onClick={clearAll}
                    >
                      Start over
                    </ActionButton>
                  </div>
                )
              }
            >
              {showResultInspector && downloadState ? (
                <div className="space-y-4">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Result
                    </p>
                    <p className="mt-1.5 text-sm font-semibold text-green-700 dark:text-green-400">
                      ✓ Conversion complete
                    </p>
                    <p className="mt-1 text-xs text-scanonix-muted">
                      Your {config.outputLabel}{" "}
                      {downloadState.outputCount === 1 ? "file is" : "files are"}{" "}
                      ready to download.
                    </p>
                  </div>

                  <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Output format</dt>
                      <dd className="font-semibold text-foreground">
                        {config.outputLabel}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Files</dt>
                      <dd className="font-semibold text-foreground">
                        {downloadState.outputCount}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Download</dt>
                      <dd className="font-semibold text-foreground">
                        {downloadState.outputCount === 1
                          ? "Single file"
                          : "ZIP archive"}
                      </dd>
                    </div>
                    <div className="flex justify-between gap-3 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Package size</dt>
                      <dd className="font-semibold text-foreground">
                        {formatFileSize(downloadState.blob.size)}
                      </dd>
                    </div>
                    <div className="min-w-0 px-3 py-2.5">
                      <dt className="text-scanonix-muted">Filename</dt>
                      <dd className="mt-0.5 truncate font-semibold text-foreground">
                        {downloadState.filename}
                      </dd>
                    </div>
                  </dl>
                </div>
              ) : (
                <div className="space-y-5">
                  <div>
                    <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      {config.title}
                    </p>
                    <p className="mt-1.5 text-xs leading-relaxed text-scanonix-muted">
                      Convert your {fromLabel} images to {toLabel}.
                    </p>
                  </div>

                  <section className="space-y-2.5">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Format
                    </h2>
                    <FormatDirection from={config.from} to={config.to} size="md" />
                  </section>

                  {showQuality ? (
                    <section className="space-y-2.5 border-t border-border/80 pt-4">
                      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Quality
                      </h2>
                      <label
                        htmlFor={`${config.slug}-quality`}
                        className="block text-sm font-medium text-foreground"
                      >
                        Quality ({quality}%)
                      </label>
                      <input
                        id={`${config.slug}-quality`}
                        type="range"
                        min={60}
                        max={100}
                        value={quality}
                        disabled={isBusy}
                        onChange={(event) => {
                          invalidateResult();
                          setShowSettingsAfterResult(true);
                          setQuality(Number(event.target.value));
                        }}
                        className="mt-1 w-full accent-scanonix-orange"
                      />
                    </section>
                  ) : null}

                  {needsBackground ? (
                    <section className="space-y-2.5 border-t border-border/80 pt-4">
                      <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Background
                      </h2>
                      <label
                        htmlFor={`${config.slug}-background-color`}
                        className="block text-sm font-medium text-foreground"
                      >
                        Background colour
                      </label>
                      <div className="mt-2 flex items-center gap-3">
                        <input
                          id={`${config.slug}-background-color`}
                          type="color"
                          value={backgroundColor}
                          disabled={isBusy}
                          onChange={(event) => {
                            invalidateResult();
                            setShowSettingsAfterResult(true);
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
                    </section>
                  ) : null}

                  <section className="space-y-2.5 border-t border-border/80 pt-4">
                    <h2 className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                      Summary
                    </h2>
                    <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Input</dt>
                        <dd className="font-semibold text-foreground">
                          {fromLabel}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Output</dt>
                        <dd className="font-semibold text-foreground">
                          {toLabel}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Images</dt>
                        <dd className="font-semibold text-foreground">
                          {images.length}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Input size</dt>
                        <dd className="font-semibold text-foreground">
                          {formatFileSize(totalInputBytes)}
                        </dd>
                      </div>
                      {showQuality ? (
                        <div className="flex justify-between gap-3 px-3 py-2.5">
                          <dt className="text-scanonix-muted">Quality</dt>
                          <dd className="font-semibold text-foreground">
                            {quality}%
                          </dd>
                        </div>
                      ) : null}
                      {needsBackground ? (
                        <div className="flex justify-between gap-3 px-3 py-2.5">
                          <dt className="text-scanonix-muted">Background</dt>
                          <dd className="font-mono font-semibold text-foreground">
                            {backgroundColor}
                          </dd>
                        </div>
                      ) : null}
                    </dl>
                  </section>

                  <section className="space-y-2 border-t border-border/80 pt-4">
                    <PrivacyNotice message={PRIVACY_MESSAGE} />
                  </section>
                </div>
              )}
            </ToolControlPanel>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={hasResult}
        phase={resultActionPhase}
        primaryLabel={downloadPrimaryLabel}
        primaryLoading={isDownloading}
        primaryDisabled={isBusy}
        onPrimaryClick={() => {
          void handleDownload();
        }}
        secondaryLabel="Reset"
        onSecondaryClick={clearAll}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
