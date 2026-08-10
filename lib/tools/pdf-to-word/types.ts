export type PdfToWordProgressPhase =
  | "reading"
  | "extracting"
  | "processing"
  | "creating"
  | "complete";

export type PdfToWordErrorCode =
  | "PASSWORD"
  | "CORRUPT"
  | "EMPTY"
  | "FAILURE";

export class PdfToWordError extends Error {
  readonly code: PdfToWordErrorCode;

  constructor(code: PdfToWordErrorCode, message: string) {
    super(message);
    this.name = "PdfToWordError";
    this.code = code;
  }
}

export type ContentBlock =
  | { type: "heading"; text: string; level: 1 | 2 | 3 }
  | { type: "paragraph"; text: string }
  | { type: "list"; items: string[]; ordered: boolean };

export interface PageContent {
  pageNumber: number;
  blocks: ContentBlock[];
  usedOcr: boolean;
}

export interface TextLine {
  text: string;
  y: number;
  fontSize: number;
}

export type PdfToWordProgressCallback = (
  phase: PdfToWordProgressPhase,
  detail?: { current?: number; total?: number },
) => void;

export function getPdfToWordProgressMessage(
  phase: PdfToWordProgressPhase,
  progress?: { current: number; total: number },
): string {
  switch (phase) {
    case "reading":
      return "Reading PDF…";
    case "extracting":
      return "Extracting text…";
    case "processing":
      if (progress) {
        return `Processing page ${progress.current} of ${progress.total}…`;
      }
      return "Processing pages…";
    case "creating":
      return "Creating Word document…";
    case "complete":
      return "Complete";
  }
}
