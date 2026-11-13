import { LazyCropPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("crop-pdf");

export default function CropPdfPage() {
  return (
    <ToolRoute
      toolId="crop-pdf"
      headerDensity="app"
      headerDescription="Choose the area of each page to keep."
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyCropPdfTool />
    </ToolRoute>
  );
}
