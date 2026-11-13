/**
 * Exercise both Image Upscaler POST handlers with mocked dependencies.
 * Run:
 * node --experimental-test-module-mocks --import file:///<tsx>/dist/loader.mjs scripts/verify-upscale-rollout-gate-http.mts
 */

import assert from "node:assert/strict";
import { mock } from "node:test";
import type { AuthUser, Profile, UserPlan } from "../types/auth";

const LISTED = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";
const BOUNDARY_JOB_ID = "boundary-not-submitted";
const ONE_PIXEL_PNG = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  "base64",
);

const SENSITIVE_PREFIXES = [
  "SUPABASE_",
  "NEXT_PUBLIC_SUPABASE_",
  "RUNPOD_",
  "REALESRGAN_",
  "STRIPE_",
  "NEXT_PUBLIC_STRIPE_",
  "OPENAI_",
  "UPSCALE_",
  "CRON_",
  "DATABASE_",
  "POSTGRES",
  "PG",
];

interface Effects {
  upload: number;
  create: number;
  charge: number;
  dispatch: number;
  usage: number;
  provider: number;
  fetch: number;
  admin: number;
  submit: number;
  recover: number;
  jobRead: number;
  signedUrl: number;
}

const effects: Effects = {
  upload: 0,
  create: 0,
  charge: 0,
  dispatch: 0,
  usage: 0,
  provider: 0,
  fetch: 0,
  admin: 0,
  submit: 0,
  recover: 0,
  jobRead: 0,
  signedUrl: 0,
};

const gateEnv = {
  realesrganServiceUrl: "",
  realesrganConfigured: false,
  cronSecret: "",
  supabaseUrl: "",
  supabasePublishableKey: "",
  supabaseServiceRoleKey: "",
  stripeSecretKey: "",
};

let sessionUser: AuthUser | null = null;
const originalFetch = globalThis.fetch;

function resetEffects(): void {
  (Object.keys(effects) as (keyof Effects)[]).forEach((key) => {
    effects[key] = 0;
  });
}

function assertNoWork(label: string): void {
  assert.deepEqual(
    {
      upload: effects.upload,
      create: effects.create,
      charge: effects.charge,
      dispatch: effects.dispatch,
      usage: effects.usage,
      provider: effects.provider,
      fetch: effects.fetch,
      admin: effects.admin,
      submit: effects.submit,
      recover: effects.recover,
      signedUrl: effects.signedUrl,
    },
    {
      upload: 0,
      create: 0,
      charge: 0,
      dispatch: 0,
      usage: 0,
      provider: 0,
      fetch: 0,
      admin: 0,
      submit: 0,
      recover: 0,
      signedUrl: 0,
    },
    label,
  );
}

function snapshotEnv(): Map<string, string | undefined> {
  const saved = new Map<string, string | undefined>();
  for (const key of Object.keys(process.env)) {
    if (SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix)) || key === "NODE_ENV") {
      saved.set(key, process.env[key]);
    }
  }
  return saved;
}

function clearSensitiveEnv(): void {
  for (const key of Object.keys(process.env)) {
    if (SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix))) {
      delete process.env[key];
    }
  }
}

function setEnvValue(key: string, value: string | undefined): void {
  if (value === undefined) delete process.env[key];
  else process.env[key] = value;
}

function restoreEnv(saved: Map<string, string | undefined>): void {
  for (const key of Object.keys(process.env)) {
    if (SENSITIVE_PREFIXES.some((prefix) => key.startsWith(prefix)) || key === "NODE_ENV") {
      if (!saved.has(key)) delete process.env[key];
    }
  }
  for (const [key, value] of saved) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
}

function installNetworkBlock(): void {
  globalThis.fetch = async (input) => {
    effects.fetch += 1;
    throw new Error(`blocked network ${String(input)}`);
  };
}

function blocked(name: keyof Effects): () => Promise<never> {
  return async () => {
    effects[name] += 1;
    throw new Error(`blocked ${name}`);
  };
}

