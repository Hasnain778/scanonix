/**
 * Classic TIFF preflight and first-page decode for local converters.
 * UTIF2 is loaded only when a file has already passed preflight.
 */

export const TIFF_MULTIPAGE_NOTICE =
  "This TIFF contains multiple pages. The first page was converted.";

export const TIFF_ERROR_NOT_TIFF = "This file is not a supported TIFF image.";
export const TIFF_ERROR_BIGTIFF = "BigTIFF is not supported.";
export const TIFF_ERROR_UNSUPPORTED =
  "This TIFF uses a compression or color mode that is not supported.";
export const TIFF_ERROR_TOO_LARGE = "This TIFF is too large to convert in the browser.";
export const TIFF_ERROR_DAMAGED = "This TIFF file is damaged or incomplete.";
export const TIFF_ERROR_DECODE = "Could not decode this TIFF image.";
export const TIFF_ERROR_TOO_MANY_DIRECTORIES =
  "This TIFF has too many image directories to convert in the browser.";

/**
 * Decoded-memory and canvas safety ceiling.
 *
 * TIFF-CONVERTERS-1C allocated and read back an 8192×8192 canvas in
 * Headless Chrome 154. This bounds decoded pixels and oriented edges
 * before UTIF.decodeImage. It is not an upload or file-size policy, and
 * it is not a claim that every browser can display 8192². Larger edges
 * were only proven for height-1 canvases, so they are not used here.
 *
 * 600 DPI US Letter and A4 scans fit under this ceiling.
 */
export const TIFF_MAX_EDGE = 8192;
export const TIFF_MAX_DECODED_PIXELS = TIFF_MAX_EDGE * TIFF_MAX_EDGE;

const ALLOWED_COMPRESSION = new Set([1, 4, 5, 8, 32773, 32946]);
const ALLOWED_PHOTOMETRIC = new Set([0, 1, 2]);
const ALLOWED_BITS = new Set([1, 8, 16]);
const MAX_DIRECTORIES = 512;
const MAX_TAG_VALUES = 16384;
const MAX_SUB_IFDS = 8;
const MAX_SUB_DEPTH = 4;

const TYPE_SIZE: Record<number, number> = {
  1: 1,
  2: 1,
  3: 2,
  4: 4,
  5: 8,
  6: 1,
  7: 1,
  8: 2,
  9: 4,
  10: 8,
  11: 4,
  12: 8,
  13: 4,
};

export class TiffDecodeError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TiffDecodeError";
  }
}

export interface TiffInspection {
  width: number;
  height: number;
  extraPages: boolean;
}

export interface DecodedTiff extends TiffInspection {
  rgba: Uint8Array;
}

interface ParsedPage {
  tags: Map<number, number[]>;
  userPage: boolean;
}

interface UtifIfd {
  width?: number;
  height?: number;
  data?: Uint8Array;
  t254?: number[];
  t256?: number[];
  t257?: number[];
  [key: string]: unknown;
}

interface UtifApi {
  decode: (buffer: ArrayBuffer, options?: { parseMN?: boolean; debug?: boolean }) => UtifIfd[];
  decodeImage: (buffer: ArrayBuffer, image: UtifIfd, images?: UtifIfd[]) => void;
  toRGBA8: (image: UtifIfd) => Uint8Array;
}

interface PreparedTiff extends TiffInspection {
  sourceWidth: number;
  sourceHeight: number;
  orientation: number;
}

function fail(message: string): never {
  throw new TiffDecodeError(message);
}

function readU16(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  const first = bytes[offset] ?? 0;
  const second = bytes[offset + 1] ?? 0;
  return littleEndian ? first | (second << 8) : (first << 8) | second;
}

function readU32(bytes: Uint8Array, offset: number, littleEndian: boolean): number {
  const first = bytes[offset] ?? 0;
  const second = bytes[offset + 1] ?? 0;
  const third = bytes[offset + 2] ?? 0;
  const fourth = bytes[offset + 3] ?? 0;
  return littleEndian
    ? (first | (second << 8) | (third << 16) | (fourth << 24)) >>> 0
    : ((first << 24) | (second << 16) | (third << 8) | fourth) >>> 0;
}

function safeMul(left: number, right: number): number {
  if (!Number.isSafeInteger(left) || !Number.isSafeInteger(right)) {
    fail(TIFF_ERROR_TOO_LARGE);
  }
  const product = left * right;
  if (!Number.isSafeInteger(product)) fail(TIFF_ERROR_TOO_LARGE);
  return product;
}

function fits(offset: number, size: number, length: number): boolean {
  return (
    Number.isSafeInteger(offset) &&
    Number.isSafeInteger(size) &&
    offset >= 0 &&
    size >= 0 &&
    offset <= length &&
    size <= length - offset
  );
}

