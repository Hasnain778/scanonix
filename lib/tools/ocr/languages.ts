export type OcrLanguageCode =
  | "eng"
  | "spa"
  | "fra"
  | "deu"
  | "por"
  | "ita"
  | "ara"
  | "urd";

export interface OcrLanguageOption {
  label: string;
  code: OcrLanguageCode;
}

export const OCR_LANGUAGES: OcrLanguageOption[] = [
  { label: "English", code: "eng" },
  { label: "Spanish", code: "spa" },
  { label: "French", code: "fra" },
  { label: "German", code: "deu" },
  { label: "Portuguese", code: "por" },
  { label: "Italian", code: "ita" },
  { label: "Arabic", code: "ara" },
  { label: "Urdu", code: "urd" },
];

export type OcrProgressPhase =
  | "preparing"
  | "reading"
  | "processing"
  | "complete";

export type OcrErrorCode =
  | "UNSUPPORTED"
  | "EMPTY_IMAGE"
  | "OCR_FAILURE"
  | "PASSWORD_PDF";

export class OcrExtractionError extends Error {
  readonly code: OcrErrorCode;

  constructor(code: OcrErrorCode, message: string) {
    super(message);
    this.name = "OcrExtractionError";
    this.code = code;
  }
}

export function getOcrProgressMessage(
  phase: OcrProgressPhase,
  detail?: { current?: number; total?: number },
): string {
  switch (phase) {
    case "preparing":
      return "Preparing file…";
    case "reading":
      return "Reading text…";
    case "processing":
      if (detail?.current && detail?.total) {
        return `Processing page ${detail.current} of ${detail.total}…`;
      }
      return "Processing…";
    case "complete":
      return "Complete";
  }
}
