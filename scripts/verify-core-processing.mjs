/**
 * Core processing verification — EXIF/orientation helpers, PDF structural ops, binary signatures.
 * Run: npm run verify:core-processing
 */

import assert from "node:assert/strict";
import { mkdtemp, writeFile, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts } from "pdf-lib";

function ok(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  console.error(`\n✗ Core processing verification failed: ${message}\n`);
  process.exit(1);
}

function assertPdfHeader(bytes) {
  const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
  assert.equal(header.startsWith("%PDF-"), true, "invalid PDF header");
}

function assertJpegHeader(bytes) {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  assert.equal(bytes[2], 0xff);
}

function assertPngHeader(bytes) {
  assert.equal(bytes.readUInt32BE(0), 0x89504e47);
}

async function testSharpAutoOrientation() {
  const landscapeStored = await sharp({
    create: {
      width: 120,
      height: 80,
      channels: 3,
      background: { r: 20, g: 120, b: 220 },
    },
  })
    .withMetadata({ orientation: 6 })
    .jpeg()
    .toBuffer();

  const metaBefore = await sharp(landscapeStored).metadata();
  const normalized = await sharp(landscapeStored).rotate().toBuffer();
  const metaAfter = await sharp(normalized).metadata();

  assert.equal(metaBefore.orientation, 6);
  assert.equal(metaAfter.width, 80);
  assert.equal(metaAfter.height, 120);
  assertJpegHeader(normalized);
  ok("Sharp auto-orients EXIF orientation 6 (120×80 stored → 80×120 output)");
}

async function testImageFormats(dir) {
  const png = await sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0.5 },
    },
  })
    .png()
    .toBuffer();
  assertPngHeader(png);

  const webp = await sharp(png).webp({ quality: 90 }).toBuffer();
  assert.equal(webp.slice(0, 4).toString("ascii"), "RIFF");
  assert.equal(webp.slice(8, 12).toString("ascii"), "WEBP");

  const jpeg = await sharp(png).flatten({ background: "#ffffff" }).jpeg().toBuffer();
  assertJpegHeader(jpeg);

  ok("PNG / WEBP / JPEG outputs have correct magic bytes");
}

async function testPdfStructuralMergeAndCompress(dir) {
  const pdfA = await PDFDocument.create();
  const font = await pdfA.embedFont(StandardFonts.Helvetica);
  const pageA = pdfA.addPage([400, 800]);
  pageA.drawText("Scanonix page A", { x: 40, y: 760, size: 14, font });

  const pdfB = await PDFDocument.create();
  const pageB = pdfB.addPage([800, 400]);
  pageB.drawText("Scanonix page B", { x: 40, y: 360, size: 14, font });

  const bytesA = await pdfA.save();
  const bytesB = await pdfB.save();

  const merged = await PDFDocument.create();
  const loadedA = await PDFDocument.load(bytesA);
  const loadedB = await PDFDocument.load(bytesB);
  const copiedA = await merged.copyPages(loadedA, loadedA.getPageIndices());
  const copiedB = await merged.copyPages(loadedB, loadedB.getPageIndices());
  copiedA.forEach((page) => merged.addPage(page));
  copiedB.forEach((page) => merged.addPage(page));

  const mergedBytes = await merged.save();
  assert.equal((await PDFDocument.load(mergedBytes)).getPageCount(), 2);
  assertPdfHeader(mergedBytes);

  const reloaded = await PDFDocument.load(mergedBytes);
  const compressed = await reloaded.save({ useObjectStreams: true });
  assertPdfHeader(compressed);
  assert.equal((await PDFDocument.load(compressed)).getPageCount(), 2);

  const split = await PDFDocument.create();
  const source = await PDFDocument.load(mergedBytes);
  const [first] = await split.copyPages(source, [0]);
  split.addPage(first);
  const splitBytes = await split.save();
  assert.equal((await PDFDocument.load(splitBytes)).getPageCount(), 1);
  assertPdfHeader(splitBytes);

  await writeFile(join(dir, "mixed-pages.pdf"), mergedBytes);
  ok("PDF merge/split/compress preserves page count and valid %PDF header");
}

async function testPdfWorkerBundlePresent() {
  const workerPath = join(
    process.cwd(),
    "node_modules",
    "pdfjs-dist",
    "build",
    "pdf.worker.min.mjs",
  );
  const worker = await readFile(workerPath);
  assert.ok(worker.byteLength > 10_000, "bundled pdf.worker.min.mjs missing");
  ok("pdfjs-dist worker is present locally for bundling");
}

async function main() {
  const dir = await mkdtemp(join(tmpdir(), "scanonix-core-"));

  try {
    await testPdfWorkerBundlePresent();
    await testSharpAutoOrientation();
    await testImageFormats(dir);
    await testPdfStructuralMergeAndCompress(dir);
    console.log("\nCore processing verification passed.\n");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

main();
