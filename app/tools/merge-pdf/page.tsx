import { LazyMergePdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";
import "@/styles/merge-pdf-prototype.css";

export const metadata = createToolPageMetadata("merge-pdf");

export default function MergePdfPage() {
  return (
    <ToolRoute
      toolId="merge-pdf"
      icon={<ToolIcon type="merge" className="h-7 w-7" />}
      seoVariant="editorial"
      headerCompact
      usageTone="quiet"
      editorialIntro={{
        eyebrow: "About merging PDFs",
        heading: "One document from several PDFs",
      }}
    >
      <LazyMergePdfTool />
    </ToolRoute>
  );
}
