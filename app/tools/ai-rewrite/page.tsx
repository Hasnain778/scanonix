import { LazyAiRewriteTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("ai-rewrite");

export default function AiRewritePage() {
  return (
    <ToolRoute
      toolId="ai-rewrite"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyAiRewriteTool />
    </ToolRoute>
  );
}
