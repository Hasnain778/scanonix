import { LazyImageResizerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-resizer");

export default function ImageResizerPage() {
  return (
    <ToolRoute
      toolId="image-resizer"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyImageResizerTool />
    </ToolRoute>
  );
}
