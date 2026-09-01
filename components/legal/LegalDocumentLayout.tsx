import Link from "next/link";
import type { LegalSection } from "@/lib/legal/content";

interface LegalTableOfContentsProps {
  sections: LegalSection[];
}

export function LegalTableOfContents({ sections }: LegalTableOfContentsProps) {
  return (
    <nav
      aria-label="Table of contents"
      className="hidden lg:block lg:sticky lg:top-28 lg:self-start"
    >
      <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-scanonix-orange">
        On this page
      </p>
      <ul className="space-y-2 border-l border-border pl-4">
        {sections.map((section) => (
          <li key={section.id}>
            <Link
              href={`#${section.id}`}
              className="block py-1 text-sm text-foreground-muted transition-colors hover:text-scanonix-orange focus-visible:text-scanonix-orange focus-visible:outline-none"
            >
              {section.title}
            </Link>
          </li>
        ))}
      </ul>
    </nav>
  );
}

interface LegalDocumentBodyProps {
  sections: LegalSection[];
}

export function LegalDocumentBody({ sections }: LegalDocumentBodyProps) {
  return (
    <div className="space-y-10">
      {sections.map((section) => (
        <section
          key={section.id}
          id={section.id}
          aria-labelledby={`${section.id}-heading`}
          className="scroll-mt-28"
        >
          <h2
            id={`${section.id}-heading`}
            className="text-xl font-semibold text-foreground sm:text-2xl"
          >
            {section.title}
          </h2>
          <div className="mt-4 space-y-4">
            {section.paragraphs.map((paragraph, index) => (
              <p
                key={`${section.id}-p-${index}`}
                className="text-sm leading-relaxed text-foreground-muted sm:text-base"
              >
                {paragraph}
              </p>
            ))}
            {section.listItems && section.listItems.length > 0 && (
              <ul className="list-disc space-y-2 pl-5 text-sm leading-relaxed text-foreground-muted sm:text-base">
                {section.listItems.map((item, index) => (
                  <li key={`${section.id}-li-${index}`}>{item}</li>
                ))}
              </ul>
            )}
          </div>
        </section>
      ))}
    </div>
  );
}

interface LegalDocumentLayoutProps {
  title: string;
  description: string;
  lastUpdated: string;
  sections: LegalSection[];
}

export function LegalDocumentLayout({
  title,
  description,
  lastUpdated,
  sections,
}: LegalDocumentLayoutProps) {
  return (
    <article>
      <header className="mb-10 max-w-3xl border-b border-border pb-8 sm:mb-12">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-scanonix-orange">
          Legal
        </p>
        <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
          {title}
        </h1>
        <p className="mt-4 text-base leading-relaxed text-foreground-muted sm:text-lg">
          {description}
        </p>
        <p className="mt-4 text-sm text-foreground-muted">
          Last updated:{" "}
          <time dateTime="2026-07-14">{lastUpdated}</time>
        </p>
        <div className="mt-6 rounded-xl border border-yellow-500/30 bg-yellow-500/10 px-4 py-3 text-sm leading-relaxed text-foreground">
          This document may require final review by qualified legal counsel
          before publication.
        </div>
      </header>

      <div className="grid gap-10 lg:grid-cols-[220px_minmax(0,1fr)] lg:gap-14 xl:grid-cols-[240px_minmax(0,1fr)]">
        <LegalTableOfContents sections={sections} />
        <div className="glass-card rounded-2xl p-6 sm:p-8 lg:p-10">
          <LegalDocumentBody sections={sections} />
        </div>
      </div>
    </article>
  );
}
