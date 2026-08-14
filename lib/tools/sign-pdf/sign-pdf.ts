import { PDFDocument } from "pdf-lib";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import {
  clampNormalizedPlacement,
  createPageGeometry,
  normalizedPlacementToPdfRect,
} from "./coordinates";
import { MAX_SIGN_PDF_PAGES, MAX_SIGNATURE_PLACEMENTS } from "./limits";
import type { NormalizedPlacement, SignatureAsset } from "./types";
import { SignPdfError } from "./types";

function validatePlacements(
  placements: NormalizedPlacement[],
  pageCount: number,
): void {
  if (placements.length === 0) {
    throw new SignPdfError(
      "NO_PLACEMENTS",
      "Add at least one signature before exporting.",
    );
  }

  if (placements.length > MAX_SIGNATURE_PLACEMENTS) {
    throw new SignPdfError(
      "INVALID_PLACEMENT",
      `A maximum of ${MAX_SIGNATURE_PLACEMENTS} signatures is supported.`,
    );
  }

  for (const placement of placements) {
    if (placement.pageIndex < 0 || placement.pageIndex >= pageCount) {
      throw new SignPdfError(
        "INVALID_PLACEMENT",
        `Signature references page ${placement.pageIndex + 1}, but the document has ${pageCount} page(s).`,
      );
    }

    if (
      placement.normWidth <= 0 ||
      placement.normHeight <= 0 ||
      placement.normX < 0 ||
      placement.normY < 0 ||
      placement.normX + placement.normWidth > 1.0001 ||
      placement.normY + placement.normHeight > 1.0001
    ) {
      throw new SignPdfError(
        "INVALID_PLACEMENT",
        "Signature placement is outside the page bounds.",
      );
    }
  }
}

async function embedSignatureAsset(
  pdf: PDFDocument,
  asset: SignatureAsset,
) {
  if (asset.mimeType === "image/jpeg") {
    return pdf.embedJpg(asset.bytes);
  }

  try {
    return await pdf.embedPng(asset.bytes);
  } catch {
    return pdf.embedJpg(asset.bytes);
  }
}

export async function signPdfDocument(
  pdfBytes: ArrayBuffer,
  placements: NormalizedPlacement[],
  assets: SignatureAsset[],
  onProgress?: (current: number, total: number) => void,
): Promise<Blob> {
  let pdf: PDFDocument;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new SignPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }
    throw new SignPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new SignPdfError("NO_PAGES", "This PDF contains no pages to sign.");
  }

  if (pageCount > MAX_SIGN_PDF_PAGES) {
    throw new SignPdfError(
      "INVALID_PLACEMENT",
      `This PDF has ${pageCount} pages. The maximum supported for signing is ${MAX_SIGN_PDF_PAGES}.`,
    );
  }

  validatePlacements(placements, pageCount);

  const assetMap = new Map(assets.map((asset) => [asset.id, asset]));
  const embeddedImages = new Map<string, Awaited<ReturnType<typeof embedSignatureAsset>>>();

  try {
    for (let index = 0; index < placements.length; index += 1) {
      onProgress?.(index + 1, placements.length);

      const placement = placements[index];
      const asset = assetMap.get(placement.signatureAssetId);
      if (!asset) {
        throw new SignPdfError(
          "MISSING_ASSET",
          `Missing signature asset for placement ${placement.id}.`,
        );
      }

      let embedded = embeddedImages.get(asset.id);
      if (!embedded) {
        embedded = await embedSignatureAsset(pdf, asset);
        embeddedImages.set(asset.id, embedded);
      }

      const page = pdf.getPage(placement.pageIndex);
      const { width, height } = page.getSize();
      const geometry = createPageGeometry(width, height, page.getRotation().angle);
      const clamped = clampNormalizedPlacement(placement);
      const pdfRect = normalizedPlacementToPdfRect(clamped, geometry);

      page.drawImage(embedded, {
        x: pdfRect.x,
        y: pdfRect.y,
        width: pdfRect.width,
        height: pdfRect.height,
      });
    }

    const outputBytes = await pdf.save();
    return new Blob([new Uint8Array(outputBytes)], { type: "application/pdf" });
  } catch (error) {
    if (error instanceof SignPdfError) {
      throw error;
    }

    throw new SignPdfError(
      "EXPORT_FAILED",
      error instanceof Error ? error.message : "Failed to export signed PDF.",
    );
  }
}

export { buildSignedPdfFilename } from "./filename";
