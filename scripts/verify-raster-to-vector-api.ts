/**
 * Raster to Vector API verifier.
 * Run: npm run verify:raster-to-vector-api
 *
 * Calls the route handler directly — no network, no production.
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { POST } from "@/app/api/tools/raster-to-vector/route";
import {
  RASTER_COLOR_COUNTS,
  RASTER_DETAIL_TO_NUMBER,
  RASTER_SMOOTHING_TO_NUMBER,
  parseRasterToVectorOptions,
} from "@/lib/design/vectorize/raster-to-vector-options";
import { validateSvgIsRealVector } from "@/lib/design/vectorize";

const root = process.cwd();
const routePath = join(root, "app", "api", "tools", "raster-to-vector", "route.ts");

let passed = 0;
let failed = 0;

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

async function makeArtPng(): Promise<Buffer> {
  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 3,
      background: { r: 30, g: 144, b: 255 },
    },
  })
    .composite([
      {
        input: await sharp({
          create: {
            width: 28,
            height: 28,
            channels: 3,
            background: { r: 255, g: 200, b: 40 },
          },
        })
          .png()
          .toBuffer(),
        left: 18,
        top: 18,
      },
    ])
    .png()
    .toBuffer();
}

function fileFromBuffer(buffer: Buffer, name: string, type: string): File {
  return new File([Uint8Array.from(buffer)], name, { type });
}

function requestWithFields(
  file: File | null,
  fields: Record<string, string>,
  ipSuffix: string,
): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, value);
  }
  return new Request("http://localhost/api/tools/raster-to-vector", {
    method: "POST",
    body: form,
    headers: {
      "x-forwarded-for": `127.0.2.${ipSuffix}`,
    },
  });
}

async function run() {
  console.log("\nRaster to Vector API verifier\n");

  try {
    const source = readFileSync(routePath, "utf8");
    assert.match(source, /export const runtime = "nodejs"/);
    assert.match(source, /handleImageToolRequest/);
    assert.match(source, /toolId:\s*"raster-to-vector"/);
    assert.match(source, /limit:\s*20/);
    assert.match(source, /preset:\s*"advanced"/);
    assert.match(source, /imageDownloadResponse/);
    assert.match(source, /parseRasterToVectorOptions/);
    ok("1 route exists with node runtime, handler, toolId, rate limit, advanced preset");
  } catch (err) {
    fail("1 route exists with node runtime, handler, toolId, rate limit, advanced preset", err);
  }

  try {
    const form = new FormData();
    form.append("file", fileFromBuffer(Buffer.from("x"), "x.png", "image/png"));
    form.append("colorCount", "24");
    form.append("detail", "High");
    form.append("smoothing", "Balanced");
    form.append("ignoreBackground", "false");
    const parsed = parseRasterToVectorOptions(form);
    assert.equal(parsed.colorCount, 24);
    assert.equal(parsed.detail, RASTER_DETAIL_TO_NUMBER.High);
    assert.equal(parsed.smoothing, RASTER_SMOOTHING_TO_NUMBER.Balanced);
    assert.equal(parsed.ignoreBackground, false);
    ok("2 default allowlist parse maps High/Balanced correctly");
  } catch (err) {
    fail("2 default allowlist parse maps High/Balanced correctly", err);
  }

  try {
    assert.deepEqual([...RASTER_COLOR_COUNTS], [4, 8, 12, 16, 24, 32]);
    assert.equal(RASTER_DETAIL_TO_NUMBER.Low, 16);
    assert.equal(RASTER_DETAIL_TO_NUMBER.Medium, 24);
    assert.equal(RASTER_DETAIL_TO_NUMBER.High, 28);
    assert.equal(RASTER_DETAIL_TO_NUMBER.Max, 30);
    assert.equal(RASTER_SMOOTHING_TO_NUMBER.Sharp, 0.5);
    assert.equal(RASTER_SMOOTHING_TO_NUMBER.Balanced, 0.8);
    assert.equal(RASTER_SMOOTHING_TO_NUMBER.Soft, 2.0);
    ok("3 color/detail/smoothing allowlists and mappings");
  } catch (err) {
    fail("3 color/detail/smoothing allowlists and mappings", err);
  }

  try {
    const form = new FormData();
    form.append("file", fileFromBuffer(Buffer.from("x"), "x.png", "image/png"));
    form.append("colorCount", "64");
    assert.throws(() => parseRasterToVectorOptions(form));
    ok("4 rejects colorCount 64");
  } catch (err) {
    fail("4 rejects colorCount 64", err);
  }

  try {
    const form = new FormData();
    form.append("file", fileFromBuffer(Buffer.from("x"), "x.png", "image/png"));
    form.append("detail", "28");
    assert.throws(() => parseRasterToVectorOptions(form));
    ok("5 rejects raw numeric detail");
  } catch (err) {
    fail("5 rejects raw numeric detail", err);
  }

  try {
    const form = new FormData();
    form.append("file", fileFromBuffer(Buffer.from("x"), "x.png", "image/png"));
    form.append("smoothing", "1.2");
    assert.throws(() => parseRasterToVectorOptions(form));
    ok("6 rejects arbitrary smoothing float");
  } catch (err) {
    fail("6 rejects arbitrary smoothing float", err);
  }

  try {
    const form = new FormData();
    form.append("file", fileFromBuffer(Buffer.from("x"), "x.png", "image/png"));
    form.append("ignoreBackground", "yes");
    assert.throws(() => parseRasterToVectorOptions(form));
    ok('7 rejects ignoreBackground other than "true"/"false"');
  } catch (err) {
    fail('7 rejects ignoreBackground other than "true"/"false"', err);
  }

  try {
    const form = new FormData();
    form.append("file", fileFromBuffer(Buffer.from("x"), "x.png", "image/png"));
    form.append("pathomit", "4");
    assert.throws(() => parseRasterToVectorOptions(form));
    const form2 = new FormData();
    form2.append("file", fileFromBuffer(Buffer.from("x"), "x.png", "image/png"));
    form2.append("tracerOptions", JSON.stringify({ ltres: 1 }));
    assert.throws(() => parseRasterToVectorOptions(form2));
    ok("8 rejects raw tracer / pathomit fields");
  } catch (err) {
    fail("8 rejects raw tracer / pathomit fields", err);
  }

  try {
    const png = await makeArtPng();
    const res = await POST(
      requestWithFields(fileFromBuffer(png, "art.png", "image/png"), {}, "1"),
    );
    assert.equal(res.status, 200);
    const svg = await res.text();
    assert.equal(validateSvgIsRealVector(svg).ok, true);
    assert.match(res.headers.get("content-type") ?? "", /image\/svg\+xml/i);
    assert.equal(/<path\b/i.test(svg), true);
    assert.equal(/<image\b/i.test(svg), false);
    assert.equal(/data:image\//i.test(svg), false);
    assert.equal(/foreignObject/i.test(svg), false);
    ok("9 PNG defaults → real SVG geometry, no raster embed");
  } catch (err) {
    fail("9 PNG defaults → real SVG geometry, no raster embed", err);
  }

  try {
    const png = await makeArtPng();
    const res = await POST(
      requestWithFields(
        fileFromBuffer(png, "art.png", "image/png"),
        {
          colorCount: "8",
          detail: "Low",
          smoothing: "Sharp",
          ignoreBackground: "true",
        },
        "2",
      ),
    );
    assert.equal(res.status, 200);
    assert.equal(validateSvgIsRealVector(await res.text()).ok, true);
    ok("10 whitelisted option combo accepted");
  } catch (err) {
    fail("10 whitelisted option combo accepted", err);
  }

  try {
    const png = await makeArtPng();
    const res = await POST(
      requestWithFields(
        fileFromBuffer(png, "art.png", "image/png"),
        { colorCount: "7" },
        "3",
      ),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, "INVALID_OPTIONS");
    ok("11 invalid colorCount → 400 INVALID_OPTIONS");
  } catch (err) {
    fail("11 invalid colorCount → 400 INVALID_OPTIONS", err);
  }

  try {
    const png = await makeArtPng();
    const res = await POST(
      requestWithFields(
        fileFromBuffer(png, "art.png", "image/png"),
        { pathomit: "2" },
        "4",
      ),
    );
    assert.equal(res.status, 400);
    ok("12 raw pathomit field rejected by API");
  } catch (err) {
    fail("12 raw pathomit field rejected by API", err);
  }

  try {
    const res = await POST(
      requestWithFields(
        fileFromBuffer(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
          "x.svg",
          "image/svg+xml",
        ),
        {},
        "5",
      ),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, "UNSUPPORTED_TYPE");
    ok("13 SVG input rejected");
  } catch (err) {
    fail("13 SVG input rejected", err);
  }

  try {
    const res = await POST(
      requestWithFields(
        fileFromBuffer(Buffer.from("ftypheic"), "x.heic", "image/heic"),
        {},
        "6",
      ),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.ok(
      body.code === "UNSUPPORTED_TYPE" || body.code === "INVALID_IMAGE",
      `unexpected code ${body.code}`,
    );
    ok("14 HEIC rejected");
  } catch (err) {
    fail("14 HEIC rejected", err);
  }

  try {
    const oversized = await sharp({
      create: {
        width: 3000,
        height: 3000,
        channels: 3,
        background: { r: 10, g: 10, b: 10 },
      },
    })
      .png()
      .toBuffer();
    const res = await POST(
      requestWithFields(fileFromBuffer(oversized, "big.png", "image/png"), {}, "7"),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.ok(
      body.code === "PIXEL_LIMIT_EXCEEDED" || body.code === "DIMENSIONS_TOO_LARGE",
      `unexpected code ${body.code}`,
    );
    ok("15 oversized / pixel-limit rejected");
  } catch (err) {
    fail("15 oversized / pixel-limit rejected", err);
  }

  try {
    const png = await makeArtPng();
    const low = await POST(
      requestWithFields(
        fileFromBuffer(png, "art.png", "image/png"),
        { detail: "Low", colorCount: "8" },
        "8",
      ),
    );
    const max = await POST(
      requestWithFields(
        fileFromBuffer(png, "art.png", "image/png"),
        { detail: "Max", colorCount: "8" },
        "9",
      ),
    );
    assert.equal(low.status, 200);
    assert.equal(max.status, 200);
    const lowSvg = await low.text();
    const maxSvg = await max.text();
    assert.equal(validateSvgIsRealVector(lowSvg).ok, true);
    assert.equal(validateSvgIsRealVector(maxSvg).ok, true);
    // Smoke: both succeed; Max should not be smaller path budget than Low in trivial cases.
    // Avoid brittle equality — only assert both produce path geometry.
    assert.equal(/<path\b/i.test(lowSvg), true);
    assert.equal(/<path\b/i.test(maxSvg), true);
    ok("16 detail Low vs Max both produce SVG (option-effect smoke)");
  } catch (err) {
    fail("16 detail Low vs Max both produce SVG (option-effect smoke)", err);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
