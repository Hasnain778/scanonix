/**
 * Page range + numbering tests for Add Page Numbers (Phase 122B).
 * Run: npx tsx scripts/verify-add-page-numbers-range.ts
 */

import {
  buildAllPagesList,
  computeDisplayNumber,
  formatPageNumber,
  parsePageRangeInputToFlatPages,
  resolvePageSelection,
  toZeroBasedIndices,
  validateFontSize,
  validateMargin,
  validateStartingNumber,
  validateHexColor,
  AddPageNumbersError,
} from "../lib/tools/add-page-numbers";

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

function assertPages(
  name: string,
  actual: number[],
  expected: number[],
) {
  const ok =
    actual.length === expected.length &&
    actual.every((page, index) => page === expected[index]);
  assert(
    name,
    ok,
    ok ? "" : `got [${actual.join(", ")}], expected [${expected.join(", ")}]`,
  );
}

function assertErrorCode(name: string, fn: () => void, code: string) {
  try {
    fn();
    assert(name, false, "expected error");
  } catch (error) {
    assert(
      name,
      error instanceof AddPageNumbersError && error.code === code,
      error instanceof Error ? error.message : String(error),
    );
  }
}

const TOTAL = 10;

function runRangeTests() {
  console.log("\n--- Page range tests (A–L) ---\n");

  // A — all pages
  assertPages(
    "TEST A — all pages",
    resolvePageSelection(true, "", TOTAL).pages,
    buildAllPagesList(TOTAL),
  );

  // B — 1-5
  assertPages(
    "TEST B — range 1-5",
    parsePageRangeInputToFlatPages("1-5", TOTAL).pages!,
    [1, 2, 3, 4, 5],
  );

  // C — 1,3,5
  assertPages(
    "TEST C — 1,3,5",
    parsePageRangeInputToFlatPages("1,3,5", TOTAL).pages!,
    [1, 3, 5],
  );

  // D — 1-3,6,8-10
  assertPages(
    "TEST D — 1-3,6,8-10",
    parsePageRangeInputToFlatPages("1-3,6,8-10", TOTAL).pages!,
    [1, 2, 3, 6, 8, 9, 10],
  );

  // E — duplicate normalization
  assertPages(
    "TEST E — duplicates deduped",
    parsePageRangeInputToFlatPages("1,1,2,2,3", TOTAL).pages!,
    [1, 2, 3],
  );

  // F — page 0 rejected
  assert(
    "TEST F — page 0 rejected",
    Boolean(parsePageRangeInputToFlatPages("0", TOTAL).error),
  );

  // G — negative rejected
  assert(
    "TEST G — negative rejected",
    Boolean(parsePageRangeInputToFlatPages("-1", TOTAL).error),
  );

  // H — > page count rejected
  assert(
    "TEST H — exceeds page count rejected",
    Boolean(parsePageRangeInputToFlatPages("11", TOTAL).error),
  );

  // I — malformed syntax rejected
  assert(
    "TEST I — malformed syntax rejected",
    Boolean(parsePageRangeInputToFlatPages("abc", TOTAL).error),
  );

  // J — whitespace handling
  assertPages(
    "TEST J — whitespace trimmed",
    parsePageRangeInputToFlatPages(" 1 - 3 , 5 ", TOTAL).pages!,
    [1, 2, 3, 5],
  );

  // K — empty rejected
  assert(
    "TEST K — empty input rejected",
    Boolean(resolvePageSelection(false, "", TOTAL).error),
  );

  // L — reversed range rejected
  assert(
    "TEST L — reversed range rejected",
    Boolean(parsePageRangeInputToFlatPages("5-1", TOTAL).error),
  );

  // Zero-based conversion
  assertPages(
    "TEST — toZeroBasedIndices",
    toZeroBasedIndices([1, 3, 5]),
    [0, 2, 4],
  );
}

