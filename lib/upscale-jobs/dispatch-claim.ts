import type { UpscaleJobRecord } from "./types";

/** Maximum RunPod poll_once dispatch attempts per job create. */
export const MAX_DISPATCH_ATTEMPTS = 3;

/** Interval between Supabase claim checks after a dispatch. */
export const CLAIM_POLL_INTERVAL_MS = 1500;

/** Claim polls per dispatch attempt before issuing another poll_once. */
export const CLAIM_VERIFY_POLLS_PER_ATTEMPT = 4;

/** Backoff before dispatch attempts 2 and 3 (attempt 1 has no backoff). */
export const DISPATCH_RETRY_BACKOFF_MS = [0, 1000, 2000] as const;

export type DispatchOutcome =
  | { ok: true; dispatchAttempts: number; runpodRequestIds: string[] }
  | { ok: false; reason: "worker_claim_timeout" | "worker_trigger_failed"; dispatchAttempts: number };

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
  outcome: "claimed" | "retry" | "failed" | "trigger_http_failed";
  message?: string;
}

/**
 * True when the worker has claimed or finished this job — dispatch can stop.
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

  if (isUpscaleJobDispatched(job)) {
    return true;
  }

  return false;
}
