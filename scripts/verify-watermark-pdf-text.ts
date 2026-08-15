/**
 * Text validation tests for Watermark PDF (Phase 124B).
 * Run: npx tsx scripts/verify-watermark-pdf-text.ts
 */

import {
  containsUnsupportedWinAnsiCharacters,
  createDefaultTextWatermarkOptions,
  findUnsupportedWinAnsiCharacters,
  validateFontSize,
  validateHexColor,
  validateOpacity,
  validateRotationDegrees,
  validateTextWatermarkOptions,
  validateWatermarkText,
  WatermarkPdfError,
} from "../lib/tools/watermark-pdf";

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

function assertThrowsCode(
  name: string,
  fn: () => void,
  expectedCode: WatermarkPdfError["code"],
) {
  try {
    fn();
    assert(name, false, "expected throw");
  } catch (error) {
    assert(
      name,
      error instanceof WatermarkPdfError && error.code === expectedCode,
      error instanceof Error ? error.message : String(error),
    );
  }
}

function run() {
  console.log("\nWatermark PDF text validation verification\n");

  assert("Valid text passes", validateWatermarkText("CONFIDENTIAL") === "CONFIDENTIAL");
  assert("Text trimmed", validateWatermarkText("  DRAFT  ") === "DRAFT");

  assertThrowsCode(
    "Empty text rejected",
    () => validateWatermarkText("   "),
    "INVALID_TEXT",
  );

  assertThrowsCode(
    "Text too long rejected",
    () => validateWatermarkText("X".repeat(201)),
    "TEXT_TOO_LONG",
  );

  assertThrowsCode(
    "Unsupported emoji rejected",
    () => validateWatermarkText("CONFIDENTIAL 🔒"),
    "UNSUPPORTED_CHARACTERS",
  );

  assert(
    "WinAnsi detector finds emoji",
    containsUnsupportedWinAnsiCharacters("Test 😀"),
  );
  assert(
    "WinAnsi ASCII safe",
    !containsUnsupportedWinAnsiCharacters("CONFIDENTIAL"),
  );
  assert(
    "Unsupported char list",
    findUnsupportedWinAnsiCharacters("A🔒B").includes("🔒"),
  );

  assert("Opacity 0.3 valid", validateOpacity(0.3) === 0.3);
  assertThrowsCode(
    "Opacity below 0.1 rejected",
    () => validateOpacity(0.05),
    "INVALID_OPACITY",
  );
  assertThrowsCode(
    "Opacity above 1 rejected",
    () => validateOpacity(1.1),
    "INVALID_OPACITY",
  );

  assert("Rotation -45 valid", validateRotationDegrees(-45) === -45);
  assertThrowsCode(
    "Rotation out of bounds rejected",
    () => validateRotationDegrees(400),
    "INVALID_ROTATION",
  );

  assert("Font size 48 valid", validateFontSize(48) === 48);
  assertThrowsCode(
    "Font size too small rejected",
    () => validateFontSize(8),
    "INVALID_FONT_SIZE",
  );
  assertThrowsCode(
    "Font size too large rejected",
    () => validateFontSize(200),
    "INVALID_FONT_SIZE",
  );

  const color = validateHexColor("#666666");
  assert("Hex color parsed", color.r > 0 && color.g > 0 && color.b > 0);
  assertThrowsCode(
    "Invalid hex rejected",
    () => validateHexColor("not-a-color"),
    "INVALID_COLOR",
  );

  const validated = validateTextWatermarkOptions(
    createDefaultTextWatermarkOptions({
      text: "CONFIDENTIAL",
      position: "center",
      rotationDegrees: -45,
    }),
    3,
  );
  assert("Default options validate", validated.text === "CONFIDENTIAL");
  assert("Default all pages", validated.selectedPageIndices.length === 3);
  assert("Center diagonal rotation preserved", validated.rotationDegrees === -45);

  assertThrowsCode(
    "Invalid page range rejected",
    () =>
      validateTextWatermarkOptions(
        createDefaultTextWatermarkOptions({
          allPages: false,
          pageRangeInput: "99",
        }),
        3,
      ),
    "INVALID_PAGE_RANGE",
  );

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
