/**
 * IE-3B adjustment model + pure RGBA processing.
 * Preview and export share these formulas.
 */

export interface EditorAdjustments {
  /** -100…100, default 0 — additive lift */
  brightness: number;
  /** -100…100, default 0 — EV-like multiply */
  exposure: number;
  /** -100…100, default 0 */
  contrast: number;
  /** -100…100, default 0 — bright tones */
  highlights: number;
  /** -100…100, default 0 — dark tones */
  shadows: number;
  /** -100…100, default 0 */
  saturation: number;
  /** -100…100, default 0 — prefers low-sat colors */
  vibrance: number;
  /** -100…100, default 0 — cool↔warm */
  temperature: number;
  /** -100…100, default 0 — green↔magenta */
  tint: number;
  /** 0…100, default 0 */
  sharpness: number;
  /** 0…100, default 0 — blur radius scale */
  blur: number;
  /** 0…100, default 0 — desaturation amount */
  grayscale: number;
}

export const ADJUST_SIGNED_MIN = -100;
export const ADJUST_SIGNED_MAX = 100;
export const ADJUST_UNSIGNED_MIN = 0;
export const ADJUST_UNSIGNED_MAX = 100;

export function createNeutralAdjustments(): EditorAdjustments {
  return {
    brightness: 0,
    exposure: 0,
    contrast: 0,
    highlights: 0,
    shadows: 0,
    saturation: 0,
    vibrance: 0,
    temperature: 0,
    tint: 0,
    sharpness: 0,
    blur: 0,
    grayscale: 0,
  };
}

export function cloneAdjustments(a: EditorAdjustments): EditorAdjustments {
  return { ...a };
}

export function adjustmentsEqual(a: EditorAdjustments, b: EditorAdjustments): boolean {
  return (
    a.brightness === b.brightness &&
    a.exposure === b.exposure &&
    a.contrast === b.contrast &&
    a.highlights === b.highlights &&
    a.shadows === b.shadows &&
    a.saturation === b.saturation &&
    a.vibrance === b.vibrance &&
    a.temperature === b.temperature &&
    a.tint === b.tint &&
    a.sharpness === b.sharpness &&
    a.blur === b.blur &&
    a.grayscale === b.grayscale
  );
}

export function isNeutralAdjustments(a: EditorAdjustments): boolean {
  return adjustmentsEqual(a, createNeutralAdjustments());
}

export function clampSigned(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(ADJUST_SIGNED_MAX, Math.max(ADJUST_SIGNED_MIN, Math.round(value)));
}

export function clampUnsigned(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(
    ADJUST_UNSIGNED_MAX,
    Math.max(ADJUST_UNSIGNED_MIN, Math.round(value)),
  );
}

function clampByte(v: number): number {
  return v < 0 ? 0 : v > 255 ? 255 : v;
}

function luminance(r: number, g: number, b: number): number {
  return (0.2126 * r + 0.7152 * g + 0.0722 * b) / 255;
}

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/**
 * Apply tonal/color adjustments in-place on RGBA ImageData (alpha preserved).
 * Order: exposure → brightness → contrast → highlights → shadows →
 * temperature → tint → saturation → vibrance → grayscale.
 * Sharpness/blur are separate (spatial) and applied by the caller around this.
 */
