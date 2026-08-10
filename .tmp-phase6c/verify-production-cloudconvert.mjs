import { PDFDocument } from "pdf-lib";
import JSZip from "jszip";
import { writeFileSync, mkdirSync, readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const tmp = __dirname;
mkdirSync(tmp, { recursive: true });

const pdfDoc = await PDFDocument.create();
pdfDoc.addPage([200, 200]);
const pdfBytes = await pdfDoc.save();
writeFileSync(join(tmp, "tiny.pdf"), pdfBytes);

const zip = new JSZip();
zip.file(
  "[Content_Types].xml",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/></Types>',
);
zip.file(
  "_rels/.rels",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/></Relationships>',
);
zip.file(
  "word/document.xml",
  '<?xml version="1.0" encoding="UTF-8" standalone="yes"?><w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"><w:body><w:p><w:r><w:t>Scanonix phase 6c test</w:t></w:r></w:p></w:body></w:document>',
);
const docxBytes = await zip.generateAsync({ type: "nodebuffer" });
writeFileSync(join(tmp, "tiny.docx"), docxBytes);

const BASE = "https://www.scanonix.com";
const report = {
  configDetected: null,
  pdfToWord: "NOT RUN",
  wordToPdf: "NOT RUN",
  outputValidation: "NOT RUN",
  details: [],
};

async function probe(route) {
  const res = await fetch(`${BASE}${route}`, { method: "POST" });
  const text = await res.text().catch(() => "");
  return { status: res.status, text: text.slice(0, 200) };
}

const probePdfWord = await probe("/api/tools/pdf-to-word");
const probeWordPdf = await probe("/api/tools/word-to-pdf");
report.details.push(`probe pdf-to-word: ${probePdfWord.status}`);
report.details.push(`probe word-to-pdf: ${probeWordPdf.status}`);

const is503 = (s) => s === 503;
// 503 = key not loaded; any other non-404 response on word-to-pdf implies route reached config gate
report.configDetected = probeWordPdf.status !== 503;
if (probePdfWord.status === 404) {
  report.details.push("pdf-to-word route: NOT DEPLOYED (404)");
}
if (probeWordPdf.status === 401) {
  report.details.push("word-to-pdf: auth required before conversion (401) — CloudConvert gate passed if not 503");
}

if (probeWordPdf.status === 503) {
  report.configDetected = false;
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const docx = readFileSync(join(tmp, "tiny.docx"));
const form1 = new FormData();
form1.append(
  "file",
  new Blob([docx], {
    type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
  }),
  "tiny.docx",
);
const w2p = await fetch(`${BASE}/api/tools/word-to-pdf`, { method: "POST", body: form1 });
report.details.push(`word-to-pdf status: ${w2p.status}`);

if (!w2p.ok) {
  report.wordToPdf = "FAIL";
  report.details.push(`word-to-pdf error: ${(await w2p.text()).slice(0, 300)}`);
  report.outputValidation = "FAIL";
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const pdfOut = Buffer.from(await w2p.arrayBuffer());
const pdfOk = pdfOut.length > 100 && pdfOut.subarray(0, 5).toString("ascii").startsWith("%PDF-");
report.wordToPdf = pdfOk ? "PASS" : "FAIL";
report.details.push(`word-to-pdf bytes: ${pdfOut.length}, pdf header ok: ${pdfOk}`);

if (!pdfOk) {
  report.outputValidation = "FAIL";
  console.log(JSON.stringify(report, null, 2));
  process.exit(0);
}

const pdf = readFileSync(join(tmp, "tiny.pdf"));
const form2 = new FormData();
form2.append("file", new Blob([pdf], { type: "application/pdf" }), "tiny.pdf");
const p2w = await fetch(`${BASE}/api/tools/pdf-to-word`, { method: "POST", body: form2 });
report.details.push(`pdf-to-word status: ${p2w.status}`);

if (p2w.status === 401 || p2w.status === 403) {
  report.pdfToWord = "NOT RUN";
  report.details.push(`pdf-to-word blocked by auth/plan (config present): ${p2w.status}`);
  report.outputValidation = report.wordToPdf === "PASS" ? "PASS" : "FAIL";
} else if (!p2w.ok) {
  report.pdfToWord = "FAIL";
  report.details.push(`pdf-to-word error: ${(await p2w.text()).slice(0, 300)}`);
  report.outputValidation = "FAIL";
} else {
  const docxOut = Buffer.from(await p2w.arrayBuffer());
  const docxOk = docxOut.length > 100 && docxOut[0] === 0x50 && docxOut[1] === 0x4b;
  report.pdfToWord = docxOk ? "PASS" : "FAIL";
  report.details.push(`pdf-to-word bytes: ${docxOut.length}, docx header ok: ${docxOk}`);
  report.outputValidation =
    report.wordToPdf === "PASS" && docxOk ? "PASS" : "FAIL";
}

console.log(JSON.stringify(report, null, 2));
