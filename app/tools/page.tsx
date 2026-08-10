import { LazyToolsDirectory } from "@/components/tools/lazy";
import { ToolLayout, ToolShell } from "@/components/workspace";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "All Online PDF, Image & AI Document Tools | Scanonix",
  description:
    "Browse free online PDF, image, and AI document tools. Merge, split, compress, convert, OCR, translate, and edit files in one place.",
  path: "/tools",
  keywords: [
    "online PDF tools",
    "document tools",
    "OCR online",
    "image converter",
    "Scanonix tools",
    "PDF merge",
    "PDF split",
    "PDF to Word",
    "background remover",
    "QR scanner",
  ],
});

export default function ToolsPage() {
  return (
    <ToolShell>
      <ToolLayout>
        <LazyToolsDirectory />
      </ToolLayout>
    </ToolShell>
  );
}
