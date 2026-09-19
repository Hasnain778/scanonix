/**
 * IE-4B — text objects (document-space, canvas-pixel coordinates).
 * Preview and export share the same layout + draw math.
 * Fonts: see lib/image-editor/fonts (IE-4B.2).
 */

import { isValidHexColor, normalizeHex } from "@/lib/image-editor/background";
import {
  DEFAULT_EDITOR_FONT_ID,
  EDITOR_FONT_REGISTRY,
  getFontFamily,
  getFontStack as registryGetFontStack,
  normalizeFontWeight,
  type EditorFontFamilyId,
  type EditorFontWeight,
} from "@/lib/image-editor/fonts/registry";
import { ensureEditorFontsLoaded as loadFonts } from "@/lib/image-editor/fonts/loader";

export type EditorTextAlign = "left" | "center" | "right";
export type EditorTextWeight = EditorFontWeight;
export type { EditorFontFamilyId };

export interface EditorTextObject {
  id: string;
  text: string;
  /** Center of the unrotated text block, in canvas pixels. */
  x: number;
  y: number;
  fontFamilyId: EditorFontFamilyId;
  fontSize: number;
  fontWeight: EditorTextWeight;
  color: string;
  opacity: number;
  align: EditorTextAlign;
  /** Degrees, any finite angle (normalized for storage). */
  rotation: number;
}

/** @deprecated Use EDITOR_FONT_REGISTRY — kept for verifier compatibility. */
export const EDITOR_FONT_FAMILIES = EDITOR_FONT_REGISTRY.map((f) => ({
  id: f.id,
  label: f.label,
  stack: f.stack,
  loadFamily: f.cssFamily,
}));

export function getFontOption(id: EditorFontFamilyId | string) {
  const f = getFontFamily(id);
  return {
    id: f.id,
    label: f.label,
    stack: f.stack,
    loadFamily: f.cssFamily,
  };
}

export function getFontStack(id: EditorFontFamilyId | string): string {
  return registryGetFontStack(id);
}

export function buildCanvasFont(
  weight: EditorTextWeight,
  fontSize: number,
  fontFamilyId: EditorFontFamilyId | string,
): string {
  const size = clampTextFontSize(fontSize);
  const w = normalizeFontWeight(fontFamilyId, weight);
  return `${w} ${size}px ${getFontStack(fontFamilyId)}`;
}

export async function ensureEditorFontsLoaded(
  familyIds?: EditorFontFamilyId[],
): Promise<void> {
  await loadFonts(familyIds);
}

export const TEXT_LINE_HEIGHT_RATIO = 1.25;
export const TEXT_MAX_OBJECTS = 40;
export const TEXT_MAX_LENGTH = 2000;
export const TEXT_FONT_SIZE_MIN = 8;
export const TEXT_FONT_SIZE_MAX = 400;
export const TEXT_DEFAULT = "Add your text";

let textIdCounter = 0;

export function createTextId(): string {
  textIdCounter += 1;
  const rand =
    typeof crypto !== "undefined" && "randomUUID" in crypto
      ? crypto.randomUUID().replace(/-/g, "").slice(0, 12)
      : `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`;
  return `txt_${rand}_${textIdCounter.toString(36)}`;
}

export function clampTextFontSize(value: number): number {
  if (!Number.isFinite(value)) return 48;
  return Math.min(
    TEXT_FONT_SIZE_MAX,
    Math.max(TEXT_FONT_SIZE_MIN, Math.round(value)),
  );
}

export function clampTextOpacity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, Math.round(value)));
}

export function normalizeTextRotation(degrees: number): number {
  if (!Number.isFinite(degrees)) return 0;
  let n = ((degrees % 360) + 360) % 360;
  if (n > 180) n -= 360;
  return Math.round(n * 10) / 10;
}

export function clampTextCoordinate(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.round(value * 100) / 100;
}

export function sanitizeTextContent(raw: string): string {
  const normalized = raw.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
  if (normalized.length <= TEXT_MAX_LENGTH) return normalized;
  return normalized.slice(0, TEXT_MAX_LENGTH);
}

