/** File intelligence analysis limits. */
export const FILE_LIMITS = {
  /** Hard cap for in-memory analysis (bytes) */
  maxAnalysisBytes: 25 * 1024 * 1024,
  /** Maximum time budget for file analysis */
  analysisBudgetMs: 30_000,
  /** ZIP archive limits */
  maxZipEntries: 500,
  maxZipDepth: 3,
  maxZipTotalUncompressedBytes: 100 * 1024 * 1024,
  /** Zip bomb ratio threshold (uncompressed / compressed) */
  maxZipCompressionRatio: 100,
  /** Evidence snippet length */
  maxEvidenceLength: 280,
  /** Max matches per category */
  maxMatchesPerCategory: 8,
} as const;

export const SUPPORTED_EXTENSIONS = new Set([
  "pdf",
  "docx",
  "doc",
  "xlsx",
  "xls",
  "pptx",
  "ppt",
  "txt",
  "csv",
  "json",
  "xml",
  "html",
  "htm",
  "js",
  "mjs",
  "css",
  "zip",
  "png",
  "jpg",
  "jpeg",
  "gif",
  "svg",
]);

export const EXECUTABLE_EXTENSIONS = new Set([
  "exe",
  "bat",
  "cmd",
  "com",
  "scr",
  "vbs",
  "ps1",
  "msi",
  "dll",
  "js",
  "jar",
  "apk",
]);

export const SCRIPT_EXTENSIONS = new Set(["js", "mjs", "vbs", "ps1", "bat", "cmd"]);

export type FileAnalyzerCategory =
  | "file-metadata"
  | "pdf"
  | "office"
  | "archive"
  | "javascript"
  | "html"
  | "image"
  | "text"
  | "filename";

export type FileFormatFamily =
  | "pdf"
  | "office-open-xml"
  | "office-legacy"
  | "archive"
  | "javascript"
  | "html"
  | "image"
  | "text"
  | "css"
  | "unknown";
