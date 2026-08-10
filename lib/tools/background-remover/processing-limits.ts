/** Free / anonymous background removal processing budget (longest edge). */
export const FREE_PROCESSING_MAX_LONG_EDGE = 1920;

/** Pro / Business background removal processing budget (matches 4K export preset). */
export const PRO_PROCESSING_MAX_LONG_EDGE = 3840;

/** Hard server-side reject for decompression-bomb / malicious dimensions. */
export const MAX_ACCEPTED_LONG_EDGE = 16_384;

/** Hard server-side reject for total pixel count (~100 MP). */
export const MAX_ACCEPTED_PIXELS = 100_000_000;

export function buildOptimizationNotice(
  originalWidth: number,
  originalHeight: number,
  processedWidth: number,
  processedHeight: number,
  isPremium: boolean,
): string {
  const exportLabel = isPremium ? "4K (3840px)" : "HD (1920px)";
  return (
    `Large photo (${originalWidth}×${originalHeight}px) was automatically optimized to ` +
    `${processedWidth}×${processedHeight}px for background removal. ` +
    `Export up to ${exportLabel} longest edge.`
  );
}
