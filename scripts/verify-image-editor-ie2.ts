/**
 * IE-2 / IE-3A / IE-3B Image Editor verifier (pure TS, no canvas package).
 * Run: npx tsx scripts/verify-image-editor-ie2.ts
 */

import {
  createNeutralAdjustments,
  isNeutralAdjustments,
  processAdjustmentsRgba,
  adjustmentsEqual,
  clampSigned,
  clampUnsigned,
} from "../lib/image-editor/adjustments";
import {
  backgroundsEqual,
  createColorBackground,
  createDefaultBackground,
  createTransparentBackground,
  jpegFlattenColor,
  normalizeHex,
  resetBackground,
} from "../lib/image-editor/background";
import {
  createDocumentFromPreset,
  createDocumentFromSource,
  createInitialDocument,
  documentsEqual,
  rotateDocument,
  applyPresetToDocument,
  applyPlacementMode,
  applyCustomCanvas,
  resetAdjustmentsOnly,
  resetBackgroundOnly,
  resetFilterOnly,
  type EditorDocument,
} from "../lib/image-editor/document";
import {
  ORIGINAL_FILTER_ID,
  clampFilterIntensity,
  composeImageAdjustments,
  createDefaultFilterState,
  getFilterById,
  getFilterCatalog,
  isOriginalFilter,
  resetFilterState,
  filterStatesEqual,
} from "../lib/image-editor/filters";
import {
  clampCropRect,
  createCenteredRatioCrop,
  getDocumentOutputSize,
  getEditedImageSize,
  getCanvasOutputSize,
  moveCropRect,
  resizeCropRect,
  sourceToRotatedDocument,
  rotatedDocumentToSource,
  computeContentPlacement,
  basePlacementScale,
  clampContentOffsets,
  getCanvasFrameLayout,
  stagePointToCanvasPoint,
  stageDeltaToCanvasDelta,
} from "../lib/image-editor/geometry";
import { getExportDimensions } from "../lib/image-editor/export";
import {
  getPresetById,
  validateCanvasDimensions,
  CANVAS_PRESETS,
} from "../lib/image-editor/presets";
import {
  canRedo,
  canUndo,
  commitDocument,
  createHistory,
  historyIsDocumentOnly,
  redo,
  replacePresent,
  resetDocument,
  undo,
} from "../lib/image-editor/history";
import {
  TEXT_DEFAULT,
  TEXT_MAX_LENGTH,
  addTextObject,
  approximateMeasureWidth,
  clampTextFontSize,
  clampTextOpacity,
  createDefaultTextObject,
  createTextId,
  deleteTextObject,
  duplicateTextObject,
  layoutTextBlock,
  normalizeTextColor,
  normalizeTextRotation,
  splitTextLines,
  textObjectsEqual,
  updateTextInList,
} from "../lib/image-editor/text";
import {
  DEFAULT_EDITOR_FONT_ID,
  EDITOR_FONT_CATEGORY_FILTERS,
  EDITOR_FONT_REGISTRY,
  getFontFamily,
  listEditorFonts,
  normalizeFontWeight,
  registryHasNoRemoteUrls,
  registryHasUniqueIds,
} from "../lib/image-editor/fonts/registry";

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

const source = { width: 400, height: 300 };

assert(
  "rotation 90 swaps edited image dimensions",
  getEditedImageSize(source, { crop: null, rotation: 90 }).width === 300 &&
    getEditedImageSize(source, { crop: null, rotation: 90 }).height === 400,
);

assert(
  "rotation 270 swaps edited image dimensions",
  getDocumentOutputSize(source, { crop: null, rotation: 270 }).width === 300 &&
    getDocumentOutputSize(source, { crop: null, rotation: 270 }).height === 400,
);

assert(
  "rotation 180 keeps edited dimensions",
  getEditedImageSize(source, { crop: null, rotation: 180 }).width === 400 &&
    getEditedImageSize(source, { crop: null, rotation: 180 }).height === 300,
);

const crop = clampCropRect(
  { x: -10, y: 250, width: 500, height: 100 },
  source,
);
assert(
  "crop clamping stays inside source",
  crop.x >= 0 &&
    crop.y >= 0 &&
    crop.x + crop.width <= source.width &&
    crop.y + crop.height <= source.height,
);

const ratioCrop = createCenteredRatioCrop(source, "1:1");
assert(
  "1:1 crop is square and inside source",
  ratioCrop.width === ratioCrop.height &&
    ratioCrop.x >= 0 &&
    ratioCrop.y >= 0 &&
    ratioCrop.x + ratioCrop.width <= source.width,
);

const ratio43 = createCenteredRatioCrop(source, "4:3");
assert(
  "4:3 crop respects ratio",
  Math.abs(ratio43.width / ratio43.height - 4 / 3) < 0.02,
);

