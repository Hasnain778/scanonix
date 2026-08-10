/**
 * Phase 4B provider verification — Ghostscript compression + PyMuPDF secure redaction.
 * Run: npm run verify:phase4b-providers
 */

import assert from "node:assert/strict";
import { spawn } from "node:child_process";
import { existsSync } from "node:fs";
import { mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import sharp from "sharp";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import * as pdfjs from "pdfjs-dist/legacy/build/pdf.mjs";

function ok(message) {
  console.log(`✓ ${message}`);
}

function skip(message) {
  console.log(`○ ${message}`);
}

function fail(message) {
  console.error(`\n✗ Phase 4B provider verification failed: ${message}\n`);
  process.exit(1);
}

function readEnv(key) {
  return process.env[key]?.trim() ?? "";
}

function ghostscriptBin() {
  return readEnv("GHOSTSCRIPT_BIN") || readEnv("GS_BIN") || "gs";
}

function redactionPython() {
  return readEnv("PDF_REDACTION_PYTHON");
}

function isGhostscriptConfigured() {
  return Boolean(ghostscriptBin());
}

function isPdfRedactionConfigured() {
  return Boolean(redactionPython());
}

function assertPdfHeader(bytes) {
  const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
  assert.equal(header.startsWith("%PDF-"), true, "invalid PDF header");
}

async function runProcess(command, args, timeoutMs = 120_000) {
  await new Promise((resolve, reject) => {
    const child = spawn(command, args, {
      stdio: ["ignore", "pipe", "pipe"],
      windowsHide: true,
    });

    let stderr = "";
    const timer = setTimeout(() => {
      child.kill("SIGKILL");
      reject(new Error(`Process timed out after ${timeoutMs}ms`));
    }, timeoutMs);

    child.stderr.on("data", (chunk) => {
      stderr += chunk.toString();
    });

    child.on("error", (error) => {
      clearTimeout(timer);
      reject(error);
    });

    child.on("close", (code) => {
      clearTimeout(timer);
      if (code === 0) {
        resolve();
        return;
      }
      reject(new Error(stderr.trim() || `Process exited with code ${code}`));
    });
  });
}

async function extractPdfText(bytes) {
  const doc = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  let text = "";

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}\n`;
  }

  return text;
}

async function createSampleCompressionPdf() {
  const jpeg = await sharp({
    create: {
      width: 400,
      height: 300,
      channels: 3,
      background: { r: 180, g: 90, b: 40 },
    },
  })
    .jpeg({ quality: 95 })
    .toBuffer();

  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const image = await pdf.embedJpg(jpeg);

  const page1 = pdf.addPage([612, 792]);
  page1.drawText("Scanonix compression sample — page 1", {
    x: 50,
    y: 720,
    size: 14,
    font,
  });
  page1.drawLine({
    start: { x: 50, y: 680 },
    end: { x: 300, y: 620 },
    thickness: 2,
    color: rgb(0.2, 0.4, 0.9),
  });
  page1.drawImage(image, { x: 50, y: 300, width: 240, height: 180 });

  const page2 = pdf.addPage([612, 792]);
  page2.drawText("Vector and text should remain extractable after compression.", {
    x: 50,
    y: 720,
    size: 12,
    font,
  });
  page2.drawRectangle({
    x: 80,
    y: 500,
    width: 180,
    height: 90,
    borderColor: rgb(0.1, 0.1, 0.1),
    borderWidth: 1,
  });

  return pdf.save();
}

async function createRedactionTestPdf(secret) {
  const pdf = await PDFDocument.create();
  const font = await pdf.embedFont(StandardFonts.Helvetica);
  const page = pdf.addPage([612, 792]);
  page.drawText("Public header text", { x: 50, y: 720, size: 14, font });
  page.drawText(secret, { x: 50, y: 650, size: 12, font });
  page.drawText("Public footer text", { x: 50, y: 600, size: 12, font });
  return pdf.save();
}

async function findRedactionAreas(bytes, query) {
  const pdf = await pdfjs.getDocument({ data: new Uint8Array(bytes) }).promise;
  const areas = [];
  const normalizedQuery = query.trim().toLowerCase();

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex + 1);
    const viewport = page.getViewport({ scale: 1 });
    const textContent = await page.getTextContent();

    for (const item of textContent.items) {
      if (!("str" in item) || !normalizedQuery) continue;
      if (!item.str.toLowerCase().includes(normalizedQuery)) continue;

      const transform = item.transform;
      const x = transform[4] ?? 0;
      const y = transform[5] ?? 0;
      const width = item.width ?? normalizedQuery.length * 8;
      const height = item.height ?? 12;

      areas.push({
        pageIndex,
        x,
        y: viewport.height - y - height,
        width: width + 4,
        height: height + 4,
      });
    }
  }

  return areas;
}

function compressionArgs(inputPath, outputPath, level) {
  const settings = {
    low: ["-dPDFSETTINGS=/prepress", "-dColorImageResolution=300"],
    medium: ["-dPDFSETTINGS=/ebook", "-dColorImageResolution=150"],
    high: ["-dPDFSETTINGS=/screen", "-dColorImageResolution=96"],
  }[level];

  return [
    "-sDEVICE=pdfwrite",
    "-dCompatibilityLevel=1.4",
    "-dDetectDuplicateImages=true",
    "-dCompressFonts=true",
    "-dSubsetFonts=true",
    "-dNOPAUSE",
    "-dQUIET",
    "-dBATCH",
    ...settings,
    `-sOutputFile=${outputPath}`,
    inputPath,
  ];
}

function testProviderModulesExist() {
  const root = process.cwd();
  const modules = [
    "lib/providers/pdf/compression/ghostscript-provider.ts",
    "lib/providers/pdf/compression/types.ts",
    "lib/providers/pdf/redaction/pymupdf-provider.ts",
    "lib/providers/pdf/redaction/types.ts",
    "lib/providers/pdf/shared/temp-workspace.ts",
    "lib/providers/pdf/shared/subprocess.ts",
    "lib/tools/compress-pdf/client.ts",
    "app/api/tools/pdf/compress/route.ts",
    "app/api/tools/security/redact-pdf/route.ts",
    "scripts/pdf_redact.py",
  ];

  for (const relative of modules) {
    assert.ok(existsSync(join(root, relative)), `${relative} missing`);
  }

  ok("Phase 4B provider modules and routes exist");
}

function testProviderConfigStatus() {
  const gs = isGhostscriptConfigured();
  const redaction = isPdfRedactionConfigured();

  console.log("\nProvider configuration status:");
  console.log(
    `  Ghostscript:   ${gs ? ghostscriptBin() : "NOT configured (503 on compress route)"}`,
  );
  console.log(
    `  PyMuPDF:       ${redaction ? redactionPython() : "NOT configured (503 on redact route)"}`,
  );

  if (!gs && !redaction) {
    console.log(
      "\nNote: No Phase 4B providers are configured in this environment. " +
        "Routes will return 503 until Ghostscript and PDF_REDACTION_PYTHON are set up.",
    );
  }

  ok("Provider config checks completed (informational)");
}

async function testGhostscriptAvailability() {
  if (!isGhostscriptConfigured()) {
    skip("Ghostscript runtime check skipped — GHOSTSCRIPT_BIN not set");
    return false;
  }

  try {
    await runProcess(ghostscriptBin(), ["--version"], 15_000);
    ok("Ghostscript runtime responds to --version");
    return true;
  } catch (error) {
    skip(`Ghostscript runtime unavailable (${error instanceof Error ? error.message : error})`);
    return false;
  }
}

async function testPyMuPdfAvailability() {
  if (!isPdfRedactionConfigured()) {
    skip("PyMuPDF runtime check skipped — PDF_REDACTION_PYTHON not set");
    return false;
  }

  try {
    await runProcess(redactionPython(), ["-c", "import pymupdf"], 15_000);
    ok("PyMuPDF (pymupdf) import succeeds in PDF_REDACTION_PYTHON");
    return true;
  } catch (error) {
    skip(`PyMuPDF runtime unavailable (${error instanceof Error ? error.message : error})`);
    return false;
  }
}

async function testCompressionProvider(gsAvailable) {
  if (!gsAvailable) {
    skip("Compression integration test skipped — Ghostscript unavailable");
    return;
  }

  const dir = await mkdtemp(join(tmpdir(), "scanonix-4b-compress-"));
  const inputPath = join(dir, "input.pdf");
  const outputPath = join(dir, "output.pdf");

  try {
    const inputBytes = await createSampleCompressionPdf();
    await writeFile(inputPath, inputBytes);
    const inputPageCount = (await PDFDocument.load(inputBytes)).getPageCount();

    await runProcess(ghostscriptBin(), compressionArgs(inputPath, outputPath, "medium"));

    const outputBytes = await readFile(outputPath);
    assert.ok(outputBytes.byteLength > 0, "compressed output is zero bytes");
    assertPdfHeader(outputBytes);

    const outputPageCount = (await PDFDocument.load(outputBytes)).getPageCount();
    assert.equal(outputPageCount, inputPageCount, "compression changed page count");

    const extracted = await extractPdfText(outputBytes);
    assert.match(extracted, /Scanonix compression sample/i, "expected text missing after compression");
    assert.match(
      extracted,
      /Vector and text should remain extractable/i,
      "multi-page text missing after compression",
    );

    ok("Ghostscript compression produces valid PDF with preserved page count and extractable text");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function testSecureRedactionProvider(pymupdfAvailable) {
  if (!pymupdfAvailable) {
    skip("Secure redaction integration test skipped — PyMuPDF unavailable");
    return;
  }

  const secret = "SCANONIX_REDACTION_SECRET_73921";
  const dir = await mkdtemp(join(tmpdir(), "scanonix-4b-redact-"));
  const inputPath = join(dir, "input.pdf");
  const outputPath = join(dir, "output.pdf");
  const scriptPath = join(process.cwd(), "scripts", "pdf_redact.py");

  try {
    const inputBytes = await createRedactionTestPdf(secret);
    await writeFile(inputPath, inputBytes);
    const inputPageCount = (await PDFDocument.load(inputBytes)).getPageCount();

    const areas = await findRedactionAreas(inputBytes, secret);
    assert.ok(areas.length > 0, "could not locate secret text for redaction test");

    await runProcess(redactionPython(), [
      scriptPath,
      "--input",
      inputPath,
      "--output",
      outputPath,
      "--areas",
      JSON.stringify(areas),
    ]);

    const outputBytes = await readFile(outputPath);
    assert.ok(outputBytes.byteLength > 0, "redacted output is zero bytes");
    assertPdfHeader(outputBytes);

    const outputPageCount = (await PDFDocument.load(outputBytes)).getPageCount();
    assert.equal(outputPageCount, inputPageCount, "redaction changed page count");

    const extracted = await extractPdfText(outputBytes);
    assert.doesNotMatch(
      extracted,
      /SCANONIX_REDACTION_SECRET_73921/i,
      "SECRET TEXT STILL RECOVERABLE — secure redaction test FAILED",
    );
    assert.match(extracted, /Public header text/i, "unaffected text should remain");

    ok("Secure redaction removes secret text (independent pdf.js extraction verified)");
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function main() {
  try {
    testProviderModulesExist();
    testProviderConfigStatus();
    const gsAvailable = await testGhostscriptAvailability();
    const pymupdfAvailable = await testPyMuPdfAvailability();
    await testCompressionProvider(gsAvailable);
    await testSecureRedactionProvider(pymupdfAvailable);
    console.log("\nPhase 4B provider verification passed.\n");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
