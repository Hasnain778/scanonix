import { LazyImageToPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-to-pdf");

export default function ImageToPdfPage() {
  return (
    <ToolRoute
      toolId="image-to-pdf"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyImageToPdfTool />
    </ToolRoute>
  );
}
