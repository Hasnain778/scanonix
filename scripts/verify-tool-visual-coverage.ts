/**
 * Tool visual coverage verification (Phase 128F-FIX1).
 * Run: npx tsx scripts/verify-tool-visual-coverage.ts
 */

import { CANONICAL_TOOL_IDS } from "../constants/tool-categories";
import {
  getDuplicateVisualSlugs,
  getMissingVisualSlugs,
  TOOL_VISUALS,
  TOOL_VISUAL_SLUGS,
} from "../constants/tool-visuals";

/** All icon types implemented in components/ui/ToolIcon.tsx */
const VALID_ICON_TYPES = new Set([
  "image-pdf",
  "pdf-image",
  "merge",
  "split",
  "rotate-pdf",
  "organize-pdf",
  "crop-pdf",
  "add-page-numbers",
  "fill-pdf",
  "sign-pdf",
  "compress",
  "ocr",
  "word",
  "convert",
  "bg-remove",
  "qr",
  "scan",
  "secure",
  "manage",
  "android",
  "security",
  "protect-pdf",
  "unlock-pdf",
  "watermark-pdf",
  "redact-pdf",
  "metadata-cleaner",
  "pdf-to-word",
  "word-to-pdf",
  "image-compress",
  "image-resize",
  "image-upscale",
  "png-to-jpg",
  "jpg-to-png",
  "png-to-webp",
  "jpg-to-webp",
  "webp-to-jpg",
  "webp-to-png",
  "heic-to-jpg",
  "heic-to-png",
  "ai-translate",
  "ai-summary",
  "ai-rewrite",
]);

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

function run() {
  console.log("\nTool visual coverage verification (Phase 128F-FIX1)\n");

  const missing = getMissingVisualSlugs();
  const duplicates = getDuplicateVisualSlugs();

  assert(
    "Canonical tool count is 36",
    CANONICAL_TOOL_IDS.length === 36,
    `got ${CANONICAL_TOOL_IDS.length}`,
  );

  assert(
    "TOOL_VISUALS covers all 36 canonical tools",
    missing.length === 0,
    missing.length ? `missing: ${missing.join(", ")}` : "",
  );

  assert(
    "No duplicate visual slugs",
    duplicates.length === 0,
    duplicates.length ? duplicates.join(", ") : "",
  );

  assert(
    "TOOL_VISUALS has exactly 36 entries",
    TOOL_VISUAL_SLUGS.length === 36,
    `got ${TOOL_VISUAL_SLUGS.length}`,
  );

  const missingIconFields: string[] = [];
  const missingAccentFields: string[] = [];
  const missingGlowFields: string[] = [];
  const invalidEntries: string[] = [];
  const unknownIcons: string[] = [];

  for (const slug of CANONICAL_TOOL_IDS) {
    const visual = TOOL_VISUALS[slug];
    if (!visual) continue;

    if (!visual.icon?.trim()) missingIconFields.push(slug);
    if (!visual.accentColor?.trim()) missingAccentFields.push(slug);
    if (!visual.glowColor?.trim()) missingGlowFields.push(slug);
    if (!visual.iconFamily) invalidEntries.push(`${slug}: missing iconFamily`);
    if (!visual.motion) invalidEntries.push(`${slug}: missing motion`);
    if (visual.icon && !VALID_ICON_TYPES.has(visual.icon)) {
      unknownIcons.push(`${slug} → ${visual.icon}`);
    }
  }

  assert("Every tool has icon field", missingIconFields.length === 0, missingIconFields.join(", "));
  assert(
    "Every tool has accentColor",
    missingAccentFields.length === 0,
    missingAccentFields.join(", "),
  );
  assert("Every tool has glowColor", missingGlowFields.length === 0, missingGlowFields.join(", "));
  assert("All entries have iconFamily + motion", invalidEntries.length === 0, invalidEntries.join("; "));
  assert(
    "All icon types resolve to implemented ToolIcon glyphs",
    unknownIcons.length === 0,
    unknownIcons.join(", "),
  );

  console.log("\n--- Coverage summary ---");
  console.log(`Canonical tools: ${CANONICAL_TOOL_IDS.length}`);
  console.log(`Visual entries:  ${TOOL_VISUAL_SLUGS.length}`);
  console.log(`Missing:         ${missing.length}`);
  console.log(`Passed: ${passed}  Failed: ${failed}\n`);

  if (failed > 0) {
    process.exit(1);
  }
}

run();
