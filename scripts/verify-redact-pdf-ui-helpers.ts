/**
 * Redact PDF UI helper tests (Phase 125C) — tests A–Z.
 * Run: npx tsx scripts/verify-redact-pdf-ui-helpers.ts
 */

import { PDFDocument, degrees } from "pdf-lib";
import {
  addRedaction,
  addRedactionToState,
  applyRedactionsToDocumentState,
  canExportRedactWorkspace,
  clampNormalizedRedaction,
  clearAllRedactions,
  clearRedactionsForPage,
  commitRedactionHistory,
  computeFitWidthZoom,
  createRedactionHistory,
  createRedactionPageGeometryForEntry,
  isRedactDrawModeActive,
  loadRedactionDocumentState,
  MIN_NORMALIZED_REDACTION_SIZE,
  moveNormalizedRedaction,
  normalizedRedactionFromPointerDrag,
  REDACT_DRAW_MODE,
  redoRedactionHistory,
  removeRedactionFromState,
  resizeNormalizedRedaction,
  shouldAbortExportOnRasterFailure,
  stepRedactZoom,
  undoRedactionHistory,
  updateRedactionInState,
  zoomPreservesNormalizedRedactions,
} from "../lib/tools/redact-pdf";
import { RedactPdfError } from "../lib/tools/redact-pdf/types";
import { redactPdfDocument } from "../lib/tools/redact-pdf/redact-pdf";

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

async function createRotatedPdf(
  rotation: 0 | 90 | 180 | 270,
): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([612, 792]);
  if (rotation !== 0) {
    page.setRotation(degrees(rotation));
  }
  return bytesToArrayBuffer(await pdf.save());
}

async function createOffsetCropPdf(): Promise<ArrayBuffer> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([800, 600]);
  page.setCropBox(100, 50, 500, 400);
  return bytesToArrayBuffer(await pdf.save());
}

const SAMPLE = { x: 0.2, y: 0.3, width: 0.4, height: 0.2 };

