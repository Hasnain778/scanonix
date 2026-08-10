import assert from "node:assert/strict";
import {
  getUpscaleJobProgressLabel,
  getUpscaleJobProgressSnapshot,
} from "../lib/upscale-jobs/progress";
import {
  storageExtFromMime,
  upscaleJobInputPath,
  upscaleJobOutputPath,
} from "../lib/upscale-jobs/paths";

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("progress labels map job stages", () => {
  assert.equal(getUpscaleJobProgressLabel("preparing"), "Preparing image");
  assert.equal(getUpscaleJobProgressLabel("queued"), "Queued");
  assert.equal(getUpscaleJobProgressLabel("upscaling"), "Upscaling");
  assert.equal(getUpscaleJobProgressLabel("preparing_result"), "Preparing result");
  assert.equal(getUpscaleJobProgressLabel("completed"), "Completed");
});

test("progress snapshot respects status and floors", () => {
  const queued = getUpscaleJobProgressSnapshot("queued", "queued", 0);
  assert.equal(queued.label, "Queued");
  assert.equal(queued.percent, 15);

  const upscaling = getUpscaleJobProgressSnapshot("processing", "upscaling", 40);
  assert.equal(upscaling.label, "Upscaling");
  assert.equal(upscaling.percent, 40);

  const completed = getUpscaleJobProgressSnapshot("completed", "completed", 80);
  assert.equal(completed.label, "Completed");
  assert.equal(completed.percent, 100);
});

test("storage paths follow user/job layout", () => {
  const userId = "11111111-1111-1111-1111-111111111111";
  const jobId = "22222222-2222-2222-2222-222222222222";
  assert.equal(
    upscaleJobInputPath(userId, jobId, "png"),
    `${userId}/upscale-jobs/${jobId}/input.png`,
  );
  assert.equal(
    upscaleJobOutputPath(userId, jobId, "jpg"),
    `${userId}/upscale-jobs/${jobId}/output.jpg`,
  );
  assert.equal(storageExtFromMime("image/jpeg"), "jpg");
});

console.log(`\n${passed}/${passed} upscale job library checks passed.`);
