/**
 * IE-4A Image Editor — document model with filter + background.
 */

import {
  cloneAdjustments,
  createNeutralAdjustments,
  adjustmentsEqual,
  type EditorAdjustments,
} from "@/lib/image-editor/adjustments";
import {
  backgroundsEqual,
  cloneBackground,
  createDefaultBackground,
  resetBackground,
  type EditorBackground,
} from "@/lib/image-editor/background";
import {
  cloneFilterState,
  createDefaultFilterState,
  filterStatesEqual,
  resetFilterState,
  type EditorFilterState,
} from "@/lib/image-editor/filters";
import {
  CUSTOM_PRESET_ID,
  getPresetById,
  validateCanvasDimensions,
} from "@/lib/image-editor/presets";
import {
  cloneTextObjects,
  textObjectsEqual,
  type EditorTextObject,
} from "@/lib/image-editor/text";

export type EditorRotation = 0 | 90 | 180 | 270;
export type CropRatioId = "free" | "original" | "1:1" | "4:3" | "16:9";
export type ContentPlacementMode = "fit" | "fill" | "original";

export interface CropRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface EditorCanvas {
  width: number;
  height: number;
  presetId: string | null;
}

export interface ContentTransform {
  mode: ContentPlacementMode;
  scale: number;
  offsetX: number;
  offsetY: number;
}

export interface EditorDocument {
  canvas: EditorCanvas;
  content: ContentTransform;
  crop: CropRect | null;
  rotation: EditorRotation;
  adjustments: EditorAdjustments;
  filter: EditorFilterState;
  background: EditorBackground;
  flipX: boolean;
  flipY: boolean;
  /** Text overlays in canvas-pixel space (drawn above image). */
  texts: EditorTextObject[];
}

export interface EditorViewport {
  zoom: number;
  panX: number;
  panY: number;
}

export interface EditorSourceMeta {
  width: number;
  height: number;
  filename: string;
  mimeType: string;
}

export type {
  EditorAdjustments,
  EditorBackground,
  EditorFilterState,
  EditorTextObject,
};

export const CONTENT_SCALE_MIN = 0.1;
export const CONTENT_SCALE_MAX = 8;
export const ZOOM_MIN = 0.1;
export const ZOOM_MAX = 8;
export const HISTORY_CAP = 40;

export const ACCEPTED_EDITOR_MIME = new Set([
  "image/png",
  "image/jpeg",
  "image/jpg",
  "image/webp",
]);

export const ACCEPTED_EDITOR_EXT = new Set(["png", "jpg", "jpeg", "webp"]);

export function createContentTransform(
  mode: ContentPlacementMode = "fit",
): ContentTransform {
  return { mode, scale: 1, offsetX: 0, offsetY: 0 };
}

export function createCanvasFromSize(
  width: number,
  height: number,
  presetId: string | null = null,
): EditorCanvas {
  const validated = validateCanvasDimensions(width, height);
  if (!validated.ok) {
    return {
      width: Math.max(1, Math.round(width)),
      height: Math.max(1, Math.round(height)),
      presetId,
    };
  }
  return { width: validated.width, height: validated.height, presetId };
}

export function createInitialDocument(
  sourceWidth = 1080,
  sourceHeight = 1080,
): EditorDocument {
  return {
    canvas: createCanvasFromSize(sourceWidth, sourceHeight, null),
    content: createContentTransform("fit"),
    crop: null,
    rotation: 0,
    adjustments: createNeutralAdjustments(),
    filter: createDefaultFilterState(),
    background: createDefaultBackground(),
    flipX: false,
    flipY: false,
    texts: [],
  };
}

export function createDocumentFromSource(
  width: number,
  height: number,
): EditorDocument {
  return createInitialDocument(width, height);
}

export function createDocumentFromPreset(presetId: string): EditorDocument | null {
  const preset = getPresetById(presetId);
  if (!preset) return null;
  return {
    ...createInitialDocument(preset.width, preset.height),
    canvas: createCanvasFromSize(preset.width, preset.height, preset.id),
    content: createContentTransform("fill"),
  };
}

export function createInitialViewport(): EditorViewport {
  return { zoom: 1, panX: 0, panY: 0 };
}

