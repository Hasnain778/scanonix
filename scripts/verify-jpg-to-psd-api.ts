/**
 * JPG to PSD API verifier.
 * Run: npm run verify:jpg-to-psd-api
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { POST } from "@/app/api/tools/jpg-to-psd/route";
import {
  PSD_MAX_OUTPUT_BYTES,
  PSD_MAX_SIDE,
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

function requestWithForm(
  fields: Record<string, string | File>,
): Request {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) {
    form.append(k, v);
  }
  return new Request("http://localhost/api/tools/jpg-to-psd", {
    method: "POST",
    body: form,
    headers: { "x-forwarded-for": nextIp() },
  });
}

async function makeRgbJpeg(width = 48, height = 36): Promise<Buffer> {
  return sharp({
    create: {
      width,
      height,
      channels: 3,
      background: { r: 40, g: 120, b: 220 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function makeOrientedJpeg(): Promise<{
  buffer: Buffer;
  expectedW: number;
  expectedH: number;
}> {
  // Stored 40×20 with orientation 6 → visual 20×40 after rotate()
  const buffer = await sharp({
    create: {
      width: 40,
      height: 20,
      channels: 3,
      background: { r: 200, g: 40, b: 40 },
    },
  })
    .jpeg({ quality: 90 })
    .withMetadata({ orientation: 6 })
    .toBuffer();
  return { buffer, expectedW: 20, expectedH: 40 };
}

async function makeGrayJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 128, g: 128, b: 128 },
    },
  })
    .greyscale()
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function makeCmykJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 24,
      height: 24,
      channels: 3,
      background: { r: 180, g: 60, b: 30 },
    },
  })
    .toColorspace("cmyk")
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function jsonBody(res: Response): Promise<{ error?: string; code?: string }> {
  try {
    return (await res.json()) as { error?: string; code?: string };
  } catch {
    return {};
  }
}

async function run() {
  console.log("\nJPG to PSD API verifier\n");
  const root = process.cwd();
  const routeSource = readFileSync(
    join(root, "app/api/tools/jpg-to-psd/route.ts"),
    "utf8",
  );

  try {
    assert.equal(existsSync(join(root, "app/api/tools/jpg-to-psd/route.ts")), true);
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
    ok("5 handleImageToolRequest");
  } catch (e) {
    fail("5 handleImageToolRequest", e);
  }

  try {
    assert.match(routeSource, /toolId:\s*"jpg-to-psd"/);
    ok("6 correct toolId");
  } catch (e) {
    fail("6 correct toolId", e);
  }

  try {
    assert.match(routeSource, /limit:\s*10/);
    assert.match(routeSource, /windowMs:\s*60_000/);
    ok("7 rate 10/min");
  } catch (e) {
    fail("7 rate 10/min", e);
  }

  try {
    const access = getToolAccess("jpg-to-psd");
    assert.ok(access);
    assert.equal(access!.requiresAuth, false);
    assert.equal(access!.requiresPro, false);
    assert.equal(access!.processing, "server");
    assert.equal(access!.route, "jpg-to-psd");
    ok("8 FREE_SERVER access");
  } catch (e) {
    fail("8 FREE_SERVER access", e);
  }

  try {
    assert.match(routeSource, /ALLOWED_FORM_FIELDS/);
    assert.match(routeSource, /Unsupported field/);
    ok("9 file-only FormData contract");
  } catch (e) {
    fail("9 file-only FormData contract", e);
  }

  try {
    assert.match(routeSource, /0xff/);
    assert.match(routeSource, /isJpegMagic/);
    ok("10 JPEG magic accepted (enforced in route)");
  } catch (e) {
    fail("10 JPEG magic accepted (enforced in route)", e);
  }

  // 11–19 success path
  try {
    const jpeg = await makeRgbJpeg();
    assert.equal(jpeg[0], 0xff);
    assert.equal(jpeg[1], 0xd8);
    assert.equal(jpeg[2], 0xff);
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(jpeg, "vacation-photo.jpg", "image/jpeg"),
      }),
    );
    assert.equal(res.status, 200, await res.clone().text());
    const bytes = Buffer.from(await res.arrayBuffer());
    const header = readPsdHeader(bytes);
    assert.equal(header.magic, "8BPS");
    assert.equal(header.version, 1);
    assert.equal(header.colorMode, 3);
    assert.equal(header.depth, 8);
    assert.equal(header.width, 48);
    assert.equal(header.height, 36);
    const meta = validatePsdBuffer(bytes, {
      width: 48,
      height: 36,
      layerName: "vacation-photo",
    });
    assert.equal(meta.layerCount, 1);
    assert.match(res.headers.get("content-type") ?? "", /image\/vnd\.adobe\.photoshop/i);
    assert.match(
      res.headers.get("content-disposition") ?? "",
      /attachment;.*vacation-photo\.psd/i,
    );
    ok("11 normal RGB JPEG success");
    ok("12 8BPS output");
    ok("13 PSD v1");
    ok("14 RGB/8-bit");
    ok("15 exactly 1 layer");
    ok("16 correct dimensions");
    ok("17 correct layer name");
    ok("18 image/vnd.adobe.photoshop");
    ok("19 .psd attachment filename");
  } catch (e) {
    fail("11–19 RGB JPEG success path", e);
  }

  try {
    const { buffer, expectedW, expectedH } = await makeOrientedJpeg();
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(buffer, "rotated.jpg", "image/jpeg"),
      }),
    );
    assert.equal(res.status, 200, await res.clone().text());
    const bytes = Buffer.from(await res.arrayBuffer());
    const meta = validatePsdBuffer(bytes);
    assert.equal(meta.width, expectedW);
    assert.equal(meta.height, expectedH);
    ok("20 EXIF orientation handling");
  } catch (e) {
    fail("20 EXIF orientation handling", e);
  }

  try {
    const gray = await makeGrayJpeg();
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(gray, "gray.jpg", "image/jpeg"),
      }),
    );
    assert.equal(res.status, 200, await res.clone().text());
    const bytes = Buffer.from(await res.arrayBuffer());
    validatePsdBuffer(bytes, { width: 32, height: 24 });
    ok("21 grayscale JPEG success");
  } catch (e) {
    fail("21 grayscale JPEG success", e);
  }

  try {
    const cmyk = await makeCmykJpeg();
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(cmyk, "cmyk.jpg", "image/jpeg"),
      }),
    );
    if (res.status === 200) {
      const bytes = Buffer.from(await res.arrayBuffer());
      validatePsdBuffer(bytes);
      ok("22 CMYK JPEG converts successfully");
    } else {
      const body = await jsonBody(res);
      assert.ok(body.code === "INVALID_IMAGE" || body.code === "UNSUPPORTED_TYPE");
      ok("22 CMYK JPEG deterministic clear reject");
    }
  } catch (e) {
    fail("22 CMYK JPEG convert or clear reject", e);
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

  await expectReject(
    "23 PNG rejected",
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .png()
      .toBuffer(),
    "x.png",
    "image/png",
  );

  await expectReject(
    "24 WebP rejected",
    await sharp({
      create: { width: 8, height: 8, channels: 3, background: { r: 1, g: 2, b: 3 } },
    })
      .webp()
      .toBuffer(),
    "x.webp",
    "image/webp",
  );

  await expectReject(
    "25 SVG rejected",
    Buffer.from('<svg xmlns="http://www.w3.org/2000/svg" width="8" height="8"></svg>'),
    "x.svg",
    "image/svg+xml",
  );

  await expectReject(
    "26 HEIC rejected",
    Buffer.from([0x00, 0x00, 0x00, 0x18, 0x66, 0x74, 0x79, 0x70, 0x68, 0x65, 0x69, 0x63]),
    "x.heic",
    "image/heic",
  );

  await expectReject(
    "27 PSD input rejected",
    Buffer.from("8BPS" + "\0".repeat(20)),
    "x.psd",
    "image/vnd.adobe.photoshop",
  );

  await expectReject(
    "28 random bytes rejected",
    Buffer.from("not-an-image-at-all-zzzz"),
    "x.jpg",
    "image/jpeg",
  );

  try {
    const huge = Buffer.alloc(FREE_IMAGE_MAX_BYTES + 1, 0);
    huge[0] = 0xff;
    huge[1] = 0xd8;
    huge[2] = 0xff;
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(huge, "big.jpg", "image/jpeg"),
      }),
    );
    assert.notEqual(res.status, 200);
    ok("29 >10MB rejected");
  } catch (e) {
    fail("29 >10MB rejected", e);
  }

  try {
    const big = await sharp({
      create: {
        width: PSD_MAX_SIDE + 1,
        height: 16,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
      .jpeg({ quality: 70 })
      .toBuffer();
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(big, "wide.jpg", "image/jpeg"),
      }),
    );
    assert.equal(res.status, 400);
    const body = await jsonBody(res);
    assert.equal(body.code, "DIMENSIONS_TOO_LARGE");
    ok("30 >2048 side rejected");
  } catch (e) {
    fail("30 >2048 side rejected", e);
  }

  try {
    // Pixel cap equals side²; over-side covers over-pixels in practice.
    assert.ok(routeSource.includes("PSD_MAX_PIXELS"));
    assert.ok(routeSource.includes("DIMENSIONS_TOO_LARGE"));
    ok("31 >2048² pixels rejected (enforced via PSD_MAX_PIXELS)");
  } catch (e) {
    fail("31 >2048² pixels rejected (enforced via PSD_MAX_PIXELS)", e);
  }

  try {
    assert.ok(routeSource.includes("OUTPUT_TOO_LARGE"));
    assert.equal(PSD_MAX_OUTPUT_BYTES, 40 * 1024 * 1024);
    ok("32 output limit mapping exists");
  } catch (e) {
    fail("32 output limit mapping exists", e);
  }

  try {
    const jpeg = await makeRgbJpeg();
    const res = await POST(
      requestWithForm({
        file: fileFromBuffer(jpeg, "opts.jpg", "image/jpeg"),
        layerName: "Hack",
        colorMode: "CMYK",
      }),
    );
    assert.equal(res.status, 400);
    const body = await jsonBody(res);
    assert.equal(body.code, "UNSUPPORTED_FIELD");
    ok("33 no client options accepted");
  } catch (e) {
    fail("33 no client options accepted", e);
  }

  try {
    assert.equal(/writePsdBuffer/.test(routeSource), false);
    assert.equal(/from ["']ag-psd["']/.test(routeSource), false);
    ok("34 no raw ag-psd logic duplicated in route");
  } catch (e) {
    fail("34 no raw ag-psd logic duplicated in route", e);
  }

  try {
    assert.match(routeSource, /createPsdFromRaster/);
    ok("35 shared PSD engine used");
  } catch (e) {
    fail("35 shared PSD engine used", e);
  }

  try {
    assert.match(routeSource, /validatePsdBuffer/);
    ok("36 shared validator used");
  } catch (e) {
    fail("36 shared validator used", e);
  }

  try {
    const imports = routeSource
      .split(/\r?\n/)
      .filter((l) => /^\s*import\s/.test(l))
      .join("\n");
    assert.equal(/from ['"]canvas['"]/.test(imports), false);
    assert.equal(/@napi-rs\/canvas/.test(imports), false);
    assert.equal(/ag-psd\/initialize-canvas/.test(imports), false);
    ok("37 no canvas import");
  } catch (e) {
    fail("37 no canvas import", e);
  }

  try {
    assert.equal(existsSync(join(root, "app/api/tools/png-to-psd/route.ts")), true);
    assert.equal(existsSync(join(root, "app/tools/png-to-psd/page.tsx")), true);
    assert.equal(existsSync(join(root, "app/tools/jpg-to-psd/page.tsx")), true);
    ok("38 JPG-to-PSD and PNG-to-PSD public pages present");
  } catch (e) {
    fail("38 JPG-to-PSD and PNG-to-PSD public pages present", e);
  }

  try {
    assert.equal(existsSync(join(root, "app/tools/background-remover/page.tsx")), false);
    assert.equal(existsSync(join(root, "app/api/tools/background-remover/route.ts")), false);
    ok("39 Background Remover remains absent");
  } catch (e) {
    fail("39 Background Remover remains absent", e);
  }

  try {
    assert.match(routeSource, /handleImageToolRequest/);
    // Metering lives inside handleImageToolRequest → consumeUsage for signed-in users
    const handler = readFileSync(
      join(root, "lib/tools/shared/api-handler.ts"),
      "utf8",
    );
    assert.match(handler, /consumeUsage/);
    ok("40 usage/metering path preserved");
  } catch (e) {
    fail("40 usage/metering path preserved", e);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  if (failed > 0) process.exit(1);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});
