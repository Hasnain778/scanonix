import { EXECUTABLE_EXTENSIONS } from "@/lib/scan/file/constants";
import type { FileAnalysisMatch } from "@/lib/scan/file/types";

export function analyzeFilename(fileName: string, mimeType: string, fileSize: number): FileAnalysisMatch[] {
  const matches: FileAnalysisMatch[] = [];
  const extension = fileName.split(".").pop()?.toLowerCase() ?? "";
  const lowerName = fileName.toLowerCase();

  if (EXECUTABLE_EXTENSIONS.has(extension)) {
    matches.push({
      id: "filename-executable-extension",
      category: "filename",
      severity: "critical",
      title: "Executable file extension detected",
      description: `Files with the .${extension} extension can execute code on a host system.`,
      whyItMatters: "Executable payloads are a common malware delivery vector.",
      evidence: `.${extension}`,
      recommendation: "Quarantine the file and verify its source before opening.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: "easy",
    });
  }

  if (/\.(pdf|docx?|xlsx?|jpg|png|gif)\.(exe|scr|bat|cmd|js)$/i.test(lowerName)) {
    matches.push({
      id: "filename-double-extension",
      category: "filename",
      severity: "critical",
      title: "Double extension filename detected",
      description: "The filename appears to disguise an executable as a document or image.",
      whyItMatters: "Double extensions are a common social-engineering malware tactic.",
      evidence: fileName,
      recommendation: "Block execution and inspect the file in an isolated environment.",
      confidence: "high",
      affectedResource: fileName,
      fixDifficulty: "easy",
    });
  }

  if (mimeType && /script|javascript|x-msdownload|x-dosexec/i.test(mimeType)) {
    matches.push({
      id: "filename-risky-mime",
      category: "filename",
      severity: "high",
      title: "Risky MIME type reported",
      description: `The file was identified as ${mimeType}.`,
      whyItMatters: "Script and executable MIME types can run automatically in some environments.",
      evidence: mimeType,
      recommendation: "Treat the file as untrusted and avoid executing it locally.",
      confidence: "medium",
      affectedResource: fileName,
      fixDifficulty: "easy",
    });
  }

  if (fileSize > 50 * 1024 * 1024) {
    matches.push({
      id: "filename-oversized",
      category: "filename",
      severity: "medium",
      title: "Unusually large file size",
      description: "The uploaded file exceeds 50 MB, which may indicate embedded payloads.",
      whyItMatters: "Large files can hide compressed malware or exfiltrated data.",
      evidence: `${fileSize} bytes`,
      recommendation: "Inspect archive contents and scan with additional sandbox tooling.",
      confidence: "medium",
      affectedResource: fileName,
      fixDifficulty: "moderate",
    });
  }

  return matches;
}
