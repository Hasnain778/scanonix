import assert from "node:assert/strict";
import {
  advanceUpscaleStagedProgress,
  computeUpscaleStagedProgressPercent,
  getUpscaleStagedProgressSnapshot,
  UPSCALE_STAGED_PROGRESS_WAIT_CAP,
} from "../lib/tools/image-upscaler/staged-progress";

let passed = 0;

function test(name, fn) {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("staged labels follow upscaler ranges", () => {
  assert.equal(getUpscaleStagedProgressSnapshot(5).label, "Preparing image");
  assert.equal(getUpscaleStagedProgressSnapshot(20).label, "Uploading securely");
  assert.equal(getUpscaleStagedProgressSnapshot(50).label, "Upscaling image");
  assert.equal(getUpscaleStagedProgressSnapshot(90).label, "Preparing result");
  assert.equal(getUpscaleStagedProgressSnapshot(98).label, "Finalizing");
});

test("staged progress never exceeds wait cap", () => {
  const percent = computeUpscaleStagedProgressPercent(999_999);
  assert.ok(percent <= UPSCALE_STAGED_PROGRESS_WAIT_CAP);
});

test("staged progress never moves backwards", () => {
  const next = advanceUpscaleStagedProgress(40, 30);
  assert.equal(next, 40);
  assert.equal(advanceUpscaleStagedProgress(40, 55), 55);
});

console.log(`\n${passed}/${passed} image upscaler staged progress checks passed.`);