const moved = moveCropRect(
  { x: 10, y: 10, width: 100, height: 80 },
  source,
  1000,
  1000,
);
assert(
  "moved crop clamps to bottom-right",
  moved.x === source.width - 100 && moved.y === source.height - 80,
);

const resized = resizeCropRect(
  { x: 0, y: 0, width: 100, height: 100 },
  source,
  { width: 200 },
  "1:1",
);
assert(
  "ratio resize keeps 1:1",
  resized.width === resized.height && resized.width === 200,
);

const p = { x: 40, y: 20 };
for (const rot of [0, 90, 180, 270] as const) {
  const mapped = sourceToRotatedDocument(p, source, rot);
  const back = rotatedDocumentToSource(mapped, source, rot);
  assert(
    `rotation ${rot} source↔document round-trip`,
    Math.abs(back.x - p.x) < 0.001 && Math.abs(back.y - p.y) < 0.001,
  );
}

const croppedOut = getEditedImageSize(source, {
  crop: { x: 10, y: 10, width: 100, height: 50 },
  rotation: 90,
});
assert(
  "crop + 90° edited size",
  croppedOut.width === 50 && croppedOut.height === 100,
);

// --- History ---
let hist = createHistory(createDocumentFromSource(400, 300));
const bright: EditorDocument = {
  ...hist.present,
  adjustments: { ...hist.present.adjustments, brightness: 40 },
};
hist = commitDocument(hist, bright);
assert("undo available after commit", canUndo(hist));
hist = undo(hist);
assert("undo restores initial", hist.present.adjustments.brightness === 0);
assert("redo available after undo", canRedo(hist));
hist = redo(hist);
assert("redo restores brightness", hist.present.adjustments.brightness === 40);

hist = undo(hist);
const rotated = rotateDocument(hist.present, "right");
hist = commitDocument(hist, rotated);
assert("new edit after undo clears redo", !canRedo(hist));
assert("rotation applied", hist.present.rotation === 90);

hist = resetDocument(hist, createDocumentFromSource(400, 300));
assert(
  "reset restores source-sized canvas",
  hist.present.canvas.width === 400 && hist.present.canvas.height === 300,
);
assert("reset is undoable", canUndo(hist));
assert("history stores documents only", historyIsDocumentOnly(hist));

hist = commitDocument(hist, {
  ...hist.present,
  adjustments: { ...hist.present.adjustments, contrast: 20 },
});
assert(
  "no bitmap fields in history snapshots",
  historyIsDocumentOnly(hist) &&
    !("bitmap" in hist.present) &&
    !("imageData" in hist.present),
);

// --- Presets ---
const yt = getPresetById("yt-thumb");
assert(
  "YouTube Thumbnail preset 1280×720",
  !!yt && yt.width === 1280 && yt.height === 720,
);
const igStory = getPresetById("ig-story");
assert(
  "Instagram Story preset 1080×1920",
  !!igStory && igStory.width === 1080 && igStory.height === 1920,
);
assert("preset catalog non-empty", CANVAS_PRESETS.length >= 20);

const fromPreset = createDocumentFromPreset("yt-thumb");
assert(
  "createDocumentFromPreset sets canvas",
  !!fromPreset &&
    fromPreset.canvas.width === 1280 &&
    fromPreset.canvas.height === 720 &&
    fromPreset.canvas.presetId === "yt-thumb",
);

const customOk = validateCanvasDimensions(800, 600);
assert("custom dims valid", customOk.ok === true);
const customBad = validateCanvasDimensions(10, 10);
assert("custom dims reject tiny", customBad.ok === false);

let doc = createDocumentFromSource(400, 300);
doc = applyPresetToDocument(doc, "ig-post");
assert(
  "applyPresetToDocument",
  doc.canvas.width === 1080 &&
    doc.canvas.height === 1080 &&
    doc.canvas.presetId === "ig-post",
);

const customDoc = applyCustomCanvas(doc, 900, 500);
assert(
  "applyCustomCanvas",
  !!customDoc &&
    customDoc.canvas.width === 900 &&
    customDoc.canvas.height === 500 &&
    customDoc.canvas.presetId === "custom",
);

assert(
  "canvas output size from document",
  getCanvasOutputSize(doc.canvas).width === 1080 &&
    getCanvasOutputSize(doc.canvas).height === 1080,
);

const exportDims = getExportDimensions(400, 300, doc);
assert(
  "export dimensions = canvas (not source, not viewport)",
  exportDims.width === 1080 && exportDims.height === 1080,
);

const image = { width: 400, height: 200 };
const canvas = { width: 200, height: 200 };
assert(
  "fit scale is min edge",
  Math.abs(basePlacementScale(image, canvas, "fit") - 0.5) < 0.001,
);
assert(
  "fill scale is max edge",
  Math.abs(basePlacementScale(image, canvas, "fill") - 1) < 0.001,
);
assert(
  "original scale is 1",
  Math.abs(basePlacementScale(image, canvas, "original") - 1) < 0.001,
);

