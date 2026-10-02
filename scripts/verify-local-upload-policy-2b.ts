/**
 * Local/browser upload policy: no artificial primary-file byte cap.
 * Run: npx tsx scripts/verify-local-upload-policy-2b.ts
 */

import { readFileSync } from "node:fs";
import { join } from "node:path";
import { validateAnonymousUploadSize } from "../lib/plan/tool-access";
import {
  MAX_ADD_PAGE_NUMBERS_PAGES,
} from "../lib/tools/add-page-numbers/limits";
import { MAX_CROP_PDF_PAGES } from "../lib/tools/crop-pdf/limits";
import { MAX_FILL_PDF_PAGES } from "../lib/tools/fill-pdf/limits";
import { MAX_ORGANIZE_PDF_PAGES } from "../lib/tools/organize-pdf/limits";
import {
  MAX_REDACT_CANVAS_LONG_EDGE,
  MAX_REDACT_PDF_PAGES,
} from "../lib/tools/redact-pdf/limits";
import { MAX_SIGN_PDF_PAGES, MAX_SIGNATURE_IMAGE_BYTES } from "../lib/tools/sign-pdf/limits";
import {
  MAX_WATERMARK_IMAGE_BYTES,
  MAX_WATERMARK_PDF_PAGES,
} from "../lib/tools/watermark-pdf/limits";
import { validateQrScannerFile } from "../lib/tools/qr-scanner/file-validation";

const root = process.cwd();
let failed = 0;

function read(relativePath: string): string {
  return readFileSync(join(root, relativePath), "utf8");
}

function assert(label: string, condition: boolean): void {
  if (condition) {
    console.log(`ok  ${label}`);
    return;
  }
  failed += 1;
  console.error(`FAIL  ${label}`);
}

function assertGateOmitsSize(label: string, source: string, invocation: string): void {
  assert(`${label} gates without a byte argument`, source.includes(invocation));
  assert(
    `${label} does not pass a size into the gate`,
    !source.includes(invocation.replace(/\)$/, ",")),
  );
}

const ELEVEN_MIB = 11 * 1024 * 1024;

assert(
  "anonymous helper skips validation when no size is supplied",
  validateAnonymousUploadSize("merge-pdf", undefined) === null,
);
assert(
  "anonymous helper still rejects an explicit size above 10 MiB",
  validateAnonymousUploadSize("merge-pdf", ELEVEN_MIB)?.includes("10MB") === true,
);

const merge = read("components/tools/merge-pdf/MergePdfTool.tsx");
const imageToPdf = read("components/tools/image-to-pdf/ImageToPdfTool.tsx");
const converters = read("components/image-tools/ImageFormatConverterTool.tsx");
assert("merge does not pre-check aggregate bytes", !merge.includes("validateAnonymousUploadSize"));
assert("merge does not sum selected bytes for a cap", !merge.includes("totalBytes"));
assertGateOmitsSize("merge", merge, 'gateToolOperation("merge-pdf")');
assert("image-to-pdf does not sum selected bytes for a cap", !imageToPdf.includes("totalBytes"));
assertGateOmitsSize("image-to-pdf", imageToPdf, 'gateToolOperation("image-to-pdf")');
assert("converters do not sum selected bytes for a cap", !converters.includes("totalBytes"));
assertGateOmitsSize("converters", converters, "gateToolOperation(config.slug)");

const singleFileGates = [
  ["split-pdf", "components/tools/split-pdf/SplitPdfTool.tsx", 'gateToolOperation("split-pdf")'],
  ["rotate-pdf", "components/tools/rotate-pdf/RotatePdfTool.tsx", 'gateToolOperation("rotate-pdf")'],
  ["pdf-to-image", "components/tools/pdf-to-image/PdfToImageTool.tsx", 'gateToolOperation("pdf-to-image")'],
  ["ocr", "components/tools/ocr/OcrTool.tsx", 'gateToolOperation("ocr")'],
  ["redact-pdf", "components/tools/redact-pdf-client/RedactPdfClientTool.tsx", "gateToolOperation(toolId)"],
] as const;

