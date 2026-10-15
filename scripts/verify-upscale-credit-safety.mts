/**
 * Local checks for upscaler credit safety. Does not connect to Supabase or RunPod.
 * Run: node --experimental-strip-types --test scripts/verify-upscale-credit-safety.mts
 */
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import sharp from "sharp";
import { inspectUpscaleInput } from "../lib/upscale-jobs/inspect-input";
import {
  submitPreparedUpscaleJob,
  type UpscaleSubmitDeps,
} from "../lib/upscale-jobs/submit-job";
import type { ImageToolFileInput } from "../lib/tools/shared/api-handler";

const migration = readFileSync(
  new URL("../supabase/migrations/018_upscale_job_credits.sql", import.meta.url),
  "utf8",
);
const migration019 = readFileSync(
  new URL("../supabase/migrations/019_upscale_worker_safety.sql", import.meta.url),
  "utf8",
);

function imageFile(bytes: Buffer, type = "image/png"): ImageToolFileInput {
  const file = new File([new Uint8Array(bytes)], "sample.png", { type });
  return { file, buffer: bytes, mimeType: type };
}

function deps(overrides: Partial<UpscaleSubmitDeps> = {}): UpscaleSubmitDeps & {
  calls: string[];
} {
  const calls: string[] = [];
  const usage = {
    usageCount: 1,
    limit: 500,
    remaining: 499,
    resetAt: "2026-11-01T00:00:00.000Z",
  };
  return {
    calls,
    createJobId: overrides.createJobId ?? (() => "job-1"),
    uploadInput: async (path, buffer, mimeType) => {
      calls.push("upload");
      await overrides.uploadInput?.(path, buffer, mimeType);
    },
    createJob: async (input) => {
      calls.push("create");
      if (overrides.createJob) return overrides.createJob(input);
      return { id: "job-1" };
    },
    chargeJob: async (jobId) => {
      calls.push("charge");
      if (overrides.chargeJob) return overrides.chargeJob(jobId);
      return { outcome: "charged", allowed: true, usage };
    },
    closeUnchargedJob: async (jobId, errorCode, errorMessage) => {
      calls.push("close");
      if (overrides.closeUnchargedJob) {
        return overrides.closeUnchargedJob(jobId, errorCode, errorMessage);
      }
      return "cancelled";
    },
    dispatchJob: async (jobId) => {
      calls.push("dispatch");
      await overrides.dispatchJob?.(jobId);
    },
    failChargedJob: async (jobId, errorCode, errorMessage) => {
      calls.push("fail");
      if (overrides.failChargedJob) return overrides.failChargedJob(jobId, errorCode, errorMessage);
      return "refunded";
    },
  };
}

test("invalid image is rejected before a job or charge", async () => {
  await assert.rejects(
    () => inspectUpscaleInput(Buffer.from("not-an-image"), 2),
    /Could not read image dimensions/,
  );
});

test("oversized output is rejected before a job or charge", async () => {
  const wide = await sharp({
    create: { width: 9000, height: 1, channels: 3, background: { r: 0, g: 0, b: 0 } },
  })
    .png()
    .toBuffer();
  await assert.rejects(
    () => inspectUpscaleInput(wide, 2),
    /maximum supported dimensions/,
  );
});

test("successful job charges once and only then dispatches", async () => {
  const harness = deps();
  const png = await sharp({
    create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
  })
    .png()
    .toBuffer();
  const inspected = await inspectUpscaleInput(png, 2);
  const result = await submitPreparedUpscaleJob(
    { userId: "user-1", scale: 2, file: imageFile(png), width: inspected.width, height: inspected.height },
    harness,
  );
  assert.deepEqual(result, { status: "created", jobId: "job-1" });
  assert.deepEqual(harness.calls, ["upload", "create", "charge", "dispatch"]);
});

test("quota denial does not dispatch", async () => {
  const harness = deps({
    chargeJob: async () => ({
      outcome: "denied",
      allowed: false,
      usage: { usageCount: 500, limit: 500, remaining: 0, resetAt: "2026-11-01T00:00:00.000Z" },
    }),
  });
  const result = await submitPreparedUpscaleJob(
    { userId: "user-1", scale: 2, file: imageFile(Buffer.from("x")), width: 8, height: 8 },
    harness,
  );
  assert.equal(result.status, "denied");
  assert.deepEqual(harness.calls, ["upload", "create", "charge", "close"]);
});

test("job creation failure does not charge", async () => {
  const harness = deps({
    createJob: async () => {
      throw new Error("insert failed");
    },
  });
  const result = await submitPreparedUpscaleJob(
    { userId: "user-1", scale: 2, file: imageFile(Buffer.from("x")), width: 8, height: 8 },
    harness,
  );
  assert.equal(result.status, "create_failed");
  assert.deepEqual(harness.calls, ["upload", "create"]);
});

