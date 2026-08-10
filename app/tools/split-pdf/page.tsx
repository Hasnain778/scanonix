import { LazySplitPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("split-pdf");

export default function SplitPdfPage() {
  return (
    <ToolRoute
      toolId="split-pdf"
      icon={<ToolIcon type="split" className="h-7 w-7" />}
    >
      <LazySplitPdfTool />
    </ToolRoute>
  );
}
