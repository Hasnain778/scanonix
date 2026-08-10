import { LazyOcrTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("ocr");

export default function OcrPage() {
  return (
    <ToolRoute
      toolId="ocr"
      icon={<ToolIcon type="ocr" className="h-7 w-7" />}
    >
      <LazyOcrTool />
    </ToolRoute>
  );
}
