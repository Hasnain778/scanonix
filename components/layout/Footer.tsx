import type { ReactNode } from "react";
import Link from "next/link";
import { ConsentPreferencesLink } from "@/components/analytics/ConsentPreferencesLink";
import { FooterSocialLinks } from "@/components/layout/FooterSocialLinks";
import { PlayStoreLink } from "@/components/marketing/PlayStoreLink";
import { BrandLockup } from "@/components/ui/BrandLockup";
import { getToolsCategoryHref } from "@/lib/navigation/tool-category-urls";

const PRODUCT_LINKS = [
  { label: "Home", href: "/" },
  { label: "All Tools", href: getToolsCategoryHref("all") },
  { label: "Pricing", href: "/pricing" },
  { label: "Dashboard", href: "/dashboard" },
] as const;

const DISCOVER_LINKS = [
  { label: "PDF Tools", href: getToolsCategoryHref("pdf") },
  { label: "Image Tools", href: getToolsCategoryHref("image") },
  { label: "AI Tools", href: getToolsCategoryHref("ai") },
  { label: "Security Tools", href: getToolsCategoryHref("security") },
] as const;

const LEGAL_LINKS = [
  { label: "Privacy", href: "/privacy" },
  { label: "Terms", href: "/terms" },
] as const;

function FooterColumn({
  title,
  links,
  children,
}: {
  title: string;
  links: readonly { label: string; href: string }[];
  children?: ReactNode;
}) {
  return (
    <nav aria-label={title}>
      <h2 className="site-footer__heading">{title}</h2>
      <ul className="site-footer__links">
        {links.map((link) => (
          <li key={link.href + link.label}>
            <Link href={link.href} className="site-footer__link">
              {link.label}
            </Link>
          </li>
        ))}
        {children}
      </ul>
    </nav>
  );
}

export function Footer({ finderClearance = false }: { finderClearance?: boolean }) {
  const currentYear = new Date().getFullYear();

  return (
    <footer className={finderClearance ? "site-footer tool-finder-page-end" : "site-footer"}>
      <div className="page-container site-footer__inner">
        <div className="site-footer__main">
          <div className="site-footer__brand">
            <Link href="/" className="inline-flex" aria-label="SCANONIX home">
              <BrandLockup variant="footer" decorative />
            </Link>
            <p className="site-footer__statement">
              Free online tools for PDFs, images, AI documents, and file protection.
            </p>
          </div>

          <FooterColumn title="Product" links={PRODUCT_LINKS} />
          <FooterColumn title="Discover" links={DISCOVER_LINKS} />
          <FooterColumn title="Legal" links={LEGAL_LINKS}>
            <li>
              <ConsentPreferencesLink className="site-footer__link" />
            </li>
          </FooterColumn>

          <div className="site-footer__store">
            <h2 className="site-footer__heading">Get Scanonix</h2>
            <p className="site-footer__statement">
              Scan and work with documents on Android.
            </p>
            <PlayStoreLink
              location="footer"
              variant="badge"
              badgeHeight={68}
              className="site-footer__play"
            />
          </div>
        </div>

        <div className="site-footer__bottom">
          <p className="site-footer__legal">© {currentYear} Scanonix</p>
          <div className="site-footer__bottom-end">
            <Link href="/contact" className="site-footer__link">
              Contact
            </Link>
            <FooterSocialLinks />
          </div>
        </div>
      </div>
    </footer>
  );
}
