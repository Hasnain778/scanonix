import { LazyUnlockPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";
import "@/styles/unlock-pdf-prototype.css";

export const metadata = createToolPageMetadata("unlock-pdf");

export default function UnlockPdfPage() {
  return (
    <ToolRoute
      toolId="unlock-pdf"
      icon={<ToolIcon type="unlock-pdf" className="h-7 w-7" />}
      seoVariant="editorial"
      headerCompact
      usageTone="quiet"
      editorialIntro={{
        eyebrow: "About unlocking PDFs",
        heading: "Open a file you already have the password for",
      }}
    >
      <LazyUnlockPdfTool />
    </ToolRoute>
  );
}
