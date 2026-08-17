import type { PrimaryToolCategory } from "@/constants/tool-categories";
import { getToolsCategoryHref } from "@/lib/navigation/tool-category-urls";

/** Indexable category hub for image tools (Phase 128F / 129G). */
export const IMAGE_TOOLS_HUB_PATH = "/tools/image" as const;

export function getImageToolsHubHref(): string {
  return IMAGE_TOOLS_HUB_PATH;
}

/** Breadcrumb target for a primary category — image uses the dedicated hub. */
export function getCategoryBreadcrumbHref(category: PrimaryToolCategory): string {
  if (category === "image") {
    return IMAGE_TOOLS_HUB_PATH;
  }

  return getToolsCategoryHref(category);
}
