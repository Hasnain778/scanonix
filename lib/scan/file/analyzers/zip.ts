import JSZip from "jszip";
import {
  EXECUTABLE_EXTENSIONS,
  FILE_LIMITS,
  SCRIPT_EXTENSIONS,
} from "@/lib/scan/file/constants";
import { truncateEvidence } from "@/lib/scan/file/metadata";
import type { FileAnalysisContext, FileAnalysisMatch } from "@/lib/scan/file/types";

const SUSPICIOUS_ZIP_NAME_PATTERNS = [
  /\.exe$/i,
  /\.dll$/i,
  /\.scr$/i,
  /\.bat$/i,
  /\.cmd$/i,
  /\.ps1$/i,
  /\.js$/i,
  /\.vbs$/i,
  /^\./,
  /\.\./,
  /__MACOSX/,
];

export async function analyzeZipArchive(
  context: FileAnalysisContext,
  depth = 0,
): Promise<FileAnalysisMatch[]> {
  const matches: FileAnalysisMatch[] = [];
  const { buffer, metadata } = context;

  if (depth > FILE_LIMITS.maxZipDepth) {
    matches.push({
      id: "zip-max-depth",
      category: "archive",
      severity: "high",
      title: "Nested archive depth limit exceeded",
      description: `Archive nesting exceeds ${FILE_LIMITS.maxZipDepth} levels.`,
      whyItMatters: "Deeply nested archives are used to evade scanners and hide payloads.",
      evidence: `Depth ${depth}`,
      recommendation: "Extract manually in an isolated environment with depth limits.",
      confidence: "high",
      affectedResource: metadata.fileName,
      fixDifficulty: "moderate",
    });
    return matches;
  }

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    matches.push({
      id: "zip-invalid",
      category: "archive",
      severity: "medium",
      title: "Invalid ZIP archive",
      description: "The file could not be parsed as a valid ZIP archive.",
      whyItMatters: "Malformed archives may crash extractors or hide malicious structure.",
      evidence: "JSZip parse failed",
      recommendation: "Inspect with a hardened archive tool before extraction.",
      confidence: "high",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
    return matches;
  }

  const entries = Object.values(zip.files).filter((entry) => !entry.dir);
  if (entries.length > FILE_LIMITS.maxZipEntries) {
    matches.push({
      id: "zip-too-many-entries",
      category: "archive",
      severity: "medium",
      title: "Archive contains excessive entries",
      description: `${entries.length} files exceed the ${FILE_LIMITS.maxZipEntries} entry analysis limit.`,
      whyItMatters: "Archives with thousands of files may be used for denial-of-service or evasion.",
      evidence: `${entries.length} entries`,
      recommendation: "Extract selectively and avoid full recursive expansion.",
      confidence: "high",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
  }

  const totalCompressed = buffer.length;
  let totalUncompressed = 0;

  for (const entry of entries.slice(0, FILE_LIMITS.maxZipEntries)) {
    const name = entry.name;

    if (SUSPICIOUS_ZIP_NAME_PATTERNS.some((pattern) => pattern.test(name))) {
      matches.push({
        id: `zip-suspicious-name-${name.slice(0, 20)}`,
        category: "archive",
        severity: "high",
        title: "Suspicious filename inside archive",
        description: `Potentially dangerous entry: ${name}`,
        whyItMatters: "Archives often disguise executables with misleading paths or double extensions.",
        evidence: truncateEvidence(name),
        recommendation: "Do not extract or execute suspicious entries.",
        confidence: "high",
        affectedResource: name,
        fixDifficulty: "easy",
      });
    }

    const ext = name.split(".").pop()?.toLowerCase() ?? "";
    if (EXECUTABLE_EXTENSIONS.has(ext)) {
      matches.push({
        id: "zip-executable",
        category: "archive",
        severity: "critical",
        title: "Executable file inside archive",
        description: `Archive contains executable: ${name}`,
        whyItMatters: "Executables in archives are a primary malware delivery vector.",
        evidence: name,
        recommendation: "Quarantine and scan extracted files in a sandbox.",
        confidence: "high",
        affectedResource: name,
        fixDifficulty: "easy",
      });
    }

    if (SCRIPT_EXTENSIONS.has(ext)) {
      matches.push({
        id: "zip-script",
        category: "archive",
        severity: "medium",
        title: "Script file inside archive",
        description: `Script entry detected: ${name}`,
        whyItMatters: "Scripts can execute automatically when extracted on some systems.",
        evidence: name,
        recommendation: "Review script contents before execution.",
        confidence: "high",
        affectedResource: name,
        fixDifficulty: "easy",
      });
    }

    if (ext === "zip" && depth < FILE_LIMITS.maxZipDepth) {
      try {
        const nested = await entry.async("nodebuffer");
        totalUncompressed += nested.length;
        const nestedMatches = await analyzeZipArchive(
          { ...context, buffer: nested, metadata: { ...metadata, fileName: name } },
          depth + 1,
        );
        matches.push(...nestedMatches);
      } catch {
        // Skip unreadable nested archive entry
      }
    }
  }

  if (totalCompressed > 0 && totalUncompressed > 0) {
    const ratio = totalUncompressed / totalCompressed;
    if (ratio > FILE_LIMITS.maxZipCompressionRatio) {
      matches.push({
        id: "zip-bomb-indicator",
        category: "archive",
        severity: "high",
        title: "Possible zip bomb detected",
        description: `Compression ratio ${ratio.toFixed(1)}:1 exceeds safe threshold.`,
        whyItMatters: "Zip bombs expand to exhaust disk or memory during extraction.",
        evidence: `${totalUncompressed} uncompressed / ${totalCompressed} compressed bytes`,
        recommendation: "Do not fully extract — inspect entries individually with limits.",
        confidence: "medium",
        affectedResource: metadata.fileName,
        fixDifficulty: "easy",
      });
    }
  }

  if (totalUncompressed > FILE_LIMITS.maxZipTotalUncompressedBytes) {
    matches.push({
      id: "zip-uncompressed-limit",
      category: "archive",
      severity: "high",
      title: "Archive uncompressed size exceeds limit",
      description: "Total uncompressed size may cause resource exhaustion.",
      whyItMatters: "Oversized uncompressed content is characteristic of archive bombs.",
      evidence: `${totalUncompressed} bytes uncompressed`,
      recommendation: "Avoid bulk extraction; use streaming inspection tools.",
      confidence: "high",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
  }

  return matches.slice(0, FILE_LIMITS.maxMatchesPerCategory);
}
