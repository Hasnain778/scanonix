import {
  PSD_DEFAULT_LAYER_NAME,
  PSD_LAYER_NAME_MAX_LENGTH,
} from "./types";

/**
 * Deterministic PSD layer label sanitizer (not a download filename).
 */
export function sanitizePsdLayerName(raw: string | undefined | null): string {
  if (raw == null) return PSD_DEFAULT_LAYER_NAME;

  // Strip C0 controls + DEL; normalize whitespace
  let name = String(raw)
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .replace(/\s+/g, " ")
    .trim();

  if (!name) return PSD_DEFAULT_LAYER_NAME;

  if (name.length > PSD_LAYER_NAME_MAX_LENGTH) {
    name = name.slice(0, PSD_LAYER_NAME_MAX_LENGTH).trim();
  }

  return name || PSD_DEFAULT_LAYER_NAME;
}
