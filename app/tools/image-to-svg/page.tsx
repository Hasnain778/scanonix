import { LazyImageToSvgTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-to-svg");

export default function ImageToSvgPage() {
  return (
    <ToolRoute
      toolId="image-to-svg"
      icon={<ToolIcon type="convert" className="h-7 w-7" />}
    >
      <LazyImageToSvgTool />
    </ToolRoute>
  );
}
