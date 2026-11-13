import { LazyJpgToPsdTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("jpg-to-psd");

export default function JpgToPsdPage() {
  return (
    <ToolRoute
      toolId="jpg-to-psd"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyJpgToPsdTool />
    </ToolRoute>
  );
}