function readNumericValues(
  bytes: Uint8Array,
  offset: number,
  count: number,
  type: 3 | 4,
  littleEndian: boolean,
): number[] {
  const step = type === 3 ? 2 : 4;
  const values: number[] = [];
  for (let index = 0; index < count; index += 1) {
    const at = offset + index * step;
    values.push(type === 3 ? readU16(bytes, at, littleEndian) : readU32(bytes, at, littleEndian));
  }
  return values;
}

function parseDirectory(
  bytes: Uint8Array,
  offset: number,
  littleEndian: boolean,
): { tags: Map<number, number[]>; next: number; subOffsets: number[] } {
  if (!fits(offset, 2, bytes.length)) fail(TIFF_ERROR_DAMAGED);
  const count = readU16(bytes, offset, littleEndian);
  if (count > 256 || !fits(offset, 2 + count * 12 + 4, bytes.length)) {
    fail(TIFF_ERROR_DAMAGED);
  }

  const tags = new Map<number, number[]>();
  const subOffsets: number[] = [];

  for (let index = 0; index < count; index += 1) {
    const entry = offset + 2 + index * 12;
    const tag = readU16(bytes, entry, littleEndian);
    const type = readU16(bytes, entry + 2, littleEndian);
    const valueCount = readU32(bytes, entry + 4, littleEndian);
    const typeSize = TYPE_SIZE[type];
    if (!typeSize || valueCount > MAX_TAG_VALUES) fail(TIFF_ERROR_DAMAGED);

    const byteLength = typeSize * valueCount;
    let valueOffset = entry + 8;
    if (byteLength > 4) {
      valueOffset = readU32(bytes, entry + 8, littleEndian);
      if (!fits(valueOffset, byteLength, bytes.length)) fail(TIFF_ERROR_DAMAGED);
    }

    if (type === 3 || type === 4) {
      const values = readNumericValues(
        bytes,
        valueOffset,
        valueCount,
        type,
        littleEndian,
      );
      tags.set(tag, values);
      if (tag === 330) subOffsets.push(...values);
    }
  }

  return {
    tags,
    next: readU32(bytes, offset + 2 + count * 12, littleEndian),
    subOffsets,
  };
}

function isReduced(tags: Map<number, number[]>): boolean {
  return ((tags.get(254)?.[0] ?? 0) & 1) === 1;
}

function walkSubDirectories(
  bytes: Uint8Array,
  offsets: number[],
  littleEndian: boolean,
  seen: Set<number>,
  depth: number,
): void {
  if (offsets.length > MAX_SUB_IFDS) fail(TIFF_ERROR_DAMAGED);
  if (depth > MAX_SUB_DEPTH) fail(TIFF_ERROR_DAMAGED);

  for (const offset of offsets) {
    if (offset < 8 || offset >= bytes.length || seen.has(offset)) fail(TIFF_ERROR_DAMAGED);
    if (seen.size >= MAX_DIRECTORIES) fail(TIFF_ERROR_TOO_MANY_DIRECTORIES);
    seen.add(offset);
    const directory = parseDirectory(bytes, offset, littleEndian);
    if (directory.subOffsets.length > 0) {
      walkSubDirectories(bytes, directory.subOffsets, littleEndian, seen, depth + 1);
    }
  }
}

function prepareTiff(bytes: Uint8Array): PreparedTiff {
  if (bytes.length < 8) fail(TIFF_ERROR_NOT_TIFF);
  const order = String.fromCharCode(bytes[0] ?? 0, bytes[1] ?? 0);
  if (order !== "II" && order !== "MM") fail(TIFF_ERROR_NOT_TIFF);

  const littleEndian = order === "II";
  const magic = readU16(bytes, 2, littleEndian);
  if (magic === 43) fail(TIFF_ERROR_BIGTIFF);
  if (magic !== 42) fail(TIFF_ERROR_NOT_TIFF);

  let offset = readU32(bytes, 4, littleEndian);
  if (offset < 8 || offset >= bytes.length) fail(TIFF_ERROR_DAMAGED);

  const seen = new Set<number>();
  const pages: ParsedPage[] = [];
  const pendingSubs: number[][] = [];

  while (offset !== 0) {
    if (seen.has(offset)) fail(TIFF_ERROR_DAMAGED);
    if (seen.size >= MAX_DIRECTORIES) fail(TIFF_ERROR_TOO_MANY_DIRECTORIES);
    seen.add(offset);

    const directory = parseDirectory(bytes, offset, littleEndian);
    const userPage = directory.tags.has(256) && directory.tags.has(257) && !isReduced(directory.tags);
    pages.push({ tags: directory.tags, userPage });
    if (directory.subOffsets.length > 0) pendingSubs.push(directory.subOffsets);

    offset = directory.next;
    if (offset !== 0 && (offset < 8 || offset >= bytes.length)) fail(TIFF_ERROR_DAMAGED);
  }

  for (const subOffsets of pendingSubs) {
    walkSubDirectories(bytes, subOffsets, littleEndian, seen, 1);
  }

  const userPages = pages.filter((page) => page.userPage);
  if (userPages.length === 0) fail(TIFF_ERROR_DAMAGED);
  return validateUserPage(bytes, userPages[0].tags, userPages.length > 1);
}

