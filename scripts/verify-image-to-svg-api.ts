/**
 * Image to SVG API verifier.
 * Run: npm run verify:image-to-svg-api
 *
 * Calls the route handler directly — no network, no production.
 */

import assert from "node:assert/strict";
import sharp from "sharp";
import { POST } from "@/app/api/tools/image-to-svg/route";
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

async function makeJpeg(): Promise<Buffer> {
  return sharp({
    create: {
      width: 48,
      height: 48,
      channels: 3,
      background: { r: 80, g: 40, b: 160 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function makeWebp(): Promise<Buffer> {
  return sharp({
    create: {
      width: 40,
      height: 40,
      channels: 3,
      background: { r: 20, g: 180, b: 90 },
    },
  })
    .webp({ quality: 90 })
    .toBuffer();
}

function fileFromBuffer(buffer: Buffer, name: string, type: string): File {
  return new File([Uint8Array.from(buffer)], name, { type });
}

function requestWithFile(file: File | null, ipSuffix: string): Request {
  const form = new FormData();
  if (file) form.append("file", file);
  return new Request("http://localhost/api/tools/image-to-svg", {
    method: "POST",
    body: form,
    headers: {
      "x-forwarded-for": `127.0.1.${ipSuffix}`,
    },
  });
}

async function run() {
  console.log("\nImage to SVG API verifier\n");

  try {
    const png = await makeArtPng();
    const res = await POST(requestWithFile(fileFromBuffer(png, "art.png", "image/png"), "1"));
    assert.equal(res.status, 200);
    const svg = await res.text();
    assert.equal(validateSvgIsRealVector(svg).ok, true);
    assert.match(res.headers.get("content-type") ?? "", /image\/svg\+xml/i);
    ok("1 PNG → 200 SVG");
  } catch (err) {
    fail("1 PNG → 200 SVG", err);
  }

  try {
    const jpeg = await makeJpeg();
    const res = await POST(requestWithFile(fileFromBuffer(jpeg, "shape.jpg", "image/jpeg"), "2"));
    assert.equal(res.status, 200);
    assert.equal(validateSvgIsRealVector(await res.text()).ok, true);
    ok("2 JPEG → 200 SVG");
  } catch (err) {
    fail("2 JPEG → 200 SVG", err);
  }

  try {
    const webp = await makeWebp();
    const res = await POST(requestWithFile(fileFromBuffer(webp, "shape.webp", "image/webp"), "3"));
    assert.equal(res.status, 200);
    const svg = await res.text();
    assert.equal(validateSvgIsRealVector(svg).ok, true);
    assert.equal(/<path\b/i.test(svg), true);
    ok("3 WebP → 200 SVG");
  } catch (err) {
    fail("3 WebP → 200 SVG", err);
  }

  try {
    const res = await POST(
      requestWithFile(
        fileFromBuffer(
          Buffer.from('<svg xmlns="http://www.w3.org/2000/svg"></svg>'),
          "x.svg",
          "image/svg+xml",
        ),
        "4",
      ),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.equal(body.code, "UNSUPPORTED_TYPE");
    ok("4 SVG input rejected");
  } catch (err) {
    fail("4 SVG input rejected", err);
  }

  try {
    const res = await POST(
      requestWithFile(
        fileFromBuffer(Buffer.from("not-an-image-at-all"), "x.bin", "application/octet-stream"),
        "5",
      ),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.ok(
      body.code === "UNSUPPORTED_TYPE" || body.code === "INVALID_IMAGE",
      `unexpected code ${body.code}`,
    );
    ok("5 invalid binary rejected");
  } catch (err) {
    fail("5 invalid binary rejected", err);
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
      requestWithFile(fileFromBuffer(oversized, "big.png", "image/png"), "6"),
    );
    assert.equal(res.status, 400);
    const body = (await res.json()) as { code?: string };
    assert.ok(
      body.code === "PIXEL_LIMIT_EXCEEDED" || body.code === "DIMENSIONS_TOO_LARGE",
      `unexpected code ${body.code}`,
    );
    ok("6 oversized / pixel-limit rejected");
  } catch (err) {
    fail("6 oversized / pixel-limit rejected", err);
  }

  try {
    const png = await makeArtPng();
    const res = await POST(requestWithFile(fileFromBuffer(png, "art.png", "image/png"), "7"));
    const svg = await res.text();
    assert.equal(/<path\b/i.test(svg), true);
    assert.equal(validateSvgIsRealVector(svg).ok, true);
    ok("7 SVG contains real path geometry");
  } catch (err) {
    fail("7 SVG contains real path geometry", err);
  }

  try {
    const png = await makeArtPng();
    const res = await POST(requestWithFile(fileFromBuffer(png, "art.png", "image/png"), "8"));
    const svg = await res.text();
    assert.equal(/<image\b/i.test(svg), false);
    ok("8 response contains no <image>");
  } catch (err) {
    fail("8 response contains no <image>", err);
  }

  try {
    const png = await makeArtPng();
    const res = await POST(requestWithFile(fileFromBuffer(png, "art.png", "image/png"), "9"));
    const svg = await res.text();
    assert.equal(/data:image\//i.test(svg), false);
    assert.equal(/foreignObject/i.test(svg), false);
    ok("9 response contains no data:image / foreignObject");
  } catch (err) {
    fail("9 response contains no data:image / foreignObject", err);
  }

  try {
    const png = await makeArtPng();
    const res = await POST(requestWithFile(fileFromBuffer(png, "art.png", "image/png"), "10"));
    assert.match(res.headers.get("content-type") ?? "", /image\/svg\+xml/i);
    assert.match(
      res.headers.get("content-disposition") ?? "",
      /attachment; filename=".*\.svg"/i,
    );
    ok("10 content type is correct");
  } catch (err) {
    fail("10 content type is correct", err);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
