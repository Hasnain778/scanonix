/**
 * Phase 130L-5D-3D — Watermark PDF theme guards.
 * Run: npx tsx scripts/verify-watermark-theme-130l5d3d.ts
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

console.log("\n130L-5D-3D Watermark PDF theme verification\n");

const tool = read("components/tools/watermark-pdf-client/WatermarkPdfClientTool.tsx");
assert(
  "Tool chrome uses semantic foreground/surfaces",
  tool.includes("text-foreground") &&
    tool.includes("bg-surface") &&
    !tool.includes("bg-[#0a0a0a]") &&
    !tool.includes("bg-black/40"),
);
assert(
  "settings.color pipeline preserved",
  tool.includes("settings.color") &&
    tool.includes('data-watermark-color-picker') &&
    tool.includes('data-watermark-color-input') &&
    tool.includes("updateSettings({ color:"),
);
assert(
  "Auto-download via downloadBlob preserved",
  tool.includes("downloadBlob(") &&
    tool.includes("data-watermark-download-button") &&
    !tool.includes("ResultActionBar"),
);
assert(
  "No theme foreground in color update path",
  !tool.includes("color: \"var(--foreground)\"") &&
    !tool.includes("color: currentColor"),
);

const preview = read("components/tools/watermark-pdf-client/WatermarkPdfPreview.tsx");
assert(
  "PDF bg-white preserved",
  preview.includes("bg-white shadow-lg") || preview.includes("border-border bg-white"),
);
assert(
  "PDF render #ffffff preserved",
  preview.includes('fillStyle = "#ffffff"'),
);
assert(
  "Preview overlay uses color prop (not theme token)",
  preview.includes("color: textOverlayStyle.color") &&
    !preview.includes("color: \"var(--foreground)\""),
);
assert(
  "Excluded-page banner over document preserved",
  preview.includes("bg-black/70") && preview.includes("text-white"),
);

const picker = read("components/tools/watermark-pdf-client/PositionPicker.tsx");
assert(
  "PositionPicker mini-page white preserved",
  picker.includes("bg-white/90") && picker.includes("bg-white/70"),
);
assert(
  "PositionPicker geometry/mapping labels preserved",
  picker.includes("data-watermark-position-picker") &&
    picker.includes("top-left") &&
    picker.includes("getPositionLabel") &&
    picker.includes("h-16 w-14"),
);
assert(
  "PositionPicker selected indicator remains orange",
  picker.includes("border-scanonix-orange") && picker.includes("bg-scanonix-orange"),
);

const previewUi = read("lib/tools/watermark-pdf/preview-ui.ts");
assert(
  "preview-ui color remains argument-driven",
  previewUi.includes("color,") &&
    !previewUi.includes("currentColor") &&
    !previewUi.includes("text-foreground"),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
