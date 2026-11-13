import { LazyFillPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("fill-pdf");

export default function FillPdfPage() {
  return (
    <ToolRoute
      toolId="fill-pdf"
      headerDensity="app"
      headerDescription="Edit the fields on an interactive PDF form."
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyFillPdfTool />
    </ToolRoute>
  );
}
