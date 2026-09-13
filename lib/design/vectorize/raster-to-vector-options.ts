/**
 * Whitelisted Raster to Vector control values.
 * Maps semantic UI fields → vectorizeImage option numbers.
 * Do not accept raw imagetracer / pathomit / ltres / qtres from clients.
 */

export const RASTER_COLOR_COUNTS = [4, 8, 12, 16, 24, 32] as const;
export type RasterColorCount = (typeof RASTER_COLOR_COUNTS)[number];

export const RASTER_DETAIL_LEVELS = ["Low", "Medium", "High", "Max"] as const;
export type RasterDetailLevel = (typeof RASTER_DETAIL_LEVELS)[number];

/** Higher detail → lower pathomit (engine code semantics). */
export const RASTER_DETAIL_TO_NUMBER: Record<RasterDetailLevel, number> = {
  Low: 16,
  Medium: 24,
  High: 28,
  Max: 30,
};

export const RASTER_SMOOTHING_LEVELS = ["Sharp", "Balanced", "Soft"] as const;
export type RasterSmoothingLevel = (typeof RASTER_SMOOTHING_LEVELS)[number];

export const RASTER_SMOOTHING_TO_NUMBER: Record<RasterSmoothingLevel, number> = {
  Sharp: 0.5,
  Balanced: 0.8,
  Soft: 2.0,
};

export const RASTER_DEFAULTS = {
  colorCount: 24 as RasterColorCount,
  detail: "High" as RasterDetailLevel,
  smoothing: "Balanced" as RasterSmoothingLevel,
  ignoreBackground: false,
} as const;

export interface ParsedRasterToVectorOptions {
  colorCount: RasterColorCount;
  detail: number;
  detailLabel: RasterDetailLevel;
  smoothing: number;
  smoothingLabel: RasterSmoothingLevel;
  ignoreBackground: boolean;
}

export class RasterOptionError extends Error {
  readonly code = "INVALID_OPTIONS" as const;

  constructor(message: string) {
    super(message);
    this.name = "RasterOptionError";
  }
}

function asSingleString(value: FormDataEntryValue | null): string | undefined {
  if (value == null || value === "") return undefined;
  if (typeof value !== "string") {
    throw new RasterOptionError("Invalid option type.");
  }
  return value;
}

function parseColorCount(raw: string | undefined): RasterColorCount {
  if (raw === undefined) return RASTER_DEFAULTS.colorCount;
  const n = Number(raw);
  if (!Number.isInteger(n) || !(RASTER_COLOR_COUNTS as readonly number[]).includes(n)) {
    throw new RasterOptionError(
      "Invalid colorCount. Allowed: 4, 8, 12, 16, 24, 32.",
    );
  }
  return n as RasterColorCount;
}

function parseDetail(raw: string | undefined): {
  label: RasterDetailLevel;
  value: number;
} {
  if (raw === undefined) {
    return {
      label: RASTER_DEFAULTS.detail,
      value: RASTER_DETAIL_TO_NUMBER[RASTER_DEFAULTS.detail],
    };
  }
  if (!(RASTER_DETAIL_LEVELS as readonly string[]).includes(raw)) {
    throw new RasterOptionError(
      "Invalid detail. Allowed: Low, Medium, High, Max.",
    );
  }
  const label = raw as RasterDetailLevel;
  return { label, value: RASTER_DETAIL_TO_NUMBER[label] };
}

function parseSmoothing(raw: string | undefined): {
  label: RasterSmoothingLevel;
  value: number;
} {
  if (raw === undefined) {
    return {
      label: RASTER_DEFAULTS.smoothing,
      value: RASTER_SMOOTHING_TO_NUMBER[RASTER_DEFAULTS.smoothing],
    };
  }
  if (!(RASTER_SMOOTHING_LEVELS as readonly string[]).includes(raw)) {
    throw new RasterOptionError(
      "Invalid smoothing. Allowed: Sharp, Balanced, Soft.",
    );
  }
  const label = raw as RasterSmoothingLevel;
  return { label, value: RASTER_SMOOTHING_TO_NUMBER[label] };
}

function parseIgnoreBackground(raw: string | undefined): boolean {
  if (raw === undefined) return RASTER_DEFAULTS.ignoreBackground;
  if (raw === "true") return true;
  if (raw === "false") return false;
  throw new RasterOptionError(
    'Invalid ignoreBackground. Allowed: "true" or "false".',
  );
}

/** Reject unexpected FormData keys beyond file + four controls. */
const ALLOWED_FIELDS = new Set([
  "file",
  "colorCount",
  "detail",
  "smoothing",
  "ignoreBackground",
]);

export function assertOnlyAllowedRasterFields(formData: FormData): void {
  for (const key of formData.keys()) {
    if (!ALLOWED_FIELDS.has(key)) {
      throw new RasterOptionError(`Unsupported field: ${key}`);
    }
  }
}

export function parseRasterToVectorOptions(
  formData: FormData,
): ParsedRasterToVectorOptions {
  assertOnlyAllowedRasterFields(formData);

  const colorCount = parseColorCount(asSingleString(formData.get("colorCount")));
  const detail = parseDetail(asSingleString(formData.get("detail")));
  const smoothing = parseSmoothing(asSingleString(formData.get("smoothing")));
  const ignoreBackground = parseIgnoreBackground(
    asSingleString(formData.get("ignoreBackground")),
  );

  return {
    colorCount,
    detail: detail.value,
    detailLabel: detail.label,
    smoothing: smoothing.value,
    smoothingLabel: smoothing.label,
    ignoreBackground,
  };
}
