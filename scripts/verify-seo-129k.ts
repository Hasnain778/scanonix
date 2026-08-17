/**
 * PDF to Word conservative search-intent SEO verification (Phase 129K).
 * Run: npm run verify:seo-129k
 */

import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { CANONICAL_SITE_ORIGIN } from "../config/canonical-site-url";
import { TOOL_SEO } from "../constants/tool-seo";
import { TOOL_ACCESS } from "../lib/plan/tool-access";

const PDF_TO_WORD_ID = "pdf-to-word";
const OCR_ID = "ocr";
const QR_ID = "qr-scanner";
const BG_ID = "background-remover";
const FILL_ID = "fill-pdf";

const PRESERVED_TITLE = "PDF to Word Converter Online";
const PRESERVED_H1 = "Convert PDF to Word Online";

/** Production API uses CloudConvert — not local Tesseract OCR in convert-pdf-to-word.ts */
const PRODUCTION_CONVERTER_MARKER = "cloudConvertProvider.convertPdfToDocx";

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

function pdfToWordCombinedCopy(): string {
  const seo = TOOL_SEO[PDF_TO_WORD_ID];
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

function run() {
  console.log("\nPDF to Word conservative SEO verification (Phase 129K)\n");

  const seo = TOOL_SEO[PDF_TO_WORD_ID];
  const copy = pdfToWordCombinedCopy();
  const apiRoute = readSource("app/api/tools/pdf-to-word/route.ts");

  // 1. Title / H1 preserved
  assert("1 pdf-to-word seoTitle preserved", seo.seoTitle.includes(PRESERVED_TITLE));
  assert("1 pdf-to-word h1 preserved", seo.h1 === PRESERVED_H1);

  // 2. Production conversion path is CloudConvert
  assert(
    "2 production API uses CloudConvert",
    apiRoute.includes(PRODUCTION_CONVERTER_MARKER),
  );

  // 3. Scanned-PDF / OCR claims must not misstate Scanonix OCR
  assert(
    "3 copy does not claim Scanonix runs OCR for pdf-to-word",
    !/Scanonix (detects image-only|runs OCR)/i.test(copy),
  );
  assert(
    "3 copy does not claim automatic OCR fallback",
    !/OCR fallback/i.test(copy),
  );
  assert(
    "3 copy mentions CloudConvert conversion truthfully",
    /CloudConvert/i.test(copy),
  );
  assert(
    "3 scanned PDF limitations are honest",
    seo.limitations?.some((item) => /scanned|image-only/i.test(item)) ?? false,
  );

  // 4. Differentiated content depth
  assert(
    "4 pageDescription length >= 200",
    seo.pageDescription.length >= 200,
    String(seo.pageDescription.length),
  );
  assert("4 useCases count >= 4", (seo.useCases?.length ?? 0) >= 4);
  assert("4 limitations count >= 5", (seo.limitations?.length ?? 0) >= 5);
  assert("4 faq count remains 6", seo.faqs.length === 6);

  const questions = seo.faqs.map((faq) => faq.question.trim().toLowerCase());
  assert("4 faq questions are unique", new Set(questions).size === questions.length);

  // 5. Pro / free accuracy
  const access = TOOL_ACCESS[PDF_TO_WORD_ID];
  assert("5 pdf-to-word requires Pro", access?.requiresPro === true);
  assert("5 pdf-to-word is server-side", access?.processing === "server");
  assert(
    "5 faq states Pro requirement",
    seo.faqs.some((faq) => /Pro feature/i.test(faq.answer)),
  );
  assert(
    "5 no misleading free claim in title/meta/h1",
    !/\bfree\b/i.test(`${seo.seoTitle} ${seo.metaDescription} ${seo.h1}`),
  );
  assert(
    "5 no fake accuracy percentage claims",
    !/\d{2,3}%\s*(accur|success)/i.test(copy),
  );

  // 6. Related tools preserved
  assert(
    "6 relatedToolIds preserved",
    JSON.stringify(seo.relatedToolIds) ===
      JSON.stringify(["ocr", "word-to-pdf", "compress-pdf", "sign-pdf"]),
  );

  // 7. Canonical / path unchanged
  assert("7 canonical origin is www", CANONICAL_SITE_ORIGIN === "https://www.scanonix.com");
  assert("7 pdf-to-word path unchanged", seo.path === "/tools/pdf-to-word");

  // 8. Preserve 129I OCR markers
  const ocr = TOOL_SEO[OCR_ID];
  assert("8 ocr 129I title preserved", ocr.seoTitle.includes("OCR Scan Online"));
  assert("8 ocr faq count >= 8", ocr.faqs.length >= 8);

  // 9. Preserve QR 129I clarification
  const qr = TOOL_SEO[QR_ID];
  assert("9 qr-scanner h1 says QR Code", /QR Code/i.test(qr.h1));
  assert(
    "9 qr-scanner clarifies not document scanner",
    qr.faqs.some((faq) => /document|photo scanner/i.test(faq.question + faq.answer)),
  );

  // 10. Preserve 129F markers
  const webpSeo = TOOL_SEO["webp-to-png"];
  assert(
    "10 webp-to-png 129F useCases preserved",
    (webpSeo.useCases?.length ?? 0) >= 3 && webpSeo.pageDescription.length >= 120,
  );

  // 11. Preserve 129G linking markers
  assert(
    "11 ToolRoute uses getCategoryBreadcrumbHref",
    readSource("components/workspace/ToolRoute.tsx").includes("getCategoryBreadcrumbHref"),
  );

  // 12. Background remover untouched
  const bgBefore = TOOL_SEO[BG_ID];
  assert(
    "12 background-remover title unchanged",
    bgBefore.seoTitle.includes("Remove Background from Image Online"),
  );
  assert(
    "12 background-remover h1 unchanged",
    bgBefore.h1 === "Remove Image Background Online",
  );
  assert("12 background-remover faq count unchanged", bgBefore.faqs.length === 5);

  // 13. Fill PDF untouched
  const fill = TOOL_SEO[FILL_ID];
  assert("13 fill-pdf h1 unchanged", fill.h1 === "Fill PDF Form");
  assert("13 fill-pdf faq count unchanged", fill.faqs.length === 7);
  assert(
    "13 fill-pdf has no useCases section yet",
    (fill.useCases?.length ?? 0) === 0,
  );

  assert(
    "13 verify script exists",
    existsSync(join(root, "scripts", "verify-seo-129k.ts")),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
