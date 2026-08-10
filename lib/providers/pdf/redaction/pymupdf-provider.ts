import { readFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { env, isPdfRedactionConfigured } from "@/config/env";
import { assertPdfBytes } from "@/lib/image/validate-binary";
import { loadPdfDocument, PdfLoadError } from "@/lib/pdf/core";
import {
  isVercelServerlessRuntime,
  resolveNativeProviderMode,
} from "@/lib/providers/runtime/production-guards";
import { runProcess, ProcessTimeoutError } from "@/lib/providers/pdf/shared/subprocess";
import { withTempWorkspace } from "@/lib/providers/pdf/shared/temp-workspace";
import type {
  PdfRedactionProvider,
  PdfRedactionRequest,
  PdfRedactionResult,
} from "./types";
import {
  PdfRedactionFailedError,
  PdfRedactionNotConfiguredError,
} from "./types";

const REDACTION_SCRIPT = join(process.cwd(), "scripts", "pdf_redact.py");
const DEFAULT_TIMEOUT_MS = 120_000;

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
        throw new PdfRedactionFailedError(
          "Password-protected PDFs are not supported for redaction.",
        );
      }
      throw new PdfRedactionFailedError(
        "Could not read this PDF. The file may be corrupt or unsupported.",
      );
    }
    throw new PdfRedactionFailedError(
      "Could not read this PDF. The file may be corrupt or unsupported.",
    );
  }
}

async function callPdfRedactionService(
  input: Buffer,
  areasJson: string,
): Promise<Buffer> {
  const serviceUrl = env.pdfRedactionServiceUrl;
  if (!serviceUrl) {
    throw new PdfRedactionNotConfiguredError();
  }

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(input)], { type: "application/pdf" }), "input.pdf");
  formData.append("areas", areasJson);

  const response = await fetch(serviceUrl, {
    method: "POST",
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `PDF redaction service returned ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function validateRedactionOutput(
  output: Buffer,
  inputPageCount: number,
  provider: string,
): Promise<PdfRedactionResult> {
  if (output.byteLength === 0) {
    throw new PdfRedactionFailedError("Redaction produced an empty file.");
  }

  try {
    assertPdfBytes(output);
  } catch {
    throw new PdfRedactionFailedError("Redaction produced an invalid PDF file.");
  }

  let outputPageCount: number;
  try {
    const pdfDoc = await PDFDocument.load(output, { ignoreEncryption: true });
    outputPageCount = pdfDoc.getPageCount();
  } catch {
    throw new PdfRedactionFailedError("Redaction produced a corrupt PDF file.");
  }

  if (outputPageCount !== inputPageCount) {
    throw new PdfRedactionFailedError(
      `Redaction changed page count (${inputPageCount} → ${outputPageCount}).`,
    );
  }

  return {
    output,
    inputPageCount,
    outputPageCount,
    provider,
  };
}

async function runLocalRedaction(
  request: PdfRedactionRequest,
  inputPageCount: number,
  areasJson: string,
): Promise<PdfRedactionResult> {
  if (isVercelServerlessRuntime()) {
    throw new PdfRedactionNotConfiguredError();
  }

  if (!env.pdfRedactionPython) {
    throw new PdfRedactionNotConfiguredError();
  }

  const timeoutMs = request.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  return withTempWorkspace(request.input, ".pdf", async (workspace) => {
    try {
      await runProcess({
        command: env.pdfRedactionPython,
        args: [
          REDACTION_SCRIPT,
          "--input",
          workspace.inputPath,
          "--output",
          workspace.outputPath,
          "--areas",
          areasJson,
        ],
        timeoutMs,
      });
    } catch (error) {
      if (error instanceof ProcessTimeoutError) {
        throw new PdfRedactionFailedError(
          "PDF redaction timed out. Try fewer pages or smaller regions.",
        );
      }

      const message =
        error instanceof Error ? error.message : "Secure PDF redaction failed.";

      throw new PdfRedactionFailedError(message);
    }

    let output: Buffer;
    try {
      output = await readFile(workspace.outputPath);
    } catch {
      throw new PdfRedactionFailedError(
        "Redaction did not produce an output file.",
      );
    }

    return validateRedactionOutput(output, inputPageCount, "pymupdf");
  });
}

export class PyMuPdfRedactionProvider implements PdfRedactionProvider {
  readonly name = "pymupdf";

  async isConfigured(): Promise<boolean> {
    if (!isPdfRedactionConfigured()) {
      return false;
    }

    const mode = resolveNativeProviderMode(
      env.pdfRedactionServiceUrl,
      env.pdfRedactionPython,
    );
    if (mode === "service") {
      return true;
    }

    try {
      await runProcess({
        command: env.pdfRedactionPython,
        args: ["-c", "import pymupdf"],
        timeoutMs: 15_000,
      });
      return true;
    } catch {
      return false;
    }
  }

  async redact(request: PdfRedactionRequest): Promise<PdfRedactionResult> {
    if (!isPdfRedactionConfigured()) {
      throw new PdfRedactionNotConfiguredError();
    }

    if (request.areas.length === 0) {
      throw new PdfRedactionFailedError("Select at least one area to redact.");
    }

    const inputPageCount = await getInputPageCount(request.input);
    if (inputPageCount === 0) {
      throw new PdfRedactionFailedError("This PDF contains no pages.");
    }

    const areasJson = JSON.stringify(request.areas);
    const mode = resolveNativeProviderMode(
      env.pdfRedactionServiceUrl,
      env.pdfRedactionPython,
    );

    if (mode === "service") {
      const output = await callPdfRedactionService(request.input, areasJson);
      return validateRedactionOutput(output, inputPageCount, "pdf-redaction-service");
    }

    return runLocalRedaction(request, inputPageCount, areasJson);
  }
}

let defaultProvider: PyMuPdfRedactionProvider | null = null;

export function getPdfRedactionProvider(): PdfRedactionProvider {
  if (!defaultProvider) {
    defaultProvider = new PyMuPdfRedactionProvider();
  }
  return defaultProvider;
}

export async function redactPdfWithProvider(
  request: PdfRedactionRequest,
): Promise<PdfRedactionResult> {
  const provider = getPdfRedactionProvider();
  const configured = await provider.isConfigured();
  if (!configured) {
    throw new PdfRedactionNotConfiguredError();
  }
  return provider.redact(request);
}
