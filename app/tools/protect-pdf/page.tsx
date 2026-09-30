import { LazyProtectPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";
import "@/styles/protect-pdf-prototype.css";

export const metadata = createToolPageMetadata("protect-pdf");

export default function ProtectPdfPage() {
  return (
    <ToolRoute
      toolId="protect-pdf"
      icon={<ToolIcon type="protect-pdf" className="h-7 w-7" />}
      seoVariant="editorial"
      headerCompact
      usageTone="quiet"
      editorialIntro={{
        eyebrow: "About password protection",
        heading: "A password before the file is shared",
      }}
    >
      <LazyProtectPdfTool />
    </ToolRoute>
  );
}
