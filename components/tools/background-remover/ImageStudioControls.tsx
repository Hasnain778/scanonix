"use client";

import { useRef, type ReactNode } from "react";
import Link from "next/link";
import { ActionButton } from "@/components/ui/ActionButton";
import { ProBadge } from "@/components/tools/background-remover/ProBadge";
import type { StudioBackgroundOptions } from "@/lib/tools/background-remover/export-image";
import {
  RESOLUTION_PRESETS,
  type BackgroundPreviewMode,
  type ExportFormat,
  type ResolutionPresetId,
} from "@/lib/tools/background-remover/studio-types";

interface ImageStudioControlsProps {
  background: StudioBackgroundOptions;
  resolutionPreset: ResolutionPresetId;
  exportFormat: ExportFormat;
  exportQuality: number;
  zoom: number;
  outputWidth: number;
  outputHeight: number;
  isPremium: boolean;
  disabled?: boolean;
  onBackgroundChange: (background: StudioBackgroundOptions) => void;
  onResolutionChange: (preset: ResolutionPresetId) => void;
  onExportFormatChange: (format: ExportFormat) => void;
  onExportQualityChange: (quality: number) => void;
  onZoomChange: (zoom: number) => void;
}

const BACKGROUND_MODES: { mode: BackgroundPreviewMode; label: string }[] = [
  { mode: "transparent", label: "Transparent" },
  { mode: "white", label: "White" },
  { mode: "black", label: "Black" },
  { mode: "custom", label: "Custom colour" },
  { mode: "gradient", label: "Gradient" },
  { mode: "upload", label: "Upload background" },
];

const EXPORT_FORMATS: ExportFormat[] = ["png", "jpg", "webp"];

function SectionTitle({ children }: { children: ReactNode }) {
  return (
    <p className="mb-3 text-xs font-semibold uppercase tracking-[0.15em] text-scanonix-muted">
      {children}
    </p>
  );
}

