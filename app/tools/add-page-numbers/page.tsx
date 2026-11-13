import { LazyAddPageNumbersTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("add-page-numbers");

export default function AddPageNumbersPage() {
  return (
    <ToolRoute
      toolId="add-page-numbers"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyAddPageNumbersTool />
    </ToolRoute>
  );
}
