import { LazyBackgroundRemoverTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("background-remover");

export default function BackgroundRemoverPage() {
  return (
    <ToolRoute
      toolId="background-remover"
      icon={<ToolIcon type="bg-remove" className="h-7 w-7" />}
    >
      <LazyBackgroundRemoverTool />
    </ToolRoute>
  );
}
