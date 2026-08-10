import { createAdminClient } from "@/lib/supabase/admin";
import type {
  CreateUpscaleJobInput,
  UpdateUpscaleJobInput,
  UpscaleJobRecord,
} from "./types";

function mapRow(row: Record<string, unknown>): UpscaleJobRecord {
  return row as unknown as UpscaleJobRecord;
}

export async function createJob(input: CreateUpscaleJobInput): Promise<UpscaleJobRecord> {
  const admin = createAdminClient();

  const insertPayload: Record<string, unknown> = {
      user_id: input.userId,
      status: "queued",
      stage: "queued",
      progress: 15,
      scale: input.scale,
      input_storage_path: input.inputStoragePath,
      input_mime_type: input.inputMimeType,
      input_width: input.inputWidth,
      input_height: input.inputHeight,
      input_size_bytes: input.inputSizeBytes,
      usage_charged: input.usageCharged,
    };

  if (input.id) {
    insertPayload.id = input.id;
  }

  const { data, error } = await admin
    .from("upscale_jobs")
    .insert(insertPayload)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not create upscale job.");
  }

  return mapRow(data);
}

export async function getJobForUser(
  userId: string,
  jobId: string,
): Promise<UpscaleJobRecord | null> {
  const admin = createAdminClient();

  const { data, error } = await admin
    .from("upscale_jobs")
    .select("*")
    .eq("id", jobId)
    .eq("user_id", userId)
    .maybeSingle();

  if (error) {
    throw new Error(error.message);
  }

  return data ? mapRow(data) : null;
}

export async function updateJob(
  jobId: string,
  patch: UpdateUpscaleJobInput,
): Promise<UpscaleJobRecord> {
  const admin = createAdminClient();

  const payload: Record<string, unknown> = {};
  if (patch.status !== undefined) payload.status = patch.status;
  if (patch.stage !== undefined) payload.stage = patch.stage;
  if (patch.progress !== undefined) payload.progress = patch.progress;
  if (patch.outputStoragePath !== undefined) payload.output_storage_path = patch.outputStoragePath;
  if (patch.outputWidth !== undefined) payload.output_width = patch.outputWidth;
  if (patch.outputHeight !== undefined) payload.output_height = patch.outputHeight;
  if (patch.outputFormat !== undefined) payload.output_format = patch.outputFormat;
  if (patch.outputSizeBytes !== undefined) payload.output_size_bytes = patch.outputSizeBytes;
  if (patch.errorCode !== undefined) payload.error_code = patch.errorCode;
  if (patch.errorMessage !== undefined) payload.error_message = patch.errorMessage;
  if (patch.workerId !== undefined) payload.worker_id = patch.workerId;
  if (patch.startedAt !== undefined) payload.started_at = patch.startedAt;
  if (patch.completedAt !== undefined) payload.completed_at = patch.completedAt;

  const { data, error } = await admin
    .from("upscale_jobs")
    .update(payload)
    .eq("id", jobId)
    .select("*")
    .single();

  if (error || !data) {
    throw new Error(error?.message ?? "Could not update upscale job.");
  }

  return mapRow(data);
}
