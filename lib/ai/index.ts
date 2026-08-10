/**
 * Local AI capabilities — run in the browser without a backend.
 * Cloud AI features live in services/ai.
 */

export type LocalAiCapability =
  | "ocr"
  | "background-removal"
  | "qr-decode";

export const LOCAL_AI_CAPABILITIES: Record<
  LocalAiCapability,
  { label: string; library: string }
> = {
  ocr: { label: "OCR Text Extraction", library: "tesseract.js" },
  "background-removal": {
    label: "Background Removal",
    library: "@imgly/background-removal",
  },
  "qr-decode": { label: "QR Scanner", library: "jsqr" },
};

export function isLocalAiCapability(id: string): id is LocalAiCapability {
  return id in LOCAL_AI_CAPABILITIES;
}

export * from "../tools/ocr/extract-text";
export * from "../tools/ocr/languages";
export * from "../tools/ocr/file-validation";
export * from "../tools/qr-scanner/decode-qr";
export * from "../tools/qr-scanner/parse-result";
export * from "../tools/qr-scanner/types";