function first(tags: Map<number, number[]>, tag: number, fallback?: number): number {
  const values = tags.get(tag);
  if (!values || values.length === 0) {
    if (fallback === undefined) fail(TIFF_ERROR_DAMAGED);
    return fallback;
  }
  return values[0] ?? fallback ?? fail(TIFF_ERROR_DAMAGED);
}

function validateUserPage(
  bytes: Uint8Array,
  tags: Map<number, number[]>,
  extraPages: boolean,
): PreparedTiff {
  const width = first(tags, 256);
  const height = first(tags, 257);
  const compression = first(tags, 259, 1);
  const photometric = tags.has(262) ? first(tags, 262) : fail(TIFF_ERROR_UNSUPPORTED);
  const samples = first(tags, 277, photometric === 2 ? 0 : 1);
  const bits = tags.get(258);
  const planar = first(tags, 284, 1);
  const orientation = first(tags, 274, 1);
  const predictor = tags.has(317) ? first(tags, 317) : 1;

  if (!Number.isSafeInteger(width) || !Number.isSafeInteger(height) || width < 1 || height < 1) {
    fail(TIFF_ERROR_DAMAGED);
  }
  if (planar !== 1) fail(TIFF_ERROR_UNSUPPORTED);
  if (!ALLOWED_COMPRESSION.has(compression)) fail(TIFF_ERROR_UNSUPPORTED);
  if (!ALLOWED_PHOTOMETRIC.has(photometric)) fail(TIFF_ERROR_UNSUPPORTED);
  if (orientation < 1 || orientation > 8) fail(TIFF_ERROR_UNSUPPORTED);
  if (predictor !== 1 && predictor !== 2) fail(TIFF_ERROR_UNSUPPORTED);
  if (!bits || bits.length === 0) fail(TIFF_ERROR_UNSUPPORTED);

  const bitsPer = bits[0] ?? 0;
  if (!ALLOWED_BITS.has(bitsPer) || bits.some((value) => value !== bitsPer)) {
    fail(TIFF_ERROR_UNSUPPORTED);
  }
  if (photometric === 2 && samples !== 3 && samples !== 4) fail(TIFF_ERROR_UNSUPPORTED);
  if (photometric !== 2 && samples !== 1) fail(TIFF_ERROR_UNSUPPORTED);

  if (width > TIFF_MAX_EDGE || height > TIFF_MAX_EDGE) fail(TIFF_ERROR_TOO_LARGE);
  const pixels = safeMul(width, height);
  if (pixels > TIFF_MAX_DECODED_PIXELS) fail(TIFF_ERROR_TOO_LARGE);

  const orientedWidth = orientation >= 5 ? height : width;
  const orientedHeight = orientation >= 5 ? width : height;
  if (orientedWidth > TIFF_MAX_EDGE || orientedHeight > TIFF_MAX_EDGE) {
    fail(TIFF_ERROR_TOO_LARGE);
  }

  const bytesPerSample = Math.ceil(bitsPer / 8);
  safeMul(safeMul(pixels, samples), bytesPerSample);
  safeMul(pixels, 4);
  assertDataWindows(bytes, tags, compression === 1);

  return {
    width: orientedWidth,
    height: orientedHeight,
    sourceWidth: width,
    sourceHeight: height,
    orientation,
    extraPages,
  };
}

function assertDataWindows(
  bytes: Uint8Array,
  tags: Map<number, number[]>,
  uncompressed: boolean,
): void {
  const windows = [
    { offsets: tags.get(273) ?? [], counts: tags.get(279) ?? [] },
    { offsets: tags.get(324) ?? [], counts: tags.get(325) ?? [] },
  ].filter((window) => window.offsets.length > 0);

  if (windows.length === 0) fail(TIFF_ERROR_DAMAGED);

  for (const window of windows) {
    if (uncompressed && window.counts.length === 0) fail(TIFF_ERROR_DAMAGED);
    for (let index = 0; index < window.offsets.length; index += 1) {
      const start = window.offsets[index] ?? 0;
      if (start >= bytes.length) fail(TIFF_ERROR_DAMAGED);
      if (window.counts.length === 0) continue;
      const count = window.counts[index];
      if (count === undefined || count < 1 || !fits(start, count, bytes.length)) {
        fail(TIFF_ERROR_DAMAGED);
      }
    }
  }
}

