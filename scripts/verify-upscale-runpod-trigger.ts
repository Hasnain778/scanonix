/**
 * Verify RunPod async upscale worker trigger (Phase 8G.10).
 * Run: npx tsx scripts/verify-upscale-runpod-trigger.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  buildRunPodPollOnceRunUrl,
  isRunPodUpscaleTriggerConfigured,
  readRunPodUpscaleEndpointId,
  triggerRunPodPollOnce,
} from "../lib/upscale-jobs/runpod-trigger";

function withEnv(vars: Record<string, string | undefined>, fn: () => void | Promise<void>): Promise<void> {
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

async function main(): Promise<void> {
  let passed = 0;

  async function test(name: string, fn: () => void | Promise<void>): Promise<void> {
    await fn();
    passed += 1;
    console.log(`✓ ${name}`);
  }

  await test("missing env → trigger not configured", async () => {
    await withEnv(
      {
        RUNPOD_API_KEY: undefined,
        RUNPOD_UPSCALE_ENDPOINT_ID: undefined,
        RUNPOD_ENDPOINT_ID: undefined,
      },
      () => {
        assert.equal(isRunPodUpscaleTriggerConfigured(), false);
      },
    );
  });

  await test("successful trigger calls RunPod /run once with poll_once input", async () => {
    let callCount = 0;

    await withEnv(
      {
        RUNPOD_API_KEY: "test-api-key",
        RUNPOD_UPSCALE_ENDPOINT_ID: "endpoint-abc123",
      },
      async () => {
        const mockFetch = (async (url: string | URL | Request, init?: RequestInit) => {
          callCount += 1;
          assert.equal(String(url), "https://api.runpod.ai/v2/endpoint-abc123/run");
          assert.equal(init?.method, "POST");
          assert.equal(
            (init?.headers as Record<string, string>).Authorization,
            "Bearer test-api-key",
          );
          assert.equal(
            init?.body,
            JSON.stringify({ input: { mode: "poll_once" } }),
          );
          return new Response(JSON.stringify({ id: "runpod-job-1", status: "IN_QUEUE" }), {
            status: 200,
            headers: { "Content-Type": "application/json" },
          });
        }) as typeof fetch;

        const result = await triggerRunPodPollOnce(mockFetch);
        assert.equal(result.ok, true);
        if (result.ok) {
          assert.equal(result.runpodJobId, "runpod-job-1");
        }
        assert.equal(callCount, 1);
      },
    );
  });

  await test("RunPod HTTP failure → controlled trigger error", async () => {
    await withEnv(
      {
        RUNPOD_API_KEY: "test-api-key",
        RUNPOD_UPSCALE_ENDPOINT_ID: "endpoint-abc123",
      },
      async () => {
        const mockFetch = (async () =>
          new Response("upstream error", { status: 502 })) as typeof fetch;

        const result = await triggerRunPodPollOnce(mockFetch);
        assert.equal(result.ok, false);
        if (!result.ok) {
          assert.match(result.message, /502/);
        }
      },
    );
  });

  await test("jobs route triggers worker only after createJob insert", () => {
    const routeSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/jobs/route.ts"),
      "utf8",
    );

    assert.match(routeSource, /createUpscaleJobRecord/);
    assert.match(routeSource, /triggerUpscaleWorkerAfterJobCreated\(jobId\)/);

    const createIndex = routeSource.indexOf("const jobId = await createUpscaleJobRecord");
    const triggerIndex = routeSource.indexOf("await triggerUpscaleWorkerAfterJobCreated(jobId)");
    assert.ok(createIndex >= 0 && triggerIndex > createIndex);
  });

  await test("trigger failure returns WORKER_TRIGGER_FAILED without starting client poll success", () => {
    const routeSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/jobs/route.ts"),
      "utf8",
    );
    const triggerWorkerSource = readFileSync(
      join(process.cwd(), "lib/upscale-jobs/trigger-worker.ts"),
      "utf8",
    );

    assert.match(routeSource, /WORKER_TRIGGER_FAILED/);
    assert.match(triggerWorkerSource, /worker_trigger_failed/);
    assert.match(triggerWorkerSource, /updateJob/);
  });

  await test("no RunPod API key exposure to client bundles", () => {
    const publicEnvSource = readFileSync(join(process.cwd(), "config/env.public.ts"), "utf8");
    const clientSource = readFileSync(
      join(process.cwd(), "lib/tools/image-upscaler/client.ts"),
      "utf8",
    );
    const upscalerSource = readFileSync(
      join(process.cwd(), "components/tools/image-upscaler/ImageUpscalerTool.tsx"),
      "utf8",
    );

    for (const source of [publicEnvSource, clientSource, upscalerSource]) {
      assert.doesNotMatch(source, /RUNPOD_API_KEY/);
      assert.doesNotMatch(source, /RUNPOD_UPSCALE_ENDPOINT_ID/);
      assert.doesNotMatch(source, /api\.runpod\.ai/);
    }

    assert.doesNotMatch(clientSource, /triggerRunPodPollOnce/);
  });

  await test("duplicate click protection remains on client and route rate limit", () => {
    const clientSource = readFileSync(
      join(process.cwd(), "lib/tools/image-upscaler/client.ts"),
      "utf8",
    );
    const upscalerSource = readFileSync(
      join(process.cwd(), "components/tools/image-upscaler/ImageUpscalerTool.tsx"),
      "utf8",
    );
    const routeSource = readFileSync(
      join(process.cwd(), "app/api/tools/image/upscale/jobs/route.ts"),
      "utf8",
    );

    assert.match(upscalerSource, /isProcessingRef/);
    assert.match(clientSource, /createUpscaleJob/);
    assert.match(routeSource, /enforceRateLimit/);
  });

  await test("buildRunPodPollOnceRunUrl uses configured endpoint id", async () => {
    await withEnv(
      {
        RUNPOD_UPSCALE_ENDPOINT_ID: "my-endpoint-id",
        RUNPOD_API_BASE_URL: "https://api.runpod.ai/v2",
        RUNPOD_API_KEY: undefined,
      },
      () => {
        assert.equal(
          buildRunPodPollOnceRunUrl(),
          "https://api.runpod.ai/v2/my-endpoint-id/run",
        );
        assert.equal(readRunPodUpscaleEndpointId(), "my-endpoint-id");
        assert.equal(isRunPodUpscaleTriggerConfigured(), false);
      },
    );
  });

  console.log(`\n${passed}/${passed} RunPod upscale trigger checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
