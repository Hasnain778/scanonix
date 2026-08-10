export type PdfCompressionLevel = "low" | "medium" | "high";

export interface PdfCompressionRequest {
  input: Buffer;
  level: PdfCompressionLevel;
  timeoutMs?: number;
}

export interface PdfCompressionResult {
  output: Buffer;
  inputPageCount: number;
  outputPageCount: number;
  provider: string;
}

export interface PdfCompressionProvider {
  readonly name: string;
  isConfigured(): Promise<boolean>;
  compress(request: PdfCompressionRequest): Promise<PdfCompressionResult>;
}

import { nativeProviderUnavailableMessage } from "@/lib/providers/runtime/production-guards";

export class PdfCompressionNotConfiguredError extends Error {
  constructor(message?: string) {
    super(message ?? nativeProviderUnavailableMessage("PDF compression"));
    this.name = "PdfCompressionNotConfiguredError";
  }
}

export class PdfCompressionFailedError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "PdfCompressionFailedError";
  }
}

/** Map legacy UI level ids to provider levels. */
export function mapLegacyCompressionLevel(level: string): PdfCompressionLevel {
  switch (level) {
    case "light":
      return "low";
    case "strong":
      return "high";
    case "recommended":
    default:
      return "medium";
  }
}

export function compressionLevelToLegacy(level: PdfCompressionLevel): "light" | "recommended" | "strong" {
  switch (level) {
    case "low":
      return "light";
    case "high":
      return "strong";
    case "medium":
    default:
      return "recommended";
  }
}
