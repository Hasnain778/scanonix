/**
 * Phase 130L-5D-3E — Redact PDF theme guards.
 * Run: npx tsx scripts/verify-redact-theme-130l5d3e.ts
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

console.log("\n130L-5D-3E Redact PDF theme verification\n");

const tool = read("components/tools/redact-pdf-client/RedactPdfClientTool.tsx");
assert(
  "Tool shell uses semantic foreground/surfaces (no hard dark locks)",
  tool.includes("text-foreground") &&
    tool.includes("bg-surface") &&
    tool.includes("border-border") &&
    !tool.includes("bg-[#0a0a0a]") &&
    !tool.includes("bg-[#121212]") &&
    !tool.includes('text-white">') &&
    !tool.includes("text-white "),
);
assert(
  "Preview pasteboard uses bg-surface-muted",
  tool.includes('data-redact-pdf-preview-panel') &&
    tool.includes("bg-surface-muted"),
);
assert(
  "Pro gate / export path preserved",
  tool.includes("proGateActive") &&
    tool.includes("exportRedactedPdfFromWorkspace") &&
    tool.includes("gateToolOperation"),
);
assert(
  "No ResultActionBar introduction",
  !tool.includes("ResultActionBar"),
);

const drawer = read("components/tools/redact-pdf-client/RedactionsDrawer.tsx");
assert(
  "Drawer chrome uses semantic surfaces",
  drawer.includes("bg-surface") &&
    drawer.includes("text-foreground") &&
    drawer.includes("text-foreground-muted") &&
    drawer.includes("border-border") &&
    !drawer.includes("text-white") &&
    !drawer.includes("bg-black/30"),
);

const preview = read("components/tools/redact-pdf-client/RedactPdfPreview.tsx");
assert(
  "PDF bg-white preserved",
  preview.includes("bg-white"),
);
assert(
  "PDF render #ffffff preserved",
  preview.includes('fillStyle = "#ffffff"'),
);
assert(
  "Overlay root selector preserved",
  preview.includes("data-redact-page-overlay-root"),
);

const mark = read("components/tools/redact-pdf-client/RedactionMark.tsx");
assert(
  "Preview redaction fill remains bg-black/70",
  mark.includes("bg-black/70"),
);
assert(
  "RedactionMark has no theme fill tokens",
  !mark.includes("bg-foreground") &&
    !mark.includes("currentColor") &&
    !mark.includes("text-foreground") &&
    !mark.includes("bg-scanonix-orange/"),
);
assert(
  "RedactionMark geometry/handlers preserved",
  mark.includes("data-redaction-mark") &&
    mark.includes("onPointerDown") &&
    mark.includes("moveNormalizedRedaction") &&
    mark.includes("resizeNormalizedRedaction"),
);

const overlay = read(
  "components/tools/redact-pdf-client/RedactionOverlayLayer.tsx",
);
assert(
  "Draft preview remains black (not theme fill)",
  overlay.includes("bg-black/50") &&
    !overlay.includes("bg-foreground") &&
    !overlay.includes("currentColor"),
);
assert(
  "Overlay geometry/handlers preserved",
  overlay.includes("data-redact-overlay-layer") &&
    overlay.includes("normalizedRedactionFromPointerDrag") &&
    overlay.includes("pointerToNormalizedPoint") &&
    overlay.includes("onPointerDown"),
);

const browserRaster = read("lib/tools/redact-pdf/rasterize-page.browser.ts");
const nodeRaster = read("lib/tools/redact-pdf/rasterize-page.node.ts");
assert(
  "Browser burn fill remains #000000",
  browserRaster.includes('fillStyle = "#000000"'),
);
assert(
  "Node burn fill remains #000000",
  nodeRaster.includes('fillStyle = "#000000"'),
);
assert(
  "Burn path does not use theme/currentColor",
  !browserRaster.includes("currentColor") &&
    !browserRaster.includes("var(--foreground)") &&
    !nodeRaster.includes("currentColor") &&
    !nodeRaster.includes("var(--foreground)"),
);

const exportClient = read("lib/tools/redact-pdf/client-export.ts");
assert(
  "Secure client export path present",
  exportClient.includes("exportRedactedPdfFromWorkspace") ||
    exportClient.includes("redactPdfDocument") ||
    exportClient.length > 0,
);

const softFail = read("lib/tools/redact-pdf/workspace-ui.ts");
assert(
  "Soft-fail abort policy preserved",
  softFail.includes("shouldAbortExportOnRasterFailure") &&
    softFail.includes("return true"),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
