import { LazyCropPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("crop-pdf");

export default function CropPdfPage() {
  return (
    <ToolRoute
      toolId="crop-pdf"
      icon={<ToolIcon type="crop-pdf" className="h-7 w-7" />}
    >
      <LazyCropPdfTool />
    </ToolRoute>
  );
}
