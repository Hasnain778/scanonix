/**
 * TIFF → JPG and TIFF → PNG local converter verification.
 * Run: npx tsx scripts/verify-tiff-converters.ts
 */

import { readFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import type { Browser, Page } from "puppeteer";
import sharp from "sharp";
import pako from "pako";
import { CANONICAL_TOOL_IDS } from "../constants/tool-categories";
import { getConverterBySlug } from "../constants/image-tools";
import { INDEXABLE_TOOL_PATHS, TOOL_SEO } from "../constants/tool-seo";
import { validateFormatFile } from "../lib/image/formats";
import { TOOL_ACCESS } from "../lib/plan/tool-access";
import { packageOutputsForDownload } from "../lib/utils/download";
import {
  TIFF_ERROR_BIGTIFF,
  TIFF_ERROR_DAMAGED,
  TIFF_ERROR_NOT_TIFF,
  TIFF_ERROR_TOO_LARGE,
  TIFF_ERROR_UNSUPPORTED,
  TIFF_MAX_DECODED_PIXELS,
  TIFF_MAX_EDGE,
  TIFF_MULTIPAGE_NOTICE,
  decodeTiffBytes,
  inspectTiffBytes,
  orientTiffRgba,
} from "../lib/image/tiff-decode";

const root = join(import.meta.dirname, "..");
let failed = 0;

function assert(name: string, condition: boolean, detail = ""): void {
  if (condition) {
    console.log(`✓ ${name}`);
    return;
  }
  failed += 1;
  console.error(`✗ ${name}${detail ? ` — ${detail}` : ""}`);
}

function blobBytes(bytes: Uint8Array): ArrayBuffer {
  const copy = new ArrayBuffer(bytes.byteLength);
  new Uint8Array(copy).set(bytes);
  return copy;
}

function same(actual: Uint8Array | null, expected: number[]): boolean {
  if (!actual || actual.length !== expected.length) return false;
  return expected.every((value, index) => actual[index] === value);
}

function u16(value: number): number[] {
  return [value & 255, (value >> 8) & 255];
}

function u32(value: number): number[] {
  return [value & 255, (value >> 8) & 255, (value >> 16) & 255, (value >>> 24) & 255];
}

function typeSize(type: number): number {
  return ({ 1: 1, 3: 2, 4: 4 } as Record<number, number>)[type] ?? 0;
}

interface TiffEntry {
  tag: number;
  type: number;
  count: number;
  value?: number | null;
  values?: number[];
  bytes?: number[];
  inlineBytes?: number[];
  forceExternal?: boolean;
  keep?: boolean;
  dir?: number;
  _external?: boolean;
  _at?: number;
}

interface TiffPage {
  entries: TiffEntry[];
  pixels: Uint8Array;
  next?: "none";
  linkTo?: number;
  _pix?: number;
}

function entryBytes(entry: TiffEntry): number {
  if (entry.bytes) return entry.bytes.length;
  if (entry.values) return entry.values.length * typeSize(entry.type);
  return 4;
}

function entryPayload(entry: TiffEntry): number[] {
  if (entry.bytes) return [...entry.bytes];
  const out: number[] = [];
  for (const value of entry.values ?? []) {
    if (entry.type === 3) out.push(...u16(value));
    else out.push(...u32(value));
  }
  return out;
}

function buildTiff(pages: TiffPage[]): Uint8Array {
  let offset = 8;
  const dirAt = pages.map((page) => {
    const at = offset;
    offset += 2 + page.entries.length * 12 + 4;
    return at;
  });
  for (const page of pages) {
    for (const entry of page.entries) {
      const inline = entryBytes(entry) <= 4 && !entry.forceExternal;
      entry._external = !inline;
      if (entry._external) {
        entry._at = offset;
        const size = entryBytes(entry);
        offset += size + (size % 2);
      }
    }
  }
  for (const page of pages) {
    page._pix = offset;
    offset += page.pixels.length;
    const strip = page.entries.find((entry) => entry.tag === 273);
    if (strip && !strip.keep) strip.value = page._pix;
    const count = page.entries.find((entry) => entry.tag === 279);
    if (count && count.value == null) count.value = page.pixels.length;
  }
  for (const page of pages) {
    for (const entry of page.entries) {
      if (entry.dir != null) entry.value = dirAt[entry.dir];
    }
  }

  const bytes: number[] = [0x49, 0x49, 0x2a, 0x00, ...u32(dirAt[0] ?? 8)];
  pages.forEach((page, index) => {
    bytes.push(...u16(page.entries.length));
    for (const entry of page.entries) {
      bytes.push(...u16(entry.tag), ...u16(entry.type), ...u32(entry.count));
      if (entry._external) bytes.push(...u32(entry._at ?? 0));
      else if (entry.type === 3) bytes.push(...u16(entry.value ?? entry.values?.[0] ?? 0), 0, 0);
      else if (entry.type === 4) bytes.push(...u32(entry.value ?? 0));
      else bytes.push(...(entry.inlineBytes ?? [0, 0, 0, 0]));
    }
    const next = page.next === "none" ? 0 : dirAt[index + 1] ?? 0;
    bytes.push(...u32(page.linkTo != null ? page.linkTo : next));
  });
  for (const page of pages) {
    for (const entry of page.entries) {
      if (!entry._external) continue;
      const payload = entryPayload(entry);
      bytes.push(...payload);
      if (payload.length % 2) bytes.push(0);
    }
  }
  for (const page of pages) bytes.push(...page.pixels);
  return Uint8Array.from(bytes);
}

function short(tag: number, value: number): TiffEntry {
  return { tag, type: 3, count: 1, value };
}

function long(tag: number, value: number | null): TiffEntry {
  return { tag, type: 4, count: 1, value };
}

function rgbEntries(width: number, height: number, compression: number, extra: TiffEntry[] = []): TiffEntry[] {
  return [
    short(256, width),
    short(257, height),
    { tag: 258, type: 3, count: 3, values: [8, 8, 8] },
    short(259, compression),
    short(262, 2),
    long(273, 0),
    short(277, 3),
    long(278, height),
    long(279, null),
    ...extra,
  ];
}

const RGB = [255, 0, 0, 0, 255, 0, 0, 0, 255, 255, 255, 0];

function handRgb(compression: number, pixels: Uint8Array, extra: TiffEntry[] = []): Uint8Array {
  return buildTiff([{ entries: rgbEntries(2, 2, compression, extra), pixels }]);
}

function opaqueRgb(raw: number[]): number[] {
  const out: number[] = [];
  for (let index = 0; index < raw.length; index += 3) {
    out.push(raw[index] ?? 0, raw[index + 1] ?? 0, raw[index + 2] ?? 0, 255);
  }
  return out;
}

function opaqueGray(raw: number[]): number[] {
  return raw.flatMap((value) => [value, value, value, 255]);
}

async function expectDecoded(name: string, bytes: Uint8Array, expected: number[], width: number, height: number): Promise<void> {
  try {
    const decoded = await decodeTiffBytes(bytes);
    assert(
      name,
      decoded.width === width &&
        decoded.height === height &&
        decoded.rgba.length === width * height * 4 &&
        same(decoded.rgba, expected),
      `got ${decoded.width}x${decoded.height} ${Array.from(decoded.rgba).slice(0, 16).join(",")}`,
    );
  } catch (error) {
    assert(name, false, error instanceof Error ? error.message : "threw");
  }
}

async function expectReject(name: string, bytes: Uint8Array, message: string): Promise<void> {
  const started = Date.now();
  try {
    await decodeTiffBytes(bytes);
    assert(name, false, "decoded an unsupported file");
  } catch (error) {
    assert(
      name,
      error instanceof Error && error.message === message && Date.now() - started < 1000,
      error instanceof Error ? error.message : "threw",
    );
  }
}

async function main(): Promise<void> {
  console.log("\nTIFF converter verification\n");

  assert("edge ceiling is the measured 8192 canvas", TIFF_MAX_EDGE === 8192);
  assert(
    "pixel ceiling is 8192² decoded pixels",
    TIFF_MAX_DECODED_PIXELS === 8192 * 8192,
  );

  const uncompressed = handRgb(1, Uint8Array.from(RGB));
  await expectDecoded("rgb uncompressed", uncompressed, opaqueRgb(RGB), 2, 2);

  const packed = Uint8Array.from([RGB.length - 1, ...RGB]);
  await expectDecoded("rgb packbits", handRgb(32773, packed), opaqueRgb(RGB), 2, 2);

  const zlib = pako.deflate(Uint8Array.from(RGB));
  await expectDecoded("rgb deflate 8", handRgb(8, zlib), opaqueRgb(RGB), 2, 2);
  await expectDecoded("rgb deflate 32946", handRgb(32946, zlib), opaqueRgb(RGB), 2, 2);

  const lzw = await sharp(Buffer.from(RGB), { raw: { width: 2, height: 2, channels: 3 } })
    .tiff({ compression: "lzw", predictor: "none" })
    .toBuffer();
  await expectDecoded("rgb lzw", new Uint8Array(lzw), opaqueRgb(RGB), 2, 2);

  const predicted = await sharp(Buffer.from(RGB), { raw: { width: 2, height: 2, channels: 3 } })
    .tiff({ compression: "lzw", predictor: "horizontal" })
    .toBuffer();
  await expectDecoded("rgb lzw predictor 2", new Uint8Array(predicted), opaqueRgb(RGB), 2, 2);

  const gray = [0, 64, 128, 255];
  await expectDecoded(
    "grayscale",
    buildTiff([
      {
        entries: [
          short(256, 4),
          short(257, 1),
          short(258, 8),
          short(259, 1),
          short(262, 1),
          long(273, 0),
          short(277, 1),
          long(278, 1),
          long(279, null),
        ],
        pixels: Uint8Array.from(gray),
      },
    ]),
    opaqueGray(gray),
    4,
    1,
  );

  await expectDecoded(
    "bilevel uncompressed",
    buildTiff([
      {
        entries: [
          short(256, 8),
          short(257, 1),
          short(258, 1),
          short(259, 1),
          short(262, 1),
          long(273, 0),
          short(277, 1),
          long(278, 1),
          long(279, null),
        ],
        pixels: Uint8Array.from([0b10110000]),
      },
    ]),
    opaqueGray([255, 0, 255, 255, 0, 0, 0, 0]),
    8,
    1,
  );

  const eofb = "000000000001000000000001";
  const faxBits = `00110001100110000000110111${eofb}`;
  const fax: number[] = [];
  let accumulator = 0;
  let bitCount = 0;
  for (const bit of faxBits) {
    accumulator = (accumulator << 1) | (bit === "1" ? 1 : 0);
    bitCount += 1;
    if (bitCount === 8) {
      fax.push(accumulator);
      accumulator = 0;
      bitCount = 0;
    }
  }
  if (bitCount) fax.push(accumulator << (8 - bitCount));
  await expectDecoded(
    "bilevel group 4",
    buildTiff([
      {
        entries: [
          short(256, 8),
          short(257, 1),
          short(258, 1),
          short(259, 4),
          short(262, 0),
          short(266, 1),
          long(273, 0),
          short(277, 1),
          long(278, 1),
          long(279, null),
        ],
        pixels: Uint8Array.from(fax),
      },
    ]),
    opaqueGray([255, 255, 255, 0, 0, 255, 255, 255]),
    8,
    1,
  );

  const rgbaRaw = [255, 0, 0, 255, 0, 255, 0, 0, 0, 0, 255, 128];
  const alphaFile = buildTiff([
    {
      entries: [
        short(256, 3),
        short(257, 1),
        { tag: 258, type: 3, count: 4, values: [8, 8, 8, 8] },
        short(259, 1),
        short(262, 2),
        long(273, 0),
        short(277, 4),
        long(278, 1),
        long(279, null),
        short(338, 2),
      ],
      pixels: Uint8Array.from(rgbaRaw),
    },
  ]);
  await expectDecoded("rgba alpha", alphaFile, rgbaRaw, 3, 1);

  const grid: number[] = [];
  for (let value = 1; value <= 6; value += 1) grid.push(value, 0, 0);
  const orientationSpec: Record<number, number[]> = {
    1: [1, 2, 3, 4, 5, 6],
    2: [3, 2, 1, 6, 5, 4],
    3: [6, 5, 4, 3, 2, 1],
    4: [4, 5, 6, 1, 2, 3],
    5: [1, 4, 2, 5, 3, 6],
    6: [4, 1, 5, 2, 6, 3],
    7: [6, 3, 5, 2, 4, 1],
    8: [3, 6, 2, 5, 1, 4],
  };
  const orientedSource = opaqueRgb(grid);
  for (const [tag, expected] of Object.entries(orientationSpec)) {
    const orientation = Number(tag);
    const swapped = orientation >= 5;
    const turned = orientTiffRgba(Uint8Array.from(orientedSource), 3, 2, orientation);
    const reds = Array.from(turned.rgba).filter((_, index) => index % 4 === 0);
    assert(
      `orientation ${orientation} transform`,
      turned.width === (swapped ? 2 : 3) &&
        turned.height === (swapped ? 3 : 2) &&
        same(Uint8Array.from(reds), expected),
      reds.join(","),
    );
  }
  for (const orientation of [1, 3, 6, 8]) {
    const file = buildTiff([
      {
        entries: [...rgbEntries(3, 2, 1), short(274, orientation)],
        pixels: Uint8Array.from(grid),
      },
    ]);
    const decoded = await decodeTiffBytes(file);
    const reds = Array.from(decoded.rgba).filter((_, index) => index % 4 === 0);
    const swapped = orientation >= 5;
    assert(
      `orientation ${orientation} decoded`,
      decoded.width === (swapped ? 2 : 3) &&
        decoded.height === (swapped ? 3 : 2) &&
        same(Uint8Array.from(reds), orientationSpec[orientation] ?? []),
      reds.join(","),
    );
  }

  const page0 = [9, 0, 0, 9, 0, 0];
  const page1 = [0, 9, 0, 0, 9, 0];
  const multipage = buildTiff([
    { entries: rgbEntries(2, 1, 1), pixels: Uint8Array.from(page0) },
    { entries: rgbEntries(2, 1, 1), pixels: Uint8Array.from(page1) },
  ]);
  const multiDecoded = await decodeTiffBytes(multipage);
  assert(
    "multipage converts first page and reports another page",
    multiDecoded.extraPages && same(multiDecoded.rgba, opaqueRgb(page0)),
    Array.from(multiDecoded.rgba).join(","),
  );
  assert(
    "multipage notice is exact",
    TIFF_MULTIPAGE_NOTICE === "This TIFF contains multiple pages. The first page was converted.",
  );

  const reduced = buildTiff([
    {
      entries: [...rgbEntries(1, 1, 1), short(254, 1)],
      pixels: Uint8Array.from([1, 2, 3]),
    },
    { entries: rgbEntries(2, 1, 1), pixels: Uint8Array.from(page0) },
  ]);
  const reducedDecoded = await decodeTiffBytes(reduced);
  assert(
    "reduced-resolution IFD is not a page",
    !reducedDecoded.extraPages && reducedDecoded.width === 2 && same(reducedDecoded.rgba, opaqueRgb(page0)),
  );

  const subFile = buildTiff([
    {
      entries: [...rgbEntries(1, 1, 1), { tag: 330, type: 4, count: 1, value: 0, dir: 1 }],
      pixels: Uint8Array.from([4, 5, 6]),
      next: "none",
    },
    { entries: rgbEntries(1, 1, 1), pixels: Uint8Array.from([1, 2, 3]), next: "none" },
  ]);
  const subDecoded = await decodeTiffBytes(subFile);
  assert(
    "sub-IFD is not a top-level page",
    !subDecoded.extraPages && same(subDecoded.rgba, opaqueRgb([4, 5, 6])),
  );

  assert(
    ".tif is accepted",
    validateFormatFile(new File([blobBytes(uncompressed)], "scan.tif", { type: "" }), "tiff"),
  );
  assert(
    ".tiff is accepted",
    validateFormatFile(new File([blobBytes(uncompressed)], "scan.tiff", { type: "" }), "tiff"),
  );
  assert(
    "image/tiff is accepted",
    validateFormatFile(new File([blobBytes(uncompressed)], "scan.bin", { type: "image/tiff" }), "tiff"),
  );
  await expectReject("corrupt truncated", uncompressed.slice(0, 4), TIFF_ERROR_NOT_TIFF);
  await expectReject(
    "png renamed to tif",
    Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    TIFF_ERROR_NOT_TIFF,
  );
  await expectReject("unsupported compression", handRgb(99, Uint8Array.from(RGB)), TIFF_ERROR_UNSUPPORTED);
  await expectReject(
    "bigtiff",
    Uint8Array.from([0x49, 0x49, 0x2b, 0x00, 0x08, 0x00, 0x00, 0x00]),
    TIFF_ERROR_BIGTIFF,
  );
  await expectReject(
    "planar configuration 2",
    handRgb(1, Uint8Array.from(RGB), [short(284, 2)]),
    TIFF_ERROR_UNSUPPORTED,
  );
  await expectReject(
    "unsafe dimension",
    buildTiff([
      {
        entries: rgbEntries(9000, 1, 1),
        pixels: Uint8Array.from([1, 2, 3]),
      },
    ]),
    TIFF_ERROR_TOO_LARGE,
  );
  const wide = new Uint8Array(8192 * 3);
  const allowedEdge = buildTiff([{ entries: rgbEntries(8192, 1, 1), pixels: wide }]);
  const inspected = inspectTiffBytes(allowedEdge);
  assert("8192 edge is inside the decoded-memory ceiling", inspected.width === 8192 && inspected.height === 1);

  const cyclic = buildTiff([
    { entries: rgbEntries(1, 1, 1), pixels: Uint8Array.from([1, 2, 3]), linkTo: 8 },
  ]);
  await expectReject("cyclic IFD", cyclic, TIFF_ERROR_DAMAGED);

  const alpha = await decodeTiffBytes(alphaFile);
  await assertCanvasOutput(alpha.rgba, alpha.width, alpha.height);

  const converterSource = readFileSync(join(root, "lib/image/convert-format.ts"), "utf8");
  const toolSource = readFileSync(join(root, "components/image-tools/ImageFormatConverterTool.tsx"), "utf8");
  assert("tiff decode is a dedicated branch", converterSource.includes('options.from === "tiff"'));
  assert("tiff uses the shared canvas encoder", converterSource.includes("encodeCanvas(decoded.canvas, options)"));
  assert("jpeg flatten default remains white", converterSource.includes('options.backgroundColor ?? "#ffffff"'));
  assert("png encoding is reused", converterSource.includes("canvasToPngBlob"));
  assert("heic decode path remains", converterSource.includes("decodeHeicFile"));
  assert("native normalization remains", converterSource.includes("normalizeImageToCanvas"));
  assert(
    "gate is called without a file-size argument",
    toolSource.includes("gateToolOperation(config.slug)") &&
      !toolSource.includes("gateToolOperation(config.slug,"),
  );
  assert("multipage notice is shown after conversion", toolSource.includes("notice"));
  assert(
    "tiff preview is decoded locally instead of using the file as an image",
    toolSource.includes("createTiffPreview") &&
      toolSource.includes('previewUrl: isTiff ? "" : URL.createObjectURL(file)'),
  );
  const previewSource = readFileSync(join(root, "lib/image/tiff-preview.ts"), "utf8");
  assert(
    "tiff thumbnail uses the conversion ceiling instead of a separate 16MP refusal",
    previewSource.includes("inspectTiffFile") &&
      previewSource.includes("decodeTiffToCanvas") &&
      previewSource.includes("TIFF_PREVIEW_LONG_EDGE = 480") &&
      !previewSource.includes("16_000_000") &&
      !previewSource.includes("5120"),
  );

  if (typeof FileReader === "undefined") {
    class NodeFileReader {
      result: ArrayBuffer | null = null;
      onload: ((event: { target: { result: ArrayBuffer | null } }) => void) | null = null;
      onerror: ((event: { target: { error: Error } }) => void) | null = null;
      readAsArrayBuffer(blob: Blob): void {
        void blob.arrayBuffer().then(
          (buffer) => {
            this.result = buffer;
            this.onload?.({ target: { result: buffer } });
          },
          (error: Error) => {
            this.onerror?.({ target: { error } });
          },
        );
      }
    }
    globalThis.FileReader = NodeFileReader as unknown as typeof FileReader;
  }

  const single = await packageOutputsForDownload(
    [{ filename: "one.jpg", blob: new Blob(["one"]) }],
    "scanonix-tiff-to-jpg.zip",
  );
  const zipped = await packageOutputsForDownload(
    [
      { filename: "one.jpg", blob: new Blob(["one"]) },
      { filename: "two.jpg", blob: new Blob(["two"]) },
    ],
    "scanonix-tiff-to-jpg.zip",
  );
  const zipHeader = new Uint8Array(await zipped.blob.arrayBuffer());
  assert("one selected file is not zipped", single.filename === "one.jpg");
  assert(
    "multiple selected files use the existing zip",
    zipped.filename === "scanonix-tiff-to-jpg.zip" && zipHeader[0] === 0x50 && zipHeader[1] === 0x4b,
  );

  for (const slug of ["tiff-to-jpg", "tiff-to-png"] as const) {
    const access = TOOL_ACCESS[slug];
    const seo = TOOL_SEO[slug];
    assert(
      `${slug} is free local`,
      access?.processing === "client" && access.requiresAuth === false && access.requiresPro === false,
    );
    assert(`${slug} is canonical`, CANONICAL_TOOL_IDS.includes(slug));
    assert(`${slug} is indexable`, INDEXABLE_TOOL_PATHS.includes(`/tools/${slug}`));
    assert(`${slug} page exists`, Boolean(getConverterBySlug(slug)));
    assert(
      `${slug} copy avoids unsupported claims`,
      Boolean(seo) &&
        !/all tiff variants|bigtiff support|preserves cmyk|preserves 16-bit|all pages|unlimited/i.test(
          `${seo?.metaDescription} ${seo?.pageDescription}`,
        ) &&
        /browser/i.test(seo?.metaDescription ?? "") &&
        (seo?.limitations ?? []).some((line) => /first page|BigTIFF/i.test(line)),
    );
  }
  assert("canonical inventory is 43", CANONICAL_TOOL_IDS.length === 43);

  for (const slug of [
    "png-to-jpg",
    "jpg-to-png",
    "png-to-webp",
    "jpg-to-webp",
    "webp-to-jpg",
    "webp-to-png",
    "heic-to-jpg",
    "heic-to-png",
  ]) {
    assert(`${slug} converter remains registered`, Boolean(getConverterBySlug(slug)));
  }

  await assertRenderedGeometry();

  console.log(failed === 0 ? "\nTIFF converter verification passed\n" : `\n${failed} failed\n`);
  process.exit(failed === 0 ? 0 : 1);
}

async function writeGeometryTiff(file: string): Promise<void> {
  await sharp({
    create: { width: 640, height: 360, channels: 3, background: { r: 32, g: 96, b: 180 } },
  })
    .tiff({ compression: "lzw" })
    .toFile(file);
}

type Box = { x: number; y: number; width: number; height: number };

async function measureLoaded(page: Page): Promise<{
  innerWidth: number;
  dpr: number;
  thumb: Box;
  file: Box;
  inspector: Box;
  slider: Box | null;
  cta: Box;
  checker: Box;
  stageColumns: string;
  stageDisplay: string;
  overflow: number;
}> {
  const readGeometry = new Function(
    `return (() => {
      const box = (selector) => {
        const node = document.querySelector(selector);
        if (!node) return null;
        const rect = node.getBoundingClientRect();
        return { x: rect.x, y: rect.y, width: rect.width, height: rect.height };
      };
      const stageNode = document.querySelector(".tiff-stage");
      const stage = stageNode ? getComputedStyle(stageNode) : null;
      const cta = document.querySelector("[data-converter-primary='desktop']");
      const ctaBox = cta ? cta.getBoundingClientRect() : null;
      return {
        innerWidth: window.innerWidth,
        dpr: window.devicePixelRatio,
        thumb: box(".tiff-thumb"),
        file: box(".tiff-file"),
        inspector: box(".tiff-inspector"),
        slider: box("[data-converter-control='quality']"),
        cta: ctaBox
          ? { x: ctaBox.x, y: ctaBox.y, width: ctaBox.width, height: ctaBox.height }
          : { x: 0, y: 0, width: 0, height: 0 },
        checker: box(".tiff-checker"),
        stageColumns: stage ? stage.gridTemplateColumns : "",
        stageDisplay: stage ? stage.display : "",
        overflow: document.documentElement.scrollWidth - window.innerWidth,
      };
    })();`,
  ) as () => Promise<{
    innerWidth: number;
    dpr: number;
    thumb: Box | null;
    file: Box | null;
    inspector: Box | null;
    slider: Box | null;
    cta: Box;
    checker: Box | null;
    stageColumns: string;
    stageDisplay: string;
    overflow: number;
  }>;
  const facts = await page.evaluate(readGeometry);
  if (!facts.thumb || !facts.file || !facts.inspector || !facts.checker) {
    throw new Error("TIFF workspace nodes were not rendered");
  }
  return {
    innerWidth: facts.innerWidth,
    dpr: facts.dpr,
    thumb: facts.thumb,
    file: facts.file,
    inspector: facts.inspector,
    slider: facts.slider,
    cta: facts.cta,
    checker: facts.checker,
    stageColumns: facts.stageColumns,
    stageDisplay: facts.stageDisplay,
    overflow: facts.overflow,
  };
}

async function openLoaded(browser: Browser, url: string, file: string, width: number) {
  const page = await browser.newPage();
  await page.setViewport({ width, height: 900, deviceScaleFactor: 1 });
  await page.evaluateOnNewDocument(() => {
    localStorage.setItem("scanonix-theme", "bright");
    localStorage.setItem(
      "scanonix_consent_v1",
      JSON.stringify({ analytics: false, decidedAt: "2026-10-07T00:00:00.000Z", version: 1 }),
    );
  });
  await page.goto(url, { waitUntil: "networkidle0", timeout: 90000 });
  const input = await page.waitForSelector("input[type=file]");
  if (!input) throw new Error("file input missing");
  await input.uploadFile(file);
  await page.waitForFunction(
    () => {
      const image = document.querySelector(".tiff-thumb img");
      return Boolean(image && (image as HTMLImageElement).complete && (image as HTMLImageElement).naturalWidth > 0);
    },
    { timeout: 30000 },
  );
  return page;
}

async function assertRenderedGeometry(): Promise<void> {
  let reachable = false;
  try {
    const response = await fetch("http://localhost:3000/tools/tiff-to-jpg");
    reachable = response.ok;
  } catch {
    reachable = false;
  }
  assert("rendered geometry requires the local page", reachable);
  if (!reachable) return;

  const file = join(tmpdir(), "scanonix-tiff-geometry.tif");
  await writeGeometryTiff(file);
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    channel: "chrome",
    args: ["--disable-dev-shm-usage"],
  });
  try {
    const desktop = await openLoaded(browser, "http://localhost:3000/tools/tiff-to-jpg", file, 1440);
    const jpg = await measureLoaded(desktop);
    await desktop.close();
    const beside =
      jpg.stageDisplay === "grid" &&
      jpg.inspector.x >= jpg.file.x + jpg.file.width - 8 &&
      Math.abs(jpg.inspector.y - jpg.file.y) < 120;
    assert(
      "desktop jpg thumbnail is at most 180×120",
      jpg.thumb.width <= 180 && jpg.thumb.height <= 120 && jpg.thumb.width >= 100,
      `${Math.round(jpg.thumb.width)}×${Math.round(jpg.thumb.height)} inner ${jpg.innerWidth} dpr ${jpg.dpr}`,
    );
    assert(
      "desktop jpg file row is at most 140px tall",
      jpg.file.height <= 140 && jpg.file.height >= 80,
      `${Math.round(jpg.file.height)}px`,
    );
    assert(
      "desktop jpg inspector is a 280–400px column beside the file",
      beside && jpg.inspector.width >= 280 && jpg.inspector.width <= 400,
      `${Math.round(jpg.inspector.width)}px columns ${jpg.stageColumns}`,
    );
    assert(
      "desktop jpg slider stays inside the inspector",
      Boolean(jpg.slider) && jpg.slider!.width <= jpg.inspector.width + 1 && jpg.slider!.width >= jpg.inspector.width - 24,
      jpg.slider ? `${Math.round(jpg.slider.width)} vs inspector ${Math.round(jpg.inspector.width)}` : "missing",
    );
    assert(
      "desktop jpg action stays inside the inspector",
      jpg.cta.width > 0 && jpg.cta.width <= jpg.inspector.width + 1 && jpg.cta.width >= jpg.inspector.width - 8,
      `${Math.round(jpg.cta.width)} vs page ${jpg.innerWidth}`,
    );
    assert(
      "checkerboard matches the thumbnail frame",
      Math.abs(jpg.checker.width - jpg.thumb.width) <= 1 &&
        Math.abs(jpg.checker.height - jpg.thumb.height) <= 1 &&
        Math.abs(jpg.checker.x - jpg.thumb.x) <= 1,
      `${Math.round(jpg.checker.width)}×${Math.round(jpg.checker.height)}`,
    );

    const pngPage = await openLoaded(browser, "http://localhost:3000/tools/tiff-to-png", file, 1440);
    const png = await measureLoaded(pngPage);
    await pngPage.close();
    const pngBeside = png.inspector.x >= png.file.x + png.file.width - 8;
    assert(
      "desktop png inspector is the same bounded column",
      pngBeside &&
        png.inspector.width >= 280 &&
        png.inspector.width <= 400 &&
        png.thumb.width <= 180 &&
        png.thumb.height <= 120 &&
        png.file.height <= 140 &&
        png.cta.width <= png.inspector.width + 1,
      `inspector ${Math.round(png.inspector.width)} thumb ${Math.round(png.thumb.width)}×${Math.round(png.thumb.height)}`,
    );

    const mobile = await openLoaded(browser, "http://localhost:3000/tools/tiff-to-jpg", file, 390);
    const narrow = await measureLoaded(mobile);
    await mobile.close();
    assert(
      "mobile stacks without horizontal overflow",
      narrow.inspector.y >= narrow.file.y + narrow.file.height - 4 &&
        narrow.overflow <= 1 &&
        narrow.thumb.width <= 180,
      `overflow ${narrow.overflow} inner ${narrow.innerWidth}`,
    );

    const plain = await browser.newPage();
    await plain.setViewport({ width: 1440, height: 900, deviceScaleFactor: 1 });
    await plain.goto("http://localhost:3000/tools/png-to-jpg", { waitUntil: "networkidle0", timeout: 90000 });
    const shared = await plain.evaluate(() => ({
      tiff: Boolean(document.querySelector(".tiff-stage")),
      drop: Boolean(document.querySelector(".converter-drop")),
    }));
    await plain.close();
    assert("png to jpg does not use the tiff workspace", shared.drop && !shared.tiff);
  } finally {
    await browser.close();
  }
}