export function applyPointAdjustments(
  data: Uint8ClampedArray,
  adj: EditorAdjustments,
): void {
  const pointNeutral =
    adj.exposure === 0 &&
    adj.brightness === 0 &&
    adj.contrast === 0 &&
    adj.highlights === 0 &&
    adj.shadows === 0 &&
    adj.saturation === 0 &&
    adj.vibrance === 0 &&
    adj.temperature === 0 &&
    adj.tint === 0 &&
    adj.grayscale === 0;
  if (pointNeutral) return;

  const exposureFactor = Math.pow(2, adj.exposure / 100);
  const brightnessAdd = (adj.brightness / 100) * 64;
  const contrastFactor = 1 + adj.contrast / 100;
  const satFactor = 1 + adj.saturation / 100;
  const vib = adj.vibrance / 100;
  const temp = adj.temperature / 100;
  const tintAmt = adj.tint / 100;
  const hl = adj.highlights / 100;
  const sh = adj.shadows / 100;
  const grayAmt = adj.grayscale / 100;

  for (let i = 0; i < data.length; i += 4) {
    const a = data[i + 3];
    if (a === 0) continue;

    let r = data[i];
    let g = data[i + 1];
    let b = data[i + 2];

    // Exposure (multiplicative)
    r *= exposureFactor;
    g *= exposureFactor;
    b *= exposureFactor;

    // Brightness (additive)
    r += brightnessAdd;
    g += brightnessAdd;
    b += brightnessAdd;

    // Contrast around mid-gray
    r = (r - 128) * contrastFactor + 128;
    g = (g - 128) * contrastFactor + 128;
    b = (b - 128) * contrastFactor + 128;

    let lum = luminance(clampByte(r), clampByte(g), clampByte(b));

    // Highlights / shadows (luminance-aware)
    if (hl !== 0 || sh !== 0) {
      const hiW = smoothstep(0.45, 0.95, lum);
      const shW = 1 - smoothstep(0.05, 0.55, lum);
      const lift = hl * hiW * 48 + sh * shW * 48;
      r += lift;
      g += lift;
      b += lift;
      lum = luminance(clampByte(r), clampByte(g), clampByte(b));
    }

    // Temperature / tint
    if (temp !== 0 || tintAmt !== 0) {
      r += temp * 36 - tintAmt * 12;
      g += tintAmt * 28;
      b += -temp * 36 - tintAmt * 12;
    }

    // Saturation
    if (satFactor !== 1) {
      const gy = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = gy + (r - gy) * satFactor;
      g = gy + (g - gy) * satFactor;
      b = gy + (b - gy) * satFactor;
    }

    // Vibrance — boost low-saturation colors more
    if (vib !== 0) {
      const maxc = Math.max(r, g, b);
      const minc = Math.min(r, g, b);
      const sat = maxc <= 1e-6 ? 0 : (maxc - minc) / maxc;
      const boost = 1 + vib * (1 - sat);
      const gy = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = gy + (r - gy) * boost;
      g = gy + (g - gy) * boost;
      b = gy + (b - gy) * boost;
    }

    // Grayscale amount
    if (grayAmt > 0) {
      const gy = 0.2126 * r + 0.7152 * g + 0.0722 * b;
      r = r + (gy - r) * grayAmt;
      g = g + (gy - g) * grayAmt;
      b = b + (gy - b) * grayAmt;
    }

    data[i] = clampByte(r);
    data[i + 1] = clampByte(g);
    data[i + 2] = clampByte(b);
    // alpha unchanged
  }
}

/** Box blur horizontal+vertical; radius in pixels (0 = no-op). Alpha preserved. */
export function boxBlurRgba(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  radius: number,
): Uint8ClampedArray {
  if (radius <= 0) return src;
  const r = Math.min(32, Math.max(1, Math.round(radius)));
  const tmp = new Uint8ClampedArray(src.length);
  const out = new Uint8ClampedArray(src.length);
  const w = width;
  const h = height;

  // Horizontal
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0;
      let gs = 0;
      let bs = 0;
      let as = 0;
      let count = 0;
      for (let k = -r; k <= r; k++) {
        const xx = Math.min(w - 1, Math.max(0, x + k));
        const i = (y * w + xx) * 4;
        const alpha = src[i + 3];
        rs += src[i] * alpha;
        gs += src[i + 1] * alpha;
        bs += src[i + 2] * alpha;
        as += alpha;
        count += 1;
      }
      const o = (y * w + x) * 4;
      if (as === 0) {
        tmp[o] = tmp[o + 1] = tmp[o + 2] = tmp[o + 3] = 0;
      } else {
        tmp[o] = rs / as;
        tmp[o + 1] = gs / as;
        tmp[o + 2] = bs / as;
        tmp[o + 3] = as / count;
      }
    }
  }

  // Vertical
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      let rs = 0;
      let gs = 0;
      let bs = 0;
      let as = 0;
      let count = 0;
      for (let k = -r; k <= r; k++) {
        const yy = Math.min(h - 1, Math.max(0, y + k));
        const i = (yy * w + x) * 4;
        const alpha = tmp[i + 3];
        rs += tmp[i] * alpha;
        gs += tmp[i + 1] * alpha;
        bs += tmp[i + 2] * alpha;
        as += alpha;
        count += 1;
      }
      const o = (y * w + x) * 4;
      if (as === 0) {
        out[o] = out[o + 1] = out[o + 2] = out[o + 3] = 0;
      } else {
        out[o] = rs / as;
        out[o + 1] = gs / as;
        out[o + 2] = bs / as;
        out[o + 3] = as / count;
      }
    }
  }

  return out;
}

