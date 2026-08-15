/**
 * Image watermark top-position tests (Phase 124C-FIX4).
 * Run: npx tsx scripts/verify-watermark-pdf-fix4-image-top-positions.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  computeImageDrawSize,
  computeImagePreviewOverlayStyle,
  computeImageWatermarkAnchor,
  computeRotatedImageExtents,
  createWatermarkPageGeometry,
  visibleLocalPointToPdf,
} from "../lib/tools/watermark-pdf";
import type { PdfBox } from "../lib/tools/crop-pdf/types";
import type { WatermarkPageEntry, WatermarkPosition } from "../lib/tools/watermark-pdf/types";

const root = process.cwd();
const MARGIN = 36;
const INTRINSIC_WIDTH = 200;
const INTRINSIC_HEIGHT = 100;
const PAGE_WIDTH = 600;
const PAGE_HEIGHT = 800;

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

function approxEqual(a: number, b: number, epsilon = 0.5): boolean {
  return Math.abs(a - b) <= epsilon;
}

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function makeGeometry(
  rotation: 0 | 90 | 180 | 270,
  cropBox?: PdfBox,
  mediaOrigin?: { x: number; y: number },
) {
  const ox = mediaOrigin?.x ?? 0;
  const oy = mediaOrigin?.y ?? 0;
  const mediaBox: PdfBox = { x: ox, y: oy, width: PAGE_WIDTH, height: PAGE_HEIGHT };
  return createWatermarkPageGeometry(mediaBox, cropBox ?? mediaBox, rotation);
}

function makePageEntry(
  rotation: 0 | 90 | 180 | 270,
  cropBox?: PdfBox,
): WatermarkPageEntry {
  const ox = cropBox?.x ?? 0;
  const oy = cropBox?.y ?? 0;
  const width = cropBox?.width ?? PAGE_WIDTH;
  const height = cropBox?.height ?? PAGE_HEIGHT;
  return {
    sourcePageIndex: 0,
    intrinsicRotation: rotation,
    mediaBox: { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT },
    cropBox: cropBox ?? { x: 0, y: 0, width: PAGE_WIDTH, height: PAGE_HEIGHT },
    visibleBox: { x: ox, y: oy, width, height },
  };
}

interface VisualBounds {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

function imageVisualBounds(
  geometry: ReturnType<typeof makeGeometry>,
  position: WatermarkPosition,
  imageWidth: number,
  imageHeight: number,
  rotationDegrees = 0,
): VisualBounds {
  const anchor = computeImageWatermarkAnchor(
    geometry,
    position,
    MARGIN,
    imageWidth,
    imageHeight,
    rotationDegrees,
  );
  const extents = computeRotatedImageExtents(
    imageWidth,
    imageHeight,
    rotationDegrees,
  );

  return {
    left: anchor.localX + extents.minX,
    top: anchor.localY + extents.minY,
    right: anchor.localX + extents.maxX,
    bottom: anchor.localY + extents.maxY,
  };
}

function previewVisualBounds(
  pageEntry: WatermarkPageEntry,
  position: WatermarkPosition,
  relativeWidthRatio: number,
  rotationDegrees = 0,
): VisualBounds {
  const geometry = createWatermarkPageGeometry(
    pageEntry.mediaBox,
    pageEntry.cropBox,
    pageEntry.intrinsicRotation,
  );
  const { width, height } = computeImageDrawSize(
    geometry,
    INTRINSIC_WIDTH,
    INTRINSIC_HEIGHT,
    relativeWidthRatio,
  );
  const style = computeImagePreviewOverlayStyle({
    pageEntry,
    position,
    margin: MARGIN,
    intrinsicWidth: INTRINSIC_WIDTH,
    intrinsicHeight: INTRINSIC_HEIGHT,
    relativeWidthRatio,
    opacity: 0.3,
    rotationDegrees,
  });

  const left = parseFloat(style.left) / 100 * geometry.visualWidth;
  const boxHeight = parseFloat(style.height) / 100 * geometry.visualHeight;

  if (style.top !== undefined) {
    const top = parseFloat(style.top) / 100 * geometry.visualHeight;
    return {
      left,
      top,
      right: left + width,
      bottom: top + boxHeight,
    };
  }

  const bottomOffset = parseFloat(style.bottom ?? "0") / 100 * geometry.visualHeight;
  const bottom = geometry.visualHeight - bottomOffset;
  return {
    left,
    top: bottom - boxHeight,
    right: left + width,
    bottom,
  };
}

function assertTopBounds(
  name: string,
  bounds: VisualBounds,
  geometry: ReturnType<typeof makeGeometry>,
  horizontal: "left" | "center" | "right",
) {
  assert(
    `${name} top edge at margin`,
    approxEqual(bounds.top, MARGIN),
    `top=${bounds.top}, expected=${MARGIN}`,
  );

  if (horizontal === "left") {
    assert(
      `${name} left edge at margin`,
      approxEqual(bounds.left, MARGIN),
      `left=${bounds.left}, expected=${MARGIN}`,
    );
  } else if (horizontal === "center") {
    assert(
      `${name} horizontally centered`,
      approxEqual(
        bounds.left + (bounds.right - bounds.left) / 2,
        geometry.visualWidth / 2,
      ),
      `centerX=${bounds.left + (bounds.right - bounds.left) / 2}, expected=${geometry.visualWidth / 2}`,
    );
  } else {
    assert(
      `${name} right edge at margin`,
      approxEqual(bounds.right, geometry.visualWidth - MARGIN),
      `right=${bounds.right}, expected=${geometry.visualWidth - MARGIN}`,
    );
  }
}

function assertBottomBounds(
  name: string,
  bounds: VisualBounds,
  geometry: ReturnType<typeof makeGeometry>,
  horizontal: "left" | "center" | "right",
) {
  assert(
    `${name} bottom edge at margin`,
    approxEqual(bounds.bottom, geometry.visualHeight - MARGIN),
    `bottom=${bounds.bottom}, expected=${geometry.visualHeight - MARGIN}`,
  );

  if (horizontal === "left") {
    assert(
      `${name} left edge at margin`,
      approxEqual(bounds.left, MARGIN),
      `left=${bounds.left}, expected=${MARGIN}`,
    );
  } else if (horizontal === "center") {
    assert(
      `${name} horizontally centered`,
      approxEqual(
        bounds.left + (bounds.right - bounds.left) / 2,
        geometry.visualWidth / 2,
      ),
      `centerX=${bounds.left + (bounds.right - bounds.left) / 2}, expected=${geometry.visualWidth / 2}`,
    );
  } else {
    assert(
      `${name} right edge at margin`,
      approxEqual(bounds.right, geometry.visualWidth - MARGIN),
      `right=${bounds.right}, expected=${geometry.visualWidth - MARGIN}`,
    );
  }
}

function assertCenterBounds(
  name: string,
  bounds: VisualBounds,
  geometry: ReturnType<typeof makeGeometry>,
) {
  const centerX = bounds.left + (bounds.right - bounds.left) / 2;
  const centerY = bounds.top + (bounds.bottom - bounds.top) / 2;
  assert(
    `${name} centered horizontally`,
    approxEqual(centerX, geometry.visualWidth / 2),
    `centerX=${centerX}, expected=${geometry.visualWidth / 2}`,
  );
  assert(
    `${name} centered vertically`,
    approxEqual(centerY, geometry.visualHeight / 2),
    `centerY=${centerY}, expected=${geometry.visualHeight / 2}`,
  );
}

function imageSizeForScale(relativeWidthRatio: number, geometry = makeGeometry(0)) {
  return computeImageDrawSize(
    geometry,
    INTRINSIC_WIDTH,
    INTRINSIC_HEIGHT,
    relativeWidthRatio,
  );
}

async function run() {
  console.log("\nWatermark PDF FIX4 image top-position verification (Phase 124C-FIX4)\n");

  const geometry = makeGeometry(0);
  const pageEntry = makePageEntry(0);
  const scale25 = 0.25;

  const { width: imageWidth, height: imageHeight } = imageSizeForScale(scale25);

  // A–C: top preview
  const topLeftPreview = previewVisualBounds(pageEntry, "top-left", scale25);
  assertTopBounds("A image top-left preview", topLeftPreview, geometry, "left");

  const topCenterPreview = previewVisualBounds(pageEntry, "top-center", scale25);
  assertTopBounds("B image top-center preview", topCenterPreview, geometry, "center");

  const topRightPreview = previewVisualBounds(pageEntry, "top-right", scale25);
  assertTopBounds("C image top-right preview", topRightPreview, geometry, "right");

  // D–F: top export (engine bounds used by pdf-lib drawImage anchor)
  const topLeftExport = imageVisualBounds(geometry, "top-left", imageWidth, imageHeight);
  assertTopBounds("D image top-left export", topLeftExport, geometry, "left");

  const topCenterExport = imageVisualBounds(geometry, "top-center", imageWidth, imageHeight);
  assertTopBounds("E image top-center export", topCenterExport, geometry, "center");

  const topRightExport = imageVisualBounds(geometry, "top-right", imageWidth, imageHeight);
  assertTopBounds("F image top-right export", topRightExport, geometry, "right");

  // G–J: center/bottom regression
  assertCenterBounds(
    "G center unchanged",
    imageVisualBounds(geometry, "center", imageWidth, imageHeight),
    geometry,
  );
  assertBottomBounds(
    "H bottom-left unchanged",
    imageVisualBounds(geometry, "bottom-left", imageWidth, imageHeight),
    geometry,
    "left",
  );
  assertBottomBounds(
    "I bottom-center unchanged",
    imageVisualBounds(geometry, "bottom-center", imageWidth, imageHeight),
    geometry,
    "center",
  );
  assertBottomBounds(
    "J bottom-right unchanged",
    imageVisualBounds(geometry, "bottom-right", imageWidth, imageHeight),
    geometry,
    "right",
  );

  // K–M: 45° top positions
  const rot45 = 45;
  assertTopBounds(
    "K 45° top-left",
    imageVisualBounds(geometry, "top-left", imageWidth, imageHeight, rot45),
    geometry,
    "left",
  );
  assertTopBounds(
    "L 45° top-center",
    imageVisualBounds(geometry, "top-center", imageWidth, imageHeight, rot45),
    geometry,
    "center",
  );
  assertTopBounds(
    "M 45° top-right",
    imageVisualBounds(geometry, "top-right", imageWidth, imageHeight, rot45),
    geometry,
    "right",
  );

  // N–P: source page rotation
  const geo90 = makeGeometry(90);
  assertTopBounds(
    "N 90° source page top-left",
    imageVisualBounds(
      geo90,
      "top-left",
      imageSizeForScale(scale25, geo90).width,
      imageSizeForScale(scale25, geo90).height,
    ),
    geo90,
    "left",
  );

  const geo180 = makeGeometry(180);
  assertTopBounds(
    "O 180° source page top-center",
    imageVisualBounds(
      geo180,
      "top-center",
      imageSizeForScale(scale25, geo180).width,
      imageSizeForScale(scale25, geo180).height,
    ),
    geo180,
    "center",
  );

  const geo270 = makeGeometry(270);
  assertTopBounds(
    "P 270° source page top-right",
    imageVisualBounds(
      geo270,
      "top-right",
      imageSizeForScale(scale25, geo270).width,
      imageSizeForScale(scale25, geo270).height,
    ),
    geo270,
    "right",
  );

  // Q–S: offset CropBox
  const offsetCrop: PdfBox = { x: 50, y: 75, width: 500, height: 650 };
  const geoOffset = makeGeometry(0, offsetCrop);
  const pageOffset = makePageEntry(0, offsetCrop);
  const offsetSize = imageSizeForScale(scale25, geoOffset);

  assertTopBounds(
    "Q offset CropBox top-left",
    imageVisualBounds(geoOffset, "top-left", offsetSize.width, offsetSize.height),
    geoOffset,
    "left",
  );
  assertTopBounds(
    "R offset CropBox top-center",
    imageVisualBounds(geoOffset, "top-center", offsetSize.width, offsetSize.height),
    geoOffset,
    "center",
  );
  assertTopBounds(
    "S offset CropBox top-right",
    imageVisualBounds(geoOffset, "top-right", offsetSize.width, offsetSize.height),
    geoOffset,
    "right",
  );

  void pageOffset;

  // T–V: image scales
  for (const [label, ratio] of [
    ["T image scale 10%", 0.1],
    ["U image scale 25%", 0.25],
    ["V image scale 50%", 0.5],
  ] as const) {
    const size = imageSizeForScale(ratio);
    assertTopBounds(
      label,
      imageVisualBounds(geometry, "top-center", size.width, size.height),
      geometry,
      "center",
    );
  }

  // Preview/export parity for top-center
  const previewBounds = previewVisualBounds(pageEntry, "top-center", scale25);
  const exportBounds = imageVisualBounds(geometry, "top-center", imageWidth, imageHeight);
  assert(
    "Preview/export top-center parity",
    approxEqual(previewBounds.top, exportBounds.top) &&
      approxEqual(previewBounds.left, exportBounds.left),
    `preview=(${previewBounds.left},${previewBounds.top}) export=(${exportBounds.left},${exportBounds.top})`,
  );

  // Export anchor maps to PDF bottom-left with visual top at margin
  const anchor = computeImageWatermarkAnchor(
    geometry,
    "top-left",
    MARGIN,
    imageWidth,
    imageHeight,
  );
  const pdfPoint = visibleLocalPointToPdf(anchor.localX, anchor.localY, geometry);
  assert(
    "Export PDF anchor converts for top-left",
    approxEqual(pdfPoint.y + imageHeight, geometry.visibleBox.y + geometry.visibleBox.height - MARGIN),
    `pdfY=${pdfPoint.y}, expected bottom-left y=${geometry.visibleBox.y + geometry.visibleBox.height - MARGIN - imageHeight}`,
  );

  // FIX2 regression markers
  const previewSource = read("components/tools/watermark-pdf-client/WatermarkPdfPreview.tsx");
  assert(
    "FIX2 blinking regression",
    previewSource.includes("imageOverlayStyle = useMemo") &&
      !previewSource.match(/useEffect\([\s\S]*?imagePreviewUrl[\s\S]*?loadPdfJsDocument/),
  );

  // FIX3 regression markers
  const toolSource = read("components/tools/watermark-pdf-client/WatermarkPdfClientTool.tsx");
  assert(
    "FIX3 image input regression",
    toolSource.includes('WATERMARK_IMAGE_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg"') &&
      toolSource.includes('inputId="watermark-source-pdf-input"') &&
      toolSource.includes('id="watermark-image-input"'),
  );

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
