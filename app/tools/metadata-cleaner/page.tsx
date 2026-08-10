import { LazyMetadataCleanerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("metadata-cleaner");

export default function MetadataCleanerPage() {
  return (
    <ToolRoute
      toolId="metadata-cleaner"
      icon={<ToolIcon type="security" className="h-7 w-7" />}
    >
      <LazyMetadataCleanerTool />
    </ToolRoute>
  );
}
