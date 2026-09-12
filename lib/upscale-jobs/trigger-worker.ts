import {
  DISPATCH_RETRY_BACKOFF_MS,
  MAX_DISPATCH_ATTEMPTS,
  isUpscaleJobDispatched,
  shouldSkipDispatchRetry,
  type DispatchLogEvent,
  type DispatchOutcome,
} from "./dispatch-claim";
import { getJobById, updateJob } from "./repository";
import { triggerRunPodPollOnce, type RunPodTriggerResult } from "./runpod-trigger";
import type { UpscaleJobRecord } from "./types";

const WORKER_TRIGGER_ERROR_MESSAGE =
  "Could not start upscaling worker. Please try again.";

export interface DispatchDependencies {
  triggerRunPod: typeof triggerRunPodPollOnce;
  getJob: (jobId: string) => Promise<UpscaleJobRecord | null>;
  updateJob: typeof updateJob;
  sleep: (ms: number) => Promise<void>;
  logEvent: (event: DispatchLogEvent) => void;
}

function defaultSleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

function defaultLogEvent(event: DispatchLogEvent): void {
  console.log(
    JSON.stringify({
      scope: "upscale-jobs-dispatch",
      timestamp: new Date().toISOString(),
      ...event,
    }),
  );
}

function defaultDependencies(): DispatchDependencies {
  return {
    triggerRunPod: triggerRunPodPollOnce,
    getJob: getJobById,
    updateJob,
    sleep: defaultSleep,
    logEvent: defaultLogEvent,
  };
}

function logTriggerResult(
  deps: DispatchDependencies,
  jobId: string,
  dispatchAttempt: number,
  triggered: RunPodTriggerResult,
  job: UpscaleJobRecord | null,
  outcome: DispatchLogEvent["outcome"],
  message?: string,
): void {
  deps.logEvent({
    jobId,
    dispatchAttempt,
    runpodRequestId: triggered.ok ? triggered.runpodJobId : undefined,
    runpodHttpOk: triggered.ok,
    runpodHttpStatus: triggered.ok ? 200 : triggered.status,
    runpodMessage: triggered.ok ? undefined : triggered.message,
    supabaseStatus: job?.status,
    workerId: job?.worker_id ?? null,
    startedAt: job?.started_at ?? null,
    outcome,
    message,
  });
}

async function markDispatchFailure(
  deps: DispatchDependencies,
  jobId: string,
  dispatchAttempts: number,
  errorMessage: string,
): Promise<void> {
  try {
    await deps.updateJob(jobId, {
      status: "failed",
      stage: "queued",
      errorCode: "worker_trigger_failed",
      errorMessage,
      completedAt: new Date().toISOString(),
    });
  } catch (updateError) {
    console.error(
      "[upscale-jobs] Failed to mark job %s failed after dispatch error worker_trigger_failed: %s",
      jobId,
      updateError instanceof Error ? updateError.message : String(updateError),
    );
  }

  deps.logEvent({
    jobId,
    dispatchAttempt: dispatchAttempts,
    outcome: "failed",
    message: errorMessage,
  });
}

/**
 * Dispatch RunPod poll_once. Success = accepted HTTP trigger (job may still be queued).
 * Retries only when the RunPod trigger itself fails. Does not wait for worker claim.
 * Exported for deterministic tests — production callers should use
 * triggerUpscaleWorkerAfterJobCreated().
 */
export async function dispatchUpscaleWorkerWithClaimVerification(
  jobId: string,
  partialDeps: Partial<DispatchDependencies> = {},
): Promise<DispatchOutcome> {
  const deps: DispatchDependencies = { ...defaultDependencies(), ...partialDeps };
  const runpodRequestIds: string[] = [];
  let lastJob: UpscaleJobRecord | null = await deps.getJob(jobId);

  if (isUpscaleJobDispatched(lastJob)) {
    deps.logEvent({
      jobId,
      dispatchAttempt: 0,
      supabaseStatus: lastJob?.status,
      workerId: lastJob?.worker_id ?? null,
      startedAt: lastJob?.started_at ?? null,
      outcome: "already_dispatched",
      message: "Job already claimed or finished before first trigger.",
    });
    return { ok: true, dispatchAttempts: 0, runpodRequestIds };
  }

  for (let attempt = 1; attempt <= MAX_DISPATCH_ATTEMPTS; attempt += 1) {
    const backoffMs = DISPATCH_RETRY_BACKOFF_MS[attempt - 1] ?? 0;
    if (backoffMs > 0) {
      await deps.sleep(backoffMs);
    }

    lastJob = await deps.getJob(jobId);
    if (shouldSkipDispatchRetry(lastJob)) {
      deps.logEvent({
        jobId,
        dispatchAttempt: attempt,
        supabaseStatus: lastJob?.status,
        workerId: lastJob?.worker_id ?? null,
        startedAt: lastJob?.started_at ?? null,
        outcome: "already_dispatched",
        message: "Job claimed before retry trigger.",
      });
      return { ok: true, dispatchAttempts: Math.max(0, attempt - 1), runpodRequestIds };
    }

    const triggered = await deps.triggerRunPod();

    if (triggered.ok) {
      runpodRequestIds.push(triggered.runpodJobId);
      lastJob = await deps.getJob(jobId);
      logTriggerResult(
        deps,
        jobId,
        attempt,
        triggered,
        lastJob,
        "triggered",
        "RunPod trigger accepted; job may remain queued until worker claims.",
      );
      return { ok: true, dispatchAttempts: attempt, runpodRequestIds };
    }

    logTriggerResult(
      deps,
      jobId,
      attempt,
      triggered,
      lastJob,
      "trigger_http_failed",
      triggered.message,
    );

    if (attempt < MAX_DISPATCH_ATTEMPTS) {
      deps.logEvent({
        jobId,
        dispatchAttempt: attempt,
        supabaseStatus: lastJob?.status,
        workerId: lastJob?.worker_id ?? null,
        startedAt: lastJob?.started_at ?? null,
        outcome: "retry",
        message: "RunPod trigger failed; scheduling another trigger attempt.",
      });
    }
  }

  lastJob = await deps.getJob(jobId);
  if (isUpscaleJobDispatched(lastJob)) {
    deps.logEvent({
      jobId,
      dispatchAttempt: MAX_DISPATCH_ATTEMPTS,
      supabaseStatus: lastJob?.status,
      workerId: lastJob?.worker_id ?? null,
      startedAt: lastJob?.started_at ?? null,
      outcome: "already_dispatched",
      message: "Job claimed after trigger attempts.",
    });
    return { ok: true, dispatchAttempts: MAX_DISPATCH_ATTEMPTS, runpodRequestIds };
  }

  await markDispatchFailure(deps, jobId, MAX_DISPATCH_ATTEMPTS, WORKER_TRIGGER_ERROR_MESSAGE);

  return {
    ok: false,
    reason: "worker_trigger_failed",
    dispatchAttempts: MAX_DISPATCH_ATTEMPTS,
  };
}

export async function triggerUpscaleWorkerAfterJobCreated(jobId: string): Promise<void> {
  const outcome = await dispatchUpscaleWorkerWithClaimVerification(jobId);

  if (outcome.ok) {
    return;
  }

  throw new Error(WORKER_TRIGGER_ERROR_MESSAGE);
}
