import { LazyRotatePdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("rotate-pdf");

export default function RotatePdfPage() {
  return (
    <ToolRoute
      toolId="rotate-pdf"
      icon={<ToolIcon type="rotate-pdf" className="h-7 w-7" />}
    >
      <LazyRotatePdfTool />
    </ToolRoute>
  );
}
