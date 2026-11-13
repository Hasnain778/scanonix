import { LazyImageCompressorTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-compressor");

export default function ImageCompressorPage() {
  return (
    <ToolRoute
      toolId="image-compressor"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyImageCompressorTool />
    </ToolRoute>
  );
}
