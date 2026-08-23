/**
 * Shared Puppeteer helpers for client tool regression tests.
 */

import { mkdir } from "node:fs/promises";
import { join } from "node:path";

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

export async function installDownloadHook(page) {
  await page.evaluate(() => {
    window.__regressionDl = [];
    if (!window.__regressionDlHooked) {
      window.__regressionDlHooked = 1;
      const original = URL.createObjectURL;
      URL.createObjectURL = function (blob) {
        window.__regressionDl.push(blob);
        return original.call(this, blob);
      };
    }
  });
}

export async function readLastBlob(page) {
  return page.evaluate(async () => {
    const blob = window.__regressionDl?.at(-1);
    if (!blob) return null;
    const buf = new Uint8Array(await blob.arrayBuffer());
    return {
      size: buf.length,
      type: blob.type,
      bytes: Array.from(buf),
    };
  }).then((result) =>
    result
      ? { ...result, bytes: Buffer.from(result.bytes) }
      : null,
  );
}

export async function readAllBlobs(page) {
  return page
    .evaluate(async () => {
      const out = [];
      for (const blob of window.__regressionDl || []) {
        const buf = new Uint8Array(await blob.arrayBuffer());
        out.push({
          size: buf.length,
          type: blob.type,
          bytes: Array.from(buf),
        });
      }
      return out;
    })
    .then((blobs) =>
      blobs.map((b) => ({ ...b, bytes: Buffer.from(b.bytes) })),
    );
}

export async function uploadFiles(page, ...files) {
  const input = await page.waitForSelector('input[type="file"]', { timeout: 30000 });
  await input.uploadFile(...files);
  await input.evaluate((el) => el.dispatchEvent(new Event("change", { bubbles: true })));
}

export async function clickButtonContaining(page, text) {
  return page.evaluate((t) => {
    const el = [...document.querySelectorAll("button")].find(
      (e) => e.textContent.includes(t) && !e.disabled,
    );
    if (!el) return false;
    el.click();
    return true;
  }, text);
}

export async function waitForBodyText(page, text, timeout = 120000) {
  await page.waitForFunction((t) => document.body.innerText.includes(t), { timeout }, text);
}

export function attachPageDiagnostics(page, diagnostics) {
  const errors = [];
  page.on("console", (msg) => {
    if (msg.type() === "error") {
      const text = msg.text();
      if (!/401|Unauthorized|gateToolOperation/i.test(text)) {
        errors.push(text);
      }
    }
  });
  page.on("pageerror", (err) => errors.push(String(err)));
  page.on("requestfailed", (req) => {
    errors.push(`NETWORK_FAIL ${req.url()} ${req.failure()?.errorText || ""}`);
  });
  diagnostics.getErrors = () => errors.slice(0, 10);
}

export async function captureFailureArtifacts(page, slug, screenshotDir) {
  if (!screenshotDir) return;
  await mkdir(screenshotDir, { recursive: true });
  const path = join(screenshotDir, `${slug}-failure.png`);
  await page.screenshot({ path, fullPage: true }).catch(() => {});
  return path;
}

export async function launchBrowser(puppeteer) {
  return puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox", "--disable-dev-shm-usage"],
  });
}
