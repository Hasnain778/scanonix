import { LazyAiSummaryTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("ai-summary");

export default function AiSummaryPage() {
  return (
    <ToolRoute
      toolId="ai-summary"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyAiSummaryTool />
    </ToolRoute>
  );
}
