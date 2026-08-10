import { LazyMergePdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("merge-pdf");

export default function MergePdfPage() {
  return (
    <ToolRoute
      toolId="merge-pdf"
      icon={<ToolIcon type="merge" className="h-7 w-7" />}
    >
      <LazyMergePdfTool />
    </ToolRoute>
  );
}
