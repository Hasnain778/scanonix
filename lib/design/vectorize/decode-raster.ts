import sharp from "sharp";
import {
  VECTORIZE_MAX_BYTES,
  VECTORIZE_MAX_DIMENSION,
  VECTORIZE_MIN_DIMENSION,
  VectorizeError,
  type VectorizeInputMime,
} from "./types";

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const JPEG_SIG = Buffer.from([0xff, 0xd8, 0xff]);
const WEBP_RIFF = Buffer.from("RIFF");
const WEBP_WEBP = Buffer.from("WEBP");
const PDF_SIG = Buffer.from("%PDF");
const SVG_MARKERS = [Buffer.from("<svg"), Buffer.from("<?xml")];

export interface DecodedRaster {
  width: number;
  height: number;
  /** RGBA8 interleaved */
  data: Buffer;
  mimeType: VectorizeInputMime;
}

function startsWith(buf: Buffer, sig: Buffer, offset = 0): boolean {
  if (buf.length < offset + sig.length) return false;
  return sig.compare(buf, offset, offset + sig.length, 0, sig.length) === 0;
}

export function detectVectorizeMime(
  buffer: Buffer,
  fileName?: string,
  declaredType?: string,
): VectorizeInputMime | null {
  const lowerName = (fileName ?? "").toLowerCase();
  const declared = (declaredType ?? "").toLowerCase().split(";")[0]?.trim() ?? "";

  if (
    lowerName.endsWith(".svg") ||
    declared === "image/svg+xml" ||
    SVG_MARKERS.some((m) => bufIncludesAscii(buffer, m))
  ) {
    return null;
  }
  if (lowerName.endsWith(".pdf") || declared === "application/pdf" || startsWith(buffer, PDF_SIG)) {
    return null;
  }

  // Magic-byte detection only — extensions alone are not trusted.
  if (startsWith(buffer, PNG_SIG)) return "image/png";
  if (startsWith(buffer, JPEG_SIG)) return "image/jpeg";
  if (
    startsWith(buffer, WEBP_RIFF) &&
    buffer.length >= 12 &&
    startsWith(buffer, WEBP_WEBP, 8)
  ) {
    return "image/webp";
  }

  return null;
}

function bufIncludesAscii(buf: Buffer, needle: Buffer): boolean {
  const head = buf.subarray(0, Math.min(buf.length, 512)).toString("utf8").toLowerCase();
  return head.includes(needle.toString("utf8").toLowerCase());
}

/**
 * Flatten near-transparent pixels onto white so imagetracer does not invent
 * opaque black mats; real logo colors stay on a clean backdrop that we can
 * strip afterward when ignoreBackground is enabled.
 */
export function flattenTransparentOntoWhite(rgba: Buffer): Buffer {
  const out = Buffer.from(rgba);
  for (let i = 0; i < out.length; i += 4) {
    const a = out[i + 3]!;
    if (a >= 250) continue;
    if (a <= 8) {
      out[i] = 255;
      out[i + 1] = 255;
      out[i + 2] = 255;
      out[i + 3] = 255;
      continue;
    }
    const alpha = a / 255;
    out[i] = Math.round(out[i]! * alpha + 255 * (1 - alpha));
    out[i + 1] = Math.round(out[i + 1]! * alpha + 255 * (1 - alpha));
    out[i + 2] = Math.round(out[i + 2]! * alpha + 255 * (1 - alpha));
    out[i + 3] = 255;
  }
  return out;
}

export async function decodeRasterForVectorize(
  input: Buffer,
  fileName?: string,
  declaredType?: string,
): Promise<DecodedRaster> {
  if (!input || input.length === 0) {
    throw new VectorizeError("EMPTY_INPUT", "Image buffer is empty.");
  }
  if (input.length > VECTORIZE_MAX_BYTES) {
    throw new VectorizeError(
      "TOO_LARGE",
      `Image exceeds the ${Math.round(VECTORIZE_MAX_BYTES / (1024 * 1024))}MB prototype limit.`,
    );
  }

  const mimeType = detectVectorizeMime(input, fileName, declaredType);
  if (!mimeType) {
    throw new VectorizeError(
      "UNSUPPORTED_TYPE",
      "Unsupported image type. Use PNG, JPEG, or WebP (not SVG/PDF).",
    );
  }

  let decoded: { data: Buffer; info: { width: number; height: number } };
  try {
    decoded = await sharp(input, { failOn: "none" })
      .rotate()
      .ensureAlpha()
      .raw()
      .toBuffer({ resolveWithObject: true });
  } catch {
    throw new VectorizeError("INVALID_IMAGE", "Could not decode image.");
  }

  const width = decoded.info.width;
  const height = decoded.info.height;
  if (
    width < VECTORIZE_MIN_DIMENSION ||
    height < VECTORIZE_MIN_DIMENSION ||
    !Number.isFinite(width) ||
    !Number.isFinite(height)
  ) {
    throw new VectorizeError("INVALID_IMAGE", "Image has invalid dimensions.");
  }
  if (width > VECTORIZE_MAX_DIMENSION || height > VECTORIZE_MAX_DIMENSION) {
    throw new VectorizeError(
      "DIMENSIONS_TOO_LARGE",
      `Image exceeds ${VECTORIZE_MAX_DIMENSION}px on a side.`,
    );
  }

  return {
    width,
    height,
    data: decoded.data,
    mimeType,
  };
}
