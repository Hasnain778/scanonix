import { LazyRasterToVectorTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("raster-to-vector");

export default function RasterToVectorPage() {
  return (
    <ToolRoute
      toolId="raster-to-vector"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyRasterToVectorTool />
    </ToolRoute>
  );
}
