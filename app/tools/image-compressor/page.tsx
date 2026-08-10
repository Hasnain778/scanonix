import { LazyImageCompressorTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-compressor");

export default function ImageCompressorPage() {
  return (
    <ToolRoute
      toolId="image-compressor"
      icon={<ToolIcon type="compress" className="h-7 w-7" />}
    >
      <LazyImageCompressorTool />
    </ToolRoute>
  );
}
