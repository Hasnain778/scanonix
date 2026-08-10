import type { ContentBlock, TextLine } from "./types";

const BULLET_PATTERN = /^([\u2022•\-\*])\s+(.+)$/;
const ORDERED_LIST_PATTERN = /^(\d+[\.\)])\s+(.+)$/;

function median(values: number[]): number {
  if (values.length === 0) return 12;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0
    ? (sorted[mid - 1] + sorted[mid]) / 2
    : sorted[mid];
}

function detectListItem(text: string): { ordered: boolean; item: string } | null {
  const bulletMatch = text.match(BULLET_PATTERN);
  if (bulletMatch) {
    return { ordered: false, item: bulletMatch[2].trim() };
  }

  const orderedMatch = text.match(ORDERED_LIST_PATTERN);
  if (orderedMatch) {
    return { ordered: true, item: orderedMatch[2].trim() };
  }

  return null;
}

export function linesToBlocks(lines: TextLine[]): ContentBlock[] {
  if (lines.length === 0) {
    return [];
  }

  const fontSizes = lines.map((line) => line.fontSize);
  const medianFontSize = median(fontSizes);
  const blocks: ContentBlock[] = [];
  let paragraphLines: string[] = [];
  let currentList: { items: string[]; ordered: boolean } | null = null;

  const flushParagraph = () => {
    if (paragraphLines.length === 0) return;
    blocks.push({
      type: "paragraph",
      text: paragraphLines.join("\n"),
    });
    paragraphLines = [];
  };

  const flushList = () => {
    if (!currentList) return;
    blocks.push({
      type: "list",
      items: currentList.items,
      ordered: currentList.ordered,
    });
    currentList = null;
  };

  for (let index = 0; index < lines.length; index++) {
    const line = lines[index];
    const previousLine = index > 0 ? lines[index - 1] : null;
    const verticalGap = previousLine ? previousLine.y - line.y : 0;
    const averageLineHeight =
      (line.fontSize + (previousLine?.fontSize ?? line.fontSize)) / 2;
    const isParagraphBreak =
      Boolean(previousLine) && verticalGap > averageLineHeight * 1.4;

    const listItem = detectListItem(line.text);
    if (listItem) {
      flushParagraph();
      if (!currentList || currentList.ordered !== listItem.ordered) {
        flushList();
        currentList = { items: [], ordered: listItem.ordered };
      }
      currentList.items.push(listItem.item);
      continue;
    }

    flushList();

    if (line.fontSize >= medianFontSize * 1.45 && line.text.length < 120) {
      flushParagraph();
      const level: 1 | 2 | 3 =
        line.fontSize >= medianFontSize * 1.8
          ? 1
          : line.fontSize >= medianFontSize * 1.6
            ? 2
            : 3;
      blocks.push({ type: "heading", text: line.text, level });
      continue;
    }

    if (isParagraphBreak) {
      flushParagraph();
    }

    paragraphLines.push(line.text);
  }

  flushList();
  flushParagraph();

  return blocks;
}

export function plainTextToBlocks(text: string): ContentBlock[] {
  const rawLines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (rawLines.length === 0) {
    return [];
  }

  const lines: TextLine[] = rawLines.map((lineText, index) => ({
    text: lineText,
    y: rawLines.length - index,
    fontSize: 12,
  }));

  return linesToBlocks(lines);
}

export function blocksToPlainText(blocks: ContentBlock[]): string {
  return blocks
    .map((block) => {
      switch (block.type) {
        case "heading":
          return block.text;
        case "paragraph":
          return block.text;
        case "list":
          return block.items
            .map((item, index) =>
              block.ordered ? `${index + 1}. ${item}` : `• ${item}`,
            )
            .join("\n");
      }
    })
    .join("\n\n")
    .trim();
}
