import { readFile } from "node:fs/promises";
import { join } from "node:path";
import sharp from "sharp";
import { env, isRembgConfigured } from "@/config/env";
import { assertBufferMatchesFormat } from "@/lib/image/validate-binary";
import {
  isVercelServerlessRuntime,
  nativeProviderUnavailableMessage,
  resolveNativeProviderMode,
} from "@/lib/providers/runtime/production-guards";
import { runProcess, ProcessTimeoutError } from "@/lib/providers/pdf/shared/subprocess";
import { withTempWorkspace } from "@/lib/providers/pdf/shared/temp-workspace";
import {
  BackgroundRemoverProcessingError,
  prepareProcessingInput,
} from "@/lib/tools/background-remover/prepare-processing-input";
import {
  FREE_PROCESSING_MAX_LONG_EDGE,
  PRO_PROCESSING_MAX_LONG_EDGE,
} from "@/lib/tools/background-remover/processing-limits";
import type {
  BackgroundRemovalOptions,
  BackgroundRemovalProvider,
  BackgroundRemovalResult,
} from "./types";
import { buildRembgServiceAuthHeaders } from "./rembg-service-auth";

const REMBG_SCRIPT = join(process.cwd(), "scripts", "rembg_infer.py");
const DEFAULT_TIMEOUT_MS = 120_000;

export class RembgNotConfiguredError extends Error {
  constructor(message?: string) {
    super(message ?? nativeProviderUnavailableMessage("Background removal"));
    this.name = "RembgNotConfiguredError";
  }
}

function extensionForMime(mimeType: string): string {
  if (mimeType === "image/png") return "png";
  if (mimeType === "image/webp") return "webp";
  if (mimeType === "image/jpeg" || mimeType === "image/jpg") return "jpg";
  return "jpg";
}

async function analyzeSubjectWithSharp(buffer: Buffer): Promise<boolean> {
  const { data, info } = await sharp(buffer)
    .ensureAlpha()
    .raw()
    .toBuffer({ resolveWithObject: true });

  const totalPixels = info.width * info.height;
  let transparentPixels = 0;
  let subjectPixels = 0;

  for (let index = 3; index < data.length; index += 4) {
    const alpha = data[index];
    if (alpha < 32) {
      transparentPixels += 1;
    } else if (alpha > 200) {
      subjectPixels += 1;
    }
  }

  const transparentRatio = transparentPixels / totalPixels;
  const subjectRatio = subjectPixels / totalPixels;

  return !(
    transparentRatio < 0.05 ||
    subjectRatio < 0.02 ||
    transparentRatio > 0.98
  );
}

async function callRembgService(
  input: Buffer,
  mimeType: string,
  model: string,
): Promise<Buffer> {
  const serviceUrl = env.rembgServiceUrl;
  if (!serviceUrl) {
    throw new RembgNotConfiguredError();
  }

  const formData = new FormData();
  formData.append("file", new Blob([new Uint8Array(input)], { type: mimeType }), "input.bin");
  formData.append("model", model);

  const response = await fetch(serviceUrl, {
    method: "POST",
    headers: buildRembgServiceAuthHeaders(),
    body: formData,
  });

  if (!response.ok) {
    const text = await response.text().catch(() => "");
    throw new Error(text || `Background removal service returned ${response.status}`);
  }

  return Buffer.from(await response.arrayBuffer());
}

async function runRembgPython(input: Buffer, mimeType: string): Promise<{ buffer: Buffer; model: string }> {
  if (isVercelServerlessRuntime()) {
    throw new RembgNotConfiguredError();
  }

  if (!env.rembgPython) {
    throw new RembgNotConfiguredError();
  }

  const ext = extensionForMime(mimeType);
  const model = env.rembgModel || "isnet-general-use";

  return withTempWorkspace(input, `.${ext}`, async (workspace) => {
    const outputPath = workspace.outputPath.replace(/\.[^.]+$/, ".png");

    const args = [
      REMBG_SCRIPT,
      "--input",
      workspace.inputPath,
      "--output",
      outputPath,
      "--model",
      model,
    ];

    if (env.rembgModelDir) {
      args.push("--model-dir", env.rembgModelDir);
    }

    try {
      await runProcess({
        command: env.rembgPython,
        args,
        timeoutMs: DEFAULT_TIMEOUT_MS,
        env: env.rembgModelDir
          ? { ...process.env, U2NET_HOME: env.rembgModelDir }
          : undefined,
      });
    } catch (error) {
      if (error instanceof ProcessTimeoutError) {
        throw new Error("Background removal timed out. Try a smaller image.");
      }
      throw error;
    }

    const buffer = await readFile(outputPath);
    return { buffer, model };
  });
}

async function assertDimensionsPreserved(
  input: Buffer,
  output: Buffer,
): Promise<{ width: number; height: number }> {
  const inputMeta = await sharp(input, { failOn: "none" }).metadata();
  const outputMeta = await sharp(output, { failOn: "none" }).metadata();

  const inputWidth = inputMeta.width ?? 0;
  const inputHeight = inputMeta.height ?? 0;
  const width = outputMeta.width ?? 0;
  const height = outputMeta.height ?? 0;

  if (inputWidth !== width || inputHeight !== height) {
    throw new Error(
      `Background removal changed dimensions (${inputWidth}×${inputHeight} → ${width}×${height}).`,
    );
  }

  return { width, height };
}

export async function removeBackgroundWithRembg(
  input: Buffer,
  mimeType: string,
  options: BackgroundRemovalOptions,
): Promise<BackgroundRemovalResult> {
  if (!isRembgConfigured()) {
    throw new RembgNotConfiguredError();
  }

  const prepared = await prepareProcessingInput(
    input,
    mimeType,
    options.processingMaxLongEdge,
  );

  const model = env.rembgModel || "isnet-general-use";
  const mode = resolveNativeProviderMode(env.rembgServiceUrl, env.rembgPython);

  const { buffer: rawOutput, model: usedModel } =
    mode === "service"
      ? {
          buffer: await callRembgService(prepared.buffer, prepared.mimeType, model),
          model,
        }
      : await runRembgPython(prepared.buffer, prepared.mimeType);

  assertBufferMatchesFormat(rawOutput, "png");

  const { width, height } = await assertDimensionsPreserved(prepared.buffer, rawOutput);
  const hasSubject = await analyzeSubjectWithSharp(rawOutput);

  return {
    buffer: rawOutput,
    width,
    height,
    originalWidth: prepared.originalWidth,
    originalHeight: prepared.originalHeight,
    wasOptimized: prepared.wasOptimized,
    likelyNoSubject: !hasSubject,
    provider: mode === "service" ? "rembg-service" : "rembg",
    model: usedModel,
  };
}

export const rembgServerProvider: BackgroundRemovalProvider = {
  removeBackground: removeBackgroundWithRembg,
};

export {
  FREE_PROCESSING_MAX_LONG_EDGE as FREE_MAX_LONG_EDGE,
  PRO_PROCESSING_MAX_LONG_EDGE as PRO_MAX_LONG_EDGE,
};
export { BackgroundRemoverProcessingError };
