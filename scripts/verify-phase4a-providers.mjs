/**
 * Phase 4A provider verification — config checks, magic byte helpers, script presence.
 * Run: npm run verify:phase4a-providers
 */

import assert from "node:assert/strict";
import { existsSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";

function ok(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  console.error(`\n✗ Phase 4A provider verification failed: ${message}\n`);
  process.exit(1);
}

function readEnv(key) {
  return process.env[key]?.trim() ?? "";
}

function isCloudConvertConfigured() {
  return Boolean(readEnv("CLOUDCONVERT_API_KEY"));
}

function isRealEsrganConfigured() {
  return Boolean(readEnv("REALESRGAN_SERVICE_URL") || readEnv("REALESRGAN_BIN"));
}

function isRembgConfigured() {
  return Boolean(readEnv("REMBG_PYTHON"));
}

function assertPdfHeader(bytes) {
  const header = Buffer.from(bytes.slice(0, 5)).toString("ascii");
  assert.equal(header.startsWith("%PDF-"), true, "invalid PDF header");
}

function assertDocxHeader(bytes) {
  assert.equal(bytes[0], 0x50);
  assert.equal(bytes[1], 0x4b);
}

async function testMagicByteHelpers() {
  const png = await sharp({
    create: { width: 8, height: 8, channels: 4, background: { r: 0, g: 0, b: 0, alpha: 0 } },
  })
    .png()
    .toBuffer();

  assert.equal(png.readUInt32BE(0), 0x89504e47);

  const pdf = await PDFDocument.create();
  pdf.addPage();
  const pdfBytes = await pdf.save();
  assertPdfHeader(pdfBytes);

  const zip = new JSZip();
  zip.file("[Content_Types].xml", '<?xml version="1.0"?><Types></Types>');
  zip.file("word/document.xml", "<w:document></w:document>");
  const docxBytes = await zip.generateAsync({ type: "nodebuffer" });
  assertDocxHeader(docxBytes);

  ok("PDF / PNG / DOCX magic byte helpers pass");
}

function testScriptPresence() {
  const root = process.cwd();
  const realesrganScript = join(root, "scripts", "realesrgan_infer.py");
  const rembgScript = join(root, "scripts", "rembg_infer.py");

  assert.ok(existsSync(realesrganScript), "scripts/realesrgan_infer.py missing");
  assert.ok(existsSync(rembgScript), "scripts/rembg_infer.py missing");
  ok("Python inference scripts are present");
}

function testProviderConfigStatus() {
  const cloudConvert = isCloudConvertConfigured();
  const realesrgan = isRealEsrganConfigured();
  const rembg = isRembgConfigured();

  console.log("\nProvider configuration status:");
  console.log(`  CloudConvert:  ${cloudConvert ? "configured" : "NOT configured (503 on conversion routes)"}`);
  console.log(`  Real-ESRGAN:   ${realesrgan ? "configured" : "NOT configured (503 on upscale route)"}`);
  console.log(`  rembg:         ${rembg ? "configured" : "NOT configured (503 on background remover route)"}`);

  if (!cloudConvert && !realesrgan && !rembg) {
    console.log(
      "\nNote: No Phase 4A providers are configured in this environment. " +
        "Routes will return 503 until env vars and Python runtimes are set up.",
    );
  }

  ok("Provider config checks completed (informational)");
}

function testProviderModulesExist() {
  const root = process.cwd();
  const modules = [
    "lib/providers/upscale/realesrgan-provider.ts",
    "lib/providers/conversion/cloudconvert-provider.ts",
    "lib/providers/background-removal/rembg-server-provider.ts",
    "lib/tools/document-conversion/client.ts",
    "app/api/tools/pdf-to-word/route.ts",
    "app/api/tools/background-remover/remove/route.ts",
  ];

  for (const relative of modules) {
    assert.ok(existsSync(join(root, relative)), `${relative} missing`);
  }

  ok("Phase 4A provider modules and routes exist");
}

async function main() {
  try {
    testProviderModulesExist();
    testScriptPresence();
    await testMagicByteHelpers();
    testProviderConfigStatus();
    console.log("\nPhase 4A provider verification passed.\n");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
