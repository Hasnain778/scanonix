import { LazyUnlockPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("unlock-pdf");

export default function UnlockPdfPage() {
  return (
    <ToolRoute
      toolId="unlock-pdf"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyUnlockPdfTool />
    </ToolRoute>
  );
}
