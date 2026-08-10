import { PDFDocument } from "pdf-lib";
import { FILE_LIMITS } from "@/lib/scan/file/constants";
import { truncateEvidence } from "@/lib/scan/file/metadata";
import type { FileAnalysisContext, FileAnalysisMatch } from "@/lib/scan/file/types";

const PDF_PATTERNS: { id: string; title: string; pattern: RegExp; severity: FileAnalysisMatch["severity"]; why: string; rec: string }[] = [
  { id: "pdf-javascript", title: "Embedded JavaScript in PDF", pattern: /\/JavaScript|\/JS\b/i, severity: "high", why: "PDF JavaScript can execute when the document is opened.", rec: "Remove JavaScript actions or open in a sandboxed PDF viewer." },
  { id: "pdf-open-action", title: "PDF OpenAction detected", pattern: /\/OpenAction/i, severity: "high", why: "OpenAction runs automatically when the PDF is opened.", rec: "Review and remove automatic actions before distribution." },
  { id: "pdf-launch-action", title: "PDF Launch action detected", pattern: /\/Launch/i, severity: "critical", why: "Launch actions can execute external programs.", rec: "Do not open — remove launch actions from the document." },
  { id: "pdf-embedded-file", title: "Embedded files in PDF", pattern: /\/EmbeddedFile|\/EmbeddedFiles/i, severity: "medium", why: "Embedded files may conceal additional payloads.", rec: "Extract and scan embedded attachments separately." },
  { id: "pdf-acroform", title: "PDF interactive forms detected", pattern: /\/AcroForm/i, severity: "low", why: "Forms can capture data or trigger submit actions.", rec: "Verify form submit destinations are trusted." },
  { id: "pdf-hidden-object", title: "Hidden or invisible PDF objects", pattern: /\/Hidden\s+true|\/Invisible\s+true/i, severity: "medium", why: "Hidden objects may conceal content from casual review.", rec: "Inspect hidden layers and annotations manually." },
];

export async function analyzePdf(context: FileAnalysisContext): Promise<FileAnalysisMatch[]> {
  const matches: FileAnalysisMatch[] = [];
  const { buffer, metadata } = context;
  const raw = buffer.toString("latin1");

  for (const rule of PDF_PATTERNS) {
    if (!rule.pattern.test(raw)) continue;
    matches.push({
      id: rule.id,
      category: "pdf",
      severity: rule.severity,
      title: rule.title,
      description: `${rule.title} was identified in the PDF structure.`,
      whyItMatters: rule.why,
      evidence: truncateEvidence(raw.match(rule.pattern)?.[0] ?? rule.title),
      recommendation: rule.rec,
      confidence: "high",
      affectedResource: metadata.fileName,
      fixDifficulty: "moderate",
    });
  }

  if (/\/Encrypt/i.test(raw)) {
    matches.push({
      id: "pdf-encrypted",
      category: "pdf",
      severity: "low",
      title: "PDF encryption detected",
      description: "The PDF is encrypted or password-protected.",
      whyItMatters: "Encrypted PDFs limit inspection and may hide malicious content.",
      evidence: "/Encrypt dictionary present",
      recommendation: "Decrypt in a safe environment and re-scan contents.",
      confidence: "high",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
  }

  try {
    await PDFDocument.load(buffer, { ignoreEncryption: true });
  } catch {
    matches.push({
      id: "pdf-password-protected",
      category: "pdf",
      severity: "medium",
      title: "PDF may be password protected",
      description: "The PDF could not be fully parsed — it may require a password.",
      whyItMatters: "Password protection prevents complete static analysis of embedded content.",
      evidence: "pdf-lib parse failed with encryption",
      recommendation: "Supply password in a controlled environment for deeper inspection.",
      confidence: "medium",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
  }

  const suspiciousMeta = raw.match(/\/(?:Title|Author|Subject|Keywords)\s*\(([^)]{0,120})\)/i);
  if (suspiciousMeta && /password|login|invoice|urgent|wire/i.test(suspiciousMeta[0])) {
    matches.push({
      id: "pdf-suspicious-metadata",
      category: "pdf",
      severity: "low",
      title: "Suspicious PDF metadata",
      description: "Document metadata contains social-engineering keywords.",
      whyItMatters: "Phishing PDFs often use urgent or credential-related metadata.",
      evidence: truncateEvidence(suspiciousMeta[0]),
      recommendation: "Verify sender and document origin before opening.",
      confidence: "medium",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
  }

  return matches.slice(0, FILE_LIMITS.maxMatchesPerCategory);
}