for (const [label, path, invocation] of singleFileGates) {
  const source = read(path);
  assertGateOmitsSize(label, source, invocation);
  assert(`${label} does not compare file.size to a byte cap`, !/file\.size\s*>/.test(source));
}

const uploadGuards = [
  "components/tools/organize-pdf/OrganizePdfTool.tsx",
  "components/tools/fill-pdf/FillPdfTool.tsx",
  "components/tools/crop-pdf/CropPdfTool.tsx",
  "components/tools/add-page-numbers/AddPageNumbersTool.tsx",
  "components/tools/sign-pdf/SignPdfTool.tsx",
  "components/tools/watermark-pdf-client/WatermarkPdfClientTool.tsx",
];

for (const path of uploadGuards) {
  const source = read(path);
  assert(`${path} does not use the anonymous upload-byte helper`, !source.includes("getAnonymousUploadLimit"));
}

const watermarkClient = read("components/tools/watermark-pdf-client/WatermarkPdfClientTool.tsx");
assert(
  "watermark primary PDF hint does not advertise 10 MB",
  !watermarkClient.includes("up to 10 MB"),
);
assert(
  "watermark secondary image cap remains",
  watermarkClient.includes("file.size > MAX_WATERMARK_IMAGE_BYTES"),
);

const loaders = [
  "lib/tools/organize-pdf/load-document.ts",
  "lib/tools/crop-pdf/load-document.ts",
  "lib/tools/fill-pdf/load-document.ts",
  "lib/tools/fill-pdf/fill-pdf.ts",
  "lib/tools/add-page-numbers/load-document.ts",
  "lib/tools/watermark-pdf/load-document.ts",
  "lib/tools/redact-pdf/redaction-state.ts",
];
for (const path of loaders) {
  assert(`${path} has no primary byte rejection`, !read(path).includes("MB size limit"));
}

assert("organize page guard remains 200", MAX_ORGANIZE_PDF_PAGES === 200);
assert("crop page guard remains 200", MAX_CROP_PDF_PAGES === 200);
assert("fill page guard remains 200", MAX_FILL_PDF_PAGES === 200);
assert("page-numbers page guard remains 200", MAX_ADD_PAGE_NUMBERS_PAGES === 200);
assert("watermark page guard remains 200", MAX_WATERMARK_PDF_PAGES === 200);
assert("redact page guard remains 200", MAX_REDACT_PDF_PAGES === 200);
assert("sign page guard remains 200", MAX_SIGN_PDF_PAGES === 200);
assert("redact raster edge remains 4000", MAX_REDACT_CANVAS_LONG_EDGE === 4000);
assert("watermark image cap remains 2 MiB", MAX_WATERMARK_IMAGE_BYTES === 2 * 1024 * 1024);
assert("signature image cap remains 2 MiB", MAX_SIGNATURE_IMAGE_BYTES === 2 * 1024 * 1024);
assert(
  "watermark image validator still enforces 2 MiB",
  read("lib/tools/watermark-pdf/validation.ts").includes("imageBytes.byteLength > MAX_WATERMARK_IMAGE_BYTES"),
);
assert(
  "signature asset loader still enforces 2 MiB",
  read("lib/tools/sign-pdf/signature-assets.ts").includes("file.size > MAX_SIGNATURE_IMAGE_BYTES"),
);

const ocrPreprocess = read("lib/tools/ocr/preprocess.ts");
const ocrExtract = read("lib/tools/ocr/extract-text.ts");
const ocrRuntime = read("lib/tools/ocr/runtime.ts");
assert("OCR pixel guard remains", ocrPreprocess.includes("MAX_OCR_PIXELS = 16_000_000"));
assert("OCR long-edge guard remains", ocrPreprocess.includes("MAX_OCR_LONG_EDGE = 4000"));
assert("OCR PDF scale remains 2.5", ocrExtract.includes("PDF_OCR_SCALE = 2.5"));
assert("OCR startup deadline remains", ocrRuntime.includes("90_000") || ocrExtract.includes("90_000"));
assert("OCR recognition deadline remains", ocrRuntime.includes("180_000") || ocrExtract.includes("180_000"));

