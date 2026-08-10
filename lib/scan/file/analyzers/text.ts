import { FILE_LIMITS } from "@/lib/scan/file/constants";
import { truncateEvidence } from "@/lib/scan/file/metadata";
import type { FileAnalysisContext, FileAnalysisMatch } from "@/lib/scan/file/types";

export function analyzeTextFile(context: FileAnalysisContext): {
  matches: FileAnalysisMatch[];
  extractedMetadata: Record<string, string | number | boolean | string[]>;
} {
  const matches: FileAnalysisMatch[] = [];
  const extractedMetadata: Record<string, string | number | boolean | string[]> = {};
  const { metadata, textPreview } = context;
  const ext = metadata.extension.toLowerCase();

  if (ext === "json") {
    try {
      const parsed = JSON.parse(textPreview) as unknown;
      extractedMetadata.jsonValid = true;
      if (typeof parsed === "object" && parsed !== null) {
        extractedMetadata.jsonKeys = Object.keys(parsed as Record<string, unknown>).slice(0, 20);
      }
    } catch {
      matches.push({
        id: "text-invalid-json",
        category: "text",
        severity: "low",
        title: "Invalid JSON structure",
        description: "File extension is .json but content is not valid JSON.",
        whyItMatters: "Malformed JSON may break parsers or hide non-JSON payloads.",
        evidence: truncateEvidence(textPreview.slice(0, 80)),
        recommendation: "Validate JSON with a strict parser before processing.",
        confidence: "high",
        affectedResource: metadata.fileName,
        fixDifficulty: "easy",
      });
    }
  }

  if (ext === "xml" || ext === "html") {
    if (/<!ENTITY|<!DOCTYPE[^>]*\[/i.test(textPreview)) {
      matches.push({
        id: "text-xxe-indicator",
        category: "text",
        severity: "high",
        title: "XXE indicator in XML",
        description: "XML contains DOCTYPE/ENTITY declarations that may enable XXE.",
        whyItMatters: "External entity expansion can read local files or SSRF.",
        evidence: truncateEvidence(textPreview.match(/<!ENTITY|<!DOCTYPE[^>]*\[/i)?.[0] ?? ""),
        recommendation: "Disable external entities in XML parsers.",
        confidence: "medium",
        affectedResource: metadata.fileName,
        fixDifficulty: "moderate",
      });
    }
  }

  if (ext === "csv" && textPreview.length > 0) {
    const lines = textPreview.split(/\r?\n/).filter(Boolean);
    extractedMetadata.csvRows = Math.min(lines.length, 10000);
    extractedMetadata.csvColumns = (lines[0]?.split(",").length ?? 0);
  }

  if (/password|secret|api[_-]?key|token\s*=/i.test(textPreview)) {
    matches.push({
      id: "text-sensitive-content",
      category: "text",
      severity: "medium",
      title: "Sensitive keyword in text file",
      description: "Plaintext file contains credential or secret keywords.",
      whyItMatters: "Text files may accidentally store secrets in cleartext.",
      evidence: truncateEvidence(textPreview.match(/password|secret|api[_-]?key|token\s*=/i)?.[0] ?? ""),
      recommendation: "Remove secrets and rotate any exposed credentials.",
      confidence: "medium",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
  }

  return { matches: matches.slice(0, FILE_LIMITS.maxMatchesPerCategory), extractedMetadata };
}

export function analyzeGenericFile(context: FileAnalysisContext): FileAnalysisMatch[] {
  const matches: FileAnalysisMatch[] = [];
  if (!context.metadata.formatSupported) {
    matches.push({
      id: "file-unknown-format",
      category: "file-metadata",
      severity: "info",
      title: "Unknown or unsupported file format",
      description: "Metadata was extracted but no specialized analyzer matched this format.",
      whyItMatters: "Unsupported formats receive limited static analysis coverage.",
      evidence: `Extension .${context.metadata.extension || "none"}, detected ${context.metadata.detectedMimeType}`,
      recommendation: "Use format-specific tools for deeper inspection if needed.",
      confidence: "high",
      affectedResource: context.metadata.fileName,
      fixDifficulty: "easy",
    });
  }
  return matches;
}
