import { ContactForm } from "@/components/contact/ContactForm";
import { ToolShell } from "@/components/tools/ToolShell";
import { CONTACT_CATEGORIES, SUPPORT_EMAIL } from "@/lib/legal/content";
import { createPageMetadata } from "@/lib/utils/seo";

export const metadata = createPageMetadata({
  title: "Contact Scanonix — Support & Enquiries",
  description:
    "Contact Scanonix for technical support, billing questions, feature requests, business enquiries, and privacy requests.",
  path: "/contact",
  keywords: [
    "Contact Scanonix",
    "Scanonix support",
    "document tools support",
    "Scanonix help",
  ],
});

export default function ContactPage() {
  return (
    <ToolShell>
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <header className="mb-10 max-w-3xl sm:mb-12">
          <p className="mb-4 text-xs font-semibold uppercase tracking-[0.25em] text-scanonix-orange">
            Support
          </p>
          <h1 className="text-balance text-3xl font-bold tracking-tight text-foreground sm:text-4xl lg:text-5xl">
            Contact Scanonix
          </h1>
          <p className="mt-4 text-base leading-relaxed text-foreground-muted sm:text-lg">
            Need help with a tool, billing, a feature idea, or a privacy request?
            Send us a message and we will get back to you as soon as we can.
          </p>
        </header>

        <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:gap-12">
          <div className="glass-card rounded-2xl p-6 sm:p-8">
            <ContactForm />
          </div>

          <aside className="space-y-6">
            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-foreground">Support email</h2>
              <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
                Prefer email? Reach us directly at:
              </p>
              <a
                href={`mailto:${SUPPORT_EMAIL}`}
                className="mt-3 inline-flex text-base font-semibold text-scanonix-orange transition-colors hover:text-scanonix-orange-light"
              >
                {SUPPORT_EMAIL}
              </a>
            </div>

            <div className="glass-card rounded-2xl p-6">
              <h2 className="text-lg font-semibold text-foreground">
                Support categories
              </h2>
              <ul className="mt-4 space-y-3">
                {CONTACT_CATEGORIES.map((category) => (
                  <li
                    key={category.value}
                    className="flex items-start gap-3 text-sm text-foreground-muted"
                  >
                    <span className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-scanonix-orange" />
                    {category.label}
                  </li>
                ))}
              </ul>
            </div>

            <div className="rounded-2xl border border-border bg-surface-muted p-6">
              <h2 className="text-sm font-semibold uppercase tracking-[0.15em] text-foreground">
                Response times
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-foreground-muted">
                We aim to respond to most enquiries within two business days.
                Billing and privacy requests may require additional verification.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </ToolShell>
  );
}
