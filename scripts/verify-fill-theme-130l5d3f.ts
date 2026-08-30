/**
 * Phase 130L-5D-3F — Fill PDF theme guards.
 * Run: npx tsx scripts/verify-fill-theme-130l5d3f.ts
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

console.log("\n130L-5D-3F Fill PDF theme verification\n");

const tool = read("components/tools/fill-pdf/FillPdfTool.tsx");
assert(
  "FillPdfTool chrome uses semantic surfaces/foreground",
  tool.includes("text-foreground") &&
    tool.includes("bg-surface") &&
    tool.includes("border-border") &&
    !tool.includes("bg-[#0a0a0a]") &&
    !tool.includes("bg-[#121212]"),
);
assert(
  "FillPdfTool pasteboard uses bg-surface-muted",
  tool.includes("bg-surface-muted"),
);
assert(
  "ResultActionBar usage preserved (frozen shared)",
  tool.includes("ResultActionBar") &&
    tool.includes('label: "Download filled PDF"') &&
    tool.includes('label: "Start over"'),
);
assert(
  "Export/download handlers preserved",
  tool.includes("handleExport") &&
    tool.includes("handleDownload") &&
    tool.includes("resetWorkspace"),
);

const preview = read("components/tools/fill-pdf/PdfFormPreview.tsx");
assert(
  "PDF page bg-white preserved",
  preview.includes("bg-white"),
);
assert(
  "PDF render #ffffff preserved",
  preview.includes('fillStyle = "#ffffff"'),
);
assert(
  "Preview root data attribute preserved",
  preview.includes("data-fill-pdf-preview-root"),
);
assert(
  "DirectFormFieldOverlay still mounted from preview",
  preview.includes("DirectFormFieldOverlay"),
);
assert(
  "Loading/error chrome no longer hard #1a1a1a",
  !preview.includes("bg-[#1a1a1a]") &&
    preview.includes("bg-surface-muted"),
);

const overlay = read("components/tools/fill-pdf/DirectFormFieldOverlay.tsx");
assert(
  "WYSIWYG text-black preserved on overlays",
  (overlay.match(/text-black/g) || []).length >= 2,
);
assert(
  "WYSIWYG white/transparent field backgrounds preserved",
  overlay.includes("bg-transparent") &&
    overlay.includes("bg-white/50") &&
    overlay.includes("bg-white/40"),
);
assert(
  "Overlay does not use theme tokens for field fill/text",
  !overlay.includes("text-foreground") &&
    !overlay.includes("bg-surface") &&
    !overlay.includes("input-field") &&
    !overlay.includes("currentColor"),
);
assert(
  "Overlay geometry/handlers preserved",
  overlay.includes("pointer-events-auto absolute") &&
    overlay.includes("data-field-name") &&
    overlay.includes("onChange"),
);

const toolbar = read("components/tools/fill-pdf/TextFormatToolbar.tsx");
assert(
  "TextFormatToolbar uses semantic chrome",
  toolbar.includes("text-foreground") &&
    toolbar.includes("border-border") &&
    toolbar.includes("bg-surface-raised") &&
    !toolbar.includes("bg-[#141414]") &&
    !toolbar.includes("border-white/10"),
);
assert(
  "TextFormatToolbar orange active state preserved",
  toolbar.includes("border-scanonix-orange") &&
    toolbar.includes("bg-scanonix-orange/20"),
);
assert(
  "TextFormatToolbar format handlers preserved",
  toolbar.includes("data-fill-pdf-text-format-toolbar") &&
    toolbar.includes("onChange({ bold:") &&
    toolbar.includes("fontSize"),
);

const navigator = read("components/tools/fill-pdf/FieldsNavigator.tsx");
assert(
  "FieldsNavigator uses semantic panel chrome",
  navigator.includes("bg-surface/98") &&
    navigator.includes("text-foreground") &&
    navigator.includes("border-border") &&
    !navigator.includes("bg-[#0d1117]"),
);
assert(
  "FieldsNavigator scrim preserved",
  navigator.includes("bg-black/50"),
);
assert(
  "FieldsNavigator selection/jump preserved",
  navigator.includes("data-fill-pdf-fields-navigator") &&
    navigator.includes("data-nav-field") &&
    navigator.includes("onFieldSelect") &&
    navigator.includes("bg-scanonix-orange/10"),
);

const orphans = [
  "components/tools/fill-pdf/FormFieldPanel.tsx",
  "components/tools/fill-pdf/FormFieldControl.tsx",
  "components/tools/fill-pdf/FormFieldOverlay.tsx",
];
for (const rel of orphans) {
  assert(`${rel} still present (orphan untouched)`, existsSync(join(root, rel)));
}

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
