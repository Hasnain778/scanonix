export type BackgroundPreviewMode =
  | "transparent"
  | "white"
  | "black"
  | "custom"
  | "gradient"
  | "upload";

/** HD (free) and 4K (premium) export presets. */
export type ResolutionPresetId = "hd" | "4k";

export type ExportFormat = "png" | "jpg" | "webp";

export interface ResolutionPreset {
  id: ResolutionPresetId;
  label: string;
  description: string;
  maxLongEdge: number;
  premium: boolean;
}

export const RESOLUTION_PRESETS: ResolutionPreset[] = [
  {
    id: "hd",
    label: "HD",
    description: "1920px longest edge",
    maxLongEdge: 1920,
    premium: false,
  },
  {
    id: "4k",
    label: "4K",
    description: "3840px longest edge",
    maxLongEdge: 3840,
    premium: true,
  },
];

export function getResolutionPreset(id: ResolutionPresetId): ResolutionPreset {
  const preset = RESOLUTION_PRESETS.find((item) => item.id === id);
  if (!preset) {
    return RESOLUTION_PRESETS[0];
  }
  return preset;
}

/**
 * Export target long edge for a preset.
 * HD always targets 1920px. 4K upscales small images to 3840px, preserves native
 * size between 1921–3840px, and downscales above 3840px.
 */
function resolveExportTargetLongEdge(
  sourceWidth: number,
  sourceHeight: number,
  presetId: ResolutionPresetId,
): number {
  const preset = getResolutionPreset(presetId);
  const longEdge = Math.max(sourceWidth, sourceHeight);

  if (presetId === "hd") {
    return preset.maxLongEdge;
  }

  const hdMaxLongEdge = getResolutionPreset("hd").maxLongEdge;

  if (longEdge > preset.maxLongEdge) {
    return preset.maxLongEdge;
  }

  if (longEdge > hdMaxLongEdge) {
    return longEdge;
  }

  return preset.maxLongEdge;
}

export function calculateOutputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  presetId: ResolutionPresetId,
): { width: number; height: number } {
  const longEdge = Math.max(sourceWidth, sourceHeight);

  if (longEdge <= 0) {
    return { width: 1, height: 1 };
  }

  const targetLongEdge = resolveExportTargetLongEdge(
    sourceWidth,
    sourceHeight,
    presetId,
  );

  if (longEdge === targetLongEdge) {
    return { width: sourceWidth, height: sourceHeight };
  }

  const scale = targetLongEdge / longEdge;
  return {
    width: Math.max(1, Math.round(sourceWidth * scale)),
    height: Math.max(1, Math.round(sourceHeight * scale)),
  };
}

export function isPremiumResolution(presetId: ResolutionPresetId): boolean {
  return getResolutionPreset(presetId).premium;
}

export function getExportFilename(format: ExportFormat): string {
  return `scanonix-background-removed.${format}`;
}

export function getAllowedPresets(isPremium: boolean): ResolutionPresetId[] {
  return isPremium ? ["hd", "4k"] : ["hd"];
}
