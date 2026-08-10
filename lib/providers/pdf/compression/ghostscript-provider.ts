import { readFile } from "node:fs/promises";
import { PDFDocument } from "pdf-lib";
import { env, isGhostscriptConfigured } from "@/config/env";
import { assertPdfBytes } from "@/lib/image/validate-binary";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import {
  isVercelServerlessRuntime,
  resolveNativeProviderMode,
} from "@/lib/providers/runtime/production-guards";
import { runProcess, ProcessTimeoutError } from "@/lib/providers/pdf/shared/subprocess";
import { withTempWorkspace } from "@/lib/providers/pdf/shared/temp-workspace";
import type {
  PdfCompressionLevel,
  PdfCompressionProvider,
  PdfCompressionRequest,
  PdfCompressionResult,
} from "./types";
import {
  PdfCompressionFailedError,
  PdfCompressionNotConfiguredError,
} from "./types";

const DEFAULT_TIMEOUT_MS = 120_000;

const LEVEL_ARGS: Record<PdfCompressionLevel, string[]> = {
  low: [
    "-dPDFSETTINGS=/prepress",
    "-dColorImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleType=/Bicubic",
    "-dMonoImageDownsampleType=/Subsample",
    "-dColorImageResolution=300",
    "-dGrayImageResolution=300",
    "-dMonoImageResolution=1200",
  ],
  medium: [
    "-dPDFSETTINGS=/ebook",
    "-dColorImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleType=/Bicubic",
    "-dMonoImageDownsampleType=/Subsample",
    "-dColorImageResolution=150",
    "-dGrayImageResolution=150",
    "-dMonoImageResolution=600",
  ],
  high: [
    "-dPDFSETTINGS=/screen",
    "-dColorImageDownsampleType=/Bicubic",
    "-dGrayImageDownsampleType=/Bicubic",
    "-dMonoImageDownsampleType=/Subsample",
    "-dColorImageResolution=96",
    "-dGrayImageResolution=96",
    "-dMonoImageResolution=300",
  ],
};

async function getInputPageCount(input: Buffer): Promise<number> {
  const arrayBuffer = input.buffer.slice(
    input.byteOffset,
    input.byteOffset + input.byteLength,
  ) as ArrayBuffer;

  try {
    const pdfDoc = await loadPdfDocument(arrayBuffer);
    return pdfDoc.getPageCount();
  } catch (error) {
    if (error instanceof PdfLoadError) {
      if (error.code === "PASSWORD") {
        throw new PdfCompressionFailedError(
          "Password-protected PDFs are not supported for compression.",
        );
      }
      throw new PdfCompressionFailedError(
        "Could not read this PDF. The file may be corrupt or unsupported.",
      );
    }
    throw new PdfCompressionFailedError(
      "Could not read this PDF. The file may be corrupt or unsupported.",
    );
  }
}

function buildGhostscriptArgs(
  inputPath: string,
  outputPath: string,
  level: PdfCompressionLevel,
): string[] {
  return [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    "-dDetectDuplicateImages=true",
    "-dCompressFonts=true",
    "-dSubsetFonts=true",
    "-dEmbedAllFonts=true",
    "-dAutoRotatePages=/None",
    "-dPreserveMarkedContent=true",
    "-dPreserveOverprintSettings=true",
    "-dUseFlateCompression=true",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    ...LEVEL_ARGS[level],
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];
}

function isPasswordProtectedError(message: string): boolean {
  return /password|encrypted|needs a password|requires a password/i.test(message);
}

