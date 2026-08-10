import type { UpscaleJobPublicStatus, UpscaleJobRecord, UpscaleJobStatus } from "./types";

/**
 * Resolve the effective job status from Supabase row fields.
 * Aligns with RunPod worker completion writes in job_processor._mark_job_completed.
 */
export function resolveUpscaleJobStatus(job: UpscaleJobRecord): UpscaleJobStatus {
  if (job.status === "failed" || job.status === "cancelled") {
    return job.status;
  }

  if (job.status === "completed") {
    return "completed";
  }

  if (
    job.completed_at &&
    job.output_storage_path &&
    (job.stage === "completed" || job.progress >= 100)
  ) {
    return "completed";
  }

  return job.status;
}

export function isTerminalUpscaleJobStatus(status: UpscaleJobPublicStatus): boolean {
  if (status.status === "failed" || status.status === "cancelled") {
    return true;
  }

  if (status.status === "completed") {
    return true;
  }

  if (status.completedAt && status.outputStoragePath) {
    return true;
  }

  return false;
}

export function isActiveUpscaleJobStatus(status: UpscaleJobPublicStatus): boolean {
  return !isTerminalUpscaleJobStatus(status);
}

export type UpscaleJobPollAction = "continue" | "fetch-result" | "stop-error";

export function getUpscaleJobPollAction(status: UpscaleJobPublicStatus): UpscaleJobPollAction {
  if (isActiveUpscaleJobStatus(status)) {
    return "continue";
  }

  if (status.status === "failed" || status.status === "cancelled") {
    return "stop-error";
  }

  return "fetch-result";
}
