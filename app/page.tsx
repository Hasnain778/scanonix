import { Footer } from "@/components/layout/Footer";
import { Navbar } from "@/components/layout/Navbar";
import { PopularToolsSection, ToolCategoriesSection } from "@/components/home/PopularToolsSection";
import { ScanonixProPromo } from "@/components/home/ScanonixProPromo";
import { HomeHero } from "@/components/sections/HomeHero";
import {
  createPageMetadata,
  createSoftwareApplicationJsonLd,
  createWebSiteJsonLd,
} from "@/lib/utils/seo";
import type { Metadata } from "next";

export const metadata: Metadata = createPageMetadata({
  title: "Free Online PDF, Image & AI Document Tools | Scanonix",
  description:
    "Free online PDF, image, and AI document tools. Merge, split, compress, convert, OCR, remove backgrounds, and edit files in your browser with Scanonix.",
  path: "/",
  keywords: [
    "PDF tools",
    "merge PDF",
    "compress PDF",
    "PDF to Word",
    "Word to PDF",
    "image tools",
    "background remover",
    "OCR",
    "AI document tools",
    "online tools",
    "Scanonix",
  ],
});

const websiteJsonLd = createWebSiteJsonLd();
const softwareApplicationJsonLd = createSoftwareApplicationJsonLd();

export default function Home() {
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
      <main className="relative z-10 bg-[#0a0a0a]">
        <HomeHero />
        <PopularToolsSection />
        <ToolCategoriesSection />
        <ScanonixProPromo />
      </main>
      <Footer />
    </>
  );
}
