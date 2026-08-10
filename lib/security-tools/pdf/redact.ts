import type { RedactionArea } from "@/lib/providers/pdf/redaction/types";

export type { RedactionArea };

export function parseRedactionAreas(raw: string | null): RedactionArea[] {
  if (!raw) return [];

  try {
    const parsed = JSON.parse(raw) as RedactionArea[];
    if (!Array.isArray(parsed)) return [];

    return parsed.filter(
      (area) =>
        typeof area.pageIndex === "number" &&
        typeof area.x === "number" &&
        typeof area.y === "number" &&
        typeof area.width === "number" &&
        typeof area.height === "number" &&
        area.width > 0 &&
        area.height > 0,
    );
  } catch {
    return [];
  }
}

/** Cosmetic overlay redaction — NOT secure. Do not use in production paths. */
export async function redactPdfAreasCosmeticOverlay(
  buffer: Buffer,
  areas: RedactionArea[],
): Promise<Uint8Array> {
  const { PDFDocument, rgb } = await import("pdf-lib");

  if (areas.length === 0) {
    throw new Error("Select at least one area to redact.");
  }

  const pdfDoc = await PDFDocument.load(buffer, { ignoreEncryption: true });
  const pages = pdfDoc.getPages();

  for (const area of areas) {
    const page = pages[area.pageIndex];
    if (!page) continue;

    page.drawRectangle({
      x: area.x,
      y: area.y,
      width: area.width,
      height: area.height,
      color: rgb(0, 0, 0),
      borderWidth: 0,
    });
  }

  return pdfDoc.save();
}

/** Client-side raster redaction — browser only, not wired to production API. */
export async function redactPdfPermanentClient(
  buffer: ArrayBuffer,
  areas: RedactionArea[],
): Promise<Uint8Array> {
  if (areas.length === 0) {
    throw new Error("Select at least one area to redact.");
  }

  const { configurePdfWorker } = await import("@/lib/pdf/configure-worker");
  await configurePdfWorker();
  const pdfjs = await import("pdfjs-dist");
  const { jsPDF } = await import("jspdf");
  const loadingTask = pdfjs.getDocument({ data: new Uint8Array(buffer) });
  const pdf = await loadingTask.promise;

  let doc: InstanceType<typeof jsPDF> | null = null;

  for (let pageIndex = 0; pageIndex < pdf.numPages; pageIndex += 1) {
    const page = await pdf.getPage(pageIndex + 1);
    const scale = 2;
    const viewport = page.getViewport({ scale });
    const canvas = document.createElement("canvas");
    canvas.width = viewport.width;
    canvas.height = viewport.height;
    const context = canvas.getContext("2d");
    if (!context) {
      throw new Error("Could not create canvas context.");
    }

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    for (const area of areas.filter((item) => item.pageIndex === pageIndex)) {
      context.fillStyle = "#000000";
      context.fillRect(
        area.x * scale,
        area.y * scale,
        area.width * scale,
        area.height * scale,
      );
    }

    const baseViewport = page.getViewport({ scale: 1 });
    const orientation = baseViewport.width > baseViewport.height ? "landscape" : "portrait";
    const imageData = canvas.toDataURL("image/jpeg", 0.92);

    if (!doc) {
      doc = new jsPDF({
        unit: "pt",
        format: [baseViewport.width, baseViewport.height],
        orientation,
      });
    } else {
      doc.addPage([baseViewport.width, baseViewport.height], orientation);
    }

    doc.addImage(imageData, "JPEG", 0, 0, baseViewport.width, baseViewport.height);
  }

  if (!doc) {
    throw new Error("Could not process PDF pages.");
  }

  return new Uint8Array(doc.output("arraybuffer"));
}
