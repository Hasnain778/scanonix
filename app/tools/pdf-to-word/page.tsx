import { LazyPdfToWordTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("pdf-to-word");

export default function PdfToWordPage() {
  return (
    <ToolRoute
      toolId="pdf-to-word"
      icon={<ToolIcon type="word" className="h-7 w-7" />}
    >
      <LazyPdfToWordTool />
    </ToolRoute>
  );
}
