/**
 * Sharp production readiness — import, decode, encode, lockfile + config checks.
 * Run: npm run verify:sharp-production
 */

import assert from "node:assert/strict";
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";

const root = process.cwd();

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

function testNextConfigDoesNotExternalizeSharp() {
  const configSource = readFileSync(join(root, "next.config.ts"), "utf8");
  assert.doesNotMatch(
    configSource,
    /serverExternalPackages:\s*\[[^\]]*"sharp"/,
    "sharp must not be listed in serverExternalPackages",
  );
  assert.match(configSource, /serverExternalPackages:\s*\["@react-pdf\/renderer"\]/);

  ok("next.config.ts keeps sharp bundled (not in serverExternalPackages)");
}

function testPackageJsonPin() {
  const pkg = readJson("package.json");
  assert.equal(pkg.dependencies.sharp, "0.35.3", "package.json must pin sharp to 0.35.3");

  ok("package.json pins sharp@0.35.3 exactly");
}

async function main() {
  try {
    testPackageJsonPin();
    testNextConfigDoesNotExternalizeSharp();
    testLockfileLinuxPackages();
    await testSharpRuntime();

    const linuxLibvipsPath = join(root, "node_modules", "@img", "sharp-libvips-linux-x64");
    if (process.platform === "linux") {
      assert.ok(existsSync(linuxLibvipsPath), "linux libvips package must be installed on Linux hosts");
      ok("Linux host has @img/sharp-libvips-linux-x64 installed locally");
    } else {
      console.log(
        `  (skipped local linux libvips directory check on ${process.platform}; lockfile entries verified)`,
      );
    }

    console.log("\nSharp production verification passed.\n");
  } catch (error) {
    fail(error instanceof Error ? error.message : String(error));
  }
}

main();
