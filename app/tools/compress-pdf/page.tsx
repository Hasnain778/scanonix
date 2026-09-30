import { LazyCompressPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";
import "@/styles/compress-pdf-prototype.css";

export const metadata = createToolPageMetadata("compress-pdf");

export default function CompressPdfPage() {
  return (
    <ToolRoute
      toolId="compress-pdf"
      icon={<ToolIcon type="compress" className="h-7 w-7" />}
      seoVariant="editorial"
      headerCompact
      usageTone="quiet"
      editorialIntro={{
        eyebrow: "About compression",
        heading: "A smaller file, only when the original can shrink",
      }}
    >
      <LazyCompressPdfTool />
    </ToolRoute>
  );
}