export function normalizeTextColor(raw: string): string | null {
  if (!isValidHexColor(raw)) return null;
  return normalizeHex(raw);
}

export function splitTextLines(text: string): string[] {
  const lines = sanitizeTextContent(text).split("\n");
  return lines.length ? lines : [""];
}

export function getTextLineHeight(fontSize: number): number {
  return clampTextFontSize(fontSize) * TEXT_LINE_HEIGHT_RATIO;
}

export function defaultTextFontSize(
  canvasWidth: number,
  canvasHeight: number,
): number {
  const edge = Math.min(Math.max(1, canvasWidth), Math.max(1, canvasHeight));
  return clampTextFontSize(Math.round(edge * 0.055));
}

export function cloneTextObject(t: EditorTextObject): EditorTextObject {
  return {
    id: t.id,
    text: t.text,
    x: t.x,
    y: t.y,
    fontFamilyId: t.fontFamilyId,
    fontSize: t.fontSize,
    fontWeight: t.fontWeight,
    color: t.color,
    opacity: t.opacity,
    align: t.align,
    rotation: t.rotation,
  };
}

export function cloneTextObjects(texts: EditorTextObject[]): EditorTextObject[] {
  return texts.map(cloneTextObject);
}

export function textObjectsEqual(
  a: EditorTextObject[],
  b: EditorTextObject[],
): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    const left = a[i]!;
    const right = b[i]!;
    if (
      left.id !== right.id ||
      left.text !== right.text ||
      left.x !== right.x ||
      left.y !== right.y ||
      left.fontFamilyId !== right.fontFamilyId ||
      left.fontSize !== right.fontSize ||
      left.fontWeight !== right.fontWeight ||
      left.color !== right.color ||
      left.opacity !== right.opacity ||
      left.align !== right.align ||
      left.rotation !== right.rotation
    ) {
      return false;
    }
  }
  return true;
}

export function createDefaultTextObject(
  canvasWidth: number,
  canvasHeight: number,
  overrides?: Partial<EditorTextObject>,
): EditorTextObject {
  const fontSize = defaultTextFontSize(canvasWidth, canvasHeight);
  const base: EditorTextObject = {
    id: overrides?.id ?? createTextId(),
    text: TEXT_DEFAULT,
    x: clampTextCoordinate(canvasWidth / 2),
    y: clampTextCoordinate(canvasHeight / 2),
    fontFamilyId: DEFAULT_EDITOR_FONT_ID,
    fontSize,
    fontWeight: "500",
    color: "#000000",
    opacity: 100,
    align: "center",
    rotation: 0,
  };
  const merged = { ...base, ...overrides, id: base.id };
  const familyId = merged.fontFamilyId || DEFAULT_EDITOR_FONT_ID;
  return {
    ...merged,
    fontFamilyId: familyId,
    fontWeight: normalizeFontWeight(familyId, merged.fontWeight),
    text: sanitizeTextContent(merged.text),
    fontSize: clampTextFontSize(merged.fontSize),
    opacity: clampTextOpacity(merged.opacity),
    rotation: normalizeTextRotation(merged.rotation),
    color: normalizeTextColor(merged.color) ?? "#000000",
    x: clampTextCoordinate(merged.x),
    y: clampTextCoordinate(merged.y),
  };
}

export type TextMeasureWidth = (line: string) => number;

/** Pure layout: lines + AABB size around center anchor. */
export function layoutTextBlock(
  textObj: Pick<
    EditorTextObject,
    "text" | "fontSize" | "align"
  >,
  measureWidth: TextMeasureWidth,
): {
  lines: string[];
  lineHeight: number;
  width: number;
  height: number;
} {
  const lines = splitTextLines(textObj.text);
  const lineHeight = getTextLineHeight(textObj.fontSize);
  let width = 0;
  for (const line of lines) {
    width = Math.max(width, measureWidth(line));
  }
  if (!Number.isFinite(width) || width < 0) width = 0;
  // Empty line still occupies line height
  const height = Math.max(lineHeight, lines.length * lineHeight);
  return { lines, lineHeight, width: Math.max(1, width), height };
}

