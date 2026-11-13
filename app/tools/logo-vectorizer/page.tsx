import { LazyLogoVectorizerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("logo-vectorizer");

export default function LogoVectorizerPage() {
  return (
    <ToolRoute
      toolId="logo-vectorizer"
      headerDensity="app"
      usageTone="quiet"
      seoVariant="quiet"
    >
      <LazyLogoVectorizerTool />
    </ToolRoute>
  );
}
