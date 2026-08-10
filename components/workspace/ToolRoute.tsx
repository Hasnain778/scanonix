import { type ReactNode } from "react";
import { ToolUsageHeader } from "@/components/plan/ToolUsageHeader";
import { getToolSeo } from "@/constants/tool-seo";
import { env } from "@/config/env";
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
          __html: JSON.stringify(
            createBreadcrumbJsonLd([
              { name: "Home", url: env.siteUrl },
              { name: "Tools", url: `${env.siteUrl}/tools` },
              { name: tool.h1, url: `${env.siteUrl}${tool.path}` },
            ]),
          ),
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
        />
        <ToolUsageHeader />
        {children}
        {showSeoContent ? <ToolSeoContent toolId={toolId} /> : null}
      </ToolLayout>
    </ToolShell>
  );
}
