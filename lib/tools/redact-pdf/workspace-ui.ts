/** Workspace UI helpers for Redact PDF client editor (Phase 125C). */

import { detectExistingDigitalSignatures } from "@/lib/tools/fill-pdf/detect-form";
import {
  addRedaction,
  canExportRedactPdf,
  getRedactionsForPage,
  removeRedaction,
  updateRedaction,
  validateExportRedactionState,
} from "./redaction-state";
import {
  clampNormalizedRedaction,
  createRedactionPageGeometry,
} from "./coordinates";
import { MIN_NORMALIZED_REDACTION_SIZE } from "./limits";
import type {
  NormalizedRedactionRect,
  RedactionDocumentState,
  RedactionRect,
} from "./types";
import { RedactPdfError, REDACT_PRIVACY_COPY } from "./types";

export { REDACT_PRIVACY_COPY };

export const REDACT_DRAW_MODE = "draw" as const;
export type RedactEditorMode = typeof REDACT_DRAW_MODE;

export const REDACT_PERMANENT_APPLIED_COPY =
  "Redactions are permanently applied to the exported PDF.";

export const REDACT_SANITIZATION_LIMITATION_COPY =
  "Page-region redaction does not automatically remove document metadata, attachments, or other hidden information outside the selected page areas.";

export const REDACT_RASTER_QUALITY_COPY =
  "Pages containing redactions are rebuilt as images to remove underlying content. Text on those pages may no longer be selectable.";

export const REDACT_FORM_ANNOTATION_WARNING =
  "Interactive fields or annotations on redacted pages may be flattened or removed.";

export const DIGITAL_SIGNATURE_REDACT_WARNING =
  "Redacting this PDF may invalidate existing digital signatures.";

export type RedactionResizeHandle =
  | "nw"
  | "n"
  | "ne"
  | "w"
  | "e"
  | "sw"
  | "s"
  | "se";

export interface RedactionHistoryState {
  past: RedactionRect[][];
  present: RedactionRect[];
  future: RedactionRect[][];
}

export interface NormalizedPointerPoint {
  x: number;
  y: number;
}

function cloneRedactions(redactions: RedactionRect[]): RedactionRect[] {
  return redactions.map((rect) => ({ ...rect }));
}

export function isRedactDrawModeActive(mode: RedactEditorMode): boolean {
  return mode === REDACT_DRAW_MODE;
}

export function canExportRedactWorkspace(
  state: RedactionDocumentState,
  isExporting: boolean,
): boolean {
  return canExportRedactPdf(state) && !isExporting;
}

export function detectRedactPdfWarnings(
  pdfBytes: ArrayBuffer | Uint8Array,
): { hasExistingDigitalSignatures: boolean } {
  return {
    hasExistingDigitalSignatures: detectExistingDigitalSignatures(pdfBytes),
  };
}

export function moveNormalizedRedaction(
  rect: NormalizedRedactionRect,
  deltaX: number,
  deltaY: number,
): NormalizedRedactionRect {
  return clampNormalizedRedaction({
    ...rect,
    x: rect.x + deltaX,
    y: rect.y + deltaY,
  });
}

export function resizeNormalizedRedaction(
  rect: NormalizedRedactionRect,
  handle: RedactionResizeHandle,
  deltaX: number,
  deltaY: number,
): NormalizedRedactionRect {
  let { x, y, width, height } = rect;

  switch (handle) {
    case "nw":
      x += deltaX;
      y += deltaY;
      width -= deltaX;
      height -= deltaY;
      break;
    case "n":
      y += deltaY;
      height -= deltaY;
      break;
    case "ne":
      y += deltaY;
      width += deltaX;
      height -= deltaY;
      break;
    case "w":
      x += deltaX;
      width -= deltaX;
      break;
    case "e":
      width += deltaX;
      break;
    case "sw":
      x += deltaX;
      width -= deltaX;
      height += deltaY;
      break;
    case "s":
      height += deltaY;
      break;
    case "se":
      width += deltaX;
      height += deltaY;
      break;
    default:
      break;
  }

  return clampNormalizedRedaction({ x, y, width, height });
}

/** Convert pointer drag in normalized overlay coordinates to a redaction rect. */
export function normalizedRedactionFromPointerDrag(
  start: NormalizedPointerPoint,
  end: NormalizedPointerPoint,
): NormalizedRedactionRect | null {
  const x = Math.min(start.x, end.x);
  const y = Math.min(start.y, end.y);
  const width = Math.abs(end.x - start.x);
  const height = Math.abs(end.y - start.y);

  if (
    width < MIN_NORMALIZED_REDACTION_SIZE ||
    height < MIN_NORMALIZED_REDACTION_SIZE
  ) {
    return null;
  }

  const clamped = clampNormalizedRedaction({ x, y, width, height });
  return clamped.width >= MIN_NORMALIZED_REDACTION_SIZE &&
    clamped.height >= MIN_NORMALIZED_REDACTION_SIZE
    ? clamped
    : null;
}

export function pointerToNormalizedPoint(
  clientX: number,
  clientY: number,
  containerRect: DOMRectLike,
): NormalizedPointerPoint {
  const width = containerRect.width || 1;
  const height = containerRect.height || 1;
  const x = (clientX - containerRect.left) / width;
  const y = (clientY - containerRect.top) / height;

  return {
    x: Math.max(0, Math.min(1, x)),
    y: Math.max(0, Math.min(1, y)),
  };
}

export interface DOMRectLike {
  left: number;
  top: number;
  width: number;
  height: number;
}

export function createRedactionHistory(
  redactions: RedactionRect[],
): RedactionHistoryState {
  return {
    past: [],
    present: cloneRedactions(redactions),
    future: [],
  };
}

