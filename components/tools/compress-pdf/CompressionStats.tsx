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

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-scanonix-border bg-black/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-scanonix-muted">
          Original size
        </p>
        <p className="mt-2 text-xl font-bold text-white">
          {formatFileSize(originalSize)}
        </p>
      </div>
      <div className="rounded-xl border border-scanonix-orange/30 bg-scanonix-orange/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-scanonix-orange">
          Compressed size
        </p>
        <p className="mt-2 text-xl font-bold text-white">
          {formatFileSize(compressedSize)}
        </p>
      </div>
      <div className="rounded-xl border border-green-500/30 bg-green-500/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-green-400">
          Saved
        </p>
        <p className="mt-2 text-xl font-bold text-white">{savings}%</p>
      </div>
    </div>
  );
}