function installMocks(): void {
  mock.module("@/config/env", {
    cache: true,
    namedExports: {
      env: gateEnv,
      isSupabaseConfigured: () => true,
      assertSupabaseConfigured: () => undefined,
      isRealEsrganConfigured: () => gateEnv.realesrganConfigured,
      assertStripeConfigured: () => {
        throw new Error("blocked stripe");
      },
      isStripeConfigured: () => false,
    },
  });

  mock.module("@/lib/auth/session", {
    cache: true,
    namedExports: {
      getAuthUser: async () => sessionUser,
      requireAuth: async () => {
        throw new Error("blocked requireAuth");
      },
    },
  });

  mock.module("@/lib/supabase/admin", {
    cache: true,
    namedExports: {
      createAdminClient: () => {
        effects.admin += 1;
        throw new Error("blocked admin client");
      },
    },
  });

  mock.module("@/lib/supabase/server", {
    cache: true,
    namedExports: {
      createClient: async () => {
        effects.admin += 1;
        throw new Error("blocked supabase server client");
      },
      createAnonymousClient: () => {
        effects.admin += 1;
        throw new Error("blocked anonymous supabase client");
      },
    },
  });

  mock.module("@/lib/security/rate-limit", {
    cache: true,
    namedExports: {
      enforceRateLimit: () => null,
      getClientIp: () => "local-test",
      checkRateLimit: () => ({ allowed: true, remaining: 1 }),
      rateLimitResponse: () => {
        throw new Error("blocked rate limit response");
      },
    },
  });

  mock.module("@/lib/plan/usage", {
    cache: true,
    namedExports: {
      consumeUsage: blocked("usage"),
    },
  });

  mock.module("@/lib/upscale-jobs/storage", {
    cache: true,
    namedExports: {
      uploadInput: blocked("upload"),
      getSignedResultUrl: blocked("signedUrl"),
    },
  });

  mock.module("@/lib/upscale-jobs/repository", {
    cache: true,
    namedExports: {
      createJob: blocked("create"),
      getJobForUser: async () => {
        effects.jobRead += 1;
        return null;
      },
      getJobById: async () => {
        effects.jobRead += 1;
        return null;
      },
      updateJob: async () => {
        throw new Error("blocked job update");
      },
    },
  });

  mock.module("@/lib/upscale-jobs/credits", {
    cache: true,
    namedExports: {
      chargeUpscaleJob: blocked("charge"),
      closeUnchargedUpscaleJob: async () => {
        throw new Error("blocked close");
      },
      abortUnclaimedUpscaleJob: async () => {
        throw new Error("blocked abort");
      },
      recoverStaleUpscaleJobs: blocked("recover"),
      dispatchAbortKeepsJob: () => false,
    },
  });

  mock.module("@/lib/upscale-jobs/submit-job", {
    cache: true,
    namedExports: {
      submitPreparedUpscaleJob: async () => {
        effects.submit += 1;
        return { status: "created", jobId: BOUNDARY_JOB_ID };
      },
    },
  });

  mock.module("@/lib/upscale-jobs/trigger-worker", {
    cache: true,
    namedExports: {
      triggerUpscaleWorkerAfterJobCreated: blocked("dispatch"),
    },
  });

  mock.module("@/lib/providers/upscale/realesrgan-provider", {
    cache: true,
    namedExports: {
      RealEsrganNotConfiguredError: class RealEsrganNotConfiguredError extends Error {},
      realEsrganProvider: {
        upscale: blocked("provider"),
      },
    },
  });
}

function setRollout(mode: string | undefined, allowlist?: string): void {
  if (mode === undefined) delete process.env.UPSCALE_ROLLOUT;
  else process.env.UPSCALE_ROLLOUT = mode;
  if (allowlist === undefined) delete process.env.UPSCALE_ALLOWLIST_USER_IDS;
  else process.env.UPSCALE_ALLOWLIST_USER_IDS = allowlist;
}

function setRunPodConfigured(configured: boolean): void {
  delete process.env.RUNPOD_ENDPOINT_ID;
  delete process.env.RUNPOD_API_BASE_URL;
  if (!configured) {
    delete process.env.RUNPOD_API_KEY;
    delete process.env.RUNPOD_UPSCALE_ENDPOINT_ID;
    return;
  }
  process.env.RUNPOD_API_KEY = "local-test-only";
  process.env.RUNPOD_UPSCALE_ENDPOINT_ID = "local-test-endpoint";
}

