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

export function calculateOutputDimensions(
  sourceWidth: number,
  sourceHeight: number,
  presetId: ResolutionPresetId,
): { width: number; height: number } {
  const preset = getResolutionPreset(presetId);
  const longEdge = Math.max(sourceWidth, sourceHeight);

  if (longEdge <= preset.maxLongEdge) {
    return { width: sourceWidth, height: sourceHeight };
  }

  const scale = preset.maxLongEdge / longEdge;
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
