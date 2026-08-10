import { LazyImageToPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-to-pdf");

export default function ImageToPdfPage() {
  return (
    <ToolRoute
      toolId="image-to-pdf"
      icon={<ToolIcon type="image-pdf" className="h-7 w-7" />}
    >
      <LazyImageToPdfTool />
    </ToolRoute>
  );
}
