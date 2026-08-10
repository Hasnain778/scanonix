import { LazyImageUpscalerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-upscaler");

export default function ImageUpscalerPage() {
  return (
    <ToolRoute
      toolId="image-upscaler"
      icon={<ToolIcon type="convert" className="h-7 w-7" />}
    >
      <LazyImageUpscalerTool />
    </ToolRoute>
  );
}
