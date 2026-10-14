import { randomUUID } from "node:crypto";
import { NextResponse } from "next/server";
import { assertSupabaseConfigured, isSupabaseConfigured } from "@/config/env";
import {
  limitReachedResponse,
  requirePremiumAiPlan,
  validateUploadSize,
} from "@/lib/plan/access";
import { enforceRateLimit } from "@/lib/security/rate-limit";
import {
  chargeUpscaleJob,
  closeUnchargedUpscaleJob,
  failUpscaleJob,
} from "@/lib/upscale-jobs/credits";
import { inspectUpscaleInput } from "@/lib/upscale-jobs/inspect-input";
import { createJob } from "@/lib/upscale-jobs/repository";
import { isRunPodUpscaleTriggerConfigured } from "@/lib/upscale-jobs/runpod-trigger";
import { uploadInput } from "@/lib/upscale-jobs/storage";
import { submitPreparedUpscaleJob } from "@/lib/upscale-jobs/submit-job";
import { triggerUpscaleWorkerAfterJobCreated } from "@/lib/upscale-jobs/trigger-worker";
import { readImageFromFormData } from "@/lib/tools/shared/api-handler";
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

  const factorRaw = Number(formData.get("factor") ?? 2);
  const scale: 2 | 4 = factorRaw === 4 ? 4 : 2;

  let inspected: { width: number; height: number };
  try {
    inspected = await inspectUpscaleInput(fileInput.buffer, scale);
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Could not read image dimensions.",
        code: "INVALID_IMAGE",
      },
      { status: 400 },
    );
  }

  const submitted = await submitPreparedUpscaleJob(
    {
      userId: access.user.id,
      scale,
      file: fileInput,
      width: inspected.width,
      height: inspected.height,
    },
    {
      createJobId: randomUUID,
      uploadInput,
      createJob,
      chargeJob: (jobId) => chargeUpscaleJob(access.user.id, access.plan, jobId),
      closeUnchargedJob: closeUnchargedUpscaleJob,
      dispatchJob: triggerUpscaleWorkerAfterJobCreated,
      failChargedJob: failUpscaleJob,
    },
  );

  if (submitted.status === "created") {
    return NextResponse.json({ jobId: submitted.jobId }, { status: 201 });
  }

  if (submitted.status === "denied") {
    return limitReachedResponse(ROUTE, "Tool operation limit reached for your current plan.", {
      usageCount: submitted.usage.usageCount,
      limit: submitted.usage.limit,
      remaining: submitted.usage.remaining,
      resetAt: submitted.usage.resetAt,
    });
  }

  const dispatchFailed = submitted.status === "dispatch_failed";
  return NextResponse.json(
    {
      error: submitted.message,
      code: dispatchFailed ? "WORKER_TRIGGER_FAILED" : "JOB_CREATE_FAILED",
    },
    { status: dispatchFailed ? 503 : 500 },
  );
}