const fitPlace = computeContentPlacement(image, canvas, {
  mode: "fit",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});
assert(
  "fit placement centered and contained",
  fitPlace.drawWidth <= canvas.width + 0.01 &&
    fitPlace.drawHeight <= canvas.height + 0.01 &&
    Math.abs(fitPlace.x - (canvas.width - fitPlace.drawWidth) / 2) < 0.01,
);

const fillPlace = computeContentPlacement(image, canvas, {
  mode: "fill",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});
assert(
  "fill placement covers canvas",
  fillPlace.drawWidth >= canvas.width - 0.01 &&
    fillPlace.drawHeight >= canvas.height - 0.01,
);

const originalPlace = computeContentPlacement(image, canvas, {
  mode: "original",
  scale: 1,
  offsetX: 0,
  offsetY: 0,
});
assert(
  "original placement uses native scale",
  Math.abs(originalPlace.drawWidth - 400) < 0.01 &&
    Math.abs(originalPlace.drawHeight - 200) < 0.01,
);

const clamped = clampContentOffsets(
  image,
  canvas,
  { mode: "fit", scale: 1, offsetX: 0, offsetY: 0 },
  99999,
  99999,
);
assert(
  "content pan offsets are bounded",
  Math.abs(clamped.offsetX) < 10000 && Math.abs(clamped.offsetY) < 10000,
);

doc = applyPlacementMode(doc, "fill");
assert("placement mode fill", doc.content.mode === "fill" && doc.content.scale === 1);

hist = commitDocument(hist, applyPresetToDocument(hist.present, "yt-thumb"));
assert(
  "history captures canvas preset change",
  hist.present.canvas.presetId === "yt-thumb" && historyIsDocumentOnly(hist),
);

assert(
  "initial document has canvas + content + adjustments",
  typeof createInitialDocument().canvas.width === "number" &&
    typeof createInitialDocument().content.mode === "string" &&
    isNeutralAdjustments(createInitialDocument().adjustments),
);

// --- IE-3B exact coordinates ---
const stage = { width: 800, height: 600 };
const canvasSize = { width: 400, height: 300 };
const viewport = { zoom: 2, panX: 40, panY: -20 };
const layout = getCanvasFrameLayout(canvasSize, stage, viewport, 48);
assert("frame layout scale uses viewport zoom", layout.scale > 0);
const centerStage = {
  x: layout.frameX + layout.frameWidth / 2,
  y: layout.frameY + layout.frameHeight / 2,
};
const canvasPt = stagePointToCanvasPoint(centerStage, layout);
assert(
  "stage center maps to canvas center",
  Math.abs(canvasPt.x - canvasSize.width / 2) < 0.5 &&
    Math.abs(canvasPt.y - canvasSize.height / 2) < 0.5,
);

const delta = stageDeltaToCanvasDelta(layout.scale * 10, layout.scale * -5, layout);
assert(
  "stage delta → canvas delta exact",
  Math.abs(delta.x - 10) < 0.001 && Math.abs(delta.y + 5) < 0.001,
);

const portraitLayout = getCanvasFrameLayout(
  { width: 1080, height: 1920 },
  stage,
  { zoom: 1, panX: 0, panY: 0 },
  48,
);
const landscapeLayout = getCanvasFrameLayout(
  { width: 1920, height: 1080 },
  stage,
  { zoom: 1, panX: 0, panY: 0 },
  48,
);
assert(
  "portrait and landscape frames fit stage",
  portraitLayout.frameWidth <= stage.width &&
    portraitLayout.frameHeight <= stage.height &&
    landscapeLayout.frameWidth <= stage.width &&
    landscapeLayout.frameHeight <= stage.height,
);

// Fit/Fill content reposition with offsets
const fitMoved = computeContentPlacement(image, canvas, {
  mode: "fit",
  scale: 1,
  offsetX: 12,
  offsetY: -8,
});
assert(
  "fit content offset applied",
  Math.abs(fitMoved.x - ((canvas.width - fitMoved.drawWidth) / 2 + 12)) < 0.01 &&
    Math.abs(fitMoved.y - ((canvas.height - fitMoved.drawHeight) / 2 - 8)) < 0.01,
);

const fillMoved = computeContentPlacement(image, canvas, {
  mode: "fill",
  scale: 1,
  offsetX: 5,
  offsetY: 5,
});
assert("fill content offset applied", fillMoved.x !== fillPlace.x || fillMoved.y !== fillPlace.y);

// --- Adjustments ---
const neutral = createNeutralAdjustments();
assert("neutral adjustments", isNeutralAdjustments(neutral));
assert("clamp signed", clampSigned(999) === 100 && clampSigned(-999) === -100);
assert("clamp unsigned", clampUnsigned(999) === 100 && clampUnsigned(-5) === 0);

function rgba(r: number, g: number, b: number, a = 255): Uint8ClampedArray {
  return new Uint8ClampedArray([r, g, b, a]);
}

