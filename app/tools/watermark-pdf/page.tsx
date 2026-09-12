import { LazyWatermarkPdfClientTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("watermark-pdf");

export default function WatermarkPdfPage() {
  return (
    <ToolRoute
      toolId="watermark-pdf"
      icon={<ToolIcon type="watermark-pdf" className="h-7 w-7" />}
    >
      <LazyWatermarkPdfClientTool />
    </ToolRoute>
  );
}
