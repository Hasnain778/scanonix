import { ImageToolsHub } from "@/components/image-tools/ImageToolsHub";
import { ToolLayout, ToolShell } from "@/components/workspace";
import { ToolSeoContent } from "@/components/workspace/ToolSeoContent";
import { env } from "@/config/env";
import {
  createBreadcrumbJsonLd,
  createFaqJsonLd,
  createToolJsonLd,
} from "@/lib/utils/seo";
import { createToolPageMetadata } from "@/lib/utils/tool-page";
import { getToolSeo } from "@/constants/tool-seo";

export const metadata = createToolPageMetadata("image");

export default function ImageToolsPage() {
  const tool = getToolSeo("image");
  const structuredData = createToolJsonLd({
    name: tool.h1,
    description: tool.metaDescription,
    url: `${env.siteUrl}${tool.path}`,
  });
  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: "Home", url: env.siteUrl },
    { name: "Tools", url: `${env.siteUrl}/tools` },
    { name: tool.h1, url: `${env.siteUrl}${tool.path}` },
  ]);
  const faqJsonLd = createFaqJsonLd(tool.faqs);

  return (
    <ToolShell>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(structuredData) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbJsonLd) }}
      />
      {faqJsonLd ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{ __html: JSON.stringify(faqJsonLd) }}
        />
      ) : null}
      <ToolLayout maxWidth="6xl">
        <ImageToolsHub />
        <ToolSeoContent toolId="image" />
      </ToolLayout>
    </ToolShell>
  );
}
