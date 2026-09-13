import { LazyLogoVectorizerTool } from "@/components/tools/lazy";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("logo-vectorizer");

export default function LogoVectorizerPage() {
  return (
    <ToolRoute
      toolId="logo-vectorizer"
      icon={<ToolIcon type="convert" className="h-7 w-7" />}
    >
      <LazyLogoVectorizerTool />
    </ToolRoute>
  );
}
