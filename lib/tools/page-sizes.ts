import type { PageOrientation, PageSize } from "./types";

/** Millimetres per pixel at 96 DPI. */
export const PX_TO_MM = 25.4 / 96;

export const PAGE_DIMENSIONS_MM = {
  a4: { width: 210, height: 297 },
  letter: { width: 215.9, height: 279.4 },
} as const;

export function getPageDimensionsMm(
  pageSize: PageSize,
  orientation: PageOrientation,
  imageWidthPx?: number,
  imageHeightPx?: number,
): { width: number; height: number } {
  if (pageSize === "fit" && imageWidthPx && imageHeightPx) {
    return {
      width: imageWidthPx * PX_TO_MM,
      height: imageHeightPx * PX_TO_MM,
    };
  }

  const base =
    pageSize === "letter" ? PAGE_DIMENSIONS_MM.letter : PAGE_DIMENSIONS_MM.a4;

  if (orientation === "landscape") {
    return { width: base.height, height: base.width };
  }

  return { width: base.width, height: base.height };
}

export function fitImageToPage(
  imageWidthMm: number,
  imageHeightMm: number,
  pageWidthMm: number,
  pageHeightMm: number,
): { width: number; height: number; x: number; y: number } {
  const scale = Math.min(
    pageWidthMm / imageWidthMm,
    pageHeightMm / imageHeightMm,
  );

  const width = imageWidthMm * scale;
  const height = imageHeightMm * scale;
  const x = (pageWidthMm - width) / 2;
  const y = (pageHeightMm - height) / 2;

  return { width, height, x, y };
}
