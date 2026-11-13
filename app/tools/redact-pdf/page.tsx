import { LazyRedactPdfProClientTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("redact-pdf");

export default function RedactPdfPage() {
  return (
    <ToolRoute
      toolId="redact-pdf"
      headerDensity="app"
      headerDescription="Mark the areas that should be permanently hidden."
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyRedactPdfProClientTool />
    </ToolRoute>
  );
}