export function commitRedactionHistory(
  history: RedactionHistoryState,
  nextRedactions: RedactionRect[],
): RedactionHistoryState {
  return {
    past: [...history.past, history.present],
    present: cloneRedactions(nextRedactions),
    future: [],
  };
}

export function undoRedactionHistory(
  history: RedactionHistoryState,
): RedactionHistoryState | null {
  if (history.past.length === 0) {
    return null;
  }

  const previous = history.past[history.past.length - 1];
  return {
    past: history.past.slice(0, -1),
    present: cloneRedactions(previous),
    future: [history.present, ...history.future],
  };
}

export function redoRedactionHistory(
  history: RedactionHistoryState,
): RedactionHistoryState | null {
  if (history.future.length === 0) {
    return null;
  }

  const [next, ...remainingFuture] = history.future;
  return {
    past: [...history.past, history.present],
    present: cloneRedactions(next),
    future: remainingFuture,
  };
}

export function applyRedactionsToDocumentState(
  state: RedactionDocumentState,
  redactions: RedactionRect[],
): RedactionDocumentState {
  return { ...state, redactions: cloneRedactions(redactions) };
}

export function addRedactionToState(
  state: RedactionDocumentState,
  pageIndex: number,
  normalizedRect: NormalizedRedactionRect,
): RedactionDocumentState {
  return addRedaction(state, pageIndex, normalizedRect);
}

export function updateRedactionInState(
  state: RedactionDocumentState,
  redactionId: string,
  normalizedRect: NormalizedRedactionRect,
): RedactionDocumentState {
  return updateRedaction(state, redactionId, normalizedRect);
}

export function removeRedactionFromState(
  state: RedactionDocumentState,
  redactionId: string,
): RedactionDocumentState {
  return removeRedaction(state, redactionId);
}

export function clearRedactionsForPage(
  state: RedactionDocumentState,
  pageIndex: number,
): RedactionDocumentState {
  return {
    ...state,
    redactions: state.redactions.filter((rect) => rect.pageIndex !== pageIndex),
  };
}

export function clearAllRedactions(
  state: RedactionDocumentState,
): RedactionDocumentState {
  return { ...state, redactions: [] };
}

export function getRedactionNavigatorItems(
  state: RedactionDocumentState,
): Array<{ id: string; pageIndex: number; label: string }> {
  const counts = new Map<number, number>();

  return state.redactions.map((rect) => {
    const nextCount = (counts.get(rect.pageIndex) ?? 0) + 1;
    counts.set(rect.pageIndex, nextCount);
    return {
      id: rect.id,
      pageIndex: rect.pageIndex,
      label: `Page ${rect.pageIndex + 1} — Redaction ${nextCount}`,
    };
  });
}

export const REDACT_ZOOM_MIN = 0.5;
export const REDACT_ZOOM_MAX = 2;
export const REDACT_ZOOM_STEP = 0.25;

export function clampRedactZoom(zoom: number): number {
  if (!Number.isFinite(zoom)) {
    return 1;
  }
  return Math.min(REDACT_ZOOM_MAX, Math.max(REDACT_ZOOM_MIN, zoom));
}

export function stepRedactZoom(current: number, direction: "in" | "out"): number {
  const delta = direction === "in" ? REDACT_ZOOM_STEP : -REDACT_ZOOM_STEP;
  return clampRedactZoom(Math.round((current + delta) * 100) / 100);
}

export function computeFitWidthZoom(
  containerWidth: number,
  basePageWidth: number,
): number {
  if (!Number.isFinite(containerWidth) || !Number.isFinite(basePageWidth)) {
    return 1;
  }
  if (basePageWidth <= 0) {
    return 1;
  }
  return clampRedactZoom(containerWidth / basePageWidth);
}

/** Zoom adjusts display only — normalized redaction coordinates stay unchanged. */
export function zoomPreservesNormalizedRedactions(
  before: RedactionRect[],
  after: RedactionRect[],
): boolean {
  if (before.length !== after.length) {
    return false;
  }

  return before.every((rect, index) => {
    const other = after[index];
    return (
      rect.id === other.id &&
      rect.x === other.x &&
      rect.y === other.y &&
      rect.width === other.width &&
      rect.height === other.height &&
      rect.pageIndex === other.pageIndex
    );
  });
}

export function computeRedactionOverlayStyle(
  rect: NormalizedRedactionRect,
  selected: boolean,
): { left: string; top: string; width: string; height: string; className: string } {
  return {
    left: `${rect.x * 100}%`,
    top: `${rect.y * 100}%`,
    width: `${rect.width * 100}%`,
    height: `${rect.height * 100}%`,
    className: selected
      ? "border-2 border-scanonix-orange ring-2 ring-scanonix-orange/30"
      : "border border-black/60",
  };
}

export function createRedactionPageGeometryForEntry(
  pageEntry: RedactionDocumentState["pages"][number],
) {
  return createRedactionPageGeometry(
    pageEntry.mediaBox,
    pageEntry.originalCropBox,
    pageEntry.intrinsicRotation,
  );
}

/** Policy: raster failures abort export — never fall back to original page content. */
export function shouldAbortExportOnRasterFailure(): boolean {
  return true;
}

export function resolveRedactExportErrorMessage(error: unknown): string {
  if (error instanceof RedactPdfError) {
    return error.message;
  }

  return error instanceof Error
    ? error.message
    : "Could not export redacted PDF.";
}

export function getActivePageRedactions(
  state: RedactionDocumentState,
  pageIndex: number,
): RedactionRect[] {
  return getRedactionsForPage(state.redactions, pageIndex);
}

export function shouldShowFormAnnotationWarning(
  state: RedactionDocumentState,
): boolean {
  return state.redactions.length > 0;
}
