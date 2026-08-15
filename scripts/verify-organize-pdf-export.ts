/**
 * Organize PDF core engine tests (Phase 120B).
 * Run: npx tsx scripts/verify-organize-pdf-export.ts
 */

import { degrees, PDFDocument, rgb } from "pdf-lib";
import { loadPdfDocument } from "../lib/pdf/core";
import {
  buildOrganizedPdfFilename,
  deletePageById,
  loadOrganizeDocumentState,
  MAX_ORGANIZE_PDF_BYTES,
  MAX_ORGANIZE_PDF_PAGES,
  movePageLeft,
  movePageRight,
  normalizePageRotation,
  organizePdfDocument,
  OrganizePdfError,
  reorderPages,
  rotatePageById,
  type OrganizePageEntry,
} from "../lib/tools/organize-pdf";

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

type PageLabel = "A" | "B" | "C" | "D";

const PAGE_SPECS: Record<PageLabel, { width: number; height: number }> = {
  A: { width: 400, height: 600 },
  B: { width: 600, height: 400 },
  C: { width: 500, height: 500 },
  D: { width: 700, height: 300 },
};

async function createLabeledPdf(labels: PageLabel[]): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (const label of labels) {
    const spec = PAGE_SPECS[label];
    const page = pdf.addPage([spec.width, spec.height]);
    page.drawText(`PAGE ${label}`, {
      x: 20,
      y: spec.height - 40,
      size: 24,
      color: rgb(0.1, 0.1, 0.1),
    });
  }

  return pdf.save();
}

async function createRotatedSourcePdf(
  label: PageLabel,
  intrinsicDegrees: 0 | 90 | 180 | 270,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const spec = PAGE_SPECS[label];
  const page = pdf.addPage([spec.width, spec.height]);
  page.drawText(`PAGE ${label}`, {
    x: 20,
    y: spec.height - 40,
    size: 24,
  });
  page.setRotation(degrees(intrinsicDegrees));
  return pdf.save();
}

function entryFromLabel(
  id: string,
  label: PageLabel,
  sourcePageIndex: number,
  overrides: Partial<OrganizePageEntry> = {},
): OrganizePageEntry {
  const spec = PAGE_SPECS[label];
  return {
    id,
    sourcePageIndex,
    intrinsicRotation: 0,
    rotationDelta: 0,
    mediaWidth: spec.width,
    mediaHeight: spec.height,
    ...overrides,
  };
}

async function assertExportedPageSizes(
  blob: Blob,
  expected: Array<{ width: number; height: number }>,
  name: string,
): Promise<void> {
  const pdf = await loadPdfDocument(await blob.arrayBuffer());
  assert(
    `${name} — page count`,
    pdf.getPageCount() === expected.length,
    `expected ${expected.length}, got ${pdf.getPageCount()}`,
  );

  for (let index = 0; index < expected.length; index += 1) {
    const page = pdf.getPage(index);
    const { width, height } = page.getSize();
    const target = expected[index];
    const sizeMatch =
      Math.abs(width - target.width) < 0.5 &&
      Math.abs(height - target.height) < 0.5;
    assert(
      `${name} — page ${index + 1} size`,
      sizeMatch,
      `expected ${target.width}x${target.height}, got ${width}x${height}`,
    );
  }
}

async function assertExportedRotations(
  blob: Blob,
  expectedAngles: number[],
  name: string,
): Promise<void> {
  const pdf = await loadPdfDocument(await blob.arrayBuffer());
  for (let index = 0; index < expectedAngles.length; index += 1) {
    const angle = normalizePageRotation(pdf.getPage(index).getRotation().angle);
    assert(
      `${name} — page ${index + 1} rotation`,
      angle === expectedAngles[index],
      `expected ${expectedAngles[index]}, got ${angle}`,
    );
  }
}

