import ImageTracer from "imagetracerjs";
import {
  decodeRasterForVectorize,
  flattenTransparentOntoWhite,
} from "./decode-raster";
import { resolveVectorizeSettings } from "./presets";
import {
  VectorizeError,
  type VectorizeImageOptions,
  type VectorizeImageResult,
} from "./types";
import { cleanupTracedSvg, validateSvgIsRealVector } from "./validate-svg";

export type {
  VectorizeErrorCode,
  VectorizeImageOptions,
  VectorizeImageResult,
  VectorizeInputMime,
  VectorizePreset,
  VectorizeTraceMetadata,
} from "./types";
export {
  VectorizeError,
  VECTORIZE_MAX_BYTES,
  VECTORIZE_MAX_DIMENSION,
  VECTORIZE_MAX_INPUT_PIXELS,
} from "./types";
export { validateSvgIsRealVector } from "./validate-svg";
export { resolveVectorizeSettings } from "./presets";

export interface VectorizeImageInput {
  /** Encoded PNG / JPEG / WebP bytes. */
  buffer: Buffer;
  fileName?: string;
  mimeType?: string;
}

/**
 * Internal shared raster → genuine SVG path tracer.
 * Powers future Logo Vectorizer / Image to SVG / Raster to Vector tools.
 */
export async function vectorizeImage(
  input: VectorizeImageInput,
  options: VectorizeImageOptions = {},
): Promise<VectorizeImageResult> {
  const settings = resolveVectorizeSettings(options);
  const decoded = await decodeRasterForVectorize(
    input.buffer,
    input.fileName,
    input.mimeType,
  );

  const rgba = settings.ignoreBackground
    ? flattenTransparentOntoWhite(decoded.data)
    : decoded.data;

  let svg: string;
  try {
    svg = ImageTracer.imagedataToSVG(
      {
        width: decoded.width,
        height: decoded.height,
        data: rgba,
      },
      settings.tracerOptions,
    );
  } catch (err) {
    throw new VectorizeError(
      "TRACE_FAILED",
      err instanceof Error ? err.message : "Vector tracing failed.",
    );
  }

  svg = cleanupTracedSvg(svg, settings.ignoreBackground);

  const validation = validateSvgIsRealVector(svg);
  if (!validation.ok) {
    throw new VectorizeError(
      "INVALID_SVG_OUTPUT",
      `Traced SVG failed vector checks: ${validation.reasons.join("; ")}`,
    );
  }

  const byteSize = Buffer.byteLength(svg, "utf8");

  return {
    svg,
    width: decoded.width,
    height: decoded.height,
    byteSize,
    mimeType: decoded.mimeType,
    meta: {
      preset: settings.preset,
      colorCount: settings.colorCount,
      pathOmit: settings.pathOmit,
      lineThreshold: settings.lineThreshold,
      curveThreshold: settings.curveThreshold,
      ignoreBackground: settings.ignoreBackground,
      pathCount: validation.pathCount,
      tracer: "imagetracerjs",
    },
  };
}