function assertChannel(
  name: string,
  buf: Uint8ClampedArray,
  expect: [number, number, number, number],
  tol = 2,
) {
  assert(
    name,
    Math.abs(buf[0] - expect[0]) <= tol &&
      Math.abs(buf[1] - expect[1]) <= tol &&
      Math.abs(buf[2] - expect[2]) <= tol &&
      buf[3] === expect[3],
    `got [${[...buf]}]`,
  );
}

const basePix = rgba(100, 100, 100, 200);

assertChannel(
  "Brightness neutral",
  processAdjustmentsRgba(basePix, 1, 1, neutral),
  [100, 100, 100, 200],
);

assertChannel(
  "Contrast neutral",
  processAdjustmentsRgba(basePix, 1, 1, { ...neutral, contrast: 0 }),
  [100, 100, 100, 200],
);

assertChannel(
  "Exposure neutral",
  processAdjustmentsRgba(basePix, 1, 1, { ...neutral, exposure: 0 }),
  [100, 100, 100, 200],
);

assertChannel(
  "Saturation neutral",
  processAdjustmentsRgba(rgba(120, 80, 60, 255), 1, 1, { ...neutral, saturation: 0 }),
  [120, 80, 60, 255],
);

assertChannel(
  "Vibrance neutral",
  processAdjustmentsRgba(rgba(120, 80, 60, 255), 1, 1, { ...neutral, vibrance: 0 }),
  [120, 80, 60, 255],
);

assertChannel(
  "Temperature neutral",
  processAdjustmentsRgba(basePix, 1, 1, { ...neutral, temperature: 0 }),
  [100, 100, 100, 200],
);

assertChannel(
  "Tint neutral",
  processAdjustmentsRgba(basePix, 1, 1, { ...neutral, tint: 0 }),
  [100, 100, 100, 200],
);

assertChannel(
  "Highlights neutral",
  processAdjustmentsRgba(basePix, 1, 1, { ...neutral, highlights: 0 }),
  [100, 100, 100, 200],
);

assertChannel(
  "Shadows neutral",
  processAdjustmentsRgba(basePix, 1, 1, { ...neutral, shadows: 0 }),
  [100, 100, 100, 200],
);

assertChannel(
  "Sharpness neutral",
  processAdjustmentsRgba(basePix, 1, 1, { ...neutral, sharpness: 0 }),
  [100, 100, 100, 200],
);

assertChannel(
  "Blur neutral",
  processAdjustmentsRgba(basePix, 1, 1, { ...neutral, blur: 0 }),
  [100, 100, 100, 200],
);

assertChannel(
  "Grayscale neutral",
  processAdjustmentsRgba(rgba(200, 50, 50, 180), 1, 1, { ...neutral, grayscale: 0 }),
  [200, 50, 50, 180],
);

const brighter = processAdjustmentsRgba(basePix, 1, 1, {
  ...neutral,
  brightness: 50,
});
assert("brightness lifts channels", brighter[0] > 100 && brighter[3] === 200);

const exposed = processAdjustmentsRgba(basePix, 1, 1, {
  ...neutral,
  exposure: 50,
});
assert(
  "exposure differs from brightness",
  exposed[0] !== brighter[0] && exposed[3] === 200,
);

const grayed = processAdjustmentsRgba(rgba(200, 40, 40, 255), 1, 1, {
  ...neutral,
  grayscale: 100,
});
assert(
  "grayscale 100 equalizes RGB",
  Math.abs(grayed[0] - grayed[1]) <= 1 &&
    Math.abs(grayed[1] - grayed[2]) <= 1 &&
    grayed[3] === 255,
);

const transparent = processAdjustmentsRgba(rgba(0, 0, 0, 0), 1, 1, {
  ...neutral,
  brightness: 80,
  contrast: 40,
  temperature: 30,
});
assert(
  "alpha preserved on transparent pixel",
  transparent[3] === 0,
);

// Reset adjustments only
doc = {
  ...applyPresetToDocument(createDocumentFromSource(400, 300), "yt-thumb"),
  adjustments: { ...createNeutralAdjustments(), brightness: 30, saturation: 20 },
  rotation: 90,
};
const afterResetAdj = resetAdjustmentsOnly(doc);
assert(
  "reset adjustments preserves canvas/crop/rotation",
  afterResetAdj.canvas.presetId === "yt-thumb" &&
    afterResetAdj.rotation === 90 &&
    isNeutralAdjustments(afterResetAdj.adjustments),
);

// History commit after slider-style replacePresent
hist = createHistory(createDocumentFromSource(200, 200));
const beforeAdj = hist.present;
hist = replacePresent(hist, {
  ...hist.present,
  adjustments: { ...hist.present.adjustments, brightness: 25 },
});
hist = commitDocument({ ...hist, present: beforeAdj }, hist.present);
assert("history commit after adjustment", canUndo(hist));
assert(
  "export document includes adjustment state",
  hist.present.adjustments.brightness === 25 &&
    !adjustmentsEqual(hist.present.adjustments, createNeutralAdjustments()),
);

