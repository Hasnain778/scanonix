#!/usr/bin/env node
/**
 * Server tool integration tests against a running Next.js instance.
 * Safe local checks for Image Compressor + Image Resizer always.
 * Background Remover runs only when RUN_EXTERNAL_SMOKE=1 (avoids hammering production worker).
 *
 * Run: npm run verify:regression:server-local
 * Env: REGRESSION_BASE_URL (default http://localhost:3000)
 *      RUN_EXTERNAL_SMOKE=1 — include background remover POST
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { hasAlphaChannel, isJpeg, isPng, magicHex, safeBodySnippet } from "./lib/binary.mjs";
import { exitWithSummary, fail, pass, printHeader, summarizeResults } from "./lib/report.mjs";

const BASE = process.env.REGRESSION_BASE_URL || "http://localhost:3000";
const FIX = join(process.cwd(), "tests", "fixtures", "regression");
const EXTERNAL = process.env.RUN_EXTERNAL_SMOKE === "1";

function fixture(name) {
  return readFileSync(join(FIX, name));
}

async function postMultipart(route, fields, fileField, fileName, buffer, mime) {
  const form = new FormData();
  for (const [key, value] of Object.entries(fields)) {
    form.append(key, String(value));
  }
  form.append(fileField, new Blob([buffer], { type: mime }), fileName);

  const res = await fetch(`${BASE}${route}`, { method: "POST", body: form });
  const contentType = res.headers.get("content-type") || "";
  let body = "";
  if (contentType.includes("application/json")) {
    body = JSON.stringify(await res.json());
  } else {
    body = `[binary ${contentType} ${res.headers.get("content-length") || "?"} bytes]`;
  }
  return { res, contentType, body };
}

async function readBinaryResponse(res) {
  const buf = Buffer.from(await res.arrayBuffer());
  return buf;
}

async function testCompress(results) {
  const slug = "image-compressor";
  const input = fixture("sample.jpg");
  const meta = await sharp(input).metadata();
  const { res, contentType, body } = await postMultipart(
    "/api/tools/image/compress",
    { quality: "80" },
    "file",
    "sample.jpg",
    input,
    "image/jpeg",
  );

  if (!res.ok) {
    recordFail(results, slug, `HTTP ${res.status}`, { route: "/api/tools/image/compress", body });
    return;
  }

  const out = await readBinaryResponse(res);
  const outMeta = await sharp(out).metadata().catch(() => null);
  const ok =
    res.status === 200 &&
    contentType.includes("image/") &&
    isJpeg(out) &&
    outMeta &&
    outMeta.width === meta.width &&
    outMeta.height === meta.height;

  record(results, slug, ok, ok ? `JPEG ${outMeta.width}x${outMeta.height}` : "compress validation failed", {
    route: "/api/tools/image/compress",
    status: res.status,
    magic: magicHex(out),
  });
}

async function testResize(results) {
  const slug = "image-resizer";
  const input = fixture("sample.jpg");
  const targetW = 160;
  const targetH = 100;
  const { res, contentType, body } = await postMultipart(
    "/api/tools/image/resize",
    { width: String(targetW), height: String(targetH), fit: "fill", format: "jpeg" },
    "file",
    "sample.jpg",
    input,
    "image/jpeg",
  );

  if (!res.ok) {
    recordFail(results, slug, `HTTP ${res.status}`, { route: "/api/tools/image/resize", body });
    return;
  }

  const out = await readBinaryResponse(res);
  const outMeta = await sharp(out).metadata().catch(() => null);
  const ok =
    res.status === 200 &&
    contentType.includes("image/") &&
    isJpeg(out) &&
    outMeta &&
    outMeta.width === targetW &&
    outMeta.height === targetH;

  record(results, slug, ok, ok ? `JPEG ${targetW}x${targetH}` : "resize validation failed", {
    route: "/api/tools/image/resize",
    status: res.status,
    actual: outMeta ? `${outMeta.width}x${outMeta.height}` : "unknown",
  });
}

async function testBackgroundRemover(results) {
  const slug = "background-remover";
  if (!EXTERNAL) {
    results[slug] = { ok: true, detail: "skipped (set RUN_EXTERNAL_SMOKE=1 to run)", skipped: true };
    pass(slug, "skipped — external worker not invoked in default CI");
    return;
  }

  const input = fixture("bg-remover-subject.jpg");
  const { res, body } = await postMultipart(
    "/api/tools/background-remover/remove",
    {},
    "file",
    "bg-remover-subject.jpg",
    input,
    "image/jpeg",
  );

  if (res.status === 422) {
    const json = JSON.parse(body.replace(/^\[binary.*\]$/, "{}")).code || body;
    record(
      results,
      slug,
      false,
      `422 user/fixture rejection (not infra): ${safeBodySnippet(body)}`,
      { route: "/api/tools/background-remover/remove", status: 422 },
    );
    return;
  }

  if (!res.ok) {
    recordFail(results, slug, `HTTP ${res.status}`, {
      route: "/api/tools/background-remover/remove",
      body: safeBodySnippet(body),
    });
    return;
  }

  const out = await readBinaryResponse(res);
  const ok = isPng(out) && out.length > 500;
  record(results, slug, ok, ok ? `PNG ${out.length} bytes` : "invalid PNG output", {
    route: "/api/tools/background-remover/remove",
    magic: magicHex(out),
    hasAlpha: hasAlphaChannel(out),
  });
}

function record(results, slug, ok, detail, meta = {}) {
  results[slug] = { ok, detail, ...meta };
  if (ok) pass(slug, detail);
  else fail(slug, detail, meta);
}

function recordFail(results, slug, detail, meta) {
  record(results, slug, false, detail, meta);
}

async function main() {
  printHeader(`Server tool integration (${BASE})`);

  try {
    const health = await fetch(BASE);
    if (!health.ok && health.status !== 404) {
      console.error(`Base URL not reachable: ${BASE} (${health.status})`);
      process.exit(1);
    }
  } catch (err) {
    console.error(`Base URL not reachable: ${BASE} — ${err instanceof Error ? err.message : err}`);
    process.exit(1);
  }

  const results = {};
  await testCompress(results);
  await testResize(results);
  await testBackgroundRemover(results);

  const active = Object.entries(results).filter(([, r]) => !r.skipped);
  const summary = summarizeResults(Object.fromEntries(active));
  exitWithSummary(summary, "Server integration");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
