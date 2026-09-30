import { LazySignPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("sign-pdf");

export default function SignPdfPage() {
  return (
    <ToolRoute
      toolId="sign-pdf"
      icon={<ToolIcon type="sign-pdf" className="h-5 w-5" />}
      headerCompact
      usageTone="quiet"
    >
      <LazySignPdfTool />
    </ToolRoute>
  );
}
