import { LazyAiTranslateTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("ai-translate");

export default function AiTranslatePage() {
  return (
    <ToolRoute
      toolId="ai-translate"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyAiTranslateTool />
    </ToolRoute>
  );
}
