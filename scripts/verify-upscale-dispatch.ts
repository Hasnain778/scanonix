/**
 * Verify RunPod dispatch: create succeeds on accepted trigger (no claim wait).
 * Run: npx tsx scripts/verify-upscale-dispatch.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  MAX_DISPATCH_ATTEMPTS,
  isUpscaleJobDispatched,
} from "../lib/upscale-jobs/dispatch-claim";
import {
  dispatchUpscaleWorkerWithClaimVerification,
} from "../lib/upscale-jobs/trigger-worker";
import type { UpscaleJobRecord } from "../lib/upscale-jobs/types";

const JOB_ID = "f13a66a7-9d9e-4350-a898-f4db692f3664";

function baseJob(overrides: Partial<UpscaleJobRecord> = {}): UpscaleJobRecord {
  return {
    id: JOB_ID,
    user_id: "user-1",
    status: "queued",
    scale: 2,
    stage: "queued",
    progress: 15,
    input_storage_path: "user-1/upscale-jobs/input.jpg",
    output_storage_path: null,
    input_mime_type: "image/jpeg",
    input_width: 100,
    input_height: 100,
    input_size_bytes: 1000,
    output_width: null,
    output_height: null,
    output_format: null,
    output_size_bytes: null,
    error_code: null,
    error_message: null,
    usage_charged: true,
    attempts: 0,
    max_attempts: 3,
    worker_id: null,
    created_at: "2026-08-10T02:51:40.42119+00:00",
    started_at: null,
    completed_at: null,
    expires_at: "2026-08-11T02:51:40.42119+00:00",
    ...overrides,
  };
}

async function main(): Promise<void> {
  let passed = 0;

  async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  }

  await test("A. successful trigger while job still queued -> ok, exactly 1 trigger", async () => {
    let triggerCount = 0;
    let sleepCalls = 0;
    let job = baseJob();
    let failedErrorCode: string | null = null;

    const outcome = await dispatchUpscaleWorkerWithClaimVerification(JOB_ID, {
      sleep: async () => {
        sleepCalls += 1;
      },
      logEvent: () => {},
      getJob: async () => job,
      updateJob: async (_jobId, patch) => {
        failedErrorCode = patch.errorCode ?? null;
        job = {
          ...job,
          status: patch.status ?? job.status,
          error_code: patch.errorCode ?? job.error_code,
        };
        return job;
      },
      triggerRunPod: async () => {
        triggerCount += 1;
        return { ok: true as const, runpodJobId: "runpod-req-1" };
      },
    });

    assert.equal(outcome.ok, true);
    assert.equal(triggerCount, 1);
    assert.equal(sleepCalls, 0);
    assert.equal(job.status, "queued");
    assert.equal(failedErrorCode, null);
    assert.equal(isUpscaleJobDispatched(job), false);
  });

  await test("B. successful trigger does not wait/poll for claim", async () => {
    let triggerCount = 0;
    let getJobCalls = 0;
    let job = baseJob();

    const outcome = await dispatchUpscaleWorkerWithClaimVerification(JOB_ID, {
      sleep: async () => {
        assert.fail("sleep must not run after a successful trigger (no claim wait)");
      },
      logEvent: () => {},
      getJob: async () => {
        getJobCalls += 1;
        return job;
      },
      updateJob: async () => {
        assert.fail("updateJob must not mark failure after successful trigger");
        return job;
      },
      triggerRunPod: async () => {
        triggerCount += 1;
        return { ok: true as const, runpodJobId: "runpod-req-1" };
      },
    });

    assert.equal(outcome.ok, true);
    assert.equal(triggerCount, 1);
    // Initial get + post-trigger get only (no claim-wait poll loop).
    assert.ok(getJobCalls <= 3);
  });

  await test("C. job already processing before first trigger -> 0 triggers", async () => {
    let triggerCount = 0;
    const job = baseJob({
      status: "processing",
      worker_id: "runpod-realesrgan",
      started_at: "2026-08-10T02:52:00.000Z",
      attempts: 1,
    });

    const outcome = await dispatchUpscaleWorkerWithClaimVerification(JOB_ID, {
      sleep: async () => {},
      logEvent: () => {},
      getJob: async () => job,
      updateJob: async () => job,
      triggerRunPod: async () => {
        triggerCount += 1;
        return { ok: true as const, runpodJobId: "runpod-req-1" };
      },
    });

    assert.equal(outcome.ok, true);
    assert.equal(triggerCount, 0);
  });

  await test("D. no worker_claim_timeout path after successful trigger", async () => {
    let triggerCount = 0;
    let job = baseJob();
    let updateCalled = false;

    const outcome = await dispatchUpscaleWorkerWithClaimVerification(JOB_ID, {
      sleep: async () => {},
      logEvent: () => {},
      getJob: async () => job,
      updateJob: async () => {
        updateCalled = true;
        return job;
      },
      triggerRunPod: async () => {
        triggerCount += 1;
        return { ok: true as const, runpodJobId: `runpod-req-${triggerCount}` };
      },
    });

    assert.equal(outcome.ok, true);
    assert.equal(triggerCount, 1);
    assert.equal(updateCalled, false);
    assert.equal(job.status, "queued");
    assert.equal("reason" in outcome, false);
  });

  await test("E. first HTTP fail then success -> 2 triggers, no claim wait", async () => {
    let triggerCount = 0;
    let job = baseJob();

    const outcome = await dispatchUpscaleWorkerWithClaimVerification(JOB_ID, {
      sleep: async () => {},
      logEvent: () => {},
      getJob: async () => job,
      updateJob: async () => job,
      triggerRunPod: async () => {
        triggerCount += 1;
        if (triggerCount === 1) {
          return { ok: false as const, message: "RunPod trigger failed with status 502.", status: 502 };
        }
        return { ok: true as const, runpodJobId: "runpod-req-2" };
      },
    });

    assert.equal(outcome.ok, true);
    assert.equal(triggerCount, 2);
    assert.equal(job.status, "queued");
  });

  await test("F. job completes quickly during trigger -> still success, 1 trigger", async () => {
    let triggerCount = 0;
    let job = baseJob();

    const outcome = await dispatchUpscaleWorkerWithClaimVerification(JOB_ID, {
      sleep: async () => {},
      logEvent: () => {},
      getJob: async () => job,
      updateJob: async () => job,
      triggerRunPod: async () => {
        triggerCount += 1;
        job = baseJob({
          status: "completed",
          stage: "completed",
          progress: 100,
          worker_id: "runpod-realesrgan",
          started_at: "2026-08-10T02:52:00.000Z",
          completed_at: "2026-08-10T02:52:16.000Z",
          output_storage_path: "user-1/upscale-jobs/output.jpg",
          attempts: 1,
        });
        return { ok: true as const, runpodJobId: "runpod-req-1" };
      },
    });

    assert.equal(outcome.ok, true);
    assert.equal(triggerCount, 1);
  });

  await test("G. RunPod HTTP failures -> bounded retry then worker_trigger_failed", async () => {
    let triggerCount = 0;
    let job = baseJob();
    let failedErrorCode: string | null = null;

    const outcome = await dispatchUpscaleWorkerWithClaimVerification(JOB_ID, {
      sleep: async () => {},
      logEvent: () => {},
      getJob: async () => job,
      updateJob: async (_jobId, patch) => {
        failedErrorCode = patch.errorCode ?? null;
        job = {
          ...job,
          status: patch.status ?? job.status,
          error_code: patch.errorCode ?? job.error_code,
        };
        return job;
      },
      triggerRunPod: async () => {
        triggerCount += 1;
        return { ok: false as const, message: "RunPod trigger failed with status 502.", status: 502 };
      },
    });

    assert.equal(outcome.ok, false);
    if (!outcome.ok) {
      assert.equal(outcome.reason, "worker_trigger_failed");
    }
    assert.equal(triggerCount, MAX_DISPATCH_ATTEMPTS);
    assert.equal(failedErrorCode, "worker_trigger_failed");
  });

  await test("H. source: no claim-wait after successful trigger; route still awaits dispatch", () => {
    const triggerSource = readFileSync(join(process.cwd(), "lib/upscale-jobs/trigger-worker.ts"), "utf8");
    const claimSource = readFileSync(join(process.cwd(), "lib/upscale-jobs/dispatch-claim.ts"), "utf8");
    const pollingSource = readFileSync(join(process.cwd(), "scripts/verify-upscale-job-polling.ts"), "utf8");
    const terminalSource = readFileSync(join(process.cwd(), "lib/upscale-jobs/terminal-status.ts"), "utf8");
    const routeSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/jobs/route.ts"),
      "utf8",
    );

    assert.doesNotMatch(triggerSource, /visibilitychange/);
    assert.doesNotMatch(triggerSource, /UPSCALE_JOB_POLL_INTERVAL/);
    assert.doesNotMatch(triggerSource, /worker_claim_timeout/);
    assert.doesNotMatch(triggerSource, /waitForJobDispatch/);
    assert.doesNotMatch(triggerSource, /CLAIM_WAIT_MS/);
    assert.doesNotMatch(claimSource, /CLAIM_WAIT_MS/);
    assert.doesNotMatch(claimSource, /CLAIM_VERIFY_POLLS/);
    assert.match(terminalSource, /resolveUpscaleJobStatus/);
    assert.match(pollingSource, /getUpscaleJobPollAction/);
    assert.match(routeSource, /await triggerUpscaleWorkerAfterJobCreated\(jobId\)/);
    assert.match(triggerSource, /dispatchUpscaleWorkerWithClaimVerification/);
    assert.match(triggerSource, /RunPod trigger accepted/);
  });

  await test("jobs route awaits dispatch (not fire-and-forget)", () => {
    const routeSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/jobs/route.ts"),
      "utf8",
    );
    assert.match(routeSource, /await triggerUpscaleWorkerAfterJobCreated\(jobId\)/);
    assert.doesNotMatch(routeSource, /void triggerUpscaleWorkerAfterJobCreated/);
  });

  await test("I. retries stop immediately after first successful trigger", async () => {
    let triggerCount = 0;
    let job = baseJob();

    const outcome = await dispatchUpscaleWorkerWithClaimVerification(JOB_ID, {
      sleep: async () => {},
      logEvent: () => {},
      getJob: async () => job,
      updateJob: async () => job,
      triggerRunPod: async () => {
        triggerCount += 1;
        if (triggerCount === 1) {
          return { ok: false as const, message: "RunPod trigger failed with status 502.", status: 502 };
        }
        // Still queued — must not issue a third trigger.
        return { ok: true as const, runpodJobId: "runpod-req-2" };
      },
    });

    assert.equal(outcome.ok, true);
    assert.equal(triggerCount, 2);
  });

  console.log(`\n${passed}/${passed} upscale dispatch checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
