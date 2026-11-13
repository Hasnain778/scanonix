import { LazyOrganizePdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("organize-pdf");

export default function OrganizePdfPage() {
  return (
    <ToolRoute
      toolId="organize-pdf"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyOrganizePdfTool />
    </ToolRoute>
  );
}
