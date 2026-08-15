/**
 * Crop PDF state management tests (Phase 121B).
 * Run: npx tsx scripts/verify-crop-pdf-state.ts
 */

import { degrees, PDFDocument } from "pdf-lib";
import {
  applyNormalizedCropToPages,
  CropPdfError,
  getApplyCropCompatibility,
  getPageById,
  hasCustomCrop,
  loadCropDocumentState,
  resetAllCrops,
  resetPageCrop,
  setCropForPage,
  validatePageCrop,
} from "../lib/tools/crop-pdf";

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
  sizes: Array<{ width: number; height: number; rotation?: 0 | 90 | 180 | 270 }>,
): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();

  for (const spec of sizes) {
    const page = pdf.addPage([spec.width, spec.height]);
    if (spec.rotation) {
      page.setRotation(degrees(spec.rotation));
    }
  }

  return pdf.save();
}

async function createOffsetCropPdf(): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  const page = pdf.addPage([600, 800]);
  page.setCropBox(50, 75, 500, 650);
  return pdf.save();
}

async function run() {
  console.log("\nCrop PDF state verification\n");

  const sourceBytes = await createMultiPagePdf([
    { width: 600, height: 800 },
    { width: 600, height: 800 },
    { width: 800, height: 600 },
  ]);
  const buffer = bytesToArrayBuffer(sourceBytes);

  const loaded1 = await loadCropDocumentState(buffer);
  const loaded2 = await loadCropDocumentState(buffer);

  // Stable page IDs
  assert(
    "Stable page IDs — unique per page",
    new Set(loaded1.pages.map((page) => page.id)).size === loaded1.pages.length,
  );
  assert(
    "Stable page IDs — reload generates new IDs (UUID per load)",
    loaded1.pages[0].id !== loaded2.pages[0].id,
  );

  const page0Id = loaded1.pages[0].id;
  const page1Id = loaded1.pages[1].id;
  const page2Id = loaded1.pages[2].id;

  const cropA = { x: 0.1, y: 0.2, width: 0.35, height: 0.45 };
  const cropB = { x: 0.05, y: 0.05, width: 0.5, height: 0.5 };

  // Set crop
  let state = setCropForPage(loaded1, page0Id, cropA);
  assert(
    "Set crop — hasCustomCrop true",
    hasCustomCrop(getPageById(state.pages, page0Id)),
  );
  assert(
    "Set crop — other pages unchanged",
    !hasCustomCrop(getPageById(state.pages, page1Id)),
  );

  // Per-page independent crops
  state = setCropForPage(state, page1Id, cropB);
  assert(
    "Per-page crops — page 0 retains crop A",
    getPageById(state.pages, page0Id).normalizedCropRect.x === cropA.x,
  );
  assert(
    "Per-page crops — page 1 has crop B",
    getPageById(state.pages, page1Id).normalizedCropRect.width === cropB.width,
  );

  // Reset current page
  state = resetPageCrop(state, page0Id);
  assert(
    "Reset current — clears custom crop flag",
    !hasCustomCrop(getPageById(state.pages, page0Id)),
  );
  assert(
    "Reset current — other page crop preserved",
    hasCustomCrop(getPageById(state.pages, page1Id)),
  );

  // Reset all
  state = resetAllCrops(state);
  assert(
    "Reset all — no custom crops remain",
    state.pages.every((page) => !page.hasCustomCrop),
  );

  // Original CropBox retained after reset (offset crop fixture)
  const offsetBytes = bytesToArrayBuffer(await createOffsetCropPdf());
  const offsetState = await loadCropDocumentState(offsetBytes);
  const offsetPageId = offsetState.pages[0].id;
  const originalCrop = { ...offsetState.pages[0].originalCropBox };

  let offsetWorking = setCropForPage(offsetState, offsetPageId, cropA);
  offsetWorking = resetPageCrop(offsetWorking, offsetPageId);
  const resetPage = getPageById(offsetWorking.pages, offsetPageId);

  assert(
    "Reset preserves original CropBox metadata",
    resetPage.originalCropBox.x === originalCrop.x &&
      resetPage.originalCropBox.y === originalCrop.y &&
      resetPage.originalCropBox.width === originalCrop.width &&
      resetPage.originalCropBox.height === originalCrop.height,
  );
  assert(
    "Reset preserves visible box",
    resetPage.visibleBox.width === 500 && resetPage.visibleBox.height === 650,
  );

  // Apply to compatible pages
  const compatibleBytes = bytesToArrayBuffer(
    await createMultiPagePdf([
      { width: 600, height: 800 },
      { width: 600, height: 800 },
    ]),
  );
  let compatState = await loadCropDocumentState(compatibleBytes);
  const compat0 = compatState.pages[0].id;
  const compat1 = compatState.pages[1].id;

  compatState = setCropForPage(compatState, compat0, cropA);
  const applyResult = applyNormalizedCropToPages(compatState, compat0, [
    compat0,
    compat1,
  ]);

  assert(
    "Apply to compatible — both pages applied",
    applyResult.appliedPageIds.length === 2,
  );
  assert(
    "Apply to compatible — page 1 matches source crop",
    getPageById(applyResult.state.pages, compat1).normalizedCropRect.x === cropA.x,
  );

  // Mixed geometry — landscape page skipped
  const mixedBytes = bytesToArrayBuffer(
    await createMultiPagePdf([
      { width: 600, height: 800 },
      { width: 800, height: 600 },
    ]),
  );
  let mixedState = await loadCropDocumentState(mixedBytes);
  const mixed0 = mixedState.pages[0].id;
  const mixed1 = mixedState.pages[1].id;

  mixedState = setCropForPage(mixedState, mixed0, cropA);
  const mixedApply = applyNormalizedCropToPages(mixedState, mixed0, [
    mixed0,
    mixed1,
  ]);

  assert(
    "Mixed geometry — incompatible page skipped",
    mixedApply.skippedPageIds.includes(mixed1),
  );
  assert(
    "Mixed geometry — compatibility check fails for different sizes",
    !getApplyCropCompatibility(
      getPageById(mixedState.pages, mixed0),
      getPageById(mixedState.pages, mixed1),
    ).compatible,
  );

  // Invalid page id
  let threw = false;
  try {
    setCropForPage(mixedState, "nonexistent-id", cropA);
  } catch (error) {
    threw = error instanceof CropPdfError && error.code === "INVALID_PAGE";
  }
  assert("Invalid page id — throws INVALID_PAGE", threw);

  // Invalid crop validation
  threw = false;
  try {
    validatePageCrop({ x: 0, y: 0, width: 0.01, height: 0.5 });
  } catch (error) {
    threw = error instanceof CropPdfError && error.code === "CROP_TOO_SMALL";
  }
  assert("Invalid crop — CROP_TOO_SMALL", threw);

  // Immutable operations — original state unchanged
  const immutableBefore = await loadCropDocumentState(buffer);
  const immutablePageId = immutableBefore.pages[0].id;
  const immutableCopy = setCropForPage(immutableBefore, immutablePageId, cropA);
  assert(
    "Immutable — original state unchanged after setCropForPage",
    !hasCustomCrop(getPageById(immutableBefore.pages, immutablePageId)) &&
      hasCustomCrop(getPageById(immutableCopy.pages, immutablePageId)),
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
