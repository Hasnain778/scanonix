import { LazyQrScannerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("qr-scanner");

export default function QrScannerPage() {
  return (
    <ToolRoute
      toolId="qr-scanner"
      icon={<ToolIcon type="qr" className="h-7 w-7" />}
    >
      <LazyQrScannerTool />
    </ToolRoute>
  );
}
