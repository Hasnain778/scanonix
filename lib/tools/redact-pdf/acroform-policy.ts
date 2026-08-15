import type { PDFDocument } from "pdf-lib";

type PdfLibDocument = PDFDocument;

/**
 * AcroForm policy (SECURITY CRITICAL):
 *
 * When ANY page is redacted:
 * - Remove all form fields whose widgets appear on a redacted page.
 * - Fields shared across redacted + clean pages are removed entirely so /V values
 *   cannot leak via the document-level AcroForm dictionary.
 * - Fail-safe: strip any remaining fields after targeted removal.
 */
export async function applyAcroFormRedactionPolicy(
  pdf: PdfLibDocument,
  redactedPageIndices: Set<number>,
): Promise<void> {
  if (redactedPageIndices.size === 0) {
    return;
  }

  let form;

  try {
    form = pdf.getForm();
  } catch {
    return;
  }

  const pages = pdf.getPages();
  const fields = [...form.getFields()];

  for (const field of fields) {
    let removeField = false;

    const acroField = (
      field as unknown as {
        acroField?: {
          getWidgets?: () => Array<{
            P?: () => unknown;
          }>;
        };
      }
    ).acroField;

    const widgets = acroField?.getWidgets?.() ?? [];

    if (widgets.length === 0) {
      removeField = true;
    } else {
      for (const widget of widgets) {
        const pageRef = widget.P?.();
        if (!pageRef) {
          removeField = true;
          break;
        }

        const pageIndex = pages.findIndex((page) => page.ref === pageRef);
        if (pageIndex >= 0 && redactedPageIndices.has(pageIndex)) {
          removeField = true;
          break;
        }
      }
    }

    if (removeField) {
      form.removeField(field);
    }
  }

  for (const field of [...form.getFields()]) {
    form.removeField(field);
  }
}

/** Annotation policy: redacted pages are raster-only (no original annotations copied). */
export const REDACTED_PAGE_ANNOTATION_POLICY =
  "Redacted pages are rebuilt from raster pixels — original annotations are not preserved.";

/** Clean pages copied via copyPages retain their original annotations. */
export const CLEAN_PAGE_ANNOTATION_POLICY =
  "Pages without redactions preserve original annotations.";
