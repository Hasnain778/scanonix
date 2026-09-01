import { ToolsDirectory } from "@/components/tools/directory/ToolsDirectory";
import { ToolsDirectoryHeroHeader } from "@/components/tools/directory/ToolsDirectoryHeroHeader";
import { ToolLayout, ToolShell } from "@/components/workspace";
import { parseToolsCategoryParam } from "@/lib/navigation/tool-category-urls";
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

export default async function ToolsPage({
  searchParams,
}: {
  searchParams: Promise<{ category?: string }>;
}) {
  const params = await searchParams;
  const initialCategory = parseToolsCategoryParam(params.category ?? null);

  return (
    <ToolShell>
      <div className="tools-directory-shell">
        <ToolLayout>
          <div className="tools-directory-page space-y-8 sm:space-y-10">
            <div className="tools-directory-hero-zone">
              <ToolsDirectoryHeroHeader />
              <ToolsDirectory initialCategory={initialCategory} />
            </div>
          </div>
        </ToolLayout>
      </div>
    </ToolShell>
  );
}
