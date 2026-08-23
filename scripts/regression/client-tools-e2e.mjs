#!/usr/bin/env node
/**
 * Client tool browser regression — 21 anonymous GREEN tools (excludes redact-pdf).
 * Validates actual output bytes/content, not UI-only success signals.
 *
 * Run: npm run verify:regression:client-e2e
 * Env: REGRESSION_BASE_URL (default http://localhost:3000)
 *      REGRESSION_SCREENSHOT_DIR (optional failure screenshots)
 *      REGRESSION_FORCE_FAIL_SLUG (test-only — forces one assertion failure)
 */

import puppeteer from "puppeteer";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { isJpeg, isPdf, isPng, isWebp, isZip, magicHex } from "./lib/binary.mjs";
import {
  attachPageDiagnostics,
  captureFailureArtifacts,
  clickButtonContaining,
  installDownloadHook,
  launchBrowser,
  readAllBlobs,
  readLastBlob,
  sleep,
  uploadFiles,
  waitForBodyText,
} from "./lib/puppeteer-helpers.mjs";
import { exitWithSummary, fail, pass, printHeader, summarizeResults } from "./lib/report.mjs";

const BASE = process.env.REGRESSION_BASE_URL || "http://localhost:3000";
const FIX = join(process.cwd(), "tests", "fixtures", "regression");
const SCREENSHOT_DIR = process.env.REGRESSION_SCREENSHOT_DIR || "";
const FORCE_FAIL = process.env.REGRESSION_FORCE_FAIL_SLUG || "";

const CLIENT_TOOLS = [
  "merge-pdf",
  "split-pdf",
  "organize-pdf",
  "rotate-pdf",
  "crop-pdf",
  "fill-pdf",
  "sign-pdf",
  "add-page-numbers",
  "watermark-pdf",
  "pdf-to-image",
  "image-to-pdf",
  "jpg-to-png",
  "png-to-jpg",
  "jpg-to-webp",
  "png-to-webp",
  "webp-to-jpg",
  "webp-to-png",
  "heic-to-jpg",
  "heic-to-png",
  "ocr",
  "qr-scanner",
];

function fp(name) {
  return join(FIX, name);
}

async function pdfPageCount(bytes) {
  try {
    return (await PDFDocument.load(bytes)).getPageCount();
  } catch {
    return -1;
  }
}

function record(results, slug, ok, detail, meta = {}) {
  results[slug] = { ok, detail, ...meta };
  if (ok) pass(slug, detail);
  else fail(slug, detail, { slug, ...meta });
}

async function withPage(fn) {
  const browser = await launchBrowser(puppeteer);
  const page = await browser.newPage();
  page.setDefaultTimeout(120000);
  const diagnostics = {};
  attachPageDiagnostics(page, diagnostics);
  try {
    await fn(page, diagnostics);
  } finally {
    await browser.close();
  }
  return diagnostics;
}

