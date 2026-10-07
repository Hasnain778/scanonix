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
import {
  TiffConverterQueue,
  type TiffPreviewView,
} from "@/components/image-tools/TiffConverterQueue";
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
import { createTiffPreview } from "@/lib/image/tiff-preview";
import { inspectTiffFile } from "@/lib/image/tiff-decode";
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
  const [tiffPreviews, setTiffPreviews] = useState<Record<string, TiffPreviewView>>({});
  const [resultPreviewUrl, setResultPreviewUrl] = useState<string | null>(null);

  const downloadStateRef = useRef<DownloadState | null>(null);
  const imagesRef = useRef(images);
  const addMoreInputRef = useRef<HTMLInputElement>(null);
  const tiffPreviewUrls = useRef<Map<string, string>>(new Map());
  const previewTokens = useRef<Map<string, symbol>>(new Map());
  const previewAlive = useRef(true);
  const tiffPreviewsRef = useRef(tiffPreviews);
  const resultPreviewRef = useRef<string | null>(null);
  const isTiff = config.from === "tiff";

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
    tiffPreviewsRef.current = tiffPreviews;
  }, [tiffPreviews]);

  useEffect(() => {
    downloadStateRef.current = downloadState;
  }, [downloadState]);

  useEffect(() => {
    const urls = tiffPreviewUrls.current;
    const tokens = previewTokens.current;
    previewAlive.current = true;
    return () => {
      previewAlive.current = false;
      tokens.clear();
      imagesRef.current.forEach((image) => {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
      urls.forEach((url) => URL.revokeObjectURL(url));
      urls.clear();
      if (resultPreviewRef.current) URL.revokeObjectURL(resultPreviewRef.current);
    };
  }, []);

  useEffect(() => {
    if (images.length === 0 || !needsBackground || config.from === "tiff") {
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

  const replaceResultPreview = useCallback((blob: Blob | null) => {
    if (resultPreviewRef.current) URL.revokeObjectURL(resultPreviewRef.current);
    if (!blob) {
      resultPreviewRef.current = null;
      setResultPreviewUrl(null);
      return;
    }
    const url = URL.createObjectURL(blob);
    resultPreviewRef.current = url;
    setResultPreviewUrl(url);
  }, []);

  const invalidateResult = useCallback(() => {
    downloadStateRef.current = null;
    setDownloadState(null);
    replaceResultPreview(null);
    if (status === "success") {
      setStatus("idle");
      setStatusMessage(undefined);
    }
  }, [replaceResultPreview, status]);

  const loadDimensions = useCallback(async (id: string, file: File) => {
    try {
      const { width, height } =
        config.from === "tiff" ? await inspectTiffFile(file) : await getImageDimensions(file);
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
  }, [config.from]);

  const forgetTiffPreview = useCallback((id: string) => {
    previewTokens.current.delete(id);
    const url = tiffPreviewUrls.current.get(id);
    if (url) URL.revokeObjectURL(url);
    tiffPreviewUrls.current.delete(id);
    setTiffPreviews((current) => {
      if (!(id in current)) return current;
      const next = { ...current };
      delete next[id];
      return next;
    });
  }, []);

  const prepareTiffPreview = useCallback((id: string, file: File) => {
    const token = Symbol(id);
    previewTokens.current.set(id, token);
    setTiffPreviews((current) => ({ ...current, [id]: { status: "loading", url: null } }));

    void createTiffPreview(file).then((result) => {
      if (!previewAlive.current || previewTokens.current.get(id) !== token) {
        if (result.kind === "image") URL.revokeObjectURL(result.url);
        return;
      }

      if (result.kind === "image") {
        const previous = tiffPreviewUrls.current.get(id);
        if (previous) URL.revokeObjectURL(previous);
        tiffPreviewUrls.current.set(id, result.url);
      }

      setTiffPreviews((current) => ({
        ...current,
        [id]: {
          status: result.kind === "image" ? "ready" : "unavailable",
          url: result.kind === "image" ? result.url : null,
          extraPages: result.kind === "image" ? result.extraPages : false,
        },
      }));
      if (result.kind === "image" && config.to === "jpg") {
        setTransparencyDetected(result.hasTransparency);
      }
      setImages((current) =>
        current.map((item) =>
          item.id === id ? { ...item, width: result.width, height: result.height } : item,
        ),
      );
    }).catch(() => {
      if (!previewAlive.current || previewTokens.current.get(id) !== token) return;
      setTiffPreviews((current) => ({
        ...current,
        [id]: { status: "unavailable", url: null },
      }));
    });
  }, [config.to]);

  const markTiffPreviewUnavailable = useCallback((id: string) => {
    const url = tiffPreviewUrls.current.get(id);
    if (url) URL.revokeObjectURL(url);
    tiffPreviewUrls.current.delete(id);
    setTiffPreviews((current) => ({
      ...current,
      [id]: { status: "unavailable", url: null },
    }));
  }, []);

  const addFiles = useCallback(
    (files: File[]) => {
      const accepted = files.filter(validateFile);
      if (accepted.length === 0) return;

      const newImages: JpgImageItem[] = accepted.map((file) => ({
        id: createImageId(),
        file,
        previewUrl: isTiff ? "" : URL.createObjectURL(file),
        width: null,
        height: null,
      }));

      const nextCount = imagesRef.current.length + newImages.length;
      setImages((current) => [...current, ...newImages]);
      setStatus("idle");
      setStatusMessage(undefined);
      invalidateResult();
      if (!isTiff) {
        newImages.forEach((item) => void loadDimensions(item.id, item.file));
        return;
      }
      if (nextCount === 1) {
        prepareTiffPreview(newImages[0].id, newImages[0].file);
        return;
      }
      setTiffPreviews((current) => {
        const next = { ...current };
        newImages.forEach((item) => {
          next[item.id] = { status: "meta", url: null };
        });
        return next;
      });
      newImages.forEach((item) => void loadDimensions(item.id, item.file));
    },
    [invalidateResult, isTiff, loadDimensions, prepareTiffPreview, validateFile],
  );

  const removeImage = useCallback(
    (id: string) => {
      setImages((current) => {
        const target = current.find((image) => image.id === id);
        if (target?.previewUrl) URL.revokeObjectURL(target.previewUrl);
        return current.filter((image) => image.id !== id);
      });
      forgetTiffPreview(id);
      invalidateResult();
      if (!isTiff) return;
      const remaining = imagesRef.current.filter((image) => image.id !== id);
      if (remaining.length !== 1) return;
      const item = remaining[0];
      const preview = tiffPreviewsRef.current[item.id];
      if (!preview || preview.status === "meta") prepareTiffPreview(item.id, item.file);
    },
    [forgetTiffPreview, invalidateResult, isTiff, prepareTiffPreview],
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
      current.forEach((image) => {
        if (image.previewUrl) URL.revokeObjectURL(image.previewUrl);
      });
      return [];
    });
    previewTokens.current.clear();
    tiffPreviewUrls.current.forEach((url) => URL.revokeObjectURL(url));
    tiffPreviewUrls.current.clear();
    setTiffPreviews({});
    downloadStateRef.current = null;
    setDownloadState(null);
    replaceResultPreview(null);
    setStatus("idle");
    setStatusMessage(undefined);
    setProgress(undefined);
    setIsDownloading(false);
    setTransparencyDetected(false);
  }, [replaceResultPreview]);

  const handleConvert = async () => {
    if (images.length === 0 || isBusy) return;

    const attempt = createProcessAttempt(config.slug);

    const gate = await gateToolOperation(config.slug);
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
    replaceResultPreview(null);

    try {
      const { outputs, notice } = await convertImageFiles(
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
      replaceResultPreview(isTiff && outputs.length === 1 ? blob : null);
      attempt.success(outputs.length);
      setStatus("success");
      const ready = `Converted ${outputs.length} image${outputs.length === 1 ? "" : "s"} \u2014 ready to download.`;
      setStatusMessage(notice ? `${ready} ${notice}` : ready);
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

  const tiffSettings = showOptions ? (
    <div className="space-y-5" data-converter-options="" aria-label="Conversion options">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
        Settings
      </p>
      {showQuality ? (
        <div>
          <div className="flex items-center justify-between gap-3">
            <label
              htmlFor={`${config.slug}-quality`}
              className="text-sm font-medium text-foreground"
            >
              Quality
            </label>
            <span className="text-sm font-semibold text-scanonix-orange">{quality}%</span>
          </div>
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
            className="converter-quality mt-3 w-full"
          />
        </div>
      ) : null}
      {needsBackground ? (
        <div>
          <label
            htmlFor={`${config.slug}-background-color`}
            className="text-sm font-medium text-foreground"
          >
            Background colour
          </label>
          <div className="mt-3 flex items-center gap-3">
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
              className="tiff-color"
            />
            <span className="font-mono text-sm text-scanonix-muted">{backgroundColor}</span>
          </div>
          {showTransparencyWarning ? (
            <p className="mt-3 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs leading-relaxed text-foreground">
              JPG does not support transparency. Transparent areas will be
              flattened onto your selected background colour.
            </p>
          ) : null}
        </div>
      ) : null}
    </div>
  ) : (
    <div data-tiff-inspector-body="png">
      <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
        Output
      </p>
      <p className="mt-2 text-sm font-semibold text-foreground">PNG</p>
      <p className="mt-1 text-xs leading-relaxed text-scanonix-muted">Transparency preserved</p>
    </div>
  );

  const desktopPrimary = (className: string) => (
    <ActionButton
      size="lg"
      className={className}
      data-converter-primary="desktop"
      loading={hasResult ? isDownloading : status === "loading"}
      disabled={hasResult ? isBusy : images.length === 0 || isBusy}
      onClick={runPrimary}
    >
      {primaryLabel}
    </ActionButton>
  );

  return (
    <div
      className={`image-converter-premium space-y-5 overflow-x-hidden${isTiff ? " tiff-workspace" : ""}`}
    >
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
            <div
              className={
                isTiff
                  ? "tiff-stage mx-auto grid w-full max-w-[62rem] items-start gap-6 lg:grid-cols-[minmax(0,1fr)_340px] lg:gap-x-10"
                  : undefined
              }
            >
              <div className={isTiff ? "tiff-main min-w-0 space-y-4" : "space-y-5"}>
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
                    {isTiff
                      ? images.length > 1
                        ? "Drag to reorder."
                        : "Selected file"
                      : "Drag to reorder."}
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

              {isTiff ? (
                <TiffConverterQueue
                  images={images}
                  previews={tiffPreviews}
                  resultPreviewUrl={resultPreviewUrl}
                  onRemove={removeImage}
                  onReorder={reorderImages}
                  onPreviewError={markTiffPreviewUnavailable}
                  disabled={isBusy}
                />
              ) : (
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
              )}

              {!isTiff && showOptions ? (
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

              {!isTiff ? (
                <div className="hidden lg:block">
                  {desktopPrimary("h-12 min-w-56 px-8 shadow-[var(--shadow-orange-sm)]")}
                </div>
              ) : null}
              </div>

              {isTiff ? (
                <aside
                  className="tiff-inspector min-w-0 w-full lg:w-[340px] lg:max-w-[340px] lg:justify-self-start"
                  aria-label="Conversion settings"
                >
                  {tiffSettings}
                  <div className="tiff-inspector-action hidden lg:block">
                    {desktopPrimary("h-12 w-full shadow-[var(--shadow-orange-sm)]")}
                  </div>
                </aside>
              ) : null}
            </div>
          ) : null
        }
      />

      {images.length > 0 ? (
        <div className={isTiff ? "converter-privacy tiff-privacy" : "converter-privacy"}>
          <PrivacyNotice message={PRIVACY_MESSAGE} />
        </div>
      ) : null}

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
