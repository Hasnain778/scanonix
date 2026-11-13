import { LazyQrScannerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("qr-scanner");

export default function QrScannerPage() {
  return (
    <ToolRoute
      toolId="qr-scanner"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyQrScannerTool />
    </ToolRoute>
  );
}
