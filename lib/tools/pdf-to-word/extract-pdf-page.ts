import type { TextItem } from "pdfjs-dist/types/src/display/api";
import type { ContentBlock, TextLine } from "./types";
import { linesToBlocks, plainTextToBlocks } from "./text-structure";

const MIN_NATIVE_TEXT_CHARS = 20;

function getFontSize(transform: number[], height: number): number {
  const scale = Math.hypot(transform[0] ?? 0, transform[1] ?? 0);
  return scale > 0 ? scale : height || 12;
}

function groupFragmentsIntoLines(items: TextItem[]): TextLine[] {
  const fragments = items
    .filter((item) => item.str.trim().length > 0)
    .map((item) => ({
      text: item.str,
      x: item.transform[4] ?? 0,
      y: item.transform[5] ?? 0,
      width: item.width,
      fontSize: getFontSize(item.transform, item.height),
    }));

  if (fragments.length === 0) {
    return [];
  }

  fragments.sort((a, b) => {
    const yTolerance = Math.min(a.fontSize, b.fontSize) * 0.45;
    if (Math.abs(b.y - a.y) > yTolerance) {
      return b.y - a.y;
    }
    return a.x - b.x;
  });

  const lineGroups: {
    y: number;
    fontSize: number;
    fragments: typeof fragments;
  }[] = [];

  for (const fragment of fragments) {
    const existingLine = lineGroups.find(
      (line) =>
        Math.abs(line.y - fragment.y) <=
        Math.max(line.fontSize, fragment.fontSize) * 0.4,
    );

    if (existingLine) {
      existingLine.fragments.push(fragment);
      existingLine.fontSize = Math.max(existingLine.fontSize, fragment.fontSize);
    } else {
      lineGroups.push({
        y: fragment.y,
        fontSize: fragment.fontSize,
        fragments: [fragment],
      });
    }
  }

  lineGroups.sort((a, b) => b.y - a.y);

  return lineGroups
    .map((line) => {
      line.fragments.sort((a, b) => a.x - b.x);

      let text = "";
      let previousEndX = 0;

      for (const fragment of line.fragments) {
        if (text) {
          const gap = fragment.x - previousEndX;
          if (gap > fragment.fontSize * 0.2) {
            text += " ";
          }
        }
        text += fragment.text;
        previousEndX = fragment.x + (fragment.width || fragment.text.length * fragment.fontSize * 0.45);
      }

      return {
        text: text.trim(),
        y: line.y,
        fontSize: line.fontSize,
      };
    })
    .filter((line) => line.text.length > 0);
}

function blocksToCharCount(blocks: ContentBlock[]): number {
  return blocks.reduce((total, block) => {
    switch (block.type) {
      case "heading":
      case "paragraph":
        return total + block.text.replace(/\s+/g, "").length;
      case "list":
        return (
          total +
          block.items.reduce(
            (listTotal, item) => listTotal + item.replace(/\s+/g, "").length,
            0,
          )
        );
    }
  }, 0);
}

type PdfPage = Awaited<
  ReturnType<Awaited<ReturnType<typeof import("../pdf-to-image/pdf-render").loadPdfDocument>>["getPage"]>
>;

export async function extractNativePageContent(
  page: PdfPage,
): Promise<{ blocks: ContentBlock[]; charCount: number }> {
  const textContent = await page.getTextContent();
  const items = textContent.items.filter(
    (item): item is TextItem => "str" in item,
  );

  const lines = groupFragmentsIntoLines(items);
  const blocks = linesToBlocks(lines);

  return {
    blocks,
    charCount: blocksToCharCount(blocks),
  };
}

export function ocrTextToBlocks(text: string): ContentBlock[] {
  return plainTextToBlocks(text);
}

export { MIN_NATIVE_TEXT_CHARS };
