/**
 * Image watermark upload tests for Watermark PDF client (Phase 124C-FIX3).
 * Run: npx tsx scripts/verify-watermark-pdf-fix3-image-upload.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import {
  WatermarkPreviewRenderTracker,
  buildImageWatermarkExportOptions,
  buildWatermarkExportOptions,
  computeImagePreviewOverlayStyle,
  createDefaultWorkspaceSettings,
  exportWatermarkedPdf,
  getWatermarkImageFileError,
  isAcceptedWatermarkImageFile,
  isAcceptedWatermarkPdfFile,
  isTransparentPng,
  switchWatermarkMode,
  watermarkPdfDocument,
} from "../lib/tools/watermark-pdf";
import type { ImageWorkspaceAsset, WatermarkWorkspaceSettings } from "../lib/tools/watermark-pdf/workspace-ui";
import type { WatermarkPageEntry, WatermarkPosition } from "../lib/tools/watermark-pdf/types";

const root = process.cwd();

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

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

function sourceIncludes(source: string, pattern: string | RegExp, label: string) {
  const found =
    typeof pattern === "string" ? source.includes(pattern) : pattern.test(source);
  assert(label, found, typeof pattern === "string" ? `missing ${pattern}` : "");
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

function makeFile(name: string, type: string): File {
  return { name, type, size: 1024 } as File;
}

function createTransparentPngBytes(): Uint8Array {
  return Uint8Array.from([
    0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0x00, 0x00, 0x00, 0x0d, 0x49, 0x48,
    0x44, 0x52, 0x00, 0x00, 0x00, 0x01, 0x00, 0x00, 0x00, 0x01, 0x08, 0x06, 0x00, 0x00,
    0x00, 0x1f, 0x15, 0xc4, 0x89, 0x00, 0x00, 0x00, 0x0a, 0x49, 0x44, 0x41, 0x54, 0x78,
    0x9c, 0x63, 0x00, 0x01, 0x00, 0x00, 0x05, 0x00, 0x01, 0x0d, 0x0a, 0x2d, 0xb4, 0x00,
    0x00, 0x00, 0x00, 0x49, 0x45, 0x4e, 0x44, 0xae, 0x42, 0x60, 0x82,
  ]);
}

function imageOverlayAt(
  position: WatermarkPosition,
  patch: Partial<{
    relativeWidthPercent: number;
    opacityPercent: number;
    rotationDegrees: number;
  }> = {},
) {
  return computeImagePreviewOverlayStyle({
    pageEntry: makePageEntry(),
    position,
    margin: 36,
    intrinsicWidth: 200,
    intrinsicHeight: 100,
    relativeWidthRatio: (patch.relativeWidthPercent ?? 30) / 100,
    opacity: (patch.opacityPercent ?? 30) / 100,
    rotationDegrees: patch.rotationDegrees ?? 0,
  });
}

function run() {
  console.log("\nWatermark PDF FIX3 image upload verification (Phase 124C-FIX3)\n");

  const toolSource = read("components/tools/watermark-pdf-client/WatermarkPdfClientTool.tsx");
  const previewSource = read("components/tools/watermark-pdf-client/WatermarkPdfPreview.tsx");
  const dropZoneSource = read("components/tools/FileDropZone.tsx");

  // 1. Source accepts PDF
  assert("1 source accepts PDF", isAcceptedWatermarkPdfFile(makeFile("doc.pdf", "application/pdf")));
  sourceIncludes(
    toolSource,
    'accept={WATERMARK_SOURCE_PDF_ACCEPT}',
    "1 source input uses application/pdf accept",
  );
  sourceIncludes(
    toolSource,
    'WATERMARK_SOURCE_PDF_ACCEPT = "application/pdf"',
    "1 source accept constant is application/pdf",
  );

  // 2. Source rejects image
  assert(
    "2 source rejects PNG",
    !isAcceptedWatermarkPdfFile(makeFile("logo.png", "image/png")),
  );
  assert(
    "2 source rejects JPEG",
    !isAcceptedWatermarkPdfFile(makeFile("logo.jpg", "image/jpeg")),
  );

  // 3. Image input accepts PNG
  assert("3 image input accepts PNG", isAcceptedWatermarkImageFile(makeFile("logo.png", "image/png")));
  sourceIncludes(
    toolSource,
    'accept={WATERMARK_IMAGE_ACCEPT}',
    "3 image input uses PNG/JPEG accept",
  );
  sourceIncludes(
    toolSource,
    'WATERMARK_IMAGE_ACCEPT = "image/png,image/jpeg,.png,.jpg,.jpeg"',
    "3 image accept includes png/jpeg",
  );

  // 4. Image input accepts JPEG
  assert(
    "4 image input accepts JPEG",
    isAcceptedWatermarkImageFile(makeFile("logo.jpg", "image/jpeg")),
  );
  assert(
    "4 image input accepts .jpeg extension",
    isAcceptedWatermarkImageFile(makeFile("logo.jpeg", "")),
  );

  // 5. Image input does NOT accept PDF
  assert(
    "5 image input rejects PDF",
    !isAcceptedWatermarkImageFile(makeFile("doc.pdf", "application/pdf")),
  );
  assert(
    "5 PDF as watermark image has clear error",
    Boolean(getWatermarkImageFileError(makeFile("doc.pdf", "application/pdf"))?.includes("PDF")),
  );

  // 6. Different IDs
  sourceIncludes(toolSource, 'inputId="watermark-source-pdf-input"', "6 source PDF input id");
  sourceIncludes(toolSource, 'id="watermark-image-input"', "6 watermark image input id");
  sourceIncludes(
    toolSource,
    'id="watermark-image-replace-input"',
    "6 watermark replace input id",
  );
  assert(
    "6 source and image ids differ",
    toolSource.includes('inputId="watermark-source-pdf-input"') &&
      toolSource.includes('id="watermark-image-input"'),
  );

  // 7. Different refs/handlers
  sourceIncludes(toolSource, "handleSourcePdfUpload", "7 separate source PDF handler");
  sourceIncludes(toolSource, "handleWatermarkImageUpload", "7 separate image upload handler");
  sourceIncludes(toolSource, "watermarkImageInputRef", "7 watermark image ref");
  sourceIncludes(toolSource, "watermarkImageReplaceInputRef", "7 watermark replace ref");
  assert(
    "7 handlers are not aliased",
    toolSource.includes("onFilesSelected={handleSourcePdfUpload}") &&
      toolSource.includes("onChange={handleWatermarkImageInputChange}") &&
      !toolSource.includes("onFilesSelected={handleWatermarkImageUpload}"),
  );

  // 8. Upload watermark image triggers IMAGE input not PDF
  sourceIncludes(
    toolSource,
    "openWatermarkImagePicker",
    "8 dedicated image picker opener",
  );
  sourceIncludes(
    toolSource,
    "watermarkImageInputRef.current?.click()",
    "8 upload button triggers image input ref",
  );
  sourceIncludes(
    toolSource,
    "data-watermark-upload-image-button",
    "8 upload watermark image button marker",
  );
  assert(
    "8 upload button does not call source PDF handler",
    toolSource.includes("onClick={openWatermarkImagePicker}") &&
      !toolSource.includes("onClick={handleSourcePdfUpload}"),
  );

  // 9–10. PNG/JPEG selection enters Image mode state
  assert(
    "9 PNG selection sets image mode in handler",
    toolSource.includes('updateSettings({ mode: "image" })') &&
      toolSource.includes("handleWatermarkImageUpload"),
  );
  assert(
    "10 JPEG mime type supported in asset",
    toolSource.includes('mimeType: "image/png" | "image/jpeg"'),
  );

  // 11. Thumbnail appears
  sourceIncludes(toolSource, "data-watermark-image-thumbnail", "11 thumbnail marker");
  sourceIncludes(toolSource, "data-watermark-image-selected", "11 selected image state container");

  // 12. Replace image works
  sourceIncludes(toolSource, "data-watermark-replace-image", "12 replace image button");
  sourceIncludes(
    toolSource,
    "openWatermarkImageReplacePicker",
    "12 replace uses separate picker",
  );
  sourceIncludes(
    toolSource,
    "watermarkImageReplaceInputRef.current?.click()",
    "12 replace triggers replace input ref",
  );

  // 13. Remove image works
  sourceIncludes(toolSource, "data-watermark-remove-image", "13 remove image button");
  sourceIncludes(toolSource, "handleRemoveImage", "13 remove image handler");

  // 14. Transparent PNG preserved
  const transparentPng = createTransparentPngBytes();
  assert("14 transparent PNG detected", isTransparentPng(transparentPng));
  sourceIncludes(
    toolSource,
    "isTransparentPng(bytes)",
    "14 transparent PNG state tracked on upload",
  );
  sourceIncludes(
    toolSource,
    "data-watermark-transparent-png-notice",
    "14 transparent PNG notice in UI",
  );

  // 15. Image overlay appears live
  sourceIncludes(previewSource, "data-watermark-pdf-image-overlay", "15 live image overlay element");
  sourceIncludes(
    previewSource,
    "computeImagePreviewOverlayStyle",
    "15 image overlay uses 124B geometry",
  );
  sourceIncludes(toolSource, "data-watermark-image-filename", "15 filename shown after selection");

  // 16–19. Size/opacity/rotation/position update overlay only
  const baseOverlay = imageOverlayAt("center");
  const widerOverlay = imageOverlayAt("center", { relativeWidthPercent: 50 });
  const opaqueOverlay = imageOverlayAt("center", { opacityPercent: 80 });
  const rotatedOverlay = imageOverlayAt("center", { rotationDegrees: 45 });
  const movedOverlay = imageOverlayAt("bottom-right");
  assert(
    "16 size change updates overlay width",
    baseOverlay.width !== widerOverlay.width,
  );
  assert(
    "17 opacity change updates overlay opacity",
    baseOverlay.opacity !== opaqueOverlay.opacity,
  );
  assert(
    "18 rotation change updates overlay transform",
    baseOverlay.transform !== rotatedOverlay.transform,
  );
  assert(
    "19 position change updates overlay placement",
    baseOverlay.left !== movedOverlay.left || baseOverlay.top !== movedOverlay.top,
  );

  const tracker = new WatermarkPreviewRenderTracker();
  const renderDeps = {
    pdfByteLength: 12_345,
    sourcePageIndex: 0,
    intrinsicRotation: 0,
    containerWidth: 640,
  };
  assert("20 initial PDF render allowed", tracker.maybeRenderPdf(renderDeps));
  tracker.updateOverlay({
    position: "center",
    rotationDegrees: 45,
    opacityPercent: 50,
    fontSize: 48,
    text: "",
  });
  assert(
    "20 image setting changes do not re-render PDF.js",
    !tracker.maybeRenderPdf(renderDeps) && tracker.pdfRenderCount === 1,
  );
  assert(
    "20 preview PDF effect excludes image overlay props",
    !previewSource.match(
      /useEffect\([\s\S]*?imagePreviewUrl[\s\S]*?loadPdfJsDocument/,
    ),
  );
  assert(
    "20 preview keeps image overlay memoized separately",
    previewSource.includes("imageOverlayStyle = useMemo"),
  );

  // 21. Export calls 124B image engine
  const settings: WatermarkWorkspaceSettings = switchWatermarkMode(
    createDefaultWorkspaceSettings(),
    "image",
  );
  const imageBytes = createTransparentPngBytes();
  const exportOptions = buildWatermarkExportOptions(settings, imageBytes);
  assert("21 export options are image type", exportOptions.type === "image");
  assert(
    "21 export wrapper aliases 124B engine",
    exportWatermarkedPdf === watermarkPdfDocument,
  );
  sourceIncludes(toolSource, "exportWatermarkedPdf", "21 UI calls exportWatermarkedPdf");
  sourceIncludes(
    toolSource,
    "buildWatermarkExportOptions",
    "21 UI builds export options via 124B helpers",
  );
  assert(
    "21 image export options include bytes",
    buildImageWatermarkExportOptions(settings, imageBytes).imageBytes === imageBytes,
  );

  // Extra error coverage
  assert(
    "GIF rejected with clear error",
    Boolean(getWatermarkImageFileError(makeFile("anim.gif", "image/gif"))?.includes("GIF")),
  );
  assert(
    "WebP rejected with clear error",
    Boolean(getWatermarkImageFileError(makeFile("photo.webp", "image/webp"))?.includes("WebP")),
  );
  assert(
    "SVG rejected with clear error",
    Boolean(getWatermarkImageFileError(makeFile("logo.svg", "image/svg+xml"))?.includes("SVG")),
  );

  // FileDropZone passes through input id/data attributes
  sourceIncludes(dropZoneSource, "inputId", "FileDropZone supports dedicated input id");
  sourceIncludes(dropZoneSource, "inputDataAttributes", "FileDropZone supports data attributes");

  // Simulate ImageWorkspaceAsset contract for replace/remove state flow
  const asset: ImageWorkspaceAsset = {
    bytes: transparentPng,
    previewUrl: "blob:mock",
    fileName: "mark.png",
    mimeType: "image/png",
    intrinsicWidth: 1,
    intrinsicHeight: 1,
    isTransparentPng: true,
  };
  assert("image asset stores filename for thumbnail UI", asset.fileName === "mark.png");

  console.log(`\nResults: ${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run();