test("dispatch failure refunds the charged job", async () => {
  const harness = deps({
    dispatchJob: async () => {
      throw new Error("Could not start upscaling worker. Please try again.");
    },
  });
  const result = await submitPreparedUpscaleJob(
    { userId: "user-1", scale: 2, file: imageFile(Buffer.from("x")), width: 8, height: 8 },
    harness,
  );
  assert.equal(result.status, "dispatch_failed");
  assert.deepEqual(harness.calls, ["upload", "create", "charge", "dispatch", "fail"]);
});

interface LedgerJob {
  status: "queued" | "processing" | "completed" | "failed" | "cancelled";
  charged: boolean;
  refunded: boolean;
  attempts: number;
  maxAttempts: number;
  createdAt: number;
  startedAt: number | null;
}

function ledger() {
  let usage = 0;
  const jobs = new Map<string, LedgerJob>();
  let chain: Promise<void> = Promise.resolve();

  function lock<T>(fn: () => T): Promise<T> {
    const run = chain.then(fn, fn);
    chain = run.then(
      () => undefined,
      () => undefined,
    );
    return run;
  }

  return {
    usage: () => usage,
    add(id: string, createdAt: number) {
      jobs.set(id, {
        status: "queued",
        charged: false,
        refunded: false,
        attempts: 0,
        maxAttempts: 3,
        createdAt,
        startedAt: null,
      });
    },
    charge(id: string, limit: number) {
      return lock(() => {
        const job = jobs.get(id);
        if (!job || job.refunded || job.status !== "queued") return "rejected";
        if (job.charged) return "already_charged";
        if (usage >= limit) return "denied";
        usage += 1;
        job.charged = true;
        return "charged";
      });
    },
    fail(id: string) {
      return lock(() => {
        const job = jobs.get(id);
        if (!job || job.status === "completed") return "completed";
        if (job.refunded) return "already_refunded";
        if (job.status === "queued" || job.status === "processing") job.status = "failed";
        if (!job.charged) return "not_charged";
        if (usage <= 0) {
          job.charged = false;
          job.refunded = true;
          return "refunded_without_decrement";
        }
        usage -= 1;
        job.charged = false;
        job.refunded = true;
        return "refunded";
      });
    },
    complete(id: string) {
      return lock(() => {
        const job = jobs.get(id);
        if (!job || job.refunded || job.status === "failed" || job.status === "cancelled" || !job.charged) {
          return "rejected";
        }
        if (job.status === "completed") return "already_completed";
        job.status = "completed";
        return "completed";
      });
    },
    recover(now: number, staleMs: number) {
      return lock(() => {
        for (const job of jobs.values()) {
          const stale =
            job.status === "processing" &&
            job.startedAt !== null &&
            now - job.startedAt >= staleMs;
          if (!stale || job.refunded) continue;
          if (job.attempts < job.maxAttempts) {
            job.status = "queued";
            job.startedAt = null;
            continue;
          }
          job.status = "failed";
        }
        for (const job of jobs.values()) {
          if (
            job.status === "queued" &&
            job.charged &&
            !job.refunded &&
            job.startedAt === null &&
            now - job.createdAt >= 6 * 60 * 60 * 1000
          ) {
            job.status = "failed";
          }
        }
        for (const job of jobs.values()) {
          if ((job.status === "failed" || job.status === "cancelled") && job.charged && !job.refunded) {
            if (usage > 0) usage -= 1;
            job.charged = false;
            job.refunded = true;
          }
        }
      });
    },
    claim(id: string, now: number) {
      return lock(() => {
        const job = jobs.get(id);
        if (!job || job.status !== "queued" || !job.charged || job.refunded) return false;
        if (job.attempts >= job.maxAttempts) return false;
        job.status = "processing";
        job.startedAt = now;
        job.attempts += 1;
        return true;
      });
    },
    abort(id: string) {
      return lock(() => {
        const job = jobs.get(id);
        if (!job) return "not_found";
        if (job.status === "completed") return "completed";
        if (job.refunded) return "already_refunded";
        if (job.status === "queued" && job.startedAt === null && job.charged) {
          job.status = "failed";
          if (usage > 0) usage -= 1;
          job.charged = false;
          job.refunded = true;
          return "refunded";
        }
        if (job.status === "processing") return "in_progress";
        return "unchanged";
      });
    },
    job: (id: string) => jobs.get(id),
  };
}

test("worker failure refunds once and a duplicate refund does not", async () => {
  const book = ledger();
  book.add("job", 0);
  assert.equal(await book.charge("job", 500), "charged");
  assert.equal(await book.claim("job", 1_000), true);
  assert.equal(await book.fail("job"), "refunded");
  assert.equal(book.usage(), 0);
  assert.equal(await book.fail("job"), "already_refunded");
  assert.equal(book.usage(), 0);
  assert.equal(await book.charge("job", 500), "rejected");
});

