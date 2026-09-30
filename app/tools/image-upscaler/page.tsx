import { LazyImageUpscalerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-upscaler");

export default function ImageUpscalerPage() {
  return (
    <ToolRoute
      toolId="image-upscaler"
      icon={<ToolIcon type="image-upscale" className="h-5 w-5" />}
      headerCompact
      usageTone="quiet"
    >
      <LazyImageUpscalerTool />
    </ToolRoute>
  );
}
