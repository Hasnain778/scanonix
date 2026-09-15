/**
 * PNG to PSD API verifier.
 * Run: npm run verify:png-to-psd-api
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { POST } from "@/app/api/tools/png-to-psd/route";
import {
  PSD_MAX_OUTPUT_BYTES,
  PSD_MAX_SIDE,
  extractPsdRasterPixels,
  readPsdHeader,
  validatePsdBuffer,
} from "@/lib/design/psd";
import { getToolAccess } from "@/lib/plan/tool-access";
import { FREE_IMAGE_MAX_BYTES } from "@/lib/tools/shared/image-validate";

let passed = 0;
let failed = 0;
let ip = 1;

function ok(name: string) {
  passed += 1;
  console.log(`✓ ${name}`);
}

function fail(name: string, detail: unknown) {
  failed += 1;
  console.error(
    `✗ ${name} — ${detail instanceof Error ? detail.message : String(detail)}`,
  );
}

function nextIp(): string {
  ip += 1;
  return `203.0.113.${ip % 250}`;
}

function fileFromBuffer(buffer: Buffer, name: string, type: string): File {
  return new File([Uint8Array.from(buffer)], name, { type });
}

function requestWithForm(fields: Record<string, string | File>): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v);
  }
  return new Request("http://localhost/api/tools/png-to-psd", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": nextIp() },
  });
}

async function jsonBody(
  res: Response,
): Promise<{ error?: string; code?: string }> {
  try {
    return (await res.json()) as { error?: string; code?: string };
  } catch {
    return {};
  }
}

function sample(
  data: Uint8ClampedArray,
  width: number,
  x: number,
  y: number,
): [number, number, number, number] {
  const i = (y * width + x) * 4;
  return [data[i]!, data[i + 1]!, data[i + 2]!, data[i + 3]!];
}

function crc32(buf: Buffer): number {
  let c = ~0;
  for (let i = 0; i < buf.length; i++) {
    c ^= buf[i]!;
    for (let k = 0; k < 8; k++) {
      c = (c >>> 1) ^ (0xedb88320 & -(c & 1));
    }
  }
  return ~c >>> 0;
}

/** Insert APNG acTL after IHDR so animation is detectable without multi-frame IDAT. */
function withApngActlChunk(png: Buffer): Buffer {
  assert.ok(png.length >= 33);
  assert.equal(png.toString("ascii", 12, 16), "IHDR");
  const ihdrEnd = 33; // sig(8) + IHDR chunk(25)
  const actlData = Buffer.alloc(8);
  actlData.writeUInt32BE(2, 0); // num_frames
  actlData.writeUInt32BE(0, 4); // num_plays
  const typeAndData = Buffer.concat([Buffer.from("acTL"), actlData]);
  const length = Buffer.alloc(4);
  length.writeUInt32BE(8, 0);
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(typeAndData), 0);
  const actl = Buffer.concat([length, typeAndData, crc]);
  return Buffer.concat([png.subarray(0, ihdrEnd), actl, png.subarray(ihdrEnd)]);
}

async function makeRgbPng(width = 48, height = 36): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 120, b: 220 },
    },
  })
    .png()
    .toBuffer();
}

async function makeRgbaAlphaPattern(): Promise<{
  buffer: Buffer;
  width: number;
  height: number;
}> {
  const width = 16;
  const height = 8;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = 200;
      data[i + 1] = 40;
      data[i + 2] = 90;
      if (x < 5) data[i + 3] = 255;
      else if (x < 10) data[i + 3] = 128;
      else data[i + 3] = 0;
    }
  }
  const buffer = await sharp(data, {
    raw: { width, height, channels: 4 },
  })
    .png()
    .toBuffer();
  return { buffer, width, height };
}

async function makeOpaqueAlphaChannelPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 20,
      height: 12,
      channels: 4,
      background: { r: 40, g: 80, b: 120, alpha: 1 },
    },
  })
    .png()
    .toBuffer();
}

async function makeGrayPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .greyscale()
    .png()
    .toBuffer();
}

