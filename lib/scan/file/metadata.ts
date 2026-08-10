import { createHash } from "node:crypto";
import {
  FILE_LIMITS,
  SUPPORTED_EXTENSIONS,
  type FileFormatFamily,
} from "@/lib/scan/file/constants";
import type { FileMetadata } from "@/lib/scan/file/types";

const MAGIC_SIGNATURES: { mime: string; family: FileFormatFamily; magic: number[]; offset?: number }[] = [
  { mime: "application/pdf", family: "pdf", magic: [0x25, 0x50, 0x44, 0x46] },
  { mime: "application/zip", family: "archive", magic: [0x50, 0x4b, 0x03, 0x04] },
  { mime: "application/zip", family: "archive", magic: [0x50, 0x4b, 0x05, 0x06] },
  { mime: "application/x-ole-storage", family: "office-legacy", magic: [0xd0, 0xcf, 0x11, 0xe0] },
  { mime: "image/png", family: "image", magic: [0x89, 0x50, 0x4e, 0x47] },
  { mime: "image/jpeg", family: "image", magic: [0xff, 0xd8, 0xff] },
  { mime: "image/gif", family: "image", magic: [0x47, 0x49, 0x46, 0x38] },
];

function matchesMagic(buffer: Buffer, magic: number[], offset = 0): boolean {
  if (buffer.length < offset + magic.length) return false;
  return magic.every((byte, index) => buffer[offset + index] === byte);
}

export function detectFormatFromBuffer(buffer: Buffer, extension: string): {
  detectedMimeType: string;
  formatFamily: FileFormatFamily;
} {
  for (const signature of MAGIC_SIGNATURES) {
    if (matchesMagic(buffer, signature.magic, signature.offset ?? 0)) {
      if (signature.family === "archive") {
        const ext = extension.toLowerCase();
        if (["docx", "xlsx", "pptx"].includes(ext)) {
          const mimeByExt: Record<string, string> = {
            docx: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            xlsx: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
            pptx: "application/vnd.openxmlformats-officedocument.presentationml.presentation",
          };
          return {
            detectedMimeType: mimeByExt[ext] ?? signature.mime,
            formatFamily: "office-open-xml",
          };
        }
        if (ext === "zip") {
          return { detectedMimeType: signature.mime, formatFamily: "archive" };
        }
        return { detectedMimeType: signature.mime, formatFamily: "office-open-xml" };
      }
      return { detectedMimeType: signature.mime, formatFamily: signature.family };
    }
  }

  const ext = extension.toLowerCase();
  if (["html", "htm"].includes(ext)) {
    return { detectedMimeType: "text/html", formatFamily: "html" };
  }
  if (["js", "mjs"].includes(ext)) {
    return { detectedMimeType: "application/javascript", formatFamily: "javascript" };
  }
  if (ext === "css") {
    return { detectedMimeType: "text/css", formatFamily: "css" };
  }
  if (["txt", "csv", "json", "xml"].includes(ext)) {
    return { detectedMimeType: "text/plain", formatFamily: "text" };
  }
  if (ext === "svg") {
    return { detectedMimeType: "image/svg+xml", formatFamily: "image" };
  }

  return { detectedMimeType: "application/octet-stream", formatFamily: "unknown" };
}

export function extractExtension(fileName: string): string {
  const parts = fileName.split(".");
  if (parts.length < 2) return "";
  return (parts.pop() ?? "").toLowerCase();
}

export function buildFileMetadata(params: {
  fileName: string;
  fileSize: number;
  mimeType?: string;
  buffer: Buffer;
  lastModified?: number | null;
}): FileMetadata {
  const extension = extractExtension(params.fileName);
  const { detectedMimeType, formatFamily } = detectFormatFromBuffer(params.buffer, extension);
  const sha256 = createHash("sha256").update(params.buffer).digest("hex");
  const md5 = createHash("md5").update(params.buffer).digest("hex");

  return {
    fileName: params.fileName,
    extension,
    mimeType: params.mimeType?.trim() || "application/octet-stream",
    detectedMimeType,
    sizeBytes: params.fileSize,
    sha256,
    md5,
    uploadedAt: new Date().toISOString(),
    lastModified:
      params.lastModified && params.lastModified > 0
        ? new Date(params.lastModified).toISOString()
        : null,
    formatFamily,
    formatSupported: SUPPORTED_EXTENSIONS.has(extension),
  };
}

export function truncateEvidence(value: string): string {
  const trimmed = value.trim();
  if (trimmed.length <= FILE_LIMITS.maxEvidenceLength) return trimmed;
  return `${trimmed.slice(0, FILE_LIMITS.maxEvidenceLength - 1)}…`;
}

export function bufferToTextPreview(buffer: Buffer, maxBytes = 512 * 1024): string {
  const slice = buffer.subarray(0, Math.min(buffer.length, maxBytes));
  return slice.toString("utf8");
}

export function isBudgetExceeded(startedAt: number): boolean {
  return Date.now() - startedAt > FILE_LIMITS.analysisBudgetMs;
}

export function isMostlyText(buffer: Buffer): boolean {
  const sample = buffer.subarray(0, Math.min(buffer.length, 4096));
  let nonPrintable = 0;
  for (const byte of sample) {
    if (byte === 9 || byte === 10 || byte === 13) continue;
    if (byte < 32 || byte > 126) nonPrintable += 1;
  }
  return nonPrintable / Math.max(sample.length, 1) < 0.15;
}
