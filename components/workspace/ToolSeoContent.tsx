import Link from "next/link";
import { getRelatedTools, getToolSeo, type ToolSeoEntry } from "@/constants/tool-seo";

interface ToolSeoContentProps {
  toolId: string;
  /** `panel` is the default boxed article. `editorial` is opt-in and used by the Merge PDF prototype. */
  variant?: "panel" | "editorial";
  /** Visible editorial title. Does not replace SEO data, schema, or the page H1. */
  editorialIntro?: {
    eyebrow: string;
    heading: string;
  };
}

function SeoSection({
  title,
  children,
  ruled = true,
}: {
  title: string;
  children: React.ReactNode;
  ruled?: boolean;
}) {
  return (
    <section
      className={
        ruled
          ? "border-t border-border pt-10 first:border-t-0 first:pt-0"
          : "pt-12 first:pt-0"
      }
    >
      <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
        {title}
      </h2>
      <div className="mt-4 text-sm leading-relaxed text-foreground-muted sm:text-base">
        {children}
      </div>
    </section>
  );
}

export function ToolSeoContent({
  toolId,
  variant = "panel",
  editorialIntro,
}: ToolSeoContentProps) {
  const tool = getToolSeo(toolId);
  const relatedTools = getRelatedTools(toolId);

  if (variant === "editorial") {
    return (
      <aside
        aria-label={`About ${tool.h1}`}
        className="mt-20 sm:mt-36 lg:mt-[30rem]"
      >
        <header className="max-w-3xl">
          {editorialIntro ? (
            <>
              <p className="text-[11px] font-semibold uppercase tracking-[0.14em] text-scanonix-muted">
                {editorialIntro.eyebrow}
              </p>
              <h2 className="mt-2 text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
                {editorialIntro.heading}
              </h2>
            </>
          ) : (
            <h2 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              {tool.h1}
            </h2>
          )}
          <p className="mt-4 text-sm leading-relaxed text-foreground-muted sm:text-base">
            {tool.pageDescription}
          </p>
        </header>

        <div className="mt-12 space-y-0">
          <SeoSection title={`How to use ${tool.h1}`} ruled={false}>
            <ol className="list-decimal space-y-2 pl-5">
              {tool.howToSteps.map((step) => (
                <li key={step}>{step}</li>
              ))}
            </ol>
          </SeoSection>

          <SeoSection title={`Why use Scanonix ${tool.h1}`} ruled={false}>
            <ul className="list-disc space-y-2 pl-5">
              {tool.whyUse.map((item) => (
                <li key={item}>{item}</li>
              ))}
            </ul>
          </SeoSection>

          {tool.useCases && tool.useCases.length > 0 && (
            <SeoSection title="Common use cases" ruled={false}>
              <ul className="list-disc space-y-2 pl-5">
                {tool.useCases.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </SeoSection>
          )}

          {tool.limitations && tool.limitations.length > 0 && (
            <SeoSection title="Good to know" ruled={false}>
              <ul className="list-disc space-y-2 pl-5">
                {tool.limitations.map((item) => (
                  <li key={item}>{item}</li>
                ))}
              </ul>
            </SeoSection>
          )}

          <SeoSection title="Key features" ruled={false}>
            <ul className="grid gap-x-8 gap-y-2 sm:grid-cols-2">
              {tool.keyFeatures.map((feature) => (
                <li key={feature} className="flex items-start gap-2.5 py-1">
                  <span
                    className="mt-2 h-1.5 w-1.5 shrink-0 rounded-full bg-scanonix-orange"
                    aria-hidden="true"
                  />
                  <span>{feature}</span>
                </li>
              ))}
            </ul>
          </SeoSection>

          {tool.faqs.length > 0 && (
            <SeoSection title="Frequently asked questions" ruled={false}>
              <dl className="space-y-6">
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
            <SeoSection title="Related tools" ruled={false}>
              <ul className="grid gap-2 sm:grid-cols-2">
                {relatedTools.map((related) => (
                  <li key={related.id}>
                    <Link
                      href={related.path}
                      className="home-btn-interactive block rounded-xl px-3 py-3 transition-colors hover:bg-brand-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-scanonix-orange/40"
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
        </div>
      </aside>
    );
  }

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
