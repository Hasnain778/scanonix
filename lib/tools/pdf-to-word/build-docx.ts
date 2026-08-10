import {
  Document,
  HeadingLevel,
  Packer,
  PageBreak,
  Paragraph,
  TextRun,
} from "docx";
import type { ContentBlock, PageContent } from "./types";

function headingLevel(level: 1 | 2 | 3): (typeof HeadingLevel)[keyof typeof HeadingLevel] {
  switch (level) {
    case 1:
      return HeadingLevel.HEADING_1;
    case 2:
      return HeadingLevel.HEADING_2;
    case 3:
      return HeadingLevel.HEADING_3;
  }
}

function paragraphFromText(text: string): Paragraph {
  const parts = text.split("\n");

  if (parts.length === 1) {
    return new Paragraph({ children: [new TextRun({ text })] });
  }

  const children: TextRun[] = [];
  parts.forEach((part, index) => {
    children.push(new TextRun({ text: part }));
    if (index < parts.length - 1) {
      children.push(new TextRun({ break: 1 }));
    }
  });

  return new Paragraph({ children });
}

function blocksToParagraphs(blocks: ContentBlock[]): Paragraph[] {
  const paragraphs: Paragraph[] = [];

  for (const block of blocks) {
    switch (block.type) {
      case "heading":
        paragraphs.push(
          new Paragraph({
            text: block.text,
            heading: headingLevel(block.level),
          }),
        );
        break;
      case "paragraph":
        paragraphs.push(paragraphFromText(block.text));
        break;
      case "list":
        block.items.forEach((item, index) => {
          paragraphs.push(
            new Paragraph({
              children: [
                new TextRun({
                  text: block.ordered ? `${index + 1}. ${item}` : `• ${item}`,
                }),
              ],
              indent: { left: 720 },
            }),
          );
        });
        break;
    }
  }

  return paragraphs;
}

export async function buildDocxFromPages(pages: PageContent[]): Promise<Blob> {
  const children: Paragraph[] = [];

  pages.forEach((page, pageIndex) => {
    if (pages.length > 1 && pageIndex > 0) {
      children.push(new Paragraph({ children: [new PageBreak()] }));
    }

    if (pages.length > 1) {
      children.push(
        new Paragraph({
          text: `Page ${page.pageNumber}`,
          heading: HeadingLevel.HEADING_2,
        }),
      );
    }

    children.push(...blocksToParagraphs(page.blocks));
  });

  if (children.length === 0) {
    children.push(new Paragraph({ children: [new TextRun({ text: "" })] }));
  }

  const document = new Document({
    sections: [
      {
        properties: {},
        children,
      },
    ],
  });

  return Packer.toBlob(document);
}
