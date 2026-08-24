import Link from "next/link";
import { ConsentPreferencesLink } from "@/components/analytics/ConsentPreferencesLink";
import { FooterSocialLinks } from "@/components/layout/FooterSocialLinks";
import { BrandLockup } from "@/components/ui/BrandLockup";
import { PLAY_STORE_URL } from "@/config/site";
import { getToolsCategoryHref } from "@/lib/navigation/tool-category-urls";

const PRODUCT_LINKS = [
  { label: "All Tools", href: getToolsCategoryHref("all") },
  { label: "PDF Tools", href: getToolsCategoryHref("pdf") },
  { label: "Image Tools", href: getToolsCategoryHref("image") },
  { label: "AI Tools", href: getToolsCategoryHref("ai") },
  { label: "Security Tools", href: getToolsCategoryHref("security") },
  { label: "Pricing", href: "/pricing" },
] as const;

const COMPANY_LINKS = [
  { label: "Contact", href: "/contact" },
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const;

const ACCOUNT_LINKS = [
  { label: "Dashboard", href: "/dashboard" },
  { label: "Billing", href: "/account/billing" },
  { label: "Settings", href: "/account/settings" },
  { label: "Sign In", href: "/login" },
] as const;

function FooterColumn({
  title,
  links,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
}) {
  return (
    <div>
      <h3 className="text-sm font-semibold text-white">{title}</h3>
      <ul className="mt-4 space-y-3">
        {links.map((link) => (
          <li key={link.label}>
            <Link
              href={link.href}
              className="text-sm text-scanonix-muted transition-colors duration-200 hover:text-scanonix-orange"
            >
              {link.label}
            </Link>
          </li>
        ))}
        {title === "Company" ? (
          <li>
            <ConsentPreferencesLink />
          </li>
        ) : null}
      </ul>
    </div>
  );
}

export function Footer() {
  const currentYear = new Date().getFullYear();

  return (
    <footer className="relative border-t border-white/8 bg-[#060606]">
      <div className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-scanonix-orange/35 to-transparent" />

      <div className="page-container py-16 sm:py-20">
        <div className="grid gap-10 lg:grid-cols-12 lg:gap-8">
          <div className="lg:col-span-4">
            <Link
              href="/"
              className="group inline-flex min-w-0 items-center"
              aria-label="SCANONIX home"
            >
              <BrandLockup variant="footer" decorative />
            </Link>
            <p className="mt-5 max-w-sm text-sm leading-relaxed text-scanonix-muted">
              Free online tools for PDFs, images, AI documents, and file protection.
            </p>
            <FooterSocialLinks />
            <a
              href={PLAY_STORE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="home-btn-interactive mt-5 inline-flex items-center gap-2 rounded-xl border border-white/10 bg-white/[0.03] px-4 py-2.5 text-sm font-medium text-white transition-colors hover:border-scanonix-orange/35 hover:bg-scanonix-orange/5"
            >
              <svg className="h-4 w-4 text-scanonix-orange" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                <path d="M3.6 1.8A1.8 1.8 0 012 3.4v17.2a1.8 1.8 0 001.6 1.6l10.2-9.8L3.6 1.8zm11.8 8.4l2.8 2.7 2.8-1.6c.9-.5.9-1.7 0-2.2l-2.8-1.6-2.8 2.7zM15.4 12 5.2 21.8c.3.1.7 0 1-.2l10.2-5.9-1-3.7zM5.2 2.2l10.2 5.9 1-3.7L6.2 2c-.3-.2-.7-.3-1-.2z" />
              </svg>
              Get the Android app
            </a>
          </div>

          <div className="grid grid-cols-2 gap-8 sm:grid-cols-3 lg:col-span-8">
            <FooterColumn title="Product" links={PRODUCT_LINKS} />
            <FooterColumn title="Company" links={COMPANY_LINKS} />
            <FooterColumn title="Account" links={ACCOUNT_LINKS} />
          </div>
        </div>

        <div className="mt-12 border-t border-white/8 pt-8">
          <p className="text-center text-sm text-scanonix-muted">
            © {currentYear} Scanonix. All rights reserved.{" "}
            <span className="text-scanonix-muted/50">|</span> Privacy-first processing.{" "}
            <span className="text-scanonix-muted/50">|</span> Secure payments by Stripe.
          </p>
        </div>
      </div>
    </footer>
  );
}
