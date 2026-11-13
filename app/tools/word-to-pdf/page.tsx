import { LazyWordToPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("word-to-pdf");

export default function WordToPdfPage() {
  return (
    <ToolRoute
      toolId="word-to-pdf"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyWordToPdfTool />
    </ToolRoute>
  );
}
