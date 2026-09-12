/**
 * Repeat / Tile mode verification for Watermark PDF.
 * Run: npx tsx scripts/verify-watermark-pdf-repeat-tile.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  PDFArray,
  PDFDocument,
  PDFRawStream,
  PDFRef,
  decodePDFRawStream,
} from "pdf-lib";
import {
  computeImagePreviewOverlayStyles,
  computeRepeatTileCenters,
  computeTextPreviewOverlayStyles,
  computeTextWatermarkAnchor,
  createDefaultImageWatermarkOptions,
  createDefaultTextWatermarkOptions,
  createDefaultWorkspaceSettings,
  createWatermarkPageGeometry,
  DEFAULT_WATERMARK_PLACEMENT_MODE,
  DEFAULT_WATERMARK_REPEAT_PATTERN,
  enumerateImageWatermarkAnchors,
  enumerateTextWatermarkAnchors,
  getRepeatPatternTileCount,
  isWatermarkRepeatPattern,
  parseRepeatPattern,
  validateTextWatermarkOptions,
  watermarkPdfDocument,
  type WatermarkPageEntry,
  type WatermarkRepeatPattern,
} from "../lib/tools/watermark-pdf";

const root = process.cwd();

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

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function toArrayBuffer(bytes: Uint8Array): ArrayBuffer {
  return bytes.buffer.slice(
    bytes.byteOffset,
    bytes.byteOffset + bytes.byteLength,
  ) as ArrayBuffer;
}

function countOperator(content: string, operator: string): number {
  const re = new RegExp(`\\b${operator}\\b`, "g");
  return (content.match(re) ?? []).length;
}

async function getPageContent(
  bytes: Uint8Array,
  pageIndex: number,
): Promise<string> {
  const pdf = await PDFDocument.load(bytes);
  const page = pdf.getPage(pageIndex);
  const contents = page.node.Contents();
  if (!contents) return "";

  const refs: PDFRef[] = [];
  if (contents instanceof PDFRef) {
    refs.push(contents);
  } else if (contents instanceof PDFArray) {
    for (let i = 0; i < contents.size(); i += 1) {
      const item = contents.get(i);
      if (item instanceof PDFRef) refs.push(item);
    }
  }

  const chunks: string[] = [];
  for (const ref of refs) {
    const stream = pdf.context.lookup(ref);
    if (stream instanceof PDFRawStream) {
      const decoded = decodePDFRawStream(stream);
      chunks.push(Buffer.from(decoded.decode()).toString("latin1"));
    }
  }
  return chunks.join("\n");
}

const TINY_PNG = Uint8Array.from(
  atob(
    "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mP8z8BQDwAEhQGAhKmMIQAAAABJRU5ErkJggg==",
  ),
  (char) => char.charCodeAt(0),
);

async function createBlankPdf(pageCount = 1): Promise<Uint8Array> {
  const pdf = await PDFDocument.create();
  for (let i = 0; i < pageCount; i += 1) {
    pdf.addPage([612, 792]);
  }
  return pdf.save();
}

function makePageEntry(): WatermarkPageEntry {
  return {
    sourcePageIndex: 0,
    intrinsicRotation: 0,
    mediaBox: { x: 0, y: 0, width: 612, height: 792 },
    cropBox: { x: 0, y: 0, width: 612, height: 792 },
    visibleBox: { x: 0, y: 0, width: 612, height: 792 },
  };
}

async function run() {
  console.log("\nWatermark PDF Repeat / Tile verification\n");

  const patterns: WatermarkRepeatPattern[] = ["2x2", "3x3", "4x4"];
  const expectedCounts = { "2x2": 4, "3x3": 9, "4x4": 16 } as const;

  // A. pattern counts
  for (const pattern of patterns) {
    const { rows, cols } = parseRepeatPattern(pattern);
    const centers = computeRepeatTileCenters(612, 792, rows, cols, 36);
    assert(
      `A ${pattern} returns ${expectedCounts[pattern]} positions`,
      centers.length === expectedCounts[pattern] &&
        getRepeatPatternTileCount(pattern) === expectedCounts[pattern],
    );
  }

  // B. coordinates inside bounds, not on edges, deterministic order
  {
    const margin = 36;
    const width = 612;
    const height = 792;
    const centers = computeRepeatTileCenters(width, height, 3, 3, margin);
    const allInside = centers.every(
      (c) =>
        c.centerX > margin &&
        c.centerX < width - margin &&
        c.centerY > margin &&
        c.centerY < height - margin,
    );
    assert("B all centers inside usable bounds", allInside);

    const notOnEdge = centers.every(
      (c) =>
        c.centerX !== 0 &&
        c.centerX !== width &&
        c.centerY !== 0 &&
        c.centerY !== height,
    );
    assert("B no tile center on page edge", notOnEdge);

    const again = computeRepeatTileCenters(width, height, 3, 3, margin);
    assert(
      "B grid order deterministic",
      JSON.stringify(centers) === JSON.stringify(again),
    );

    assert(
      "B first tile is top-left cell",
      centers[0].centerY < centers[centers.length - 1].centerY &&
        centers[0].centerX < centers[2].centerX,
    );
  }

  // C. preview + export share tile-geometry primitive (source)
  {
    const previewUi = read("lib/tools/watermark-pdf/preview-ui.ts");
    const exportEngine = read("lib/tools/watermark-pdf/watermark-pdf.ts");
    const tileGeom = read("lib/tools/watermark-pdf/tile-geometry.ts");

    assert(
      "C tile-geometry defines computeRepeatTileCenters",
      tileGeom.includes("export function computeRepeatTileCenters"),
    );
    assert(
      "C preview imports enumerate*WatermarkAnchors",
      previewUi.includes("enumerateTextWatermarkAnchors") &&
        previewUi.includes("enumerateImageWatermarkAnchors"),
    );
    assert(
      "C export imports enumerate*WatermarkAnchors",
      exportEngine.includes("enumerateTextWatermarkAnchors") &&
        exportEngine.includes("enumerateImageWatermarkAnchors"),
    );
    assert(
      "C preview has no duplicate tile center math",
      !previewUi.includes("function computeRepeatTileCenters"),
    );
    assert(
      "C export does not redefine tile centers",
      !exportEngine.includes("function computeRepeatTileCenters"),
    );

    const pageEntry = makePageEntry();
    const geometry = createWatermarkPageGeometry(
      pageEntry.mediaBox,
      pageEntry.cropBox,
      pageEntry.intrinsicRotation,
    );
    const textAnchors = enumerateTextWatermarkAnchors(geometry, {
      placementMode: "repeat",
      repeatPattern: "3x3",
      position: "center",
      margin: 36,
      textWidth: 100,
      fontSize: 24,
    });
    const previewStyles = computeTextPreviewOverlayStyles({
      pageEntry,
      position: "center",
      margin: 36,
      fontSize: 24,
      textWidth: 100,
      color: "#666666",
      opacity: 0.3,
      rotationDegrees: 45,
      bold: false,
      cssHeight: 792,
      placementMode: "repeat",
      repeatPattern: "3x3",
    });
    assert(
      "C preview overlay count matches enumerate anchors",
      textAnchors.length === 9 && previewStyles.length === 9,
    );

    const imageAnchors = enumerateImageWatermarkAnchors(geometry, {
      placementMode: "repeat",
      repeatPattern: "2x2",
      position: "center",
      margin: 36,
      imageWidth: 80,
      imageHeight: 40,
      rotationDegrees: 0,
    });
    const imageStyles = computeImagePreviewOverlayStyles({
      pageEntry,
      position: "center",
      margin: 36,
      intrinsicWidth: 80,
      intrinsicHeight: 40,
      relativeWidthRatio: 80 / 612,
      opacity: 0.4,
      rotationDegrees: 0,
      placementMode: "repeat",
      repeatPattern: "2x2",
    });
    assert(
      "C image preview overlay count matches enumerate anchors",
      imageAnchors.length === 4 && imageStyles.length === 4,
    );
  }

  // D. text export draw count
  {
    const blank = await createBlankPdf(1);
    const result = await watermarkPdfDocument(
      toArrayBuffer(blank),
      createDefaultTextWatermarkOptions({
        text: "TILEMARK",
        fontSize: 18,
        rotationDegrees: 0,
        placementMode: "repeat",
        repeatPattern: "3x3",
      }),
      "blank.pdf",
    );
    const content = await getPageContent(result.bytes, 0);
    const draws = countOperator(content, "Tj");
    assert(
      "D repeat text writes 9 draw ops/page",
      draws === 9,
      `got ${draws}`,
    );
  }

  // E. image export draw count
  {
    const blank = await createBlankPdf(1);
    const result = await watermarkPdfDocument(
      toArrayBuffer(blank),
      createDefaultImageWatermarkOptions(TINY_PNG, {
        relativeWidthRatio: 0.08,
        placementMode: "repeat",
        repeatPattern: "2x2",
        rotationDegrees: 0,
      }),
      "blank.pdf",
    );
    const content = await getPageContent(result.bytes, 0);
    const doCount = countOperator(content, "Do");
    assert(
      "E repeat image writes 4 draw ops/page",
      doCount === 4,
      `got ${doCount}`,
    );
  }

  // F. page selection — non-selected pages get zero repeated draws
  {
    const blank = await createBlankPdf(3);
    const result = await watermarkPdfDocument(
      toArrayBuffer(blank),
      createDefaultTextWatermarkOptions({
        text: "PAGESEL",
        fontSize: 16,
        rotationDegrees: 0,
        placementMode: "repeat",
        repeatPattern: "2x2",
        allPages: false,
        pageRangeInput: "2",
      }),
      "multi.pdf",
    );

    const out = await PDFDocument.load(result.bytes);
    assert("F output still has 3 pages", out.getPageCount() === 3);

    const page0 = countOperator(await getPageContent(result.bytes, 0), "Tj");
    const page1 = countOperator(await getPageContent(result.bytes, 1), "Tj");
    const page2 = countOperator(await getPageContent(result.bytes, 2), "Tj");
    assert(
      "F non-selected pages get zero repeated watermark draws",
      page0 === 0 && page1 === 4 && page2 === 0,
      `got [${page0}, ${page1}, ${page2}]`,
    );
  }

  // G. single mode regression — geometry path untouched
  {
    const geometrySource = read("lib/tools/watermark-pdf/geometry.ts");
    assert(
      "G geometry still exports computeTextWatermarkAnchor",
      geometrySource.includes("export function computeTextWatermarkAnchor"),
    );
    assert(
      "G geometry does not import tile-geometry",
      !geometrySource.includes("tile-geometry"),
    );

    const geometry = createWatermarkPageGeometry(
      { x: 0, y: 0, width: 612, height: 792 },
      { x: 0, y: 0, width: 612, height: 792 },
      0,
    );
    const single = enumerateTextWatermarkAnchors(geometry, {
      placementMode: "single",
      position: "center",
      margin: 36,
      textWidth: 100,
      fontSize: 48,
    });
    const classic = computeTextWatermarkAnchor(
      geometry,
      "center",
      36,
      100,
      48,
    );
    assert(
      "G single enumerate matches classic anchor",
      single.length === 1 &&
        single[0].localX === classic.localX &&
        single[0].localY === classic.localY,
    );

    const blank = await createBlankPdf(1);
    const singleOut = await watermarkPdfDocument(
      toArrayBuffer(blank),
      createDefaultTextWatermarkOptions({
        text: "SINGLE",
        placementMode: "single",
        fontSize: 24,
        rotationDegrees: 0,
      }),
      "blank.pdf",
    );
    const singleDraws = countOperator(
      await getPageContent(singleOut.bytes, 0),
      "Tj",
    );
    assert("G single mode still one draw", singleDraws === 1);
  }

  // H. type safety / invalid patterns
  {
    assert("H 2x2 is valid pattern", isWatermarkRepeatPattern("2x2"));
    assert("H 5x5 rejected", !isWatermarkRepeatPattern("5x5"));
    assert("H empty rejected", !isWatermarkRepeatPattern(""));

    const validated = validateTextWatermarkOptions(
      createDefaultTextWatermarkOptions({}),
      1,
    );
    assert(
      "H omitted placement defaults to single",
      validated.placementMode === DEFAULT_WATERMARK_PLACEMENT_MODE,
    );
    assert(
      "H omitted pattern defaults to 3x3",
      validated.repeatPattern === DEFAULT_WATERMARK_REPEAT_PATTERN,
    );

    let threw = false;
    try {
      validateTextWatermarkOptions(
        createDefaultTextWatermarkOptions({
          // @ts-expect-error intentional invalid pattern
          repeatPattern: "5x5",
          placementMode: "repeat",
        }),
        1,
      );
    } catch {
      threw = true;
    }
    assert("H invalid repeat pattern rejected", threw);

    const defaults = createDefaultWorkspaceSettings();
    assert(
      "H workspace default placement is single",
      defaults.placementMode === "single",
    );
    assert(
      "H workspace default pattern is 3x3 (ready when repeat enabled)",
      defaults.repeatPattern === "3x3",
    );
  }

  // UI wiring smoke
  {
    const tool = read(
      "components/tools/watermark-pdf-client/WatermarkPdfClientTool.tsx",
    );
    const preview = read(
      "components/tools/watermark-pdf-client/WatermarkPdfPreview.tsx",
    );
    assert(
      "UI placement mode control present",
      tool.includes("data-watermark-placement-mode"),
    );
    assert(
      "UI pattern control present",
      tool.includes("data-watermark-repeat-pattern"),
    );
    assert(
      "UI preview receives placementMode",
      preview.includes("placementMode") && preview.includes("repeatPattern"),
    );
    assert(
      "UI maps multiple tile overlays",
      preview.includes("textOverlayStyles.map") &&
        preview.includes("imageOverlayStyles.map"),
    );
  }

  // 4x4 text export count
  {
    const blank = await createBlankPdf(1);
    const result = await watermarkPdfDocument(
      toArrayBuffer(blank),
      createDefaultTextWatermarkOptions({
        text: "GRID16",
        fontSize: 12,
        rotationDegrees: 0,
        placementMode: "repeat",
        repeatPattern: "4x4",
      }),
      "blank.pdf",
    );
    const draws = countOperator(await getPageContent(result.bytes, 0), "Tj");
    assert("A/D 4x4 text writes 16 draws", draws === 16, `got ${draws}`);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) {
    process.exit(1);
  }
}

void run();
