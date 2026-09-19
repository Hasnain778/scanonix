/**
 * Pure document history — snapshots EditorDocument only (no bitmaps).
 */

import {
  HISTORY_CAP,
  cloneDocument,
  createInitialDocument,
  documentsEqual,
  type EditorDocument,
} from "@/lib/image-editor/document";

export interface DocumentHistoryState {
  past: EditorDocument[];
  present: EditorDocument;
  future: EditorDocument[];
}

export function createHistory(
  initial: EditorDocument = createInitialDocument(),
): DocumentHistoryState {
  return {
    past: [],
    present: cloneDocument(initial),
    future: [],
  };
}

export function commitDocument(
  state: DocumentHistoryState,
  next: EditorDocument,
  cap = HISTORY_CAP,
): DocumentHistoryState {
  if (documentsEqual(state.present, next)) {
    return state;
  }

  const past = [...state.past, cloneDocument(state.present)];
  while (past.length > cap) {
    past.shift();
  }

  return {
    past,
    present: cloneDocument(next),
    future: [],
  };
}

export function replacePresent(
  state: DocumentHistoryState,
  next: EditorDocument,
): DocumentHistoryState {
  return {
    ...state,
    present: cloneDocument(next),
  };
}

export function undo(state: DocumentHistoryState): DocumentHistoryState {
  if (state.past.length === 0) return state;
  const past = [...state.past];
  const previous = past.pop()!;
  return {
    past,
    present: previous,
    future: [cloneDocument(state.present), ...state.future],
  };
}

export function redo(state: DocumentHistoryState): DocumentHistoryState {
  if (state.future.length === 0) return state;
  const [next, ...rest] = state.future;
  return {
    past: [...state.past, cloneDocument(state.present)],
    present: cloneDocument(next),
    future: rest,
  };
}

export function resetDocument(
  state: DocumentHistoryState,
  initial: EditorDocument = createInitialDocument(),
  cap = HISTORY_CAP,
): DocumentHistoryState {
  return commitDocument(state, initial, cap);
}

export function canUndo(state: DocumentHistoryState): boolean {
  return state.past.length > 0;
}

export function canRedo(state: DocumentHistoryState): boolean {
  return state.future.length > 0;
}

/** Test helper: history never stores bitmaps / canvases. */
export function historyIsDocumentOnly(state: DocumentHistoryState): boolean {
  const all = [...state.past, state.present, ...state.future];
  return all.every((doc) => {
    if (typeof doc.canvas !== "object" || typeof doc.content !== "object") {
      return false;
    }
    if (typeof doc.adjustments !== "object") return false;
    if (typeof doc.filter !== "object") return false;
    if (typeof doc.background !== "object") return false;
    if (!Array.isArray(doc.texts)) return false;
    if ("bitmap" in doc || "imageData" in doc) return false;
    if (typeof (doc as { canvasEl?: unknown }).canvasEl !== "undefined") {
      return false;
    }
    return (
      typeof doc.adjustments.brightness === "number" &&
      typeof doc.filter.filterId === "string" &&
      typeof doc.background.type === "string" &&
      typeof doc.rotation === "number" &&
      typeof doc.canvas.width === "number" &&
      typeof doc.content.mode === "string" &&
      doc.texts.every(
        (t) =>
          typeof t === "object" &&
          t !== null &&
          typeof (t as { id?: unknown }).id === "string" &&
          typeof (t as { text?: unknown }).text === "string" &&
          !("bitmap" in t) &&
          !("canvas" in t),
      )
    );
  });
}
