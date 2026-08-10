import { getUpscaleJobProgressSnapshot } from "./progress";
import { resolveUpscaleJobStatus } from "./terminal-status";
import type { UpscaleJobPublicStatus, UpscaleJobRecord } from "./types";

export function toPublicJobStatus(job: UpscaleJobRecord): UpscaleJobPublicStatus {
  const status = resolveUpscaleJobStatus(job);
  const snapshot = getUpscaleJobProgressSnapshot(status, job.stage, job.progress);

  return {
    jobId: job.id,
    status,
    stage: snapshot.stage,
    progress: snapshot.percent,
    label: snapshot.label,
    scale: job.scale,
    inputWidth: job.input_width,
    inputHeight: job.input_height,
    outputWidth: job.output_width,
    outputHeight: job.output_height,
    outputFormat: job.output_format,
    outputStoragePath: job.output_storage_path,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    expiresAt: job.expires_at,
  };
}
