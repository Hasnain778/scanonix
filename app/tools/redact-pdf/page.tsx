import { LazyRedactPdfProClientTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("redact-pdf");

export default function RedactPdfPage() {
  return (
    <ToolRoute
      toolId="redact-pdf"
      icon={<ToolIcon type="redact-pdf" className="h-5 w-5" />}
      headerCompact
      usageTone="quiet"
    >
      <LazyRedactPdfProClientTool />
    </ToolRoute>
  );
}
