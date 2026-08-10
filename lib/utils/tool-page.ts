import { getToolSeo } from "@/constants/tool-seo";
import { createPageMetadata } from "@/lib/utils/seo";

export function createToolPageMetadata(toolId: string) {
  const tool = getToolSeo(toolId);

  return createPageMetadata({
    title: tool.seoTitle,
    description: tool.metaDescription,
    path: tool.path,
    keywords: tool.keywords,
    type: "website",
  });
}

/** @deprecated Pass a toolId instead of manual options. */
export function createToolPageMetadataFromOptions(options: {
  title: string;
  description: string;
  path: string;
  keywords?: string[];
}) {
  return createPageMetadata({
    title: options.title,
    description: options.description,
    path: options.path,
    keywords: options.keywords,
    type: "website",
  });
}