async function callPdfCompressionService(
  input: Buffer,
  level: PdfCompressionLevel,
): Promise<Buffer> {
  const serviceUrl = env.pdfCompressionServiceUrl;
  if (!serviceUrl) {
    throw new PdfCompressionNotConfiguredError();
  }

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(input)], { type: "application/pdf" }), "input.pdf");
  formData.append("level", level);

  const response = await fetch(serviceUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `PDF compression service returned ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function runLocalGhostscript(
  request: PdfCompressionRequest,
  inputPageCount: number,
): Promise<PdfCompressionResult> {
  if (isVercelServerlessRuntime()) {
    throw new PdfCompressionNotConfiguredError();
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return withTempWorkspace(request.input, ".pdf", async (workspace) => {
    try {
      await runProcess({
        command: env.ghostscriptBin,
        args: buildGhostscriptArgs(
          workspace.inputPath,
          workspace.outputPath,
          request.level,
        ),
        timeoutMs,
      });
    } catch (error) {
      if (error instanceof ProcessTimeoutError) {
        throw new PdfCompressionFailedError(
          "PDF compression timed out. Try a smaller file or a lighter compression level.",
        );
      }

      const message =
        error instanceof Error ? error.message : "Ghostscript compression failed.";

      if (isPasswordProtectedError(message)) {
        throw new PdfCompressionFailedError(
          "Password-protected PDFs are not supported for compression.",
        );
      }

      throw new PdfCompressionFailedError(message);
    }

    let output: Buffer;
    try {
      output = await readFile(workspace.outputPath);
    } catch {
      throw new PdfCompressionFailedError(
        "Compression did not produce an output file.",
      );
    }

    return validateCompressionOutput(output, inputPageCount, "ghostscript");
  });
}

async function validateCompressionOutput(
  output: Buffer,
  inputPageCount: number,
  provider: string,
): Promise<PdfCompressionResult> {
  if (output.byteLength === 0) {
    throw new PdfCompressionFailedError(
      "Compression produced an empty file.",
    );
  }

  try {
    assertPdfBytes(output);
  } catch {
    throw new PdfCompressionFailedError(
      "Compression produced an invalid PDF file.",
    );
  }

  let outputPageCount: number;
  try {
    const pdfDoc = await PDFDocument.load(output, { ignoreEncryption: true });
    outputPageCount = pdfDoc.getPageCount();
  } catch {
    throw new PdfCompressionFailedError(
      "Compression produced a corrupt PDF file.",
    );
  }

  if (outputPageCount !== inputPageCount) {
    throw new PdfCompressionFailedError(
      `Compression changed page count (${inputPageCount} → ${outputPageCount}).`,
    );
  }

  return {
    output,
    inputPageCount,
    outputPageCount,
    provider,
  };
}

export class GhostscriptPdfCompressionProvider implements PdfCompressionProvider {
  readonly name = "ghostscript";

  async isConfigured(): Promise<boolean> {
    if (!isGhostscriptConfigured()) {
      return false;
    }

    const mode = resolveNativeProviderMode(
      env.pdfCompressionServiceUrl,
      env.ghostscriptBin,
    );
    if (mode === "service") {
      return true;
    }

    try {
      await runProcess({
        command: env.ghostscriptBin,
        args: ["--version"],
        timeoutMs: 10_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async compress(request: PdfCompressionRequest): Promise<PdfCompressionResult> {
    if (!isGhostscriptConfigured()) {
      throw new PdfCompressionNotConfiguredError();
    }

    const inputPageCount = await getInputPageCount(request.input);
    if (inputPageCount === 0) {
      throw new PdfCompressionFailedError(
        "This PDF contains no pages to compress.",
      );
    }

    const mode = resolveNativeProviderMode(
      env.pdfCompressionServiceUrl,
      env.ghostscriptBin,
    );

    if (mode === "service") {
      const output = await callPdfCompressionService(request.input, request.level);
      return validateCompressionOutput(output, inputPageCount, "pdf-compression-service");
    }

    return runLocalGhostscript(request, inputPageCount);
  }
}

let defaultProvider: GhostscriptPdfCompressionProvider | null = null;

export function getPdfCompressionProvider(): PdfCompressionProvider {
  if (!defaultProvider) {
    defaultProvider = new GhostscriptPdfCompressionProvider();
  }
  return defaultProvider;
}

export async function compressPdfWithProvider(
  request: PdfCompressionRequest,
): Promise<PdfCompressionResult> {
  const provider = getPdfCompressionProvider();
  const configured = await provider.isConfigured();
  if (!configured) {
    throw new PdfCompressionNotConfiguredError();
  }
  return provider.compress(request);
}
