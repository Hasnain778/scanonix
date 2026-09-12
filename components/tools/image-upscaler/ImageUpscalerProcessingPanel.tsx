"use client";

import type { UpscaleJobProgressSnapshot } from "@/lib/upscale-jobs/progress";

interface ImageUpscalerProcessingPanelProps {
  snapshot: UpscaleJobProgressSnapshot;
  previewUrl: string;
  factor: 2 | 4;
}

export function ImageUpscalerProcessingPanel({
  snapshot,
  previewUrl,
  factor,
}: ImageUpscalerProcessingPanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-surface p-5 shadow-[var(--shadow-soft)] sm:p-6">
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-foreground">{snapshot.label}</p>
          <span className="text-sm font-semibold tabular-nums text-scanonix-orange">
            {snapshot.percent}%
          </span>
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-surface-muted"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={snapshot.percent}
          aria-label={`Image upscaling progress: ${snapshot.label}`}
        >
          <div
            className="h-full rounded-full bg-scanonix-orange transition-[width] duration-500 ease-out"
            style={{ width: `${snapshot.percent}%` }}
          />
        </div>

        <p className="text-xs text-scanonix-muted">
          Upscaling at {factor}× with Real-ESRGAN on Scanonix servers — please keep this tab open.
        </p>
      </div>

      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-border bg-black/30 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Original uploaded image being upscaled"
          className="max-h-full max-w-full object-contain opacity-90"
        />
      </div>
    </div>
  );
}
