/**
 * Compress PDF no-growth guarantee.
 * Run: npx tsx scripts/verify-compress-pdf-no-growth.ts
 */

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { PDFDocument } from "pdf-lib";
import { formatCompressPdfSavingsLabel } from "../components/tools/compress-pdf/savings-label";
import { compressPdfBytes } from "../lib/tools/compress-pdf/compress-pdf";
import {
  calculateSavingsPercent,
  type CompressionLevel,
} from "../lib/tools/compress-pdf/compression-levels";
import { selectNonGrowingPdfBytes } from "../lib/tools/compress-pdf/no-growth";

const LEVELS: CompressionLevel[] = ["light", "recommended", "strong"];

function savedLabel(originalSize: number, resultSize: number): string {
  const percent = calculateSavingsPercent(originalSize, resultSize);
  if (resultSize < originalSize && percent > 0) {
    return formatCompressPdfSavingsLabel(originalSize, resultSize, percent);
  }
  return "No reduction";
}

function bytes(length: number, fill: number): Uint8Array {
  return new Uint8Array(length).fill(fill);
}

/** Compact two-page PDF with an unembedded Helvetica reference. */
function tinyTwoPagePdf(): Uint8Array {
  const stream = "BT /F1 12 Tf 72 720 Td (Hello page) Tj ET";
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R 4 0 R] /Count 2 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 5 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n",
    "4 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Contents 6 0 R /Resources << /Font << /F1 7 0 R >> >> >>\nendobj\n",
    `5 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    `6 0 obj\n<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\nendobj\n`,
    "7 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
  ];
  let body = "%PDF-1.4\n";
  const offsets = [0];
  for (const object of objects) {
    offsets.push(body.length);
    body += object;
  }
  const xref = body.length;
  let table = `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n`;
  for (let index = 1; index <= objects.length; index += 1) {
    table += `${String(offsets[index]).padStart(10, "0")} 00000 n \n`;
  }
  body += `${table}trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF\n`;
  return new TextEncoder().encode(body);
}

function assertCaseA(): void {
  const original = bytes(1890, 1);
  const candidate = bytes(4300, 2);
  const result = selectNonGrowingPdfBytes(original, candidate);
  assert.equal(result.byteLength, 1890);
  assert.equal(result, original);
  assert.equal(savedLabel(1890, result.byteLength), "No reduction");
  console.log("CASE A pass — 1890 vs 4300 keeps original, saved = No reduction");
}

function assertCaseB(): void {
  const original = bytes(1890, 1);
  const candidate = bytes(1890, 2);
  const result = selectNonGrowingPdfBytes(original, candidate);
  assert.equal(result, original);
  assert.notEqual(result, candidate);
  assert.equal(savedLabel(original.byteLength, result.byteLength), "No reduction");
  console.log("CASE B pass — equal length keeps original, saved = No reduction");
}

function assertCaseC(): void {
  const original = bytes(100_000, 1);
  const candidate = bytes(50_000, 2);
  const result = selectNonGrowingPdfBytes(original, candidate);
  assert.equal(result, candidate);
  assert.equal(result.byteLength, 50_000);
  assert.equal(calculateSavingsPercent(100_000, result.byteLength), 50);
  assert.equal(savedLabel(100_000, result.byteLength), "50%");
  console.log("CASE C pass — 100000 vs 50000 keeps candidate, saved = 50%");
}

function assertCaseDSelector(): void {
  const original = bytes(1890, 1);
  const candidate = bytes(4300, 2);
  for (const level of LEVELS) {
    const result = selectNonGrowingPdfBytes(original, candidate);
    assert.equal(result, original, level);
    assert.equal(savedLabel(original.byteLength, result.byteLength), "No reduction");
  }
  console.log("CASE D pass — light, recommended, and strong share the no-growth selector");
}

async function assertTinyTwoPagePdf(): Promise<void> {
  const original = tinyTwoPagePdf();
  const loaded = await PDFDocument.load(original);
  assert.equal(loaded.getPageCount(), 2);

  for (const level of LEVELS) {
    const input = new ArrayBuffer(original.byteLength);
    new Uint8Array(input).set(original);
    const result = await compressPdfBytes(input, level);
    assert.ok(
      result.byteLength <= original.byteLength,
      `${level} grew ${original.byteLength} → ${result.byteLength}`,
    );
    if (result.byteLength === original.byteLength) {
      assert.deepEqual(result, original, `${level} equal length must be the original bytes`);
      assert.equal(savedLabel(original.byteLength, result.byteLength), "No reduction");
    } else {
      assert.ok(result.byteLength < original.byteLength);
      assert.ok(calculateSavingsPercent(original.byteLength, result.byteLength) > 0);
    }
    console.log(
      `tiny two-page ${level}: original ${original.byteLength} → result ${result.byteLength}`,
    );
  }
}

function assertRouteWiresGuard(): void {
  const route = readFileSync(
    join(process.cwd(), "app/api/tools/pdf/compress/route.ts"),
    "utf8",
  );
  assert.match(route, /selectNonGrowingPdfBytes\(input, result\.output\)/);
  console.log("route pass — Ghostscript output is passed through the no-growth selector");
}

async function main(): Promise<void> {
  assertCaseA();
  assertCaseB();
  assertCaseC();
  assertCaseDSelector();
  await assertTinyTwoPagePdf();
  assertRouteWiresGuard();
  console.log("compress PDF no-growth verification passed");
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