export function cloneDocument(doc: EditorDocument): EditorDocument {
  return {
    canvas: {
      width: doc.canvas.width,
      height: doc.canvas.height,
      presetId: doc.canvas.presetId,
    },
    content: {
      mode: doc.content.mode,
      scale: doc.content.scale,
      offsetX: doc.content.offsetX,
      offsetY: doc.content.offsetY,
    },
    crop: doc.crop
      ? {
          x: doc.crop.x,
          y: doc.crop.y,
          width: doc.crop.width,
          height: doc.crop.height,
        }
      : null,
    rotation: doc.rotation,
    adjustments: cloneAdjustments(doc.adjustments),
    filter: cloneFilterState(doc.filter),
    background: cloneBackground(doc.background),
    flipX: doc.flipX,
    flipY: doc.flipY,
    texts: cloneTextObjects(doc.texts),
  };
}

export function documentsEqual(a: EditorDocument, b: EditorDocument): boolean {
  if (a.rotation !== b.rotation) return false;
  if (a.flipX !== b.flipX || a.flipY !== b.flipY) return false;
  if (!adjustmentsEqual(a.adjustments, b.adjustments)) return false;
  if (!filterStatesEqual(a.filter, b.filter)) return false;
  if (!backgroundsEqual(a.background, b.background)) return false;
  if (!textObjectsEqual(a.texts, b.texts)) return false;
  if (
    a.canvas.width !== b.canvas.width ||
    a.canvas.height !== b.canvas.height ||
    a.canvas.presetId !== b.canvas.presetId
  ) {
    return false;
  }
  if (
    a.content.mode !== b.content.mode ||
    a.content.scale !== b.content.scale ||
    a.content.offsetX !== b.content.offsetX ||
    a.content.offsetY !== b.content.offsetY
  ) {
    return false;
  }
  if (a.crop === null && b.crop === null) return true;
  if (a.crop === null || b.crop === null) return false;
  return (
    a.crop.x === b.crop.x &&
    a.crop.y === b.crop.y &&
    a.crop.width === b.crop.width &&
    a.crop.height === b.crop.height
  );
}

export function isAcceptedEditorFile(file: File): boolean {
  const mime = file.type.toLowerCase();
  if (ACCEPTED_EDITOR_MIME.has(mime)) return true;
  const ext = file.name.split(".").pop()?.toLowerCase() ?? "";
  return ACCEPTED_EDITOR_EXT.has(ext);
}

export function clampContentScale(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(CONTENT_SCALE_MAX, Math.max(CONTENT_SCALE_MIN, value));
}

export function clampZoom(value: number): number {
  if (!Number.isFinite(value)) return 1;
  return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, value));
}

export function normalizeRotation(degrees: number): EditorRotation {
  const normalized = ((Math.round(degrees) % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

export function rotateDocument(
  doc: EditorDocument,
  direction: "left" | "right",
): EditorDocument {
  const delta = direction === "right" ? 90 : -90;
  return {
    ...cloneDocument(doc),
    rotation: normalizeRotation(doc.rotation + delta),
  };
}

export function applyPresetToDocument(
  doc: EditorDocument,
  presetId: string,
): EditorDocument {
  const preset = getPresetById(presetId);
  if (!preset) return cloneDocument(doc);
  return {
    ...cloneDocument(doc),
    canvas: createCanvasFromSize(preset.width, preset.height, preset.id),
    content: createContentTransform(
      doc.content.mode === "original" ? "fit" : doc.content.mode,
    ),
  };
}

export function applyCustomCanvas(
  doc: EditorDocument,
  width: number,
  height: number,
): EditorDocument | null {
  const validated = validateCanvasDimensions(width, height);
  if (!validated.ok) return null;
  return {
    ...cloneDocument(doc),
    canvas: {
      width: validated.width,
      height: validated.height,
      presetId: CUSTOM_PRESET_ID,
    },
  };
}

export function applyPlacementMode(
  doc: EditorDocument,
  mode: ContentPlacementMode,
): EditorDocument {
  return {
    ...cloneDocument(doc),
    content: createContentTransform(mode),
  };
}

export function resetAdjustmentsOnly(doc: EditorDocument): EditorDocument {
  return {
    ...cloneDocument(doc),
    adjustments: createNeutralAdjustments(),
  };
}

export function resetFilterOnly(doc: EditorDocument): EditorDocument {
  return {
    ...cloneDocument(doc),
    filter: resetFilterState(),
  };
}

export function resetBackgroundOnly(doc: EditorDocument): EditorDocument {
  return {
    ...cloneDocument(doc),
    background: resetBackground(),
  };
}
