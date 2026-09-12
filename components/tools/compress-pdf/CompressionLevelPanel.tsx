import Link from "next/link";
import { ProIndicator } from "@/components/ui/ProIndicator";
import type { CompressionLevel } from "@/lib/tools/compress-pdf/compression-levels";
import {
  COMPRESSION_LEVELS,
  estimateCompressedSize,
} from "@/lib/tools/compress-pdf/compression-levels";
import { formatFileSize } from "@/lib/tools/format-utils";

interface CompressionLevelPanelProps {
  level: CompressionLevel;
  onLevelChange: (level: CompressionLevel) => void;
  originalSize: number;
  disabled?: boolean;
  isPro?: boolean;
}

const LEVEL_ORDER: CompressionLevel[] = [
  "light",
  "recommended",
  "strong",
];

const PRO_LEVELS = new Set<CompressionLevel>(["recommended", "strong"]);

export function CompressionLevelPanel({
  level,
  onLevelChange,
  originalSize,
  disabled = false,
  isPro = false,
}: CompressionLevelPanelProps) {
  const estimatedSize = estimateCompressedSize(originalSize, level);

  return (
    <div className="space-y-3">
      <div>
        <p className="text-[11px] font-bold uppercase tracking-[0.08em] text-scanonix-muted">
          Compression level
        </p>
        <p className="mt-1.5 text-sm leading-snug text-scanonix-muted">
          Choose how aggressively to optimize your PDF. Results vary by document
          structure.
        </p>
      </div>

      <div className="grid gap-2">
        {LEVEL_ORDER.map((option) => {
          const settings = COMPRESSION_LEVELS[option];
          const estimate = estimateCompressedSize(originalSize, option);
          const requiresPro = PRO_LEVELS.has(option);
          const locked = requiresPro && !isPro;
          const selected = level === option;

          return (
            <label
              key={option}
              className={`relative block rounded-xl border p-3.5 transition-all duration-200 ${
                locked
                  ? "cursor-not-allowed border-border/70 bg-surface-muted/80"
                  : selected
                    ? "cursor-pointer border-scanonix-orange bg-scanonix-orange/15 text-foreground shadow-[0_0_0_1px_color-mix(in_srgb,var(--scanonix-orange)_35%,transparent)]"
                    : "cursor-pointer border-border bg-surface-muted text-scanonix-muted hover:border-scanonix-orange/40 hover:text-foreground"
              } ${disabled && !locked ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="compressionLevel"
                value={option}
                checked={selected}
                onChange={() => {
                  if (!locked) onLevelChange(option);
                }}
                disabled={disabled || locked}
                className="sr-only"
              />
              <span className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <span
                  className={`text-sm font-semibold ${
                    locked
                      ? "text-foreground"
                      : selected
                        ? "text-foreground"
                        : "text-scanonix-muted"
                  }`}
                >
                  {settings.label}
                </span>
                {requiresPro && (
                  <ProIndicator
                    variant={locked ? "locked" : "active"}
                    title={
                      locked
                        ? "Pro feature — upgrade to unlock"
                        : "Pro compression level"
                    }
                  />
                )}
                {locked && (
                  <span className="text-[10px] font-semibold uppercase tracking-wide text-scanonix-muted">
                    Locked
                  </span>
                )}
              </span>
              <span className="mt-1.5 block text-xs leading-snug text-scanonix-muted">
                {settings.description}
              </span>
              <span className="mt-2 block text-xs font-medium text-scanonix-orange">
                Est. ~{formatFileSize(estimate)}
              </span>
            </label>
          );
        })}
      </div>

      {!isPro && (
        <p className="text-xs text-scanonix-muted">
          Free users can use light compression up to 10MB.{" "}
          <Link href="/pricing" className="text-scanonix-orange hover:underline">
            Upgrade to Pro
          </Link>{" "}
          for medium/strong levels and larger files.
        </p>
      )}

      <p className="text-xs text-scanonix-muted">
        Estimated output for selected level: ~{formatFileSize(estimatedSize)}{" "}
        (actual size may vary).
      </p>
    </div>
  );
}
