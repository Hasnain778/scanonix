/**
 * Generate permanent regression fixtures (no personal data).
 * Run: npm run verify:regression:fixtures
 *
 * Sources:
 * - PDFs: pdf-lib programmatic pages / AcroForm (same pattern as verify-fill-pdf-export.ts)
 * - JPG/PNG/WebP: sharp synthetic gradients/shapes
 * - HEIC: sharp heif encoder (requires libheif; succeeds on Linux CI)
 * - OCR image: sharp-rendered SVG with exact text "SCANONIX OCR TEST 12345"
 * - QR image: npx qrcode CLI payload "SCANONIX-QR-REGRESSION"
 * - BG remover subject: sharp-rendered SVG person silhouette on white background
 */

import { execSync } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdir, writeFile } from "node:fs/promises";
import { join } from "node:path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import sharp from "sharp";

const FIXTURE_DIR = join(process.cwd(), "tests", "fixtures", "regression");

const REQUIRED = [
  "single-page-a.pdf",
  "single-page-b.pdf",
  "two-page.pdf",
  "fillable-form.pdf",
  "sample.jpg",
  "sample.png",
  "sample.webp",
  "sample.heic",
  "ocr-test.png",
  "qr-test.png",
  "bg-remover-subject.jpg",
];

async function makeSimplePdf(path, labels) {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  for (const label of labels) {
    const page = doc.addPage([612, 792]);
    page.drawText(label, { x: 72, y: 700, size: 28, font, color: rgb(0, 0, 0) });
    page.drawText("Scanonix regression fixture", {
      x: 72,
      y: 660,
      size: 12,
      font,
      color: rgb(0.4, 0.4, 0.4),
    });
  }
  await writeFile(path, await doc.save());
}

async function makeFillableFormPdf(path) {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  const form = pdf.getForm();

  const nameField = form.createTextField("editable.name");
  nameField.setText("Before");
  nameField.addToPage(page, { x: 72, y: 700, width: 200, height: 24 });

  const codeField = form.createTextField("readonly.code");
  codeField.setText("KEEP");
  codeField.enableReadOnly();
  codeField.addToPage(page, { x: 72, y: 660, width: 200, height: 24 });

  const noteField = form.createTextField("untouched.note");
  noteField.setText("Same");
  noteField.addToPage(page, { x: 72, y: 620, width: 200, height: 24 });

  const consent = form.createCheckBox("consent.accept");
  consent.addToPage(page, { x: 72, y: 580, width: 18, height: 18 });

  await writeFile(path, await pdf.save());
}

async function generate() {
  await mkdir(FIXTURE_DIR, { recursive: true });

  await makeSimplePdf(join(FIXTURE_DIR, "single-page-a.pdf"), ["MERGE A"]);
  await makeSimplePdf(join(FIXTURE_DIR, "single-page-b.pdf"), ["MERGE B"]);
  await makeSimplePdf(join(FIXTURE_DIR, "two-page.pdf"), ["PAGE 1", "PAGE 2"]);
  await makeFillableFormPdf(join(FIXTURE_DIR, "fillable-form.pdf"));

  const jpg = await sharp({
    create: { width: 320, height: 200, channels: 3, background: { r: 30, g: 144, b: 255 } },
  })
    .jpeg({ quality: 88 })
    .toBuffer();
  await writeFile(join(FIXTURE_DIR, "sample.jpg"), jpg);

  const png = await sharp({
    create: { width: 200, height: 200, channels: 4, background: { r: 255, g: 0, b: 0, alpha: 0.5 } },
  })
    .png()
    .toBuffer();
  await writeFile(join(FIXTURE_DIR, "sample.png"), png);

  const webp = await sharp(png).webp({ quality: 88 }).toBuffer();
  await writeFile(join(FIXTURE_DIR, "sample.webp"), webp);

  let heicOk = false;
  try {
    const heic = await sharp(png).heif({ compression: "hevc" }).toBuffer();
    await writeFile(join(FIXTURE_DIR, "sample.heic"), heic);
    heicOk = true;
  } catch (err) {
    const existing = join(FIXTURE_DIR, "sample.heic");
    if (existsSync(existing)) {
      console.warn("HEIC encode skipped; keeping existing sample.heic");
      heicOk = true;
    } else {
      console.warn(`HEIC encode unavailable (${err instanceof Error ? err.message : err})`);
      console.warn("Commit sample.heic from Linux sharp encode or Nokia HEIF conformance (C002.heic)");
    }
  }

  const ocrSvg = `<svg width="640" height="160" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <text x="24" y="96" font-family="Arial, sans-serif" font-size="36" fill="black">SCANONIX OCR TEST 12345</text>
</svg>`;
  await writeFile(
    join(FIXTURE_DIR, "ocr-test.png"),
    await sharp(Buffer.from(ocrSvg)).png().toBuffer(),
  );

  try {
    execSync(`npx --yes qrcode -o "${join(FIXTURE_DIR, "qr-test.png")}" "SCANONIX-QR-REGRESSION"`, {
      stdio: "pipe",
    });
  } catch (err) {
    if (!existsSync(join(FIXTURE_DIR, "qr-test.png"))) {
      throw new Error(`QR fixture generation failed: ${err instanceof Error ? err.message : err}`);
    }
    console.warn("QR generation failed; keeping existing qr-test.png");
  }

  const subjectSvg = `<svg width="240" height="320" xmlns="http://www.w3.org/2000/svg">
  <rect width="100%" height="100%" fill="white"/>
  <ellipse cx="120" cy="110" rx="55" ry="70" fill="#3b82f6"/>
  <rect x="70" y="190" width="100" height="120" rx="20" fill="#3b82f6"/>
</svg>`;
  await writeFile(
    join(FIXTURE_DIR, "bg-remover-subject.jpg"),
    await sharp(Buffer.from(subjectSvg)).jpeg({ quality: 90 }).toBuffer(),
  );

  const missing = REQUIRED.filter((name) => !existsSync(join(FIXTURE_DIR, name)));
  if (missing.length > 0) {
    throw new Error(`Missing fixtures after generation: ${missing.join(", ")}`);
  }

  console.log(`Regression fixtures ready in ${FIXTURE_DIR}`);
  if (!heicOk) {
    console.warn("sample.heic not generated on this host — HEIC E2E requires Linux CI or libheif");
  }
}

const verifyOnly = process.argv.includes("--verify");

if (verifyOnly) {
  const missing = REQUIRED.filter((name) => !existsSync(join(FIXTURE_DIR, name)));
  if (missing.length > 0) {
    console.error(`Missing regression fixtures: ${missing.join(", ")}`);
    console.error("Run: npm run verify:regression:fixtures");
    process.exit(1);
  }
  console.log(`✓ All ${REQUIRED.length} regression fixtures present`);
  process.exit(0);
}

generate().catch((err) => {
  console.error(err);
  process.exit(1);
});
