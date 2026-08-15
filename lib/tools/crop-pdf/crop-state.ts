import type {
  CropDocumentState,
  CropPageEntry,
  NormalizedCropRect,
} from "./types";
import { CropPdfError, FULL_VISIBLE_CROP } from "./types";
import {
  isFullVisibleCrop,
  validateNormalizedCrop,
} from "./coordinates";

export function findPageIndexById(
  pages: CropPageEntry[],
  id: string,
): number {
  return pages.findIndex((page) => page.id === id);
}

export function getPageById(
  pages: CropPageEntry[],
  id: string,
): CropPageEntry {
  const page = pages.find((entry) => entry.id === id);
  if (!page) {
    throw new CropPdfError("INVALID_PAGE", "Page not found in document.");
  }
  return page;
}

export function hasCustomCrop(page: CropPageEntry): boolean {
  return page.hasCustomCrop;
}

export function validatePageCrop(rect: NormalizedCropRect): void {
  if (!validateNormalizedCrop(rect)) {
    if (
      !Number.isFinite(rect.x) ||
      !Number.isFinite(rect.y) ||
      !Number.isFinite(rect.width) ||
      !Number.isFinite(rect.height)
    ) {
      throw new CropPdfError("INVALID_CROP", "Crop coordinates are invalid.");
    }

    if (
      rect.width < 0.02 ||
      rect.height < 0.02 ||
      rect.width <= 0 ||
      rect.height <= 0
    ) {
      throw new CropPdfError(
        "CROP_TOO_SMALL",
        "Crop area is too small. Increase the selection size.",
      );
    }

    throw new CropPdfError(
      "INVALID_CROP",
      "Crop selection is outside the allowed page bounds.",
    );
  }
}

function withCropState(
  page: CropPageEntry,
  normalizedCropRect: NormalizedCropRect,
): CropPageEntry {
  const hasCustom = !isFullVisibleCrop(normalizedCropRect);
  return {
    ...page,
    normalizedCropRect,
    hasCustomCrop: hasCustom,
  };
}

export function setCropForPage(
  state: CropDocumentState,
  pageId: string,
  normalizedCropRect: NormalizedCropRect,
): CropDocumentState {
  validatePageCrop(normalizedCropRect);
  getPageById(state.pages, pageId);

  return {
    pages: state.pages.map((page) =>
      page.id === pageId ? withCropState(page, normalizedCropRect) : page,
    ),
  };
}

export function resetPageCrop(
  state: CropDocumentState,
  pageId: string,
): CropDocumentState {
  getPageById(state.pages, pageId);

  return {
    pages: state.pages.map((page) =>
      page.id === pageId ? withCropState(page, FULL_VISIBLE_CROP) : page,
    ),
  };
}

export function resetAllCrops(state: CropDocumentState): CropDocumentState {
  return {
    pages: state.pages.map((page) => withCropState(page, FULL_VISIBLE_CROP)),
  };
}

export interface ApplyCropCompatibility {
  compatible: boolean;
  reason?: string;
}

/** Pages are compatible when visible dimensions and rotation match. */
export function getApplyCropCompatibility(
  source: CropPageEntry,
  target: CropPageEntry,
): ApplyCropCompatibility {
  if (source.intrinsicRotation !== target.intrinsicRotation) {
    return {
      compatible: false,
      reason: "Pages have different rotation metadata.",
    };
  }

  const sourceVisible = source.visibleBox;
  const targetVisible = target.visibleBox;

  if (
    Math.abs(sourceVisible.width - targetVisible.width) > 0.5 ||
    Math.abs(sourceVisible.height - targetVisible.height) > 0.5
  ) {
    return {
      compatible: false,
      reason: "Pages have different visible dimensions.",
    };
  }

  return { compatible: true };
}

export interface ApplyCropResult {
  state: CropDocumentState;
  appliedPageIds: string[];
  skippedPageIds: string[];
}

/**
 * Apply the source page's normalized crop to all compatible pages.
 * Uses normalized visual proportions — never raw PDF-point coordinates.
 */
export function applyNormalizedCropToPages(
  state: CropDocumentState,
  sourcePageId: string,
  targetPageIds: string[],
): ApplyCropResult {
  const source = getPageById(state.pages, sourcePageId);
  validatePageCrop(source.normalizedCropRect);

  const appliedPageIds: string[] = [];
  const skippedPageIds: string[] = [];

  const nextPages = state.pages.map((page) => {
    if (!targetPageIds.includes(page.id)) {
      return page;
    }

    if (page.id === sourcePageId) {
      appliedPageIds.push(page.id);
      return page;
    }

    const compatibility = getApplyCropCompatibility(source, page);
    if (!compatibility.compatible) {
      skippedPageIds.push(page.id);
      return page;
    }

    appliedPageIds.push(page.id);
    return withCropState(page, source.normalizedCropRect);
  });

  return {
    state: { pages: nextPages },
    appliedPageIds,
    skippedPageIds,
  };
}

export function withPages(
  state: CropDocumentState,
  pages: CropPageEntry[],
): CropDocumentState {
  return { pages };
}

export function canExportCropPdf(state: CropDocumentState): boolean {
  return state.pages.length > 0;
}
