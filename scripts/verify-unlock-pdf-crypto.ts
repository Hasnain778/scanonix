/**
 * Unlock PDF crypto verification (Phase 127B) — tests A–J.
 * Run: npx tsx scripts/verify-unlock-pdf-crypto.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { unlockPdfWithPassword } from "../lib/security-tools/pdf/unlock";
import { loadPdfJsDocumentNode } from "../lib/tools/redact-pdf/pdfjs-node";
import {
  createUnlockEncryptedFixture,
  UNLOCK_FIXTURE_MARKER,
  UNLOCK_PDF_TEST_PASSWORD,
} from "./lib/unlock-pdf-fixtures";

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

function decodeLatin1(bytes: Uint8Array): string {
  return new TextDecoder("latin1").decode(bytes);
}

function pdfContainsEncryptDictionary(bytes: Uint8Array): boolean {
  return /\/Encrypt\b/.test(decodeLatin1(bytes));
}

async function expectPdfLibEncryptedLoadFailure(name: string, bytes: Uint8Array) {
  try {
    await PDFDocument.load(bytes);
    assert(name, false, "expected encrypted load failure");
  } catch (error) {
    const message = error instanceof Error ? error.message.toLowerCase() : "";
    assert(
      name,
      message.includes("encrypted"),
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function extractPdfText(bytes: Uint8Array): Promise<string> {
  const doc = await loadPdfJsDocumentNode(bytes);
  let text = "";

  for (let pageNumber = 1; pageNumber <= doc.numPages; pageNumber += 1) {
    const page = await doc.getPage(pageNumber);
    const content = await page.getTextContent();
    text += `${content.items.map((item) => ("str" in item ? item.str : "")).join(" ")}\n`;
  }

  return text;
}

async function run() {
  console.log("\nUnlock PDF crypto verification\n");

  const encrypted = await createUnlockEncryptedFixture();
  assert("A AES-256 protect fixture generated", pdfContainsEncryptDictionary(encrypted));

  await expectPdfLibEncryptedLoadFailure(
    "B encrypted PDF requires password for pdf-lib load",
    encrypted,
  );

  try {
    await unlockPdfWithPassword(Buffer.from(encrypted), "");
    assert("C empty password rejected for user-password PDF", false);
  } catch (error) {
    assert(
      "C empty password rejected for user-password PDF",
      error instanceof Error && error.message.toLowerCase().includes("incorrect password"),
      error instanceof Error ? error.message : String(error),
    );
  }

  try {
    await unlockPdfWithPassword(Buffer.from(encrypted), "wrong-password");
    assert("D wrong password rejected", false);
  } catch (error) {
    assert(
      "D wrong password rejected",
      error instanceof Error && error.message.toLowerCase().includes("incorrect password"),
      error instanceof Error ? error.message : String(error),
    );
  }

  let unlocked: Uint8Array;
  try {
    unlocked = await unlockPdfWithPassword(
      Buffer.from(encrypted),
      UNLOCK_PDF_TEST_PASSWORD,
    );
    assert("E correct password decrypts via unlockPdfWithPassword", unlocked.length > 0);
  } catch (error) {
    assert(
      "E correct password decrypts via unlockPdfWithPassword",
      false,
      error instanceof Error ? error.message : String(error),
    );
    unlocked = new Uint8Array();
  }

  try {
    const doc = await PDFDocument.load(unlocked);
    assert("F unlocked PDF opens without password", doc.getPageCount() === 1);
  } catch (error) {
    assert(
      "F unlocked PDF opens without password",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  assert("G /Encrypt absent in unlocked output", !pdfContainsEncryptDictionary(unlocked));

  const unlockedText = await extractPdfText(unlocked);
  assert(
    "H marker text preserved after unlock",
    unlockedText.includes(UNLOCK_FIXTURE_MARKER),
    unlockedText.trim() || "no text extracted",
  );

  const unlockSource = readFileSync(
    join(process.cwd(), "lib/security-tools/pdf/unlock.ts"),
    "utf8",
  );
  const routeSource = readFileSync(
    join(process.cwd(), "app/api/tools/security/unlock-pdf/route.ts"),
    "utf8",
  );
  assert(
    "I no brute-force loop in unlock wrapper or route",
    !/for\s*\(.*password/.test(unlockSource) &&
      !/while\s*\(.*password/.test(unlockSource) &&
      routeSource.includes("unlockPdfWithPassword") &&
      !/for\s*\(.*password/.test(routeSource),
  );

  const logs: string[] = [];
  const originalLog = console.log;
  const originalError = console.error;
  console.log = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
    originalLog(...args);
  };
  console.error = (...args: unknown[]) => {
    logs.push(args.map(String).join(" "));
    originalError(...args);
  };

  await unlockPdfWithPassword(Buffer.from(encrypted), UNLOCK_PDF_TEST_PASSWORD);

  console.log = originalLog;
  console.error = originalError;

  assert(
    "J password not written to console logs during unlock",
    !logs.join("\n").includes(UNLOCK_PDF_TEST_PASSWORD),
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
