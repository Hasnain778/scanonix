"use client";

import type { StagedProgressSnapshot } from "@/lib/tools/background-remover/staged-progress";

interface BackgroundRemoverProcessingPanelProps {
  snapshot: StagedProgressSnapshot;
  previewUrl: string;
}

export function BackgroundRemoverProcessingPanel({
  snapshot,
  previewUrl,
}: BackgroundRemoverProcessingPanelProps) {
  return (
    <div className="glass-card rounded-2xl p-5 sm:p-6">
      <div className="mb-5 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <p className="text-sm font-medium text-white">{snapshot.label}</p>
          <span className="text-sm font-semibold tabular-nums text-scanonix-orange">
            {snapshot.percent}%
          </span>
        </div>

        <div
          className="h-2 overflow-hidden rounded-full bg-white/10"
          role="progressbar"
          aria-valuemin={0}
          aria-valuemax={100}
          aria-valuenow={snapshot.percent}
          aria-label={`Background removal progress: ${snapshot.label}`}
        >
          <div
            className="h-full rounded-full bg-scanonix-orange transition-[width] duration-500 ease-out"
            style={{ width: `${snapshot.percent}%` }}
          />
        </div>

        <p className="text-xs text-scanonix-muted">
          Staged progress — background removal runs securely on Scanonix servers.
        </p>
      </div>

      <div className="flex aspect-[4/3] items-center justify-center overflow-hidden rounded-xl border border-white/10 bg-black/40 p-4">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={previewUrl}
          alt="Original uploaded image being processed"
          className="max-h-full max-w-full object-contain opacity-90"
        />
      </div>
    </div>
  );
}
