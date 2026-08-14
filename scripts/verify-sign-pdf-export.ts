/**
 * Sign PDF export engine tests (Phase 119B).
 * Run: npx tsx scripts/verify-sign-pdf-export.ts
 */

import { PDFDocument, rgb } from "pdf-lib";
import { loadPdfDocument } from "../lib/pdf/core";
import {
  buildSignedPdfFilename,
  createSignatureAssetFromBytes,
  signPdfDocument,
} from "../lib/tools/sign-pdf";
import type { NormalizedPlacement } from "../lib/tools/sign-pdf/types";
import { SignPdfError } from "../lib/tools/sign-pdf/types";

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

/** 1×1 transparent PNG */
const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

/** Minimal valid JPEG (1×1) */
const TINY_JPG = Uint8Array.from(
  atob(
    "/9j/4AAQSkZJRgABAQEASABIAAD/2wBDAP//////////////////////////////////////////////////////////////////////////////////////2wBDAf//////////////////////////////////////////////////////////////////////////////////////wAARCAABAAEDAREAAhEBAxEB/8QAFAABAAAAAAAAAAAAAAAAAAAAAv/EABQRAQAAAAAAAAAAAAAAAAAAAAD/xAAUAQEAAAAAAAAAAAAAAAAAAAAA/9oADAMBAAIQAxAAAAGfAP/EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAQUCf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQMBAT8Bf//EABQRAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQIBAT8Bf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEABj8Cf//EABQQAQAAAAAAAAAAAAAAAAAAAAD/2gAIAQEAAj8Cf//Z",
  ),
  (char) => char.charCodeAt(0),
);

function bytesToArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer;
}

async function createTestPdf(pages: Array<{ width: number; height: number }>) {
  const pdf = await PDFDocument.create();

  for (const page of pages) {
    const sheet = pdf.addPage([page.width, page.height]);
    sheet.drawText("Scanonix Sign PDF test page", {
      x: 24,
      y: page.height - 48,
      size: 12,
      color: rgb(0.2, 0.2, 0.2),
    });
  }

  return pdf.save();
}

async function run() {
  console.log("\nSign PDF export verification\n");

  assert(
    "filename helper",
    buildSignedPdfFilename("contract.pdf") === "contract-signed.pdf",
  );

  const portraitBytes = await createTestPdf([{ width: 600, height: 800 }]);
  const portraitAsset = createSignatureAssetFromBytes(
    TINY_PNG,
    "sig-1",
    "draw",
    "image/png",
  );

  const portraitPlacement: NormalizedPlacement = {
    id: "placement-1",
    pageIndex: 0,
    normX: 0.5,
    normY: 0.75,
    normWidth: 0.25,
    normHeight: 0.1,
    signatureAssetId: portraitAsset.id,
  };

  const signedPortrait = await signPdfDocument(
    bytesToArrayBuffer(portraitBytes),
    [portraitPlacement],
    [portraitAsset],
  );

  assert("1-page portrait export returns PDF blob", signedPortrait.type === "application/pdf");

  const reloadedPortrait = await loadPdfDocument(await signedPortrait.arrayBuffer());
  assert("1-page portrait preserves page count", reloadedPortrait.getPageCount() === 1);

  const twoPageBytes = await createTestPdf([
    { width: 600, height: 800 },
    { width: 600, height: 800 },
  ]);
  const pageTwoPlacement: NormalizedPlacement = {
    id: "placement-2",
    pageIndex: 1,
    normX: 0.1,
    normY: 0.1,
    normWidth: 0.2,
    normHeight: 0.1,
    signatureAssetId: portraitAsset.id,
  };

  const signedTwoPage = await signPdfDocument(
    bytesToArrayBuffer(twoPageBytes),
    [pageTwoPlacement],
    [portraitAsset],
  );
  const reloadedTwoPage = await loadPdfDocument(await signedTwoPage.arrayBuffer());
  assert("2-page PDF stays 2 pages", reloadedTwoPage.getPageCount() === 2);

  const multiPlacement: NormalizedPlacement[] = [
    {
      id: "p1",
      pageIndex: 0,
      normX: 0.05,
      normY: 0.05,
      normWidth: 0.15,
      normHeight: 0.08,
      signatureAssetId: portraitAsset.id,
    },
    {
      id: "p2",
      pageIndex: 1,
      normX: 0.6,
      normY: 0.7,
      normWidth: 0.2,
      normHeight: 0.1,
      signatureAssetId: portraitAsset.id,
    },
  ];

  const signedMulti = await signPdfDocument(
    bytesToArrayBuffer(twoPageBytes),
    multiPlacement,
    [portraitAsset],
  );
  assert("multiple signatures export succeeds", signedMulti.size > 0);

  const landscapeBytes = await createTestPdf([{ width: 800, height: 600 }]);
  const signedLandscape = await signPdfDocument(
    bytesToArrayBuffer(landscapeBytes),
    [portraitPlacement],
    [portraitAsset],
  );
  assert("landscape export succeeds", signedLandscape.type === "application/pdf");

  const typedAsset = createSignatureAssetFromBytes(
    TINY_PNG,
    "typed-1",
    "type",
    "image/png",
  );
  const signedTyped = await signPdfDocument(
    bytesToArrayBuffer(portraitBytes),
    [{ ...portraitPlacement, signatureAssetId: typedAsset.id }],
    [typedAsset],
  );
  assert("typed signature asset export succeeds", signedTyped.size > 0);

  const uploadAsset = createSignatureAssetFromBytes(
    TINY_PNG,
    "upload-1",
    "upload",
    "image/png",
  );
  const signedUpload = await signPdfDocument(
    bytesToArrayBuffer(portraitBytes),
    [{ ...portraitPlacement, signatureAssetId: uploadAsset.id }],
    [uploadAsset],
  );
  assert("upload PNG signature export succeeds", signedUpload.size > 0);

  const jpgAsset = createSignatureAssetFromBytes(
    TINY_JPG,
    "jpg-1",
    "upload",
    "image/jpeg",
  );
  const signedJpg = await signPdfDocument(
    bytesToArrayBuffer(portraitBytes),
    [{ ...portraitPlacement, signatureAssetId: jpgAsset.id }],
    [jpgAsset],
  );
  assert("upload JPEG signature export succeeds", signedJpg.size > 0);

  let malformedFailed = false;
  try {
    await signPdfDocument(
      new ArrayBuffer(8),
      [portraitPlacement],
      [portraitAsset],
    );
  } catch (error) {
    malformedFailed = error instanceof SignPdfError && error.code === "CORRUPT_PDF";
  }
  assert("malformed PDF fails gracefully", malformedFailed);

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
