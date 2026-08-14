/**
 * Sign PDF signature validation tests (Phase 119B).
 * Run: npx tsx scripts/verify-sign-pdf-signature-validation.ts
 */

import { validateSignatureImageFile } from "../lib/tools/sign-pdf/signature-assets";

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

function makeFile(name: string, type: string, size = 128): File {
  const buffer = new Uint8Array(size);
  return new File([buffer], name, { type });
}

function run() {
  console.log("\nSign PDF signature validation verification\n");

  assert("PNG accepted", validateSignatureImageFile(makeFile("sig.png", "image/png")) === null);
  assert(
    "JPEG accepted",
    validateSignatureImageFile(makeFile("sig.jpg", "image/jpeg")) === null,
  );
  assert(
    "JPG extension accepted",
    validateSignatureImageFile(makeFile("sig.JPG", "application/octet-stream")) === null,
  );
  assert(
    "SVG rejected",
    validateSignatureImageFile(makeFile("sig.svg", "image/svg+xml")) !== null,
  );
  assert(
    "GIF rejected",
    validateSignatureImageFile(makeFile("sig.gif", "image/gif")) !== null,
  );
  assert(
    "WEBP rejected",
    validateSignatureImageFile(makeFile("sig.webp", "image/webp")) !== null,
  );
  assert(
    "HTML rejected",
    validateSignatureImageFile(makeFile("sig.html", "text/html")) !== null,
  );
  assert(
    "unknown binary rejected",
    validateSignatureImageFile(makeFile("sig.bin", "application/octet-stream")) !== null,
  );
  assert("empty file rejected", validateSignatureImageFile(makeFile("sig.png", "image/png", 0)) !== null);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
