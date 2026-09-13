import { LazyRasterToVectorTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("raster-to-vector");

export default function RasterToVectorPage() {
  return (
    <ToolRoute
      toolId="raster-to-vector"
      icon={<ToolIcon type="convert" className="h-7 w-7" />}
    >
      <LazyRasterToVectorTool />
    </ToolRoute>
  );
}
