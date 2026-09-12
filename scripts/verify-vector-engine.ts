/**
 * Internal shared vector engine verifier (Design & Vector prototype).
 * Run: npm run verify:vector-engine
 *
 * No public routes. No external APIs.
 */

import assert from "node:assert/strict";
import sharp from "sharp";
import {
  VECTORIZE_MAX_BYTES,
  VectorizeError,
  validateSvgIsRealVector,
  vectorizeImage,
} from "@/lib/design/vectorize";

let passed = 0;
let failed = 0;

function ok(name: string) {
  passed += 1;
  console.log(`✓ ${name}`);
}

function fail(name: string, detail: unknown) {
  failed += 1;
  console.error(`✗ ${name} — ${detail instanceof Error ? detail.message : String(detail)}`);
}

function assertRealVector(svg: string, label: string) {
  const v = validateSvgIsRealVector(svg);
  assert.equal(v.ok, true, `${label}: ${v.reasons.join("; ")}`);
  assert.ok(v.pathCount >= 1, `${label}: expected path geometry`);
  assert.equal(/<image\b/i.test(svg), false, `${label}: must not embed <image>`);
  assert.equal(/data:image\//i.test(svg), false, `${label}: must not embed data:image`);
}

async function makeTwoColorLogoPng(): Promise<Buffer> {
  // Orange square on transparent canvas — logo-style.
  const mark = await sharp({
    create: {
      width: 40,
      height: 40,
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
    .composite([{ input: mark, left: 12, top: 12 }])
    .png()
    .toBuffer();
}

async function makeTransparentRingPng(): Promise<Buffer> {
  // Opaque blue circle-ish block with transparent surround.
  const core = await sharp({
    create: {
      width: 28,
      height: 28,
      channels: 4,
      background: { r: 30, g: 90, b: 220, alpha: 1 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 48,
      height: 48,
      channels: 4,
      background: { r: 0, g: 0, b: 0, alpha: 0 },
    },
  })
    .composite([{ input: core, left: 10, top: 10 }])
    .png()
    .toBuffer();
}

async function makeGeometryJpeg(): Promise<Buffer> {
  const red = await sharp({
    create: {
      width: 30,
      height: 20,
      channels: 3,
      background: { r: 220, g: 40, b: 40 },
    },
  })
    .png()
    .toBuffer();
  const blue = await sharp({
    create: {
      width: 20,
      height: 30,
      channels: 3,
      background: { r: 40, g: 80, b: 220 },
    },
  })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: 80,
      height: 60,
      channels: 3,
      background: { r: 255, g: 255, b: 255 },
    },
  })
    .composite([
      { input: red, left: 8, top: 8 },
      { input: blue, left: 45, top: 20 },
    ])
    .jpeg({ quality: 90 })
    .toBuffer();
}

async function run() {
  console.log("\nVector engine verifier\n");

  try {
    const logoPng = await makeTwoColorLogoPng();
    const logo = await vectorizeImage(
      { buffer: logoPng, fileName: "logo.png", mimeType: "image/png" },
      { preset: "logo" },
    );
    assertRealVector(logo.svg, "logo preset");
    assert.equal(logo.width, 64);
    assert.equal(logo.height, 64);
    assert.ok(logo.byteSize > 40, "logo SVG should be non-trivial");
    assert.equal(logo.meta.preset, "logo");
    assert.equal(logo.meta.tracer, "imagetracerjs");
    assert.ok(logo.meta.pathCount >= 1);
    ok("1 simple two-color logo-style PNG (logo preset)");
  } catch (err) {
    fail("1 simple two-color logo-style PNG (logo preset)", err);
  }

  try {
    const ring = await makeTransparentRingPng();
    const result = await vectorizeImage(
      { buffer: ring, fileName: "transparent.png" },
      { preset: "logo", ignoreBackground: true },
    );
    assertRealVector(result.svg, "transparent PNG");
    assert.equal(result.width, 48);
    assert.equal(result.height, 48);
    ok("2 transparent PNG");
  } catch (err) {
    fail("2 transparent PNG", err);
  }

  try {
    const jpeg = await makeGeometryJpeg();
    const result = await vectorizeImage(
      { buffer: jpeg, fileName: "shapes.jpg", mimeType: "image/jpeg" },
      { preset: "general" },
    );
    assertRealVector(result.svg, "JPEG geometry");
    assert.equal(result.width, 80);
    assert.equal(result.height, 60);
    assert.equal(result.mimeType, "image/jpeg");
    ok("3 JPEG with simple geometric shapes");
  } catch (err) {
    fail("3 JPEG with simple geometric shapes", err);
  }

  try {
    let rejected = false;
    try {
      await vectorizeImage({
        buffer: Buffer.from("<svg xmlns='http://www.w3.org/2000/svg'></svg>"),
        fileName: "x.svg",
        mimeType: "image/svg+xml",
      });
    } catch (err) {
      rejected = err instanceof VectorizeError && err.code === "UNSUPPORTED_TYPE";
    }
    assert.equal(rejected, true, "SVG input must be rejected");

    rejected = false;
    try {
      await vectorizeImage({
        buffer: Buffer.from("%PDF-1.4 fake"),
        fileName: "x.pdf",
      });
    } catch (err) {
      rejected = err instanceof VectorizeError && err.code === "UNSUPPORTED_TYPE";
    }
    assert.equal(rejected, true, "PDF input must be rejected");

    rejected = false;
    try {
      await vectorizeImage({ buffer: Buffer.alloc(0), fileName: "empty.png" });
    } catch (err) {
      rejected =
        err instanceof VectorizeError &&
        (err.code === "EMPTY_INPUT" || err.code === "UNSUPPORTED_TYPE");
    }
    assert.equal(rejected, true, "empty input must be rejected");

    rejected = false;
    try {
      await vectorizeImage({
        buffer: Buffer.alloc(VECTORIZE_MAX_BYTES + 1, 1),
        fileName: "huge.bin",
      });
    } catch (err) {
      rejected = err instanceof VectorizeError && err.code === "TOO_LARGE";
    }
    assert.equal(rejected, true, "oversize buffer must be rejected");

    ok("4 rejection of invalid input");
  } catch (err) {
    fail("4 rejection of invalid input", err);
  }

  try {
    const logoPng = await makeTwoColorLogoPng();
    const result = await vectorizeImage(
      { buffer: logoPng, fileName: "logo.png" },
      { preset: "logo" },
    );
    assert.equal(/<svg\b/i.test(result.svg), true);
    assert.equal(/<path\b/i.test(result.svg), true);
    ok("5 SVG contains vector path(s)");
  } catch (err) {
    fail("5 SVG contains vector path(s)", err);
  }

  try {
    const logoPng = await makeTwoColorLogoPng();
    const result = await vectorizeImage(
      { buffer: logoPng, fileName: "logo.png" },
      { preset: "general" },
    );
    assert.equal(/<image\b/i.test(result.svg), false);
    assert.equal(/data:image\//i.test(result.svg), false);
    ok("6 SVG contains NO embedded raster image");
  } catch (err) {
    fail("6 SVG contains NO embedded raster image", err);
  }

  try {
    const jpeg = await makeGeometryJpeg();
    const result = await vectorizeImage({ buffer: jpeg, fileName: "shapes.jpg" });
    assert.equal(result.width, 80);
    assert.equal(result.height, 60);
    assert.match(result.svg, /viewBox="0 0 80 60"|width="80"[^>]*height="60"/i);
    ok("7 dimensions preserved logically");
  } catch (err) {
    fail("7 dimensions preserved logically", err);
  }

  try {
    const logoPng = await makeTwoColorLogoPng();
    const a = await vectorizeImage({ buffer: logoPng }, { preset: "logo" });
    const b = await vectorizeImage({ buffer: logoPng }, { preset: "logo" });
    assert.equal(a.svg, b.svg, "logo preset should be deterministic");
    assert.ok(a.byteSize > 0 && a.meta.pathCount > 0);
    ok("8 logo preset produces non-empty usable deterministic output");
  } catch (err) {
    fail("8 logo preset produces non-empty usable deterministic output", err);
  }

  console.log(`\n${passed} passed, ${failed} failed\n`);
  process.exit(failed > 0 ? 1 : 0);
}

run().catch((err) => {
  console.error(err);
  process.exit(1);
});
