/** Central site configuration — URLs, branding, and default SEO values. */
import { resolveCanonicalSiteUrl } from "@/config/canonical-site-url";

export const SITE = {
  name: "Scanonix",
  tagline: "Free Online PDF, Image & AI Document Tools",
  description:
    "Free online PDF, image, and AI document tools. Merge, split, compress, convert, OCR, remove backgrounds, and edit files in your browser.",
  url: resolveCanonicalSiteUrl(process.env.NEXT_PUBLIC_SITE_URL),
  locale: "en_GB",
  twitterHandle: "@scanonix",
  supportEmail: "support@scanonix.com",
  defaultOgImage: "/og-scanonix.png",
  defaultOgImageAlt: "Scanonix — Online PDF, Image and AI Document Tools",
  ogImageWidth: 1200,
  ogImageHeight: 630,
} as const;

export const PLAY_STORE_URL =
  "https://play.google.com/store/apps/details?id=com.scanonix.app";
