/**
 * Image tool inventory and related-tool expectations (Phase 129G).
 * Used by verify-seo-129g.ts — does not replace tool-seo copy.
 */

import { TOOL_CATEGORY_MATRIX } from "@/constants/tool-categories";
import { IMAGE_TOOLS_HUB_PATH } from "@/lib/navigation/category-hub-urls";

export { IMAGE_TOOLS_HUB_PATH };

/** Canonical image workspace tools from the category matrix. */
export const IMAGE_TOOL_IDS = TOOL_CATEGORY_MATRIX.filter(
  (entry) => entry.primaryCategory === "image",
)
  .map((entry) => entry.toolId)
  .sort() as readonly string[];

export const IMAGE_FORMAT_CLUSTERS = {
  webp: ["png-to-webp", "jpg-to-webp", "webp-to-jpg", "webp-to-png"] as const,
  heic: ["heic-to-jpg", "heic-to-png"] as const,
  raster: ["png-to-jpg", "jpg-to-png"] as const,
  edit: [
    "background-remover",
    "image-compressor",
    "image-resizer",
    "image-upscaler",
  ] as const,
} as const;

const MIN_RELATED = 3;
const MAX_RELATED = 5;

/** Whether a tool id belongs to the image category matrix. */
export function isImageCategoryToolId(toolId: string): boolean {
  return (IMAGE_TOOL_IDS as readonly string[]).includes(toolId);
}

/** Validate related-tool lists for image pages (3–5 ids, resolvable). */
export function validateImageRelatedToolIds(
  toolId: string,
  relatedToolIds: readonly string[],
): { ok: true } | { ok: false; reason: string } {
  if (!isImageCategoryToolId(toolId)) {
    return { ok: true };
  }

  if (relatedToolIds.length < MIN_RELATED || relatedToolIds.length > MAX_RELATED) {
    return {
      ok: false,
      reason: `expected ${MIN_RELATED}-${MAX_RELATED} related tools, got ${relatedToolIds.length}`,
    };
  }

  if (new Set(relatedToolIds).size !== relatedToolIds.length) {
    return { ok: false, reason: "duplicate related tool ids" };
  }

  if (relatedToolIds.includes(toolId)) {
    return { ok: false, reason: "related tools must not include self" };
  }

  return { ok: true };
}
