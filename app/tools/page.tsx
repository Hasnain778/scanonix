import { Suspense } from "react";
import { ToolsDirectoryHeroHeader } from "@/components/tools/directory/ToolsDirectoryHeroHeader";
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

function ToolsDirectoryControlsFallback() {
  return (
    <div className="py-8 text-center text-sm text-scanonix-muted">
      Loading tools directory…
    </div>
  );
}

export default function ToolsPage() {
  return (
    <ToolShell>
      <ToolLayout>
        <div className="tools-directory-page space-y-8 sm:space-y-10">
          <div className="tools-directory-hero-zone">
            <ToolsDirectoryHeroHeader />
            <Suspense fallback={<ToolsDirectoryControlsFallback />}>
              <LazyToolsDirectory />
            </Suspense>
          </div>
        </div>
      </ToolLayout>
    </ToolShell>
  );
}
