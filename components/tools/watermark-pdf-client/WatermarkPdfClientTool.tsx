"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ChevronLeft, ChevronRight, Stamp } from "lucide-react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import type { ResultActionPhase } from "@/components/tools/result-action-types";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import { ToolControlPanel } from "@/components/workspace/ToolControlPanel";
import { ToolWorkspaceShell } from "@/components/workspace/ToolWorkspaceShell";
import {
  buildWatermarkExportOptions,
  canExportWatermarkWorkspace,
  clampFontSize,
  computeImageDrawSize,
  createDefaultWorkspaceSettings,
  createWatermarkPageGeometry,
  DEFAULT_WATERMARK_COLOR,
  DIGITAL_SIGNATURE_WATERMARK_WARNING,
  exportWatermarkedPdf,
  getRepeatPatternLabel,
  getTextValidationError,
  getUnsupportedCharacterError,
  getWatermarkPdfErrorMessage,
  getWatermarkImageFileError,
  isAcceptedWatermarkPdfFile,
  isTransparentPng,
  loadWatermarkDocumentState,
  mapEngineErrorToMessage,
  MAX_RELATIVE_WIDTH_PERCENT,
  MAX_WATERMARK_FONT_SIZE,
  MAX_WATERMARK_IMAGE_BYTES,
  MAX_WATERMARK_IMAGE_LONG_EDGE,
  MAX_WATERMARK_PDF_BYTES,
  measurePreviewTextWidth,
  MIN_RELATIVE_WIDTH_PERCENT,
  MIN_WATERMARK_FONT_SIZE,
  MARGIN_PRESET_OPTIONS,
  MAX_OPACITY_PERCENT,
  MIN_OPACITY_PERCENT,
  opacityPercentToEngine,
  resetWorkspaceSettings,
  resolvePageSelection,
  ROTATION_PRESET_OPTIONS,
  sanitizeUserFacingError,
  switchWatermarkMode,
  validateRotationInput,
  validateWorkspaceColor,
  WATERMARK_REPEAT_PATTERNS,
  WATERMARK_SECURITY_COPY,
  WATERMARK_UI_PRIVACY_COPY,
  watermarkMayOverlapInRepeatPattern,
  WatermarkPdfError,
  type ImageWorkspaceAsset,
  type WatermarkDocumentState,
  type WatermarkPlacementMode,
  type WatermarkRepeatPattern,
  type WatermarkType,
  type WatermarkWorkspaceSettings,
} from "@/lib/tools/watermark-pdf";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { PositionPicker } from "./PositionPicker";
import { WatermarkPdfPreview } from "./WatermarkPdfPreview";
import { createProcessAttempt } from "@/lib/analytics/process-lifecycle";
import { buildToolDownloadMeta } from "@/lib/analytics/download-meta";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  document: WatermarkDocumentState;
}

const WATERMARK_SOURCE_PDF_ACCEPT = "application/pdf";
const WATERMARK_IMAGE_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";

function WatermarkDropIcon({ className = "h-7 w-7" }: { className?: string }) {
  return <Stamp className={className} aria-hidden="true" strokeWidth={1.75} />;
}

function loadImageDimensions(
  bytes: Uint8Array,
  mimeType: string,
): Promise<{ width: number; height: number }> {
  return new Promise((resolve, reject) => {
    const blob = new Blob([Uint8Array.from(bytes)], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const image = new Image();

    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };

    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error("Could not read this image."));
    };

    image.src = url;
  });
}