function runNumberingTests() {
  console.log("\n--- Numbering tests ---\n");

  const selected = [3, 4, 5, 6, 7];

  // Start at 1
  assert(
    "TEST — start 1 on page 3",
    computeDisplayNumber(selected, 2, 1) === 1,
  );
  assert(
    "TEST — start 1 on page 7",
    computeDisplayNumber(selected, 6, 1) === 5,
  );

  // Start at 5
  assert(
    "TEST — start 5 on page 3",
    computeDisplayNumber(selected, 2, 5) === 5,
  );
  assert(
    "TEST — start 5 on page 7",
    computeDisplayNumber(selected, 6, 5) === 9,
  );

  // Unselected page
  assert(
    "TEST — unselected page returns null",
    computeDisplayNumber(selected, 0, 1) === null,
  );

  // Disjoint range
  const disjoint = [1, 4, 9];
  assert(
    "TEST — disjoint range page 4 → 2",
    computeDisplayNumber(disjoint, 3, 1) === 2,
  );

  // All four formats
  assert(
    "TEST — format number",
    formatPageNumber({ displayNumber: 3, totalInSequence: 5, format: "number" }) === "3",
  );
  assert(
    "TEST — format page-number",
    formatPageNumber({ displayNumber: 3, totalInSequence: 5, format: "page-number" }) === "Page 3",
  );
  assert(
    "TEST — format number-of-total",
    formatPageNumber({ displayNumber: 3, totalInSequence: 5, format: "number-of-total" }) === "3 of 5",
  );
  assert(
    "TEST — format page-number-of-total",
    formatPageNumber({ displayNumber: 3, totalInSequence: 5, format: "page-number-of-total" }) === "Page 3 of 5",
  );

  // "of N" uses selected count (122A approved semantics)
  assert(
    "TEST — of N uses selected count",
    formatPageNumber({ displayNumber: 1, totalInSequence: 5, format: "number-of-total" }) === "1 of 5",
  );

  // High valid starting number
  assert(
    "TEST — high starting number",
    computeDisplayNumber([1], 0, 99_999) === 99_999,
  );
}

function runValidationTests() {
  console.log("\n--- Validation tests ---\n");

  assert("TEST — font size default valid", validateFontSize(10) === 10);
  assertErrorCode(
    "TEST — font size below minimum",
    () => validateFontSize(7),
    "INVALID_FONT_SIZE",
  );
  assertErrorCode(
    "TEST — font size above maximum",
    () => validateFontSize(37),
    "INVALID_FONT_SIZE",
  );
  assertErrorCode(
    "TEST — font size NaN",
    () => validateFontSize(Number.NaN),
    "INVALID_FONT_SIZE",
  );

  assert("TEST — margin medium valid", validateMargin(36) === 36);
  assertErrorCode(
    "TEST — margin not preset",
    () => validateMargin(30),
    "INVALID_MARGIN",
  );

  assert("TEST — starting number valid", validateStartingNumber(1) === 1);
  assertErrorCode(
    "TEST — starting number zero",
    () => validateStartingNumber(0),
    "INVALID_START_NUMBER",
  );
  assertErrorCode(
    "TEST — starting number over max",
    () => validateStartingNumber(100_000),
    "INVALID_START_NUMBER",
  );

  const black = validateHexColor("#000000");
  assert(
    "TEST — hex #000000",
    black.r === 0 && black.g === 0 && black.b === 0,
  );
  const short = validateHexColor("#f60");
  assert(
    "TEST — hex #f60 expanded",
    Math.abs(short.r - 1) < 0.01 && Math.abs(short.g - 0.4) < 0.01,
  );
  assertErrorCode(
    "TEST — invalid hex",
    () => validateHexColor("red"),
    "INVALID_COLOR",
  );
}

function run() {
  console.log("\nAdd Page Numbers range + numbering verification\n");
  runRangeTests();
  runNumberingTests();
  runValidationTests();

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

run();
