import { type ReactNode } from "react";
import { ToolUsageHeader } from "@/components/plan/ToolUsageHeader";
import { getToolById, HOMEPAGE_CATEGORY_META } from "@/constants/homepage-tools";
import { getToolSeo } from "@/constants/tool-seo";
import { env } from "@/config/env";
import { getCategoryBreadcrumbHref } from "@/lib/navigation/category-hub-urls";
import {
  createBreadcrumbJsonLd,
  createFaqJsonLd,
  createToolJsonLd,
} from "@/lib/utils/seo";
import { ToolSeoContent } from "./ToolSeoContent";
import { ToolLayout, ToolPageHeader, ToolShell } from "./ToolShell";

interface ToolRouteProps {
  toolId: string;
  icon?: ReactNode;
  children: ReactNode;
  showSeoContent?: boolean;
  jsonLd?: ReactNode;
}

export function ToolRoute({
  toolId,
  icon,
  children,
  showSeoContent = true,
  jsonLd,
}: ToolRouteProps) {
  const tool = getToolSeo(toolId);
  const homepageTool = getToolById(toolId);
  const categoryMeta = homepageTool
    ? HOMEPAGE_CATEGORY_META[homepageTool.category]
    : undefined;
  const categoryBreadcrumb = categoryMeta
    ? {
        label: categoryMeta.heading,
        href: getCategoryBreadcrumbHref(homepageTool!.category),
      }
    : undefined;
  const breadcrumbItems = [
    { name: "Home", url: env.siteUrl },
    { name: "Tools", url: `${env.siteUrl}/tools` },
    ...(categoryMeta
      ? [
          {
            name: categoryMeta.heading,
            url: `${env.siteUrl}${getCategoryBreadcrumbHref(homepageTool!.category)}`,
          },
        ]
      : []),
    { name: tool.h1, url: `${env.siteUrl}${tool.path}` },
  ];
  const defaultJsonLd = (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(
            createToolJsonLd({
              name: tool.h1,
              description: tool.metaDescription,
              url: `${env.siteUrl}${tool.path}`,
            }),
          ),
        }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify(createBreadcrumbJsonLd(breadcrumbItems)),
        }}
      />
      {createFaqJsonLd(tool.faqs) ? (
        <script
          type="application/ld+json"
          dangerouslySetInnerHTML={{
            __html: JSON.stringify(createFaqJsonLd(tool.faqs)),
          }}
        />
      ) : null}
    </>
  );

  return (
    <ToolShell>
      {jsonLd ?? defaultJsonLd}
      <ToolLayout>
        <ToolPageHeader
          title={tool.h1}
          description={tool.headerDescription ?? tool.pageDescription}
          icon={icon}
          showBreadcrumbs
          categoryBreadcrumb={categoryBreadcrumb}
        />
        <ToolUsageHeader />
        {children}
        {showSeoContent ? <ToolSeoContent toolId={toolId} /> : null}
      </ToolLayout>
    </ToolShell>
  );
}
