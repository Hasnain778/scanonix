"use client";

import { useCallback, useEffect, useMemo, useRef, useState, type ChangeEvent } from "react";
import { ActionButton } from "@/components/ui/ActionButton";
import { FileDropZone } from "@/components/tools/FileDropZone";
import { PrivacyNotice } from "@/components/tools/PrivacyNotice";
import { ToolStatusBanner } from "@/components/tools/ToolStatusBanner";
import { ToolStickyMobileActionBar } from "@/components/tools/ToolStickyMobileActionBar";
import {
  buildWatermarkedPdfFilename,
  buildWatermarkExportOptions,
  canExportWatermarkWorkspace,
  clampFontSize,
  createDefaultWorkspaceSettings,
  DEFAULT_WATERMARK_COLOR,
  DIGITAL_SIGNATURE_WATERMARK_WARNING,
  exportWatermarkedPdf,
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
  WATERMARK_SECURITY_COPY,
  WATERMARK_UI_PRIVACY_COPY,
  WatermarkPdfError,
  type ImageWorkspaceAsset,
  type WatermarkDocumentState,
  type WatermarkType,
  type WatermarkWorkspaceSettings,
} from "@/lib/tools/watermark-pdf";
import { downloadBlob } from "@/lib/tools/download";
import { formatFileSize } from "@/lib/tools/format-utils";
import type { ToolStatus } from "@/lib/tools/types";
import { PositionPicker } from "./PositionPicker";
import { WatermarkPdfPreview } from "./WatermarkPdfPreview";

interface UploadedPdfState {
  file: File;
  bytes: ArrayBuffer;
  document: WatermarkDocumentState;
}

type MobilePanel = "preview" | "settings";

const WATERMARK_SOURCE_PDF_ACCEPT = "application/pdf";
const WATERMARK_IMAGE_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg";

