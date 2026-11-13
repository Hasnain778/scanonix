import { LazyMergePdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("merge-pdf");

export default function MergePdfPage() {
  return (
    <ToolRoute
      toolId="merge-pdf"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyMergePdfTool />
    </ToolRoute>
  );
}
