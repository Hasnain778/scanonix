import JSZip from "jszip";
import { EXECUTABLE_EXTENSIONS, FILE_LIMITS } from "@/lib/scan/file/constants";
import { truncateEvidence } from "@/lib/scan/file/metadata";
import type { FileAnalysisContext, FileAnalysisMatch } from "@/lib/scan/file/types";

const MACRO_PATHS = [
  "vbaProject.bin",
  "xl/vbaProject.bin",
  "ppt/vbaProject.bin",
  "word/vbaProject.bin",
];

const AUTO_OPEN_PATTERNS = [
  /autoopen/i,
  /document_open/i,
  /workbook_open/i,
  /auto_open/i,
];

export async function analyzeOfficeOpenXml(context: FileAnalysisContext): Promise<FileAnalysisMatch[]> {
  const matches: FileAnalysisMatch[] = [];
  const { buffer, metadata } = context;

  let zip: JSZip;
  try {
    zip = await JSZip.loadAsync(buffer);
  } catch {
    matches.push({
      id: "office-invalid-ooxml",
      category: "office",
      severity: "medium",
      title: "Invalid Office Open XML structure",
      description: "The file appears to be Office format but could not be parsed as ZIP/XML.",
      whyItMatters: "Corrupted or malformed Office files may be crafted to exploit parsers.",
      evidence: "JSZip parse failed",
      recommendation: "Open only in an updated Office suite with protected view enabled.",
      confidence: "high",
      affectedResource: metadata.fileName,
      fixDifficulty: "easy",
    });
    return matches;
  }

  for (const path of MACRO_PATHS) {
    if (zip.file(path)) {
      matches.push({
        id: "office-vba-macros",
        category: "office",
        severity: "high",
        title: "VBA macros detected",
        description: `Macro project file found: ${path}`,
        whyItMatters: "VBA macros are a common malware delivery mechanism in Office documents.",
        evidence: path,
        recommendation: "Disable macros and scan in an isolated environment before enabling.",
        confidence: "high",
        affectedResource: metadata.fileName,
        fixDifficulty: "moderate",
      });
      break;
    }
  }

  const relsFiles = Object.keys(zip.files).filter((name) => name.endsWith(".rels"));
  for (const relPath of relsFiles) {
    const content = await zip.file(relPath)?.async("string");
    if (!content) continue;
    if (/TargetMode\s*=\s*"External"/i.test(content) && /http/i.test(content)) {
      matches.push({
        id: "office-external-template",
        category: "office",
        severity: "medium",
        title: "External template link detected",
        description: "Document relationships reference an external HTTP resource.",
        whyItMatters: "External templates can pull remote content when the document opens.",
        evidence: truncateEvidence(content.match(/Target="[^"]+"/)?.[0] ?? relPath),
        recommendation: "Block external content and verify template sources.",
        confidence: "high",
        affectedResource: relPath,
        fixDifficulty: "moderate",
      });
      break;
    }
  }

  for (const [path, entry] of Object.entries(zip.files)) {
    if (entry.dir) continue;
    const ext = path.split(".").pop()?.toLowerCase() ?? "";
    if (EXECUTABLE_EXTENSIONS.has(ext)) {
      matches.push({
        id: "office-embedded-executable",
        category: "office",
        severity: "critical",
        title: "Embedded executable inside Office document",
        description: `Embedded file with executable extension: ${path}`,
        whyItMatters: "Office documents should not contain executable payloads.",
        evidence: path,
        recommendation: "Quarantine the file and do not enable macros or embedded content.",
        confidence: "high",
        affectedResource: path,
        fixDifficulty: "easy",
      });
      break;
    }
    if (/oleObject|activeX|embeddedPackage/i.test(path)) {
      matches.push({
        id: "office-ole-object",
        category: "office",
        severity: "medium",
        title: "OLE or ActiveX object detected",
        description: `Active content reference found: ${path}`,
        whyItMatters: "OLE/ActiveX objects can execute code or load external resources.",
        evidence: path,
        recommendation: "Open with macros disabled and inspect embedded objects.",
        confidence: "medium",
        affectedResource: path,
        fixDifficulty: "moderate",
      });
      break;
    }
  }

  const vbaData = await zip.file("word/vbaData.xml")?.async("string");
  const macroText = vbaData ?? context.textPreview;
  if (AUTO_OPEN_PATTERNS.some((pattern) => pattern.test(macroText))) {
    matches.push({
      id: "office-autoopen-macro",
      category: "office",
      severity: "high",
      title: "AutoOpen macro indicator",
      description: "AutoOpen or Document_Open style macro entry points were detected.",
      whyItMatters: "Auto-executing macros run without user interaction when enabled.",
      evidence: "AutoOpen/Document_Open pattern",
      recommendation: "Keep macros disabled unless the document source is fully trusted.",
      confidence: "medium",
      affectedResource: metadata.fileName,
      fixDifficulty: "moderate",
    });
  }

  return matches.slice(0, FILE_LIMITS.maxMatchesPerCategory);
}

export function analyzeOfficeLegacy(context: FileAnalysisContext): FileAnalysisMatch[] {
  const matches: FileAnalysisMatch[] = [];
  const raw = context.buffer.toString("latin1");

  if (/vbaProject|_VBA_PROJECT|Macros/i.test(raw)) {
    matches.push({
      id: "office-legacy-macros",
      category: "office",
      severity: "high",
      title: "Legacy Office macro indicators",
      description: "Binary Office file contains VBA/macro project signatures.",
      whyItMatters: "Legacy .doc/.xls/.ppt formats commonly deliver macro malware.",
      evidence: "VBA project signature in OLE compound file",
      recommendation: "Open in Protected View with macros disabled.",
      confidence: "high",
      affectedResource: context.metadata.fileName,
      fixDifficulty: "moderate",
    });
  }

  if (/Ole10Native|Package/i.test(raw)) {
    matches.push({
      id: "office-legacy-ole",
      category: "office",
      severity: "medium",
      title: "Embedded OLE object in legacy Office file",
      description: "OLE native packaging detected inside the compound document.",
      whyItMatters: "Embedded OLE objects can contain executables or scripts.",
      evidence: "Ole10Native/Package marker",
      recommendation: "Do not interact with embedded objects until scanned in isolation.",
      confidence: "medium",
      affectedResource: context.metadata.fileName,
      fixDifficulty: "moderate",
    });
  }

  return matches;
}