async function makeGrayAlphaPng(): Promise<Buffer> {
  const width = 16;
  const height = 12;
  const data = Buffer.alloc(width * height * 2);
  for (let i = 0; i < width * height; i++) {
    data[i * 2] = 180;
    data[i * 2 + 1] = i < (width * height) / 2 ? 255 : 100;
  }
  return sharp(data, {
    raw: { width, height, channels: 2 },
  })
    .png()
    .toBuffer();
}

async function makePalettePng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 24,
      height: 16,
      channels: 3,
      background: { r: 10, g: 20, b: 30 },
    },
  })
    .png({ palette: true, colours: 8 })
    .toBuffer();
}

async function makePaletteTrnsPng(): Promise<Buffer> {
  const width = 16;
  const height = 16;
  const data = Buffer.alloc(width * height * 4);
  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4;
      data[i] = 255;
      data[i + 1] = 0;
      data[i + 2] = 0;
      data[i + 3] = x < width / 2 ? 255 : 0;
    }
  }
  return sharp(data, { raw: { width, height, channels: 4 } })
    .png({ palette: true, colours: 16 })
    .toBuffer();
}

async function make16BitPng(): Promise<{ buffer: Buffer; width: number; height: number }> {
  const width = 12;
  const height = 10;
  const data = Buffer.alloc(width * height * 3 * 2);
  for (let i = 0; i < width * height; i++) {
    const o = i * 6;
    data.writeUInt16BE(40000, o);
    data.writeUInt16BE(20000, o + 2);
    data.writeUInt16BE(10000, o + 4);
  }
  const buffer = await sharp(data, {
    // Sharp runtime accepts ushort depth; constructor Raw typings omit it.
    raw: { width, height, channels: 3, depth: "ushort" } as never,
  })
    .toColourspace("rgb16")
    .png()
    .toBuffer();
  return { buffer, width, height };
}

async function assertSuccessPsd(
  label: string,
  buffer: Buffer,
  name: string,
  expected: { width: number; height: number; hasAlphaHeader: boolean },
): Promise<Buffer> {
  const res = await POST(
    requestWithForm({
      file: fileFromBuffer(buffer, name, "image/png"),
    }),
  );
  assert.equal(res.status, 200, `${label}: ${await res.clone().text()}`);
  const bytes = Buffer.from(await res.arrayBuffer());
  const header = readPsdHeader(bytes);
  assert.equal(header.magic, "8BPS");
  assert.equal(header.version, 1);
  assert.equal(header.colorMode, 3);
  assert.equal(header.depth, 8);
  assert.equal(header.width, expected.width);
  assert.equal(header.height, expected.height);
  const meta = validatePsdBuffer(bytes, {
    width: expected.width,
    height: expected.height,
  });
  assert.equal(meta.layerCount, 1);
  assert.match(
    res.headers.get("content-type") ?? "",
    /image\/vnd\.adobe\.photoshop/i,
  );
  assert.match(
    res.headers.get("content-disposition") ?? "",
    /\.psd/i,
  );
  assert.equal(
    res.headers.get("x-image-has-alpha"),
    expected.hasAlphaHeader ? "true" : "false",
  );
  return bytes;
}

