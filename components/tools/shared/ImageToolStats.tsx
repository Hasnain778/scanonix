import { formatFileSize } from "@/lib/tools/format-utils";

function calculateSavingsPercent(originalSize: number, outputSize: number): number {
  if (originalSize <= 0) return 0;
  const saved = Math.max(0, originalSize - outputSize);
  return Math.round((saved / originalSize) * 100);
}

interface ImageToolStatsProps {
  originalSize: number;
  outputSize: number;
  width?: number;
  height?: number;
  originalWidth?: number;
  originalHeight?: number;
  showDimensions?: boolean;
}

export function ImageToolStats({
  originalSize,
  outputSize,
  width,
  height,
  originalWidth,
  originalHeight,
  showDimensions = false,
}: ImageToolStatsProps) {
  const savings = calculateSavingsPercent(originalSize, outputSize);
  const sizeReduced = outputSize < originalSize;

  return (
    <div className="grid gap-4 sm:grid-cols-3">
      <div className="rounded-xl border border-scanonix-border bg-black/30 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-scanonix-muted">
          Original size
        </p>
        <p className="mt-2 text-xl font-bold text-white">{formatFileSize(originalSize)}</p>
        {showDimensions && originalWidth && originalHeight ? (
          <p className="mt-1 text-xs text-scanonix-muted">
            {originalWidth} × {originalHeight}px
          </p>
        ) : null}
      </div>
      <div className="rounded-xl border border-scanonix-orange/30 bg-scanonix-orange/10 p-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-scanonix-orange">
          Output size
        </p>
        <p className="mt-2 text-xl font-bold text-white">{formatFileSize(outputSize)}</p>
        {showDimensions && width && height ? (
          <p className="mt-1 text-xs text-scanonix-muted">
            {width} × {height}px
          </p>
        ) : null}
      </div>
      <div
        className={`rounded-xl border p-4 ${
          sizeReduced
            ? "border-green-500/30 bg-green-500/10"
            : "border-scanonix-border bg-black/30"
        }`}
      >
        <p
          className={`text-xs font-semibold uppercase tracking-wider ${
            sizeReduced ? "text-green-400" : "text-scanonix-muted"
          }`}
        >
          {sizeReduced ? "Saved" : "Change"}
        </p>
        <p className="mt-2 text-xl font-bold text-white">
          {sizeReduced ? `${savings}%` : formatFileSize(Math.abs(outputSize - originalSize))}
        </p>
      </div>
    </div>
  );
}
