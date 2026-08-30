/**
 * Phase 130L-5D-3C — Sign PDF theme guards.
 * Run: npx tsx scripts/verify-sign-theme-130l5d3c.ts
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

console.log("\n130L-5D-3C Sign PDF theme verification\n");

const tool = read("components/tools/sign-pdf/SignPdfTool.tsx");
assert(
  "SignPdfTool chrome uses semantic foreground/surfaces",
  tool.includes("text-foreground") &&
    tool.includes("bg-surface") &&
    !tool.includes('text-white">') &&
    !tool.includes("bg-black/40"),
);

const modal = read("components/tools/sign-pdf/SignatureCreatorModal.tsx");
assert(
  "Modal dialog uses semantic surface",
  modal.includes("bg-surface") && modal.includes("text-foreground"),
);
assert(
  "Modal scrim bg-black/70 preserved",
  modal.includes("bg-black/70"),
);
assert(
  "Typed preview uses fixed signature ink #111111",
  modal.includes('color: "#111111"') && !modal.includes("text-white"),
);

const drawPad = read("components/tools/sign-pdf/SignatureDrawPad.tsx");
assert(
  "DrawPad stroke #111111 preserved",
  (drawPad.match(/strokeStyle = "#111111"/g) || []).length >= 2,
);
assert(
  "DrawPad canvas remains bg-transparent",
  drawPad.includes("bg-transparent"),
);

const palette = read("components/tools/sign-pdf/SignatureAssetPalette.tsx");
assert(
  "AssetPalette uses semantic chrome",
  palette.includes("text-foreground") &&
    palette.includes("bg-surface") &&
    !palette.includes("text-white") &&
    !palette.includes("bg-black/20"),
);
assert(
  "Checkerboard preview surface preserved",
  palette.includes("repeating-conic-gradient"),
);

const editor = read("components/tools/sign-pdf/PdfPageEditor.tsx");
assert(
  "PDF bg-white preserved",
  editor.includes("bg-white"),
);
assert(
  "PDF render #ffffff preserved",
  editor.includes('fillStyle = "#ffffff"'),
);
assert(
  "data-sign-page-overlay-root preserved",
  editor.includes("data-sign-page-overlay-root"),
);

const overlay = read("components/tools/sign-pdf/SignaturePlacementOverlay.tsx");
assert(
  "PlacementOverlay resolves data-sign-page-overlay-root",
  overlay.includes('[data-sign-page-overlay-root]'),
);
assert(
  "PlacementOverlay pointer handlers preserved",
  overlay.includes("onPointerDown") &&
    overlay.includes("setPointerCapture") &&
    overlay.includes("border-scanonix-orange"),
);

const assets = read("lib/tools/sign-pdf/signature-assets.ts");
assert(
  "Asset generation #111111 ink preserved",
  assets.includes('fillStyle = "#111111"') &&
    assets.includes('strokeStyle = "#111111"'),
);
assert(
  "Asset generation does not use currentColor/theme foreground for ink",
  !assets.includes("currentColor") &&
    !assets.includes("text-foreground") &&
    !assets.includes("var(--foreground)"),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
