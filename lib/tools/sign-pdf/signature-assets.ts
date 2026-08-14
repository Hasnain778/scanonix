import {
  MAX_SIGNATURE_IMAGE_BYTES,
  MAX_SIGNATURE_IMAGE_LONG_EDGE,
} from "./limits";
import type { SignatureAsset, SignatureSourceType } from "./types";
import { SignPdfError } from "./types";

const ACCEPTED_SIGNATURE_MIME_TYPES = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
]);

const ACCEPTED_SIGNATURE_EXTENSIONS = new Set(["png", "jpg", "jpeg"]);

const REJECTED_SIGNATURE_MIME_PREFIXES = ["image/svg", "image/gif", "image/webp"];

export const SIGNATURE_TYPED_FONT_STYLES = [
  {
    id: "script",
    label: "Script",
    font: '"Segoe Script", "Snell Roundhand", "Apple Chancery", "Brush Script MT", cursive',
  },
  {
    id: "formal",
    label: "Formal",
    font: 'Georgia, "Times New Roman", serif',
  },
  {
    id: "simple",
    label: "Simple",
    font: 'system-ui, -apple-system, "Segoe UI", sans-serif',
  },
] as const;

export type SignatureTypedFontStyleId =
  (typeof SIGNATURE_TYPED_FONT_STYLES)[number]["id"];

function assertBrowserCanvas(): void {
  if (typeof document === "undefined") {
    throw new SignPdfError(
      "UNSUPPORTED_SIGNATURE",
      "Signature rendering requires a browser environment.",
    );
  }
}

function createCanvas(width: number, height: number): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  return canvas;
}

function measureTextWidth(text: string, font: string): number {
  const canvas = createCanvas(1, 1);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new SignPdfError("UNSUPPORTED_SIGNATURE", "Canvas is not supported.");
  }
  context.font = font;
  return context.measureText(text).width;
}

function canvasToPngBytes(canvas: HTMLCanvasElement): Promise<Uint8Array> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      async (blob) => {
        if (!blob) {
          reject(new SignPdfError("UNSUPPORTED_SIGNATURE", "Failed to export signature PNG."));
          return;
        }
        resolve(new Uint8Array(await blob.arrayBuffer()));
      },
      "image/png",
    );
  });
}

function trimCanvasTransparentPadding(
  canvas: HTMLCanvasElement,
): HTMLCanvasElement {
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) {
    return canvas;
  }

  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);

  let minX = width;
  let minY = height;
  let maxX = 0;
  let maxY = 0;
  let hasInk = false;

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      const alpha = data[(y * width + x) * 4 + 3];
      if (alpha > 8) {
        hasInk = true;
        minX = Math.min(minX, x);
        minY = Math.min(minY, y);
        maxX = Math.max(maxX, x);
        maxY = Math.max(maxY, y);
      }
    }
  }

  if (!hasInk) {
    return canvas;
  }

  const trimmedWidth = Math.max(1, maxX - minX + 1);
  const trimmedHeight = Math.max(1, maxY - minY + 1);
  const trimmed = createCanvas(trimmedWidth, trimmedHeight);
  const trimmedContext = trimmed.getContext("2d");
  if (!trimmedContext) {
    return canvas;
  }

  trimmedContext.drawImage(
    canvas,
    minX,
    minY,
    trimmedWidth,
    trimmedHeight,
    0,
    0,
    trimmedWidth,
    trimmedHeight,
  );

  return trimmed;
}

export function validateSignatureImageFile(file: File): string | null {
  const type = file.type.toLowerCase();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

  if (
    REJECTED_SIGNATURE_MIME_PREFIXES.some((prefix) => type.startsWith(prefix)) ||
    extension === "svg" ||
    extension === "gif" ||
    extension === "webp" ||
    extension === "html" ||
    extension === "htm"
  ) {
    return "Unsupported signature image type. Use PNG or JPG/JPEG.";
  }

  const mimeOk =
    ACCEPTED_SIGNATURE_MIME_TYPES.has(type) ||
    ACCEPTED_SIGNATURE_EXTENSIONS.has(extension);

  if (!mimeOk) {
    return "Unsupported signature image type. Use PNG or JPG/JPEG.";
  }

  if (file.size === 0) {
    return "The signature image is empty.";
  }

  if (file.size > MAX_SIGNATURE_IMAGE_BYTES) {
    const maxMb = Math.round(MAX_SIGNATURE_IMAGE_BYTES / (1024 * 1024));
    return `Signature image exceeds the ${maxMb} MB limit.`;
  }

  return null;
}

export async function normalizeUploadedSignatureFile(
  file: File,
  assetId: string,
): Promise<SignatureAsset> {
  const validationError = validateSignatureImageFile(file);
  if (validationError) {
    throw new SignPdfError("UNSUPPORTED_SIGNATURE", validationError);
  }

  assertBrowserCanvas();

  const url = URL.createObjectURL(file);
  try {
    const image = await loadImageElement(url);
    const longEdge = Math.max(image.naturalWidth, image.naturalHeight);
    const scale =
      longEdge > MAX_SIGNATURE_IMAGE_LONG_EDGE
        ? MAX_SIGNATURE_IMAGE_LONG_EDGE / longEdge
        : 1;

    const width = Math.max(1, Math.round(image.naturalWidth * scale));
    const height = Math.max(1, Math.round(image.naturalHeight * scale));
    const canvas = createCanvas(width, height);
    const context = canvas.getContext("2d");
    if (!context) {
      throw new SignPdfError("UNSUPPORTED_SIGNATURE", "Canvas is not supported.");
    }

    context.clearRect(0, 0, width, height);
    context.drawImage(image, 0, 0, width, height);

    const bytes = await canvasToPngBytes(canvas);
    return {
      id: assetId,
      sourceType: "upload",
      bytes,
      mimeType: "image/png",
    };
  } finally {
    URL.revokeObjectURL(url);
  }
}

