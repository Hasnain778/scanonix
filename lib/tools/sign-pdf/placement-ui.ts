import { clampNormalizedPlacement } from "./coordinates";
import type { NormalizedPlacement } from "./types";

export const MIN_NORMALIZED_SIGNATURE_SIZE = 0.05;
export const DEFAULT_NORMALIZED_SIGNATURE_WIDTH = 0.28;

export function canExportSignPdf(placements: NormalizedPlacement[]): boolean {
  return placements.length > 0;
}

export function createDefaultPlacement(params: {
  id: string;
  pageIndex: number;
  signatureAssetId: string;
  assetAspectRatio: number;
}): NormalizedPlacement {
  const aspect =
    Number.isFinite(params.assetAspectRatio) && params.assetAspectRatio > 0
      ? params.assetAspectRatio
      : 2.5;

  let normWidth = DEFAULT_NORMALIZED_SIGNATURE_WIDTH;
  let normHeight = normWidth / aspect;

  if (normHeight > 0.2) {
    normHeight = 0.2;
    normWidth = normHeight * aspect;
  }

  const clamped = clampNormalizedPlacement({
    normX: (1 - normWidth) / 2,
    normY: (1 - normHeight) / 2,
    normWidth,
    normHeight,
  });

  return {
    id: params.id,
    pageIndex: params.pageIndex,
    signatureAssetId: params.signatureAssetId,
    ...clamped,
  };
}

export function previewRectToNormalizedPlacement(
  placement: Pick<NormalizedPlacement, "id" | "pageIndex" | "signatureAssetId">,
  rect: { x: number; y: number; width: number; height: number },
  previewWidth: number,
  previewHeight: number,
): NormalizedPlacement {
  if (previewWidth <= 0 || previewHeight <= 0) {
    throw new Error("Preview dimensions must be positive.");
  }

  const clamped = clampNormalizedPlacement({
    normX: rect.x / previewWidth,
    normY: rect.y / previewHeight,
    normWidth: Math.max(MIN_NORMALIZED_SIGNATURE_SIZE, rect.width / previewWidth),
    normHeight: Math.max(MIN_NORMALIZED_SIGNATURE_SIZE, rect.height / previewHeight),
  });

  return {
    id: placement.id,
    pageIndex: placement.pageIndex,
    signatureAssetId: placement.signatureAssetId,
    ...clamped,
  };
}

export function constrainPreviewRectAspectRatio(
  rect: { x: number; y: number; width: number; height: number },
  aspectRatio: number,
  previewWidth: number,
  previewHeight: number,
  resizeFrom: "corner" = "corner",
): { x: number; y: number; width: number; height: number } {
  const safeAspect = aspectRatio > 0 ? aspectRatio : 2.5;
  let width = Math.max(24, rect.width);
  let height = width / safeAspect;

  if (height < 24) {
    height = 24;
    width = height * safeAspect;
  }

  width = Math.min(width, previewWidth);
  height = Math.min(height, previewHeight);

  if (width / height !== safeAspect) {
    height = width / safeAspect;
  }

  let x = rect.x;
  let y = rect.y;

  if (resizeFrom === "corner") {
    // Keep top-left fixed while resizing from bottom-right handle.
  }

  x = Math.max(0, Math.min(previewWidth - width, x));
  y = Math.max(0, Math.min(previewHeight - height, y));

  return { x, y, width, height };
}

export function movePreviewRect(
  rect: { x: number; y: number; width: number; height: number },
  deltaX: number,
  deltaY: number,
  previewWidth: number,
  previewHeight: number,
): { x: number; y: number; width: number; height: number } {
  const x = Math.max(0, Math.min(previewWidth - rect.width, rect.x + deltaX));
  const y = Math.max(0, Math.min(previewHeight - rect.height, rect.y + deltaY));
  return { ...rect, x, y };
}

export function getPlacementsForPage(
  placements: NormalizedPlacement[],
  pageIndex: number,
): NormalizedPlacement[] {
  return placements.filter((placement) => placement.pageIndex === pageIndex);
}
