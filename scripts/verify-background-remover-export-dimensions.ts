/**
 * Export dimension tests for Background Remover (Phase 117).
 * Run: npx tsx scripts/verify-background-remover-export-dimensions.ts
 */

import { calculateOutputDimensions } from "../lib/tools/background-remover/studio-types";

let passed = 0;
let failed = 0;

function assert(name: string, condition: boolean, detail = "") {
  if (condition) {
    passed += 1;
    console.log(`✓ ${name}`);
  } else {
    failed += 1;
    console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
  }
}

function assertDims(
  name: string,
  sourceWidth: number,
  sourceHeight: number,
  preset: "hd" | "4k",
  expectedWidth: number,
  expectedHeight: number,
) {
  const result = calculateOutputDimensions(sourceWidth, sourceHeight, preset);
  const ok =
    result.width === expectedWidth && result.height === expectedHeight;
  assert(
    name,
    ok,
    ok
      ? ""
      : `got ${result.width}×${result.height}, expected ${expectedWidth}×${expectedHeight}`,
  );
}

function run() {
  console.log("\nBackground remover export dimension verification\n");

  assertDims("700×700 HD", 700, 700, "hd", 1920, 1920);
  assertDims("700×700 4K", 700, 700, "4k", 3840, 3840);

  assertDims("800×1200 HD", 800, 1200, "hd", 1280, 1920);
  assertDims("800×1200 4K", 800, 1200, "4k", 2560, 3840);

  assertDims("1200×800 HD", 1200, 800, "hd", 1920, 1280);
  assertDims("1200×800 4K", 1200, 800, "4k", 3840, 2560);

  assertDims("2500×1500 HD", 2500, 1500, "hd", 1920, 1152);
  assertDims("2500×1500 4K", 2500, 1500, "4k", 2500, 1500);

  assertDims("5000×3000 HD", 5000, 3000, "hd", 1920, 1152);
  assertDims("5000×3000 4K", 5000, 3000, "4k", 3840, 2304);

  const zero = calculateOutputDimensions(0, 0, "hd");
  assert("zero dimensions — safe minimum", zero.width >= 1 && zero.height >= 1);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
