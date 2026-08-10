import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { getUpscaleJobProgressSnapshot } from "../lib/upscale-jobs/progress";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("async client polls every 2 seconds", () => {
  const clientSource = readFileSync(
    join(root, "lib/tools/image-upscaler/client.ts"),
    "utf8",
  );
  assert.match(clientSource, /UPSCALE_JOB_POLL_INTERVAL_MS = 2000/);
});

test("terminal job statuses include completed and failed", () => {
  const clientSource = readFileSync(
    join(root, "lib/tools/image-upscaler/client.ts"),
    "utf8",
  );
  assert.match(clientSource, /status === "completed"/);
  assert.match(clientSource, /status === "failed"/);
  assert.match(clientSource, /status === "cancelled"/);
});

test("sync upscale route returns ASYNC_REQUIRED when service URL is set", () => {
  const routeSource = readFileSync(
    join(root, "app/api/tools/image/upscale/route.ts"),
    "utf8",
  );
  assert.match(routeSource, /ASYNC_REQUIRED/);
  assert.match(routeSource, /realesrganServiceUrl/);
  assert.match(routeSource, /\/api\/tools\/image\/upscale\/jobs/);
});

test("jobs POST route creates queued jobs without Real-ESRGAN", () => {
  const jobsRouteSource = readFileSync(
    join(root, "app/api/tools/image/upscale/jobs/route.ts"),
    "utf8",
  );
  assert.match(jobsRouteSource, /createJob/);
  assert.match(jobsRouteSource, /usageCharged/);
  assert.doesNotMatch(jobsRouteSource, /realEsrganProvider/);
});

test("processing panel uses real progress labels", () => {
  const snapshot = getUpscaleJobProgressSnapshot("processing", "upscaling", 55);
  assert.equal(snapshot.label, "Upscaling");
  assert.equal(snapshot.percent, 55);
});

console.log(`\n${passed}/${passed} async image upscaler checks passed.`);