/**
 * Unsharp-mask style sharpening. amount 0…100.
 * Uses blurred copy; preserves alpha from original.
 */
export function sharpenRgba(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  amount: number,
): Uint8ClampedArray {
  if (amount <= 0) return src;
  const blurred = boxBlurRgba(src, width, height, 1);
  const out = new Uint8ClampedArray(src.length);
  const strength = amount / 100;
  for (let i = 0; i < src.length; i += 4) {
    const a = src[i + 3];
    out[i + 3] = a;
    if (a === 0) {
      out[i] = out[i + 1] = out[i + 2] = 0;
      continue;
    }
    out[i] = clampByte(src[i] + (src[i] - blurred[i]) * strength * 1.5);
    out[i + 1] = clampByte(src[i + 1] + (src[i + 1] - blurred[i + 1]) * strength * 1.5);
    out[i + 2] = clampByte(src[i + 2] + (src[i + 2] - blurred[i + 2]) * strength * 1.5);
  }
  return out;
}

/**
 * Full adjustment pass on ImageData-compatible buffer.
 * Returns new buffer (does not mutate input except when no-ops return same ref).
 */
export function processAdjustmentsRgba(
  src: Uint8ClampedArray,
  width: number,
  height: number,
  adj: EditorAdjustments,
): Uint8ClampedArray {
  if (isNeutralAdjustments(adj)) return src;

  let data: Uint8ClampedArray = new Uint8ClampedArray(src);

  // Spatial: blur first (so sharpen can re-emphasize edges after mild blur if both set)
  if (adj.blur > 0) {
    const radius = (adj.blur / 100) * 8;
    data = boxBlurRgba(data, width, height, radius);
  }

  applyPointAdjustments(data, adj);

  if (adj.sharpness > 0) {
    data = sharpenRgba(data, width, height, adj.sharpness);
  }

  return data;
}

/** Apply adjustments onto an HTMLCanvasElement; returns new canvas. */
export function applyAdjustmentsToCanvas(
  sourceCanvas: HTMLCanvasElement,
  adj: EditorAdjustments,
): HTMLCanvasElement {
  if (isNeutralAdjustments(adj)) return sourceCanvas;

  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const ctx = sourceCanvas.getContext("2d", { willReadFrequently: true });
  if (!ctx) return sourceCanvas;

  const imageData = ctx.getImageData(0, 0, w, h);
  const processed = processAdjustmentsRgba(imageData.data, w, h, adj);
  if (processed !== imageData.data) {
    imageData.data.set(processed);
  }

  const out = document.createElement("canvas");
  out.width = w;
  out.height = h;
  const outCtx = out.getContext("2d");
  if (!outCtx) return sourceCanvas;
  outCtx.putImageData(imageData, 0, 0);
  return out;
}

/** Downscale for interactive preview, then adjust (same formulas). */
export function applyAdjustmentsForPreview(
  sourceCanvas: HTMLCanvasElement,
  adj: EditorAdjustments,
  maxEdge = 1280,
): HTMLCanvasElement {
  if (isNeutralAdjustments(adj)) return sourceCanvas;
  const w = sourceCanvas.width;
  const h = sourceCanvas.height;
  const edge = Math.max(w, h);
  if (edge <= maxEdge) {
    return applyAdjustmentsToCanvas(sourceCanvas, adj);
  }
  const scale = maxEdge / edge;
  const pw = Math.max(1, Math.round(w * scale));
  const ph = Math.max(1, Math.round(h * scale));
  const preview = document.createElement("canvas");
  preview.width = pw;
  preview.height = ph;
  const pctx = preview.getContext("2d");
  if (!pctx) return applyAdjustmentsToCanvas(sourceCanvas, adj);
  pctx.imageSmoothingEnabled = true;
  pctx.imageSmoothingQuality = "high";
  pctx.drawImage(sourceCanvas, 0, 0, pw, ph);
  return applyAdjustmentsToCanvas(preview, adj);
}
