import {
  getCompositeImageData,
  getLayerImageData,
  initializeCanvas,
  readPsd,
} from "ag-psd";
import {
  PSD_BITS_PER_CHANNEL,
  PSD_COLOR_MODE_RGB,
  PsdError,
  type PsdValidationMeta,
} from "./types";

let imageDataPolyfillInstalled = false;

/**
 * Pure-JS ImageData factory for ag-psd bitmap decode helpers.
 * createCanvas must never be used in this engine path.
 */
function ensureImageDataPolyfill(): void {
  if (imageDataPolyfillInstalled) return;
  initializeCanvas(
    () => {
      throw new PsdError(
        "UNEXPECTED_STRUCTURE",
        "Canvas createCanvas was invoked — canvas-free PSD path violated.",
      );
    },
    ((width: number, height: number) => ({
      width,
      height,
      data: new Uint8ClampedArray(width * height * 4),
      colorSpace: "srgb" as PredefinedColorSpace,
    })) as (width: number, height: number) => ImageData,
  );
  imageDataPolyfillInstalled = true;
}

export interface PsdHeaderFields {
  magic: string;
  version: number;
  channels: number;
  height: number;
  width: number;
  depth: number;
  colorMode: number;
}

export function readPsdHeader(buffer: Buffer): PsdHeaderFields {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength < 26) {
    throw new PsdError("INVALID_PSD", "PSD buffer is too short.");
  }
  return {
    magic: buffer.subarray(0, 4).toString("ascii"),
    version: buffer.readUInt16BE(4),
    channels: buffer.readUInt16BE(12),
    height: buffer.readUInt32BE(14),
    width: buffer.readUInt32BE(18),
    depth: buffer.readUInt16BE(22),
    colorMode: buffer.readUInt16BE(24),
  };
}

export interface ExtractedPsdRaster {
  width: number;
  height: number;
  layerName: string;
  /** RGBA8 interleaved */
  data: Uint8ClampedArray;
  composite: Uint8ClampedArray | null;
}

/**
 * Decode layer (+ composite when available) pixels without a canvas package.
 */
export function extractPsdRasterPixels(buffer: Buffer): ExtractedPsdRaster {
  ensureImageDataPolyfill();
  const psd = readPsd(buffer, {
    useRawData: true,
    skipThumbnail: true,
  });

  const layer = psd.children?.[0];
  if (!layer) {
    throw new PsdError("UNEXPECTED_STRUCTURE", "PSD has no raster layer.");
  }

  const layerImage = getLayerImageData(layer);
  if (!layerImage?.data) {
    throw new PsdError("UNEXPECTED_STRUCTURE", "PSD layer has no pixel data.");
  }

  const compositeImage = getCompositeImageData(psd);
  const data = new Uint8ClampedArray(layerImage.data);
  const composite = compositeImage?.data
    ? new Uint8ClampedArray(compositeImage.data)
    : null;

  return {
    width: psd.width,
    height: psd.height,
    layerName: layer.name || "",
    data,
    composite,
  };
}

/**
 * Structural validation of an encoded PSD buffer.
 */
export function validatePsdBuffer(
  buffer: Buffer,
  expected?: { width?: number; height?: number; layerName?: string },
): PsdValidationMeta {
  if (!Buffer.isBuffer(buffer) || buffer.byteLength <= 0) {
    throw new PsdError("INVALID_PSD", "PSD buffer is empty.");
  }

  // Reject common non-PSD containers early
  if (buffer[0] === 0xff && buffer[1] === 0xd8) {
    throw new PsdError("INVALID_PSD", "Buffer looks like JPEG, not PSD.");
  }
  if (buffer[0] === 0x89 && buffer[1] === 0x50) {
    throw new PsdError("INVALID_PSD", "Buffer looks like PNG, not PSD.");
  }

  const header = readPsdHeader(buffer);
  if (header.magic !== "8BPS") {
    throw new PsdError("INVALID_PSD", `Expected 8BPS magic, got ${header.magic}.`);
  }
  if (header.version !== 1) {
    throw new PsdError("INVALID_PSD", `Expected PSD version 1, got ${header.version}.`);
  }
  if (header.colorMode !== PSD_COLOR_MODE_RGB) {
    throw new PsdError(
      "INVALID_PSD",
      `Expected RGB color mode (${PSD_COLOR_MODE_RGB}), got ${header.colorMode}.`,
    );
  }
  if (header.depth !== PSD_BITS_PER_CHANNEL) {
    throw new PsdError(
      "INVALID_PSD",
      `Expected ${PSD_BITS_PER_CHANNEL}-bit depth, got ${header.depth}.`,
    );
  }
  if (header.width <= 0 || header.height <= 0) {
    throw new PsdError("INVALID_PSD", "PSD header has invalid dimensions.");
  }

  if (expected?.width !== undefined && header.width !== expected.width) {
    throw new PsdError(
      "UNEXPECTED_STRUCTURE",
      `PSD width ${header.width} !== expected ${expected.width}.`,
    );
  }
  if (expected?.height !== undefined && header.height !== expected.height) {
    throw new PsdError(
      "UNEXPECTED_STRUCTURE",
      `PSD height ${header.height} !== expected ${expected.height}.`,
    );
  }

  // Structure parse without bitmap decode (canvas-free)
  const structured = readPsd(buffer, {
    useRawData: true,
    skipThumbnail: true,
  });

  const children = structured.children ?? [];
  if (children.length !== 1) {
    throw new PsdError(
      "UNEXPECTED_STRUCTURE",
      `Expected exactly 1 raster layer, found ${children.length}.`,
    );
  }

  const layer = children[0]!;
  const layerName = layer.name || "";
  if (!layer.rawData) {
    throw new PsdError(
      "UNEXPECTED_STRUCTURE",
      "PSD layer is missing raw raster channel data.",
    );
  }
  if ((layer as { canvas?: unknown }).canvas) {
    throw new PsdError(
      "UNEXPECTED_STRUCTURE",
      "PSD parse unexpectedly produced a canvas object.",
    );
  }

  if (expected?.layerName !== undefined && layerName !== expected.layerName) {
    throw new PsdError(
      "UNEXPECTED_STRUCTURE",
      `Layer name "${layerName}" !== expected "${expected.layerName}".`,
    );
  }

  // Confirm pixels can be decoded without a canvas package
  const pixels = extractPsdRasterPixels(buffer);
  if (pixels.data.byteLength !== header.width * header.height * 4) {
    throw new PsdError(
      "UNEXPECTED_STRUCTURE",
      "Decoded layer pixel buffer has unexpected length.",
    );
  }

  return {
    width: header.width,
    height: header.height,
    layerCount: 1,
    colorMode: header.colorMode,
    bitsPerChannel: header.depth,
    layerName,
    byteLength: buffer.byteLength,
  };
}
