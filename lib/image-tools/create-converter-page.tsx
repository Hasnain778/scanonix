import type { Metadata } from "next";
import { FileImage } from "lucide-react";
import type { ImageConverterDefinition } from "@/constants/image-tools";
import { getToolSeo } from "@/constants/tool-seo";
import { ConverterToolExtras } from "@/components/image-tools/ConverterToolExtras";
import { ImageFormatConverterTool } from "@/components/image-tools/ImageFormatConverterTool";
import { ToolRoute } from "@/components/workspace";
import { env } from "@/config/env";
import { IMAGE_TOOLS_HUB_PATH } from "@/lib/navigation/category-hub-urls";
import {
  createBreadcrumbJsonLd,
  createFaqJsonLd,
  createToolJsonLd,
} from "@/lib/utils/seo";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export function createImageConverterMetadata(config: ImageConverterDefinition): Metadata {
  return createToolPageMetadata(config.slug);
}

function ConverterJsonLd({ config }: { config: ImageConverterDefinition }) {
  const path = `/tools/${config.slug}`;
  const structuredData = createToolJsonLd({
    name: config.title,
    description: config.metaDescription,
    url: `${env.siteUrl}${path}`,
  });
  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: "Home", url: env.siteUrl },
    { name: "Tools", url: `${env.siteUrl}/tools` },
    { name: "Image Tools", url: `${env.siteUrl}${IMAGE_TOOLS_HUB_PATH}` },
    { name: config.title, url: `${env.siteUrl}${path}` },
  ]);
  const faqJsonLd = createFaqJsonLd(getToolSeo(config.slug).faqs);

  return (
    <>
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
    </>
  );
}

export function createImageConverterPage(config: ImageConverterDefinition) {
  return function ImageConverterPage() {
    return (
      <ToolRoute
        toolId={config.slug}
        icon={<FileImage className="h-7 w-7" strokeWidth={1.75} aria-hidden="true" />}
        showSeoContent
        jsonLd={<ConverterJsonLd config={config} />}
      >
        <ImageFormatConverterTool config={config} />
        <ConverterToolExtras config={config} />
      </ToolRoute>
    );
  };
}
