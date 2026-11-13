import { LazyPngToPsdTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("png-to-psd");

export default function PngToPsdPage() {
  return (
    <ToolRoute
      toolId="png-to-psd"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyPngToPsdTool />
    </ToolRoute>
  );
}
