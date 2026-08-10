import { FILE_LIMITS } from "@/lib/scan/file/constants";
import { truncateEvidence } from "@/lib/scan/file/metadata";
import type { FileAnalysisContext, FileAnalysisMatch } from "@/lib/scan/file/types";

function readUInt32BE(buffer: Buffer, offset: number): number {
  return buffer.readUInt32BE(offset);
}

function analyzePng(buffer: Buffer, fileName: string): { matches: FileAnalysisMatch[]; meta: Record<string, string | number> } {
  const matches: FileAnalysisMatch[] = [];
  const meta: Record<string, string | number> = {};

  if (buffer.length >= 24 && buffer.toString("ascii", 0, 4) === "\x89PNG") {
    meta.width = readUInt32BE(buffer, 16);
    meta.height = readUInt32BE(buffer, 20);
  }

  let offset = 8;
  while (offset + 12 <= buffer.length) {
    const length = readUInt32BE(buffer, offset);
    const type = buffer.toString("ascii", offset + 4, offset + 8);
    const dataStart = offset + 8;
    const dataEnd = dataStart + length;
    if (dataEnd + 4 > buffer.length) break;

    if (type === "tEXt" || type === "iTXt" || type === "zTXt") {
      const chunk = buffer.subarray(dataStart, Math.min(dataEnd, dataStart + 200)).toString("utf8");
      meta[`png_${type}`] = truncateEvidence(chunk);
      if (/password|secret|token|author/i.test(chunk)) {
        matches.push({
          id: "image-png-sensitive-metadata",
          category: "image",
          severity: "low",
          title: "Sensitive text in PNG metadata",
          description: `PNG ${type} chunk contains potentially sensitive keywords.`,
          whyItMatters: "Images may leak credentials or internal notes via metadata chunks.",
          evidence: truncateEvidence(chunk),
          recommendation: "Strip metadata before publishing images.",
          confidence: "medium",
          affectedResource: fileName,
          fixDifficulty: "easy",
        });
      }
    }

    offset = dataEnd + 4;
  }

  return { matches, meta };
}

function analyzeJpeg(buffer: Buffer, fileName: string): { matches: FileAnalysisMatch[]; meta: Record<string, string | number> } {
  const matches: FileAnalysisMatch[] = [];
  const meta: Record<string, string | number> = {};

  if (buffer.length > 4 && buffer[0] === 0xff && buffer[1] === 0xd8) {
    meta.format = "jpeg";
  }

  const exifIndex = buffer.indexOf("Exif");
  if (exifIndex >= 0) {
    meta.hasExif = 1;
    const exifSnippet = buffer.subarray(exifIndex, Math.min(exifIndex + 120, buffer.length)).toString("latin1");
    if (/GPS/i.test(exifSnippet)) {
      matches.push({
        id: "image-gps-exif",
        category: "image",
        severity: "low",
        title: "GPS metadata indicator in EXIF",
        description: "JPEG EXIF data may contain GPS location information.",
        whyItMatters: "GPS metadata can expose physical locations when images are shared.",
        evidence: "EXIF GPS marker present",
        recommendation: "Remove EXIF GPS tags before external sharing.",
        confidence: "medium",
        affectedResource: fileName,
        fixDifficulty: "easy",
      });
    }
  }

  return { matches, meta };
}

function analyzeSvg(content: string, fileName: string): FileAnalysisMatch[] {
  const matches: FileAnalysisMatch[] = [];
  if (/<script/i.test(content)) {
    matches.push({
      id: "svg-script",
      category: "image",
      severity: "high",
      title: "Script element in SVG",
      description: "SVG contains embedded script tags.",
      whyItMatters: "SVG scripts execute in browser context and enable XSS.",
      evidence: truncateEvidence(content.match(/<script[^>]*>/i)?.[0] ?? "<script>"),
      recommendation: "Sanitize SVG or serve as attachment, not inline HTML.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: "moderate",
    });
  }
  if (/on\w+\s*=|javascript:/i.test(content)) {
    matches.push({
      id: "svg-event-handler",
      category: "image",
      severity: "medium",
      title: "Event handler or javascript: URL in SVG",
      description: "SVG uses inline event handlers or javascript: links.",
      whyItMatters: "Active content in SVG files can execute when rendered in browsers.",
      evidence: truncateEvidence(content.match(/on\w+\s*=|javascript:/i)?.[0] ?? ""),
      recommendation: "Remove active content from SVG before hosting.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: "moderate",
    });
  }
  return matches;
}

export function analyzeImageFile(context: FileAnalysisContext): {
  matches: FileAnalysisMatch[];
  extractedMetadata: Record<string, string | number | boolean | string[]>;
} {
  const matches: FileAnalysisMatch[] = [];
  const extractedMetadata: Record<string, string | number | boolean | string[]> = {};
  const { buffer, metadata } = context;
  const ext = metadata.extension.toLowerCase();

  if (ext === "png") {
    const png = analyzePng(buffer, metadata.fileName);
    matches.push(...png.matches);
    Object.assign(extractedMetadata, png.meta);
  } else if (["jpg", "jpeg"].includes(ext)) {
    const jpeg = analyzeJpeg(buffer, metadata.fileName);
    matches.push(...jpeg.matches);
    Object.assign(extractedMetadata, jpeg.meta);
  } else if (ext === "gif") {
    extractedMetadata.format = "gif";
    if (buffer.length >= 10) {
      extractedMetadata.width = buffer.readUInt16LE(6);
      extractedMetadata.height = buffer.readUInt16LE(8);
    }
  } else if (ext === "svg") {
    matches.push(...analyzeSvg(context.textPreview, metadata.fileName));
    extractedMetadata.format = "svg";
  }

  return { matches: matches.slice(0, FILE_LIMITS.maxMatchesPerCategory), extractedMetadata };
}