const qrValidation = read("lib/tools/qr-scanner/file-validation.ts");
const qrUpload = read("components/tools/qr-scanner/QrUploadScanner.tsx");
assert("QR validation has no byte constant", !qrValidation.includes("MAX_QR_SCANNER_BYTES"));
assert("QR validation does not read file.size", !qrValidation.includes("file.size"));
assert("QR copy does not claim 25 MB", !qrUpload.includes("25 MB"));
const qrFile = new File([new Uint8Array([1])], "code.png", { type: "image/png" });
Object.defineProperty(qrFile, "size", { value: 30 * 1024 * 1024 });
assert("QR accepts a typed image above 25 MiB", validateQrScannerFile(qrFile) === null);
const qrBad = new File([new Uint8Array([1])], "notes.txt", { type: "text/plain" });
assert(
  "QR still rejects an unsupported type",
  validateQrScannerFile(qrBad)?.includes("Unsupported file type") === true,
);

const editor = read("components/image-editor/ImageEditorWorkspace.tsx");
assert("image editor has no byte-cap comparison", !/file\.size\s*>/.test(editor));

const toolGate = read("lib/plan/tool-gate.ts");
assert(
  "shared gate still validates a supplied size",
  toolGate.includes("validateAnonymousUploadSize(tool, fileSizeBytes)"),
);
const planConfig = read("lib/plan/config.ts");
assert("free plan upload constant remains 10 MiB", planConfig.includes("maxUploadBytes: 10 * 1024 * 1024"));
assert("pro plan upload constant remains 50 MiB", planConfig.includes("maxUploadBytes: 50 * 1024 * 1024"));
assert("business plan upload constant remains 100 MiB", planConfig.includes("maxUploadBytes: 100 * 1024 * 1024"));
assert(
  "plan clamp to analysis bytes remains",
  planConfig.includes("Math.min(limits.maxUploadBytes, FILE_LIMITS.maxAnalysisBytes)"),
);
assert(
  "server upload validator still rejects an explicit size",
  read("lib/plan/access.ts").includes("fileSizeBytes > limits.maxUploadBytes"),
);
assert(
  "compress PDF still sends file size into plan access",
  read("app/api/tools/pdf/compress/route.ts").includes('resolveFreeToolAccess(ROUTE, "compress-pdf", file.size)'),
);
assert(
  "compress PDF free-tier copy remains",
  read("components/tools/compress-pdf/CompressionLevelPanel.tsx").includes("up to 10MB"),
);
assert(
  "image compress route still uses the shared image byte cap",
  read("app/api/tools/image/compress/route.ts").includes("maxBytes: FREE_IMAGE_MAX_BYTES"),
);
assert(
  "image resize route still uses the shared image byte cap",
  read("app/api/tools/image/resize/route.ts").includes("maxBytes: FREE_IMAGE_MAX_BYTES"),
);
assert(
  "upscale job route still clamps to the shared image byte cap",
  read("app/api/tools/image/upscale/jobs/route.ts").includes("FREE_IMAGE_MAX_BYTES"),
);
assert(
  "upscaler pixel guard remains",
  read("lib/providers/upscale/realesrgan-provider.ts").includes("MAX_INPUT_PIXELS = 4_000_000"),
);
assert(
  "vectorize byte cap remains",
  read("lib/design/vectorize/types.ts").includes("VECTORIZE_MAX_BYTES = 5 * 1024 * 1024"),
);
assert(
  "jpg-to-psd route still uses the shared image byte cap",
  read("app/api/tools/jpg-to-psd/route.ts").includes("FREE_IMAGE_MAX_BYTES"),
);
assert(
  "png-to-psd route still uses the shared image byte cap",
  read("app/api/tools/png-to-psd/route.ts").includes("FREE_IMAGE_MAX_BYTES"),
);

if (failed > 0) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}

console.log("\nlocal upload policy 2b checks passed");
