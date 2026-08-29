/**
 * Phase 130L-5B Wave 1 — static shared workspace theme guards.
 * Run: npx tsx scripts/verify-workspace-theme-130l5b.ts
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

console.log("\n130L-5B Wave 1 workspace theme verification\n");

const header = read("components/workspace/ToolShell.tsx");
assert(
  "ToolPageHeader H1 uses text-foreground",
  header.includes("ToolPageHeader") &&
    header.includes('text-foreground sm:text-4xl') &&
    !/h1 className="[^"]*text-white/.test(header),
);

const results = read("components/tools/ToolResultsPanel.tsx");
assert(
  "ToolResultsPanel title uses text-foreground",
  results.includes("text-foreground") && !results.includes("text-white"),
);
assert(
  "ToolResultsPanel uses border-border / bg-surface",
  results.includes("border-border") && results.includes("bg-surface"),
);

const sticky = read("components/tools/ToolStickyMobileActionBar.tsx");
assert(
  "ToolStickyMobileActionBar has no #121212 hard lock",
  !sticky.includes("#121212"),
);
assert(
  "ToolStickyMobileActionBar uses semantic surface/border",
  sticky.includes("bg-surface/95") && sticky.includes("border-border"),
);
assert(
  "ToolStickyMobileActionBar keeps spacer + measurement contract",
  sticky.includes("data-sticky-action-spacer") &&
    sticky.includes("setInsetBottomPx") &&
    sticky.includes("ResizeObserver"),
);

const pdfList = read("components/tools/PdfFileList.tsx");
assert(
  "PdfFileList has no text-white / bg-black/40 locks",
  !pdfList.includes("text-white") && !pdfList.includes("bg-black/40"),
);

const imageGrid = read("components/tools/ImagePreviewGrid.tsx");
assert(
  "ImagePreviewGrid has no text-white / bg-black/40 locks",
  !imageGrid.includes("text-white") && !imageGrid.includes("bg-black/40"),
);

const drop = read("components/tools/FileDropZone.tsx");
assert(
  "FileDropZone unchanged (no Wave-1 edit required)",
  !drop.includes("text-white") && drop.includes("border-border"),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
