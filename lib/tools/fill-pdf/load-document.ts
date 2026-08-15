import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import { buildFormFieldDescriptors } from "./field-descriptors";
import { createInitialFormState } from "./field-values";
import {
  collectFillPdfWarnings,
  detectDocumentFormType,
  isPdfBytes,
} from "./detect-form";
import {
  MAX_FILL_PDF_BYTES,
  MAX_FILL_PDF_FIELDS,
  MAX_FILL_PDF_PAGES,
} from "./limits";
import type { FillPdfDocumentState } from "./types";
import { FillPdfError } from "./types";

export interface LoadFillPdfDocumentOptions {
  byteLength?: number;
}

export async function loadFillPdfDocumentState(
  pdfBytes: ArrayBuffer,
  options: LoadFillPdfDocumentOptions = {},
): Promise<FillPdfDocumentState> {
  if (!isPdfBytes(pdfBytes)) {
    throw new FillPdfError(
      "WRONG_FILE_TYPE",
      "Only PDF files are supported for form filling.",
    );
  }

  const byteLength = options.byteLength ?? pdfBytes.byteLength;
  if (byteLength > MAX_FILL_PDF_BYTES || pdfBytes.byteLength > MAX_FILL_PDF_BYTES) {
    throw new FillPdfError(
      "FILE_TOO_LARGE",
      `This PDF exceeds the ${Math.round(MAX_FILL_PDF_BYTES / (1024 * 1024))}MB size limit.`,
    );
  }

  const documentFormType = await detectDocumentFormType(pdfBytes);

  if (documentFormType === "XFA") {
    throw new FillPdfError(
      "XFA_UNSUPPORTED",
      "This PDF uses XFA forms, which are not supported. Please use a standard AcroForm PDF.",
    );
  }

  if (documentFormType === "HYBRID_XFA_ACROFORM") {
    throw new FillPdfError(
      "HYBRID_XFA_UNSUPPORTED",
      "This PDF mixes XFA and AcroForm data, which is not supported.",
    );
  }

  let pdf;

  try {
    pdf = await loadPdfDocument(pdfBytes);
  } catch (error) {
    if (error instanceof PdfLoadError) {
      throw new FillPdfError(
        error.code === "PASSWORD" ? "PASSWORD_PDF" : "CORRUPT_PDF",
        error.message,
      );
    }

    throw new FillPdfError(
      "CORRUPT_PDF",
      error instanceof Error ? error.message : "Could not read this PDF.",
    );
  }

  const pageCount = pdf.getPageCount();
  if (pageCount === 0) {
    throw new FillPdfError(
      "CORRUPT_PDF",
      "This PDF contains no pages.",
    );
  }

  if (pageCount > MAX_FILL_PDF_PAGES) {
    throw new FillPdfError(
      "TOO_MANY_PAGES",
      `This PDF has ${pageCount} pages. The maximum supported is ${MAX_FILL_PDF_PAGES}.`,
    );
  }

  const fields = buildFormFieldDescriptors(pdf);

  if (fields.length === 0) {
    throw new FillPdfError(
      "NO_FORM_FIELDS",
      "This PDF does not contain any fillable form fields.",
    );
  }

  if (fields.length > MAX_FILL_PDF_FIELDS) {
    throw new FillPdfError(
      "TOO_MANY_FIELDS",
      `This PDF has ${fields.length} form fields. The maximum supported is ${MAX_FILL_PDF_FIELDS}.`,
    );
  }

  const initialValues = createInitialFormState(fields);
  const warnings = collectFillPdfWarnings(pdfBytes);

  return {
    documentFormType,
    pageCount,
    fields,
    initialValues,
    warnings,
  };
}
