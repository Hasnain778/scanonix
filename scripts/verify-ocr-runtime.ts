/**
 * OCR same-origin runtime and bounded-failure checks.
 * Run: npx tsx scripts/verify-ocr-runtime.ts
 */
import assert from "node:assert/strict";
import { existsSync, readFileSync, statSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  getOcrWorkerOptions,
  OCR_INIT_TIMEOUT_MS,
  OCR_RECOGNIZE_TIMEOUT_MS,
  OCR_RUNTIME_CORE_PATH,
  OCR_RUNTIME_LANG_PATH,
  OCR_RUNTIME_WORKER_PATH,
  OcrTimeoutError,
  withOcrDeadline,
} from "../lib/tools/ocr/runtime";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const runtimeDir = join(root, "public", "ocr-runtime");

const coreFiles = [
  "tesseract-core-lstm.wasm.js",
  "tesseract-core-lstm.wasm",
  "tesseract-core-simd-lstm.wasm.js",
  "tesseract-core-simd-lstm.wasm",
  "tesseract-core-relaxedsimd-lstm.wasm.js",
  "tesseract-core-relaxedsimd-lstm.wasm",
];

const languages = ["eng", "spa", "fra", "deu", "por", "ita", "ara", "urd"];

function fail(message: string): never {
  throw new Error(message);
}

function assertFile(relativePath: string, minBytes: number) {
  const absolute = join(runtimeDir, relativePath);
  assert.equal(existsSync(absolute), true, relativePath);
  const size = statSync(absolute).size;
  assert.ok(size >= minBytes, `${relativePath} is ${size} bytes`);
}

async function main() {
  const options = getOcrWorkerOptions();
  assert.equal(options.workerPath, OCR_RUNTIME_WORKER_PATH);
  assert.equal(options.corePath, OCR_RUNTIME_CORE_PATH);
  assert.equal(options.langPath, OCR_RUNTIME_LANG_PATH);
  assert.equal(options.gzip, true);
  assert.equal(options.workerPath?.includes("jsdelivr"), false);
  assert.equal(options.corePath?.includes("jsdelivr"), false);
  assert.equal(options.langPath?.includes("jsdelivr"), false);
  assert.ok(OCR_INIT_TIMEOUT_MS >= 60_000);
  assert.ok(OCR_RECOGNIZE_TIMEOUT_MS >= 120_000);

  assertFile("worker.min.js", 50_000);
  assertFile("NOTICE.txt", 100);
  assertFile("licenses/tesseract.js-core.LICENSE", 1_000);
  assertFile("licenses/tesseract.js.LICENSE.md", 1_000);
  for (const name of coreFiles) {
    assertFile(join("core", name), 100_000);
  }
  for (const language of languages) {
    const relative = join("lang", `${language}.traineddata.gz`);
    assertFile(relative, 100_000);
    const bytes = readFileSync(join(runtimeDir, relative));
    assert.equal(bytes[0], 0x1f, `${language} gzip magic`);
    assert.equal(bytes[1], 0x8b, `${language} gzip magic`);
  }

  const extractSource = readFileSync(
    join(root, "lib", "tools", "ocr", "extract-text.ts"),
    "utf8",
  );
  assert.match(extractSource, /getOcrWorkerOptions\(/);
  assert.match(extractSource, /withOcrDeadline\(/);
  assert.doesNotMatch(extractSource, /jsdelivr/);
  assert.doesNotMatch(extractSource, /10 \* 1024 \* 1024/);

  const hung = withOcrDeadline(new Promise<string>(() => {}), 40, "init");
  await assert.rejects(hung, (error: unknown) => {
    assert.ok(error instanceof OcrTimeoutError);
    assert.equal(error.phase, "init");
    assert.equal(error.message, "OCR couldn't start. Please try again.");
    return true;
  });

  let lateTerminated = false;
  const late = withOcrDeadline(
    new Promise<{ terminate: () => void }>((resolve) => {
      setTimeout(() => resolve({ terminate: () => { lateTerminated = true; } }), 80);
    }),
    20,
    "init",
    (worker) => {
      worker.terminate();
    },
  );
  await assert.rejects(late, OcrTimeoutError);
  await new Promise((resolve) => setTimeout(resolve, 100));
  assert.equal(lateTerminated, true, "late worker is terminated");

  await assert.rejects(
    withOcrDeadline(Promise.reject(new Error("recognize failed")), 500, "recognize"),
    (error: unknown) => {
      assert.ok(error instanceof Error);
      assert.equal(error.message, "recognize failed");
      assert.equal(error instanceof OcrTimeoutError, false);
      return true;
    },
  );

  const finished = await withOcrDeadline(Promise.resolve("ok"), 500, "recognize");
  assert.equal(finished, "ok");

  const finish = new OcrTimeoutError("recognize");
  assert.equal(finish.message, "OCR couldn't finish reading this file. Please try again.");

  if (process.exitCode) fail("verify failed");
  console.log("verify-ocr-runtime: ok");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
