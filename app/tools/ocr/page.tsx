import { LazyOcrTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("ocr");

export default function OcrPage() {
  return (
    <ToolRoute
      toolId="ocr"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyOcrTool />
    </ToolRoute>
  );
}
