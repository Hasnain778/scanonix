import { LazyAiSummaryTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("ai-summary");

export default function AiSummaryPage() {
  return (
    <ToolRoute
      toolId="ai-summary"
      icon={<ToolIcon type="ocr" className="h-7 w-7" />}
    >
      <LazyAiSummaryTool />
    </ToolRoute>
  );
}