async function assertCanvasOutput(rgba: Uint8Array, width: number, height: number): Promise<void> {
  const puppeteer = await import("puppeteer");
  const browser = await puppeteer.default.launch({
    headless: true,
    channel: "chrome",
    args: ["--disable-dev-shm-usage"],
  });
  try {
    const page = await browser.newPage();
    const readOutput = new Function(
      "payload",
      `return (async () => {
        const pixels = payload.pixels;
        const imageWidth = payload.imageWidth;
        const imageHeight = payload.imageHeight;
        const source = document.createElement("canvas");
        source.width = imageWidth;
        source.height = imageHeight;
        const sourceContext = source.getContext("2d");
        if (!sourceContext) return null;
        sourceContext.putImageData(new ImageData(new Uint8ClampedArray(pixels), imageWidth, imageHeight), 0, 0);
        const flat = document.createElement("canvas");
        flat.width = imageWidth;
        flat.height = imageHeight;
        const flatContext = flat.getContext("2d");
        if (!flatContext) return null;
        flatContext.fillStyle = "#ffffff";
        flatContext.fillRect(0, 0, imageWidth, imageHeight);
        flatContext.drawImage(source, 0, 0);
        const pngBlob = await new Promise((resolve) => source.toBlob(resolve, "image/png"));
        const jpgBlob = await new Promise((resolve) => flat.toBlob(resolve, "image/jpeg", 0.92));
        if (!pngBlob || !jpgBlob) return null;
        const readBlob = async (blob) => {
          const bitmap = await createImageBitmap(blob);
          const canvas = document.createElement("canvas");
          canvas.width = bitmap.width;
          canvas.height = bitmap.height;
          const context = canvas.getContext("2d");
          if (!context) return [];
          context.drawImage(bitmap, 0, 0);
          return Array.from(context.getImageData(0, 0, canvas.width, canvas.height).data);
        };
        const jpgBytes = Array.from(new Uint8Array(await jpgBlob.arrayBuffer())).slice(0, 3);
        return {
          png: await readBlob(pngBlob),
          flat: Array.from(flatContext.getImageData(0, 0, imageWidth, imageHeight).data),
          jpgBytes,
        };
      })();`,
    ) as (payload: {
      pixels: number[];
      imageWidth: number;
      imageHeight: number;
    }) => Promise<{ png: number[]; flat: number[]; jpgBytes: number[] } | null>;
    const result = await page.evaluate(readOutput, {
      pixels: Array.from(rgba),
      imageWidth: width,
      imageHeight: height,
    });

    const png = result?.png ?? [];
    const flat = result?.flat ?? [];
    const jpgBytes = result?.jpgBytes ?? [];
    assert(
      "png preserves decoded alpha",
      png[3] === 255 && png[7] === 0 && png[11] === 128,
      png.slice(0, 12).join(","),
    );
    const transparentFlattened =
      flat[4] === 255 && flat[5] === 255 && flat[6] === 255 && flat[7] === 255;
    const opaqueRedKept = flat[0] === 255 && flat[1] === 0 && flat[2] === 0 && flat[3] === 255;
    assert(
      "jpg flattens transparency onto white",
      transparentFlattened &&
        opaqueRedKept &&
        jpgBytes[0] === 255 &&
        jpgBytes[1] === 216 &&
        jpgBytes[2] === 255,
      `${flat.slice(0, 12).join(",")} jpeg ${jpgBytes.join(",")}`,
    );
  } finally {
    await browser.close();
  }
}

void main();
