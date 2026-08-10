import { LazyWordToPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("word-to-pdf");

export default function WordToPdfPage() {
  return (
    <ToolRoute
      toolId="word-to-pdf"
      icon={<ToolIcon type="word" className="h-7 w-7" />}
    >
      <LazyWordToPdfTool />
    </ToolRoute>
  );
}