export function inspectTiffBytes(bytes: Uint8Array): TiffInspection {
  const prepared = prepareTiff(bytes);
  return {
    width: prepared.width,
    height: prepared.height,
    extraPages: prepared.extraPages,
  };
}

export async function inspectTiffFile(file: File): Promise<TiffInspection> {
  return inspectTiffBytes(new Uint8Array(await file.arrayBuffer()));
}

export function orientTiffRgba(
  rgba: Uint8Array,
  width: number,
  height: number,
  orientation: number,
): { rgba: Uint8Array; width: number; height: number } {
  const swap = orientation >= 5;
  const outputWidth = swap ? height : width;
  const outputHeight = swap ? width : height;
  const output = new Uint8Array(safeMul(safeMul(outputWidth, outputHeight), 4));

  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      let nextX = x;
      let nextY = y;
      if (orientation === 2) nextX = width - 1 - x;
      else if (orientation === 3) {
        nextX = width - 1 - x;
        nextY = height - 1 - y;
      } else if (orientation === 4) nextY = height - 1 - y;
      else if (orientation === 5) {
        nextX = y;
        nextY = x;
      } else if (orientation === 6) {
        nextX = height - 1 - y;
        nextY = x;
      } else if (orientation === 7) {
        nextX = height - 1 - y;
        nextY = width - 1 - x;
      } else if (orientation === 8) {
        nextX = y;
        nextY = width - 1 - x;
      }

      const source = (y * width + x) * 4;
      const destination = (nextY * outputWidth + nextX) * 4;
      output.set(rgba.subarray(source, source + 4), destination);
    }
  }

  return { rgba: output, width: outputWidth, height: outputHeight };
}

function copyBuffer(bytes: Uint8Array): ArrayBuffer {
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  return copy.buffer;
}

async function loadUtif(): Promise<UtifApi> {
  const imported = (await import("utif2")) as {
    default?: Partial<UtifApi>;
    decode?: UtifApi["decode"];
    decodeImage?: UtifApi["decodeImage"];
    toRGBA8?: UtifApi["toRGBA8"];
  };
  const candidate =
    imported.default && typeof imported.default.decode === "function"
      ? imported.default
      : imported;
  if (
    typeof candidate.decode !== "function" ||
    typeof candidate.decodeImage !== "function" ||
    typeof candidate.toRGBA8 !== "function"
  ) {
    fail(TIFF_ERROR_DECODE);
  }
  return candidate as UtifApi;
}

function isReducedIfd(image: UtifIfd): boolean {
  const value = image.t254?.[0] ?? 0;
  return (value & 1) === 1;
}

export async function decodeTiffBytes(bytes: Uint8Array): Promise<DecodedTiff> {
  const prepared = prepareTiff(bytes);

  try {
    const UTIF = await loadUtif();
    const buffer = copyBuffer(bytes);
    const directories = UTIF.decode(buffer, { parseMN: false, debug: false });
    const page = directories.find(
      (image) => image.t256 && image.t257 && !isReducedIfd(image),
    );
    if (!page || page.t256?.[0] !== prepared.sourceWidth || page.t257?.[0] !== prepared.sourceHeight) {
      fail(TIFF_ERROR_DECODE);
    }

    UTIF.decodeImage(buffer, page, directories);
    const rgba = UTIF.toRGBA8(page);
    const width = page.width;
    const height = page.height;
    if (
      width !== prepared.sourceWidth ||
      height !== prepared.sourceHeight ||
      !(rgba instanceof Uint8Array) ||
      rgba.length !== width * height * 4
    ) {
      fail(TIFF_ERROR_DECODE);
    }

    const oriented = orientTiffRgba(rgba, width, height, prepared.orientation);
    if (
      oriented.width !== prepared.width ||
      oriented.height !== prepared.height ||
      oriented.rgba.length !== oriented.width * oriented.height * 4
    ) {
      fail(TIFF_ERROR_DECODE);
    }

    return {
      rgba: oriented.rgba,
      width: oriented.width,
      height: oriented.height,
      extraPages: prepared.extraPages,
    };
  } catch (error) {
    if (error instanceof TiffDecodeError) throw error;
    fail(TIFF_ERROR_DECODE);
  }
}

export async function decodeTiffToCanvas(
  file: File,
): Promise<{ canvas: HTMLCanvasElement; extraPages: boolean }> {
  const decoded = await decodeTiffBytes(new Uint8Array(await file.arrayBuffer()));
  if (typeof document === "undefined") fail(TIFF_ERROR_DECODE);

  const canvas = document.createElement("canvas");
  canvas.width = decoded.width;
  canvas.height = decoded.height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) fail(TIFF_ERROR_DECODE);

  const imageData = context.createImageData(decoded.width, decoded.height);
  imageData.data.set(decoded.rgba);
  context.putImageData(imageData, 0, 0);
  return { canvas, extraPages: decoded.extraPages };
}
