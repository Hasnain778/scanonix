import { LazyUnlockPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("unlock-pdf");

export default function UnlockPdfPage() {
  return (
    <ToolRoute
      toolId="unlock-pdf"
      icon={<ToolIcon type="compress" className="h-7 w-7" />}
    >
      <LazyUnlockPdfTool />
    </ToolRoute>
  );
}