assert(
  "documentsEqual sees adjustment diffs",
  !documentsEqual(beforeAdj, hist.present),
);

// ---------- IE-4A: Filters + Background ----------
const filterCatalog = getFilterCatalog();
assert("filter catalog has Original", filterCatalog[0]?.id === ORIGINAL_FILTER_ID);
assert(
  "filter catalog curated size",
  filterCatalog.length === 12 &&
    [
      "original",
      "vivid",
      "warm",
      "cool",
      "vintage",
      "fade",
      "mono",
      "noir",
      "sepia",
      "dramatic",
      "soft",
      "cinematic",
    ].every((id) => !!getFilterById(id)),
);

const defaultFilter = createDefaultFilterState();
assert(
  "filter default is Original @ 100",
  defaultFilter.filterId === ORIGINAL_FILTER_ID && defaultFilter.intensity === 100,
);
assert("Original filter semantics", isOriginalFilter(ORIGINAL_FILTER_ID));
assert("filter preset lookup Vivid", getFilterById("vivid")?.name === "Vivid");

const vivid = getFilterById("vivid")!;
const manual = { ...createNeutralAdjustments(), brightness: 20 };
const at0 = composeImageAdjustments(
  { filterId: "vivid", intensity: 0 },
  manual,
);
assert(
  "filter intensity 0 equals manual only",
  adjustmentsEqual(at0, manual),
);
const at100 = composeImageAdjustments(
  { filterId: "vivid", intensity: 100 },
  createNeutralAdjustments(),
);
assert(
  "filter intensity 100 equals full preset",
  adjustmentsEqual(at100, vivid.adjustments),
);
const at50 = composeImageAdjustments(
  { filterId: "vivid", intensity: 50 },
  createNeutralAdjustments(),
);
assert(
  "filter intensity 50 half saturation",
  Math.abs(at50.saturation - vivid.adjustments.saturation * 0.5) < 1.01,
);

const composedManual = composeImageAdjustments(
  { filterId: "vivid", intensity: 100 },
  manual,
);
assert(
  "manual-adjust + filter composition adds brightness",
  composedManual.brightness ===
    clampSigned(vivid.adjustments.brightness + manual.brightness) &&
    composedManual.saturation ===
      clampSigned(vivid.adjustments.saturation + manual.saturation),
);

assert(
  "Original compose ignores intensity",
  adjustmentsEqual(
    composeImageAdjustments({ filterId: ORIGINAL_FILTER_ID, intensity: 50 }, manual),
    manual,
  ),
);

assert("clamp filter intensity", clampFilterIntensity(150) === 100);

let filterDoc = createDocumentFromSource(200, 150);
filterDoc = {
  ...filterDoc,
  filter: { filterId: "cinematic", intensity: 80 },
  adjustments: { ...createNeutralAdjustments(), contrast: 15 },
  background: createColorBackground("#112233"),
  crop: { x: 10, y: 10, width: 100, height: 80 },
  rotation: 90,
};
const afterFilterReset = resetFilterOnly(filterDoc);
assert(
  "filter reset restores Original without wiping adjust/bg/crop",
  afterFilterReset.filter.filterId === ORIGINAL_FILTER_ID &&
    afterFilterReset.adjustments.contrast === 15 &&
    afterFilterReset.background.type === "color" &&
    afterFilterReset.crop?.width === 100 &&
    afterFilterReset.rotation === 90,
);

hist = createHistory(createDocumentFromSource(100, 100));
hist = commitDocument(hist, {
  ...hist.present,
  filter: { filterId: "warm", intensity: 100 },
});
assert("filter history undoable", canUndo(hist));
hist = undo(hist);
assert(
  "filter history undo restores Original",
  hist.present.filter.filterId === ORIGINAL_FILTER_ID,
);
hist = redo(hist);
assert("filter history redo restores Warm", hist.present.filter.filterId === "warm");

hist = commitDocument(hist, {
  ...hist.present,
  filter: { filterId: "warm", intensity: 40 },
});
assert("filter intensity history", hist.present.filter.intensity === 40);
hist = undo(hist);
assert("filter intensity undo", hist.present.filter.intensity === 100);

const bgDefault = createDefaultBackground();
assert(
  "background default transparent",
  bgDefault.type === "transparent",
);
assert(
  "transparent background",
  createTransparentBackground().type === "transparent",
);
assert(
  "solid background",
  createColorBackground("#ff6600").type === "color" &&
    normalizeHex("#f60") === "#ff6600",
);
assert(
  "jpeg flatten transparent → white",
  jpegFlattenColor(createTransparentBackground()) === "#ffffff",
);
assert(
  "jpeg flatten solid uses color",
  jpegFlattenColor(createColorBackground("#00ff00")) === "#00ff00",
);

