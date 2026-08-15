import { StandardFonts } from "pdf-lib";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { detectExistingDigitalSignatures } from "./detect-signatures";
import { buildWatermarkedPdfFilename } from "./filename";
import {
  computeImageDrawSize,
  computeImageWatermarkAnchor,
  computeTextWatermarkAnchor,
  createWatermarkPageGeometry,
  localAnchorToPdfDrawOptions,
  validateImageFitsInVisibleBox,
  validateTextFitsInVisibleBox,
} from "./geometry";
import type {
  ValidatedWatermarkPdfOptions,
  WatermarkPdfExportResult,
  WatermarkPdfOptions,
} from "./types";
import { WatermarkPdfError } from "./types";
import {
  canUseBoldFont,
  validateImageDimensions,
  validateWatermarkPdfOptions,
} from "./validation";

async function embedWatermarkImage(
  pdf: Awaited<ReturnType<typeof loadPdfDocument>>,
  imageBytes: Uint8Array,
) {
  try {
    return await pdf.embedPng(imageBytes);
  } catch {
    try {
      return await pdf.embedJpg(imageBytes);
    } catch {
      throw new WatermarkPdfError(
        "INVALID_IMAGE",
        "Choose a PNG or JPEG image for the watermark.",
      );
    }
  }
}

export async function watermarkPdfDocument(
  originalBytes: ArrayBuffer,
  options: WatermarkPdfOptions | ValidatedWatermarkPdfOptions,
  originalFilename = "document.pdf",
  onProgress?: (current: number, total: number) => void,
): Promise<WatermarkPdfExportResult> {
  let pdf;

  try {
    pdf = await loadPdfDocument(originalBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new WatermarkPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new WatermarkPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new WatermarkPdfError(
      "CORRUPT_PDF",
      "This PDF contains no pages to watermark.",
    );
  }

  const validated: ValidatedWatermarkPdfOptions =
    "selectedPageIndices" in options
      ? options
      : validateWatermarkPdfOptions(options, pageCount);

  for (const pageIndex of validated.selectedPageIndices) {
    if (pageIndex < 0 || pageIndex >= pageCount) {
      throw new WatermarkPdfError(
        "INVALID_PAGE_RANGE",
        `Page ${pageIndex + 1} is outside the document range (1–${pageCount}).`,
      );
    }
  }

  const hasExistingDigitalSignatures = detectExistingDigitalSignatures(originalBytes);

  try {
    if (validated.type === "text") {
      const useBold = canUseBoldFont(validated.text, validated.bold);
      const font = await pdf.embedFont(
        useBold ? StandardFonts.HelveticaBold : StandardFonts.Helvetica,
      );
      const textWidth = font.widthOfTextAtSize(validated.text, validated.fontSize);

      for (let index = 0; index < validated.selectedPageIndices.length; index += 1) {
        onProgress?.(index + 1, validated.selectedPageIndices.length);

        const pageIndex = validated.selectedPageIndices[index];
        const page = pdf.getPage(pageIndex);

        const geometry = createWatermarkPageGeometry(
          readPdfBox(page.getMediaBox()),
          readPdfBox(page.getCropBox()),
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
          throw new WatermarkPdfError(
            "TEXT_DOES_NOT_FIT",
            `Page ${pageIndex + 1}: watermark text does not fit within the visible page area.`,
          );
        }

        const anchor = computeTextWatermarkAnchor(
          geometry,
          validated.position,
          validated.margin,
          textWidth,
          validated.fontSize,
        );

        const drawOptions = localAnchorToPdfDrawOptions(
          anchor,
          geometry,
          validated.rotationDegrees,
          validated.color,
        );

        page.drawText(validated.text, {
          x: drawOptions.x,
          y: drawOptions.y,
          size: validated.fontSize,
          font,
          color: drawOptions.color,
          rotate: drawOptions.rotate,
          opacity: validated.opacity,
        });
      }
    } else {
      const embeddedImage = await embedWatermarkImage(pdf, validated.imageBytes);
      validateImageDimensions(embeddedImage.width, embeddedImage.height);

      for (let index = 0; index < validated.selectedPageIndices.length; index += 1) {
        onProgress?.(index + 1, validated.selectedPageIndices.length);

        const pageIndex = validated.selectedPageIndices[index];
        const page = pdf.getPage(pageIndex);

        const geometry = createWatermarkPageGeometry(
          readPdfBox(page.getMediaBox()),
          readPdfBox(page.getCropBox()),
          page.getRotation().angle,
        );

        const { width: imageWidth, height: imageHeight } = computeImageDrawSize(
          geometry,
          embeddedImage.width,
          embeddedImage.height,
          validated.relativeWidthRatio,
        );

        if (
          !validateImageFitsInVisibleBox(
            geometry,
            validated.position,
            validated.margin,
            imageWidth,
            imageHeight,
            validated.rotationDegrees,
          )
        ) {
          throw new WatermarkPdfError(
            "TEXT_DOES_NOT_FIT",
            `Page ${pageIndex + 1}: watermark image does not fit within the visible page area.`,
          );
        }

        const anchor = computeImageWatermarkAnchor(
          geometry,
          validated.position,
          validated.margin,
          imageWidth,
          imageHeight,
          validated.rotationDegrees,
        );

        const drawOptions = localAnchorToPdfDrawOptions(
          anchor,
          geometry,
          validated.rotationDegrees,
        );

        page.drawImage(embeddedImage, {
          x: drawOptions.x,
          y: drawOptions.y,
          width: imageWidth,
          height: imageHeight,
          rotate: drawOptions.rotate,
          opacity: validated.opacity,
        });
      }
    }

    const bytes = await pdf.save();

    return {
      bytes,
      filename: buildWatermarkedPdfFilename(originalFilename),
      hasExistingDigitalSignatures,
    };
  } catch (error) {
    if (error instanceof WatermarkPdfError) {
      throw error;
    }

    throw new WatermarkPdfError(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "Failed to export watermarked PDF.",
    );
  }
}

function readPdfBox(box: {
  x: number;
  y: number;
  width: number;
  height: number;
}) {
  return {
    x: box.x,
    y: box.y,
    width: box.width,
    height: box.height,
  };
}

export function createDefaultTextWatermarkOptions(
  overrides: Partial<Extract<WatermarkPdfOptions, { type: "text" }>> = {},
): Extract<WatermarkPdfOptions, { type: "text" }> {
  return {
    type: "text",
    text: "CONFIDENTIAL",
    position: "center",
    opacity: 0.3,
    fontSize: 48,
    bold: false,
    color: "#666666",
    margin: 36,
    rotationDegrees: -45,
    allPages: true,
    pageRangeInput: "",
    ...overrides,
  };
}

export function createDefaultImageWatermarkOptions(
  imageBytes: Uint8Array,
  overrides: Partial<Omit<Extract<WatermarkPdfOptions, { type: "image" }>, "type" | "imageBytes">> = {},
): Extract<WatermarkPdfOptions, { type: "image" }> {
  return {
    type: "image",
    imageBytes,
    position: "center",
    opacity: 0.3,
    relativeWidthRatio: 0.2,
    margin: 36,
    rotationDegrees: 0,
    allPages: true,
    pageRangeInput: "",
    ...overrides,
  };
}
