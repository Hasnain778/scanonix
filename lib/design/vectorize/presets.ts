import type { ImageTracerOptions } from "imagetracerjs";
import type { VectorizeImageOptions, VectorizePreset } from "./types";

export interface ResolvedVectorizeSettings {
  preset: VectorizePreset;
  colorCount: number;
  pathOmit: number;
  lineThreshold: number;
  curveThreshold: number;
  ignoreBackground: boolean;
  blurRadius: number;
  tracerOptions: ImageTracerOptions;
}

const PRESET_DEFAULTS: Record<
  VectorizePreset,
  Omit<ResolvedVectorizeSettings, "preset" | "tracerOptions">
> = {
  // Balanced starting point for general raster → SVG.
  general: {
    colorCount: 12,
    pathOmit: 8,
    lineThreshold: 1,
    curveThreshold: 1,
    ignoreBackground: false,
    blurRadius: 0,
  },
  // Few colors, stronger noise omit, slight blur — logos/icons.
  logo: {
    colorCount: 6,
    pathOmit: 12,
    lineThreshold: 1.5,
    curveThreshold: 1.5,
    ignoreBackground: true,
    blurRadius: 1,
  },
  // More colors / fidelity reserved for future advanced UI.
  advanced: {
    colorCount: 24,
    pathOmit: 4,
    lineThreshold: 0.8,
    curveThreshold: 0.8,
    ignoreBackground: false,
    blurRadius: 0,
  },
};

function clamp(n: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, n));
}

/**
 * Resolve public options into imagetracer settings.
 * `detail` maps to pathomit (higher detail → lower omit).
 * `smoothing` raises line/curve error thresholds.
 */
export function resolveVectorizeSettings(
  options: VectorizeImageOptions = {},
): ResolvedVectorizeSettings {
  const preset = options.preset ?? "general";
  const base = PRESET_DEFAULTS[preset];

  const colorCount = clamp(
    options.colorCount ?? base.colorCount,
    2,
    64,
  );

  const pathOmit =
    options.detail !== undefined
      ? clamp(Math.round(32 - options.detail), 0, 32)
      : base.pathOmit;

  const smoothing = options.smoothing;
  const lineThreshold =
    smoothing !== undefined
      ? clamp(smoothing, 0.1, 8)
      : base.lineThreshold;
  const curveThreshold =
    smoothing !== undefined
      ? clamp(smoothing, 0.1, 8)
      : base.curveThreshold;

  const ignoreBackground = options.ignoreBackground ?? base.ignoreBackground;

  const tracerOptions: ImageTracerOptions = {
    // Deterministic palette sampling for stable verifier output.
    colorsampling: 2,
    numberofcolors: colorCount,
    pathomit: pathOmit,
    ltres: lineThreshold,
    qtres: curveThreshold,
    rightangleenhance: true,
    linefilter: preset === "logo",
    blurradius: base.blurRadius,
    blurdelta: 20,
    strokewidth: 1,
    scale: 1,
    roundcoords: 1,
    viewbox: true,
    desc: false,
    layering: 0,
  };

  return {
    preset,
    colorCount,
    pathOmit,
    lineThreshold,
    curveThreshold,
    ignoreBackground,
    blurRadius: base.blurRadius,
    tracerOptions,
  };
}
