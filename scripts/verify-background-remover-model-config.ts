/**
 * Phase 9.2 — Background remover BiRefNet model configuration verification.
 * Run: npx tsx scripts/verify-background-remover-model-config.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const PRODUCTION_MODEL = "birefnet-general";
const WORKER_ROOT = join(process.cwd(), "..", "rembg-worker");
const WEBSITE_ROOT = process.cwd();

let passed = 0;

function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

function readWorker(relativePath: string): string {
  return readFileSync(join(WORKER_ROOT, relativePath), "utf8");
}

function main(): void {
  test("H. worker Dockerfile defaults to birefnet-general with preload", () => {
    const dockerfile = readWorker("Dockerfile");
    assert.match(dockerfile, new RegExp(`REMBG_MODEL=${PRODUCTION_MODEL}`));
    assert.match(dockerfile, new RegExp(`REMBG_PRELOAD_MODELS=${PRODUCTION_MODEL}`));
  });

  test("H. worker config.py defaults to birefnet-general", () => {
    const config = readWorker("app/config.py");
    assert.match(config, new RegExp(`REMBG_MODEL", "${PRODUCTION_MODEL}"`));
    assert.match(config, new RegExp(`REMBG_PRELOAD_MODELS", "${PRODUCTION_MODEL}"`));
  });

  test("H. website env default uses birefnet-general", () => {
    const envSource = readFileSync(join(WEBSITE_ROOT, "config/env.ts"), "utf8");
    assert.match(envSource, new RegExp(`"${PRODUCTION_MODEL}"`));
  });

  test("H. rembg-server-provider fallback uses birefnet-general", () => {
    const providerSource = readFileSync(
      join(WEBSITE_ROOT, "lib/providers/background-removal/rembg-server-provider.ts"),
      "utf8",
    );
    assert.match(providerSource, new RegExp(`"${PRODUCTION_MODEL}"`));
    assert.doesNotMatch(providerSource, /isnet-general-use/);
  });

  test("I. worker alpha matting defaults remain Phase 7K values", () => {
    const quality = readWorker("app/rembg_quality.py");
    assert.match(quality, /REMBG_ALPHA_MATTING", True/);
    assert.match(quality, /REMBG_ALPHA_MATTING_FG_THRESHOLD", 240/);
    assert.match(quality, /REMBG_ALPHA_MATTING_BG_THRESHOLD", 12/);
    assert.match(quality, /REMBG_ALPHA_MATTING_ERODE_SIZE", 6/);
    assert.match(quality, /REMBG_POST_PROCESS_MASK", True/);
  });

  test("J. free processing limit remains 1920px", () => {
    const limits = readFileSync(
      join(WEBSITE_ROOT, "lib/tools/background-remover/processing-limits.ts"),
      "utf8",
    );
    assert.match(limits, /FREE_PROCESSING_MAX_LONG_EDGE = 1920/);
  });

  test("J. pro processing limit remains 3840px", () => {
    const limits = readFileSync(
      join(WEBSITE_ROOT, "lib/tools/background-remover/processing-limits.ts"),
      "utf8",
    );
    assert.match(limits, /PRO_PROCESSING_MAX_LONG_EDGE = 3840/);
  });

  test("G. API route contract unchanged (multipart POST → PNG download)", () => {
    const routeSource = readFileSync(
      join(WEBSITE_ROOT, "app/api/tools/background-remover/remove/route.ts"),
      "utf8",
    );
    assert.match(routeSource, /rembgServerProvider\.removeBackground/);
    assert.match(routeSource, /imageDownloadResponse/);
    assert.match(routeSource, /image\/png/);
    assert.doesNotMatch(routeSource, /NextResponse\.json\(\{ jobId/);
  });

  test("K. no Image Upscaler files reference birefnet or rembg model change", () => {
    const upscalerFiles = [
      "lib/upscale-jobs/trigger-worker.ts",
      "lib/upscale-jobs/runpod-trigger.ts",
      "app/api/tools/image/upscale/jobs/route.ts",
    ];
    for (const file of upscalerFiles) {
      const source = readFileSync(join(WEBSITE_ROOT, file), "utf8");
      assert.doesNotMatch(source, /birefnet/);
      assert.doesNotMatch(source, /REMBG_MODEL/);
    }
  });

  test("worker concurrency default reduced to 1 for BiRefNet memory safety", () => {
    const dockerfile = readWorker("Dockerfile");
    const config = readWorker("app/config.py");
    assert.match(dockerfile, /MAX_CONCURRENT_JOBS=1/);
    assert.match(config, /MAX_CONCURRENT_JOBS", "1"/);
  });

  console.log(`\n${passed}/${passed} background remover model config checks passed.`);
}

main();
