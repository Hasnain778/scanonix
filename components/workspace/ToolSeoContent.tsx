import Link from "next/link";
import { getRelatedTools, getToolSeo, type ToolSeoEntry } from "@/constants/tool-seo";

interface ToolSeoContentProps {
  toolId: string;
}

function SeoSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="border-t border-border pt-10 first:border-t-0 first:pt-0">
      <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-relaxed text-foreground-muted sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function ToolSeoContent({ toolId }: ToolSeoContentProps) {
  const tool = getToolSeo(toolId);
  const relatedTools = getRelatedTools(toolId);

  return (
    <aside
      aria-label={`About ${tool.h1}`}
      className="mt-14 space-y-10 rounded-2xl border border-border bg-surface-raised p-6 sm:mt-16 sm:p-8"
    >
      <div className="border-b border-border pb-10">
        <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
          {tool.h1}
        </h2>
        <p className="mt-4 text-sm leading-relaxed text-foreground-muted sm:text-base">
          {tool.pageDescription}
        </p>
      </div>

      <SeoSection title={`How to use ${tool.h1}`}>
        <ol className="list-decimal space-y-2 pl-5">
          {tool.howToSteps.map((step) => (
            <li key={step}>{step}</li>
          ))}
        </ol>
      </SeoSection>

      <SeoSection title={`Why use Scanonix ${tool.h1}`}>
        <ul className="list-disc space-y-2 pl-5">
          {tool.whyUse.map((item) => (
            <li key={item}>{item}</li>
          ))}
        </ul>
      </SeoSection>

      {tool.useCases && tool.useCases.length > 0 && (
        <SeoSection title="Common use cases">
          <ul className="list-disc space-y-2 pl-5">
            {tool.useCases.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SeoSection>
      )}

      {tool.limitations && tool.limitations.length > 0 && (
        <SeoSection title="Good to know">
          <ul className="list-disc space-y-2 pl-5">
            {tool.limitations.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ul>
        </SeoSection>
      )}

      <SeoSection title="Key features">
        <ul className="grid gap-2 sm:grid-cols-2">
          {tool.keyFeatures.map((feature) => (
            <li
              key={feature}
              className="flex items-start gap-2 rounded-lg border border-border bg-surface px-3 py-2"
            >
              <span
                className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-scanonix-orange"
                aria-hidden="true"
              />
              <span>{feature}</span>
            </li>
          ))}
        </ul>
      </SeoSection>

      {tool.faqs.length > 0 && (
        <SeoSection title="Frequently asked questions">
          <dl className="space-y-5">
            {tool.faqs.map((faq) => (
              <div key={faq.question}>
                <dt className="font-medium text-foreground">{faq.question}</dt>
                <dd className="mt-1.5">{faq.answer}</dd>
              </div>
            ))}
          </dl>
        </SeoSection>
      )}

      {relatedTools.length > 0 && (
        <SeoSection title="Related tools">
          <ul className="grid gap-3 sm:grid-cols-2">
            {relatedTools.map((related) => (
              <li key={related.id}>
                <Link
                  href={related.path}
                  className="home-btn-interactive block rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:border-scanonix-orange/40 hover:bg-brand-soft"
                >
                  <span className="font-medium text-foreground">{related.h1}</span>
                  <span className="mt-1 block text-sm text-foreground-muted">
                    {related.metaDescription.slice(0, 90)}
                    {related.metaDescription.length > 90 ? "…" : ""}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </SeoSection>
      )}
    </aside>
  );
}

export function getToolSeoForJsonLd(toolId: string): ToolSeoEntry {
  return getToolSeo(toolId);
}