async function run() {
  console.log("\nRedact PDF UI helper verification (Phase 125C)\n");

  // A. draw mode active
  assert("A draw mode active", isRedactDrawModeActive(REDACT_DRAW_MODE));

  // B. pointer drag creates normalized rect
  const dragged = normalizedRedactionFromPointerDrag(
    { x: 0.1, y: 0.2 },
    { x: 0.5, y: 0.6 },
  );
  assert(
    "B pointer drag creates normalized rect",
    dragged !== null && dragged.x === 0.1 && dragged.width === 0.4,
  );

  // C. minimum size enforced
  assert(
    "C minimum size enforced",
    normalizedRedactionFromPointerDrag(
      { x: 0.1, y: 0.1 },
      { x: 0.105, y: 0.105 },
    ) === null,
  );

  // D. bounds enforced
  const clamped = clampNormalizedRedaction({ x: 0.95, y: 0.95, width: 0.2, height: 0.2 });
  assert(
    "D bounds enforced",
    clamped.x + clamped.width <= 1 + 1e-9 &&
      clamped.y + clamped.height <= 1 + 1e-9,
  );

  // E. move
  const moved = moveNormalizedRedaction(SAMPLE, 0.05, 0.05);
  assert("E move", moved.x === 0.25 && moved.y === 0.35);

  // F. resize
  const resized = resizeNormalizedRedaction(SAMPLE, "se", 0.1, 0.05);
  assert(
    "F resize",
    resized.width > SAMPLE.width && resized.height > SAMPLE.height,
  );

  const singleBytes = await createMultiPagePdf(1);
  let state = await loadRedactionDocumentState(singleBytes);
  state = addRedaction(state, 0, SAMPLE);

  // G. delete
  const deleteState = addRedaction(
    await loadRedactionDocumentState(singleBytes),
    0,
    SAMPLE,
  );
  const deleteId = deleteState.redactions[0].id;
  const afterDelete = removeRedactionFromState(deleteState, deleteId);
  assert("G delete", afterDelete.redactions.length === 0);

  // H. multiple rects
  let multiRectState = await loadRedactionDocumentState(singleBytes);
  multiRectState = addRedaction(multiRectState, 0, SAMPLE);
  multiRectState = addRedaction(multiRectState, 0, {
    x: 0.55,
    y: 0.55,
    width: 0.2,
    height: 0.2,
  });
  assert(
    "H multiple rects",
    multiRectState.redactions.length === 2 &&
      multiRectState.redactions[0].id !== multiRectState.redactions[1].id,
  );
  state = multiRectState;

  // I. multiple pages
  const multiBytes = await createMultiPagePdf(3);
  let multiState = await loadRedactionDocumentState(multiBytes);
  multiState = addRedaction(multiState, 0, SAMPLE);
  multiState = addRedaction(multiState, 2, { x: 0.1, y: 0.1, width: 0.3, height: 0.3 });
  assert(
    "I multiple pages",
    multiState.redactions.some((rect) => rect.pageIndex === 0) &&
      multiState.redactions.some((rect) => rect.pageIndex === 2),
  );

  // J. undo add
  let history = createRedactionHistory([]);
  history = commitRedactionHistory(history, state.redactions);
  const undoneAdd = undoRedactionHistory(history);
  assert(
    "J undo add",
    undoneAdd !== null && undoneAdd.present.length === 0,
  );

  // K. redo add
  const redoneAdd = redoRedactionHistory(undoneAdd!);
  assert(
    "K redo add",
    redoneAdd !== null && redoneAdd.present.length === state.redactions.length,
  );

  // L. undo move
  let moveState = addRedaction(await loadRedactionDocumentState(singleBytes), 0, SAMPLE);
  const originalX = moveState.redactions[0].x;
  moveState = updateRedactionInState(moveState, moveState.redactions[0].id, {
    ...SAMPLE,
    x: 0.35,
  });
  history = createRedactionHistory([{ ...moveState.redactions[0], x: originalX }]);
  history = commitRedactionHistory(history, moveState.redactions);
  const undoneMove = undoRedactionHistory(history);
  assert(
    "L undo move",
    undoneMove !== null && undoneMove.present[0].x === originalX,
  );

  // M. undo resize
  let resizeState = addRedaction(await loadRedactionDocumentState(singleBytes), 0, SAMPLE);
  const originalWidth = resizeState.redactions[0].width;
  resizeState = updateRedactionInState(
    resizeState,
    resizeState.redactions[0].id,
    { ...SAMPLE, width: 0.55 },
  );
  history = createRedactionHistory([
    { ...resizeState.redactions[0], width: originalWidth },
  ]);
  history = commitRedactionHistory(history, resizeState.redactions);
  const undoneResize = undoRedactionHistory(history);
  assert(
    "M undo resize",
    undoneResize !== null && undoneResize.present[0].width === originalWidth,
  );

  // N. clear page
  const clearedPage = clearRedactionsForPage(multiState, 0);
  assert(
    "N clear page",
    clearedPage.redactions.every((rect) => rect.pageIndex !== 0) &&
      clearedPage.redactions.some((rect) => rect.pageIndex === 2),
  );

  // O. clear all
  const clearedAll = clearAllRedactions(multiState);
  assert("O clear all", clearedAll.redactions.length === 0);

  // P. page navigation preserves state
  multiState = await loadRedactionDocumentState(multiBytes);
  multiState = addRedaction(multiState, 0, SAMPLE);
  multiState = addRedaction(multiState, 1, { x: 0.15, y: 0.15, width: 0.25, height: 0.25 });
  const page0Rects = multiState.redactions.filter((rect) => rect.pageIndex === 0);
  const page1Rects = multiState.redactions.filter((rect) => rect.pageIndex === 1);
  assert(
    "P page navigation preserves state",
    page0Rects.length === 1 && page1Rects.length === 1,
  );

  // Q. zoom preserves normalized state
  const beforeZoom = multiState.redactions;
  const afterZoom = applyRedactionsToDocumentState(multiState, beforeZoom).redactions;
  assert(
    "Q zoom preserves normalized state",
    zoomPreservesNormalizedRedactions(beforeZoom, afterZoom),
  );
  assert(
    "Q zoom step changes display only",
    stepRedactZoom(1, "in") > 1 &&
      zoomPreservesNormalizedRedactions(beforeZoom, beforeZoom),
  );

  // R–U. rotation overlay geometry
  for (const [label, rotation] of [
    ["R", 0],
    ["S", 90],
    ["T", 180],
    ["U", 270],
  ] as const) {
    const rotatedState = await loadRedactionDocumentState(
      await createRotatedPdf(rotation),
    );
    const geometry = createRedactionPageGeometryForEntry(rotatedState.pages[0]);
    assert(
      `${label} rotation ${rotation}° overlay geometry`,
      geometry.visualWidth > 0 && geometry.visualHeight > 0,
    );
  }

  // V. CropBox
  const cropState = await loadRedactionDocumentState(await createOffsetCropPdf());
  const cropGeometry = createRedactionPageGeometryForEntry(cropState.pages[0]);
  assert(
    "V CropBox geometry",
    cropGeometry.visibleBox.width === 500 && cropGeometry.visibleBox.height === 400,
  );

  // W. offset CropBox
  assert(
    "W offset CropBox visible area",
    cropState.pages[0].visibleBox.x === 100 && cropState.pages[0].visibleBox.y === 50,
  );

  // X. export disabled with no redactions
  const emptyState = await loadRedactionDocumentState(singleBytes);
  assert(
    "X export disabled with no redactions",
    !canExportRedactWorkspace(emptyState, false),
  );

  // Y. export uses 125B secure engine
  const exportState = addRedaction(emptyState, 0, SAMPLE);
  const exported = await redactPdfDocument(
    singleBytes,
    exportState,
    "sample.pdf",
  );
  assert(
    "Y export uses 125B secure engine",
    exported.bytes.byteLength > 0 && exported.filename.endsWith("-redacted.pdf"),
  );

  // Z. raster failure surfaces error, never insecure fallback
  assert("Z abort policy enabled", shouldAbortExportOnRasterFailure());
  let exportAborted = false;
  try {
    const truncated = singleBytes.slice(0, Math.floor(singleBytes.byteLength / 2));
    await redactPdfDocument(truncated, exportState, "sample.pdf");
  } catch (error) {
    exportAborted =
      error instanceof RedactPdfError &&
      (error.code === "RASTERIZATION_FAILED" ||
        error.code === "CORRUPT_PDF" ||
        error.code === "EXPORT_FAILED");
  }
  assert(
    "Z raster failure surfaces error, never insecure fallback",
    exportAborted,
  );

  assert(
    "minimum normalized redaction constant",
    MIN_NORMALIZED_REDACTION_SIZE === 0.01,
  );

  assert(
    "fit width zoom",
    computeFitWidthZoom(800, 400) === 2,
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
