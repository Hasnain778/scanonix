import { LazyJpgToPsdTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("jpg-to-psd");

export default function JpgToPsdPage() {
  return (
    <ToolRoute
      toolId="jpg-to-psd"
      icon={<ToolIcon type="convert" className="h-7 w-7" />}
    >
      <LazyJpgToPsdTool />
    </ToolRoute>
  );
}
