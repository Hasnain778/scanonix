import { LazyProtectPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("protect-pdf");

export default function ProtectPdfPage() {
  return (
    <ToolRoute
      toolId="protect-pdf"
      icon={<ToolIcon type="compress" className="h-7 w-7" />}
    >
      <LazyProtectPdfTool />
    </ToolRoute>
  );
}