export function ImageStudioControls({
  background,
  resolutionPreset,
  exportFormat,
  exportQuality,
  zoom,
  outputWidth,
  outputHeight,
  isPremium,
  disabled = false,
  onBackgroundChange,
  onResolutionChange,
  onExportFormatChange,
  onExportQualityChange,
  onZoomChange,
}: ImageStudioControlsProps) {
  const backgroundUploadRef = useRef<HTMLInputElement>(null);

  const setBackgroundMode = (mode: BackgroundPreviewMode) => {
    onBackgroundChange({ ...background, mode });
  };

  return (
    <div className="space-y-6">
      <div className="glass-card rounded-2xl p-5">
        <SectionTitle>Export resolution</SectionTitle>
        <div className="grid grid-cols-2 gap-2">
          {RESOLUTION_PRESETS.map((preset) => {
            const isLocked = preset.premium && !isPremium;
            const isSelected = resolutionPreset === preset.id;

            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled || isLocked}
                onClick={() => !isLocked && onResolutionChange(preset.id)}
                className={`flex flex-col items-start rounded-xl border px-3 py-2.5 text-left transition-all ${
                  isLocked
                    ? "cursor-not-allowed border-border bg-surface-muted opacity-60"
                    : isSelected
                      ? "border-scanonix-orange bg-scanonix-orange/15"
                      : "border-border bg-surface-muted hover:border-scanonix-orange/40"
                }`}
              >
                <span className="flex w-full items-center justify-between gap-1">
                  <span className="text-sm font-semibold text-foreground">
                    {preset.label}
                  </span>
                  {preset.premium ? (
                    <ProBadge />
                  ) : (
                    <span className="text-[10px] font-medium text-emerald-400">
                      Free
                    </span>
                  )}
                </span>
                <span className="mt-0.5 text-[10px] text-scanonix-muted">
                  {preset.description}
                </span>
              </button>
            );
          })}
        </div>
        {!isPremium && (
          <p className="mt-3 text-xs text-scanonix-muted">
            Free exports are HD (1920px).{" "}
            <Link href="/pricing" className="text-scanonix-orange hover:underline">
              Upgrade to Pro
            </Link>{" "}
            for 4K output.
          </p>
        )}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <SectionTitle>Background</SectionTitle>
        <div className="flex flex-wrap gap-2">
          {BACKGROUND_MODES.map(({ mode, label }) => (
            <button
              key={mode}
              type="button"
              disabled={disabled}
              onClick={() => setBackgroundMode(mode)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium transition-colors disabled:opacity-50 ${
                background.mode === mode
                  ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground"
                  : "border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {background.mode === "custom" && (
          <div className="mt-4 flex items-center gap-3">
            <input
              type="color"
              value={background.customColor}
              disabled={disabled}
              onChange={(event) =>
                onBackgroundChange({
                  ...background,
                  customColor: event.target.value,
                })
              }
              className="h-10 w-14 cursor-pointer rounded-lg border border-border bg-transparent"
            />
            <span className="font-mono text-sm text-scanonix-muted">
              {background.customColor.toUpperCase()}
            </span>
          </div>
        )}

        {background.mode === "gradient" && (
          <div className="mt-4 flex flex-wrap items-center gap-4">
            <label className="flex items-center gap-2 text-sm text-scanonix-muted">
              Start
              <input
                type="color"
                value={background.gradientStart}
                disabled={disabled}
                onChange={(event) =>
                  onBackgroundChange({
                    ...background,
                    gradientStart: event.target.value,
                  })
                }
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
              />
            </label>
            <label className="flex items-center gap-2 text-sm text-scanonix-muted">
              End
              <input
                type="color"
                value={background.gradientEnd}
                disabled={disabled}
                onChange={(event) =>
                  onBackgroundChange({
                    ...background,
                    gradientEnd: event.target.value,
                  })
                }
                className="h-9 w-12 cursor-pointer rounded-lg border border-border bg-transparent"
              />
            </label>
          </div>
        )}

        {background.mode === "upload" && (
          <div className="mt-4">
            <input
              ref={backgroundUploadRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              className="sr-only"
              disabled={disabled}
              onChange={(event) => {
                const file = event.target.files?.[0];
                if (!file) return;
                if (background.backgroundImageUrl) {
                  URL.revokeObjectURL(background.backgroundImageUrl);
                }
                onBackgroundChange({
                  ...background,
                  backgroundImageUrl: URL.createObjectURL(file),
                });
                event.target.value = "";
              }}
            />
            <ActionButton
              variant="outline"
              size="sm"
              disabled={disabled}
              onClick={() => backgroundUploadRef.current?.click()}
            >
              Choose background image
            </ActionButton>
          </div>
        )}
      </div>

      <div className="glass-card rounded-2xl p-5">
        <SectionTitle>Export</SectionTitle>

        <div className="mb-4 flex flex-wrap gap-2">
          {EXPORT_FORMATS.map((format) => (
            <button
              key={format}
              type="button"
              disabled={disabled}
              onClick={() => onExportFormatChange(format)}
              className={`rounded-lg border px-3 py-2 text-sm font-medium uppercase transition-colors disabled:opacity-50 ${
                exportFormat === format
                  ? "border-scanonix-orange bg-scanonix-orange/15 text-foreground"
                  : "border-border bg-surface-muted text-scanonix-muted hover:text-foreground"
              }`}
            >
              {format}
            </button>
          ))}
        </div>

        {exportFormat !== "png" && (
          <div className="mb-4">
            <div className="mb-2 flex items-center justify-between text-sm">
              <span className="text-scanonix-muted">Quality</span>
              <span className="font-mono text-foreground">
                {Math.round(exportQuality * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={0.5}
              max={1}
              step={0.01}
              value={exportQuality}
              disabled={disabled}
              onChange={(event) =>
                onExportQualityChange(Number(event.target.value))
              }
              className="w-full accent-scanonix-orange"
            />
          </div>
        )}

        <div className="mb-4 rounded-xl border border-border bg-surface-muted px-4 py-3">
          <p className="text-xs text-scanonix-muted">Output dimensions</p>
          <p className="mt-1 font-mono text-sm font-semibold text-foreground">
            {outputWidth} × {outputHeight}px
          </p>
        </div>

        <div>
          <div className="mb-2 flex items-center justify-between text-sm">
            <span className="text-scanonix-muted">Preview zoom</span>
            <span className="font-mono text-foreground">{Math.round(zoom * 100)}%</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={disabled || zoom <= 0.5}
              onClick={() => onZoomChange(Math.max(0.5, zoom - 0.25))}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-scanonix-orange/40 disabled:opacity-40"
            >
              −
            </button>
            <input
              type="range"
              min={0.5}
              max={2}
              step={0.05}
              value={zoom}
              disabled={disabled}
              onChange={(event) => onZoomChange(Number(event.target.value))}
              className="flex-1 accent-scanonix-orange"
            />
            <button
              type="button"
              disabled={disabled || zoom >= 2}
              onClick={() => onZoomChange(Math.min(2, zoom + 0.25))}
              className="rounded-lg border border-border px-3 py-1.5 text-sm text-foreground hover:border-scanonix-orange/40 disabled:opacity-40"
            >
              +
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
