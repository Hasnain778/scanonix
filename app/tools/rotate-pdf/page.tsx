import { LazyRotatePdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("rotate-pdf");

export default function RotatePdfPage() {
  return (
    <ToolRoute
      toolId="rotate-pdf"
      headerDensity="app"
      headerDescription="Rotate PDF pages by 90°, 180°, or 270°."
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyRotatePdfTool />
    </ToolRoute>
  );
}
