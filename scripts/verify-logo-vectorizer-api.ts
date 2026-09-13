/**
 * Logo Vectorizer API foundation verifier.
 * Run: npm run verify:logo-vectorizer-api
 *
 * Calls the route handler directly — no network, no production.
 */

import assert from "node:assert/strict";
import sharp from "sharp";
import { POST } from "@/app/api/tools/logo-vectorizer/route";
import { validateSvgIsRealVector } from "@/lib/design/vectorize";

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

async function makeLogoPng(): Promise<Buffer> {
  const mark = await sharp({
    create: {
      width: 36,
      height: 36,
      channels: 3,
      background: { r: 255, g: 106, b: 0 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 64,
      height: 64,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: mark, left: 14, top: 14 }])
    .png()
    .toBuffer();
}

async function makeJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 48,
      height: 48,
      channels: 3,
      background: { r: 40, g: 120, b: 220 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

function fileFromBuffer(
  buffer: Buffer,
  name: string,
  type: string,
): File {
  return new File([Uint8Array.from(buffer)], name, { type });
}

function requestWithFile(
  file: File | null,
  ipSuffix: string,
): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://localhost/api/tools/logo-vectorizer", {
    method: "POST",
    body: form,
    headers: {
      // Isolate rate-limit buckets across assertions.
      "x-forwarded-for": `127.0.0.${ipSuffix}`,
    },
  });
}

async function run() {
  console.log("\nLogo Vectorizer API verifier\n");

  try {
    const png = await makeLogoPng();
    const file = fileFromBuffer(png, "mark.png", "image/png");
    const res = await POST(requestWithFile(file, "1"));
    assert.equal(res.status, 200);
    const svg = await res.text();
    const v = validateSvgIsRealVector(svg);
    assert.equal(v.ok, true, v.reasons.join("; "));
    assert.match(res.headers.get("content-type") ?? "", /image\/svg\+xml/i);
    ok("1 valid PNG → 200 SVG");
  } catch (err) {
    fail("1 valid PNG → 200 SVG", err);
  }

  try {
    const jpeg = await makeJpeg();
    const file = fileFromBuffer(jpeg, "shape.jpg", "image/jpeg");
    const res = await POST(requestWithFile(file, "2"));
    assert.equal(res.status, 200);
    const svg = await res.text();
    assert.equal(validateSvgIsRealVector(svg).ok, true);
    ok("2 valid JPEG → 200 SVG");
  } catch (err) {
    fail("2 valid JPEG → 200 SVG", err);
  }

  try {
    const png = await makeLogoPng();
    const file = fileFromBuffer(png, "transparent-logo.png", "image/png");
    const res = await POST(requestWithFile(file, "3"));
    assert.equal(res.status, 200);
    const svg = await res.text();
    assert.equal(validateSvgIsRealVector(svg).ok, true);
    assert.equal(/<path\b/i.test(svg), true);
    ok("3 transparent logo PNG → valid vector");
  } catch (err) {
    fail("3 transparent logo PNG → valid vector", err);
  }

  try {
    const res = await POST(requestWithFile(null, "4"));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { error?: string; code?: string };
    assert.ok(
      body.code === "MISSING_FILE" ||
        (body.error ?? "").toLowerCase().includes("image file is required"),
      `unexpected missing-file body ${JSON.stringify(body)}`,
    );
    ok("4 missing file → expected error");
  } catch (err) {
    fail("4 missing file → expected error", err);
  }

  try {
    const file = fileFromBuffer(
      Buffer.from("not-an-image-at-all"),
      "x.bin",
      "application/octet-stream",
    );
    const res = await POST(requestWithFile(file, "5"));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.ok(
      body.code === "UNSUPPORTED_TYPE" || body.code === "INVALID_IMAGE",
      `unexpected code ${body.code}`,
    );
    ok("5 invalid binary → expected error");
  } catch (err) {
    fail("5 invalid binary → expected error", err);
  }

  try {
    const file = fileFromBuffer(
      Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
      "x.svg",
      "image/svg+xml",
    );
    const res = await POST(requestWithFile(file, "6"));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, "UNSUPPORTED_TYPE");
    ok("6 SVG input rejected");
  } catch (err) {
    fail("6 SVG input rejected", err);
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
    const file = fileFromBuffer(oversized, "big.png", "image/png");
    const res = await POST(requestWithFile(file, "7"));
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.ok(
      body.code === "PIXEL_LIMIT_EXCEEDED" ||
        body.code === "DIMENSIONS_TOO_LARGE",
      `unexpected code ${body.code}`,
    );
    ok("7 oversized image rejected");
  } catch (err) {
    fail("7 oversized image rejected", err);
  }

  try {
    const png = await makeLogoPng();
    const file = fileFromBuffer(png, "mark.png", "image/png");
    const res = await POST(requestWithFile(file, "8"));
    const svg = await res.text();
    assert.equal(/<image\b/i.test(svg), false);
    assert.equal(/data:image\//i.test(svg), false);
    assert.equal(/foreignObject/i.test(svg), false);
    ok("8 response contains no raster embedding");
  } catch (err) {
    fail("8 response contains no raster embedding", err);
  }

  try {
    const png = await makeLogoPng();
    const file = fileFromBuffer(png, "mark.png", "image/png");
    const res = await POST(requestWithFile(file, "9"));
    const ct = res.headers.get("content-type") ?? "";
    assert.match(ct, /image\/svg\+xml/i);
    assert.match(
      res.headers.get("content-disposition") ?? "",
      /attachment; filename=".*\.svg"/i,
    );
    ok("9 content type is correct");
  } catch (err) {
    fail("9 content type is correct", err);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
