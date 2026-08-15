/**
 * Redaction state tests for Redact PDF (Phase 125B).
 * Run: npx tsx scripts/verify-redact-pdf-state.ts
 */

import { PDFDocument } from "pdf-lib";
import {
  addRedaction,
  canExportRedactPdf,
  countCleanPages,
  countRedactedPages,
  getRedactedPageIndices,
  getRedactionsForPage,
  loadRedactionDocumentState,
  removeRedaction,
  updateRedaction,
  validateExportRedactionState,
} from "../lib/tools/redact-pdf";
import { RedactPdfError } from "../lib/tools/redact-pdf/types";
import { MAX_REDACTIONS } from "../lib/tools/redact-pdf/limits";

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

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

async function createMultiPagePdf(pageCount: number): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  for (let index = 0; index < pageCount; index += 1) {
    pdf.addPage([612, 792]);
  }
  return bytesToArrayBuffer(await pdf.save());
}

const REDACT = { x: 0.2, y: 0.3, width: 0.4, height: 0.2 };

async function run() {
  console.log("\nRedact PDF state verification\n");

  const singleBytes = await createMultiPagePdf(1);
  let state = await loadRedactionDocumentState(singleBytes);
  assert("TEST A — load single page", state.pages.length === 1);
  assert("TEST B — initial redactions empty", state.redactions.length === 0);

  state = addRedaction(state, 0, REDACT);
  assert("TEST C — add redaction", state.redactions.length === 1);
  assert(
    "TEST D — redaction has stable id",
    typeof state.redactions[0].id === "string" && state.redactions[0].id.length > 0,
  );

  const redactionId = state.redactions[0].id;
  state = updateRedaction(state, redactionId, { x: 0.1, y: 0.1, width: 0.2, height: 0.2 });
  assert(
    "TEST E — update redaction",
    state.redactions[0].x === 0.1 && state.redactions[0].width === 0.2,
  );

  state = removeRedaction(state, redactionId);
  assert("TEST F — remove redaction", state.redactions.length === 0);

  state = addRedaction(state, 0, REDACT);
  assert("TEST G — canExport false without redactions cleared", canExportRedactPdf(state));

  const multiBytes = await createMultiPagePdf(3);
  let multiState = await loadRedactionDocumentState(multiBytes);
  multiState = addRedaction(multiState, 0, REDACT);
  multiState = addRedaction(multiState, 2, { x: 0.5, y: 0.5, width: 0.2, height: 0.2 });

  assert(
    "TEST H — multi-page redaction indices",
    getRedactedPageIndices(multiState.redactions).size === 2,
  );
  assert(
    "TEST I — getRedactionsForPage filters correctly",
    getRedactionsForPage(multiState.redactions, 0).length === 1 &&
      getRedactionsForPage(multiState.redactions, 1).length === 0,
  );
  assert(
    "TEST J — count redacted/clean pages",
    countRedactedPages(multiState) === 2 && countCleanPages(multiState) === 1,
  );

  let invalidPageThrew = false;
  try {
    addRedaction(multiState, 99, REDACT);
  } catch (error) {
    invalidPageThrew = error instanceof RedactPdfError && error.code === "INVALID_PAGE";
  }
  assert("TEST K — invalid page rejected", invalidPageThrew);

  let invalidRectThrew = false;
  try {
    addRedaction(multiState, 0, { x: 0, y: 0, width: 0.001, height: 0.5 });
  } catch (error) {
    invalidRectThrew =
      error instanceof RedactPdfError && error.code === "INVALID_RECTANGLE";
  }
  assert("TEST L — invalid rectangle rejected", invalidRectThrew);

  let noRedactionsThrew = false;
  try {
    validateExportRedactionState(await loadRedactionDocumentState(singleBytes));
  } catch (error) {
    noRedactionsThrew =
      error instanceof RedactPdfError && error.code === "NO_REDACTIONS";
  }
  assert("TEST M — export requires redactions", noRedactionsThrew);

  let corruptThrew = false;
  try {
    await loadRedactionDocumentState(bytesToArrayBuffer(new Uint8Array([1, 2, 3])));
  } catch (error) {
    corruptThrew = error instanceof RedactPdfError && error.code === "CORRUPT_PDF";
  }
  assert("TEST N — corrupt PDF rejected", corruptThrew);

  let tooManyThrew = false;
  try {
    let heavy = await loadRedactionDocumentState(singleBytes);
    for (let index = 0; index <= MAX_REDACTIONS; index += 1) {
      heavy = addRedaction(heavy, 0, {
        x: 0.01,
        y: 0.01,
        width: 0.02,
        height: 0.02,
      });
    }
  } catch (error) {
    tooManyThrew =
      error instanceof RedactPdfError && error.code === "TOO_MANY_REDACTIONS";
  }
  assert("TEST O — max redactions enforced", tooManyThrew);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
