/**
 * IE-4A curated filter presets — typed single source.
 * Filters are adjustment presets applied before manual Adjust values.
 */

import {
  clampSigned,
  clampUnsigned,
  createNeutralAdjustments,
  type EditorAdjustments,
} from "@/lib/image-editor/adjustments";

export const ORIGINAL_FILTER_ID = "original" as const;

export interface EditorFilterPreset {
  id: string;
  name: string;
  /** Adjustment delta applied at intensity 100%. Neutral for Original. */
  adjustments: EditorAdjustments;
}

function adj(partial: Partial<EditorAdjustments>): EditorAdjustments {
  return { ...createNeutralAdjustments(), ...partial };
}

/** Curated filter catalog — quality over quantity. */
export const EDITOR_FILTERS: readonly EditorFilterPreset[] = [
  { id: ORIGINAL_FILTER_ID, name: "Original", adjustments: createNeutralAdjustments() },
  {
    id: "vivid",
    name: "Vivid",
    adjustments: adj({ saturation: 38, vibrance: 28, contrast: 12 }),
  },
  {
    id: "warm",
    name: "Warm",
    adjustments: adj({ temperature: 42, tint: 8, saturation: 12, brightness: 4 }),
  },
  {
    id: "cool",
    name: "Cool",
    adjustments: adj({ temperature: -42, tint: -6, saturation: 8, contrast: 6 }),
  },
  {
    id: "vintage",
    name: "Vintage",
    adjustments: adj({
      temperature: 28,
      saturation: -22,
      contrast: -8,
      highlights: -18,
      shadows: 14,
      tint: 10,
    }),
  },
  {
    id: "fade",
    name: "Fade",
    adjustments: adj({
      contrast: -28,
      brightness: 10,
      highlights: 22,
      shadows: 12,
      saturation: -18,
    }),
  },
  {
    id: "mono",
    name: "Mono",
    adjustments: adj({ grayscale: 100, contrast: 10 }),
  },
  {
    id: "noir",
    name: "Noir",
    adjustments: adj({
      grayscale: 100,
      contrast: 38,
      shadows: -22,
      highlights: -16,
      brightness: -4,
    }),
  },
  {
    id: "sepia",
    name: "Sepia",
    adjustments: adj({
      grayscale: 78,
      temperature: 48,
      tint: 18,
      contrast: -6,
      brightness: 4,
    }),
  },
  {
    id: "dramatic",
    name: "Dramatic",
    adjustments: adj({
      contrast: 42,
      shadows: -28,
      highlights: -22,
      saturation: 16,
      vibrance: 10,
    }),
  },
  {
    id: "soft",
    name: "Soft",
    adjustments: adj({
      contrast: -16,
      brightness: 6,
      highlights: 14,
      blur: 10,
      saturation: -6,
    }),
  },
  {
    id: "cinematic",
    name: "Cinematic",
    adjustments: adj({
      contrast: 22,
      temperature: -16,
      saturation: -12,
      shadows: -18,
      highlights: -12,
      tint: 6,
      vibrance: 8,
    }),
  },
] as const;

export function getFilterCatalog(): readonly EditorFilterPreset[] {
  return EDITOR_FILTERS;
}

export function getFilterById(id: string): EditorFilterPreset | undefined {
  return EDITOR_FILTERS.find((f) => f.id === id);
}

export function isOriginalFilter(id: string): boolean {
  return id === ORIGINAL_FILTER_ID;
}

export interface EditorFilterState {
  filterId: string;
  /** 0–100; ignored when Original */
  intensity: number;
}

export function createDefaultFilterState(): EditorFilterState {
  return { filterId: ORIGINAL_FILTER_ID, intensity: 100 };
}

export function cloneFilterState(state: EditorFilterState): EditorFilterState {
  return { filterId: state.filterId, intensity: state.intensity };
}

export function filterStatesEqual(a: EditorFilterState, b: EditorFilterState): boolean {
  return a.filterId === b.filterId && a.intensity === b.intensity;
}

export function clampFilterIntensity(value: number): number {
  if (!Number.isFinite(value)) return 100;
  return Math.min(100, Math.max(0, Math.round(value)));
}

function scaleAdjustments(
  source: EditorAdjustments,
  t: number,
): EditorAdjustments {
  const s = Math.min(1, Math.max(0, t));
  return {
    brightness: clampSigned(source.brightness * s),
    exposure: clampSigned(source.exposure * s),
    contrast: clampSigned(source.contrast * s),
    highlights: clampSigned(source.highlights * s),
    shadows: clampSigned(source.shadows * s),
    saturation: clampSigned(source.saturation * s),
    vibrance: clampSigned(source.vibrance * s),
    temperature: clampSigned(source.temperature * s),
    tint: clampSigned(source.tint * s),
    sharpness: clampUnsigned(source.sharpness * s),
    blur: clampUnsigned(source.blur * s),
    grayscale: clampUnsigned(source.grayscale * s),
  };
}

function addAdjustments(
  a: EditorAdjustments,
  b: EditorAdjustments,
): EditorAdjustments {
  return {
    brightness: clampSigned(a.brightness + b.brightness),
    exposure: clampSigned(a.exposure + b.exposure),
    contrast: clampSigned(a.contrast + b.contrast),
    highlights: clampSigned(a.highlights + b.highlights),
    shadows: clampSigned(a.shadows + b.shadows),
    saturation: clampSigned(a.saturation + b.saturation),
    vibrance: clampSigned(a.vibrance + b.vibrance),
    temperature: clampSigned(a.temperature + b.temperature),
    tint: clampSigned(a.tint + b.tint),
    sharpness: clampUnsigned(a.sharpness + b.sharpness),
    blur: clampUnsigned(a.blur + b.blur),
    grayscale: clampUnsigned(a.grayscale + b.grayscale),
  };
}

/**
 * Compose filter (scaled by intensity) then manual adjustments.
 * Order: filter → manual. Selecting a filter does not wipe manual values.
 */
export function composeImageAdjustments(
  filterState: EditorFilterState,
  manual: EditorAdjustments,
): EditorAdjustments {
  if (isOriginalFilter(filterState.filterId) || filterState.intensity <= 0) {
    return { ...manual };
  }
  const preset = getFilterById(filterState.filterId);
  if (!preset) return { ...manual };
  const scaled = scaleAdjustments(preset.adjustments, filterState.intensity / 100);
  return addAdjustments(scaled, manual);
}

export function resetFilterState(): EditorFilterState {
  return createDefaultFilterState();
}
