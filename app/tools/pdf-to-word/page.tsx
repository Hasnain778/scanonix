import { LazyPdfToWordTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("pdf-to-word");

export default function PdfToWordPage() {
  return (
    <ToolRoute
      toolId="pdf-to-word"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyPdfToWordTool />
    </ToolRoute>
  );
}
