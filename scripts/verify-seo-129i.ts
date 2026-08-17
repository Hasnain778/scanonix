/**
 * OCR search-intent SEO deepening verification (Phase 129I).
 * Run: npm run verify:seo-129i
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_SITE_ORIGIN } from "../config/canonical-site-url";
import { TOOL_SEO } from "../constants/tool-seo";
import { SCANONIX_TOOLS } from "../constants/tools-directory-data";
import { TOOL_ACCESS } from "../lib/plan/tool-access";

const OCR_ID = "ocr";
const QR_ID = "qr-scanner";

const MIN_OCR_FAQ_COUNT = 8;
const MIN_OCR_PAGE_DESCRIPTION_LENGTH = 200;
const MIN_META_DESCRIPTION_LENGTH = 120;

/** Natural intent concepts from 129H-2 — not exact query stuffing targets. */
const OCR_INTENT_CONCEPTS = [
  /ocr reader/i,
  /scan(ned|ning)?/i,
  /extract.*text/i,
  /text extraction/i,
  /scanned (pdf|document)/i,
  /image|photo|screenshot/i,
  /tesseract/i,
  /handwriting.*limited|limited.*handwriting/i,
];

const QR_QR_FOCUS_PATTERNS = [
  /qr code/i,
  /qr barcode|barcode/i,
  /decode/i,
];

const PRO_TOOL_IDS = Object.entries(TOOL_ACCESS)
  .filter(([, cfg]) => cfg.requiresPro)
  .map(([id]) => id);

const PRO_INDEXABLE_TOOL_IDS = PRO_TOOL_IDS.filter((id) => Boolean(TOOL_SEO[id]));

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

