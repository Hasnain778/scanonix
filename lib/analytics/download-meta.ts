import { getPrimaryCategory } from "@/constants/tool-categories";
import type { DownloadType, ToolCategory, ToolDownloadParams } from "@/lib/analytics/events";

/**
 * Builds allowlisted tool_download params from a known tool slug.
 * Returns undefined when the slug is not in the category matrix (no inference from filenames).
 */
export function buildToolDownloadMeta(
  toolSlug: string,
  outputCount: number,
  downloadType?: DownloadType,
): ToolDownloadParams | undefined {
  if (!Number.isInteger(outputCount) || outputCount < 1) {
    return undefined;
  }

  const category = getPrimaryCategory(toolSlug);
  if (!category) {
    return undefined;
  }

  return {
    tool_slug: toolSlug,
    tool_category: category as ToolCategory,
    output_count: outputCount,
    download_type: downloadType ?? (outputCount === 1 ? "single" : "zip"),
  };
}
