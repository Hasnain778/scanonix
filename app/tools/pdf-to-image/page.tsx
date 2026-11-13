import { LazyPdfToImageTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("pdf-to-image");

export default function PdfToImagePage() {
  return (
    <ToolRoute
      toolId="pdf-to-image"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyPdfToImageTool />
    </ToolRoute>
  );
}
