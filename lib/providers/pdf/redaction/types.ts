export interface RedactionArea {
  pageIndex: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PdfRedactionRequest {
  input: Buffer;
  areas: RedactionArea[];
  timeoutMs?: number;
}

export interface PdfRedactionResult {
  output: Buffer;
  inputPageCount: number;
  outputPageCount: number;
  provider: string;
}

export interface PdfRedactionProvider {
  readonly name: string;
  isConfigured(): Promise<boolean>;
  redact(request: PdfRedactionRequest): Promise<PdfRedactionResult>;
}

import { nativeProviderUnavailableMessage } from "@/lib/providers/runtime/production-guards";

export class PdfRedactionNotConfiguredError extends Error {
  readonly requiredRuntime: string;

  constructor(message?: string) {
    super(message ?? nativeProviderUnavailableMessage("Secure PDF redaction"));
    this.name = "PdfRedactionNotConfiguredError";
    this.requiredRuntime = "PyMuPDF (pymupdf) via PDF_REDACTION_PYTHON or PDF_REDACTION_SERVICE_URL";
  }
}

export class PdfRedactionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfRedactionFailedError";
  }
}
