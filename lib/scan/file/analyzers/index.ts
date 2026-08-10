import { analyzeCssFile, analyzeJavaScriptFile } from "@/lib/scan/file/analyzers/javascript";
import { analyzeHtmlFile } from "@/lib/scan/file/analyzers/html";
import { analyzeImageFile } from "@/lib/scan/file/analyzers/image";
import { analyzeOfficeLegacy, analyzeOfficeOpenXml } from "@/lib/scan/file/analyzers/office";
import { analyzePdf } from "@/lib/scan/file/analyzers/pdf";
import { analyzeGenericFile, analyzeTextFile } from "@/lib/scan/file/analyzers/text";
import { analyzeZipArchive } from "@/lib/scan/file/analyzers/zip";
import { isBudgetExceeded } from "@/lib/scan/file/metadata";
import type { FileAnalysisContext, FileAnalysisMatch } from "@/lib/scan/file/types";

export async function runFormatAnalyzers(
  context: FileAnalysisContext,
): Promise<{ matches: FileAnalysisMatch[]; extractedMetadata: Record<string, string | number | boolean | string[]> }> {
  const matches: FileAnalysisMatch[] = [];
  let extractedMetadata: Record<string, string | number | boolean | string[]> = {};
  const { metadata } = context;
  const ext = metadata.extension.toLowerCase();
  const family = metadata.formatFamily;

  if (isBudgetExceeded(context.budgetStartedAt)) {
    return { matches, extractedMetadata };
  }

  if (ext === "pdf" || family === "pdf") {
    matches.push(...(await analyzePdf(context)));
  }

  if (["docx", "xlsx", "pptx"].includes(ext) || family === "office-open-xml") {
    matches.push(...(await analyzeOfficeOpenXml(context)));
  }

  if (["doc", "xls", "ppt"].includes(ext) || family === "office-legacy") {
    matches.push(...analyzeOfficeLegacy(context));
  }

  if (ext === "zip" || (family === "archive" && ext === "zip")) {
    matches.push(...(await analyzeZipArchive(context)));
  }

  if (["js", "mjs"].includes(ext) || family === "javascript") {
    matches.push(...analyzeJavaScriptFile(context));
  }

  if (ext === "css" || family === "css") {
    matches.push(...analyzeCssFile(context));
  }

  if (["html", "htm"].includes(ext) || family === "html") {
    matches.push(...analyzeHtmlFile(context));
  }

  if (["png", "jpg", "jpeg", "gif", "svg"].includes(ext) || family === "image") {
    const image = analyzeImageFile(context);
    matches.push(...image.matches);
    extractedMetadata = { ...extractedMetadata, ...image.extractedMetadata };
  }

  if (["txt", "csv", "json", "xml"].includes(ext) || family === "text") {
    const text = analyzeTextFile(context);
    matches.push(...text.matches);
    extractedMetadata = { ...extractedMetadata, ...text.extractedMetadata };
  }

  matches.push(...analyzeGenericFile(context));

  return { matches, extractedMetadata };
}
