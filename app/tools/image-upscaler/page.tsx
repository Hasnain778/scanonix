import { LazyImageUpscalerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-upscaler");

export default function ImageUpscalerPage() {
  return (
    <ToolRoute
      toolId="image-upscaler"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyImageUpscalerTool />
    </ToolRoute>
  );
}
