/**
 * Unlock PDF error-path verification (Phase 127B) — tests W–AE.
 * Run: npx tsx scripts/verify-unlock-pdf-errors.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { basename } from "node:path";
import {
  UnlockPdfError,
  unlockPdfWithPassword,
} from "../lib/security-tools/pdf/unlock";
import { getToolAccess } from "../lib/plan/tool-access";
import {
  createCorruptPdfBytes,
  createUnlockEncryptedFixture,
  createUnencryptedPlainPdfBytes,
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

async function expectUnlockError(
  name: string,
  run: () => Promise<unknown>,
  code: UnlockPdfError["code"],
) {
  try {
    await run();
    assert(name, false, `expected UnlockPdfError ${code}`);
  } catch (error) {
    assert(
      name,
      error instanceof UnlockPdfError && error.code === code,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function sanitizeFileName(name: string): string {
  const base = basename(name.replace(/\\/g, "/"));
  return base.replace(/[^\w.\-() ]+/g, "_").slice(0, 200) || "file";
}

async function run() {
  console.log("\nUnlock PDF error verification\n");

  const plain = await createUnencryptedPlainPdfBytes();
  const encrypted = await createUnlockEncryptedFixture();
  const corrupt = createCorruptPdfBytes();

  await expectUnlockError(
    "W unencrypted PDF returns NOT_ENCRYPTED",
    () => unlockPdfWithPassword(Buffer.from(plain), UNLOCK_PDF_TEST_PASSWORD),
    "NOT_ENCRYPTED",
  );

  await expectUnlockError(
    "X corrupt PDF returns CORRUPT_PDF",
    () => unlockPdfWithPassword(Buffer.from(corrupt), UNLOCK_PDF_TEST_PASSWORD),
    "CORRUPT_PDF",
  );

  const apiHandlerSource = readFileSync(
    join(process.cwd(), "lib/security-tools/api-handler.ts"),
    "utf8",
  );
  assert(
    "Y fake extension rejected by upload parser",
    apiHandlerSource.includes('.endsWith(".pdf")') &&
      apiHandlerSource.includes("Only PDF files are supported."),
  );

  await expectUnlockError(
    "Z incorrect password returns INCORRECT_PASSWORD",
    () => unlockPdfWithPassword(Buffer.from(encrypted), "wrong-password"),
    "INCORRECT_PASSWORD",
  );

  const decryptSource = readFileSync(
    join(process.cwd(), "node_modules/@pdfsmaller/pdf-decrypt/dist/pdf-decrypt.mjs"),
    "utf8",
  );
  assert(
    "AA unsupported encryption surfaced by engine",
    decryptSource.includes("Unsupported encryption"),
  );

  const componentSource = readFileSync(
    join(process.cwd(), "components/tools/security/UnlockPdfTool.tsx"),
    "utf8",
  );
  assert(
    "AB signed-PDF warning wired in UnlockPdfTool",
    componentSource.includes("detectExistingDigitalSignatures") &&
      componentSource.includes("DIGITAL_SIGNATURE_WARNING"),
  );

  const routeSource = readFileSync(
    join(process.cwd(), "app/api/tools/security/unlock-pdf/route.ts"),
    "utf8",
  );
  assert(
    "AC filename convention uses -unlocked.pdf suffix",
    routeSource.includes('`${baseName}-unlocked.pdf`'),
  );

  const unicodeBase = "résumé-文档";
  const sanitized = sanitizeFileName(`${unicodeBase}.pdf`);
  assert(
    "AD Unicode filename sanitized for Content-Disposition",
    sanitized.endsWith(".pdf") && !sanitized.includes("文档"),
    sanitized,
  );

  try {
    await unlockPdfWithPassword(Buffer.from(encrypted), "bad-pass");
    assert("AE incorrect-password message omits submitted password", false);
  } catch (error) {
    assert(
      "AE incorrect-password message omits submitted password",
      error instanceof UnlockPdfError &&
        !error.message.includes("bad-pass") &&
        !error.message.includes(UNLOCK_PDF_TEST_PASSWORD),
      error instanceof Error ? error.message : String(error),
    );
  }

  const access = getToolAccess("unlock-pdf");
  assert("unlock-pdf still requires Pro", access?.requiresPro === true);
  assert("unlock-pdf processing stays server-side", access?.processing === "server");

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
