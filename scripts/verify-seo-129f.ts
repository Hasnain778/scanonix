/**
 * Thin tool content depth verification (Phase 129F).
 * Run: npx tsx scripts/verify-seo-129f.ts
 */

import { TOOL_SEO } from "../constants/tool-seo";
import { SCANONIX_TOOLS } from "../constants/tools-directory-data";
import { TOOL_ACCESS } from "../lib/plan/tool-access";

const WEBP_CONVERTER_IDS = [
  "png-to-webp",
  "jpg-to-webp",
  "webp-to-jpg",
  "webp-to-png",
] as const;

const REQUIRED_TARGET_IDS = [...WEBP_CONVERTER_IDS, "heic-to-png"] as const;

const OPTIONAL_TARGET_IDS = ["rotate-pdf"] as const;

const TARGET_TOOL_IDS = [...REQUIRED_TARGET_IDS, ...OPTIONAL_TARGET_IDS] as const;

const MIN_FAQ_COUNT = 4;
const MIN_META_DESCRIPTION_LENGTH = 120;
const MIN_PAGE_DESCRIPTION_LENGTH = 120;

const PRO_TOOL_IDS = Object.entries(TOOL_ACCESS)
  .filter(([, cfg]) => cfg.requiresPro)
  .map(([id]) => id);

const PRO_INDEXABLE_TOOL_IDS = PRO_TOOL_IDS.filter((id) => Boolean(TOOL_SEO[id]));

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

function hasMisleadingProFreeClaim(toolId: string): string | null {
  const seo = TOOL_SEO[toolId];
  if (!seo) return "missing TOOL_SEO entry";

  const freePattern = /\bfree\b/i;
  const fields: Array<[string, string]> = [
    ["seoTitle", seo.seoTitle],
    ["metaDescription", seo.metaDescription],
    ["h1", seo.h1],
  ];

  for (const [field, value] of fields) {
    if (freePattern.test(value)) {
      return `${field} contains "free": ${value}`;
    }
  }

  if (seo.keywords?.some((kw) => freePattern.test(kw))) {
    return `keywords contain "free": ${seo.keywords.join(", ")}`;
  }

  return null;
}

function hasContentDepth(toolId: string): boolean {
  const seo = TOOL_SEO[toolId];
  if (!seo) return false;

  const hasSections =
    (seo.useCases?.length ?? 0) >= 3 && (seo.limitations?.length ?? 0) >= 3;

  const hasLongFormCopy =
    seo.pageDescription.length >= MIN_PAGE_DESCRIPTION_LENGTH &&
    seo.whyUse.length >= 4 &&
    seo.howToSteps.length >= 3;

  return hasSections && hasLongFormCopy;
}

function run() {
  console.log("\nThin tool content depth verification (Phase 129F)\n");

  // 1. Registry unchanged — 36 tools, exactly 4 WEBP converters
  assert("1 tools directory count is 36", SCANONIX_TOOLS.length === 36);

  const directoryWebpIds = SCANONIX_TOOLS.map((tool) => tool.id).filter((id) =>
    /webp/i.test(id),
  );
  assert(
    "1 exactly four WEBP converter tools in registry",
    directoryWebpIds.length === 4 &&
      WEBP_CONVERTER_IDS.every((id) => directoryWebpIds.includes(id)),
    directoryWebpIds.join(", "),
  );

  for (const toolId of TARGET_TOOL_IDS) {
    assert(`1 target tool ${toolId} exists in directory`, SCANONIX_TOOLS.some((tool) => tool.id === toolId));
    assert(`1 target tool ${toolId} has TOOL_SEO entry`, Boolean(TOOL_SEO[toolId]));
  }

  // 2. Content depth — useCases, limitations, richer copy
  for (const toolId of TARGET_TOOL_IDS) {
    const seo = TOOL_SEO[toolId];
    assert(`2 ${toolId} has useCases (>=3)`, (seo.useCases?.length ?? 0) >= 3, String(seo.useCases?.length));
    assert(
      `2 ${toolId} has limitations (>=3)`,
      (seo.limitations?.length ?? 0) >= 3,
      String(seo.limitations?.length),
    );
    assert(
      `2 ${toolId} meets minimum content depth`,
      hasContentDepth(toolId),
      `pageDescription=${seo.pageDescription.length}, whyUse=${seo.whyUse.length}`,
    );
    assert(
      `2 ${toolId} metaDescription length >= ${MIN_META_DESCRIPTION_LENGTH}`,
      seo.metaDescription.length >= MIN_META_DESCRIPTION_LENGTH,
      String(seo.metaDescription.length),
    );
  }

  // 3. FAQ count and format-specific answers
  for (const toolId of TARGET_TOOL_IDS) {
    const seo = TOOL_SEO[toolId];
    assert(
      `3 ${toolId} has >= ${MIN_FAQ_COUNT} FAQs`,
      seo.faqs.length >= MIN_FAQ_COUNT,
      String(seo.faqs.length),
    );

    const questions = seo.faqs.map((faq) => faq.question.trim().toLowerCase());
    assert(
      `3 ${toolId} FAQ questions are unique`,
      new Set(questions).size === questions.length,
    );
  }

  // 4. Differentiated page copy — no identical paragraphs across targets
  const pageDescriptions = TARGET_TOOL_IDS.map((id) => TOOL_SEO[id].pageDescription.trim());
  assert(
    "4 target pageDescription values are all unique",
    new Set(pageDescriptions).size === pageDescriptions.length,
  );

  const metaDescriptions = TARGET_TOOL_IDS.map((id) => TOOL_SEO[id].metaDescription.trim());
  assert(
    "4 target metaDescription values are all unique",
    new Set(metaDescriptions).size === metaDescriptions.length,
  );

  const firstFaqAnswers = TARGET_TOOL_IDS.map((id) => TOOL_SEO[id].faqs[0]?.answer.trim() ?? "");
  assert(
    "4 target first FAQ answers are all unique",
    new Set(firstFaqAnswers).size === firstFaqAnswers.length,
  );

  // 5. Accurate free/client-side claims for targeted free client tools
  for (const toolId of TARGET_TOOL_IDS) {
    const access = TOOL_ACCESS[toolId];
    assert(`5 ${toolId} is free client tool`, access?.requiresPro === false && access?.processing === "client");

    const seo = TOOL_SEO[toolId];
    const mentionsFree =
      /\bfree\b/i.test(seo.metaDescription) ||
      seo.faqs.some((faq) => /\bfree\b/i.test(faq.question) || /\bfree\b/i.test(faq.answer));

    if (access?.processing === "client") {
      const mentionsLocal =
        seo.whyUse.some((item) => /browser|locally|device|not uploaded/i.test(item)) ||
        seo.faqs.some((faq) => /browser|locally|device|not uploaded/i.test(faq.answer));
      assert(`5 ${toolId} mentions local browser processing`, mentionsLocal);
    }

    assert(`5 ${toolId} includes accurate free claim`, mentionsFree);
  }

  // 6. No new misleading free claims on Pro indexable tools
  for (const toolId of PRO_INDEXABLE_TOOL_IDS) {
    const issue = hasMisleadingProFreeClaim(toolId);
    assert(`6 Pro tool ${toolId} has no misleading free claims`, issue === null, issue ?? "");
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