function setUser(
  userId: string,
  plan: UserPlan,
  subscriptionStatus: Profile["subscription_status"],
): void {
  sessionUser = {
    id: userId,
    email: "gate-test@example.test",
    profile: {
      id: userId,
      full_name: null,
      avatar_url: null,
      plan,
      subscription_status: subscriptionStatus,
      status: "active",
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    },
  };
}

function formRequest(url: string, claimedUserId: string): Request {
  const form = new FormData();
  form.set("userId", claimedUserId);
  form.set("user_id", claimedUserId);
  form.set("sessionUserId", claimedUserId);
  form.set("premium", "true");
  form.set("factor", "2");
  form.set("file", new File([ONE_PIXEL_PNG], "tiny.png", { type: "image/png" }));
  return new Request(url, {
    method: "POST",
    headers: { "x-user-id": claimedUserId },
    body: form,
  });
}

interface Handlers {
  jobs: (request: Request) => Promise<Response>;
  sync: (request: Request) => Promise<Response>;
  status: (
    request: Request,
    context: { params: Promise<{ id: string }> },
  ) => Promise<Response>;
  result: (
    request: Request,
    context: { params: Promise<{ id: string }> },
  ) => Promise<Response>;
  recover: (request: Request) => Promise<Response>;
}

async function loadHandlers(): Promise<Handlers> {
  const jobs = (await import("../app/api/tools/image/upscale/jobs/route")) as {
    POST: Handlers["jobs"];
  };
  const sync = (await import("../app/api/tools/image/upscale/route")) as {
    POST: Handlers["sync"];
  };
  const status = (await import("../app/api/tools/image/upscale/jobs/[id]/route")) as {
    GET: Handlers["status"];
  };
  const result = (await import("../app/api/tools/image/upscale/jobs/[id]/result/route")) as {
    GET: Handlers["result"];
  };
  const recover = (await import("../app/api/cron/upscale-jobs/recover/route")) as {
    GET: Handlers["recover"];
  };
  return {
    jobs: jobs.POST,
    sync: sync.POST,
    status: status.GET,
    result: result.GET,
    recover: recover.GET,
  };
}

async function bodyOf(response: Response): Promise<{ code?: string; error?: string; jobId?: string }> {
  return (await response.json()) as { code?: string; error?: string; jobId?: string };
}

