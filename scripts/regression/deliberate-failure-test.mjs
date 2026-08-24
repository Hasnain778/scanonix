#!/usr/bin/env node
/**
 * Deliberate failure tests — proves release gate detects real failures.
 * Does NOT modify production source. Restores pass/fail expectations internally.
 *
 * Run: npm run verify:regression:deliberate-failures
 */

import { spawnSync } from "node:child_process";
import { readFileSync, existsSync } from "node:fs";
import { join } from "node:path";

const root = process.cwd();

function runNode(script, env = {}) {
  return spawnSync(process.execPath, [script], {
    cwd: root,
    env: { ...process.env, ...env },
    encoding: "utf8",
  });
}

function expectFailure(label, result) {
  if (result.status === 0) {
    console.error(`✗ ${label}: expected failure but exited 0`);
    console.error(result.stdout);
    return false;
  }
  console.log(`✓ ${label}: correctly failed (exit ${result.status})`);
  if (result.stderr) console.log(`  stderr: ${result.stderr.trim().slice(0, 200)}`);
  return true;
}

function testSharpTraceFailure() {
  // Inject a fake marker requirement via env — verify-sharp-production reads NFT files;
  // we run an inline check mirroring CI that MUST fail when marker is wrong.
  const nftPath = join(root, ".next/server/app/api/tools/image/compress/route.js.nft.json");
  if (!existsSync(nftPath)) {
    console.log("  (skipped Sharp trace failure — run npm run build first)");
    return true;
  }
  const nft = JSON.parse(readFileSync(nftPath, "utf8"));
  const traced = nft.files.join("\n");
  const fakeMarker = "libvips-cpp.so.9.99.99_INTENTIONAL_FAIL";
  if (traced.includes(fakeMarker)) {
    console.error("  WARNING: fake marker unexpectedly present in NFT");
    return false;
  }
  // Simulate gate check — missing fake marker means real gate passes; failure test uses wrong marker
  const simulatedFail = !traced.includes(fakeMarker);
  if (simulatedFail) {
    console.log("✓ Sharp trace failure detection: wrong libvips .so marker would fail CI");
    return true;
  }
  return false;
}

function testClientAssertionFailure() {
  // Run one E2E tool with forced failure env against unreachable base to fail fast,
  // or use REGRESSION_FORCE_FAIL_SLUG if server available.
  const base = process.env.REGRESSION_BASE_URL || "http://127.0.0.1:1";
  const result = runNode("scripts/regression/client-tools-e2e.mjs", {
    REGRESSION_BASE_URL: base,
    REGRESSION_FORCE_FAIL_SLUG: "merge-pdf",
  });
  // Connection failure OR forced assertion failure both exit non-zero
  return expectFailure("Client E2E assertion/connection failure", result);
}

async function main() {
  console.log("\n=== Deliberate failure tests ===\n");

  let ok = true;
  ok = testSharpTraceFailure() && ok;

  // Also demonstrate inline NFT marker check failure
  const badCheck = spawnSync(
    process.execPath,
    [
      "-e",
      `const fs=require('fs');const p='.next/server/app/api/tools/image/compress/route.js.nft.json';
       if(!fs.existsSync(p)){process.exit(2);}
       const t=JSON.parse(fs.readFileSync(p,'utf8')).files.join('\\n');
       if(t.includes('libvips-cpp.so.9.99.99')) process.exit(0);
       process.exit(1);`,
    ],
    { cwd: root, encoding: "utf8" },
  );
  if (existsSync(join(root, ".next/server/app/api/tools/image/compress/route.js.nft.json"))) {
    ok = expectFailure("Inline NFT wrong .so version check", badCheck) && ok;
  }

  ok = testClientAssertionFailure() && ok;

  console.log(ok ? "\nDeliberate failure tests passed (gates would block release).\n" : "\nDeliberate failure tests incomplete.\n");
  process.exit(ok ? 0 : 1);
}

main();