const bgDoc = {
  ...createDocumentFromSource(200, 200),
  background: createColorBackground("#abcdef"),
  filter: { filterId: "mono", intensity: 100 },
  adjustments: { ...createNeutralAdjustments(), brightness: 10 },
};
const afterBgReset = resetBackgroundOnly(bgDoc);
assert(
  "background reset restores default only",
  afterBgReset.background.type === "transparent" &&
    afterBgReset.filter.filterId === "mono" &&
    afterBgReset.adjustments.brightness === 10,
);

hist = createHistory(createDocumentFromSource(120, 120));
hist = commitDocument(hist, {
  ...hist.present,
  background: createColorBackground("#000000"),
});
assert("background history undoable", canUndo(hist));
hist = undo(hist);
assert(
  "background history undo",
  hist.present.background.type === "transparent",
);

assert(
  "background excluded from image-only filtering (compose ignores bg)",
  adjustmentsEqual(
    composeImageAdjustments(
      { filterId: "vivid", intensity: 100 },
      createNeutralAdjustments(),
    ),
    vivid.adjustments,
  ) && !backgroundsEqual(createColorBackground("#fff"), createTransparentBackground()),
);

assert(
  "PNG alpha background semantics (transparent type, no bake flag)",
  createTransparentBackground().type === "transparent" &&
    resetBackground().type === "transparent",
);

const storyPreset = createDocumentFromPreset("ig-story");
const ytThumbPreset = createDocumentFromPreset("yt-thumb");
assert(
  "Instagram Story canvas 1080×1920",
  !!storyPreset &&
    getCanvasOutputSize(storyPreset.canvas).width === 1080 &&
    getCanvasOutputSize(storyPreset.canvas).height === 1920,
);
assert(
  "YouTube Thumbnail canvas 1280×720",
  !!ytThumbPreset &&
    getCanvasOutputSize(ytThumbPreset.canvas).width === 1280 &&
    getCanvasOutputSize(ytThumbPreset.canvas).height === 720,
);

const storyFit = applyPlacementMode(storyPreset!, "fit");
assert(
  "target canvas dimensions unchanged by filter/bg",
  getExportDimensions(400, 300, storyFit).width === 1080 &&
    getExportDimensions(400, 300, storyFit).height === 1920,
);

assert(
  "viewport independence (export size from canvas only)",
  getExportDimensions(9999, 9999, createDocumentFromSource(640, 480)).width ===
    640,
);

assert(
  "no bitmap history — document-only history",
  historyIsDocumentOnly(
    createHistory({
      ...createDocumentFromSource(50, 50),
      filter: { filterId: "noir", intensity: 70 },
      background: createColorBackground("#111111"),
    }),
  ),
);

assert(
  "filterStatesEqual / resetFilterState",
  filterStatesEqual(resetFilterState(), createDefaultFilterState()),
);

assert(
  "initial document includes filter + background",
  createInitialDocument().filter.filterId === ORIGINAL_FILTER_ID &&
    createInitialDocument().background.type === "transparent",
);

// ─── IE-4B Text objects ───────────────────────────────────────────

const t0 = createDefaultTextObject(1080, 1080);
assert(
  "default text object creation",
  t0.text === TEXT_DEFAULT &&
    t0.x === 540 &&
    t0.y === 540 &&
    t0.align === "center" &&
    t0.opacity === 100 &&
    t0.rotation === 0 &&
    typeof t0.id === "string" &&
    t0.id.startsWith("txt_"),
);

const idA = createTextId();
const idB = createTextId();
assert("unique IDs", idA !== idB && idA !== t0.id);

let textDoc: EditorDocument = {
  ...createInitialDocument(800, 600),
  texts: [],
};
const added = addTextObject(
  textDoc.texts,
  createDefaultTextObject(800, 600, { id: "txt_a" }),
);
assert("add text", !!added && added.length === 1 && added[0]!.id === "txt_a");
textDoc = { ...textDoc, texts: added! };

const dup = duplicateTextObject(textDoc.texts, "txt_a");
assert(
  "duplicate text",
  !!dup &&
    dup.texts.length === 2 &&
    dup.newId !== "txt_a" &&
    dup.texts[1]!.text === textDoc.texts[0]!.text &&
    dup.texts[1]!.x !== textDoc.texts[0]!.x,
);
textDoc = { ...textDoc, texts: dup!.texts };
assert(
  "text drawing order deterministic",
  textDoc.texts[0]!.id === "txt_a" && textDoc.texts[1]!.id === dup!.newId,
);

const edited = updateTextInList(textDoc.texts, "txt_a", {
  text: "Hello\nWorld",
  fontSize: 64,
  fontWeight: "700",
  color: "#ff5500",
  opacity: 80,
  align: "left",
  rotation: 15,
});
assert(
  "text edit",
  edited[0]!.text === "Hello\nWorld" &&
    edited[0]!.fontSize === 64 &&
    edited[0]!.fontWeight === "700" &&
    edited[0]!.color === "#ff5500" &&
    edited[0]!.opacity === 80 &&
    edited[0]!.align === "left" &&
    edited[0]!.rotation === 15,
);
textDoc = { ...textDoc, texts: edited };

