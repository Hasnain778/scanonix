import { LazyImageResizerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-resizer");

export default function ImageResizerPage() {
  return (
    <ToolRoute
      toolId="image-resizer"
      icon={<ToolIcon type="convert" className="h-7 w-7" />}
    >
      <LazyImageResizerTool />
    </ToolRoute>
  );
}
