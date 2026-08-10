import {
  CLAIM_POLL_INTERVAL_MS,
  CLAIM_VERIFY_POLLS_PER_ATTEMPT,
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

const WORKER_CLAIM_TIMEOUT_MESSAGE =
  "Upscaling worker did not start in time. Please try again.";

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

async function waitForJobDispatch(
  deps: DispatchDependencies,
  jobId: string,
  dispatchAttempt: number,
): Promise<UpscaleJobRecord | null> {
  let latest: UpscaleJobRecord | null = await deps.getJob(jobId);

  for (let poll = 0; poll < CLAIM_VERIFY_POLLS_PER_ATTEMPT; poll += 1) {
    if (isUpscaleJobDispatched(latest)) {
      deps.logEvent({
        jobId,
        dispatchAttempt,
        supabaseStatus: latest?.status,
        workerId: latest?.worker_id ?? null,
        startedAt: latest?.started_at ?? null,
        outcome: "claimed",
        message: "Job claimed during verification window.",
      });
      return latest;
    }

    if (poll < CLAIM_VERIFY_POLLS_PER_ATTEMPT - 1) {
      await deps.sleep(CLAIM_POLL_INTERVAL_MS);
      latest = await deps.getJob(jobId);
    }
  }

  return latest;
}

async function markDispatchFailure(
  deps: DispatchDependencies,
  jobId: string,
  dispatchAttempts: number,
  errorCode: "worker_claim_timeout" | "worker_trigger_failed",
  errorMessage: string,
): Promise<void> {
  try {
    await deps.updateJob(jobId, {
      status: "failed",
      stage: "queued",
      errorCode,
      errorMessage,
      completedAt: new Date().toISOString(),
    });
  } catch (updateError) {
    console.error(
      "[upscale-jobs] Failed to mark job %s failed after dispatch error %s: %s",
      jobId,
      errorCode,
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
 * Dispatch RunPod poll_once with bounded claim verification for one Supabase job.
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
      outcome: "claimed",
      message: "Job already dispatched before first trigger.",
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
        outcome: "claimed",
        message: "Job claimed before retry trigger.",
      });
      return { ok: true, dispatchAttempts: attempt - 1, runpodRequestIds };
    }

    const triggered = await deps.triggerRunPod();
    if (triggered.ok) {
      runpodRequestIds.push(triggered.runpodJobId);
    }

    lastJob = await deps.getJob(jobId);
    if (triggered.ok && isUpscaleJobDispatched(lastJob)) {
      logTriggerResult(deps, jobId, attempt, triggered, lastJob, "claimed");
      return { ok: true, dispatchAttempts: attempt, runpodRequestIds };
    }

    if (!triggered.ok) {
      logTriggerResult(
        deps,
        jobId,
        attempt,
        triggered,
        lastJob,
        "trigger_http_failed",
        triggered.message,
      );
    } else {
      logTriggerResult(deps, jobId, attempt, triggered, lastJob, "retry");
    }

    if (triggered.ok) {
      lastJob = await waitForJobDispatch(deps, jobId, attempt);
      if (isUpscaleJobDispatched(lastJob)) {
        return { ok: true, dispatchAttempts: attempt, runpodRequestIds };
      }
    }

    if (attempt < MAX_DISPATCH_ATTEMPTS) {
      deps.logEvent({
        jobId,
        dispatchAttempt: attempt,
        runpodRequestId: triggered.ok ? triggered.runpodJobId : undefined,
        supabaseStatus: lastJob?.status,
        workerId: lastJob?.worker_id ?? null,
        startedAt: lastJob?.started_at ?? null,
        outcome: "retry",
        message: "Job still unclaimed; scheduling another dispatch attempt.",
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
      outcome: "claimed",
      message: "Job claimed after final verification.",
    });
    return { ok: true, dispatchAttempts: MAX_DISPATCH_ATTEMPTS, runpodRequestIds };
  }

  if (runpodRequestIds.length === 0) {
    await markDispatchFailure(
      deps,
      jobId,
      MAX_DISPATCH_ATTEMPTS,
      "worker_trigger_failed",
      WORKER_TRIGGER_ERROR_MESSAGE,
    );
    return {
      ok: false,
      reason: "worker_trigger_failed",
      dispatchAttempts: MAX_DISPATCH_ATTEMPTS,
    };
  }

  await markDispatchFailure(
    deps,
    jobId,
    MAX_DISPATCH_ATTEMPTS,
    "worker_claim_timeout",
    WORKER_CLAIM_TIMEOUT_MESSAGE,
  );

  return {
    ok: false,
    reason: "worker_claim_timeout",
    dispatchAttempts: MAX_DISPATCH_ATTEMPTS,
  };
}

export async function triggerUpscaleWorkerAfterJobCreated(jobId: string): Promise<void> {
  const outcome = await dispatchUpscaleWorkerWithClaimVerification(jobId);

  if (outcome.ok) {
    return;
  }

  if (outcome.reason === "worker_trigger_failed") {
    throw new Error(WORKER_TRIGGER_ERROR_MESSAGE);
  }

  throw new Error(WORKER_CLAIM_TIMEOUT_MESSAGE);
}
