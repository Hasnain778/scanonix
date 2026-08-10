import type { CompressionLevel } from "./compression-levels";
import { PdfCompressionError } from "./compression-levels";

export type CompressProgressPhase = "uploading" | "compressing" | "complete";

export interface CompressPdfClientOptions {
  file: File;
  level: CompressionLevel;
  onProgress?: (phase: CompressProgressPhase) => void;
}

export async function compressPdfViaServer(
  options: CompressPdfClientOptions,
): Promise<Blob> {
  const { file, level, onProgress } = options;

  onProgress?.("uploading");

  const formData = new FormData();
  formData.append("file", file);
  formData.append("level", level);

  onProgress?.("compressing");

  const response = await fetch("/api/tools/pdf/compress", {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    let message = "PDF compression failed. Please try again.";
    try {
      const payload = (await response.json()) as { error?: string; code?: string };
      if (payload.error) {
        message = payload.error;
      }
      if (payload.code === "NOT_CONFIGURED") {
        throw new PdfCompressionError("FAILURE", message);
      }
      if (payload.code === "PRO_REQUIRED") {
        throw new PdfCompressionError("FAILURE", message);
      }
      if (payload.code === "TOO_LARGE") {
        throw new PdfCompressionError("TOO_LARGE", message);
      }
    } catch (error) {
      if (error instanceof PdfCompressionError) {
        throw error;
      }
    }

    throw new PdfCompressionError("FAILURE", message);
  }

  const contentType = response.headers.get("Content-Type") ?? "";
  if (!contentType.includes("application/pdf")) {
    throw new PdfCompressionError(
      "FAILURE",
      "Compression did not return a valid PDF.",
    );
  }

  const blob = await response.blob();
  if (blob.size === 0) {
    throw new PdfCompressionError(
      "FAILURE",
      "Compression produced an empty file.",
    );
  }

  onProgress?.("complete");
  return blob;
}
