import { LazyPdfToImageTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("pdf-to-image");

export default function PdfToImagePage() {
  return (
    <ToolRoute
      toolId="pdf-to-image"
      icon={<ToolIcon type="pdf-image" className="h-7 w-7" />}
    >
      <LazyPdfToImageTool />
    </ToolRoute>
  );
}
