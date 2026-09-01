/**
 * Phase 130L-5F-2 — public P2 Bright theme chrome guards.
 * Run: npx tsx scripts/verify-public-theme-130l5f2.ts
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

console.log("\n130L-5F-2 public theme verification\n");

const consentBanner = read("components/analytics/ConsentBanner.tsx");
assert(
  "ConsentBanner shell is semantic (not fixed #0e0e0e)",
  consentBanner.includes("bg-surface-raised") &&
    !consentBanner.includes("bg-[#0e0e0e]"),
);
assert(
  "ConsentBanner text/actions are semantic",
  consentBanner.includes("text-foreground") &&
    consentBanner.includes("onClick={rejectAnalytics}") &&
    consentBanner.includes("onClick={acceptAnalytics}"),
);

const consentPanel = read("components/analytics/ConsentPreferencesPanel.tsx");
assert(
  "ConsentPreferencesPanel shell is semantic",
  consentPanel.includes("bg-surface-raised") &&
    consentPanel.includes("border-border") &&
    !consentPanel.includes("bg-[#0e0e0e]"),
);
assert(
  "ConsentPreferencesPanel handlers preserved",
  consentPanel.includes("onClick={rejectAnalytics}") &&
    consentPanel.includes("onClick={acceptAnalytics}") &&
    consentPanel.includes("closePreferences"),
);

const bgTool = read("components/tools/background-remover/BackgroundRemoverTool.tsx");
const studioControls = read("components/tools/background-remover/ImageStudioControls.tsx");
assert(
  "BG studio controls use semantic chrome",
  studioControls.includes("text-foreground") &&
    studioControls.includes("border-border") &&
    studioControls.includes("bg-surface-muted") &&
    !studioControls.includes("bg-[#0e0e0e]") &&
    !studioControls.includes("border-white/10"),
);
assert(
  "BG uploaded file label is semantic",
  bgTool.includes("text-foreground") && !bgTool.includes("text-white"),
);

const beforeAfter = read("components/tools/background-remover/BeforeAfterSlider.tsx");
assert(
  "BG comparison retains intentional media blacks",
  beforeAfter.includes("bg-black/40") &&
    beforeAfter.includes("bg-black/60") &&
    beforeAfter.includes("CheckerboardBackground"),
);

const aiRewrite = read("components/tools/ai-rewrite/AiRewriteTool.tsx");
assert(
  "AiRewriteTool inputs/labels are semantic",
  aiRewrite.includes("input-field") &&
    aiRewrite.includes("select-field") &&
    aiRewrite.includes("text-foreground") &&
    !aiRewrite.includes("text-neutral-300") &&
    !aiRewrite.includes("bg-black/40"),
);

const cloudAi = read("components/tools/ai/CloudAiTextTool.tsx");
assert(
  "CloudAiTextTool shared chrome is semantic",
  cloudAi.includes("input-field") &&
    cloudAi.includes("text-foreground") &&
    !cloudAi.includes("text-neutral-300") &&
    !cloudAi.includes("bg-black/40"),
);

const qrTool = read("components/tools/qr-scanner/QrScannerTool.tsx");
const qrResult = read("components/tools/qr-scanner/QrResultPanel.tsx");
assert(
  "QR mode chips are semantic",
  qrTool.includes("text-foreground") &&
    qrTool.includes("bg-surface-muted") &&
    !qrTool.includes("bg-black/30"),
);
assert(
  "QR result panel chrome is semantic",
  qrResult.includes("text-foreground") &&
    qrResult.includes("bg-surface-muted") &&
    !qrResult.includes("bg-black/40") &&
    !qrResult.includes("text-white"),
);

const upscaler = read("components/tools/ai-translate/AiTranslateTool.tsx");
const upscalerTool = read("components/tools/image-upscaler/ImageUpscalerTool.tsx");
assert(
  "AiTranslateTool still frozen (5F-1 untouched)",
  upscaler.includes("text-foreground") && !upscaler.includes("text-neutral-300"),
);
assert(
  "Upscaler app chrome migrated; preview wells retain media black",
  upscalerTool.includes("text-foreground") &&
    upscalerTool.includes("bg-surface-muted") &&
    upscalerTool.includes("bg-black/30"),
);

const compressor = read("components/tools/image-compressor/ImageCompressorTool.tsx");
const resizer = read("components/tools/image-resizer/ImageResizerTool.tsx");
assert(
  "Compressor preview well retains intentional media black",
  compressor.includes("bg-black/30") &&
    compressor.includes("text-foreground"),
);
assert(
  "Resizer preview well retains intentional media black",
  resizer.includes("bg-black/30") &&
    resizer.includes("text-foreground"),
);

console.log(`\nResult: ${passed}/${passed + failed} ${failed === 0 ? "PASS" : "FAIL"}\n`);
process.exit(failed === 0 ? 0 : 1);
