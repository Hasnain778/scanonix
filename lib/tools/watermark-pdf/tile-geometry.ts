/**
 * Shared repeat/tile watermark placement (preview + export).
 *
 * Single-watermark geometry remains in geometry.ts and is unchanged.
 * Both preview and export must call these helpers — no CSS-only duplicates.
 */

import {
  computeImageWatermarkAnchor,
  computeRotatedImageExtents,
  computeTextWatermarkAnchor,
  type CropPageGeometry,
  type WatermarkLocalAnchor,
} from "./geometry";
import type {
  WatermarkPlacementMode,
  WatermarkPosition,
  WatermarkRepeatPattern,
} from "./types";

export const WATERMARK_REPEAT_PATTERNS = ["2x2", "3x3", "4x4"] as const;

export const DEFAULT_WATERMARK_PLACEMENT_MODE: WatermarkPlacementMode = "single";
export const DEFAULT_WATERMARK_REPEAT_PATTERN: WatermarkRepeatPattern = "3x3";

export function isWatermarkRepeatPattern(
  value: unknown,
): value is WatermarkRepeatPattern {
  return (
    value === "2x2" || value === "3x3" || value === "4x4"
  );
}

export function isWatermarkPlacementMode(
  value: unknown,
): value is WatermarkPlacementMode {
  return value === "single" || value === "repeat";
}

export function parseRepeatPattern(pattern: WatermarkRepeatPattern): {
  rows: number;
  cols: number;
} {
  switch (pattern) {
    case "2x2":
      return { rows: 2, cols: 2 };
    case "3x3":
      return { rows: 3, cols: 3 };
    case "4x4":
      return { rows: 4, cols: 4 };
    default: {
      const exhaustive: never = pattern;
      return exhaustive;
    }
  }
}

export function getRepeatPatternTileCount(pattern: WatermarkRepeatPattern): number {
  const { rows, cols } = parseRepeatPattern(pattern);
  return rows * cols;
}

export function getRepeatPatternLabel(pattern: WatermarkRepeatPattern): string {
  const { rows, cols } = parseRepeatPattern(pattern);
  return `${rows} × ${cols} · ${rows * cols} watermarks per page`;
}

/**
 * Evenly distribute tile centers inside the usable page area (inset by margin).
 * Order is row-major: top→bottom, left→right.
 */
export function computeRepeatTileCenters(
  visualWidth: number,
  visualHeight: number,
  rows: number,
  cols: number,
  margin: number,
): Array<{ centerX: number; centerY: number }> {
  const safeMargin = Math.max(0, margin);
  const usableWidth = Math.max(0, visualWidth - 2 * safeMargin);
  const usableHeight = Math.max(0, visualHeight - 2 * safeMargin);
  const centers: Array<{ centerX: number; centerY: number }> = [];

  for (let row = 0; row < rows; row += 1) {
    for (let col = 0; col < cols; col += 1) {
      centers.push({
        centerX: safeMargin + ((col + 0.5) * usableWidth) / cols,
        centerY: safeMargin + ((row + 0.5) * usableHeight) / rows,
      });
    }
  }

  return centers;
}

export function computeTextRepeatTileAnchors(
  geometry: CropPageGeometry,
  pattern: WatermarkRepeatPattern,
  margin: number,
  textWidth: number,
  fontSize: number,
): WatermarkLocalAnchor[] {
  const { rows, cols } = parseRepeatPattern(pattern);
  const centers = computeRepeatTileCenters(
    geometry.visualWidth,
    geometry.visualHeight,
    rows,
    cols,
    margin,
  );

  return centers.map(({ centerX, centerY }) => ({
    localX: centerX - textWidth / 2,
    // Match single-position "center" baseline: mid-height + half font size.
    localY: centerY + fontSize / 2,
  }));
}

export function computeImageRepeatTileAnchors(
  geometry: CropPageGeometry,
  pattern: WatermarkRepeatPattern,
  margin: number,
  imageWidth: number,
  imageHeight: number,
  rotationDegrees = 0,
): WatermarkLocalAnchor[] {
  const { rows, cols } = parseRepeatPattern(pattern);
  const centers = computeRepeatTileCenters(
    geometry.visualWidth,
    geometry.visualHeight,
    rows,
    cols,
    margin,
  );
  const extents = computeRotatedImageExtents(
    imageWidth,
    imageHeight,
    rotationDegrees,
  );

  return centers.map(({ centerX, centerY }) => ({
    localX: centerX - (extents.minX + extents.maxX) / 2,
    localY: centerY - (extents.minY + extents.maxY) / 2,
  }));
}

export function enumerateTextWatermarkAnchors(
  geometry: CropPageGeometry,
  args: {
    placementMode?: WatermarkPlacementMode;
    repeatPattern?: WatermarkRepeatPattern;
    position: WatermarkPosition;
    margin: number;
    textWidth: number;
    fontSize: number;
  },
): WatermarkLocalAnchor[] {
  const mode = args.placementMode ?? DEFAULT_WATERMARK_PLACEMENT_MODE;
  if (mode !== "repeat") {
    return [
      computeTextWatermarkAnchor(
        geometry,
        args.position,
        args.margin,
        args.textWidth,
        args.fontSize,
      ),
    ];
  }

  const pattern = args.repeatPattern ?? DEFAULT_WATERMARK_REPEAT_PATTERN;
  return computeTextRepeatTileAnchors(
    geometry,
    pattern,
    args.margin,
    args.textWidth,
    args.fontSize,
  );
}

export function enumerateImageWatermarkAnchors(
  geometry: CropPageGeometry,
  args: {
    placementMode?: WatermarkPlacementMode;
    repeatPattern?: WatermarkRepeatPattern;
    position: WatermarkPosition;
    margin: number;
    imageWidth: number;
    imageHeight: number;
    rotationDegrees?: number;
  },
): WatermarkLocalAnchor[] {
  const mode = args.placementMode ?? DEFAULT_WATERMARK_PLACEMENT_MODE;
  const rotationDegrees = args.rotationDegrees ?? 0;
  if (mode !== "repeat") {
    return [
      computeImageWatermarkAnchor(
        geometry,
        args.position,
        args.margin,
        args.imageWidth,
        args.imageHeight,
        rotationDegrees,
      ),
    ];
  }

  const pattern = args.repeatPattern ?? DEFAULT_WATERMARK_REPEAT_PATTERN;
  return computeImageRepeatTileAnchors(
    geometry,
    pattern,
    args.margin,
    args.imageWidth,
    args.imageHeight,
    rotationDegrees,
  );
}

/**
 * Non-blocking UX hint: watermark bounds larger than a single tile cell.
 * Does not change export semantics.
 */
export function watermarkMayOverlapInRepeatPattern(
  visualWidth: number,
  visualHeight: number,
  pattern: WatermarkRepeatPattern,
  margin: number,
  contentWidth: number,
  contentHeight: number,
): boolean {
  const { rows, cols } = parseRepeatPattern(pattern);
  const safeMargin = Math.max(0, margin);
  const cellWidth = Math.max(0, visualWidth - 2 * safeMargin) / cols;
  const cellHeight = Math.max(0, visualHeight - 2 * safeMargin) / rows;
  return contentWidth > cellWidth * 0.92 || contentHeight > cellHeight * 0.92;
}