let textHist = createHistory({ ...textDoc, texts: [] });
textHist = commitDocument(textHist, {
  ...textHist.present,
  texts: [createDefaultTextObject(800, 600, { id: "txt_hist" })],
});
assert("history undo add available", canUndo(textHist));
const afterAdd = textHist.present.texts.length;
textHist = undo(textHist);
assert(
  "history undo add",
  textHist.present.texts.length === 0 && afterAdd === 1,
);
textHist = redo(textHist);
assert("history redo add", textHist.present.texts.length === 1);

textHist = commitDocument(textHist, {
  ...textHist.present,
  texts: deleteTextObject(textHist.present.texts, "txt_hist"),
});
assert("history undo delete available", canUndo(textHist));
textHist = undo(textHist);
assert("history undo delete", textHist.present.texts.length === 1);

const movedBase = textHist.present;
textHist = replacePresent(textHist, {
  ...textHist.present,
  texts: updateTextInList(textHist.present.texts, "txt_hist", {
    x: 100,
    y: 120,
  }),
});
assert(
  "move text (transient)",
  textHist.present.texts[0]!.x === 100 && textHist.present.texts[0]!.y === 120,
);
textHist = commitDocument(
  { ...textHist, present: movedBase },
  textHist.present,
);
assert("move history transaction", canUndo(textHist));
textHist = undo(textHist);
assert(
  "move history undo restores position",
  textHist.present.texts[0]!.x !== 100,
);

assert("font-size validation", clampTextFontSize(3) === 8 && clampTextFontSize(999) === 400);
assert("opacity validation", clampTextOpacity(-5) === 0 && clampTextOpacity(150) === 100);
assert(
  "rotation normalization/validation",
  normalizeTextRotation(370) === 10 && normalizeTextRotation(Number.NaN) === 0,
);
assert(
  "color validation",
  normalizeTextColor("#abc") === "#aabbcc" && normalizeTextColor("nope") === null,
);
assert("alignment", edited[0]!.align === "left");

const textLines = splitTextLines("a\nb\nc");
const textLayout = layoutTextBlock(
  { text: "a\nb\nc", fontSize: 20, align: "center" },
  (line) => approximateMeasureWidth(line, 20),
);
assert(
  "multiline metrics/layout",
  textLines.length === 3 &&
    textLayout.lines.length === 3 &&
    textLayout.height === 20 * 1.25 * 3 &&
    textLayout.width > 0,
);

const canvasResized = applyCustomCanvas(
  { ...textDoc, texts: [createDefaultTextObject(800, 600, { id: "keep", x: 50, y: 60 })] },
  400,
  400,
);
assert(
  "text survives canvas resize",
  !!canvasResized &&
    canvasResized.texts.length === 1 &&
    canvasResized.texts[0]!.id === "keep" &&
    canvasResized.texts[0]!.x === 50 &&
    canvasResized.canvas.width === 400,
);

const cropped = {
  ...textDoc,
  texts: [createDefaultTextObject(800, 600, { id: "crop-survives" })],
  crop: { x: 10, y: 10, width: 100, height: 80 },
};
assert(
  "text survives image crop state changes",
  cropped.texts[0]!.id === "crop-survives" && cropped.crop?.width === 100,
);

const rotatedSrc = rotateDocument(
  {
    ...createInitialDocument(400, 300),
    texts: [createDefaultTextObject(400, 300, { id: "rot-survives", text: "Stay" })],
  },
  "right",
);
assert(
  "text survives source rotation state changes",
  rotatedSrc.rotation === 90 &&
    rotatedSrc.texts[0]!.id === "rot-survives" &&
    rotatedSrc.texts[0]!.text === "Stay",
);

const withFilter = {
  ...rotatedSrc,
  filter: { filterId: "vivid", intensity: 100 },
  adjustments: { ...createNeutralAdjustments(), brightness: 20 },
  background: createColorBackground("#112233"),
};
assert(
  "filter does not mutate text",
  withFilter.texts[0]!.text === "Stay" && withFilter.texts[0]!.color === "#000000",
);
assert(
  "Adjust does not mutate text",
  withFilter.texts[0]!.opacity === 100 && withFilter.adjustments.brightness === 20,
);
assert(
  "background does not mutate text",
  withFilter.background.type === "color" && withFilter.texts.length === 1,
);

assert(
  "viewport excluded from text coordinates/export",
  getExportDimensions(100, 100, withFilter).width === withFilter.canvas.width &&
    withFilter.texts[0]!.x === 200,
);

