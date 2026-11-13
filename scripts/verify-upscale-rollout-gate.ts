/**
 * Fail-closed Image Upscaler rollout gate.
 * Run: npx tsx scripts/verify-upscale-rollout-gate.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  authorizeUpscaleSubmission,
  type UpscaleRolloutEnv,
  type UpscaleSubmissionIdentity,
} from "../lib/upscale-jobs/rollout-gate";

const LISTED = "11111111-1111-4111-8111-111111111111";
const OTHER = "22222222-2222-4222-8222-222222222222";

function withEnv(
  vars: Record<string, string | undefined>,
  fn: () => Promise<void>,
): Promise<void> {
  const previous: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(vars)) {
    previous[key] = process.env[key];
    if (value === undefined) {
      delete process.env[key];
    } else {
      process.env[key] = value;
    }
  }

  return Promise.resolve(fn()).finally(() => {
    for (const [key, value] of Object.entries(previous)) {
      if (value === undefined) {
        delete process.env[key];
      } else {
        process.env[key] = value;
      }
    }
  });
}

function allowlistEnv(ids: string | undefined): UpscaleRolloutEnv {
  return {
    UPSCALE_ROLLOUT: "allowlist",
    UPSCALE_ALLOWLIST_USER_IDS: ids,
  };
}

function premium(sessionUserId: string): UpscaleSubmissionIdentity {
  return { sessionUserId, premiumEntitled: true };
}

async function assertDenied(
  identity: UpscaleSubmissionIdentity,
  env?: UpscaleRolloutEnv,
): Promise<void> {
  const calls: string[] = [];
  const decision = authorizeUpscaleSubmission(identity, env);
  if (decision.allowed) {
    calls.push("upload", "createJob", "charge", "dispatch");
  }

  assert.equal(decision.allowed, false);
  assert.deepEqual(calls, []);
  if (!decision.allowed) {
    const body = await decision.response.json();
    const serialized = JSON.stringify(body);
    assert.equal(decision.response.status, 403);
    assert.equal(body.code, "ROLLOUT_CLOSED");
    assert.equal(body.error, "Image upscaling is not available.");
    assert.equal(Object.keys(body).length, 2);
    assert.doesNotMatch(serialized, new RegExp(LISTED, "i"));
    assert.doesNotMatch(serialized, new RegExp(OTHER, "i"));
    assert.doesNotMatch(serialized, /UPSCALE_/);
    assert.doesNotMatch(serialized, /allowlist/i);
  }
}

async function assertAllowed(
  identity: UpscaleSubmissionIdentity,
  env?: UpscaleRolloutEnv,
): Promise<void> {
  const decision = authorizeUpscaleSubmission(identity, env);
  assert.equal(decision.allowed, true);
}

function gateExpression(source: string): string {
  const match = source.match(/const rollout = authorizeUpscaleSubmission\(\{[\s\S]*?\}\);/);
  assert.ok(match, "route is missing the shared rollout gate");
  return match[0];
}

function assertEarlier(source: string, earlier: string, later: string): void {
  const earlierIndex = source.indexOf(earlier);
  const laterIndex = source.indexOf(later);
  assert.ok(earlierIndex >= 0, `missing: ${earlier}`);
  assert.ok(laterIndex > earlierIndex, `${earlier} must run before ${later}`);
}

async function main(): Promise<void> {
  let passed = 0;

  async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  }

  await test("missing rollout mode denies a premium user before side effects", async () => {
    await assertDenied(premium(LISTED), {});
  });

  await test("empty rollout mode denies a premium user", async () => {
    await assertDenied(premium(LISTED), { UPSCALE_ROLLOUT: "   " });
  });

  await test("invalid rollout mode denies a premium user", async () => {
    await assertDenied(premium(LISTED), {
      UPSCALE_ROLLOUT: "enabled",
      UPSCALE_ALLOWLIST_USER_IDS: LISTED,
    });
  });

  await test("allowlist mode with missing ids denies the listed shape of user", async () => {
    await assertDenied(premium(LISTED), allowlistEnv(undefined));
    await assertDenied(premium(LISTED), allowlistEnv(""));
    await assertDenied(premium(LISTED), allowlistEnv(" , , "));
  });

  await test("allowlist mode with a malformed id denies every user", async () => {
    await assertDenied(premium(LISTED), allowlistEnv(`${LISTED},not-a-uuid`));
    await assertDenied(premium(LISTED), allowlistEnv("not-a-uuid"));
  });

  await test("allowlisted premium user is allowed", async () => {
    await assertAllowed(premium(LISTED.toUpperCase()), allowlistEnv(` ${LISTED} `));
  });

  await test("non-allowlisted premium user is denied", async () => {
    await assertDenied(premium(OTHER), allowlistEnv(LISTED));
  });

  await test("non-premium user is denied in allowlist and open modes", async () => {
    await assertDenied(
      { sessionUserId: LISTED, premiumEntitled: false },
      allowlistEnv(LISTED),
    );
    await assertDenied(
      { sessionUserId: LISTED, premiumEntitled: false },
      { UPSCALE_ROLLOUT: "open" },
    );
  });

  await test("open mode allows a premium user and still denies a non-premium user", async () => {
    await assertAllowed(premium(OTHER), {
      UPSCALE_ROLLOUT: " open ",
      UPSCALE_ALLOWLIST_USER_IDS: "not-a-uuid",
    });
    await assertDenied(
      { sessionUserId: OTHER, premiumEntitled: false },
      { UPSCALE_ROLLOUT: "open" },
    );
  });

  await test("unset process env denies even when NODE_ENV is production", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        UPSCALE_ROLLOUT: undefined,
        UPSCALE_ALLOWLIST_USER_IDS: LISTED,
      },
      async () => {
        await assertDenied(premium(LISTED));
      },
    );
  });

  await test("explicit open is the only open setting and is not implied by production", async () => {
    await withEnv(
      {
        NODE_ENV: "production",
        UPSCALE_ROLLOUT: "open",
        UPSCALE_ALLOWLIST_USER_IDS: undefined,
      },
      async () => {
        await assertAllowed(premium(OTHER));
      },
    );
  });

  await test("a client-supplied user id cannot replace the session user id", async () => {
    const claimedUserId = LISTED;
    const decision = authorizeUpscaleSubmission(
      premium(OTHER),
      allowlistEnv(claimedUserId),
    );
    assert.equal(decision.allowed, false);
    assert.notEqual(OTHER, claimedUserId);
  });

  await test("both POST routes use the same gate before upload, charge, or dispatch", async () => {
    const jobsSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/jobs/route.ts"),
      "utf8",
    );
    const syncSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/route.ts"),
      "utf8",
    );
    const helperSource = readFileSync(
      join(process.cwd(), "lib/upscale-jobs/rollout-gate.ts"),
      "utf8",
    );
    const statusSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/jobs/[id]/route.ts"),
      "utf8",
    );
    const resultSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/jobs/[id]/result/route.ts"),
      "utf8",
    );
    const cronSource = readFileSync(
      join(process.cwd(), "app/api/cron/upscale-jobs/recover/route.ts"),
      "utf8",
    );

    assert.equal(gateExpression(jobsSource), gateExpression(syncSource));
    assert.match(jobsSource, /from "@\/lib\/upscale-jobs\/rollout-gate"/);
    assert.match(syncSource, /from "@\/lib\/upscale-jobs\/rollout-gate"/);

    assertEarlier(jobsSource, "await requirePremiumAiPlan(ROUTE)", "authorizeUpscaleSubmission(");
    assertEarlier(jobsSource, "if (access instanceof NextResponse)", "authorizeUpscaleSubmission(");
    assertEarlier(jobsSource, "if (!rollout.allowed)", "await request.formData()");
    assertEarlier(jobsSource, "if (!rollout.allowed)", "readImageFromFormData(");
    assertEarlier(jobsSource, "if (!rollout.allowed)", "uploadInput,");
    assertEarlier(jobsSource, "if (!rollout.allowed)", "createJob,");
    assertEarlier(jobsSource, "if (!rollout.allowed)", "chargeUpscaleJob(");
    assertEarlier(jobsSource, "if (!rollout.allowed)", "await submitPreparedUpscaleJob(");
    assertEarlier(jobsSource, "if (!rollout.allowed)", "dispatchJob: triggerUpscaleWorkerAfterJobCreated");
    assert.doesNotMatch(jobsSource, /formData\.get\(\s*["'](?:userId|user_id|premium)["']/);
    assert.doesNotMatch(jobsSource, /realEsrganProvider/);

    assertEarlier(syncSource, "await requirePremiumAiPlan(route)", "authorizeUpscaleSubmission(");
    assertEarlier(syncSource, "if (access instanceof NextResponse)", "authorizeUpscaleSubmission(");
    assertEarlier(syncSource, "if (!rollout.allowed)", "handleImageToolRequest(");
    assertEarlier(syncSource, "if (!rollout.allowed)", "realEsrganProvider.upscale(");
    assertEarlier(syncSource, "if (!rollout.allowed)", "env.realesrganServiceUrl");
    assert.doesNotMatch(syncSource, /formData\.get\(\s*["'](?:userId|user_id|premium)["']/);
    assert.doesNotMatch(syncSource, /submitPreparedUpscaleJob|chargeUpscaleJob|createJob\(/);

    assert.doesNotMatch(helperSource, /NODE_ENV/);
    assert.doesNotMatch(helperSource, /NEXT_PUBLIC_UPSCALE/);
    assert.doesNotMatch(
      helperSource,
      /chargeUpscaleJob|createJob|uploadInput|triggerUpscaleWorker|realEsrganProvider|consumeUsage/,
    );

    for (const source of [statusSource, resultSource, cronSource]) {
      assert.doesNotMatch(source, /authorizeUpscaleSubmission|UPSCALE_ROLLOUT/);
    }
  });

  console.log(`\n${passed}/${passed} upscale rollout gate checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