async function run() {
  console.log("\nOrganize PDF export verification\n");

  // Filename — Test N
  assert(
    "TEST N — filename helper basic",
    buildOrganizedPdfFilename("document.pdf") === "document-organized.pdf",
  );
  assert(
    "TEST N — filename helper uppercase extension",
    buildOrganizedPdfFilename("DOCUMENT.PDF") === "DOCUMENT-organized.pdf",
  );
  assert(
    "TEST N — filename helper no extension",
    buildOrganizedPdfFilename("document") === "document-organized.pdf",
  );
  assert(
    "TEST N — filename helper spaced name",
    buildOrganizedPdfFilename("my scan file.pdf") === "my scan file-organized.pdf",
  );
  assert(
    "TEST N — filename helper multiple dots",
    buildOrganizedPdfFilename("report.final.v2.pdf") === "report.final.v2-organized.pdf",
  );

  const abcdBytes = await createLabeledPdf(["A", "B", "C", "D"]);
  const abcBytes = await createLabeledPdf(["A", "B", "C"]);
  const singleBytes = await createLabeledPdf(["A"]);

  const pagesA = entryFromLabel("a", "A", 0);
  const pagesB = entryFromLabel("b", "B", 1);
  const pagesC = entryFromLabel("c", "C", 2);
  const pagesD = entryFromLabel("d", "D", 3);

  // TEST A — identity order
  const exportA = await organizePdfDocument(bytesToArrayBuffer(abcBytes), [
    pagesA,
    pagesB,
    pagesC,
  ]);
  await assertExportedPageSizes(
    exportA,
    [PAGE_SPECS.A, PAGE_SPECS.B, PAGE_SPECS.C],
    "TEST A",
  );

  // TEST B — reorder C A B
  const exportB = await organizePdfDocument(bytesToArrayBuffer(abcBytes), [
    pagesC,
    pagesA,
    pagesB,
  ]);
  await assertExportedPageSizes(
    exportB,
    [PAGE_SPECS.C, PAGE_SPECS.A, PAGE_SPECS.B],
    "TEST B",
  );

  // TEST C — multiple reorders: D first, B last → D A C B
  let orderC = [pagesA, pagesB, pagesC, pagesD];
  orderC = reorderPages(orderC, 3, 0);
  orderC = reorderPages(orderC, 2, 3);
  assert(
    "TEST C — reorder engine order ids",
    orderC.map((page) => page.id).join(",") === "d,a,c,b",
  );
  const exportC = await organizePdfDocument(bytesToArrayBuffer(abcdBytes), orderC);
  await assertExportedPageSizes(
    exportC,
    [PAGE_SPECS.D, PAGE_SPECS.A, PAGE_SPECS.C, PAGE_SPECS.B],
    "TEST C",
  );

  // TEST D — delete middle
  const exportD = await organizePdfDocument(bytesToArrayBuffer(abcBytes), [
    pagesA,
    pagesC,
  ]);
  await assertExportedPageSizes(exportD, [PAGE_SPECS.A, PAGE_SPECS.C], "TEST D");

  // TEST E — delete first / last
  const exportE1 = await organizePdfDocument(bytesToArrayBuffer(abcBytes), [
    pagesB,
    pagesC,
  ]);
  await assertExportedPageSizes(exportE1, [PAGE_SPECS.B, PAGE_SPECS.C], "TEST E delete first");

  const exportE2 = await organizePdfDocument(bytesToArrayBuffer(abcBytes), [
    pagesA,
    pagesB,
  ]);
  await assertExportedPageSizes(exportE2, [PAGE_SPECS.A, PAGE_SPECS.B], "TEST E delete last");

  // TEST F — prevent empty document
  let deleteBlocked = false;
  try {
    deletePageById([pagesA], pagesA.id);
  } catch (error) {
    deleteBlocked =
      error instanceof OrganizePdfError &&
      error.code === "CANNOT_DELETE_LAST_PAGE";
  }
  assert("TEST F — delete last page blocked", deleteBlocked);

  let exportBlocked = false;
  try {
    await organizePdfDocument(bytesToArrayBuffer(singleBytes), []);
  } catch (error) {
    exportBlocked =
      error instanceof OrganizePdfError && error.code === "NO_PAGES";
  }
  assert("TEST F — zero-page export blocked", exportBlocked);

  // TEST G — rotate only page 2
  const rotatedG = rotatePageById([pagesA, pagesB, pagesC], pagesB.id);
  const exportG = await organizePdfDocument(bytesToArrayBuffer(abcBytes), rotatedG);
  await assertExportedPageSizes(
    exportG,
    [PAGE_SPECS.A, PAGE_SPECS.B, PAGE_SPECS.C],
    "TEST G sizes",
  );
  await assertExportedRotations(exportG, [0, 90, 0], "TEST G");

  // TEST H — rotation cycle
  let cyclePage = pagesB;
  let cycleState = [pagesA, cyclePage, pagesC];
  const cycleAngles: Array<0 | 90 | 180 | 270> = [0, 90, 180, 270, 0];
  for (let step = 0; step < cycleAngles.length; step += 1) {
    const expected = cycleAngles[step];
    assert(
      `TEST H — rotation cycle step ${step}`,
      cyclePage.rotationDelta === expected,
      `expected delta ${expected}, got ${cyclePage.rotationDelta}`,
    );
    if (step < cycleAngles.length - 1) {
      cycleState = rotatePageById(cycleState, pagesB.id);
      cyclePage = cycleState[1];
    }
  }

  // TEST I — existing rotated source page + additional delta
  const rotatedSourceBytes = await createRotatedSourcePdf("A", 90);
  const loadedRotated = await loadOrganizeDocumentState(
    bytesToArrayBuffer(rotatedSourceBytes),
  );
  assert(
    "TEST I — intrinsic rotation captured",
    loadedRotated.pages[0]?.intrinsicRotation === 90,
  );
  const withDelta = rotatePageById(loadedRotated.pages, loadedRotated.pages[0].id);
  const exportI = await organizePdfDocument(
    bytesToArrayBuffer(rotatedSourceBytes),
    withDelta,
  );
  await assertExportedRotations(exportI, [180], "TEST I");

  // TEST J — mixed dimensions reorder
  const exportJ = await organizePdfDocument(bytesToArrayBuffer(abcdBytes), [
    pagesD,
    pagesB,
    pagesA,
    pagesC,
  ]);
  await assertExportedPageSizes(
    exportJ,
    [PAGE_SPECS.D, PAGE_SPECS.B, PAGE_SPECS.A, PAGE_SPECS.C],
    "TEST J",
  );

  // TEST K — reorder + rotate + delete combined
  let stateK = [pagesA, pagesB, pagesC, pagesD];
  stateK = deletePageById(stateK, pagesB.id);
  stateK = rotatePageById(stateK, pagesC.id);
  const rotatedC = stateK.find((page) => page.id === pagesC.id)!;
  stateK = [pagesD, pagesA, rotatedC];
  const exportK = await organizePdfDocument(bytesToArrayBuffer(abcdBytes), stateK);
  assert("TEST K — page count", (await loadPdfDocument(await exportK.arrayBuffer())).getPageCount() === 3);
  await assertExportedPageSizes(
    exportK,
    [PAGE_SPECS.D, PAGE_SPECS.A, PAGE_SPECS.C],
    "TEST K order",
  );
  await assertExportedRotations(exportK, [0, 0, 90], "TEST K rotation");

  // TEST L — malformed PDF
  let malformed = false;
  try {
    await loadOrganizeDocumentState(new ArrayBuffer(8));
  } catch (error) {
    malformed =
      error instanceof OrganizePdfError && error.code === "CORRUPT_PDF";
  }
  assert("TEST L — malformed PDF rejected", malformed);

  // TEST M — 1-page PDF
  const exportM = await organizePdfDocument(bytesToArrayBuffer(singleBytes), [
    pagesA,
  ]);
  await assertExportedPageSizes(exportM, [PAGE_SPECS.A], "TEST M");

  // Stable IDs preserved through reorder
  const reordered = reorderPages([pagesA, pagesB, pagesC], 2, 0);
  assert(
    "stable page ids after reorder",
    reordered.map((page) => page.id).join(",") === "c,a,b",
  );

  // Reorder safety — no-op at boundaries
  assert(
    "move first page left is safe",
    movePageLeft([pagesA, pagesB], pagesA.id)
      .map((page) => page.id)
      .join(",") === "a,b",
  );
  const movedRight = movePageRight([pagesA, pagesB], pagesB.id);
  assert(
    "move last page right is safe",
    movedRight.map((page) => page.id).join(",") === "a,b",
  );

  // Invalid reorder indices
  let invalidReorder = false;
  try {
    reorderPages([pagesA, pagesB], -1, 0);
  } catch (error) {
    invalidReorder =
      error instanceof OrganizePdfError && error.code === "INVALID_INDEX";
  }
  assert("invalid reorder indices rejected", invalidReorder);

  // File size limit
  let tooLarge = false;
  try {
    await loadOrganizeDocumentState(bytesToArrayBuffer(abcBytes), {
      byteLength: MAX_ORGANIZE_PDF_BYTES + 1,
    });
  } catch (error) {
    tooLarge =
      error instanceof OrganizePdfError && error.code === "FILE_TOO_LARGE";
  }
  assert("file size limit enforced", tooLarge);

  // Page limit
  const manyPagePdf = await PDFDocument.create();
  for (let index = 0; index < MAX_ORGANIZE_PDF_PAGES + 1; index += 1) {
    manyPagePdf.addPage([300, 400]);
  }
  const manyBytes = await manyPagePdf.save();
  let tooManyPages = false;
  try {
    await loadOrganizeDocumentState(bytesToArrayBuffer(manyBytes));
  } catch (error) {
    tooManyPages =
      error instanceof OrganizePdfError && error.code === "TOO_MANY_PAGES";
  }
  assert("page limit enforced", tooManyPages);

  // Load creates stable ids and preserves source indices
  const loaded = await loadOrganizeDocumentState(bytesToArrayBuffer(abcBytes));
  assert(
    "load preserves source indices",
    loaded.pages.map((page) => page.sourcePageIndex).join(",") === "0,1,2",
  );
  assert(
    "load assigns unique ids",
    new Set(loaded.pages.map((page) => page.id)).size === loaded.pages.length,
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

void run();