async function runMergePdf(results) {
  const slug = "merge-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/merge-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("single-page-a.pdf"), fp("single-page-b.pdf"));
    await waitForBodyText(page, "single-page-a.pdf", 30000);
    await clickButtonContaining(page, "Merge PDFs");
    await waitForBodyText(page, "ready to download", 90000);
    await clickButtonContaining(page, "Download");
    const blob = await readLastBlob(page);
    const pages = blob ? await pdfPageCount(blob.bytes) : -1;
    const ok =
      FORCE_FAIL === slug ? false : Boolean(blob && isPdf(blob.bytes) && pages === 2);
    record(results, slug, ok, ok ? `PDF ${pages} pages` : `expected 2-page PDF`, {
      assertion: "PDF magic + pageCount===2",
      output: blob ? { magic: magicHex(blob.bytes), pages, size: blob.size } : null,
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runSplitPdf(results) {
  const slug = "split-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/split-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("two-page.pdf"));
    await waitForBodyText(page, "2 page", 30000);
    await clickButtonContaining(page, "Select all");
    await clickButtonContaining(page, "Split PDF");
    await waitForBodyText(page, "ready to download", 90000);
    await clickButtonContaining(page, "Download split PDF");
    const blobs = await readAllBlobs(page);
    const pdfs = blobs.filter((b) => isPdf(b.bytes));
    const ok = FORCE_FAIL === slug ? false : pdfs.length >= 1;
    record(results, slug, ok, ok ? `${pdfs.length} PDF output(s)` : "no PDF output", {
      assertion: "at least one %PDF blob",
      output: pdfs[0] ? { magic: magicHex(pdfs[0].bytes), size: pdfs[0].size } : null,
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runRotatePdf(results) {
  const slug = "rotate-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/rotate-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("two-page.pdf"));
    await waitForBodyText(page, "Ready to rotate", 30000);
    await clickButtonContaining(page, "Rotate PDF");
    await waitForBodyText(page, "ready to download", 90000);
    await clickButtonContaining(page, "Download rotated PDF");
    const blob = await readLastBlob(page);
    const pages = blob ? await pdfPageCount(blob.bytes) : -1;
    const ok = FORCE_FAIL === slug ? false : Boolean(blob && isPdf(blob.bytes) && pages === 2);
    record(results, slug, ok, ok ? `PDF ${pages} pages` : "invalid rotate output", {
      assertion: "PDF magic + pageCount===2",
      output: blob ? { pages, size: blob.size } : null,
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runOrganizePdf(results) {
  const slug = "organize-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/organize-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("two-page.pdf"));
    await waitForBodyText(page, "two-page.pdf", 60000);
    await sleep(3000);
    await clickButtonContaining(page, "Export organized PDF");
    await waitForBodyText(page, "Organized PDF ready", 120000);
    await clickButtonContaining(page, "Download PDF");
    await sleep(1500);
    const blob = await readLastBlob(page);
    const pages = blob ? await pdfPageCount(blob.bytes) : -1;
    const ok = FORCE_FAIL === slug ? false : Boolean(blob && isPdf(blob.bytes) && pages === 2);
    record(results, slug, ok, ok ? `PDF ${pages} pages` : "invalid organize output", {
      assertion: "PDF magic + pageCount===2",
      output: blob ? { pages, size: blob.size } : null,
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runCropPdf(results) {
  const slug = "crop-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/crop-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("two-page.pdf"));
    await waitForBodyText(page, "two-page.pdf", 60000);
    (await clickButtonContaining(page, "Export cropped PDF")) ||
      (await clickButtonContaining(page, "Export"));
    await waitForBodyText(page, "ready to download", 120000);
    (await clickButtonContaining(page, "Download cropped PDF")) ||
      (await clickButtonContaining(page, "Download"));
    const blob = await readLastBlob(page);
    const ok = FORCE_FAIL === slug ? false : Boolean(blob && isPdf(blob.bytes));
    record(results, slug, ok, ok ? "PDF output" : "no PDF", { assertion: "PDF magic" });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runFillPdf(results) {
  const slug = "fill-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/fill-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("fillable-form.pdf"));
    await waitForBodyText(page, "fillable-form.pdf", 60000);
    await sleep(2000);
    const hasFields = await page.evaluate(() => {
      const t = document.body.innerText;
      return !/no (interactive |supported )?form fields|no fields to fill/i.test(t);
    });
    if (!hasFields) {
      record(results, slug, false, "fillable-form.pdf did not expose AcroForm fields", {
        assertion: "interactive form fields visible",
      });
      await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
      return;
    }
    await page.evaluate(() => {
      const editable = document.querySelector('[data-field-id="editable.name"] input, input[aria-label*="editable"], input[type="text"]');
      if (editable instanceof HTMLInputElement) {
        editable.focus();
        editable.value = "Regression";
        editable.dispatchEvent(new Event("input", { bubbles: true }));
        editable.dispatchEvent(new Event("change", { bubbles: true }));
      }
    });
    await sleep(500);
    await clickButtonContaining(page, "Done");
    await waitForBodyText(page, "ready to download", 120000);
    await clickButtonContaining(page, "Download filled PDF");
    await sleep(1500);
    const blobs = await readAllBlobs(page);
    const pdf = blobs.find((b) => isPdf(b.bytes));
    const ok = FORCE_FAIL === slug ? false : Boolean(pdf);
    record(results, slug, ok, ok ? "filled PDF export" : "no filled PDF", {
      assertion: "PDF magic from AcroForm fixture export",
      output: pdf ? { size: pdf.size } : null,
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runSignPdf(results) {
  const slug = "sign-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/sign-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("two-page.pdf"));
    await waitForBodyText(page, "two-page.pdf", 60000);
    await clickButtonContaining(page, "Create signature");
    await sleep(1200);
    const canvas = await page.$("canvas");
    if (canvas) {
      const box = await canvas.boundingBox();
      if (box) {
        await page.mouse.move(box.x + 20, box.y + box.height / 2);
        await page.mouse.down();
        await page.mouse.move(box.x + box.width - 20, box.y + box.height / 2);
        await page.mouse.up();
      }
      await clickButtonContaining(page, "Add signature");
    }
    await sleep(1500);
    await clickButtonContaining(page, "Add to page");
    await sleep(800);
    await clickButtonContaining(page, "Export signed PDF");
    await waitForBodyText(page, "ready to download", 120000);
    await clickButtonContaining(page, "Download signed PDF");
    await sleep(1500);
    const blobs = await readAllBlobs(page);
    const pdf = blobs.find((b) => isPdf(b.bytes));
    const ok = FORCE_FAIL === slug ? false : Boolean(pdf);
    record(results, slug, ok, ok ? "signed PDF download" : "no PDF blob captured", {
      assertion: "downloaded output is PDF not preview image",
      output: pdf ? { size: pdf.size } : null,
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runAddPageNumbers(results) {
  const slug = "add-page-numbers";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/add-page-numbers`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("two-page.pdf"));
    await waitForBodyText(page, "two-page.pdf", 60000);
    (await clickButtonContaining(page, "Export numbered PDF")) ||
      (await clickButtonContaining(page, "Add page numbers"));
    await waitForBodyText(page, "ready to download", 120000);
    (await clickButtonContaining(page, "Download numbered PDF")) ||
      (await clickButtonContaining(page, "Download"));
    const blob = await readLastBlob(page);
    const pages = blob ? await pdfPageCount(blob.bytes) : -1;
    const ok = FORCE_FAIL === slug ? false : Boolean(blob && isPdf(blob.bytes) && pages === 2);
    record(results, slug, ok, ok ? `PDF ${pages} pages` : "invalid output", {
      assertion: "PDF magic + pageCount===2",
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runWatermarkPdf(results) {
  const slug = "watermark-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/watermark-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("two-page.pdf"));
    await waitForBodyText(page, "two-page.pdf", 60000);
    const textInput = await page.$('input[type="text"]');
    if (textInput) await textInput.type("SCANONIX TEST");
    await clickButtonContaining(page, "Download watermarked PDF");
    await waitForBodyText(page, "ready to download", 120000).catch(() => {});
    const blobs = await readAllBlobs(page);
    const pdf = blobs.find((b) => isPdf(b.bytes));
    const jpegPreview = blobs.find((b) => isJpeg(b.bytes));
    const ok =
      FORCE_FAIL === slug ? false : Boolean(pdf && !(!pdf && jpegPreview));
    record(results, slug, ok, ok ? "watermarked PDF (not preview JPEG)" : "PDF missing — preview JPEG only?", {
      assertion: "filter blobs for %PDF; reject preview JPEG-only",
      output: {
        pdfSize: pdf?.size,
        previewJpeg: Boolean(jpegPreview),
        blobCount: blobs.length,
      },
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runPdfToImage(results) {
  const slug = "pdf-to-image";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/pdf-to-image`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("two-page.pdf"));
    await waitForBodyText(page, "2 page", 60000);
    await clickButtonContaining(page, "Convert to");
    await waitForBodyText(page, "ready to download", 180000);
    await clickButtonContaining(page, "Download");
    const blobs = await readAllBlobs(page);
    const images = blobs.filter((b) => isJpeg(b.bytes) || isPng(b.bytes));
    const zip = blobs.find((b) => isZip(b.bytes));
    const ok =
      FORCE_FAIL === slug ? false : images.length >= 2 || Boolean(zip && zip.size > 500);
    record(results, slug, ok, ok ? `${images.length} image(s) or ZIP` : "no image/ZIP output", {
      assertion: "2 page images or multi-page ZIP",
      output: { imageCount: images.length, zipSize: zip?.size },
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runImageToPdf(results) {
  const slug = "image-to-pdf";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/image-to-pdf`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp("sample.jpg"));
    await waitForBodyText(page, "sample.jpg", 30000);
    await clickButtonContaining(page, "Generate PDF");
    await waitForBodyText(page, "ready to download", 120000);
    await clickButtonContaining(page, "Download");
    const blob = await readLastBlob(page);
    const pages = blob ? await pdfPageCount(blob.bytes) : -1;
    const ok = FORCE_FAIL === slug ? false : Boolean(blob && isPdf(blob.bytes) && pages >= 1);
    record(results, slug, ok, ok ? `PDF ${pages} page(s)` : "invalid PDF", {
      assertion: "PDF magic + pages>=1",
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runImageConverter(results, slug, input, convertBtn, downloadBtn, validate) {
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/${slug}`, { waitUntil: "networkidle2" });
    await installDownloadHook(page);
    await uploadFiles(page, fp(input));
    await sleep(1500);
    await clickButtonContaining(page, convertBtn);
    await waitForBodyText(page, "ready to download", 120000);
    await clickButtonContaining(page, downloadBtn);
    const blob = await readLastBlob(page);
    const ok = FORCE_FAIL === slug ? false : Boolean(blob && validate(blob.bytes));
    record(results, slug, ok, ok ? "valid output bytes" : "wrong format", {
      assertion: "output magic bytes",
      output: blob ? { magic: magicHex(blob.bytes), size: blob.size } : null,
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runHeicConverter(results, slug, convertBtn, downloadBtn, validate) {
  if (!existsSync(fp("sample.heic"))) {
    record(results, slug, false, "sample.heic fixture missing (needs Linux/libheif generation)", {
      assertion: "HEIC fixture present",
    });
    return;
  }
  await runImageConverter(results, slug, "sample.heic", convertBtn, downloadBtn, validate);
}

async function runOcr(results) {
  const slug = "ocr";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/ocr`, { waitUntil: "networkidle2" });
    await uploadFiles(page, fp("ocr-test.png"));
    await waitForBodyText(page, "ocr-test.png", 30000);
    await clickButtonContaining(page, "Extract text");
    await waitForBodyText(page, "Extracted text", 300000);
    const text = await page.$eval("textarea", (el) => el.value).catch(() => "");
    const ok =
      FORCE_FAIL === slug ? false : /SCANONIX OCR TEST 12345/i.test(text);
    record(results, slug, ok, ok ? "expected OCR text" : `got: "${text.slice(0, 80)}"`, {
      assertion: "textarea contains SCANONIX OCR TEST 12345",
      output: { excerpt: text.slice(0, 120) },
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function runQrScanner(results) {
  const slug = "qr-scanner";
  await withPage(async (page) => {
    await page.goto(`${BASE}/tools/qr-scanner`, { waitUntil: "networkidle2" });
    await clickButtonContaining(page, "Upload image");
    await sleep(600);
    await uploadFiles(page, fp("qr-test.png"));
    await waitForBodyText(page, "SCANONIX-QR-REGRESSION", 60000);
    const ok = FORCE_FAIL === slug ? false : true;
    record(results, slug, ok, "decoded SCANONIX-QR-REGRESSION", {
      assertion: "exact QR payload visible",
    });
    if (!ok) await captureFailureArtifacts(page, slug, SCREENSHOT_DIR);
  });
}

async function main() {
  printHeader(`Client tool regression E2E (${BASE})`);

  const missing = ["single-page-a.pdf", "fillable-form.pdf", "sample.jpg", "ocr-test.png"].filter(
    (f) => !existsSync(fp(f)),
  );
  if (missing.length) {
    console.error(`Missing fixtures: ${missing.join(", ")} — run npm run verify:regression:fixtures`);
    process.exit(1);
  }

  const results = {};

  await runMergePdf(results);
  await runSplitPdf(results);
  await runOrganizePdf(results);
  await runRotatePdf(results);
  await runCropPdf(results);
  await runFillPdf(results);
  await runSignPdf(results);
  await runAddPageNumbers(results);
  await runWatermarkPdf(results);
  await runPdfToImage(results);
  await runImageToPdf(results);

  await runImageConverter(results, "jpg-to-png", "sample.jpg", "Convert to PNG", "Download PNG", isPng);
  await runImageConverter(results, "png-to-jpg", "sample.png", "Convert to JPG", "Download JPG", isJpeg);
  await runImageConverter(results, "jpg-to-webp", "sample.jpg", "Convert to WEBP", "Download WEBP", isWebp);
  await runImageConverter(results, "png-to-webp", "sample.png", "Convert to WEBP", "Download WEBP", isWebp);
  await runImageConverter(results, "webp-to-jpg", "sample.webp", "Convert to JPG", "Download JPG", isJpeg);
  await runImageConverter(results, "webp-to-png", "sample.webp", "Convert to PNG", "Download PNG", isPng);

  await runHeicConverter(results, "heic-to-jpg", "Convert to JPG", "Download JPG", isJpeg);
  await runHeicConverter(results, "heic-to-png", "Convert to PNG", "Download PNG", isPng);

  await runOcr(results);
  await runQrScanner(results);

  const tested = CLIENT_TOOLS.filter((t) => results[t]);
  if (tested.length !== CLIENT_TOOLS.length) {
    console.error(`Expected ${CLIENT_TOOLS.length} tools, ran ${tested.length}`);
    process.exit(1);
  }

  exitWithSummary(summarizeResults(results), "Client E2E");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
