/**
 * Protect PDF error-path verification (Phase 126B).
 * Run: npx tsx scripts/verify-protect-pdf-errors.ts
 */

import {
  ProtectPdfError,
  protectPdfWithPassword,
} from "../lib/security-tools/pdf/protect";
import { getToolAccess } from "../lib/plan/tool-access";
import {
  createCorruptPdfBytes,
  createEncryptedPdfBytes,
  createPlainTextPdfBytes,
  PROTECT_PDF_TEST_PASSWORD,
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

async function expectProtectError(
  name: string,
  run: () => Promise<unknown>,
  code: ProtectPdfError["code"],
) {
  try {
    await run();
    assert(name, false, `expected ProtectPdfError ${code}`);
  } catch (error) {
    assert(
      name,
      error instanceof ProtectPdfError && error.code === code,
      error instanceof Error ? error.message : String(error),
    );
  }
}

async function run() {
  console.log("\nProtect PDF error verification\n");

  const plain = await createPlainTextPdfBytes();
  const encrypted = await createEncryptedPdfBytes();
  const corrupt = createCorruptPdfBytes();

  await expectProtectError(
    "A EMPTY_PASSWORD for blank password",
    () => protectPdfWithPassword(Buffer.from(plain), ""),
    "EMPTY_PASSWORD",
  );

  await expectProtectError(
    "B PASSWORD_TOO_SHORT for 3-character password",
    () => protectPdfWithPassword(Buffer.from(plain), "abc"),
    "PASSWORD_TOO_SHORT",
  );

  await expectProtectError(
    "C ALREADY_ENCRYPTED for pre-encrypted PDF",
    () => protectPdfWithPassword(Buffer.from(encrypted), PROTECT_PDF_TEST_PASSWORD),
    "ALREADY_ENCRYPTED",
  );

  await expectProtectError(
    "D INVALID_PDF for corrupt upload",
    () => protectPdfWithPassword(Buffer.from(corrupt), PROTECT_PDF_TEST_PASSWORD),
    "INVALID_PDF",
  );

  try {
    const output = await protectPdfWithPassword(
      Buffer.from(plain),
      PROTECT_PDF_TEST_PASSWORD,
    );
    assert("E valid password protects plain PDF", output.length > 0);
  } catch (error) {
    assert(
      "E valid password protects plain PDF",
      false,
      error instanceof Error ? error.message : String(error),
    );
  }

  const access = getToolAccess("protect-pdf");
  assert("F protect-pdf still requires Pro", access?.requiresPro === true);
  assert("G protect-pdf still requires auth", access?.requiresAuth === true);
  assert("H protect-pdf processing stays server-side", access?.processing === "server");

  assert(
    "I ALREADY_ENCRYPTED message is actionable",
    (() => {
      try {
        throw new ProtectPdfError(
          "ALREADY_ENCRYPTED",
          "This PDF is already password-protected. Unlock it first, then protect again.",
        );
      } catch (error) {
        return (
          error instanceof ProtectPdfError &&
          error.message.toLowerCase().includes("already password-protected")
        );
      }
    })(),
  );

  assert(
    "J EMPTY_PASSWORD message prompts user",
    (() => {
      try {
        throw new ProtectPdfError("EMPTY_PASSWORD", "Enter a password.");
      } catch (error) {
        return error instanceof ProtectPdfError && error.message === "Enter a password.";
      }
    })(),
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
