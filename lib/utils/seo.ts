import type { Metadata } from "next";
import { SITE, PLAY_STORE_URL } from "@/config/site";

export interface PageSeoOptions {
  title: string;
  description: string;
  path?: string;
  ogImage?: string;
  noIndex?: boolean;
  keywords?: string[];
  type?: "website" | "article";
}

export function createPageMetadata(options: PageSeoOptions): Metadata {
  const {
    title,
    description,
    path = "",
    ogImage = SITE.defaultOgImage,
    noIndex = false,
    keywords,
    type = "website",
  } = options;

  const url = `${SITE.url}${path}`;
  const fullTitle = title.includes(SITE.name)
    ? title
    : `${title} | ${SITE.name}`;

  return {
    metadataBase: new URL(SITE.url),
    title: { absolute: fullTitle },
    description,
    keywords,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : { index: true, follow: true },
    openGraph: {
      title: fullTitle,
      description,
      url,
      siteName: SITE.name,
      locale: SITE.locale,
      type,
      images: [{ url: ogImage, width: 1200, height: 630, alt: fullTitle }],
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
      site: SITE.twitterHandle,
      images: [ogImage],
    },
  };
}

export function createOrganizationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: SITE.name,
    url: SITE.url,
    logo: `${SITE.url}/icon.png`,
  };
}

export function createWebSiteJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    name: SITE.name,
    url: SITE.url,
  };
}

export function createSoftwareApplicationJsonLd() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: SITE.name,
    url: SITE.url,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web, Android",
    installUrl: PLAY_STORE_URL,
    sameAs: [PLAY_STORE_URL],
    description:
      "Free online PDF, image, and AI document tools — merge, split, compress, convert, OCR, and more in your browser.",
  };
}

export function createFaqJsonLd(faqs: Array<{ question: string; answer: string }>) {
  if (faqs.length === 0) return null;

  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: faqs.map((faq) => ({
      "@type": "Question",
      name: faq.question,
      acceptedAnswer: {
        "@type": "Answer",
        text: faq.answer,
      },
    })),
  };
}

/** @deprecated Use createSoftwareApplicationJsonLd */
export function createWebApplicationJsonLd() {
  return createSoftwareApplicationJsonLd();
}

export function createToolJsonLd(tool: {
  name: string;
  description: string;
  url: string;
}) {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: tool.name,
    description: tool.description,
    url: tool.url,
    applicationCategory: "UtilitiesApplication",
    operatingSystem: "Web",
    isPartOf: {
      "@type": "SoftwareApplication",
      name: SITE.name,
      url: SITE.url,
    },
  };
}

export function createBreadcrumbJsonLd(
  items: Array<{ name: string; url: string }>,
) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, index) => ({
      "@type": "ListItem",
      position: index + 1,
      name: item.name,
      item: item.url,
    })),
  };
}