function readSource(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function ocrCombinedCopy(): string {
  const seo = TOOL_SEO[OCR_ID];
  return [
    seo.seoTitle,
    seo.metaDescription,
    seo.h1,
    seo.headerDescription ?? "",
    seo.pageDescription,
    ...seo.howToSteps,
    ...seo.whyUse,
    ...(seo.useCases ?? []),
    ...(seo.limitations ?? []),
    ...seo.keyFeatures,
    ...seo.faqs.flatMap((faq) => [faq.question, faq.answer]),
    ...(seo.keywords ?? []),
  ].join("\n");
}

function countPhraseOccurrences(text: string, phrase: string): number {
  const regex = new RegExp(phrase.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "gi");
  return (text.match(regex) ?? []).length;
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

function run() {
  console.log("\nOCR search-intent SEO deepening verification (Phase 129I)\n");

  const ocr = TOOL_SEO[OCR_ID];
  const qr = TOOL_SEO[QR_ID];

  assert("1 ocr tool exists in directory", SCANONIX_TOOLS.some((tool) => tool.id === OCR_ID));
  assert("1 qr-scanner tool exists in directory", SCANONIX_TOOLS.some((tool) => tool.id === QR_ID));
  assert("1 ocr has TOOL_SEO entry", Boolean(ocr));
  assert("1 qr-scanner has TOOL_SEO entry", Boolean(qr));

  // 2. OCR content depth
  assert(
    "2 ocr pageDescription length >= 200",
    ocr.pageDescription.length >= MIN_OCR_PAGE_DESCRIPTION_LENGTH,
    String(ocr.pageDescription.length),
  );
  assert("2 ocr has useCases (>=5)", (ocr.useCases?.length ?? 0) >= 5, String(ocr.useCases?.length));
  assert(
    "2 ocr has limitations (>=5)",
    (ocr.limitations?.length ?? 0) >= 5,
    String(ocr.limitations?.length),
  );
  assert(
    "2 ocr metaDescription length >= 120",
    ocr.metaDescription.length >= MIN_META_DESCRIPTION_LENGTH,
    String(ocr.metaDescription.length),
  );
  assert(
    `2 ocr has >= ${MIN_OCR_FAQ_COUNT} FAQs`,
    ocr.faqs.length >= MIN_OCR_FAQ_COUNT,
    String(ocr.faqs.length),
  );

  const ocrQuestions = ocr.faqs.map((faq) => faq.question.trim().toLowerCase());
  assert("2 ocr FAQ questions are unique", new Set(ocrQuestions).size === ocrQuestions.length);

  // 3. OCR intent concepts represented naturally
  const ocrCopy = ocrCombinedCopy();
  for (const pattern of OCR_INTENT_CONCEPTS) {
    assert(`3 ocr copy matches intent ${pattern}`, pattern.test(ocrCopy));
  }

  // 4. No keyword stuffing — cap repetitive exact phrases
  assert(
    "4 ocr no excessive 'ocr scan' repetition",
    countPhraseOccurrences(ocrCopy, "ocr scan") <= 4,
    String(countPhraseOccurrences(ocrCopy, "ocr scan")),
  );
  assert(
    "4 ocr no excessive 'online ocr' repetition",
    countPhraseOccurrences(ocrCopy, "online ocr") <= 5,
    String(countPhraseOccurrences(ocrCopy, "online ocr")),
  );
  assert(
    "4 ocr no fake accuracy percentage claims",
    !/\d{2,3}%\s*(accur|success)/i.test(ocrCopy),
  );
  assert(
    "4 ocr handwriting limitation preserved",
    ocr.limitations?.some((item) => /handwriting/i.test(item)) ?? false,
  );

  // 5. OCR metadata aligned to intent without aggressive CTR bait
  assert("5 ocr seoTitle mentions scan or extract", /scan|extract/i.test(ocr.seoTitle));
  assert(
    "5 ocr metaDescription mentions reader or extract",
    /reader|extract/i.test(ocr.metaDescription),
  );
  assert("5 ocr h1 unchanged core intent", /Extract Text from Scanned PDFs and Images/i.test(ocr.h1));

  // 6. QR scanner explicitly QR-focused
  const qrCopy = [
    qr.seoTitle,
    qr.metaDescription,
    qr.h1,
    qr.headerDescription ?? "",
    qr.pageDescription,
    ...qr.faqs.flatMap((faq) => [faq.question, faq.answer]),
  ].join("\n");

  for (const pattern of QR_QR_FOCUS_PATTERNS) {
    assert(`6 qr-scanner copy matches ${pattern}`, pattern.test(qrCopy));
  }
  assert("6 qr-scanner h1 says QR Code", /QR Code/i.test(qr.h1));
  assert(
    "6 qr-scanner clarifies not a document scanner",
    qr.faqs.some((faq) => /document|photo scanner|scanned pdf/i.test(faq.question + faq.answer)),
  );
  assert("6 qr-scanner references OCR for text extraction", /ocr/i.test(qrCopy));
  assert("6 qr-scanner relatedToolIds includes ocr", qr.relatedToolIds.includes(OCR_ID));

  // 7. Preserve 129F markers
  const webpSeo = TOOL_SEO["webp-to-png"];
  assert(
    "7 webp-to-png 129F useCases preserved",
    (webpSeo.useCases?.length ?? 0) >= 3 && webpSeo.pageDescription.length >= 120,
  );
  const heicSeo = TOOL_SEO["heic-to-png"];
  assert(
    "7 heic-to-png 129F content depth preserved",
    (heicSeo.useCases?.length ?? 0) >= 3 && heicSeo.faqs.length >= 4,
  );
  const rotateSeo = TOOL_SEO["rotate-pdf"];
  assert(
    "7 rotate-pdf 129F content preserved",
    rotateSeo.faqs.length >= 4 && rotateSeo.pageDescription.length >= 120,
  );

  // 8. Preserve 129G linking markers
  const toolRoute = readSource("components/workspace/ToolRoute.tsx");
  assert("8 ToolRoute image breadcrumb uses hub href", toolRoute.includes("getCategoryBreadcrumbHref"));
  assert(
    "8 PopularToolsSection links image category to hub",
    readSource("components/home/PopularToolsSection.tsx").includes("getImageToolsHubHref()"),
  );

  // 9. Canonical / schema surfaces unchanged
  assert("9 canonical origin is www", CANONICAL_SITE_ORIGIN === "https://www.scanonix.com");
  assert("9 ocr path unchanged", ocr.path === "/tools/ocr");
  assert("9 qr-scanner path unchanged", qr.path === "/tools/qr-scanner");
  assert(
    "9 verify script exists",
    existsSync(join(root, "scripts", "verify-seo-129i.ts")),
  );

  // 10. Pro copy guards
  for (const toolId of PRO_INDEXABLE_TOOL_IDS) {
    const issue = hasMisleadingProFreeClaim(toolId);
    assert(`10 Pro tool ${toolId} has no misleading free claims`, issue === null, issue ?? "");
  }

  // 11. OCR is free client tool — local processing mentioned
  const ocrAccess = TOOL_ACCESS[OCR_ID];
  assert("11 ocr is free client tool", ocrAccess?.requiresPro === false && ocrAccess?.processing === "client");
  assert(
    "11 ocr mentions local browser processing",
    ocr.whyUse.some((item) => /browser|device|tesseract/i.test(item)) ||
      ocr.faqs.some((faq) => /browser|device|tesseract/i.test(faq.answer)),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
