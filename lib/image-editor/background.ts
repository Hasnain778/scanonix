/**
 * IE-4A canvas background model — behind image content, not background removal.
 */

export type EditorBackgroundType = "transparent" | "color";

export interface EditorBackground {
  type: EditorBackgroundType;
  /** Hex color when type === "color" */
  color: string;
}

export const BACKGROUND_PRESET_SWATCHES: readonly {
  id: string;
  label: string;
  background: EditorBackground;
}[] = [
  { id: "transparent", label: "Transparent", background: { type: "transparent", color: "#ffffff" } },
  { id: "white", label: "White", background: { type: "color", color: "#ffffff" } },
  { id: "black", label: "Black", background: { type: "color", color: "#000000" } },
  { id: "light-gray", label: "Light gray", background: { type: "color", color: "#e5e7eb" } },
  { id: "dark-gray", label: "Dark gray", background: { type: "color", color: "#374151" } },
  { id: "scanonix-orange", label: "Scanonix orange", background: { type: "color", color: "#f97316" } },
] as const;

export function createDefaultBackground(): EditorBackground {
  return { type: "transparent", color: "#ffffff" };
}

export function cloneBackground(bg: EditorBackground): EditorBackground {
  return { type: bg.type, color: bg.color };
}

export function backgroundsEqual(a: EditorBackground, b: EditorBackground): boolean {
  if (a.type !== b.type) return false;
  if (a.type === "transparent") return true;
  return normalizeHex(a.color) === normalizeHex(b.color);
}

export function normalizeHex(input: string): string {
  let hex = input.trim().toLowerCase();
  if (!hex.startsWith("#")) hex = `#${hex}`;
  if (/^#[0-9a-f]{3}$/.test(hex)) {
    hex = `#${hex[1]}${hex[1]}${hex[2]}${hex[2]}${hex[3]}${hex[3]}`;
  }
  if (!/^#[0-9a-f]{6}$/.test(hex)) {
    return "#ffffff";
  }
  return hex;
}

export function isValidHexColor(input: string): boolean {
  const hex = input.trim().toLowerCase();
  return /^#?[0-9a-f]{3}$/.test(hex) || /^#?[0-9a-f]{6}$/.test(hex);
}

export function createColorBackground(color: string): EditorBackground {
  return { type: "color", color: normalizeHex(color) };
}

export function createTransparentBackground(): EditorBackground {
  return { type: "transparent", color: "#ffffff" };
}

export function resetBackground(): EditorBackground {
  return createDefaultBackground();
}

/** JPEG flatten fill when canvas background is transparent. */
export function jpegFlattenColor(bg: EditorBackground): string {
  if (bg.type === "color") return normalizeHex(bg.color);
  return "#ffffff";
}
