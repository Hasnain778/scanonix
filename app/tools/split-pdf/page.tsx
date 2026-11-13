import { LazySplitPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("split-pdf");

export default function SplitPdfPage() {
  return (
    <ToolRoute
      toolId="split-pdf"
      headerDensity="app"
      headerDescription="Extract pages from a PDF or divide a document into smaller files with Scanonix."
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazySplitPdfTool />
    </ToolRoute>
  );
}
