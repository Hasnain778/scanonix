import { StandardFonts } from "pdf-lib";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import {
  computePageNumberAnchor,
  createPageNumberGeometry,
  localAnchorToPdfDrawOptions,
  validateTextFitsInVisibleBox,
} from "./geometry";
import { computeDisplayNumber, formatPageNumber } from "./numbering";
import { buildAllPagesList } from "./page-range";
import type { PageNumberOptions, ValidatedPageNumberOptions } from "./types";
import { AddPageNumbersError } from "./types";
import { validatePageNumberOptions } from "./validation";

export async function addPageNumbersToPdf(
  originalBytes: ArrayBuffer,
  options: PageNumberOptions | ValidatedPageNumberOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<Uint8Array> {
  let pdf;

  try {
    pdf = await loadPdfDocument(originalBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new AddPageNumbersError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new AddPageNumbersError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new AddPageNumbersError(
      "CORRUPT_PDF",
      "This PDF contains no pages to number.",
    );
  }

  const validated: ValidatedPageNumberOptions =
    "selectedPageIndices" in options
      ? options
      : validatePageNumberOptions(options, pageCount);

  for (const pageIndex of validated.selectedPageIndices) {
    if (pageIndex < 0 || pageIndex >= pageCount) {
      throw new AddPageNumbersError(
        "INVALID_PAGE_RANGE",
        `Page ${pageIndex + 1} is outside the document range (1–${pageCount}).`,
      );
    }
  }

  const selectedPagesOneBased = validated.selectedPageIndices.map((index) => index + 1);
  const totalInSequence = selectedPagesOneBased.length;

  try {
    const font = await pdf.embedFont(StandardFonts.Helvetica);

    for (let index = 0; index < validated.selectedPageIndices.length; index += 1) {
      onProgress?.(index + 1, validated.selectedPageIndices.length);

      const pageIndex = validated.selectedPageIndices[index];
      const page = pdf.getPage(pageIndex);

      const displayNumber = computeDisplayNumber(
        selectedPagesOneBased,
        pageIndex,
        validated.startingNumber,
      );

      if (displayNumber === null) {
        continue;
      }

      const text = formatPageNumber({
        displayNumber,
        totalInSequence,
        format: validated.format,
      });

      const textWidth = font.widthOfTextAtSize(text, validated.fontSize);

      const geometry = createPageNumberGeometry(
        {
          x: page.getMediaBox().x,
          y: page.getMediaBox().y,
          width: page.getMediaBox().width,
          height: page.getMediaBox().height,
        },
        {
          x: page.getCropBox().x,
          y: page.getCropBox().y,
          width: page.getCropBox().width,
          height: page.getCropBox().height,
        },
        page.getRotation().angle,
      );

      if (
        !validateTextFitsInVisibleBox(
          geometry,
          validated.position,
          validated.margin,
          textWidth,
          validated.fontSize,
        )
      ) {
        throw new AddPageNumbersError(
          "TEXT_DOES_NOT_FIT",
          `Page ${pageIndex + 1}: page number text does not fit within the visible page area.`,
        );
      }

      const anchor = computePageNumberAnchor(
        geometry,
        validated.position,
        validated.margin,
        textWidth,
        validated.fontSize,
      );

      const drawOptions = localAnchorToPdfDrawOptions(
        anchor,
        geometry,
        validated.fontSize,
        validated.color,
      );

      page.drawText(text, {
        x: drawOptions.x,
        y: drawOptions.y,
        size: drawOptions.size,
        font,
        color: drawOptions.color,
        rotate: drawOptions.rotate,
      });
    }

    return pdf.save();
  } catch (error) {
    if (error instanceof AddPageNumbersError) {
      throw error;
    }

    throw new AddPageNumbersError(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "Failed to export numbered PDF.",
    );
  }
}

/** Convenience helper for tests — default all-pages options. */
export function createDefaultPageNumberOptions(
  overrides: Partial<PageNumberOptions> = {},
): PageNumberOptions {
  return {
    allPages: true,
    pageRangeInput: "",
    startingNumber: 1,
    format: "number",
    position: "bottom-center",
    fontSize: 10,
    margin: 36,
    color: "#000000",
    ...overrides,
  };
}

export { buildAllPagesList };
