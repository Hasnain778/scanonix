import { LazyAiTranslateTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("ai-translate");

export default function AiTranslatePage() {
  return (
    <ToolRoute
      toolId="ai-translate"
      icon={<ToolIcon type="convert" className="h-7 w-7" />}
    >
      <LazyAiTranslateTool />
    </ToolRoute>
  );
}
