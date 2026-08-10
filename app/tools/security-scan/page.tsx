import { Suspense } from "react";
import { LazySecurityScanTool } from "@/components/tools/lazy";
import { LoadingState } from "@/components/common/LoadingState";
import { AppPageLayout } from "@/components/layout/AppPageLayout";
import { ToolSeoContent } from "@/components/workspace/ToolSeoContent";
import { ToolUsageHeader } from "@/components/plan/ToolUsageHeader";
import { ToolBreadcrumbs } from "@/components/ui/ToolBreadcrumbs";
import { env } from "@/config/env";
import { getToolSeo } from "@/constants/tool-seo";
import {
  createBreadcrumbJsonLd,
  createFaqJsonLd,
  createToolJsonLd,
} from "@/lib/utils/seo";
import { createToolPageMetadata } from "@/lib/utils/tool-page";

export const metadata = createToolPageMetadata("security-scan");

export default async function SecurityScanPage() {
  const tool = getToolSeo("security-scan");
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
    <AppPageLayout>
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
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <ToolBreadcrumbs title={tool.h1} />
        <header className="mb-8 max-w-3xl">
          <h1 className="text-3xl font-bold tracking-tight text-white sm:text-4xl">
            {tool.h1}
          </h1>
          <p className="mt-3 text-base leading-relaxed text-scanonix-muted sm:text-lg">
            {tool.pageDescription}
          </p>
        </header>
        <ToolUsageHeader />
        <Suspense
          fallback={
            <LoadingState
              title="Loading scanner…"
              description="Preparing your scan workspace."
            />
          }
        >
          <LazySecurityScanTool />
        </Suspense>
        <ToolSeoContent toolId="security-scan" />
      </div>
    </AppPageLayout>
  );
}
