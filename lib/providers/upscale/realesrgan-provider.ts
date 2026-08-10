import { readFile } from "node:fs/promises";
import sharp from "sharp";
import { env, isRealEsrganConfigured } from "@/config/env";
import { assertBufferMatchesFormat } from "@/lib/image/validate-binary";
import {
  isVercelServerlessRuntime,
  nativeProviderUnavailableMessage,
  resolveNativeProviderMode,
} from "@/lib/providers/runtime/production-guards";
import { runProcess, ProcessTimeoutError } from "@/lib/providers/pdf/shared/subprocess";
import { withTempWorkspace } from "@/lib/providers/pdf/shared/temp-workspace";
import type { UpscaleOptions, UpscaleProvider, UpscaleResult } from "./types";
import { buildRealEsrganServiceAuthHeaders, readRealEsrganServiceUrl } from "./realesrgan-service-auth";

const SERVICE_TIMEOUT_MS = 280_000;
const LOCAL_PROCESS_TIMEOUT_MS = 280_000;
const MAX_DIMENSION = 16_384;
const MAX_INPUT_PIXELS = 4_000_000;

export class RealEsrganNotConfiguredError extends Error {
  constructor(message?: string) {
    super(message ?? nativeProviderUnavailableMessage("Image upscaling"));
    this.name = "RealEsrganNotConfiguredError";
  }
}

function resolveInputExtension(format: string | undefined): string {
  if (format === "png") return "png";
  if (format === "webp") return "webp";
  return "jpg";
}

function outputFormatForInput(hasAlpha: boolean): "png" | "jpg" {
  return hasAlpha ? "png" : "jpg";
}

