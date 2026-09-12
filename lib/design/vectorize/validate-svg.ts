/**
 * Prove SVG output is genuine vector geometry — not a raster wrapper.
 */

export interface SvgVectorValidation {
  ok: boolean;
  pathCount: number;
  reasons: string[];
}

const HAS_SVG_ROOT = /<svg\b/i;
const HAS_VECTOR_GEOM =
  /<(?:path|polygon|polyline|circle|ellipse|rect|line)\b/i;
const HAS_EMBEDDED_IMAGE = /<image\b/i;
const HAS_DATA_IMAGE = /data:image\//i;
const HAS_FOREIGN_OBJECT = /<foreignObject\b/i;

export function countSvgPathLikeElements(svg: string): number {
  const matches = svg.match(
    /<(?:path|polygon|polyline|circle|ellipse|rect|line)\b/gi,
  );
  return matches?.length ?? 0;
}

export function validateSvgIsRealVector(svg: string): SvgVectorValidation {
  const reasons: string[] = [];
  const trimmed = svg.trim();

  if (!trimmed) {
    reasons.push("empty SVG");
  }
  if (!HAS_SVG_ROOT.test(trimmed)) {
    reasons.push("missing <svg> root");
  }
  if (HAS_EMBEDDED_IMAGE.test(trimmed)) {
    reasons.push("contains embedded <image> element");
  }
  if (HAS_DATA_IMAGE.test(trimmed)) {
    reasons.push("contains data:image payload");
  }
  if (HAS_FOREIGN_OBJECT.test(trimmed)) {
    reasons.push("contains <foreignObject>");
  }

  const pathCount = countSvgPathLikeElements(trimmed);
  if (pathCount < 1 || !HAS_VECTOR_GEOM.test(trimmed)) {
    reasons.push("no vector geometry (<path> or equivalent)");
  }

  return {
    ok: reasons.length === 0,
    pathCount,
    reasons,
  };
}

/**
 * Drop zero-opacity / pure-white background paths when ignoreBackground is on.
 * Keeps logo SVGs cleaner without inventing fake transparency.
 */
export function cleanupTracedSvg(svg: string, ignoreBackground: boolean): string {
  let out = svg;

  // imagetracer often emits fully transparent black mats for alpha regions.
  out = out.replace(
    /<path\b[^>]*\bopacity\s*=\s*["']0(?:\.0+)?["'][^>]*\/?>/gi,
    "",
  );
  out = out.replace(
    /<path\b[^>]*\bopacity\s*=\s*["']0(?:\.0+)?["'][^>]*>\s*<\/path>/gi,
    "",
  );

  if (ignoreBackground) {
    out = out.replace(
      /<path\b[^>]*fill\s*=\s*["']rgb\(\s*255\s*,\s*255\s*,\s*255\s*\)["'][^>]*\/?>/gi,
      "",
    );
    out = out.replace(
      /<path\b[^>]*fill\s*=\s*["']#fff(?:fff)?["'][^>]*\/?>/gi,
      "",
    );
  }

  return out.replace(/\s{2,}/g, " ").trim();
}
