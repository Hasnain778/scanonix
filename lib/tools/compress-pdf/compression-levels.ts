export type CompressionLevel = "light" | "recommended" | "strong";

export type CompressProgressPhase =
  | "reading"
  | "uploading"
  | "compressing"
  | "finalising"
  | "complete";

export type PdfCompressionErrorCode =
  | "PASSWORD"
  | "CORRUPT"
  | "TOO_LARGE"
  | "FAILURE"
  | "NO_SAVINGS";

export class PdfCompressionError extends Error {
  readonly code: PdfCompressionErrorCode;

  constructor(code: PdfCompressionErrorCode, message: string) {
    super(message);
    this.name = "PdfCompressionError";
    this.code = code;
  }
}

export interface CompressionLevelSettings {
  label: string;
  description: string;
  useObjectStreams: boolean;
  stripMetadata: boolean;
  /** Conservative estimate for UI hints only — actual savings vary by PDF structure. */
  estimateRatio: number;
}

export const COMPRESSION_LEVELS: Record<
  CompressionLevel,
  CompressionLevelSettings
> = {
  light: {
    label: "Light compression",
    description: "Gentle optimization that preserves document structure and quality (free)",
    useObjectStreams: false,
    stripMetadata: false,
    estimateRatio: 0.9,
  },
  recommended: {
    label: "Recommended compression",
    description: "Stronger structural optimization for most PDFs (Pro)",
    useObjectStreams: true,
    stripMetadata: false,
    estimateRatio: 0.75,
  },
  strong: {
    label: "Strong compression",
    description: "Maximum available optimization, including metadata removal where applicable (Pro)",
    useObjectStreams: true,
    stripMetadata: true,
    estimateRatio: 0.6,
  },
};

/** Server-side Ghostscript compression via /api/tools/pdf/compress. */
export const PDF_COMPRESSION_ENGINE_LIMITATION =
  "PDF compression runs on the server with Ghostscript. It preserves selectable text and vector content while recompressing embedded images. Actual size reduction varies by PDF structure.";

export const LARGE_PDF_BYTES = 80 * 1024 * 1024;
export const LARGE_PDF_PAGES = 150;

export function estimateCompressedSize(
  originalSize: number,
  level: CompressionLevel,
): number {
  return Math.round(originalSize * COMPRESSION_LEVELS[level].estimateRatio);
}

export function getCompressProgressMessage(
  phase: CompressProgressPhase,
  detail?: { current?: number; total?: number },
): string {
  switch (phase) {
    case "reading":
      return "Reading PDF…";
    case "uploading":
      return "Uploading PDF…";
    case "compressing":
      if (detail?.current && detail?.total) {
        return `Compressing PDF (${detail.current}/${detail.total})…`;
      }
      return "Compressing PDF on server…";
    case "finalising":
      return "Finalising…";
    case "complete":
      return "Complete";
  }
}

export function calculateSavingsPercent(
  originalSize: number,
  compressedSize: number,
): number {
  if (originalSize <= 0) return 0;
  return Math.max(0, Math.round((1 - compressedSize / originalSize) * 100));
}

function isPasswordProtectedPdfError(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const maybeError = error as { name?: string; message?: string };
  return (
    maybeError.name === "PasswordException" ||
    /password/i.test(maybeError.message ?? "")
  );
}

export { isPasswordProtectedPdfError };
