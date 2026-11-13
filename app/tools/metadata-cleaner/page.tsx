import { LazyMetadataCleanerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("metadata-cleaner");

export default function MetadataCleanerPage() {
  return (
    <ToolRoute
      toolId="metadata-cleaner"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyMetadataCleanerTool />
    </ToolRoute>
  );
}
