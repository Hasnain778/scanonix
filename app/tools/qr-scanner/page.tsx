import { LazyQrScannerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("qr-scanner");

export default function QrScannerPage() {
  return (
    <ToolRoute
      toolId="qr-scanner"
      icon={<ToolIcon type="qr" className="h-5 w-5" />}
      headerCompact
      usageTone="quiet"
    >
      <LazyQrScannerTool />
    </ToolRoute>
  );
}
