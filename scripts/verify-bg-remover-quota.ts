/**
 * Background Remover quota regression — server is the sole quota authority.
 * Run: npm run verify:bg-remover-quota
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function extractProcessImageBlock(source: string): string {
  const start = source.indexOf("const processImage = useCallback(");
  assert.notEqual(start, -1, "processImage callback must exist in BackgroundRemoverTool");

  const tryStart = source.indexOf("try {", start);
  assert.notEqual(tryStart, -1, "processImage try block must exist");

  const submitCall = source.indexOf("submitBackgroundRemovalForm", tryStart);
  assert.notEqual(submitCall, -1, "processImage must call submitBackgroundRemovalForm");

  return source.slice(tryStart, submitCall);
}

function main(): void {
  let passed = 0;

  function test(name: string, fn: () => void): void {
    fn();
    passed += 1;
    console.log(`✓ ${name}`);
  }

  console.log("\nBackground Remover quota verification (130I-1)\n");

  const toolSource = read("components/tools/background-remover/BackgroundRemoverTool.tsx");
  const routeSource = read("app/api/tools/background-remover/remove/route.ts");
  const processBlock = extractProcessImageBlock(toolSource);

  test("client processImage does not call gateToolOperation", () => {
    assert.doesNotMatch(processBlock, /gateToolOperation\s*\(/);
  });

  test("client processImage does not call /api/usage/consume", () => {
    assert.doesNotMatch(processBlock, /\/api\/usage\/consume/);
    assert.doesNotMatch(processBlock, /consumeToolUsageViaApi/);
  });

  test("client processImage keeps anonymous upload size validation only", () => {
    assert.match(processBlock, /validateAnonymousUploadSize\s*\(\s*["']background-remover["']/);
  });

  test("server remove route retains consumeUsage for authenticated users", () => {
    assert.match(routeSource, /consumeUsage\s*\(/);
    assert.match(routeSource, /if\s*\(\s*!access\.anonymous\s*\)/);
  });

  test("server remove route consumes before rembg processing", () => {
    const consumeIndex = routeSource.indexOf("consumeUsage(");
    const rembgIndex = routeSource.indexOf("rembgServerProvider.removeBackground");
    assert.ok(consumeIndex !== -1 && rembgIndex !== -1, "consume and rembg calls must exist");
    assert.ok(consumeIndex < rembgIndex, "quota must be consumed before rembg runs");
  });

  test("4K export authorization remains separate from processing quota", () => {
    assert.match(toolSource, /authorizeBackgroundExport\s*\(/);
    assert.doesNotMatch(
      read("app/api/tools/background-remover/authorize-export/route.ts"),
      /consumeUsage\s*\(/,
    );
  });

  test("quota delta contract: one server consume per authenticated operation", () => {
    const serverConsumes = (routeSource.match(/consumeUsage\s*\(/g) ?? []).length;
    assert.equal(serverConsumes, 1, "remove route must call consumeUsage exactly once");
    assert.doesNotMatch(toolSource, /gateToolOperation\s*\(\s*["']background-remover["']/);
  });

  test("failed-operation semantics unchanged: server pre-consumes before processing", () => {
    assert.match(
      routeSource,
      /consumeUsage[\s\S]*rembgServerProvider\.removeBackground/,
    );
  });

  console.log(`\n${passed}/${passed} background remover quota checks passed.\n`);
  console.log("Expected authenticated quota delta on success: AFTER = BEFORE - 1 (not BEFORE - 2)");
  console.log(
    "Expected failed processing (auth): AFTER = BEFORE - 1 (server pre-consumes; unchanged this phase)",
  );
}

main();
