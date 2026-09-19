/**
 * Social / content canvas presets — single typed data source.
 */

export type CanvasPresetFamily =
  | "instagram"
  | "facebook"
  | "youtube"
  | "x"
  | "linkedin"
  | "tiktok"
  | "general"
  | "custom";

export interface CanvasPreset {
  id: string;
  family: CanvasPresetFamily;
  label: string;
  width: number;
  height: number;
}

export const CANVAS_PRESET_FAMILIES: {
  id: CanvasPresetFamily;
  label: string;
}[] = [
  { id: "instagram", label: "Instagram" },
  { id: "facebook", label: "Facebook" },
  { id: "youtube", label: "YouTube" },
  { id: "x", label: "X / Twitter" },
  { id: "linkedin", label: "LinkedIn" },
  { id: "tiktok", label: "TikTok" },
  { id: "general", label: "General" },
  { id: "custom", label: "Custom" },
];

/** Canonical preset list — do not scatter dimensions in UI. */
export const CANVAS_PRESETS: readonly CanvasPreset[] = [
  // Instagram
  { id: "ig-post", family: "instagram", label: "Instagram Post", width: 1080, height: 1080 },
  { id: "ig-portrait", family: "instagram", label: "Instagram Portrait Post", width: 1080, height: 1350 },
  { id: "ig-story", family: "instagram", label: "Instagram Story", width: 1080, height: 1920 },
  { id: "ig-reel", family: "instagram", label: "Instagram Reel", width: 1080, height: 1920 },
  { id: "ig-profile", family: "instagram", label: "Instagram Profile Picture", width: 1080, height: 1080 },
  // Facebook
  { id: "fb-post", family: "facebook", label: "Facebook Post", width: 1200, height: 630 },
  { id: "fb-cover", family: "facebook", label: "Facebook Cover", width: 851, height: 315 },
  { id: "fb-profile", family: "facebook", label: "Facebook Profile Picture", width: 1080, height: 1080 },
  { id: "fb-story", family: "facebook", label: "Facebook Story", width: 1080, height: 1920 },
  // YouTube
  { id: "yt-thumb", family: "youtube", label: "YouTube Thumbnail", width: 1280, height: 720 },
  { id: "yt-banner", family: "youtube", label: "YouTube Channel Banner", width: 2560, height: 1440 },
  { id: "yt-profile", family: "youtube", label: "YouTube Profile Picture", width: 800, height: 800 },
  // X
  { id: "x-post", family: "x", label: "X Post", width: 1600, height: 900 },
  { id: "x-header", family: "x", label: "X Header", width: 1500, height: 500 },
  { id: "x-profile", family: "x", label: "X Profile Picture", width: 400, height: 400 },
  // LinkedIn
  { id: "li-post", family: "linkedin", label: "LinkedIn Post", width: 1200, height: 627 },
  { id: "li-profile", family: "linkedin", label: "LinkedIn Profile Picture", width: 400, height: 400 },
  { id: "li-cover", family: "linkedin", label: "LinkedIn Cover", width: 1584, height: 396 },
  // TikTok
  { id: "tt-video", family: "tiktok", label: "TikTok Video / Story", width: 1080, height: 1920 },
  { id: "tt-profile", family: "tiktok", label: "TikTok Profile Picture", width: 200, height: 200 },
  // General
  { id: "gen-square", family: "general", label: "Square", width: 1080, height: 1080 },
  { id: "gen-portrait", family: "general", label: "Portrait", width: 1080, height: 1350 },
  { id: "gen-landscape", family: "general", label: "Landscape", width: 1920, height: 1080 },
  { id: "gen-hd", family: "general", label: "HD", width: 1280, height: 720 },
  { id: "gen-fhd", family: "general", label: "Full HD", width: 1920, height: 1080 },
] as const;

export const CUSTOM_PRESET_ID = "custom" as const;

export const CANVAS_MIN = 32;
export const CANVAS_MAX = 8192;

export function getPresetById(id: string): CanvasPreset | undefined {
  return CANVAS_PRESETS.find((p) => p.id === id);
}

export function getPresetsByFamily(family: CanvasPresetFamily): CanvasPreset[] {
  return CANVAS_PRESETS.filter((p) => p.family === family);
}

export function validateCanvasDimensions(
  width: number,
  height: number,
): { ok: true; width: number; height: number } | { ok: false; error: string } {
  if (!Number.isFinite(width) || !Number.isFinite(height)) {
    return { ok: false, error: "Width and height must be numbers." };
  }
  const w = Math.round(width);
  const h = Math.round(height);
  if (w < CANVAS_MIN || h < CANVAS_MIN) {
    return { ok: false, error: `Minimum size is ${CANVAS_MIN}×${CANVAS_MIN}.` };
  }
  if (w > CANVAS_MAX || h > CANVAS_MAX) {
    return { ok: false, error: `Maximum size is ${CANVAS_MAX}×${CANVAS_MAX}.` };
  }
  return { ok: true, width: w, height: h };
}

export function formatCanvasSize(width: number, height: number): string {
  return `${width} × ${height}`;
}