function PdfDropIcon() {
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
        d="M7 21h10a2 2 0 002-2V9.414a1 1 0 00-.293-.707l-5.414-5.414A1 1 0 0012.586 3H7a2 2 0 00-2 2v14a2 2 0 002 2z"
      />
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 7h6M12 4v6" />
    </svg>
  );
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
  const [mobilePanel, setMobilePanel] = useState<MobilePanel>("preview");
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
    setMobilePanel("preview");
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
      downloadBlob(blob, result.filename);
      setStatus("success");
      setStatusMessage("Watermarked PDF downloaded.");
    } catch (error) {
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

  const settingsPanel = (
    <div className="flex min-h-0 flex-col">
      <div className="flex-1 space-y-5 overflow-y-auto pb-4">
        <div
          data-watermark-mode-selector
          className="inline-flex w-full rounded-xl border border-scanonix-border bg-black/30 p-1"
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
                className={`flex-1 rounded-lg px-4 py-2 text-sm font-medium transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                  selected
                    ? "bg-scanonix-orange/15 text-white"
                    : "text-scanonix-muted hover:text-white"
                }`}
              >
                {mode === "text" ? "TEXT" : "IMAGE"}
              </button>
            );
          })}
        </div>

        {settings.mode === "text" ? (
          <label className="block text-sm">
            <span className="mb-1 block text-scanonix-muted">Watermark text</span>
            <input
              type="text"
              data-watermark-text-input
              value={settings.text}
              disabled={isBusy}
              onChange={(event) => updateSettings({ text: event.target.value })}
              className="w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
              aria-describedby={
                unsupportedCharacterError ? "watermark-text-error" : undefined
              }
            />
            {unsupportedCharacterError && (
              <p id="watermark-text-error" className="mt-2 text-xs text-red-300">
                {unsupportedCharacterError}
              </p>
            )}
          </label>
        ) : (
          <div className="space-y-3" data-watermark-image-upload-section>
            <span className="block text-sm text-scanonix-muted">Watermark image</span>
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
                className="space-y-3 rounded-xl border border-scanonix-border bg-black/30 p-3"
                data-watermark-image-selected
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={imageAsset.previewUrl}
                  alt="Watermark preview"
                  data-watermark-image-thumbnail
                  className="mx-auto max-h-32 w-auto object-contain"
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
              <div className="space-y-3 rounded-xl border border-dashed border-scanonix-border bg-black/20 px-4 py-6 text-center">
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

        <div className="space-y-3">
          <p className="text-sm font-medium text-white">Position</p>
          <PositionPicker
            value={settings.position}
            disabled={isBusy}
            onChange={(position) => updateSettings({ position })}
          />
        </div>

        <label className="block text-sm" data-watermark-opacity-control>
          <span className="mb-1 block text-scanonix-muted">
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
            {settings.opacityPercent}% ({opacityPercentToEngine(settings.opacityPercent).toFixed(1)})
          </span>
        </label>

        <fieldset className="space-y-3" data-watermark-rotation-control>
          <legend className="text-sm font-medium text-white">Rotation</legend>
          <div className="flex flex-wrap gap-2">
            {ROTATION_PRESET_OPTIONS.map((preset) => {
              const selected = settings.rotationDegrees === preset.value;
              return (
                <button
                  key={preset.label}
                  type="button"
                  data-watermark-rotation={preset.value}
                  disabled={isBusy}
                  aria-pressed={selected}
                  onClick={() => updateSettings({ rotationDegrees: preset.value })}
                  className={`rounded-xl border px-3 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-white"
                      : "border-scanonix-border bg-black/30 text-scanonix-muted hover:border-scanonix-orange/50"
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
              className="min-w-0 flex-1 rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
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

        {settings.mode === "text" && (
          <>
            <label className="block text-sm" data-watermark-font-size-control>
              <span className="mb-1 block text-scanonix-muted">
                Font size ({MIN_WATERMARK_FONT_SIZE}–{MAX_WATERMARK_FONT_SIZE} pt)
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
                  updateSettings({ fontSize: clampFontSize(Number(event.target.value)) })
                }
                className="w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
              />
            </label>

            <div className="space-y-2" data-watermark-color-control>
              <span className="block text-sm text-scanonix-muted">Color</span>
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
                  onChange={(event) => updateSettings({ color: event.target.value })}
                  className="h-11 w-14 cursor-pointer rounded-lg border border-scanonix-border bg-black/40 p-1"
                  aria-label="Watermark color"
                />
                <input
                  type="text"
                  data-watermark-color-input
                  value={settings.color}
                  disabled={isBusy}
                  onChange={(event) => updateSettings({ color: event.target.value })}
                  onBlur={handleColorBlur}
                  placeholder="#666666"
                  className="min-w-0 flex-1 rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 font-mono text-sm text-white focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
                  aria-label="Watermark hex color"
                />
              </div>
            </div>

            <label className="flex items-center gap-3 text-sm text-scanonix-muted">
              <input
                type="checkbox"
                data-watermark-bold-input
                checked={settings.bold}
                disabled={isBusy}
                onChange={(event) => updateSettings({ bold: event.target.checked })}
                className="h-4 w-4 accent-scanonix-orange"
              />
              Bold
            </label>
          </>
        )}

        {settings.mode === "image" && (
          <label className="block text-sm">
            <span className="mb-1 block text-scanonix-muted">
              Image width ({MIN_RELATIVE_WIDTH_PERCENT}–{MAX_RELATIVE_WIDTH_PERCENT}% of page)
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
                updateSettings({ relativeWidthPercent: Number(event.target.value) })
              }
              className="w-full accent-scanonix-orange"
              aria-valuetext={`${settings.relativeWidthPercent} percent of page width`}
            />
            <span className="mt-1 block text-xs text-scanonix-muted">
              {settings.relativeWidthPercent}%
            </span>
          </label>
        )}

        <fieldset className="space-y-3">
          <legend className="text-sm font-medium text-white">Margin</legend>
          <div className="flex flex-wrap gap-2">
            {MARGIN_PRESET_OPTIONS.map((preset) => {
              const selected = settings.margin === preset.value;
              return (
                <button
                  key={preset.value}
                  type="button"
                  disabled={isBusy}
                  aria-pressed={selected}
                  onClick={() => updateSettings({ margin: preset.value })}
                  className={`rounded-xl border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 disabled:cursor-not-allowed disabled:opacity-50 ${
                    selected
                      ? "border-scanonix-orange bg-scanonix-orange/10 text-white"
                      : "border-scanonix-border bg-black/30 text-scanonix-muted hover:border-scanonix-orange/50"
                  }`}
                >
                  {preset.label}
                </button>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="space-y-3" data-watermark-page-range>
          <legend className="text-sm font-medium text-white">Pages to watermark</legend>
          <label className="flex items-center gap-3 text-sm text-scanonix-muted">
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
          <label className="flex items-center gap-3 text-sm text-scanonix-muted">
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
                onChange={(event) => updateSettings({ pageRangeInput: event.target.value })}
                className="w-full rounded-xl border border-scanonix-border bg-black/40 px-3 py-2 text-sm text-white placeholder:text-scanonix-muted/70 focus:border-scanonix-orange focus:outline-none focus:ring-2 focus:ring-scanonix-orange/20"
              />
              {selection.error && (
                <p className="mt-2 text-xs text-red-300">{selection.error}</p>
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
      </div>

      <div className="sticky bottom-0 border-t border-scanonix-border bg-scanonix-surface pt-4">
        <ActionButton
          size="lg"
          data-watermark-download-button
          className="w-full"
          loading={isExporting}
          disabled={!canExport}
          onClick={handleDownloadWatermarkedPdf}
        >
          {isExporting ? "Watermarking…" : "Download watermarked PDF"}
        </ActionButton>
        <div className="mt-3 space-y-2">
          <PrivacyNotice message={WATERMARK_UI_PRIVACY_COPY} />
          <p className="text-xs text-scanonix-muted">{WATERMARK_SECURITY_COPY}</p>
        </div>
      </div>
    </div>
  );

  return (
    <div className="space-y-8 overflow-x-hidden">
      <ToolStatusBanner
        status={isReadingPdf ? "loading" : status}
        message={isReadingPdf ? "Reading PDF…" : statusMessage}
      />

      {!uploadedPdf && (
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
            icon={<PdfDropIcon />}
          />
          <PrivacyNotice message={WATERMARK_UI_PRIVACY_COPY} />
          <p className="text-sm text-scanonix-muted">{WATERMARK_SECURITY_COPY}</p>
        </>
      )}

      {uploadedPdf && currentPageEntry && (
        <div
          data-watermark-pdf-workspace
          className="overflow-hidden rounded-xl border border-scanonix-border/80 bg-[#0a0a0a]"
        >
          {/* Document-first header: filename, page nav, choose another */}
          <div
            data-watermark-pdf-header
            className="flex flex-wrap items-center gap-x-3 gap-y-2 border-b border-scanonix-border/80 px-3 py-2 sm:px-4"
          >
            <div className="flex min-w-0 flex-1 items-center gap-2">
              <span className="shrink-0 text-sm font-semibold text-white">Watermark PDF</span>
              <span
                className="truncate text-xs text-scanonix-muted sm:text-sm"
                title={uploadedPdf.file.name}
              >
                {uploadedPdf.file.name}
              </span>
              <span className="hidden text-xs text-scanonix-muted sm:inline">
                · {formatFileSize(uploadedPdf.file.size)}
              </span>
            </div>

            <div
              data-watermark-page-nav
              className="flex flex-wrap items-center justify-center gap-1.5 sm:flex-1"
            >
              <ActionButton
                variant="outline"
                size="sm"
                data-watermark-page-prev
                disabled={currentPageIndex <= 0 || isBusy}
                onClick={() => setCurrentPageIndex(Math.max(0, currentPageIndex - 1))}
              >
                Previous
              </ActionButton>
              <span
                data-watermark-page-indicator
                className="min-w-[5rem] text-center text-xs text-scanonix-muted sm:text-sm"
              >
                Page {currentPageIndex + 1} of {pageCount}
              </span>
              <ActionButton
                variant="outline"
                size="sm"
                data-watermark-page-next
                disabled={currentPageIndex >= pageCount - 1 || isBusy}
                onClick={() =>
                  setCurrentPageIndex(Math.min(pageCount - 1, currentPageIndex + 1))
                }
              >
                Next
              </ActionButton>
            </div>

            <ActionButton
              variant="outline"
              size="sm"
              data-watermark-choose-another
              disabled={isBusy}
              onClick={resetWorkspace}
              className="w-full sm:ml-auto sm:w-auto"
            >
              Choose another PDF
            </ActionButton>
          </div>

          {uploadedPdf.document.hasExistingDigitalSignatures && (
            <div className="border-b border-amber-500/30 bg-amber-500/10 px-4 py-3">
              <p className="text-sm text-amber-100/90">
                {DIGITAL_SIGNATURE_WATERMARK_WARNING}
              </p>
            </div>
          )}

          <div className="flex gap-2 border-b border-scanonix-border/80 px-3 py-2 lg:hidden">
            <button
              type="button"
              aria-pressed={mobilePanel === "preview"}
              onClick={() => setMobilePanel("preview")}
              className={`flex-1 rounded-xl border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 ${
                mobilePanel === "preview"
                  ? "border-scanonix-orange bg-scanonix-orange/10 text-white"
                  : "border-scanonix-border bg-black/30 text-scanonix-muted"
              }`}
            >
              Preview
            </button>
            <button
              type="button"
              aria-pressed={mobilePanel === "settings"}
              onClick={() => setMobilePanel("settings")}
              className={`flex-1 rounded-xl border px-4 py-2 text-sm transition focus:outline-none focus:ring-2 focus:ring-scanonix-orange/30 ${
                mobilePanel === "settings"
                  ? "border-scanonix-orange bg-scanonix-orange/10 text-white"
                  : "border-scanonix-border bg-black/30 text-scanonix-muted"
              }`}
            >
              Settings
            </button>
          </div>

          <div className="grid min-h-[520px] lg:grid-cols-[minmax(0,7fr)_minmax(280px,3fr)]">
            <div
              data-watermark-pdf-preview-panel
              className={`bg-[#121212] p-4 sm:p-6 ${
                mobilePanel === "settings" ? "hidden lg:block" : ""
              }`}
            >
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
              />
            </div>

            <div
              data-watermark-pdf-settings-panel
              className={`flex min-h-0 flex-col border-scanonix-border/80 p-4 sm:p-5 lg:border-l lg:max-h-[calc(100vh-12rem)] ${
                mobilePanel === "preview" ? "hidden lg:flex" : ""
              }`}
            >
              {settingsPanel}
            </div>
          </div>
        </div>
      )}

      <ToolStickyMobileActionBar
        visible={Boolean(uploadedPdf && canExport)}
        primaryLabel="Download watermarked PDF"
        primaryLoading={isExporting}
        primaryDisabled={!canExport}
        onPrimaryClick={handleDownloadWatermarkedPdf}
        secondaryLabel={uploadedPdf ? "Choose another PDF" : undefined}
        onSecondaryClick={uploadedPdf ? resetWorkspace : undefined}
        secondaryDisabled={isBusy}
      />
    </div>
  );
}
