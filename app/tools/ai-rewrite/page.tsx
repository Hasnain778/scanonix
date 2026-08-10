import { LazyAiRewriteTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("ai-rewrite");

export default function AiRewritePage() {
  return (
    <ToolRoute
      toolId="ai-rewrite"
      icon={<ToolIcon type="ocr" className="h-7 w-7" />}
    >
      <LazyAiRewriteTool />
    </ToolRoute>
  );
}