async function main(): Promise<void> {
  const saved = snapshotEnv();
  clearSensitiveEnv();
  setEnvValue("NODE_ENV", "test");
  installNetworkBlock();
  installMocks();

  let passed = 0;
  const test = async (name: string, fn: () => Promise<void>) => {
    resetEffects();
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  };

  try {
    const handlers = await loadHandlers();

    await test("missing rollout mode denies both premium POST handlers", async () => {
      setRunPodConfigured(true);
      setRollout(undefined, LISTED);
      gateEnv.realesrganServiceUrl = "http://127.0.0.1:9/must-not-be-called";
      setUser(LISTED, "pro", "active");

      const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", OTHER));
      const syncResponse = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", OTHER));
      const jobsBody = await bodyOf(jobsResponse);
      const syncBody = await bodyOf(syncResponse);

      assert.equal(jobsResponse.status, 403);
      assert.equal(syncResponse.status, 403);
      assert.equal(jobsBody.code, "ROLLOUT_CLOSED");
      assert.equal(syncBody.code, "ROLLOUT_CLOSED");
      assertNoWork("missing mode");
    });

    await test("unknown rollout mode denies both premium POST handlers", async () => {
      setRunPodConfigured(true);
      setRollout("enabled", LISTED);
      gateEnv.realesrganServiceUrl = "http://127.0.0.1:9/must-not-be-called";
      setUser(LISTED, "pro", "active");

      const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", LISTED));
      const syncResponse = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", LISTED));

      assert.equal(jobsResponse.status, 403);
      assert.equal(syncResponse.status, 403);
      assert.equal((await bodyOf(jobsResponse)).code, "ROLLOUT_CLOSED");
      assert.equal((await bodyOf(syncResponse)).code, "ROLLOUT_CLOSED");
      assertNoWork("unknown mode");
    });

    await test("allowlist mode denies an unlisted premium user on both POST handlers", async () => {
      setRunPodConfigured(true);
      setRollout("allowlist", LISTED);
      gateEnv.realesrganServiceUrl = "";
      gateEnv.realesrganConfigured = true;
      setUser(OTHER, "pro", "active");

      const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", LISTED));
      const syncResponse = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", LISTED));

      assert.equal(jobsResponse.status, 403);
      assert.equal(syncResponse.status, 403);
      assert.equal((await bodyOf(jobsResponse)).code, "ROLLOUT_CLOSED");
      assert.equal((await bodyOf(syncResponse)).code, "ROLLOUT_CLOSED");
      assertNoWork("unlisted premium");
    });

    await test("allowlist mode admits only the authenticated listed user", async () => {
      setRunPodConfigured(true);
      setRollout("allowlist", LISTED);
      gateEnv.realesrganServiceUrl = "http://127.0.0.1:9/must-not-be-called";
      gateEnv.realesrganConfigured = true;
      setUser(LISTED, "pro", "active");

      const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", OTHER));
      const jobsBody = await bodyOf(jobsResponse);
      assert.equal(jobsResponse.status, 201);
      assert.equal(jobsBody.jobId, BOUNDARY_JOB_ID);
      assert.equal(effects.submit, 1);
      assert.equal(effects.upload, 0);
      assert.equal(effects.create, 0);
      assert.equal(effects.charge, 0);
      assert.equal(effects.dispatch, 0);
      assert.equal(effects.usage, 0);
      assert.equal(effects.provider, 0);
      assert.equal(effects.fetch, 0);
      assert.equal(effects.admin, 0);

      resetEffects();
      const syncResponse = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", OTHER));
      const syncBody = await bodyOf(syncResponse);
      assert.equal(syncResponse.status, 409);
      assert.equal(syncBody.code, "ASYNC_REQUIRED");
      assertNoWork("listed sync boundary");
    });

    await test("malformed allowlist fails closed for a listed premium user", async () => {
      setRunPodConfigured(true);
      setRollout("allowlist", `${LISTED},not-a-uuid`);
      gateEnv.realesrganServiceUrl = "http://127.0.0.1:9/must-not-be-called";
      setUser(LISTED, "pro", "active");

      const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", LISTED));
      const syncResponse = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", LISTED));

      assert.equal(jobsResponse.status, 403);
      assert.equal(syncResponse.status, 403);
      assert.equal((await bodyOf(jobsResponse)).code, "ROLLOUT_CLOSED");
      assert.equal((await bodyOf(syncResponse)).code, "ROLLOUT_CLOSED");
      assertNoWork("malformed allowlist");
    });

    await test("open mode admits an entitled premium user through both handlers", async () => {
      setRunPodConfigured(true);
      setRollout("open", "not-a-uuid");
      gateEnv.realesrganServiceUrl = "http://127.0.0.1:9/must-not-be-called";
      setUser(OTHER, "pro", "active");

      const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", LISTED));
      assert.equal(jobsResponse.status, 201);
      assert.equal((await bodyOf(jobsResponse)).jobId, BOUNDARY_JOB_ID);
      assert.equal(effects.submit, 1);
      assert.equal(effects.charge, 0);
      assert.equal(effects.dispatch, 0);
      assert.equal(effects.provider, 0);
      assert.equal(effects.fetch, 0);

      resetEffects();
      const syncResponse = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", LISTED));
      assert.equal(syncResponse.status, 409);
      assert.equal((await bodyOf(syncResponse)).code, "ASYNC_REQUIRED");
      assertNoWork("open sync boundary");
    });

    await test("free and inactive accounts cannot bypass premium entitlement", async () => {
      setRunPodConfigured(true);
      setRollout("open", LISTED);
      gateEnv.realesrganServiceUrl = "";
      gateEnv.realesrganConfigured = true;

      for (const account of [
        { plan: "free" as const, subscription: null },
        { plan: "pro" as const, subscription: "canceled" as const },
      ]) {
        resetEffects();
        setUser(LISTED, account.plan, account.subscription);
        const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", LISTED));
        const syncResponse = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", LISTED));
        const jobsBody = await bodyOf(jobsResponse);
        const syncBody = await bodyOf(syncResponse);
        assert.equal(jobsResponse.status, 403);
        assert.equal(syncResponse.status, 403);
        assert.equal(jobsBody.code, "plan_restricted");
        assert.equal(syncBody.code, "plan_restricted");
        assertNoWork(account.plan);
      }
    });

    await test("caller-supplied user ids do not override the session", async () => {
      setRunPodConfigured(true);
      setRollout("allowlist", LISTED);
      gateEnv.realesrganServiceUrl = "";
      gateEnv.realesrganConfigured = true;
      setUser(OTHER, "pro", "active");

      const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", LISTED));
      const syncResponse = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", LISTED));
      assert.equal(jobsResponse.status, 403);
      assert.equal(syncResponse.status, 403);
      assert.equal((await bodyOf(jobsResponse)).code, "ROLLOUT_CLOSED");
      assert.equal((await bodyOf(syncResponse)).code, "ROLLOUT_CLOSED");
      assertNoWork("caller supplied id");
    });

    await test("missing RunPod endpoint refuses the jobs handler before any charge", async () => {
      setRunPodConfigured(false);
      setRollout("open");
      setUser(LISTED, "pro", "active");

      const jobsResponse = await handlers.jobs(formRequest("http://127.0.0.1/api/tools/image/upscale/jobs", LISTED));
      const jobsBody = await bodyOf(jobsResponse);
      assert.equal(jobsResponse.status, 503);
      assert.equal(jobsBody.code, "NOT_CONFIGURED");
      assertNoWork("missing endpoint");
    });

    await test("denied legacy handler reaches neither provider nor usage charge", async () => {
      setRunPodConfigured(true);
      setRollout("allowlist", LISTED);
      setUser(OTHER, "pro", "active");

      gateEnv.realesrganServiceUrl = "http://127.0.0.1:9/must-not-be-called";
      gateEnv.realesrganConfigured = true;
      const withService = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", LISTED));
      assert.equal(withService.status, 403);
      assertNoWork("legacy denied with service url");

      resetEffects();
      gateEnv.realesrganServiceUrl = "";
      gateEnv.realesrganConfigured = true;
      const localProvider = await handlers.sync(formRequest("http://127.0.0.1/api/tools/image/upscale", LISTED));
      assert.equal(localProvider.status, 403);
      assert.equal((await bodyOf(localProvider)).code, "ROLLOUT_CLOSED");
      assertNoWork("legacy denied with local provider configured");
    });

    await test("status, result, and recovery handlers stay outside the rollout gate", async () => {
      setRollout(undefined, `${LISTED},not-a-uuid`);
      setUser(OTHER, "pro", "active");
      const context = { params: Promise.resolve({ id: "job-local-test" }) };

      const statusResponse = await handlers.status(
        new Request("http://127.0.0.1/api/tools/image/upscale/jobs/job-local-test"),
        context,
      );
      const resultResponse = await handlers.result(
        new Request("http://127.0.0.1/api/tools/image/upscale/jobs/job-local-test/result"),
        context,
      );
      const recoverResponse = await handlers.recover(
        new Request("http://127.0.0.1/api/cron/upscale-jobs/recover"),
      );

      assert.equal(statusResponse.status, 404);
      assert.equal(resultResponse.status, 404);
      assert.equal(recoverResponse.status, 401);
      assert.notEqual((await bodyOf(statusResponse)).code, "ROLLOUT_CLOSED");
      assert.notEqual((await bodyOf(resultResponse)).code, "ROLLOUT_CLOSED");
      assert.notEqual((await bodyOf(recoverResponse)).code, "ROLLOUT_CLOSED");
      assert.equal(effects.charge, 0);
      assert.equal(effects.recover, 0);
      assert.equal(effects.fetch, 0);
      assert.equal(effects.admin, 0);
      assert.equal(effects.jobRead, 2);
    });

    console.log(`\n${passed}/${passed} upscale rollout HTTP handler checks passed.`);
  } finally {
    globalThis.fetch = originalFetch;
    restoreEnv(saved);
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
