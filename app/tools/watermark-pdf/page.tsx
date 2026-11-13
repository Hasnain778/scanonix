import { LazyWatermarkPdfClientTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("watermark-pdf");

export default function WatermarkPdfPage() {
  return (
    <ToolRoute
      toolId="watermark-pdf"
      headerDensity="app"
      headerDescription="Place a text or image mark on selected pages."
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyWatermarkPdfClientTool />
    </ToolRoute>
  );
}
