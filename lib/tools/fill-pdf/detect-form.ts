import type { DocumentFormType } from "./types";

const PDF_HEADER = "%PDF-";

function toUint8Array(bytes: ArrayBuffer | Uint8Array): Uint8Array {
  return bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
}

function bytesContainPattern(bytes: Uint8Array, pattern: string): boolean {
  const patternBytes = new TextEncoder().encode(pattern);
  if (patternBytes.length === 0 || bytes.length < patternBytes.length) {
    return false;
  }

  outer: for (let index = 0; index <= bytes.length - patternBytes.length; index += 1) {
    for (let offset = 0; offset < patternBytes.length; offset += 1) {
      if (bytes[index + offset] !== patternBytes[offset]) {
        continue outer;
      }
    }
    return true;
  }

  return false;
}

export function isPdfBytes(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = toUint8Array(bytes);
  if (view.length < 5) {
    return false;
  }

  const header = String.fromCharCode(view[0], view[1], view[2], view[3], view[4]);
  return header === PDF_HEADER;
}

export function bytesContainXfaReference(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = toUint8Array(bytes);
  return bytesContainPattern(view, "/XFA");
}

export function bytesContainAcroFormReference(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = toUint8Array(bytes);
  return bytesContainPattern(view, "/AcroForm");
}

async function loadPdfJsDocument(bytes: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");
  return pdfjs.getDocument({ data: bytes.slice() }).promise;
}

/**
 * Detect document form technology BEFORE calling pdf-lib getForm().
 * pdf-lib getForm() silently deletes XFA — hybrid/XFA must be rejected here.
 */
export async function detectDocumentFormType(
  bytes: ArrayBuffer | Uint8Array,
): Promise<DocumentFormType> {
  const view = toUint8Array(bytes);
  const hasXfaBytes = bytesContainXfaReference(view);
  const hasAcroFormBytes = bytesContainAcroFormReference(view);

  let isPureXfa = false;
  let hasXfaHtml = false;
  let hasAcroFormFields = false;

  try {
    const doc = await loadPdfJsDocument(view);
    isPureXfa = doc.isPureXfa;
    hasXfaHtml = doc.allXfaHtml != null;

    const fieldObjects = await doc.getFieldObjects();
    hasAcroFormFields =
      fieldObjects != null && Object.keys(fieldObjects).length > 0;

    await doc.cleanup();
  } catch {
    // Fall back to raw-byte heuristics when PDF.js cannot parse the file.
  }

  const hasXfa = hasXfaBytes || isPureXfa || hasXfaHtml;
  const hasAcro = hasAcroFormBytes || hasAcroFormFields;

  if (hasXfa && hasAcro) {
    return "HYBRID_XFA_ACROFORM";
  }

  if (hasXfa) {
    return "XFA";
  }

  if (hasAcro) {
    return "ACROFORM";
  }

  return "NO_FORM";
}

/** True when the PDF bytes contain signed signature dictionaries (/ByteRange). */
export function detectExistingDigitalSignatures(
  bytes: ArrayBuffer | Uint8Array,
): boolean {
  const view = toUint8Array(bytes);
  return (
    bytesContainPattern(view, "/ByteRange") &&
    (bytesContainPattern(view, "/Type /Sig") ||
      bytesContainPattern(view, "/Type/Sig") ||
      bytesContainPattern(view, "/SubFilter"))
  );
}

/**
 * Warning-only scan for JavaScript actions. Never executed.
 * Covers common /JavaScript and /JS action name patterns.
 */
export function hasJSActions(bytes: ArrayBuffer | Uint8Array): boolean {
  const view = toUint8Array(bytes);
  return (
    bytesContainPattern(view, "/JavaScript") ||
    bytesContainPattern(view, "/JS ") ||
    bytesContainPattern(view, "/JS\n") ||
    bytesContainPattern(view, "/JS\r") ||
    bytesContainPattern(view, "/JS(") ||
    bytesContainPattern(view, "/JS<")
  );
}

export function collectFillPdfWarnings(
  bytes: ArrayBuffer | Uint8Array,
): {
  hasExistingDigitalSignatures: boolean;
  hasJavaScriptActions: boolean;
} {
  return {
    hasExistingDigitalSignatures: detectExistingDigitalSignatures(bytes),
    hasJavaScriptActions: hasJSActions(bytes),
  };
}
