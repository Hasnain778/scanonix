import { formatFileSize } from "@/lib/tools/format-utils";
import { calculateSavingsPercent } from "@/lib/tools/compress-pdf/compression-levels";

interface CompressionStatsProps {
  originalSize: number;
  compressedSize: number;
}

export function CompressionStats({
  originalSize,
  compressedSize,
}: CompressionStatsProps) {
  const savings = calculateSavingsPercent(originalSize, compressedSize);
  const hasSavings = savings > 0;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-border bg-surface-muted p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-scanonix-muted">
          Original size
        </p>
        <p className="mt-2 text-xl font-bold text-foreground">
          {formatFileSize(originalSize)}
        </p>
      </div>
      <div className="rounded-xl border border-scanonix-orange/40 bg-scanonix-orange/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-scanonix-orange">
          Compressed size
        </p>
        <p className="mt-2 text-xl font-bold text-foreground">
          {formatFileSize(compressedSize)}
        </p>
      </div>
      <div
        className={
          hasSavings
            ? "rounded-xl border border-green-500/30 bg-green-500/10 p-4"
            : "rounded-xl border border-border bg-surface-muted p-4"
        }
      >
        <p
          className={
            hasSavings
              ? "text-xs font-semibold uppercase tracking-wider text-green-400"
              : "text-xs font-semibold uppercase tracking-wider text-scanonix-muted"
          }
        >
          {hasSavings ? "Saved" : "Size change"}
        </p>
        <p className="mt-2 text-xl font-bold text-foreground">
          {hasSavings ? `${savings}%` : "No size reduction"}
        </p>
      </div>
    </div>
  );
}
