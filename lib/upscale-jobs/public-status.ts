import { getUpscaleJobProgressSnapshot } from "./progress";
import type { UpscaleJobPublicStatus, UpscaleJobRecord } from "./types";

export function toPublicJobStatus(job: UpscaleJobRecord): UpscaleJobPublicStatus {
  const snapshot = getUpscaleJobProgressSnapshot(job.status, job.stage, job.progress);

  return {
    jobId: job.id,
    status: job.status,
    stage: snapshot.stage,
    progress: snapshot.percent,
    label: snapshot.label,
    scale: job.scale,
    inputWidth: job.input_width,
    inputHeight: job.input_height,
    outputWidth: job.output_width,
    outputHeight: job.output_height,
    outputFormat: job.output_format,
    errorCode: job.error_code,
    errorMessage: job.error_message,
    createdAt: job.created_at,
    startedAt: job.started_at,
    completedAt: job.completed_at,
    expiresAt: job.expires_at,
  };
}
