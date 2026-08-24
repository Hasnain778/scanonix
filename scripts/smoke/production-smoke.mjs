#!/usr/bin/env node
/**
 * Safe production post-deploy smoke — read-only HTTP + compress/resize processing.
 * Background Remover optional via RUN_EXTERNAL_SMOKE=1 (single tiny fixture, no hammering).
 *
 * Run: npm run smoke:production
 * Env: PRODUCTION_BASE_URL (default https://www.scanonix.com)
 *      RUN_EXTERNAL_SMOKE=1 — include one background remover call
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import sharp from "sharp";
import { isJpeg, isPng, magicHex, safeBodySnippet } from "../regression/lib/binary.mjs";
import { exitWithSummary, fail, pass, printHeader, summarizeResults } from "../regression/lib/report.mjs";

const BASE = process.env.PRODUCTION_BASE_URL || "https://www.scanonix.com";
const FIX = join(process.cwd(), "tests", "fixtures", "regression");
const EXTERNAL = process.env.RUN_EXTERNAL_SMOKE === "1";

const HTTP_ROUTES = [
  { slug: "home", path: "/", expectStatus: 200 },
  { slug: "tools", path: "/tools", expectStatus: 200 },
  { slug: "pricing", path: "/pricing", expectStatus: 200 },
  { slug: "account", path: "/account", expectStatus: [200, 307, 308] },
  { slug: "robots", path: "/robots.txt", expectStatus: 200 },
  { slug: "sitemap", path: "/sitemap.xml", expectStatus: 200 },
  { slug: "favicon", path: "/favicon.ico", expectStatus: 200 },
];

async function checkHttp(results) {
  for (const { slug, path, expectStatus } of HTTP_ROUTES) {
    const url = `${BASE}${path}`;
    try {
      const res = await fetch(url, { redirect: "manual" });
      const allowed = Array.isArray(expectStatus) ? expectStatus : [expectStatus];
      const ok = allowed.includes(res.status);
      results[`http:${slug}`] = { ok, detail: `${res.status}`, path, status: res.status };
      if (ok) pass(`http:${slug}`, `${path} → ${res.status}`);
      else fail(`http:${slug}`, `${path} → ${res.status} (expected ${allowed.join("|")})`, { path, status: res.status });
    } catch (err) {
      results[`http:${slug}`] = { ok: false, detail: String(err) };
      fail(`http:${slug}`, err instanceof Error ? err.message : String(err));
    }
  }
}

async function postImage(route, fileName, buffer, fields = {}) {
  const form = new FormData();
  for (const [k, v] of Object.entries(fields)) form.append(k, String(v));
  form.append("file", new Blob([buffer], { type: "image/jpeg" }), fileName);
  const res = await fetch(`${BASE}${route}`, { method: "POST", body: form });
  const ct = res.headers.get("content-type") || "";
  let bodySnippet = "";
  if (ct.includes("json")) {
    bodySnippet = safeBodySnippet(JSON.stringify(await res.json()));
  }
  const binary = ct.includes("image/") ? Buffer.from(await res.arrayBuffer()) : null;
  return { res, ct, bodySnippet, binary };
}

async function checkProcessing(results) {
  const jpg = readFileSync(join(FIX, "sample.jpg"));

  const compress = await postImage("/api/tools/image/compress", "sample.jpg", jpg, { quality: "85" });
  const compressOk = compress.res.status === 200 && compress.binary && isJpeg(compress.binary);
  results["proc:compress"] = {
    ok: compressOk,
    detail: compressOk ? "200 JPEG" : `HTTP ${compress.res.status}`,
    status: compress.res.status,
    magic: compress.binary ? magicHex(compress.binary) : null,
  };
  compressOk
    ? pass("proc:compress", "200 JPEG")
    : fail("proc:compress", compress.bodySnippet || `HTTP ${compress.res.status}`, {
        route: "/api/tools/image/compress",
        status: compress.res.status,
      });

  const resize = await postImage("/api/tools/image/resize", "sample.jpg", jpg, {
    width: "120",
    height: "80",
    fit: "fill",
    format: "jpeg",
  });
  const resizeMeta = resize.binary ? await sharp(resize.binary).metadata().catch(() => null) : null;
  const resizeOk =
    resize.res.status === 200 &&
    resize.binary &&
    isJpeg(resize.binary) &&
    resizeMeta?.width === 120 &&
    resizeMeta?.height === 80;
  results["proc:resize"] = {
    ok: resizeOk,
    detail: resizeOk ? "120x80 JPEG" : `HTTP ${resize.res.status}`,
    status: resize.res.status,
  };
  resizeOk
    ? pass("proc:resize", "120x80 JPEG")
    : fail("proc:resize", resize.bodySnippet || `HTTP ${resize.res.status}`, {
        route: "/api/tools/image/resize",
        status: resize.res.status,
      });
}

async function checkBackgroundRemover(results) {
  const slug = "proc:bg-remover";
  if (!EXTERNAL) {
    results[slug] = { ok: true, detail: "skipped (RUN_EXTERNAL_SMOKE not set)", skipped: true };
    pass(slug, "skipped — optional external smoke");
    return;
  }

  const subject = readFileSync(join(FIX, "bg-remover-subject.jpg"));
  const { res, bodySnippet, binary } = await postImage(
    "/api/tools/background-remover/remove",
    "bg-remover-subject.jpg",
    subject,
  );

  if (res.status === 422) {
    // User-input / fixture rejection — not infrastructure failure
    results[slug] = {
      ok: false,
      detail: `422 no_subject or fixture rejection — ${bodySnippet}`,
      status: 422,
      infraFailure: false,
    };
    fail(slug, "422 — distinguish from infra; check fixture/subject", { status: 422, body: bodySnippet });
    return;
  }

  const ok = res.status === 200 && binary && isPng(binary);
  results[slug] = { ok, detail: ok ? "200 PNG" : `HTTP ${res.status}`, status: res.status };
  ok ? pass(slug, "200 PNG") : fail(slug, bodySnippet || `HTTP ${res.status}`, { status: res.status });
}

async function main() {
  printHeader(`Production smoke (${BASE})`);

  const results = {};
  await checkHttp(results);
  await checkProcessing(results);
  await checkBackgroundRemover(results);

  const active = Object.entries(results).filter(([, r]) => !r.skipped);
  exitWithSummary(summarizeResults(Object.fromEntries(active)), "Production smoke");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
