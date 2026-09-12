import type { UpscaleJobRecord } from "./types";

/**
 * Maximum RunPod HTTP trigger attempts when the trigger itself fails.
 * A successful trigger ends dispatch immediately — claim is not verified here.
 */
export const MAX_DISPATCH_ATTEMPTS = 3;

/** Backoff before RunPod trigger retry attempts 2 and 3 (trigger HTTP failures only). */
export const DISPATCH_RETRY_BACKOFF_MS = [0, 1000, 2000] as const;

export type DispatchOutcome =
  | { ok: true; dispatchAttempts: number; runpodRequestIds: string[] }
  | { ok: false; reason: "worker_trigger_failed"; dispatchAttempts: number };

export interface DispatchLogEvent {
  jobId: string;
  dispatchAttempt: number;
  runpodRequestId?: string;
  runpodHttpOk?: boolean;
  runpodHttpStatus?: number;
  runpodMessage?: string;
  supabaseStatus?: string;
  workerId?: string | null;
  startedAt?: string | null;
  outcome: "triggered" | "already_dispatched" | "retry" | "failed" | "trigger_http_failed";
  message?: string;
}

/**
 * True when the worker has claimed or finished this job — skip further triggers.
 */
export function isUpscaleJobDispatched(job: UpscaleJobRecord | null): boolean {
  if (!job) {
    return false;
  }

  if (job.status !== "queued") {
    return true;
  }

  if (job.worker_id) {
    return true;
  }

  if (job.started_at) {
    return true;
  }

  return false;
}

export function shouldSkipDispatchRetry(job: UpscaleJobRecord | null): boolean {
  if (!job) {
    return false;
  }

  return isUpscaleJobDispatched(job);
}
