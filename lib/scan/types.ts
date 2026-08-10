import type { ScanTargetType } from "@/lib/scan-history/types";

export class ScanRunnerError extends Error {
  readonly code: "invalid_target" | "network" | "timeout" | "unsupported";

  constructor(
    code: ScanRunnerError["code"],
    message: string,
  ) {
    super(message);
    this.name = "ScanRunnerError";
    this.code = code;
  }
}

export interface RunWebsiteScanInput {
  scanId: string;
  target: string;
}

export interface RunFileScanInput {
  scanId: string;
  fileName: string;
  fileSize: number;
  mimeType?: string;
  fileBuffer: Buffer;
  lastModified?: number | null;
  maxUploadBytes: number;
}

export interface RunScanRequest {
  scanId: string;
  targetType: ScanTargetType;
  target?: string;
  fileName?: string;
  fileSize?: number;
  mimeType?: string;
}
