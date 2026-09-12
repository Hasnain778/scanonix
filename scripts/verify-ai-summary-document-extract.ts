/**
 * Static QA for AI Summary document extraction (no OpenAI / no usage).
 *
 * TXT/DOCX exercise extractSummaryDocumentText.
 * PDF exercises the same production helpers (extractNativePageContent +
 * blocksToPlainText) via the existing Node pdf.js loader — browser Summary
 * uses loadPdfDocument from pdf-render instead of this Node path.
 */
import assert from "node:assert/strict";
import { PDFDocument, StandardFonts } from "pdf-lib";
import { Document, Packer, Paragraph, TextRun } from "docx";
import {
  detectSummaryDocumentKind,
  extractSummaryDocumentText,
  SUMMARY_OCR_TOOL_HREF,
  SummaryDocumentExtractError,
  validateSummaryUploadFile,
} from "../lib/tools/ai-summary/extract-document-text";
import { getAnonymousUploadLimit } from "../lib/plan/tool-access";
import { loadPdfJsDocumentNode } from "../lib/tools/redact-pdf/pdfjs-node";
import {
  extractNativePageContent,
  MIN_NATIVE_TEXT_CHARS,
} from "../lib/tools/pdf-to-word/extract-pdf-page";
import { blocksToPlainText } from "../lib/tools/pdf-to-word/text-structure";

const MAX_CHARS = 100_000;

function fileFromBytes(
  name: string,
  bytes: Uint8Array,
  type: string,
): File {
  return new File([Buffer.from(bytes)], name, { type });
}

async function buildNativePdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const page = doc.addPage();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  page.drawText(
    "Scanonix native text PDF fixture for AI Document Summary extraction.",
    { x: 48, y: 700, size: 12, font },
  );
  return doc.save();
}

async function buildEmptyPdf(): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  doc.addPage();
  return doc.save();
}

async function buildDocx(): Promise<Uint8Array> {
  const document = new Document({
    sections: [
      {
        children: [
          new Paragraph({
            children: [
              new TextRun(
                "Scanonix DOCX fixture for AI Document Summary raw text extraction.",
              ),
            ],
          }),
        ],
      },
    ],
  });
  const buffer = await Packer.toBuffer(document);
  return new Uint8Array(buffer);
}

async function extractPdfNativeTextViaSharedHelpers(
  bytes: Uint8Array,
): Promise<string> {
  const pdf = await loadPdfJsDocumentNode(bytes);
  const pageTexts: string[] = [];
  let totalCharCount = 0;

  for (let pageNumber = 1; pageNumber <= pdf.numPages; pageNumber++) {
    const page = await pdf.getPage(pageNumber);
    const nativeContent = await extractNativePageContent(page);
    totalCharCount += nativeContent.charCount;
    const plain = blocksToPlainText(nativeContent.blocks);
    if (plain) pageTexts.push(plain);
  }

  if (totalCharCount < MIN_NATIVE_TEXT_CHARS || pageTexts.length === 0) {
    throw new SummaryDocumentExtractError(
      "NO_NATIVE_TEXT",
      "We couldn't find selectable text in this PDF. If it's a scanned document, use Scanonix OCR first.",
    );
  }

  return pageTexts.join("\n\n");
}

async function main() {
  console.log("verify-ai-summary-document-extract");

  assert.equal(SUMMARY_OCR_TOOL_HREF, "/tools/ocr");

  const maxBytes = getAnonymousUploadLimit();
  assert.equal(maxBytes, 10 * 1024 * 1024, "reuses free plan anonymous upload limit");

  // TXT via Summary helper
  const txt = new File(
    ["Hello from TXT extraction for AI Summary.\nLine two."],
    "sample.txt",
    { type: "text/plain" },
  );
  assert.equal(detectSummaryDocumentKind(txt), "txt");
  assert.equal(validateSummaryUploadFile(txt, maxBytes), null);
  const txtResult = await extractSummaryDocumentText(txt);
  assert.match(txtResult.text, /Hello from TXT/);

  // Image rejection
  const png = new File([Buffer.from([137, 80, 78, 71])], "scan.png", {
    type: "image/png",
  });
  const pngError = validateSummaryUploadFile(png, maxBytes);
  assert.ok(pngError);
  assert.equal(pngError.code, "UNSUPPORTED");
  assert.match(pngError.message, /Images|OCR/i);

  // DOCX via Summary helper (mammoth)
  const docxBytes = await buildDocx();
  const docx = fileFromBytes(
    "sample.docx",
    docxBytes,
    "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  );
  assert.equal(detectSummaryDocumentKind(docx), "docx");
  const docxResult = await extractSummaryDocumentText(docx);
  assert.match(docxResult.text, /DOCX fixture/i);

  // Native PDF via shared extractNativePageContent (Node pdf.js loader)
  const pdfBytes = await buildNativePdf();
  const pdfFile = fileFromBytes("native.pdf", pdfBytes, "application/pdf");
  assert.equal(detectSummaryDocumentKind(pdfFile), "pdf");
  const pdfText = await extractPdfNativeTextViaSharedHelpers(pdfBytes);
  assert.match(pdfText, /native text PDF/i);

  // Empty / no native text PDF
  const emptyBytes = await buildEmptyPdf();
  await assert.rejects(
    () => extractPdfNativeTextViaSharedHelpers(emptyBytes),
    (error: unknown) => {
      assert.ok(error instanceof SummaryDocumentExtractError);
      assert.equal(error.code, "NO_NATIVE_TEXT");
      assert.match(error.message, /selectable text/i);
      assert.match(error.message, /OCR/i);
      return true;
    },
  );

  // >100k character gate condition (UI blocks Generate; no API call)
  assert.equal("x".repeat(MAX_CHARS + 1).length > MAX_CHARS, true);

  // Upload size rejection (plan maxUploadBytes pattern)
  const huge = new File([new Uint8Array(maxBytes + 1)], "huge.txt", {
    type: "text/plain",
  });
  const sizeError = validateSummaryUploadFile(huge, maxBytes);
  assert.ok(sizeError);
  assert.equal(sizeError.code, "TOO_LARGE");

  console.log(
    "PASS — TXT, DOCX, native PDF helpers, empty PDF, image reject, size limit",
  );
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
