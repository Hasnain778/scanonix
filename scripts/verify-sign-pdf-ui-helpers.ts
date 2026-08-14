/**
 * Sign PDF UI helper tests (Phase 119C).
 * Run: npx tsx scripts/verify-sign-pdf-ui-helpers.ts
 */

import { buildSignedPdfFilename } from "../lib/tools/sign-pdf/filename";
import {
  canExportSignPdf,
  createDefaultPlacement,
  getPlacementsForPage,
  movePreviewRect,
  previewRectToNormalizedPlacement,
} from "../lib/tools/sign-pdf/placement-ui";

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

function run() {
  console.log("\nSign PDF UI helper verification\n");

  assert("export disabled with zero placements", !canExportSignPdf([]));
  assert("export enabled with placements", canExportSignPdf([
    {
      id: "p1",
      pageIndex: 0,
      normX: 0.1,
      normY: 0.1,
      normWidth: 0.2,
      normHeight: 0.1,
      signatureAssetId: "a1",
    },
  ]));

  const placement = createDefaultPlacement({
    id: "p1",
    pageIndex: 0,
    signatureAssetId: "a1",
    assetAspectRatio: 2,
  });
  assert("default placement centered-ish", placement.normX > 0 && placement.normY > 0);
  assert(
    "default placement within bounds",
    placement.normX + placement.normWidth <= 1 &&
      placement.normY + placement.normHeight <= 1,
  );

  const moved = movePreviewRect(
    { x: 10, y: 10, width: 50, height: 20 },
    15,
    5,
    300,
    400,
  );
  assert("move constrained inside page", moved.x === 25 && moved.y === 15);

  const normalized = previewRectToNormalizedPlacement(
    { id: "p2", pageIndex: 1, signatureAssetId: "a2" },
    { x: 150, y: 300, width: 75, height: 40 },
    300,
    400,
  );
  assert("normalized page index preserved", normalized.pageIndex === 1);
  assert("normalized x", Math.abs(normalized.normX - 0.5) < 0.001);

  const pagePlacements = getPlacementsForPage(
    [
      { ...placement, pageIndex: 0 },
      { ...placement, id: "p2", pageIndex: 2 },
    ],
    2,
  );
  assert("page filter returns one placement", pagePlacements.length === 1);

  assert(
    "filename helper",
    buildSignedPdfFilename("contract.pdf") === "contract-signed.pdf",
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
