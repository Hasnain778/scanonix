/**
 * Sharp production readiness — import, decode, encode, lockfile, config + NFT checks.
 * Run: npm run verify:sharp-production
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();

const SHARP_IMAGE_ROUTES = [
  {
    route: "/api/tools/image/compress",
    nftPath: ".next/server/app/api/tools/image/compress/route.js.nft.json",
  },
  {
    route: "/api/tools/image/resize",
    nftPath: ".next/server/app/api/tools/image/resize/route.js.nft.json",
  },
  {
    route: "/api/tools/background-remover/remove",
    nftPath: ".next/server/app/api/tools/background-remover/remove/route.js.nft.json",
  },
];

const REQUIRED_NFT_MARKERS = [
  "@img/sharp-linux-x64",
  "@img/sharp-libvips-linux-x64",
  "libvips-cpp.so.8.18.3",
];

function ok(message) {
  console.log(`✓ ${message}`);
}

function fail(message) {
  console.error(`\n✗ Sharp production verification failed: ${message}\n`);
  process.exit(1);
}

function readJson(relativePath) {
  return JSON.parse(readFileSync(join(root, relativePath), "utf8"));
}

function assertJpegHeader(bytes) {
  assert.equal(bytes[0], 0xff);
  assert.equal(bytes[1], 0xd8);
  assert.equal(bytes[2], 0xff);
}

function assertPngHeader(bytes) {
  assert.equal(bytes.readUInt32BE(0), 0x89504e47);
}

async function testSharpRuntime() {
  const input = await sharp({
    create: {
      width: 32,
      height: 24,
      channels: 3,
      background: { r: 220, g: 110, b: 40 },
    },
  })
    .jpeg({ quality: 85 })
    .toBuffer();

  assertJpegHeader(input);

  const meta = await sharp(input).metadata();
  assert.equal(meta.width, 32);
  assert.equal(meta.height, 24);
  assert.equal(meta.format, "jpeg");

  const png = await sharp(input).png().toBuffer();
  assertPngHeader(png);

  const jpeg = await sharp(png).jpeg({ quality: 80 }).toBuffer();
  assertJpegHeader(jpeg);

  ok("Sharp imports and can decode JPEG, output PNG, and re-encode JPEG");
}

function testLockfileLinuxPackages() {
  const lock = readJson("package-lock.json");
  const sharpPkg = lock.packages?.["node_modules/sharp"];
  assert.ok(sharpPkg, "lockfile must contain node_modules/sharp");
  assert.equal(sharpPkg.version, "0.35.3", "top-level sharp must be pinned to 0.35.3");

  const linuxSharp = lock.packages?.["node_modules/@img/sharp-linux-x64"];
  const linuxLibvips = lock.packages?.["node_modules/@img/sharp-libvips-linux-x64"];
  assert.ok(linuxSharp, "lockfile must declare @img/sharp-linux-x64 for Vercel linux-x64");
  assert.ok(linuxLibvips, "lockfile must declare @img/sharp-libvips-linux-x64 for Vercel linux-x64");
  assert.equal(linuxSharp.version, "0.35.3", "@img/sharp-linux-x64 version must match sharp");
  assert.equal(linuxLibvips.version, "1.3.2", "@img/sharp-libvips-linux-x64 must match sharp 0.35.3");

  ok("Lockfile contains matching linux-x64 sharp + libvips optional packages (0.35.3 / 1.3.2)");
}

function testNextConfigTracingIncludes() {
  const configSource = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.doesNotMatch(
    configSource,
    /serverExternalPackages:\s*\[[^\]]*"sharp"/,
    "sharp must not be listed in serverExternalPackages",
  );
  assert.match(configSource, /serverExternalPackages:\s*\["@react-pdf\/renderer"\]/);
  assert.match(configSource, /outputFileTracingIncludes:/);
  assert.match(configSource, /\/api\/tools\/image\/compress/);
  assert.match(configSource, /\/api\/tools\/image\/resize/);
  assert.match(configSource, /\/api\/tools\/background-remover\/remove/);
  assert.match(configSource, /node_modules\/@img\/sharp-linux-x64\/\*\*\/\*/);
  assert.match(configSource, /node_modules\/@img\/sharp-libvips-linux-x64\/\*\*\/\*/);

  ok("next.config.ts defines targeted outputFileTracingIncludes for all three image routes");
}

function testPackageJsonPin() {
  const pkg = readJson("package.json");
  assert.equal(pkg.dependencies.sharp, "0.35.3", "package.json must pin sharp to 0.35.3");

  ok("package.json pins sharp@0.35.3 exactly");
}

function testLinuxNativeNftTraces() {
  if (process.platform !== "linux") {
    console.log(
      `  (skipped Linux NFT trace checks on ${process.platform}; run on Linux after production build)`,
    );
    return;
  }

  for (const { route, nftPath } of SHARP_IMAGE_ROUTES) {
    const absoluteNftPath = join(root, nftPath);
    assert.ok(existsSync(absoluteNftPath), `missing NFT trace for ${route}: ${nftPath}`);

    const nft = readJson(nftPath);
    assert.ok(Array.isArray(nft.files), `NFT for ${route} must contain a files array`);

    const tracedFiles = nft.files.join("\n");
    for (const marker of REQUIRED_NFT_MARKERS) {
      assert.match(
        tracedFiles,
        new RegExp(marker.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")),
        `NFT for ${route} must trace ${marker}`,
      );
    }

    ok(`${route} NFT traces @img/sharp-linux-x64, @img/sharp-libvips-linux-x64, and libvips-cpp.so.8.18.3`);
  }

  const libvipsSoPath = join(
    root,
    "node_modules",
    "@img",
    "sharp-libvips-linux-x64",
    "lib",
    "libvips-cpp.so.8.18.3",
  );
  assert.ok(existsSync(libvipsSoPath), `libvips shared object must exist at ${libvipsSoPath}`);
  ok(`libvips-cpp.so.8.18.3 exists on disk at node_modules/@img/sharp-libvips-linux-x64/lib/libvips-cpp.so.8.18.3`);
}

async function main() {
  try {
    testPackageJsonPin();
    testNextConfigTracingIncludes();
    testLockfileLinuxPackages();
    await testSharpRuntime();
    testLinuxNativeNftTraces();

    console.log("\nSharp production verification passed.\n");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