export function WatermarkPdfClientTool() {
  const [uploadedPdf, setUploadedPdf] = useState<UploadedPdfState | null>(null);
  const [settings, setSettings] = useState<WatermarkWorkspaceSettings>(
    createDefaultWorkspaceSettings(),
  );
  const [imageAsset, setImageAsset] = useState<ImageWorkspaceAsset | null>(null);
  const [currentPageIndex, setCurrentPageIndex] = useState(0);
  const [customRotation, setCustomRotation] = useState("");

  const [isReadingPdf, setIsReadingPdf] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [status, setStatus] = useState<ToolStatus>("idle");
  const [statusMessage, setStatusMessage] = useState<string>();

  const imageAssetRef = useRef<ImageWorkspaceAsset | null>(null);
  const watermarkImageInputRef = useRef<HTMLInputElement>(null);
  const watermarkImageReplaceInputRef = useRef<HTMLInputElement>(null);

  const pageCount = uploadedPdf?.document.pageCount ?? 0;
  const currentPageEntry = uploadedPdf?.document.pages[currentPageIndex];
  const isBusy = isReadingPdf || isExporting;

  const selection = useMemo(() => {
    if (!uploadedPdf) {
      return { pages: [] as number[], error: undefined as string | undefined };
    }
    return resolvePageSelection(settings.allPages, settings.pageRangeInput, pageCount);
  }, [uploadedPdf, settings.allPages, settings.pageRangeInput, pageCount]);

  const textError = useMemo(
    () => (settings.mode === "text" ? getTextValidationError(settings.text) : undefined),
    [settings.mode, settings.text],
  );

  const unsupportedCharacterError = useMemo(
    () =>
      settings.mode === "text" ? getUnsupportedCharacterError(settings.text) : undefined,
    [settings.mode, settings.text],
  );

  const showRepeatOverlapWarning = useMemo(() => {
    if (settings.placementMode !== "repeat" || !currentPageEntry) {
      return false;
    }

    const geometry = createWatermarkPageGeometry(
      currentPageEntry.mediaBox,
      currentPageEntry.cropBox,
      currentPageEntry.intrinsicRotation,
    );

    if (settings.mode === "text") {
      const trimmed = settings.text.trim();
      if (!trimmed) return false;
      const textWidth = measurePreviewTextWidth(
        trimmed,
        settings.fontSize,
        settings.bold,
      );
      return watermarkMayOverlapInRepeatPattern(
        geometry.visualWidth,
        geometry.visualHeight,
        settings.repeatPattern,
        settings.margin,
        textWidth,
        settings.fontSize,
      );
    }

    if (!imageAsset) return false;
    const { width, height } = computeImageDrawSize(
      geometry,
      imageAsset.intrinsicWidth,
      imageAsset.intrinsicHeight,
      settings.relativeWidthPercent / 100,
    );
    return watermarkMayOverlapInRepeatPattern(
      geometry.visualWidth,
      geometry.visualHeight,
      settings.repeatPattern,
      settings.margin,
      width,
      height,
    );
  }, [
    settings.placementMode,
    settings.repeatPattern,
    settings.margin,
    settings.mode,
    settings.text,
    settings.fontSize,
    settings.bold,
    settings.relativeWidthPercent,
    currentPageEntry,
    imageAsset,
  ]);

  const canExport = useMemo(
    () =>
      uploadedPdf !== null &&
      canExportWatermarkWorkspace(
        pageCount,
        isExporting,
        selection.error,
        selection.pages.length,
        settings.mode,
        textError,
        imageAsset !== null,
      ),
    [
      uploadedPdf,
      pageCount,
      isExporting,
      selection.error,
      selection.pages.length,
      settings.mode,
      textError,
      imageAsset,
    ],
  );

  useEffect(() => {
    imageAssetRef.current = imageAsset;
  }, [imageAsset]);

  useEffect(() => {
    return () => {
      if (imageAssetRef.current?.previewUrl) {
        URL.revokeObjectURL(imageAssetRef.current.previewUrl);
      }
    };
  }, []);

  const revokeImageAsset = useCallback((asset: ImageWorkspaceAsset | null) => {
    if (asset?.previewUrl) {
      URL.revokeObjectURL(asset.previewUrl);
    }
  }, []);

  const resetSettingsState = useCallback(() => {
    setSettings(resetWorkspaceSettings());
    setCustomRotation("");
  }, []);

  const resetWorkspace = useCallback(() => {
    revokeImageAsset(imageAssetRef.current);
    setUploadedPdf(null);
    setImageAsset(null);
    setCurrentPageIndex(0);
    setStatus("idle");
    setStatusMessage(undefined);
    setIsExporting(false);
    resetSettingsState();
  }, [resetSettingsState, revokeImageAsset]);

  const handleSettingChange = useCallback(() => {
    setStatus("idle");
    setStatusMessage(undefined);
  }, []);

  const updateSettings = useCallback(
    (patch: Partial<WatermarkWorkspaceSettings>) => {
      setSettings((current) => ({ ...current, ...patch }));
      handleSettingChange();
    },
    [handleSettingChange],
  );

  const handleSourcePdfUpload = useCallback(async (files: File[]) => {
    const file = files[0];
    if (!file) return;

    if (!isAcceptedWatermarkPdfFile(file)) {
      setStatus("error");
      setStatusMessage("Please upload a PDF file.");
      return;
    }

    if (file.size > MAX_WATERMARK_PDF_BYTES) {
      const maxMb = Math.round(MAX_WATERMARK_PDF_BYTES / (1024 * 1024));
      setStatus("error");
      setStatusMessage(`File exceeds the ${maxMb}MB upload limit.`);
      return;
    }

    setIsReadingPdf(true);
    setStatus("idle");
    setStatusMessage(undefined);

    try {
      const bytes = await file.arrayBuffer();
      const document = await loadWatermarkDocumentState(bytes, {
        byteLength: file.size,
      });

      revokeImageAsset(imageAssetRef.current);
      setImageAsset(null);
      setUploadedPdf({ file, bytes, document });
      setCurrentPageIndex(0);
      resetSettingsState();
    } catch (error) {
      setUploadedPdf(null);
      setStatus("error");
      setStatusMessage(
        error instanceof WatermarkPdfError
          ? error.message
          : getWatermarkPdfErrorMessage(error),
      );
    } finally {
      setIsReadingPdf(false);
    }
  }, [resetSettingsState, revokeImageAsset]);

  const handleWatermarkImageUpload = useCallback(
    async (files: File[]) => {
      const file = files[0];
      if (!file) return;

      const typeError = getWatermarkImageFileError(file);
      if (typeError) {
        setStatus("error");
        setStatusMessage(typeError);
        return;
      }

      if (file.size > MAX_WATERMARK_IMAGE_BYTES) {
        const maxMb = Math.round(MAX_WATERMARK_IMAGE_BYTES / (1024 * 1024));
        setStatus("error");
        setStatusMessage(`Image watermark must be ${maxMb}MB or smaller.`);
        return;
      }

      try {
        const buffer = await file.arrayBuffer();
        const bytes = new Uint8Array(buffer);
        const lowerName = file.name.toLowerCase();
        const isPng = file.type === "image/png" || lowerName.endsWith(".png");
        const mimeType: "image/png" | "image/jpeg" = isPng ? "image/png" : "image/jpeg";
        const dimensions = await loadImageDimensions(bytes, mimeType);
        const longEdge = Math.max(dimensions.width, dimensions.height);

        if (longEdge > MAX_WATERMARK_IMAGE_LONG_EDGE) {
          setStatus("error");
          setStatusMessage(
            `Image watermark must be ${MAX_WATERMARK_IMAGE_LONG_EDGE}px or smaller on its longest edge.`,
          );
          return;
        }

        revokeImageAsset(imageAssetRef.current);
        const previewUrl = URL.createObjectURL(new Blob([bytes], { type: mimeType }));
        const nextAsset: ImageWorkspaceAsset = {
          bytes,
          previewUrl,
          fileName: file.name,
          mimeType,
          intrinsicWidth: dimensions.width,
          intrinsicHeight: dimensions.height,
          isTransparentPng: isPng && isTransparentPng(bytes),
        };

        setImageAsset(nextAsset);
        updateSettings({ mode: "image" });
        setStatus("idle");
        setStatusMessage(undefined);
      } catch (error) {
        setStatus("error");
        setStatusMessage(
          error instanceof Error ? error.message : "Could not read this image.",
        );
      }
    },
    [revokeImageAsset, updateSettings],
  );

  const handleWatermarkImageInputChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      void handleWatermarkImageUpload(files);
      event.target.value = "";
    },
    [handleWatermarkImageUpload],
  );

  const handleWatermarkImageReplaceChange = useCallback(
    (event: ChangeEvent<HTMLInputElement>) => {
      const files = event.target.files ? Array.from(event.target.files) : [];
      void handleWatermarkImageUpload(files);
      event.target.value = "";
    },
    [handleWatermarkImageUpload],
  );

  const openWatermarkImagePicker = useCallback(() => {
    watermarkImageInputRef.current?.click();
  }, []);

  const openWatermarkImageReplacePicker = useCallback(() => {
    watermarkImageReplaceInputRef.current?.click();
  }, []);

  const handleRemoveImage = useCallback(() => {
    revokeImageAsset(imageAssetRef.current);
    setImageAsset(null);
    handleSettingChange();
  }, [revokeImageAsset, handleSettingChange]);

  const handleModeChange = useCallback(
    (mode: WatermarkType) => {
      setSettings((current) => switchWatermarkMode(current, mode));
      handleSettingChange();
    },
    [handleSettingChange],
  );

  const handleColorBlur = () => {
    const colorError = validateWorkspaceColor(settings.color);
    if (colorError) {
      setStatus("error");
      setStatusMessage(colorError);
      return;
    }

    setStatus("idle");
    setStatusMessage(undefined);
  };

  const handleCustomRotationApply = () => {
    const parsed = Number(customRotation);
    const validated = validateRotationInput(parsed);
    if (validated === undefined) {
      setStatus("error");
      setStatusMessage("Enter a rotation between -360 and 360 degrees.");
      return;
    }

    updateSettings({ rotationDegrees: validated });
    setStatus("idle");
    setStatusMessage(undefined);
  };

  const handleDownloadWatermarkedPdf = async () => {
    if (!uploadedPdf || !canExport || isExporting) return;

    const attempt = createProcessAttempt("watermark-pdf");
    if (!attempt?.markStarted()) return;

    setIsExporting(true);
    setStatus("loading");
    setStatusMessage("Watermarking PDF…");

    try {
      const options = buildWatermarkExportOptions(
        settings,
        imageAsset?.bytes ?? null,
      );

      const result = await exportWatermarkedPdf(
        uploadedPdf.bytes,
        options,
        uploadedPdf.file.name,
        (current, total) => {
          setStatusMessage(`Watermarking pages (${current}/${total})…`);
        },
      );

      const blob = new Blob([Uint8Array.from(result.bytes)], {
        type: "application/pdf",
      });
      downloadBlob(blob, result.filename, buildToolDownloadMeta("watermark-pdf", 1));
      attempt.success(1);
      setStatus("success");
      setStatusMessage("Watermarked PDF downloaded.");
    } catch (error) {
      attempt.error("unknown");
      setStatus("error");
      setStatusMessage(
        error instanceof WatermarkPdfError
          ? mapEngineErrorToMessage(
              error.code,
              sanitizeUserFacingError(error.message) ?? error.message,
            )
          : getWatermarkPdfErrorMessage(error),
      );
    } finally {
      setIsExporting(false);
    }
  };

  const hasResult = status === "success";

  const resultActionPhase: ResultActionPhase = useMemo(() => {
    if (isExporting || isReadingPdf) return "processing";
    if (hasResult) return "success";
    if (status === "error") return "error";
    if (uploadedPdf && canExport) return "ready";
    return "idle";
  }, [isExporting, isReadingPdf, hasResult, status, uploadedPdf, canExport]);

  const stickyVisible = Boolean(
    uploadedPdf && (canExport || isExporting || hasResult),
  );

  const exportHint = canExport
    ? "Ready to add your watermark and download."
    : selection.error
      ? "Fix the page range before continuing."
      : textError
        ? "Enter valid watermark text."
        : settings.mode === "image" && !imageAsset
          ? "Upload a watermark image to continue."
          : "Configure watermark options.";

  const settingsBody = (
    <div className="space-y-4">
      <div>
        <div className="flex items-center gap-2">
          <Stamp
            className="h-4 w-4 text-scanonix-orange"
            aria-hidden="true"
          />
          <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Watermark PDF
          </p>
        </div>
        <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
          Choose the watermark content, style, and placement. Preview updates
          live on the left.
        </p>
      </div>

      <section className="space-y-2.5">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
          Watermark
        </p>
        <div
          data-watermark-mode-selector
          className="inline-flex w-full rounded-lg border border-border bg-surface-muted p-1"
          role="group"
          aria-label="Watermark type"
        >
          {(["text", "image"] as const).map((mode) => {
            const selected = settings.mode === mode;
            return (
              <button
                key={mode}
                type="button"
                data-watermark-mode={mode}
                aria-pressed={selected}
                disabled={isBusy}
                onClick={() => handleModeChange(mode)}
                className={`flex-1 rounded-md px-3 py-2 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "bg-scanonix-orange/15 text-scanonix-orange shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_30%,transparent)]"
                    : "text-scanonix-muted hover:text-foreground"
                }`}
              >
                {mode === "text" ? "TEXT" : "IMAGE"}
              </button>
            );
          })}
        </div>

        {settings.mode === "text" ? (
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-scanonix-muted">
              Watermark text
            </span>
            <input
              type="text"
              data-watermark-text-input
              value={settings.text}
              disabled={isBusy}
              onChange={(event) => updateSettings({ text: event.target.value })}
              className="input-field"
              aria-describedby={
                unsupportedCharacterError ? "watermark-text-error" : undefined
              }
            />
            {unsupportedCharacterError && (
              <p id="watermark-text-error" className="mt-2 text-xs text-red-600">
                {unsupportedCharacterError}
              </p>
            )}
          </label>
        ) : (
          <div className="space-y-3" data-watermark-image-upload-section>
            <span className="block text-xs font-medium text-scanonix-muted">
              Watermark image
            </span>
            <input
              ref={watermarkImageInputRef}
              id="watermark-image-input"
              type="file"
              accept={WATERMARK_IMAGE_ACCEPT}
              data-watermark-image-input
              className="sr-only"
              disabled={isBusy}
              onChange={handleWatermarkImageInputChange}
            />
            <input
              ref={watermarkImageReplaceInputRef}
              id="watermark-image-replace-input"
              type="file"
              accept={WATERMARK_IMAGE_ACCEPT}
              data-watermark-image-replace-input
              className="sr-only"
              disabled={isBusy}
              onChange={handleWatermarkImageReplaceChange}
            />
            {imageAsset ? (
              <div
                className="space-y-3 rounded-xl border border-border bg-surface-muted p-3"
                data-watermark-image-selected
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageAsset.previewUrl}
                  alt="Watermark preview"
                  data-watermark-image-thumbnail
                  className="mx-auto max-h-28 w-auto object-contain"
                />
                <p
                  className="truncate text-center text-xs text-scanonix-muted"
                  data-watermark-image-filename
                  title={imageAsset.fileName}
                >
                  {imageAsset.fileName}
                </p>
                {imageAsset.isTransparentPng && (
                  <p
                    className="text-xs text-scanonix-muted"
                    data-watermark-transparent-png-notice
                  >
                    Transparent PNG detected — transparency will be preserved.
                  </p>
                )}
                <div className="flex flex-wrap gap-2">
                  <ActionButton
                    variant="outline"
                    size="sm"
                    data-watermark-replace-image
                    disabled={isBusy}
                    onClick={openWatermarkImageReplacePicker}
                  >
                    Replace image
                  </ActionButton>
                  <ActionButton
                    variant="outline"
                    size="sm"
                    data-watermark-remove-image
                    disabled={isBusy}
                    onClick={handleRemoveImage}
                  >
                    Remove image
                  </ActionButton>
                </div>
              </div>
            ) : (
              <div className="space-y-3 rounded-xl border border-dashed border-border bg-surface-muted px-4 py-5 text-center">
                <p className="text-sm text-scanonix-muted">
                  Upload a PNG or JPEG to use as your watermark image.
                </p>
                <ActionButton
                  variant="outline"
                  size="sm"
                  data-watermark-upload-image-button
                  disabled={isBusy}
                  onClick={openWatermarkImagePicker}
                >
                  Upload PNG or JPEG
                </ActionButton>
                <span className="sr-only" data-watermark-upload-image-label>
                  Upload watermark image
                </span>
              </div>
            )}
          </div>
        )}
      </section>

      <section className="space-y-3 border-t border-border/80 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
          Style
        </p>

        {settings.mode === "text" && (
          <>
            <label className="block text-sm" data-watermark-font-size-control>
              <span className="mb-1.5 block text-xs font-medium text-scanonix-muted">
                Font size ({MIN_WATERMARK_FONT_SIZE}–{MAX_WATERMARK_FONT_SIZE}{" "}
                pt)
              </span>
              <input
                type="number"
                data-watermark-font-size-input
                min={MIN_WATERMARK_FONT_SIZE}
                max={MAX_WATERMARK_FONT_SIZE}
                step={1}
                value={settings.fontSize}
                disabled={isBusy}
                onChange={(event) =>
                  updateSettings({
                    fontSize: clampFontSize(Number(event.target.value)),
                  })
                }
                className="input-field"
              />
            </label>

            <div className="space-y-2" data-watermark-color-control>
              <span className="block text-xs font-medium text-scanonix-muted">
                Color
              </span>
              <div className="flex items-center gap-3">
                <input
                  type="color"
                  data-watermark-color-picker
                  value={
                    /^#[0-9a-fA-F]{6}$/.test(settings.color)
                      ? settings.color
                      : DEFAULT_WATERMARK_COLOR
                  }
                  disabled={isBusy}
                  onChange={(event) =>
                    updateSettings({ color: event.target.value })
                  }
                  className="h-10 w-12 cursor-pointer rounded-md border border-border bg-surface-muted p-1"
                  aria-label="Watermark color"
                />
                <input
                  type="text"
                  data-watermark-color-input
                  value={settings.color}
                  disabled={isBusy}
                  onChange={(event) =>
                    updateSettings({ color: event.target.value })
                  }
                  onBlur={handleColorBlur}
                  placeholder="#666666"
                  className="input-field min-w-0 flex-1 font-mono text-sm"
                  aria-label="Watermark hex color"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-foreground">
              <input
                type="checkbox"
                data-watermark-bold-input
                checked={settings.bold}
                disabled={isBusy}
                onChange={(event) =>
                  updateSettings({ bold: event.target.checked })
                }
                className="h-4 w-4 accent-scanonix-orange"
              />
              Bold
            </label>
          </>
        )}

        {settings.mode === "image" && (
          <label className="block text-sm">
            <span className="mb-1.5 block text-xs font-medium text-scanonix-muted">
              Image width ({MIN_RELATIVE_WIDTH_PERCENT}–
              {MAX_RELATIVE_WIDTH_PERCENT}% of page)
            </span>
            <input
              type="range"
              data-watermark-image-width-input
              min={MIN_RELATIVE_WIDTH_PERCENT}
              max={MAX_RELATIVE_WIDTH_PERCENT}
              step={1}
              value={settings.relativeWidthPercent}
              disabled={isBusy}
              onChange={(event) =>
                updateSettings({
                  relativeWidthPercent: Number(event.target.value),
                })
              }
              className="w-full accent-scanonix-orange"
              aria-valuetext={`${settings.relativeWidthPercent} percent of page width`}
            />
            <span className="mt-1 block text-xs text-scanonix-muted">
              {settings.relativeWidthPercent}%
            </span>
          </label>
        )}

        <label className="block text-sm" data-watermark-opacity-control>
          <span className="mb-1.5 block text-xs font-medium text-scanonix-muted">
            Opacity ({MIN_OPACITY_PERCENT}–{MAX_OPACITY_PERCENT}%)
          </span>
          <input
            type="range"
            data-watermark-opacity-input
            min={MIN_OPACITY_PERCENT}
            max={MAX_OPACITY_PERCENT}
            step={1}
            value={settings.opacityPercent}
            disabled={isBusy}
            onChange={(event) =>
              updateSettings({ opacityPercent: Number(event.target.value) })
            }
            className="w-full accent-scanonix-orange"
            aria-valuetext={`${settings.opacityPercent} percent`}
          />
          <span className="mt-1 block text-xs text-scanonix-muted">
            {settings.opacityPercent}% (
            {opacityPercentToEngine(settings.opacityPercent).toFixed(1)})
          </span>
        </label>
      </section>

      <section className="space-y-3 border-t border-border/80 pt-4">
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
          Placement
        </p>

        <fieldset className="space-y-2" data-watermark-placement-mode>
          <legend className="text-xs font-medium text-scanonix-muted">
            Placement mode
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {(
              [
                { value: "single" as const, label: "Single" },
                { value: "repeat" as const, label: "Repeat / Tile" },
              ] as const
            ).map((option) => {
              const selected = settings.placementMode === option.value;
              return (
                <button
                  key={option.value}
                  type="button"
                  data-watermark-placement-mode-option={option.value}
                  disabled={isBusy}
                  aria-pressed={selected}
                  onClick={() =>
                    updateSettings({
                      placementMode: option.value as WatermarkPlacementMode,
                    })
                  }
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-foreground"
                      : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/50"
                  }`}
                >
                  {option.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        {settings.placementMode === "single" ? (
          <div className="space-y-2" data-watermark-position-picker>
            <p className="text-xs font-medium text-scanonix-muted">Position</p>
            <PositionPicker
              value={settings.position}
              disabled={isBusy}
              onChange={(position) => updateSettings({ position })}
            />
          </div>
        ) : (
          <fieldset className="space-y-2" data-watermark-repeat-pattern>
            <legend className="text-xs font-medium text-scanonix-muted">
              Pattern
            </legend>
            <div className="flex flex-wrap gap-1.5">
              {WATERMARK_REPEAT_PATTERNS.map((pattern) => {
                const selected = settings.repeatPattern === pattern;
                const { rows, cols } = (() => {
                  const [r, c] = pattern.split("x").map(Number);
                  return { rows: r, cols: c };
                })();
                return (
                  <button
                    key={pattern}
                    type="button"
                    data-watermark-repeat-pattern-option={pattern}
                    disabled={isBusy}
                    aria-pressed={selected}
                    onClick={() =>
                      updateSettings({
                        repeatPattern: pattern as WatermarkRepeatPattern,
                      })
                    }
                    className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                      selected
                        ? "border-scanonix-orange bg-scanonix-orange/10 text-foreground"
                        : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/50"
                    }`}
                  >
                    {rows} × {cols}
                  </button>
                );
              })}
            </div>
            <p
              className="text-xs text-scanonix-muted"
              data-watermark-repeat-summary
            >
              {getRepeatPatternLabel(settings.repeatPattern)}
            </p>
            {showRepeatOverlapWarning && (
              <p
                className="text-xs text-amber-700 dark:text-amber-400"
                data-watermark-repeat-overlap-warning
                role="status"
              >
                Watermarks may overlap at this size. Reduce the watermark size or
                choose a smaller grid.
              </p>
            )}
          </fieldset>
        )}

        <fieldset className="space-y-2.5" data-watermark-rotation-control>
          <legend className="text-xs font-medium text-scanonix-muted">
            Rotation
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {ROTATION_PRESET_OPTIONS.map((preset) => {
              const selected = settings.rotationDegrees === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  data-watermark-rotation={preset.value}
                  disabled={isBusy}
                  aria-pressed={selected}
                  onClick={() =>
                    updateSettings({ rotationDegrees: preset.value })
                  }
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-foreground"
                      : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/50"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
          <div className="flex gap-2">
            <label className="sr-only" htmlFor="watermark-custom-rotation">
              Custom rotation degrees
            </label>
            <input
              id="watermark-custom-rotation"
              type="number"
              data-watermark-rotation-custom
              min={-360}
              max={360}
              step={1}
              value={customRotation}
              disabled={isBusy}
              placeholder="Custom °"
              onChange={(event) => setCustomRotation(event.target.value)}
              className="input-field min-w-0 flex-1"
            />
            <ActionButton
              variant="outline"
              size="sm"
              disabled={isBusy || !customRotation.trim()}
              onClick={handleCustomRotationApply}
            >
              Apply
            </ActionButton>
          </div>
        </fieldset>

        <fieldset className="space-y-2.5">
          <legend className="text-xs font-medium text-scanonix-muted">
            Margin
          </legend>
          <div className="flex flex-wrap gap-1.5">
            {MARGIN_PRESET_OPTIONS.map((preset) => {
              const selected = settings.margin === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  disabled={isBusy}
                  aria-pressed={selected}
                  onClick={() => updateSettings({ margin: preset.value })}
                  className={`rounded-md border px-3 py-1.5 text-sm font-semibold transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-foreground"
                      : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/50"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </fieldset>
      </section>

      <section className="space-y-2.5 border-t border-border/80 pt-4">
        <fieldset className="space-y-2.5" data-watermark-page-range>
          <legend className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
            Pages
          </legend>
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              type="radio"
              name="watermark-page-selection"
              data-watermark-page-range-all
              checked={settings.allPages}
              disabled={isBusy}
              onChange={() => updateSettings({ allPages: true })}
              className="h-4 w-4 accent-scanonix-orange"
            />
            All pages
          </label>
          <label className="flex items-center gap-3 text-sm text-foreground">
            <input
              type="radio"
              name="watermark-page-selection"
              data-watermark-page-range-custom
              checked={!settings.allPages}
              disabled={isBusy}
              onChange={() => updateSettings({ allPages: false })}
              className="h-4 w-4 accent-scanonix-orange"
            />
            Custom pages
          </label>
          {!settings.allPages && (
            <div>
              <label className="sr-only" htmlFor="watermark-page-range">
                Custom page range
              </label>
              <input
                id="watermark-page-range"
                type="text"
                data-watermark-page-range-input
                value={settings.pageRangeInput}
                disabled={isBusy}
                placeholder="e.g. 1-5, 8, 10-12"
                onChange={(event) =>
                  updateSettings({ pageRangeInput: event.target.value })
                }
                className="input-field text-sm"
              />
              {selection.error && (
                <p className="mt-2 text-xs text-red-600">{selection.error}</p>
              )}
              {!selection.error && selection.pages.length > 0 && (
                <p className="mt-2 text-xs text-scanonix-muted">
                  {selection.pages.length} page
                  {selection.pages.length === 1 ? "" : "s"} selected
                </p>
              )}
            </div>
          )}
        </fieldset>
      </section>

      <div className="border-t border-border/80 pt-3 space-y-2">
        <PrivacyNotice message={WATERMARK_UI_PRIVACY_COPY} />
        <p className="text-xs text-scanonix-muted">{WATERMARK_SECURITY_COPY}</p>
      </div>
    </div>
  );

  return (
    <div className="space-y-5 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
      />

      <ToolWorkspaceShell
        isEmpty={!uploadedPdf}
        empty={
          <>
            <FileDropZone
              onFilesSelected={handleSourcePdfUpload}
              accept={WATERMARK_SOURCE_PDF_ACCEPT}
              validateFile={isAcceptedWatermarkPdfFile}
              multiple={false}
              disabled={isBusy}
              inputId="watermark-source-pdf-input"
              inputDataAttributes={{ "data-watermark-source-pdf-input": "true" }}
              label="Drop a PDF file here to add a watermark"
              hint="or click to browse — up to 10 MB, processed locally in your browser"
              icon={<WatermarkDropIcon />}
            />
            <PrivacyNotice message={WATERMARK_UI_PRIVACY_COPY} />
            <p className="text-sm text-scanonix-muted">
              {WATERMARK_SECURITY_COPY}
            </p>
          </>
        }
        workArea={
          uploadedPdf && currentPageEntry ? (
            <div
              data-watermark-pdf-workspace
              className="overflow-hidden rounded-2xl border border-border bg-surface shadow-[var(--shadow-soft)]"
            >
              <div
                data-watermark-pdf-header
                className="flex flex-col gap-2.5 border-b border-border/80 bg-surface-muted/40 px-3.5 py-2.5 sm:flex-row sm:items-center sm:justify-between sm:px-4"
              >
                <div className="flex min-w-0 items-center gap-2.5">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-border bg-surface text-scanonix-orange">
                    <WatermarkDropIcon className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold text-foreground">
                      {uploadedPdf.file.name}
                    </p>
                    <p className="truncate text-[11px] text-scanonix-muted">
                      {formatFileSize(uploadedPdf.file.size)} · {pageCount} page
                      {pageCount === 1 ? "" : "s"}
                    </p>
                  </div>
                </div>
                <div
                  className={
                    stickyVisible
                      ? "hidden w-full sm:w-auto md:block"
                      : "w-full sm:w-auto"
                  }
                >
                  <ActionButton
                    variant="outline"
                    size="sm"
                    data-watermark-choose-another
                    disabled={isBusy}
                    onClick={resetWorkspace}
                    className="w-full rounded-lg sm:w-auto"
                  >
                    {hasResult ? "Start over" : "Choose another PDF"}
                  </ActionButton>
                </div>
              </div>

              {uploadedPdf.document.hasExistingDigitalSignatures && (
                <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
                  <p className="text-sm text-foreground">
                    {DIGITAL_SIGNATURE_WATERMARK_WARNING}
                  </p>
                </div>
              )}

              <div
                data-watermark-page-nav
                className="flex flex-wrap items-center justify-center gap-1.5 border-b border-border/80 bg-surface px-3 py-2"
              >
                <ActionButton
                  variant="outline"
                  size="sm"
                  data-watermark-page-prev
                  disabled={currentPageIndex <= 0 || isBusy}
                  onClick={() =>
                    setCurrentPageIndex(Math.max(0, currentPageIndex - 1))
                  }
                  className="rounded-md"
                >
                  <ChevronLeft className="mr-1 h-4 w-4" aria-hidden="true" />
                  Previous
                </ActionButton>
                <span
                  data-watermark-page-indicator
                  className="min-w-[5rem] text-center text-xs font-medium text-scanonix-muted sm:text-sm"
                >
                  Page {currentPageIndex + 1} of {pageCount}
                </span>
                <ActionButton
                  variant="outline"
                  size="sm"
                  data-watermark-page-next
                  disabled={currentPageIndex >= pageCount - 1 || isBusy}
                  onClick={() =>
                    setCurrentPageIndex(
                      Math.min(pageCount - 1, currentPageIndex + 1),
                    )
                  }
                  className="rounded-md"
                >
                  Next
                  <ChevronRight className="ml-1 h-4 w-4" aria-hidden="true" />
                </ActionButton>
              </div>

              <div
                data-watermark-pdf-preview-panel
                className="bg-surface-muted/30 p-3 sm:p-4"
              >
                <div className="overflow-hidden rounded-xl border border-border bg-surface shadow-sm">
                  <WatermarkPdfPreview
                    pageEntry={currentPageEntry}
                    pdfBytes={uploadedPdf.bytes}
                    pageCount={pageCount}
                    currentPageIndex={currentPageIndex}
                    mode={settings.mode}
                    text={settings.text}
                    position={settings.position}
                    opacityPercent={settings.opacityPercent}
                    fontSize={settings.fontSize}
                    bold={settings.bold}
                    color={settings.color}
                    margin={settings.margin}
                    rotationDegrees={settings.rotationDegrees}
                    relativeWidthPercent={settings.relativeWidthPercent}
                    imagePreviewUrl={imageAsset?.previewUrl ?? null}
                    imageIntrinsicWidth={imageAsset?.intrinsicWidth ?? 0}
                    imageIntrinsicHeight={imageAsset?.intrinsicHeight ?? 0}
                    allPages={settings.allPages}
                    pageRangeInput={settings.pageRangeInput}
                    placementMode={settings.placementMode}
                    repeatPattern={settings.repeatPattern}
                  />
                </div>
              </div>
            </div>
          ) : null
        }
        controlPanel={
          uploadedPdf && currentPageEntry ? (
            <div data-watermark-pdf-settings-panel className="contents">
              <ToolControlPanel
                aria-label="Watermark PDF controls"
                footer={
                  hasResult ? (
                    <div className="flex flex-col gap-2">
                      <div className="hidden md:block">
                        <ActionButton
                          size="lg"
                          data-watermark-download-button
                          className="w-full"
                          loading={isExporting}
                          disabled={!canExport}
                          onClick={handleDownloadWatermarkedPdf}
                        >
                          {isExporting
                            ? "Watermarking…"
                            : "Download watermarked PDF"}
                        </ActionButton>
                      </div>
                      <ActionButton
                        variant="outline"
                        size="lg"
                        className="w-full"
                        disabled={isBusy}
                        onClick={handleSettingChange}
                      >
                        Change settings
                      </ActionButton>
                      <div className="hidden md:block">
                        <ActionButton
                          variant="outline"
                          size="lg"
                          className="w-full"
                          disabled={isBusy}
                          onClick={resetWorkspace}
                        >
                          Start over
                        </ActionButton>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-col gap-2">
                      <p className="text-[11px] leading-snug text-scanonix-muted">
                        {exportHint}
                      </p>
                      <div
                        className={
                          stickyVisible ? "hidden md:block" : undefined
                        }
                      >
                        <ActionButton
                          size="lg"
                          data-watermark-download-button
                          className="w-full shadow-[var(--shadow-orange-sm)]"
                          loading={isExporting}
                          disabled={!canExport}
                          onClick={handleDownloadWatermarkedPdf}
                        >
                          {isExporting
                            ? "Watermarking…"
                            : "Download watermarked PDF"}
                        </ActionButton>
                      </div>
                    </div>
                  )
                }
              >
                {hasResult ? (
                  <div className="space-y-4">
                    <div>
                      <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
                        Result
                      </p>
                      <p className="mt-1.5 text-sm font-semibold text-green-700">
                        ✓ Watermark added
                      </p>
                      <p className="mt-1 text-xs text-scanonix-muted">
                        Your watermarked PDF was downloaded. You can download
                        again or change settings.
                      </p>
                    </div>
                    <dl className="divide-y divide-border/70 overflow-hidden rounded-xl border border-border bg-surface-muted/60 text-sm">
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Pages</dt>
                        <dd className="font-semibold text-foreground">
                          {selection.pages.length || pageCount}
                        </dd>
                      </div>
                      <div className="flex justify-between gap-3 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Type</dt>
                        <dd className="font-semibold capitalize text-foreground">
                          {settings.mode}
                        </dd>
                      </div>
                      <div className="min-w-0 px-3 py-2.5">
                        <dt className="text-scanonix-muted">Source</dt>
                        <dd className="mt-0.5 truncate font-semibold text-foreground">
                          {uploadedPdf.file.name}
                        </dd>
                      </div>
                    </dl>
                  </div>
                ) : (
                  settingsBody
                )}
              </ToolControlPanel>
            </div>
          ) : null
        }
      />

      <ToolStickyMobileActionBar
        visible={stickyVisible}
        phase={resultActionPhase}
        primaryLabel="Download watermarked PDF"
        primaryLoading={isExporting}
        primaryDisabled={!canExport}
        showPrimaryOnError
        onPrimaryClick={handleDownloadWatermarkedPdf}
        secondaryLabel={
          uploadedPdf && !hasResult ? "Choose another PDF" : undefined
        }
        onSecondaryClick={
          uploadedPdf && !hasResult ? resetWorkspace : undefined
        }
        secondaryDisabled={isBusy}
        onStartOver={hasResult ? resetWorkspace : undefined}
        startOverLabel="Start over"
        startOverDisabled={isBusy}
      />
    </div>
  );
}
