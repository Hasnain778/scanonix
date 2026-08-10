import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import sharp from "sharp";
import { assertSupabaseConfigured, isSupabaseConfigured } from "@/config/env";
import {
  limitReachedResponse,
  requirePremiumAiPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { consumeUsage } from "@/lib/plan/usage";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  upscaleJobInputPath,
  storageExtFromMime,
} from "@/lib/upscale-jobs/paths";
import { createJob } from "@/lib/upscale-jobs/repository";
import { isRunPodUpscaleTriggerConfigured } from "@/lib/upscale-jobs/runpod-trigger";
import { uploadInput } from "@/lib/upscale-jobs/storage";
import { triggerUpscaleWorkerAfterJobCreated } from "@/lib/upscale-jobs/trigger-worker";
import {
  readImageFromFormData,
  type ImageToolFileInput,
} from "@/lib/tools/shared/api-handler";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const ROUTE = "/api/tools/image/upscale/jobs";

export async function POST(request: Request) {
  if (!isSupabaseConfigured()) {
    return NextResponse.json(
      { error: "Async upscaling is not configured.", code: "NOT_CONFIGURED" },
      { status: 503 },
    );
  }

  try {
    assertSupabaseConfigured();
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Supabase is not configured.",
        code: "NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  if (!isRunPodUpscaleTriggerConfigured()) {
    return NextResponse.json(
      {
        error: "Async upscaling worker is not configured.",
        code: "NOT_CONFIGURED",
      },
      { status: 503 },
    );
  }

  const rateLimited = enforceRateLimit(request, {
    route: ROUTE,
    limit: 15,
    windowMs: 60_000,
  });
  if (rateLimited) return rateLimited;

  let formData: FormData;
  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart request." }, { status: 400 });
  }

  const access = await requirePremiumAiPlan(ROUTE);
  if (access instanceof NextResponse) {
    return access;
  }

  const maxBytes = Math.min(FREE_IMAGE_MAX_BYTES, access.limits.maxUploadBytes);
  const fileInput = await readImageFromFormData(formData, "file", maxBytes);
  if (fileInput instanceof NextResponse) {
    return fileInput;
  }

  const uploadError = validateUploadSize(ROUTE, fileInput.file.size, access.limits);
  if (uploadError) {
    return uploadError;
  }

  let usageCharged = false;
  try {
    const usage = await consumeUsage(access.user.id, access.plan);
    if (!usage.allowed) {
      return limitReachedResponse(ROUTE, "Tool operation limit reached for your current plan.", {
        usageCount: usage.usageCount,
        limit: usage.limit,
        remaining: usage.remaining,
        resetAt: usage.resetAt,
      });
    }
    usageCharged = true;
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not authorize operation.",
      },
      { status: 500 },
    );
  }

  const factorRaw = Number(formData.get("factor") ?? 2);
  const scale: 2 | 4 = factorRaw === 4 ? 4 : 2;

  try {
    const jobId = await createUpscaleJobRecord(access.user.id, scale, fileInput, usageCharged);
    await triggerUpscaleWorkerAfterJobCreated(jobId);
    return NextResponse.json({ jobId }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not create upscale job.";
    const isWorkerTriggerFailure = message.includes("Could not start upscaling worker");

    return NextResponse.json(
      {
        error: message,
        code: isWorkerTriggerFailure ? "WORKER_TRIGGER_FAILED" : "JOB_CREATE_FAILED",
      },
      { status: isWorkerTriggerFailure ? 503 : 500 },
    );
  }
}

async function createUpscaleJobRecord(
  userId: string,
  scale: 2 | 4,
  fileInput: ImageToolFileInput,
  usageCharged: boolean,
): Promise<string> {
  const inputMeta = await sharp(fileInput.buffer, { failOn: "none" }).metadata();
  const inputWidth = inputMeta.width ?? 0;
  const inputHeight = inputMeta.height ?? 0;

  if (inputWidth <= 0 || inputHeight <= 0) {
    throw new Error("Could not read image dimensions.");
  }

  const outputWidth = inputWidth * scale;
  const outputHeight = inputHeight * scale;
  if (outputWidth > 16_384 || outputHeight > 16_384) {
    throw new Error("Upscaled output would exceed the maximum supported dimensions.");
  }

  const inputPixels = inputWidth * inputHeight;
  if (inputPixels > 4_000_000) {
    throw new Error("Image is too large to upscale safely on this server.");
  }

  const jobId = randomUUID();
  const ext = storageExtFromMime(fileInput.mimeType);
  const inputPath = upscaleJobInputPath(userId, jobId, ext);

  await uploadInput(inputPath, fileInput.buffer, fileInput.mimeType);

  const job = await createJob({
    id: jobId,
    userId,
    scale,
    inputStoragePath: inputPath,
    inputMimeType: fileInput.mimeType,
    inputWidth,
    inputHeight,
    inputSizeBytes: fileInput.file.size,
    usageCharged,
  });

  return job.id;
}
