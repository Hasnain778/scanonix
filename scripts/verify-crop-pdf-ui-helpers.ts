/**
 * Crop PDF UI helper tests (Phase 121C).
 * Run: npx tsx scripts/verify-crop-pdf-ui-helpers.ts
 */

import { PDFDocument } from "pdf-lib";
import {
  applyNormalizedCropToPages,
  buildCroppedPdfFilename,
  clampNormalizedCrop,
  loadCropDocumentState,
  MIN_NORMALIZED_CROP_SIZE,
  moveNormalizedCrop,
  resetAllCrops,
  resetPageCrop,
  resizeNormalizedCrop,
  setCropForPage,
} from "../lib/tools/crop-pdf";
import {
  canExportCropWorkspace,
  countCompatiblePages,
  formatApplyCropSummary,
  getCompatiblePageIds,
  normalizedCropFromPercentInputs,
  shouldClearCropStateOnReplace,
} from "../lib/tools/crop-pdf/workspace-ui";

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

async function createMultiPagePdf(
  sizes: Array<{ width: number; height: number }>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (const spec of sizes) {
    pdf.addPage([spec.width, spec.height]);
  }
  return pdf.save();
}

async function run() {
  console.log("\nCrop PDF UI helper verification\n");

  const cropA = { x: 0.1, y: 0.15, width: 0.4, height: 0.5 };
  const cropB = { x: 0.05, y: 0.05, width: 0.55, height: 0.55 };

  assert(
    "crop clamping keeps rect inside page",
    clampNormalizedCrop({ x: 0.95, y: 0.95, width: 0.2, height: 0.2 }).x <=
      1 - MIN_NORMALIZED_CROP_SIZE,
  );

  assert(
    "minimum crop size enforced on resize",
    resizeNormalizedCrop(
      { x: 0.1, y: 0.1, width: 0.5, height: 0.5 },
      "se",
      -0.6,
      -0.6,
    ).width >= MIN_NORMALIZED_CROP_SIZE,
  );

  assert(
    "drag state update stays in bounds",
    moveNormalizedCrop({ x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, 0.9, 0.9).x +
      moveNormalizedCrop({ x: 0.1, y: 0.1, width: 0.3, height: 0.3 }, 0.9, 0.9)
        .width <=
      1 + 1e-9,
  );

  const sourceBytes = bytesToArrayBuffer(
    await createMultiPagePdf([
      { width: 600, height: 800 },
      { width: 600, height: 800 },
      { width: 800, height: 600 },
    ]),
  );
  const loaded = await loadCropDocumentState(sourceBytes);
  const page0 = loaded.pages[0].id;
  const page1 = loaded.pages[1].id;
  const page2 = loaded.pages[2].id;

  let state = setCropForPage(loaded, page0, cropA);
  state = setCropForPage(state, page1, cropB);

  assert(
    "page navigation preserves crop state",
    getPageByIdSafe(state, page0).normalizedCropRect.x === cropA.x &&
      getPageByIdSafe(state, page1).normalizedCropRect.width === cropB.width,
  );

  const applyCurrent = setCropForPage(state, page0, cropA);
  assert(
    "apply-to-current updates page",
    getPageByIdSafe(applyCurrent, page0).hasCustomCrop,
  );

  const applyResult = applyNormalizedCropToPages(state, page0, [page0, page1, page2]);
  assert(
    "apply-to-compatible pages applies matching geometry",
    getPageByIdSafe(applyResult.state, page1).normalizedCropRect.x === cropA.x,
  );
  assert(
    "apply-to-compatible pages skips incompatible",
    applyResult.skippedPageIds.includes(page2),
  );
  assert(
    "apply summary mentions skipped pages",
    formatApplyCropSummary(applyResult).includes("Skipped"),
  );

  const resetCurrent = resetPageCrop(state, page0);
  assert(
    "reset current clears custom crop",
    !getPageByIdSafe(resetCurrent, page0).hasCustomCrop,
  );
  assert(
    "reset current preserves other page crop",
    getPageByIdSafe(resetCurrent, page1).hasCustomCrop,
  );

  const resetAll = resetAllCrops(state);
  assert(
    "reset all clears every custom crop",
    resetAll.pages.every((page) => !page.hasCustomCrop),
  );

  assert("export disabled while processing", !canExportCropWorkspace(3, true));
  assert("export enabled when idle", canExportCropWorkspace(3, false));
  assert("replace PDF clears state flag", shouldClearCropStateOnReplace());

  assert(
    "compatible page count",
    countCompatiblePages(state.pages, page0) === 2,
  );
  assert(
    "compatible page ids exclude landscape page",
    !getCompatiblePageIds(state.pages, page0).includes(page2),
  );

  const fromPercent = normalizedCropFromPercentInputs({
    xPercent: 10,
    yPercent: 20,
    widthPercent: 40,
    heightPercent: 50,
  });
  assert("percent inputs map to normalized crop", fromPercent.x === 0.1);

  assert(
    "filename helper",
    buildCroppedPdfFilename("report.pdf") === "report-cropped.pdf",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

function getPageByIdSafe(
  state: { pages: Array<{ id: string; normalizedCropRect: { x: number; width: number }; hasCustomCrop: boolean }> },
  id: string,
) {
  const page = state.pages.find((entry) => entry.id === id);
  if (!page) {
    throw new Error(`Page ${id} not found`);
  }
  return page;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