export async function createTypedSignatureAsset(
  text: string,
  assetId: string,
  fontStyleId: SignatureTypedFontStyleId = "script",
): Promise<SignatureAsset> {
  const trimmed = text.trim();
  if (!trimmed) {
    throw new SignPdfError("UNSUPPORTED_SIGNATURE", "Enter a name to create a signature.");
  }

  assertBrowserCanvas();

  const style =
    SIGNATURE_TYPED_FONT_STYLES.find((entry) => entry.id === fontStyleId) ??
    SIGNATURE_TYPED_FONT_STYLES[0];

  const fontSize = 64;
  const font = `${fontSize}px ${style.font}`;
  const textWidth = measureTextWidth(trimmed, font);
  const canvas = createCanvas(Math.ceil(textWidth + 32), fontSize + 32);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new SignPdfError("UNSUPPORTED_SIGNATURE", "Canvas is not supported.");
  }

  context.clearRect(0, 0, canvas.width, canvas.height);
  context.font = font;
  context.fillStyle = "#111111";
  context.textBaseline = "middle";
  context.fillText(trimmed, 16, canvas.height / 2);

  const trimmedCanvas = trimCanvasTransparentPadding(canvas);
  const bytes = await canvasToPngBytes(trimmedCanvas);

  return {
    id: assetId,
    sourceType: "type",
    bytes,
    mimeType: "image/png",
  };
}

export interface DrawStrokePoint {
  x: number;
  y: number;
}

/** Reusable stroke list → transparent PNG (for draw tab in Phase 119C). */
export async function createDrawnSignatureAssetFromStrokes(
  strokes: DrawStrokePoint[][],
  assetId: string,
  canvasWidth: number,
  canvasHeight: number,
): Promise<SignatureAsset> {
  assertBrowserCanvas();

  const canvas = createCanvas(canvasWidth, canvasHeight);
  const context = canvas.getContext("2d");
  if (!context) {
    throw new SignPdfError("UNSUPPORTED_SIGNATURE", "Canvas is not supported.");
  }

  context.clearRect(0, 0, canvasWidth, canvasHeight);
  context.lineCap = "round";
  context.lineJoin = "round";
  context.lineWidth = 2.5;
  context.strokeStyle = "#111111";

  let hasInk = false;

  for (const stroke of strokes) {
    if (stroke.length < 2) continue;
    hasInk = true;
    context.beginPath();
    context.moveTo(stroke[0].x, stroke[0].y);
    for (let index = 1; index < stroke.length; index += 1) {
      context.lineTo(stroke[index].x, stroke[index].y);
    }
    context.stroke();
  }

  if (!hasInk) {
    throw new SignPdfError("UNSUPPORTED_SIGNATURE", "Draw a signature before continuing.");
  }

  const trimmedCanvas = trimCanvasTransparentPadding(canvas);
  const bytes = await canvasToPngBytes(trimmedCanvas);

  return {
    id: assetId,
    sourceType: "draw",
    bytes,
    mimeType: "image/png",
  };
}

export async function createDrawnSignatureAssetFromCanvas(
  sourceCanvas: HTMLCanvasElement,
  assetId: string,
): Promise<SignatureAsset> {
  assertBrowserCanvas();

  const trimmedCanvas = trimCanvasTransparentPadding(sourceCanvas);
  const bytes = await canvasToPngBytes(trimmedCanvas);

  return {
    id: assetId,
    sourceType: "draw",
    bytes,
    mimeType: "image/png",
  };
}

export function createSignatureAssetFromBytes(
  bytes: Uint8Array,
  assetId: string,
  sourceType: SignatureSourceType,
  mimeType: "image/png" | "image/jpeg",
): SignatureAsset {
  if (bytes.byteLength === 0) {
    throw new SignPdfError("UNSUPPORTED_SIGNATURE", "Signature image is empty.");
  }

  if (bytes.byteLength > MAX_SIGNATURE_IMAGE_BYTES) {
    throw new SignPdfError(
      "UNSUPPORTED_SIGNATURE",
      "Signature image exceeds the size limit.",
    );
  }

  return { id: assetId, sourceType, bytes, mimeType };
}

function loadImageElement(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () =>
      reject(new SignPdfError("UNSUPPORTED_SIGNATURE", "Could not load signature image."));
    image.src = src;
  });
}

/**
 * Cleanup expectations (Phase 119B):
 * - Call URL.revokeObjectURL after loading uploaded images (handled here).
 * - UI layers should revoke preview object URLs on unmount via revokeObjectUrls().
 * - Avoid retaining large base64 data URLs; prefer Blob/Uint8Array until export.
 * - PDF bytes can be released when component state is cleared; export does not retain them.
 */