/** Approximate measure for Node/tests (no Canvas). */
export function approximateMeasureWidth(
  line: string,
  fontSize: number,
): number {
  const size = clampTextFontSize(fontSize);
  // Average glyph width ~0.55em for Latin sans
  return Math.max(size * 0.2, line.length * size * 0.55);
}

export function createCanvasMeasureWidth(
  ctx: CanvasRenderingContext2D,
  textObj: Pick<EditorTextObject, "fontFamilyId" | "fontSize" | "fontWeight">,
): TextMeasureWidth {
  ctx.font = buildCanvasFont(
    textObj.fontWeight,
    textObj.fontSize,
    textObj.fontFamilyId,
  );
  return (line: string) => {
    const m = ctx.measureText(line.length ? line : " ");
    return m.width;
  };
}

export interface TextLocalBounds {
  width: number;
  height: number;
  lines: string[];
  lineHeight: number;
}

export function getTextLocalBounds(
  textObj: EditorTextObject,
  measureWidth: TextMeasureWidth,
): TextLocalBounds {
  const layout = layoutTextBlock(textObj, measureWidth);
  return layout;
}

/** Point in canvas space → local unrotated box space (origin = center). */
export function canvasPointToTextLocal(
  canvasX: number,
  canvasY: number,
  textObj: Pick<EditorTextObject, "x" | "y" | "rotation">,
): { x: number; y: number } {
  const dx = canvasX - textObj.x;
  const dy = canvasY - textObj.y;
  const rad = (-textObj.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return {
    x: dx * cos - dy * sin,
    y: dx * sin + dy * cos,
  };
}

export function hitTestTextObject(
  canvasX: number,
  canvasY: number,
  textObj: EditorTextObject,
  measureWidth: TextMeasureWidth,
  padding = 6,
): boolean {
  const bounds = getTextLocalBounds(textObj, measureWidth);
  const local = canvasPointToTextLocal(canvasX, canvasY, textObj);
  const hw = bounds.width / 2 + padding;
  const hh = bounds.height / 2 + padding;
  return local.x >= -hw && local.x <= hw && local.y >= -hh && local.y <= hh;
}

/**
 * Hit-test from top-most text downward (document order: last drawn = top).
 */
export function hitTestTextsTopFirst(
  canvasX: number,
  canvasY: number,
  texts: EditorTextObject[],
  measureWidthFor: (t: EditorTextObject) => TextMeasureWidth,
  padding = 6,
): string | null {
  for (let i = texts.length - 1; i >= 0; i--) {
    const t = texts[i]!;
    if (hitTestTextObject(canvasX, canvasY, t, measureWidthFor(t), padding)) {
      return t.id;
    }
  }
  return null;
}

/**
 * Draw one text object. Shared by preview + export.
 * (x,y) = center; rotation around center; align within block width.
 */
export function drawTextObject(
  ctx: CanvasRenderingContext2D,
  textObj: EditorTextObject,
): TextLocalBounds {
  const measure = createCanvasMeasureWidth(ctx, textObj);
  const bounds = getTextLocalBounds(textObj, measure);

  ctx.save();
  ctx.translate(textObj.x, textObj.y);
  ctx.rotate((textObj.rotation * Math.PI) / 180);
  ctx.globalAlpha = clampTextOpacity(textObj.opacity) / 100;
  ctx.fillStyle = normalizeTextColor(textObj.color) ?? "#000000";
  ctx.font = buildCanvasFont(
    textObj.fontWeight,
    textObj.fontSize,
    textObj.fontFamilyId,
  );
  ctx.textBaseline = "middle";
  ctx.textAlign = "left";

  const startY = -bounds.height / 2 + bounds.lineHeight / 2;
  for (let i = 0; i < bounds.lines.length; i++) {
    const line = bounds.lines[i]!;
    const lineW = measure(line.length ? line : " ");
    let lx = -bounds.width / 2;
    if (textObj.align === "center") lx = -lineW / 2;
    else if (textObj.align === "right") lx = bounds.width / 2 - lineW;
    ctx.fillText(line, lx, startY + i * bounds.lineHeight);
  }
  ctx.restore();
  return bounds;
}

export function drawTextObjects(
  ctx: CanvasRenderingContext2D,
  texts: EditorTextObject[],
): void {
  for (const t of texts) {
    drawTextObject(ctx, t);
  }
}

/** Editor-only selection outline in canvas pixel space (caller maps to stage). */
export function getTextSelectionCorners(
  textObj: EditorTextObject,
  measureWidth: TextMeasureWidth,
  padding = 8,
): { x: number; y: number }[] {
  const bounds = getTextLocalBounds(textObj, measureWidth);
  const hw = bounds.width / 2 + padding;
  const hh = bounds.height / 2 + padding;
  const locals = [
    { x: -hw, y: -hh },
    { x: hw, y: -hh },
    { x: hw, y: hh },
    { x: -hw, y: hh },
  ];
  const rad = (textObj.rotation * Math.PI) / 180;
  const cos = Math.cos(rad);
  const sin = Math.sin(rad);
  return locals.map((p) => ({
    x: textObj.x + p.x * cos - p.y * sin,
    y: textObj.y + p.x * sin + p.y * cos,
  }));
}

export function findTextById(
  texts: EditorTextObject[],
  id: string | null | undefined,
): EditorTextObject | null {
  if (!id) return null;
  return texts.find((t) => t.id === id) ?? null;
}

export function updateTextInList(
  texts: EditorTextObject[],
  id: string,
  patch: Partial<EditorTextObject>,
): EditorTextObject[] {
  return texts.map((t) => {
    if (t.id !== id) return t;
    const next = { ...t, ...patch, id: t.id };
    if (patch.fontFamilyId !== undefined) {
      next.fontFamilyId = patch.fontFamilyId;
      next.fontWeight = normalizeFontWeight(
        patch.fontFamilyId,
        patch.fontWeight ?? next.fontWeight,
      );
    } else if (patch.fontWeight !== undefined) {
      next.fontWeight = normalizeFontWeight(next.fontFamilyId, patch.fontWeight);
    }
    if (patch.text !== undefined) next.text = sanitizeTextContent(patch.text);
    if (patch.fontSize !== undefined)
      next.fontSize = clampTextFontSize(patch.fontSize);
    if (patch.opacity !== undefined)
      next.opacity = clampTextOpacity(patch.opacity);
    if (patch.rotation !== undefined)
      next.rotation = normalizeTextRotation(patch.rotation);
    if (patch.color !== undefined) {
      next.color = normalizeTextColor(patch.color) ?? t.color;
    }
    if (patch.x !== undefined) next.x = clampTextCoordinate(patch.x);
    if (patch.y !== undefined) next.y = clampTextCoordinate(patch.y);
    return next;
  });
}

export function addTextObject(
  texts: EditorTextObject[],
  next: EditorTextObject,
): EditorTextObject[] | null {
  if (texts.length >= TEXT_MAX_OBJECTS) return null;
  return [...texts, cloneTextObject(next)];
}

export function duplicateTextObject(
  texts: EditorTextObject[],
  id: string,
  offset = 24,
): { texts: EditorTextObject[]; newId: string } | null {
  if (texts.length >= TEXT_MAX_OBJECTS) return null;
  const source = findTextById(texts, id);
  if (!source) return null;
  const copy = cloneTextObject(source);
  copy.id = createTextId();
  copy.x = clampTextCoordinate(source.x + offset);
  copy.y = clampTextCoordinate(source.y + offset);
  return { texts: [...texts, copy], newId: copy.id };
}

export function deleteTextObject(
  texts: EditorTextObject[],
  id: string,
): EditorTextObject[] {
  return texts.filter((t) => t.id !== id);
}
