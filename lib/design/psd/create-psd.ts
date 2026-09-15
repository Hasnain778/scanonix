import { writePsdBuffer, type PixelData, type Psd } from "ag-psd";
import { sanitizePsdLayerName } from "./sanitize-layer-name";
import {
  PSD_BITS_PER_CHANNEL,
  PSD_CHANNELS,
  PSD_COLOR_MODE_RGB,
  PSD_MAX_OUTPUT_BYTES,
  PSD_MAX_PIXELS,
  PSD_MAX_SIDE,
  PsdError,
  type PsdRasterInput,
} from "./types";

function assertRasterInput(input: PsdRasterInput): {
  width: number;
  height: number;
  layerName: string;
  rgba: Uint8ClampedArray;
} {
  const { width, height, data, channels, hasAlpha } = input;

  if (
    !Number.isInteger(width) ||
    !Number.isInteger(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new PsdError(
      "INVALID_DIMENSIONS",
      "PSD width and height must be positive integers.",
    );
  }

  if (width > PSD_MAX_SIDE || height > PSD_MAX_SIDE) {
    throw new PsdError(
      "DIMENSIONS_TOO_LARGE",
      `PSD dimensions exceed the ${PSD_MAX_SIDE}px side limit.`,
    );
  }

  const pixels = width * height;
  if (pixels > PSD_MAX_PIXELS) {
    throw new PsdError(
      "PIXEL_LIMIT_EXCEEDED",
      `PSD pixel count exceeds the ${PSD_MAX_PIXELS} limit.`,
    );
  }

  if (channels !== PSD_CHANNELS) {
    throw new PsdError(
      "INVALID_PIXEL_DATA",
      `PSD engine requires ${PSD_CHANNELS}-channel RGBA8 input.`,
    );
  }

  const expected = pixels * PSD_CHANNELS;
  if (!data || data.byteLength !== expected) {
    throw new PsdError(
      "INVALID_PIXEL_DATA",
      `RGBA buffer length must be width×height×4 (${expected} bytes).`,
    );
  }

  const layerName = sanitizePsdLayerName(input.layerName);
  const rgba = new Uint8ClampedArray(expected);
  rgba.set(data);

  if (!hasAlpha) {
    for (let i = 3; i < rgba.length; i += 4) {
      rgba[i] = 255;
    }
  }

  return { width, height, layerName, rgba };
}

function toPixelData(
  width: number,
  height: number,
  data: Uint8ClampedArray,
): PixelData {
  return { width, height, data };
}

/**
 * Encode normalized RGBA8 pixels into a real PSD (8BPS) Buffer.
 * Canvas-free: uses ag-psd imageData / writePsdBuffer only.
 */
export function createPsdFromRaster(input: PsdRasterInput): Buffer {
  const { width, height, layerName, rgba } = assertRasterInput(input);
  const image = toPixelData(width, height, rgba);

  const psd: Psd = {
    width,
    height,
    channels: 3,
    bitsPerChannel: PSD_BITS_PER_CHANNEL,
    colorMode: PSD_COLOR_MODE_RGB,
    children: [
      {
        name: layerName,
        left: 0,
        top: 0,
        right: width,
        bottom: height,
        imageData: image,
      },
    ],
    imageData: image,
  };

  let encoded: Buffer;
  try {
    encoded = writePsdBuffer(psd, {
      generateThumbnail: false,
    });
  } catch (error) {
    throw new PsdError(
      "ENCODE_FAILED",
      error instanceof Error ? error.message : "PSD encode failed.",
    );
  }

  if (!Buffer.isBuffer(encoded) || encoded.byteLength <= 0) {
    throw new PsdError("ENCODE_FAILED", "PSD encoder returned an empty buffer.");
  }

  if (encoded.byteLength > PSD_MAX_OUTPUT_BYTES) {
    throw new PsdError(
      "OUTPUT_TOO_LARGE",
      `Generated PSD exceeds the ${Math.round(PSD_MAX_OUTPUT_BYTES / (1024 * 1024))}MB output limit.`,
    );
  }

  return encoded;
}
