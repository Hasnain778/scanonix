import { LazyCompressPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("compress-pdf");

export default function CompressPdfPage() {
  return (
    <ToolRoute
      toolId="compress-pdf"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyCompressPdfTool />
    </ToolRoute>
  );
}
