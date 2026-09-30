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

      <div className="grid gap-1.5" role="radiogroup" aria-label="Compression level">
        {LEVEL_ORDER.map((option) => {
          const settings = COMPRESSION_LEVELS[option];
          const estimate = estimateCompressedSize(originalSize, option);
          const requiresPro = PRO_LEVELS.has(option);
          const locked = requiresPro && !isPro;
          const selected = level === option;

          return (
            <label
              key={option}
              className={`relative block rounded-lg px-3 py-2.5 transition-colors focus-within:outline-none focus-within:ring-2 focus-within:ring-scanonix-orange/35 ${
                locked
                  ? "cursor-not-allowed bg-surface-muted/50"
                  : selected
                    ? "cursor-pointer bg-scanonix-orange/10 text-foreground ring-1 ring-scanonix-orange/45"
                    : "cursor-pointer text-scanonix-muted hover:bg-surface-muted/80 hover:text-foreground"
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
              <span className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
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
              <span className="mt-1.5 block min-w-0 text-xs leading-relaxed text-scanonix-muted">
                {settings.description}
              </span>
              <span className="mt-2 block min-w-0 text-xs font-medium leading-relaxed text-scanonix-orange">
                Rough guide ~{formatFileSize(estimate)} — not a guaranteed size
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
        Rough guide for the selected level: ~{formatFileSize(estimatedSize)}.
        This is a fixed ratio, not a measurement of this PDF. Already-optimized
        files may not get smaller.
      </p>
    </div>
  );
}
