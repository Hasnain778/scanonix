import { clampNormalizedCrop } from "./coordinates";
import {
  getApplyCropCompatibility,
  getPageById,
  hasCustomCrop,
  type ApplyCropResult,
} from "./crop-state";
import type { CropPageEntry, NormalizedCropRect } from "./types";

export type CropResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "w"
  | "e"
  | "sw"
  | "s"
  | "se";

export function canExportCropWorkspace(
  pageCount: number,
  isExporting: boolean,
): boolean {
  return pageCount > 0 && !isExporting;
}

export function countCustomCropPages(pages: CropPageEntry[]): number {
  return pages.filter((page) => hasCustomCrop(page)).length;
}

export function getCompatiblePageIds(
  pages: CropPageEntry[],
  sourcePageId: string,
): string[] {
  const source = getPageById(pages, sourcePageId);
  return pages
    .filter((page) => getApplyCropCompatibility(source, page).compatible)
    .map((page) => page.id);
}

export function countCompatiblePages(
  pages: CropPageEntry[],
  sourcePageId: string,
): number {
  return getCompatiblePageIds(pages, sourcePageId).length;
}

export function moveNormalizedCrop(
  rect: NormalizedCropRect,
  deltaX: number,
  deltaY: number,
): NormalizedCropRect {
  return clampNormalizedCrop({
    ...rect,
    x: rect.x + deltaX,
    y: rect.y + deltaY,
  });
}

export function resizeNormalizedCrop(
  rect: NormalizedCropRect,
  handle: CropResizeHandle,
  deltaX: number,
  deltaY: number,
): NormalizedCropRect {
  let { x, y, width, height } = rect;

  switch (handle) {
    case "nw":
      x += deltaX;
      y += deltaY;
      width -= deltaX;
      height -= deltaY;
      break;
    case "n":
      y += deltaY;
      height -= deltaY;
      break;
    case "ne":
      y += deltaY;
      width += deltaX;
      height -= deltaY;
      break;
    case "w":
      x += deltaX;
      width -= deltaX;
      break;
    case "e":
      width += deltaX;
      break;
    case "sw":
      x += deltaX;
      width -= deltaX;
      height += deltaY;
      break;
    case "s":
      height += deltaY;
      break;
    case "se":
      width += deltaX;
      height += deltaY;
      break;
    default:
      break;
  }

  return clampNormalizedCrop({ x, y, width, height });
}

export function normalizedCropFromPercentInputs(inputs: {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
}): NormalizedCropRect {
  return clampNormalizedCrop({
    x: inputs.xPercent / 100,
    y: inputs.yPercent / 100,
    width: inputs.widthPercent / 100,
    height: inputs.heightPercent / 100,
  });
}

export function normalizedCropToPercentInputs(rect: NormalizedCropRect): {
  xPercent: number;
  yPercent: number;
  widthPercent: number;
  heightPercent: number;
} {
  return {
    xPercent: Math.round(rect.x * 1000) / 10,
    yPercent: Math.round(rect.y * 1000) / 10,
    widthPercent: Math.round(rect.width * 1000) / 10,
    heightPercent: Math.round(rect.height * 1000) / 10,
  };
}

export function formatApplyCropSummary(result: ApplyCropResult): string {
  const applied = result.appliedPageIds.length;
  const skipped = result.skippedPageIds.length;

  if (skipped === 0) {
    return `Applied crop to ${applied} page${applied === 1 ? "" : "s"}.`;
  }

  return `Applied crop to ${applied} page${applied === 1 ? "" : "s"}. Skipped ${skipped} incompatible page${skipped === 1 ? "" : "s"}.`;
}

export function shouldClearCropStateOnReplace(): boolean {
  return true;
}
