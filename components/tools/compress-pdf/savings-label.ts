import { formatFileSize } from "@/lib/tools/format-utils";

/**
 * Compress PDF "Saved" label.
 * Keeps a plain percent when rounded sizes already differ.
 * When original and compressed format to the same KB/MB string, append the exact byte delta.
 */
export function formatCompressPdfSavingsLabel(
  originalSize: number,
  compressedSize: number,
  savingsPercent: number,
): string {
  const percentLabel = `${savingsPercent}%`;
  if (
    originalSize > compressedSize &&
    formatFileSize(originalSize) === formatFileSize(compressedSize)
  ) {
    return `${percentLabel} · ${formatFileSize(originalSize - compressedSize)}`;
  }
  return percentLabel;
}
