import { LazyImageToSvgTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-to-svg");

export default function ImageToSvgPage() {
  return (
    <ToolRoute
      toolId="image-to-svg"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyImageToSvgTool />
    </ToolRoute>
  );
}