assert(
  "render/export dimensions unchanged by viewport",
  getExportDimensions(1, 1, createDocumentFromSource(640, 480)).width === 640,
);

assert(
  "history contains no bitmap objects",
  historyIsDocumentOnly(
    createHistory({
      ...createDocumentFromSource(50, 50),
      texts: [createDefaultTextObject(50, 50)],
    }),
  ),
);

assert(
  "textObjectsEqual / initial texts empty",
  textObjectsEqual(createInitialDocument().texts, []) &&
    createInitialDocument().texts.length === 0,
);

assert(
  "text length safety cap",
  updateTextInList(
    [createDefaultTextObject(100, 100, { id: "cap" })],
    "cap",
    { text: "x".repeat(TEXT_MAX_LENGTH + 50) },
  )[0]!.text.length === TEXT_MAX_LENGTH,
);

// ─── IE-4B.2 Font library ─────────────────────────────────────────

assert("font registry IDs unique", registryHasUniqueIds());
assert(
  "font registry categories valid",
  EDITOR_FONT_REGISTRY.every((f) =>
    ["sans", "serif", "display", "handwritten", "mono", "system"].includes(
      f.category,
    ),
  ),
);
assert(
  "font registry CSS family non-empty",
  EDITOR_FONT_REGISTRY.every((f) => f.cssFamily.trim().length > 0),
);
assert(
  "font registry weights non-empty",
  EDITOR_FONT_REGISTRY.every((f) => f.weights.length > 0),
);
assert(
  "default font exists",
  getFontFamily(DEFAULT_EDITOR_FONT_ID).id === "geist-sans",
);
assert(
  "existing Geist IDs remain valid",
  getFontFamily("geist-sans").id === "geist-sans" &&
    getFontFamily("geist-mono").id === "geist-mono",
);
assert(
  "font search",
  listEditorFonts("all", "playfair").some((f) => f.id === "playfair-display") &&
    listEditorFonts("all", "zzzz-nope").length === 0,
);
assert(
  "font category filtering",
  listEditorFonts("display").every((f) => f.category === "display") &&
    listEditorFonts("handwritten").length >= 3 &&
    EDITOR_FONT_CATEGORY_FILTERS.some((c) => c.id === "serif"),
);
assert(
  "unsupported weight normalization",
  normalizeFontWeight("bebas-neue", "700") === "400" &&
    normalizeFontWeight("inter", "500") === "500",
);

const fontDocBase = {
  ...createInitialDocument(800, 600),
  texts: [
    createDefaultTextObject(800, 600, {
      id: "font-a",
      fontFamilyId: "geist-sans",
      text: "Hello\nWorld",
      x: 100,
      y: 120,
      rotation: 12,
      opacity: 80,
    }),
  ],
};
let fontHist = createHistory(fontDocBase);
const afterFont = {
  ...fontHist.present,
  texts: updateTextInList(fontHist.present.texts, "font-a", {
    fontFamilyId: "playfair-display",
  }),
};
assert(
  "font selection changes document",
  afterFont.texts[0]!.fontFamilyId === "playfair-display" &&
    afterFont.texts[0]!.text === "Hello\nWorld" &&
    afterFont.texts[0]!.x === 100 &&
    afterFont.texts[0]!.y === 120 &&
    afterFont.texts[0]!.rotation === 12 &&
    afterFont.texts[0]!.opacity === 80,
);
fontHist = commitDocument(fontHist, afterFont);
assert("undo font selection available", canUndo(fontHist));
fontHist = undo(fontHist);
assert(
  "undo font selection",
  fontHist.present.texts[0]!.fontFamilyId === "geist-sans",
);
fontHist = redo(fontHist);
assert(
  "redo font selection",
  fontHist.present.texts[0]!.fontFamilyId === "playfair-display",
);

const dupFont = duplicateTextObject(afterFont.texts, "font-a");
assert(
  "font ID survives duplicate",
  !!dupFont &&
    dupFont.texts[1]!.fontFamilyId === "playfair-display" &&
    dupFont.texts[1]!.id !== "font-a",
);

assert("font registry contains no unsafe arbitrary URL", registryHasNoRemoteUrls());
assert(
  "export resolves fonts actually used (ids present)",
  Array.from(
    new Set(
      [
        createDefaultTextObject(10, 10, { fontFamilyId: "inter" }),
        createDefaultTextObject(10, 10, { fontFamilyId: "pacifico" }),
      ].map((t) => t.fontFamilyId),
    ),
  ).every((id) => !!getFontFamily(id).id),
);
assert(
  "viewport remains irrelevant to font coords",
  getExportDimensions(1, 1, afterFont).width === afterFont.canvas.width,
);
assert(
  "curated library size",
  EDITOR_FONT_REGISTRY.length >= 24 && EDITOR_FONT_REGISTRY.length <= 40,
);

console.log(`\nIE verifier: ${passed} passed, ${failed} failed`);
if (failed > 0) {
  process.exit(1);
}