async function callServiceUpscale(
  input: Buffer,
  options: UpscaleOptions,
  mimeType: string,
): Promise<Buffer> {
  const serviceUrl = readRealEsrganServiceUrl();
  if (!serviceUrl) {
    throw new RealEsrganNotConfiguredError();
  }

  const authHeaders = buildRealEsrganServiceAuthHeaders();
  if (isVercelServerlessRuntime() && !authHeaders.Authorization) {
    throw new RealEsrganNotConfiguredError(
      "Image upscaling worker authentication is not configured. Set REALESRGAN_SERVICE_SECRET on Vercel to match REALESRGAN_WORKER_SECRET on the worker.",
    );
  }

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(input)], { type: mimeType }), "input.bin");
  formData.append("scale", String(options.factor));
  if (options.tileSize) {
    formData.append("tile", String(options.tileSize));
  }

  const controller = new AbortController();
  const timeoutHandle = setTimeout(() => controller.abort(), SERVICE_TIMEOUT_MS);

  let response: Response;
  try {
    response = await fetch(serviceUrl, {
      method: "POST",
      headers: authHeaders,
      body: formData,
      signal: controller.signal,
    });
  } catch (error) {
    if (error instanceof Error && error.name === "AbortError") {
      throw new Error("Real-ESRGAN upscaling timed out. Try a smaller image or 2× scale.");
    }
    throw error;
  } finally {
    clearTimeout(timeoutHandle);
  }

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    if (response.status === 504 || text.toLowerCase().includes("timed out")) {
      throw new Error("Real-ESRGAN upscaling timed out. Try a smaller image or 2× scale.");
    }
    throw new Error(text || `Real-ESRGAN service returned ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function runNcnnVulkanUpscale(
  input: Buffer,
  options: UpscaleOptions,
  inputFormat: string | undefined,
  outputFormat: "png" | "jpg",
): Promise<Buffer> {
  if (isVercelServerlessRuntime()) {
    throw new RealEsrganNotConfiguredError();
  }

  if (!env.realesrganBin) {
    throw new RealEsrganNotConfiguredError();
  }

  const ext = resolveInputExtension(inputFormat);
  const modelName = env.realesrganModel || "realesrgan-x4plus";
  const modelDir = env.realesrganModelDir || "models";

  return withTempWorkspace(input, `.${ext}`, async (workspace) => {
    const outputPath = workspace.outputPath.replace(/\.[^.]+$/, `.${outputFormat}`);

    const args = [
      "-i",
      workspace.inputPath,
      "-o",
      outputPath,
      "-n",
      modelName,
      "-m",
      modelDir,
      "-s",
      String(options.factor),
      "-f",
      outputFormat,
    ];

    if (env.realesrganGpuId !== "") {
      args.push("-g", env.realesrganGpuId);
    }

    const tileSize = options.tileSize ?? 0;
    if (tileSize > 0) {
      args.push("-t", String(tileSize));
    }

    try {
      await runProcess({
        command: env.realesrganBin,
        args,
        timeoutMs: LOCAL_PROCESS_TIMEOUT_MS,
      });
    } catch (error) {
      if (error instanceof ProcessTimeoutError) {
        throw new Error("Real-ESRGAN upscaling timed out. Try a smaller image.");
      }
      throw error;
    }

    return readFile(outputPath);
  });
}

async function validateUpscaleOutput(
  input: Buffer,
  output: Buffer,
  factor: UpscaleOptions["factor"],
  preserveAlpha: boolean,
): Promise<UpscaleResult> {
  const inputMeta = await sharp(input, { failOn: "none" }).metadata();
  const outputMeta = await sharp(output, { failOn: "none" }).metadata();

  const originalWidth = inputMeta.width ?? 0;
  const originalHeight = inputMeta.height ?? 0;
  const width = outputMeta.width ?? 0;
  const height = outputMeta.height ?? 0;

  if (originalWidth <= 0 || originalHeight <= 0 || width <= 0 || height <= 0) {
    throw new Error("Could not validate upscaled image dimensions.");
  }

  const expectedWidth = originalWidth * factor;
  const expectedHeight = originalHeight * factor;

  if (Math.abs(width - expectedWidth) > 2 || Math.abs(height - expectedHeight) > 2) {
    throw new Error(
      `Upscaled dimensions mismatch: expected ${expectedWidth}×${expectedHeight}, got ${width}×${height}.`,
    );
  }

  if (width > MAX_DIMENSION || height > MAX_DIMENSION) {
    throw new Error("Upscaled image exceeds the maximum supported dimensions.");
  }

  const hasAlpha = preserveAlpha && Boolean(inputMeta.hasAlpha);
  const format: "png" | "jpeg" = hasAlpha ? "png" : "jpeg";

  let finalBuffer = output;
  if (format === "jpeg" && outputMeta.format === "png") {
    finalBuffer = await sharp(output).flatten({ background: "#ffffff" }).jpeg({ quality: 92 }).toBuffer();
    assertBufferMatchesFormat(finalBuffer, "jpg");
  } else if (format === "png") {
    if (outputMeta.format !== "png") {
      finalBuffer = await sharp(output).png({ compressionLevel: 6 }).toBuffer();
    }
    assertBufferMatchesFormat(finalBuffer, "png");
  } else {
    assertBufferMatchesFormat(finalBuffer, "jpg");
  }

  return { buffer: finalBuffer, width, height, format };
}

function assertUpscaleInputAllowed(width: number, height: number, factor: UpscaleOptions["factor"]): void {
  const inputPixels = width * height;
  if (inputPixels > MAX_INPUT_PIXELS) {
    throw new Error("Image is too large to upscale safely on this server.");
  }

  const outputWidth = width * factor;
  const outputHeight = height * factor;
  if (outputWidth > MAX_DIMENSION || outputHeight > MAX_DIMENSION) {
    throw new Error("Upscaled output would exceed the maximum supported dimensions.");
  }
}

export async function upscaleWithRealEsrgan(
  input: Buffer,
  options: UpscaleOptions,
): Promise<UpscaleResult> {
  if (!isRealEsrganConfigured()) {
    throw new RealEsrganNotConfiguredError();
  }

  const inputMeta = await sharp(input, { failOn: "none" }).metadata();
  const originalWidth = inputMeta.width ?? 0;
  const originalHeight = inputMeta.height ?? 0;
  assertUpscaleInputAllowed(originalWidth, originalHeight, options.factor);

  const preserveAlpha = options.preserveAlpha ?? inputMeta.hasAlpha === true;
  const mimeType =
    inputMeta.format === "png"
      ? "image/png"
      : inputMeta.format === "webp"
        ? "image/webp"
        : "image/jpeg";

  const longEdge = Math.max(originalWidth, originalHeight);
  const tileSize = options.tileSize ?? (longEdge > 2048 ? 512 : 0);
  const upscaleOptions: UpscaleOptions = { ...options, tileSize, preserveAlpha };
  const outputFormat = outputFormatForInput(preserveAlpha);

  const mode = resolveNativeProviderMode(
    readRealEsrganServiceUrl(),
    env.realesrganBin,
  );

  const rawOutput =
    mode === "service"
      ? await callServiceUpscale(input, upscaleOptions, mimeType)
      : await runNcnnVulkanUpscale(
          input,
          upscaleOptions,
          inputMeta.format,
          outputFormat,
        );

  return validateUpscaleOutput(input, rawOutput, options.factor, preserveAlpha);
}

export const realEsrganProvider: UpscaleProvider = {
  upscale: upscaleWithRealEsrgan,
};

export { MAX_DIMENSION, MAX_INPUT_PIXELS };
