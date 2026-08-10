/**
 * Phase 7J — Background Remover UI state + staged progress tests.
 * Run: npx tsx scripts/verify-background-remover-ui-state.ts
 */

import assert from "node:assert/strict";
import {
  advanceStagedProgress,
  computeStagedProgressPercent,
  getStagedProgressSnapshot,
  resolveSuccessProgressPercent,
  shouldAllowCompleteProgress,
  STAGED_PROGRESS_WAIT_CAP,
} from "../lib/tools/background-remover/staged-progress";
import {
  clearPreviewState,
  createPreviewStateFromSuccess,
  hasCompletePreviewState,
  selectBeforeAfterUrls,
} from "../lib/tools/background-remover/ui-state";

let passed = 0;

function test(name: string, fn: () => void): void {
  fn();
  passed += 1;
  console.log(`✓ ${name}`);
}

test("original and processed preview URLs are stored separately", () => {
  const state = createPreviewStateFromSuccess("blob:original", "blob:processed");
  assert.notEqual(state.originalPreviewUrl, state.processedPreviewUrl);
});

test("API success preview becomes AFTER source", () => {
  const state = createPreviewStateFromSuccess("blob:original", "blob:processed");
  const urls = selectBeforeAfterUrls(state);
  assert.equal(urls.beforeUrl, "blob:original");
  assert.equal(urls.afterUrl, "blob:processed");
});

test("before preview remains original URL", () => {
  const state = createPreviewStateFromSuccess("blob:original", "blob:processed");
  assert.equal(selectBeforeAfterUrls(state).beforeUrl, "blob:original");
});

test("processed preview URL distinct for export/download path", () => {
  const state = createPreviewStateFromSuccess("blob:original", "blob:processed");
  assert.equal(hasCompletePreviewState(state), true);
  assert.equal(selectBeforeAfterUrls(state).afterUrl, "blob:processed");
});

test("progress begins at 0 after upload start", () => {
  assert.equal(getStagedProgressSnapshot(0).percent, 0);
  assert.equal(getStagedProgressSnapshot(0).stage, "preparing");
});

test("staged progress cannot reach 100 before API completion", () => {
  const waiting = computeStagedProgressPercent(120_000);
  assert.ok(waiting <= STAGED_PROGRESS_WAIT_CAP);
  assert.equal(shouldAllowCompleteProgress(false), false);
  assert.notEqual(waiting, 100);
});

test("success sets progress to 100", () => {
  assert.equal(resolveSuccessProgressPercent(), 100);
  assert.equal(getStagedProgressSnapshot(100).percent, 100);
  assert.equal(shouldAllowCompleteProgress(true), true);
});

test("failure clears preview state helper", () => {
  const cleared = clearPreviewState();
  assert.equal(cleared.originalPreviewUrl, null);
  assert.equal(cleared.processedPreviewUrl, null);
  assert.equal(hasCompletePreviewState(cleared), false);
});

test("second upload replaces prior preview URLs in helper", () => {
  const first = createPreviewStateFromSuccess("blob:one-original", "blob:one-processed");
  const second = createPreviewStateFromSuccess("blob:two-original", "blob:two-processed");
  assert.notEqual(first.originalPreviewUrl, second.originalPreviewUrl);
  assert.notEqual(first.processedPreviewUrl, second.processedPreviewUrl);
});

test("staged progress never moves backwards", () => {
  let current = 0;
  const samples = [500, 1000, 2000, 4000, 8000, 16_000, 32_000, 64_000];
  for (const elapsed of samples) {
    const next = advanceStagedProgress(current, computeStagedProgressPercent(elapsed));
    assert.ok(next >= current);
    current = next;
  }
});

test("stage labels map to expected ranges", () => {
  assert.equal(getStagedProgressSnapshot(5).label, "Preparing image");
  assert.equal(getStagedProgressSnapshot(20).label, "Uploading securely");
  assert.equal(getStagedProgressSnapshot(50).label, "Removing background");
  assert.equal(getStagedProgressSnapshot(90).label, "Preparing preview");
});

test("reject identical original/processed URLs", () => {
  assert.throws(() => createPreviewStateFromSuccess("blob:same", "blob:same"));
});

console.log(`\n${passed}/${passed} background remover UI state checks passed.`);
