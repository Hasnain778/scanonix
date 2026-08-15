import { LazyFillPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("fill-pdf");

export default function FillPdfPage() {
  return (
    <ToolRoute
      toolId="fill-pdf"
      icon={<ToolIcon type="fill-pdf" className="h-7 w-7" />}
    >
      <LazyFillPdfTool />
    </ToolRoute>
  );
}
