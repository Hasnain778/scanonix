import { load } from "cheerio";
import { isTag, isText, type AnyNode } from "domhandler";
import mammoth from "mammoth";
import { PDFDocument, StandardFonts, type PDFFont, type PDFPage, rgb } from "pdf-lib";

type CheerioInstance = ReturnType<typeof load>;

const PAGE_WIDTH = 595.28;
const PAGE_HEIGHT = 841.89;
const MARGIN = 50;
const CONTENT_WIDTH = PAGE_WIDTH - MARGIN * 2;

interface LayoutState {
  page: PDFPage;
  y: number;
  font: PDFFont;
  boldFont: PDFFont;
}

function wrapText(text: string, font: PDFFont, fontSize: number, maxWidth: number): string[] {
  const words = text.split(/\s+/).filter(Boolean);
  if (words.length === 0) return [""];

  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    const width = font.widthOfTextAtSize(candidate, fontSize);
    if (width <= maxWidth) {
      current = candidate;
    } else if (current) {
      lines.push(current);
      current = word;
    } else {
      lines.push(word);
      current = "";
    }
  }

  if (current) lines.push(current);
  return lines.length > 0 ? lines : [""];
}

function ensureSpace(state: LayoutState, pdfDoc: PDFDocument, lineHeight: number): LayoutState {
  if (state.y - lineHeight >= MARGIN) {
    return state;
  }

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  return { ...state, page, y: PAGE_HEIGHT - MARGIN };
}

function drawLines(
  state: LayoutState,
  pdfDoc: PDFDocument,
  lines: string[],
  fontSize: number,
  font: PDFFont,
  extraGap = 4,
): LayoutState {
  const lineHeight = fontSize + 4;
  let next = state;

  for (const line of lines) {
    next = ensureSpace(next, pdfDoc, lineHeight);
    next.page.drawText(line, {
      x: MARGIN,
      y: next.y,
      size: fontSize,
      font,
      color: rgb(0, 0, 0),
    });
    next = { ...next, y: next.y - lineHeight };
  }

  return { ...next, y: next.y - extraGap };
}

function drawBlockText(
  state: LayoutState,
  pdfDoc: PDFDocument,
  text: string,
  fontSize: number,
  font: PDFFont,
): LayoutState {
  const paragraphs = text.split(/\n+/);
  let next = state;

  for (const paragraph of paragraphs) {
    const trimmed = paragraph.trim();
    if (!trimmed) {
      next = { ...next, y: next.y - fontSize };
      continue;
    }
    const lines = wrapText(trimmed, font, fontSize, CONTENT_WIDTH);
    next = drawLines(next, pdfDoc, lines, fontSize, font, 8);
  }

  return next;
}

function nodeText(api: CheerioInstance, node: AnyNode): string {
  return api(node).text();
}

function processNode(
  state: LayoutState,
  pdfDoc: PDFDocument,
  api: CheerioInstance,
  element: AnyNode,
): LayoutState {
  if (isText(element)) {
    const text = element.data;
    if (text.trim()) {
      return drawBlockText(state, pdfDoc, text.trim(), 12, state.font);
    }
    return state;
  }

  if (!isTag(element)) {
    return state;
  }

  const tag = element.name.toLowerCase();

  if (tag === "p") {
    const text = nodeText(api, element).trim();
    if (!text) return { ...state, y: state.y - 8 };
    return drawBlockText(state, pdfDoc, text, 12, state.font);
  }

  if (/^h[1-6]$/.test(tag)) {
    const level = Number(tag[1]);
    const sizes: Record<number, number> = { 1: 22, 2: 18, 3: 16, 4: 14, 5: 13, 6: 12 };
    const text = nodeText(api, element).trim();
    if (!text) return state;
    const lines = wrapText(text, state.boldFont, sizes[level] ?? 14, CONTENT_WIDTH);
    const next = drawLines(state, pdfDoc, lines, sizes[level] ?? 14, state.boldFont, 10);
    return { ...next, y: next.y - 4 };
  }

  if (tag === "ul" || tag === "ol") {
    let next = state;
    const listItems = element.children.filter(isTag).filter((child) => child.name === "li");
    listItems.forEach((li, index) => {
      const bullet = tag === "ul" ? "•" : `${index + 1}.`;
      const text = nodeText(api, li).trim();
      if (!text) return;
      const lines = wrapText(`${bullet} ${text}`, next.font, 12, CONTENT_WIDTH - 12);
      next = drawLines(next, pdfDoc, lines, 12, next.font, 6);
    });
    return { ...next, y: next.y - 4 };
  }

  if (tag === "br") {
    return { ...state, y: state.y - 14 };
  }

  if (tag === "img") {
    const alt = element.attribs.alt?.trim();
    if (alt) {
      return drawBlockText(state, pdfDoc, `[Image: ${alt}]`, 11, state.font);
    }
    return state;
  }

  let next = state;
  for (const child of element.children) {
    next = processNode(next, pdfDoc, api, child);
  }

  return next;
}

export async function convertDocxToPdf(docxBuffer: Buffer): Promise<Uint8Array> {
  const result = await mammoth.convertToHtml({ buffer: docxBuffer });
  const html = result.value?.trim();

  const pdfDoc = await PDFDocument.create();
  const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);

  const page = pdfDoc.addPage([PAGE_WIDTH, PAGE_HEIGHT]);
  let state: LayoutState = {
    page,
    y: PAGE_HEIGHT - MARGIN,
    font,
    boldFont,
  };

  if (!html) {
    state.page.drawText("Empty document", {
      x: MARGIN,
      y: state.y,
      size: 12,
      font,
      color: rgb(0, 0, 0),
    });
    return pdfDoc.save();
  }

  const api = load(html);
  const rootChildren =
    api("body").length > 0
      ? (api("body").get(0)?.children ?? [])
      : (api.root().get(0)?.children ?? []);

  for (const child of rootChildren) {
    state = processNode(state, pdfDoc, api, child);
  }

  return pdfDoc.save();
}
