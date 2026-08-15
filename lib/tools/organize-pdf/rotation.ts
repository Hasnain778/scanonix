import type { OrganizePageRotation } from "./types";

/** Normalize pdf-lib rotation angles to 0 | 90 | 180 | 270. */
export function normalizePageRotation(angle: number): OrganizePageRotation {
  const normalized = ((Math.round(angle) % 360) + 360) % 360;
  if (normalized === 90 || normalized === 180 || normalized === 270) {
    return normalized;
  }
  return 0;
}

/** Clockwise rotation cycle: 0 → 90 → 180 → 270 → 0. */
export function nextRotationClockwise(
  rotation: OrganizePageRotation,
): OrganizePageRotation {
  return normalizePageRotation(rotation + 90);
}

/** Counter-clockwise rotation cycle: 0 → 270 → 180 → 90 → 0. */
export function nextRotationCounterClockwise(
  rotation: OrganizePageRotation,
): OrganizePageRotation {
  return normalizePageRotation(rotation + 270);
}

/** Final rotation applied on export (intrinsic + user delta). */
export function getEffectiveRotation(
  intrinsicRotation: OrganizePageRotation,
  rotationDelta: OrganizePageRotation,
): OrganizePageRotation {
  return normalizePageRotation(intrinsicRotation + rotationDelta);
}
