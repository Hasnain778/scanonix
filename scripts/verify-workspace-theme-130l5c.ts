/**
 * Phase 130L-5C Wave 2 — static tool workspace theme guards.
 * Run: npx tsx scripts/verify-workspace-theme-130l5c.ts
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

console.log("\n130L-5C Wave 2 workspace theme verification\n");

const scan = read("components/tools/security-scan/SecurityScanTool.tsx");
assert(
  "SecurityScanTool uses semantic surface/foreground",
  scan.includes("text-foreground") &&
    scan.includes("bg-surface/95") &&
    !scan.includes('text-white">Website Scanner') &&
    !scan.includes("bg-[#0c0c0c]"),
);

const progress = read("components/tools/security-scan/ScanStageProgress.tsx");
assert(
  "ScanStageProgress percent uses text-foreground",
  progress.includes("text-foreground") && !progress.includes("text-white"),
);

const page = read("app/tools/security-scan/page.tsx");
assert(
  "security-scan H1 uses text-foreground (wording untouched)",
  page.includes("text-foreground") &&
    page.includes("{tool.h1}") &&
    !/h1 className="[^"]*text-white/.test(page),
);

const gate = read("components/tools/security/ProSecurityGate.tsx");
assert(
  "ProSecurityGate uses semantic surface gradient + foreground",
  gate.includes("via-surface-raised") &&
    gate.includes("text-foreground") &&
    !gate.includes("via-[#141414]"),
);

const workspace = read("components/tools/security/SecurityToolWorkspace.tsx");
assert(
  "SecurityToolWorkspace loading/name are semantic",
  workspace.includes("bg-surface") &&
    workspace.includes("text-foreground") &&
    !workspace.includes("bg-[#0e0e0e]"),
);

const converter = read("components/image-tools/ImageFormatConverterTool.tsx");
assert(
  "ImageFormatConverterTool panels are semantic",
  converter.includes("border-border") &&
    converter.includes("bg-surface") &&
    !converter.includes("border-white/10") &&
    !converter.includes('text-white">'),
);

const format = read("components/image-tools/FormatDirection.tsx");
assert(
  "FormatDirection FROM chip is semantic",
  format.includes("text-foreground") && !format.includes("text-white"),
);

const extras = read("components/image-tools/ConverterToolExtras.tsx");
assert(
  "ConverterToolExtras heading is semantic",
  extras.includes("text-foreground") && !extras.includes("text-white"),
);

const stats = read("components/tools/shared/ImageToolStats.tsx");
assert(
  "ImageToolStats values use text-foreground",
  stats.includes("text-foreground") && !stats.includes("text-white") && !stats.includes("bg-black/30"),
);

const pdfBanner = read("components/tools/pdf-to-word/PdfToWordProgressBanner.tsx");
assert(
  "PdfToWordProgressBanner loading uses text-foreground",
  pdfBanner.includes("text-foreground") &&
    !pdfBanner.includes('loading: "border-scanonix-orange/40 bg-scanonix-orange/10 text-white"'),
);

console.log(`\n${passed} passed, ${failed} failed\n`);
process.exit(failed > 0 ? 1 : 0);
