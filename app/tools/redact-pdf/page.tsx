import { LazyRedactPdfTool } from "@/components/tools/lazy";
import { ToolLaunchUnavailable } from "@/components/tools/ToolLaunchUnavailable";
import { ToolRoute } from "@/components/workspace";
import { ToolIcon } from "@/components/ui/ToolIcon";
import { isPdfRedactionConfigured } from "@/config/env";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("redact-pdf");

export default function RedactPdfPage() {
  const isAvailable = isPdfRedactionConfigured();

  return (
    <ToolRoute
      toolId="redact-pdf"
      icon={<ToolIcon type="word" className="h-7 w-7" />}
    >
      {isAvailable ? (
        <LazyRedactPdfTool />
      ) : (
        <ToolLaunchUnavailable
          title="Redact PDF temporarily unavailable"
          message="Secure PDF redaction is not available on this deployment yet. Protect PDF, Watermark PDF, and Metadata Cleaner remain available."
        />
      )}
    </ToolRoute>
  );
}
