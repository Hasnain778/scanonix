import { LazyProtectPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("protect-pdf");

export default function ProtectPdfPage() {
  return (
    <ToolRoute
      toolId="protect-pdf"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyProtectPdfTool />
    </ToolRoute>
  );
}