test("retry requeues without a refund and the final stale failure refunds", async () => {
  const book = ledger();
  book.add("job", 0);
  await book.charge("job", 500);
  await book.claim("job", 0);
  await book.recover(600_000, 600_000);
  assert.equal(book.job("job")?.status, "queued");
  assert.equal(book.usage(), 1);
  await book.claim("job", 600_000);
  await book.recover(1_200_000, 600_000);
  assert.equal(book.job("job")?.status, "queued");
  assert.equal(book.usage(), 1);
  await book.claim("job", 1_200_000);
  await book.recover(1_800_000, 600_000);
  assert.equal(book.job("job")?.status, "failed");
  assert.equal(book.job("job")?.refunded, true);
  assert.equal(book.usage(), 0);
});

test("a queued job inside the cold-start window is kept, and a six-hour-old job is refunded", async () => {
  const book = ledger();
  book.add("fresh", 0);
  book.add("old", 0);
  await book.charge("fresh", 500);
  await book.charge("old", 500);
  await book.recover(30 * 60 * 1000, 600_000);
  assert.equal(book.job("fresh")?.status, "queued");
  assert.equal(book.usage(), 2);
  await book.recover(6 * 60 * 60 * 1000, 600_000);
  assert.equal(book.job("fresh")?.refunded, true);
  assert.equal(book.job("old")?.refunded, true);
  assert.equal(book.usage(), 0);
});

test("concurrent charges stop at the shared quota", async () => {
  const book = ledger();
  book.add("a", 0);
  book.add("b", 0);
  const results = await Promise.all([book.charge("a", 1), book.charge("b", 1)]);
  assert.deepEqual(results.sort(), ["charged", "denied"]);
  assert.equal(book.usage(), 1);
});

test("a late worker cannot complete a refunded job", async () => {
  const book = ledger();
  book.add("job", 0);
  await book.charge("job", 500);
  await book.fail("job");
  assert.equal(await book.complete("job"), "rejected");
  assert.equal(book.job("job")?.status, "failed");
  assert.equal(book.usage(), 0);
});

test("a completed job is not refunded", async () => {
  const book = ledger();
  book.add("job", 0);
  await book.charge("job", 500);
  await book.claim("job", 1);
  assert.equal(await book.complete("job"), "completed");
  assert.equal(await book.fail("job"), "completed");
  assert.equal(book.usage(), 1);
});

test("claim refuses a queued job that is already at max attempts", async () => {
  const book = ledger();
  book.add("job", 0);
  await book.charge("job", 500);
  const job = book.job("job");
  if (!job) throw new Error("missing job");
  job.attempts = job.maxAttempts;
  assert.equal(await book.claim("job", 1_000), false);
  assert.equal(book.job("job")?.status, "queued");
  assert.equal(book.job("job")?.attempts, 3);
  assert.equal(book.usage(), 1);
});

test("abort refunds an unclaimed job and leaves a claimed job charged", async () => {
  const book = ledger();
  book.add("fresh", 0);
  book.add("claimed", 0);
  await book.charge("fresh", 500);
  await book.charge("claimed", 500);
  await book.claim("claimed", 1_000);
  assert.equal(await book.abort("claimed"), "in_progress");
  assert.equal(book.job("claimed")?.status, "processing");
  assert.equal(await book.abort("fresh"), "refunded");
  assert.equal(book.usage(), 1);
  assert.equal(await book.abort("fresh"), "already_refunded");
  assert.equal(book.usage(), 1);
});

test("dispatch failure that finds the job in progress keeps it", async () => {
  const harness = deps({
    dispatchJob: async () => {
      throw new Error("Could not start upscaling worker. Please try again.");
    },
    failChargedJob: async () => "in_progress",
  });
  const result = await submitPreparedUpscaleJob(
    { userId: "user-1", scale: 2, file: imageFile(Buffer.from("x")), width: 8, height: 8 },
    harness,
  );
  assert.deepEqual(result, { status: "created", jobId: "job-1" });
  assert.deepEqual(harness.calls, ["upload", "create", "charge", "dispatch", "fail"]);
});

test("migration 018 keeps the shared counter and the credit guards", () => {
  assert.match(migration, /action = 'tool_operation'/);
  assert.match(migration, /usage_count > 0/);
  assert.match(migration, /usage_count < p_limit/);
  assert.match(migration, /for update skip locked/);
  assert.match(migration, /interval '6 hours'/);
  assert.match(migration, /attempts < max_attempts/);
  assert.match(migration, /refunded upscale job cannot be completed/);
  assert.match(migration, /completed upscale job cannot change status/);
  assert.match(migration, /new upscale jobs must start uncharged/);
  assert.doesNotMatch(migration, /create or replace function public\.consume_tool_usage/);
});

test("migration 019 guards claim attempts and clears the write flag", () => {
  assert.match(migration019, /attempts < max_attempts/);
  assert.match(migration019, /abort_unclaimed_upscale_job/);
  assert.match(migration019, /fail_owned_upscale_job/);
  assert.match(migration019, /complete_owned_upscale_job/);
  assert.match(migration019, /scanonix\.upscale_job_write', '', true/);
  assert.match(migration019, /must change through an upscale job function/);
  assert.doesNotMatch(migration019, /create or replace function public\.charge_upscale_job/);
  assert.doesNotMatch(migration019, /create or replace function public\.refund_upscale_job/);
});
