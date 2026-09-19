/**
 * On-demand FontFace loader for editor-bundled fonts.
 * Site (Geist) and system fonts resolve via document.fonts.load only.
 */

import {
  getFontFamily,
  type EditorFontFamilyId,
  type EditorFontWeight,
} from "@/lib/image-editor/fonts/registry";

const loadedKeys = new Set<string>();
const inflight = new Map<string, Promise<void>>();

function faceKey(familyId: string, weight: EditorFontWeight): string {
  return `${familyId}:${weight}`;
}

async function registerFace(
  familyId: string,
  weight: EditorFontWeight,
): Promise<void> {
  const key = faceKey(familyId, weight);
  if (loadedKeys.has(key)) return;
  if (inflight.has(key)) return inflight.get(key);

  const promise = (async () => {
    if (typeof document === "undefined" || !document.fonts) {
      loadedKeys.add(key);
      return;
    }
    const family = getFontFamily(familyId);
    if (family.source === "system" || family.source === "site") {
      try {
        await document.fonts.load(`${weight} 48px ${family.cssFamily}`);
      } catch {
        /* ignore */
      }
      loadedKeys.add(key);
      return;
    }

    const file = family.files.find((f) => f.weight === weight);
    if (!file) {
      loadedKeys.add(key);
      return;
    }

    try {
      const face = new FontFace(family.cssFamily, `url(${file.path})`, {
        style: "normal",
        weight,
        display: "swap",
      });
      const loaded = await face.load();
      document.fonts.add(loaded);
      loadedKeys.add(key);
    } catch {
      // Mark attempted so we don't spin; canvas falls back to stack.
      loadedKeys.add(key);
    }
  })();

  inflight.set(key, promise);
  try {
    await promise;
  } finally {
    inflight.delete(key);
  }
}

/** Load specific weights for a family (default: all declared weights). */
export async function loadEditorFontFamily(
  familyId: string,
  weights?: EditorFontWeight[],
): Promise<void> {
  const family = getFontFamily(familyId);
  const list = weights?.length ? weights : family.weights;
  await Promise.all(list.map((w) => registerFace(family.id, w)));
}

/** Load fonts used by document text objects (export path). */
export async function ensureEditorFontsLoaded(
  familyIds?: string[],
): Promise<void> {
  if (typeof document === "undefined") return;
  const ids = familyIds?.length
    ? familyIds
    : (["geist-sans"] as EditorFontFamilyId[]);
  await Promise.all(ids.map((id) => loadEditorFontFamily(id)));
  try {
    await document.fonts.ready;
  } catch {
    /* ignore */
  }
}

export function isEditorFontFaceReady(
  familyId: string,
  weight: EditorFontWeight,
): boolean {
  return loadedKeys.has(faceKey(familyId, weight));
}

/** Test helper — clear loader cache. */
export function __resetEditorFontLoaderForTests(): void {
  loadedKeys.clear();
  inflight.clear();
}
