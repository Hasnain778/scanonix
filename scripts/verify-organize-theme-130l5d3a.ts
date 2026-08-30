/**
 * Phase 130L-5D-3A — Organize PDF theme guards.
 * Run: npx tsx scripts/verify-organize-theme-130l5d3a.ts
 */
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();
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

function read(rel: string) {
  const path = join(root, rel);
  assert(`${rel} exists`, existsSync(path));
  return existsSync(path) ? readFileSync(path, "utf8") : "";
}

console.log("\n130L-5D-3A Organize PDF theme verification\n");

const tool = read("components/tools/organize-pdf/OrganizePdfTool.tsx");
assert(
  "OrganizePdfTool headings/stats use text-foreground",
  tool.includes("text-foreground") &&
    !tool.includes("text-white") &&
    tool.includes("bg-surface"),
);

const grid = read("components/tools/organize-pdf/OrganizePageGrid.tsx");
assert(
  "OrganizePageGrid Pages heading uses text-foreground",
  grid.includes('text-lg font-semibold text-foreground">Pages') &&
    !grid.includes('text-lg font-semibold text-white">Pages'),
);
assert(
  "Intentional thumbnail bg-white preserved",
  grid.includes("aspect-[3/4] overflow-hidden bg-white"),
);
assert(
  "Intentional overlay badges over PDF preserved",
  grid.includes("bg-black/80") && grid.includes("text-white"),
);
assert(
  "DnD handlers preserved",
  grid.includes("onDragStart") &&
    grid.includes("onDragOver") &&
    grid.includes("onDrop") &&
    grid.includes("onDragEnd") &&
    grid.includes("draggable={!disabled}"),
);
assert(
  "aspect-[3/4] geometry preserved",
  grid.includes("aspect-[3/4]"),
);

const render = read("lib/tools/organize-pdf/thumbnail-render.ts");
assert(
  "PDF render #ffffff fill preserved",
  render.includes('fillStyle = "#ffffff"'),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
