import { LazyRedactPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("redact-pdf");

export default function RedactPdfPage() {
  return (
    <ToolRoute
      toolId="redact-pdf"
      icon={<ToolIcon type="word" className="h-7 w-7" />}
    >
      <LazyRedactPdfTool />
    </ToolRoute>
  );
}