async function run() {
  console.log("\nPNG to PSD API verifier\n");
  const root = process.cwd();
  const routePath = join(root, "app/api/tools/png-to-psd/route.ts");
  const routeSource = readFileSync(routePath, "utf8");

  try {
    assert.equal(existsSync(routePath), true);
    ok("1 route exists");
  } catch (e) {
    fail("1 route exists", e);
  }

  try {
    assert.match(routeSource, /export async function POST/);
    assert.equal(/export async function GET/.test(routeSource), false);
    ok("2 POST-only architecture");
  } catch (e) {
    fail("2 POST-only architecture", e);
  }

  try {
    assert.match(routeSource, /runtime\s*=\s*"nodejs"/);
    ok("3 runtime nodejs");
  } catch (e) {
    fail("3 runtime nodejs", e);
  }

  try {
    assert.match(routeSource, /maxDuration\s*=\s*60/);
    ok("4 maxDuration 60");
  } catch (e) {
    fail("4 maxDuration 60", e);
  }

  try {
    assert.match(routeSource, /handleImageToolRequest/);
    assert.match(routeSource, /toolId:\s*"png-to-psd"/);
    assert.match(routeSource, /limit:\s*10/);
    assert.match(routeSource, /windowMs:\s*60_000/);
    ok("5 handleImageToolRequest / toolId / rate 10/min");
  } catch (e) {
    fail("5 handleImageToolRequest / toolId / rate 10/min", e);
  }

  try {
    const access = getToolAccess("png-to-psd");
    assert.ok(access);
    assert.equal(access!.requiresAuth, false);
    assert.equal(access!.requiresPro, false);
    assert.equal(access!.processing, "server");
    assert.equal(access!.route, "png-to-psd");
    ok("6 FREE_SERVER access");
  } catch (e) {
    fail("6 FREE_SERVER access", e);
  }

  try {
    assert.match(routeSource, /0x89/);
    assert.match(routeSource, /0x50/);
    assert.match(routeSource, /0x4e/);
    assert.match(routeSource, /0x47/);
    assert.match(routeSource, /isPngMagic|PNG_SIGNATURE/);
    ok("7 PNG magic signature enforced");
  } catch (e) {
    fail("7 PNG magic signature enforced", e);
  }

  try {
    assert.match(routeSource, /acTL|isAnimatedPng|Animated PNG/);
    ok("8 APNG rejection path present");
  } catch (e) {
    fail("8 APNG rejection path present", e);
  }

  try {
    assert.match(routeSource, /createPsdFromRaster/);
    assert.match(routeSource, /validatePsdBuffer/);
    assert.equal(/from ["']ag-psd["']/.test(routeSource), false);
    assert.equal(/writePsdBuffer/.test(routeSource), false);
    ok("9 shared PSD engine used; no duplicated writer");
  } catch (e) {
    fail("9 shared PSD engine used; no duplicated writer", e);
  }

  try {
    const imports = routeSource
      .split(/\r?\n/)
      .filter((l) => /^\s*import\s/.test(l))
      .join("\n");
    assert.equal(/from ['"]canvas['"]/.test(imports), false);
    assert.equal(/@napi-rs\/canvas/.test(imports), false);
    ok("10 no canvas import");
  } catch (e) {
    fail("10 no canvas import", e);
  }

  // A — ordinary RGB PNG
  try {
    const png = await makeRgbPng();
    assert.equal(png[0], 0x89);
    assert.equal(png[1], 0x50);
    await assertSuccessPsd("A RGB", png, "photo-rgb.png", {
      width: 48,
      height: 36,
      hasAlphaHeader: false,
    });
    ok("A ordinary RGB PNG → opaque PSD");
  } catch (e) {
    fail("A ordinary RGB PNG → opaque PSD", e);
  }

  // B/C/D — RGBA with 255 / 128 / 0
  try {
    const { buffer, width, height } = await makeRgbaAlphaPattern();
    const bytes = await assertSuccessPsd("B RGBA", buffer, "alpha-logo.png", {
      width,
      height,
      hasAlphaHeader: true,
    });
    const extracted = extractPsdRasterPixels(bytes);
    assert.equal(sample(extracted.data, width, 0, 0)[3], 255);
    assert.equal(sample(extracted.data, width, 7, 0)[3], 128);
    assert.equal(sample(extracted.data, width, 15, 0)[3], 0);
    ok("B RGBA PNG accepted");
    ok("C partial alpha (128) preserved");
    ok("D fully transparent pixel (0) preserved");
    ok("B–D opaque alpha (255) preserved");
  } catch (e) {
    fail("B–D RGBA / partial / transparent alpha", e);
  }

  // E — fully opaque alpha-channel PNG → hasAlpha false
  try {
    const png = await makeOpaqueAlphaChannelPng();
    const meta = await sharp(png).metadata();
    assert.equal(meta.hasAlpha, true);
    await assertSuccessPsd("E opaque-alpha", png, "opaque-alpha.png", {
      width: 20,
      height: 12,
      hasAlphaHeader: false,
    });
    ok("E fully opaque alpha-channel PNG → X-Image-Has-Alpha false");
  } catch (e) {
    fail("E fully opaque alpha-channel PNG → X-Image-Has-Alpha false", e);
  }

  // F — grayscale
  try {
    const png = await makeGrayPng();
    await assertSuccessPsd("F gray", png, "gray.png", {
      width: 32,
      height: 24,
      hasAlphaHeader: false,
    });
    ok("F grayscale PNG → RGB 8-bit PSD");
  } catch (e) {
    fail("F grayscale PNG → RGB 8-bit PSD", e);
  }

  // G — grayscale + alpha
  try {
    const png = await makeGrayAlphaPng();
    const meta = await sharp(png).metadata();
    assert.ok((meta.channels ?? 0) >= 2);
    const bytes = await assertSuccessPsd("G gray+A", png, "gray-alpha.png", {
      width: 16,
      height: 12,
      hasAlphaHeader: true,
    });
    const extracted = extractPsdRasterPixels(bytes);
    assert.equal(sample(extracted.data, 16, 0, 0)[3], 255);
    assert.ok(sample(extracted.data, 16, 15, 11)[3] < 255);
    ok("G grayscale + alpha PNG");
  } catch (e) {
    fail("G grayscale + alpha PNG", e);
  }

  // H — palette/indexed
  try {
    const png = await makePalettePng();
    const meta = await sharp(png).metadata();
    // Sharp may report palette via channels/space; accept if encode succeeds as RGB8 PSD.
    assert.ok(meta.format === "png");
    await assertSuccessPsd("H palette", png, "palette.png", {
      width: 24,
      height: 16,
      hasAlphaHeader: false,
    });
    ok("H palette/indexed PNG → RGB 8-bit PSD");
  } catch (e) {
    fail("H palette/indexed PNG → RGB 8-bit PSD", e);
  }

  // I — palette + tRNS
  try {
    const png = await makePaletteTrnsPng();
    const bytes = await assertSuccessPsd("I palette+tRNS", png, "palette-trns.png", {
      width: 16,
      height: 16,
      hasAlphaHeader: true,
    });
    const extracted = extractPsdRasterPixels(bytes);
    assert.equal(sample(extracted.data, 16, 0, 0)[3], 255);
    assert.equal(sample(extracted.data, 16, 15, 0)[3], 0);
    ok("I palette + tRNS PNG transparency preserved");
  } catch (e) {
    fail("I palette + tRNS PNG transparency preserved", e);
  }

  // J — 16-bit → 8-bit
  try {
    const { buffer, width, height } = await make16BitPng();
    const meta = await sharp(buffer).metadata();
    assert.equal(meta.depth, "ushort");
    const bytes = await assertSuccessPsd("J 16-bit", buffer, "hi-bit.png", {
      width,
      height,
      hasAlphaHeader: false,
    });
    const header = readPsdHeader(bytes);
    assert.equal(header.depth, 8);
    ok("J 16-bit PNG accepted → RGB 8-bit PSD");
  } catch (e) {
    fail("J 16-bit PNG accepted → RGB 8-bit PSD", e);
  }

  // K — oversized side
  try {
    const big = await sharp({
      create: {
        width: PSD_MAX_SIDE + 1,
        height: 16,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
      .png()
      .toBuffer();
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(big, "wide.png", "image/png"),
      }),
    );
    assert.equal(res.status, 400);
    const body = await jsonBody(res);
    assert.equal(body.code, "DIMENSIONS_TOO_LARGE");
    ok("K oversized side rejected");
  } catch (e) {
    fail("K oversized side rejected", e);
  }

  // L — pixel cap enforced (side² bound; route checks PSD_MAX_PIXELS)
  try {
    assert.ok(routeSource.includes("PSD_MAX_PIXELS"));
    assert.ok(routeSource.includes("DIMENSIONS_TOO_LARGE"));
    ok("L pixel-limit gate present (PSD_MAX_PIXELS)");
  } catch (e) {
    fail("L pixel-limit gate present (PSD_MAX_PIXELS)", e);
  }

  async function expectReject(
    label: string,
    buffer: Buffer,
    name: string,
    type: string,
    code = "UNSUPPORTED_TYPE",
  ) {
    try {
      const res = await POST(
        requestWithForm({ file: fileFromBuffer(buffer, name, type) }),
      );
      assert.notEqual(res.status, 200);
      const body = await jsonBody(res);
      assert.equal(body.code, code);
      ok(label);
    } catch (e) {
      fail(label, e);
    }
  }

  // M — wrong extension / non-PNG bytes
  await expectReject(
    "M wrong extension with non-PNG bytes rejected",
    Buffer.from("not-a-png-file-zzzzzzzz"),
    "fake.png",
    "image/png",
  );

  // N–U format rejections
  await expectReject(
    "N JPEG rejected",
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .jpeg()
      .toBuffer(),
    "x.jpg",
    "image/jpeg",
  );

  await expectReject(
    "O WebP rejected",
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .webp()
      .toBuffer(),
    "x.webp",
    "image/webp",
  );

  await expectReject(
    "P SVG rejected",
    Buffer.from(
      '<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"></svg>',
    ),
    "x.svg",
    "image/svg+xml",
  );

  await expectReject(
    "Q HEIC rejected",
    Buffer.from([
      0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63,
    ]),
    "x.heic",
    "image/heic",
  );

  await expectReject(
    "R PSD rejected",
    Buffer.from("8BPS" + "\0".repeat(20)),
    "x.psd",
    "image/vnd.adobe.photoshop",
  );

  await expectReject(
    "S GIF rejected",
    Buffer.from("GIF89a" + "\0".repeat(20)),
    "x.gif",
    "image/gif",
  );

  try {
    const avif = await sharp({
      create: {
        width: 8,
        height: 8,
        channels: 3,
        background: { r: 1, g: 2, b: 3 },
      },
    })
      .avif()
      .toBuffer();
    await expectReject("T AVIF rejected", avif, "x.avif", "image/avif");
  } catch (e) {
    // If AVIF encode unavailable in this Sharp build, still reject magic-less/non-PNG.
    fail("T AVIF rejected", e);
  }

  await expectReject(
    "U PDF/random rejected",
    Buffer.from("%PDF-1.4 not an image"),
    "x.pdf",
    "application/pdf",
  );

  // V — APNG
  try {
    const base = await makeRgbPng(8, 8);
    const apng = withApngActlChunk(base);
    assert.ok(apng.includes(Buffer.from("acTL")));
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(apng, "anim.png", "image/png"),
      }),
    );
    assert.equal(res.status, 400);
    const body = await jsonBody(res);
    assert.equal(body.code, "UNSUPPORTED_TYPE");
    assert.match(body.error ?? "", /animated|APNG/i);
    ok("V APNG explicitly rejected");
  } catch (e) {
    fail("V APNG explicitly rejected", e);
  }

  // W — unknown FormData field
  try {
    const png = await makeRgbPng(8, 8);
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(png, "opts.png", "image/png"),
        quality: "90",
        alpha: "keep",
      }),
    );
    assert.equal(res.status, 400);
    const body = await jsonBody(res);
    assert.equal(body.code, "UNSUPPORTED_FIELD");
    ok("W unknown FormData field rejected");
  } catch (e) {
    fail("W unknown FormData field rejected", e);
  }

  try {
    const huge = Buffer.alloc(FREE_IMAGE_MAX_BYTES + 1, 0);
    PNG_SIGNATURE_COPY(huge);
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(huge, "big.png", "image/png"),
      }),
    );
    assert.notEqual(res.status, 200);
    ok("X >10MB rejected");
  } catch (e) {
    fail("X >10MB rejected", e);
  }

  try {
    assert.equal(PSD_MAX_OUTPUT_BYTES, 40 * 1024 * 1024);
    assert.ok(routeSource.includes("OUTPUT_TOO_LARGE"));
    ok("Y output limit mapping exists");
  } catch (e) {
    fail("Y output limit mapping exists", e);
  }

  try {
    assert.equal(existsSync(join(root, "app/tools/png-to-psd/page.tsx")), true);
    assert.equal(existsSync(join(root, "app/api/tools/png-to-psd/route.ts")), true);
    ok("Z public /tools/png-to-psd page and API present");
  } catch (e) {
    fail("Z public /tools/png-to-psd page and API present", e);
  }

  try {
    assert.equal(existsSync(join(root, "app/tools/background-remover/page.tsx")), false);
    assert.equal(
      existsSync(join(root, "app/api/tools/background-remover/route.ts")),
      false,
    );
    ok("Background Remover remains absent");
  } catch (e) {
    fail("Background Remover remains absent", e);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

function PNG_SIGNATURE_COPY(target: Buffer) {
  const sig = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
  for (let i = 0; i < sig.length; i++) target[i] = sig[i]!;
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
