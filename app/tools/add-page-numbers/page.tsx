import { LazyAddPageNumbersTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("add-page-numbers");

export default function AddPageNumbersPage() {
  return (
    <ToolRoute
      toolId="add-page-numbers"
      icon={<ToolIcon type="add-page-numbers" className="h-7 w-7" />}
    >
      <LazyAddPageNumbersTool />
    </ToolRoute>
  );
}
