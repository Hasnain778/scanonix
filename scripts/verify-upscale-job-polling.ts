/**
 * Verify upscale job polling recognizes RunPod worker completion (Phase 8G.13).
 * Run: npx tsx scripts/verify-upscale-job-polling.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { toPublicJobStatus } from "../lib/upscale-jobs/public-status";
import {
  getUpscaleJobPollAction,
  isActiveUpscaleJobStatus,
  isTerminalUpscaleJobStatus,
} from "../lib/upscale-jobs/terminal-status";
import type { UpscaleJobRecord } from "../lib/upscale-jobs/types";

const root = process.cwd();

function makeJob(overrides: Partial<UpscaleJobRecord> = {}): UpscaleJobRecord {
  return {
    id: "22222222-2222-2222-2222-222222222222",
    user_id: "11111111-1111-1111-1111-111111111111",
    status: "queued",
    scale: 2,
    stage: "queued",
    progress: 15,
    input_storage_path: "11111111-1111-1111-1111-111111111111/upscale-jobs/22222222-2222-2222-2222-222222222222/input.jpg",
    output_storage_path: null,
    input_mime_type: "image/jpeg",
    input_width: 512,
    input_height: 512,
    input_size_bytes: 120_000,
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
    created_at: "2026-08-10T00:00:00.000Z",
    started_at: null,
    completed_at: null,
    expires_at: "2026-08-11T00:00:00.000Z",
    ...overrides,
  };
}

async function main(): Promise<void> {
  let passed = 0;

  function test(name: string, fn: () => void): void {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  }

  test("queued job stays polling", () => {
    const status = toPublicJobStatus(makeJob());
    assert.equal(isActiveUpscaleJobStatus(status), true);
    assert.equal(isTerminalUpscaleJobStatus(status), false);
    assert.equal(getUpscaleJobPollAction(status), "continue");
  });

  test("processing job stays polling", () => {
    const status = toPublicJobStatus(
      makeJob({
        status: "processing",
        stage: "upscaling",
        progress: 40,
        started_at: "2026-08-10T00:00:05.000Z",
        worker_id: "runpod-gpu-1",
      }),
    );
    assert.equal(isActiveUpscaleJobStatus(status), true);
    assert.equal(getUpscaleJobPollAction(status), "continue");
  });

  test("completed RunPod job returns completed to client", () => {
    const status = toPublicJobStatus(
      makeJob({
        status: "completed",
        stage: "completed",
        progress: 100,
        output_storage_path:
          "11111111-1111-1111-1111-111111111111/upscale-jobs/22222222-2222-2222-2222-222222222222/output.jpg",
        output_width: 1024,
        output_height: 1024,
        output_format: "jpg",
        output_size_bytes: 450_000,
        completed_at: "2026-08-10T00:01:30.000Z",
        worker_id: "runpod-gpu-1",
      }),
    );

    assert.equal(status.status, "completed");
    assert.equal(status.stage, "completed");
    assert.equal(status.progress, 100);
    assert.equal(isTerminalUpscaleJobStatus(status), true);
    assert.equal(getUpscaleJobPollAction(status), "fetch-result");
  });

  test("output image path is returned on completed job status", () => {
    const outputPath =
      "11111111-1111-1111-1111-111111111111/upscale-jobs/22222222-2222-2222-2222-222222222222/output.jpg";
    const status = toPublicJobStatus(
      makeJob({
        status: "completed",
        stage: "completed",
        progress: 100,
        output_storage_path: outputPath,
        completed_at: "2026-08-10T00:01:30.000Z",
      }),
    );

    assert.equal(status.outputStoragePath, outputPath);
  });

  test("failed job stops polling", () => {
    const status = toPublicJobStatus(
      makeJob({
        status: "failed",
        stage: "upscaling",
        progress: 40,
        error_code: "processing_failed",
        error_message: "Image upscaling failed. Try a different image or scale.",
        completed_at: "2026-08-10T00:01:00.000Z",
      }),
    );

    assert.equal(isTerminalUpscaleJobStatus(status), true);
    assert.equal(getUpscaleJobPollAction(status), "stop-error");
  });

  test("completed job automatically transitions UI to result", () => {
    const status = toPublicJobStatus(
      makeJob({
        status: "completed",
        stage: "completed",
        progress: 100,
        output_storage_path:
          "11111111-1111-1111-1111-111111111111/upscale-jobs/22222222-2222-2222-2222-222222222222/output.jpg",
        completed_at: "2026-08-10T00:01:30.000Z",
      }),
    );

    assert.equal(getUpscaleJobPollAction(status), "fetch-result");
  });

  test("worker completion signature resolves when status column still processing", () => {
    const status = toPublicJobStatus(
      makeJob({
        status: "processing",
        stage: "completed",
        progress: 100,
        output_storage_path:
          "11111111-1111-1111-1111-111111111111/upscale-jobs/22222222-2222-2222-2222-222222222222/output.jpg",
        completed_at: "2026-08-10T00:01:30.000Z",
      }),
    );

    assert.equal(status.status, "completed");
    assert.equal(getUpscaleJobPollAction(status), "fetch-result");
  });

  test("status polling route disables caching", () => {
    const routeSource = readFileSync(
      join(root, "app/api/tools/image/upscale/jobs/[id]/route.ts"),
      "utf8",
    );
    assert.match(routeSource, /Cache-Control.*no-store/);
    assert.match(routeSource, /revalidate = 0/);
  });

  test("browser polling client busts cache on each request", () => {
    const clientSource = readFileSync(
      join(root, "lib/tools/image-upscaler/client.ts"),
      "utf8",
    );
    assert.match(clientSource, /Date\.now\(\)/);
    assert.match(clientSource, /cache: "no-store"/);
  });

  console.log(`\n${passed}/${passed} upscale job polling checks passed.`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
