import { jsPDF } from "jspdf";
import { processImageFile } from "../image-utils";
import { fitImageToPage, getPageDimensionsMm, PX_TO_MM } from "../page-sizes";
import type { ImageItem, PdfGenerationOptions } from "../types";

export async function generateImagesToPdf(
  images: ImageItem[],
  options: PdfGenerationOptions,
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  if (images.length === 0) {
    throw new Error("Add at least one image to create a PDF");
  }

  let pdf: jsPDF | null = null;

  for (let index = 0; index < images.length; index++) {
    const image = images[index];
    onProgress?.(index + 1, images.length);

    const processed = await processImageFile(image.file, image.rotation);
    const imageWidthMm = processed.widthPx * PX_TO_MM;
    const imageHeightMm = processed.heightPx * PX_TO_MM;

    const pageDimensions = getPageDimensionsMm(
      options.pageSize,
      options.orientation,
      processed.widthPx,
      processed.heightPx,
    );

    if (index === 0) {
      pdf = new jsPDF({
        orientation:
          pageDimensions.width > pageDimensions.height
            ? "landscape"
            : "portrait",
        unit: "mm",
        format: [pageDimensions.width, pageDimensions.height],
        compress: true,
      });
    } else {
      pdf!.addPage(
        [pageDimensions.width, pageDimensions.height],
        pageDimensions.width > pageDimensions.height
          ? "landscape"
          : "portrait",
      );
    }

    const placement =
      options.pageSize === "fit"
        ? {
            x: 0,
            y: 0,
            width: pageDimensions.width,
            height: pageDimensions.height,
          }
        : fitImageToPage(
            imageWidthMm,
            imageHeightMm,
            pageDimensions.width,
            pageDimensions.height,
          );

    pdf!.addImage(
      processed.dataUrl,
      processed.format,
      placement.x,
      placement.y,
      placement.width,
      placement.height,
      undefined,
      "FAST",
    );
  }

  return pdf!.output("blob");
}
