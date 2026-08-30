/**
 * Phase 130L-5D-3B — Crop PDF theme guards.
 * Run: npx tsx scripts/verify-crop-theme-130l5d3b.ts
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

console.log("\n130L-5D-3B Crop PDF theme verification\n");

const tool = read("components/tools/crop-pdf/CropPdfTool.tsx");
assert(
  "CropPdfTool chrome uses semantic foreground/surfaces",
  tool.includes("text-foreground") &&
    tool.includes("bg-surface") &&
    !tool.includes("text-white") &&
    !tool.includes("bg-black/40"),
);
assert(
  "CropPdfTool percent inputs use input-field",
  tool.includes('className="input-field"'),
);
assert(
  "CropPdfTool page select uses select-field",
  tool.includes("select-field"),
);

const editor = read("components/tools/crop-pdf/CropPageEditor.tsx");
assert(
  "PDF page bg-white preserved",
  editor.includes("border border-border bg-white") ||
    editor.includes("bg-white shadow-lg"),
);
assert(
  "PDF render #ffffff preserved",
  editor.includes('fillStyle = "#ffffff"'),
);
assert(
  "data-crop-page-overlay-root preserved",
  editor.includes("data-crop-page-overlay-root"),
);

const overlay = read("components/tools/crop-pdf/CropOverlay.tsx");
assert(
  "Crop mask bg-black/45 preserved",
  (overlay.match(/bg-black\/45/g) || []).length >= 4,
);
assert(
  "Overlay resolves data-crop-page-overlay-root",
  overlay.includes('[data-crop-page-overlay-root]'),
);
assert(
  "Pointer crop handlers preserved",
  overlay.includes("onPointerDown") &&
    overlay.includes("onPointerMove") &&
    overlay.includes("setPointerCapture") &&
    overlay.includes("touch-none"),
);
assert(
  "CropOverlay handle geometry classes preserved",
  overlay.includes("-left-3 -top-3") &&
    overlay.includes("border-scanonix-orange") &&
    overlay.includes("cursor-move"),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
