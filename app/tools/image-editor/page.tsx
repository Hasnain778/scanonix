import { ImageEditorPageFrame } from "@/components/image-editor/ImageEditorPageFrame";
import { ImageEditorWorkspace } from "@/components/image-editor/ImageEditorWorkspace";
import { getToolById, HOMEPAGE_CATEGORY_META } from "@/constants/homepage-tools";
import { getToolSeo } from "@/constants/tool-seo";
import { env } from "@/config/env";
import { getCategoryBreadcrumbHref } from "@/lib/navigation/category-hub-urls";
import { createBreadcrumbJsonLd, createToolJsonLd } from "@/lib/utils/seo";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("image-editor");

/**
 * Canonical public Image Editor.
 * Full-viewport application shell — no site footer or below-fold SEO chrome.
 * Tool and breadcrumb JSON-LD only. FAQ schema stays absent because the FAQs are not rendered.
 */
export default function ImageEditorPage() {
  const tool = getToolSeo("image-editor");
  const homepageTool = getToolById("image-editor");
  const categoryMeta = homepageTool
    ? HOMEPAGE_CATEGORY_META[homepageTool.category]
    : undefined;
  const structuredData = createToolJsonLd({
    name: tool.h1,
    description: tool.metaDescription,
    url: `${env.siteUrl}${tool.path}`,
  });
  const breadcrumbJsonLd = createBreadcrumbJsonLd([
    { name: "Home", url: env.siteUrl },
    { name: "Tools", url: `${env.siteUrl}/tools` },
    ...(categoryMeta && homepageTool
      ? [
          {
            name: categoryMeta.heading,
            url: `${env.siteUrl}${getCategoryBreadcrumbHref(homepageTool.category)}`,
          },
        ]
      : []),
    { name: tool.h1, url: `${env.siteUrl}${tool.path}` },
  ]);

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
      <ImageEditorPageFrame>
        <ImageEditorWorkspace />
      </ImageEditorPageFrame>
    </>
  );
}
