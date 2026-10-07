import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { HomeQuickSuggestions } from "@/components/home/HomeQuickSuggestions";
import { HomeToolDiscovery } from "@/components/home/HomeToolDiscovery";
import { ScanonixProPromo } from "@/components/home/ScanonixProPromo";
import { HomeHero } from "@/components/sections/HomeHero";
import { getPopularTools } from "@/constants/homepage-tools";
import {
  createPageMetadata,
  createSoftwareApplicationJsonLd,
  createWebSiteJsonLd,
} from "@/lib/utils/seo";
import type { Metadata } from "next";

export const metadata: Metadata = createPageMetadata({
  title: "Free Online PDF, Image & AI Document Tools | Scanonix",
  description:
    "Free online PDF, image, and AI document tools. Merge, split, compress, convert, OCR, and edit files in your browser with Scanonix.",
  path: "/",
  keywords: [
    "PDF tools",
    "merge PDF",
    "compress PDF",
    "PDF to Word",
    "Word to PDF",
    "image tools",
    "image compressor",
    "OCR",
    "AI document tools",
    "online tools",
    "Scanonix",
  ],
});

const websiteJsonLd = createWebSiteJsonLd();
const softwareApplicationJsonLd = createSoftwareApplicationJsonLd();

export default function Home() {
  const popularTools = getPopularTools();

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(websiteJsonLd) }}
      />
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(softwareApplicationJsonLd) }}
      />
      <Navbar />
      <main className="tool-finder-page relative z-10 overflow-x-hidden bg-background">
        <HomeHero />
        <HomeToolDiscovery tools={popularTools} />
        <HomeQuickSuggestions />
        <ScanonixProPromo />
      </main>
      <Footer finderClearance />
    </>
  );
}
