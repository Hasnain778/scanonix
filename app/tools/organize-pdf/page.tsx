import { LazyOrganizePdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("organize-pdf");

export default function OrganizePdfPage() {
  return (
    <ToolRoute
      toolId="organize-pdf"
      icon={<ToolIcon type="organize-pdf" className="h-7 w-7" />}
    >
      <LazyOrganizePdfTool />
    </ToolRoute>
  );
}
