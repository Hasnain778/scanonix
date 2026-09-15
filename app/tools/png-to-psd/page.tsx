import { LazyPngToPsdTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("png-to-psd");

export default function PngToPsdPage() {
  return (
    <ToolRoute
      toolId="png-to-psd"
      icon={<ToolIcon type="convert" className="h-7 w-7" />}
    >
      <LazyPngToPsdTool />
    </ToolRoute>
  );
}
