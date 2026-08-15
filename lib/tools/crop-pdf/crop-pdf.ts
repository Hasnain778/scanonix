import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import {
  createCropPageGeometry,
  normalizedCropToPdfCropBox,
} from "./coordinates";
import { canExportCropPdf } from "./crop-state";
import type { CropDocumentState, CropPageEntry } from "./types";
import { CropPdfError } from "./types";

function validateExportState(pages: CropPageEntry[]): void {
  if (!canExportCropPdf({ pages })) {
    throw new CropPdfError(
      "EXPORT_FAILED",
      "Add at least one page before exporting.",
    );
  }
}

/**
 * Export a cropped PDF from source bytes and the current crop state.
 *
 * Only pages with hasCustomCrop receive an updated CropBox via setCropBox.
 * Untouched/reset pages retain their original CropBox.
 * MediaBox, rotation, page count, and order are preserved. No rasterization.
 */
export async function cropPdfDocument(
  originalBytes: ArrayBuffer,
  state: CropDocumentState,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  validateExportState(state.pages);

  let pdf;

  try {
    pdf = await loadPdfDocument(originalBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new CropPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new CropPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const sourcePageCount = pdf.getPageCount();
  for (const entry of state.pages) {
    if (entry.sourcePageIndex < 0 || entry.sourcePageIndex >= sourcePageCount) {
      throw new CropPdfError(
        "INVALID_PAGE",
        `Page references source index ${entry.sourcePageIndex + 1}, but the document has ${sourcePageCount} page(s).`,
      );
    }
  }

  try {
    for (let index = 0; index < state.pages.length; index += 1) {
      onProgress?.(index + 1, state.pages.length);

      const entry = state.pages[index];
      if (!entry.hasCustomCrop) {
        continue;
      }

      const page = pdf.getPage(entry.sourcePageIndex);
      const geometry = createCropPageGeometry(
        entry.mediaBox,
        entry.originalCropBox,
        entry.intrinsicRotation,
      );
      const nextCropBox = normalizedCropToPdfCropBox(
        entry.normalizedCropRect,
        geometry,
      );

      if (
        !Number.isFinite(nextCropBox.x) ||
        !Number.isFinite(nextCropBox.y) ||
        !Number.isFinite(nextCropBox.width) ||
        !Number.isFinite(nextCropBox.height) ||
        nextCropBox.width <= 0 ||
        nextCropBox.height <= 0
      ) {
        throw new CropPdfError(
          "INVALID_CROP",
          "Crop selection produced invalid page geometry.",
        );
      }

      page.setCropBox(
        nextCropBox.x,
        nextCropBox.y,
        nextCropBox.width,
        nextCropBox.height,
      );
    }

    const outputBytes = await pdf.save();
    return new Blob([new Uint8Array(outputBytes)], { type: "application/pdf" });
  } catch (error) {
    if (error instanceof CropPdfError) {
      throw error;
    }

    throw new CropPdfError(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "Failed to export cropped PDF.",
    );
  }
}
