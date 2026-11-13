import { LazySignPdfTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("sign-pdf");

export default function SignPdfPage() {
  return (
    <ToolRoute
      toolId="sign-pdf"
      headerDensity="app"
      headerDescription="Draw, type, or place a signature on any page."
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazySignPdfTool />
    </ToolRoute>
  );
}
