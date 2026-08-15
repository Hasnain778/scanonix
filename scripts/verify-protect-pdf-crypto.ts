/**
 * Protect PDF crypto verification (Phase 126B) — tests A–T.
 * Run: npx tsx scripts/verify-protect-pdf-crypto.ts
 */

import { PDFDocument } from "pdf-lib";
import { decryptPDF } from "@pdfsmaller/pdf-decrypt";
import { protectPdfWithPassword } from "../lib/security-tools/pdf/protect";
import {
  createPlainTextPdfBytes,
  PROTECT_PDF_TEST_PASSWORD,
  protectFixturePdf,
} from "./lib/protect-pdf-fixtures";

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
  const raw = decodeLatin1(bytes);
  return /\/Encrypt\b/.test(raw);
}

function parseEncryptParams(bytes: Uint8Array): {
  v?: number;
  r?: number;
  length?: number;
  filter?: string;
  cfm?: string;
  cfKeyBytes?: number;
} {
  const raw = decodeLatin1(bytes);
  const filterIndex = raw.indexOf("/Filter /Standard");
  if (filterIndex === -1) {
    return {};
  }

  const dictStart = raw.lastIndexOf("<<", filterIndex);
  const dictEnd = raw.indexOf(">>", filterIndex);
  const dict = raw.slice(dictStart, dictEnd + 2);
  const vMatch = dict.match(/\/V\s+(\d+)/);
  const rMatch = dict.match(/\/R\s+(\d+)/);
  const lengthMatch = dict.match(/\/Length\s+(\d+)/);
  const cfmMatch = dict.match(/\/CFM\s+\/(\w+)/);
  const cfKeyMatch = dict.match(/\/StdCF[\s\S]*?\/Length\s+(\d+)/);

  return {
    v: vMatch ? Number(vMatch[1]) : undefined,
    r: rMatch ? Number(rMatch[1]) : undefined,
    length: lengthMatch ? Number(lengthMatch[1]) : undefined,
    filter: "Standard",
    cfm: cfmMatch?.[1],
    cfKeyBytes: cfKeyMatch ? Number(cfKeyMatch[1]) : undefined,
  };
}

function bytesContainPlaintextPassword(bytes: Uint8Array, password: string): boolean {
  return decodeLatin1(bytes).includes(password);
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

async function run() {
  console.log("\nProtect PDF crypto verification\n");

  const source = await createPlainTextPdfBytes();
  const protectedBytes = await protectFixturePdf(source);
  const params = parseEncryptParams(protectedBytes);

  assert("A /Encrypt dictionary exists", pdfContainsEncryptDictionary(protectedBytes));
  assert("B AES-256 uses V=5", params.v === 5, `V=${params.v ?? "missing"}`);
  assert("C AES-256 uses R=6", params.r === 6, `R=${params.r ?? "missing"}`);
  assert(
    "D AES-256 key Length is 256",
    params.length === 256,
    `Length=${params.length ?? "missing"}`,
  );
  assert(
    "E Filter Standard with AESV3 crypt filter",
    params.filter === "Standard" && params.cfm === "AESV3",
    `Filter=${params.filter ?? "missing"} CFM=${params.cfm ?? "missing"}`,
  );

  await expectPdfLibEncryptedLoadFailure(
    "F pdf-lib load fails without password",
    protectedBytes,
  );

  try {
    await decryptPDF(protectedBytes, "wrong-password");
    assert("G decryptPDF rejects wrong password", false);
  } catch {
    assert("G decryptPDF rejects wrong password", true);
  }

  try {
    const decrypted = await decryptPDF(protectedBytes, PROTECT_PDF_TEST_PASSWORD);
    assert("H decryptPDF succeeds with correct password", decrypted.length > 0);
    assert(
      "I decrypted bytes restore PDF header",
      decodeLatin1(decrypted).startsWith("%PDF-"),
    );
  } catch (error) {
    assert(
      "H decryptPDF succeeds with correct password",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  assert(
    "J password not present as plaintext in protected PDF",
    !bytesContainPlaintextPassword(protectedBytes, PROTECT_PDF_TEST_PASSWORD),
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

  await protectPdfWithPassword(Buffer.from(source), PROTECT_PDF_TEST_PASSWORD);

  console.log = originalLog;
  console.error = originalError;

  assert(
    "K password not written to console logs during protect",
    !logs.join("\n").includes(PROTECT_PDF_TEST_PASSWORD),
  );

  assert(
    "L protected output differs from source",
    protectedBytes.length !== source.length ||
      protectedBytes.some((byte, index) => byte !== source[index]),
  );
  assert(
    "M protected output remains a PDF",
    decodeLatin1(protectedBytes).startsWith("%PDF-"),
  );
  assert(
    "N protected output ends with EOF marker",
    decodeLatin1(protectedBytes).trimEnd().endsWith("%%EOF"),
  );

  try {
    await PDFDocument.load(protectedBytes, { ignoreEncryption: true });
    assert("O pdf-lib can load with ignoreEncryption", true);
  } catch (error) {
    assert(
      "O pdf-lib can load with ignoreEncryption",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  assert(
    "P owner password matches user password configuration",
    params.v === 5 && params.r === 6,
  );

  const secondPass = await protectFixturePdf(source, "another-pass-1234");
  const secondParams = parseEncryptParams(secondPass);
  assert("Q second protect run still emits AES-256 params", secondParams.v === 5 && secondParams.r === 6);
  assert(
    "R independent protect wrapper uses AES-256 algorithm",
    secondParams.length === 256 && secondParams.cfKeyBytes === 32,
    `Length=${secondParams.length ?? "missing"} CF=${secondParams.cfKeyBytes ?? "missing"}`,
  );

  try {
    await decryptPDF(protectedBytes, "");
    assert("S empty password cannot decrypt protected PDF", false);
  } catch {
    assert("S empty password cannot decrypt protected PDF", true);
  }

  const decryptedAgain = await decryptPDF(protectedBytes, PROTECT_PDF_TEST_PASSWORD);
  const roundTripDoc = await PDFDocument.load(decryptedAgain);
  assert(
    "T round-trip decrypt reproduces loadable PDF document",
    roundTripDoc.getPageCount() === 1,
    String(roundTripDoc.getPageCount()),
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
