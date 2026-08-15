/** PDF.js Node.js initialization for redact engine tests and server-side rasterization. */

import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);

function resolvePdfJsStandardFontDir(): string {
  const pdfjsDistPath = path.dirname(require.resolve("pdfjs-dist/package.json"));
  return `${path.join(pdfjsDistPath, "standard_fonts")}/`;
}

export async function loadPdfJsDocumentNode(data: Uint8Array) {
  const pdfjs = await import("pdfjs-dist/legacy/build/pdf.mjs");

  // Always copy — pdf.js may transfer (neuter) the underlying ArrayBuffer.
  const copy = new Uint8Array(data);

  return pdfjs.getDocument({
    data: copy,
    useWorkerFetch: false,
    standardFontDataUrl: resolvePdfJsStandardFontDir(),
  }).promise;
}

export function getPdfJsNodeRenderInit() {
  return {
    useWorkerFetch: false,
    standardFontDataUrl: resolvePdfJsStandardFontDir(),
  };
}
