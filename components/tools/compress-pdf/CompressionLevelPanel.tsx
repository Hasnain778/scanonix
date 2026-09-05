import Link from "next/link";
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
    <div className="rounded-2xl border border-scanonix-border bg-scanonix-surface p-5 sm:p-6">
      <h2 className="text-lg font-semibold text-white">Compression level</h2>
      <p className="mt-1 text-sm text-scanonix-muted">
        Choose how aggressively to optimize your PDF. Compression runs securely on
        the server. Results vary by document structure — image-heavy or scanned
        PDFs may see limited size reduction.
      </p>

      <div className="mt-6 grid gap-2 sm:grid-cols-3">
        {LEVEL_ORDER.map((option) => {
          const settings = COMPRESSION_LEVELS[option];
          const estimate = estimateCompressedSize(originalSize, option);
          const requiresPro = PRO_LEVELS.has(option);
          const locked = requiresPro && !isPro;

          return (
            <label
              key={option}
              className={`rounded-xl border p-4 transition-all duration-200 ${
                locked
                  ? "cursor-not-allowed border-scanonix-border/60 opacity-60"
                  : level === option
                    ? "cursor-pointer border-scanonix-orange bg-scanonix-orange/10"
                    : "cursor-pointer border-scanonix-border hover:border-scanonix-orange/40"
              } ${disabled ? "cursor-not-allowed opacity-50" : ""}`}
            >
              <input
                type="radio"
                name="compressionLevel"
                value={option}
                checked={level === option}
                onChange={() => {
                  if (!locked) onLevelChange(option);
                }}
                disabled={disabled || locked}
                className="sr-only"
              />
              <span className="block text-sm font-semibold text-white">
                {settings.label}
                {requiresPro && (
                  <span className="ml-2 rounded-full bg-scanonix-orange/20 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-scanonix-orange">
                    Pro
                  </span>
                )}
              </span>
              <span className="mt-1 block text-xs text-scanonix-muted">
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
        <p className="mt-4 text-xs text-scanonix-muted">
          Free users can use light compression up to 10MB.{" "}
          <Link href="/pricing" className="text-scanonix-orange hover:underline">
            Upgrade to Pro
          </Link>{" "}
          for medium/strong levels and larger files.
        </p>
      )}

      <p className="mt-4 text-xs text-scanonix-muted">
        Estimated output for selected level: ~{formatFileSize(estimatedSize)}{" "}
        (actual size may vary).
      </p>
    </div>
  );
}
